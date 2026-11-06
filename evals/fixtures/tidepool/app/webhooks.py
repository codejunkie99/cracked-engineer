PRO_PRICE_CENTS = 1200


def handle_payment(db, event):
    """Called by the HTTP layer for each payment webhook from the provider."""
    if event["type"] != "payment.succeeded":
        return "ignored"
    user_id = event["data"]["user_id"]
    db.execute("UPDATE users SET plan = 'pro' WHERE id = ?", (user_id,))
    db.execute(
        "INSERT INTO ledger_entries (user_id, amount_cents, event_id) VALUES (?, ?, ?)",
        (user_id, PRO_PRICE_CENTS, event["id"]),
    )
    return "ok"
