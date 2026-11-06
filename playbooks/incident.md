# Incident

Use after a production failure, a near miss, or a game day. The goal is a rule and a check that would have caught it.

## Steps

1. Restate the incident in four lines: what users saw, when it started and ended, how it was detected, and what stopped it.
2. Reproduce the failure on the closest surface you can reach. If it does not reproduce, synthesize the trigger: inject the latency, replay the event, lag the replica. Keep the command and its output.
3. Find the first place the system went wrong, not the last symptom. A guard is a fix only when the state it handles is legitimate.
4. Name the missing rule. Find the concept file and the principle it belongs to.
   - If the rule was missing, add it.
   - If the rule existed but its enforcer did not catch the failure, raise the enforcer one level or more (`reference/enforcement.md`).
5. Write the check. Its break patch recreates the incident condition. Prove it with `node .cracked/red_green.mjs <id>`.
6. Fix the code with `playbooks/change.md`.
7. Check detection. If users saw the failure before an alert fired, add or fix the alert in `concepts/operations.md` and prove that it fires.
8. Write `docs/incidents/YYYY-MM-DD-<slug>.md`: timeline, first wrong state, rule added, check added, alert added. Name systems and decisions, not people.

## Game day

To test before an incident, pick one fault from the concept files, inject it in staging, and run steps 2 to 8. Check that the alert fires and that the runbook works as written.

## Reply

The four-line restatement, the reproduction command and output, the first wrong state, the rule and its LOG row, and the detection gap.
