#!/usr/bin/env node
// Claude Code Stop hook. Blocks the end of a turn while check_system.mjs or the fast red tests fail.
// It runs only when the repo has uncommitted changes, and it blocks at most CRACKED_STOP_MAX_BLOCKS times in a row (default 3).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_BLOCKS = Number(process.env.CRACKED_STOP_MAX_BLOCKS || 3);
const cracked = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  input = {};
}

const start = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: start, encoding: 'utf8' });
if (top.status !== 0) process.exit(0);
const root = top.stdout.trim();
if (process.env.CRACKED_SKIP_STOP === '1' || !fs.existsSync(path.join(root, 'SYSTEM.md'))) process.exit(0);

const status = spawnSync('git', ['status', '--porcelain', '--', '.', ':(exclude)tests/red/LOG.md', ':(exclude).cracked/.restore'], { cwd: root, encoding: 'utf8' });
if (status.status !== 0 || !status.stdout.trim()) process.exit(0);

const tag = crypto.createHash('sha256').update(`${root}\n${input.session_id || 'no-session'}`).digest('hex').slice(0, 16);
const counter = path.join(os.tmpdir(), `cracked-stop-${tag}`);
const blocks = Number(fs.existsSync(counter) ? fs.readFileSync(counter, 'utf8') : 0) || 0;

const runScript = (script, args) =>
  spawnSync(process.execPath, [path.join(cracked, script), ...args], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const system = runScript('check_system.mjs', []);
const fast = runScript('red_green.mjs', ['--fast']);

if (system.status === 0 && fast.status === 0) {
  fs.rmSync(counter, { force: true });
  process.exit(0);
}
if (blocks >= MAX_BLOCKS) {
  fs.rmSync(counter, { force: true });
  process.stderr.write(`cracked-engineer: the checks still fail after ${MAX_BLOCKS} blocks. The turn ends. Tell the user which checks fail.\n`);
  process.exit(0);
}
fs.writeFileSync(counter, String(blocks + 1));

const tail = (r) => `${r.stdout || ''}${r.stderr || ''}`.split('\n').filter((l) => l.trim()).slice(-30).join('\n');
const parts = [];
if (system.status !== 0) parts.push(`$ node .cracked/check_system.mjs\n${tail(system)}`);
if (fast.status !== 0) parts.push(`$ node .cracked/red_green.mjs --fast\n${tail(fast)}`);
const reason = `cracked-engineer: the checks fail (block ${blocks + 1} of ${MAX_BLOCKS}). Fix them before you finish, or tell the user why you cannot.\n\n${parts.join('\n\n')}`;
process.stdout.write(JSON.stringify({ decision: 'block', reason }));
process.exit(0);
