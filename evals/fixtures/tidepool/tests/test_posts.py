import unittest

from app.db import connect
from app.posts import create_post, get_post, home_timeline


class Posts(unittest.TestCase):
    def setUp(self):
        self.db = connect()
        self.db.execute("INSERT INTO users (id, name) VALUES ('a', 'Ana'), ('b', 'Ben'), ('c', 'Cy')")
        self.db.execute("INSERT INTO follows (follower_id, author_id) VALUES ('b', 'a')")

    def test_follower_sees_followers_only_post(self):
        post_id = create_post(self.db, "a", "hello", "followers")
        self.assertEqual(get_post(self.db, "b", post_id)[0], 200)

    def test_stranger_does_not_see_followers_only_post(self):
        post_id = create_post(self.db, "a", "hello", "followers")
        self.assertEqual(get_post(self.db, "c", post_id), (404, None))

    def test_timeline_shows_followed_authors(self):
        create_post(self.db, "a", "first")
        self.assertEqual([r[2] for r in home_timeline(self.db, "b")], ["first"])


if __name__ == "__main__":
    unittest.main()
