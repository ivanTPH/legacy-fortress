"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, IconTile, PageHeader, Row } from "../../../components/ui/V3Primitives";
import { AddAssetLink } from "../../../components/ui/LFDesignSystem";
import { formatCurrency } from "../../../lib/currency";
import { latestTimestamp } from "../../../lib/dashboard/summary";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { resolveWalletContextForRead } from "../../../lib/canonicalPersistence";
import {
  buildFinanceCategorySummary,
  getAssetsForFinanceCategory,
  getFinanceRowCurrencyCode,
  type DashboardAssetRow,
  type FinanceCategoryKey,
} from "../../../lib/dashboard/summary";
import { loadFinanceDashboardRows } from "../../../lib/dashboard/financeRows";
import { filterFinanceDashboardRowsForViewer } from "../../../lib/dashboard/financeViewerRows";
import { isVaultSubsectionEnabled, type VaultSubsectionKey } from "../../../lib/vaultPreferences";
import {
  shouldRefreshDashboardForAssetMutation,
  subscribeToCanonicalAssetMutation,
} from "../../../lib/assets/liveSync";

type FinanceSectionCard = {
  key: FinanceCategoryKey;
  preferenceKey: VaultSubsectionKey;
  title: string;
  href: string;
  description: string;
  icon: string;
};

const FINANCE_SECTION_CARDS: FinanceSectionCard[] = [
  { key: "bank", preferenceKey: "finances_bank", title: "Banks", href: "/finances/bank", description: "Current and savings accounts.", icon: "account_balance" },
  { key: "pensions", preferenceKey: "finances_pensions", title: "Pensions", href: "/finances/pensions", description: "Track pension providers, values, and notes.", icon: "savings" },
  { key: "investments", preferenceKey: "finances_investments", title: "Investments", href: "/finances/investments", description: "Record portfolios, funds, and investment platforms.", icon: "trending_up" },
  { key: "insurance", preferenceKey: "finances_insurance", title: "Insurance", href: "/finances/insurance", description: "Capture life and protection policy references.", icon: "health_and_safety" },
  { key: "debts", preferenceKey: "finances_debts", title: "Debts", href: "/finances/debts", description: "Track liabilities and repayment obligations.", icon: "credit_card" },
];

