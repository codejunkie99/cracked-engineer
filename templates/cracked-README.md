# .cracked

Tools from the cracked-engineer skill. The install script overwrites these files. Change the skill, not this folder.

| File | Use |
|---|---|
| `red_green.mjs` | `node .cracked/red_green.mjs <id>` proves that a red test fails on its planted fault. `--all` proves every test. `--fast` runs the fast checks of PROVEN rules. |
| `check_system.mjs` | `node .cracked/check_system.mjs` checks SYSTEM.md, MODULES.md, the manifest, and the proofs. `--strict` also fails on a draft. |
| `hooks/stop.mjs` | Claude Code Stop hook. Blocks the end of a turn while the checks fail. Set `CRACKED_SKIP_STOP=1` to turn it off. |
| `hooks/guard.mjs` | Claude Code PreToolUse hook. Blocks shell commands that can destroy data or shared state. |
| `templates/` | The ADR and PR templates. |

## Add a red test

1. Write the check. It is a shell command that exits 0 while the rule holds.
2. Plant the fault in the code by hand, in a file with no other uncommitted changes.
3. Save the fault: `git diff -- <files> > tests/red/breaks/<id>.patch`
4. Restore the files: `git checkout -- <files>`
5. Add a row to `tests/red/manifest.tsv`.
6. Prove it: `node .cracked/red_green.mjs <id>`
