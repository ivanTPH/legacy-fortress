"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityPreferencesContext";

type InfoTipProps = {
  label: string;
  message: ReactNode;
  title?: ReactNode;
  tone?: "default" | "security" | "warning";
  className?: string;
  alwaysVisible?: boolean;
};

export default function InfoTip({
  label,
  message,
  title,
  tone = "default",
  className,
  alwaysVisible = false,
}: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const { preferences } = useAccessibilityPreferences();

  useEffect(() => {
    if (!open) return undefined;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    return () => document.removeEventListener("pointerdown", closeOnPointerDown);
  }, [open]);

  if (!alwaysVisible && preferences.contextualHelpEnabled === false) {
    return null;
  }

  return (
    <span
      ref={wrapRef}
      className={["lf-info-tip", className].filter(Boolean).join(" ")}
      style={wrapStyle}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        style={{ ...buttonStyle, ...buttonToneStyle[tone] }}
        className="lf-info-tip-button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <span aria-hidden="true" style={glyphStyle}>
          i
        </span>
      </button>
      <span
        id={tipId}
        role="tooltip"
        data-tone={tone}
        className="lf-info-tip-popover lf-info-tip-tooltip"
        style={{
          ...tooltipStyle,
          ...tooltipToneStyle[tone],
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
          transform: open ? "translateY(0)" : "translateY(4px)",
        }}
      >
        {title ? <strong style={titleStyle}>{title}</strong> : null}
        <span>{message}</span>
      </span>
    </span>
  );
}

const wrapStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const buttonStyle: CSSProperties = {
  width: 22,
  height: 22,
  minWidth: 22,
  minHeight: 22,
  borderRadius: 999,
  border: 0,
  background: "#f4f2ef",
  color: "#111827",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const glyphStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1,
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};

const tooltipStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: "calc(100% + 8px)",
  zIndex: 30,
  display: "grid",
  gap: 4,
  width: "min(280px, calc(100vw - 32px))",
  maxWidth: "calc(100vw - 32px)",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#0f172a",
  color: "#fff",
  padding: "10px 12px",
  fontSize: 12,
  lineHeight: 1.5,
  boxShadow: "0 12px 24px rgba(15,23,42,0.18)",
  transition: "opacity 140ms ease, transform 140ms ease",
};

const titleStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  lineHeight: 1.35,
};

const buttonToneStyle: Record<NonNullable<InfoTipProps["tone"]>, CSSProperties> = {
  default: {},
  security: {},
  warning: {},
};

const tooltipToneStyle: Record<NonNullable<InfoTipProps["tone"]>, CSSProperties> = {
  default: {},
  security: {
    borderColor: "#93c5fd",
    background: "#0f172a",
  },
  warning: {
    borderColor: "#fdba74",
    background: "#1c1917",
  },
};
