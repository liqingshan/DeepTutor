import type { BuiltinAccountRole } from "@/lib/account-role";

/** Built-in roles, in display order. */
export const ACCOUNT_ROLES: readonly BuiltinAccountRole[] = [
  "admin",
  "teacher",
  "student",
  "user",
];

/** i18n keys describing what each built-in role means today. */
export const ROLE_DESCRIPTION_KEYS: Record<BuiltinAccountRole, string> = {
  admin:
    "Admins manage accounts, roles and assignments, and work in the shared workspace.",
  teacher:
    "Teacher is an identity label; permissions match an ordinary account.",
  student:
    "Student is an identity label; permissions match an ordinary account.",
  user: "Ordinary account with a personal workspace and assigned shared resources.",
};

export function countUsersByRole(
  users: readonly { role: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const role of ACCOUNT_ROLES) counts[role] = 0;
  for (const user of users) {
    const role = String(user.role || "user");
    counts[role] = (counts[role] ?? 0) + 1;
  }
  return counts;
}
