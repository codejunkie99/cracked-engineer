## Design rules (cracked-engineer)

- Before you change code, read SYSTEM.md and the MODULES.md entry of each module you touch.
- A change that touches a rule in SYSTEM.md needs that rule's red test. Prove it with `node .cracked/red_green.mjs <id>`.
- The agent that writes the code does not edit the red test or its break patch.
- Do not change a MODULES.md contract, or add a service or a datastore, without an ADR in docs/adr/.
- Label every number in SYSTEM.md: MEASURED with its run log, TARGET, GUESS, or DERIVED.
- Before you finish, `node .cracked/check_system.mjs` must report 0 errors.
