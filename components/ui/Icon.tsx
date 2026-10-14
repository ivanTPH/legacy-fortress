"use client";

import type { CSSProperties } from "react";

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
  size = 20,
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
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

