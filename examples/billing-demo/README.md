# Billing demo

A small billing module with two proven rules. Use it to see the cracked-engineer loop end to end. It needs git, Node 18 or newer, and Python 3.

| Rule | Check | Fault in the break patch |
|---|---|---|
| R1: a payment event changes state at most once | `event_applies_once` | the primary key on `payment_events.event_id` is removed |
| R2: SQL is never built from strings | `no_string_sql` | `current_plan` builds its query with an f-string |

## Run it

The scripts apply break patches with git, so work in a copy that is a git repository.

```sh
cp -R <skill folder>/examples/billing-demo /tmp/billing-demo
cd /tmp/billing-demo
git init -q && git add -A && git commit -qm init
node <skill folder>/scripts/install.mjs .

node .cracked/check_system.mjs        # 2 errors: R1 and R2 are PROVEN, but no proof exists yet
node .cracked/red_green.mjs --all     # each check: GREEN, then RED with its fault, then the files are restored
node .cracked/check_system.mjs --strict   # 0 errors
```

## Try a regression

Plant a fault for real and see the fast check catch it:

```sh
sed -i.bak 's/event_id TEXT PRIMARY KEY,/event_id TEXT NOT NULL,/' billing/schema.sql
node .cracked/red_green.mjs --fast    # FAIL event_applies_once: ledger has 5 entries; expected 1
mv billing/schema.sql.bak billing/schema.sql
```
