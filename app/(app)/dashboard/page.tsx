"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardAssetSummaryCard from "../components/dashboard/DashboardAssetSummaryCard";
import ActionQueuePanel from "../components/dashboard/ActionQueuePanel";
import Icon from "../../../components/ui/Icon";
import { formatCurrency } from "../../../lib/currency";
import {
  buildFinanceSummary,
  buildBucketSummary,
  getDashboardAssetValueMajor,
  getAssetsForBucket,
  getLegalDocuments,
  latestTimestamp,
} from "../../../lib/dashboard/summary";
import { shouldObscureSection, type AccessActivationStatus, type CollaboratorRole } from "../../../lib/access-control/roles";
import { canViewPath, filterAssetIdsForViewer, filterRecordIdsForViewer } from "../../../lib/access-control/viewerAccess";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { isMissingColumnError, isMissingRelationError } from "../../../lib/supabaseErrors";
import { fetchCanonicalAssets } from "../../../lib/assets/fetchCanonicalAssets";
import {
  loadCanonicalContactsForOwner,
  type CanonicalContactInviteStatus,
  type CanonicalContactVerificationStatus,
} from "../../../lib/contacts/canonicalContacts";
import { buildDashboardDiscoveryResults } from "../../../lib/records/discovery";
import {
  notifyCanonicalAssetMutation,
  shouldRefreshDashboardForAssetMutation,
  subscribeToCanonicalAssetMutation,
} from "../../../lib/assets/liveSync";
import { resolveWalletContextForRead } from "../../../lib/canonicalPersistence";
import {
  appendDevBankTrace,
  getDevSmokeVariant,
  isDevBankTraceEnabled,
  isDevSmokeModeEnabled,
  readDevBankTrace,
  subscribeToDevBankTrace,
  type CanonicalBankTraceEntry,
} from "../../../lib/devSmoke";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultCategoryEnabled } from "../../../lib/vaultPreferences";
import {
  deriveBlockingState,
  resolveWorkflowActionHref,
  type BlockingUserContext,
} from "../../../lib/workflow/blockingModel";

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

type AttachmentRow = {
  id: string;
  record_id?: string | null;
  owner_user_id?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  created_at?: string | null;
};

type SectionEntrySearchRow = {
  id: string;
  title?: string | null;
  section_key?: string | null;
  category_key?: string | null;
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

type ContactDiscoveryRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_role?: string | null;
  relationship?: string | null;
  invite_status?: CanonicalContactInviteStatus | null;
  verification_status?: CanonicalContactVerificationStatus | null;
  linked_context?: Array<{
    label?: string | null;
    role?: string | null;
    section_key?: string | null;
    category_key?: string | null;
  }> | null;
};

