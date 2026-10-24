"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RoleEditorModal } from "@/features/multi-user/components/RoleEditorModal";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import {
  deleteRole,
  listRoles,
  type RoleDefinition,
} from "@/lib/admin-api";
import { ROLE_DESCRIPTION_KEYS } from "@/lib/admin-roles";
import {
  accountRoleLabelKey,
  type BuiltinAccountRole,
} from "@/lib/account-role";
import { permissionLabelKey } from "@/lib/admin-permissions";

const BUILTIN_ICONS: Record<BuiltinAccountRole, LucideIcon> = {
  admin: ShieldCheck,
  teacher: GraduationCap,
  student: BookOpen,
  user: User,
};

const BUILTIN_TONES: Record<BuiltinAccountRole, string> = {
  admin:
    "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  teacher: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  student:
    "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  user: "bg-[var(--muted)]/50 text-[var(--muted-foreground)] ring-[var(--border)]",
};

const CUSTOM_TONE =
  "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400";

function builtinRole(role: RoleDefinition): role is RoleDefinition & {
  id: BuiltinAccountRole;
} {
  return Boolean(accountRoleLabelKey(role.id)) && role.builtin;
}

export default function AdminRolesPage() {
  const { t } = useTranslation();
  const { can } = useAuthStatus();
  const canWrite = can("admin.roles.write");

  const [roles, setRoles] = useState<RoleDefinition[] | null>(null);
  const [error, setError] = useState("");
  const [editorRole, setEditorRole] = useState<
    RoleDefinition | null | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setRoles(await listRoles());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Failed to load roles"),
      );
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const builtins = useMemo(() => {
    const order = ["admin", "teacher", "student", "user"];
    return [...(roles ?? [])]
      .filter((role) => role.builtin)
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [roles]);

  const customRoles = useMemo(
    () => (roles ?? []).filter((role) => !role.builtin),
    [roles],
  );

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteRole(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : t("Failed to delete role"),
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function renderRoleCard(role: RoleDefinition) {
    const isBuiltin = builtinRole(role);
    const Icon = isBuiltin ? BUILTIN_ICONS[role.id] : Sparkles;
    const tone = isBuiltin ? BUILTIN_TONES[role.id] : CUSTOM_TONE;
    const labelKey = accountRoleLabelKey(role.id);
    const name = labelKey ? t(labelKey) : role.name;
    const description = isBuiltin
      ? t(ROLE_DESCRIPTION_KEYS[role.id])
      : role.description || t("No description");
    const visiblePermissions = role.permissions.slice(0, 4);
    const remaining = role.permissions.length - visiblePermissions.length;

    return (
      <article
        key={role.id}
        data-testid={`role-card-${role.id}`}
        className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tone}`}
          >
            <Icon size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {name}
              </h3>
              <span className="rounded-full bg-[var(--muted)]/60 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
                {isBuiltin ? t("Built-in role") : t("Custom role")}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-4 min-h-[26px]">
          {role.permissions.length === 0 ? (
            <span className="text-xs text-[var(--muted-foreground)]">
              {t("No admin permissions")}
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {visiblePermissions.map((permissionId) => {
                const key = permissionLabelKey(permissionId);
                return (
                  <span
                    key={permissionId}
                    className="rounded-full bg-[var(--muted)]/50 px-2 py-0.5 text-[10.5px] text-[var(--muted-foreground)]"
                  >
                    {key ? t(key) : permissionId}
                  </span>
                );
              })}
              {remaining > 0 && (
                <span className="rounded-full bg-[var(--muted)]/50 px-2 py-0.5 text-[10.5px] text-[var(--muted-foreground)]">
                  +{remaining}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-3">
          <div>
            <span className="font-serif text-2xl font-semibold text-[var(--foreground)]">
              {role.user_count}
            </span>
            <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">
              {t("Users")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditorRole(role)}
              disabled={!canWrite}
              aria-label={t("Edit role")}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Pencil size={15} />
            </button>
            {!role.builtin && (
              <button
                type="button"
                onClick={() => setDeleteTarget(role)}
                disabled={!canWrite}
                aria-label={t("Delete role")}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-semibold text-[var(--foreground)]">
            {t("Role Management")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("Configure built-in roles and add custom roles")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("admin.roles.read") && (
            <Link
              href="/admin/permissions"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)]"
            >
              <KeyRound size={14} />
              {t("Permission Management")}
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
          {canWrite && (
            <button
              type="button"
              onClick={() => setEditorRole(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
            >
              <Plus size={14} />
              {t("Add role")}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {actionError}
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : roles === null ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted-foreground)]">
          {t("Loading")}
        </div>
      ) : (
        <>
          <section aria-labelledby="admin-built-in-roles">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="admin-built-in-roles"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                {t("Built-in roles")}
              </h2>
              <span className="text-xs text-[var(--muted-foreground)]">
                {t("Permissions can be changed for every built-in role.")}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {builtins.map(renderRoleCard)}
            </div>
          </section>

          <section aria-labelledby="admin-custom-roles" className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="admin-custom-roles"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                {t("Custom roles")}
              </h2>
              <span className="text-xs text-[var(--muted-foreground)]">
                {t("{{count}} custom roles", { count: customRoles.length })}
              </span>
            </div>

            {customRoles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/60 px-6 py-10 text-center">
                <Sparkles
                  size={24}
                  strokeWidth={1.5}
                  className="mx-auto text-[var(--muted-foreground)]/60"
                />
                <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                  {t("No custom roles yet")}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {t(
                    "Create a role when you need a narrower admin surface than the built-in administrator.",
                  )}
                </p>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setEditorRole(null)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)]"
                  >
                    <Plus size={14} />
                    {t("Add role")}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {customRoles.map(renderRoleCard)}
              </div>
            )}
          </section>
        </>
      )}

      <p className="mt-8 text-center text-xs text-[var(--muted-foreground)]">
        {t("DeepTutor Admin · Role Management")}
      </p>

      <RoleEditorModal
        isOpen={editorRole !== undefined}
        role={editorRole ?? null}
        canWrite={canWrite}
        onClose={() => setEditorRole(undefined)}
        onSaved={() => {
          void load();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("Delete role")}
        tone="danger"
        confirmLabel={t("Delete role")}
        busyLabel={t("Deleting…")}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        <p>
          {t(
            "This permanently removes the custom role. Accounts assigned to it must be reassigned first.",
          )}
        </p>
        {deleteTarget && (
          <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
            {deleteTarget.name}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
