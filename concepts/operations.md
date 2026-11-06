# Operations

Read when the work touches SLOs, alerts, logs, tracing, deploys, feature flags, or a runbook.

## Decide

- An SLO for each user-facing path: the SLI (for example, the share of requests under 300 ms with no 5xx), the target, and the window (example: 99.9% over 30 days).
- The error budget policy: what the team stops doing when the budget is spent.
- The deploy method: canary or staged rollout, and the signal that stops it.

## Burn-rate alerts

The burn rate is the observed error rate divided by the error rate the SLO allows. At a burn rate of 1, the budget lasts exactly the window. At 10, a 30-day budget lasts 3 days. The Google SRE Workbook suggests these starting points for a 30-day window:

| Budget spent | In | Burn rate | Action |
|---|---|---|---|
| 2% | 1 hour | 14.4 | page |
| 5% | 6 hours | 6 | page |
| 10% | 3 days | 1 | ticket |

Alert on symptoms that users feel (errors, latency), not on causes (CPU).

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| Each user-facing path has an SLO and a burn-rate alert | the table above | alert rules in the repository, `alert_fires_on_burn` (test) |
| A request ID reaches every call and every job | W3C trace context or OpenTelemetry | `request_id_reaches_job` (test) |
| The dead-letter queue raises an alert | any message older than a threshold (GUESS) | alert rules (test) |
| A service has a readiness gate before its first production deploy | a logging baseline, a rollback path, an SLO draft, a runbook, tested alerts | PR template (doc) |
| Each feature flag has an owner and a removal date | in the flag's definition | a lint on the flag registry (lint) |

## Red tests

### `alert_fires_on_burn`

- Run: unit-test the alert rules with synthetic series, for example with `promtool test rules` for Prometheus. Feed an error rate at a burn rate of 15 for 1 hour.
- Assert: the page alert fires.
- Break: set the alert threshold to a burn rate of 100.
- Expect: no alert fires.

### `request_id_reaches_job`

- Run: send a request with a known request ID. The request enqueues a job.
- Assert: the job's log lines carry the same request ID.
- Break: drop the request ID when the job is enqueued.
- Expect: the job logs carry no request ID, or a new one.

## Audit

- Log lines with no request ID.
- Alerts on CPU or memory with no SLO alert.
- A dead-letter queue that nobody watches.
- Deploys with no rollback step, and flags with no owner.

## Example

Dapper (Google) traces a request across services by passing trace context with each call, and samples traces to keep overhead low. For an agent build, the move is simpler: pass a request ID through every call and every queued job, so a fan-out job traces back to the post that caused it.
