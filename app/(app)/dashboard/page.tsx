"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardAssetSummaryCard from "../components/dashboard/DashboardAssetSummaryCard";
import ActionQueuePanel, { type ActionCentreContext, type ActionCentreTask } from "../components/dashboard/ActionQueuePanel";
import Icon from "../../../components/ui/Icon";
import InfoTip from "../../../components/ui/InfoTip";
import AttachmentGallery, { type AttachmentGalleryItem } from "../../../components/documents/AttachmentGallery";
import { FormField, NumberInput, TextInput } from "../../../components/forms/asset/AssetFormControls";
import { formatCurrency } from "../../../lib/currency";
import {
  buildFinanceSummary,
  buildBucketSummary,
  getDashboardAssetValueMajor,
  getAssetsForBucket,
  getDashboardAssetBucket,
  getLegalDocuments,
  latestTimestamp,
} from "../../../lib/dashboard/summary";
import { shouldObscureSection, type AccessActivationStatus, type CollaboratorRole } from "../../../lib/access-control/roles";
import { canViewPath, filterAssetIdsForViewer, filterRecordIdsForViewer } from "../../../lib/access-control/viewerAccess";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { isMissingColumnError, isMissingRelationError } from "../../../lib/supabaseErrors";
import { fetchCanonicalAssets } from "../../../lib/assets/fetchCanonicalAssets";
import { loadFinanceDashboardRows } from "../../../lib/dashboard/financeRows";
import { getStoredFileSignedUrl, isPrintableDocumentMimeType } from "../../../lib/assets/documentLinks";
import { createAsset } from "../../../lib/assets/createAsset";
import {
  loadCanonicalContactsForOwner,
  type CanonicalContactInviteStatus,
  type CanonicalContactVerificationStatus,
} from "../../../lib/contacts/canonicalContacts";
import { savePeopleContact } from "../../../lib/contacts/contactRepository";
import { getPlanLimitRedirectHref } from "../../../lib/accountPlan";
import { sendContactInvite } from "../../../lib/contacts/sendContactInvite";
import { loadProfileWorkspace, saveProfileWorkspace } from "../../../lib/profile/workspace";
import { buildDashboardDiscoveryResults } from "../../../lib/records/discovery";
import {
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
import { isVaultCategoryEnabled, isVaultSubsectionEnabled } from "../../../lib/vaultPreferences";
import {
  deriveBlockingState,
  resolveWorkflowActionHref,
  type BlockingItem,
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
  storage_bucket?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
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

type ContactDiscoveryRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_role?: string | null;
  relationship?: string | null;
  source_type?: string | null;
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

type DashboardReviewPanel = {
  key: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  icon: string;
  helperText?: string;
  tone?: "default" | "warning" | "success";
  readinessKey?: ExecutorLegalReadinessItemKey;
};

type ContactInviteDisplay = {
  label: "Send invite" | "Sending" | "Sent" | "Pending" | "Accepted" | "Failed" | "Plan limit reached" | "Resend invite";
  detail: string;
  href: string;
  ctaLabel: string;
  tone: "default" | "warning" | "success" | "danger";
  action: "send" | "resend" | "open" | "billing" | "disabled" | "status";
  icon: string;
};

type DashboardInviteOverride = "sending" | "sent" | "pending" | "failed" | "plan_limit";

type DashboardQuickActionKind = "profile" | "executor" | "next_of_kin" | "finance";

type QuickContactForm = {
  name: string;
  email: string;
  phone: string;
  relationship: string;
};

type QuickProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine: string;
  postCode: string;
};

type QuickFinanceForm = {
  name: string;
  value: string;
};

type VaultCompletenessStatus = "Complete" | "In progress" | "Not added yet";

type VaultCompletenessItem = {
  key: string;
  title: string;
  href: string;
  icon: string;
  status: VaultCompletenessStatus;
  missingItems: string[];
  nextAction: string;
  reviewDue: string | null;
  detail: string;
};

type DashboardDocumentItem = AttachmentGalleryItem & {
  source: "document" | "attachment";
  storageBucket: string;
  storagePath: string;
  linkedLabel: string;
  href: string;
  statusLabel: string;
};

type DashboardSetupStep = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  completed: boolean;
};

type DashboardInsightSignalType =
  | "missing_executor"
  | "missing_will"
  | "profile_incomplete"
  | "missing_financial_records"
  | "missing_documents"
  | "review_overdue";

type DashboardInsightSeverity = "critical" | "high" | "medium" | "low";

type DashboardInsightSignal = {
  type: DashboardInsightSignalType;
  severity: DashboardInsightSeverity;
  message: string;
  action: string;
  href: string;
};

type DashboardContactRole = "executor" | "next_of_kin" | "adviser" | "contact";
type DashboardContactStatus = "none" | "sent" | "pending" | "accepted" | "failed";
type DashboardContactActionKey = "send_invite" | "resend_invite" | "review_contact" | "review_billing";

type DashboardContactAction = {
  key: DashboardContactActionKey;
  label: string;
  kind: ContactInviteDisplay["action"];
  href: string;
  primary: boolean;
};

type DashboardContactRow = {
  id: string;
  name: string;
  role: DashboardContactRole;
  status: DashboardContactStatus;
  actions: DashboardContactAction[];
  invite: ContactInviteDisplay;
  source: ContactDiscoveryRow;
};

type DashboardDocumentCategoryKey = "will" | "id" | "financial" | "property";
type DashboardDocumentSignalSeverity = "high" | "medium" | "low" | "clear";

type DashboardDocumentCoverage = {
  categories: Record<DashboardDocumentCategoryKey, boolean>;
  missingCategories: DashboardDocumentCategoryKey[];
  signalMessage: string;
  signalSeverity: DashboardDocumentSignalSeverity;
  quickActions: Array<{
    key: "upload" | "view_all";
    label: string;
    href: string;
  }>;
};

type ExecutorLegalReadinessModel = {
  executorAssigned: boolean;
  executorAccepted: boolean;
  willPresent: boolean;
  willUploaded: boolean;
  willUploadReasonCode: "linked_current_will_file" | "legacy_will_file" | "will_record_without_file" | "no_will_record";
  keyDocumentsPresent: boolean;
  supportingLegalInfoPresent: boolean;
  powerOfAttorneyPresent: boolean;
  contactsComplete: boolean;
  identityVerified: boolean;
  lastReviewDate?: string;
};

type ExecutorLegalReadinessStatusLevel = "Not started" | "Incomplete" | "At risk" | "Ready";
type ExecutorLegalReadinessItemKey = keyof Omit<ExecutorLegalReadinessModel, "lastReviewDate"> | "reviewDetails";

type ExecutorLegalReadinessItem = {
  key: ExecutorLegalReadinessItemKey;
  label: string;
  complete: boolean;
  status: "Complete" | "Not yet added" | "Recommended";
  whyItMatters: string;
  nextAction: string;
  href: string;
};

type ExecutorLegalReadinessState = {
  model: ExecutorLegalReadinessModel;
  statusLevel: ExecutorLegalReadinessStatusLevel;
  explanation: string;
  checklistSummary: {
    executor: string;
    will: string;
    documents: string;
    contacts: string;
  };
  executorSummary: {
    name: string | null;
    inviteStatus: "not invited" | "invited" | "accepted";
    lastActivity: string | null;
  };
  documentSummary: {
    will: "Missing" | "Recorded" | "Uploaded";
    identityDocument: "Missing" | "Uploaded";
    financialOrPropertyDocuments: "Missing" | "Partial" | "Uploaded";
    supportingLegalInfo: "Not added" | "Recorded";
    powerOfAttorney: "Not added" | "Recorded";
  };
  items: ExecutorLegalReadinessItem[];
  completedCount: number;
  totalCount: number;
  statusSummary: string;
  nextAction: ExecutorLegalReadinessItem | null;
  reviewRecommended: boolean;
};

type DashboardStateInput = {
  assetRows: AssetRow[];
  documentRows: DocumentRow[];
  attachmentRows: AttachmentRow[];
  contactRows: ContactDiscoveryRow[];
  sectionEntryRows: SectionEntrySearchRow[];
  profileReadiness: ProfileReadinessRow;
  dashboardInviteState: Record<string, DashboardInviteOverride>;
  legalRecordCount: number;
  willRecordCount: number;
  bankRecordCount: number;
  financeRecordCount: number;
  propertyRecordCount: number;
  businessRecordCount: number;
  digitalRecordCount: number;
  possessionsRecordCount: number;
  tasks: ActionCentreTask[];
  executorContactCount: number;
  nextOfKinContactCount: number;
  loading: boolean;
  viewerMode: string;
};

