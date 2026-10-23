import type { AccountRole } from "@/lib/account-role";

/** Roles the local user store accepts, in display order. */
export const ACCOUNT_ROLES: readonly AccountRole[] = [
  "admin",
  "teacher",
  "student",
  "user",
];

export type RoleMatrixValue = "full" | "assigned" | "none";

export interface RoleMatrixRow {
  labelKey: string;
  values: Record<AccountRole, RoleMatrixValue>;
}

/** i18n keys describing what each built-in role means today. */
export const ROLE_DESCRIPTION_KEYS: Record<AccountRole, string> = {
  admin:
    "Admins manage accounts, roles and assignments, and work in the shared workspace.",
  teacher:
    "Teacher is an identity label; permissions match an ordinary account.",
  student:
    "Student is an identity label; permissions match an ordinary account.",
  user: "Ordinary account with a personal workspace and assigned shared resources.",
};

/**
 * Built-in role permissions.
 *
 * Only ``admin`` elevates today. ``teacher`` and ``student`` are identity
 * labels with ordinary-account permissions until a class/course model exists.
 */
export const ROLE_MATRIX: readonly RoleMatrixRow[] = [
  {
    labelKey: "Personal workspace",
    values: { admin: "full", teacher: "full", student: "full", user: "full" },
  },
  {
    labelKey: "Chat and learning",
    values: { admin: "full", teacher: "full", student: "full", user: "full" },
  },
  {
    labelKey: "Assigned shared resources",
    values: {
      admin: "full",
      teacher: "assigned",
      student: "assigned",
      user: "assigned",
    },
  },
  {
    labelKey: "User and role management",
    values: { admin: "full", teacher: "none", student: "none", user: "none" },
  },
  {
    labelKey: "Resource assignments",
    values: { admin: "full", teacher: "none", student: "none", user: "none" },
  },
  {
    labelKey: "System and plugin settings",
    values: { admin: "full", teacher: "none", student: "none", user: "none" },
  },
];

export function countUsersByRole(
  users: readonly { role: AccountRole }[],
): Record<AccountRole, number> {
  const counts: Record<AccountRole, number> = {
    admin: 0,
    teacher: 0,
    student: 0,
    user: 0,
  };
  for (const user of users) {
    if (Object.hasOwn(counts, user.role)) counts[user.role] += 1;
  }
  return counts;
}
