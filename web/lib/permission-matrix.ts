import type { BuiltinAccountRole } from "@/lib/account-role";

/**
 * Role-related permission catalog for the admin console.
 *
 * The first section mirrors what the backend stores per role
 * (``data/system/roles.json``). The remaining sections are not stored on the
 * role: they are fixed platform rules driven by ``preset``, the grant, and the
 * learning policy. They are listed here so one page answers "what can this role
 * do?" completely, while the editor still edits exactly the stored section.
 */

export type PermissionScope = "role" | "preset" | "grant" | "learning";

export type PresetId = "standard" | "learner" | "custom";
type PresetMatrix = Record<PresetId, PermissionValue>;

/** How a value applies to an account for one row. */
export type PermissionValue =
  | "yes"
  | "no"
  | "granted"
  | "fixed"
  | "configurable"
  | "full"
  | "limited";

export const PERMISSION_VALUE_LABEL: Record<PermissionValue, string> = {
  yes: "Yes",
  no: "No",
  granted: "Only when granted",
  fixed: "No",
  configurable: "Configurable",
  full: "Yes",
  limited: "Limited",
};

export interface PermissionRow {
  id: string;
  scope: PermissionScope;
  labelKey: string;
  /** Stored role permission id; ``null`` for platform-level rows. */
  permissionId: string | null;
  /** Values used for preset-level rows. */
  presets?: PresetMatrix;
  /** Whether a row represents a restriction the admin can lift. */
  restriction?: boolean;
}

const always = (value: PermissionValue): PresetMatrix => ({
  standard: value,
  learner: value,
  custom: value,
});

