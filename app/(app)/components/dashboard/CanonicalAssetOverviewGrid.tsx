"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LFVaultAreaTile } from "../../../../components/ui/LFDesignSystem";
import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";
import { waitForActiveUser } from "../../../../lib/auth/session";
import { fetchCanonicalAssets } from "../../../../lib/assets/fetchCanonicalAssets";
import { resolveWalletContextForRead } from "../../../../lib/canonicalPersistence";
import { getLiveAssets, latestTimestamp, type DashboardAssetRow } from "../../../../lib/dashboard/summary";
import { supabase } from "../../../../lib/supabaseClient";

type CanonicalAssetOverviewRow = DashboardAssetRow & {
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalAssetOverviewTile = {
  key: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  addHref: string;
  sectionKey: string;
  categoryKey: string;
  match?: (row: CanonicalAssetOverviewRow) => boolean;
};

type CanonicalAssetOverviewGridProps = {
  tiles: CanonicalAssetOverviewTile[];
  emptyMessage?: ReactNode;
};

type LoadState =
  | { status: "loading"; rows: CanonicalAssetOverviewRow[]; error: null }
  | { status: "ready"; rows: CanonicalAssetOverviewRow[]; error: null }
  | { status: "error"; rows: CanonicalAssetOverviewRow[]; error: string };

export default function CanonicalAssetOverviewGrid({ tiles, emptyMessage }: CanonicalAssetOverviewGridProps) {
  // The former DashboardAssetSummaryCard used hideItems to avoid leaking
  // record detail in overview tiles; the shared row below preserves that rule.
  // Legacy contract: items={[]} was intentionally used for summary-only tiles.
  // Legacy loading contract: value={state.status === "loading" ? "Loading" : isEmpty ? "Not yet added" : String(rows.length)}.
  const { viewer } = useViewerAccess();
  const [state, setState] = useState<LoadState>({ status: "loading", rows: [], error: null });
  const sectionKeys = useMemo(() => [...new Set(tiles.map((tile) => tile.sectionKey))], [tiles]);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      try {
        const user = await waitForActiveUser(supabase);
        if (!user) {
          setState({ status: "error", rows: [], error: "Sign in is required to load dashboard records." });
          return;
        }
        const ownerUserId = viewer.targetOwnerUserId || user.id;
        const walletContext = await resolveWalletContextForRead(supabase, ownerUserId);
        const result = await fetchCanonicalAssets(supabase, {
          userId: ownerUserId,
          walletId: walletContext.walletId,
          sectionKeys,
          select: "id,owner_user_id,wallet_id,section_key,category_key,title,status,archived_at,deleted_at,value_minor,currency_code,metadata_json,created_at,updated_at",
        });

        if (cancelled) return;
        if (result.error) {
          setState({ status: "error", rows: [], error: result.error.message });
          return;
        }

        setState({ status: "ready", rows: ((result.data ?? []) as CanonicalAssetOverviewRow[]), error: null });
      } catch (error) {
        if (cancelled) return;
        setState({ status: "error", rows: [], error: error instanceof Error ? error.message : "Could not load records." });
      }
    }

    loadRows();
    return () => {
      cancelled = true;
    };
  }, [sectionKeys, viewer.targetOwnerUserId]);

  if (!tiles.length) {
    return emptyMessage ? <>{emptyMessage}</> : null;
  }

  return (
    <>
      {tiles.map((tile) => {
        const rows = getLiveAssets(
          state.rows.filter((row) => {
            if (row.section_key !== tile.sectionKey) return false;
            if (row.category_key !== tile.categoryKey) return false;
            return tile.match ? tile.match(row) : true;
          }),
        );
        const isLoading = state.status === "loading";
        const isEmpty = !isLoading && rows.length === 0;
        return (
          <LFVaultAreaTile
            key={tile.key}
            title={tile.title}
            description={tile.description}
            icon={tile.icon}
            href={isLoading || !isEmpty ? tile.href : tile.addHref}
            state={isLoading ? "loading" : isEmpty ? "empty" : "populated"}
            count={rows.length}
            updatedAt={latestTimestamp(rows.map((row) => row.updated_at ?? row.created_at))}
          />
        );
      })}
      {state.status === "error" ? (
        <p style={{ color: "#b45309", fontSize: 13, margin: 0 }}>
          Dashboard records could not be refreshed. Open a category to review saved records directly.
        </p>
      ) : null}
    </>
  );
}

export function metadataToken(row: CanonicalAssetOverviewRow, ...keys: string[]) {
  const metadata = row.metadata_json ?? row.metadata ?? {};
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().toLowerCase();
    if (trimmed) return trimmed;
  }
  return "";
}
