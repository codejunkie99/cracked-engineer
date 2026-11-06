#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import * as L from './lib.mjs';

const USAGE = `check_system: check SYSTEM.md, MODULES.md, and the red test files.

Usage:
  node .cracked/check_system.mjs            report problems. A draft SYSTEM.md is allowed.
  node .cracked/check_system.mjs --strict   also fail on a draft, a placeholder, or a missing concept.

Prints one line per problem as file:line: error|warning: text. Exits 1 when there is an error.`;

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
const strict = args.includes('--strict');
const root = L.findRoot() ?? process.cwd();
const problems = [];
const add = (level, file, n, msg) => problems.push({ level, file, n, msg });
const error = (file, n, msg) => add('error', file, n, msg);
const warning = (file, n, msg) => add('warning', file, n, msg);
const strictError = (file, n, msg) => add(strict ? 'error' : 'warning', file, n, msg);
const SYS = 'SYSTEM.md';
const MOD = 'MODULES.md';
const isPlaceholder = (s) => L.PLACEHOLDER_RE.test(s);
const short = (s) => (s.length > 90 ? `${s.slice(0, 87)}...` : s).trim();

function report() {
  problems.sort((a, b) => a.file.localeCompare(b.file) || a.n - b.n);
  for (const p of problems) console.log(`${p.file}:${p.n}: ${p.level}: ${p.msg}`);
  const errors = problems.filter((p) => p.level === 'error').length;
  const warnings = problems.length - errors;
  console.log(`check_system: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}${strict ? ' (strict)' : ''}.`);
  process.exit(errors ? 1 : 0);
}

const sysText = L.read(path.join(root, SYS));
if (sysText === null) {
  error(SYS, 1, 'not found. Run the intake or audit playbook of cracked-engineer.');
  report();
}
const sys = L.parseSystem(sysText);
const manifest = L.readManifest(root);
const log = L.readLog(root);
const latest = L.latestByTest(log.rows);
const manifestById = new Map(manifest.rows.map((r) => [r.id, r]));

if (sys.draft) {
  const n = sysText.split('\n').findIndex((l) => /cracked:\s*draft/i.test(l)) + 1;
  strictError(SYS, n, 'SYSTEM.md is a draft. Delete the draft line when every section is complete.');
}

for (const name of ['intake', 'targets', 'data', 'concepts', 'rules']) {
  if (!sys.sections.has(name)) error(SYS, 1, `the section "## ${name}" is missing.`);
}

const placeholderLines = [];
for (const sec of sys.sections.values()) {
  for (const l of sec.body) if (!l.fenced && isPlaceholder(l.text)) placeholderLines.push(l);
}
if (strict) for (const l of placeholderLines) error(SYS, l.n, `replace the placeholder: ${short(l.text)}`);
else if (placeholderLines.length) warning(SYS, placeholderLines[0].n, `${placeholderLines.length} line${placeholderLines.length === 1 ? ' has' : 's have'} a <placeholder>. The first one is here.`);

// Every number in intake and targets carries a label.
for (const name of ['intake', 'targets']) {
  const sec = sys.sections.get(name);
  if (!sec) continue;
  for (const { n, text, fenced } of sec.body) {
    if (fenced || !/^\s*[-*]\s/.test(text)) continue;
    const probe = text
      .replace(/^\s*[-*]\s+/, '')
      .replace(/`[^`]*`/g, '')
      .replace(/\bp\d{2,3}(\.\d+)?\b/gi, '');
    if (/\d/.test(probe) && !L.LABEL_RE.test(text)) {
      error(SYS, n, `a number with no label. Add MEASURED: <log path>, TARGET, GUESS, or DERIVED: ${short(text)}`);
    }
  }
}

// A MEASURED number names a run log that exists.
for (const name of ['intake', 'targets', 'data']) {
  const sec = sys.sections.get(name);
  if (!sec) continue;
  for (const { n, text, fenced } of sec.body) {
    if (fenced) continue;
    for (const m of text.matchAll(/\bMEASURED\b\s*:?\s*([^\s,;)]*)/g)) {
      const p = m[1].replace(/`/g, '');
      if (!p || !/[/.]/.test(p)) error(SYS, n, 'MEASURED needs the path of its run log, for example "MEASURED: out/load/2026-11-06.txt".');
      else if (!fs.existsSync(path.join(root, p))) error(SYS, n, `MEASURED points to ${p}, which does not exist.`);
    }
  }
}

