# Cache

Read when the work adds or changes a cache, a TTL, an invalidation, or a hot key.

## Decide

- Where the cache sits: the client, the CDN, the web server, the database, or the application (memcached, Redis).
- The level: object-level (an assembled user or post) or query-level (the result of a query). Prefer object-level. One changed row can stale many cached queries, and that is hard to find.
- The update pattern. `SYSTEM.md` names exactly one:
  - Cache-aside: the app reads the cache, and on a miss reads the database and fills the cache. Data can be stale until the TTL ends.
  - Write-through: the app writes the cache, and the cache writes the database at once. Writes are slower.
  - Write-behind: the app writes the cache, and the database update comes later. Data is lost if the cache fails first.
  - Refresh-ahead: the cache refreshes hot entries before they expire. It helps only when reads are predictable.
- The TTL of each key space.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| The database is the source of truth. The cache is disposable. | a cache flush changes no answers | `cache_flush_changes_no_answers` (test) |
| Every key has a TTL | the cache client requires a TTL | a wrapper with no default (architecture) |
| A write that changes a cached object deletes or updates its key | in the same code path as the write | `write_invalidates_cached_object` (test) |
| A hot key that expires loads once | single-flight loading or leases | `hot_key_miss_loads_once` (test) |
| No write-behind for data you cannot lose | write-behind only for counters and similar | PR review (doc) |

## Red tests

### `hot_key_miss_loads_once`

- Run: expire the cache entry of a hot post. Send 100 concurrent reads for it.
- Assert: the database receives exactly 1 load query for that post.
- Break: remove the single-flight lock.
- Expect: the database receives many load queries (a stampede).

### `write_invalidates_cached_object`

- Run: read a post (it enters the cache). Edit the post. Read it again.
- Assert: the second read returns the edit.
- Break: remove the key delete from the edit path.
- Expect: the second read returns the old text until the TTL ends.

### `cache_flush_changes_no_answers`

- Run: record the answers to a fixed set of reads. Flush the cache. Read again.
- Assert: the answers are the same.
- Break: make a write path update only the cache (write-behind with no database write).
- Expect: the answer after the flush differs.

## Audit

- Keys set with no TTL.
- Write paths that change a cached object and do not touch the cache.
- A cache that holds the only copy of some data.
- CONSISTENT data (money, permissions) behind a TTL-only cache.

## Example

Facebook's memcache paper (NSDI 2013) describes a look-aside cache (cache-aside) in front of the databases, with leases that stop stale sets and thundering herds on hot keys.
