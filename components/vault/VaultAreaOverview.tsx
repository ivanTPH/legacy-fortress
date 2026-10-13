import { LFPageHeader, LFVaultAreaTile } from "../../components/ui/LFDesignSystem";

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
            <LFVaultAreaTile
              key={tile.key}
              title={tile.title}
              description={tile.description}
              icon={tile.icon}
              href={loading || hasRecords ? tile.href : tile.addHref}
              state={loading ? "loading" : hasRecords ? "populated" : "empty"}
              count={tile.count}
              updatedAt={tile.updatedAt}
            />
          );
        })}
      </div>
    </section>
  );
}
