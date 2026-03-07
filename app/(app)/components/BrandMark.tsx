import React from "react";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

export default function BrandMark({ size = 40, className }: BrandMarkProps) {
  const dot = Math.max(4, Math.floor((size - 18) / 3));

  return (
    <div
      className={className}
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: "linear-gradient(145deg, #10141f 0%, #1a2433 100%)",
        border: "1px solid #243244",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 4,
        padding: 8,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          style={{
            width: dot,
            height: dot,
            borderRadius: 999,
            background: "rgba(255,255,255,0.95)",
          }}
        />
      ))}
    </div>
  );
}
