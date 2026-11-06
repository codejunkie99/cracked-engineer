#!/usr/bin/env node
// Claude Code PreToolUse hook for Bash. Blocks shell commands that can destroy data or shared state.
// It slows an agent down. It does not stop one that writes the command into a script first.
// The real controls are database grants, bucket policies, and branch protection.
import fs from 'node:fs';

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const command = String(input?.tool_input?.command ?? '');
if (!command.trim()) process.exit(0);

function block(what) {
  process.stderr.write(
    `cracked-engineer guard blocked this command (${what}). It can destroy data or shared state.\n` +
      'Ask the user to run it, or make the change through a reviewed migration or plan.\n' +
      `Command: ${command.slice(0, 300)}\n`,
  );
  process.exit(2);
}

// Splits a command into simple commands (token lists). Quotes keep their text in one token.
function segments(cmd) {
  const segs = [];
  let tokens = [];
  let cur = '';
  let has = false;
  let quote = null;
  const pushToken = () => {
    if (has) tokens.push(cur);
    cur = '';
    has = false;
  };
  const endSegment = () => {
    pushToken();
    if (tokens.length) segs.push(tokens);
    tokens = [];
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < cmd.length) cur += cmd[++i];
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      has = true;
    } else if (c === '\\' && i + 1 < cmd.length) {
      cur += cmd[++i];
      has = true;
    } else if (';&|\n()`'.includes(c)) {
      endSegment();
    } else if (/\s/.test(c)) {
      pushToken();
    } else {
      cur += c;
      has = true;
    }
  }
  endSegment();
  return segs;
}

const base = (t) => t.split('/').pop();
const PREFIXES = new Set(['sudo', 'env', 'time', 'nice', 'nohup', 'command', 'exec', 'xargs', 'npx', 'bunx']);
const RUNNERS = { pnpm: ['exec', 'dlx'], yarn: ['exec', 'dlx'], bun: ['x'], uv: ['run'], poetry: ['run'], pipenv: ['run'], bundle: ['exec'] };

function programOf(tokens) {
  let i = 0;
  while (i < tokens.length) {
    const b = base(tokens[i]);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i += 1;
    else if (PREFIXES.has(b)) {
      i += 1;
      while (i < tokens.length && tokens[i].startsWith('-')) i += 1;
    } else if (RUNNERS[b] && RUNNERS[b].includes(tokens[i + 1])) i += 2;
    else break;
  }
  return { name: i < tokens.length ? base(tokens[i]) : '', args: tokens.slice(i + 1), tokens };
}

const seq = (list, ...words) => list.some((_, i) => words.every((w, k) => list[i + k] === w));
const sub = (args) => args.find((a) => !a.startsWith('-')) ?? '';

const SQL_RUNNERS = new Set([
  'psql', 'mysql', 'mariadb', 'sqlite3', 'sqlcmd', 'sqlplus', 'clickhouse', 'clickhouse-client', 'cockroach', 'duckdb', 'bq', 'snowsql',
  'mongo', 'mongosh', 'python', 'python3', 'node', 'bun', 'deno', 'ruby', 'perl', 'php', 'sh', 'bash', 'zsh', 'docker', 'kubectl',
  'heroku', 'supabase', 'rails',
]);
const SQL = [
  ['DROP TABLE, DATABASE, or SCHEMA', /\bdrop\s+(table|database|schema)\b/i],
  ['DROP COLUMN', /\bdrop\s+column\b/i],
  ['TRUNCATE', /\btruncate\s+(table\s+)?[A-Za-z_"`]/i],
  ['DELETE without WHERE', /\bdelete\s+from\s+[\w."`]+\s*(;|$|["'`)])/im],
];

const DANGEROUS_RM = new Set(['/', '/*', '~', '~/', '~/*', '$HOME', '$HOME/', '${HOME}', '.', './', '..', '../', '*', './*']);

function checkProgram({ name, args, tokens }) {
  if (seq(tokens, 'prisma', 'migrate', 'reset') || (seq(tokens, 'prisma', 'db', 'push') && tokens.includes('--force-reset'))) return 'a Prisma database reset';
  switch (name) {
    case 'git':
      if (sub(args) === 'push' && args.some((a) => a === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) || /^\+./.test(a))) return 'a git force push';
      return null;
    case 'terraform':
      return sub(args) === 'destroy' || (sub(args) === 'apply' && args.includes('-destroy')) ? 'terraform destroy' : null;
    case 'pulumi':
      return sub(args) === 'destroy' ? 'pulumi destroy' : null;
    case 'kubectl':
      return sub(args) === 'delete' && args.some((a) => /^(ns|namespaces?|pv|pvc|persistentvolumes?|persistentvolumeclaims?)(\/|$)/.test(a))
        ? 'kubectl delete of a namespace or volume'
        : null;
    case 'dropdb':
      return 'dropdb';
    case 'redis-cli':
      return args.some((a) => /^flush(all|db)$/i.test(a)) ? 'Redis FLUSHALL or FLUSHDB' : null;
    case 'mongo':
    case 'mongosh':
      return args.some((a) => /dropDatabase\s*\(/.test(a)) ? 'MongoDB dropDatabase' : null;
    case 'aws':
      if ((seq(args, 's3', 'rm') && args.includes('--recursive')) || seq(args, 's3', 'rb')) return 'an S3 recursive delete';
      return args[0] === 'rds' && /^delete-db-(instance|cluster)$/.test(args[1] ?? '') ? 'an RDS delete' : null;
    case 'gsutil':
      return args.includes('rm') && args.some((a) => /^-[a-zA-Z]*r/.test(a)) ? 'a GCS recursive delete' : null;
    case 'gcloud':
      return seq(args, 'sql', 'instances', 'delete') ? 'a Cloud SQL delete' : null;
    case 'docker':
      return seq(args, 'volume', 'rm') || seq(args, 'volume', 'prune') || (seq(args, 'system', 'prune') && args.includes('--volumes'))
        ? 'a Docker volume delete'
        : null;
    case 'rails':
    case 'rake':
      return args.some((a) => /^db:(drop|reset|schema:load|truncate_all)$/.test(a)) ? 'a Rails database drop or reset' : null;
    case 'python':
    case 'python3':
      return args.some((a) => base(a) === 'manage.py') && args.includes('flush') ? 'a Django flush' : null;
    case 'django-admin':
      return args.includes('flush') ? 'a Django flush' : null;
    case 'rm': {
      const recursive = args.some((a) => a === '--recursive' || (/^-[a-zA-Z]+$/.test(a) && /[rR]/.test(a)));
      const targets = args.filter((a) => !a.startsWith('-'));
      return recursive && targets.some((t) => DANGEROUS_RM.has(t) || /^\/[^/]+\/?$/.test(t)) ? 'rm -r of a root, home, or current folder' : null;
    }
    default:
      return null;
  }
}

const programs = segments(command).map(programOf);
if (programs.some((p) => SQL_RUNNERS.has(p.name))) {
  for (const [what, re] of SQL) if (re.test(command)) block(what);
}
for (const p of programs) {
  const what = checkProgram(p);
  if (what) block(what);
}
process.exit(0);