type DashboardState = {
  contacts: {
    rows: DashboardContactRow[];
    inviteStatusCounts: ReturnType<typeof createInviteStatusCounts>;
    total: number;
  };
  documents: {
    items: DashboardDocumentItem[];
    storedCount: number;
    coverage: DashboardDocumentCoverage;
  };
  legalReadiness: ExecutorLegalReadinessState;
  completeness: {
    items: VaultCompletenessItem[];
    completedCategoryCount: number;
    attentionCategoryCount: number;
    statusSummary: string;
  };
  actions: {
    items: BlockingItem[];
    ownerBlockingActions: BlockingItem[];
    firstOwnerAction: BlockingItem | null;
    setupSteps: DashboardSetupStep[];
    completedSetupSteps: number;
    nextSetupStep: DashboardSetupStep | null;
    isFirstTimeOrNearEmpty: boolean;
    showSetupGuide: boolean;
    commandStatusSummary: string;
    primaryAction: DashboardReviewPanel;
    context: ActionCentreContext;
  };
  blockers: {
    items: BlockingItem[];
    critical: BlockingItem[];
  };
  priorities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  signals: DashboardInsightSignal[];
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
  const [reviewPanel, setReviewPanel] = useState<DashboardReviewPanel | null>(null);
  const [dashboardInviteState, setDashboardInviteState] = useState<Record<string, DashboardInviteOverride>>({});
  const [quickActionSaving, setQuickActionSaving] = useState(false);
  const [quickActionError, setQuickActionError] = useState("");
  const [quickContactForm, setQuickContactForm] = useState<QuickContactForm>({
    name: "",
    email: "",
    phone: "",
    relationship: "",
  });
  const [quickProfileForm, setQuickProfileForm] = useState<QuickProfileForm>({
    firstName: "",
    lastName: "",
    phone: "",
    addressLine: "",
    postCode: "",
  });
  const [quickFinanceForm, setQuickFinanceForm] = useState<QuickFinanceForm>({
    name: "",
    value: "",
  });
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
  const canViewPossessions = canViewPath("/vault/personal", viewer);
  const showFinancialCard = canViewFinancial && isVaultCategoryEnabled(preferences, "finances");
  const showLegalCard = canViewLegal && isVaultCategoryEnabled(preferences, "legal");
  const showPropertyCard = canViewProperty && isVaultCategoryEnabled(preferences, "property");
  const showBusinessCard = canViewBusiness && isVaultCategoryEnabled(preferences, "business");
  const showDigitalCard = canViewDigital && isVaultCategoryEnabled(preferences, "digital");
  const showPossessionsCard = canViewPossessions && isVaultSubsectionEnabled(preferences, "personal_possessions");
  const assetBuckets = useMemo(() => buildDashboardAssetBuckets(assetRows), [assetRows]);
  const legalDocuments = useMemo(() => getLegalDocuments(documentRows), [documentRows]);
  const legalAssets = useMemo(
    () => assetRows.filter((row) => row.deleted_at == null && row.archived_at == null && row.status !== "archived" && String(row.section_key ?? "") === "legal"),
    [assetRows],
  );
  const financeRecordCount = assetBuckets.finance.length;
  const bankRecordCount = useMemo(
    () => assetBuckets.finance.filter((row) => String(row.category_key ?? "").trim() === "bank").length,
    [assetBuckets.finance],
  );
  const propertyRecordCount = assetBuckets.property.length;
  const businessRecordCount = assetBuckets.business.length;
  const digitalRecordCount = assetBuckets.digital.length;
  const possessionsRows = assetBuckets.possessions;
  const possessionsRecordCount = possessionsRows.length;
  const legalRecordCount = legalAssets.length + legalDocuments.length;
  const willRecordCount = useMemo(
    () => legalAssets.filter(isWillAsset).length + legalDocuments.filter(isWillDocument).length,
    [legalAssets, legalDocuments],
  );
  const executorContactCount = useMemo(
    () => contactRows.filter(isExecutorContact).length + assetRows.filter(isExecutorAsset).length,
    [assetRows, contactRows],
  );
  const nextOfKinContactCount = useMemo(
    () => contactRows.filter(isNextOfKinContact).length,
    [contactRows],
  );

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
        const [assetsRes, financeRowsRes, documentsRes, contactsRes, sectionEntriesRes, profileReadinessRes] = await Promise.all([
          fetchCanonicalAssets(supabase, { userId: targetOwnerUserId, walletId: wallet.walletId }),
          loadFinanceDashboardRows(supabase, { userId: targetOwnerUserId, walletId: wallet.walletId }),
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
        if (financeRowsRes.error && !isMissingRelationError(financeRowsRes.error, "records")) {
          warnings.push("Finance summary could not be fully loaded.");
        }
        if (documentsRes.error && !isMissingRelationError(documentsRes.error, "documents")) {
          warnings.push("Document summary could not be fully loaded.");
        }
        if (warnings.length > 0) {
          setStatus(`⚠️ ${warnings[0]}`);
        }

        const canonicalAssets = (((assetsRes.data ?? []) as unknown) as AssetRow[]);
        const nonFinanceAssets = canonicalAssets.filter((row) => getDashboardAssetBucket(row) !== "finance");
        const mergedAssets = [...nonFinanceAssets, ...(((financeRowsRes.data ?? []) as unknown) as AssetRow[])];
        const assets = filterAssetIdsForViewer(mergedAssets, viewer);
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
  }, [devSmokeMode, devSmokeVariant, refreshToken, router, viewer]);

  useEffect(() => {
    if (searchParams.get("created") !== "1") return;
    const category = searchParams.get("category") ?? "asset";
    const label = category.replace(/-/g, " ");
    const id = searchParams.get("createdId");
    setStatus(`✅ Asset created successfully (${label})${id ? ` · ID ${id}` : ""}.`);
  }, [searchParams]);

  useEffect(() => {
    if (!reviewPanel) {
      setQuickActionError("");
      return;
    }
    setQuickActionError("");
    const kind = getDashboardQuickActionKind(reviewPanel);
    if (kind === "executor") {
      setQuickContactForm({ name: "", email: "", phone: "", relationship: "Executor" });
    } else if (kind === "next_of_kin") {
      setQuickContactForm({ name: "", email: "", phone: "", relationship: "Next of kin" });
    } else if (kind === "finance") {
      setQuickFinanceForm({ name: "", value: "" });
    } else if (kind === "profile") {
      setQuickProfileForm((current) => ({
        ...current,
        firstName: current.firstName,
        lastName: current.lastName,
        phone: current.phone,
        addressLine: current.addressLine,
        postCode: current.postCode,
      }));
    }
  }, [reviewPanel]);

const financialSummary = useMemo(() => {
  return buildFinanceSummary(assetBuckets.finance, {
    createdId: createdAssetId,
    currency,
    getHref: getFinanceWorkspaceHref,
  });
}, [assetBuckets.finance, currency, createdAssetId]);
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
    return buildBucketSummary(assetBuckets.property, {
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
  }, [assetBuckets.property, currency, createdAssetId]);

  const businessSummary = useMemo(() => {
    return buildBucketSummary(assetBuckets.business, {
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
  }, [assetBuckets.business, currency, createdAssetId]);

  const digitalSummary = useMemo(() => {
    return buildBucketSummary(assetBuckets.digital, {
      createdId: createdAssetId,
      detailLabel: "digital asset(s)",
      itemBuilder: (row) => ({
        id: row.id,
        label: row.title || "Digital asset",
        href: "/vault/digital",
        meta: "Digital",
      }),
    });
  }, [assetBuckets.digital, createdAssetId]);

  const possessionsSummary = useMemo(() => {
    return buildBucketSummary(possessionsRows, {
      createdId: createdAssetId,
      detailLabel: "possession record(s)",
      itemBuilder: (row) => ({
        id: row.id,
        label: row.title || "Possession",
        href: "/vault/personal",
        meta: String((row.metadata_json ?? row.metadata ?? {})["category"] ?? "Personal"),
      }),
    });
  }, [createdAssetId, possessionsRows]);

  const actionCentreTasks = useMemo<ActionCentreTask[]>(
    () =>
      assetBuckets.tasks.map((row) => {
        const metadata = row.metadata_json ?? row.metadata ?? {};
        const taskStatus = String(metadata["task_status"] ?? metadata["status"] ?? "not_started");
        return {
          id: row.id,
          title: row.title || String(metadata["task_title"] ?? "Untitled task"),
          status: taskStatus,
          type: resolveDashboardTaskType(metadata),
          href: "/personal/tasks",
          relatedEntity: String(metadata["related_asset_label"] ?? metadata["related_record_label"] ?? metadata["instruction_reference"] ?? "").trim() || undefined,
          createdAt: row.created_at,
          dueDate: String(metadata["due_date"] ?? "") || null,
          description: String(metadata["description"] ?? metadata["notes"] ?? ""),
        };
      }),
    [assetBuckets.tasks],
  );

  const latestCreateTrace = devBankTraceEntries.filter((entry) => entry.kind === "create").at(-1) ?? null;
  const latestDashboardTrace = devBankTraceEntries.filter((entry) => entry.kind === "dashboard-load").at(-1) ?? null;
  const latestBankLoadTrace = devBankTraceEntries.filter((entry) => entry.kind === "bank-load").at(-1) ?? null;
  const searchQuery = String(searchParams.get("search") ?? "").trim();
  const discoveryResults = useMemo(
    () => {
      if (!searchQuery) return [];
      return buildDashboardDiscoveryResults({
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
      });
    },
    [assetRows, attachmentRows, contactRows, documentRows, searchQuery, sectionEntryRows],
  );
  const dashboardState = useDashboardState({
    assetRows,
    documentRows,
    attachmentRows,
    contactRows,
    sectionEntryRows,
    profileReadiness,
    dashboardInviteState,
    legalRecordCount,
    willRecordCount,
    bankRecordCount,
    financeRecordCount,
    propertyRecordCount,
    businessRecordCount,
    digitalRecordCount,
    possessionsRecordCount,
    tasks: actionCentreTasks,
    executorContactCount,
    nextOfKinContactCount,
    loading,
    viewerMode: viewer.mode,
  });
  const requiredReadinessTasks = dashboardState.legalReadiness.items.filter((item) => !item.complete);

  const markDashboardTaskComplete = useCallback(async (taskId: string) => {
    const task = assetRows.find((row) => row.id === taskId && String(row.category_key ?? "") === "tasks");
    if (!task) {
      setStatus("⚠️ Could not find that task.");
      return;
    }

    try {
      const metadata = { ...(task.metadata_json ?? task.metadata ?? {}) };
      metadata["task_status"] = "completed";
      metadata["completion_date"] = new Date().toISOString().slice(0, 10);
      const updateRes = await supabase
        .from("assets")
        .update({ metadata_json: metadata, updated_at: new Date().toISOString() })
        .eq("id", taskId);
      if (updateRes.error) {
        setStatus(`⚠️ Could not complete task: ${updateRes.error.message}`);
        return;
      }
      setAssetRows((current) =>
        current.map((row) =>
          row.id === taskId
            ? { ...row, metadata_json: metadata, metadata, updated_at: new Date().toISOString() }
            : row,
        ),
      );
      setStatus("✅ Task marked complete.");
    } catch (error) {
      setStatus(`⚠️ Could not complete task: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [assetRows]);

  const handleAction = useCallback((actionKey: string) => {
    if (actionKey.startsWith("task:complete:")) {
      void markDashboardTaskComplete(actionKey.replace("task:complete:", ""));
      return;
    }
    if (actionKey.startsWith("task:open:")) {
      router.push("/personal/tasks");
      return;
    }
    if (actionKey === "dashboard:add-executor") {
      setReviewPanel({
        key: actionKey,
        title: "Add executor",
        description: "Add the person who should be recognised as executor for your estate records.",
        href: "/contacts?group=executors",
        ctaLabel: "Open Contacts",
        icon: "supervisor_account",
        helperText: "This creates a basic executor record. You can add detailed permissions and invite status from Contacts.",
        tone: "warning",
      });
      return;
    }
    if (actionKey === "dashboard:upload-document") {
      setReviewPanel({
        key: actionKey,
        title: "Upload key document",
        description: "Document uploads stay in the document workspace so files use the shared preview and attachment controls.",
        href: "/property/documents",
        ctaLabel: "Upload document",
        icon: "upload_file",
        helperText: "Upload documents from the document area so each file can be linked to the right record.",
        tone: "warning",
      });
      return;
    }
    if (actionKey === "dashboard:review-will") {
      setReviewPanel({
        key: actionKey,
        title: "Review will information",
        description: "Add will information or upload the will document so trusted people can find the record when needed.",
        href: "/legal/wills",
        ctaLabel: "Open Legal",
        icon: "gavel",
        helperText: "Legacy Fortress records whether will information exists. It does not validate legal authenticity.",
        tone: "warning",
        readinessKey: "willUploaded",
      });
      return;
    }
    const item = dashboardState.actions.items.find((candidate) => candidate.actionKey === actionKey);
    if (!item) {
      setReviewPanel(buildReviewPanelFromAction(actionKey, "Review action", "Open the relevant section to continue."));
      return;
    }
    setReviewPanel(buildReviewPanelFromAction(item.actionKey, item.stageName, item.blockerLabel));
  }, [dashboardState.actions.items, markDashboardTaskComplete, router]);

  async function handleDashboardInviteAction(contact: ContactDiscoveryRow, invite: ContactInviteDisplay) {
    if (invite.action === "disabled" || invite.action === "status") {
      return;
    }
    if (invite.action === "billing") {
      router.push(invite.href);
      return;
    }
    if (invite.action === "open") {
      router.push(invite.href);
      return;
    }
    await sendDashboardContactInvite(contact, invite.action === "resend");
  }

  async function sendDashboardContactInvite(contact: ContactDiscoveryRow, resend = false) {
    const contactName = contact.full_name || contact.email || "this contact";
    if (!contact.email) {
      router.push(`/contacts?contact=${contact.id}`);
      return;
    }

    setDashboardInviteState((current) => ({ ...current, [contact.id]: "sending" }));
    setStatus("");

    try {
      const user = await waitForActiveUser(supabase);
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      const assignedRole = normalizeDashboardContactRole(contact.contact_role);
      await sendContactInvite(supabase, {
        ownerUserId: user.id,
        ownerEmail: user.email ?? null,
        contactId: contact.id,
        contactName: contact.full_name || contact.email,
        contactEmail: contact.email,
        contactPhone: contact.phone ?? null,
        contactRelationship: contact.relationship ?? null,
        assignedRole,
        activationStatus: "invited",
        resend,
        origin: typeof window !== "undefined" ? window.location.origin : null,
      });

      setDashboardInviteState((current) => ({ ...current, [contact.id]: "sent" }));
      setContactRows((current) =>
        current.map((row) =>
          row.id === contact.id
            ? { ...row, invite_status: "invite_sent", verification_status: row.verification_status === "not_verified" ? "invited" : row.verification_status }
            : row,
        ),
      );
      setStatus(`✅ Invitation ${resend ? "resent" : "sent"} to ${contactName}.`);
      window.setTimeout(() => {
        setDashboardInviteState((current) => ({ ...current, [contact.id]: "pending" }));
      }, 1800);
    } catch (error) {
      const planHref = getPlanLimitRedirectHref(error);
      if (planHref) {
        setDashboardInviteState((current) => ({ ...current, [contact.id]: "plan_limit" }));
        setStatus(`⚠️ ${error instanceof Error ? error.message : "Starter plan limit reached."}`);
        return;
      }
      setDashboardInviteState((current) => ({ ...current, [contact.id]: "failed" }));
      setStatus(`⚠️ Could not ${resend ? "resend" : "send"} invitation to ${contactName}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function saveQuickProfile() {
    const firstName = quickProfileForm.firstName.trim();
    const lastName = quickProfileForm.lastName.trim();
    if (!firstName || !lastName) {
      setQuickActionError("First name and last name are required.");
      return;
    }

    setQuickActionSaving(true);
    setQuickActionError("");
    try {
      const user = await waitForActiveUser(supabase);
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      const loaded = await loadProfileWorkspace(supabase, {
        userId: user.id,
        baseEmail: user.email ?? "",
      });
      const nextForm = {
        ...loaded.form,
        first_name: firstName,
        last_name: lastName,
        display_name: loaded.form.display_name || [firstName, lastName].filter(Boolean).join(" "),
        telephone: quickProfileForm.phone.trim() || loaded.form.telephone,
        mobile_number: quickProfileForm.phone.trim() || loaded.form.mobile_number,
        house_name_or_number: quickProfileForm.addressLine.trim() || loaded.form.house_name_or_number,
        post_code: quickProfileForm.postCode.trim() || loaded.form.post_code,
      };
      await saveProfileWorkspace(supabase, {
        userId: user.id,
        form: nextForm,
        support: loaded.support,
      });
      window.dispatchEvent(new CustomEvent("lf-profile-updated"));
      setProfileReadiness({
        hasProfile: true,
        hasContact: Boolean(nextForm.telephone.trim() || nextForm.mobile_number.trim()),
        hasAddress: Boolean(nextForm.house_name_or_number.trim() || nextForm.post_code.trim()),
      });
      setStatus("✅ Profile basics saved.");
      setReviewPanel(null);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      setQuickActionError(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setQuickActionSaving(false);
    }
  }

  async function saveQuickExecutor() {
    await saveQuickContact("executor");
  }

  async function saveQuickNextOfKin() {
    await saveQuickContact("next_of_kin");
  }

  async function saveQuickContact(kind: "executor" | "next_of_kin") {
    const name = quickContactForm.name.trim();
    const email = quickContactForm.email.trim().toLowerCase();
    const phone = quickContactForm.phone.trim();
    const relationship = quickContactForm.relationship.trim() || (kind === "executor" ? "Executor" : "Next of kin");
    if (!name) {
      setQuickActionError("Name is required.");
      return;
    }

    setQuickActionSaving(true);
    setQuickActionError("");
    try {
      const user = await waitForActiveUser(supabase);
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      if (kind === "executor") {
        await savePeopleContact(supabase, {
          ownerUserId: user.id,
          fullName: name,
          email: email || null,
          phone: phone || null,
          relationship,
          contactRole: "executor",
          sourceType: "manual",
          inviteStatus: "not_invited",
          verificationStatus: "not_verified",
        });
      } else {
        await savePeopleContact(supabase, {
          ownerUserId: user.id,
          fullName: name,
          email: email || null,
          phone: phone || null,
          relationship,
          contactRole: "friend_or_family",
          sourceType: "next_of_kin",
          inviteStatus: "not_invited",
          verificationStatus: "not_verified",
        });
      }

      setStatus(`✅ ${kind === "executor" ? "Executor" : "Next of kin"} saved.`);
      setReviewPanel(null);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      setQuickActionError(error instanceof Error ? error.message : "Contact could not be saved.");
    } finally {
      setQuickActionSaving(false);
    }
  }

  async function saveQuickFinanceRecord() {
    const name = quickFinanceForm.name.trim();
    const value = quickFinanceForm.value.trim();
    if (!name) {
      setQuickActionError("Record name is required.");
      return;
    }
    const numericValue = value ? Number(value) : 0;
    if (value && !Number.isFinite(numericValue)) {
      setQuickActionError("Value must be a valid number.");
      return;
    }

    setQuickActionSaving(true);
    setQuickActionError("");
    try {
      const user = await waitForActiveUser(supabase);
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      await createAsset(supabase, {
        userId: user.id,
        categorySlug: "bank-accounts",
        title: name,
        metadata: {
          title: name,
          provider_name: name,
          institution_name: name,
          dashboard_quick_record: true,
          account_type: "Account",
          country: "GB",
          country_code: "GB",
          currency: currency || "GBP",
          currency_code: currency || "GBP",
          current_balance: numericValue,
          value_major: numericValue,
          notes: "Added from the dashboard quick action. Add account details from Finances when ready.",
        },
        visibility: "private",
      });
      setStatus("✅ Financial record saved.");
      setReviewPanel(null);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      setQuickActionError(error instanceof Error ? error.message : "Financial record could not be saved.");
    } finally {
      setQuickActionSaving(false);
    }
  }

  async function resolveDashboardDocumentUrl(item: DashboardDocumentItem) {
    return getStoredFileSignedUrl(supabase, {
      storageBucket: item.storageBucket,
      storagePath: item.storagePath,
      expiresInSeconds: 120,
    });
  }

  async function downloadDashboardDocument(item: DashboardDocumentItem) {
    const signedUrl = await resolveDashboardDocumentUrl(item);
    if (!signedUrl) {
      setStatus(`⚠️ Could not download ${item.fileName || "this file"}.`);
      return;
    }

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        setStatus(`⚠️ Could not download file: ${response.status} ${response.statusText}`);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = item.fileName || "document";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (error) {
      setStatus(`⚠️ Could not download file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function printDashboardDocument(item: DashboardDocumentItem) {
    if (!isPrintableDocumentMimeType(item.mimeType)) {
      setStatus("Print is available for PDF and image files only.");
      return;
    }

    const signedUrl = await resolveDashboardDocumentUrl(item);
    if (!signedUrl) {
      setStatus(`⚠️ Could not print ${item.fileName || "this file"}.`);
      return;
    }

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        setStatus(`⚠️ Could not prepare file for print: ${response.status} ${response.statusText}`);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      document.body.appendChild(printFrame);
      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } finally {
          setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            printFrame.remove();
          }, 10_000);
        }
      };
      printFrame.src = objectUrl;
    } catch (error) {
      setStatus(`⚠️ Could not print file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  function renderQuickActionForm(panel: DashboardReviewPanel) {
    const readinessPanel = renderReadinessActionPanel(panel);
    if (readinessPanel) return readinessPanel;

    const kind = getDashboardQuickActionKind(panel);
    if (!kind || viewer.mode === "linked") return null;

    if (kind === "profile") {
      return (
        <form style={quickFormStyle} onSubmit={(event) => { event.preventDefault(); void saveQuickProfile(); }}>
          <div style={quickFormGridStyle}>
            <FormField label="First name" iconName="badge" required error={quickActionError && !quickProfileForm.firstName.trim() ? "Required" : ""}>
              <TextInput value={quickProfileForm.firstName} onChange={(value) => setQuickProfileForm((current) => ({ ...current, firstName: value }))} placeholder="e.g. Ivan" disabled={quickActionSaving} />
            </FormField>
            <FormField label="Last name" iconName="badge" required error={quickActionError && !quickProfileForm.lastName.trim() ? "Required" : ""}>
              <TextInput value={quickProfileForm.lastName} onChange={(value) => setQuickProfileForm((current) => ({ ...current, lastName: value }))} placeholder="e.g. Smith" disabled={quickActionSaving} />
            </FormField>
            <FormField label="Phone" iconName="call" helpText="Optional, but useful for trusted people.">
              <TextInput value={quickProfileForm.phone} onChange={(value) => setQuickProfileForm((current) => ({ ...current, phone: value }))} placeholder="e.g. +44 7700 900123" disabled={quickActionSaving} />
            </FormField>
            <FormField label="Address line" iconName="home" helpText="A short address line is enough here.">
              <TextInput value={quickProfileForm.addressLine} onChange={(value) => setQuickProfileForm((current) => ({ ...current, addressLine: value }))} placeholder="House name or number" disabled={quickActionSaving} />
            </FormField>
            <FormField label="Postcode" iconName="location_on">
              <TextInput value={quickProfileForm.postCode} onChange={(value) => setQuickProfileForm((current) => ({ ...current, postCode: value }))} placeholder="e.g. SW1A 1AA" disabled={quickActionSaving} />
            </FormField>
          </div>
          <QuickFormActions saving={quickActionSaving} error={quickActionError} primaryLabel="Save profile basics" secondaryLabel={panel.ctaLabel} onSecondary={() => router.push(panel.href)} />
        </form>
      );
    }

    if (kind === "executor" || kind === "next_of_kin") {
      return (
        <form style={quickFormStyle} onSubmit={(event) => { event.preventDefault(); void (kind === "executor" ? saveQuickExecutor() : saveQuickNextOfKin()); }}>
          <div style={quickFormGridStyle}>
            <FormField label={kind === "executor" ? "Executor name" : "Next of kin name"} iconName="person" required error={quickActionError && !quickContactForm.name.trim() ? "Required" : ""}>
              <TextInput value={quickContactForm.name} onChange={(value) => setQuickContactForm((current) => ({ ...current, name: value }))} placeholder="Full name" disabled={quickActionSaving} />
            </FormField>
            <FormField label="Email" iconName="mail" helpText="Optional here. You can send the invite later from Contacts.">
              <TextInput value={quickContactForm.email} onChange={(value) => setQuickContactForm((current) => ({ ...current, email: value }))} placeholder="name@example.com" disabled={quickActionSaving} />
            </FormField>
            <FormField label="Phone" iconName="call">
              <TextInput value={quickContactForm.phone} onChange={(value) => setQuickContactForm((current) => ({ ...current, phone: value }))} placeholder="Optional phone number" disabled={quickActionSaving} />
            </FormField>
            <FormField label="Relationship" iconName="diversity_3" helpText={kind === "executor" ? "Used to identify the person, not to grant access automatically." : "This helps your family recognise the contact."}>
              <TextInput value={quickContactForm.relationship} onChange={(value) => setQuickContactForm((current) => ({ ...current, relationship: value }))} placeholder={kind === "executor" ? "Executor" : "Next of kin"} disabled={quickActionSaving} />
            </FormField>
          </div>
          <QuickFormActions saving={quickActionSaving} error={quickActionError} primaryLabel={kind === "executor" ? "Save executor" : "Save next of kin"} secondaryLabel="Open Contacts" onSecondary={() => router.push("/contacts")} />
        </form>
      );
    }

    return (
      <form style={quickFormStyle} onSubmit={(event) => { event.preventDefault(); void saveQuickFinanceRecord(); }}>
        <div style={quickFormGridStyle}>
          <FormField label="Record name" iconName="account_balance" required error={quickActionError && !quickFinanceForm.name.trim() ? "Required" : ""} helpText="Add a basic record now, then complete the full details in Finances when ready.">
            <TextInput value={quickFinanceForm.name} onChange={(value) => setQuickFinanceForm((current) => ({ ...current, name: value }))} placeholder="e.g. Main current account" disabled={quickActionSaving} />
          </FormField>
          <FormField label={`Estimated value (${currency || "GBP"})`} iconName="payments">
            <NumberInput value={quickFinanceForm.value} onChange={(value) => setQuickFinanceForm((current) => ({ ...current, value }))} placeholder="0" disabled={quickActionSaving} />
          </FormField>
        </div>
        <QuickFormActions saving={quickActionSaving} error={quickActionError} primaryLabel="Save financial record" secondaryLabel="Open Finances" onSecondary={() => router.push("/finances")} />
      </form>
    );
  }

  function renderReadinessActionPanel(panel: DashboardReviewPanel) {
    if (!panel.readinessKey) return null;

    if (panel.readinessKey === "executorAssigned" || panel.readinessKey === "executorAccepted") {
      const executorRows = dashboardState.contacts.rows.filter((row) => row.role === "executor");
      return (
        <div style={readinessActionPanelStyle}>
          <div style={readinessPanelHeaderStyle}>
            <span style={readinessItemIconStyle(Boolean(dashboardState.legalReadiness.executorSummary.name))}>
              <Icon name="supervisor_account" size={16} />
            </span>
            <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <strong style={{ color: "#1f1712" }}>Executor details</strong>
              <span style={{ color: "#64748b", fontSize: 13 }}>
                {dashboardState.legalReadiness.executorSummary.name ?? "No executor added yet"} · Invite {dashboardState.legalReadiness.executorSummary.inviteStatus}
              </span>
            </span>
          </div>

          {executorRows.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {executorRows.map((contactRow) => (
                <div key={contactRow.id} style={miniStatusRowStyle}>
                  <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 13, color: "#1f2937" }}>{contactRow.name}</strong>
                    <span style={{ color: "#64748b", fontSize: 12 }}>
                      {formatDashboardContactStatus(contactRow.status)} · {contactRow.invite.detail}
                    </span>
                  </span>
                  {contactRow.actions.length ? (
                    <button
                      type="button"
                      style={statusBadgeStyle(contactRow.invite.tone, contactRow.actions[0]?.kind === "disabled" ? "disabled" : "button")}
                      disabled={contactRow.actions[0]?.kind === "disabled"}
                      onClick={() => void handleDashboardInviteAction(contactRow.source, contactRow.invite)}
                      aria-label={`${contactRow.actions[0]?.label ?? contactRow.invite.ctaLabel} for ${contactRow.name}`}
                    >
                      <Icon name={contactRow.invite.icon} size={13} />
                      {contactRow.actions[0]?.label ?? contactRow.invite.label}
                    </button>
                  ) : (
                    <span style={statusBadgeStyle(contactRow.invite.tone, "status")}>
                      <Icon name={contactRow.invite.icon} size={13} />
                      {formatDashboardContactStatus(contactRow.status)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : renderQuickActionForm({ ...panel, readinessKey: undefined, title: "Add executor", description: "Add the person who should be recognised as executor for your estate records." })}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={ghostCommandButtonStyle} onClick={() => router.push("/contacts?group=executors")}>
              Full contact management
              <Icon name="arrow_forward" size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (["willPresent", "willUploaded", "keyDocumentsPresent", "identityVerified"].includes(panel.readinessKey)) {
      return (
        <div style={readinessActionPanelStyle}>
          <div style={readinessPanelHeaderStyle}>
            <span style={readinessItemIconStyle(dashboardState.documents.storedCount > 0)}>
              <Icon name="folder_open" size={16} />
            </span>
            <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <strong style={{ color: "#1f1712" }}>Document readiness</strong>
              <span style={{ color: "#64748b", fontSize: 13 }}>
                Will: {dashboardState.legalReadiness.documentSummary.will} · ID: {dashboardState.legalReadiness.documentSummary.identityDocument} · Financial/property: {dashboardState.legalReadiness.documentSummary.financialOrPropertyDocuments} · Wishes: {dashboardState.legalReadiness.documentSummary.supportingLegalInfo}
              </span>
            </span>
          </div>
          <div style={readinessUploadGridStyle}>
            <ReadinessUploadAction label="Upload will" detail="Store the will document or add will information." href="/legal/wills" />
            <ReadinessUploadAction label="Upload identity document" detail="Add an ID document in the identity document workspace." href="/identity-documents" />
            <ReadinessUploadAction label="Upload financial/property document" detail="Attach supporting files from the document workspace. Multiple files are supported there." href="/property/documents" />
          </div>
          {dashboardState.documents.items.length ? (
            <AttachmentGallery
              items={dashboardState.documents.items}
              emptyText="No documents are available from your current vault access."
              onResolvePreviewUrl={(item) => resolveDashboardDocumentUrl(item)}
              onDownload={(item) => void downloadDashboardDocument(item)}
              onPrint={(item) => void printDashboardDocument(item)}
              onOpenRelated={(item) => router.push(item.href)}
              openRelatedLabel="Go to linked record"
            />
          ) : (
            <div style={compactEmptyStateStyle}>No supporting documents uploaded yet. Open the document workspace to add one or more files without forcing structured entry.</div>
          )}
        </div>
      );
    }

    if (panel.readinessKey === "contactsComplete") {
      return (
        <div style={readinessActionPanelStyle}>
          <div style={trustCueStyle}>Complete contacts by recording both an executor and next of kin. Invitations and permissions stay in the full Contacts workspace.</div>
          {renderQuickActionForm({ ...panel, readinessKey: undefined, title: "Add next of kin", description: "Add one trusted person so family and access decisions are easier to review later." })}
        </div>
      );
    }

    return (
      <div style={readinessActionPanelStyle}>
        <div style={readinessSnapshotGridStyle}>
          <ReadinessSnapshot label="Status" value={dashboardState.legalReadiness.statusLevel} />
          <ReadinessSnapshot label="Last reviewed" value={dashboardState.legalReadiness.model.lastReviewDate ?? "Not reviewed yet"} />
          <ReadinessSnapshot label="Review" value={dashboardState.legalReadiness.reviewRecommended ? "Review recommended" : "Up to date"} />
        </div>
        <div style={readinessGridStyle}>
          {dashboardState.legalReadiness.items.map((item) => (
            <div key={item.key} style={readinessItemStyle(item.complete)}>
              <span style={readinessItemIconStyle(item.complete)}>
                <Icon name={item.complete ? "check" : "add"} size={16} />
              </span>
              <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <strong style={{ color: "#1f1712" }}>{item.label}</strong>
                <span style={{ color: "#64748b", fontSize: 12 }}>{item.status}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={trustCueStyle}>Mark reviewed is not stored separately yet. This panel uses the latest saved record or document update as the review date.</div>
      </div>
    );
  }

  return (
    <div className="lf-dashboard-shell" style={{ display: "grid", gap: 14 }}>
      {status ? (
        isPlanLimitStatus(status) ? (
          <button
            type="button"
            style={planLimitStatusButtonStyle}
            onClick={() => router.push("/account/billing?reason=plan-limit")}
            aria-label={`${stripStatusPrefix(status)} Open subscription and billing.`}
          >
            <Icon name="credit_card" size={16} />
            <span>{stripStatusPrefix(status)}</span>
            <strong>Review subscription</strong>
          </button>
        ) : (
          <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div>
        )
      ) : null}
      {loading ? <div style={{ color: "#6b7280" }}>Loading dashboard summary...</div> : null}
      {searchQuery ? (
        <section style={searchResultsPanelStyle} aria-label="Dashboard search results">
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={overviewIconStyle}>
                <Icon name="search" size={16} />
              </div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Dashboard search results</h2>
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Results for <strong>{searchQuery}</strong> from your dashboard records, linked documents, contacts, and key destinations.
            </div>
            <button type="button" onClick={() => router.push("/dashboard")} style={searchResetButtonStyle}>
              Clear dashboard search
            </button>
          </div>
          {discoveryResults.length === 0 ? (
            <div style={searchEmptyStateStyle}>No dashboard records, contacts, documents, or destinations match this search. Clear the search to return to the full dashboard.</div>
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
        className="lf-dashboard-overview-panel"
        style={{
          border: "1px solid #e8e1dc",
          borderRadius: 16,
          background: "#fff",
          padding: 18,
          display: "grid",
          gap: 12,
        }}
      >
        <div className="lf-dashboard-overview-heading" style={{ display: "grid", gap: 4 }}>
          <div className="lf-dashboard-overview-title-row" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
            <div style={overviewIconStyle}>
              <Icon name="dashboard" size={16} />
            </div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Overview</h2>
            <InfoTip
              className="lf-panel-help"
              label="Explain dashboard overview"
              title="Dashboard overview"
              message="These cards summarise the main areas of your vault. Open a card to review or add records in that section."
            />
          </div>
        <div className="lf-dashboard-overview-copy" style={{ color: "#64748b", fontSize: 13 }}>
          Review the main areas of your secure legacy vault.
        </div>
        </div>
        {showFinancialCard || showLegalCard || showPropertyCard || showBusinessCard || showDigitalCard || showPossessionsCard ? (
        <div className="lf-content-grid lf-dashboard-overview-grid">
          {showFinancialCard ? (
            <DashboardAssetSummaryCard
              icon={<Icon name="account_balance" size={22} />}
              title="All finances"
              href="/finances"
              addedAt={financialSummary.addedAt}
              value={String(financeRecordCount)}
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
              icon={<Icon name="description" size={22} />}
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
              icon={<Icon name="home" size={22} />}
              title="Property"
              href="/property"
              addedAt={propertySummary.addedAt}
              value={String(propertyRecordCount)}
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
              icon={<Icon name="business_center" size={22} />}
              title="Business"
              href="/business"
              addedAt={businessSummary.addedAt}
              value={String(businessRecordCount)}
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
              icon={<Icon name="devices" size={22} />}
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

          {showPossessionsCard ? (
            <DashboardAssetSummaryCard
              icon={<Icon name="inventory_2" size={22} />}
              title="Possessions"
              href="/vault/personal"
              addedAt={possessionsSummary.addedAt}
              value={String(possessionsRecordCount)}
              detail={`possession record${possessionsRecordCount === 1 ? "" : "s"}`}
              inlineSummary
              hideItems
              actionLabel="Open possessions"
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

      <ActionQueuePanel items={dashboardState.actions.items} context={dashboardState.actions.context} onAction={handleAction} />
      <section className="lf-dashboard-readiness-summary" style={readinessPanelStyle} aria-label="Estate readiness summary">
        <div className="lf-dashboard-readiness-heading" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
          <div style={overviewIconStyle}>
            <Icon name="verified_user" size={16} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Estate Readiness</h2>
          <span style={readinessStatusBadgeStyle(dashboardState.legalReadiness.statusLevel)}>{dashboardState.legalReadiness.statusLevel}</span>
          <span style={setupProgressPillStyle}>{dashboardState.legalReadiness.statusSummary}</span>
          <InfoTip
            className="lf-panel-help"
            label="Explain estate readiness"
            title="Estate readiness"
            tone="security"
            message="This is a practical checklist for executors and trusted people. It highlights missing records, contacts, and documents without giving legal advice."
          />
        </div>
        <button
          className="lf-dashboard-readiness-card"
          type="button"
          style={readinessSummaryCardStyle(dashboardState.legalReadiness.statusLevel)}
          onClick={() => {
            if (dashboardState.legalReadiness.nextAction) {
              router.push(dashboardState.legalReadiness.nextAction.href);
              return;
            }
            setReviewPanel({
              key: "readiness-review",
              title: "Review estate readiness",
              description: dashboardState.legalReadiness.explanation,
              href: "/legal",
              ctaLabel: "Open Legal",
              icon: "verified_user",
              helperText: "The full readiness checklist opens here as a focused dashboard panel when you need it.",
              tone: dashboardState.legalReadiness.statusLevel === "Ready" ? "success" : "default",
              readinessKey: "reviewDetails",
            });
          }}
          aria-label={
            dashboardState.legalReadiness.nextAction
              ? `Open required readiness task: ${dashboardState.legalReadiness.nextAction.nextAction}`
              : "Open estate readiness review panel"
          }
        >
          <span style={commandIconStyle(dashboardState.legalReadiness.statusLevel === "Ready" ? "success" : "warning")}>
            <Icon name={dashboardState.legalReadiness.statusLevel === "Ready" ? "task_alt" : "assignment_late"} size={18} />
          </span>
          <span style={{ display: "grid", gap: 3, minWidth: 0, textAlign: "left" }}>
            <strong style={{ color: "#1f1712" }}>
              {dashboardState.legalReadiness.completedCount} of {dashboardState.legalReadiness.totalCount} readiness checks complete
            </strong>
            <span style={{ color: "#64748b", fontSize: 13 }}>
              {dashboardState.legalReadiness.nextAction
                ? `Next: ${dashboardState.legalReadiness.nextAction.nextAction}`
                : "Core executor and legal readiness checks are complete."}
            </span>
          </span>
          <Icon name="arrow_forward" size={16} />
        </button>
        {requiredReadinessTasks.length ? (
          <div className="lf-dashboard-readiness-task-list" style={readinessTaskListStyle} aria-label="Required estate readiness tasks">
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Required tasks</div>
            {requiredReadinessTasks.slice(0, 4).map((item) => (
              <button
                key={item.key}
                className="lf-dashboard-readiness-task"
                type="button"
                style={readinessTaskButtonStyle}
                onClick={() => router.push(item.href)}
                aria-label={`Open task: ${item.nextAction}`}
              >
                <span style={readinessItemIconStyle(false)}>
                  <Icon name={item.key === "reviewDetails" ? "event_repeat" : "assignment_late"} size={15} />
                </span>
                <span style={{ display: "grid", gap: 2, minWidth: 0, textAlign: "left" }}>
                  <strong style={{ color: "#1f1712", fontSize: 13 }}>{item.label}</strong>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{item.nextAction}</span>
                </span>
                <span style={statusBadgeStyle("warning", "button")}>Open task</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
      {reviewPanel ? (
        <section className="lf-dashboard-review-panel" style={reviewPanelStyle(reviewPanel.tone)} aria-live="polite" aria-label="Dashboard review panel">
          <div style={commandCardHeaderStyle}>
            <span style={commandIconStyle(reviewPanel.tone)}>
              <Icon name={reviewPanel.icon} size={18} />
            </span>
            <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <span style={commandEyebrowStyle}>Why this matters</span>
              <strong style={{ color: "#1f1712" }}>{reviewPanel.title}</strong>
            </span>
          </div>
          <p style={commandDescriptionStyle}>{reviewPanel.description}</p>
          {reviewPanel.helperText ? <div style={trustCueStyle}>{reviewPanel.helperText}</div> : null}
          {renderQuickActionForm(reviewPanel) ?? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={primaryCommandButtonStyle} onClick={() => router.push(reviewPanel.href)}>
                {reviewPanel.ctaLabel}
                <Icon name="arrow_forward" size={16} />
              </button>
              <button type="button" style={ghostCommandButtonStyle} onClick={() => setReviewPanel(null)}>
                Close
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ReadinessSnapshot({ label, value }: { label: string; value: string }) {
  return (
    <div style={readinessSnapshotStyle}>
      <span style={commandEyebrowStyle}>{label}</span>
      <strong style={{ color: "#1f1712", fontSize: 14 }}>{value}</strong>
    </div>
  );
}

function ReadinessUploadAction({ label, detail, href }: { label: string; detail: string; href: string }) {
  return (
    <a href={href} style={readinessUploadActionStyle}>
      <span style={readinessItemIconStyle(false)}>
        <Icon name="upload_file" size={16} />
      </span>
      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <strong style={{ color: "#1f1712" }}>{label}</strong>
        <span style={{ color: "#64748b", fontSize: 12 }}>{detail}</span>
      </span>
      <Icon name="arrow_forward" size={15} />
    </a>
  );
}

function useDashboardState(input: DashboardStateInput): DashboardState {
  const storedDocumentCount = useMemo(
    () => countStoredDashboardDocuments(input.documentRows, input.attachmentRows),
    [input.attachmentRows, input.documentRows],
  );

  const blockingState = useMemo(
    () =>
      filterConsumerDashboardBlockers(deriveBlockingState(
        {
          profile: input.profileReadiness,
        } satisfies BlockingUserContext,
        {
          personal: { total: input.possessionsRecordCount + input.contactRows.length },
          financial: { total: input.financeRecordCount },
          legal: { total: input.legalRecordCount },
          property: { total: input.propertyRecordCount },
          business: { total: input.businessRecordCount },
          digital: { total: input.digitalRecordCount },
          contacts: input.contactRows.map((contact) => ({
            id: contact.id,
            fullName: contact.full_name ?? null,
            email: contact.email ?? null,
            inviteStatus: contact.invite_status ?? null,
            verificationStatus: contact.verification_status ?? null,
          })),
        },
      )),
    [
      input.businessRecordCount,
      input.contactRows,
      input.digitalRecordCount,
      input.financeRecordCount,
      input.legalRecordCount,
      input.possessionsRecordCount,
      input.profileReadiness,
      input.propertyRecordCount,
    ],
  );

  const dashboardDocumentItems = useMemo<DashboardDocumentItem[]>(
    () => buildDashboardDocumentItems({
      documentRows: input.documentRows,
      attachmentRows: input.attachmentRows,
      assetRows: input.assetRows,
      sectionEntryRows: input.sectionEntryRows,
    }),
    [input.assetRows, input.attachmentRows, input.documentRows, input.sectionEntryRows],
  );

  const normalizedContactRows = useMemo(
    () => normalizeDashboardContactRows(input.contactRows, input.dashboardInviteState),
    [input.contactRows, input.dashboardInviteState],
  );

  const inviteStatusCounts = useMemo(
    () => createInviteStatusCounts(input.contactRows, input.dashboardInviteState),
    [input.contactRows, input.dashboardInviteState],
  );

  const documentCoverage = useMemo(
    () => buildDashboardDocumentCoverage(dashboardDocumentItems),
    [dashboardDocumentItems],
  );

  const legalReadiness = useMemo(
    () => buildExecutorLegalReadinessState({
      assetRows: input.assetRows,
      documentRows: input.documentRows,
      attachmentRows: input.attachmentRows,
      contactRows: input.contactRows,
      dashboardInviteState: input.dashboardInviteState,
      profileReadiness: input.profileReadiness,
      executorContactCount: input.executorContactCount,
      nextOfKinContactCount: input.nextOfKinContactCount,
      willRecordCount: input.willRecordCount,
      documentItems: dashboardDocumentItems,
      documentCoverage,
    }),
    [
      dashboardDocumentItems,
      documentCoverage,
      input.assetRows,
      input.attachmentRows,
      input.contactRows,
      input.dashboardInviteState,
      input.documentRows,
      input.executorContactCount,
      input.nextOfKinContactCount,
      input.profileReadiness,
      input.willRecordCount,
    ],
  );

  const setupSteps = useMemo<DashboardSetupStep[]>(
    () => [
      {
        key: "profile",
        label: "Complete your profile",
        description: "Help trusted people confirm who you are and how to reach you.",
        href: "/profile",
        icon: "account_circle",
        completed: input.profileReadiness.hasProfile && input.profileReadiness.hasContact && input.profileReadiness.hasAddress,
      },
      {
        key: "bank",
        label: "Add a bank account",
        description: "Start your financial record with the account people are most likely to need first.",
        href: "/finances/bank",
        icon: "account_balance",
        completed: input.bankRecordCount > 0,
      },
      {
        key: "contact",
        label: "Add a personal contact",
        description: "Name someone important so roles and access stay clear.",
        href: "/contacts",
        icon: "contacts",
        completed: input.contactRows.length > 0,
      },
      {
        key: "document",
        label: "Upload an important document",
        description: "Attach a key file so supporting evidence is easy to find later.",
        href: "/property/documents",
        icon: "upload_file",
        completed: storedDocumentCount > 0,
      },
    ],
    [input.bankRecordCount, input.contactRows.length, input.profileReadiness, storedDocumentCount],
  );

  const vaultCompletenessItems = useMemo(
    () =>
      buildVaultCompletenessItems({
        profileReadiness: input.profileReadiness,
        possessionsRecordCount: input.possessionsRecordCount,
        legalRecordCount: input.legalRecordCount,
        willRecordCount: input.willRecordCount,
        financeRecordCount: input.financeRecordCount,
        bankRecordCount: input.bankRecordCount,
        propertyRecordCount: input.propertyRecordCount,
        businessRecordCount: input.businessRecordCount,
        storedDocumentCount,
        contactCount: input.contactRows.length,
        executorContactCount: input.executorContactCount,
        nextOfKinContactCount: input.nextOfKinContactCount,
        assetRows: input.assetRows,
        documentRows: input.documentRows,
        attachmentRows: input.attachmentRows,
      }),
    [
      input.assetRows,
      input.attachmentRows,
      input.bankRecordCount,
      input.businessRecordCount,
      input.contactRows.length,
      input.documentRows,
      input.executorContactCount,
      input.financeRecordCount,
      input.legalRecordCount,
      input.nextOfKinContactCount,
      input.possessionsRecordCount,
      input.profileReadiness,
      input.propertyRecordCount,
      input.willRecordCount,
      storedDocumentCount,
    ],
  );

  return useMemo(() => {
    const completedSetupSteps = setupSteps.filter((step) => step.completed).length;
    const nextSetupStep = setupSteps.find((step) => !step.completed) ?? null;
    const hasPersonalRecords = input.possessionsRecordCount > 0 || input.contactRows.length > 0;
    const isFirstTimeOrNearEmpty =
      !input.profileReadiness.hasProfile &&
      !input.profileReadiness.hasContact &&
      !input.profileReadiness.hasAddress &&
      !hasPersonalRecords &&
      input.financeRecordCount === 0;
    const showSetupGuide = input.viewerMode !== "linked" && !input.loading && completedSetupSteps < setupSteps.length;
    const ownerBlockingActions = blockingState.filter((item) => item.isBlocking && item.requiredRole === "owner");
    const firstOwnerAction = ownerBlockingActions[0] ?? null;
    const completedVaultCategoryCount = vaultCompletenessItems.filter((item) => item.status === "Complete").length;
    const attentionVaultCategoryCount = vaultCompletenessItems.filter((item) => item.status === "Not added yet").length;
    const vaultStatusSummary = attentionVaultCategoryCount > 0
      ? `${attentionVaultCategoryCount} category${attentionVaultCategoryCount === 1 ? "" : "ies"} not added yet`
      : `${completedVaultCategoryCount} of ${vaultCompletenessItems.length} categories complete`;
    const criticalBlockers = blockingState.filter((item) => item.isBlocking && getDashboardPriorityBand(item.priority) === "critical");
    const priorities = blockingState.reduce(
      (counts, item) => {
        if (!item.isBlocking) return counts;
        const band = getDashboardPriorityBand(item.priority);
        counts[band] += 1;
        return counts;
      },
      { critical: 0, high: 0, medium: 0, low: 0 },
    );
    const signals = buildDashboardInsightSignals({
      profileReadiness: input.profileReadiness,
      financeRecordCount: input.financeRecordCount,
      executorContactCount: input.executorContactCount,
      willRecordCount: input.willRecordCount,
      storedDocumentCount,
      completenessItems: vaultCompletenessItems,
    });
    const primaryAction = nextSetupStep
      ? {
          key: `setup-${nextSetupStep.key}`,
          title: nextSetupStep.label,
          description: nextSetupStep.description,
          href: nextSetupStep.href,
          ctaLabel: nextSetupStep.label,
          icon: nextSetupStep.icon,
          helperText: "This is the quickest way to make your vault more complete.",
        }
      : firstOwnerAction
        ? buildReviewPanelFromAction(firstOwnerAction.actionKey, firstOwnerAction.stageName, firstOwnerAction.blockerLabel)
        : {
            key: "review-vault",
            title: "Review your vault",
            description: "Everything essential looks up to date. Open a section to review details or add more records.",
            href: "/profile",
            ctaLabel: "Review profile",
            icon: "verified_user",
            helperText: "You can update your records anytime.",
            tone: "success" as const,
          };

    return {
      contacts: {
        rows: normalizedContactRows,
        inviteStatusCounts,
        total: normalizedContactRows.length,
      },
      documents: {
        items: dashboardDocumentItems,
        storedCount: storedDocumentCount,
        coverage: documentCoverage,
      },
      legalReadiness: {
        ...legalReadiness,
      },
      completeness: {
        items: vaultCompletenessItems,
        completedCategoryCount: completedVaultCategoryCount,
        attentionCategoryCount: attentionVaultCategoryCount,
        statusSummary: vaultStatusSummary,
      },
      actions: {
        items: blockingState,
        ownerBlockingActions,
        firstOwnerAction,
        setupSteps,
        completedSetupSteps,
        nextSetupStep,
        isFirstTimeOrNearEmpty,
        showSetupGuide,
        commandStatusSummary: `${completedSetupSteps} of ${setupSteps.length} setup steps complete`,
        primaryAction,
        context: {
          hasExecutor: input.executorContactCount > 0,
          contactCount: input.contactRows.length,
          documentCount: storedDocumentCount,
          profileIncomplete: !(input.profileReadiness.hasProfile && input.profileReadiness.hasContact && input.profileReadiness.hasAddress),
          tasks: input.tasks,
          estateReadiness: {
            executorAssigned: legalReadiness.model.executorAssigned,
            willUploaded: legalReadiness.model.willUploaded,
            keyDocumentsPresent: legalReadiness.model.keyDocumentsPresent,
          },
        },
      },
      blockers: {
        items: blockingState.filter((item) => item.isBlocking),
        critical: criticalBlockers,
      },
      priorities,
      signals,
    };
  }, [
    blockingState,
    dashboardDocumentItems,
    documentCoverage,
    input.contactRows,
    input.executorContactCount,
    input.financeRecordCount,
    input.loading,
    input.possessionsRecordCount,
    input.profileReadiness,
    input.tasks,
    input.viewerMode,
    input.willRecordCount,
    inviteStatusCounts,
    legalReadiness,
    normalizedContactRows,
    setupSteps,
    storedDocumentCount,
    vaultCompletenessItems,
  ]);
}

function createInviteStatusCounts(
  contacts: ContactDiscoveryRow[],
  dashboardInviteState: Record<string, DashboardInviteOverride>,
) {
  const counts = { send: 0, sent: 0, pending: 0, accepted: 0, failed: 0, planLimit: 0 };
  contacts.forEach((contact) => {
    const invite = getContactInviteDisplay(contact, dashboardInviteState[contact.id]);
    if (invite.label === "Send invite") counts.send += 1;
    if (invite.label === "Sent") counts.sent += 1;
    if (invite.label === "Pending") counts.pending += 1;
    if (invite.label === "Accepted") counts.accepted += 1;
    if (invite.label === "Failed") counts.failed += 1;
    if (invite.label === "Plan limit reached") counts.planLimit += 1;
  });
  return counts;
}

function filterConsumerDashboardBlockers(items: BlockingItem[]) {
  return items.filter((item) => item.requiredRole !== "admin" && !item.href.startsWith("/internal/"));
}

function normalizeDashboardContactRows(
  contacts: ContactDiscoveryRow[],
  dashboardInviteState: Record<string, DashboardInviteOverride>,
): DashboardContactRow[] {
  return contacts.map((contact) => {
    const invite = getContactInviteDisplay(contact, dashboardInviteState[contact.id]);
    return {
      id: contact.id,
      name: contact.full_name || contact.email || contact.phone || "Trusted contact",
      role: normalizeDashboardContactRowRole(contact),
      status: normalizeDashboardContactRowStatus(invite),
      actions: buildDashboardContactActions(invite),
      invite,
      source: contact,
    };
  });
}

function normalizeDashboardContactRowRole(contact: ContactDiscoveryRow): DashboardContactRole {
  const roleText = [
    contact.contact_role,
    contact.relationship,
    contact.source_type,
    ...(contact.linked_context ?? []).flatMap((context) => [context.role, context.category_key, context.label]),
  ].map((value) => String(value ?? "").toLowerCase().replace(/[_-]+/g, " ")).join(" ");
  if (roleText.includes("executor")) return "executor";
  if (roleText.includes("next of kin")) return "next_of_kin";
  if (roleText.includes("adviser") || roleText.includes("advisor") || roleText.includes("accountant") || roleText.includes("lawyer") || roleText.includes("solicitor")) return "adviser";
  return "contact";
}

function normalizeDashboardContactRowStatus(invite: ContactInviteDisplay): DashboardContactStatus {
  if (invite.label === "Accepted") return "accepted";
  if (invite.label === "Pending" || invite.action === "resend") return "pending";
  if (invite.label === "Sent") return "sent";
  if (invite.label === "Failed" || invite.label === "Plan limit reached") return "failed";
  return "none";
}

function buildDashboardContactActions(invite: ContactInviteDisplay): DashboardContactAction[] {
  if (invite.action === "status" || invite.action === "disabled") return [];
  if (invite.action === "send") {
    return [{ key: "send_invite", label: "Send invite", kind: invite.action, href: invite.href, primary: true }];
  }
  if (invite.action === "resend") {
    return [{ key: "resend_invite", label: "Resend invite", kind: invite.action, href: invite.href, primary: true }];
  }
  if (invite.action === "billing") {
    return [{ key: "review_billing", label: "Review billing", kind: invite.action, href: invite.href, primary: true }];
  }
  return [{ key: "review_contact", label: invite.ctaLabel || "Review contact", kind: invite.action, href: invite.href, primary: true }];
}

function formatDashboardContactStatus(status: DashboardContactStatus) {
  if (status === "none") return "Not invited";
  if (status === "sent") return "Sent";
  if (status === "pending") return "Pending";
  if (status === "accepted") return "Accepted";
  return "Failed";
}

function getDashboardPriorityBand(priority: number): keyof DashboardState["priorities"] {
  if (priority <= 25) return "critical";
  if (priority <= 45) return "high";
  if (priority <= 70) return "medium";
  return "low";
}

function buildDashboardInsightSignals({
  profileReadiness,
  financeRecordCount,
  executorContactCount,
  willRecordCount,
  storedDocumentCount,
  completenessItems,
}: {
  profileReadiness: ProfileReadinessRow;
  financeRecordCount: number;
  executorContactCount: number;
  willRecordCount: number;
  storedDocumentCount: number;
  completenessItems: VaultCompletenessItem[];
}): DashboardInsightSignal[] {
  const signals: DashboardInsightSignal[] = [];
  const profileIncomplete = !(profileReadiness.hasProfile && profileReadiness.hasContact && profileReadiness.hasAddress);

  if (executorContactCount === 0) {
    signals.push({
      type: "missing_executor",
      severity: "critical",
      message: "You have not added an executor",
      action: "add_executor",
      href: "/contacts?group=executors",
    });
  }

  if (willRecordCount === 0) {
    signals.push({
      type: "missing_will",
      severity: "critical",
      message: "No will has been uploaded",
      action: "upload_will",
      href: "/legal/wills",
    });
  }

  if (profileIncomplete) {
    signals.push({
      type: "profile_incomplete",
      severity: "medium",
      message: "Your profile is incomplete",
      action: "complete_profile",
      href: "/profile",
    });
  }

  if (financeRecordCount === 0) {
    signals.push({
      type: "missing_financial_records",
      severity: "high",
      message: "No financial records have been added",
      action: "add_financial_record",
      href: "/finances",
    });
  }

  if (storedDocumentCount === 0) {
    signals.push({
      type: "missing_documents",
      severity: "high",
      message: "No documents have been uploaded",
      action: "upload_document",
      href: "/property/documents",
    });
  }

  const overdueReview = completenessItems.find((item) => isDashboardReviewOverdue(item.reviewDue));
  if (overdueReview) {
    signals.push({
      type: "review_overdue",
      severity: "medium",
      message: `${overdueReview.title} review is overdue`,
      action: "review_section",
      href: overdueReview.href,
    });
  }

  return signals.sort((left, right) => getDashboardSignalSeverityRank(left.severity) - getDashboardSignalSeverityRank(right.severity));
}

function getDashboardSignalSeverityRank(severity: DashboardInsightSeverity) {
  if (severity === "critical") return 0;
  if (severity === "high") return 1;
  if (severity === "medium") return 2;
  return 3;
}

function isDashboardReviewOverdue(reviewDue: string | null) {
  if (!reviewDue) return false;
  const timestamp = Date.parse(reviewDue);
  return Number.isFinite(timestamp) && timestamp < Date.now();
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

function buildDashboardAssetBuckets(rows: AssetRow[]) {
  const activeRows = rows.filter((row) => row.deleted_at == null && row.archived_at == null && row.status !== "archived");
  const finance = getAssetsForBucket(activeRows, "finance");
  const property = getAssetsForBucket(activeRows, "property");
  const business = getAssetsForBucket(activeRows, "business");
  const digital = getAssetsForBucket(activeRows, "digital");
  const tasks = getAssetsForBucket(activeRows, "tasks");
  const possessions = activeRows.filter((row) => {
    const sectionKey = String(row.section_key ?? "").trim().toLowerCase();
    const categoryKey = String(row.category_key ?? "").trim().toLowerCase();
    return sectionKey === "personal" && categoryKey !== "executors" && categoryKey !== "beneficiaries" && categoryKey !== "tasks";
  });

  return {
    finance,
    property,
    business,
    digital,
    tasks,
    possessions,
  };
}

function countStoredDashboardDocuments(documentRows: DocumentRow[], attachmentRows: AttachmentRow[]) {
  return (
    documentRows.filter((row) => String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim()).length
    + attachmentRows.filter((row) => String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim()).length
  );
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

function buildReviewPanelFromAction(actionKey: string, stageName: string, blockerLabel: string): DashboardReviewPanel {
  const href = resolveWorkflowActionHref(actionKey);
  const lowerLabel = blockerLabel.toLowerCase();
  const isInviteIssue = lowerLabel.includes("invite") || lowerLabel.includes("invitation");
  const needsBilling = lowerLabel.includes("plan") || lowerLabel.includes("limit") || lowerLabel.includes("failed");

  if (needsBilling) {
    return {
      key: actionKey,
      title: stageName,
      description: blockerLabel,
      href: "/account/billing?reason=invite-status",
      ctaLabel: "Review subscription",
      icon: "credit_card",
      helperText: "Plan-limited or failed invitation states are handled in billing so access stays controlled.",
      tone: "warning",
    };
  }

  if (isInviteIssue) {
    return {
      key: actionKey,
      title: stageName,
      description: blockerLabel,
      href,
      ctaLabel: "Open contacts",
      icon: "contacts",
      helperText: "You can review the contact first, then send or resend the invite from Contacts.",
      tone: "default",
    };
  }

  return {
    key: actionKey,
    title: stageName,
    description: blockerLabel,
    href,
    ctaLabel: "Open section",
    icon: "assignment",
    helperText: "Review the context here, then continue only if it looks right.",
    tone: "default",
  };
}

function getDashboardQuickActionKind(panel: DashboardReviewPanel): DashboardQuickActionKind | null {
  if (panel.readinessKey && ["willPresent", "willUploaded", "keyDocumentsPresent", "identityVerified", "reviewDetails"].includes(panel.readinessKey)) return null;
  const text = [panel.key, panel.title, panel.description, panel.ctaLabel, panel.href, panel.helperText]
    .join(" ")
    .toLowerCase();
  if (text.includes("executor")) return "executor";
  if (text.includes("next of kin") || text.includes("next_of_kin") || text.includes("next-of-kin")) return "next_of_kin";
  if (panel.href.startsWith("/profile") || text.includes("profile")) return "profile";
  if (panel.href.startsWith("/finances") || text.includes("financial record") || text.includes("finances")) return "finance";
  return null;
}

function QuickFormActions({
  saving,
  error,
  primaryLabel,
  secondaryLabel,
  onSecondary,
}: {
  saving: boolean;
  error: string;
  primaryLabel: string;
  secondaryLabel: string;
  onSecondary: () => void;
}) {
  return (
    <div style={quickFormActionWrapStyle}>
      {error ? <div style={quickFormErrorStyle} role="alert">{error}</div> : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" style={primaryCommandButtonStyle} disabled={saving}>
          {saving ? "Saving..." : primaryLabel}
          <Icon name="check" size={16} />
        </button>
        <button type="button" style={ghostCommandButtonStyle} onClick={onSecondary} disabled={saving}>
          {secondaryLabel}
          <Icon name="arrow_forward" size={16} />
        </button>
      </div>
    </div>
  );
}

function getContactInviteDisplay(contact: ContactDiscoveryRow, override?: DashboardInviteOverride): ContactInviteDisplay {
  if (override === "sending") {
    return {
      label: "Sending",
      detail: "Sending the invite now.",
      href: `/contacts?contact=${contact.id}`,
      ctaLabel: "Sending invite",
      tone: "default",
      action: "disabled",
      icon: "hourglass_top",
    };
  }
  if (override === "sent") {
    return {
      label: "Sent",
      detail: "Invite sent. Waiting for the contact to respond.",
      href: `/contacts?contact=${contact.id}`,
      ctaLabel: "Review invitation",
      tone: "warning",
      action: "status",
      icon: "mark_email_read",
    };
  }
  if (override === "pending") {
    return {
      label: "Pending",
      detail: "Waiting for the contact to respond.",
      href: `/contacts?contact=${contact.id}`,
      ctaLabel: "Review invitation",
      tone: "warning",
      action: "resend",
      icon: "schedule",
    };
  }
  if (override === "plan_limit") {
    return {
      label: "Plan limit reached",
      detail: "Your current plan needs review before more invites can be sent.",
      href: "/account/billing?reason=invite-status",
      ctaLabel: "Review subscription",
      tone: "danger",
      action: "billing",
      icon: "credit_card",
    };
  }
  if (override === "failed") {
    return {
      label: "Failed",
      detail: "Invite could not be sent. Review the contact details before trying again.",
      href: `/contacts?contact=${contact.id}`,
      ctaLabel: "Review contact",
      tone: "danger",
      action: "open",
      icon: "error",
    };
  }

  const normalizedStatus = String(contact.invite_status ?? "").trim().toLowerCase();
  const verificationStatus = String(contact.verification_status ?? "").trim().toLowerCase();
  const contactHref = `/contacts?contact=${contact.id}`;

  if (
    normalizedStatus.includes("accepted") ||
    normalizedStatus.includes("activated") ||
    normalizedStatus.includes("verified") ||
    verificationStatus.includes("verified")
  ) {
    return {
      label: "Accepted",
      detail: "Access invitation accepted.",
      href: contactHref,
      ctaLabel: "Review contact",
      tone: "success",
      action: "status",
      icon: "verified",
    };
  }

  if (
    normalizedStatus.includes("limit") ||
    normalizedStatus.includes("blocked")
  ) {
    return {
      label: "Plan limit reached",
      detail: "Your current plan needs review before more invites can be sent.",
      href: "/account/billing?reason=invite-status",
      ctaLabel: "Review subscription",
      tone: "danger",
      action: "billing",
      icon: "credit_card",
    };
  }

  if (
    normalizedStatus.includes("failed") ||
    normalizedStatus.includes("error")
  ) {
    return {
      label: "Failed",
      detail: "Invite could not be sent. Review the contact details before trying again.",
      href: contactHref,
      ctaLabel: "Review contact",
      tone: "danger",
      action: "open",
      icon: "error",
    };
  }

  if (normalizedStatus.includes("pending")) {
    return {
      label: "Pending",
      detail: "Waiting for the contact to respond.",
      href: contactHref,
      ctaLabel: "Resend invite",
      tone: "warning",
      action: "resend",
      icon: "schedule",
    };
  }

  if (normalizedStatus.includes("sent") || normalizedStatus.includes("invite_sent")) {
    return {
      label: "Pending",
      detail: "Invite sent and awaiting response.",
      href: contactHref,
      ctaLabel: "Resend invite",
      tone: "warning",
      action: "resend",
      icon: "schedule",
    };
  }

  return {
    label: "Send invite",
    detail: contact.email ? "Ready to invite from Contacts." : "Add an email before sending an invite.",
    href: contactHref,
    ctaLabel: contact.email ? "Send invite" : "Open contact",
    tone: "default",
    action: contact.email ? "send" : "open",
    icon: contact.email ? "send" : "edit",
  };
}

function normalizeDashboardContactRole(value: string | null | undefined): CollaboratorRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  const allowed = new Set<CollaboratorRole>([
    "professional_advisor",
    "accountant",
    "financial_advisor",
    "lawyer",
    "trustee",
    "executor",
    "power_of_attorney",
    "friend_or_family",
  ]);
  if (allowed.has(normalized as CollaboratorRole)) return normalized as CollaboratorRole;
  if (normalized.includes("trustee")) return "trustee";
  if (normalized.includes("executor")) return "executor";
  if (normalized.includes("attorney")) return "power_of_attorney";
  if (normalized.includes("accountant")) return "accountant";
  if (normalized.includes("lawyer") || normalized.includes("solicitor")) return "lawyer";
  if (normalized.includes("advisor") || normalized.includes("adviser")) return "professional_advisor";
  return "friend_or_family";
}

function resolveDashboardTaskType(metadata: Record<string, unknown>): ActionCentreTask["type"] {
  const raw = String(metadata["task_type"] ?? metadata["type"] ?? "").trim().toLowerCase();
  if (raw === "system_generated" || raw === "system") return "system_generated";
  if (raw === "reminder") return "reminder";
  return "user_created";
}

function isPlanLimitStatus(value: string) {
  return value.toLowerCase().includes("starter plan limit reached");
}

function stripStatusPrefix(value: string) {
  return value.replace(/^[✅⚠️❌]\s*/u, "");
}

function buildVaultCompletenessItems({
  profileReadiness,
  possessionsRecordCount,
  legalRecordCount,
  willRecordCount,
  financeRecordCount,
  bankRecordCount,
  propertyRecordCount,
  businessRecordCount,
  storedDocumentCount,
  contactCount,
  executorContactCount,
  nextOfKinContactCount,
  assetRows,
  documentRows,
  attachmentRows,
}: {
  profileReadiness: ProfileReadinessRow;
  possessionsRecordCount: number;
  legalRecordCount: number;
  willRecordCount: number;
  financeRecordCount: number;
  bankRecordCount: number;
  propertyRecordCount: number;
  businessRecordCount: number;
  storedDocumentCount: number;
  contactCount: number;
  executorContactCount: number;
  nextOfKinContactCount: number;
  assetRows: AssetRow[];
  documentRows: DocumentRow[];
  attachmentRows: AttachmentRow[];
}): VaultCompletenessItem[] {
  const profileMissing = [
    profileReadiness.hasProfile ? "" : "Add your name",
    profileReadiness.hasContact ? "" : "Add contact details",
    profileReadiness.hasAddress ? "" : "Add address",
  ].filter(Boolean);
  const personalCount = possessionsRecordCount;
  const personalMissing = [
    personalCount > 0 ? "" : "Add a personal record",
    nextOfKinContactCount > 0 ? "" : "Confirm next of kin",
  ].filter(Boolean);
  const legalMissing = [
    willRecordCount > 0 ? "" : "Upload your will",
    executorContactCount > 0 ? "" : "Add your executor",
  ].filter(Boolean);
  const financeMissing = [
    bankRecordCount > 0 ? "" : "Add a bank account",
    hasFinanceCategory(assetRows, "pensions") ? "" : "Add pension details",
  ].filter(Boolean);
  const propertyMissing = propertyRecordCount > 0 ? [] : ["Review property details"];
  const businessMissing = businessRecordCount > 0 ? [] : ["Add business interests if relevant"];
  const documentMissing = storedDocumentCount > 0 ? [] : ["Upload key document"];
  const contactMissing = [
    contactCount > 0 ? "" : "Add trusted contact",
    executorContactCount > 0 ? "" : "Add executor",
  ].filter(Boolean);

  return [
    buildCompletenessItem({
      key: "profile",
      title: "Profile",
      href: "/profile",
      icon: "account_circle",
      hasStarted: profileReadiness.hasProfile || profileReadiness.hasContact || profileReadiness.hasAddress,
      missingItems: profileMissing,
      nextAction: profileMissing[0] ?? "Review profile",
      reviewDue: findReviewDueDate("profile", assetRows, documentRows, attachmentRows),
      detail: "Your profile helps trusted people confirm identity, address, and contact details.",
    }),
    buildCompletenessItem({
      key: "personal",
      title: "Personal",
      href: "/personal",
      icon: "inventory_2",
      hasStarted: personalCount > 0 || nextOfKinContactCount > 0,
      missingItems: personalMissing,
      nextAction: personalMissing[0] ?? "Review personal records",
      reviewDue: findReviewDueDate("personal", assetRows, documentRows, attachmentRows),
      detail: "Personal records and next-of-kin details give context for people helping you later.",
    }),
    buildCompletenessItem({
      key: "legal",
      title: "Legal",
      href: "/legal/wills",
      icon: "gavel",
      hasStarted: legalRecordCount > 0 || executorContactCount > 0,
      missingItems: legalMissing,
      nextAction: legalMissing[0] ?? "Review will information",
      reviewDue: findReviewDueDate("legal", assetRows, documentRows, attachmentRows),
      detail: "Legal progress checks whether will information and executor details are present. This is not legal advice.",
    }),
    buildCompletenessItem({
      key: "finances",
      title: "Finances",
      href: "/finances",
      icon: "account_balance",
      hasStarted: financeRecordCount > 0,
      missingItems: financeMissing,
      nextAction: financeMissing[0] ?? "Review financial records",
      reviewDue: findReviewDueDate("finances", assetRows, documentRows, attachmentRows),
      detail: "Financial progress checks for core account and pension information stored in your vault.",
    }),
    buildCompletenessItem({
      key: "property",
      title: "Property",
      href: "/property",
      icon: "home",
      hasStarted: propertyRecordCount > 0,
      missingItems: propertyMissing,
      nextAction: propertyMissing[0] ?? "Review property details",
      reviewDue: findReviewDueDate("property", assetRows, documentRows, attachmentRows),
      detail: "Property records help show what property information is available for review.",
    }),
    buildCompletenessItem({
      key: "business",
      title: "Business",
      href: "/business",
      icon: "business_center",
      hasStarted: businessRecordCount > 0,
      missingItems: businessMissing,
      nextAction: businessMissing[0] ?? "Review business details",
      reviewDue: findReviewDueDate("business", assetRows, documentRows, attachmentRows),
      detail: "Business records are optional for some users, but visible here when relevant.",
    }),
    buildCompletenessItem({
      key: "documents",
      title: "Documents",
      href: "/property/documents",
      icon: "folder_open",
      hasStarted: storedDocumentCount > 0,
      missingItems: documentMissing,
      nextAction: documentMissing[0] ?? "Review documents",
      reviewDue: findReviewDueDate("documents", assetRows, documentRows, attachmentRows),
      detail: "Document progress checks whether supporting files are stored alongside your records.",
    }),
    buildCompletenessItem({
      key: "contacts",
      title: "Contacts / Executors",
      href: "/contacts?group=executors",
      icon: "contacts",
      hasStarted: contactCount > 0 || executorContactCount > 0,
      missingItems: contactMissing,
      nextAction: contactMissing[0] ?? "Review contacts",
      reviewDue: findReviewDueDate("contacts", assetRows, documentRows, attachmentRows),
      detail: "Contacts progress checks whether trusted people and executor details are recorded.",
    }),
  ];
}

function buildCompletenessItem({
  key,
  title,
  href,
  icon,
  hasStarted,
  missingItems,
  nextAction,
  reviewDue,
  detail,
}: Omit<VaultCompletenessItem, "status"> & { hasStarted: boolean }) {
  const status: VaultCompletenessStatus = missingItems.length === 0 ? "Complete" : hasStarted ? "In progress" : "Not added yet";
  return { key, title, href, icon, status, missingItems, nextAction, reviewDue, detail };
}

function buildDashboardDocumentItems({
  documentRows,
  attachmentRows,
  assetRows,
  sectionEntryRows,
}: {
  documentRows: DocumentRow[];
  attachmentRows: AttachmentRow[];
  assetRows: AssetRow[];
  sectionEntryRows: SectionEntrySearchRow[];
}): DashboardDocumentItem[] {
  const documentItems = documentRows
    .filter((row) => String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim())
    .map((row) => {
      const sectionKey = resolveDocumentSectionKey(row, assetRows);
      const categoryKey = row.category_key ?? null;
      const linkedLabel = resolveParentLabel(row.asset_id, assetRows, row.title ?? row.document_type ?? null) ?? "Vault record";
      return {
        id: `document-${row.id}`,
        source: "document" as const,
        fileName: row.file_name || row.title || row.document_type || "Untitled document",
        mimeType: row.mime_type || "application/octet-stream",
        createdAt: row.created_at ?? undefined,
        metaLabel: `${formatDocumentStatus(row)} · Linked to ${linkedLabel}`,
        storageBucket: String(row.storage_bucket ?? ""),
        storagePath: String(row.storage_path ?? ""),
        linkedLabel,
        href: getDiscoveryDocumentHref(sectionKey, categoryKey, linkedLabel),
        statusLabel: formatDocumentStatus(row),
      } satisfies DashboardDocumentItem;
    });

  const attachmentItems = attachmentRows
    .filter((row) => String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim())
    .map((row) => {
      const sectionKey = resolveAttachmentSectionKey(row, assetRows, sectionEntryRows);
      const categoryKey = resolveAttachmentCategoryKey(row, assetRows, sectionEntryRows);
      const linkedLabel = resolveSearchParentLabel(row.record_id, assetRows, sectionEntryRows, "Vault record") ?? "Vault record";
      return {
        id: `attachment-${row.id}`,
        source: "attachment" as const,
        fileName: row.file_name || "Untitled attachment",
        mimeType: row.mime_type || "application/octet-stream",
        createdAt: row.created_at ?? undefined,
        metaLabel: `Stored · Linked to ${linkedLabel}`,
        storageBucket: String(row.storage_bucket ?? ""),
        storagePath: String(row.storage_path ?? ""),
        linkedLabel,
        href: getDiscoveryAttachmentHref(sectionKey, categoryKey),
        statusLabel: "Stored",
      } satisfies DashboardDocumentItem;
    });

  return [...documentItems, ...attachmentItems]
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")))
    .slice(0, 6);
}

const DASHBOARD_KEY_DOCUMENT_CATEGORIES: Array<{ key: DashboardDocumentCategoryKey; label: string; needles: string[] }> = [
  { key: "will", label: "Will", needles: ["will", "wills", "testament"] },
  { key: "id", label: "ID", needles: ["identity", "passport", "driving licence", "driver licence", "id document", "proof of id"] },
  { key: "financial", label: "Financial", needles: ["finance", "financial", "bank", "pension", "investment", "insurance", "debt", "account"] },
  { key: "property", label: "Property", needles: ["property", "house", "home", "mortgage", "deed", "land registry"] },
];

function buildDashboardDocumentCoverage(items: DashboardDocumentItem[]): DashboardDocumentCoverage {
  const categories = DASHBOARD_KEY_DOCUMENT_CATEGORIES.reduce(
    (result, category) => {
      result[category.key] = items.some((item) => dashboardDocumentMatchesCategory(item, category.needles));
      return result;
    },
    { will: false, id: false, financial: false, property: false } as Record<DashboardDocumentCategoryKey, boolean>,
  );
  const missingCategories = DASHBOARD_KEY_DOCUMENT_CATEGORIES
    .filter((category) => !categories[category.key])
    .map((category) => category.key);
  const quickActions = [
    { key: "upload" as const, label: items.length ? "Upload document" : "Upload first document", href: "/property/documents" },
    { key: "view_all" as const, label: "View all", href: "/property/documents" },
  ];

  if (items.length === 0) {
    return {
      categories,
      missingCategories,
      signalMessage: "No documents uploaded yet.",
      signalSeverity: "high",
      quickActions,
    };
  }

  if (items.length === 1) {
    return {
      categories,
      missingCategories,
      signalMessage: "Only 1 document uploaded. Add key documents when you are ready.",
      signalSeverity: "medium",
      quickActions,
    };
  }

  if (missingCategories.length > 0) {
    return {
      categories,
      missingCategories,
      signalMessage: `Key documents missing: ${formatDocumentCategoryList(missingCategories)}.`,
      signalSeverity: "medium",
      quickActions,
    };
  }

  return {
    categories,
    missingCategories,
    signalMessage: "Basic key document coverage is in place.",
    signalSeverity: "clear",
    quickActions,
  };
}

function buildExecutorLegalReadinessState({
  assetRows,
  documentRows,
  attachmentRows,
  contactRows,
  dashboardInviteState,
  profileReadiness,
  executorContactCount,
  nextOfKinContactCount,
  willRecordCount,
  documentItems,
  documentCoverage,
}: {
  assetRows: AssetRow[];
  documentRows: DocumentRow[];
  attachmentRows: AttachmentRow[];
  contactRows: ContactDiscoveryRow[];
  dashboardInviteState: Record<string, DashboardInviteOverride>;
  profileReadiness: ProfileReadinessRow;
  executorContactCount: number;
  nextOfKinContactCount: number;
  willRecordCount: number;
  documentItems: DashboardDocumentItem[];
  documentCoverage: DashboardDocumentCoverage;
}): ExecutorLegalReadinessState {
  const executorSummary = buildExecutorReadinessSummary(assetRows, contactRows, dashboardInviteState);
  const executorAssigned = executorContactCount > 0;
  const executorAccepted = contactRows
    .filter(isExecutorContact)
    .some((contact) => isAcceptedExecutorContact(contact, dashboardInviteState[contact.id]));
  const willPresent = willRecordCount > 0;
  const willUploadState = getWillUploadState(assetRows, documentRows, attachmentRows);
  const willUploaded = willUploadState.uploaded;
  const keyDocumentsPresent =
    documentCoverage.categories.will &&
    documentCoverage.categories.id &&
    (documentCoverage.categories.financial || documentCoverage.categories.property);
  const supportingLegalInfoPresent = hasSupportingLegalInfoRecord(assetRows, documentRows);
  const powerOfAttorneyPresent = hasPowerOfAttorneyRecord(assetRows, documentRows);
  const contactsComplete = executorAssigned && nextOfKinContactCount > 0;
  const identityVerified =
    profileReadiness.hasProfile &&
    profileReadiness.hasContact &&
    documentCoverage.categories.id;
  const lastReviewDate = formatDashboardLastReviewDate(latestTimestamp([
    ...assetRows.map((row) => row.updated_at ?? row.created_at),
    ...documentRows.map((row) => row.created_at),
    ...attachmentRows.map((row) => row.created_at ?? null),
  ]));
  const lastReviewTimestamp = latestTimestamp([
    ...assetRows.map((row) => row.updated_at ?? row.created_at),
    ...documentRows.map((row) => row.created_at),
    ...attachmentRows.map((row) => row.created_at ?? null),
  ]);

  const model: ExecutorLegalReadinessModel = {
    executorAssigned,
    executorAccepted,
    willPresent,
    willUploaded,
    willUploadReasonCode: willUploadState.reasonCode,
    keyDocumentsPresent,
    supportingLegalInfoPresent,
    powerOfAttorneyPresent,
    contactsComplete,
    identityVerified,
    ...(lastReviewDate ? { lastReviewDate } : {}),
  };
  const documentSummary: ExecutorLegalReadinessState["documentSummary"] = {
    will: willUploaded ? "Uploaded" : willPresent ? "Recorded" : "Missing",
    identityDocument: documentCoverage.categories.id ? "Uploaded" : "Missing",
    financialOrPropertyDocuments: documentCoverage.categories.financial && documentCoverage.categories.property
      ? "Uploaded"
      : documentCoverage.categories.financial || documentCoverage.categories.property
        ? "Partial"
        : "Missing",
    supportingLegalInfo: supportingLegalInfoPresent ? "Recorded" : "Not added",
    powerOfAttorney: powerOfAttorneyPresent ? "Recorded" : "Not added",
  };
  const statusLevel = getExecutorLegalReadinessStatusLevel(model);
  const reviewRecommended = isReviewOlderThanMonths(lastReviewTimestamp, 12);
  const explanation = getExecutorLegalReadinessExplanation(statusLevel, reviewRecommended);

  const items: ExecutorLegalReadinessItem[] = [
    {
      key: "executorAssigned",
      label: "Executor assigned",
      complete: model.executorAssigned,
      status: model.executorAssigned ? "Complete" : "Not yet added",
      whyItMatters: "A named executor helps your family understand who should act for your estate.",
      nextAction: "Add executor",
      href: "/contacts?group=executors",
    },
    {
      key: "executorAccepted",
      label: "Executor invite accepted",
      complete: model.executorAccepted,
      status: model.executorAccepted ? "Complete" : model.executorAssigned ? "Recommended" : "Not yet added",
      whyItMatters: "An accepted invite gives clearer confidence that the executor knows about their role.",
      nextAction: model.executorAssigned ? "Send or resend invite" : "Add executor first",
      href: model.executorAssigned ? "/contacts?group=executors" : "/contacts?group=executors",
    },
    {
      key: "willPresent",
      label: "Will information present",
      complete: model.willPresent,
      status: model.willPresent ? "Complete" : "Not yet added",
      whyItMatters: "Will information is a core readiness signal for estate planning. This is a record check, not legal validation.",
      nextAction: "Add will information",
      href: "/legal/wills",
    },
    {
      key: "willUploaded",
      label: "Will document uploaded",
      complete: model.willUploaded,
      status: model.willUploaded ? "Complete" : "Not yet added",
      whyItMatters: model.willPresent
        ? "A stored file linked to the will record helps trusted people find the supporting document when needed."
        : "Create the will record first, then attach the supporting file to that record.",
      nextAction: "Upload will",
      href: "/legal/wills",
    },
    {
      key: "keyDocumentsPresent",
      label: "Key documents present",
      complete: model.keyDocumentsPresent,
      status: model.keyDocumentsPresent ? "Complete" : documentItems.length ? "Recommended" : "Not yet added",
      whyItMatters: "Basic document coverage helps people find identity, legal, and asset evidence quickly.",
      nextAction: "Upload key documents",
      href: "/property/documents",
    },
    {
      key: "contactsComplete",
      label: "Executor and next of kin recorded",
      complete: model.contactsComplete,
      status: model.contactsComplete ? "Complete" : "Recommended",
      whyItMatters: "Executor and next-of-kin details make people and access decisions easier to understand.",
      nextAction: nextOfKinContactCount > 0 ? "Review contacts" : "Confirm next of kin",
      href: nextOfKinContactCount > 0 ? "/contacts?group=next-of-kin" : "/contacts?group=next-of-kin&add=1",
    },
    {
      key: "identityVerified",
      label: "Identity details available",
      complete: model.identityVerified,
      status: model.identityVerified ? "Complete" : "Recommended",
      whyItMatters: "Profile details and an identity document help others confirm the vault belongs to you.",
      nextAction: profileReadiness.hasProfile && profileReadiness.hasContact ? "Upload ID document" : "Complete profile",
      href: profileReadiness.hasProfile && profileReadiness.hasContact ? "/identity-documents" : "/profile",
    },
    {
      key: "reviewDetails",
      label: "Review details",
      complete: !reviewRecommended,
      status: reviewRecommended ? "Recommended" : "Complete",
      whyItMatters: "A periodic review keeps executor, will, document, and contact details current.",
      nextAction: "Review details",
      href: "/dashboard",
    },
  ];
  const completedCount = items.filter((item) => item.complete).length;
  const nextAction = items.find((item) => !item.complete) ?? null;

  return {
    model,
    statusLevel,
    explanation,
    checklistSummary: {
      executor: !model.executorAssigned ? "Missing" : model.executorAccepted ? "Accepted" : executorSummary.inviteStatus === "invited" ? "Invited" : "Not invited",
      will: documentSummary.will,
      documents: model.keyDocumentsPresent ? "Ready" : documentItems.length ? "Partial" : "Missing",
      contacts: model.contactsComplete ? "Complete" : "Incomplete",
    },
    executorSummary,
    documentSummary,
    items,
    completedCount,
    totalCount: items.length,
    statusSummary: `${statusLevel} · ${completedCount} of ${items.length} ready`,
    nextAction,
    reviewRecommended,
  };
}

function buildExecutorReadinessSummary(
  assetRows: AssetRow[],
  contactRows: ContactDiscoveryRow[],
  dashboardInviteState: Record<string, DashboardInviteOverride>,
): ExecutorLegalReadinessState["executorSummary"] {
  const executorContact = contactRows.find(isExecutorContact) ?? null;
  const executorAsset = assetRows.find(isExecutorAsset) ?? null;
  const metadata = executorAsset?.metadata_json ?? executorAsset?.metadata ?? {};
  const name =
    executorContact?.full_name ||
    executorContact?.email ||
    executorAsset?.title ||
    String(metadata["executor_name"] ?? "").trim() ||
    null;
  const inviteStatus: ExecutorLegalReadinessState["executorSummary"]["inviteStatus"] = executorContact
    ? isAcceptedExecutorContact(executorContact, dashboardInviteState[executorContact.id])
      ? "accepted"
      : getContactInviteDisplay(executorContact, dashboardInviteState[executorContact.id]).label === "Send invite"
        ? "not invited"
        : "invited"
    : "not invited";
  const lastActivity = formatDashboardLastReviewDate(latestTimestamp([
    executorAsset?.updated_at ?? executorAsset?.created_at ?? null,
  ]));

  return { name, inviteStatus, lastActivity: lastActivity ?? null };
}

function getExecutorLegalReadinessStatusLevel(model: ExecutorLegalReadinessModel): ExecutorLegalReadinessStatusLevel {
  if (!model.executorAssigned) return "Not started";
  if (!model.willPresent && !model.willUploaded) return "Incomplete";
  if (!model.keyDocumentsPresent || !model.contactsComplete || !model.identityVerified || !model.executorAccepted) return "At risk";
  return "Ready";
}

function getExecutorLegalReadinessExplanation(statusLevel: ExecutorLegalReadinessStatusLevel, reviewRecommended: boolean) {
  const reviewText = reviewRecommended ? " Review recommended because the latest saved update is over 12 months old." : "";
  if (statusLevel === "Not started") {
    return `Add an executor first so your estate has a named person who can act when needed.${reviewText}`;
  }
  if (statusLevel === "Incomplete") {
    return `Executor details are started. Add will information next so the legal record is easier to find.${reviewText}`;
  }
  if (statusLevel === "At risk") {
    return `Executor and will details exist, but supporting documents or contact details are still incomplete.${reviewText}`;
  }
  return `Core executor, will, document, contact, and identity readiness checks are complete.${reviewText}`;
}

function isReviewOlderThanMonths(timestamp: string | null | undefined, months: number) {
  if (!timestamp) return false;
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return false;
  return addMonths(parsed, months).getTime() < Date.now();
}

function isAcceptedExecutorContact(contact: ContactDiscoveryRow, override: DashboardInviteOverride | undefined) {
  const invite = getContactInviteDisplay(contact, override);
  return invite.label === "Accepted" || includesAny([contact.invite_status, contact.verification_status], ["accepted", "verified"]);
}

function formatDashboardLastReviewDate(timestamp: string | null | undefined) {
  if (!timestamp) return undefined;
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return formatReviewDueDate(parsed) ?? undefined;
}

function dashboardDocumentMatchesCategory(item: DashboardDocumentItem, needles: string[]) {
  const haystack = [
    item.fileName,
    item.mimeType,
    item.metaLabel,
    item.linkedLabel,
    item.href,
    item.statusLabel,
    item.source,
  ].map((value) => String(value ?? "").toLowerCase().replace(/[_-]+/g, " ")).join(" ");
  return needles.some((needle) => haystack.includes(needle));
}

function formatDocumentCategoryList(categories: DashboardDocumentCategoryKey[]) {
  return categories
    .map((category) => DASHBOARD_KEY_DOCUMENT_CATEGORIES.find((entry) => entry.key === category)?.label ?? category)
    .join(", ");
}

function formatDocumentStatus(row: DocumentRow) {
  const hasStoredFile = String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim();
  return hasStoredFile ? "Stored" : "Record only";
}

function isWillAsset(row: AssetRow) {
  const metadata = row.metadata_json ?? row.metadata ?? {};
  return includesAny([row.title, row.category_key, row.subtype_key, metadata["document_type"], metadata["document_title"], metadata["category_slug"]], ["will", "wills"]);
}

function isWillDocument(row: DocumentRow) {
  return includesAny([row.title, row.file_name, row.category_key, row.document_type, row.document_kind], ["will", "wills"]);
}

function getWillUploadState(assetRows: AssetRow[], documentRows: DocumentRow[], attachmentRows: AttachmentRow[]) {
  const willAssetIds = new Set(
    assetRows
      .filter((row) => row.deleted_at == null && row.archived_at == null && row.status !== "archived" && isWillAsset(row))
      .map((row) => row.id),
  );
  const linkedCurrentWillFile =
    documentRows.some((row) => Boolean(row.asset_id && willAssetIds.has(row.asset_id) && hasStoredDocumentFile(row))) ||
    attachmentRows.some((row) => Boolean(row.record_id && willAssetIds.has(row.record_id) && hasStoredAttachmentFile(row)));

  if (linkedCurrentWillFile) {
    return { uploaded: true, reasonCode: "linked_current_will_file" as const };
  }

  const legacyWillFile = willAssetIds.size === 0 && documentRows.some((row) => isWillDocument(row) && hasStoredDocumentFile(row));
  if (legacyWillFile) {
    return { uploaded: true, reasonCode: "legacy_will_file" as const };
  }

  return {
    uploaded: false,
    reasonCode: willAssetIds.size > 0 ? "will_record_without_file" as const : "no_will_record" as const,
  };
}

function hasStoredDocumentFile(row: DocumentRow) {
  return Boolean(String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim());
}

function hasStoredAttachmentFile(row: AttachmentRow) {
  return Boolean(String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim());
}

function hasSupportingLegalInfoRecord(assetRows: AssetRow[], documentRows: DocumentRow[]) {
  const assetMatch = assetRows.some((row) => {
    const metadata = row.metadata_json ?? row.metadata ?? {};
    return includesAny(
      [row.title, row.category_key, row.subtype_key, metadata["document_type"], metadata["document_title"], metadata["category_slug"]],
      ["expression of wishes", "wishes", "funeral wishes", "funeral_wishes"],
    );
  });
  const documentMatch = documentRows.some((row) =>
    includesAny([row.title, row.file_name, row.category_key, row.document_type, row.document_kind], ["expression of wishes", "wishes", "funeral wishes", "funeral_wishes"]),
  );
  return assetMatch || documentMatch;
}

function hasPowerOfAttorneyRecord(assetRows: AssetRow[], documentRows: DocumentRow[]) {
  const assetMatch = assetRows.some((row) => {
    const metadata = row.metadata_json ?? row.metadata ?? {};
    return includesAny(
      [row.title, row.category_key, row.subtype_key, metadata["document_type"], metadata["document_title"], metadata["category_slug"], metadata["poa_type"]],
      ["power of attorney", "power_of_attorney", "power-of-attorney", "lasting power", "lpa"],
    );
  });
  const documentMatch = documentRows.some((row) =>
    includesAny([row.title, row.file_name, row.category_key, row.document_type, row.document_kind], ["power of attorney", "power_of_attorney", "power-of-attorney", "lasting power", "lpa"]),
  );
  return assetMatch || documentMatch;
}

function isExecutorAsset(row: AssetRow) {
  const metadata = row.metadata_json ?? row.metadata ?? {};
  return includesAny([row.title, row.category_key, metadata["executor_type"], metadata["role_type"]], ["executor", "co executor", "co_executor", "executors"]);
}

function isExecutorContact(contact: ContactDiscoveryRow) {
  return includesAny([
    contact.contact_role,
    contact.relationship,
    contact.source_type,
    ...(contact.linked_context ?? []).flatMap((context) => [context.role, context.category_key, context.label]),
  ], ["executor", "co executor", "co_executor", "executors"]);
}

function isNextOfKinContact(contact: ContactDiscoveryRow) {
  return includesAny([
    contact.contact_role,
    contact.relationship,
    contact.source_type,
    ...(contact.linked_context ?? []).flatMap((context) => [context.role, context.category_key, context.label]),
  ], ["next of kin", "next_of_kin", "next-of-kin"]);
}

function hasFinanceCategory(rows: AssetRow[], category: string) {
  return getAssetsForBucket(rows, "finance").some((row) => String(row.category_key ?? "").toLowerCase().includes(category));
}

function includesAny(values: unknown[], needles: string[]) {
  const haystack = values.map((value) => String(value ?? "").toLowerCase().replace(/[_-]+/g, " ")).join(" ");
  return needles.some((needle) => haystack.includes(needle.replace(/[_-]+/g, " ")));
}

function findReviewDueDate(
  section: string,
  assetRows: AssetRow[],
  documentRows: DocumentRow[],
  attachmentRows: AttachmentRow[],
) {
  const candidates: string[] = [];
  for (const row of assetRows) {
    if (!recordMatchesCompletenessSection(section, row.section_key, row.category_key)) continue;
    const metadata = row.metadata_json ?? row.metadata ?? {};
    candidates.push(...extractDateCandidates(metadata), row.updated_at ?? "", row.created_at ?? "");
  }
  for (const row of documentRows) {
    if (section !== "documents" && !recordMatchesCompletenessSection(section, resolveDocumentSectionKey(row, assetRows), row.category_key)) continue;
    candidates.push(row.created_at ?? "");
  }
  if (section === "documents") {
    for (const row of attachmentRows) candidates.push(row.created_at ?? "");
  }

  const dueDates = candidates
    .map((value) => new Date(value))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());
  const explicitDue = dueDates.find((date) => date.getTime() > Date.now());
  const fallback = dueDates[0] ? addMonths(dueDates[0], 12) : null;
  return formatReviewDueDate(explicitDue ?? fallback);
}

function recordMatchesCompletenessSection(section: string, sectionKey: string | null | undefined, categoryKey: string | null | undefined) {
  const normalizedSection = String(sectionKey ?? "").toLowerCase();
  const normalizedCategory = String(categoryKey ?? "").toLowerCase();
  if (section === "finances") return normalizedSection === "finances";
  if (section === "documents") return true;
  if (section === "contacts") return normalizedCategory.includes("executor") || normalizedSection === "contacts";
  return normalizedSection === section || normalizedCategory === section;
}

function extractDateCandidates(metadata: Record<string, unknown>) {
  return [
    metadata["review_due_at"],
    metadata["review_due"],
    metadata["next_review_due"],
    metadata["next_review_at"],
    metadata["due_date"],
    metadata["remind_at"],
    metadata["scheduled_for"],
  ].map((value) => String(value ?? "").trim()).filter(Boolean);
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function formatReviewDueDate(date: Date | null) {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  } catch {
    return null;
  }
}

const overviewIconStyle = {
  width: 28,
  height: 28,
  borderRadius: 10,
  background: "#f7f3f0",
  border: "1px solid #eadfd8",
  color: "#3a2118",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} satisfies CSSProperties;

const setupProgressPillStyle = {
  border: "1px solid #e7ded7",
  borderRadius: 999,
  background: "#f8f5f2",
  color: "#4b3a31",
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 750,
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const planLimitStatusButtonStyle = {
  border: "1px solid #fed7aa",
  borderRadius: 12,
  background: "#fff7ed",
  color: "#9a3412",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 13,
  textAlign: "left",
  cursor: "pointer",
} satisfies CSSProperties;

const commandCardHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
} satisfies CSSProperties;

function commandIconStyle(tone: DashboardReviewPanel["tone"] | ContactInviteDisplay["tone"] = "default"): CSSProperties {
  const styles = {
    default: { background: "#f7f3f0", color: "#3a2118", border: "1px solid #eadfd8" },
    warning: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" },
    success: { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
    danger: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
  }[tone ?? "default"];

  return {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...styles,
  };
}

const commandEyebrowStyle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
} satisfies CSSProperties;

const commandDescriptionStyle = {
  margin: 0,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.45,
} satisfies CSSProperties;

const trustCueStyle = {
  borderRadius: 10,
  background: "#f8f5f2",
  color: "#5b4a40",
  padding: "8px 10px",
  fontSize: 12,
} satisfies CSSProperties;

const quickFormStyle = {
  border: "1px solid #ece5df",
  borderRadius: 12,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 12,
} satisfies CSSProperties;

const quickFormGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
} satisfies CSSProperties;

const quickFormActionWrapStyle = {
  display: "grid",
  gap: 10,
} satisfies CSSProperties;

const quickFormErrorStyle = {
  border: "1px solid #fecaca",
  borderRadius: 10,
  background: "#fef2f2",
  color: "#991b1b",
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 700,
} satisfies CSSProperties;

const primaryCommandButtonStyle = {
  border: "1px solid #2b201b",
  borderRadius: 10,
  background: "#2b201b",
  color: "#fff",
  minHeight: 40,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontWeight: 750,
  cursor: "pointer",
  width: "fit-content",
} satisfies CSSProperties;

const ghostCommandButtonStyle = {
  border: "1px solid #d9d1cb",
  borderRadius: 10,
  background: "#fff",
  color: "#3a2118",
  minHeight: 40,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontWeight: 750,
  cursor: "pointer",
} satisfies CSSProperties;

const miniStatusRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 10,
  border: "1px solid #f0e9e3",
  borderRadius: 10,
  padding: 10,
  background: "#fffefd",
} satisfies CSSProperties;

function statusBadgeStyle(tone: ContactInviteDisplay["tone"], mode: "button" | "disabled" | "status" = "button"): CSSProperties {
  const palette = {
    default: { background: "#f8f5f2", color: "#3a2118", border: "1px solid #e7ded7" },
    warning: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" },
    success: { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
    danger: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
  }[tone];

  return {
    border: palette.border,
    background: palette.background,
    color: palette.color,
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
    minHeight: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    cursor: mode === "button" ? "pointer" : "default",
    opacity: mode === "disabled" ? 0.72 : 1,
  };
}

const compactEmptyStateStyle = {
  border: "1px dashed #d8d1cc",
  borderRadius: 12,
  background: "#fffefd",
  color: "#6f645d",
  padding: 12,
  fontSize: 13,
  lineHeight: 1.45,
} satisfies CSSProperties;

function reviewPanelStyle(tone: DashboardReviewPanel["tone"] = "default"): CSSProperties {
  const palette = tone === "success"
    ? { border: "#bbf7d0", background: "#f7fbf7" }
    : tone === "warning"
      ? { border: "#fed7aa", background: "#fffaf4" }
      : { border: "#d7cabe", background: "#fff" };

  return {
    border: `1px solid ${palette.border}`,
    borderRadius: 14,
    background: palette.background,
    padding: 14,
    display: "grid",
    gap: 12,
  };
}

const completenessPanelStyle = {
  border: "1px solid #e8e1dc",
  borderRadius: 16,
  background: "#fff",
  padding: 18,
  display: "grid",
  gap: 14,
} satisfies CSSProperties;

const readinessPanelStyle = {
  ...completenessPanelStyle,
  background: "#fffefd",
} satisfies CSSProperties;

function readinessStatusBadgeStyle(statusLevel: ExecutorLegalReadinessStatusLevel): CSSProperties {
  const palette = statusLevel === "Ready"
    ? { border: "#bbf7d0", background: "#f0fdf4", color: "#166534" }
    : statusLevel === "At risk"
      ? { border: "#fed7aa", background: "#fff7ed", color: "#9a3412" }
      : { border: "#e8e1dc", background: "#f8f6f4", color: "#5f5852" };
  return {
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.color,
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

function readinessSummaryCardStyle(statusLevel: ExecutorLegalReadinessStatusLevel): CSSProperties {
  const complete = statusLevel === "Ready";
  return {
    border: complete ? "1px solid #bbf7d0" : "1px solid #fed7aa",
    borderRadius: 14,
    background: complete ? "#f7fbf7" : "#fffaf4",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
  };
}

const readinessTaskListStyle = {
  display: "grid",
  gap: 8,
} satisfies CSSProperties;

const readinessTaskButtonStyle = {
  border: "1px solid #ece5df",
  borderRadius: 12,
  background: "#fff",
  padding: 10,
  color: "#1f1712",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
} satisfies CSSProperties;

const readinessSnapshotGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
} satisfies CSSProperties;

const readinessSnapshotStyle = {
  border: "1px solid #ece5df",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
  display: "grid",
  gap: 4,
} satisfies CSSProperties;

const readinessActionPanelStyle = {
  border: "1px solid #ece5df",
  borderRadius: 14,
  background: "#fffefd",
  padding: 14,
  display: "grid",
  gap: 12,
} satisfies CSSProperties;

const readinessPanelHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "center",
  gap: 10,
} satisfies CSSProperties;

const readinessUploadGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
} satisfies CSSProperties;

const readinessUploadActionStyle = {
  textDecoration: "none",
  border: "1px solid #ece5df",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
  color: "#1f1712",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 10,
} satisfies CSSProperties;

const readinessGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
} satisfies CSSProperties;

function readinessItemStyle(complete: boolean): CSSProperties {
  return {
    border: complete ? "1px solid #d7eadb" : "1px solid #ece5df",
    borderRadius: 12,
    background: complete ? "#f7fbf7" : "#fff",
    padding: 12,
    color: "#1f1712",
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "center",
    gap: 10,
    minHeight: 66,
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
  };
}

function readinessItemIconStyle(complete: boolean): CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: complete ? "#e7f4ea" : "#f7f3f0",
    color: complete ? "#166534" : "#3a2118",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

const searchResultsPanelStyle = {
  border: "1px solid #e5e0dc",
  borderRadius: 16,
  background: "#fffefd",
  padding: 16,
  display: "grid",
  gap: 12,
} satisfies CSSProperties;

const searchEmptyStateStyle = {
  border: "1px dashed #d8d1cc",
  borderRadius: 14,
  padding: 14,
  color: "#6f645d",
  background: "#fffefd",
} satisfies CSSProperties;

const searchResetButtonStyle = {
  border: "1px solid #ded6d1",
  borderRadius: 999,
  background: "#fff",
  color: "#3a2118",
  padding: "7px 12px",
  fontSize: 13,
  fontWeight: 700,
  justifySelf: "start",
  cursor: "pointer",
} satisfies CSSProperties;

const searchResultStyle = {
  textDecoration: "none",
  color: "#0f172a",
  border: "1px solid #e8e1dc",
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
  background: "#f7f3f0",
  border: "1px solid #eadfd8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#3a2118",
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
    href: "/identity-documents",
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
  if (normalizedCategory === "identity-documents") return "/identity-documents";
  if (normalizedCategory === "power-of-attorney") return "/legal/power-of-attorney";
  if (normalizedCategory === "wills") return "/legal/wills";
  if (normalizedCategory === "death-certificate") return "/legal/death-certificate";
  if ((parentLabel ?? "").toLowerCase().includes("identity")) return "/identity-documents";
  return "/legal";
}

function getPersonalWorkspaceHref(categoryKey: string) {
  const normalizedCategory = String(categoryKey ?? "").trim();
  if (normalizedCategory === "social-media") return "/personal/social-media";
  if (normalizedCategory === "tasks") return "/personal/tasks";
  return "/personal";
}
