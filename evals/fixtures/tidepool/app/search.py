def search_posts(db, text, limit=20):
    return db.execute(
        "SELECT id, author_id, body FROM posts WHERE visibility = 'public' AND body LIKE ? ORDER BY id DESC LIMIT ?",
        (f"%{text}%", limit),
    ).fetchall()
