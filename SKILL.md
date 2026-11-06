---
name: cracked-engineer
description: Records system design decisions in SYSTEM.md and MODULES.md and proves each rule with a red test that fails on a planted fault. Use when starting a service, auditing a repo for reliability gaps, changing code that touches data, money, queues, caches, or external calls, or after an incident.
disable-model-invocation: true
argument-hint: "[intake | audit | change <what> | incident <what>]"
---

# Cracked engineer

The agent writes code fast. It does not know where data lives, what happens under load, or what happens when a part fails. Those decisions are system design.

This skill turns each decision into a written rule with an enforcer:

- `SYSTEM.md` holds the decisions, the numbers behind them, and the rules table.
- `MODULES.md` holds one contract per module: what it owns, what it promises, how it fails.
- `tests/red/` holds the red tests. Each test has a break patch that plants its fault. The test must fail with the patch and pass without it.
- `.cracked/` holds the scripts that check all of the above. Hooks and CI run them.

**The law:** the agent does not know the design until it can make a test fail for it.

## Pick the mode

Use the mode in the arguments. If there is none, pick it from the repo.

| Repo state | Mode | Playbook |
|---|---|---|
| Little or no code, no `SYSTEM.md` | Intake | `playbooks/intake.md` |
| Code exists, no `SYSTEM.md` | Audit | `playbooks/audit.md` |
| `SYSTEM.md` exists | Change | `playbooks/change.md` |
| Something failed in production or a game day | Incident | `playbooks/incident.md` |

Tell the user the mode and the reason in one line.

## Start every run

1. Read the playbook. Copy its steps into your todo list word for word. A step you skip stays in the list as `skip: <reason>`.
2. Restate the user's goal and the smallest change that meets it. Do not wait for confirmation.
3. If the repo has no `.cracked/` folder, run `node <this skill's folder>/scripts/install.mjs <repo>`.
4. Read each concept file that the work touches (index below). Read `principles.md` before a design decision.

## Rules for every mode

- **Label every number** in `SYSTEM.md`: `MEASURED: <run log path>`, `TARGET`, `GUESS`, or `DERIVED: <formula>`. A number with no label is a hidden guess.
- **Enforce each rule at the highest level that works:** architecture, permission, type, lint, test, doc. Nothing fails when an agent skips a doc, so a doc is the last resort. See `reference/enforcement.md`.
- **Prove every check with `node .cracked/red_green.mjs <id>`,** not by hand. A check that never failed has not shown that it can see its fault.
- **Separate the test author from the implementer.** One agent or session writes the red test and its break patch. Another writes the code, and does not edit either file.
- **Run it instead of asking.** If a question has an answer you can observe (a pool size, a hit rate, a query plan), run a probe or a prototype and record the result as `MEASURED`. Ask the user only for the decisions they own (table below).
- **Cite what changed a decision.** The PR names each principle and concept file that changed a decision. Cite only files you read in this session.
- **Never weaken or delete a red test to make a change pass.** If the rule is wrong, change the rule with an ADR.
- **Keep `SYSTEM.md` short.** It holds rules and numbers, not an overview. Reasons go in ADRs in `docs/adr/`.

## Decision ownership

| Delegate: the agent decides and logs it | Review: the agent decides, the user checks the PR | Own: the user decides, the agent proposes a default |
|---|---|---|
| Intake math, index choices, cache keys, test fixtures | Module contracts, consistency labels for data other than money, queue depths, timeouts | TARGET numbers (p99, availability), RPO and RTO, consistency for money and permissions, a new service or datastore, anything that cannot be undone |

For an Own decision, give two or three options and a default. Then continue with the work that does not depend on it.

## Concept index

Read a concept file when the work touches its area. Each file lists the decisions, the rules with their enforcers, and the red tests with their break patches.

| File | Read when the work touches |
|---|---|
| `concepts/capacity.md` | traffic numbers, load, pools, workers, "it is slow" |
| `concepts/latency.md` | any outbound call, endpoint budgets, timeouts |
| `concepts/consistency.md` | replicas, read-your-writes, stale reads |
| `concepts/recovery.md` | backups, restores, RPO, RTO |
| `concepts/edge.md` | DNS, CDN, cache headers, load balancer, TLS |
| `concepts/modules.md` | module boundaries, services, imports, shared state |
| `concepts/database.md` | schema, migrations, indexes, new datastores |
| `concepts/cache.md` | any cache, TTL, invalidation, hot keys |
| `concepts/jobs.md` | queues, workers, webhooks, retries, events |
| `concepts/calls.md` | API endpoints, HTTP verbs, retries, idempotency keys |
| `concepts/security.md` | auth, input, secrets, credentials, rate limits |
| `concepts/operations.md` | SLOs, alerts, tracing, deploys, flags |

