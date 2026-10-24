"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import Modal from "@/components/common/Modal";
import {
  setUserRole,
  type RoleDefinition,
  type UserRecord,
} from "@/lib/admin-api";

interface RoleAssignDialogProps {
  user: UserRecord | null;
  roles: readonly RoleDefinition[];
  onClose: () => void;
  onAssigned: (role: string, roleName: string) => void;
}

export function RoleAssignDialog({
  user,
  roles,
  onClose,
  onAssigned,
}: RoleAssignDialogProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setSelected(user.role);
    setError("");
    setSaving(false);
  }, [user]);

  async function handleAssign() {
    if (!user || !selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await setUserRole(user.username, selected);
      onAssigned(result.role, result.role_name);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Failed to update role"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={user !== null}
      onClose={onClose}
      title={t("Change role")}
      width="md"
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
            onClick={handleAssign}
            disabled={saving || !selected || selected === user?.role}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? t("Saving…") : t("Assign")}
          </button>
        </div>
      }
    >
      <div className="px-5 py-4">
        {error && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </div>
        )}
        {user && (
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            {t("Choose a role for {{username}}.", { username: user.username })}
          </p>
        )}
        <div className="max-h-[55dvh] space-y-1 overflow-y-auto">
          {roles.map((role) => (
            <label
              key={role.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                selected === role.id
                  ? "border-[var(--ring)] bg-[var(--accent)]/60"
                  : "border-[var(--border)] hover:bg-[var(--muted)]/30"
              }`}
            >
              <input
                type="radio"
                name="account-role"
                value={role.id}
                checked={selected === role.id}
                onChange={() => setSelected(role.id)}
                disabled={saving}
                className="mt-1 h-4 w-4 accent-[var(--foreground)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                  {role.name}
                  {role.builtin && (
                    <span className="rounded-full bg-[var(--muted)]/60 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
                      {t("Built-in role")}
                    </span>
                  )}
                </span>
                {role.description && (
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    {role.description}
                  </span>
                )}
                <span className="mt-0.5 block text-[10px] text-[var(--muted-foreground)]">
                  {t("{{count}} users", { count: role.user_count })} ·{" "}
                  {t("{{count}} permissions", {
                    count: role.permissions.length,
                  })}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
