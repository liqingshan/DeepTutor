import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_ROLES,
  countUsersByRole,
  ROLE_MATRIX,
} from "../lib/admin-roles";

test("built-in roles keep their display order", () => {
  assert.deepEqual(ACCOUNT_ROLES, ["admin", "teacher", "student", "user"]);
});

test("countUsersByRole counts each role and ignores unknown values", () => {
  const counts = countUsersByRole([
    { role: "admin" },
    { role: "admin" },
    { role: "teacher" },
    { role: "student" },
    { role: "user" },
    { role: "user" },
    { role: "user" },
    // Runtime data can drift from the TypeScript union.
    { role: "unknown" as never },
  ]);

  assert.deepEqual(counts, {
    admin: 2,
    teacher: 1,
    student: 1,
    user: 3,
  });
});

test("only administrators manage users, roles and settings", () => {
  const managementRows = ROLE_MATRIX.filter((row) =>
    [
      "User and role management",
      "Resource assignments",
      "System and plugin settings",
    ].includes(row.labelKey),
  );

  assert.equal(managementRows.length, 3);
  for (const row of managementRows) {
    assert.equal(row.values.admin, "full");
    assert.equal(row.values.teacher, "none");
    assert.equal(row.values.student, "none");
    assert.equal(row.values.user, "none");
  }
});

test("teacher and student share the ordinary shared-resource assignment model", () => {
  const shared = ROLE_MATRIX.find(
    (row) => row.labelKey === "Assigned shared resources",
  );
  assert.ok(shared);
  assert.equal(shared.values.admin, "full");
  assert.equal(shared.values.teacher, "assigned");
  assert.equal(shared.values.student, "assigned");
  assert.equal(shared.values.user, "assigned");
});
