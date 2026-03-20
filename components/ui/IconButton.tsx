"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import Icon from "./Icon";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: string;
  label: string;
  danger?: boolean;
};

export function IconButton({ icon, label, danger = false, style, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={danger ? "lf-icon-btn lf-icon-btn-danger" : "lf-icon-btn"}
      style={style}
      {...props}
    >
      <Icon name={icon} size={18} />
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
      <Icon name={icon} size={16} />
    </span>
  );
}

const statusToneStyle: Record<NonNullable<Parameters<typeof StatusIcon>[0]["tone"]>, CSSProperties> = {
  neutral: {
    color: "#334155",
    background: "#f1f5f9",
    borderColor: "#cbd5e1",
  },
  success: {
    color: "#166534",
    background: "#dcfce7",
    borderColor: "#bbf7d0",
  },
  warning: {
    color: "#92400e",
    background: "#fef3c7",
    borderColor: "#fde68a",
  },
  danger: {
    color: "#991b1b",
    background: "#fee2e2",
    borderColor: "#fecaca",
  },
};

export default IconButton;
