"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  Minus,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";

import { listUsers, type UserRecord } from "@/lib/admin-api";
import {
  ACCOUNT_ROLES,
  ROLE_DESCRIPTION_KEYS,
  ROLE_MATRIX,
  countUsersByRole,
  type RoleMatrixValue,
} from "@/lib/admin-roles";
import { accountRoleLabelKey, type AccountRole } from "@/lib/account-role";

const ROLE_ICONS: Record<AccountRole, LucideIcon> = {
  admin: ShieldCheck,
  teacher: GraduationCap,
  student: BookOpen,
  user: User,
};

const ROLE_TONES: Record<AccountRole, string> = {
  admin:
    "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  teacher: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  student:
    "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  user: "bg-[var(--muted)]/50 text-[var(--muted-foreground)] ring-[var(--border)]",
};

function MatrixCell({ value }: { value: RoleMatrixValue }) {
  const { t } = useTranslation();

  if (value === "full") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Check size={13} strokeWidth={2.2} />
        {t("Full access")}
      </span>
    );
  }

  if (value === "assigned") {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--muted)]/60 px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
        {t("Assigned")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]/70">
      <Minus size={13} strokeWidth={2} />
      {t("No access")}
    </span>
  );
}

export default function AdminRolesPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listUsers()
      .then((data) => {
        if (alive) setUsers(data);
      })
      .catch((cause) => {
        if (!alive) return;
        setError(
          cause instanceof Error ? cause.message : t("Failed to load users"),
        );
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const counts = useMemo(() => countUsersByRole(users ?? []), [users]);
  const total = users?.length ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-semibold text-[var(--foreground)]">
            {t("Role Management")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("View built-in roles and their default permissions")}
          </p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)]"
        >
          {t("Manage users")}
          <ArrowRight size={14} />
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <section aria-labelledby="admin-built-in-roles">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="admin-built-in-roles"
            className="text-sm font-semibold text-[var(--foreground)]"
          >
            {t("Built-in roles")}
          </h2>
          <span className="text-xs text-[var(--muted-foreground)]">
            {total === null
              ? "—"
              : t("{{count}} users", { count: total })}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {ACCOUNT_ROLES.map((role) => {
            const Icon = ROLE_ICONS[role];
            return (
              <article
                key={role}
                data-testid={`role-card-${role}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${ROLE_TONES[role]}`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {t(accountRoleLabelKey(role))}
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
                      {t(ROLE_DESCRIPTION_KEYS[role])}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between gap-3 border-t border-[var(--border)]/60 pt-3">
                  <div>
                    <span className="font-serif text-2xl font-semibold text-[var(--foreground)]">
                      {users === null ? "—" : counts[role]}
                    </span>
                    <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">
                      {t("Users")}
                    </span>
                  </div>
                  <Link
                    href="/admin/users"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {t("Manage users")}
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="admin-role-permissions" className="mt-8">
        <div className="mb-3">
          <h2
            id="admin-role-permissions"
            className="text-sm font-semibold text-[var(--foreground)]"
          >
            {t("Role permissions")}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t(
              "Role definitions are fixed in this version. Assign roles from User Management.",
            )}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("Capability")}
                </th>
                {ACCOUNT_ROLES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className="px-4 py-3 font-medium"
                  >
                    {t(accountRoleLabelKey(role))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {ROLE_MATRIX.map((row) => (
                <tr key={row.labelKey}>
                  <th
                    scope="row"
                    className="px-4 py-3 text-left font-medium text-[var(--foreground)]"
                  >
                    {t(row.labelKey)}
                  </th>
                  {ACCOUNT_ROLES.map((role) => (
                    <td key={role} className="px-4 py-3">
                      <MatrixCell value={row.values[role]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-[var(--muted-foreground)]">
        {t("DeepTutor Admin · Role Management")}
      </p>
    </div>
  );
}
