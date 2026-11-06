# Latency

Read when the work adds or changes an outbound call, sets an endpoint budget, or touches timeouts.

## Decide

- A p99 TARGET for each user-facing endpoint. p50 hides the slow tail. p99 means 99% of requests finish at or below this time.
- A timeout for each outbound call. It is shorter than the budget of the endpoint that makes the call.
- The degraded response for each non-critical dependency: what the endpoint returns when that dependency times out.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| Every outbound call has a timeout shorter than the caller's budget | a shared client that requires a timeout | a wrapper with no default, or a lint that flags calls with no timeout (lint), `slow_dependency_does_not_block_reads` (test) |
| A non-critical dependency that times out gives a degraded response | the page loads without the link preview | `slow_dependency_does_not_block_reads` (test) |
| Retries fit inside the budget | at most 1 retry on a read, with jitter | client configuration (lint) |
| Each dependency has its own pool or concurrency limit | a bulkhead per dependency | `slow_dependency_does_not_block_reads` (test) |

## Red tests

### `slow_dependency_does_not_block_reads`

- Run: make a fake non-critical dependency (for example, the link preview service) hang for 30 s. Load the endpoint that uses it at TARGET peak.
- Assert: p99 stays under the endpoint TARGET. No worker waits longer than the configured timeout.
- Break: remove the client timeout.
- Expect: workers stall, and p99 rises past the TARGET.

Use Toxiproxy (the `timeout` or `latency` toxic) or a fake server that never answers. Do not use a mock that returns at once: it cannot hang.

## Audit

Clients with no overall timeout by default:

- Python `requests.get(...)` and `urllib.request.urlopen(...)` with no `timeout=`.
- Node `fetch(...)` with no `signal: AbortSignal.timeout(ms)`.
- Go `http.Client{}` with no `Timeout`, and `http.Get(...)` (the default client).
- Rust `reqwest::Client::new()` with no `.timeout(...)`.
- Database drivers with no statement timeout, and Redis clients with no command timeout.

Also look for:

- A fan-out that waits for the slowest of N calls. The request is as slow as its slowest dependency.
- Retry loops whose total time exceeds the endpoint budget.

## Traps

- A timeout longer than the caller's budget protects nothing. The caller times out first and the work continues.
- Published latency tables are orders of magnitude, not your numbers. Measure your system and label the result MEASURED.
