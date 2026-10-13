"use client";

import type { CSSProperties } from "react";

/** Semantic names used by the application resolve to the approved Material Symbols vocabulary. */
export const LF_ICON_MAP = {
  dashboard: "space_dashboard",
  add: "add",
  addCircle: "add_circle",
  actionCentre: "task_alt",
  finances: "account_balance_wallet",
  legal: "gavel",
  property: "home",
  business: "work",
  digital: "devices",
  possessions: "inventory_2",
  people: "group",
  accessRequests: "key",
  support: "help",
  settings: "settings",
  search: "search",
  notifications: "notifications",
  edit: "edit",
  open: "chevron_right",
  lock: "lock",
  identity: "badge",
  document: "description",
  will: "history_edu",
  trust: "account_tree",
  powerOfAttorney: "shield_person",
} as const;

export type MaterialIconName = string;

type IconProps = {
  name: MaterialIconName;
  size?: number;
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

export default function Icon({
  name,
  size = 18,
  filled = false,
  className,
  style,
  title,
}: IconProps) {
  return (
    <span
      className={`lf-icon material-symbols-rounded${className ? ` ${className}` : ""}`}
      aria-hidden={title ? undefined : true}
      title={title}
      style={{
        fontSize: size,
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24',
        ...style,
      }}
    >
      {LF_ICON_MAP[name as keyof typeof LF_ICON_MAP] ?? name}
    </span>
  );
}
