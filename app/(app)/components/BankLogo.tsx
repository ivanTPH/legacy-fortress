import Image from "next/image";
import { getBankLogoFromRecord, type BankDetectionInput } from "../../../lib/bankLogos";

type BankLogoProps = {
  bank: BankDetectionInput;
  size?: number;
};

export default function BankLogo({ bank, size = 28 }: BankLogoProps) {
  const { logoSrc, alt } = getBankLogoFromRecord(bank);

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        marginRight: 12,
        flexShrink: 0,
      }}
    />
  );
}