export const PERMISSION_MATRIX: readonly PermissionRow[] = [
  // ---------------------------------------------------------------- stored
  {
    id: "admin.users.read",
    scope: "role",
    labelKey: "permission.users.read",
    permissionId: "admin.users.read",
  },
  {
    id: "admin.users.write",
    scope: "role",
    labelKey: "permission.users.write",
    permissionId: "admin.users.write",
  },
  {
    id: "admin.roles.read",
    scope: "role",
    labelKey: "permission.roles.read",
    permissionId: "admin.roles.read",
  },
  {
    id: "admin.roles.write",
    scope: "role",
    labelKey: "permission.roles.write",
    permissionId: "admin.roles.write",
  },
  {
    id: "admin.resources.read",
    scope: "role",
    labelKey: "permission.resources.read",
    permissionId: "admin.resources.read",
  },
  {
    id: "admin.resources.write",
    scope: "role",
    labelKey: "permission.resources.write",
    permissionId: "admin.resources.write",
  },
  {
    id: "admin.settings.manage",
    scope: "role",
    labelKey: "permission.settings.manage",
    permissionId: "admin.settings.manage",
  },
  {
    id: "admin.plugins.manage",
    scope: "role",
    labelKey: "permission.plugins.manage",
    permissionId: "admin.plugins.manage",
  },
  {
    id: "admin.system.manage",
    scope: "role",
    labelKey: "permission.system.manage",
    permissionId: "admin.system.manage",
  },

  // ---------------------------------------------------------------- preset
  {
    id: "preset.feature-scope",
    scope: "preset",
    labelKey: "Available features",
    permissionId: null,
    presets: { standard: "full", learner: "limited", custom: "full" },
  },
  {
    id: "preset.default-entry",
    scope: "preset",
    labelKey: "Default entry",
    permissionId: null,
    presets: { standard: "full", learner: "limited", custom: "full" },
  },
  {
    id: "preset.persona",
    scope: "preset",
    labelKey: "Persona",
    permissionId: null,
    presets: {
      standard: "configurable",
      learner: "fixed",
      custom: "configurable",
    },
  },
  {
    id: "preset.learning-policy-required",
    scope: "preset",
    labelKey: "Learning policy required",
    permissionId: null,
    presets: { standard: "no", learner: "yes", custom: "no" },
  },
  {
    id: "preset.upload-material",
    scope: "preset",
    labelKey: "Upload reading materials",
    permissionId: null,
    presets: { standard: "yes", learner: "granted", custom: "yes" },
  },
  {
    id: "preset.material-scope",
    scope: "preset",
    labelKey: "Reading material scope",
    permissionId: null,
    presets: { standard: "full", learner: "limited", custom: "full" },
  },
  {
    id: "preset.extensions",
    scope: "preset",
    labelKey: "Reading extensions",
    permissionId: null,
    presets: { standard: "full", learner: "limited", custom: "full" },
  },
  {
    id: "preset.guardian-managed",
    scope: "preset",
    labelKey: "Managed by a guardian",
    permissionId: null,
    presets: { standard: "no", learner: "yes", custom: "no" },
  },
  {
    id: "preset.export-migration",
    scope: "preset",
    labelKey: "Export and migration",
    permissionId: null,
    presets: { standard: "yes", learner: "no", custom: "yes" },
  },

  // ---------------------------------------------------------------- grants
  {
    id: "grant.models",
    scope: "grant",
    labelKey: "Models",
    permissionId: null,
    presets: always("granted"),
  },
  {
    id: "grant.knowledge-bases",
    scope: "grant",
    labelKey: "Knowledge bases",
    permissionId: null,
    presets: always("granted"),
  },
  {
    id: "grant.skills",
    scope: "grant",
    labelKey: "Skills",
    permissionId: null,
    presets: always("granted"),
  },
  {
    id: "grant.partners",
    scope: "grant",
    labelKey: "Partners",
    permissionId: null,
    presets: always("granted"),
  },
  {
    id: "grant.books",
    scope: "grant",
    labelKey: "Shared books",
    permissionId: null,
    presets: always("granted"),
  },
  {
    id: "grant.tools",
    scope: "grant",
    labelKey: "System tools",
    permissionId: null,
    presets: always("granted"),
  },
  {
    id: "grant.mcp",
    scope: "grant",
    labelKey: "MCP tools",
    permissionId: null,
    presets: always("granted"),
  },
  {
    id: "grant.cli",
    scope: "grant",
    labelKey: "CLI apps",
    permissionId: null,
    presets: always("granted"),
  },
  {
    id: "grant.exec",
    scope: "grant",
    labelKey: "Code execution",
    permissionId: null,
    presets: always("granted"),
  },

  // -------------------------------------------------------------- learning
  {
    id: "learning.allowed-capabilities",
    scope: "learning",
    labelKey: "Allowed capabilities",
    permissionId: null,
    presets: { standard: "yes", learner: "limited", custom: "yes" },
    restriction: true,
  },
  {
    id: "learning.surfaces",
    scope: "learning",
    labelKey: "Allowed surfaces",
    permissionId: null,
    presets: { standard: "yes", learner: "limited", custom: "yes" },
    restriction: true,
  },
  {
    id: "learning.kb-selection",
    scope: "learning",
    labelKey: "Knowledge base selection",
    permissionId: null,
    presets: { standard: "yes", learner: "no", custom: "yes" },
    restriction: true,
  },
  {
    id: "learning.web-search",
    scope: "learning",
    labelKey: "Web search in a turn",
    permissionId: null,
    presets: { standard: "yes", learner: "no", custom: "yes" },
    restriction: true,
  },
  {
    id: "learning.tools",
    scope: "learning",
    labelKey: "Tools in a turn",
    permissionId: null,
    presets: { standard: "yes", learner: "no", custom: "yes" },
    restriction: true,
  },
  {
    id: "learning.partners",
    scope: "learning",
    labelKey: "Partner in a turn",
    permissionId: null,
    presets: { standard: "yes", learner: "no", custom: "yes" },
    restriction: true,
  },
];

export const PRESET_IDS: readonly PresetId[] = ["standard", "learner", "custom"];

export const PRESET_LABEL_KEYS: Record<PresetId, string> = {
  standard: "Standard",
  learner: "Learner",
  custom: "Custom",
};

export const PRESET_DESCRIPTION_KEYS: Record<PresetId, string> = {
  standard: "Full feature set with no learning restrictions.",
  learner:
    "Restricted learning account: Chat and Immersive Reading only, with a locked teacher persona.",
  custom:
    "Ordinary account reserved for a later per-account configuration.",
};

export type RoleColumn = {
  id: string;
  name: string;
  builtin: boolean;
  permissions: readonly string[];
  userCount: number;
};

/** Rows belonging to one matrix section. */
export function rowsInScope(scope: PermissionScope): PermissionRow[] {
  return PERMISSION_MATRIX.filter((row) => row.scope === scope);
}

export function roleValue(
  row: PermissionRow,
  role: RoleColumn,
): PermissionValue {
  if (row.permissionId) {
    return role.permissions.includes(row.permissionId) ? "yes" : "no";
  }
  // Platform rows behave the same way for every role: a role decides which
  // accounts exist and what they may manage, never what a preset allows.
  return "yes";
}

export function presetValue(
  row: PermissionRow,
  preset: PresetId,
): PermissionValue {
  if (row.permissionId) {
    // Stored admin permissions are on/off per role, never per preset.
    return "no";
  }
  return row.presets?.[preset] ?? "no";
}
