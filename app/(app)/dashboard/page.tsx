"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import DashboardAssetSummaryCard from "../components/dashboard/DashboardAssetSummaryCard";
import CompletionChecklist from "../components/dashboard/CompletionChecklist";
import ContactInvitationManager from "../components/dashboard/ContactInvitationManager";
import AssetCreateModal from "../components/dashboard/AssetCreateModal";
import type { AssetQuickCreateInput } from "../components/dashboard/AssetCreateModal";
import Icon from "../../../components/ui/Icon";
import { readCanonicalBankAsset } from "../../../lib/assets/bankAsset";
import { formatCurrency } from "../../../lib/currency";
import { buildCompletionChecklist, type CompletionInput } from "../../../lib/dashboard/completion";
import {
  buildBucketSummary,
  buildRecentCanonicalActivity,
  countCanonicalDocuments,
  countAssetsByBucket,
  getDashboardAssetBucket,
  getAssetsForBucket,
  getLegalDocuments,
  latestTimestamp,
  prioritizeCreatedAsset,
} from "../../../lib/dashboard/summary";
import { shouldObscureSection, type AccessActivationStatus, type CollaboratorRole } from "../../../lib/access-control/roles";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { isMissingColumnError, isMissingRelationError } from "../../../lib/supabaseErrors";
import { createAsset } from "../../../lib/assets/createAsset";
import { fetchCanonicalAssets } from "../../../lib/assets/fetchCanonicalAssets";
import { getCanonicalAssetMetadataFromValues, resolveConfiguredFieldValue } from "../../../lib/assets/fieldDictionary";
import { resolveWalletContextForRead } from "../../../lib/canonicalPersistence";
import { getDevSmokeVariant, isDevSmokeModeEnabled } from "../../../lib/devSmoke";
import { buildDashboardDiscoveryResults } from "../../../lib/records/discovery";

type ProfileRow = {
  user_id?: string | null;
  display_name?: string | null;
  avatar_path?: string | null;
};

