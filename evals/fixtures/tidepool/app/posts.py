def create_post(db, author_id, body, visibility="public"):
    cur = db.execute(
        "INSERT INTO posts (author_id, body, visibility) VALUES (?, ?, ?)",
        (author_id, body, visibility),
    )
    return cur.lastrowid


def get_post(db, viewer_id, post_id):
    row = db.execute("SELECT id, author_id, body, visibility FROM posts WHERE id = ?", (post_id,)).fetchone()
    if row is None:
        return 404, None
    _, author_id, body, visibility = row
    if visibility == "followers" and viewer_id != author_id:
        follows = db.execute(
            "SELECT 1 FROM follows WHERE follower_id = ? AND author_id = ?", (viewer_id, author_id)
        ).fetchone()
        if follows is None:
            return 404, None
    return 200, {"id": post_id, "author_id": author_id, "body": body}


def home_timeline(db, viewer_id, limit=50):
    return db.execute(
        "SELECT p.id, p.author_id, p.body FROM posts p "
        "JOIN follows f ON f.author_id = p.author_id "
        "WHERE f.follower_id = ? AND p.visibility IN ('public', 'followers') "
        "ORDER BY p.id DESC LIMIT ?",
        (viewer_id, limit),
    ).fetchall()
