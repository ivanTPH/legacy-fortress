"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardAssetSummaryCard from "../components/dashboard/DashboardAssetSummaryCard";
import CompletionChecklist from "../components/dashboard/CompletionChecklist";
import ContactInvitationManager from "../components/dashboard/ContactInvitationManager";
import {
  BriefcaseIcon,
  BuildingIcon,
  DocumentIcon,
  KeyIcon,
  PersonIcon,
  WalletIcon,
} from "../components/NavIcons";
import { formatCurrency } from "../../../lib/currency";
import { computeFinancialTotals } from "../../../lib/financialTotals";
import { buildCompletionChecklist, type CompletionInput } from "../../../lib/dashboard/completion";
import { shouldObscureSection, type AccessActivationStatus, type CollaboratorRole } from "../../../lib/access-control/roles";
import { supabase } from "../../../lib/supabaseClient";

type FinancialRow = {
  id: string;
  account_type: string | null;
  account_name: string | null;
  balance: number | null;
  currency: string | null;
  created_at: string | null;
};

type LegalRow = {
  id: string;
  title: string | null;
  document_type: string | null;
  created_at: string | null;
};

type PropertyRow = {
  id: string;
  address: string | null;
  property_type: string | null;
  estimated_value: number | null;
  mortgage_balance: number | null;
  created_at: string | null;
};

type BusinessRow = {
  id: string;
  entity_name: string | null;
  entity_type: string | null;
  estimated_value: number | null;
  created_at: string | null;
};

type DigitalRow = {
  id: string;
  service_name: string | null;
  category: string | null;
  created_at: string | null;
};

