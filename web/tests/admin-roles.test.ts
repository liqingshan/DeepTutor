import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_ROLES,
  ROLE_DESCRIPTION_KEYS,
  countUsersByRole,
} from "../lib/admin-roles";

test("built-in roles keep their display order", () => {
  assert.deepEqual(ACCOUNT_ROLES, ["admin", "teacher", "student", "user"]);
});

test("countUsersByRole counts built-in and custom roles, ignoring bad values", () => {
  const counts = countUsersByRole([
    { role: "admin" },
    { role: "admin" },
    { role: "moderator" },
    { role: "moderator" },
    { role: "moderator" },
    { role: "user" },
  ]);

  assert.deepEqual(counts, {
    admin: 2,
    teacher: 0,
    student: 0,
    user: 1,
    moderator: 3,
  });
});

test("every built-in role has a description translation key", () => {
  for (const role of ACCOUNT_ROLES) {
    assert.equal(typeof ROLE_DESCRIPTION_KEYS[role], "string");
    assert.ok(ROLE_DESCRIPTION_KEYS[role].length > 0);
  }
});