type ProfileReadinessRow = {
  hasProfile: boolean;
  hasAddress: boolean;
  hasContact: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { viewer } = useViewerAccess();
  const { preferences } = useVaultPreferences();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [refreshToken, setRefreshToken] = useState(0);
  const [devBankTraceEntries, setDevBankTraceEntries] = useState<CanonicalBankTraceEntry[]>([]);
  const createdAssetId = searchParams.get("createdId") ?? "";
  const devSmokeMode = isDevSmokeModeEnabled(searchParams);
  const devSmokeVariant = getDevSmokeVariant(searchParams);
  const devBankTraceEnabled = isDevBankTraceEnabled(searchParams);

  const [assetRows, setAssetRows] = useState<AssetRow[]>([]);
  const [documentRows, setDocumentRows] = useState<DocumentRow[]>([]);
  const [attachmentRows, setAttachmentRows] = useState<AttachmentRow[]>([]);
  const [contactRows, setContactRows] = useState<ContactDiscoveryRow[]>([]);
  const [sectionEntryRows, setSectionEntryRows] = useState<SectionEntrySearchRow[]>([]);
  const [profileReadiness, setProfileReadiness] = useState<ProfileReadinessRow>({
    hasProfile: false,
    hasAddress: false,
    hasContact: false,
  });

  const viewerRole: CollaboratorRole = viewer.viewerRole;
  const viewerActivation: AccessActivationStatus = viewer.activationStatus;
  const canViewFinancial = canViewPath("/finances", viewer);
  const canViewLegal = canViewPath("/legal", viewer);
  const canViewProperty = canViewPath("/property", viewer);
  const canViewBusiness = canViewPath("/business", viewer);
  const canViewDigital = canViewPath("/vault/digital", viewer);
  const canViewTasks = canViewPath("/personal/tasks", viewer);
  const showFinancialCard = canViewFinancial && isVaultCategoryEnabled(preferences, "finances");
  const showLegalCard = canViewLegal && isVaultCategoryEnabled(preferences, "legal");
  const showPropertyCard = canViewProperty && isVaultCategoryEnabled(preferences, "property");
  const showBusinessCard = canViewBusiness && isVaultCategoryEnabled(preferences, "business");
  const showDigitalCard = canViewDigital && isVaultCategoryEnabled(preferences, "digital");
  const showTaskCard = canViewTasks && isVaultCategoryEnabled(preferences, "tasks");
  const legalDocuments = useMemo(() => getLegalDocuments(documentRows), [documentRows]);
  const legalAssets = useMemo(
    () => assetRows.filter((row) => row.deleted_at == null && row.archived_at == null && row.status !== "archived" && String(row.section_key ?? "") === "legal"),
    [assetRows],
  );
  const financeRecordCount = useMemo(() => getAssetsForBucket(assetRows, "finance").length, [assetRows]);
  const propertyRecordCount = useMemo(() => getAssetsForBucket(assetRows, "property").length, [assetRows]);
  const businessRecordCount = useMemo(() => getAssetsForBucket(assetRows, "business").length, [assetRows]);
  const digitalRecordCount = useMemo(() => getAssetsForBucket(assetRows, "digital").length, [assetRows]);
  const taskRecordCount = useMemo(() => getAssetsForBucket(assetRows, "tasks").length, [assetRows]);
  const legalRecordCount = legalAssets.length + legalDocuments.length;

  useEffect(() => {
    if (!devBankTraceEnabled) return;
    setDevBankTraceEntries(readDevBankTrace());
    return subscribeToDevBankTrace(() => {
      setDevBankTraceEntries(readDevBankTrace());
    });
  }, [devBankTraceEnabled]);

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
          if (!devSmokeMode) {
            router.replace("/sign-in");
            return;
          }
          applyDevSmokeDashboardState(devSmokeVariant, setAssetRows, setDocumentRows, setAttachmentRows, setCurrency, setContactRows);
          return;
        }
        const targetOwnerUserId = viewer.targetOwnerUserId || user.id;
        const wallet = await resolveWalletContextForRead(supabase, targetOwnerUserId);
        const [assetsRes, documentsRes, contactsRes, sectionEntriesRes, profileReadinessRes] = await Promise.all([
          fetchCanonicalAssets(supabase, { userId: targetOwnerUserId, walletId: wallet.walletId }),
          fetchDocuments(targetOwnerUserId, wallet.walletId),
          loadCanonicalContactsForOwner(supabase, targetOwnerUserId),
          fetchSectionEntries(targetOwnerUserId),
          fetchProfileReadiness(targetOwnerUserId),
        ]);
        if (!mounted) return;

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
        if (warnings.length > 0) {
          setStatus(`⚠️ ${warnings[0]}`);
        }

        const assets = filterAssetIdsForViewer((((assetsRes.data ?? []) as unknown) as AssetRow[]), viewer);
        const financeAssets = getAssetsForBucket(assets, "finance");
        setAssetRows(assets);
        appendDevBankTrace({
          kind: "dashboard-load",
          source: "DashboardPage.load",
          timestamp: new Date().toISOString(),
          userId: targetOwnerUserId,
          organisationId: wallet.organisationId,
          walletId: wallet.walletId,
          assetIds: financeAssets.map((row) => row.id),
          assetCategoryTokens: financeAssets.map((row) =>
            String((row.metadata_json ?? row.metadata ?? {})["asset_category_token"] ?? (row.metadata_json ?? row.metadata ?? {})["category_slug"] ?? ""),
          ),
          titles: financeAssets.map((row) =>
            String((row.metadata_json ?? row.metadata ?? {})["provider_name"] ?? row.provider_name ?? (row.metadata_json ?? row.metadata ?? {})["institution_name"] ?? row.title ?? "").trim(),
          ),
        });

        const firstCurrency =
          assets.find((row) => row.currency_code)?.currency_code ||
          inferFirstCurrencyFromMetadata(assets) ||
          "GBP";
        setCurrency(firstCurrency);

        const attachmentsRes = await fetchAttachments(targetOwnerUserId);
        if (attachmentsRes.error && !isMissingRelationError(attachmentsRes.error, "attachments")) {
          warnings.push("Attachment search results could not be fully loaded.");
        }
        if (sectionEntriesRes.error && !isMissingRelationError(sectionEntriesRes.error, "section_entries")) {
          warnings.push("Attachment parent records could not be fully resolved.");
        }

        const scopedSectionEntries = filterRecordIdsForViewer(((sectionEntriesRes.data ?? []) as SectionEntrySearchRow[]), viewer);
        const allowedAssetIds = new Set(assets.map((row) => row.id));
        const allowedRecordIds = new Set(scopedSectionEntries.map((row) => row.id));

        setDocumentRows(
          ((documentsRes.data ?? []) as DocumentRow[]).filter((row) => !row.asset_id || allowedAssetIds.has(String(row.asset_id))),
        );
        setAttachmentRows(
          filterRecordIdsForViewer(((attachmentsRes.data ?? []) as AttachmentRow[]), viewer),
        );
        setContactRows(viewer.mode === "linked" ? [] : ((contactsRes ?? []) as ContactDiscoveryRow[]));
        setSectionEntryRows(scopedSectionEntries.filter((row) => allowedRecordIds.has(String(row.id)) || allowedRecordIds.size === 0));
        setProfileReadiness(profileReadinessRes);

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
  }, [devSmokeMode, devSmokeVariant, router, refreshToken, viewer.accountHolderName, viewer.mode, viewer.targetOwnerUserId]);

  useEffect(() => {
    if (searchParams.get("created") !== "1") return;
    const category = searchParams.get("category") ?? "asset";
    const label = category.replace(/-/g, " ");
    const id = searchParams.get("createdId");
    setStatus(`✅ Asset created successfully (${label})${id ? ` · ID ${id}` : ""}.`);
  }, [searchParams]);

