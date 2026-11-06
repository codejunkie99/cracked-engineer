# SYSTEM.md

Billing demo for cracked-engineer. The numbers are examples.

## intake
- use cases in scope: apply payment events from the provider, read a user's plan
- use cases out of scope: checkout, refunds, invoices
- paying users: 5,000 (GUESS)
- payment events: 200 per day (GUESS)
- peak event rate: 1 per second (GUESS, peak factor 400 on the daily average)
- the provider can deliver one event more than once (provider docs). Each event must apply once (TARGET).
- in-flight handlers at peak: 0.05 (DERIVED: Little's law, 1 per second x 0.05 s)

## targets
- event handler p99: 200 ms (TARGET)
- RPO: 5 min (TARGET). RTO: 30 min (TARGET).

## data
- source of truth: one SQLite file in the demo, Postgres in production
- CONSISTENT: payment_events, ledger_entries, plans
- EVENTUAL: none

## concepts
- capacity: decided (intake)
- latency: skip: the demo makes no outbound calls
- consistency: decided (data)
- recovery: skip: the demo has no production database
- edge: skip: the demo has no HTTP edge
- modules: decided (MODULES.md)
- database: decided (R1)
- cache: skip: the demo has no cache
- jobs: decided (R1)
- calls: skip: the demo makes no outbound calls
- security: decided (R2, R3)
- operations: skip: the demo has no deployment

## rules
| ID | Rule | Concept | Enforcer | Level | Check | Status |
|---|---|---|---|---|---|---|
| R1 | A payment event changes state at most once | jobs | primary key on payment_events.event_id, written in the same transaction as the ledger entry | test | `event_applies_once` | PROVEN |
| R2 | SQL is never built from strings | security | tools/no_string_sql.py, an AST check | lint | `no_string_sql` | PROVEN |
| R3 | The agent's database role cannot drop data | security | database grants | permission | - | UNTESTED: the demo has no production database |

## limits
- A test catches only the fault it defines. A wrong rule passes its own test.
- SQLite stands in for Postgres. Check the primary key behavior on the production database too.
