import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
};

export default function BrandMark({
  size = 40,
  alt = "Legacy Fortress",
  className,
  priority = false,
}: BrandMarkProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
      }}
    >
      <Image
        src="/brand/logo.png"
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        sizes={`${size}px`}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
