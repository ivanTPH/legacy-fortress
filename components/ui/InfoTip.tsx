"use client";

import { useId, useState, type CSSProperties } from "react";
import Icon from "./Icon";

export default function InfoTip({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span style={wrapStyle}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        style={buttonStyle}
        className="lf-info-tip-button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="info" size={14} />
      </button>
      <span
        id={tipId}
        role="tooltip"
        style={{
          ...tooltipStyle,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transform: open ? "translateY(0)" : "translateY(4px)",
        }}
      >
        {message}
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
  width: 26,
  height: 26,
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const tooltipStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: "calc(100% + 8px)",
  zIndex: 30,
  width: 240,
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
