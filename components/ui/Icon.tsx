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
  size = 18,
  filled = false,
  className,
  style,
  title,
}: IconProps) {
  return (
    <span
      className={`lf-icon material-symbols-outlined${className ? ` ${className}` : ""}`}
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
      {name}
    </span>
  );
}

