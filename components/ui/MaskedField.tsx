"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import IconButton from "./IconButton";

type MaskedFieldProps = {
  label?: string;
  value: string | null | undefined;
  placeholder?: string;
  preserveLast?: number;
};

export default function MaskedField({
  label,
  value,
  placeholder = "Not set",
  preserveLast = 4,
}: MaskedFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!revealed) return;
    const timeout = window.setTimeout(() => setRevealed(false), 30_000);
    return () => window.clearTimeout(timeout);
  }, [revealed]);

  const cleanValue = (value ?? "").trim();
  const displayValue = useMemo(() => {
    if (!cleanValue) return placeholder;
    return revealed ? cleanValue : maskAllButLast(cleanValue, preserveLast);
  }, [cleanValue, revealed, placeholder, preserveLast]);

  return (
    <span style={cleanValue ? wrapStyle : emptyWrapStyle}>
      <span style={textStyle}>{label ? <span>{label}: </span> : null}<span style={valueStyle}>{displayValue}</span></span>
      {cleanValue ? (
        <>
          <IconButton
            icon={revealed ? "visibility" : "visibility_off"}
            label={revealed ? "Hide protected information" : "Reveal protected information"}
            aria-pressed={revealed}
            onClick={() => setRevealed((prev) => !prev)}
            style={iconBtnStyle}
          />
          <IconButton
            icon={copied ? "check" : "content_copy"}
            label={copied ? "Details copied" : "Copy details"}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(cleanValue);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                setCopied(false);
              }
            }}
            style={iconBtnStyle}
          />
        </>
      ) : null}
    </span>
  );
}

export function maskAllButLast(value: string, preserveLast = 4) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return "";
  if (compact.length <= preserveLast) return "•".repeat(compact.length);
  return `${"•".repeat(compact.length - preserveLast)}${compact.slice(-preserveLast)}`;
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 44px 44px",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minWidth: 0,
};

const emptyWrapStyle: CSSProperties = {
  display: "block",
  minWidth: 0,
};

const textStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
};

const valueStyle: CSSProperties = {
  letterSpacing: 0.3,
};

const iconBtnStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
};
