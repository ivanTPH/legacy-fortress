"use client";

import Image from "next/image";
import { useState } from "react";
import Icon from "./Icon";
import { isApprovedLocalLogoPath } from "../../lib/assets/providerLogoPath.mjs";
import { tileLetter, tileTextColour } from "../../lib/assets/providerBrands.mjs";

/**
 * A provider's logo; or, for a known or named financial provider without one, a tile in its colour with its first
 * letter (owner decision 23 Nov 2026); otherwise the category icon or initials.
 */
export default function BrandMark({ name, logoPath = "", categoryIcon, markText, tileColor }: { name: string; logoPath?: string; categoryIcon?: string; markText?: string | null; tileColor?: string | null }) {
  const [failedPath, setFailedPath] = useState("");
  const trustedLogoPath = isApprovedLocalLogoPath(logoPath) ? logoPath : "";
  const words = name.trim().split(/\s+/).map((word) => word.replace(/[^a-z0-9]/gi, "")).filter(Boolean);
  const initials = (markText || (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2)) || "?").toUpperCase();
  const showLogo = Boolean(trustedLogoPath && failedPath !== trustedLogoPath);
  if (!showLogo && tileColor && /^#[0-9a-f]{6}$/i.test(tileColor)) {
    return (
      <span className="lf-v52-brand-mark is-tile" aria-hidden="true" style={{ background: tileColor, color: tileTextColour(tileColor) }}>
        <span>{tileLetter(name)}</span>
      </span>
    );
  }
  // Official app icons (owner decision 25 Nov 2026) fill the whole tile, like the provider's app on a phone.
  const isAppIcon = showLogo && trustedLogoPath.startsWith("/logos/apps/");
  return (
    <span className={`lf-v52-brand-mark ${showLogo ? (isAppIcon ? "is-logo is-app" : "is-logo") : categoryIcon ? "is-category" : "is-monogram"}`} aria-hidden="true">
      {trustedLogoPath && failedPath !== trustedLogoPath ? (
        <Image src={trustedLogoPath} alt="" width={isAppIcon ? 44 : 32} height={isAppIcon ? 44 : 32} unoptimized onError={() => setFailedPath(trustedLogoPath)} />
      ) : categoryIcon ? <Icon name={categoryIcon} size={22} /> : <span>{initials}</span>}
    </span>
  );
}
