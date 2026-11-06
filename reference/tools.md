# Tools

Tools that can act as enforcers or help plant faults. Check each tool's current documentation before you use it.

## Contents

- Module boundaries
- Fault injection
- Load
- Queries and migrations
- Backups
- Security checks
- Contracts and tracing
- Mutation testing
- Formal checks

## Module boundaries

| Stack | Tool | Level |
|---|---|---|
| Go | `internal/` packages (the compiler enforces them) | architecture |
| Rust | `pub(crate)`, and crates as boundaries (a crate can use only its dependencies) | architecture |
| Node | the package.json `exports` map | architecture |
| Python | import-linter (contracts: layers, forbidden, independence) | lint |
| JavaScript, TypeScript | dependency-cruiser | lint |
| Java, Kotlin | ArchUnit | lint |
| Go | depguard (golangci-lint), go-arch-lint | lint |

## Fault injection

| Need | Tool |
|---|---|
| Latency, timeouts, resets on a TCP link | Toxiproxy (with a Testcontainers module) |
| Network faults on a Linux host | `tc netem` |
| Faults in Kubernetes | Chaos Mesh, LitmusChaos |
| A fault at a chosen line of code | failpoints, for example the `fail` crate in Rust |
| A dependency that hangs | a fake server that never answers |

## Load

k6, Locust, vegeta, wrk2. Keep the load generator off the machine under test.

## Queries and migrations

| Need | Tool |
|---|---|
| Query plans | `EXPLAIN (ANALYZE, BUFFERS)` in Postgres, `EXPLAIN FORMAT=JSON` in MySQL |
| The slowest queries in production | `pg_stat_statements`, `auto_explain` |
| Unsafe migrations | squawk (Postgres), strong_migrations (Rails), Atlas migrate lint |
| Online schema changes in MySQL | gh-ost, pt-online-schema-change |

## Backups

Point-in-time recovery in Postgres: pgBackRest, WAL-G, Barman, or the managed service's setting. Object lock or a retention policy on the backup bucket.

## Security checks

| Need | Tool |
|---|---|
| SQL built from strings | semgrep rules, bandit B608 (Python) |
| Secrets in the repository | gitleaks, trufflehog |

## Contracts and tracing

- Contract tests between services: Pact.
- Request IDs and traces: OpenTelemetry, W3C trace context.
- Alert rule tests: `promtool test rules` (Prometheus).

## Mutation testing

mutmut (Python), Stryker (JavaScript, TypeScript, C#, Scala), PIT (Java), cargo-mutants (Rust).

## Formal checks

For a race, a retry protocol, or a state machine that tests reach poorly, a model checker such as TLA+ checks every order of steps in a small model. A formal-verification skill can build such a check for one property and keep it in step with the code.
