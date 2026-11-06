# MODULES.md

## module: billing

### owns
- tables: payment_events, ledger_entries, plans
- the only code that writes those tables

### public interface
- `connect(path) -> connection`
- `handle_payment_event(db, event) -> "applied" | "duplicate"`
- `current_plan(db, user_id) -> plan`

### consistency
- CONSISTENT. Every read goes to the primary.

### promises
- A payment event changes state at most once, however many times it arrives.
- The event row, the ledger entry, and the plan change commit together or not at all.

### failure behavior
- duplicate event: returns "duplicate" and changes nothing.
- database error: the transaction rolls back and the error goes to the caller.

### the hard part
- A redelivered event. The provider sends an event again until it gets a 2xx response.

### red tests
- `event_applies_once`
- `no_string_sql`

### not allowed
- Other modules read or write billing tables directly.
- The contract changes without an ADR.
