#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const USAGE = `install: add cracked-engineer to a repository. It is safe to run again.

Usage:
  node <skill folder>/scripts/install.mjs [repo] [--ci] [--no-hooks]

  repo        the repository folder (default: the current folder). It must be a git repository.
  --ci        also add .github/workflows/cracked-engineer.yml
  --no-hooks  do not add the Claude Code hooks to .claude/settings.json

It copies the scripts to .cracked/, creates SYSTEM.md, MODULES.md, and tests/red/ when they do
not exist, adds the hooks, and adds the design rules to CLAUDE.md (and to AGENTS.md when it
exists). It never overwrites SYSTEM.md, MODULES.md, the manifest, or the log.`;

const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const template = (name) => fs.readFileSync(path.join(SKILL, 'templates', name), 'utf8');
const START = '<!-- cracked-engineer:start -->';
const END = '<!-- cracked-engineer:end -->';

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
const unknown = args.filter((a) => a.startsWith('-') && !['--ci', '--no-hooks'].includes(a));
if (unknown.length) {
  console.error(`install: unknown option ${unknown.join(' ')}\n\n${USAGE}`);
  process.exit(64);
}
const target = path.resolve(args.find((a) => !a.startsWith('-')) ?? '.');
const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: target, encoding: 'utf8' });
if (top.status !== 0) {
  console.error(`install: ${target} is not a git repository. Run "git init" there first. red_green.mjs uses git to apply break patches.`);
  process.exit(64);
}
const root = top.stdout.trim();
const report = [];
const note = (verb, file, extra = '') => report.push(`  ${verb.padEnd(9)} ${file}${extra ? `  (${extra})` : ''}`);
const abs = (rel) => path.join(root, rel);
const read = (rel) => (fs.existsSync(abs(rel)) ? fs.readFileSync(abs(rel), 'utf8') : null);
function write(rel, text, mode) {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), text);
  if (mode) fs.chmodSync(abs(rel), mode);
}

// Tool files: always the skill's current version.
const TOOLS = [
  ['scripts/lib.mjs', '.cracked/lib.mjs', 0o644],
  ['scripts/red_green.mjs', '.cracked/red_green.mjs', 0o755],
  ['scripts/check_system.mjs', '.cracked/check_system.mjs', 0o755],
  ['scripts/hooks/stop.mjs', '.cracked/hooks/stop.mjs', 0o755],
  ['scripts/hooks/guard.mjs', '.cracked/hooks/guard.mjs', 0o755],
  ['templates/ADR.md', '.cracked/templates/ADR.md', 0o644],
  ['templates/PR.md', '.cracked/templates/PR.md', 0o644],
  ['templates/cracked-README.md', '.cracked/README.md', 0o644],
];
for (const [src, dst, mode] of TOOLS) {
  const text = fs.readFileSync(path.join(SKILL, src), 'utf8');
  const old = read(dst);
  if (old === text) continue;
  write(dst, text, mode);
  note(old === null ? 'created' : 'updated', dst);
}

// Project files: created once, then owned by the project.
const SCAFFOLD = [
  ['SYSTEM.md', 'SYSTEM.md'],
  ['MODULES.md', 'MODULES.md'],
  ['manifest.tsv', 'tests/red/manifest.tsv'],
  ['LOG.md', 'tests/red/LOG.md'],
];
for (const [src, dst] of SCAFFOLD) {
  if (read(dst) !== null) {
    note('kept', dst, 'exists');
    continue;
  }
  write(dst, template(src));
  note('created', dst);
}
for (const keep of ['tests/red/breaks/.gitkeep', 'docs/adr/.gitkeep']) {
  if (!fs.existsSync(path.dirname(abs(keep))) || !fs.readdirSync(path.dirname(abs(keep))).length) {
    write(keep, '');
    note('created', keep);
  }
}

function ensureLine(rel, line, why) {
  const text = read(rel) ?? '';
  if (text.split(/\r?\n/).includes(line)) return;
  write(rel, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`);
  note('updated', rel, why);
}
ensureLine('.gitattributes', 'tests/red/LOG.md merge=union', 'LOG.md keeps rows from both branches in a merge');
ensureLine('.gitignore', '.cracked/.restore/', 'red_green snapshots stay local');

// Hooks.
if (!args.includes('--no-hooks')) {
  const rel = '.claude/settings.json';
  const text = read(rel);
  let settings = {};
  let ok = true;
  if (text !== null) {
    try {
      settings = JSON.parse(text);
    } catch {
      ok = false;
      note('skipped', rel, 'not valid JSON. Copy the hooks from templates/claude-settings.json by hand');
    }
  }
  if (ok) {
    const wanted = JSON.parse(template('claude-settings.json')).hooks;
    settings.hooks ??= {};
    const added = [];
    for (const [event, entries] of Object.entries(wanted)) {
      settings.hooks[event] ??= [];
      for (const entry of entries) {
        const marker = /\.cracked\/hooks\/[\w.]+/.exec(entry.hooks[0].command)[0];
        const present = settings.hooks[event].some((e) => (e.hooks ?? []).some((h) => String(h.command ?? '').includes(marker)));
        if (!present) {
          settings.hooks[event].push(entry);
          added.push(event);
        }
      }
    }
    if (added.length) {
      write(rel, `${JSON.stringify(settings, null, 2)}\n`);
      note(text === null ? 'created' : 'updated', rel, `added the ${added.join(' and ')} hook${added.length === 1 ? '' : 's'}`);
    }
  }
}

// The design rules every session reads.
const pointer = `${START}\n${template('session-pointer.md').trim()}\n${END}`;
const contextFiles = ['CLAUDE.md'];
if (read('AGENTS.md') !== null) contextFiles.push('AGENTS.md');
for (const rel of contextFiles) {
  const text = read(rel);
  if (text === null) {
    write(rel, `# Project notes\n\n${pointer}\n`);
    note('created', rel);
    continue;
  }
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  const next = a >= 0 && b > a ? `${text.slice(0, a)}${pointer}${text.slice(b + END.length)}` : `${text}${text.endsWith('\n') ? '' : '\n'}\n${pointer}\n`;
  if (next !== text) {
    write(rel, next);
    note('updated', rel, 'design rules');
  }
}

if (args.includes('--ci')) {
  const rel = '.github/workflows/cracked-engineer.yml';
  if (read(rel) === null) {
    write(rel, template('github-workflow.yml'));
    note('created', rel, 'add your test setup to it');
  } else note('kept', rel, 'exists');
}

console.log(`cracked-engineer installed in ${root}`);
console.log(report.length ? report.join('\n') : '  nothing to change');
console.log('\nNext: run the intake or audit playbook. Check the files with: node .cracked/check_system.mjs');
