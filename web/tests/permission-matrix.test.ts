import test from "node:test";
import assert from "node:assert/strict";

import { ADMIN_PERMISSION_IDS } from "../lib/admin-permissions";
import {
  PERMISSION_MATRIX,
  PERMISSION_VALUE_LABEL,
  PRESET_IDS,
  presetValue,
  roleValue,
  rowsInScope,
  type RoleColumn,
} from "../lib/permission-matrix";

const ADMIN_ROLE: RoleColumn = {
  id: "admin",
  name: "Admin",
  builtin: true,
  permissions: ADMIN_PERMISSION_IDS,
  userCount: 1,
};

const USER_ROLE: RoleColumn = {
  id: "user",
  name: "User",
  builtin: true,
  permissions: [],
  userCount: 4,
};

test("the stored section mirrors the backend catalog", () => {
  const stored = rowsInScope("role").map((row) => row.permissionId);
  assert.deepEqual(stored, [...ADMIN_PERMISSION_IDS]);
});

test("every matrix row is unique and carries a label", () => {
  const ids = PERMISSION_MATRIX.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of PERMISSION_MATRIX) {
    assert.ok(row.labelKey.length > 0, `${row.id} has no label key`);
  }
});

test("a role is yes only for the permissions it actually carries", () => {
  const usersRead = rowsInScope("role").find(
    (row) => row.permissionId === "admin.users.read",
  );
  assert.ok(usersRead);
  assert.equal(roleValue(usersRead, ADMIN_ROLE), "yes");
  assert.equal(roleValue(usersRead, USER_ROLE), "no");
});

test("platform rows are identical for every role", () => {
  for (const row of PERMISSION_MATRIX.filter((item) => item.permissionId === null)) {
    assert.equal(
      roleValue(row, ADMIN_ROLE),
      roleValue(row, USER_ROLE),
      `${row.id} differs between roles`,
    );
  }
});

test("every matrix cell has a rendered value", () => {
  // Rows never render blank: each combination maps to a known label.
  for (const preset of PRESET_IDS) {
    for (const row of PERMISSION_MATRIX) {
      assert.ok(presetValue(row, preset) in PERMISSION_VALUE_LABEL);
      assert.ok(roleValue(row, ADMIN_ROLE) in PERMISSION_VALUE_LABEL);
    }
  }
});

test("preset rows separate learner from standard", () => {
  const restricted = [
    "preset.feature-scope",
    "preset.material-scope",
    "preset.extensions",
  ];
  for (const id of restricted) {
    const row = PERMISSION_MATRIX.find((item) => item.id === id);
    assert.ok(row, `${id} missing`);
    assert.equal(presetValue(row, "learner"), "limited");
    assert.equal(presetValue(row, "standard"), "full");
    assert.equal(presetValue(row, "custom"), "full");
  }

  const denied = [
    "learning.kb-selection",
    "learning.web-search",
    "learning.tools",
    "learning.partners",
  ];
  for (const id of denied) {
    const row = PERMISSION_MATRIX.find((item) => item.id === id);
    assert.ok(row, `${id} missing`);
    assert.equal(presetValue(row, "learner"), "no");
    assert.equal(presetValue(row, "standard"), "yes");
  }
});

test("resource grants are conditional, never implied by the role", () => {
  for (const row of rowsInScope("grant")) {
    assert.equal(presetValue(row, "standard"), "granted");
    assert.equal(presetValue(row, "learner"), "granted");
  }
});
