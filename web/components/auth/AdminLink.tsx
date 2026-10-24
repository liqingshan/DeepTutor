"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import { hasPermission } from "@/lib/admin-permissions";
import Tooltip from "@/shared/ui/Tooltip";

interface AdminLinkProps {
  collapsed?: boolean;
}

export function AdminLink({ collapsed = false }: AdminLinkProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { enabled, permissions } = useAuthStatus();
  const canOpenUsers = hasPermission(permissions, "admin.users.read");
  const canOpenRoles = hasPermission(permissions, "admin.roles.read");

  if (!enabled || (!canOpenUsers && !canOpenRoles)) return null;

  const href = canOpenUsers ? "/admin/users" : "/admin/roles";
  const active = pathname.startsWith("/admin");

  if (collapsed) {
    return (
      <Tooltip label={t("Admin")} side="right">
        <Link
          href={href}
          className={`rounded-lg p-2 transition-colors
            ${
              active
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/50 hover:text-[var(--foreground)]"
            }`}
          aria-label={t("Admin")}
        >
          <ShieldCheck size={16} strokeWidth={1.5} />
        </Link>
      </Tooltip>
    );
  }

  return (
    <Link
      href={href}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors
        ${
          active
            ? "bg-[var(--primary)]/10 text-[var(--primary)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/50 hover:text-[var(--foreground)]"
        }`}
    >
      <ShieldCheck size={16} strokeWidth={1.5} />
      <span>{t("Admin")}</span>
    </Link>
  );
}
