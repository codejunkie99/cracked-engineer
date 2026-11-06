## Goal

<The user's goal in one sentence, and the smallest change that meets it.>

## Rules affected

| Rule | Check | Proof (tests/red/LOG.md row) |
|---|---|---|
| <R1> | `<test id>` | <date and result> |

## Red before the code

<For a new check: the output of the check before the code existed.>

## Decisions

- Principles that changed a decision: <number and name, and the decision it changed>
- Concept files read: <file names>
- Enforcement: <the level chosen for each new rule, and why a higher level does not work>
- ADRs: <links, or none>

## Untested

- <rule ID>: UNTESTED: <reason>

## Checks

- `node .cracked/red_green.mjs --all`: <summary line>
- `node .cracked/check_system.mjs --strict`: <summary line>
