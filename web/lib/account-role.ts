/** Built-in roles accepted by the local user store. Custom roles are free-form ids. */
export type BuiltinAccountRole = "admin" | "teacher" | "student" | "user";

/**
 * A role id. Built-ins keep their literal names; custom role ids come from the
 * role store (lowercase slug) and are resolved to a display name separately.
 */
export type AccountRole = string;

const LABEL_KEYS: Record<BuiltinAccountRole, "Admin" | "Teacher" | "Student" | "User"> = {
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  user: "User",
};

export function isBuiltinAccountRole(role: string): role is BuiltinAccountRole {
  return Object.hasOwn(LABEL_KEYS, role);
}

/** Translation key for a built-in role, or null for a custom role. */
export function accountRoleLabelKey(role: string): string | null {
  return isBuiltinAccountRole(role) ? LABEL_KEYS[role] : null;
}