const financialSummary = useMemo(() => {
  return buildFinanceSummary(assetRows, {
    createdId: createdAssetId,
    currency,
    getHref: getFinanceWorkspaceHref,
  });
}, [assetRows, currency, createdAssetId]);
const legalSummary = useMemo(() => {
    const legalItems = [
      ...legalAssets.map((row) => ({
        id: `asset-${row.id}`,
        label: row.title || "Legal record",
        href: "/legal",
        meta: row.category_key || "Asset",
      })),
      ...legalDocuments.map((row) => ({
        id: row.id,
        label: row.title || row.document_type || "Legal document",
        href: "/legal",
        meta: row.document_type || "Document",
      })),
    ];
    return {
      addedAt: latestTimestamp([
        ...legalAssets.map((row) => row.updated_at ?? row.created_at),
        ...legalDocuments.map((row) => row.created_at),
      ]),
      valueText: legalItems.length ? `${legalItems.length}` : "No records yet",
      detailText: legalItems.length ? `${legalItems.length} legal record(s)` : "No records yet",
      items: legalItems.slice(0, 3),
    };
  }, [legalAssets, legalDocuments]);

  const propertySummary = useMemo(() => {
    return buildBucketSummary(getAssetsForBucket(assetRows, "property"), {
      createdId: createdAssetId,
      detailLabel: "property asset(s)",
      valueTextBuilder: (rows) => {
        const totalMajor = rows.reduce((sum, row) => sum + getAssetValueMajor(row), 0);
        return totalMajor > 0 ? formatCurrency(totalMajor, currency) : `${rows.length}`;
      },
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
      valueTextBuilder: (rows) => {
        const totalMajor = rows.reduce((sum, row) => sum + getAssetValueMajor(row), 0);
        return totalMajor > 0 ? formatCurrency(totalMajor, currency) : `${rows.length}`;
      },
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

  const latestCreateTrace = devBankTraceEntries.filter((entry) => entry.kind === "create").at(-1) ?? null;
  const latestDashboardTrace = devBankTraceEntries.filter((entry) => entry.kind === "dashboard-load").at(-1) ?? null;
  const latestBankLoadTrace = devBankTraceEntries.filter((entry) => entry.kind === "bank-load").at(-1) ?? null;
  const searchQuery = String(searchParams.get("search") ?? "").trim();
  const discoveryResults = useMemo(
    () =>
      buildDashboardDiscoveryResults({
        query: searchQuery,
        assets: assetRows,
        contacts: contactRows.map((row) => ({
          id: row.id,
          fullName: row.full_name ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
          contactRole: row.contact_role ?? null,
          relationship: row.relationship ?? null,
          linkedContext: row.linked_context ?? null,
        })),
        documents: documentRows.map((row) => ({
          id: row.id,
          title: row.title ?? null,
          fileName: row.file_name ?? row.title ?? null,
          parentLabel: resolveParentLabel(row.asset_id, assetRows, row.title ?? row.document_type ?? null),
          sectionKey: resolveDocumentSectionKey(row, assetRows),
          categoryKey: row.category_key ?? null,
          documentKind: row.document_kind ?? row.document_type ?? null,
        })),
        attachments: attachmentRows.map((row) => ({
          id: row.id,
          fileName: row.file_name ?? null,
          parentLabel: resolveSearchParentLabel(row.record_id, assetRows, sectionEntryRows, null),
          sectionKey: resolveAttachmentSectionKey(row, assetRows, sectionEntryRows),
          categoryKey: resolveAttachmentCategoryKey(row, assetRows, sectionEntryRows),
          mimeType: row.mime_type ?? null,
          metaLabel: resolveSearchParentLabel(row.record_id, assetRows, sectionEntryRows, null),
        })),
        assetHref: (asset) => getDiscoveryAssetHref(asset),
        assetIcon: (asset) => getDiscoveryAssetIcon(asset),
        contactHref: (contact) => `/contacts?contact=${contact.id}`,
        documentHref: (document) => getDiscoveryDocumentHref(document.sectionKey, document.categoryKey, document.parentLabel),
        attachmentHref: (attachment) => getDiscoveryAttachmentHref(attachment.sectionKey, attachment.categoryKey),
        extraLinks: DASHBOARD_SEARCH_LINKS,
      }),
    [assetRows, attachmentRows, contactRows, documentRows, searchQuery, sectionEntryRows],
  );
  const blockingState = useMemo(
    () =>
      deriveBlockingState(
        {
          profile: profileReadiness,
        } satisfies BlockingUserContext,
        {
          personal: { total: taskRecordCount },
          financial: { total: financeRecordCount },
          legal: { total: legalRecordCount },
          property: { total: propertyRecordCount },
          business: { total: businessRecordCount },
          digital: { total: digitalRecordCount },
          contacts: contactRows.map((contact) => ({
            id: contact.id,
            fullName: contact.full_name ?? null,
            email: contact.email ?? null,
            inviteStatus: contact.invite_status ?? null,
            verificationStatus: contact.verification_status ?? null,
          })),
        },
      ),
    [
      assetRows,
      businessRecordCount,
      contactRows,
      digitalRecordCount,
      financeRecordCount,
      legalRecordCount,
      profileReadiness,
      propertyRecordCount,
      taskRecordCount,
    ],
  );
  function handleAction(actionKey: string) {
    router.push(resolveWorkflowActionHref(actionKey));
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          border: "1px solid #f59e0b",
          borderRadius: 12,
          background: "#fffbeb",
          color: "#92400e",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.02em",
          padding: "10px 12px",
        }}
      >
        DASHBOARD BUILD CHECK - ACTION CENTRE V3
      </div>
      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#6b7280" }}>Loading dashboard summary...</div> : null}
      {searchQuery ? (
        <section style={searchResultsPanelStyle} aria-label="Search results">
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={overviewIconStyle}>
                <Icon name="search" size={16} />
              </div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Search results</h2>
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Results for <strong>{searchQuery}</strong> from your current estate records and key destinations.
            </div>
          </div>
          {discoveryResults.length === 0 ? (
            <div style={searchEmptyStateStyle}>No matching records, contacts, or sections found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {discoveryResults.map((result) => (
                <a key={result.id} href={result.href} style={searchResultStyle}>
                  <span style={searchResultIconStyle}>
                    <Icon name={result.icon} size={16} />
                  </span>
                  <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{result.label}</span>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{result.description || "Open this destination"}</span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      ) : null}
      {devBankTraceEnabled ? (
        <section
          style={{
            border: "1px dashed #f59e0b",
            borderRadius: 12,
            background: "#fff7ed",
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="bug_report" size={16} />
            <strong style={{ fontSize: 14 }}>DEV bank flow trace</strong>
          </div>
          <div style={{ fontSize: 12, color: "#7c2d12", display: "grid", gap: 6 }}>
            <div>
              Dashboard context: user <code>{latestDashboardTrace?.userId ?? "n/a"}</code> · organisation <code>{latestDashboardTrace?.organisationId ?? "n/a"}</code> · wallet <code>{latestDashboardTrace?.walletId ?? "n/a"}</code>
            </div>
            <div>
              Latest create: asset <code>{latestCreateTrace?.createdAssetId ?? "n/a"}</code> · wallet <code>{latestCreateTrace?.walletId ?? "n/a"}</code> · category <code>{latestCreateTrace?.categorySlug ?? latestCreateTrace?.assetCategoryToken ?? "n/a"}</code>
            </div>
            <div>
              Latest bank page load: wallet <code>{latestBankLoadTrace?.walletId ?? "n/a"}</code> · ids <code>{(latestBankLoadTrace?.assetIds ?? []).join(", ") || "none"}</code>
            </div>
            <div>
              Dashboard asset ids: <code>{(latestDashboardTrace?.assetIds ?? []).join(", ") || "none"}</code>
            </div>
          </div>
        </section>
      ) : null}
      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          background: "#fff",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={overviewIconStyle}>
              <Icon name="dashboard" size={16} />
            </div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Overview</h2>
          </div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Open the main areas of your estate record from one simplified overview.
        </div>
        </div>
        {showFinancialCard || showLegalCard || showPropertyCard || showBusinessCard || showDigitalCard || showTaskCard ? (
        <div className="lf-content-grid">
          {showFinancialCard ? (
            <DashboardAssetSummaryCard
              icon={<Icon name="account_balance" size={13} />}
              title="All finances"
              href="/finances"
              addedAt={financialSummary.addedAt}
              value={financialSummary.valueText}
              detail={`finance record${financeRecordCount === 1 ? "" : "s"}`}
              obscured={shouldObscureSection(viewerRole, "financial", viewerActivation)}
              inlineSummary
              hideItems
              actionLabel="Open finance records"
              actionIcon="open_in_new"
            />
          ) : null}

          {showLegalCard ? (
            <DashboardAssetSummaryCard
              icon={<Icon name="description" size={13} />}
              title="Legal"
              href="/legal"
              addedAt={legalSummary.addedAt}
              value={String(legalRecordCount)}
              detail={`legal record${legalRecordCount === 1 ? "" : "s"}`}
              obscured={shouldObscureSection(viewerRole, "legal", viewerActivation)}
              inlineSummary
              hideItems
              actionLabel="Open legal records"
              actionIcon="open_in_new"
            />
          ) : null}

          {showPropertyCard ? (
            <DashboardAssetSummaryCard
              icon={<Icon name="home" size={13} />}
              title="Property"
              href="/property"
              addedAt={propertySummary.addedAt}
              value={propertySummary.valueText}
              detail={`property record${propertyRecordCount === 1 ? "" : "s"}`}
              obscured={shouldObscureSection(viewerRole, "property", viewerActivation)}
              inlineSummary
              hideItems
              actionLabel="Open property records"
              actionIcon="open_in_new"
            />
          ) : null}

          {showBusinessCard ? (
            <DashboardAssetSummaryCard
              icon={<Icon name="business_center" size={13} />}
              title="Business"
              href="/business"
              addedAt={businessSummary.addedAt}
              value={businessSummary.valueText}
              detail={`business record${businessRecordCount === 1 ? "" : "s"}`}
              obscured={shouldObscureSection(viewerRole, "business", viewerActivation)}
              inlineSummary
              hideItems
              actionLabel="Open business records"
              actionIcon="open_in_new"
            />
          ) : null}

          {showDigitalCard ? (
            <DashboardAssetSummaryCard
              icon={<Icon name="devices" size={13} />}
              title="Digital"
              href="/vault/digital"
              addedAt={digitalSummary.addedAt}
              value={String(digitalRecordCount)}
              detail={`digital record${digitalRecordCount === 1 ? "" : "s"}`}
              obscured={shouldObscureSection(viewerRole, "digital", viewerActivation)}
              inlineSummary
              hideItems
              actionLabel="Open digital records"
              actionIcon="open_in_new"
            />
          ) : null}

          {showTaskCard ? (
            <DashboardAssetSummaryCard
              icon={<Icon name="task" size={13} />}
              title="Tasks"
              href="/personal/tasks"
              addedAt={taskSummary.addedAt}
              value={String(taskRecordCount)}
              detail={`task${taskRecordCount === 1 ? "" : "s"}`}
              inlineSummary
              hideItems
              actionLabel="Open tasks"
              actionIcon="open_in_new"
            />
          ) : null}
        </div>
        ) : (
          <div style={searchEmptyStateStyle}>
            Your dashboard overview is currently hidden by My Vault preferences. Re-enable categories or subsections in Account / My Vault at any time.
          </div>
        )}
      </section>

      <ActionQueuePanel items={blockingState} onAction={handleAction} />
    </div>
  );
}

async function fetchProfileReadiness(userId: string): Promise<ProfileReadinessRow> {
  const [profileRes, contactRes, addressRes] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("first_name,last_name,display_name")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("contact_details")
      .select("secondary_email,telephone,mobile_number")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("house_name_or_number,street_name,town,city,country,post_code")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const profile = ((profileRes.data ?? {}) as Record<string, unknown>);
  const contact = ((contactRes.data ?? {}) as Record<string, unknown>);
  const address = ((addressRes.data ?? {}) as Record<string, unknown>);

  return {
    hasProfile: Boolean(
      String(profile.first_name ?? "").trim() ||
      String(profile.last_name ?? "").trim() ||
      String(profile.display_name ?? "").trim(),
    ),
    hasContact: Boolean(
      String(contact.secondary_email ?? "").trim() ||
      String(contact.telephone ?? "").trim() ||
      String(contact.mobile_number ?? "").trim(),
    ),
    hasAddress: Boolean(
      String(address.house_name_or_number ?? "").trim() ||
      String(address.street_name ?? "").trim() ||
      String(address.town ?? "").trim() ||
      String(address.city ?? "").trim() ||
      String(address.country ?? "").trim() ||
      String(address.post_code ?? "").trim(),
    ),
  };
}

async function fetchDocuments(userId: string, walletId: string | null) {
  let query = supabase
    .from("documents")
    .select("*")
    .eq("owner_user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (walletId) query = query.eq("wallet_id", walletId);

  let response = await query;
  if (response.error && isMissingColumnError(response.error, "owner_user_id")) {
    response = await supabase
      .from("documents")
      .select("*")
      .eq("created_by", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!response.error && walletId) {
      response = await supabase
        .from("documents")
        .select("*")
        .eq("created_by", userId)
        .eq("wallet_id", walletId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
    }
  }

  return response;
}

async function fetchAttachments(userId: string) {
  return supabase
    .from("attachments")
    .select("id,record_id,owner_user_id,storage_bucket,storage_path,file_name,mime_type,created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
}

async function fetchSectionEntries(userId: string) {
  return supabase
    .from("section_entries")
    .select("id,title,section_key,category_key")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

function getFinanceWorkspaceHref(categoryKey: string) {
  if (categoryKey === "investments") return "/finances/investments";
  if (categoryKey === "pensions") return "/finances/pensions";
  if (categoryKey === "insurance") return "/finances/insurance";
  if (categoryKey === "debts" || categoryKey === "loans-liabilities") return "/finances/debts";
  return "/finances/bank";
}

function getAssetValueMajor(row: AssetRow) {
  return getDashboardAssetValueMajor(row);
}

function inferFirstCurrencyFromMetadata(rows: AssetRow[]) {
  for (const row of rows) {
    const metadata = row.metadata_json ?? row.metadata ?? {};
    const candidate = `${metadata["currency"] ?? metadata["currency_code"] ?? ""}`.trim().toUpperCase();
    if (candidate) return candidate;
  }
  return "";
}

function applyDevSmokeDashboardState(
  variant: "empty" | "fixture",
  setAssetRows: (rows: AssetRow[]) => void,
  setDocumentRows: (rows: DocumentRow[]) => void,
  setAttachmentRows: (rows: AttachmentRow[]) => void,
  setCurrency: (value: string) => void,
  setContactRows: (rows: ContactDiscoveryRow[]) => void,
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

  setAssetRows(fixtureAssets);
  setDocumentRows([]);
  setAttachmentRows([]);
  setCurrency("GBP");
  setContactRows([]);
}

const overviewIconStyle = {
  width: 28,
  height: 28,
  borderRadius: 10,
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} satisfies React.CSSProperties;

const searchResultsPanelStyle = {
  border: "1px solid #dbeafe",
  borderRadius: 16,
  background: "#f8fbff",
  padding: 16,
  display: "grid",
  gap: 12,
} satisfies CSSProperties;

const searchEmptyStateStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 14,
  color: "#64748b",
  background: "#fff",
} satisfies CSSProperties;

const searchResultStyle = {
  textDecoration: "none",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#fff",
  padding: 12,
  display: "flex",
  alignItems: "center",
  gap: 10,
} satisfies CSSProperties;

const searchResultIconStyle = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "#eff6ff",
  border: "1px solid #dbeafe",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#1d4ed8",
  flexShrink: 0,
} satisfies CSSProperties;

const DASHBOARD_SEARCH_LINKS = [
  {
    id: "contacts",
    label: "Contacts",
    description: "Open the shared contacts workspace.",
    href: "/contacts",
    icon: "contacts",
    keywords: ["people", "executors", "trustees", "advisors"],
  },
  {
    id: "profile",
    label: "Account details",
    description: "Update your account name, phone, and address details.",
    href: "/profile",
    icon: "account_circle",
    keywords: ["profile", "account", "phone", "avatar"],
  },
  {
    id: "legal-identity",
    label: "Identity documents",
    description: "Review legal identity documents and linked contacts.",
    href: "/legal/identity-documents",
    icon: "badge",
    keywords: ["passport", "driving licence", "identity"],
  },
  {
    id: "social-media",
    label: "Social media",
    description: "Open saved social media records.",
    href: "/personal/social-media",
    icon: "public",
    keywords: ["digital", "accounts", "social"],
  },
] satisfies Array<{
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  keywords: string[];
}>;

function getDiscoveryAssetHref(asset: AssetRow) {
  const section = String(asset.section_key ?? "").trim();
  if (section === "finances") return getFinanceWorkspaceHref(String(asset.category_key ?? ""));
  if (section === "legal") return getLegalWorkspaceHref(String(asset.category_key ?? ""));
  if (section === "property") return "/property";
  if (section === "business") return "/business";
  if (section === "digital") return "/vault/digital";
  if (section === "personal") return getPersonalWorkspaceHref(String(asset.category_key ?? ""));
  return "/dashboard";
}

function getDiscoveryAssetIcon(asset: AssetRow) {
  const section = String(asset.section_key ?? "").trim();
  if (section === "finances") return "account_balance";
  if (section === "legal") return "description";
  if (section === "property") return "home";
  if (section === "business") return "business_center";
  if (section === "digital") return "devices";
  if (section === "personal") return "inventory_2";
  return "description";
}

function resolveDocumentSectionKey(row: DocumentRow, assets: AssetRow[]) {
  const parent = findAssetById(row.asset_id, assets);
  if (parent?.section_key) return String(parent.section_key);
  if (row.category_key === "identity-documents" || row.document_type === "identity-document") return "legal";
  return row.category_key === "photo" ? "personal" : "legal";
}

function resolveAttachmentSectionKey(row: AttachmentRow, assets: AssetRow[], sectionEntries: SectionEntrySearchRow[]) {
  const parent = findSearchParentById(row.record_id, assets, sectionEntries);
  return String(parent?.section_key ?? "");
}

function resolveAttachmentCategoryKey(row: AttachmentRow, assets: AssetRow[], sectionEntries: SectionEntrySearchRow[]) {
  const parent = findSearchParentById(row.record_id, assets, sectionEntries);
  return String(parent?.category_key ?? "");
}

function findAssetById(assetId: string | null | undefined, assets: AssetRow[]) {
  return assets.find((row) => row.id === assetId) ?? null;
}

function findSectionEntryById(entryId: string | null | undefined, sectionEntries: SectionEntrySearchRow[]) {
  return sectionEntries.find((row) => row.id === entryId) ?? null;
}

function findSearchParentById(parentId: string | null | undefined, assets: AssetRow[], sectionEntries: SectionEntrySearchRow[]) {
  return findAssetById(parentId, assets) ?? findSectionEntryById(parentId, sectionEntries);
}

function resolveParentLabel(assetId: string | null | undefined, assets: AssetRow[], fallback: string | null) {
  const parent = findAssetById(assetId, assets);
  return String(parent?.title ?? parent?.provider_name ?? fallback ?? "").trim() || null;
}

function resolveSearchParentLabel(
  parentId: string | null | undefined,
  assets: AssetRow[],
  sectionEntries: SectionEntrySearchRow[],
  fallback: string | null,
) {
  const parent = findSearchParentById(parentId, assets, sectionEntries);
  const providerName = parent && "provider_name" in parent ? String(parent.provider_name ?? "").trim() : "";
  return String(parent?.title ?? providerName ?? fallback ?? "").trim() || null;
}

function getDiscoveryDocumentHref(
  sectionKey: string | null | undefined,
  categoryKey: string | null | undefined,
  parentLabel: string | null | undefined,
) {
  const normalizedSection = String(sectionKey ?? "").trim();
  if (normalizedSection === "personal") return getPersonalWorkspaceHref(String(categoryKey ?? ""));
  if (normalizedSection === "finances") return "/finances";
  if (normalizedSection === "legal") return getLegalWorkspaceHref(String(categoryKey ?? ""), parentLabel);
  if (normalizedSection === "property") return "/property";
  if (normalizedSection === "business") return "/business";
  if (normalizedSection === "digital") return "/vault/digital";
  return "/dashboard";
}

function getDiscoveryAttachmentHref(sectionKey: string | null | undefined, categoryKey: string | null | undefined) {
  const normalizedSection = String(sectionKey ?? "").trim();
  if (normalizedSection === "finances") return "/finances";
  if (normalizedSection === "legal") return getLegalWorkspaceHref(String(categoryKey ?? ""));
  if (normalizedSection === "property") return "/property";
  if (normalizedSection === "business") return "/business";
  if (normalizedSection === "digital") return "/vault/digital";
  if (normalizedSection === "personal") return getPersonalWorkspaceHref(String(categoryKey ?? ""));
  return "/dashboard";
}

function getLegalWorkspaceHref(categoryKey: string, parentLabel?: string | null) {
  const normalizedCategory = String(categoryKey ?? "").trim();
  if (normalizedCategory === "identity-documents") return "/legal/identity-documents";
  if (normalizedCategory === "power-of-attorney") return "/legal/power-of-attorney";
  if (normalizedCategory === "wills") return "/legal/wills";
  if (normalizedCategory === "death-certificate") return "/legal/death-certificate";
  if ((parentLabel ?? "").toLowerCase().includes("identity")) return "/legal/identity-documents";
  return "/legal";
}

function getPersonalWorkspaceHref(categoryKey: string) {
  const normalizedCategory = String(categoryKey ?? "").trim();
  if (normalizedCategory === "social-media") return "/personal/social-media";
  if (normalizedCategory === "tasks") return "/personal/tasks";
  return "/personal";
}
