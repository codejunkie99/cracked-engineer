#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as L from './lib.mjs';

const USAGE = `red_green: prove that a red test sees its fault.

Usage:
  node .cracked/red_green.mjs <id>      prove one test from tests/red/manifest.tsv
  node .cracked/red_green.mjs --all     prove every test in the manifest
  node .cracked/red_green.mjs --fast    run the fast checks of PROVEN rules once, with no break
  node .cracked/red_green.mjs --list    print the manifest

A proof runs the check without the break (it must pass), applies the break patch, runs the
check again (it must fail, and print the expect text when the manifest gives one), and
restores the files. Each proof appends one row to tests/red/LOG.md.

Exit codes: 0 PASS. 1 NOT GREEN or TIMEOUT. 2 BLIND or WRONG RED. 3 STALE, MISSING, or BAD BREAK.
4 RESTORE FAILED. 64 usage error. --all and --fast exit 1 when any test fails.
CRACKED_TIMEOUT_S sets the time limit for one run of a check, in seconds (default 600).`;

const TIMEOUT_MS = Number(process.env.CRACKED_TIMEOUT_S || 600) * 1000;
const TAIL_LINES = 25;
const EXIT = { PASS: 0, 'NOT GREEN': 1, TIMEOUT: 1, BLIND: 2, 'WRONG RED': 2, STALE: 3, MISSING: 3, 'BAD BREAK': 3, 'RESTORE FAILED': 4 };

let interrupted = false;
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => (interrupted = true));

function die(msg, code) {
  console.error(msg);
  process.exit(code);
}

const firstLine = (s) => (s || '').split('\n').find((l) => l.trim()) || 'no message';

function printTail(output) {
  const lines = output.split('\n').filter((l) => l.trim());
  if (!lines.length) return;
  const shown = lines.slice(-TAIL_LINES);
  if (lines.length > shown.length) console.log(`    ... ${lines.length - shown.length} earlier lines`);
  for (const l of shown) console.log(`    | ${l}`);
}

function run(root, cmd) {
  const t0 = Date.now();
  const r = spawnSync(cmd, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CRACKED_RED_GREEN: '1' },
  });
  const timedOut = Boolean(r.error && r.error.code === 'ETIMEDOUT');
  return { code: r.status, signal: r.signal, timedOut, output: `${r.stdout || ''}${r.stderr || ''}`, secs: ((Date.now() - t0) / 1000).toFixed(1) };
}

const desc = (r) => (r.timedOut ? `timeout ${r.secs}s` : r.code === null ? `signal ${r.signal} ${r.secs}s` : `exit ${r.code} ${r.secs}s`);

function patchFiles(root, brk) {
  const r = L.git(root, ['apply', '--numstat', '-z', brk]);
  if (!r.ok) return { error: `git cannot read the break patch: ${firstLine(r.err)}` };
  const list = [];
  for (const token of r.out.split('\0')) {
    const f = token.split('\t');
    if (f.length < 3) continue;
    if (f[2] === '') return { error: 'the break patch renames a file. Use a patch that only edits, adds, or deletes files.' };
    list.push(f[2]);
  }
  if (!list.length) return { error: 'the break patch changes no files.' };
  if (list.some((p) => p.startsWith('tests/red/'))) {
    return { error: 'the break patch edits tests/red/. A break plants a fault in the code, not in the test.' };
  }
  return { list };
}

function snapshot(root, id, files) {
  const dir = path.join(root, L.RESTORE_DIR, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const entries = files.map((rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return { rel, existed: false };
    const copy = path.join(dir, 'files', rel);
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(abs, copy);
    return { rel, existed: true, sha: L.sha256(fs.readFileSync(abs)), mode: fs.statSync(abs).mode & 0o7777 };
  });
  const snap = { dir, entries };
  saveSnapshot(snap);
  return snap;
}

const saveSnapshot = (snap) => fs.writeFileSync(path.join(snap.dir, 'files.json'), JSON.stringify(snap.entries, null, 2));
const shaOf = (abs) => (fs.existsSync(abs) ? L.sha256(fs.readFileSync(abs)) : null);

// Records the checksums of the broken files, so a later run can tell whether a file still holds the break.
function markBroken(root, snap) {
  for (const e of snap.entries) e.brokenSha = shaOf(path.join(root, e.rel));
  saveSnapshot(snap);
}

function putBack(root, snap, e) {
  const abs = path.join(root, e.rel);
  if (e.existed) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.copyFileSync(path.join(snap.dir, 'files', e.rel), abs);
    fs.chmodSync(abs, e.mode);
  } else {
    fs.rmSync(abs, { force: true });
  }
  return shaOf(abs) === (e.existed ? e.sha : null);
}

