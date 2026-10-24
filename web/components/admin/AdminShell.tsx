"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  KeyRound,
  Menu,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import Modal from "@/components/common/Modal";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import { hasPermission } from "@/lib/admin-permissions";

interface AdminNavItem {
  href: string;
  labelKey: string;
  permission: string;
  icon: LucideIcon;
}

const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    href: "/admin/users",
    labelKey: "User Management",
    permission: "admin.users.read",
    icon: Users,
  },
  {
    href: "/admin/roles",
    labelKey: "Role Management",
    permission: "admin.roles.read",
    icon: ShieldCheck,
  },
  {
    href: "/admin/permissions",
    labelKey: "Permission Management",
    permission: "admin.roles.read",
    icon: KeyRound,
  },
];

// Brand names are not translated; keeping this out of JSX also keeps the
// i18n lint rule focused on real copy.
const BRAND_NAME = "DeepTutor";

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavigation({
  permissions,
  onNavigate,
}: {
  permissions: readonly string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const items = ADMIN_NAV.filter((item) =>
    hasPermission(permissions, item.permission),
  );

  return (
    <nav
      aria-label={t("Admin navigation")}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        <p className="px-2.5 pb-1.5 pt-4 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          {t("Account & permissions")}
        </p>
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  active
                    ? "bg-[var(--accent)] font-medium text-[var(--foreground)]"
                    : "text-[var(--foreground)] hover:bg-accent/60"
                }`}
              >
                <Icon size={16} strokeWidth={1.8} className="shrink-0" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, loading, permissions } = useAuthStatus();
  const [mobileOpen, setMobileOpen] = useState(false);

  const allowedNav = ADMIN_NAV.filter((item) =>
    hasPermission(permissions, item.permission),
  );
  const currentItem = ADMIN_NAV.find((item) =>
    isActivePath(pathname, item.href),
  );

  useEffect(() => {
    if (loading) return;
    if (!authenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (allowedNav.length === 0) {
      router.replace("/");
      return;
    }
    if (!currentItem || !hasPermission(permissions, currentItem.permission)) {
      router.replace(allowedNav[0].href);
    }
  }, [
    allowedNav,
    authenticated,
    currentItem,
    loading,
    pathname,
    permissions,
    router,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
        {t("Loading")}
      </div>
    );
  }

  if (!authenticated || allowedNav.length === 0) return null;

  return (
    <div className="fixed inset-0 flex h-dvh overflow-hidden bg-[var(--background)]">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border/60 bg-[color-mix(in_srgb,var(--muted)_25%,var(--background))] md:flex">
        <div className="px-4 pb-3 pt-5">
          <Link
            href={allowedNav[0]?.href ?? "/admin/users"}
            className="flex items-center gap-2.5 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--foreground)] text-[var(--background)]">
              <ShieldCheck size={18} strokeWidth={1.9} />
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-[15px] font-semibold leading-tight text-[var(--foreground)]">
                {BRAND_NAME}
              </span>
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                {t("Admin")}
              </span>
            </span>
          </Link>
        </div>
        <AdminNavigation permissions={permissions} />
        <div className="border-t border-border/60 p-2.5">
          <Link
            href="/"
            className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--muted-foreground)] outline-none transition-colors hover:bg-accent/60 hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
            <span>{t("Back to app")}</span>
          </Link>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 md:hidden">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] font-medium text-[var(--foreground)] outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
            <span>{t("Back to app")}</span>
          </Link>
          <span className="min-w-0 truncate text-[13px] font-medium text-[var(--foreground)]">
            {currentItem ? t(currentItem.labelKey) : t("Admin")}
          </span>
          <button
            type="button"
            aria-label={t("Open admin navigation")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-[var(--foreground)] transition-colors hover:bg-accent"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {children}
        </div>
      </main>

      <Modal
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title={t("Admin")}
        width="sm"
      >
        <div className="flex h-[70dvh] flex-col pt-2">
          <AdminNavigation
            permissions={permissions}
            onNavigate={() => setMobileOpen(false)}
          />
          <div className="border-t border-border/60 p-2.5">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--muted-foreground)] outline-none transition-colors hover:bg-accent/60 hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              <span>{t("Back to app")}</span>
            </Link>
          </div>
        </div>
      </Modal>
    </div>
  );
}
