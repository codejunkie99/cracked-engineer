import sqlite3
from pathlib import Path

SCHEMA = Path(__file__).with_name("schema.sql").read_text()


def connect(path=":memory:"):
    db = sqlite3.connect(path, isolation_level=None)
    db.executescript(SCHEMA)
    return db


def handle_payment_event(db, event):
    """Apply a payment event once. Returns "applied", or "duplicate" for a redelivery."""
    db.execute("BEGIN")
    try:
        db.execute("INSERT INTO payment_events (event_id) VALUES (?)", (event["id"],))
    except sqlite3.IntegrityError:
        db.execute("ROLLBACK")
        return "duplicate"
    try:
        db.execute(
            "INSERT INTO ledger_entries (event_id, user_id, amount_cents) VALUES (?, ?, ?)",
            (event["id"], event["user_id"], event["amount_cents"]),
        )
        db.execute(
            "INSERT INTO plans (user_id, plan) VALUES (?, ?) "
            "ON CONFLICT (user_id) DO UPDATE SET plan = excluded.plan",
            (event["user_id"], event["plan"]),
        )
    except BaseException:
        db.execute("ROLLBACK")
        raise
    db.execute("COMMIT")
    return "applied"


def current_plan(db, user_id):
    row = db.execute("SELECT plan FROM plans WHERE user_id = ?", (user_id,)).fetchone()
    return row[0] if row else "free"
