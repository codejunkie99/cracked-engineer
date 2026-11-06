# Consistency

Read when the work touches read replicas, caches in front of the database, read-your-writes, or stale reads.

## Decide

- A label for each table or collection: CONSISTENT or EVENTUAL. Write the labels in `SYSTEM.md` under `## data`.
- Defaults: money, plan status, permissions, and inventory are CONSISTENT. Like counts, view counts, follower counts, and feed order can be EVENTUAL.
- The read-your-writes window: how long a user's reads of data they wrote go to the primary (example: 10 s).

## Terms

- CAP: during a network partition, a distributed system chooses consistency (some requests fail or time out) or availability (some reads are stale). Networks fail, so the choice is real.
- Weak consistency: after a write, reads may or may not see it. Examples: memcached, live voice and games.
- Eventual consistency: after a write, reads see it after a delay. Data is copied asynchronously. Examples: DNS, email, read replicas.
- Strong consistency: after a write, reads see it. Data is copied synchronously. Examples: a relational primary, file systems.
- Replicas lag. The lag grows under load and during failures.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| CONSISTENT data is read from the primary | the data layer takes a `Primary` handle for CONSISTENT tables | a type or a separate client (type), `author_sees_own_write_under_replica_lag` (test) |
| A user reads their own writes | reads go to the primary for the window after a write | `author_sees_own_write_under_replica_lag` (test) |
| CONSISTENT data is not served from a cache that a write does not update at once | no TTL-only cache on CONSISTENT data | `write_invalidates_cached_object` in `cache.md` (test) |

## Red tests

### `author_sees_own_write_under_replica_lag`

- Run: add 5 s of lag on the read replica (Toxiproxy latency on the replication link, or a replica fake that delays). User A creates a post, then loads their own profile at once.
- Assert: the new post is present.
- Break: route the author's read to the replica.
- Expect: the post is missing.

## Audit

- Reads that follow a write in the same request or the next one, through a replica connection.
- Money or permission checks that read from a replica or a cache.
- A single database URL used for both reads and writes in one place, and a replica URL in another, with no rule for which data goes where.

## Traps

- A test against one database with no replica cannot see this fault. Add lag on purpose.
- Strong consistency across regions is possible (Spanner uses TrueTime and commit wait), and it costs commit latency. Pay that cost only for CONSISTENT data.
