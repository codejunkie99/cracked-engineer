# Capacity

Read when the work touches traffic numbers, load, pools, workers, or a report that something is slow.

## Decide

- Users, RPS average and peak, the peak factor, the read to write ratio, and data growth. Label each number.
- The concurrency floor at peak, from Little's law.
- The pool size per instance, from a load test with a burst.
- For each slowness report: "slow for one user" (a performance problem) or "slow under load" (a scalability problem). Attach the measurement. The fixes are different: more servers do not fix a quadratic loop, and a faster query does not fix a lock that every request waits on.

## Math

- 1 month is about 2.5 million seconds.
- 1 RPS is about 2.5 million requests per month. 40 RPS is about 100 million. 400 RPS is about 1 billion.
- 2^10 is about 1 KB, 2^20 about 1 MB, 2^30 about 1 GB, 2^40 about 1 TB.
- Little's law: requests in flight = arrival rate x average time in the system. 1,000 RPS at 200 ms gives 200 in flight.
- Availability of parts in sequence multiplies: two parts at 99.9% give about 99.8%.
- The right order of magnitude is enough. Write the math under the number, so a reviewer can redo it.

Example, as it goes in `SYSTEM.md`:

```
- timeline reads at peak: 120 RPS (DERIVED: 50,000 users x 20 reads per day / 86,400 s x peak factor 10)
- in-flight requests at peak: 12 (DERIVED: Little's law, 120 RPS x 0.1 s). A floor, not a pool size.
```

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| The app tier is stateless | sessions, uploads, and locks live in shared stores | no local disk mounted in production (architecture), `scale_out_raises_throughput` (test) |
| Pools are sized from a burst test | peak, then 2x peak for 60 s | `pool_holds_at_burst` (test) |
| A fix for "slow under load" has a load test before and after | the PR shows both runs | PR template (doc) |

## Red tests

### `scale_out_raises_throughput`

- Run: the same load test against 1 app instance, then 2. Count successful requests only. Exclude 401 and other auth failures.
- Assert: successful RPS with 2 instances is at least 1.6x successful RPS with 1. The threshold is an example. Set yours from data.
- Break: keep sessions in process memory.
- Expect: requests that land on the second instance fail auth. Raw RPS can stay high from fast 401 responses, so count only successes.

### `pool_holds_at_burst`

- Run: load at TARGET peak, then a burst at 2x peak for 60 s, with 100 ms of latency added on the database (Toxiproxy).
- Assert: no request waits for a connection longer than the pool wait budget (example: 50 ms). p99 stays under the endpoint TARGET.
- Break: set each instance's pool to the average in-flight count divided by the instance count, with no headroom.
- Expect: pool waits pass the budget during the burst.

## Audit

- State in process memory: module-level maps used as session stores or caches, in-process locks, uploads written to local disk.
- Pool settings with no run log: `pool_size`, `max_connections`, `maxPoolSize`, `max_open_conns`.
- N+1 query loops on hot paths.
- A load generator on the same machine as the system under test.

## Traps

- Average in-flight requests is a floor for concurrency. It is not a pool size.
- A staging load test is MEASURED for staging only.
- The load generator can be the limiter. Before you trust a number, name what bounds it (a core, a lock, the disk, the network, the generator) and why the result is not twice as high.
