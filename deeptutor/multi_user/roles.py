"""Configurable role definitions and the permission catalog.

Roles are deployment state, not user data: they live in
``data/system/roles.json`` so an operator can inspect and back them up with the
rest of ``data/system``. The four built-in roles are seeded on first use and
cannot be deleted; their permission sets remain editable.

Only ``admin`` grants the shared admin workspace. Any role can carry admin
console permissions, which is what lets a deployment define a narrower
"moderator" style role without inventing a second identity system.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
import logging
import re
import threading
from typing import Any, Iterable
from uuid import uuid4

from deeptutor.services.file_io import atomic_write_text

from .paths import SYSTEM_ROOT, ensure_system_dirs

logger = logging.getLogger(__name__)

ROLES_FILE = SYSTEM_ROOT / "roles.json"
BUILTIN_ROLE_IDS: tuple[str, ...] = ("admin", "teacher", "student", "user")
BUILTIN_ROLE_NAMES: dict[str, str] = {
    "admin": "Admin",
    "teacher": "Teacher",
    "student": "Student",
    "user": "User",
}
ROLE_ID_RE = re.compile(r"^[a-z][a-z0-9_-]{1,31}$")

#: The full permission catalog. Keep this list as the single source of truth:
#: role payloads are validated against it, and the frontend renders exactly
#: these ids.
PERMISSIONS: tuple[dict[str, str], ...] = (
    {
        "id": "admin.users.read",
        "group": "users",
        "label": "View users",
        "description": "See accounts, devices, and learner profiles.",
    },
    {
        "id": "admin.users.write",
        "group": "users",
        "label": "Manage users",
        "description": "Create, import, delete, and disable accounts and devices.",
    },
    {
        "id": "admin.roles.read",
        "group": "roles",
        "label": "View roles",
        "description": "See role definitions and permission assignments.",
    },
    {
        "id": "admin.roles.write",
        "group": "roles",
        "label": "Manage roles",
        "description": "Create roles, edit permissions, and assign roles to accounts.",
    },
    {
        "id": "admin.resources.read",
        "group": "resources",
        "label": "View resource assignments",
        "description": "See shared books, knowledge bases, models, skills, and grants.",
    },
    {
        "id": "admin.resources.write",
        "group": "resources",
        "label": "Manage resource assignments",
        "description": "Assign resources, books, guardians, and learner materials.",
    },
    {
        "id": "admin.settings.manage",
        "group": "system",
        "label": "Manage settings",
        "description": "Change models, providers, MCP, subagents, and engine settings.",
    },
    {
        "id": "admin.plugins.manage",
        "group": "system",
        "label": "Manage plugins",
        "description": "Install, approve, enable, and remove plugins and CLI apps.",
    },
    {
        "id": "admin.system.manage",
        "group": "system",
        "label": "Manage system",
        "description": "View runtime diagnostics and apply application updates.",
    },
)

ALL_PERMISSIONS: frozenset[str] = frozenset(item["id"] for item in PERMISSIONS)
PERMISSION_ORDER: dict[str, int] = {
    item["id"]: index for index, item in enumerate(PERMISSIONS)
}
ADMIN_PERMISSIONS: frozenset[str] = frozenset(
    permission for permission in ALL_PERMISSIONS if permission.startswith("admin.")
)
ROLE_MANAGEMENT_PERMISSION = "admin.roles.write"

_ROLE_LOCK = threading.RLock()
_CACHE: tuple[int, int, list[dict[str, Any]]] | None = None


class RoleStorageError(RuntimeError):
    """The role store cannot be read safely."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ordered_permissions(values: Iterable[Any]) -> list[str]:
    seen = {
        str(value).strip()
        for value in values
        if str(value).strip() in ALL_PERMISSIONS
    }
    return sorted(seen, key=lambda permission: PERMISSION_ORDER[permission])


def _default_roles() -> list[dict[str, Any]]:
    created_at = _utc_now()
    roles: list[dict[str, Any]] = []
    for role_id in BUILTIN_ROLE_IDS:
        permissions = (
            _ordered_permissions(ALL_PERMISSIONS) if role_id == "admin" else []
        )
        roles.append(
            {
                "id": role_id,
                "name": BUILTIN_ROLE_NAMES[role_id],
                "description": "",
                "builtin": True,
                "permissions": permissions,
                "created_at": created_at,
            }
        )
    return roles


