"""Canonical identity store for the optional multi-user layer."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import secrets
import sqlite3
import threading
from typing import Any
from uuid import uuid4

from deeptutor.utils.secret_files import write_secret_text

from .book_permission import (
    BookPermission,
    canonical_book_permission,
    normalize_book_permission,
    public_permission_dict,
)
from .learner_profile import normalize_profile
from .models import AccountPreset, Role, normalize_role
from .paths import PROJECT_ROOT, SYSTEM_ROOT, migrate_legacy_multi_user_tree

logger = logging.getLogger(__name__)

# Serializes identity-store read/modify/write operations within this process.
# SQLite transactions additionally serialize database writes across processes.
_USERS_WRITE_LOCK = threading.RLock()

AUTH_DIR = SYSTEM_ROOT / "auth"
USERS_DB = AUTH_DIR / "auth.db"
# Compatibility constant; user records are stored in SQLite.
USERS_FILE = AUTH_DIR / "users.json"
SECRET_FILE = AUTH_DIR / "auth_secret"
LEGACY_USERS_FILE = PROJECT_ROOT / "data" / "user" / "auth_users.json"
LEGACY_SECRET_FILE = PROJECT_ROOT / "data" / "user" / "auth_secret"


def new_user_id() -> str:
    return f"u_{uuid4().hex}"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _canonical_record(
    username: str,
    value: Any,
    *,
    default_role: Role = "user",
) -> dict[str, Any] | None:
    if isinstance(value, str):
        return {
            "id": new_user_id(),
            "hash": value,
            "role": default_role,
            "created_at": utc_now(),
            "disabled": False,
            "avatar": "",
        }
    if not isinstance(value, dict):
        return None
    hashed = str(value.get("hash") or value.get("password_hash") or "")
    if not hashed:
        return None
    role = normalize_role(str(value.get("role") or default_role), default_role)
    preset = str(value.get("preset") or "standard")
    if preset not in {"standard", "learner", "custom"}:
        preset = "standard"
    record = {
        "id": str(value.get("id") or new_user_id()),
        "hash": hashed,
        "role": role,
        "created_at": str(value.get("created_at") or utc_now()),
        "disabled": bool(value.get("disabled", False)),
        "avatar": str(value.get("avatar") or ""),
        "preset": preset,
    }
    if "book_permission" in value:
        record["book_permission"] = canonical_book_permission(value.get("book_permission"))
    if "learner_profile" in value:
        record["learner_profile"] = normalize_profile(value.get("learner_profile"))
    return record


def _read_json(path: Path) -> dict[str, Any]:
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
        return loaded if isinstance(loaded, dict) else {}
    except Exception as exc:
        logger.warning("Failed to read %s: %s", path, exc)
        return {}


def _connect_users_db() -> sqlite3.Connection:
    """Open the SQLite identity database and ensure its schema exists."""
    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(USERS_DB, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            id TEXT NOT NULL UNIQUE,
            hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL DEFAULT '',
            disabled INTEGER NOT NULL DEFAULT 0,
            avatar TEXT NOT NULL DEFAULT '',
            preset TEXT NOT NULL DEFAULT 'standard',
            book_permission TEXT,
            learner_profile TEXT
        )
    """)
    return conn


def _has_users() -> bool:
    with _connect_users_db() as conn:
        return conn.execute("SELECT 1 FROM users LIMIT 1").fetchone() is not None


def _db_read_users() -> dict[str, dict[str, Any]]:
    with _connect_users_db() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY rowid").fetchall()
    users: dict[str, dict[str, Any]] = {}
    for row in rows:
        record: dict[str, Any] = {
            "id": row["id"], "hash": row["hash"], "role": row["role"],
            "created_at": row["created_at"], "disabled": bool(row["disabled"]),
            "avatar": row["avatar"], "preset": row["preset"],
        }
        if row["book_permission"] is not None:
            record["book_permission"] = json.loads(row["book_permission"])
        if row["learner_profile"] is not None:
            record["learner_profile"] = json.loads(row["learner_profile"])
        users[row["username"]] = record
    return users


