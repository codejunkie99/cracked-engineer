# cracked-engineer

A Claude Code skill that makes the agent design before it codes. Every system design decision becomes a rule in `SYSTEM.md`, and every rule gets a red test that fails on a planted fault. Scripts and hooks check it all, so the design holds across sessions.

The law: the agent does not know the design until it can make a test fail for it.

## Install the skill

Copy this folder to `~/.claude/skills/cracked-engineer/` (for all your projects) or to `.claude/skills/cracked-engineer/` inside one repository. Then run `/cracked-engineer` in Claude Code.

Inside a repository, the skill runs its install script once:

```sh
node ~/.claude/skills/cracked-engineer/scripts/install.mjs . --ci
```

The script needs git and Node 18 or newer.

## Modes

| Command | Use |
|---|---|
| `/cracked-engineer intake` | New system: labeled numbers, decisions, and a stop for review before code. |
| `/cracked-engineer audit` | Existing code: findings with commands that prove them, ranked by harm. |
| `/cracked-engineer change <what>` | A change: red test first, proof logged, PR in a fixed shape. |
| `/cracked-engineer incident <what>` | After a failure: the missing rule, its check, and the missing alert. |

## Folder map

| Path | Holds |
|---|---|
| `SKILL.md` | The router: modes, rules, decision ownership, the concept index. |
| `playbooks/` | One playbook per mode. |
| `concepts/` | Twelve system design areas, each with decisions, rules, enforcers, and red tests. |
| `principles.md` | Twelve principles, each with a check. |
| `reference/` | The enforcement ladder, the proof ladder, excuses and answers, and tools. |
| `scripts/` | `install.mjs`, `red_green.mjs`, `check_system.mjs`, and the two hooks. |
| `templates/` | `SYSTEM.md`, `MODULES.md`, the manifest, the log, the ADR, the PR, the hooks, and CI. |
| `examples/billing-demo/` | A runnable repo with two proven rules. Start here. |
| `evals/` | Three scenarios and a seeded repo to test the skill itself. |

## Try it in two minutes

See `examples/billing-demo/README.md`.
