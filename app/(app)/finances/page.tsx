"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "../../../components/ui/Icon";
import { PageHeader } from "../../../components/ui/V3Primitives";
import VaultSectionGrid from "../../../components/vault/VaultSectionGrid";
import { formatCurrency } from "../../../lib/currency";
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
  const recordCount = populated.reduce((sum, section) => sum + section.summary.includedCount, 0);
  const total = populated.reduce((sum, section) => sum + section.summary.totalMajor, 0);
  const currencies = new Set(assetRows.map((row) => getFinanceRowCurrencyCode(row) || currency));
  const totalText = currencies.size > 1 ? "Multiple currencies" : formatCurrency(total, currency);
  return <section className="lf-v3-area-page lf-v52-finance-page">
    <PageHeader title="Finances" description={loading ? "Loading records…" : `${recordCount} record${recordCount === 1 ? "" : "s"} · ${totalText}`}
      action={viewer.mode !== "linked" ? <Link href="/add?area=finances" className="lf-v52-finance-add"><Icon name="add" size={20} /><span>Add to Finances</span></Link> : undefined}>
      <nav className="lf-v52-finance-breadcrumb" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><Icon name="chevron_right" size={18} /><span aria-current="page">Finances</span></nav>
    </PageHeader>
    {status ? <p role="alert">{status}</p> : null}
    {loading ? <p role="status">Loading finance summary…</p> : null}
    <VaultSectionGrid sections={(viewer.mode === "linked" ? populated : summaries).map((section) => ({
      key: section.href, title: section.title, icon: section.icon, href: section.href,
      count: section.summary.includedCount,
      value: new Set(getAssetsForFinanceCategory(assetRows, section.key).map((row) => getFinanceRowCurrencyCode(row) || currency)).size > 1
        ? "Multiple currencies" : section.summary.valueText,
      addHref: viewer.mode === "linked" ? undefined : `${section.href}?add=1`,
      updatedAt: section.summary.addedAt,
    }))} />
    {!loading && viewer.mode === "linked" && !recordCount ? <p>No finance records are assigned to you.</p> : null}
  </section>;
}
