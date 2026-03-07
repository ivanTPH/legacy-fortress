import React from "react";

type IconProps = {
  size?: number;
};

function iconStyle(size: number) {
  return {
    width: size,
    height: size,
    stroke: "currentColor",
    strokeWidth: 1.65,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function DashboardIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

export function PersonIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20" />
    </svg>
  );
}

export function WalletIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <path d="M4 7h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a2 2 0 0 1-2-2z" />
      <path d="M4 7V6a2 2 0 0 1 2-2h11" />
      <circle cx="16" cy="13.5" r="1" />
    </svg>
  );
}

export function DocumentIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h6M10 17h6" />
    </svg>
  );
}

export function BuildingIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <path d="M4 21V5a2 2 0 0 1 2-2h8v18" />
      <path d="M14 21V9h4a2 2 0 0 1 2 2v10" />
      <path d="M8 7h2M8 11h2M8 15h2" />
    </svg>
  );
}

export function BriefcaseIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

export function KeyIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9" />
      <path d="M18 12v3" />
      <path d="M21 12v2" />
    </svg>
  );
}

export function SupportIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <path d="M5 10a7 7 0 1 1 14 0v5a2 2 0 0 1-2 2h-3" />
      <rect x="3" y="10" width="4" height="7" rx="2" />
      <rect x="17" y="10" width="4" height="7" rx="2" />
      <path d="M10 19h4" />
    </svg>
  );
}

export function SettingsIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={iconStyle(size)} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.09-1l2.09-1.62-2-3.46-2.5 1a7 7 0 0 0-1.73-1L14.5 3h-5l-.27 2.92a7 7 0 0 0-1.73 1l-2.5-1-2 3.46L5.09 11A7 7 0 0 0 5 12c0 .34.03.67.09 1L3 14.62l2 3.46 2.5-1c.53.42 1.11.76 1.73 1L9.5 21h5l.27-2.92c.62-.24 1.2-.58 1.73-1l2.5 1 2-3.46L18.91 13c.06-.33.09-.66.09-1Z" />
    </svg>
  );
}