// Every concept is decided or skipped with a reason.
const conceptsSec = sys.sections.get('concepts');
if (conceptsSec) {
  const seen = new Set();
  for (const { n, text, fenced } of conceptsSec.body) {
    if (fenced) continue;
    const m = /^\s*[-*]\s+([A-Za-z]+)\s*:\s*(.*)$/.exec(text);
    if (!m) continue;
    const name = m[1].toLowerCase();
    const value = m[2].trim();
    if (!L.CONCEPTS.includes(name)) {
      warning(SYS, n, `"${name}" is not a concept. The concepts are: ${L.CONCEPTS.join(', ')}.`);
      continue;
    }
    if (seen.has(name)) warning(SYS, n, `the concept "${name}" is listed more than once.`);
    seen.add(name);
    if (/^decided\b/i.test(value)) continue;
    const skip = /^skip\s*:\s*(.*)$/i.exec(value);
    if (skip && skip[1].trim()) continue;
    error(SYS, n, `write "decided" or "skip: <reason>" for the concept "${name}".`);
  }
  const missing = L.CONCEPTS.filter((c) => !seen.has(c));
  if (missing.length) strictError(SYS, conceptsSec.n, `these concepts are not listed: ${missing.join(', ')}. Mark each one "decided" or "skip: <reason>".`);
}

// The rules table.
const rulesSec = sys.sections.get('rules');
if (rulesSec && !sys.rulesHeader) error(SYS, rulesSec.n, 'the rules section has no table.');
if (sys.rulesHeader && sys.missingColumns.length) {
  error(SYS, sys.rulesHeader.n, `the rules table needs these columns: ID | Rule | Concept | Enforcer | Level | Check | Status. Missing: ${sys.missingColumns.join(', ')}.`);
}
const ruleIds = new Set();
for (const r of sys.rules) {
  const bad = (msg) => error(SYS, r.n, `${r.id || 'rule'}: ${msg}`);
  if (isPlaceholder(r.raw)) continue;
  if (!L.RULE_ID_RE.test(r.id)) bad('the ID must be letters and then digits, for example R1.');
  if (ruleIds.has(r.id)) bad('this ID is used twice.');
  ruleIds.add(r.id);
  if (!L.CONCEPTS.includes(r.concept)) bad(`"${r.concept}" is not a concept. Use one of: ${L.CONCEPTS.join(', ')}.`);
  if (!L.LEVELS.includes(r.level)) bad(`"${r.level}" is not a level. Use one of: ${L.LEVELS.join(', ')}.`);
  if ((!r.enforcer || r.enforcer === '-') && r.level !== 'doc') bad('name the enforcer: the mechanism that fails when the rule breaks.');
  const st = r.status;
  if (st.kind === 'INVALID') bad(`the status must be PROVEN, UNTESTED: <reason>, or N/A: <reason>. Found "${st.reason}".`);
  if ((st.kind === 'UNTESTED' || st.kind === 'N/A') && !st.reason) bad(`${st.kind} needs a reason after a colon.`);
  if (r.level === 'doc' && st.kind === 'PROVEN') bad('a doc-level rule has nothing that fails. Mark it UNTESTED: <reason>, or move it to a higher level.');
  for (const id of r.checks) if (!manifestById.has(id)) bad(`the check \`${id}\` is not in ${L.MANIFEST}.`);
  if (st.kind === 'N/A' && r.checks.length) warning(SYS, r.n, `${r.id}: an N/A rule lists a check.`);
  if (st.kind !== 'PROVEN') continue;
  if (!r.checks.length) bad('PROVEN needs a check in the Check column.');
  for (const id of r.checks) {
    const row = manifestById.get(id);
    if (!row) continue;
    if (row.rule !== r.id) bad(`the check \`${id}\` belongs to ${row.rule} in the manifest.`);
    const last = latest.get(id);
    const patch = L.read(path.join(root, row.brk));
    const rerun = `Run: node .cracked/red_green.mjs ${id}`;
    if (!last) bad(`PROVEN, but \`${id}\` has no row in ${L.LOG}. ${rerun}`);
    else if (last.result !== 'PASS') bad(`PROVEN, but the last proof of \`${id}\` is ${last.result} (${L.LOG}:${last.n}). ${rerun}`);
    else if (patch !== null && last.key !== L.proofKey(row.cmd, patch)) bad(`the proof of \`${id}\` is stale: its command or break patch changed after ${L.LOG}:${last.n}. ${rerun}`);
  }
}