type AssetRow = {
  id: string;
  owner_user_id?: string | null;
  section_key?: string | null;
  title: string | null;
  category_key?: string | null;
  subtype_key?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  value_minor?: number | null;
  estimated_value_minor?: number | null;
  currency_code?: string | null;
  status?: "active" | "archived" | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type DocumentRow = {
  id: string;
  asset_id?: string | null;
  wallet_id?: string | null;
  title?: string | null;
  category_key?: string | null;
  document_type?: string | null;
  file_name?: string | null;
  document_kind?: string | null;
  owner_user_id?: string | null;
  user_id?: string | null;
  created_at: string | null;
};

type ReminderRow = {
  id: string;
  status?: string | null;
  due_at?: string | null;
  remind_at?: string | null;
  scheduled_for?: string | null;
  owner_user_id?: string | null;
  user_id?: string | null;
};

type ProfileSummary = {
  displayName: string;
  primaryEmail: string;
  secondaryEmail: string;
  mobile: string;
  telephone: string;
  address: string;
  avatarUrl: string;
};

type QuickCreateType = "bank-accounts" | "property" | "business-interests" | "digital-assets";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryKindFilter, setDiscoveryKindFilter] = useState<"all" | "asset" | "document" | "navigation">("all");
  const [currency, setCurrency] = useState("GBP");
  const [currentUserId, setCurrentUserId] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [quickCreateType, setQuickCreateType] = useState<QuickCreateType | null>(null);
  const [quickCreateSaving, setQuickCreateSaving] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState("");
  const createdAssetId = searchParams.get("createdId") ?? "";
  const devSmokeMode = isDevSmokeModeEnabled(searchParams);
  const devSmokeVariant = getDevSmokeVariant(searchParams);

  const [hasProfileRecord, setHasProfileRecord] = useState(false);
  const [hasContactRecord, setHasContactRecord] = useState(false);
  const [hasAddressRecord, setHasAddressRecord] = useState(false);

  const [assetRows, setAssetRows] = useState<AssetRow[]>([]);
  const [documentRows, setDocumentRows] = useState<DocumentRow[]>([]);
  const [reminderRows, setReminderRows] = useState<ReminderRow[]>([]);

  const [profileSummary, setProfileSummary] = useState<ProfileSummary>({
    displayName: "Secure Account",
    primaryEmail: "",
    secondaryEmail: "",
    mobile: "",
    telephone: "",
    address: "",
    avatarUrl: "",
  });

  const viewerRole: CollaboratorRole = "owner";
  const viewerActivation: AccessActivationStatus = "active";
  const assetCounts = useMemo(() => countAssetsByBucket(assetRows), [assetRows]);
  const legalDocuments = useMemo(() => getLegalDocuments(documentRows), [documentRows]);
  const canonicalDocumentCount = useMemo(() => countCanonicalDocuments(documentRows), [documentRows]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      try {
        const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
        if (!user) {
          if (!devSmokeMode) {
            router.replace("/signin");
            return;
          }
          applyDevSmokeDashboardState(devSmokeVariant, setHasProfileRecord, setHasContactRecord, setHasAddressRecord, setAssetRows, setDocumentRows, setReminderRows, setCurrency, setProfileSummary);
          setCurrentUserId("dev-smoke-user");
          return;
        }
        setCurrentUserId(user.id);

        const wallet = await resolveWalletContextForRead(supabase, user.id);
        const [profileRes, assetsRes, documentsRes, remindersRes] = await Promise.all([
          fetchProfile(user.id),
          fetchCanonicalAssets(supabase, { userId: user.id, walletId: wallet.walletId }),
          fetchDocuments(user.id, wallet.walletId),
          fetchReminders(user.id),
        ]);
        if (!mounted) return;

        const profileData = (profileRes.data ?? null) as ProfileRow | null;
        setHasProfileRecord(Boolean(profileData) && !profileRes.error);
        setHasContactRecord(false);
        setHasAddressRecord(false);

        const avatarUrl = profileData?.avatar_path ? await getAvatarPreview(profileData.avatar_path) : "";
        setProfileSummary({
          displayName: profileData?.display_name || user.email?.split("@")[0] || "Secure Account",
          primaryEmail: user.email ?? "",
          secondaryEmail: "",
          mobile: "",
          telephone: "",
          address: "",
          avatarUrl,
        });

        const warnings: string[] = [];
        if (wallet.warning && wallet.warning !== "organisations-table-unavailable" && wallet.warning !== "wallet-not-found") {
          warnings.push("Wallet context is partially unavailable; showing owner-level summaries where possible.");
        }
        if (assetsRes.error && !isMissingRelationError(assetsRes.error, "assets")) {
          warnings.push("Asset summary could not be fully loaded.");
        }
        if (documentsRes.error && !isMissingRelationError(documentsRes.error, "documents")) {
          warnings.push("Document summary could not be fully loaded.");
        }
        if (remindersRes.error && !isMissingRelationError(remindersRes.error, "reminders")) {
          warnings.push("Reminder summary could not be fully loaded.");
        }
        if (warnings.length > 0) {
          setStatus(`⚠️ ${warnings[0]}`);
        }

        const assets = ((assetsRes.data ?? []) as unknown) as AssetRow[];
        setAssetRows(assets);

        const firstCurrency =
          assets.find((row) => row.currency_code)?.currency_code ||
          inferFirstCurrencyFromMetadata(assets) ||
          "GBP";
        setCurrency(firstCurrency);

        setDocumentRows((documentsRes.data ?? []) as DocumentRow[]);
        setReminderRows((remindersRes.data ?? []) as ReminderRow[]);

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
  }, [devSmokeMode, devSmokeVariant, router, refreshToken]);

  useEffect(() => {
    if (searchParams.get("created") !== "1") return;
    const category = searchParams.get("category") ?? "asset";
    const label = category.replace(/-/g, " ");
    const id = searchParams.get("createdId");
    setStatus(`✅ Asset created successfully (${label})${id ? ` · ID ${id}` : ""}.`);
  }, [searchParams]);

