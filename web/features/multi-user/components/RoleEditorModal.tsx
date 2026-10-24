"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import Modal from "@/components/common/Modal";
import {
  ADMIN_PERMISSIONS,
  PERMISSION_GROUPS,
} from "@/lib/admin-permissions";
import {
  createRole,
  updateRole,
  type RoleDefinition,
} from "@/lib/admin-api";

interface RoleEditorModalProps {
  isOpen: boolean;
  /** Null creates a custom role; a role edits it. */
  role: RoleDefinition | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: (role: RoleDefinition) => void;
}

export function RoleEditorModal({
  isOpen,
  role,
  canWrite,
  onClose,
  onSaved,
}: RoleEditorModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setPermissions(new Set(role?.permissions ?? []));
    setError("");
    setSaving(false);
  }, [isOpen, role]);

  const grouped = useMemo(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        ...group,
        permissions: ADMIN_PERMISSIONS.filter(
          (permission) => permission.group === group.id,
        ),
      })),
    [],
  );

  function togglePermission(permissionId: string) {
    setPermissions((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  }

  function toggleGroup(permissionIds: string[], checked: boolean) {
    setPermissions((current) => {
      const next = new Set(current);
      for (const permissionId of permissionIds) {
        if (checked) next.add(permissionId);
        else next.delete(permissionId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!canWrite || saving) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setError(t("Role name is required."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: cleanName,
        description: description.trim(),
        permissions: [...permissions],
      };
      const saved = role
        ? await updateRole(
            role.id,
            role.builtin
              ? {
                  description: payload.description,
                  permissions: payload.permissions,
                }
              : payload,
          )
        : await createRole(payload);
      onSaved(saved);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Failed to save role"),
      );
    } finally {
      setSaving(false);
    }
  }

  const title = role ? t("Edit role") : t("Create role");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      width="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-40"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canWrite || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? t("Saving…") : t("Save")}
          </button>
        </div>
      }
    >
      <div className="max-h-[75dvh] overflow-y-auto px-5 py-4">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <div className="space-y-4">
          <label className="block text-xs font-medium text-[var(--muted-foreground)]">
            {t("Role name")}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={Boolean(role?.builtin) || saving}
              placeholder={t("e.g. Moderator")}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] disabled:opacity-60"
            />
          </label>

          {role && (
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {t("Role id")}: <code>{role.id}</code>
              {role.builtin ? ` · ${t("Built-in role")}` : ""}
            </p>
          )}

          <label className="block text-xs font-medium text-[var(--muted-foreground)]">
            {t("Description")}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={saving || Boolean(role?.builtin)}
              rows={2}
              placeholder={t("What is this role for?")}
              className="mt-1.5 w-full resize-none rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[var(--foreground)]">
                {t("Permissions")}
              </p>
              <span className="text-[11px] text-[var(--muted-foreground)]">
                {t("{{count}} selected", { count: permissions.size })}
              </span>
            </div>

            <div className="space-y-3">
              {grouped.map((group) => {
                const groupPermissions = group.permissions.map(
                  (permission) => permission.id,
                );
                const allSelected = groupPermissions.every((permission) =>
                  permissions.has(permission),
                );
                return (
                  <section
                    key={group.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold text-[var(--foreground)]">
                        {t(group.labelKey)}
                      </h4>
                      <button
                        type="button"
                        disabled={!canWrite || saving}
                        onClick={() =>
                          toggleGroup(groupPermissions, !allSelected)
                        }
                        className="text-[11px] text-[var(--muted-foreground)] underline underline-offset-2 transition-colors hover:text-[var(--foreground)] disabled:opacity-40"
                      >
                        {allSelected ? t("Clear all") : t("Select all")}
                      </button>
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission.id}
                          className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-[var(--muted)]/40"
                        >
                          <input
                            type="checkbox"
                            checked={permissions.has(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                            disabled={!canWrite || saving}
                            className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--foreground)]"
                          />
                          <span className="min-w-0">
                            <span className="block text-[var(--foreground)]">
                              {t(permission.labelKey)}
                            </span>
                            <code className="block truncate text-[10px] text-[var(--muted-foreground)]">
                              {permission.id}
                            </code>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
