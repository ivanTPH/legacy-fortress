"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, IconTile, PageHeader, Row } from "../../../components/ui/V3Primitives";
import { AddAssetLink } from "../../../components/ui/LFDesignSystem";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { filterAssetIdsForViewer, filterRecordIdsForViewer } from "../../../lib/access-control/viewerAccess";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { assetMatchesLegalCategory, LEGAL_CATEGORIES } from "../../../lib/legalCategories";
import { fetchCanonicalAssets } from "../../../lib/assets/fetchCanonicalAssets";
import { resolveWalletContextForRead } from "../../../lib/canonicalPersistence";
import { supabase } from "../../../lib/supabaseClient";
import { getSafeUserData } from "@/lib/auth/requireActiveUser";
import { isVaultSubsectionEnabled, type VaultSubsectionKey } from "../../../lib/vaultPreferences";

type LegalRow = {
  id: string;
  title?: string | null;
  source: "asset" | "record";
  category_key: string | null;
  created_at: string | null;
};

type LegalAssetRow = {
  id: string;
  section_key: string | null;
  category_key: string | null;
  title: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string | null;
};

export default function LegalOverviewPage() {
  const router = useRouter();
  const { viewer } = useViewerAccess();
  const { preferences } = useVaultPreferences();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<LegalRow[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }
      const ownerUserId = viewer.targetOwnerUserId || userData.user.id;

      const [legacyResult, walletContext] = await Promise.all([
        supabase
          .from("records")
          .select("id,title,category_key,created_at")
          .eq("owner_user_id", ownerUserId)
          .eq("section_key", "legal")
          .order("created_at", { ascending: false }),
        resolveWalletContextForRead(supabase, ownerUserId),
      ]);

      const canonicalResult = await fetchCanonicalAssets(supabase, {
        userId: ownerUserId,
        walletId: walletContext.walletId,
        sectionKeys: ["legal", "personal"],
        select: "id,title,section_key,category_key,metadata_json,created_at",
      });

      if (!mounted) return;

      if (legacyResult.error || canonicalResult.error) {
        const message = legacyResult.error?.message ?? canonicalResult.error?.message ?? "Unknown error";
        setStatus(`⚠️ Could not load legal summary: ${message}`);
        setRows([]);
      } else {
        const legacyRows = filterRecordIdsForViewer((legacyResult.data ?? []) as Omit<LegalRow, "source">[], viewer).map((row) => ({ ...row, source: "record" as const }));
        const canonicalRows = filterAssetIdsForViewer((canonicalResult.data ?? []) as LegalAssetRow[], viewer).reduce<LegalRow[]>((result, row) => {
            const matchedCategory = LEGAL_CATEGORIES.find((category) => assetMatchesLegalCategory(row, category.slug));
            if (!matchedCategory) return result;
            result.push({
              id: String(row.id),
              title: row.title,
              source: "asset",
              category_key: matchedCategory.slug,
              created_at: row.created_at,
            });
            return result;
          }, []);

        setRows([...new Map([...legacyRows, ...canonicalRows].map((row) => [`${row.source}:${row.id}`, row])).values()]);
      }

      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router, viewer]);

  const visibleCategories = useMemo(
    () => LEGAL_CATEGORIES.filter((category) => isVaultSubsectionEnabled(preferences, mapLegalSlugToPreferenceKey(category.slug))),
    [preferences],
  );

  const sections = [
    ...visibleCategories.map((category) => ({ slug: category.slug, title: category.label, description: category.description,
      href: getLegalCategoryHref(category.slug), icon: getLegalCategoryIcon(category.slug) })),
    ...(isVaultSubsectionEnabled(preferences, "personal_wishes") ? [{ slug: "personal-wishes", title: "Personal Wishes",
      description: "Guidance and wishes for your trusted people.", href: "/personal/wishes", icon: "volunteer_activism" }] : []),
  ].map((section) => ({ ...section, records: rows.filter((row) => (row.category_key || "other-legal-documents") === section.slug) }));
  const populated = sections.filter((section) => section.records.length > 0);
  const empty = sections.filter((section) => section.records.length === 0);
  const recordCount = new Set(populated.flatMap((section) => section.records.map((row) => `${row.source}:${row.id}`))).size;
  const latest = populated.flatMap((section) => section.records.map((row) => row.created_at)).filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return <section className="lf-v3-area-page">
    <PageHeader title="Legal" description="Keep wills, trusts, powers of attorney and other legal records easy to find."
      action={viewer.mode === "linked" ? undefined : <AddAssetLink href="/legal/wills?add=1" />} />
    {status ? <p role="alert">{status}</p> : null}
    {loading ? <p role="status">Loading legal records…</p> : null}
    {!loading && recordCount > 0 ? <Card className="lf-v3-stats-strip" aria-label="Legal summary">
      <div><span>Records</span><strong>{recordCount}</strong></div>
      <div><span>Sections</span><strong>{populated.length} of {sections.length}</strong></div>
      <div><span>Last updated</span><strong>{formatLegalDate(latest)}</strong></div>
    </Card> : null}
    {populated.map((section) => <Card key={section.slug} className="lf-v3-area-section">
      <header><Link href={section.href}><IconTile icon={section.icon} /><span><strong>{section.title}</strong><small>{section.records.length} record{section.records.length === 1 ? "" : "s"}</small></span></Link>
        {viewer.mode !== "linked" ? <AddAssetLink href={`${section.href}?add=1`} /> : null}
      </header>
      {section.records.map((row) => <Row key={`${row.source}:${row.id}`} title={row.title || section.title}
        description={row.created_at ? `Updated ${formatLegalDate(row.created_at)}` : undefined}
        href={`${section.href}?${row.source === "asset" ? "asset" : "record"}=${encodeURIComponent(row.id)}`} />)}
    </Card>)}
    {viewer.mode !== "linked" && empty.length ? <section className="lf-v3-area-empty" aria-label="Not added yet">
      <h2>{recordCount ? "Not added yet" : "Start with any of these"}</h2>
      <div>{empty.map((section) => <Link key={section.slug} href={section.href} className="lf-v3-area-empty-tile">
        <IconTile icon={section.icon} size={32} /><strong>{section.title}</strong><small>{section.description}</small><span aria-hidden="true">＋</span>
      </Link>)}</div>
    </section> : null}
    {!loading && viewer.mode === "linked" && !recordCount ? <p>No legal records are assigned to you.</p> : null}
  </section>;
}

function formatLegalDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function mapLegalSlugToPreferenceKey(slug: string): VaultSubsectionKey {
  switch (slug) {
    case "wills":
      return "legal_wills";
    case "trusts":
      return "legal_trusts";
    case "power-of-attorney":
      return "legal_power_of_attorney";
    case "funeral-wishes":
    case "marriage-divorce-documents":
    case "identity-documents":
      return "legal_other_legal_documents";
    default:
      return "legal_other_legal_documents";
  }
}

function getLegalCategoryHref(slug: string) {
  if (slug === "identity-documents") return "/identity-documents";
  return `/legal/${slug}`;
}

function getLegalCategoryIcon(slug: string) {
  switch (slug) {
    case "wills":
      return "history_edu";
    case "trusts":
      return "account_balance";
    case "power-of-attorney":
      return "gavel";
    case "funeral-wishes":
      return "volunteer_activism";
    case "marriage-divorce-documents":
      return "diversity_1";
    case "identity-documents":
      return "badge";
    default:
      return "description";
  }
}
