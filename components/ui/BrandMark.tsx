"use client";

import Image from "next/image";
import { useState } from "react";
import Icon from "./Icon";
import { isApprovedLocalLogoPath } from "../../lib/assets/providerLogoPath.mjs";

export default function BrandMark({ name, logoPath = "", categoryIcon, markText }: { name: string; logoPath?: string; categoryIcon?: string; markText?: string | null }) {
  const [failedPath, setFailedPath] = useState("");
  const trustedLogoPath = isApprovedLocalLogoPath(logoPath) ? logoPath : "";
  const words = name.trim().split(/\s+/).map((word) => word.replace(/[^a-z0-9]/gi, "")).filter(Boolean);
  const initials = (markText || (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2)) || "?").toUpperCase();
  return (
    <span className={`lf-v52-brand-mark ${trustedLogoPath && failedPath !== trustedLogoPath ? "is-logo" : categoryIcon ? "is-category" : "is-monogram"}`} aria-hidden="true">
      {trustedLogoPath && failedPath !== trustedLogoPath ? (
        <Image src={trustedLogoPath} alt="" width={32} height={32} unoptimized onError={() => setFailedPath(trustedLogoPath)} />
      ) : categoryIcon ? <Icon name={categoryIcon} size={22} /> : <span>{initials}</span>}
    </span>
  );
}
