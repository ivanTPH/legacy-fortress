"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../../components/ui/Icon";
import { LFPageHeader, LFStatsStrip } from "../../../components/ui/LFDesignSystem";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { resolveWalletContextForRead } from "../../../lib/canonicalPersistence";
import {
  buildFinanceCategorySummary,
  getDashboardAssetValueMajor,
  latestTimestamp,
  type DashboardAssetRow,
  type FinanceCategoryKey,
} from "../../../lib/dashboard/summary";
import { loadFinanceDashboardRows } from "../../../lib/dashboard/financeRows";
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

        const rows = (assetsRes.data ?? []) as DashboardAssetRow[];
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
  }, [refreshToken, router, viewer.targetOwnerUserId]);

  const summaries = useMemo(
    () => FINANCE_SECTION_CARDS.map((section) => ({
      ...section,
      summary: buildFinanceCategorySummary(assetRows, {
        categoryKey: section.key,
        currency,
        href: section.href,
        itemLimit: 20,
      }),
    })).filter((section) => isVaultSubsectionEnabled(preferences, section.preferenceKey)),
    [assetRows, currency, preferences],
  );
  const bankRecordCount = useMemo(
    () => assetRows.filter((row) => String(row.category_key ?? "").trim() === "bank").length,
    [assetRows],
  );
  const recommendedFinanceAction = bankRecordCount === 0
    ? {
        href: "/finances/bank?add=1",
        label: "Add your first account",
        description: "Start with a bank account so your financial picture has a clear foundation.",
      }
    : assetRows.length === 0
      ? {
          href: "/finances/bank?add=1",
          label: "Add your first finance record",
          description: "Choose one financial area and add what you know now.",
        }
      : null;
  const totalRecorded = assetRows.reduce((sum, row) => sum + getDashboardAssetValueMajor(row), 0);
  const lastUpdated = latestTimestamp(assetRows.map((row) => row.updated_at ?? row.created_at));
  const formatUpdatedDate = (value: string | null) => value
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Not yet";
  const sectionUnit = (section: FinanceSectionCard, count: number) => {
    if (section.key === "bank") return count === 1 ? "account" : "accounts";
    const singular = section.title.endsWith("s") ? section.title.slice(0, -1) : section.title;
    return count === 1 ? singular.toLowerCase() : section.title.toLowerCase();
  };

  const populatedSections = summaries.filter((section) => section.summary.items.length > 0);
  const emptySections = summaries.filter((section) => section.summary.items.length === 0);

  return (
    <section className="lf-finance-page">
      <LFPageHeader
        title="Finances"
        description="Record your bank accounts, savings, pensions, and policies so your estate has a clear financial picture."
        action={{ label: "Add record", href: "/finances/bank?add=1", icon: "add" }}
      />

      {!loading ? (
        <LFStatsStrip items={[
          { label: "Total recorded", value: new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(totalRecorded) },
          { label: "Records", value: String(assetRows.length), suffix: `in ${summaries.filter((section) => section.summary.items.length > 0).length} of ${summaries.length} categories` },
          { label: "Last updated", value: formatUpdatedDate(lastUpdated) },
        ]} />
      ) : null}

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div className="lf-loading-note" role="status">Loading your finances...</div> : null}
      {!loading && recommendedFinanceAction && !assetRows.length ? (
        <Link href={recommendedFinanceAction.href} className="lf-finance-recommended-action">
          <span className="lf-finance-recommended-icon"><Icon name="arrow_forward" size={17} /></span>
          <span><strong>{recommendedFinanceAction.label}</strong><small>{recommendedFinanceAction.description}</small></span>
        </Link>
      ) : null}

      {!loading && summaries.length ? (
        <div className="lf-finance-sections">
          {populatedSections.map((section) => (
            <section key={section.href} className="lf-finance-section-card" aria-labelledby={`finance-${section.key}`}>
              <div className="lf-finance-section-heading">
                <span className="lf-finance-section-icon"><Icon name={section.icon} size={20} /></span>
                <span><h2 id={`finance-${section.key}`}>{section.title}</h2><small>{section.summary.includedCount} {sectionUnit(section, section.summary.includedCount)}</small></span>
                <strong>{section.summary.totalMajor > 0 ? new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(section.summary.totalMajor) : ""}</strong>
                <Link href={`${section.href}?add=1`} className="lf-finance-add" aria-label={`Add ${section.title.toLowerCase()}`}><Icon name="add" size={20} /></Link>
              </div>
              <div className="lf-finance-record-list">
                {section.summary.items.map((item) => (
                  <Link key={item.id} href={item.href} className="lf-finance-record-row">
                    <span><strong>{item.label}</strong><small>{item.updatedAt ? `Updated ${formatUpdatedDate(item.updatedAt)}` : "Updated date unavailable"}</small></span>
                    <span><strong>{item.meta}</strong><Icon name="chevron_right" size={20} /></span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {emptySections.length ? <section className="lf-finance-empty-section" aria-labelledby="finance-empty-heading">
            <h2 id="finance-empty-heading">Not added yet</h2>
            <div className="lf-finance-empty-grid">
              {emptySections.map((section) => <Link key={section.href} href={`${section.href}?add=1`} className="lf-finance-empty-tile"><span className="lf-finance-empty-icon"><Icon name={section.icon} size={20} /></span><span><strong>{section.title}</strong><small>{section.description}</small></span><Icon name="add" size={20} /></Link>)}
            </div>
          </section> : null}
        </div>
      ) : !loading ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Finance subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      ) : null}
    </section>
  );
}

const recommendedActionStyle = {
  textDecoration: "none",
  border: "1px solid #e3d9d1",
  borderRadius: 14,
  background: "#fffefd",
  padding: 14,
  display: "flex",
  alignItems: "center",
  gap: 12,
  color: "#0f172a",
} as const;

const recommendedIconStyle = {
  width: 34,
  height: 34,
  borderRadius: 11,
  background: "#2b201b",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} as const;
