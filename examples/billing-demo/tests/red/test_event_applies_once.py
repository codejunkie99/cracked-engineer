import unittest

from billing.events import connect, current_plan, handle_payment_event

EVENT = {"id": "evt_123", "user_id": "u_1", "amount_cents": 1200, "plan": "pro"}


class EventAppliesOnce(unittest.TestCase):
    def test_redelivered_event_changes_state_once(self):
        db = connect()
        results = [handle_payment_event(db, dict(EVENT)) for _ in range(5)]
        entries = db.execute("SELECT COUNT(*) FROM ledger_entries").fetchone()[0]
        self.assertEqual(entries, 1, f"ledger has {entries} entries; expected 1")
        self.assertEqual(results, ["applied"] + ["duplicate"] * 4)
        self.assertEqual(current_plan(db, "u_1"), "pro")


if __name__ == "__main__":
    unittest.main()
