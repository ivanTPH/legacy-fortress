"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "../../../../components/ui/V3Primitives";
import VaultSectionGrid from "../../../../components/vault/VaultSectionGrid";
import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";
import { filterAssetIdsForViewer } from "../../../../lib/access-control/viewerAccess";
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

        setState({ status: "ready", rows: filterAssetIdsForViewer((result.data ?? []) as CanonicalAssetOverviewRow[], viewer), error: null });
      } catch (error) {
        if (cancelled) return;
        setState({ status: "error", rows: [], error: error instanceof Error ? error.message : "Could not load records." });
      }
    }

    loadRows();
    return () => {
      cancelled = true;
    };
  }, [sectionKeys, viewer]);

  if (!tiles.length) {
    return emptyMessage ? <>{emptyMessage}</> : null;
  }

  const sections = tiles.map((tile) => ({
    tile,
    rows: getLiveAssets(state.rows.filter((row) => row.section_key === tile.sectionKey
      && row.category_key === tile.categoryKey && (!tile.match || tile.match(row)))),
  }));
  const populated = sections.filter((section) => section.rows.length > 0);
  const recordCount = new Set(populated.flatMap((section) => section.rows.map((row) => row.id))).size;
  const updatedAt = latestTimestamp(populated.flatMap((section) => section.rows.map((row) => row.updated_at ?? row.created_at)));
  return <div className="lf-v3-area-content">
    {state.status === "loading" ? <p role="status">Loading records…</p> : null}
    {state.status === "error" ? <p role="alert">Records could not be refreshed. Open a section to review them directly.</p> : null}
    {state.status === "ready" && recordCount ? <Card className="lf-v3-stats-strip" aria-label="Area summary">
      <div><span>Records</span><strong>{recordCount}</strong></div>
      <div><span>Sections</span><strong>{populated.length} of {tiles.length}</strong></div>
      <div><span>Last updated</span><strong>{formatAreaDate(updatedAt)}</strong></div>
    </Card> : null}
    <VaultSectionGrid sections={(viewer.mode === "linked" ? populated : sections).map(({ tile, rows }) => ({
      key: tile.key, title: tile.title, icon: tile.icon, href: tile.href, count: rows.length,
      addHref: viewer.mode === "linked" ? undefined : tile.addHref,
    }))} />
    {state.status === "ready" && viewer.mode === "linked" && !recordCount ? <p>No records are assigned in this area.</p> : null}
  </div>;
}

function formatAreaDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
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