def _write_users(users: dict[str, dict[str, Any]]) -> None:
    """Persist canonical user records to SQLite in a single transaction."""
    with _USERS_WRITE_LOCK:
        with _connect_users_db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("DELETE FROM users")
            for username, record in users.items():
                conn.execute(
                    """INSERT INTO users (
                        username, id, hash, role, created_at, disabled,
                        avatar, preset, book_permission, learner_profile
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        username, str(record.get("id") or new_user_id()),
                        str(record.get("hash") or ""),
                        str(record.get("role") or "user"),
                        str(record.get("created_at") or ""),
                        int(bool(record.get("disabled", False))),
                        str(record.get("avatar") or ""),
                        str(record.get("preset") or "standard"),
                        json.dumps(record["book_permission"], ensure_ascii=False)
                        if "book_permission" in record else None,
                        json.dumps(record["learner_profile"], ensure_ascii=False)
                        if "learner_profile" in record else None,
                    ),
                )


def _migrate_legacy_users() -> dict[str, dict[str, Any]] | None:
    if _has_users() or not LEGACY_USERS_FILE.exists():
        return None
    legacy = _read_json(LEGACY_USERS_FILE)
    users: dict[str, dict[str, Any]] = {}
    for username, value in legacy.items():
        role: Role = "admin" if not users else "user"
        if isinstance(value, dict):
            role = normalize_role(str(value.get("role") or ""), role)  # type: ignore[assignment]
        record = _canonical_record(username, value, default_role=role)
        if record is not None:
            users[str(username)] = record
    if users:
        _write_users(users)
        logger.info("Migrated auth users from %s to %s", LEGACY_USERS_FILE, USERS_DB)
        return users
    return None


def _migrate_secret() -> None:
    if SECRET_FILE.exists() or not LEGACY_SECRET_FILE.exists():
        return
    try:
        secret = LEGACY_SECRET_FILE.read_text(encoding="utf-8").strip()
        if secret:
            write_secret_text(SECRET_FILE, secret)
            logger.info("Migrated auth secret from %s to %s", LEGACY_SECRET_FILE, SECRET_FILE)
    except Exception as exc:
        logger.warning("Failed to migrate legacy auth secret: %s", exc)


def _env_bootstrap_admin() -> tuple[str, str]:
    """Return ``(username, password_hash)`` for the ``auth.json`` bootstrap admin.

    Both halves are required: the shipped default seeds a username with an
    empty hash, which cannot authenticate and therefore is not an admin. An
    empty tuple entry means "no bootstrap admin configured".

    :mod:`deeptutor.services.auth` is imported lazily because it imports this
    module. Its resolved globals — rather than a fresh settings read — are the
    source of truth on purpose: they are exactly the credentials
    ``authenticate()`` accepts, so the promotion gate in :func:`save_user` and
    the login path can never disagree about whether an admin already exists.
    """
    try:
        from deeptutor.services import auth as auth_service

        username = str(getattr(auth_service, "AUTH_USERNAME", "") or "")
        password_hash = str(getattr(auth_service, "AUTH_PASSWORD_HASH", "") or "")
    except Exception as exc:  # pragma: no cover - auth settings unavailable
        logger.warning("Could not resolve the bootstrap admin credentials: %s", exc)
        return "", ""
    if not username or not password_hash:
        return "", ""
    return username, password_hash


def _env_admin_record(password_hash: str) -> dict[str, Any]:
    """Build the in-memory record representing the bootstrap admin."""
    return {
        "id": "env-admin",
        "hash": password_hash,
        "role": "admin",
        "created_at": "",
        "disabled": False,
        "avatar": "",
        "preset": "standard",
    }


def load_users(
    env_username: str = "",
    env_password_hash: str = "",
) -> dict[str, dict[str, Any]]:
    """Load canonical users from SQLite, migrating legacy JSON once if needed."""
    migrate_legacy_multi_user_tree()
    if not _has_users():
        _migrate_legacy_users()

    users = _db_read_users()
    canonical: dict[str, dict[str, Any]] = {}
    changed = False
    for index, (username, value) in enumerate(users.items()):
        role: Role = "admin" if index == 0 else "user"
        if isinstance(value, dict):
            role = normalize_role(str(value.get("role") or ""), role)  # type: ignore[assignment]
        record = _canonical_record(str(username), value, default_role=role)
        if record is None:
            changed = True
            continue
        canonical[str(username)] = record
        changed = changed or record != value

    if changed:
        _write_users(canonical)

    # The configured bootstrap admin is an in-memory overlay only.
    if env_username and env_password_hash and env_username not in canonical:
        merged = {env_username: _env_admin_record(env_password_hash)}
        merged.update(canonical)
        return merged
    return canonical


def save_user(
    username: str,
    hashed_password: str,
    role: Role = "user",
    preset: AccountPreset = "standard",
) -> dict[str, Any]:
    # Read-modify-write must be atomic so concurrent first-time registrations
    # cannot each see an empty store and each promote themselves to admin.
    with _USERS_WRITE_LOCK:
        # Called without the env arguments on purpose: ``users`` is written back
        # to disk below, and the bootstrap admin must stay an in-memory overlay.
        users = load_users()
        env_username, _ = _env_bootstrap_admin()
        # A configured bootstrap admin counts as an existing account, so the
        # first account an operator creates from /admin/users is not silently
        # promoted — that endpoint documents role="user" (#849). Re-saving the
        # bootstrap admin's own username adopts it into the store instead, and
        # must keep the admin role.
        account_exists = bool(users) or (bool(env_username) and env_username != username)
        effective_role: Role = role if account_exists else "admin"
        existing = users.get(username) or {}
        effective_preset = str(existing.get("preset") or preset or "standard")
        if effective_preset not in {"standard", "learner", "custom"}:
            effective_preset = preset
        record = {
            "id": str(existing.get("id") or new_user_id()),
            "hash": hashed_password,
            "role": effective_role,
            "created_at": str(existing.get("created_at") or utc_now()),
            "disabled": bool(existing.get("disabled", False)),
            "avatar": str(existing.get("avatar") or ""),
            "preset": effective_preset,
            "book_permission": canonical_book_permission(existing.get("book_permission")),
            "learner_profile": normalize_profile(existing.get("learner_profile")),
        }
        users[username] = record
        _write_users(users)
    return record


def _role_display_name(role: str) -> str:
    try:
        from .roles import role_name

        return role_name(role)
    except Exception:
        return role


def list_user_info(  # nosec B107 - empty defaults mean "no env fallback supplied".
    env_username: str = "",
    env_password_hash: str = "",
) -> list[dict[str, Any]]:
    return [
        {
            "id": record.get("id", ""),
            "username": username,
            "role": record.get("role", "user"),
            "role_name": _role_display_name(str(record.get("role") or "user")),
            "created_at": record.get("created_at", ""),
            "disabled": bool(record.get("disabled", False)),
            "avatar": str(record.get("avatar") or ""),
            "preset": str(record.get("preset") or "standard"),
            "book_permission": public_permission_dict(
                normalize_book_permission(record.get("book_permission"))
            ),
        }
        for username, record in load_users(env_username, env_password_hash).items()
    ]


def get_user(username: str) -> dict[str, Any] | None:
    return load_users().get(username)


def get_user_by_id(user_id: str) -> tuple[str, dict[str, Any]] | None:
    for username, record in load_users().items():
        if str(record.get("id") or "") == user_id:
            return username, record
    return None


def get_learner_profile(username: str) -> dict[str, Any] | None:
    """Return a learner account's structured profile, if present."""
    record = get_user(username)
    if record is None or str(record.get("preset") or "standard") != "learner":
        return None
    return normalize_profile(record.get("learner_profile"))


def set_learner_profile(username: str, profile: dict[str, Any] | None) -> dict[str, Any] | None:
    """Atomically replace one ordinary user's structured learner profile."""
    with _USERS_WRITE_LOCK:
        users = load_users()
        record = users.get(username)
        if (
            record is None
            or str(record.get("role") or "user") == "admin"
            or str(record.get("preset") or "standard") != "learner"
        ):
            return None
        record["learner_profile"] = normalize_profile(profile)
        _write_users(users)
        return record["learner_profile"]


def set_book_permission(username: str, permission: BookPermission) -> bool:
    """Atomically replace one ordinary user's shared-book permission."""

    if not _has_users():
        return False
    with _USERS_WRITE_LOCK:
        users = load_users()
        record = users.get(username)
        if record is None:
            return False
        record["book_permission"] = public_permission_dict(permission)
        _write_users(users)
    return True


def remove_book_permission_overrides(book_id: str) -> list[str]:
    """Remove a deleted shared book from every explicit ACL.

    Returns affected user ids for the deletion audit summary.
    """

    if not _has_users():
        return []
    affected: list[str] = []
    with _USERS_WRITE_LOCK:
        users = load_users()
        changed = False
        for record in users.values():
            permission = normalize_book_permission(record.get("book_permission"))
            books = permission.books_dict()
            if book_id not in books:
                continue
            books.pop(book_id)
            record["book_permission"] = public_permission_dict(
                BookPermission(
                    create=permission.create,
                    default=permission.default,
                    books=tuple(books.items()),
                )
            )
            affected.append(str(record.get("id") or ""))
            changed = True
        if changed:
            _write_users(users)
    return affected


def delete_user(username: str) -> bool:
    if not _has_users():
        return False
    with _USERS_WRITE_LOCK:
        users = load_users()
        record = users.get(username)
        if record is None:
            return False
        user_id = str(record.get("id") or "")
        users.pop(username, None)
        _write_users(users)
    try:
        from .guardians import revoke_relationships_for_user

        # Route guards also revalidate both accounts, so a rare cleanup failure
        # can never make a deleted-user relationship usable.
        revoke_relationships_for_user(user_id, reason="user_deleted")
    except Exception:
        logger.exception("Could not revoke guardian relationships after user deletion")
    return True


def set_password(username: str, hashed_password: str) -> dict[str, Any] | None:
    """Replace one account's password hash without changing its identity fields."""
    if not _has_users():
        return None
    with _USERS_WRITE_LOCK:
        users = load_users()
        record = users.get(username)
        if record is None:
            return None
        record["hash"] = hashed_password
        _write_users(users)
        return deepcopy(record)


def set_avatar(username: str, avatar: str) -> bool:
    """Update the avatar marker for an existing user. Returns True on success."""
    if not _has_users():
        return False
    with _USERS_WRITE_LOCK:
        users = load_users()
        if username not in users:
            return False
        users[username]["avatar"] = avatar
        _write_users(users)
    return True


# ---------------------------------------------------------------------------
# Avatar image files — stored next to the user store, keyed by user id
# ---------------------------------------------------------------------------

# Extensions are derived from server-side content sniffing, never from the
# uploaded filename, so this list is also the full set of files we may serve.
AVATAR_EXTENSIONS = ("png", "jpg", "webp")


def _avatar_dir() -> Path:
    # Resolved lazily so tests that monkeypatch AUTH_DIR keep avatars isolated.
    return AUTH_DIR / "avatars"


def get_avatar_file(user_id: str) -> Path | None:
    """Return the stored avatar image for ``user_id``, or None."""
    for ext in AVATAR_EXTENSIONS:
        candidate = _avatar_dir() / f"{user_id}.{ext}"
        if candidate.is_file():
            return candidate
    return None


def save_avatar_file(user_id: str, data: bytes, ext: str) -> Path:
    """Atomically persist an avatar image, replacing any previous one."""
    if ext not in AVATAR_EXTENSIONS:
        raise ValueError(f"Unsupported avatar extension: {ext!r}")
    directory = _avatar_dir()
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{user_id}.{ext}"
    tmp = directory / f"{user_id}.{ext}.tmp"
    tmp.write_bytes(data)
    tmp.replace(target)
    # A re-upload may change the extension; drop stale siblings.
    for other in AVATAR_EXTENSIONS:
        if other != ext:
            (directory / f"{user_id}.{other}").unlink(missing_ok=True)
    return target


def delete_avatar_file(user_id: str) -> None:
    for ext in AVATAR_EXTENSIONS:
        (_avatar_dir() / f"{user_id}.{ext}").unlink(missing_ok=True)


def set_role(username: str, role: Role) -> bool:
    from .roles import role_exists

    if not role_exists(role):
        raise ValueError(f"Unknown role: {role!r}")
    if not _has_users():
        return False
    with _USERS_WRITE_LOCK:
        users = load_users()
        if username not in users:
            return False
        users[username]["role"] = role
        _write_users(users)
    return True


def set_preset(
    username: str, preset: AccountPreset, *, expected_user_id: str | None = None
) -> bool:
    """Update an account's configuration preset without changing its role."""
    if preset not in {"standard", "learner", "custom"}:
        raise ValueError("preset must be 'standard', 'learner', or 'custom'")
    if not _has_users():
        return False
    with _USERS_WRITE_LOCK:
        users = load_users()
        if username not in users:
            return False
        if (
            expected_user_id is not None
            and str(users[username].get("id") or "") != expected_user_id
        ):
            return False
        users[username]["preset"] = preset
        _write_users(users)
    return True


def load_or_create_auth_secret() -> str:
    migrate_legacy_multi_user_tree()
    _migrate_secret()
    try:
        if SECRET_FILE.exists():
            existing = SECRET_FILE.read_text(encoding="utf-8").strip()
            if existing:
                return existing
        generated = secrets.token_hex(32)
        write_secret_text(SECRET_FILE, generated)
        logger.warning(
            "Auth is enabled and no auth_secret file exists. Generated a stable local secret at %s.",
            SECRET_FILE,
        )
        return generated
    except Exception as exc:
        logger.warning("Failed to load/create auth secret at %s: %s", SECRET_FILE, exc)
        return secrets.token_hex(32)