const financialSummary = useMemo(() => {
  const canonicalFinanceRows = prioritizeCreatedAsset(getAssetsForBucket(assetRows, "finance"), createdAssetId);
  const totalMajor = canonicalFinanceRows.reduce((sum, row) => sum + getAssetValueMajor(row), 0);

  return {
    addedAt: latestTimestamp(canonicalFinanceRows.map((row) => row.updated_at ?? row.created_at)),
    valueText: canonicalFinanceRows.length
      ? formatCurrency(totalMajor, currency)
      : "No records yet",
    detailText: canonicalFinanceRows.length
      ? `${canonicalFinanceRows.length} finance record(s)`
      : "No records yet",
    items: canonicalFinanceRows.map((row) => {
        const bankAsset = readCanonicalBankAsset({
          title: row.title,
          provider_name: row.provider_name,
          provider_key: row.provider_key ?? null,
          currency_code: row.currency_code ?? null,
          value_minor: row.value_minor ?? row.estimated_value_minor ?? null,
          metadata: row.metadata_json ?? row.metadata ?? null,
        });
        return {
          id: `asset-${row.id}`,
          label: bankAsset.institution_name || bankAsset.title || "Finance asset",
          href: getFinanceWorkspaceHref(String(row.category_key ?? "")),
          meta: formatCurrency(bankAsset.value_major, bankAsset.currency_code || currency),
        };
      }).slice(0, 3),
  };
}, [assetRows, currency, createdAssetId]);
const legalSummary = useMemo(() => {
    return {
      addedAt: latestTimestamp(legalDocuments.map((row) => row.created_at)),
      valueText: legalDocuments.length ? `${legalDocuments.length}` : "No records yet",
      detailText: legalDocuments.length ? `${legalDocuments.length} legal document(s)` : "No records yet",
      items: legalDocuments.slice(0, 3).map((row) => ({
        id: row.id,
        label: row.title || row.document_type || "Legal document",
        href: "/legal",
        meta: row.document_type || "Document",
      })),
    };
  }, [legalDocuments]);

  const propertySummary = useMemo(() => {
    return buildBucketSummary(getAssetsForBucket(assetRows, "property"), {
      createdId: createdAssetId,
      detailLabel: "property asset(s)",
      itemBuilder: (row) => ({
        id: row.id,
        label: row.title || "Property asset",
        href: "/property",
        meta: formatCurrency(getAssetValueMajor(row), row.currency_code || currency),
      }),
    });
  }, [assetRows, currency, createdAssetId]);

  const businessSummary = useMemo(() => {
    return buildBucketSummary(getAssetsForBucket(assetRows, "business"), {
      createdId: createdAssetId,
      detailLabel: "business interest(s)",
      itemBuilder: (row) => ({
        id: row.id,
        label: row.title || "Business interest",
        href: "/business",
        meta: formatCurrency(getAssetValueMajor(row), row.currency_code || currency),
      }),
    });
  }, [assetRows, currency, createdAssetId]);

  const digitalSummary = useMemo(() => {
    return buildBucketSummary(getAssetsForBucket(assetRows, "digital"), {
      createdId: createdAssetId,
      detailLabel: "digital asset(s)",
      itemBuilder: (row) => ({
        id: row.id,
        label: row.title || "Digital asset",
        href: "/vault/digital",
        meta: "Digital",
      }),
    });
  }, [assetRows, createdAssetId]);

  const taskSummary = useMemo(() => {
    return buildBucketSummary(getAssetsForBucket(assetRows, "tasks"), {
      createdId: createdAssetId,
      detailLabel: "task(s)",
      itemBuilder: (row) => ({
        id: row.id,
        label: row.title || "Task",
        href: "/personal/tasks",
        meta: String((row.metadata_json ?? row.metadata ?? {})["task_status"] ?? "Task"),
      }),
    });
  }, [assetRows, createdAssetId]);

  const recentActivity = useMemo(
    () =>
      buildRecentCanonicalActivity({
        assets: assetRows,
        documents: documentRows,
        assetHrefForBucket: getDashboardBucketHref,
        assetLabelForBucket: getDashboardBucketLabel,
      }),
    [assetRows, documentRows],
  );
  const discoveryResults = useMemo(() => {
    const results = buildDashboardDiscoveryResults({
      query: discoveryQuery,
      assets: assetRows,
      documents: documentRows.map((row) => ({
        id: row.id,
        fileName: row.file_name,
        parentLabel: findAssetParentLabel(assetRows, row.asset_id),
        sectionKey: findAssetSectionKey(assetRows, row.asset_id),
        categoryKey: findAssetCategoryKey(assetRows, row.asset_id),
        documentKind: row.document_kind,
      })),
      assetHref: (asset) => getDashboardBucketHref(getDashboardAssetBucket(asset)),
      assetIcon: (asset) => getBucketIcon(getDashboardAssetBucket(asset)),
      documentHref: (document) =>
        getDocumentWorkspaceHref(String(document.sectionKey ?? ""), String(document.categoryKey ?? "")),
      extraLinks: [
        {
          id: "profile",
          label: "Profile",
          description: "Personal details and supporting profile records",
          href: "/profile",
          icon: "person",
          keywords: ["personal details", "identity", "contact", "address"],
        },
        {
          id: "beneficiaries",
          label: "Beneficiaries",
          description: "Canonical beneficiary records",
          href: "/personal/beneficiaries",
          icon: "group",
        },
        {
          id: "executors",
          label: "Executors & Trusted Contacts",
          description: "Executor and trusted contact workspace",
          href: "/trust",
          icon: "shield_person",
          keywords: ["trusted contacts"],
        },
        {
          id: "tasks",
          label: "Tasks & Action Tracking",
          description: "Canonical task records linked to assets and people",
          href: "/personal/tasks",
          icon: "task",
          keywords: ["actions", "action tracking"],
        },
        {
          id: "wishes",
          label: "Wishes",
          description: "Personal wishes and guidance",
          href: "/personal/wishes",
          icon: "favorite",
          keywords: ["instructions", "guidance"],
        },
      ],
    });
    return discoveryKindFilter === "all" ? results : results.filter((item) => item.kind === discoveryKindFilter);
  }, [assetRows, discoveryKindFilter, discoveryQuery, documentRows]);

