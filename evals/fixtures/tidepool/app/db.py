import sqlite3
from pathlib import Path

SCHEMA = Path(__file__).with_name("schema.sql").read_text()


def connect(path=":memory:"):
    db = sqlite3.connect(path, isolation_level=None)
    db.executescript(SCHEMA)
    return db
