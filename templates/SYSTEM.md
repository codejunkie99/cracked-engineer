# SYSTEM.md

<!-- cracked: draft -->
<!--
This file holds decisions and numbers, not explanations. Reasons go in docs/adr/.
Label every number in intake and targets: "MEASURED: <run log path>", TARGET, GUESS, or "DERIVED: <formula>".
Replace every <placeholder>. Delete the draft line above when every section is complete.
Check the file with: node .cracked/check_system.mjs (CI uses --strict).
-->

## intake
- use cases in scope: <list>
- use cases out of scope: <list>
- users: <n> (GUESS)
- peak RPS, reads: <n> (GUESS, peak factor <n>)
- peak RPS, writes: <n> (GUESS)
- read to write ratio: <n>:1 (GUESS)
- data growth: <n> GB per year (DERIVED: <inputs>)
- in-flight requests at peak: <n> (DERIVED: Little's law, <rps> x <seconds>). This is a floor, not a pool size.

## targets
- <endpoint> p99: <n> ms (TARGET)
- availability: <n>% per month (TARGET)
- RPO: <n> min (TARGET). RTO: <n> min (TARGET).

## data
- source of truth: <database>
- CONSISTENT: <tables>
- EVENTUAL: <tables>
- read-your-writes window: <n> s (TARGET)
- backups: <method>, <location>, delete permission: <roles>

## concepts
<!-- Write "decided" or "skip: <reason>" for each concept. The concept files are in the cracked-engineer skill. -->
- capacity: decided
- latency: decided
- consistency: decided
- recovery: decided
- edge: skip: <reason>
- modules: decided
- database: decided
- cache: skip: <reason>
- jobs: decided
- calls: decided
- security: decided
- operations: decided

## rules
<!-- Level: architecture, permission, type, lint, test, or doc. Status: PROVEN, UNTESTED: <reason>, or N/A: <reason>.
PROVEN needs a PASS row in tests/red/LOG.md from: node .cracked/red_green.mjs <check> -->
| ID | Rule | Concept | Enforcer | Level | Check | Status |
|---|---|---|---|---|---|---|
| R1 | <rule> | <concept> | <mechanism that fails when the rule breaks> | test | `<test id>` | UNTESTED: <reason> |

## limits
- A test catches only the fault it defines. A wrong rule passes its own test.
- Load numbers from staging are MEASURED for staging only.
- A fake provider can behave differently from the real one.
