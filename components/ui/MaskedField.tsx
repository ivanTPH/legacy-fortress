"use client";

import { useMemo, useState, type CSSProperties } from "react";
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

  const cleanValue = (value ?? "").trim();
  const displayValue = useMemo(() => {
    if (!cleanValue) return placeholder;
    return revealed ? cleanValue : maskAllButLast(cleanValue, preserveLast);
  }, [cleanValue, revealed, placeholder, preserveLast]);

  return (
    <span style={wrapStyle}>
      {label ? <span>{label}: </span> : null}
      <span style={valueStyle}>{displayValue}</span>
      {cleanValue ? (
        <>
          <IconButton
            icon={revealed ? "visibility" : "visibility_off"}
            label={revealed ? "Hide value" : "Reveal value"}
            onClick={() => setRevealed((prev) => !prev)}
            style={iconBtnStyle}
          />
          <IconButton
            icon={copied ? "check" : "content_copy"}
            label={copied ? "Copied" : "Copy value"}
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
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  rowGap: 6,
};

const valueStyle: CSSProperties = {
  letterSpacing: 0.3,
};

const iconBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  marginInlineStart: 2,
};
