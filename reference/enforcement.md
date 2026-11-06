# Enforcement

## Contents

1. The enforcement ladder
2. The proof ladder
3. Legacy code: freeze, then ratchet
4. Mutation testing
5. Excuses and answers

## 1. The enforcement ladder

A rule that only lives in a document fails silently: nothing breaks when an agent skips it. Put each rule at the highest level that works. In the PR, say why each higher level does not work.

| Level | The wrong thing... | System design examples |
|---|---|---|
| architecture | cannot be written | Go `internal/` packages and Rust `pub(crate)`, so a forbidden import does not compile. Only the billing module holds the provider credentials. An outbox table instead of publish-after-commit. A cache client that requires a TTL. No local disk on app instances. |
| permission | is denied at runtime | The agent's database role is read-only on production. Each module has its own database role. Backups have object lock. Branch protection on main. |
| type | does not type-check | A `Money` type in place of floats. A `PrimaryReader` handle required for CONSISTENT reads. An `IdempotencyKey` type that the client requires. |
| lint | fails a static check whose error names the fix | An import checker. A semgrep rule for SQL built from strings. A migration linter. A check that every HTTP call sets a timeout. |
| test | fails a behavior check | The red tests in the concept files, each proven with a planted fault. |
| doc | nothing fails | A judgment call. Mark the rule `UNTESTED: <reason>` in `SYSTEM.md`. |

A rule can have more than one enforcer. Example: the guard hook (lint) slows an agent that types `DROP TABLE`, and the database grant (permission) stops it.

## 2. The proof ladder

How sure you are that a rule holds.

1. You said so. This proves nothing.
2. You pointed at the line: a real `file:line`.
3. You walked the failure step by step, and it does not reach.
4. You ran it: a check that fails when the rule breaks, proven with `red_green.mjs`.
5. You reproduced it in the running system: staging, a game day, or production.

A rule is `PROVEN` in `SYSTEM.md` at level 4 or 5 only. Say the level of each claim in a PR or an audit finding.

## 3. Legacy code: freeze, then ratchet

A new structural check on an old codebase finds many violations at once. Do not fix them all before you turn the check on.

1. Freeze the current violations into a baseline: an import-linter `ignore_imports` list, an ArchUnit freeze store, a dependency-cruiser known-violations file, or a baseline file for your own check.
2. Turn the check on. It fails only on new violations.
3. Remove baseline entries as fixes land. The baseline only shrinks.

## 4. Mutation testing

A break patch is a hand-written mutant aimed at one rule. Mutation tools make many small mutants at once and report the tests that cannot catch them: mutmut (Python), Stryker (JavaScript, TypeScript, C#, Scala), PIT (Java), cargo-mutants (Rust). Use them to find tests that cannot fail. Use break patches to prove the system rules in `SYSTEM.md`.

## 5. Excuses and answers

| Excuse | Answer |
|---|---|
| "The change is too small for a test." | Size does not change the fault. Write the test, or mark the rule `UNTESTED: <reason>` in the PR. |
| "The platform handles this." | Then the rule is "verify the platform setting". Write a check that reads the setting. |
| "I cannot simulate this fault." | Use a fake, Toxiproxy, or a failpoint. If none works, mark the rule `UNTESTED` and give the reason. |
| "The test passed, so it works." | A test that never failed has not shown that it can see its fault. Run `red_green.mjs`. |
| "I will add the test after the code." | Then the test is shaped by the code, not by the rule. Write the check first, and record its failure before the code exists. |
| "The doc already says this." | A doc is the lowest level. Move the rule up the ladder, or accept that it will drift. |
| "The break is too hard to plant." | Plant it in configuration (a grant file, a CDN rule, a timeout value). The patch can edit any file outside `tests/red/`. |
