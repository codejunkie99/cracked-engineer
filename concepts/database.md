# Database

Read when the work touches the schema, a migration, an index, a hot query, or a new datastore.

## Decide

- The source of truth. Default: one relational database, until a named access pattern needs something else. A new datastore needs an ADR that names that access pattern.
- The hot query paths, and the index each one uses.
- For each schema change: the expand, migrate, and contract steps, and the release each step ships in.

## Scaling, in order

Use the first step that fixes the measured bottleneck. Each step after tuning needs an ADR that names the write rate or the size that forced it.

1. Tuning: a tighter schema, good indexes, fewer expensive joins, partitions for large tables.
2. Read replicas: the primary takes writes and copies them to replicas, which serve reads. Mind consistency (`consistency.md`).
3. Denormalization: redundant copies to avoid expensive joins on reads, at the cost of more complex writes.
4. Federation: split databases by function (users, posts, billing). Joins across them get harder.
5. Sharding: split one dataset by key, with consistent hashing or a versioned shard map.
6. Primary-primary replication: only with a clear reason. It needs conflict resolution.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| Every hot query uses an index | queries tagged hot are checked in CI | `hot_queries_use_index` (test) |
| A schema change is backward compatible during a deploy | expand, migrate, contract, in separate releases | a migration linter such as squawk or strong_migrations (lint), `previous_release_runs_on_new_schema` (test) |
| The agent cannot run destructive statements on production | DROP, TRUNCATE, and DELETE without WHERE are denied | database grants (permission), the guard hook (lint) |
| A new datastore has an ADR | the ADR names the access pattern | PR review (doc) |

## Red tests

### `hot_queries_use_index`

- Run: seed the test database with a production-sized row count (GUESS until measured). Run `EXPLAIN` on each query tagged hot.
- Assert: no full table scan on a table above the size threshold.
- Break: drop the index on `posts(author_id, created_at)`.
- Expect: the timeline query plan shows a sequential scan.

### `previous_release_runs_on_new_schema`

- Run: apply the new migrations. Then run the test suite of the previous release against the new schema.
- Assert: the previous release passes.
- Break: rename a column in one step instead of expand and contract.
- Expect: the previous release fails on the missing column.

## Expand and contract

To rename `name` to `full_name`:

1. Expand: add `full_name` as nullable. Old code keeps working.
2. Deploy code that writes both columns and reads `full_name` with a fallback.
3. Backfill `full_name` in batches. Keep each transaction short.
4. Deploy code that reads and writes only `full_name`.
5. Contract: drop `name`, in a later release.

To recover from a bad step, roll back the code. Do not roll back the data.

## Audit

- Foreign keys with no index, and `SELECT *` on hot paths.
- Migrations that rename or drop a column in one step, or add `NOT NULL` with no default on a large table.
- Long transactions, and backfills in one statement.
- The app and the agent connected with the owner role.

## Traps

- `EXPLAIN` on an empty table always shows a scan. Seed realistic row counts.
- An ORM can hide an N+1 loop. Count the queries per request in a test.