def _normalize_role(raw: Any, *, builtin: bool = False) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    role_id = str(raw.get("id") or "").strip().lower()
    if not ROLE_ID_RE.fullmatch(role_id):
        return None
    if builtin and role_id not in BUILTIN_ROLE_IDS:
        return None
    name = str(raw.get("name") or "").strip()[:64]
    if not name:
        name = BUILTIN_ROLE_NAMES.get(role_id, role_id)
    description = str(raw.get("description") or "").strip()[:280]
    created_at = str(raw.get("created_at") or "").strip() or _utc_now()
    return {
        "id": role_id,
        "name": name,
        "description": description,
        "builtin": bool(builtin or raw.get("builtin") is True),
        "permissions": _ordered_permissions(raw.get("permissions") or []),
        "created_at": created_at,
    }


def _roles_from_payload(payload: Any) -> list[dict[str, Any]]:
    raw_roles: Any = payload.get("roles") if isinstance(payload, dict) else payload
    if not isinstance(raw_roles, list):
        raise RoleStorageError("Role store must contain a roles array")
    roles: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in raw_roles:
        role = _normalize_role(raw)
        if role is None or role["id"] in seen:
            continue
        seen.add(role["id"])
        roles.append(role)

    # Built-ins are never lost to a manual edit; missing ones are restored with
    # their defaults, while an existing (possibly customized) set is preserved.
    by_id = {role["id"]: role for role in roles}
    changed = False
    for role_id in BUILTIN_ROLE_IDS:
        if role_id not in by_id:
            roles.append(
                {
                    "id": role_id,
                    "name": BUILTIN_ROLE_NAMES[role_id],
                    "description": "",
                    "builtin": True,
                    "permissions": (
                        _ordered_permissions(ALL_PERMISSIONS)
                        if role_id == "admin"
                        else []
                    ),
                    "created_at": _utc_now(),
                }
            )
            changed = True
        elif not by_id[role_id]["builtin"]:
            by_id[role_id]["builtin"] = True
            changed = True
    if changed:
        roles.sort(key=lambda role: _role_sort_key(role["id"]))
    return roles


def _role_sort_key(role_id: str) -> tuple[int, str]:
    if role_id in BUILTIN_ROLE_IDS:
        return (BUILTIN_ROLE_IDS.index(role_id), role_id)
    return (len(BUILTIN_ROLE_IDS), role_id)


def _write_roles(roles: list[dict[str, Any]]) -> None:
    ensure_system_dirs()
    payload = {"version": 1, "roles": roles}
    atomic_write_text(ROLES_FILE, json.dumps(payload, indent=2, ensure_ascii=False))
    global _CACHE
    try:
        stat = ROLES_FILE.stat()
        _CACHE = (stat.st_mtime_ns, stat.st_size, deepcopy(roles))
    except OSError:
        _CACHE = None


def load_roles() -> list[dict[str, Any]]:
    """Return validated role definitions, seeding built-ins on first use."""
    global _CACHE
    ensure_system_dirs()
    try:
        stat = ROLES_FILE.stat()
    except FileNotFoundError:
        roles = _default_roles()
        _write_roles(roles)
        return deepcopy(roles)

    if _CACHE is not None and _CACHE[:2] == (stat.st_mtime_ns, stat.st_size):
        return deepcopy(_CACHE[2])

    try:
        payload = json.loads(ROLES_FILE.read_text(encoding="utf-8"))
        roles = _roles_from_payload(payload)
    except (OSError, UnicodeError, json.JSONDecodeError, RoleStorageError) as exc:
        logger.error("Cannot read role store %s: %s", ROLES_FILE, exc)
        raise RoleStorageError("Cannot read role store") from exc

    # Normalizing may have repaired/added built-ins; persist that repair so the
    # next request does not repeat it.
    canonical = {"version": 1, "roles": roles}
    try:
        current = json.loads(ROLES_FILE.read_text(encoding="utf-8"))
    except Exception:
        current = None
    if current != canonical:
        _write_roles(roles)
    else:
        _CACHE = (stat.st_mtime_ns, stat.st_size, deepcopy(roles))
    return deepcopy(roles)