function restore(root, snap) {
  const bad = snap.entries.filter((e) => !putBack(root, snap, e)).map((e) => e.rel);
  if (bad.length) return `checksums differ after the restore: ${bad.join(', ')}. The snapshot stays in ${path.relative(root, snap.dir)}.`;
  fs.rmSync(snap.dir, { recursive: true, force: true });
  return null;
}

// A run that was killed can leave a break applied. Restore a file only while it still holds exactly the break.
function recoverInterrupted(root) {
  const base = path.join(root, L.RESTORE_DIR);
  if (!fs.existsSync(base)) return;
  for (const id of fs.readdirSync(base)) {
    const dir = path.join(base, id);
    const meta = L.read(path.join(dir, 'files.json'));
    if (meta === null) continue;
    const snap = { dir, entries: JSON.parse(meta) };
    const unclear = [];
    for (const e of snap.entries) {
      const now = shaOf(path.join(root, e.rel));
      if (now === (e.existed ? e.sha : null)) continue;
      if ('brokenSha' in e && now === e.brokenSha) putBack(root, snap, e);
      else unclear.push(e.rel);
    }
    if (unclear.length) {
      die(`red_green: an interrupted run of ${id} left a snapshot, and these files changed after it: ${unclear.join(', ')}.\nCheck them by hand. The original copies are in ${path.relative(root, path.join(dir, 'files'))}. Delete ${path.relative(root, dir)} when you are done.`, 4);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    console.error(`red_green: restored the files of an interrupted run of ${id}.`);
  }
}

const cell = (s) => String(s).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

function logRow(root, values) {
  const file = path.join(root, L.LOG);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `# Red test log\n\n| ${L.LOG_HEADER.join(' | ')} |\n|${L.LOG_HEADER.map(() => '---').join('|')}|\n`);
  }
  const text = L.read(file);
  fs.appendFileSync(file, `${text.endsWith('\n') ? '' : '\n'}| ${values.map(cell).join(' | ')} |\n`);
}

function prove(root, row) {
  console.log(`\n${row.id} (${row.rule})`);
  const commit = L.commitRef(root);
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const finish = (key, green, red, result, why, output) => {
    console.log(`  ${result.padEnd(9)} ${why}`);
    if (output && result !== 'PASS') printTail(output);
    logRow(root, [date, row.id, row.rule, commit, key, green, red, result]);
    return { id: row.id, rule: row.rule, result };
  };
  const patch = L.read(path.join(root, row.brk));
  if (!row.brk || patch === null) return finish('-', '-', '-', 'MISSING', `the break patch was not found: ${row.brk || '(empty field)'}`);
  const key = L.proofKey(row.cmd, patch);
  const files = patchFiles(root, row.brk);
  if (files.error) return finish(key, '-', '-', 'BAD BREAK', files.error);
  const check = L.git(root, ['apply', '--check', row.brk]);
  if (!check.ok) return finish(key, '-', '-', 'STALE', `the break patch does not apply to the current code (${firstLine(check.err)}). Plant the fault again and save a new patch.`);

  const green = run(root, row.cmd);
  console.log(`  green     ${desc(green)}`);
  if (interrupted) die('red_green: interrupted.', 130);
  if (green.timedOut) return finish(key, desc(green), '-', 'TIMEOUT', 'the check ran past the time limit without the break.', green.output);
  if (green.code !== 0) return finish(key, desc(green), '-', 'NOT GREEN', 'the check fails without the break. Make it pass first.', green.output);

  const snap = snapshot(root, row.id, files.list);
  let red = null;
  let applyError = null;
  let restoreError = null;
  try {
    const applied = L.git(root, ['apply', row.brk]);
    if (applied.ok) {
      markBroken(root, snap);
      console.log(`  break     ${row.brk}`);
      red = run(root, row.cmd);
      console.log(`  red       ${desc(red)}`);
    } else {
      applyError = firstLine(applied.err);
    }
  } finally {
    restoreError = restore(root, snap);
  }
  if (restoreError) return finish(key, desc(green), red ? desc(red) : '-', 'RESTORE FAILED', restoreError);
  console.log(`  restore   ${files.list.length} file${files.list.length === 1 ? '' : 's'}, checksums match`);
  if (interrupted) die('red_green: interrupted. The files are restored.', 130);
  if (applyError) return finish(key, desc(green), '-', 'STALE', `the break patch did not apply (${applyError}).`);
  if (red.timedOut) return finish(key, desc(green), desc(red), 'TIMEOUT', 'the check ran past the time limit with the break.', red.output);
  if (red.code === 0) return finish(key, desc(green), desc(red), 'BLIND', 'the check passes with the fault planted. It cannot see this fault.', red.output);
  if (row.expect && !red.output.includes(row.expect)) {
    return finish(key, desc(green), desc(red), 'WRONG RED', `the check failed, but its output does not contain "${row.expect}". It can fail for another reason.`, red.output);
  }
  const how = row.expect ? `RED printed "${row.expect}". GREEN without the break.` : 'RED with the break. GREEN without it.';
  return finish(key, desc(green), `${desc(red)}${row.expect ? ', expect found' : ''}`, 'PASS', how);
}

