/** Admin console permissions. Keep these ids in sync with
 * ``deeptutor/multi_user/roles.py``; the backend rejects unknown ids. */

export interface AdminPermissionDefinition {
  id: string;
  group: "users" | "roles" | "resources" | "system";
  labelKey: string;
}

export const ADMIN_PERMISSIONS: readonly AdminPermissionDefinition[] = [
  {
    id: "admin.users.read",
    group: "users",
    labelKey: "permission.users.read",
  },
  {
    id: "admin.users.write",
    group: "users",
    labelKey: "permission.users.write",
  },
  {
    id: "admin.roles.read",
    group: "roles",
    labelKey: "permission.roles.read",
  },
  {
    id: "admin.roles.write",
    group: "roles",
    labelKey: "permission.roles.write",
  },
  {
    id: "admin.resources.read",
    group: "resources",
    labelKey: "permission.resources.read",
  },
  {
    id: "admin.resources.write",
    group: "resources",
    labelKey: "permission.resources.write",
  },
  {
    id: "admin.settings.manage",
    group: "system",
    labelKey: "permission.settings.manage",
  },
  {
    id: "admin.plugins.manage",
    group: "system",
    labelKey: "permission.plugins.manage",
  },
  {
    id: "admin.system.manage",
    group: "system",
    labelKey: "permission.system.manage",
  },
];

export const ADMIN_PERMISSION_IDS: readonly string[] = ADMIN_PERMISSIONS.map(
  (permission) => permission.id,
);

export const PERMISSION_GROUPS: readonly {
  id: AdminPermissionDefinition["group"];
  labelKey: string;
}[] = [
  { id: "users", labelKey: "permission.group.users" },
  { id: "roles", labelKey: "permission.group.roles" },
  { id: "resources", labelKey: "permission.group.resources" },
  { id: "system", labelKey: "permission.group.system" },
];

export function hasPermission(
  permissions: readonly string[] | null | undefined,
  permission: string,
): boolean {
  return Boolean(permissions?.includes(permission));
}

export function hasAnyAdminPermission(
  permissions: readonly string[] | null | undefined,
): boolean {
  return Boolean(
    permissions?.some((permission) => permission.startsWith("admin.")),
  );
}

export function permissionLabelKey(permissionId: string): string | null {
  return (
    ADMIN_PERMISSIONS.find((permission) => permission.id === permissionId)
      ?.labelKey ?? null
  );
}