const completionInput: CompletionInput = useMemo(
  () => ({
    profile: {
      hasProfile: hasProfileRecord,
      hasAddress: hasAddressRecord,
      hasContact: hasContactRecord,
    },
    personal: { total: 0 },
    financial: {
      total: assetCounts.finance,
    },
    legal: {
      total: legalDocuments.length,
    },
    property: {
      total: assetCounts.property,
    },
    business: {
      total: assetCounts.business,
    },
    digital: {
      total: assetCounts.digital,
    },
  }),
  [hasProfileRecord, hasAddressRecord, hasContactRecord, assetCounts, legalDocuments],
);

  const checklist = useMemo(() => buildCompletionChecklist(completionInput), [completionInput]);

  const quickCreateLabel = useMemo(() => {
    switch (quickCreateType) {
      case "bank-accounts":
        return "Bank account";
      case "property":
        return "Property";
      case "business-interests":
        return "Business interest";
      case "digital-assets":
        return "Digital account";
      default:
        return "Asset";
    }
  }, [quickCreateType]);

  async function handleQuickCreateSubmit(input: AssetQuickCreateInput): Promise<boolean> {
    if (!quickCreateType) return false;
    if (!currentUserId) {
      setQuickCreateError("You must be signed in to create assets.");
      return false;
    }
    const titleField = input.config.fields.find((field) => field.key === "title");
    const title = titleField
      ? resolveConfiguredFieldValue(titleField, input.values)
      : `${input.values["title"] ?? ""}`;
    if (!title.trim()) {
      setQuickCreateError("Title is required.");
      return false;
    }

    setQuickCreateSaving(true);
    setQuickCreateError("");

    try {
      const metadata = buildQuickCreateMetadata(quickCreateType, input);

      const created = await createAsset(supabase, {
        userId: currentUserId,
        categorySlug: quickCreateType,
        title: title.trim(),
        metadata,
        visibility: "private",
      });

      setQuickCreateType(null);
      setQuickCreateError("");
      setRefreshToken((prev) => prev + 1);
      const destination = getQuickCreateSuccessRoute(quickCreateType, created.id);
      router.replace(destination);
      router.refresh();
      return true;
    } catch (error) {
      setQuickCreateError(error instanceof Error ? error.message : "Could not create asset.");
      return false;
    } finally {
      setQuickCreateSaving(false);
    }
  }

  function openQuickCreate(type: QuickCreateType) {
    setQuickCreateError("");
    setQuickCreateType(type);
  }

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
          icon={<Icon name="person" size={13} />}
          title="Profile"
          href="/profile"
          addedAt={hasProfileRecord ? new Date().toISOString() : null}
          value={hasProfileRecord ? "Configured" : "No records yet"}
          detail={hasProfileRecord ? "Profile exists" : "No records yet"}
          emptyActionLabel="Open profile setup"
        />

        <DashboardAssetSummaryCard
          icon={<Icon name="account_balance" size={13} />}
          title="Finances"
          href="/finances/bank"
          addedAt={financialSummary.addedAt}
          value={financialSummary.valueText}
          detail={financialSummary.detailText}
          items={financialSummary.items}
          emptyActionLabel="Add first account"
          onEmptyActionClick={() => openQuickCreate("bank-accounts")}
          obscured={shouldObscureSection(viewerRole, "financial", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<Icon name="description" size={13} />}
          title="Legal"
          href="/legal"
          addedAt={legalSummary.addedAt}
          value={legalSummary.valueText}
          detail={legalSummary.detailText}
          items={legalSummary.items}
          emptyActionLabel="Add legal document"
          obscured={shouldObscureSection(viewerRole, "legal", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<Icon name="home" size={13} />}
          title="Property"
          href="/property"
          addedAt={propertySummary.addedAt}
          value={propertySummary.valueText}
          detail={propertySummary.detailText}
          items={propertySummary.items}
          emptyActionLabel="Add property"
          onEmptyActionClick={() => openQuickCreate("property")}
          obscured={shouldObscureSection(viewerRole, "property", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<Icon name="business_center" size={13} />}
          title="Business"
          href="/business"
          addedAt={businessSummary.addedAt}
          value={businessSummary.valueText}
          detail={businessSummary.detailText}
          items={businessSummary.items}
          emptyActionLabel="Add business interest"
          onEmptyActionClick={() => openQuickCreate("business-interests")}
          obscured={shouldObscureSection(viewerRole, "business", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<Icon name="devices" size={13} />}
          title="Digital"
          href="/vault/digital"
          addedAt={digitalSummary.addedAt}
          value={digitalSummary.valueText}
          detail={digitalSummary.detailText}
          items={digitalSummary.items}
          emptyActionLabel="Add digital account"
          onEmptyActionClick={() => openQuickCreate("digital-assets")}
          obscured={shouldObscureSection(viewerRole, "digital", viewerActivation)}
        />

        <DashboardAssetSummaryCard
          icon={<Icon name="task" size={13} />}
          title="Tasks"
          href="/personal/tasks"
          addedAt={taskSummary.addedAt}
          value={taskSummary.valueText}
          detail={taskSummary.detailText}
          items={taskSummary.items}
          emptyActionLabel="Open tasks"
        />
      </div>

      <AssetCreateModal
        open={Boolean(quickCreateType)}
        categorySlug={quickCreateType}
        categoryLabel={quickCreateLabel}
        saving={quickCreateSaving}
        error={quickCreateError}
        success=""
        onClose={() => {
          if (quickCreateSaving) return;
          setQuickCreateType(null);
          setQuickCreateError("");
        }}
        onSubmit={handleQuickCreateSubmit}
      />

      <CompletionChecklist items={checklist} />

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
          padding: 14,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="monitoring" size={18} />
          <h2 style={{ margin: 0, fontSize: 16 }}>Canonical totals & activity</h2>
        </div>
        <div className="lf-content-grid" style={{ gap: 10 }}>
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Total assets</div>
            <div style={metricValueStyle}>{assetCounts.finance + assetCounts.property + assetCounts.business + assetCounts.digital + assetCounts.tasks}</div>
            <div style={metricHelpStyle}>Bank, property, business, digital, and task assets</div>
          </div>
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Linked documents</div>
            <div style={metricValueStyle}>{canonicalDocumentCount}</div>
            <div style={metricHelpStyle}>Documents linked directly to canonical assets</div>
          </div>
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Reminders</div>
            <div style={metricValueStyle}>{reminderRows.length}</div>
            <div style={metricHelpStyle}>Scheduled reminder records</div>
          </div>
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Open tasks</div>
            <div style={metricValueStyle}>{getAssetsForBucket(assetRows, "tasks").filter((row) => String((row.metadata_json ?? row.metadata ?? {})["task_status"] ?? "") !== "completed").length}</div>
            <div style={metricHelpStyle}>Canonical task records not marked complete</div>
          </div>
        </div>
        {recentActivity.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {recentActivity.map((item) => (
              <button
                key={item.id}
                type="button"
                style={activityRowStyle}
                onClick={() => router.push(item.href)}
              >
                <span style={activityIconStyle}>
                  <Icon name={item.icon} size={16} />
                </span>
                <span style={{ display: "grid", gap: 2, textAlign: "left", flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{item.description}</span>
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatDashboardDate(item.timestamp)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={emptyActivityStyle}>
            <Icon name="hourglass_empty" size={16} />
            No recent canonical asset or document activity yet.
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
          padding: 14,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="search" size={18} />
          <h2 style={{ margin: 0, fontSize: 16 }}>Quick find</h2>
        </div>
        <div className="lf-content-grid" style={{ gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Search</span>
            <div style={dashboardSearchWrapStyle}>
              <Icon name="search" size={16} />
              <input
                value={discoveryQuery}
                onChange={(event) => setDiscoveryQuery(event.target.value)}
                placeholder="Find assets, linked documents, profile pages, wishes, beneficiaries, executors, or tasks"
                style={dashboardSearchInputStyle}
              />
            </div>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Result type</span>
            <select
              value={discoveryKindFilter}
              onChange={(event) => setDiscoveryKindFilter(event.target.value as typeof discoveryKindFilter)}
              style={dashboardFilterSelectStyle}
            >
              <option value="all">All results</option>
              <option value="asset">Assets</option>
              <option value="document">Documents</option>
              <option value="navigation">Pages</option>
            </select>
          </label>
        </div>
        {!discoveryQuery.trim() ? (
          <div style={emptyActivityStyle}>
            <Icon name="search" size={16} />
            Search canonical assets, linked documents, and shared workspaces from one place.
          </div>
        ) : discoveryResults.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {discoveryResults.map((item) => (
              <button key={item.id} type="button" style={activityRowStyle} onClick={() => router.push(item.href)}>
                <span style={activityIconStyle}>
                  <Icon name={item.icon} size={16} />
                </span>
                <span style={{ display: "grid", gap: 2, textAlign: "left", flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{item.description}</span>
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize" }}>{item.kind}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={emptyActivityStyle}>
            <Icon name="filter_alt_off" size={16} />
            No canonical records or shared workspaces match that search.
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Profile summary</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {profileSummary.avatarUrl ? (
            <Image
              src={profileSummary.avatarUrl}
              alt={`${profileSummary.displayName} picture`}
              width={48}
              height={48}
              style={{ borderRadius: "999px", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "999px",
                border: "1px solid #d1d5db",
                background: "#f8fafc",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              {makeInitials(profileSummary.displayName)}
            </div>
          )}
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 700 }}>{profileSummary.displayName}</div>
            {profileSummary.address ? <div style={{ color: "#64748b", fontSize: 13 }}>{profileSummary.address}</div> : null}
            <div style={{ color: "#64748b", fontSize: 13 }}>
              {[profileSummary.primaryEmail, profileSummary.secondaryEmail].filter(Boolean).join(" · ") || "No email saved"}
            </div>
            {(profileSummary.mobile || profileSummary.telephone) ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>
                {[profileSummary.mobile, profileSummary.telephone].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <ContactInvitationManager />
    </div>
  );
}

async function fetchProfile(userId: string) {
  let response = await supabase
    .from("profiles")
    .select("user_id,display_name,avatar_path")
    .eq("user_id", userId)
    .maybeSingle();

  if (response.error && (isMissingRelationError(response.error, "profiles") || isMissingColumnError(response.error, "avatar_path"))) {
    response = await supabase
      .from("profiles")
      .select("user_id,display_name")
      .eq("user_id", userId)
      .maybeSingle();
  }

  return response;
}

async function fetchDocuments(userId: string, walletId: string | null) {
  let query = supabase
    .from("documents")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });

  if (walletId) query = query.eq("wallet_id", walletId);

  let response = await query;
  if (response.error && isMissingColumnError(response.error, "owner_user_id")) {
    response = await supabase
      .from("documents")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    if (!response.error && walletId) {
      response = await supabase
        .from("documents")
        .select("*")
        .eq("created_by", userId)
        .eq("wallet_id", walletId)
        .order("created_at", { ascending: false });
    }
  }

  return response;
}

async function fetchReminders(userId: string) {
  let response = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .order("scheduled_for", { ascending: true });

  if (response.error && isMissingColumnError(response.error, "user_id")) {
    response = await supabase
      .from("reminders")
      .select("*")
      .eq("owner_user_id", userId)
      .order("scheduled_for", { ascending: true });
  }

  return response;
}

function getDashboardBucketHref(bucket: ReturnType<typeof getDashboardAssetBucket>) {
  if (bucket === "finance") return "/finances/bank";
  if (bucket === "property") return "/property";
  if (bucket === "business") return "/business";
  if (bucket === "digital") return "/vault/digital";
  if (bucket === "tasks") return "/personal/tasks";
  return "/dashboard";
}

function getFinanceWorkspaceHref(categoryKey: string) {
  if (categoryKey === "investments") return "/finances/investments";
  if (categoryKey === "pensions") return "/finances/pensions";
  if (categoryKey === "insurance") return "/finances/insurance";
  if (categoryKey === "debts" || categoryKey === "loans-liabilities") return "/finances/debts";
  return "/finances/bank";
}

function getDashboardBucketLabel(bucket: ReturnType<typeof getDashboardAssetBucket>) {
  if (bucket === "finance") return "Bank Accounts";
  if (bucket === "property") return "Property";
  if (bucket === "business") return "Business Interests";
  if (bucket === "digital") return "Digital Assets";
  if (bucket === "tasks") return "Tasks";
  return "Assets";
}

function getBucketIcon(bucket: ReturnType<typeof getDashboardAssetBucket>) {
  if (bucket === "finance") return "account_balance";
  if (bucket === "property") return "home";
  if (bucket === "business") return "business_center";
  if (bucket === "digital") return "devices";
  if (bucket === "tasks") return "task";
  return "inventory_2";
}

function findAssetParentLabel(rows: AssetRow[], assetId: string | null | undefined) {
  const match = rows.find((row) => row.id === String(assetId ?? ""));
  return String(match?.title ?? match?.provider_name ?? "").trim() || "Linked asset";
}

function findAssetSectionKey(rows: AssetRow[], assetId: string | null | undefined) {
  return String(rows.find((row) => row.id === String(assetId ?? ""))?.section_key ?? "").trim();
}

function findAssetCategoryKey(rows: AssetRow[], assetId: string | null | undefined) {
  return String(rows.find((row) => row.id === String(assetId ?? ""))?.category_key ?? "").trim();
}

function getDocumentWorkspaceHref(sectionKey: string, categoryKey: string) {
  if (sectionKey === "property") return "/property/documents";
  if (sectionKey === "personal" && categoryKey === "beneficiaries") return "/personal/beneficiaries";
  if (sectionKey === "personal" && categoryKey === "executors") return "/trust";
  if (sectionKey === "personal" && categoryKey === "tasks") return "/personal/tasks";
  if (sectionKey === "finances") return "/finances/bank";
  if (sectionKey === "business") return "/business";
  if (sectionKey === "digital") return "/vault/digital";
  return "/dashboard";
}

function getAssetValueMajor(row: AssetRow) {
  if (typeof row.estimated_value_minor === "number") return row.estimated_value_minor / 100;
  if (typeof row.value_minor === "number") return row.value_minor / 100;

  const metadata = row.metadata_json ?? row.metadata ?? {};
  const candidateKeys = [
    "estimated_value_minor",
    "current_balance_minor",
    "outstanding_balance_minor",
    "cover_amount_minor",
    "estimated_value",
    "current_balance",
    "outstanding_balance",
    "cover_amount",
    "value",
  ];

  for (const key of candidateKeys) {
    const raw = metadata[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return key.endsWith("_minor") ? raw / 100 : raw;
    }
    if (typeof raw === "string") {
      const parsed = Number(raw.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) {
        return key.endsWith("_minor") ? parsed / 100 : parsed;
      }
    }
  }

  return 0;
}

function inferFirstCurrencyFromMetadata(rows: AssetRow[]) {
  for (const row of rows) {
    const metadata = row.metadata_json ?? row.metadata ?? {};
    const candidate = `${metadata["currency"] ?? metadata["currency_code"] ?? ""}`.trim().toUpperCase();
    if (candidate) return candidate;
  }
  return "";
}

function formatDashboardDate(input?: string | null) {
  if (!input) return "No date";
  try {
    return new Date(input).toLocaleDateString();
  } catch {
    return input;
  }
}

async function getAvatarPreview(path: string) {
  const buckets = ["vault-docs", "avatars"];
  for (const bucket of buckets) {
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;
  }
  return "";
}

function makeInitials(input: string) {
  const clean = input.trim();
  if (!clean) return "LF";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "LF";
}

function buildQuickCreateMetadata(_type: QuickCreateType, input: AssetQuickCreateInput) {
  return getCanonicalAssetMetadataFromValues(input.config, input.values);
}

function getQuickCreateSuccessRoute(type: QuickCreateType, createdId: string) {
  return `/dashboard?created=1&category=${encodeURIComponent(type)}&createdId=${encodeURIComponent(createdId)}`;
}

function applyDevSmokeDashboardState(
  variant: "empty" | "fixture",
  setHasProfileRecord: (value: boolean) => void,
  setHasContactRecord: (value: boolean) => void,
  setHasAddressRecord: (value: boolean) => void,
  setAssetRows: (rows: AssetRow[]) => void,
  setDocumentRows: (rows: DocumentRow[]) => void,
  setReminderRows: (rows: ReminderRow[]) => void,
  setCurrency: (value: string) => void,
  setProfileSummary: (value: ProfileSummary) => void,
) {
  const now = new Date().toISOString();
  const fixtureAssets: AssetRow[] =
    variant === "fixture"
      ? [
          {
            id: "smoke-asset-bank-1",
            owner_user_id: "dev-smoke-user",
            section_key: "finances",
            category_key: "bank",
            title: "Smoke HSBC Current Account",
            provider_name: "HSBC",
            value_minor: 125000,
            currency_code: "GBP",
            status: "active",
            metadata_json: {
              institution_name: "HSBC",
              account_type: "Current Account",
              account_number: "12345678",
              sort_code: "10-20-30",
              country: "GB",
              currency: "GBP",
            },
            created_at: now,
            updated_at: now,
            archived_at: null,
            deleted_at: null,
          },
        ]
      : [];

  setHasProfileRecord(variant === "fixture");
  setHasContactRecord(variant === "fixture");
  setHasAddressRecord(variant === "fixture");
  setAssetRows(fixtureAssets);
  setDocumentRows([]);
  setReminderRows([]);
  setCurrency("GBP");
  setProfileSummary({
    displayName: variant === "fixture" ? "Smoke User" : "Secure Account",
    primaryEmail: variant === "fixture" ? "smoke-user@legacy-fortress.local" : "",
    secondaryEmail: "",
    mobile: "",
    telephone: "",
    address: variant === "fixture" ? "1 Smoke Test Lane, London" : "",
    avatarUrl: "",
  });
}

const metricCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "#f8fafc",
  display: "grid",
  gap: 4,
} satisfies React.CSSProperties;

const metricLabelStyle = {
  fontSize: 12,
  color: "#64748b",
} satisfies React.CSSProperties;

const metricValueStyle = {
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
} satisfies React.CSSProperties;

const metricHelpStyle = {
  fontSize: 12,
  color: "#64748b",
} satisfies React.CSSProperties;

const activityRowStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#fff",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  cursor: "pointer",
} satisfies React.CSSProperties;

const activityIconStyle = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} satisfies React.CSSProperties;

const emptyActivityStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#64748b",
} satisfies React.CSSProperties;

const dashboardSearchWrapStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#fff",
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 42,
  color: "#475569",
} satisfies React.CSSProperties;

const dashboardSearchInputStyle = {
  border: "none",
  outline: "none",
  width: "100%",
  fontSize: 14,
  color: "#0f172a",
  background: "transparent",
} satisfies React.CSSProperties;

const dashboardFilterSelectStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#fff",
  minHeight: 42,
  padding: "0 12px",
  fontSize: 14,
  color: "#0f172a",
} satisfies React.CSSProperties;
