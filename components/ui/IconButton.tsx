"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import Icon from "./Icon";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: string;
  label: string;
  danger?: boolean;
  variant?: "default" | "round";
};

export function IconButton({ icon, label, danger = false, variant = "default", style, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${danger ? "lf-icon-btn lf-icon-btn-danger" : "lf-icon-btn"}${variant === "round" ? " lf-icon-btn-round" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      {...props}
    >
      <Icon name={icon} size={21} />
    </button>
  );
}

type ActionIconButtonProps = Omit<IconButtonProps, "icon"> & {
  action: "edit" | "attachments" | "delete";
};

const ACTION_ICON_MAP: Record<ActionIconButtonProps["action"], string> = {
  edit: "edit",
  attachments: "attach_file",
  delete: "delete",
};

export function ActionIconButton({ action, label, danger, ...props }: ActionIconButtonProps) {
  return (
    <IconButton
      icon={ACTION_ICON_MAP[action]}
      label={label}
      danger={danger ?? action === "delete"}
      {...props}
    />
  );
}

export function StatusIcon({
  icon,
  tone = "neutral",
  label,
}: {
  icon: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  label: string;
}) {
  return (
    <span
      aria-label={label}
      title={label}
      style={statusToneStyle[tone]}
      className="lf-status-icon"
    >
      <Icon name={icon} size={18} />
    </span>
  );
}

const statusToneStyle: Record<NonNullable<Parameters<typeof StatusIcon>[0]["tone"]>, CSSProperties> = {
  neutral: {
    color: "var(--lf-text)",
    background: "var(--lf-surface-subtle)",
    borderColor: "var(--lf-border-input)",
  },
  success: {
    color: "var(--lf-status-approved-text)",
    background: "#dcfce7",
    borderColor: "var(--lf-status-approved-bg)",
  },
  warning: {
    color: "var(--lf-status-pending-text)",
    background: "#fef3c7",
    borderColor: "var(--lf-status-pending-bg)",
  },
  danger: {
    color: "var(--lf-status-rejected-text)",
    background: "#fee2e2",
    borderColor: "var(--lf-status-rejected-bg)",
  },
};

export default IconButton;
