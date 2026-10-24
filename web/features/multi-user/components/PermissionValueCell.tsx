"use client";

import { useTranslation } from "react-i18next";
import { Check, Minus } from "lucide-react";

import type { PermissionValue } from "@/lib/permission-matrix";

const LABEL_KEYS: Record<PermissionValue, string> = {
  yes: "Yes",
  no: "No",
  granted: "Only when granted",
  fixed: "No",
  configurable: "Configurable",
  full: "Yes",
  limited: "Limited",
};

const TONE_CLASSES: Record<PermissionValue, string> = {
  yes: "text-emerald-600 dark:text-emerald-400",
  no: "text-[var(--muted-foreground)]/60",
  granted: "text-amber-600 dark:text-amber-400",
  fixed: "text-[var(--muted-foreground)]/60",
  configurable: "text-sky-600 dark:text-sky-400",
  full: "text-emerald-600 dark:text-emerald-400",
  limited: "text-amber-600 dark:text-amber-400",
};

/**
 * One cell of the permission matrix.
 *
 * Values with an icon read as a plain yes/no; the other values are a word
 * ("Only when granted", "Limited", …) so a reader cannot mistake a conditional
 * grant for a guarantee.
 */
export function PermissionValueCell({ value }: { value: PermissionValue }) {
  const { t } = useTranslation();
  const label = t(LABEL_KEYS[value]);

  if (value === "yes" || value === "full") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${TONE_CLASSES[value]}`}
      >
        <Check size={13} strokeWidth={2.2} aria-hidden />
        {label}
      </span>
    );
  }

  if (value === "no" || value === "fixed") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs ${TONE_CLASSES[value]}`}
      >
        <Minus size={13} strokeWidth={2} aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex text-xs font-medium ${TONE_CLASSES[value]}`}>
      {label}
    </span>
  );
}
