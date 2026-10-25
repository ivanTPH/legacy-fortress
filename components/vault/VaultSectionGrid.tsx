import Link from "next/link";
import { IconTile } from "../ui/V3Primitives";
import { AddAssetLink } from "../ui/LFDesignSystem";

export type VaultSectionTile = {
  key: string;
  title: string;
  icon: string;
  href: string;
  count: number | null;
  value?: string;
  addHref?: string;
  description?: string;
};

export default function VaultSectionGrid({ sections }: { sections: VaultSectionTile[] }) {
  return <div className="lf-v52-section-grid" aria-label="Vault sections">
    {sections.map((section) => <article key={section.key} className="lf-v52-section-tile">
      <Link href={section.href} className="lf-v52-section-link" aria-label={`${section.title}, ${section.count === null ? section.description ?? "Open section" : section.count ? `${section.count} record${section.count === 1 ? "" : "s"}` : "No records yet"}`}>
        <IconTile icon={section.icon} size={36} />
        <strong>{section.title}</strong>
        <span aria-hidden="true">›</span>
      </Link>
      <div className="lf-v52-section-meta">
        <span>{section.count === null ? section.description ?? "Open section" : section.count ? `${section.count} record${section.count === 1 ? "" : "s"}` : "No records yet"}</span>
        {section.count !== null && section.count > 0 && section.value ? <span>{section.value}</span> : null}
      </div>
      {section.addHref ? <AddAssetLink href={section.addHref} /> : null}
    </article>)}
  </div>;
}
