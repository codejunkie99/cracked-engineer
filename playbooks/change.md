# Change

Use for every change in a repo that has `SYSTEM.md`.

## Steps

1. Read `SYSTEM.md` and the `MODULES.md` entry of each module the change touches.
2. List the rules the change affects. Read the concept file of each affected area.
3. For each new or changed rule, pick the enforcer at the highest level that works (`reference/enforcement.md`). Add or update its row in the rules table, with the status `UNTESTED: in progress`.
4. Test author: write each check and its break patch. The break patch plants the fault the check must catch (see "Add a red test" in `SKILL.md`). Add a row to `tests/red/manifest.tsv`. Give the `expect` field text that only the intended failure prints.
5. Run each new check before the code exists. It must fail. Save the output for the PR. Skip this step for a check on behavior that already exists.
6. Implementer: write the code. Do not edit the red tests or their break patches. In a single session, finish the tests first and do not change them after this step.
7. Run `node .cracked/red_green.mjs <id>` for each affected check. It must report PASS. Then set the rule's status to `PROVEN`.
8. Run the full test suite and `node .cracked/check_system.mjs`. Fix every line it prints.
9. If a decision changed, write an ADR from `.cracked/templates/ADR.md` and update `SYSTEM.md`.
10. Write the PR body from `.cracked/templates/PR.md`.

## Do not

- Change a `MODULES.md` contract without an ADR.
- Add a service or a datastore without an ADR that names the reason.
- Weaken, skip, or delete a red test to make a change pass. If the rule is wrong, change the rule with an ADR.
- Mark a rule `PROVEN` without a PASS row in `tests/red/LOG.md`.

## Reply

The rules the change affects, the red output from step 5, the LOG rows from step 7, the principles and concept files that changed a decision, and any rule left `UNTESTED` with its reason.