function fast(root, rows) {
  const text = L.read(path.join(root, 'SYSTEM.md'));
  const proven = new Set(text === null ? [] : L.parseSystem(text).rules.filter((r) => r.status.kind === 'PROVEN').map((r) => r.id));
  const chosen = rows.filter((r) => r.fast === 'yes' && proven.has(r.rule));
  if (!chosen.length) {
    console.log('red_green --fast: no fast checks belong to PROVEN rules.');
    return 0;
  }
  let failed = 0;
  for (const row of chosen) {
    const r = run(root, row.cmd);
    const ok = r.code === 0 && !r.timedOut;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${row.id} (${row.rule}) ${desc(r)}`);
    if (!ok) {
      failed += 1;
      printTail(r.output);
    }
    if (interrupted) die('red_green: interrupted.', 130);
  }
  console.log(`red_green --fast: ${failed ? `${failed} of ${chosen.length} failed` : `${chosen.length} passed`}.`);
  return failed ? 1 : 0;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) die(USAGE, 64);
  if (args.includes('-h') || args.includes('--help')) {
    console.log(USAGE);
    return 0;
  }
  const root = L.findRoot();
  if (!root) die('red_green: run this inside a git repository.', 64);
  recoverInterrupted(root);
  const manifest = L.readManifest(root);
  if (!manifest.exists) die(`red_green: ${L.MANIFEST} was not found. Run the cracked-engineer install script first.`, 64);
  for (const e of manifest.errors) console.error(`${L.MANIFEST}:${e.n}: ${e.msg}`);
  const [first] = args;
  if (first === '--list') {
    for (const r of manifest.rows) console.log(`${r.id}\t${r.rule}\tfast=${r.fast}\t${r.cmd}`);
    return 0;
  }
  if (first === '--fast') return fast(root, manifest.rows);
  if (first === '--all') {
    if (!manifest.rows.length) {
      console.log('red_green: the manifest has no tests.');
      return manifest.errors.length ? 1 : 0;
    }
    const results = manifest.rows.map((row) => prove(root, row));
    const passed = results.filter((r) => r.result === 'PASS').length;
    console.log(`\nred_green --all: ${passed} of ${results.length} passed.`);
    for (const r of results.filter((x) => x.result !== 'PASS')) console.log(`  ${r.result.padEnd(14)} ${r.id} (${r.rule})`);
    return passed === results.length && !manifest.errors.length ? 0 : 1;
  }
  if (first.startsWith('-')) die(USAGE, 64);
  const row = manifest.rows.find((r) => r.id === first);
  if (!row) die(`red_green: no test "${first}" in ${L.MANIFEST}. Known tests: ${manifest.rows.map((r) => r.id).join(', ') || 'none'}.`, 64);
  return EXIT[prove(root, row).result] ?? 1;
}

process.exitCode = main();
