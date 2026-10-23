
"""Migrate DeepTutor users.json records to SQLite."""

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT,
    disabled INTEGER NOT NULL DEFAULT 0,
    avatar TEXT NOT NULL DEFAULT '',
    preset TEXT NOT NULL DEFAULT 'standard',
    book_permission TEXT NOT NULL DEFAULT '{}',
    learner_profile TEXT,
    profile_json TEXT NOT NULL
);
"""


def load_users(source: Path) -> dict[str, dict[str, Any]]:
    with source.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError("users.json must be an object keyed by username")

    seen_ids: set[str] = set()

    for username, user in data.items():
        if not isinstance(username, str) or not username.strip():
            raise ValueError("Username must be a non-empty string")

        if not isinstance(user, dict):
            raise ValueError(f"Invalid user record: {username}")

        for field in ("id", "hash"):
            if not isinstance(user.get(field), str) or not user[field]:
                raise ValueError(
                    f"User {username!r} has a missing or invalid {field!r}"
                )

        if user["id"] in seen_ids:
            raise ValueError(f"Duplicate user ID: {user['id']}")
        seen_ids.add(user["id"])

        if not isinstance(user.get("disabled", False), bool):
            raise ValueError(f"Invalid disabled value for {username!r}")

        if not isinstance(user.get("book_permission", {}), dict):
            raise ValueError(
                f"Invalid book_permission for {username!r}"
            )

    return data


def migrate_users(
    source: Path,
    database: Path,
    *,
    dry_run: bool = False,
    replace: bool = False,
) -> int:
    users = load_users(source)

    if dry_run:
        print(f"Dry run: validated {len(users)} user records.")
        print(f"Source: {source}")
        print(f"Target: {database}")
        return len(users)

    database.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(database, timeout=30)

    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 30000")
        conn.execute(SCHEMA)

        insert_sql = """
            INSERT INTO users (
                username, id, hash, role, created_at, disabled,
                avatar, preset, book_permission, learner_profile
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        if replace:
            # Explicitly requested replacement of existing usernames.
            # Conflicting IDs belonging to another username still fail.
            insert_sql = """
                INSERT INTO users (
                    username, id, hash, role, created_at, disabled,
                    avatar, preset, book_permission, learner_profile
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    id = excluded.id,
                    hash = excluded.hash,
                    role = excluded.role,
                    created_at = excluded.created_at,
                    disabled = excluded.disabled,
                    avatar = excluded.avatar,
                    preset = excluded.preset,
                    book_permission = excluded.book_permission,
                    learner_profile = excluded.learner_profile
            """

        with conn:
            for username, user in users.items():
                book_permission = user.get("book_permission", {})
                learner_profile = user.get("learner_profile")

                conn.execute(
                    insert_sql,
                    (
                        username,
                        user["id"],
                        user["hash"],
                        user.get("role", "user"),
                        user.get("created_at"),
                        int(user.get("disabled", False)),
                        user.get("avatar", ""),
                        user.get("preset", "standard"),
                        json.dumps(
                            book_permission,
                            ensure_ascii=False,
                            separators=(",", ":"),
                        ),
                        (
                            json.dumps(
                                learner_profile,
                                ensure_ascii=False,
                                separators=(",", ":"),
                            )
                            if learner_profile is not None
                            else None
                        ),
                    ),
                )

        count = conn.execute(
            "SELECT COUNT(*) FROM users"
        ).fetchone()[0]

        print(f"Migration completed. Source records: {len(users)}.")
        print(f"Total records in SQLite: {count}.")
        return len(users)

    finally:
        conn.close()


if __name__ == '__main__':
    migrate_users(Path("../data/system/auth/users.json"), Path("../data/system/auth/auth"))