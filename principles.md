# Principles

Twelve principles decide the cases that the concept files do not cover. Each one has a check, so a reviewer can see whether the code follows it. In a PR, cite a principle by number and name, and name the decision it changed.

## Contents

1. One owner per piece of state
2. Things that change together live together
3. Every dependency fails
4. Bound everything
5. Every write is safe to repeat
6. Compute is stateless
7. Choose consistency per data type
8. Contain the blast radius
9. Prefer reversible changes
10. Start boring
11. Measure before you scale
12. A failure you cannot see is not handled

## 1. One owner per piece of state

Each table, key space, file, and queue has exactly one module that writes it. Other modules read it through that module's interface, or ask the owner to change it.

- **Why:** two writers drift apart. An agent that edits one writer cannot see the other.
- **Check:** for each table in `MODULES.md`, search the code for writes outside the owner. Better: give each module its own database role or schema, so a write from another module fails.
- **Concepts:** `modules.md`, `database.md`.

## 2. Things that change together live together

Code that changes for the same reason goes in one module. Code that changes for different reasons does not share a module. Each module depends only on modules that change less often than it does.

- **Why:** a change that touches five modules is five chances to miss one. A stable module that imports a volatile one must change every time the volatile one does.
- **Check:** read `git log` for files that change in the same commits but have no import between them. Count how often each module changes, and check that imports point toward the modules that change less.
- **Concepts:** `modules.md`. For a full structural pass, use a dedicated refactor skill.

## 3. Every dependency fails

Every call to a database, a cache, a queue, or another service can hang or fail. Give every call a timeout that is shorter than the caller's budget, and a defined result on timeout.

- **Why:** a call with no timeout holds a worker until the pool is empty. One slow dependency then stops every endpoint.
- **Check:** every outbound call in the code has a timeout. Inject 30 s of latency on each dependency, and check that p99 stays under its TARGET.
- **Concepts:** `latency.md`, `calls.md`.

## 4. Bound everything

Give every queue a max depth, every retry loop a max attempt count, every pool a size, every request a max body size, every list a max page size, and every caller a rate limit. Each bound is a number in `SYSTEM.md` with a label.

- **Why:** an unbounded resource grows until something else fails, often far from the cause.
- **Check:** search for queues, retries, pools, and list endpoints with no limit. A full queue returns 503 with Retry-After. It does not grow.
- **Concepts:** `jobs.md`, `capacity.md`, `security.md`.

## 5. Every write is safe to repeat

A retry, a redelivery, or a restart after a crash must reach the same end state as one run. Give each write an identity (an event ID or an idempotency key), and record that identity in the same transaction as the write.

- **Why:** networks and queues deliver more than once. A crash between "done" and "recorded" causes a retry.
- **Check:** run the operation twice, and run it again after a crash at each step. The end state is the same.
- **Concepts:** `jobs.md`, `calls.md`.

## 6. Compute is stateless

App instances keep no state that a user needs. Sessions, uploads, locks, rate-limit counters, and caches that must agree across instances live in shared stores.

- **Why:** a load balancer sends the next request to any instance. An instance can die at any moment.
- **Check:** kill one instance under load. No user loses a session, an upload, or a lock.
- **Concepts:** `capacity.md`, `edge.md`.

## 7. Choose consistency per data type

Label each table or collection CONSISTENT or EVENTUAL. Money, permissions, plan status, and inventory are CONSISTENT. Counts, feed order, and search results can be EVENTUAL.

- **Why:** strong consistency everywhere costs latency and availability. Weak consistency on money loses money.
- **Check:** every table has a label in `SYSTEM.md`. CONSISTENT reads go to the primary. A user who writes reads their own write.
- **Concepts:** `consistency.md`, `cache.md`.

## 8. Contain the blast radius

Give each part only the access it needs. Separate the credentials of the agent, the app, and the admin. Give each dependency its own pool or worker group. Keep backups where the app and the agent cannot delete them.

- **Why:** a mistake, a bug, or an agent with broad access turns one failure into a total loss.
- **Check:** with the agent's credentials, try to drop a table and delete a backup. Both fail. One slow dependency cannot use up the shared pool.
- **Concepts:** `security.md`, `recovery.md`, `latency.md`.

## 9. Prefer reversible changes

Change the schema in steps that old and new code can both run on (expand, migrate, contract). Ship behavior behind a flag. To recover, roll back the code, not the data.

- **Why:** during a deploy, old and new versions run side by side. A one-step breaking change fails during that window, and a data rollback loses writes.
- **Check:** the previous release passes its tests against the new schema. Each flag has an owner and a removal date.
- **Concepts:** `database.md`, `operations.md`.

## 10. Start boring

Start with one modular monolith, one worker process, one relational database, and one queue. Add a service or a datastore only for a named reason: a different scaling need, a different owner, a different failure domain, or an access pattern the current store cannot serve. Write that reason in an ADR.

- **Why:** each part adds a deploy, a failure mode, and a network hop. A split without a reason adds those costs and no benefit.
- **Check:** count the services and datastores. Each one has an ADR that names its reason.
- **Concepts:** `modules.md`, `database.md`.

## 11. Measure before you scale

Label every number MEASURED, TARGET, GUESS, or DERIVED. Before you trust a measured number, find what limits it, and rule out errors, cached work, and noise. Scale the part that the measurement names, not the part that feels slow.

- **Why:** a fix for the wrong bottleneck adds cost and no speed. A number with no label is a hidden guess.
- **Check:** every MEASURED number names its run log. The log names the limiter, the run count, and the spread.
- **Concepts:** `capacity.md`.

## 12. A failure you cannot see is not handled

Pass a request ID through every call and every queued job. Define an SLO for each user-facing path, and alert on how fast the error budget burns. Watch the dead-letter queue. Test each alert by causing its fault.

- **Why:** a failure that no one detects becomes a user report, an hour or a day late.
- **Check:** inject the fault. The alert fires before a user would notice. The request ID connects the request to the job it started.
- **Concepts:** `operations.md`, `jobs.md`.
