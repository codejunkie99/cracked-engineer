# Security

Read when the work touches auth, user input, queries, output, secrets, credentials, backups, or a public endpoint.

## Decide

- Which roles exist (the agent, the app, an admin, each module) and what each role can do.
- Where secrets live: a secret store, never the repository, the prompt, or the logs.
- The rate limit of each public endpoint: per user, per API key, and per IP. Endpoints that call a paid model API need the tightest limits.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| TLS on every external connection. Storage encrypted at rest. | platform settings | a check that reads the setting (test) |
| Queries are parameterized | no SQL built from strings | semgrep or bandit (B608), or an AST check (lint), `injection_payload_returns_nothing_extra` (test) |
| User content is escaped on output | rich text passes an allowlist sanitizer | the template engine's auto-escape (architecture) |
| Secrets come from the secret store | a scanner runs in CI | gitleaks or trufflehog (lint) |
| The agent's database role is read-only on production | write access only on dev and scratch databases | database grants (permission), `agent_role_cannot_destroy` (test) |
| Backups cannot be deleted by the app or the agent | separate account, write-once retention | bucket policy (permission), `backup_delete_denied` in `recovery.md` (test) |
| Public endpoints have rate limits | counters in a shared store. Over the limit returns 429 with Retry-After. | `rate_limit_holds_across_instances` (test) |

## Red tests

### `injection_payload_returns_nothing_extra`

- Run: search posts with the input `' OR '1'='1`.
- Assert: the response holds only posts that match the literal text, which is none.
- Break: build the search query by string concatenation.
- Expect: the response returns every post.

### `agent_role_cannot_destroy`

- Run: connect to a production-like database with the agent's role. Try `DROP TABLE posts`. With the agent's storage credentials, try to delete a backup object.
- Assert: both are denied.
- Break: grant the role ownership of the schema, and grant delete on the backup bucket.
- Expect: the drop succeeds on the scratch copy, and the backup object is deleted.

### `rate_limit_holds_across_instances`

- Run: run 2 app instances. Send 2x the limit from one user, split across both instances.
- Assert: the requests over the limit receive 429 with Retry-After.
- Break: keep the counters in process memory.
- Expect: each instance allows the full limit, so the user gets 2x through.

## Audit

- f-strings, `+`, `%`, or `.format` inside `execute(...)` calls. Template strings in raw queries.
- `innerHTML`, `dangerouslySetInnerHTML`, `| safe`, and other escapes of auto-escaping.
- `.env` files, keys, and tokens in the repository or its history.
- The app or the agent connected with the owner or superuser role.
- Public endpoints with no rate limit, or a limit kept in process memory.

## Example

In July 2025, a user reported that a Replit agent deleted production data during a code freeze. Replit confirmed the deletion and said a rollback restored the data. The lesson is that access is a design decision: write it down as a rule and prove it with a test.

## Traps

- A planted secret in a break patch trips the secret scanner on the patch file itself. Keep the planted secret fake, and allowlist `tests/red/breaks/` in the scanner configuration.
- A rate limit in process memory resets per instance, so two instances double the real limit.
