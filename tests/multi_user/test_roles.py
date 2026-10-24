"""Role store and permission-catalog tests."""

from __future__ import annotations

import pytest

from deeptutor.multi_user import identity, roles
from deeptutor.multi_user.models import normalize_role


def test_built_in_roles_are_seeded_with_default_permissions(mu_isolated_root):
    loaded = roles.load_roles()
    assert [role["id"] for role in loaded] == ["admin", "teacher", "student", "user"]
    assert roles.permissions_for_role("admin") == roles.ALL_PERMISSIONS
    assert roles.permissions_for_role("teacher") == frozenset()
    assert roles.permissions_for_role("student") == frozenset()
    assert roles.permissions_for_role("user") == frozenset()


def test_custom_roles_accept_permissions_and_custom_ids(mu_isolated_root):
    created = roles.create_role(
        name="Moderator",
        description="Reviews accounts",
        permissions=["admin.users.read", "admin.roles.read"],
    )

    assert created["id"] == "moderator"
    assert created["builtin"] is False
    assert roles.role_exists("moderator")
    assert normalize_role("moderator") == "moderator"
    assert roles.permissions_for_role("moderator") == frozenset(
        {"admin.users.read", "admin.roles.read"}
    )


def test_custom_role_ids_can_be_supplied_and_are_lowercased(mu_isolated_root):
    created = roles.create_role(
        name="Support",
        role_id="Support-Team",
        permissions=[],
    )
    assert created["id"] == "support-team"
    assert roles.get_role("support-team")["name"] == "Support"


def test_unknown_permissions_and_duplicate_ids_are_rejected(mu_isolated_root):
    with pytest.raises(ValueError, match="Unknown permission"):
        roles.create_role(name="Bad", permissions=["admin.root"])

    roles.create_role(name="First", permissions=[])
    with pytest.raises(ValueError, match="already exists"):
        roles.create_role(name="Second", role_id="first")


def test_built_in_roles_cannot_be_deleted(mu_isolated_root):
    with pytest.raises(ValueError, match="Built-in"):
        roles.delete_role("admin")


def test_custom_role_can_be_renamed_and_deleted_when_unassigned(mu_isolated_root):
    roles.create_role(name="Temp", permissions=["admin.users.read"])
    updated = roles.update_role("temp", name="Temporary", description="Short lived")
    assert updated["name"] == "Temporary"
    assert updated["description"] == "Short lived"

    deleted = roles.delete_role("temp")
    assert deleted["id"] == "temp"
    assert not roles.role_exists("temp")


def test_deleting_an_assigned_custom_role_is_refused(mu_isolated_root, seed_user):
    seed_user("admin")
    seed_user("alice")
    roles.create_role(name="Moderator", permissions=["admin.users.read"])
    identity.set_role("alice", "moderator")

    with pytest.raises(ValueError, match="assigned"):
        roles.delete_role("moderator")
    assert roles.role_exists("moderator")


def test_last_role_manager_cannot_lose_the_permission(mu_isolated_root, seed_user):
    seed_user("admin")
    without_management = [
        permission
        for permission in roles.ALL_PERMISSIONS
        if permission != roles.ROLE_MANAGEMENT_PERMISSION
    ]

    with pytest.raises(ValueError, match="role management"):
        roles.update_role("admin", permissions=without_management)
    assert roles.role_has_permission("admin", roles.ROLE_MANAGEMENT_PERMISSION)


def test_a_second_role_manager_allows_reducing_the_first(
    mu_isolated_root, seed_user
):
    seed_user("admin")
    seed_user("alice")
    roles.create_role(
        name="RoleAdmin",
        permissions=[roles.ROLE_MANAGEMENT_PERMISSION],
    )
    identity.set_role("alice", "roleadmin")

    without_management = [
        permission
        for permission in roles.ALL_PERMISSIONS
        if permission != roles.ROLE_MANAGEMENT_PERMISSION
    ]
    roles.update_role("admin", permissions=without_management)
    assert not roles.role_has_permission("admin", roles.ROLE_MANAGEMENT_PERMISSION)

    with pytest.raises(ValueError, match="role management"):
        roles.update_role("roleadmin", permissions=["admin.users.read"])


def test_role_change_and_deletion_keep_a_role_manager(
    mu_isolated_root, seed_user
):
    seed_user("admin")
    seed_user("alice")
    roles.create_role(name="RoleAdmin", permissions=[roles.ROLE_MANAGEMENT_PERMISSION])
    identity.set_role("alice", "roleadmin")

    without_management = [
        permission
        for permission in roles.ALL_PERMISSIONS
        if permission != roles.ROLE_MANAGEMENT_PERMISSION
    ]
    roles.update_role("admin", permissions=without_management)

    with pytest.raises(ValueError, match="role management"):
        roles.assert_user_role_change_preserves_management("alice", "user")
    with pytest.raises(ValueError, match="role management"):
        roles.assert_user_deletion_preserves_management("alice")


def test_role_user_counts_include_custom_roles(mu_isolated_root, seed_user):
    seed_user("admin")
    seed_user("alice")
    seed_user("bob")
    roles.create_role(name="Moderator", permissions=["admin.users.read"])
    identity.set_role("alice", "moderator")
    identity.set_role("bob", "moderator")

    counts = roles.role_user_counts()
    assert counts["admin"] == 1
    assert counts["moderator"] == 2
    assert counts["user"] == 0
