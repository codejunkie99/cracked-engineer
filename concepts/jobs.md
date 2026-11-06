# Jobs

Read when the work touches queues, workers, webhooks, events, retries, or any slow or external work.

## Decide

- Which work runs in the worker. Slow work and external calls do. Cheap work and realtime flows can stay in the request: a queue adds delay and parts.
- The identity of each job or event (an event ID), and where it is recorded.
- For each external side effect (a charge, an email, a push): the idempotency key, and what the code does when the result is unknown.
- The retry limit, the backoff, and the dead-letter queue of each queue.
- The max depth of each queue, and the lag that raises an alert.

## Duplicates are normal

Many queues and webhook senders deliver at least once: a message can arrive more than once. Check your queue's documented delivery behavior.

- **Local effects** are the easy part. Write the event ID and the state change in one transaction, with a unique constraint on the event ID. A duplicate then fails the insert and changes nothing.
- **External effects** are the hard part. A local unique row cannot stop a second call to a provider. Picture the crash: the provider accepts the call, the worker dies before it records the result, and the retry calls again. There are two safe options:
  1. Send the same idempotency key on every attempt, to a provider that deduplicates by that key.
  2. If the provider cannot deduplicate, record the attempt as UNCERTAIN before the call, and reconcile with the provider before any retry.
- **A database write plus a published event** is a dual write. A crash between them loses the event, and a retry can send an event for a write that never committed. Write the event to an outbox table in the same transaction, and let a relay publish it. The relay delivers at least once, so consumers stay idempotent.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| Every consumer is idempotent | event ID plus state change in one transaction, unique constraint on the event ID | the constraint (architecture), `event_applies_once` (test) |
| An external call sends the same idempotency key on every attempt | the key is derived from the job ID, not made per attempt | `provider_call_applies_once` (test) |
| An unknown result is reconciled before a retry | the attempt is marked UNCERTAIN before the call | `reconcile_uncertain_before_retry` (test) |
| A write and its event commit together | transactional outbox | `write_and_event_commit_together` (test) |
| Retries are bounded | at most 5 attempts (example), exponential backoff with jitter, then the dead-letter queue | queue configuration (lint) |
| A full queue sheds load | a max depth. Enqueue returns 503 with Retry-After when full. | `full_queue_sheds_load` (test) |
| Queue lag and the dead-letter queue raise alerts | thresholds are GUESS until measured | see `operations.md` (test) |

## Red tests

### `event_applies_once`

- Run: deliver the same event 5 times.
- Assert: exactly 1 state change (for a payment: 1 plan change and 1 ledger entry).
- Break: remove the unique constraint on the event ID.
- Expect: each delivery applies again.
- A runnable version is in `examples/billing-demo/`.

### `provider_call_applies_once`

- Run: make the fake provider deduplicate by key. Crash the worker after the provider accepts and before the local record. Retry with the same job.
- Assert: the provider records exactly 1 operation.
- Break: make a new idempotency key on each attempt.
- Expect: the provider records 2 or more operations.

### `reconcile_uncertain_before_retry`

- Run: make the fake provider accept a charge, then hang, so the caller marks the attempt UNCERTAIN. Retry before the reconcile finishes.
- Assert: no second provider call until the reconcile finishes. After it, the ledger matches the provider.
- Break: retry at once on a timeout, with no reconcile.
- Expect: the provider records 2 operations.

### `write_and_event_commit_together`

- Run: make the publish step fail after the database commit (or crash between them).
- Assert: after recovery, the event is published exactly once for the committed write, and no event exists for a rolled-back write.
- Break: publish to the broker directly after the commit, with no outbox.
- Expect: the event is lost.

### `full_queue_sheds_load`

- Run: set the max depth to 1,000 (example). Stop the workers. Enqueue 1,500 jobs.
- Assert: jobs 1,001 to 1,500 receive 503 with Retry-After. After the workers restart, the first 1,000 jobs complete.
- Break: remove the max depth.
- Expect: all 1,500 jobs are accepted, and no 503 is returned.

## Audit

- Webhook and event handlers with no dedupe on the event ID.
- `queue.Queue()` with no `maxsize`, unbounded channels, and in-memory lists used as queues.
- Retry loops with no limit, a fixed `sleep`, or no jitter.
- `except: pass` and empty `catch` blocks around a job.
- A publish to a broker right after a database commit, with no outbox.
- A new idempotency key made inside the retry loop.

## Traps

- A queue larger than memory spills to disk and slows everything.
- A retry with no jitter makes every client retry at the same moment.
