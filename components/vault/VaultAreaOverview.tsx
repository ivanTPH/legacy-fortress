import Link from "next/link";
import Icon from "../../components/ui/Icon";
import { LFPageHeader } from "../../components/ui/LFDesignSystem";

export type VaultAreaTile = {
  key: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  addHref: string;
  count?: number;
  updatedAt?: string | null;
};

export function VaultAreaOverview({
  title,
  description,
  addHref,
  tiles,
  loading = false,
}: {
  title: string;
  description: string;
  addHref: string;
  tiles: VaultAreaTile[];
  loading?: boolean;
}) {
  return (
    <section className="lf-vault-area-overview">
      <LFPageHeader title={title} description={description} action={{ label: "Add record", href: addHref, icon: "add" }} />
      <div className="lf-vault-area-grid">
        {tiles.map((tile) => {
          const hasRecords = !loading && (tile.count ?? 0) > 0;
          return (
            <Link key={tile.key} href={loading || hasRecords ? tile.href : tile.addHref} className={`lf-vault-area-tile${loading ? " is-loading" : hasRecords ? " is-populated" : " is-empty"}`} aria-disabled={loading || undefined}>
              <span className="lf-vault-area-tile-icon"><Icon name={tile.icon} size={20} /></span>
              <span className="lf-vault-area-tile-copy">
                <strong>{tile.title}</strong>
                <small>{loading ? "Loading your records..." : hasRecords ? `${tile.count} ${tile.count === 1 ? "record" : "records"}${tile.updatedAt ? ` · Updated ${formatDate(tile.updatedAt)}` : ""}` : "Not added yet"}</small>
                {!loading && !hasRecords ? <em>{tile.description}</em> : null}
              </span>
              <Icon name={loading || hasRecords ? "chevron_right" : "add_circle"} size={20} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "date unavailable" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
