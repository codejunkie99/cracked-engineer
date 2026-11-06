# Intake

Use for a new system or a repo with little code. Do not write application code in this mode.

## Steps

1. List the use cases in scope and out of scope.
2. Answer these questions. Label each answer `MEASURED`, `TARGET`, or `GUESS`.
   - Who uses the system, and how?
   - How many users?
   - What are the inputs and outputs?
   - How much data, now and after 3 years?
   - Requests per second (RPS), average and peak. Peak factor.
   - Read to write ratio.
3. Do the back-of-the-envelope math in `concepts/capacity.md`: RPS, storage per month, storage after 3 years.
4. Apply Little's law at peak. Record the result as the concurrency floor. It is not a pool size.
5. List the components and the calls between them.
6. Read every concept file. For each one, record the decision, or write `skip: <reason>`.
7. Settle each question you can observe by running something: a probe, a query plan, a short load test, a prototype. Record the result as `MEASURED` with its log path.
8. Tag each decision Delegate, Review, or Own (table in `SKILL.md`). Read `principles.md` and name the principle behind each Own decision.
9. Stop. Show the user the intake and the Own decisions, each with two or three options and a default. Do not continue without approval.

After approval:

10. Run `node <this skill's folder>/scripts/install.mjs <repo>`. It creates `SYSTEM.md`, `MODULES.md`, and `tests/red/` when they do not exist.
11. Fill `SYSTEM.md`. Keep the `<!-- cracked: draft -->` line until every section is complete, then delete it.
12. Write `MODULES.md` contracts for the two riskiest modules first. Riskiest means money, private data, or external calls.
13. Write the red tests and break patches for those modules. Add one row per test to `tests/red/manifest.tsv`. Record each test's failure before the code exists.
14. Run `node .cracked/check_system.mjs`. Fix every line it prints.
15. Build with `playbooks/change.md`.

## Reply

The intake numbers with labels, the concurrency floor, the component list, each Own decision with options and a default, and the concepts marked `skip` with reasons.