def role_map() -> dict[str, dict[str, Any]]:
    return {role["id"]: role for role in load_roles()}


def role_exists(role_id: str) -> bool:
    try:
        return str(role_id or "").strip() in role_map()
    except RoleStorageError:
        return False


def get_role(role_id: str) -> dict[str, Any] | None:
    return role_map().get(str(role_id or "").strip())


def role_name(role_id: str) -> str:
    role = get_role(role_id)
    if role is not None:
        return str(role.get("name") or role["id"])
    return str(role_id or "user")


def permissions_for_role(role_id: str) -> frozenset[str]:
    role = get_role(role_id)
    if role is None:
        return frozenset()
    return frozenset(str(item) for item in role.get("permissions") or [])


def role_has_permission(role_id: str, permission: str) -> bool:
    return permission in permissions_for_role(role_id)


def role_has_any_permission(role_id: str, permissions: Iterable[str]) -> bool:
    granted = permissions_for_role(role_id)
    return any(permission in granted for permission in permissions)


def role_has_admin_permission(role_id: str) -> bool:
    return bool(permissions_for_role(role_id) & ADMIN_PERMISSIONS)


def role_user_counts() -> dict[str, int]:
    from .identity import load_users

    counts = {role["id"]: 0 for role in load_roles()}
    for record in load_users().values():
        role_id = str(record.get("role") or "user")
        counts[role_id] = counts.get(role_id, 0) + 1
    return counts


def public_role(role: dict[str, Any], *, user_count: int = 0) -> dict[str, Any]:
    return {
        "id": role["id"],
        "name": role["name"],
        "description": role.get("description", ""),
        "builtin": bool(role.get("builtin")),
        "permissions": list(role.get("permissions") or []),
        "user_count": user_count,
        "created_at": role.get("created_at", ""),
    }


def _unique_name(roles: list[dict[str, Any]], name: str, *, exclude: str = "") -> bool:
    lowered = name.strip().casefold()
    return all(
        role["id"] == exclude or str(role.get("name") or "").casefold() != lowered
        for role in roles
    )


def _validate_permissions(permissions: Iterable[Any]) -> list[str]:
    values = [str(item).strip() for item in permissions]
    unknown = sorted({value for value in values if value not in ALL_PERMISSIONS})
    if unknown:
        raise ValueError(f"Unknown permission: {unknown[0]}")
    return _ordered_permissions(values)


def create_role(
    *,
    name: str,
    description: str = "",
    permissions: Iterable[str] = (),
    role_id: str | None = None,
) -> dict[str, Any]:
    with _ROLE_LOCK:
        roles = load_roles()
        clean_name = str(name or "").strip()
        if not clean_name:
            raise ValueError("Role name is required.")
        cleaned_id = str(role_id or clean_name).strip().lower()
        cleaned_id = re.sub(r"[^a-z0-9_-]+", "-", cleaned_id).strip("-_")
        if len(cleaned_id) < 2:
            # Non-Latin names produce no usable slug; keep the id stable and
            # unique rather than forcing every such role onto "role-new".
            cleaned_id = f"role-{uuid4().hex[:8]}"
        cleaned_id = cleaned_id[:32]
        if not ROLE_ID_RE.fullmatch(cleaned_id):
            raise ValueError(
                "Role id must start with a letter and contain only lowercase "
                "letters, digits, '-' or '_'."
            )
        if cleaned_id in BUILTIN_ROLE_IDS or any(
            role["id"] == cleaned_id for role in roles
        ):
            raise ValueError("A role with this id already exists.")
        if not _unique_name(roles, clean_name):
            raise ValueError("A role with this name already exists.")
        role = {
            "id": cleaned_id,
            "name": clean_name[:64],
            "description": str(description or "").strip()[:280],
            "builtin": False,
            "permissions": _validate_permissions(permissions),
            "created_at": _utc_now(),
        }
        roles.append(role)
        _write_roles(roles)
        return deepcopy(role)


