"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Info,
  Layers,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

import { PermissionValueCell } from "@/features/multi-user/components/PermissionValueCell";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import { listRoles, type RoleDefinition } from "@/lib/admin-api";
import {
  PERMISSION_MATRIX,
  PRESET_DESCRIPTION_KEYS,
  PRESET_IDS,
  PRESET_LABEL_KEYS,
  presetValue,
  roleValue,
  type PermissionRow,
  type PermissionScope,
  type PresetId,
} from "@/lib/permission-matrix";

const SECTIONS: readonly {
  id: PermissionScope;
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  presetColumn: boolean;
}[] = [
  {
    id: "role",
    titleKey: "Role permissions",
    descriptionKey:
      "Stored with the role in data/system/roles.json and editable here.",
    icon: ShieldCheck,
    presetColumn: false,
  },
  {
    id: "preset",
    titleKey: "Account preset",
    descriptionKey:
      "Fixed platform rules selected by the account preset; not editable per role.",
    icon: SlidersHorizontal,
    presetColumn: true,
  },
  {
    id: "grant",
    titleKey: "Resource grants",
    descriptionKey:
      "Per-account assignments managed from User Management; a role never grants them.",
    icon: Layers,
    presetColumn: true,
  },
  {
    id: "learning",
    titleKey: "Learning policy",
    descriptionKey:
      "Learner-only limits enforced for every learner account regardless of role.",
    icon: Lock,
    presetColumn: true,
  },
];

function sectionRows(scope: PermissionScope): PermissionRow[] {
  return PERMISSION_MATRIX.filter((row) => row.scope === scope);
}

export default function AdminPermissionsPage() {
  const { t } = useTranslation();
  const { can } = useAuthStatus();
  const [roles, setRoles] = useState<RoleDefinition[] | null>(null);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<PresetId>("standard");

  useEffect(() => {
    let alive = true;
    listRoles()
      .then((data) => {
        if (alive) setRoles(data);
      })
      .catch((cause) => {
        if (!alive) return;
        setError(
          cause instanceof Error ? cause.message : t("Failed to load roles"),
        );
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const roleColumns = useMemo(
    () =>
      [...(roles ?? [])].map((role) => ({
        id: role.id,
        name: role.name,
        builtin: role.builtin,
        permissions: role.permissions,
        userCount: role.user_count,
      })),
    [roles],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-semibold text-[var(--foreground)]">
            {t("Permission Management")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("Every role-related permission in one place")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("admin.roles.read") && (
            <Link
              href="/admin/roles"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)]"
            >
              {t("Role Management")}
              <ArrowRight size={14} />
            </Link>
          )}
          {can("admin.users.read") && (
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)]"
            >
              {t("Manage users")}
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
        <Info size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" />
        <p>
          {t(
            "Role decisions only cover the first section. Preset, grant and learning rules apply to every account whatever its role.",
          )}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {t("Preset columns")}
        </span>
        <div
          className="inline-flex rounded-lg bg-[var(--muted)]/50 p-1"
          role="group"
          aria-label={t("Preset columns")}
        >
          {PRESET_IDS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={preset === candidate}
              onClick={() => setPreset(candidate)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                preset === candidate
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {t(PRESET_LABEL_KEYS[candidate])}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">
          {t(PRESET_DESCRIPTION_KEYS[preset])}
        </span>
      </div>

      {roles === null && !error ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted-foreground)]">
          {t("Loading")}
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const rows = sectionRows(section.id);
            return (
              <section
                key={section.id}
                aria-labelledby={`matrix-${section.id}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm"
              >
                <div className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]/60 text-[var(--muted-foreground)]">
                    <Icon size={15} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id={`matrix-${section.id}`}
                      className="text-sm font-semibold text-[var(--foreground)]"
                    >
                      {t(section.titleKey)}
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {t(section.descriptionKey)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]/70 text-left text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                        <th scope="col" className="px-4 py-2.5 font-medium">
                          {t("Permission")}
                        </th>
                        {roleColumns.map((role) => (
                          <th
                            key={role.id}
                            scope="col"
                            className="px-4 py-2.5 font-medium"
                          >
                            {role.name}
                          </th>
                        ))}
                        {section.presetColumn && (
                          <th
                            scope="col"
                            className="px-4 py-2.5 font-medium text-[var(--foreground)]"
                          >
                            {t(PRESET_LABEL_KEYS[preset])}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/70">
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <th
                            scope="row"
                            className="px-4 py-2.5 text-left font-medium text-[var(--foreground)]"
                          >
                            {t(row.labelKey)}
                          </th>
                          {roleColumns.map((role) => (
                            <td key={role.id} className="px-4 py-2.5">
                              <PermissionValueCell
                                value={roleValue(row, role)}
                              />
                            </td>
                          ))}
                          {section.presetColumn && (
                            <td className="px-4 py-2.5">
                              <PermissionValueCell
                                value={presetValue(row, preset)}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {roleColumns.length > 0 && (
        <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
            {t("Roles")}
          </h2>
          <ul className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
            {roleColumns.map((role) => (
              <li
                key={role.id}
                className="rounded-full bg-[var(--muted)]/50 px-2.5 py-1"
              >
                {role.name}
                <span className="ml-1.5 text-[var(--muted-foreground)]/80">
                  {t("{{count}} permissions", {
                    count: role.permissions.length,
                  })}
                  {" · "}
                  {t("{{count}} users", { count: role.userCount })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-[var(--muted-foreground)]">
        {t("DeepTutor Admin · Permission Management")}
      </p>
    </div>
  );
}
