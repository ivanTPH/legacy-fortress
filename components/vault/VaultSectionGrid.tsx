import Link from "next/link";
import { IconTile } from "../ui/V3Primitives";
import Icon from "../ui/Icon";

export type VaultSectionTile = {
  key: string;
  title: string;
  icon: string;
  href: string;
  count: number | null;
  value?: string;
  addHref?: string;
  description?: string;
  updatedAt?: string | null;
};

export default function VaultSectionGrid({ sections }: { sections: VaultSectionTile[] }) {
  return <div className="lf-v52-section-grid" aria-label="Vault sections">
    {sections.map((section) => <article key={section.key} className="lf-v52-section-tile">
      <Link href={section.href} className="lf-v52-section-link" aria-label={`${section.title}, ${section.count === null ? section.description ?? "Open section" : section.count ? `${section.count} record${section.count === 1 ? "" : "s"}` : "No records yet"}`}>
        <IconTile icon={section.icon} size={36} />
        <strong>{section.title}</strong>
        <Icon name="chevron_right" size={20} />
      </Link>
      <div className="lf-v52-section-meta">
        <span className="lf-v52-section-meta-primary">
          <span>{section.count === null ? section.description ?? "Open section" : section.count ? `${section.count} record${section.count === 1 ? "" : "s"}` : "No records yet"}</span>
          {section.count !== null && section.count > 0 && section.value ? <strong>· {section.value}</strong> : null}
        </span>
        {section.count !== null && section.count > 0 && section.updatedAt ? <span className="lf-v52-section-updated">Updated {formatSectionDate(section.updatedAt)}</span> : null}
        {section.count === 0 && section.addHref ? <Link href={section.addHref} className="lf-v52-section-add" aria-label={`Add first record in ${section.title}`}><span>Add first record</span><Icon name="add" size={18} /></Link> : null}
      </div>
    </article>)}
  </div>;
}

function formatSectionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