## Principles

Twelve principles decide the cases that the concept files do not cover. `principles.md` gives each one a check.

1. One owner per piece of state.
2. Things that change together live together. Depend on what changes less.
3. Every dependency fails. Bound every wait.
4. Bound everything.
5. Every write is safe to repeat.
6. Compute is stateless. State lives in stores.
7. Choose consistency per data type.
8. Contain the blast radius.
9. Prefer reversible changes.
10. Start boring. Add parts only for a named reason.
11. Measure before you scale.
12. A failure you cannot see is not handled.

## Scripts

`node <this skill's folder>/scripts/install.mjs <repo> [--ci] [--no-hooks]` copies the scripts into `<repo>/.cracked/`, creates `SYSTEM.md`, `MODULES.md`, and `tests/red/` when they do not exist, adds the Claude Code hooks to `.claude/settings.json`, and adds the design rules to `CLAUDE.md` (and to `AGENTS.md` when it exists). It never overwrites project files, and it is safe to run again. `--ci` adds a GitHub Actions workflow.

| Command | What it does |
|---|---|
| `node .cracked/check_system.mjs` | Checks the labels, the concepts list, the rules table, the manifest, the proofs, and `MODULES.md`. Prints `file:line: error: text`. |
| `node .cracked/check_system.mjs --strict` | Also fails on a draft `SYSTEM.md`, a placeholder, or a missing concept. CI uses this. |
| `node .cracked/red_green.mjs <id>` | Runs the check without the break (it must pass), applies the break patch, runs it again (it must fail with the `expect` text), and restores the files. Appends a row to `tests/red/LOG.md`. |
| `node .cracked/red_green.mjs --all` | Proves every test in the manifest. CI uses this. |
| `node .cracked/red_green.mjs --fast` | Runs the fast checks of PROVEN rules once, with no break. The stop hook uses this. |

`red_green.mjs` results: PASS. NOT GREEN: the check fails without the break. BLIND: the check passes with the fault planted. WRONG RED: it fails, but not with the `expect` text. STALE: the patch no longer applies to the code. BAD BREAK: the patch renames a file or edits `tests/red/`. TIMEOUT. MISSING.

The hooks: the Stop hook blocks the end of a turn (up to 3 times in a row) while `check_system.mjs` or the fast checks fail. The PreToolUse hook blocks shell commands that can destroy data or shared state. The hooks slow an agent down. The real controls are permissions and CI.

## Add a red test

1. Write the check: a shell command that exits 0 while the rule holds.
2. Plant the fault in the code by hand, in a file with no other uncommitted changes. The fault can be in code or in configuration, anywhere outside `tests/red/`.
3. Save it: `git diff -- <files> > tests/red/breaks/<id>.patch`. Then restore the files: `git checkout -- <files>`.
4. Add a row to `tests/red/manifest.tsv`: `id`, `rule`, `cmd`, `break`, `expect` (text the check prints only on this failure, or `-`), and `fast` (`yes` to run in the stop hook). Separate the fields with tabs.
5. Run `node .cracked/red_green.mjs <id>`. Then set the rule's status to `PROVEN`.

A complete example, with two proven rules, is in `examples/billing-demo/`.

## Done when

- `node .cracked/red_green.mjs --all` exits 0.
- `node .cracked/check_system.mjs --strict` exits 0.
- The PR body follows `.cracked/templates/PR.md`: the rules affected, the principles and concept files cited, the LOG rows, and each `UNTESTED` rule with its reason.

## Limits

- A test catches only the fault it defines. A wrong rule passes its own test.
- Staging numbers are `MEASURED` for staging only.
- A fake provider can behave differently from the real one. Check the provider's documented behavior.
- On a managed platform, a rule can become "verify the platform setting". Write a check that reads the setting.
- Context files guide the agent. The checks are what fail.
