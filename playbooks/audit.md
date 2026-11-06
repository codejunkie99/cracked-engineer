# Audit

Use for a repo that has code but no `SYSTEM.md`. Do not change application code until the user approves the findings. Installing the tooling in step 1 is allowed, because it adds files and changes no behavior.

## Steps

1. Run `node <this skill's folder>/scripts/install.mjs <repo>`.
2. Map the components and the calls between them from the code. Script the import graph if the repo is large.
3. Freeze the existing structural violations before you add structural checks: an import-linter `ignore_imports` list, an ArchUnit freeze file, or a baseline file. New checks then fail only on new violations. See `reference/tools.md`.
4. Read every concept file. Compare the code with each rule. Write one finding per gap:

   ```
   - [concept] file:line | what the code does | the fault it allows | the command that shows it | the output
   ```

   A finding counts only if you ran the command and saw the output. A finding you could not reproduce goes in a separate "unproven" list with the reason. Unproven findings do not get a rank.

5. Look for one root fix behind several findings. Write each root fix above the findings it solves. Read `principles.md` and name the principle behind each root fix.
6. Rank the root fixes: data loss, then money, then private data exposure, then availability, then performance. Report the first three classes in full. Collapse the rest into one list.
7. Write `SYSTEM.md` with the decisions the code makes today. Each gap becomes a rule with status `UNTESTED: open finding <n>`. Keep the draft line.
8. Stop. Show the user the ranked root fixes and the Own decisions they contain.
9. Apply the fixes in rank order with `playbooks/change.md`. One root fix per PR.

## Reply

The component map, the ranked root fixes with their findings and commands, the unproven list, and the Own decisions.

## Example findings

```
- [jobs] webhooks/payment.ts:41 | applies the plan change on each delivery | a redelivered event upgrades twice | python scripts/replay_event.py --times 2 | plan_changes=2
- [edge] deploy/cdn.yaml:12 | caches /posts/* and ignores Authorization | a followers-only post reaches a non-follower | curl -H "Cookie: $B" $CDN/posts/42 | 200, body of post 42
```
