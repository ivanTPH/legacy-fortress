"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardAssetSummaryCard from "../components/dashboard/DashboardAssetSummaryCard";
import Icon from "../../../components/ui/Icon";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { fetchCanonicalAssets } from "../../../lib/assets/fetchCanonicalAssets";
import { resolveWalletContextForRead } from "../../../lib/canonicalPersistence";
import {
  buildFinanceCategorySummary,
  type DashboardAssetRow,
  type FinanceCategoryKey,
} from "../../../lib/dashboard/summary";
import {
  shouldRefreshDashboardForAssetMutation,
  subscribeToCanonicalAssetMutation,
} from "../../../lib/assets/liveSync";

type FinanceSectionCard = {
  key: FinanceCategoryKey;
  title: string;
  href: string;
  description: string;
  icon: string;
};

const FINANCE_SECTION_CARDS: FinanceSectionCard[] = [
  { key: "bank", title: "Bank", href: "/finances/bank", description: "Current and savings accounts with provider logos.", icon: "account_balance" },
  { key: "investments", title: "Investments", href: "/finances/investments", description: "Record portfolios, funds, and investment platforms.", icon: "trending_up" },
  { key: "pensions", title: "Pensions", href: "/finances/pensions", description: "Track pension providers, values, and notes.", icon: "savings" },
  { key: "insurance", title: "Insurance", href: "/finances/insurance", description: "Capture life and protection policy references.", icon: "health_and_safety" },
  { key: "debts", title: "Debts", href: "/finances/debts", description: "Track liabilities and repayment obligations.", icon: "credit_card" },
];

export default function FinancesOverviewPage() {
  const router = useRouter();
  const { viewer } = useViewerAccess();
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
        const assetsRes = await fetchCanonicalAssets(supabase, {
          userId: ownerUserId,
          walletId: wallet.walletId,
          sectionKey: "finances",
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
      }),
    })),
    [assetRows, currency],
  );

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Review each finance category at a glance, then open the category page to add, edit, or archive records.
        </p>
      </div>

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#6b7280" }}>Loading finance summary...</div> : null}

      <div className="lf-content-grid">
        {summaries.map((section) => (
          <div key={section.href} className="lf-finance-summary-tile">
            <div className="lf-finance-summary-tile-desc">{section.description}</div>
            <DashboardAssetSummaryCard
              icon={<Icon name={section.icon} size={13} />}
              title={section.title}
              href={section.href}
              addedAt={section.summary.addedAt}
              value={section.summary.valueText}
              detail={section.summary.detailText}
              items={section.summary.items}
              emptyActionLabel="Open category"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
