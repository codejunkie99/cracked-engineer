import queue
import threading

NOTIFY_QUEUE = queue.Queue()


def enqueue_push(user_id, text):
    NOTIFY_QUEUE.put({"user_id": user_id, "text": text})
    return 202


def notify_followers(db, author_id, text):
    followers = db.execute("SELECT follower_id FROM follows WHERE author_id = ?", (author_id,)).fetchall()
    for (follower_id,) in followers:
        enqueue_push(follower_id, text)


def worker(send):
    while True:
        job = NOTIFY_QUEUE.get()
        try:
            send(job["user_id"], job["text"])
        except Exception:
            pass
        NOTIFY_QUEUE.task_done()


def start(send):
    threading.Thread(target=worker, args=(send,), daemon=True).start()