// The manifest.
if (!manifest.exists) error(L.MANIFEST, 1, 'not found. Run the cracked-engineer install script.');
for (const e of manifest.errors) error(L.MANIFEST, e.n, e.msg);
const testIds = new Set();
for (const row of manifest.rows) {
  const bad = (msg) => error(L.MANIFEST, row.n, `${row.id}: ${msg}`);
  if (!L.ID_RE.test(row.id)) bad('the id must be snake_case: lowercase letters, digits, and underscores.');
  if (testIds.has(row.id)) bad('this id is used twice.');
  testIds.add(row.id);
  if (!ruleIds.has(row.rule)) bad(`the rule ${row.rule} is not in the rules table of SYSTEM.md.`);
  if (!row.cmd) bad('the cmd field is empty.');
  if (!row.brk || row.brk === '-' || row.brk.startsWith('-')) bad('the break field must be the path of a patch.');
  else if (!fs.existsSync(path.join(root, row.brk))) bad(`the break patch ${row.brk} does not exist.`);
  if (!['yes', 'no'].includes(row.fast)) bad('fast must be yes or no.');
  if (!sys.rules.some((r) => r.checks.includes(row.id))) warning(L.MANIFEST, row.n, `${row.id}: no rule lists this test in its Check column.`);
}
if (manifest.rows.length && !log.exists) warning(L.LOG, 1, 'not found. red_green.mjs creates it on the first proof.');

// MODULES.md.
const modText = L.read(path.join(root, MOD));
if (modText === null) {
  strictError(MOD, 1, 'not found. Write a contract for each module that owns money, private data, or external calls.');
} else {
  const REQUIRED = ['owns', 'public interface', 'consistency', 'promises', 'failure behavior', 'the hard part', 'red tests', 'not allowed'];
  const modules = [...L.sections(modText).values()].filter((s) => s.name.startsWith('module:'));
  if (!modules.length) strictError(MOD, 1, 'there is no "## module: <name>" section.');
  for (const m of modules) {
    const name = m.name.slice('module:'.length).trim();
    if (isPlaceholder(name)) {
      strictError(MOD, m.n, 'replace the placeholder module name.');
      continue;
    }
    const subs = L.subsections(m.body);
    for (const req of REQUIRED) {
      const sub = subs.get(req);
      if (!sub) error(MOD, m.n, `module ${name}: the section "### ${req}" is missing.`);
      else if (!sub.body.some((l) => l.text.trim())) error(MOD, sub.n, `module ${name}: the section "### ${req}" is empty.`);
    }
    const tests = subs.get('red tests');
    for (const { n, text } of tests ? tests.body : []) {
      for (const mm of text.matchAll(/`([^`]+)`/g)) {
        if (!isPlaceholder(mm[1]) && !manifestById.has(mm[1])) error(MOD, n, `module ${name}: the red test \`${mm[1]}\` is not in ${L.MANIFEST}.`);
      }
    }
  }
}

const restoreDir = path.join(root, L.RESTORE_DIR);
if (fs.existsSync(restoreDir) && fs.readdirSync(restoreDir).length) {
  warning(L.RESTORE_DIR, 1, 'an interrupted red_green run left a snapshot. Run red_green.mjs once to restore the files.');
}

report();