export default function FinancesOverviewPage() {
  const router = useRouter();
  const { viewer } = useViewerAccess();
  const { preferences } = useVaultPreferences();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [currency, setCurrency] = useState("GBP");
  const [assetRows, setAssetRows] = useState<DashboardAssetRow[]>([]);

  useEffect(() => {
    return subscribeToCanonicalAssetMutation((detail) => {
      if (!shouldRefreshDashboardForAssetMutation(detail)) return;
      setRefreshToken((prev) => prev + 1);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      try {
        const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
        if (!user) {
          router.replace("/sign-in");
          return;
        }

        const ownerUserId = viewer.targetOwnerUserId || user.id;
        const wallet = await resolveWalletContextForRead(supabase, ownerUserId);
        const assetsRes = await loadFinanceDashboardRows(supabase, {
          userId: ownerUserId,
          walletId: wallet.walletId,
          select: "id,section_key,category_key,status,archived_at,deleted_at,created_at,updated_at,title,provider_name,provider_key,value_minor,currency_code,metadata_json",
        });

        if (!mounted) return;
        if (assetsRes.error) {
          setStatus(`⚠️ Could not load finance summary: ${assetsRes.error.message}`);
          setAssetRows([]);
          return;
        }

        const rows = filterFinanceDashboardRowsForViewer((assetsRes.data ?? []) as DashboardAssetRow[], viewer);
        setAssetRows(rows);
        const firstCurrency =
          rows.find((row) => row.currency_code)?.currency_code
          || rows
            .map((row) => `${(row.metadata_json ?? row.metadata ?? {})["currency_code"] ?? (row.metadata_json ?? row.metadata ?? {})["currency"] ?? ""}`.trim().toUpperCase())
            .find(Boolean)
          || "GBP";
        setCurrency(firstCurrency);
      } catch (error) {
        if (!mounted) return;
        setStatus(`⚠️ Could not load finance summary: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [refreshToken, router, viewer]);

  const summaries = useMemo(
    () => FINANCE_SECTION_CARDS.map((section) => ({
      ...section,
      summary: buildFinanceCategorySummary(assetRows, {
        categoryKey: section.key,
        currency,
        href: section.href,
        itemLimit: Number.POSITIVE_INFINITY,
      }),
    })).filter((section) => isVaultSubsectionEnabled(preferences, section.preferenceKey)),
    [assetRows, currency, preferences],
  );
  const populated = summaries.filter((section) => section.summary.includedCount > 0);
  const empty = summaries.filter((section) => section.summary.includedCount === 0);
  const recordCount = populated.reduce((sum, section) => sum + section.summary.includedCount, 0);
  const total = populated.reduce((sum, section) => sum + section.summary.totalMajor, 0);
  const currencies = new Set(assetRows.map((row) => getFinanceRowCurrencyCode(row) || currency));
  const updatedAt = latestTimestamp(populated.map((section) => section.summary.addedAt));
  const bankRecordCount = assetRows.filter((row) => String(row.category_key ?? "").trim() === "bank").length;
  const recommendedFinanceAction = bankRecordCount === 0 && viewer.mode !== "linked"
    ? { href: "/finances/bank?add=1", label: "Add your first account", description: "Start with a bank account so your financial picture has a clear foundation." }
    : null;

  return <section className="lf-v3-area-page lf-v51-finance-page">
    <div className="lf-v51-finance-heading"><PageHeader title="Finances" description="Keep accounts, pensions, investments, insurance and debts together for trusted review." />
      <details className="lf-v51-finance-info"><summary aria-label="About Finances">ⓘ</summary><p>Keep accounts, pensions, investments, insurance and debts together for trusted review.</p></details>
    </div>
    {status ? <p role="alert">{status}</p> : null}
    {loading ? <p role="status">Loading finance summary…</p> : null}
    {!loading && recordCount > 0 ? <div className="lf-v51-finance-total" aria-label="Finance recorded total"><strong>{currencies.size > 1 ? "Multiple currencies" : formatCurrency(total, currency)}</strong><span>{recordCount} record{recordCount === 1 ? "" : "s"} · updated {formatFinanceDate(updatedAt)}</span></div> : null}
    {!loading && recordCount > 0 ? <Card className="lf-v3-stats-strip" aria-label="Finance summary">
      <div><span>Total recorded</span><strong>{currencies.size > 1 ? "Multiple currencies" : formatCurrency(total, currency)}</strong></div>
      <div><span>Records</span><strong>{recordCount}</strong><small>in {populated.length} of {summaries.length} sections</small></div>
      <div><span>Last updated</span><strong>{formatFinanceDate(updatedAt)}</strong></div>
    </Card> : null}
    {!loading && recommendedFinanceAction ? <Card><Row icon="account_balance" title={recommendedFinanceAction.label}
      description={recommendedFinanceAction.description} href={recommendedFinanceAction.href} /></Card> : null}
    {populated.map((section) => <Card key={section.href} className="lf-v3-area-section">
      <header><Link href={section.href}><IconTile icon={section.icon} /><span><strong>{section.title}</strong><small className="lf-v3-section-count">{section.summary.includedCount} record{section.summary.includedCount === 1 ? "" : "s"}</small><small className="lf-v51-finance-section-summary">{section.summary.includedCount} record{section.summary.includedCount === 1 ? "" : "s"} · {section.summary.valueText}</small></span></Link>
        <strong className="lf-v3-area-total">{new Set(getAssetsForFinanceCategory(assetRows, section.key).map((row) => getFinanceRowCurrencyCode(row) || currency)).size > 1 ? "Multiple currencies" : section.summary.valueText}</strong>
        {viewer.mode !== "linked" ? <AddAssetLink href={`${section.href}?add=1`} /> : null}
      </header>
      {section.summary.items.map((item) => <Row key={item.id} title={item.label} trailing={item.meta}
        description={item.updatedAt ? `Updated ${formatFinanceDate(item.updatedAt)}` : "Open record details"} href={item.href} />)}
    </Card>)}
    {viewer.mode !== "linked" && empty.length ? <section className="lf-v3-area-empty" aria-label="Not added yet">
      <h2>{recordCount ? "Not added yet" : "Start with any of these"}</h2>
      <div>{empty.map((section) => <Link key={section.href} href={section.href} className="lf-v3-area-empty-tile">
        <IconTile icon={section.icon} size={32} /><strong>{section.title}</strong><small>{section.description}</small><span aria-hidden="true">＋</span>
      </Link>)}</div>
    </section> : null}
    {!loading && viewer.mode === "linked" && !recordCount ? <p>No finance records are assigned to you.</p> : null}
  </section>;
}

function formatFinanceDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
