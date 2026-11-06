// Shared parsing for the cracked-engineer scripts. This file is the one owner of every file format they read.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const CONCEPTS = ['capacity', 'latency', 'consistency', 'recovery', 'edge', 'modules', 'database', 'cache', 'jobs', 'calls', 'security', 'operations'];
export const LEVELS = ['architecture', 'permission', 'type', 'lint', 'test', 'doc'];
export const LABEL_RE = /\b(MEASURED|TARGET|GUESS|DERIVED)\b/;
export const PLACEHOLDER_RE = /<[a-z][a-z0-9 ,./-]*>/;
export const ID_RE = /^[a-z0-9][a-z0-9_]*$/;
export const RULE_ID_RE = /^[A-Z]+[0-9]+$/;
export const MANIFEST = 'tests/red/manifest.tsv';
export const LOG = 'tests/red/LOG.md';
export const RESTORE_DIR = '.cracked/.restore';
export const MANIFEST_HEADER = ['id', 'rule', 'cmd', 'break', 'expect', 'fast'];
export const LOG_HEADER = ['date', 'test', 'rule', 'commit', 'key', 'green', 'red', 'result'];

export function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, status: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

export const git = (root, args) => sh('git', args, root);

export function findRoot(start = process.cwd()) {
  const r = git(start, ['rev-parse', '--show-toplevel']);
  return r.ok ? r.out : null;
}

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
export const proofKey = (cmd, patch) => sha256(`${cmd}\n${patch}`).slice(0, 12);

export function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function dirtyFiles(root) {
  const r = git(root, ['status', '--porcelain', '--', '.', `:(exclude)${LOG}`, `:(exclude)${RESTORE_DIR}`]);
  return r.ok && r.out ? r.out.split('\n') : [];
}

export function commitRef(root) {
  const head = git(root, ['rev-parse', '--short', 'HEAD']);
  const ref = head.ok ? head.out : 'no-commit';
  return dirtyFiles(root).length ? `${ref}+dirty` : ref;
}

// HTML comments become blank lines, so line numbers stay true.
export function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));
}

// Groups lines under headings of one level. Each body line knows its line number and whether it is inside a code fence.
function group(lines, level) {
  const heading = new RegExp(`^${'#'.repeat(level)}\\s+(.+?)\\s*$`);
  const out = new Map();
  let cur = null;
  let fenced = false;
  for (const { n, text } of lines) {
    const fenceLine = /^\s*(```|~~~)/.test(text);
    if (fenceLine) fenced = !fenced;
    const m = !fenced && !fenceLine ? heading.exec(text) : null;
    if (m) {
      cur = { name: m[1].toLowerCase(), n, body: [] };
      out.set(cur.name, cur);
      continue;
    }
    if (!fenced && !fenceLine && /^#{1,6}\s/.test(text) && text.match(/^#+/)[0].length < level) {
      cur = null;
      continue;
    }
    if (cur) cur.body.push({ n, text, fenced: fenced || fenceLine });
  }
  return out;
}

export function sections(text) {
  return group(stripComments(text).split(/\r?\n/).map((t, i) => ({ n: i + 1, text: t })), 2);
}

export function subsections(body) {
  return group(body, 3);
}

export function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

const isSeparator = (cells) => cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));

export function parseTable(body) {
  let header = null;
  const rows = [];
  for (const { n, text, fenced } of body) {
    const t = text.trim();
    if (fenced || !t.startsWith('|')) {
      if (header) break;
      continue;
    }
    const cells = splitRow(t);
    if (!header) {
      header = { n, cells: cells.map((c) => c.toLowerCase()) };
      continue;
    }
    if (isSeparator(cells)) continue;
    rows.push({ n, cells });
  }
  return { header, rows };
}

export function cellIds(cell) {
  return cell
    .split(',')
    .map((s) => s.replace(/`/g, '').trim())
    .filter((s) => s && s !== '-');
}

export function parseStatus(cell) {
  const s = cell.replace(/`/g, '').trim();
  if (s === 'PROVEN') return { kind: 'PROVEN', reason: '' };
  let m = /^UNTESTED\s*:\s*(.*)$/.exec(s);
  if (m) return { kind: 'UNTESTED', reason: m[1].trim() };
  m = /^N\/A\s*:\s*(.*)$/.exec(s);
  if (m) return { kind: 'N/A', reason: m[1].trim() };
  if (s === 'UNTESTED' || s === 'N/A') return { kind: s, reason: '' };
  return { kind: 'INVALID', reason: s };
}

export const RULE_COLUMNS = ['id', 'rule', 'concept', 'enforcer', 'level', 'check', 'status'];

export function parseSystem(text) {
  const result = { draft: /<!--\s*cracked:\s*draft\s*-->/i.test(text), sections: sections(text), rules: [], rulesHeader: null, missingColumns: [] };
  const sec = result.sections.get('rules');
  if (!sec) return result;
  const { header, rows } = parseTable(sec.body);
  result.rulesHeader = header;
  if (!header) return result;
  const idx = Object.fromEntries(RULE_COLUMNS.map((c) => [c, header.cells.indexOf(c)]));
  result.missingColumns = RULE_COLUMNS.filter((c) => idx[c] < 0);
  if (result.missingColumns.length) return result;
  for (const r of rows) {
    const get = (c) => (r.cells[idx[c]] ?? '').trim();
    result.rules.push({
      n: r.n,
      id: get('id').replace(/`/g, ''),
      text: get('rule'),
      concept: get('concept').toLowerCase(),
      enforcer: get('enforcer'),
      level: get('level').toLowerCase(),
      checks: cellIds(get('check')),
      status: parseStatus(get('status')),
      raw: r.cells.join(' | '),
    });
  }
  return result;
}

export function readManifest(root) {
  const file = path.join(root, MANIFEST);
  const res = { file, rows: [], errors: [], exists: fs.existsSync(file) };
  if (!res.exists) return res;
  let header = false;
  read(file)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim() || line.startsWith('#')) return;
      const f = line.split('\t');
      if (!header) {
        header = true;
        if (f.map((x) => x.trim()).join('\t') !== MANIFEST_HEADER.join('\t')) {
          res.errors.push({ n: i + 1, msg: `the header must be these fields, separated by tabs: ${MANIFEST_HEADER.join(', ')}.` });
        }
        return;
      }
      if (f.length !== MANIFEST_HEADER.length) {
        res.errors.push({ n: i + 1, msg: `expected ${MANIFEST_HEADER.length} tab-separated fields, found ${f.length}.` });
        return;
      }
      const [id, rule, cmd, brk, expect, fast] = f.map((x) => x.trim());
      res.rows.push({ n: i + 1, id, rule, cmd, brk, expect: expect === '-' ? '' : expect, fast: fast.toLowerCase() });
    });
  return res;
}

export function readLog(root) {
  const file = path.join(root, LOG);
  const text = read(file);
  if (text === null) return { file, rows: [], exists: false };
  const rows = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim().startsWith('|')) return;
    const c = splitRow(line);
    if (c[0].toLowerCase() === 'date' || isSeparator(c) || c.length < LOG_HEADER.length) return;
    rows.push({ n: i + 1, date: c[0], test: c[1], rule: c[2], commit: c[3], key: c[4], green: c[5], red: c[6], result: c[7] });
  });
  return { file, rows, exists: true };
}

export function latestByTest(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.test, r);
  return m;
}