def update_role(
    role_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    permissions: Iterable[str] | None = None,
) -> dict[str, Any]:
    with _ROLE_LOCK:
        roles = load_roles()
        target = next((role for role in roles if role["id"] == role_id), None)
        if target is None:
            raise KeyError(role_id)
        if not target["builtin"] and name is not None:
            clean_name = str(name).strip()
            if not clean_name:
                raise ValueError("Role name is required.")
            if not _unique_name(roles, clean_name, exclude=role_id):
                raise ValueError("A role with this name already exists.")
            target["name"] = clean_name[:64]
        if description is not None:
            target["description"] = str(description).strip()[:280]
        if permissions is not None:
            target["permissions"] = _validate_permissions(permissions)
        _assert_role_management_remains(roles)
        _write_roles(roles)
        return deepcopy(target)


def delete_role(role_id: str) -> dict[str, Any]:
    with _ROLE_LOCK:
        roles = load_roles()
        target = next((role for role in roles if role["id"] == role_id), None)
        if target is None:
            raise KeyError(role_id)
        if target["builtin"]:
            raise ValueError("Built-in roles cannot be deleted.")
        counts = role_user_counts()
        if counts.get(role_id, 0) > 0:
            raise ValueError(
                f"This role is assigned to {counts[role_id]} account(s). Reassign them first."
            )
        proposed = [role for role in roles if role["id"] != role_id]
        _assert_role_management_remains(proposed)
        _write_roles(proposed)
        return deepcopy(target)


def _active_users() -> list[dict[str, Any]]:
    from .identity import load_users

    return [
        record
        for record in load_users().values()
        if not bool(record.get("disabled"))
    ]


def _assert_role_management_remains(roles: list[dict[str, Any]]) -> None:
    """Refuse a role edit that would leave nobody able to manage roles."""
    users = _active_users()
    if not users:
        return
    permissions = {
        role["id"]: set(role.get("permissions") or []) for role in roles
    }
    if not any(
        ROLE_MANAGEMENT_PERMISSION
        in permissions.get(str(record.get("role") or "user"), set())
        for record in users
    ):
        raise ValueError(
            "At least one active account must retain role management permission."
        )


def assert_user_role_change_preserves_management(
    username: str, new_role: str
) -> None:
    from .identity import load_users

    users = load_users()
    target = users.get(username)
    if target is None or bool(target.get("disabled")):
        return
    current_role = str(target.get("role") or "user")
    if not role_has_permission(current_role, ROLE_MANAGEMENT_PERMISSION):
        return
    if role_has_permission(new_role, ROLE_MANAGEMENT_PERMISSION):
        return
    for other_name, record in users.items():
        if other_name == username or bool(record.get("disabled")):
            continue
        if role_has_permission(
            str(record.get("role") or "user"), ROLE_MANAGEMENT_PERMISSION
        ):
            return
    raise ValueError(
        "At least one active account must retain role management permission."
    )


def assert_user_deletion_preserves_management(username: str) -> None:
    from .identity import load_users

    users = load_users()
    target = users.get(username)
    if target is None or bool(target.get("disabled")):
        return
    if not role_has_permission(
        str(target.get("role") or "user"), ROLE_MANAGEMENT_PERMISSION
    ):
        return
    for other_name, record in users.items():
        if other_name == username or bool(record.get("disabled")):
            continue
        if role_has_permission(
            str(record.get("role") or "user"), ROLE_MANAGEMENT_PERMISSION
        ):
            return
    raise ValueError(
        "At least one active account must retain role management permission."
    )


def invalidate_cache() -> None:
    global _CACHE
    _CACHE = None


__all__ = [
    "ADMIN_PERMISSIONS",
    "ALL_PERMISSIONS",
    "BUILTIN_ROLE_IDS",
    "BUILTIN_ROLE_NAMES",
    "PERMISSIONS",
    "ROLE_MANAGEMENT_PERMISSION",
    "ROLES_FILE",
    "RoleStorageError",
    "assert_user_deletion_preserves_management",
    "assert_user_role_change_preserves_management",
    "create_role",
    "delete_role",
    "get_role",
    "invalidate_cache",
    "load_roles",
    "permissions_for_role",
    "public_role",
    "role_exists",
    "role_has_admin_permission",
    "role_has_any_permission",
    "role_has_permission",
    "role_map",
    "role_name",
    "role_user_counts",
    "update_role",
]