type PersonalRow = {
  id: string;
  item_name: string | null;
  possession_type: string | null;
  estimated_value: number | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("GBP");

  const [hasProfileRecord, setHasProfileRecord] = useState(false);
  const [hasContactRecord, setHasContactRecord] = useState(false);
  const [hasAddressRecord, setHasAddressRecord] = useState(false);

  const [financialRows, setFinancialRows] = useState<FinancialRow[]>([]);
  const [legalRows, setLegalRows] = useState<LegalRow[]>([]);
  const [propertyRows, setPropertyRows] = useState<PropertyRow[]>([]);
  const [businessRows, setBusinessRows] = useState<BusinessRow[]>([]);
  const [digitalRows, setDigitalRows] = useState<DigitalRow[]>([]);
  const [personalRows, setPersonalRows] = useState<PersonalRow[]>([]);

  const viewerRole: CollaboratorRole = "owner";
  const viewerActivation: AccessActivationStatus = "active";

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      try {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const user = userData.user;
        if (!user) {
          router.replace("/signin");
          return;
        }

        const [
          profileRes,
          contactRes,
          addressRes,
          financialRes,
          legalRes,
          propertyRes,
          businessRes,
          digitalRes,
          personalRes,
        ] = await Promise.all([
          supabase.from("user_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
          supabase.from("contact_details").select("user_id").eq("user_id", user.id).maybeSingle(),
          supabase.from("addresses").select("user_id").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("financial_accounts")
            .select("id,account_type,account_name,balance,currency,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("legal_documents")
            .select("id,title,document_type,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("property_assets")
            .select("id,address,property_type,estimated_value,mortgage_balance,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("business_interests")
            .select("id,entity_name,entity_type,estimated_value,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("digital_assets")
            .select("id,service_name,category,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("personal_possessions")
            .select("id,item_name,possession_type,estimated_value,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (!mounted) return;

        setHasProfileRecord(Boolean(profileRes.data) && !profileRes.error);
        setHasContactRecord(Boolean(contactRes.data) && !contactRes.error);
        setHasAddressRecord(Boolean(addressRes.data) && !addressRes.error);

        if (financialRes.error) {
          setStatus("⚠️ Financial summary could not be loaded.");
          setFinancialRows([]);
        } else {
          const rows = (financialRes.data ?? []) as FinancialRow[];
          setFinancialRows(rows);
          const firstCurrency = rows.find((row) => row.currency)?.currency;
          if (firstCurrency) setCurrency(firstCurrency);
        }

        setLegalRows(legalRes.error ? [] : ((legalRes.data ?? []) as LegalRow[]));
        setPropertyRows(propertyRes.error ? [] : ((propertyRes.data ?? []) as PropertyRow[]));
        setBusinessRows(businessRes.error ? [] : ((businessRes.data ?? []) as BusinessRow[]));
        setDigitalRows(digitalRes.error ? [] : ((digitalRes.data ?? []) as DigitalRow[]));
        setPersonalRows(personalRes.error ? [] : ((personalRes.data ?? []) as PersonalRow[]));
      } catch (error) {
        if (!mounted) return;
        setStatus(`⚠️ Could not load dashboard: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const financialSummary = useMemo(() => {
    const totals = computeFinancialTotals(
      financialRows.map((row) => ({ account_type: row.account_type ?? "bank", balance: Number(row.balance ?? 0) })),
    );
    const bankAccountCount = financialRows.filter((row) => row.account_type === "bank" || row.account_type === "savings").length;
    return {
      addedAt: latestDate(financialRows.map((row) => row.created_at)),
      valueText: formatCurrency(totals.net, currency),
      detailText: `${bankAccountCount} bank account(s) · Assets ${formatCurrency(totals.assets, currency)} · Liabilities ${formatCurrency(totals.liabilities, currency)}`,
      items: financialRows.slice(0, 3).map((row) => ({
        id: row.id,
        label: row.account_name || row.account_type || "Financial account",
        href: `/vault/financial/${row.id}`,
        meta: formatCurrency(Number(row.balance ?? 0), row.currency || currency),
      })),
    };
  }, [financialRows, currency]);

  const legalSummary = useMemo(() => ({
    addedAt: latestDate(legalRows.map((row) => row.created_at)),
    valueText: `${legalRows.length}`,
    detailText: `${legalRows.length} document(s)` ,
    items: legalRows.slice(0, 3).map((row) => ({
      id: row.id,
      label: row.title || row.document_type || "Legal document",
      href: `/vault/legal/${row.id}`,
      meta: row.document_type || "Document",
    })),
  }), [legalRows]);

  const propertySummary = useMemo(() => {
    const net = propertyRows.reduce((sum, row) => sum + Number(row.estimated_value ?? 0) - Number(row.mortgage_balance ?? 0), 0);
    return {
      addedAt: latestDate(propertyRows.map((row) => row.created_at)),
      valueText: propertyRows.length ? formatCurrency(net, currency) : "No properties",
      detailText: `${propertyRows.length} property record(s)`,
      items: propertyRows.slice(0, 3).map((row) => ({
        id: row.id,
        label: row.address || row.property_type || "Property",
        href: `/vault/property/${row.id}`,
        meta: formatCurrency(Number(row.estimated_value ?? 0), currency),
      })),
    };
  }, [propertyRows, currency]);

  const businessSummary = useMemo(() => {
    const total = businessRows.reduce((sum, row) => sum + Number(row.estimated_value ?? 0), 0);
    return {
      addedAt: latestDate(businessRows.map((row) => row.created_at)),
      valueText: businessRows.length ? formatCurrency(total, currency) : "No businesses",
      detailText: `${businessRows.length} business record(s)`,
      items: businessRows.slice(0, 3).map((row) => ({
        id: row.id,
        label: row.entity_name || row.entity_type || "Business interest",
        href: `/vault/business/${row.id}`,
        meta: formatCurrency(Number(row.estimated_value ?? 0), currency),
      })),
    };
  }, [businessRows, currency]);

  const digitalSummary = useMemo(() => ({
    addedAt: latestDate(digitalRows.map((row) => row.created_at)),
    valueText: `${digitalRows.length}`,
    detailText: `${digitalRows.length} digital account reference(s)`,
    items: digitalRows.slice(0, 3).map((row) => ({
      id: row.id,
      label: row.service_name || row.category || "Digital account",
      href: `/vault/digital/${row.id}`,
      meta: row.category || "Digital",
    })),
  }), [digitalRows]);

  const personalSummary = useMemo(() => {
    const total = personalRows.reduce((sum, row) => sum + Number(row.estimated_value ?? 0), 0);
    return {
      addedAt: latestDate(personalRows.map((row) => row.created_at)),
      valueText: personalRows.length ? formatCurrency(total, currency) : "No items",
      detailText: `${personalRows.length} possession record(s)`,
      items: personalRows.slice(0, 3).map((row) => ({
        id: row.id,
        label: row.item_name || row.possession_type || "Personal possession",
        href: `/vault/personal/${row.id}`,
        meta: row.possession_type || "Possession",
      })),
    };
  }, [personalRows, currency]);

  const completionInput: CompletionInput = useMemo(
    () => ({
      profile: { hasProfile: hasProfileRecord, hasAddress: hasAddressRecord, hasContact: hasContactRecord },
      personal: { total: personalRows.length },
      financial: { total: financialRows.length },
      legal: { total: legalRows.length },
      property: { total: propertyRows.length },
      business: { total: businessRows.length },
      digital: { total: digitalRows.length },
    }),
    [hasProfileRecord, hasAddressRecord, hasContactRecord, personalRows.length, financialRows.length, legalRows.length, propertyRows.length, businessRows.length, digitalRows.length],
  );

  const checklist = useMemo(() => buildCompletionChecklist(completionInput), [completionInput]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>
          Review your estate record summaries, completion progress, and collaborator invitation status.
        </p>
      </div>

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#6b7280" }}>Loading dashboard summary...</div> : null}

      <div className="lf-content-grid">
        <DashboardAssetSummaryCard
          icon={<PersonIcon size={13} />}
          title="Profile"
          href="/profile"
          addedAt={hasProfileRecord ? new Date().toISOString() : null}
          value={hasProfileRecord ? "Configured" : "Not configured"}
          detail={hasProfileRecord ? "Profile saved" : "Add profile details"}
          emptyActionLabel="Open profile setup"
        />

        <DashboardAssetSummaryCard
          icon={<WalletIcon size={13} />}
          title="Finances"
          href="/vault/financial"
          addedAt={financialSummary.addedAt}
          value={financialSummary.valueText}
          detail={financialSummary.detailText}
          items={financialSummary.items}
          emptyActionLabel="Add first account"
          obscured={shouldObscureSection(viewerRole, "financial", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<DocumentIcon size={13} />}
          title="Legal"
          href="/vault/legal"
          addedAt={legalSummary.addedAt}
          value={legalSummary.valueText}
          detail={legalSummary.detailText}
          items={legalSummary.items}
          emptyActionLabel="Add legal document"
          obscured={shouldObscureSection(viewerRole, "legal", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<BuildingIcon size={13} />}
          title="Property"
          href="/vault/property"
          addedAt={propertySummary.addedAt}
          value={propertySummary.valueText}
          detail={propertySummary.detailText}
          items={propertySummary.items}
          emptyActionLabel="Add property"
          obscured={shouldObscureSection(viewerRole, "property", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<BriefcaseIcon size={13} />}
          title="Business"
          href="/vault/business"
          addedAt={businessSummary.addedAt}
          value={businessSummary.valueText}
          detail={businessSummary.detailText}
          items={businessSummary.items}
          emptyActionLabel="Add business interest"
          obscured={shouldObscureSection(viewerRole, "business", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<KeyIcon size={13} />}
          title="Digital"
          href="/vault/digital"
          addedAt={digitalSummary.addedAt}
          value={digitalSummary.valueText}
          detail={digitalSummary.detailText}
          items={digitalSummary.items}
          emptyActionLabel="Add digital account"
          obscured={shouldObscureSection(viewerRole, "digital", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<PersonIcon size={13} />}
          title="Personal"
          href="/vault/personal"
          addedAt={personalSummary.addedAt}
          value={personalSummary.valueText}
          detail={personalSummary.detailText}
          items={personalSummary.items}
          emptyActionLabel="Add possession"
          obscured={shouldObscureSection(viewerRole, "personal", viewerActivation)}
        />
      </div>

      <CompletionChecklist items={checklist} />

      <ContactInvitationManager />
    </div>
  );
}

function latestDate(values: Array<string | null | undefined>) {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (!filtered.length) return null;
  const max = filtered
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  return Number.isFinite(max) ? new Date(max).toISOString() : null;
}
