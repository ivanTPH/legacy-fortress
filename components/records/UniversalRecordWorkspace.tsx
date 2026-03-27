"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  optionLabel,
  personalPossessionCategories,
  personalPossessionSubcategories,
} from "../../lib/categoryConfig";
import MaskedField, { maskAllButLast } from "../ui/MaskedField";
import ConfigDrivenAssetFields from "../forms/asset/ConfigDrivenAssetFields";
import { FileDropzone, FormField } from "../forms/asset/AssetFormControls";
import { ActionIconButton } from "../ui/IconButton";
import Icon from "../ui/Icon";
import AttachmentGallery, { AttachmentGallerySummary } from "../documents/AttachmentGallery";
import { waitForActiveUser } from "../../lib/auth/session";
import { formatCurrency } from "../../lib/currency";
import {
  COUNTRY_TO_CURRENCY_DEFAULT,
  getAssetCategoryFormConfig,
  resolveConfiguredFieldValue,
  validateAssetFormValues,
} from "../../lib/assets/fieldDictionary";
import { getLegalLinkedContactDefinition } from "../../lib/legalCategories";
import {
  buildCanonicalBankEditSeed,
  normalizeCanonicalBankMetadata,
  normalizeBankAssetRow,
} from "../../lib/assets/bankAsset";
import { mergeWorkspaceSaveMetadata } from "../../lib/assets/workspaceSaveMetadata";
import {
  buildCanonicalBusinessEditSeed,
  normalizeCanonicalBusinessMetadata,
  readCanonicalBusinessAsset,
} from "../../lib/assets/businessAsset";
import {
  buildCanonicalBeneficiaryEditSeed,
  normalizeCanonicalBeneficiaryMetadata,
  readCanonicalBeneficiaryAsset,
} from "../../lib/assets/beneficiaryAsset";
import {
  buildCanonicalExecutorEditSeed,
  normalizeCanonicalExecutorMetadata,
  readCanonicalExecutorAsset,
} from "../../lib/assets/executorAsset";
import {
  buildCanonicalTaskEditSeed,
  normalizeCanonicalTaskMetadata,
  readCanonicalTaskAsset,
} from "../../lib/assets/taskAsset";
import {
  buildCanonicalDigitalEditSeed,
  normalizeCanonicalDigitalMetadata,
  readCanonicalDigitalAsset,
} from "../../lib/assets/digitalAsset";
import {
  buildCanonicalPropertyEditSeed,
  normalizeCanonicalPropertyMetadata,
  readCanonicalPropertyAsset,
} from "../../lib/assets/propertyAsset";
import { createAsset, updateAsset } from "../../lib/assets/createAsset";
import { fetchCanonicalAssets } from "../../lib/assets/fetchCanonicalAssets";
import { notifyCanonicalAssetMutation } from "../../lib/assets/liveSync";
import {
  assertWorkspaceRowsMatchCategory,
  getManagedAssetWorkspaceConfig,
  validateManagedAssetWorkspaceConfig,
} from "../../lib/assets/workspaceCategoryConfig";
import { loadSensitiveAssetPayloads, resolveWalletContextForRead } from "../../lib/canonicalPersistence";
import {
  createCanonicalAssetDocument,
  getCanonicalAssetDocumentParentLabel,
  getStoredFileSignedUrl,
  isPrintableDocumentMimeType,
  resolveCanonicalAssetDocumentContext,
} from "../../lib/assets/documentLinks";
import { mergeWorkspaceAttachments } from "../../lib/assets/mergeWorkspaceAttachments";
import {
  filterDiscoveryRecords,
} from "../../lib/records/discovery";
import { summarizeScopedAssetRows } from "../../lib/dashboard/summary";
import { supabase } from "../../lib/supabaseClient";
import { validateUploadFile } from "../../lib/validation/upload";
import {
  loadCanonicalContactsByIds,
  syncCanonicalContact,
  unlinkCanonicalContactSource,
  type CanonicalContactContext,
  type CanonicalContactRow,
} from "../../lib/contacts/canonicalContacts";
import {
  resolveLatestSavedContactIdentityReference,
  resolveSavedCanonicalContactIdForSource,
} from "../../lib/contacts/contactIdentity";
import { buildContactsWorkspaceHref } from "../../lib/contacts/contactRouting";
import {
  appendDevBankTrace,
  mergeDevBankContextTrace,
  readDevBankContextTrace,
  clearDevBankRequestTrace,
  readDevBankRequestTrace,
  isDevBankTraceEnabled,
  readDevBankTrace,
  subscribeToDevBankTrace,
  type CanonicalBankContextTrace,
  type CanonicalBankTraceEntry,
} from "../../lib/devSmoke";
import { useViewerAccess } from "../access/ViewerAccessContext";
import { getPlanLimitRedirectHref } from "../../lib/accountPlan";

type RecordStatus = "active" | "archived";
type WorkspaceVariant = "default" | "possessions" | "trusted_contacts";
const DEV_BANK_BUILD_MARKER = "LF_TRACE_BUILD_MARKER: ec9c21b+banktrace-20260320-2038";

type UniversalRecordRow = {
  id: string;
  owner_user_id: string;
  section_key: string;
  category_key: string;
  title: string | null;
  provider_name: string | null;
  provider_key: string | null;
  summary: string | null;
  value_minor: number | null;
  currency_code: string | null;
  status: RecordStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type RecordAttachment = {
  id: string;
  record_id: string;
  owner_user_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string | null;
  created_at: string;
  source_table: "documents" | "attachments";
  document_kind: "document" | "photo";
  parent_label?: string;
};

type RecordContact = {
  id: string;
  record_id: string;
  owner_user_id: string;
  contact_id: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_role: string | null;
  relationship: string | null;
  invite_status: string | null;
  verification_status: string | null;
  linked_context: CanonicalContactContext[];
  notes: string | null;
  created_at: string;
};

type ProviderCatalogRow = {
  provider_key: string;
  display_name: string;
  provider_type: "social" | "bank" | "subscription" | "vehicle" | "other";
  match_terms: string[] | null;
  logo_path: string | null;
  icon_text: string | null;
  active: boolean;
};

type WorkspaceProps = {
  sectionKey: string;
  categoryKey: string;
  title: string;
  subtitle: string;
  variant?: WorkspaceVariant;
  sectionId?: string;
  forceCanonicalRead?: boolean;
  recordFilter?: (row: UniversalRecordRow) => boolean;
};

type EditForm = {
  title: string;
  provider_name: string;
  summary: string;
  value_major: string;
  currency_code: string;
  notes: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  possession_category: string;
  possession_subtype: string;
  description: string;
  acquired_date: string;
  serial_number: string;
  location: string;
  secondary_phone: string;
  address: string;
  preferred_contact_method: string;
  contact_label: string;
  bank_name: string;
  bank_provider_key: string;
  bank_account_type: string;
  bank_account_type_other: string;
  account_holder_name: string;
  sort_code: string;
  account_number: string;
  country: string;
  country_other: string;
  currency_other: string;
  last_updated_on: string;
  iban: string;
  swift_bic: string;
  branch_name: string;
  branch_address: string;
  bank_contact_phone: string;
  bank_contact_email: string;
  online_banking_url: string;
  property_type: string;
  property_type_other: string;
  property_ownership_type: string;
  property_ownership_type_other: string;
  property_address: string;
  property_country: string;
  property_country_other: string;
  occupancy_status: string;
  occupancy_status_other: string;
  tenant_name: string;
  tenancy_type: string;
  tenancy_type_other: string;
  managing_agent: string;
  managing_agent_contact: string;
  monthly_rent: string;
  tenancy_end_date: string;
  deposit_scheme_reference: string;
  lease_or_tenant_summary: string;
  property_valuation_date: string;
  mortgage_status: string;
  mortgage_status_other: string;
  mortgage_lender: string;
  mortgage_balance: string;
  business_type: string;
  business_type_other: string;
  business_registration_number: string;
  business_jurisdiction: string;
  business_jurisdiction_other: string;
  business_ownership_percentage: string;
  business_valuation_date: string;
  business_role_title: string;
  business_status: string;
  business_status_other: string;
  digital_asset_type: string;
  digital_asset_type_other: string;
  digital_platform_provider: string;
  digital_wallet_reference: string;
  digital_jurisdiction: string;
  digital_jurisdiction_other: string;
  digital_valuation_date: string;
  digital_access_contact: string;
  digital_status: string;
  digital_status_other: string;
  social_profile_url: string;
  social_username: string;
  social_login_email: string;
  social_credential_hint: string;
  social_recovery_notes: string;
  beneficiary_preferred_name: string;
  beneficiary_relationship_to_user: string;
  beneficiary_relationship_to_user_other: string;
  beneficiary_date_of_birth: string;
  beneficiary_contact_email: string;
  beneficiary_contact_phone: string;
  beneficiary_address: string;
  beneficiary_country_code: string;
  beneficiary_country_code_other: string;
  beneficiary_type: string;
  beneficiary_type_other: string;
  beneficiary_status: string;
  beneficiary_status_other: string;
  beneficiary_share_percentage: string;
  beneficiary_identification_reference: string;
  executor_type: string;
  executor_type_other: string;
  executor_relationship_to_user: string;
  executor_relationship_to_user_other: string;
  executor_contact_email: string;
  executor_contact_phone: string;
  executor_authority_level: string;
  executor_authority_level_other: string;
  executor_jurisdiction: string;
  executor_jurisdiction_other: string;
  executor_status: string;
  executor_status_other: string;
  executor_appointed_on: string;
  executor_address: string;
  executor_identity_reference: string;
  executor_beneficiary_reference: string;
  executor_instruction_reference: string;
  task_description: string;
  task_related_asset_id: string;
  task_assigned_executor_asset_id: string;
  task_assigned_beneficiary_asset_id: string;
  task_priority: string;
  task_priority_other: string;
  task_status: string;
  task_status_other: string;
  task_due_date: string;
  task_completion_date: string;
  task_instruction_reference: string;
  investment_provider: string;
  investment_type: string;
  investment_reference: string;
  adviser_name: string;
  adviser_company: string;
  adviser_phone: string;
  adviser_email: string;
  investment_portal_url: string;
  ownership_type: string;
  beneficiary_notes: string;
  pension_provider: string;
  pension_type: string;
  pension_member_number: string;
  employer_name: string;
  scheme_name: string;
  provider_phone: string;
  provider_email: string;
  provider_address: string;
  pension_portal_url: string;
  pension_beneficiary: string;
  insurer_name: string;
  policy_type: string;
  policy_number: string;
  insured_item: string;
  cover_amount: string;
  renewal_date: string;
  insurer_phone: string;
  insurer_email: string;
  broker_name: string;
  broker_contact: string;
  identity_document_type: string;
  identity_document_type_other: string;
  identity_document_number: string;
  identity_document_country: string;
  identity_document_country_other: string;
  identity_issue_date: string;
  creditor_name: string;
  debt_type: string;
  debt_reference: string;
  outstanding_balance: string;
  debtor_name: string;
  repayment_amount: string;
  repayment_frequency: string;
  interest_rate: string;
  creditor_phone: string;
  creditor_email: string;
  creditor_address: string;
};

const EMPTY_FORM: EditForm = {
  title: "",
  provider_name: "",
  summary: "",
  value_major: "",
  currency_code: "GBP",
  notes: "",
  contact_name: "",
  contact_email: "",
  contact_role: "",
  possession_category: "watches",
  possession_subtype: "",
  description: "",
  acquired_date: "",
  serial_number: "",
  location: "",
  secondary_phone: "",
  address: "",
  preferred_contact_method: "",
  contact_label: "",
  bank_name: "",
  bank_provider_key: "",
  bank_account_type: "",
  bank_account_type_other: "",
  account_holder_name: "",
  sort_code: "",
  account_number: "",
  country: "",
  country_other: "",
  currency_other: "",
  last_updated_on: "",
  iban: "",
  swift_bic: "",
  branch_name: "",
  branch_address: "",
  bank_contact_phone: "",
  bank_contact_email: "",
  online_banking_url: "",
  property_type: "",
  property_type_other: "",
  property_ownership_type: "",
  property_ownership_type_other: "",
  property_address: "",
  property_country: "",
  property_country_other: "",
  occupancy_status: "",
  occupancy_status_other: "",
  tenant_name: "",
  tenancy_type: "",
  tenancy_type_other: "",
  managing_agent: "",
  managing_agent_contact: "",
  monthly_rent: "",
  tenancy_end_date: "",
  deposit_scheme_reference: "",
  lease_or_tenant_summary: "",
  property_valuation_date: "",
  mortgage_status: "",
  mortgage_status_other: "",
  mortgage_lender: "",
  mortgage_balance: "",
  business_type: "",
  business_type_other: "",
  business_registration_number: "",
  business_jurisdiction: "",
  business_jurisdiction_other: "",
  business_ownership_percentage: "",
  business_valuation_date: "",
  business_role_title: "",
  business_status: "",
  business_status_other: "",
  digital_asset_type: "",
  digital_asset_type_other: "",
  digital_platform_provider: "",
  digital_wallet_reference: "",
  digital_jurisdiction: "",
  digital_jurisdiction_other: "",
  digital_valuation_date: "",
  digital_access_contact: "",
  digital_status: "",
  digital_status_other: "",
  social_profile_url: "",
  social_username: "",
  social_login_email: "",
  social_credential_hint: "",
  social_recovery_notes: "",
  beneficiary_preferred_name: "",
  beneficiary_relationship_to_user: "",
  beneficiary_relationship_to_user_other: "",
  beneficiary_date_of_birth: "",
  beneficiary_contact_email: "",
  beneficiary_contact_phone: "",
  beneficiary_address: "",
  beneficiary_country_code: "",
  beneficiary_country_code_other: "",
  beneficiary_type: "",
  beneficiary_type_other: "",
  beneficiary_status: "",
  beneficiary_status_other: "",
  beneficiary_share_percentage: "",
  beneficiary_identification_reference: "",
  executor_type: "",
  executor_type_other: "",
  executor_relationship_to_user: "",
  executor_relationship_to_user_other: "",
  executor_contact_email: "",
  executor_contact_phone: "",
  executor_authority_level: "",
  executor_authority_level_other: "",
  executor_jurisdiction: "",
  executor_jurisdiction_other: "",
  executor_status: "",
  executor_status_other: "",
  executor_appointed_on: "",
  executor_address: "",
  executor_identity_reference: "",
  executor_beneficiary_reference: "",
  executor_instruction_reference: "",
  task_description: "",
  task_related_asset_id: "",
  task_assigned_executor_asset_id: "",
  task_assigned_beneficiary_asset_id: "",
  task_priority: "",
  task_priority_other: "",
  task_status: "",
  task_status_other: "",
  task_due_date: "",
  task_completion_date: "",
  task_instruction_reference: "",
  investment_provider: "",
  investment_type: "",
  investment_reference: "",
  adviser_name: "",
  adviser_company: "",
  adviser_phone: "",
  adviser_email: "",
  investment_portal_url: "",
  ownership_type: "",
  beneficiary_notes: "",
  pension_provider: "",
  pension_type: "",
  pension_member_number: "",
  employer_name: "",
  scheme_name: "",
  provider_phone: "",
  provider_email: "",
  provider_address: "",
  pension_portal_url: "",
  pension_beneficiary: "",
  insurer_name: "",
  policy_type: "",
  policy_number: "",
  insured_item: "",
  cover_amount: "",
  renewal_date: "",
  insurer_phone: "",
  insurer_email: "",
  broker_name: "",
  broker_contact: "",
  identity_document_type: "",
  identity_document_type_other: "",
  identity_document_number: "",
  identity_document_country: "",
  identity_document_country_other: "",
  identity_issue_date: "",
  creditor_name: "",
  debt_type: "",
  debt_reference: "",
  outstanding_balance: "",
  debtor_name: "",
  repayment_amount: "",
  repayment_frequency: "",
  interest_rate: "",
  creditor_phone: "",
  creditor_email: "",
  creditor_address: "",
};

const DEFAULT_PROVIDER_CATALOG: ProviderCatalogRow[] = [
  { provider_key: "facebook", display_name: "Facebook", provider_type: "social", match_terms: ["facebook", "meta"], logo_path: "/logos/social/facebook.svg", icon_text: null, active: true },
  { provider_key: "instagram", display_name: "Instagram", provider_type: "social", match_terms: ["instagram", "insta"], logo_path: "/logos/social/instagram.svg", icon_text: null, active: true },
  { provider_key: "x", display_name: "X", provider_type: "social", match_terms: ["twitter", "x.com", "x"], logo_path: "/logos/social/x.svg", icon_text: null, active: true },
  { provider_key: "linkedin", display_name: "LinkedIn", provider_type: "social", match_terms: ["linkedin"], logo_path: "/logos/social/linkedin.svg", icon_text: null, active: true },
  { provider_key: "tiktok", display_name: "TikTok", provider_type: "social", match_terms: ["tiktok", "tik tok"], logo_path: "/logos/social/tiktok.svg", icon_text: null, active: true },
  { provider_key: "youtube", display_name: "YouTube", provider_type: "social", match_terms: ["youtube"], logo_path: "/logos/social/youtube.svg", icon_text: null, active: true },

  { provider_key: "barclays", display_name: "Barclays", provider_type: "bank", match_terms: ["barclays"], logo_path: null, icon_text: null, active: true },
  { provider_key: "hsbc", display_name: "HSBC", provider_type: "bank", match_terms: ["hsbc"], logo_path: null, icon_text: null, active: true },
  { provider_key: "lloyds", display_name: "Lloyds", provider_type: "bank", match_terms: ["lloyds", "lloyds bank"], logo_path: null, icon_text: null, active: true },
  { provider_key: "natwest", display_name: "NatWest", provider_type: "bank", match_terms: ["natwest", "nat west"], logo_path: null, icon_text: null, active: true },
  { provider_key: "santander", display_name: "Santander", provider_type: "bank", match_terms: ["santander"], logo_path: null, icon_text: null, active: true },
  { provider_key: "nationwide", display_name: "Nationwide", provider_type: "bank", match_terms: ["nationwide"], logo_path: null, icon_text: null, active: true },
  { provider_key: "rbs", display_name: "RBS", provider_type: "bank", match_terms: ["rbs", "royal bank of scotland"], logo_path: null, icon_text: null, active: true },
  { provider_key: "co-operative", display_name: "Co-operative Bank", provider_type: "bank", match_terms: ["co-operative", "co operative", "co-op", "coop"], logo_path: null, icon_text: null, active: true },
  { provider_key: "virgin-money", display_name: "Virgin Money", provider_type: "bank", match_terms: ["virgin", "virgin money"], logo_path: null, icon_text: null, active: true },
  { provider_key: "deutsche-bank", display_name: "Deutsche Bank", provider_type: "bank", match_terms: ["deutsche"], logo_path: null, icon_text: null, active: true },
  { provider_key: "citibank", display_name: "Citibank", provider_type: "bank", match_terms: ["citi", "citibank"], logo_path: null, icon_text: null, active: true },
  { provider_key: "revolut", display_name: "Revolut", provider_type: "bank", match_terms: ["revolut"], logo_path: null, icon_text: null, active: true },
  { provider_key: "monzo", display_name: "Monzo", provider_type: "bank", match_terms: ["monzo"], logo_path: null, icon_text: null, active: true },
  { provider_key: "starling", display_name: "Starling", provider_type: "bank", match_terms: ["starling", "starling bank"], logo_path: null, icon_text: null, active: true },

  { provider_key: "netflix", display_name: "Netflix", provider_type: "subscription", match_terms: ["netflix"], logo_path: "/logos/subscriptions/netflix.svg", icon_text: null, active: true },
  { provider_key: "spotify", display_name: "Spotify", provider_type: "subscription", match_terms: ["spotify"], logo_path: "/logos/subscriptions/spotify.svg", icon_text: null, active: true },
  { provider_key: "amazon-prime", display_name: "Amazon Prime", provider_type: "subscription", match_terms: ["amazon prime", "prime video"], logo_path: "/logos/subscriptions/amazon-prime.svg", icon_text: null, active: true },
  { provider_key: "disney-plus", display_name: "Disney+", provider_type: "subscription", match_terms: ["disney+", "disney plus"], logo_path: "/logos/subscriptions/disney-plus.svg", icon_text: null, active: true },
  { provider_key: "apple-music", display_name: "Apple Music", provider_type: "subscription", match_terms: ["apple music"], logo_path: "/logos/subscriptions/apple-music.svg", icon_text: null, active: true },

  { provider_key: "bmw", display_name: "BMW", provider_type: "vehicle", match_terms: ["bmw"], logo_path: null, icon_text: "bmw", active: true },
  { provider_key: "ford", display_name: "Ford", provider_type: "vehicle", match_terms: ["ford"], logo_path: null, icon_text: "fd", active: true },
  { provider_key: "mercedes", display_name: "Mercedes-Benz", provider_type: "vehicle", match_terms: ["mercedes", "mercedes-benz"], logo_path: null, icon_text: "mb", active: true },
  { provider_key: "tesla", display_name: "Tesla", provider_type: "vehicle", match_terms: ["tesla"], logo_path: null, icon_text: "t", active: true },
];

const POSSESSION_CATEGORY_ICONS: Record<string, string> = {
  jewellery: "diamond",
  art: "palette",
  electronics: "devices",
  household_contents: "chair",
  collectibles: "token",
  cars_vehicles: "directions_car",
  documents_memorabilia: "description",
  watches: "watch",
  pets: "pets",
  other: "inventory_2",
};

const EXCLUDED_POSSESSION_CATEGORIES = new Set(["cars_vehicles", "vehicles", "transport"]);
const BANK_FORM_CONFIG = getAssetCategoryFormConfig("bank-accounts");
const BENEFICIARY_FORM_CONFIG = getAssetCategoryFormConfig("beneficiaries");
const EXECUTOR_FORM_CONFIG = getAssetCategoryFormConfig("executors");
const TASK_FORM_CONFIG = getAssetCategoryFormConfig("tasks");
const BUSINESS_FORM_CONFIG = getAssetCategoryFormConfig("business-interests");
const DIGITAL_FORM_CONFIG = getAssetCategoryFormConfig("digital-assets");
const PROPERTY_FORM_CONFIG = getAssetCategoryFormConfig("property");
const IDENTITY_DOCUMENT_FORM_CONFIG = getAssetCategoryFormConfig("identity-documents");
const SOCIAL_MEDIA_FORM_CONFIG = getAssetCategoryFormConfig("social-media");
export default function UniversalRecordWorkspace({
  sectionKey,
  categoryKey,
  title,
  subtitle,
  variant = "default",
  sectionId,
  forceCanonicalRead = false,
  recordFilter,
}: WorkspaceProps) {
  const router = useRouter();
  const { viewer } = useViewerAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [records, setRecords] = useState<UniversalRecordRow[]>([]);
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [contacts, setContacts] = useState<RecordContact[]>([]);
  const [catalog, setCatalog] = useState<ProviderCatalogRow[]>(DEFAULT_PROVIDER_CATALOG);
  const [taskRelationOptions, setTaskRelationOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [taskExecutorOptions, setTaskExecutorOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [taskBeneficiaryOptions, setTaskBeneficiaryOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [archivingFor, setArchivingFor] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingDocumentFile, setPendingDocumentFile] = useState<File | null>(null);
  const [assetReviewConfirmed, setAssetReviewConfirmed] = useState(false);
  const [search, setSearch] = useState("");
  const [recordStatusFilter, setRecordStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"updated_desc" | "updated_asc" | "value_desc" | "value_asc">("updated_desc");
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const [failedThumbs, setFailedThumbs] = useState<Record<string, boolean>>({});
  const [devBankTraceEntries, setDevBankTraceEntries] = useState<CanonicalBankTraceEntry[]>([]);
  const [devBankContextTrace, setDevBankContextTrace] = useState<CanonicalBankContextTrace | null>(null);
  const [devBankRequestTrace, setDevBankRequestTrace] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [devBankSubmitTrace, setDevBankSubmitTrace] = useState<string[]>([]);
  const formSectionRef = useRef<HTMLElement | null>(null);

  const isPossessions = variant === "possessions";
  const isTrustedContacts = variant === "trusted_contacts";
  const isFinanceSection = sectionKey === "finances";
  const isBankCategory = isFinanceSection && categoryKey === "bank";
  const devBankTraceEnabled = isBankCategory && isDevBankTraceEnabled();
  useMemo(() => validateManagedAssetWorkspaceConfig(sectionKey, categoryKey), [sectionKey, categoryKey]);
  const managedAssetWorkspaceConfig = getManagedAssetWorkspaceConfig(sectionKey, categoryKey);
  const canonicalCategorySlug = resolveCanonicalCategorySlug(sectionKey, categoryKey);
  const usesCanonicalAssets = Boolean(canonicalCategorySlug);
  const usesCanonicalAssetReadPath = forceCanonicalRead || Boolean(managedAssetWorkspaceConfig?.readsCanonicalAssets) || usesCanonicalAssets;
  const isCanonicalBeneficiary = canonicalCategorySlug === "beneficiaries";
  const isCanonicalExecutor = canonicalCategorySlug === "executors";
  const isCanonicalTask = canonicalCategorySlug === "tasks";
  const isCanonicalBusiness = canonicalCategorySlug === "business-interests";
  const isCanonicalDigital = canonicalCategorySlug === "digital-assets";
  const isSocialMedia = sectionKey === "personal" && categoryKey === "social-media";
  const isCanonicalProperty = canonicalCategorySlug === "property";
  const isIdentityDocuments = sectionKey === "legal" && categoryKey === "identity-documents";
  const legalLinkedContactDefinition = sectionKey === "legal" ? getLegalLinkedContactDefinition(categoryKey) : null;
  const defaultLegalContactRole = legalLinkedContactDefinition?.defaultRole ?? "";
  const usesStructuredWorkspaceForm = isFinanceSection || usesCanonicalAssets || isIdentityDocuments || isSocialMedia;
  const hasStagedExtractionInput = Boolean(pendingDocumentFile || pendingPhotoFile);
  const addLabel = isPossessions
    ? "Add possession"
    : isTrustedContacts
      ? "Add contact"
      : isBankCategory
        ? "Add bank record"
        : isCanonicalBeneficiary
          ? "Add beneficiary"
        : isCanonicalExecutor
          ? "Add executor"
        : isCanonicalTask
          ? "Add task"
        : isCanonicalBusiness
          ? "Add business interest"
          : isCanonicalDigital
            ? "Add digital asset"
        : isCanonicalProperty
          ? "Add property asset"
          : isFinanceSection
            ? "Add record"
            : "Add record";
  const saveLabel = isPossessions
    ? "Save possession"
    : isTrustedContacts
      ? "Save contact"
      : isBankCategory
        ? "Save bank record"
        : isCanonicalBeneficiary
          ? "Save beneficiary"
        : isCanonicalExecutor
          ? "Save executor"
        : isCanonicalTask
          ? "Save task"
        : isCanonicalBusiness
          ? "Save business interest"
          : isCanonicalDigital
            ? "Save digital asset"
        : isCanonicalProperty
          ? "Save property asset"
          : isFinanceSection
            ? "Save record"
            : "Save record";

  useEffect(() => {
    if (!devBankTraceEnabled) return;
    setDevBankTraceEntries(readDevBankTrace());
    setDevBankContextTrace(readDevBankContextTrace());
    setDevBankRequestTrace(readDevBankRequestTrace());
    return subscribeToDevBankTrace(() => {
      setDevBankTraceEntries(readDevBankTrace());
      setDevBankContextTrace(readDevBankContextTrace());
      setDevBankRequestTrace(readDevBankRequestTrace());
    });
  }, [devBankTraceEnabled]);

  function resetBankSubmitTrace() {
    setSubmitError("");
    setDevBankSubmitTrace([]);
    clearDevBankRequestTrace();
  }

  function pushBankSubmitTrace(step: string) {
    if (!devBankTraceEnabled) return;
    setDevBankSubmitTrace((prev) => [...prev, `${new Date().toISOString()} ${step}`].slice(-12));
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setStatus("");
      mergeDevBankContextTrace({
        source: "UniversalRecordWorkspace.load",
        stage: "bank.page-load.start",
        error: null,
      });
      if (!isCanonicalTask) {
        setTaskRelationOptions([]);
        setTaskExecutorOptions([]);
        setTaskBeneficiaryOptions([]);
      }
      const user = await requireUser(router);
      if (!user || !mounted) {
        if (mounted) {
          setStatus("Could not load records: no active signed-in session.");
          setLoading(false);
        }
        return;
      }
      const targetOwnerUserId = viewer.targetOwnerUserId || user.id;
      mergeDevBankContextTrace({
        source: "UniversalRecordWorkspace.load",
        stage: "bank.page-load.user-ready",
        sessionPresent: true,
        userId: user.id,
        error: null,
      });

      const [recordsResult, catalogResult] = await Promise.all([
        loadWorkspaceRows({
          userId: targetOwnerUserId,
          sectionKey,
          categoryKey,
          usesCanonicalAssets: usesCanonicalAssetReadPath,
          recordFilter,
        }),
        supabase
          .from("provider_catalog")
          .select("provider_key,display_name,provider_type,match_terms,logo_path,icon_text,active")
          .eq("active", true),
      ]);

      if (isCanonicalTask) {
        const walletContext = await resolveWalletContextForRead(supabase, targetOwnerUserId);
        const taskLinkResult = await fetchCanonicalAssets(supabase, {
          userId: targetOwnerUserId,
          walletId: walletContext.walletId,
          select: "id,title,section_key,category_key",
        });

        if (!taskLinkResult.error) {
          const rows = ((taskLinkResult.data ?? []) as unknown) as Array<Record<string, unknown>>;
          const filteredRows = rows.filter((row) => String(row.category_key ?? "") !== "tasks");
          setTaskRelationOptions(
            filteredRows.map((row) => ({
              value: String(row.id ?? ""),
              label: buildTaskRelatedAssetLabel(row),
            })),
          );
          setTaskExecutorOptions(
            filteredRows
              .filter((row) => String(row.category_key ?? "") === "executors")
              .map((row) => ({
                value: String(row.id ?? ""),
                label: String(row.title ?? "Executor").trim() || "Executor",
              })),
          );
          setTaskBeneficiaryOptions(
            filteredRows
              .filter((row) => String(row.category_key ?? "") === "beneficiaries")
              .map((row) => ({
                value: String(row.id ?? ""),
                label: String(row.title ?? "Beneficiary").trim() || "Beneficiary",
              })),
          );
        }
      }

      if (!mounted) return;
      if (!recordsResult.ok) {
        setStatus(`Could not load records: ${recordsResult.error}`);
        mergeDevBankContextTrace({
          source: "UniversalRecordWorkspace.load",
          stage: "bank.page-load.error",
          userId: user.id,
          error: recordsResult.error,
        });
        setRecords([]);
        setAttachments([]);
        setContacts([]);
        setLoading(false);
        return;
      }

      const nextRecords = recordsResult.rows;
      mergeDevBankContextTrace({
        source: "UniversalRecordWorkspace.load",
        stage: "bank.page-load.records-ready",
        userId: user.id,
        error: null,
      });
      if (recordsResult.warning) {
        setStatus(`Loaded records, but some encrypted fields could not be hydrated: ${recordsResult.warning}`);
      }
      setRecords(nextRecords);
      if (catalogResult.data && !catalogResult.error) {
        setCatalog(mergeCatalogRows(catalogResult.data as ProviderCatalogRow[]));
      }

      const ids = nextRecords.map((item) => item.id);
      if (ids.length === 0) {
        setAttachments([]);
        setContacts([]);
        setLoading(false);
        return;
      }

      const [documentsResult, attachmentsResult, contactsResult] = await Promise.all([
        supabase
          .from("documents")
          .select("id,asset_id,owner_user_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,checksum,created_at,document_kind")
          .eq("owner_user_id", targetOwnerUserId)
          .in("asset_id", ids)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("attachments")
          .select("id,record_id,owner_user_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,checksum,created_at")
          .eq("owner_user_id", targetOwnerUserId)
          .in("record_id", ids)
          .order("created_at", { ascending: false }),
        loadWorkspaceContacts({
          userId: targetOwnerUserId,
          ids,
          usesCanonicalAssetReadPath,
        }),
      ]);

      if (!mounted) return;
      if (documentsResult.error && attachmentsResult.error) {
        setStatus(`Could not load attachments: ${documentsResult.error.message}`);
        setAttachments([]);
      } else {
        setAttachments(
          mergeWorkspaceAttachments({
            documents: !documentsResult.error
              ? mapDocumentRowsToAttachments((documentsResult.data ?? []) as Array<Record<string, unknown>>)
              : [],
            legacyAttachments: !attachmentsResult.error
              ? mapLegacyAttachmentRowsToAttachments((attachmentsResult.data ?? []) as Array<Record<string, unknown>>)
              : [],
          }),
        );
      }
      if (contactsResult.ok) {
        setContacts(contactsResult.rows);
      } else {
        setContacts([]);
        setStatus((prev) => prev || `Could not load contacts: ${contactsResult.error}`);
      }
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [categoryKey, forceCanonicalRead, isCanonicalTask, recordFilter, router, sectionKey, usesCanonicalAssetReadPath, viewer.targetOwnerUserId]);

  const totals = useMemo(() => {
    const summary = summarizeScopedAssetRows(records);
    return {
      active: summary.activeValueMajor,
      archived: summary.archivedValueMajor,
      missingValue: summary.missingValueCount,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const items = filterDiscoveryRecords(records, {
      query: search,
      statusFilter: recordStatusFilter,
      categoryFilter: isPossessions ? categoryFilter : "all",
      excludedCategories: isPossessions ? Array.from(EXCLUDED_POSSESSION_CATEGORIES) : [],
    });
    items.sort((a, b) => {
      if (sortBy === "updated_desc") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === "updated_asc") return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (sortBy === "value_desc") return toMajorUnits(b.value_minor) - toMajorUnits(a.value_minor);
      return toMajorUnits(a.value_minor) - toMajorUnits(b.value_minor);
    });
    return items;
  }, [categoryFilter, isPossessions, recordStatusFilter, records, search, sortBy]);

  const activeRecords = filteredRecords.filter((row) => row.status === "active");
  const archivedRecords = filteredRecords.filter((row) => row.status === "archived");
  const hasAnyRecords = records.length > 0;
  const hasDiscoveryFilters = Boolean(search.trim()) || recordStatusFilter !== "all" || (isPossessions && categoryFilter !== "all");

  useEffect(() => {
    let cancelled = false;
    async function loadPhotoPreviews() {
      const imageAttachments = attachments.filter((item) => isImageAttachment(item));
      if (!imageAttachments.length) {
        setPhotoPreviews({});
        setFailedThumbs({});
        return;
      }
      const entries = await Promise.all(
        imageAttachments.map(async (item) => {
          const signed = await supabase.storage.from(item.storage_bucket).createSignedUrl(item.storage_path, 900);
          if (signed.error || !signed.data?.signedUrl) return [item.record_id, ""] as const;
          return [item.record_id, signed.data.signedUrl] as const;
        }),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [recordId, url] of entries) {
        if (!next[recordId] && url) next[recordId] = url;
      }
      setPhotoPreviews(next);
      setFailedThumbs({});
    }
    void loadPhotoPreviews();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPendingPhotoFile(null);
    setPendingDocumentFile(null);
    setAssetReviewConfirmed(false);
    resetBankSubmitTrace();
    setFormVisible(true);
  }

  function startEdit(row: UniversalRecordRow) {
    const rowContactReference = resolveLatestSavedContactIdentityReference(
      contacts.map((item) => ({
        ...item,
        sourceId: item.record_id,
        contactId: item.contact_id,
        createdAt: item.created_at,
      })),
      row.id,
    );
    const rowContact = rowContactReference ?? null;
    const canonicalBankSeed = buildCanonicalBankEditSeed({
      title: row.title,
      provider_name: row.provider_name,
      provider_key: row.provider_key,
      currency_code: row.currency_code,
      value_minor: row.value_minor,
      metadata: row.metadata,
    });
    const canonicalPropertySeed = buildCanonicalPropertyEditSeed({
      title: row.title,
      currency_code: row.currency_code,
      value_minor: row.value_minor,
      metadata: row.metadata,
    });
    const canonicalBusinessSeed = buildCanonicalBusinessEditSeed({
      title: row.title,
      currency_code: row.currency_code,
      value_minor: row.value_minor,
      metadata: row.metadata,
    });
    const canonicalBeneficiarySeed = buildCanonicalBeneficiaryEditSeed({
      title: row.title,
      metadata: row.metadata,
    });
    const canonicalExecutorSeed = buildCanonicalExecutorEditSeed({
      title: row.title,
      metadata: row.metadata,
    });
    const canonicalTaskSeed = buildCanonicalTaskEditSeed({
      title: row.title,
      metadata: row.metadata,
    });
    const canonicalDigitalSeed = buildCanonicalDigitalEditSeed({
      title: row.title,
      currency_code: row.currency_code,
      value_minor: row.value_minor,
      metadata: row.metadata,
    });
    const bankName = canonicalBankSeed.provider_name || canonicalBankSeed.institution_name;
    const investmentProvider = String(row.metadata?.investment_provider ?? row.provider_name ?? "");
    const pensionProvider = String(row.metadata?.pension_provider ?? row.provider_name ?? "");
    const insurerName = String(row.metadata?.insurer_name ?? row.provider_name ?? "");
    const creditorName = String(row.metadata?.creditor_name ?? row.provider_name ?? "");
    const bankAccountType = toSelectableValue(BANK_FORM_CONFIG, "account_type", canonicalBankSeed.account_type);
    const country = toSelectableValue(BANK_FORM_CONFIG, "country", canonicalBankSeed.country_code);
    const currency = toSelectableValue(BANK_FORM_CONFIG, "currency", canonicalBankSeed.currency_code);
    setEditingId(row.id);
    setForm({
      title: isCanonicalExecutor && rowContact?.contact_name ? rowContact.contact_name : row.title ?? "",
      provider_name: row.provider_name ?? "",
      summary: row.summary ?? "",
      value_major: canonicalBankSeed.value_major,
      currency_code: currency.selected || (row.currency_code ?? "GBP").toUpperCase(),
      notes: canonicalBankSeed.notes || String(rowContact?.notes ?? ""),
      contact_name: usesCanonicalAssets ? "" : rowContact?.contact_name ?? "",
      contact_email: usesCanonicalAssets ? "" : rowContact?.contact_email ?? "",
      contact_role: usesCanonicalAssets ? "" : rowContact?.relationship ?? rowContact?.contact_role ?? String(row.metadata?.relationship ?? ""),
      possession_category: String(row.metadata?.category ?? "watches"),
      possession_subtype: String(row.metadata?.subtype ?? ""),
      description: String(row.metadata?.description ?? ""),
      acquired_date: String(row.metadata?.acquired_date ?? ""),
      serial_number: String(row.metadata?.serial_number ?? ""),
      location: String(row.metadata?.location ?? ""),
      secondary_phone: String(row.metadata?.secondary_phone ?? ""),
      address: String(row.metadata?.address ?? ""),
      preferred_contact_method: String(row.metadata?.preferred_contact_method ?? ""),
      contact_label: String(row.metadata?.contact_label ?? ""),
      bank_name: bankName,
      bank_provider_key: canonicalBankSeed.provider_key,
      bank_account_type: bankAccountType.selected,
      bank_account_type_other: bankAccountType.other,
      account_holder_name: canonicalBankSeed.account_holder,
      sort_code: canonicalBankSeed.sort_code,
      account_number: canonicalBankSeed.account_number,
      country: country.selected,
      country_other: country.other,
      currency_other: currency.other,
      last_updated_on: canonicalBankSeed.last_updated_on,
      iban: canonicalBankSeed.iban,
      swift_bic: String(row.metadata?.swift_bic ?? ""),
      branch_name: String(row.metadata?.branch_name ?? ""),
      branch_address: String(row.metadata?.branch_address ?? ""),
      bank_contact_phone: String(row.metadata?.bank_contact_phone ?? ""),
      bank_contact_email: String(row.metadata?.bank_contact_email ?? ""),
      online_banking_url: String(row.metadata?.online_banking_url ?? ""),
      property_type: canonicalPropertySeed.property_type,
      property_type_other: canonicalPropertySeed.property_type_other,
      property_ownership_type: canonicalPropertySeed.ownership_type,
      property_ownership_type_other: canonicalPropertySeed.ownership_type_other,
      property_address: canonicalPropertySeed.property_address,
      property_country: canonicalPropertySeed.property_country,
      property_country_other: canonicalPropertySeed.property_country_other,
      occupancy_status: canonicalPropertySeed.occupancy_status,
      occupancy_status_other: canonicalPropertySeed.occupancy_status_other,
      tenant_name: canonicalPropertySeed.tenant_name,
      tenancy_type: canonicalPropertySeed.tenancy_type,
      tenancy_type_other: canonicalPropertySeed.tenancy_type_other,
      managing_agent: canonicalPropertySeed.managing_agent,
      managing_agent_contact: canonicalPropertySeed.managing_agent_contact,
      monthly_rent: canonicalPropertySeed.monthly_rent_major,
      tenancy_end_date: canonicalPropertySeed.tenancy_end_date,
      deposit_scheme_reference: canonicalPropertySeed.deposit_scheme_reference,
      lease_or_tenant_summary: canonicalPropertySeed.lease_or_tenant_summary,
      property_valuation_date: canonicalPropertySeed.valuation_date,
      mortgage_status: canonicalPropertySeed.mortgage_status,
      mortgage_status_other: canonicalPropertySeed.mortgage_status_other,
      mortgage_lender: canonicalPropertySeed.mortgage_lender,
      mortgage_balance: canonicalPropertySeed.mortgage_balance_major,
      business_type: canonicalBusinessSeed.business_type,
      business_type_other: canonicalBusinessSeed.business_type_other,
      business_registration_number: canonicalBusinessSeed.registration_number,
      business_jurisdiction: canonicalBusinessSeed.jurisdiction,
      business_jurisdiction_other: canonicalBusinessSeed.jurisdiction_other,
      business_ownership_percentage: canonicalBusinessSeed.ownership_percentage,
      business_valuation_date: canonicalBusinessSeed.valuation_date,
      business_role_title: canonicalBusinessSeed.role_title,
      business_status: canonicalBusinessSeed.business_status,
      business_status_other: canonicalBusinessSeed.business_status_other,
      digital_asset_type: canonicalDigitalSeed.digital_asset_type,
      digital_asset_type_other: canonicalDigitalSeed.digital_asset_type_other,
      digital_platform_provider: canonicalDigitalSeed.platform_provider,
      digital_wallet_reference: canonicalDigitalSeed.wallet_reference,
      digital_jurisdiction: canonicalDigitalSeed.jurisdiction,
      digital_jurisdiction_other: canonicalDigitalSeed.jurisdiction_other,
      digital_valuation_date: canonicalDigitalSeed.valuation_date,
      digital_access_contact: canonicalDigitalSeed.access_contact,
      digital_status: canonicalDigitalSeed.digital_status,
      digital_status_other: canonicalDigitalSeed.digital_status_other,
      social_profile_url: String(row.metadata?.social_profile_url ?? ""),
      social_username: String(row.metadata?.social_username ?? ""),
      social_login_email: String(row.metadata?.social_login_email ?? ""),
      social_credential_hint: String(row.metadata?.social_credential_hint ?? ""),
      social_recovery_notes: String(row.metadata?.social_recovery_notes ?? ""),
      beneficiary_preferred_name: canonicalBeneficiarySeed.preferred_name,
      beneficiary_relationship_to_user: canonicalBeneficiarySeed.relationship_to_user,
      beneficiary_relationship_to_user_other: canonicalBeneficiarySeed.relationship_to_user_other,
      beneficiary_date_of_birth: canonicalBeneficiarySeed.date_of_birth,
      beneficiary_contact_email: canonicalBeneficiarySeed.contact_email,
      beneficiary_contact_phone: canonicalBeneficiarySeed.contact_phone,
      beneficiary_address: canonicalBeneficiarySeed.beneficiary_address,
      beneficiary_country_code: canonicalBeneficiarySeed.country_code,
      beneficiary_country_code_other: canonicalBeneficiarySeed.country_code_other,
      beneficiary_type: canonicalBeneficiarySeed.beneficiary_type,
      beneficiary_type_other: canonicalBeneficiarySeed.beneficiary_type_other,
      beneficiary_status: canonicalBeneficiarySeed.beneficiary_status,
      beneficiary_status_other: canonicalBeneficiarySeed.beneficiary_status_other,
      beneficiary_share_percentage: canonicalBeneficiarySeed.share_percentage,
      beneficiary_identification_reference: canonicalBeneficiarySeed.identification_reference,
      executor_type: canonicalExecutorSeed.executor_type,
      executor_type_other: canonicalExecutorSeed.executor_type_other,
      executor_relationship_to_user: canonicalExecutorSeed.relationship_to_user,
      executor_relationship_to_user_other: canonicalExecutorSeed.relationship_to_user_other,
      executor_contact_email: rowContact?.contact_email ?? canonicalExecutorSeed.contact_email,
      executor_contact_phone: rowContact?.contact_phone ?? canonicalExecutorSeed.contact_phone,
      executor_authority_level: canonicalExecutorSeed.authority_level,
      executor_authority_level_other: canonicalExecutorSeed.authority_level_other,
      executor_jurisdiction: canonicalExecutorSeed.jurisdiction,
      executor_jurisdiction_other: canonicalExecutorSeed.jurisdiction_other,
      executor_status: canonicalExecutorSeed.executor_status,
      executor_status_other: canonicalExecutorSeed.executor_status_other,
      executor_appointed_on: canonicalExecutorSeed.appointed_on,
      executor_address: canonicalExecutorSeed.executor_address,
      executor_identity_reference: canonicalExecutorSeed.identity_reference,
      executor_beneficiary_reference: canonicalExecutorSeed.beneficiary_reference,
      executor_instruction_reference: canonicalExecutorSeed.instruction_reference,
      task_description: canonicalTaskSeed.description,
      task_related_asset_id: canonicalTaskSeed.related_asset_id,
      task_assigned_executor_asset_id: canonicalTaskSeed.assigned_executor_asset_id,
      task_assigned_beneficiary_asset_id: canonicalTaskSeed.assigned_beneficiary_asset_id,
      task_priority: canonicalTaskSeed.priority,
      task_priority_other: canonicalTaskSeed.priority_other,
      task_status: canonicalTaskSeed.task_status,
      task_status_other: canonicalTaskSeed.task_status_other,
      task_due_date: canonicalTaskSeed.due_date,
      task_completion_date: canonicalTaskSeed.completion_date,
      task_instruction_reference: canonicalTaskSeed.instruction_reference,
      investment_provider: investmentProvider,
      investment_type: String(row.metadata?.investment_type ?? ""),
      investment_reference: String(row.metadata?.investment_reference ?? ""),
      adviser_name: String(row.metadata?.adviser_name ?? ""),
      adviser_company: String(row.metadata?.adviser_company ?? ""),
      adviser_phone: String(row.metadata?.adviser_phone ?? ""),
      adviser_email: String(row.metadata?.adviser_email ?? ""),
      investment_portal_url: String(row.metadata?.investment_portal_url ?? ""),
      ownership_type: String(row.metadata?.ownership_type ?? ""),
      beneficiary_notes: String(row.metadata?.beneficiary_notes ?? ""),
      pension_provider: pensionProvider,
      pension_type: String(row.metadata?.pension_type ?? ""),
      pension_member_number: String(row.metadata?.pension_member_number ?? ""),
      employer_name: String(row.metadata?.employer_name ?? ""),
      scheme_name: String(row.metadata?.scheme_name ?? ""),
      provider_phone: String(row.metadata?.provider_phone ?? ""),
      provider_email: String(row.metadata?.provider_email ?? ""),
      provider_address: String(row.metadata?.provider_address ?? ""),
      pension_portal_url: String(row.metadata?.pension_portal_url ?? ""),
      pension_beneficiary: String(row.metadata?.pension_beneficiary ?? ""),
      insurer_name: insurerName,
      policy_type: String(row.metadata?.policy_type ?? ""),
      policy_number: String(row.metadata?.policy_number ?? ""),
      insured_item: String(row.metadata?.insured_item ?? ""),
      cover_amount: row.metadata?.cover_amount != null ? String(row.metadata?.cover_amount) : (row.value_minor != null ? String(toMajorUnits(row.value_minor)) : ""),
      renewal_date: String(row.metadata?.renewal_date ?? ""),
      insurer_phone: String(row.metadata?.insurer_phone ?? ""),
      insurer_email: String(row.metadata?.insurer_email ?? ""),
      broker_name: String(row.metadata?.broker_name ?? ""),
      broker_contact: String(row.metadata?.broker_contact ?? ""),
      identity_document_type: String(row.metadata?.identity_document_type ?? ""),
      identity_document_type_other: String(row.metadata?.identity_document_type_other ?? ""),
      identity_document_number: String(row.metadata?.identity_document_number ?? ""),
      identity_document_country: String(row.metadata?.identity_document_country ?? ""),
      identity_document_country_other: String(row.metadata?.identity_document_country_other ?? ""),
      identity_issue_date: String(row.metadata?.identity_issue_date ?? ""),
      creditor_name: creditorName,
      debt_type: String(row.metadata?.debt_type ?? ""),
      debt_reference: String(row.metadata?.debt_reference ?? ""),
      outstanding_balance: row.metadata?.outstanding_balance != null ? String(row.metadata?.outstanding_balance) : (row.value_minor != null ? String(toMajorUnits(row.value_minor)) : ""),
      debtor_name: String(row.metadata?.debtor_name ?? ""),
      repayment_amount: String(row.metadata?.repayment_amount ?? ""),
      repayment_frequency: String(row.metadata?.repayment_frequency ?? ""),
      interest_rate: String(row.metadata?.interest_rate ?? ""),
      creditor_phone: String(row.metadata?.creditor_phone ?? ""),
      creditor_email: String(row.metadata?.creditor_email ?? ""),
      creditor_address: String(row.metadata?.creditor_address ?? ""),
    });
    setPendingPhotoFile(null);
    setPendingDocumentFile(null);
    setAssetReviewConfirmed(false);
    resetBankSubmitTrace();
    setFormVisible(true);
    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function cancelForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPendingPhotoFile(null);
    setPendingDocumentFile(null);
    setAssetReviewConfirmed(false);
    setFormVisible(false);
  }

  async function saveRecord() {
    if (saving) return;
    if (viewer.readOnly) {
      setStatus("This linked account is view-only.");
      return;
    }
    setSaving(true);
    setStatus("");
    setSubmitError("");
    pushBankSubmitTrace("submit clicked");
    mergeDevBankContextTrace({
      source: "UniversalRecordWorkspace.saveRecord",
      stage: "bank.save.submit-clicked",
      error: null,
      createdAssetId: null,
      assetInsertReached: false,
    });
    const user = await requireUser(router);
    if (!user) {
      const message = "Save blocked: no active signed-in session.";
      setSubmitError(message);
      setStatus(message);
      pushBankSubmitTrace("submit blocked: no signed-in user");
      mergeDevBankContextTrace({
        source: "UniversalRecordWorkspace.saveRecord",
        stage: "bank.save.auth-missing",
        sessionPresent: false,
        userId: null,
        error: message,
        assetInsertReached: false,
      });
      setSaving(false);
      return;
    }
    mergeDevBankContextTrace({
      source: "UniversalRecordWorkspace.saveRecord",
      stage: "bank.save.user-ready",
      sessionPresent: true,
      userId: user.id,
      error: null,
      assetInsertReached: false,
    });

    const financeDraft = getFinanceDraft(categoryKey, form);
    const canonicalAssetDraft = canonicalCategorySlug
      ? getCanonicalAssetDraft(canonicalCategorySlug, form, {
          taskRelationOptions,
          taskExecutorOptions,
          taskBeneficiaryOptions,
        })
      : null;
    if (isBankCategory && BANK_FORM_CONFIG) {
      const bankErrors = validateAssetFormValues(BANK_FORM_CONFIG, bankFormToConfigValues(form));
      if (!String(financeDraft.metadata.account_holder ?? "").trim()) {
        bankErrors.account_holder = "Account holder is required.";
      }
      const firstBankError = Object.entries(bankErrors).find((entry) => Boolean(entry[1]));
      if (firstBankError) {
        const [fieldKey, message] = firstBankError;
        const fieldLabel =
          fieldKey === "account_holder"
            ? "Account holder"
            : BANK_FORM_CONFIG.fields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
        const fullMessage = `${fieldLabel}: ${message}`;
        setSubmitError(fullMessage);
        setStatus(fullMessage);
        pushBankSubmitTrace(`validation failed: ${fieldKey} -> ${message}`);
        mergeDevBankContextTrace({
          source: "UniversalRecordWorkspace.saveRecord",
          stage: "bank.save.validation-failed",
          userId: user.id,
          error: fullMessage,
          assetInsertReached: false,
        });
        setSaving(false);
        return;
      }
    }
    if (isCanonicalProperty) {
      const propertyMetadata = (canonicalAssetDraft?.metadata ?? {}) as Record<string, unknown>;
      if (!canonicalAssetDraft?.title) {
        setSubmitError("Property name is required.");
        setStatus("Property name is required.");
        pushBankSubmitTrace("validation failed: property name");
        setSaving(false);
        return;
      }
      if (!String(propertyMetadata.property_type ?? "").trim()) {
        setSubmitError("Property Type is required.");
        setStatus("Property Type is required.");
        pushBankSubmitTrace("validation failed: property_type");
        setSaving(false);
        return;
      }
      if (!String(propertyMetadata.ownership_type ?? "").trim()) {
        setStatus("Ownership Type is required.");
        setSaving(false);
        return;
      }
      if (!String(propertyMetadata.property_address ?? "").trim()) {
        setStatus("Address is required.");
        setSaving(false);
        return;
      }
      if (!String(propertyMetadata.property_country ?? "").trim()) {
        setStatus("Country is required.");
        setSaving(false);
        return;
      }
    }
    if (isCanonicalBusiness) {
      const businessMetadata = (canonicalAssetDraft?.metadata ?? {}) as Record<string, unknown>;
      if (!canonicalAssetDraft?.title) {
        setStatus("Business name is required.");
        setSaving(false);
        return;
      }
      if (!String(businessMetadata.business_type ?? "").trim()) {
        setStatus("Business Type is required.");
        setSaving(false);
        return;
      }
      if (!String(businessMetadata.jurisdiction ?? "").trim()) {
        setStatus("Jurisdiction is required.");
        setSaving(false);
        return;
      }
      if (!String(businessMetadata.business_status ?? "").trim()) {
        setStatus("Status is required.");
        setSaving(false);
        return;
      }
    }
    if (isCanonicalDigital) {
      const digitalMetadata = (canonicalAssetDraft?.metadata ?? {}) as Record<string, unknown>;
      if (!canonicalAssetDraft?.title) {
        setStatus("Asset name is required.");
        setSaving(false);
        return;
      }
      if (!String(digitalMetadata.digital_asset_type ?? "").trim()) {
        setStatus("Asset Type is required.");
        setSaving(false);
        return;
      }
      if (!String(digitalMetadata.platform_provider ?? "").trim()) {
        setStatus("Platform / Provider is required.");
        setSaving(false);
        return;
      }
      if (!String(digitalMetadata.jurisdiction ?? "").trim()) {
        setStatus("Jurisdiction is required.");
        setSaving(false);
        return;
      }
      if (!String(digitalMetadata.digital_status ?? "").trim()) {
        setStatus("Status is required.");
        setSaving(false);
        return;
      }
    }
    if (isCanonicalBeneficiary) {
      const beneficiaryMetadata = (canonicalAssetDraft?.metadata ?? {}) as Record<string, unknown>;
      if (!canonicalAssetDraft?.title) {
        setStatus("Full name is required.");
        setSaving(false);
        return;
      }
      if (!String(beneficiaryMetadata.relationship_to_user ?? "").trim()) {
        setStatus("Relationship is required.");
        setSaving(false);
        return;
      }
      if (!String(beneficiaryMetadata.beneficiary_type ?? "").trim()) {
        setStatus("Beneficiary Type is required.");
        setSaving(false);
        return;
      }
      if (!String(beneficiaryMetadata.beneficiary_status ?? "").trim()) {
        setStatus("Status is required.");
        setSaving(false);
        return;
      }
    }
    if (isCanonicalExecutor) {
      const executorMetadata = (canonicalAssetDraft?.metadata ?? {}) as Record<string, unknown>;
      if (!canonicalAssetDraft?.title) {
        setStatus("Full name is required.");
        setSaving(false);
        return;
      }
      if (!String(executorMetadata.executor_type ?? "").trim()) {
        setStatus("Role / Type is required.");
        setSaving(false);
        return;
      }
      if (!String(executorMetadata.relationship_to_user ?? "").trim()) {
        setStatus("Relationship is required.");
        setSaving(false);
        return;
      }
      if (!String(executorMetadata.authority_level ?? "").trim()) {
        setStatus("Authority Level is required.");
        setSaving(false);
        return;
      }
      if (!String(executorMetadata.jurisdiction ?? "").trim()) {
        setStatus("Jurisdiction is required.");
        setSaving(false);
        return;
      }
      if (!String(executorMetadata.executor_status ?? "").trim()) {
        setStatus("Status is required.");
        setSaving(false);
        return;
      }
    }
    if (isCanonicalTask) {
      const taskMetadata = (canonicalAssetDraft?.metadata ?? {}) as Record<string, unknown>;
      if (!canonicalAssetDraft?.title) {
        setStatus("Task title is required.");
        setSaving(false);
        return;
      }
      if (!String(taskMetadata.related_asset_id ?? "").trim()) {
        setStatus("Related Asset / Record is required.");
        setSaving(false);
        return;
      }
      if (!String(taskMetadata.priority ?? "").trim()) {
        setStatus("Priority is required.");
        setSaving(false);
        return;
      }
      if (!String(taskMetadata.task_status ?? "").trim()) {
        setStatus("Status is required.");
        setSaving(false);
        return;
      }
    }
    if (isIdentityDocuments && IDENTITY_DOCUMENT_FORM_CONFIG) {
      const identityErrors = validateAssetFormValues(IDENTITY_DOCUMENT_FORM_CONFIG, identityDocumentFormToConfigValues(form));
      const firstIdentityError = Object.entries(identityErrors).find((entry) => Boolean(entry[1]));
      if (firstIdentityError) {
        const [fieldKey, message] = firstIdentityError;
        const fieldLabel = IDENTITY_DOCUMENT_FORM_CONFIG.fields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
        const fullMessage = `${fieldLabel}: ${message}`;
        setSubmitError(fullMessage);
        setStatus(fullMessage);
        setSaving(false);
        return;
      }
    }
    if (!form.title.trim() && !(isFinanceSection && financeDraft.title) && !(usesCanonicalAssets && canonicalAssetDraft?.title)) {
      const message = isTrustedContacts ? "Please enter the contact's full name before saving." : "Please enter an item title before saving.";
      setSubmitError(message);
      setStatus(message);
      pushBankSubmitTrace("validation failed: title");
      mergeDevBankContextTrace({
        source: "UniversalRecordWorkspace.saveRecord",
        stage: "bank.save.validation-failed",
        userId: user.id,
        error: message,
        assetInsertReached: false,
      });
      setSaving(false);
      return;
    }
    if (Number(form.value_major || 0) < 0) {
      setSubmitError("Estimated value cannot be negative.");
      setStatus("Estimated value cannot be negative.");
      pushBankSubmitTrace("validation failed: negative value");
      mergeDevBankContextTrace({
        source: "UniversalRecordWorkspace.saveRecord",
        stage: "bank.save.validation-failed",
        userId: user.id,
        error: "Estimated value cannot be negative.",
        assetInsertReached: false,
      });
      setSaving(false);
      return;
    }
    if (usesCanonicalAssets && hasStagedExtractionInput && !assetReviewConfirmed) {
      const message = isCanonicalProperty
          ? "Review and confirm the property details before saving."
          : isCanonicalBusiness
            ? "Review and confirm the business details before saving."
            : isCanonicalDigital
              ? "Review and confirm the digital asset details before saving."
              : isCanonicalBeneficiary
                ? "Review and confirm the beneficiary details before saving."
                : isCanonicalExecutor
                  ? "Review and confirm the executor details before saving."
                  : isCanonicalTask
                ? "Review and confirm the task details before saving."
            : "Review and confirm the bank account details before saving.";
      setSubmitError(message);
      setStatus(message);
      pushBankSubmitTrace("validation failed: extraction confirmation not checked");
      mergeDevBankContextTrace({
        source: "UniversalRecordWorkspace.saveRecord",
        stage: "bank.save.validation-failed",
        userId: user.id,
        error: message,
        assetInsertReached: false,
      });
      setSaving(false);
      return;
    }
    pushBankSubmitTrace("validation passed");

    const providerInput = (usesCanonicalAssets ? canonicalAssetDraft?.providerName : isFinanceSection ? financeDraft.providerName : form.provider_name) ?? "";
    const providerMatch = detectProvider(providerInput, catalog);
    const resolvedBankProviderKey = providerMatch?.provider_key ?? null;
    const resolvedLegacyContactRole = form.contact_role.trim() || defaultLegalContactRole || null;
    const metadata = mergeWorkspaceSaveMetadata({
      baseMetadata: {
      notes: form.notes.trim() || null,
      category: isPossessions ? form.possession_category : null,
      subtype: isPossessions ? form.possession_subtype || null : null,
      description: isPossessions ? form.description.trim() || null : null,
      acquired_date: isPossessions ? form.acquired_date || null : null,
      serial_number: isPossessions ? form.serial_number.trim() || null : null,
      location: isPossessions ? form.location.trim() || null : null,
      relationship: isTrustedContacts ? form.contact_role.trim() || null : null,
      mobile_phone: isTrustedContacts ? form.provider_name.trim() || null : null,
      secondary_phone: isTrustedContacts ? form.secondary_phone.trim() || null : null,
      address: isTrustedContacts ? form.address.trim() || null : null,
      preferred_contact_method: isTrustedContacts ? form.preferred_contact_method.trim() || null : null,
      contact_label: isTrustedContacts ? form.contact_label.trim() || null : null,
      identity_document_type: isIdentityDocuments ? form.identity_document_type.trim() || null : null,
      identity_document_type_other: isIdentityDocuments ? form.identity_document_type_other.trim() || null : null,
      identity_document_number: isIdentityDocuments ? form.identity_document_number.trim() || null : null,
      identity_document_country: isIdentityDocuments ? form.identity_document_country.trim() || null : null,
      identity_document_country_other: isIdentityDocuments ? form.identity_document_country_other.trim() || null : null,
      identity_issue_date: isIdentityDocuments ? form.identity_issue_date || null : null,
      renewal_date: isIdentityDocuments ? form.renewal_date || null : null,
      social_profile_url: isSocialMedia ? form.social_profile_url.trim() || null : null,
      social_username: isSocialMedia ? form.social_username.trim() || null : null,
      social_login_email: isSocialMedia ? form.social_login_email.trim() || null : null,
      social_credential_hint: isSocialMedia ? form.social_credential_hint.trim() || null : null,
      social_recovery_notes: isSocialMedia ? form.social_recovery_notes.trim() || null : null,
      finance_category: isFinanceSection ? categoryKey : null,
      },
      financeMetadata: financeDraft.metadata,
      canonicalMetadata: (canonicalAssetDraft?.metadata ?? {}) as Record<string, unknown>,
      usesCanonicalAssets,
    });
    const normalizedMetadata =
      isBankCategory && usesCanonicalAssets
        ? normalizeCanonicalBankMetadata(metadata, {
            provider_name: canonicalAssetDraft?.providerName,
            provider_key: resolvedBankProviderKey,
            currency_code: canonicalAssetDraft?.currencyCode,
            value_major: canonicalAssetDraft?.valueMajor,
          })
        : isCanonicalBeneficiary
          ? normalizeCanonicalBeneficiaryMetadata(metadata)
          : isCanonicalExecutor
            ? normalizeCanonicalExecutorMetadata(metadata)
            : isCanonicalTask
              ? normalizeCanonicalTaskMetadata(metadata)
        : isCanonicalProperty
          ? normalizeCanonicalPropertyMetadata(metadata, {
              currency_code: canonicalAssetDraft?.currencyCode,
              value_major: canonicalAssetDraft?.valueMajor,
            })
          : isCanonicalDigital
            ? normalizeCanonicalDigitalMetadata(metadata, {
                currency_code: canonicalAssetDraft?.currencyCode,
                value_major: canonicalAssetDraft?.valueMajor,
              })
          : isCanonicalBusiness
            ? normalizeCanonicalBusinessMetadata(metadata, {
                currency_code: canonicalAssetDraft?.currencyCode,
                value_major: canonicalAssetDraft?.valueMajor,
              })
          : metadata;

    const canonicalCurrencyCode = usesCanonicalAssets
      ? String(canonicalAssetDraft?.currencyCode ?? "GBP").toUpperCase()
      : isFinanceSection
        ? financeDraft.currencyCode.toUpperCase()
        : (form.currency_code || "GBP").toUpperCase();

    const payload = {
      owner_user_id: user.id,
      section_key: sectionKey,
      category_key: categoryKey,
      title: usesCanonicalAssets ? canonicalAssetDraft?.title ?? null : isFinanceSection ? financeDraft.title : form.title.trim() || null,
      provider_name: usesCanonicalAssets ? canonicalAssetDraft?.providerName ?? null : isFinanceSection ? financeDraft.providerName : isSocialMedia ? form.title.trim() || null : form.provider_name.trim() || null,
      provider_key: resolvedBankProviderKey,
      summary: usesCanonicalAssets
        ? canonicalAssetDraft?.summary ?? null
        : isFinanceSection
        ? financeDraft.summary
        : isSocialMedia
        ? [form.social_username.trim(), form.social_profile_url.trim()].filter(Boolean).join(" · ") || null
        : isTrustedContacts
        ? [form.contact_role.trim(), form.contact_email.trim()].filter(Boolean).join(" · ") || null
        : legalLinkedContactDefinition
        ? [resolvedLegacyContactRole, form.contact_name.trim() || form.contact_email.trim()].filter(Boolean).join(" · ") || null
        : form.summary.trim() || null,
      value_minor: isTrustedContacts ? null : usesCanonicalAssets ? toMinorUnits(canonicalAssetDraft?.valueMajor ?? "0") : isFinanceSection ? toMinorUnits(financeDraft.valueMajor) : toMinorUnits(form.value_major),
      currency_code: canonicalCurrencyCode,
      metadata: normalizedMetadata,
      updated_at: new Date().toISOString(),
    };
    pushBankSubmitTrace(
      `payload prepared: title="${String(payload.title ?? "").trim() || "n/a"}" provider="${String(payload.provider_name ?? "").trim() || "n/a"}" category="${canonicalCategorySlug ?? categoryKey}"`,
    );

    let recordId = editingId;
    try {
      if (usesCanonicalAssets) {
        const assetInput = {
          userId: user.id,
          categorySlug: canonicalCategorySlug as "bank-accounts" | "property" | "business-interests" | "digital-assets" | "beneficiaries" | "executors" | "tasks",
          title: String(payload.title ?? "").trim(),
          metadata: normalizedMetadata,
          visibility: "private" as const,
        };
        pushBankSubmitTrace(
          `createAsset started: slug="${assetInput.categorySlug}" title="${assetInput.title || "n/a"}" provider_key="${resolvedBankProviderKey ?? "n/a"}"`,
        );
        mergeDevBankContextTrace({
          source: "UniversalRecordWorkspace.saveRecord",
          stage: "bank.save.create-asset-started",
          userId: user.id,
          error: null,
          assetInsertReached: false,
        });
        const assetResult = editingId
          ? await updateAsset(supabase, {
              assetId: editingId,
              ...assetInput,
            })
          : await createAsset(supabase, assetInput);
        recordId = assetResult.id;
        if (isCanonicalExecutor && recordId) {
          const executorContactMetadata = normalizedMetadata as Record<string, unknown>;
          await syncCanonicalContact(supabase, {
            ownerUserId: user.id,
            fullName: String(payload.title ?? "").trim() || "Contact",
            email: form.executor_contact_email.trim() || null,
            phone: form.executor_contact_phone.trim() || null,
            contactRole: String(executorContactMetadata["executor_type"] ?? "").trim() || "executor",
            relationship: String(executorContactMetadata["relationship_to_user"] ?? "").trim() || null,
            sourceType: "executor_asset",
            link: {
              sourceKind: "asset",
              sourceId: recordId,
              sectionKey,
              categoryKey,
              label: String(payload.title ?? "").trim() || "Executor",
              role: String(executorContactMetadata["executor_type"] ?? "").trim() || "executor",
            },
          });
        }
        pushBankSubmitTrace(`createAsset success: asset_id="${recordId}"`);
        mergeDevBankContextTrace({
          source: "UniversalRecordWorkspace.saveRecord",
          stage: "bank.save.create-asset-success",
          userId: user.id,
          createdAssetId: recordId,
          error: null,
          assetInsertReached: true,
        });
      } else if (editingId) {
        const updateResult = await supabase
          .from("records")
          .update(payload)
          .eq("id", editingId)
          .eq("owner_user_id", user.id)
          .select("id")
          .single();
        if (updateResult.error) {
          throw new Error(updateResult.error.message);
        }
        recordId = updateResult.data.id;
      } else {
        const insertResult = await supabase.from("records").insert(payload).select("id").single();
        if (insertResult.error) {
          throw new Error(insertResult.error.message);
        }
        recordId = insertResult.data.id;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setSubmitError(message);
      setStatus(`Save failed: ${message}`);
      const redirectHref = getPlanLimitRedirectHref(error);
      if (redirectHref) {
        router.push(redirectHref);
      }
      pushBankSubmitTrace(`createAsset error: ${message}`);
      mergeDevBankContextTrace({
        source: "UniversalRecordWorkspace.saveRecord",
        stage: "bank.save.error",
        userId: user.id,
        error: message,
        assetInsertReached: false,
      });
      setSaving(false);
      return;
    }

    let uploadWarning = "";
    if (recordId) {
      const hasContact =
        form.contact_name.trim() ||
        form.contact_email.trim() ||
        form.contact_role.trim() ||
        (isTrustedContacts && form.title.trim()) ||
        (isTrustedContacts && form.provider_name.trim());
      const managesLegacyRecordContacts =
        !usesCanonicalAssets
        && (isTrustedContacts || contacts.some((item) => item.record_id === recordId) || Boolean(form.contact_name.trim() || form.contact_email.trim() || form.contact_role.trim()));
      if (managesLegacyRecordContacts) {
        const existingCanonicalContactId = resolveSavedCanonicalContactIdForSource(
          contacts.map((item) => ({
            sourceId: item.record_id,
            contactId: item.contact_id,
            createdAt: item.created_at,
          })),
          recordId,
        );
        await supabase.from("record_contacts").delete().eq("record_id", recordId).eq("owner_user_id", user.id);
        try {
          await unlinkCanonicalContactSource(supabase, {
            ownerUserId: user.id,
            sourceKind: "record",
            sourceId: recordId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          setStatus(`Saved record, but contact unlink failed: ${message}`);
        }
        if (hasContact) {
          try {
            const canonicalContact = await syncCanonicalContact(supabase, {
              ownerUserId: user.id,
              existingContactId: existingCanonicalContactId,
              fullName: isTrustedContacts ? form.title.trim() || "Contact" : form.contact_name.trim() || "Contact",
              email: form.contact_email.trim() || null,
              phone: isTrustedContacts ? form.provider_name.trim() || null : null,
              contactRole: isTrustedContacts ? "next_of_kin" : resolvedLegacyContactRole,
              relationship: isTrustedContacts ? form.contact_role.trim() || null : null,
              sourceType: isTrustedContacts ? "next_of_kin" : "record_contact",
              link: {
                sourceKind: "record",
                sourceId: recordId,
                sectionKey,
                categoryKey,
                label: isTrustedContacts ? "Next of kin" : legalLinkedContactDefinition?.contactNameLabel ?? "Record contact",
                role: isTrustedContacts ? form.contact_role.trim() || null : resolvedLegacyContactRole,
              },
            });

            const contactResult = await supabase.from("record_contacts").insert({
              record_id: recordId,
              owner_user_id: user.id,
              contact_id: canonicalContact.id,
              contact_name: canonicalContact.full_name,
              contact_email: canonicalContact.email,
              contact_role: canonicalContact.relationship ?? canonicalContact.contact_role,
              notes: form.notes.trim() || null,
            });
            if (contactResult.error) {
              setStatus(`Saved record, but contact failed: ${contactResult.error.message}`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setStatus(`Saved record, but contact failed: ${message}`);
          }
        }
      }

      if (pendingDocumentFile) {
        const documentUpload = await uploadAttachmentAfterSave({
          userId: user.id,
          recordId,
          file: pendingDocumentFile,
        });
        if (!documentUpload.ok) {
          uploadWarning = documentUpload.error;
        }
      }

      if (pendingPhotoFile) {
        const photoUpload = await uploadAttachmentAfterSave({
          userId: user.id,
          recordId,
          file: pendingPhotoFile,
        });
        if (!photoUpload.ok) {
          uploadWarning = uploadWarning
            ? `${uploadWarning} ${photoUpload.error}`
            : photoUpload.error;
        }
      }
    }

    setStatus(uploadWarning ? `Saved successfully. ${uploadWarning}` : "Saved successfully.");
    pushBankSubmitTrace(`reload started: asset_id="${recordId ?? ""}"`);
    mergeDevBankContextTrace({
      source: "UniversalRecordWorkspace.saveRecord",
      stage: "bank.save.reload-started",
      userId: user.id,
      createdAssetId: recordId ?? null,
      error: null,
      assetInsertReached: true,
    });
    cancelForm();
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus, {
      targetOwnerUserId: viewer.targetOwnerUserId,
      forceCanonicalRead,
      recordFilter,
    });
    if (recordId && usesCanonicalAssets) {
      pushBankSubmitTrace(`sync notified: section="${sectionKey}" category="${categoryKey}" asset_id="${recordId}"`);
      notifyCanonicalAssetMutation({
        assetId: recordId,
        sectionKey,
        categoryKey,
        source: "UniversalRecordWorkspace.saveRecord",
      });
      pushBankSubmitTrace("router.refresh triggered");
      router.refresh();
    }
    pushBankSubmitTrace(`reload completed: asset_id="${recordId ?? ""}"`);
    mergeDevBankContextTrace({
      source: "UniversalRecordWorkspace.saveRecord",
      stage: "bank.save.reload-complete",
      userId: user.id,
      createdAssetId: recordId ?? null,
      error: null,
      assetInsertReached: true,
    });
    setSaving(false);
  }

  async function archiveRecord(recordId: string) {
    if (viewer.readOnly) {
      setStatus("This linked account is view-only.");
      return;
    }
    setArchivingFor(recordId);
    setStatus("");
    const user = await requireUser(router);
    if (!user) {
      setArchivingFor(null);
      return;
    }
    const result = usesCanonicalAssets
      ? await supabase
          .from("assets")
          .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", recordId)
          .eq("owner_user_id", user.id)
          .is("deleted_at", null)
      : await supabase
          .from("records")
          .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", recordId)
          .eq("owner_user_id", user.id);
    setArchivingFor(null);
    if (result.error) {
      setStatus(`Archive failed: ${result.error.message}`);
      return;
    }
    setStatus("Record archived.");
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus, {
      targetOwnerUserId: viewer.targetOwnerUserId,
      forceCanonicalRead,
      recordFilter,
    });
  }

  async function deleteRecord(recordId: string) {
    if (viewer.readOnly) {
      setStatus("This linked account is view-only.");
      return;
    }
    const confirmed = window.confirm("Delete this record permanently?");
    if (!confirmed) return;
    const user = await requireUser(router);
    if (!user) return;

    const relatedAttachments = attachments.filter((item) => item.record_id === recordId);
    if (relatedAttachments.length) {
      const byBucket = groupByBucket(relatedAttachments);
      await Promise.all(Object.entries(byBucket).map(([bucket, paths]) => supabase.storage.from(bucket).remove(paths)));
    }

    const result = usesCanonicalAssets
      ? await supabase
          .from("assets")
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", recordId)
          .eq("owner_user_id", user.id)
          .is("deleted_at", null)
      : await supabase.from("records").delete().eq("id", recordId).eq("owner_user_id", user.id);
    if (result.error) {
      setStatus(`Delete failed: ${result.error.message}`);
      return;
    }
    try {
      if (usesCanonicalAssets && isCanonicalExecutor) {
        await unlinkCanonicalContactSource(supabase, {
          ownerUserId: user.id,
          sourceKind: "asset",
          sourceId: recordId,
        });
      }
      if (!usesCanonicalAssets && (isTrustedContacts || contacts.some((item) => item.record_id === recordId))) {
        await unlinkCanonicalContactSource(supabase, {
          ownerUserId: user.id,
          sourceKind: "record",
          sourceId: recordId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Record deleted, but contact link cleanup failed: ${message}`);
    }
    setStatus("Record deleted.");
    setOpenRecordId((prev) => (prev === recordId ? null : prev));
    if (editingId === recordId) cancelForm();
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus, {
      targetOwnerUserId: viewer.targetOwnerUserId,
      forceCanonicalRead,
      recordFilter,
    });
  }

  async function uploadAttachment(recordId: string, file: File, kind: "document" | "photo") {
    if (viewer.readOnly) {
      setStatus("This linked account is view-only.");
      return;
    }
    const validation = validateUploadFile(file, {
      allowedMimeTypes: kind === "photo" ? ["image/jpeg", "image/png"] : ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: 15 * 1024 * 1024,
    });
    if (!validation.ok) {
      const allowed = kind === "photo" ? "JPG, PNG" : "PDF, JPG, PNG";
      setStatus(`${validation.error}. Allowed: ${allowed} up to 15MB.`);
      return;
    }

    const user = await requireUser(router);
    if (!user) return;

    setUploadingFor(recordId);
    setStatus("");
    const assetContext = await resolveCanonicalAssetDocumentContext(supabase, {
      assetId: recordId,
      ownerUserId: user.id,
    });
    if (!assetContext) {
      setUploadingFor(null);
      setStatus("Upload blocked: the selected asset context could not be resolved.");
      return;
    }

    const parentLabel = getCanonicalAssetDocumentParentLabel(assetContext);
    setStatus(kind === "photo" ? `Uploading photo to ${parentLabel}...` : `Uploading document to ${parentLabel}...`);
    const metadataResult = await createCanonicalAssetDocument(supabase, {
      context: assetContext,
      file,
      kind,
    });
    setUploadingFor(null);
    if (!metadataResult.ok) {
      setStatus(metadataResult.error);
      return;
    }

    setStatus(kind === "photo" ? `Photo uploaded to ${parentLabel}.` : `Attachment uploaded to ${parentLabel}.`);
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus, {
      targetOwnerUserId: viewer.targetOwnerUserId,
      forceCanonicalRead,
      recordFilter,
    });
  }

  async function removeAttachment(item: RecordAttachment) {
    if (viewer.readOnly) {
      setStatus("This linked account is view-only.");
      return;
    }
    const confirmed = window.confirm(`Remove "${item.file_name}" from this record?`);
    if (!confirmed) return;
    const user = await requireUser(router);
    if (!user) return;

    const storageResult = await supabase.storage.from(item.storage_bucket).remove([item.storage_path]);
    if (storageResult.error) {
      setStatus(`Could not remove file from storage: ${storageResult.error.message}`);
      return;
    }

    const deleteResult =
      item.source_table === "documents"
        ? await supabase
            .from("documents")
            .delete()
            .eq("id", item.id)
            .eq("owner_user_id", user.id)
        : await supabase
            .from("attachments")
            .delete()
            .eq("id", item.id)
            .eq("owner_user_id", user.id);
    if (deleteResult.error) {
      setStatus(`File removed, but metadata delete failed: ${deleteResult.error.message}`);
      return;
    }
    setStatus("Attachment removed.");
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus, {
      targetOwnerUserId: viewer.targetOwnerUserId,
      forceCanonicalRead,
      recordFilter,
    });
  }

  async function downloadAttachment(item: RecordAttachment) {
    const signedUrl = await getAttachmentSignedUrl(item, 120);
    if (!signedUrl) {
      setStatus(`Could not download ${item.file_name || "this file"}.`);
      return;
    }

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        setStatus(`Could not download file: ${response.status} ${response.statusText}`);
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = item.file_name || "document";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (error) {
      setStatus(`Could not download file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function printAttachment(item: RecordAttachment) {
    if (!isPrintableDocumentMimeType(item.mime_type)) {
      setStatus("Print is available for PDF and image files only.");
      return;
    }

    const signedUrl = await getAttachmentSignedUrl(item, 120);
    if (!signedUrl) {
      setStatus(`Could not print ${item.file_name || "this file"}.`);
      return;
    }

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        setStatus(`Could not prepare file for print: ${response.status} ${response.statusText}`);
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
      printFrame.src = objectUrl;
      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } finally {
          setTimeout(() => {
            printFrame.remove();
            URL.revokeObjectURL(objectUrl);
          }, 30_000);
        }
      };
      document.body.appendChild(printFrame);
    } catch (error) {
      setStatus(`Could not print file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const renderRow = (row: UniversalRecordRow) => {
    const canonicalBankAsset =
      isBankCategory
        ? normalizeBankAssetRow({
            title: row.title,
            provider_name: row.provider_name,
            provider_key: row.provider_key,
            currency_code: row.currency_code,
            value_minor: row.value_minor,
            metadata: row.metadata,
          })
        : null;
    const bankProviderName = canonicalBankAsset?.provider_name || canonicalBankAsset?.title || "Unnamed bank account";
    const providerInput =
      (isBankCategory ? bankProviderName : null) ??
      row.provider_name ??
      row.provider_key ??
      row.title ??
      String(
        (categoryKey === "bank"
          ? row.metadata?.provider_name ?? row.metadata?.institution_name ?? row.metadata?.bank_name
          : categoryKey === "investments"
            ? row.metadata?.investment_provider
            : categoryKey === "pensions"
              ? row.metadata?.pension_provider
              : categoryKey === "insurance"
                ? row.metadata?.insurer_name
                : categoryKey === "debts"
                  ? row.metadata?.creditor_name
                  : "") ?? "",
      );
    const provider =
      findProviderByKey(row.provider_key, catalog) ??
      detectProvider(providerInput, catalog);
    const canonicalPropertyAsset =
      isCanonicalProperty
        ? readCanonicalPropertyAsset({
            title: row.title,
            currency_code: row.currency_code,
            value_minor: row.value_minor,
            metadata: row.metadata,
          })
        : null;
    const canonicalBusinessAsset =
      isCanonicalBusiness
        ? readCanonicalBusinessAsset({
            title: row.title,
            currency_code: row.currency_code,
            value_minor: row.value_minor,
            metadata: row.metadata,
          })
        : null;
    const canonicalBeneficiaryAsset =
      isCanonicalBeneficiary
        ? readCanonicalBeneficiaryAsset({
            title: row.title,
            metadata: row.metadata,
          })
        : null;
    const canonicalExecutorAsset =
      isCanonicalExecutor
        ? readCanonicalExecutorAsset({
            title: row.title,
            metadata: row.metadata,
          })
        : null;
    const canonicalTaskAsset =
      isCanonicalTask
        ? readCanonicalTaskAsset({
            title: row.title,
            metadata: row.metadata,
          })
        : null;
    const canonicalDigitalAsset =
      isCanonicalDigital
        ? readCanonicalDigitalAsset({
            title: row.title,
            currency_code: row.currency_code,
            value_minor: row.value_minor,
            metadata: row.metadata,
          })
        : null;
    const rowAttachments = attachments.filter((item) => item.record_id === row.id);
    const attachmentGalleryItems = rowAttachments.map((item) => ({
      id: item.id,
      fileName: item.file_name,
      mimeType: item.mime_type,
      createdAt: item.created_at,
      thumbnailUrl: item.document_kind === "photo" ? photoPreviews[row.id] ?? "" : "",
      metaLabel: item.parent_label || "",
      attachment: item,
    }));

    const rowContacts = contacts.filter((item) => item.record_id === row.id);
    const primaryContact = rowContacts[0] ?? null;
    const isOpen = openRecordId === row.id;
    const categoryKeyFromRow = String(row.metadata?.category ?? "");
    const categoryLabel =
      isPossessions && categoryKeyFromRow
        ? optionLabel(personalPossessionCategories, categoryKeyFromRow, categoryKeyFromRow)
        : null;

    const previewUrl = photoPreviews[row.id];
    const thumbFailed = failedThumbs[row.id] === true;
    const leadingVisualWidth = previewUrl && !thumbFailed ? 40 : 32;

    return (
      <article key={row.id} style={recordCardStyle} className="lf-record-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {previewUrl && !thumbFailed ? (
              <div style={thumbWrapStyle}>
                <img
                  src={previewUrl}
                  alt={row.title ? `${row.title} photo` : "Possession photo"}
                  width={38}
                  height={38}
                  style={{ objectFit: "cover", width: 38, height: 38 }}
                  onError={() => {
                    setFailedThumbs((prev) => ({ ...prev, [row.id]: true }));
                  }}
                />
              </div>
            ) : (
              <ProviderBadge
                provider={provider}
                fallbackLabel={isBankCategory ? bankProviderName : row.provider_name ?? row.title ?? "Record"}
                categoryKey={isPossessions ? categoryKeyFromRow : isFinanceSection ? categoryKey : undefined}
              />
            )}
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 700 }}>
                {isBankCategory ? bankProviderName : row.title || "Untitled record"}
              </div>
              {isTrustedContacts ? (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {primaryContact?.contact_role || String(row.metadata?.relationship ?? "Relationship not set")}
                    {" · "}
                    {primaryContact?.contact_email || "No email"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Mobile: {String(row.metadata?.mobile_phone ?? row.provider_name ?? "Not set")}
                    {" · "}
                    Secondary: {String(row.metadata?.secondary_phone ?? "Not set")}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Address: {String(row.metadata?.address ?? "Not set")}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Updated {formatDate(row.updated_at)}</div>
                </>
              ) : isCanonicalDigital ? (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalDigitalAsset?.digital_summary || "Digital asset"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalDigitalAsset?.jurisdiction || "Jurisdiction not set"}
                    {canonicalDigitalAsset?.wallet_reference ? " · Reference on file" : ""}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {formatCurrency(
                      canonicalDigitalAsset?.estimated_value_major ?? toMajorUnits(row.value_minor),
                      canonicalDigitalAsset?.currency_code || (row.currency_code ?? "GBP").toUpperCase(),
                    )}{" "}
                    · Updated {formatDate(row.updated_at)}
                  </div>
                </>
              ) : isCanonicalBeneficiary ? (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalBeneficiaryAsset?.beneficiary_summary || "Beneficiary"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalBeneficiaryAsset?.contact_email || "No email"}
                    {" · "}
                    {canonicalBeneficiaryAsset?.contact_phone || "No phone"}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {canonicalBeneficiaryAsset?.preferred_name ? `${canonicalBeneficiaryAsset.preferred_name} · ` : ""}
                    Updated {formatDate(row.updated_at)}
                  </div>
                </>
              ) : isCanonicalExecutor ? (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {primaryContact?.contact_role || canonicalExecutorAsset?.executor_summary || "Executor / trusted contact"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalExecutorAsset?.jurisdiction || primaryContact?.relationship || "Jurisdiction not set"}
                    {" · "}
                    {primaryContact?.verification_status || canonicalExecutorAsset?.executor_status || "Status not set"}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {canonicalExecutorAsset?.appointed_on ? `Appointed ${canonicalExecutorAsset.appointed_on} · ` : ""}
                    Updated {formatDate(row.updated_at)}
                  </div>
                </>
              ) : isCanonicalTask ? (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalTaskAsset?.task_summary || "Task"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalTaskAsset?.related_asset_label || "No related asset"}
                    {canonicalTaskAsset?.due_date ? ` · Due ${canonicalTaskAsset.due_date}` : ""}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {canonicalTaskAsset?.assigned_executor_label || canonicalTaskAsset?.assigned_beneficiary_label || "Unassigned"}
                    {" · "}
                    Updated {formatDate(row.updated_at)}
                  </div>
                </>
              ) : isCanonicalBusiness ? (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalBusinessAsset?.business_summary || "Business interest"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalBusinessAsset?.jurisdiction || "Jurisdiction not set"}
                    {canonicalBusinessAsset?.registration_number ? " · Registration on file" : ""}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {formatCurrency(
                      canonicalBusinessAsset?.estimated_value_major ?? toMajorUnits(row.value_minor),
                      canonicalBusinessAsset?.currency_code || (row.currency_code ?? "GBP").toUpperCase(),
                    )}{" "}
                    · Updated {formatDate(row.updated_at)}
                  </div>
                </>
              ) : isCanonicalProperty ? (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalPropertyAsset?.property_summary || "Property"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {canonicalPropertyAsset?.property_address || "Address not set"}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {formatCurrency(
                      canonicalPropertyAsset?.estimated_value_major ?? toMajorUnits(row.value_minor),
                      canonicalPropertyAsset?.currency_code || (row.currency_code ?? "GBP").toUpperCase(),
                    )}{" "}
                    · Updated {formatDate(row.updated_at)}
                  </div>
                </>
              ) : isFinanceSection ? (
                <>
                  {categoryKey === "bank" ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {canonicalBankAsset?.account_type || "Account"}
                      {" · "}
                      {canonicalBankAsset?.account_holder || "Holder not set"}
                    </div>
                  ) : null}
                  {categoryKey === "bank" ? (
                    <div style={maskedRowStyle}>
                      <MaskedField label="Account" value={canonicalBankAsset?.account_number ?? ""} />
                      <MaskedField label="Sort code" value={canonicalBankAsset?.sort_code ?? ""} />
                    </div>
                  ) : null}
                  {categoryKey === "investments" ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {String(row.metadata?.investment_type ?? "Investment")} · Ref: {String(row.metadata?.investment_reference ?? "Not set")}
                    </div>
                  ) : null}
                  {categoryKey === "pensions" ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {String(row.metadata?.pension_type ?? "Pension")} · Member no: {String(row.metadata?.pension_member_number ?? "Not set")}
                    </div>
                  ) : null}
                  {categoryKey === "insurance" ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {String(row.metadata?.policy_type ?? "Policy")} · {String(row.metadata?.policy_number ?? "No policy number")} · {String(row.metadata?.insured_item ?? "Insured item not set")}
                    </div>
                  ) : null}
                  {categoryKey === "debts" ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {String(row.metadata?.debt_type ?? "Debt")} · Ref: {String(row.metadata?.debt_reference ?? "Not set")}
                    </div>
                  ) : null}
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {formatCurrency(
                      canonicalBankAsset?.current_balance ?? toMajorUnits(row.value_minor),
                      canonicalBankAsset?.currency || (row.currency_code ?? "GBP").toUpperCase(),
                    )} · Updated {formatDate(row.updated_at)}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {isIdentityDocuments
                      ? [String(row.metadata?.identity_document_type ?? ""), String(row.metadata?.identity_document_number ?? "").trim() ? "Reference on file" : ""].filter(Boolean).join(" · ") || "Identity document"
                      : row.summary || "No summary provided."}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {categoryLabel ? `${categoryLabel} · ` : ""}
                    {formatCurrency(toMajorUnits(row.value_minor), (row.currency_code ?? "GBP").toUpperCase())}
                    {" · "}
                    Updated {formatDate(row.updated_at)}
                  </div>
                  {primaryContact && legalLinkedContactDefinition ? (
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      {legalLinkedContactDefinition.contactNameLabel}: {primaryContact.contact_name || "Not set"}
                      {primaryContact.contact_role ? ` · ${primaryContact.contact_role}` : ""}
                    </div>
                  ) : null}
                </>
              )}
              {attachmentGalleryItems.length > 0 ? (
                <AttachmentGallerySummary items={attachmentGalleryItems} />
              ) : null}
              <div style={recordUpdateStampStyle}>
                Last updated by {viewer.mode === "linked" ? viewer.accountHolderName : "you"} on {formatDate(row.updated_at)}
              </div>
            </div>
          </div>
          <span style={row.status === "archived" ? archivedPillStyle : activePillStyle}>
            {row.status === "archived" ? "Archived" : "Active"}
          </span>
        </div>

        <div style={{ ...recordActionsStyle, marginLeft: leadingVisualWidth + 10 }} className="lf-record-card-actions">
          {!viewer.readOnly ? <ActionIconButton action="edit" label="Edit record" onClick={() => startEdit(row)} /> : null}
          {isPossessions || usesCanonicalAssets ? (
            <ActionIconButton
              action="attachments"
              label={isOpen ? "Hide documents" : attachmentGalleryItems.length > 0 ? `Open document${attachmentGalleryItems.length === 1 ? "" : "s"}` : "Documents"}
              onClick={() => setOpenRecordId((prev) => (prev === row.id ? null : row.id))}
            />
          ) : null}
          {!viewer.readOnly ? <ActionIconButton action="delete" label="Delete record" onClick={() => void deleteRecord(row.id)} /> : null}
          {!viewer.readOnly && !isPossessions && !isTrustedContacts && !usesCanonicalAssets && !isFinanceSection ? (
            <>
              <button type="button" style={ghostBtn} onClick={() => setOpenRecordId((prev) => (prev === row.id ? null : row.id))}>
                {isOpen ? "Hide" : "View"}
              </button>
              {row.status !== "archived" ? (
                <button type="button" style={ghostBtn} disabled={archivingFor === row.id} onClick={() => void archiveRecord(row.id)}>
                  {archivingFor === row.id ? "Archiving..." : "Archive"}
                </button>
              ) : null}
              <label style={ghostBtn}>
                {uploadingFor === row.id ? "Uploading..." : "Upload document"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAttachment(row.id, file, "document");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </>
          ) : null}
        </div>

        {isOpen ? (
          <div style={detailsPanelStyle}>
            {isPossessions ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                <div>Description: {String(row.metadata?.description ?? "No description")}</div>
                <div>Acquired: {String(row.metadata?.acquired_date ?? "Not set")}</div>
                <div>Reference / serial: {String(row.metadata?.serial_number ?? "Not set")}</div>
                <div>Location: {String(row.metadata?.location ?? "Not set")}</div>
              </div>
            ) : isCanonicalDigital ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                <div>Asset type: {canonicalDigitalAsset?.digital_asset_type || "Not set"}</div>
                <div>Platform / provider: {canonicalDigitalAsset?.platform_provider || "Not set"}</div>
                <div>Jurisdiction: {canonicalDigitalAsset?.jurisdiction || "Not set"}</div>
                <div>Access contact / custodian: {canonicalDigitalAsset?.access_contact || "Not set"}</div>
                <div>Status: {canonicalDigitalAsset?.digital_status || "Not set"}</div>
                <div>Valuation date: {canonicalDigitalAsset?.valuation_date || "Not set"}</div>
                <div>
                  <MaskedField label="Wallet / account reference" value={canonicalDigitalAsset?.wallet_reference ?? ""} />
                </div>
                <div>Notes: {canonicalDigitalAsset?.notes || "No additional notes."}</div>
              </div>
            ) : isCanonicalBeneficiary ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                <div>Relationship: {canonicalBeneficiaryAsset?.relationship_to_user || "Not set"}</div>
                <div>Beneficiary type: {canonicalBeneficiaryAsset?.beneficiary_type || "Not set"}</div>
                <div>Status: {canonicalBeneficiaryAsset?.beneficiary_status || "Not set"}</div>
                <div>Preferred name: {canonicalBeneficiaryAsset?.preferred_name || "Not set"}</div>
                <div>Contact email: {canonicalBeneficiaryAsset?.contact_email || "Not set"}</div>
                <div>Contact phone: {canonicalBeneficiaryAsset?.contact_phone || "Not set"}</div>
                <div>Country: {canonicalBeneficiaryAsset?.country_code || "Not set"}</div>
                <div>Date of birth: {canonicalBeneficiaryAsset?.date_of_birth || "Not set"}</div>
                <div>Share: {canonicalBeneficiaryAsset?.share_percentage ? `${canonicalBeneficiaryAsset.share_percentage}%` : "Not set"}</div>
                <div>
                  <MaskedField label="Address" value={canonicalBeneficiaryAsset?.beneficiary_address ?? ""} />
                </div>
                <div>
                  <MaskedField label="Identification reference" value={canonicalBeneficiaryAsset?.identification_reference ?? ""} />
                </div>
                <div>Notes: {canonicalBeneficiaryAsset?.notes || "No additional notes."}</div>
              </div>
            ) : isCanonicalExecutor ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                <div>Role / type: {canonicalExecutorAsset?.executor_type || "Not set"}</div>
                <div>Relationship: {primaryContact?.relationship || canonicalExecutorAsset?.relationship_to_user || "Not set"}</div>
                <div>Authority level: {canonicalExecutorAsset?.authority_level || "Not set"}</div>
                <div>Jurisdiction: {canonicalExecutorAsset?.jurisdiction || "Not set"}</div>
                <div>Status: {primaryContact?.verification_status || canonicalExecutorAsset?.executor_status || "Not set"}</div>
                <div>Appointed on: {canonicalExecutorAsset?.appointed_on || "Not set"}</div>
                <div>Beneficiary reference: {canonicalExecutorAsset?.beneficiary_reference || "Not set"}</div>
                <div>Instruction reference: {canonicalExecutorAsset?.instruction_reference || "Not set"}</div>
                <div>
                  <MaskedField label="Email" value={primaryContact?.contact_email ?? canonicalExecutorAsset?.contact_email ?? ""} />
                </div>
                <div>
                  <MaskedField label="Phone" value={primaryContact?.contact_phone ?? canonicalExecutorAsset?.contact_phone ?? ""} />
                </div>
                <div>
                  <MaskedField label="Address" value={canonicalExecutorAsset?.executor_address ?? ""} />
                </div>
                <div>
                  <MaskedField label="Identity reference" value={canonicalExecutorAsset?.identity_reference ?? ""} />
                </div>
                <div>Notes: {canonicalExecutorAsset?.notes || "No additional notes."}</div>
              </div>
            ) : isCanonicalTask ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                <div>Description: {canonicalTaskAsset?.description || "No description."}</div>
                <div>Related asset / record: {canonicalTaskAsset?.related_asset_label || "Not set"}</div>
                <div>Assigned executor: {canonicalTaskAsset?.assigned_executor_label || "Not set"}</div>
                <div>Assigned beneficiary: {canonicalTaskAsset?.assigned_beneficiary_label || "Not set"}</div>
                <div>Priority: {canonicalTaskAsset?.priority || "Not set"}</div>
                <div>Status: {canonicalTaskAsset?.task_status || "Not set"}</div>
                <div>Due date: {canonicalTaskAsset?.due_date || "Not set"}</div>
                <div>Completion date: {canonicalTaskAsset?.completion_date || "Not set"}</div>
                <div>Instruction / wish reference: {canonicalTaskAsset?.instruction_reference || "Not set"}</div>
                <div>Notes: {canonicalTaskAsset?.notes || "No additional notes."}</div>
              </div>
            ) : isCanonicalBusiness ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                <div>Business type: {canonicalBusinessAsset?.business_type || "Not set"}</div>
                <div>Jurisdiction: {canonicalBusinessAsset?.jurisdiction || "Not set"}</div>
                <div>Ownership: {canonicalBusinessAsset?.ownership_percentage ? `${canonicalBusinessAsset.ownership_percentage}%` : "Not set"}</div>
                <div>Role / title: {canonicalBusinessAsset?.role_title || "Not set"}</div>
                <div>Status: {canonicalBusinessAsset?.business_status || "Not set"}</div>
                <div>Valuation date: {canonicalBusinessAsset?.valuation_date || "Not set"}</div>
                <div>
                  <MaskedField label="Registration" value={canonicalBusinessAsset?.registration_number ?? ""} />
                </div>
                <div>Notes: {canonicalBusinessAsset?.notes || "No additional notes."}</div>
              </div>
            ) : isCanonicalProperty ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                <div>Property type: {canonicalPropertyAsset?.property_type || "Not set"}</div>
                <div>Ownership type: {canonicalPropertyAsset?.ownership_type || "Not set"}</div>
                <div>Address: {canonicalPropertyAsset?.property_address || "Not set"}</div>
                <div>Country: {canonicalPropertyAsset?.property_country || "Not set"}</div>
                <div>Valuation date: {canonicalPropertyAsset?.valuation_date || "Not set"}</div>
                <div>Mortgage status: {canonicalPropertyAsset?.mortgage_status || "Not set"}</div>
                <div>Mortgage lender: {canonicalPropertyAsset?.mortgage_lender || "Not set"}</div>
                <div>
                  Mortgage balance:{" "}
                  {canonicalPropertyAsset?.mortgage_balance_major
                    ? formatCurrency(
                        canonicalPropertyAsset.mortgage_balance_major,
                        canonicalPropertyAsset.currency_code || (row.currency_code ?? "GBP").toUpperCase(),
                      )
                    : "Not set"}
                </div>
                <div>Notes: {canonicalPropertyAsset?.notes || "No additional notes."}</div>
              </div>
            ) : isFinanceSection ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                {categoryKey === "bank" ? (
                  <>
                    <div>Provider: {canonicalBankAsset?.provider_name || "Not set"}</div>
                    <div>Provider key: {canonicalBankAsset?.provider_key || "Not set"}</div>
                    <div>Account type: {canonicalBankAsset?.account_type || "Not set"}</div>
                    <div>Account holder: {canonicalBankAsset?.account_holder || "Not set"}</div>
                    <div>Country: {canonicalBankAsset?.country || "Not set"}</div>
                    <div>Currency: {canonicalBankAsset?.currency || "Not set"}</div>
                    <div>
                      Current balance:{" "}
                      {canonicalBankAsset?.current_balance
                        ? formatCurrency(
                            canonicalBankAsset.current_balance,
                            canonicalBankAsset.currency || (row.currency_code ?? "GBP").toUpperCase(),
                          )
                        : "Not set"}
                    </div>
                    <div>Valuation date: {canonicalBankAsset?.valuation_date || "Not set"}</div>
                    <div>
                      <MaskedField label="Account number" value={canonicalBankAsset?.account_number ?? ""} />
                    </div>
                    <div>
                      <MaskedField label="Sort code" value={canonicalBankAsset?.sort_code ?? ""} />
                    </div>
                    <div>
                      <MaskedField label="IBAN" value={canonicalBankAsset?.iban ?? ""} />
                    </div>
                  </>
                ) : null}
                {categoryKey === "bank" ? (
                  <div>
                    <MaskedField label="SWIFT / BIC" value={String(row.metadata?.swift_bic ?? "")} />
                  </div>
                ) : null}
                {categoryKey === "investments" ? <div>Ownership: {String(row.metadata?.ownership_type ?? "Not set")}</div> : null}
                {categoryKey === "pensions" ? <div>Scheme: {String(row.metadata?.scheme_name ?? "Not set")}</div> : null}
                {categoryKey === "insurance" ? <div>Renewal date: {String(row.metadata?.renewal_date ?? "Not set")}</div> : null}
                {categoryKey === "debts" ? <div>Repayment: {String(row.metadata?.repayment_amount ?? "Not set")} ({String(row.metadata?.repayment_frequency ?? "frequency not set")})</div> : null}
                <div>Notes: {categoryKey === "bank" ? canonicalBankAsset?.notes || "No additional notes." : String(row.metadata?.notes ?? "No additional notes.")}</div>
              </div>
            ) : isIdentityDocuments ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                <div>Document type: {String(row.metadata?.identity_document_type ?? "Not set")}</div>
                <div>
                  <MaskedField label="Document number" value={String(row.metadata?.identity_document_number ?? "")} />
                </div>
                <div>Issuing country: {String(row.metadata?.identity_document_country ?? "Not set")}</div>
                <div>Issue date: {String(row.metadata?.identity_issue_date ?? "Not set")}</div>
                <div>Renewal / expiry date: {String(row.metadata?.renewal_date ?? "Not set")}</div>
                <div>Notes: {String(row.metadata?.notes ?? "No additional notes.")}</div>
              </div>
            ) : (
              <div style={{ color: "#475569", fontSize: 13 }}>
                {(row.metadata?.notes as string | undefined) || "No additional notes."}
              </div>
            )}

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Attachments & photos</div>
              {isFinanceSection || isPossessions || usesCanonicalAssets ? (
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Parent asset: {getCanonicalAssetDocumentParentLabel({
                    assetTitle: canonicalBankAsset?.title || canonicalPropertyAsset?.title || canonicalBusinessAsset?.title || canonicalDigitalAsset?.title || row.title || "",
                    sectionKey,
                    categoryKey,
                  })}
                </div>
              ) : null}
              {rowAttachments.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: 13 }}>No files uploaded.</div>
              ) : (
                <AttachmentGallery
                  items={attachmentGalleryItems}
                  emptyText="No files uploaded."
                  onResolvePreviewUrl={(entry) => getAttachmentSignedUrl(entry.attachment, 120)}
                  onDownload={(entry) => void downloadAttachment(entry.attachment)}
                  onPrint={(entry) => void printAttachment(entry.attachment)}
                  onRemove={viewer.readOnly ? undefined : (entry) => void removeAttachment(entry.attachment)}
                />
              )}
            </div>

            {usesCanonicalAssets && !viewer.readOnly ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label style={ghostBtn}>
                  {uploadingFor === row.id
                    ? "Uploading..."
                    : `Upload document to ${canonicalBankAsset?.title ?? canonicalPropertyAsset?.title ?? canonicalBusinessAsset?.title ?? canonicalDigitalAsset?.title ?? row.title ?? "this asset"}`}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAttachment(row.id, file, "document");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <label style={ghostBtn}>
                  {uploadingFor === row.id ? "Uploading..." : "Add picture"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAttachment(row.id, file, "photo");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            ) : null}

            {rowContacts.length > 0 ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Linked contacts</div>
                {rowContacts.map((item) => (
                  <div key={item.id} style={{ color: "#475569", fontSize: 13 }}>
                    {item.contact_id ? (
                      <Link href={buildContactsWorkspaceHref(item.contact_id)} style={linkedContactLinkStyle}>
                        {item.contact_name || "Unnamed contact"}
                      </Link>
                    ) : (
                      <span>{item.contact_name || "Unnamed contact"}</span>
                    )}
                    {item.relationship ? ` · ${item.relationship}` : item.contact_role ? ` · ${item.contact_role}` : ""}
                    {item.contact_email ? ` · ${item.contact_email}` : ""}
                    {item.contact_phone ? ` · ${item.contact_phone}` : ""}
                    {item.invite_status ? ` · ${item.invite_status.replace(/_/g, " ")}` : ""}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  const possessionSubtypes = personalPossessionSubcategories[form.possession_category] ?? [];

  return (
    <section id={sectionId} style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{subtitle}</p>
      </div>

      {isPossessions ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Completion: {activeRecords.length} active · {archivedRecords.length} archived · {totals.missingValue} missing value
        </div>
      ) : null}

      {!isTrustedContacts ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Active value: {formatCurrency(totals.active, "GBP")} · Archived value: {formatCurrency(totals.archived, "GBP")}
        </div>
      ) : null}

      {status ? <div style={{ color: "#475569", fontSize: 13 }}>{status}</div> : null}
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
              Auth/context: session <code>{devBankContextTrace?.sessionPresent == null ? "n/a" : devBankContextTrace.sessionPresent ? "yes" : "no"}</code> · user <code>{devBankContextTrace?.userId ?? "n/a"}</code> · organisation <code>{devBankContextTrace?.organisationId ?? "n/a"}</code> · wallet <code>{devBankContextTrace?.walletId ?? "n/a"}</code>
            </div>
            <div>
              Current stage: <code>{devBankContextTrace?.stage ?? "n/a"}</code> · asset insert reached <code>{devBankContextTrace?.assetInsertReached ? "yes" : "no"}</code>
            </div>
            {devBankContextTrace?.error ? (
              <div>
                Current error: <code>{devBankContextTrace.error}</code>
              </div>
            ) : null}
            <div>
              Latest create: {
                (() => {
                  const entry = devBankTraceEntries.filter((item) => item.kind === "create").at(-1);
                  return (
                    <>
                      user <code>{entry?.userId ?? "n/a"}</code> · organisation <code>{entry?.organisationId ?? "n/a"}</code> · wallet <code>{entry?.walletId ?? "n/a"}</code> · asset <code>{entry?.createdAssetId ?? "n/a"}</code>
                    </>
                  );
                })()
              }
            </div>
            <div>
              Latest bank page load: {
                (() => {
                  const entry = devBankTraceEntries.filter((item) => item.kind === "bank-load").at(-1);
                  return (
                    <>
                      user <code>{entry?.userId ?? "n/a"}</code> · organisation <code>{entry?.organisationId ?? "n/a"}</code> · wallet <code>{entry?.walletId ?? "n/a"}</code> · ids <code>{(entry?.assetIds ?? []).join(", ") || "none"}</code>
                    </>
                  );
                })()
              }
            </div>
            <div>
              Bank category trace: {
                (() => {
                  const entry = devBankTraceEntries.filter((item) => item.kind === "bank-load").at(-1);
                  return <code>{(entry?.assetCategoryTokens ?? []).join(", ") || entry?.assetCategoryToken || "none"}</code>;
                })()
              }
            </div>
            <div>
              Build marker: <code>{DEV_BANK_BUILD_MARKER}</code>
            </div>
            {devBankSubmitTrace.length ? (
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 12 }}>Submit trace</strong>
                {devBankSubmitTrace.map((step, index) => (
                  <code key={`${index}-${step}`} style={{ whiteSpace: "pre-wrap" }}>{step}</code>
                ))}
              </div>
            ) : null}
            {devBankRequestTrace.length ? (
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 12 }}>Assets request trace</strong>
                {devBankRequestTrace.slice(-12).map((step, index) => (
                  <code key={`${index}-${step}`} style={{ whiteSpace: "pre-wrap" }}>{step}</code>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {devBankTraceEnabled ? (
        <aside
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            width: "min(520px, calc(100vw - 32px))",
            maxHeight: "45vh",
            overflow: "auto",
            zIndex: 70,
            border: "1px solid #f59e0b",
            borderRadius: 12,
            background: "#111827",
            color: "#f8fafc",
            padding: 12,
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.3)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="lan" size={16} />
            <strong style={{ fontSize: 13 }}>DEV PostgREST trace</strong>
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1" }}>
            {DEV_BANK_BUILD_MARKER}
          </div>
          {devBankRequestTrace.length ? (
            devBankRequestTrace.slice(-14).map((step, index) => (
              <code key={`${index}-${step}`} style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#fde68a" }}>{step}</code>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>No PostgREST assets requests captured yet.</div>
          )}
        </aside>
      ) : null}

      {!loading && hasAnyRecords ? (
      <section style={cardStyle} ref={formSectionRef}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Existing records</h2>
          {!viewer.readOnly ? <button type="button" style={primaryBtn} onClick={startCreate}>
            {addLabel}
          </button> : null}
        </div>

        {!isTrustedContacts ? (
          <div className="lf-content-grid">
            <label style={fieldStyle}>
              <span style={labelStyle}>
                <Icon name="search" size={16} />
                Search
              </span>
              <input
                style={inputStyle}
                placeholder={getWorkspaceSearchPlaceholder({
                  isPossessions,
                  isCanonicalTask,
                  isCanonicalBeneficiary,
                  isCanonicalExecutor,
                })}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>
                <Icon name="filter_alt" size={16} />
                State
              </span>
              <select style={inputStyle} value={recordStatusFilter} onChange={(event) => setRecordStatusFilter(event.target.value as typeof recordStatusFilter)}>
                <option value="all">All records</option>
                <option value="active">Active only</option>
                <option value="archived">Archived only</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>
                <Icon name="swap_vert" size={16} />
                Sort
              </span>
              <select style={inputStyle} value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="updated_desc">Recently updated</option>
                <option value="updated_asc">Oldest updated</option>
                <option value="value_desc">Highest value</option>
                <option value="value_asc">Lowest value</option>
              </select>
            </label>
            {isPossessions ? (
              <label style={fieldStyle}>
                <span style={labelStyle}>
                  <Icon name="category" size={16} />
                  Category
                </span>
                <select style={inputStyle} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="all">All categories</option>
                  {personalPossessionCategories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {loading ? <div style={{ color: "#64748b" }}>Loading records...</div> : null}
        {!loading && filteredRecords.length === 0 ? (
          <div style={{ color: "#64748b" }}>
            {hasDiscoveryFilters ? "No records match the current search or filters." : "No records yet."}
          </div>
        ) : null}
        {!loading && activeRecords.length > 0 ? <div style={{ display: "grid", gap: 10 }}>{activeRecords.map(renderRow)}</div> : null}
        </section>
      ) : null}

      {archivedRecords.length > 0 ? (
        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Archived records</h2>
          <div style={{ display: "grid", gap: 10 }}>{archivedRecords.map(renderRow)}</div>
        </section>
      ) : null}

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>
            {editingId
              ? isTrustedContacts
                ? "Edit contact"
                : isCanonicalBeneficiary
                  ? "Edit beneficiary"
                  : isCanonicalExecutor
                    ? "Edit executor"
                    : isCanonicalTask
                      ? "Edit task"
                  : "Edit record"
              : isTrustedContacts
                ? "Add new contact"
                : isCanonicalBeneficiary
                  ? "Add new beneficiary"
                  : isCanonicalExecutor
                    ? "Add new executor"
                    : isCanonicalTask
                      ? "Add new task"
                  : "Add new record"}
          </h2>
          {formVisible ? <button type="button" style={ghostBtn} onClick={cancelForm}>Cancel</button> : null}
        </div>

        {!formVisible ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Click <strong>{addLabel}</strong> to create a new record.
            </div>
            {!hasAnyRecords ? (
              <div>
                {!viewer.readOnly ? <button type="button" style={primaryBtn} onClick={startCreate}>
                  {addLabel}
                </button> : null}
              </div>
            ) : null}
          </div>
        ) : usesStructuredWorkspaceForm ? (
          <FinanceFields
            sectionKey={sectionKey}
            categoryKey={categoryKey}
            form={form}
            setForm={setForm}
            taskRelationOptions={taskRelationOptions}
            taskExecutorOptions={taskExecutorOptions}
            taskBeneficiaryOptions={taskBeneficiaryOptions}
          />
        ) : (
        <div className="lf-content-grid">
          <label style={fieldStyle}>
            <span style={labelStyle}>{isTrustedContacts ? "Full name" : "Item title"}</span>
            <input style={inputStyle} value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
          </label>
          {isPossessions ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Category</span>
              <select
                style={inputStyle}
                value={form.possession_category}
                onChange={(event) => setForm((prev) => ({ ...prev, possession_category: event.target.value, possession_subtype: "" }))}
              >
                {personalPossessionCategories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label style={fieldStyle}>
              <span style={labelStyle}>{isTrustedContacts ? "Mobile phone" : "Provider or service"}</span>
              <input style={inputStyle} value={form.provider_name} onChange={(event) => setForm((prev) => ({ ...prev, provider_name: event.target.value }))} />
            </label>
          )}
          {isPossessions ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Subtype</span>
              <select style={inputStyle} value={form.possession_subtype} onChange={(event) => setForm((prev) => ({ ...prev, possession_subtype: event.target.value }))}>
                <option value="">Not set</option>
                {possessionSubtypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label style={fieldStyle}>
              <span style={labelStyle}>{isTrustedContacts ? "Relationship" : "Summary"}</span>
              <input
                style={inputStyle}
                value={isTrustedContacts ? form.contact_role : form.summary}
                onChange={(event) =>
                  setForm((prev) =>
                    isTrustedContacts
                      ? { ...prev, contact_role: event.target.value }
                      : { ...prev, summary: event.target.value },
                  )
                }
              />
            </label>
          )}
          {isTrustedContacts ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Email</span>
              <input style={inputStyle} value={form.contact_email} onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))} />
            </label>
          ) : null}
          {isTrustedContacts ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Secondary phone</span>
              <input style={inputStyle} value={form.secondary_phone} onChange={(event) => setForm((prev) => ({ ...prev, secondary_phone: event.target.value }))} />
            </label>
          ) : null}
          {isTrustedContacts ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Address</span>
              <input style={inputStyle} value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
            </label>
          ) : null}
          {isTrustedContacts ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Preferred contact method</span>
              <input style={inputStyle} value={form.preferred_contact_method} onChange={(event) => setForm((prev) => ({ ...prev, preferred_contact_method: event.target.value }))} />
            </label>
          ) : null}
          {isTrustedContacts ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Contact label</span>
              <input style={inputStyle} value={form.contact_label} onChange={(event) => setForm((prev) => ({ ...prev, contact_label: event.target.value }))} />
            </label>
          ) : null}
          {!isTrustedContacts ? (
          <label style={fieldStyle}>
            <span style={labelStyle}>Estimated value</span>
            <input type="number" step="0.01" style={inputStyle} value={form.value_major} onChange={(event) => setForm((prev) => ({ ...prev, value_major: event.target.value }))} />
          </label>
          ) : null}
          {!isTrustedContacts ? (
          <label style={fieldStyle}>
            <span style={labelStyle}>Currency</span>
            <input style={inputStyle} value={form.currency_code} onChange={(event) => setForm((prev) => ({ ...prev, currency_code: event.target.value.toUpperCase() }))} maxLength={3} />
          </label>
          ) : null}
          {isPossessions ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Description</span>
              <input style={inputStyle} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </label>
          ) : null}
          {isPossessions ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Purchase / acquired date</span>
              <input type="date" style={inputStyle} value={form.acquired_date} onChange={(event) => setForm((prev) => ({ ...prev, acquired_date: event.target.value }))} />
            </label>
          ) : null}
          {isPossessions ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Reference / serial number</span>
              <input style={inputStyle} value={form.serial_number} onChange={(event) => setForm((prev) => ({ ...prev, serial_number: event.target.value }))} />
            </label>
          ) : null}
          {isPossessions ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Location</span>
              <input style={inputStyle} value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
            </label>
          ) : null}
          <label style={fieldStyle}>
            <span style={labelStyle}>Notes</span>
            <textarea style={textAreaStyle} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
          {!isTrustedContacts ? (
            <>
              <label style={fieldStyle}>
                <span style={labelStyle}>{legalLinkedContactDefinition?.contactNameLabel ?? "Contact name"}</span>
                <input style={inputStyle} value={form.contact_name} onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>{legalLinkedContactDefinition?.contactEmailLabel ?? "Contact email"}</span>
                <input style={inputStyle} value={form.contact_email} onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>{legalLinkedContactDefinition?.contactRoleLabel ?? "Contact role"}</span>
                <input style={inputStyle} value={form.contact_role} onChange={(event) => setForm((prev) => ({ ...prev, contact_role: event.target.value }))} />
              </label>
            </>
          ) : null}
        </div>
        )}

        {formVisible ? (
          <div style={{ display: "grid", gap: 12 }}>
            {submitError ? (
              <div
                style={{
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 13,
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                  <Icon name="error" size={16} />
                  Save blocked
                </div>
                <div>{submitError}</div>
              </div>
            ) : null}
            {usesCanonicalAssets && !editingId ? (
              <div className="lf-content-grid">
                <FormField label="Statement or supporting document" iconName="upload_file" helpText="This file will be attached to the asset after save.">
                  <FileDropzone
                    label={pendingDocumentFile ? "Replace document" : "Drop a document here"}
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    file={pendingDocumentFile}
                    onFileSelect={(file) => {
                      const validation = validateUploadFile(file, {
                        allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
                        maxBytes: 15 * 1024 * 1024,
                      });
                      if (!validation.ok) {
                        setStatus(`${validation.error}. Allowed: PDF, JPG, PNG up to 15MB.`);
                        return;
                      }
                      setPendingDocumentFile(file);
                    }}
                    onClear={() => setPendingDocumentFile(null)}
                    disabled={saving}
                  />
                </FormField>
                <FormField
                  label={isCanonicalTask ? "Task image" : isCanonicalExecutor ? "Executor image" : isCanonicalBeneficiary ? "Beneficiary image" : isCanonicalProperty ? "Property photo" : isCanonicalBusiness ? "Business image" : isCanonicalDigital ? "Digital asset image" : "Photo or cheque image"}
                  iconName="add_a_photo"
                  helpText={
                    isCanonicalTask
                      ? "Optional image preview for the task card."
                      : isCanonicalExecutor
                      ? "Optional image preview for the executor card."
                      : isCanonicalBeneficiary
                      ? "Optional image preview for the beneficiary card."
                      : isCanonicalProperty
                      ? "Optional image preview for the property asset card."
                      : isCanonicalBusiness
                        ? "Optional image preview for the business asset card."
                        : isCanonicalDigital
                          ? "Optional image preview for the digital asset card."
                        : "Optional image preview for the bank asset card."
                  }
                >
                  <FileDropzone
                    label={pendingPhotoFile ? "Replace image" : "Drop an image here"}
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    file={pendingPhotoFile}
                    onFileSelect={(file) => {
                      const validation = validateUploadFile(file, {
                        allowedMimeTypes: ["image/jpeg", "image/png"],
                        maxBytes: 15 * 1024 * 1024,
                      });
                      if (!validation.ok) {
                        setStatus(`${validation.error}. Allowed: JPG, PNG up to 15MB.`);
                        return;
                      }
                      setPendingPhotoFile(file);
                    }}
                    onClear={() => setPendingPhotoFile(null)}
                    disabled={saving}
                  />
                </FormField>
              </div>
            ) : null}
            {usesCanonicalAssets && hasStagedExtractionInput ? (
              <label style={confirmationCardStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                  <Icon name="fact_check" size={18} />
                  Extraction confirmation
                </span>
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  {isCanonicalTask
                    ? "Confirm the task details and any staged document uploads before saving this asset."
                    : isCanonicalExecutor
                    ? "Confirm the executor details and any staged document uploads before saving this asset."
                    : isCanonicalBeneficiary
                    ? "Confirm the beneficiary details and any staged document uploads before saving this asset."
                    : isCanonicalProperty
                    ? "Confirm the property details and any staged document uploads before saving this asset."
                    : isCanonicalBusiness
                      ? "Confirm the business interest details and any staged document uploads before saving this asset."
                      : isCanonicalDigital
                        ? "Confirm the digital asset details and any staged document uploads before saving this asset."
                    : "Confirm the account details and any staged document uploads before saving this asset."}
                </span>
                <span style={{ color: "#334155", fontSize: 13 }}>
                  {isCanonicalTask
                    ? [
                        form.title.trim() || "Task",
                        form.task_priority === "__other" ? form.task_priority_other.trim() || "Priority not set" : form.task_priority || "Priority not set",
                        form.task_status === "__other" ? form.task_status_other.trim() || "Status not set" : form.task_status || "Status not set",
                      ].join(" · ")
                    : isCanonicalExecutor
                    ? [
                        form.title.trim() || "Executor",
                        form.executor_type === "__other" ? form.executor_type_other.trim() || "Role not set" : form.executor_type || "Role not set",
                        form.executor_status === "__other" ? form.executor_status_other.trim() || "Status not set" : form.executor_status || "Status not set",
                      ].join(" · ")
                    : isCanonicalBeneficiary
                    ? [
                        form.title.trim() || "Beneficiary",
                        form.beneficiary_relationship_to_user === "__other" ? form.beneficiary_relationship_to_user_other.trim() || "Relationship not set" : form.beneficiary_relationship_to_user || "Relationship not set",
                        form.beneficiary_status === "__other" ? form.beneficiary_status_other.trim() || "Status not set" : form.beneficiary_status || "Status not set",
                      ].join(" · ")
                    : isCanonicalProperty
                    ? [
                        form.title.trim() || "Property asset",
                        form.property_address.trim() || "No address yet",
                        form.mortgage_status === "__other" ? form.mortgage_status_other.trim() || "Mortgage status not set" : form.mortgage_status || "Mortgage status not set",
                      ].join(" · ")
                    : isCanonicalBusiness
                      ? [
                          form.title.trim() || "Business interest",
                          form.business_type === "__other" ? form.business_type_other.trim() || "Business type not set" : form.business_type || "Business type not set",
                          form.business_status === "__other" ? form.business_status_other.trim() || "Status not set" : form.business_status || "Status not set",
                        ].join(" · ")
                      : isCanonicalDigital
                        ? [
                            form.title.trim() || "Digital asset",
                            form.digital_asset_type === "__other" ? form.digital_asset_type_other.trim() || "Asset type not set" : form.digital_asset_type || "Asset type not set",
                            form.digital_status === "__other" ? form.digital_status_other.trim() || "Status not set" : form.digital_status || "Status not set",
                          ].join(" · ")
                    : `${form.bank_name.trim() || form.title.trim() || "Bank account"} · ${form.account_number ? maskAllButLast(form.account_number) : "No account number yet"} · ${form.sort_code ? maskAllButLast(form.sort_code) : "No sort code yet"}`}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={assetReviewConfirmed}
                    onChange={(event) => setAssetReviewConfirmed(event.target.checked)}
                    disabled={saving}
                  />
                  {isCanonicalTask
                    ? "I confirm these task details and staged files are correct before save."
                    : isCanonicalExecutor
                    ? "I confirm these executor details and staged files are correct before save."
                    : isCanonicalBeneficiary
                    ? "I confirm these beneficiary details and staged files are correct before save."
                    : isCanonicalProperty
                    ? "I confirm these property details and staged files are correct before save."
                    : isCanonicalBusiness
                      ? "I confirm these business details and staged files are correct before save."
                      : isCanonicalDigital
                        ? "I confirm these digital asset details and staged files are correct before save."
                    : "I confirm these bank details and staged files are correct before save."}
                </span>
              </label>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(isPossessions || isFinanceSection) && !editingId ? (
              <>
                {!usesCanonicalAssets ? <label style={ghostBtn}>
                  {pendingPhotoFile ? `Picture selected: ${pendingPhotoFile.name}` : "Add picture"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (!file) return;
                      const validation = validateUploadFile(file, {
                        allowedMimeTypes: ["image/jpeg", "image/png"],
                        maxBytes: 15 * 1024 * 1024,
                      });
                      if (!validation.ok) {
                        setStatus(`${validation.error}. Allowed: JPG, PNG up to 15MB.`);
                        return;
                      }
                      setPendingPhotoFile(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label> : null}
                {!usesCanonicalAssets ? <label style={ghostBtn}>
                  {pendingDocumentFile ? `Document selected: ${pendingDocumentFile.name}` : "Upload document"}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (!file) return;
                      const validation = validateUploadFile(file, {
                        allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
                        maxBytes: 15 * 1024 * 1024,
                      });
                      if (!validation.ok) {
                        setStatus(`${validation.error}. Allowed: PDF, JPG, PNG up to 15MB.`);
                        return;
                      }
                      setPendingDocumentFile(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label> : null}
              </>
            ) : null}
            {!viewer.readOnly ? <button type="button" style={primaryBtn} disabled={saving} onClick={() => void saveRecord()}>
              <Icon name="save" size={16} style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
              {saving ? "Saving..." : editingId ? "Save changes" : saveLabel}
            </button> : null}
            <button type="button" style={ghostBtn} onClick={cancelForm}>
              <Icon name="close" size={16} />
              Cancel
            </button>
            {editingId && !viewer.readOnly ? (
              <button type="button" style={dangerBtn} onClick={() => void deleteRecord(editingId)}>
                <Icon name="delete" size={16} />
                Delete
              </button>
            ) : null}
            {editingId && !viewer.readOnly ? (
              <>
                <label style={ghostBtn}>
                  <Icon name="upload_file" size={16} />
                  Upload document to {form.title.trim() || form.bank_name.trim() || "this asset"}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAttachment(editingId, file, "document");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <label style={ghostBtn}>
                  <Icon name="add_a_photo" size={16} />
                  Add photo to {form.title.trim() || form.bank_name.trim() || "this asset"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAttachment(editingId, file, "photo");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </>
            ) : null}
          </div>
          </div>
        ) : null}

        {formVisible && editingId ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Current attachments</div>
            {attachments.filter((item) => item.record_id === editingId).length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>No attachments yet for this asset.</div>
            ) : (
              <AttachmentGallery
                items={attachments
                  .filter((item) => item.record_id === editingId)
                  .map((item) => ({
                    id: item.id,
                    fileName: item.file_name,
                    mimeType: item.mime_type,
                    createdAt: item.created_at,
                    thumbnailUrl: item.document_kind === "photo" ? photoPreviews[item.record_id] ?? "" : "",
                    attachment: item,
                  }))}
                emptyText="No attachments yet for this asset."
                onResolvePreviewUrl={(entry) => getAttachmentSignedUrl(entry.attachment, 120)}
                onDownload={(entry) => void downloadAttachment(entry.attachment)}
                onPrint={(entry) => void printAttachment(entry.attachment)}
                onRemove={viewer.readOnly ? undefined : (entry) => void removeAttachment(entry.attachment)}
              />
            )}
          </div>
        ) : null}
      </section>
    </section>
  );
}

function FinanceFields({
  sectionKey,
  categoryKey,
  form,
  setForm,
  taskRelationOptions = [],
  taskExecutorOptions = [],
  taskBeneficiaryOptions = [],
}: {
  sectionKey: string;
  categoryKey: string;
  form: EditForm;
  setForm: (value: EditForm | ((prev: EditForm) => EditForm)) => void;
  taskRelationOptions?: Array<{ value: string; label: string }>;
  taskExecutorOptions?: Array<{ value: string; label: string }>;
  taskBeneficiaryOptions?: Array<{ value: string; label: string }>;
}) {
  if (sectionKey === "personal" && categoryKey === "tasks") {
    if (!TASK_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Task form configuration is unavailable.</div>;
    }
    const taskValues = taskFormToConfigValues(form);
    const taskConfig = buildTaskConfig(TASK_FORM_CONFIG, {
      relatedAssetOptions: taskRelationOptions,
      executorOptions: taskExecutorOptions,
      beneficiaryOptions: taskBeneficiaryOptions,
    });
    const taskErrors = validateAssetFormValues(taskConfig, taskValues);

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <FormSection title="Task" description="Track the action and attach it to a real canonical asset or record.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(taskConfig, ["title", "description", "related_asset_id", "priority", "task_status"])}
            values={taskValues}
            errors={taskErrors}
            onChange={(key, value) => {
              setForm((prev) => applyTaskConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Assignment" description="Optionally assign the task to canonical executor or beneficiary records.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(taskConfig, ["assigned_executor_asset_id", "assigned_beneficiary_asset_id", "instruction_reference"])}
            values={taskValues}
            errors={taskErrors}
            onChange={(key, value) => {
              setForm((prev) => applyTaskConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Dates & notes" description="Track due and completion dates plus any supporting notes.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(taskConfig, ["due_date", "completion_date", "notes"])}
            values={taskValues}
            errors={taskErrors}
            onChange={(key, value) => {
              setForm((prev) => applyTaskConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
      </div>
    );
  }

  if (sectionKey === "legal" && categoryKey === "identity-documents") {
    if (!IDENTITY_DOCUMENT_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Identity document form configuration is unavailable.</div>;
    }
    const legalContactDefinition = getLegalLinkedContactDefinition(categoryKey);
    const identityValues = identityDocumentFormToConfigValues(form);
    const identityErrors = validateAssetFormValues(IDENTITY_DOCUMENT_FORM_CONFIG, identityValues);

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <FormSection title="Document details" description="Keep the key identity reference details in the saved record, then attach scans or photos below.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(IDENTITY_DOCUMENT_FORM_CONFIG, ["title", "identity_document_type", "identity_document_number", "identity_document_country"])}
            values={identityValues}
            errors={identityErrors}
            onChange={(key, value) => {
              setForm((prev) => applyIdentityDocumentConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Dates and notes" description="Track issue and renewal dates so the document can be reviewed without opening edit mode later.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(IDENTITY_DOCUMENT_FORM_CONFIG, ["identity_issue_date", "renewal_date", "notes"])}
            values={identityValues}
            errors={identityErrors}
            onChange={(key, value) => {
              setForm((prev) => applyIdentityDocumentConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection
          title={legalContactDefinition?.contactNameLabel ?? "Linked contact"}
          description={legalContactDefinition?.description ?? "Optionally link the named person or family contact attached to this document."}
        >
          <div className="lf-content-grid">
            <FieldInput label={legalContactDefinition?.contactNameLabel ?? "Contact name"} value={form.contact_name} onChange={(value) => setForm((prev) => ({ ...prev, contact_name: value }))} />
            <FieldInput label={legalContactDefinition?.contactEmailLabel ?? "Contact email"} value={form.contact_email} onChange={(value) => setForm((prev) => ({ ...prev, contact_email: value }))} />
            <FieldInput label={legalContactDefinition?.contactRoleLabel ?? "Contact role"} value={form.contact_role} onChange={(value) => setForm((prev) => ({ ...prev, contact_role: value }))} />
          </div>
        </FormSection>
      </div>
    );
  }

  if (sectionKey === "digital" && categoryKey === "digital") {
    if (!DIGITAL_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Digital form configuration is unavailable.</div>;
    }
    const digitalValues = digitalFormToConfigValues(form);
    const digitalErrors = validateAssetFormValues(DIGITAL_FORM_CONFIG, digitalValues);

    return (
      <div className="lf-content-grid">
        <ConfigDrivenAssetFields
          config={DIGITAL_FORM_CONFIG}
          values={digitalValues}
          errors={digitalErrors}
          onChange={(key, value) => {
            setForm((prev) => applyDigitalConfigFieldChange(prev, key, value));
          }}
        />
      </div>
    );
  }

  if (sectionKey === "personal" && categoryKey === "social-media") {
    if (!SOCIAL_MEDIA_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Social media form configuration is unavailable.</div>;
    }
    const socialValues = socialMediaFormToConfigValues(form);
    const socialErrors = validateAssetFormValues(SOCIAL_MEDIA_FORM_CONFIG, socialValues);

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <FormSection title="Account" description="Capture the platform, profile URL, and handle so someone can recognise and locate the account quickly.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(SOCIAL_MEDIA_FORM_CONFIG, ["title", "social_profile_url", "social_username", "social_login_email"])}
            values={socialValues}
            errors={socialErrors}
            onChange={(key, value) => {
              setForm((prev) => applySocialMediaConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Access & recovery" description="Store hints and recovery notes only when they help with handover and review.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(SOCIAL_MEDIA_FORM_CONFIG, ["social_credential_hint", "social_recovery_notes", "notes"])}
            values={socialValues}
            errors={socialErrors}
            onChange={(key, value) => {
              setForm((prev) => applySocialMediaConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
      </div>
    );
  }

  if (sectionKey === "personal" && categoryKey === "beneficiaries") {
    if (!BENEFICIARY_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Beneficiary form configuration is unavailable.</div>;
    }
    const beneficiaryValues = beneficiaryFormToConfigValues(form);
    const beneficiaryErrors = validateAssetFormValues(BENEFICIARY_FORM_CONFIG, beneficiaryValues);

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <FormSection title="Identity" description="Core beneficiary identity and date of birth details.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(BENEFICIARY_FORM_CONFIG, ["title", "preferred_name", "date_of_birth", "identification_reference"])}
            values={beneficiaryValues}
            errors={beneficiaryErrors}
            onChange={(key, value) => {
              setForm((prev) => applyBeneficiaryConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Relationship" description="Define how this beneficiary relates to you and how they should be treated.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(BENEFICIARY_FORM_CONFIG, ["relationship_to_user", "beneficiary_type", "beneficiary_status", "share_percentage"])}
            values={beneficiaryValues}
            errors={beneficiaryErrors}
            onChange={(key, value) => {
              setForm((prev) => applyBeneficiaryConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Contact details" description="Use the shared contact fields for beneficiary communications.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(BENEFICIARY_FORM_CONFIG, ["contact_email", "contact_phone"])}
            values={beneficiaryValues}
            errors={beneficiaryErrors}
            onChange={(key, value) => {
              setForm((prev) => applyBeneficiaryConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Address" description="Store address details only when they are needed for estate administration.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(BENEFICIARY_FORM_CONFIG, ["beneficiary_address", "country_code"])}
            values={beneficiaryValues}
            errors={beneficiaryErrors}
            onChange={(key, value) => {
              setForm((prev) => applyBeneficiaryConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Supporting information" description="Capture any extra context or executor notes.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(BENEFICIARY_FORM_CONFIG, ["notes"])}
            values={beneficiaryValues}
            errors={beneficiaryErrors}
            onChange={(key, value) => {
              setForm((prev) => applyBeneficiaryConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
      </div>
    );
  }

  if (sectionKey === "personal" && categoryKey === "executors") {
    if (!EXECUTOR_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Executor form configuration is unavailable.</div>;
    }
    const executorValues = executorFormToConfigValues(form);
    const executorErrors = validateAssetFormValues(EXECUTOR_FORM_CONFIG, executorValues);

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <FormSection title="Identity" description="Core identity and role details for the executor or trusted contact.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(EXECUTOR_FORM_CONFIG, ["title", "executor_type", "appointed_on", "identity_reference"])}
            values={executorValues}
            errors={executorErrors}
            onChange={(key, value) => {
              setForm((prev) => applyExecutorConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Relationship" description="Capture relationship, authority, and jurisdiction for this contact.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(EXECUTOR_FORM_CONFIG, ["relationship_to_user", "authority_level", "jurisdiction", "executor_status"])}
            values={executorValues}
            errors={executorErrors}
            onChange={(key, value) => {
              setForm((prev) => applyExecutorConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Contact details" description="Sensitive contact details are stored through the encrypted payload path only.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(EXECUTOR_FORM_CONFIG, ["contact_email", "contact_phone", "executor_address"])}
            values={executorValues}
            errors={executorErrors}
            onChange={(key, value) => {
              setForm((prev) => applyExecutorConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
        <FormSection title="Supporting links" description="Reference related beneficiaries or wishes by name only; no new schema links are introduced.">
          <ConfigDrivenAssetFields
            config={pickConfigFields(EXECUTOR_FORM_CONFIG, ["beneficiary_reference", "instruction_reference", "notes"])}
            values={executorValues}
            errors={executorErrors}
            onChange={(key, value) => {
              setForm((prev) => applyExecutorConfigFieldChange(prev, key, value));
            }}
          />
        </FormSection>
      </div>
    );
  }

  if (sectionKey === "business" && categoryKey === "business") {
    if (!BUSINESS_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Business form configuration is unavailable.</div>;
    }
    const businessValues = businessFormToConfigValues(form);
    const businessErrors = validateAssetFormValues(BUSINESS_FORM_CONFIG, businessValues);

    return (
      <div className="lf-content-grid">
        <ConfigDrivenAssetFields
          config={BUSINESS_FORM_CONFIG}
          values={businessValues}
          errors={businessErrors}
          onChange={(key, value) => {
            setForm((prev) => applyBusinessConfigFieldChange(prev, key, value));
          }}
        />
      </div>
    );
  }

  if (sectionKey === "property" && categoryKey === "property") {
    if (!PROPERTY_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Property form configuration is unavailable.</div>;
    }
    const propertyValues = propertyFormToConfigValues(form);
    const propertyErrors = validateAssetFormValues(PROPERTY_FORM_CONFIG, propertyValues);

    return (
      <div className="lf-content-grid">
        <ConfigDrivenAssetFields
          config={PROPERTY_FORM_CONFIG}
          values={propertyValues}
          errors={propertyErrors}
          onChange={(key, value) => {
            setForm((prev) => applyPropertyConfigFieldChange(prev, key, value));
          }}
        />
      </div>
    );
  }

  if (categoryKey === "bank") {
    if (!BANK_FORM_CONFIG) {
      return <div style={{ color: "#b91c1c", fontSize: 13 }}>Bank form configuration is unavailable.</div>;
    }
    const bankValues = bankFormToConfigValues(form);
    const bankErrors = validateAssetFormValues(BANK_FORM_CONFIG, bankValues);

    return (
      <div className="lf-content-grid">
        <ConfigDrivenAssetFields
          config={BANK_FORM_CONFIG}
          values={bankValues}
          errors={bankErrors}
          onChange={(key, value) => {
            setForm((prev) => applyBankConfigFieldChange(prev, key, value));
          }}
        />
      </div>
    );
  }

  if (categoryKey === "investments") {
    return (
      <div className="lf-content-grid">
        <FieldInput label="Provider / platform name" value={form.investment_provider} onChange={(value) => setForm((prev) => ({ ...prev, investment_provider: value }))} />
        <FieldInput label="Investment type" value={form.investment_type} onChange={(value) => setForm((prev) => ({ ...prev, investment_type: value }))} />
        <FieldInput label="Account/reference number" value={form.investment_reference} onChange={(value) => setForm((prev) => ({ ...prev, investment_reference: value }))} />
        <FieldInput label="Estimated value" type="number" value={form.value_major} onChange={(value) => setForm((prev) => ({ ...prev, value_major: value }))} />
        <FieldInput label="Currency" value={form.currency_code} onChange={(value) => setForm((prev) => ({ ...prev, currency_code: value.toUpperCase() }))} />
        <FieldInput label="Adviser name" value={form.adviser_name} onChange={(value) => setForm((prev) => ({ ...prev, adviser_name: value }))} />
        <FieldInput label="Adviser company" value={form.adviser_company} onChange={(value) => setForm((prev) => ({ ...prev, adviser_company: value }))} />
        <FieldInput label="Adviser phone" value={form.adviser_phone} onChange={(value) => setForm((prev) => ({ ...prev, adviser_phone: value }))} />
        <FieldInput label="Adviser email" value={form.adviser_email} onChange={(value) => setForm((prev) => ({ ...prev, adviser_email: value }))} />
        <FieldInput label="Online portal URL" value={form.investment_portal_url} onChange={(value) => setForm((prev) => ({ ...prev, investment_portal_url: value }))} />
        <FieldInput label="Ownership type" value={form.ownership_type} onChange={(value) => setForm((prev) => ({ ...prev, ownership_type: value }))} />
        <FieldInput label="Beneficiary notes" value={form.beneficiary_notes} onChange={(value) => setForm((prev) => ({ ...prev, beneficiary_notes: value }))} />
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea style={textAreaStyle} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </label>
      </div>
    );
  }

  if (categoryKey === "pensions") {
    return (
      <div className="lf-content-grid">
        <FieldInput label="Pension provider" value={form.pension_provider} onChange={(value) => setForm((prev) => ({ ...prev, pension_provider: value }))} />
        <FieldInput label="Pension type" value={form.pension_type} onChange={(value) => setForm((prev) => ({ ...prev, pension_type: value }))} />
        <FieldInput label="Policy/member number" value={form.pension_member_number} onChange={(value) => setForm((prev) => ({ ...prev, pension_member_number: value }))} />
        <FieldInput label="Estimated value" type="number" value={form.value_major} onChange={(value) => setForm((prev) => ({ ...prev, value_major: value }))} />
        <FieldInput label="Currency" value={form.currency_code} onChange={(value) => setForm((prev) => ({ ...prev, currency_code: value.toUpperCase() }))} />
        <FieldInput label="Employer name" value={form.employer_name} onChange={(value) => setForm((prev) => ({ ...prev, employer_name: value }))} />
        <FieldInput label="Scheme name" value={form.scheme_name} onChange={(value) => setForm((prev) => ({ ...prev, scheme_name: value }))} />
        <FieldInput label="Provider phone" value={form.provider_phone} onChange={(value) => setForm((prev) => ({ ...prev, provider_phone: value }))} />
        <FieldInput label="Provider email" value={form.provider_email} onChange={(value) => setForm((prev) => ({ ...prev, provider_email: value }))} />
        <FieldInput label="Provider address" value={form.provider_address} onChange={(value) => setForm((prev) => ({ ...prev, provider_address: value }))} />
        <FieldInput label="Online portal URL" value={form.pension_portal_url} onChange={(value) => setForm((prev) => ({ ...prev, pension_portal_url: value }))} />
        <FieldInput label="Beneficiary / nominated person" value={form.pension_beneficiary} onChange={(value) => setForm((prev) => ({ ...prev, pension_beneficiary: value }))} />
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea style={textAreaStyle} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </label>
      </div>
    );
  }

  if (categoryKey === "insurance") {
    return (
      <div className="lf-content-grid">
        <FieldInput label="Insurer name" value={form.insurer_name} onChange={(value) => setForm((prev) => ({ ...prev, insurer_name: value }))} />
        <FieldInput label="Policy type" value={form.policy_type} onChange={(value) => setForm((prev) => ({ ...prev, policy_type: value }))} />
        <FieldInput label="Policy number" value={form.policy_number} onChange={(value) => setForm((prev) => ({ ...prev, policy_number: value }))} />
        <FieldInput label="Insured person/item" value={form.insured_item} onChange={(value) => setForm((prev) => ({ ...prev, insured_item: value }))} />
        <FieldInput label="Cover amount" type="number" value={form.cover_amount} onChange={(value) => setForm((prev) => ({ ...prev, cover_amount: value }))} />
        <FieldInput label="Currency" value={form.currency_code} onChange={(value) => setForm((prev) => ({ ...prev, currency_code: value.toUpperCase() }))} />
        <FieldInput label="Renewal date" type="date" value={form.renewal_date} onChange={(value) => setForm((prev) => ({ ...prev, renewal_date: value }))} />
        <FieldInput label="Insurer phone" value={form.insurer_phone} onChange={(value) => setForm((prev) => ({ ...prev, insurer_phone: value }))} />
        <FieldInput label="Insurer email" value={form.insurer_email} onChange={(value) => setForm((prev) => ({ ...prev, insurer_email: value }))} />
        <FieldInput label="Broker/adviser name" value={form.broker_name} onChange={(value) => setForm((prev) => ({ ...prev, broker_name: value }))} />
        <FieldInput label="Broker/adviser contact" value={form.broker_contact} onChange={(value) => setForm((prev) => ({ ...prev, broker_contact: value }))} />
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea style={textAreaStyle} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </label>
      </div>
    );
  }

  return (
    <div className="lf-content-grid">
      <FieldInput label="Creditor name" value={form.creditor_name} onChange={(value) => setForm((prev) => ({ ...prev, creditor_name: value }))} />
      <FieldInput label="Debt type" value={form.debt_type} onChange={(value) => setForm((prev) => ({ ...prev, debt_type: value }))} />
      <FieldInput label="Account/reference number" value={form.debt_reference} onChange={(value) => setForm((prev) => ({ ...prev, debt_reference: value }))} />
      <FieldInput label="Outstanding balance" type="number" value={form.outstanding_balance} onChange={(value) => setForm((prev) => ({ ...prev, outstanding_balance: value }))} />
      <FieldInput label="Currency" value={form.currency_code} onChange={(value) => setForm((prev) => ({ ...prev, currency_code: value.toUpperCase() }))} />
      <FieldInput label="Debtor name" value={form.debtor_name} onChange={(value) => setForm((prev) => ({ ...prev, debtor_name: value }))} />
      <FieldInput label="Repayment amount" type="number" value={form.repayment_amount} onChange={(value) => setForm((prev) => ({ ...prev, repayment_amount: value }))} />
      <FieldInput label="Repayment frequency" value={form.repayment_frequency} onChange={(value) => setForm((prev) => ({ ...prev, repayment_frequency: value }))} />
      <FieldInput label="Interest rate" type="number" value={form.interest_rate} onChange={(value) => setForm((prev) => ({ ...prev, interest_rate: value }))} />
      <FieldInput label="Creditor phone" value={form.creditor_phone} onChange={(value) => setForm((prev) => ({ ...prev, creditor_phone: value }))} />
      <FieldInput label="Creditor email" value={form.creditor_email} onChange={(value) => setForm((prev) => ({ ...prev, creditor_email: value }))} />
      <FieldInput label="Creditor address" value={form.creditor_address} onChange={(value) => setForm((prev) => ({ ...prev, creditor_address: value }))} />
      <label style={fieldStyle}>
        <span style={labelStyle}>Notes</span>
        <textarea style={textAreaStyle} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
      </label>
    </div>
  );
}

function FieldInput({
  label,
  iconName,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  iconName?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>
        {iconName ? <Icon name={iconName} size={16} /> : null}
        {label}
      </span>
      <input type={type} style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>{description}</div>
      </div>
      <div className="lf-content-grid">{children}</div>
    </section>
  );
}

function pickConfigFields(
  config: NonNullable<ReturnType<typeof getAssetCategoryFormConfig>>,
  keys: string[],
) {
  return {
    ...config,
    fields: config.fields.filter((field) => keys.includes(field.key)),
  };
}

function bankFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    provider_name: form.bank_name,
    account_type: form.bank_account_type,
    account_type_other: form.bank_account_type_other,
    account_holder: form.account_holder_name,
    account_number: form.account_number,
    sort_code: form.sort_code,
    iban: form.iban,
    country: form.country,
    country_other: form.country_other,
    currency: form.currency_code,
    currency_other: form.currency_other,
    current_balance: form.value_major,
    valuation_date: form.last_updated_on,
    notes: form.notes,
  };
}

function identityDocumentFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    identity_document_type: form.identity_document_type,
    identity_document_type_other: form.identity_document_type_other,
    identity_document_number: form.identity_document_number,
    identity_document_country: form.identity_document_country,
    identity_document_country_other: form.identity_document_country_other,
    identity_issue_date: form.identity_issue_date,
    renewal_date: form.renewal_date,
    notes: form.notes,
  };
}

function propertyFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    property_type: form.property_type,
    property_type_other: form.property_type_other,
    ownership_type: form.property_ownership_type,
    ownership_type_other: form.property_ownership_type_other,
    property_address: form.property_address,
    property_country: form.property_country,
    property_country_other: form.property_country_other,
    occupancy_status: form.occupancy_status,
    occupancy_status_other: form.occupancy_status_other,
    tenant_name: form.tenant_name,
    tenancy_type: form.tenancy_type,
    tenancy_type_other: form.tenancy_type_other,
    managing_agent: form.managing_agent,
    managing_agent_contact: form.managing_agent_contact,
    monthly_rent: form.monthly_rent,
    tenancy_end_date: form.tenancy_end_date,
    deposit_scheme_reference: form.deposit_scheme_reference,
    lease_or_tenant_summary: form.lease_or_tenant_summary,
    estimated_value: form.value_major,
    currency: form.currency_code,
    currency_other: form.currency_other,
    valuation_date: form.property_valuation_date,
    mortgage_status: form.mortgage_status,
    mortgage_status_other: form.mortgage_status_other,
    mortgage_lender: form.mortgage_lender,
    mortgage_balance: form.mortgage_balance,
    notes: form.notes,
  };
}

function businessFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    business_type: form.business_type,
    business_type_other: form.business_type_other,
    registration_number: form.business_registration_number,
    jurisdiction: form.business_jurisdiction,
    jurisdiction_other: form.business_jurisdiction_other,
    ownership_percentage: form.business_ownership_percentage,
    estimated_value: form.value_major,
    currency: form.currency_code,
    currency_other: form.currency_other,
    valuation_date: form.business_valuation_date,
    role_title: form.business_role_title,
    business_status: form.business_status,
    business_status_other: form.business_status_other,
    notes: form.notes,
  };
}

function digitalFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    digital_asset_type: form.digital_asset_type,
    digital_asset_type_other: form.digital_asset_type_other,
    platform_provider: form.digital_platform_provider,
    wallet_reference: form.digital_wallet_reference,
    jurisdiction: form.digital_jurisdiction,
    jurisdiction_other: form.digital_jurisdiction_other,
    estimated_value: form.value_major,
    currency: form.currency_code,
    currency_other: form.currency_other,
    valuation_date: form.digital_valuation_date,
    access_contact: form.digital_access_contact,
    digital_status: form.digital_status,
    digital_status_other: form.digital_status_other,
    notes: form.notes,
  };
}

function socialMediaFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    social_profile_url: form.social_profile_url,
    social_username: form.social_username,
    social_login_email: form.social_login_email,
    social_credential_hint: form.social_credential_hint,
    social_recovery_notes: form.social_recovery_notes,
    notes: form.notes,
  };
}

function beneficiaryFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    preferred_name: form.beneficiary_preferred_name,
    relationship_to_user: form.beneficiary_relationship_to_user,
    relationship_to_user_other: form.beneficiary_relationship_to_user_other,
    date_of_birth: form.beneficiary_date_of_birth,
    contact_email: form.beneficiary_contact_email,
    contact_phone: form.beneficiary_contact_phone,
    beneficiary_address: form.beneficiary_address,
    country_code: form.beneficiary_country_code,
    country_code_other: form.beneficiary_country_code_other,
    beneficiary_type: form.beneficiary_type,
    beneficiary_type_other: form.beneficiary_type_other,
    beneficiary_status: form.beneficiary_status,
    beneficiary_status_other: form.beneficiary_status_other,
    share_percentage: form.beneficiary_share_percentage,
    identification_reference: form.beneficiary_identification_reference,
    notes: form.notes,
  };
}

function executorFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    executor_type: form.executor_type,
    executor_type_other: form.executor_type_other,
    relationship_to_user: form.executor_relationship_to_user,
    relationship_to_user_other: form.executor_relationship_to_user_other,
    contact_email: form.executor_contact_email,
    contact_phone: form.executor_contact_phone,
    authority_level: form.executor_authority_level,
    authority_level_other: form.executor_authority_level_other,
    jurisdiction: form.executor_jurisdiction,
    jurisdiction_other: form.executor_jurisdiction_other,
    executor_status: form.executor_status,
    executor_status_other: form.executor_status_other,
    appointed_on: form.executor_appointed_on,
    executor_address: form.executor_address,
    identity_reference: form.executor_identity_reference,
    beneficiary_reference: form.executor_beneficiary_reference,
    instruction_reference: form.executor_instruction_reference,
    notes: form.notes,
  };
}

function taskFormToConfigValues(form: EditForm): Record<string, string> {
  return {
    title: form.title,
    description: form.task_description,
    related_asset_id: form.task_related_asset_id,
    assigned_executor_asset_id: form.task_assigned_executor_asset_id,
    assigned_beneficiary_asset_id: form.task_assigned_beneficiary_asset_id,
    priority: form.task_priority,
    priority_other: form.task_priority_other,
    task_status: form.task_status,
    task_status_other: form.task_status_other,
    due_date: form.task_due_date,
    completion_date: form.task_completion_date,
    instruction_reference: form.task_instruction_reference,
    notes: form.notes,
  };
}

function applyBankConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "provider_name") return { ...prev, bank_name: value };
  if (key === "account_type") return { ...prev, bank_account_type: value };
  if (key === "account_type_other") return { ...prev, bank_account_type_other: value };
  if (key === "account_holder") return { ...prev, account_holder_name: value };
  if (key === "account_number") return { ...prev, account_number: value };
  if (key === "sort_code") return { ...prev, sort_code: value };
  if (key === "iban") return { ...prev, iban: value };
  if (key === "current_balance") return { ...prev, value_major: value };
  if (key === "valuation_date") return { ...prev, last_updated_on: value };
  if (key === "notes") return { ...prev, notes: value };

  if (key === "country_other") return { ...prev, country_other: value };
  if (key === "currency_other") return { ...prev, currency_other: value.toUpperCase() };

  if (key === "currency") {
    if (value === "__other") {
      return { ...prev, currency_code: "__other" };
    }
    return { ...prev, currency_code: value.toUpperCase(), currency_other: "" };
  }

  if (key === "country") {
    const previousCountry = prev.country;
    const previousSuggested = COUNTRY_TO_CURRENCY_DEFAULT[previousCountry];
    const nextSuggested = COUNTRY_TO_CURRENCY_DEFAULT[value];
    const shouldAutoSetCurrency =
      Boolean(nextSuggested) &&
      (!prev.currency_code || prev.currency_code === previousSuggested || prev.currency_code === "__other");

    return {
      ...prev,
      country: value,
      country_other: value === "__other" ? prev.country_other : "",
      currency_code: shouldAutoSetCurrency ? String(nextSuggested) : prev.currency_code,
      currency_other: shouldAutoSetCurrency ? "" : prev.currency_other,
    };
  }

  return prev;
}

function applyIdentityDocumentConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "identity_document_type") {
    return {
      ...prev,
      identity_document_type: value,
      identity_document_type_other: value === "__other" ? prev.identity_document_type_other : "",
    };
  }
  if (key === "identity_document_type_other") return { ...prev, identity_document_type_other: value };
  if (key === "identity_document_number") return { ...prev, identity_document_number: value };
  if (key === "identity_document_country") {
    return {
      ...prev,
      identity_document_country: value,
      identity_document_country_other: value === "__other" ? prev.identity_document_country_other : "",
    };
  }
  if (key === "identity_document_country_other") return { ...prev, identity_document_country_other: value };
  if (key === "identity_issue_date") return { ...prev, identity_issue_date: value };
  if (key === "renewal_date") return { ...prev, renewal_date: value };
  if (key === "notes") return { ...prev, notes: value };
  return prev;
}

function applyPropertyConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "property_type") return { ...prev, property_type: value, property_type_other: value === "__other" ? prev.property_type_other : "" };
  if (key === "property_type_other") return { ...prev, property_type_other: value };
  if (key === "ownership_type") {
    return { ...prev, property_ownership_type: value, property_ownership_type_other: value === "__other" ? prev.property_ownership_type_other : "" };
  }
  if (key === "ownership_type_other") return { ...prev, property_ownership_type_other: value };
  if (key === "property_address") return { ...prev, property_address: value };
  if (key === "occupancy_status") return { ...prev, occupancy_status: value, occupancy_status_other: value === "__other" ? prev.occupancy_status_other : "" };
  if (key === "occupancy_status_other") return { ...prev, occupancy_status_other: value };
  if (key === "tenant_name") return { ...prev, tenant_name: value };
  if (key === "tenancy_type") return { ...prev, tenancy_type: value, tenancy_type_other: value === "__other" ? prev.tenancy_type_other : "" };
  if (key === "tenancy_type_other") return { ...prev, tenancy_type_other: value };
  if (key === "managing_agent") return { ...prev, managing_agent: value };
  if (key === "managing_agent_contact") return { ...prev, managing_agent_contact: value };
  if (key === "monthly_rent") return { ...prev, monthly_rent: value };
  if (key === "tenancy_end_date") return { ...prev, tenancy_end_date: value };
  if (key === "deposit_scheme_reference") return { ...prev, deposit_scheme_reference: value };
  if (key === "lease_or_tenant_summary") return { ...prev, lease_or_tenant_summary: value };
  if (key === "estimated_value") return { ...prev, value_major: value };
  if (key === "valuation_date") return { ...prev, property_valuation_date: value };
  if (key === "mortgage_status") return { ...prev, mortgage_status: value, mortgage_status_other: value === "__other" ? prev.mortgage_status_other : "" };
  if (key === "mortgage_status_other") return { ...prev, mortgage_status_other: value };
  if (key === "mortgage_lender") return { ...prev, mortgage_lender: value };
  if (key === "mortgage_balance") return { ...prev, mortgage_balance: value };
  if (key === "notes") return { ...prev, notes: value };
  if (key === "property_country_other") return { ...prev, property_country_other: value };
  if (key === "currency_other") return { ...prev, currency_other: value.toUpperCase() };

  if (key === "currency") {
    if (value === "__other") {
      return { ...prev, currency_code: "__other" };
    }
    return { ...prev, currency_code: value.toUpperCase(), currency_other: "" };
  }

  if (key === "property_country") {
    const previousCountry = prev.property_country;
    const previousSuggested = COUNTRY_TO_CURRENCY_DEFAULT[previousCountry];
    const nextSuggested = COUNTRY_TO_CURRENCY_DEFAULT[value];
    const shouldAutoSetCurrency =
      Boolean(nextSuggested) &&
      (!prev.currency_code || prev.currency_code === previousSuggested || prev.currency_code === "__other");

    return {
      ...prev,
      property_country: value,
      property_country_other: value === "__other" ? prev.property_country_other : "",
      currency_code: shouldAutoSetCurrency ? String(nextSuggested) : prev.currency_code,
      currency_other: shouldAutoSetCurrency ? "" : prev.currency_other,
    };
  }

  return prev;
}

function applyBusinessConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "business_type") return { ...prev, business_type: value, business_type_other: value === "__other" ? prev.business_type_other : "" };
  if (key === "business_type_other") return { ...prev, business_type_other: value };
  if (key === "registration_number") return { ...prev, business_registration_number: value };
  if (key === "ownership_percentage") return { ...prev, business_ownership_percentage: value };
  if (key === "estimated_value") return { ...prev, value_major: value };
  if (key === "valuation_date") return { ...prev, business_valuation_date: value };
  if (key === "role_title") return { ...prev, business_role_title: value };
  if (key === "business_status") return { ...prev, business_status: value, business_status_other: value === "__other" ? prev.business_status_other : "" };
  if (key === "business_status_other") return { ...prev, business_status_other: value };
  if (key === "notes") return { ...prev, notes: value };
  if (key === "jurisdiction_other") return { ...prev, business_jurisdiction_other: value };
  if (key === "currency_other") return { ...prev, currency_other: value.toUpperCase() };

  if (key === "currency") {
    if (value === "__other") {
      return { ...prev, currency_code: "__other" };
    }
    return { ...prev, currency_code: value.toUpperCase(), currency_other: "" };
  }

  if (key === "jurisdiction") {
    const previousJurisdiction = prev.business_jurisdiction;
    const previousSuggested = COUNTRY_TO_CURRENCY_DEFAULT[previousJurisdiction];
    const nextSuggested = COUNTRY_TO_CURRENCY_DEFAULT[value];
    const shouldAutoSetCurrency =
      Boolean(nextSuggested) &&
      (!prev.currency_code || prev.currency_code === previousSuggested || prev.currency_code === "__other");

    return {
      ...prev,
      business_jurisdiction: value,
      business_jurisdiction_other: value === "__other" ? prev.business_jurisdiction_other : "",
      currency_code: shouldAutoSetCurrency ? String(nextSuggested) : prev.currency_code,
      currency_other: shouldAutoSetCurrency ? "" : prev.currency_other,
    };
  }

  return prev;
}

function applyDigitalConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "digital_asset_type") return { ...prev, digital_asset_type: value, digital_asset_type_other: value === "__other" ? prev.digital_asset_type_other : "" };
  if (key === "digital_asset_type_other") return { ...prev, digital_asset_type_other: value };
  if (key === "platform_provider") return { ...prev, digital_platform_provider: value };
  if (key === "wallet_reference") return { ...prev, digital_wallet_reference: value };
  if (key === "estimated_value") return { ...prev, value_major: value };
  if (key === "valuation_date") return { ...prev, digital_valuation_date: value };
  if (key === "access_contact") return { ...prev, digital_access_contact: value };
  if (key === "digital_status") return { ...prev, digital_status: value, digital_status_other: value === "__other" ? prev.digital_status_other : "" };
  if (key === "digital_status_other") return { ...prev, digital_status_other: value };
  if (key === "notes") return { ...prev, notes: value };
  if (key === "jurisdiction_other") return { ...prev, digital_jurisdiction_other: value };
  if (key === "currency_other") return { ...prev, currency_other: value.toUpperCase() };

  if (key === "currency") {
    if (value === "__other") {
      return { ...prev, currency_code: "__other" };
    }
    return { ...prev, currency_code: value.toUpperCase(), currency_other: "" };
  }

  if (key === "jurisdiction") {
    const previousJurisdiction = prev.digital_jurisdiction;
    const previousSuggested = COUNTRY_TO_CURRENCY_DEFAULT[previousJurisdiction];
    const nextSuggested = COUNTRY_TO_CURRENCY_DEFAULT[value];
    const shouldAutoSetCurrency =
      Boolean(nextSuggested) &&
      (!prev.currency_code || prev.currency_code === previousSuggested || prev.currency_code === "__other");

    return {
      ...prev,
      digital_jurisdiction: value,
      digital_jurisdiction_other: value === "__other" ? prev.digital_jurisdiction_other : "",
      currency_code: shouldAutoSetCurrency ? String(nextSuggested) : prev.currency_code,
      currency_other: shouldAutoSetCurrency ? "" : prev.currency_other,
    };
  }

  return prev;
}

function applySocialMediaConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "social_profile_url") return { ...prev, social_profile_url: value };
  if (key === "social_username") return { ...prev, social_username: value };
  if (key === "social_login_email") return { ...prev, social_login_email: value };
  if (key === "social_credential_hint") return { ...prev, social_credential_hint: value };
  if (key === "social_recovery_notes") return { ...prev, social_recovery_notes: value };
  if (key === "notes") return { ...prev, notes: value };
  return prev;
}

function applyBeneficiaryConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "preferred_name") return { ...prev, beneficiary_preferred_name: value };
  if (key === "relationship_to_user") {
    return {
      ...prev,
      beneficiary_relationship_to_user: value,
      beneficiary_relationship_to_user_other: value === "__other" ? prev.beneficiary_relationship_to_user_other : "",
    };
  }
  if (key === "relationship_to_user_other") return { ...prev, beneficiary_relationship_to_user_other: value };
  if (key === "date_of_birth") return { ...prev, beneficiary_date_of_birth: value };
  if (key === "contact_email") return { ...prev, beneficiary_contact_email: value };
  if (key === "contact_phone") return { ...prev, beneficiary_contact_phone: value };
  if (key === "beneficiary_address") return { ...prev, beneficiary_address: value };
  if (key === "country_code") {
    return {
      ...prev,
      beneficiary_country_code: value,
      beneficiary_country_code_other: value === "__other" ? prev.beneficiary_country_code_other : "",
    };
  }
  if (key === "country_code_other") return { ...prev, beneficiary_country_code_other: value };
  if (key === "beneficiary_type") {
    return {
      ...prev,
      beneficiary_type: value,
      beneficiary_type_other: value === "__other" ? prev.beneficiary_type_other : "",
    };
  }
  if (key === "beneficiary_type_other") return { ...prev, beneficiary_type_other: value };
  if (key === "beneficiary_status") {
    return {
      ...prev,
      beneficiary_status: value,
      beneficiary_status_other: value === "__other" ? prev.beneficiary_status_other : "",
    };
  }
  if (key === "beneficiary_status_other") return { ...prev, beneficiary_status_other: value };
  if (key === "share_percentage") return { ...prev, beneficiary_share_percentage: value };
  if (key === "identification_reference") return { ...prev, beneficiary_identification_reference: value };
  if (key === "notes") return { ...prev, notes: value };
  return prev;
}

function applyExecutorConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "executor_type") {
    return {
      ...prev,
      executor_type: value,
      executor_type_other: value === "__other" ? prev.executor_type_other : "",
    };
  }
  if (key === "executor_type_other") return { ...prev, executor_type_other: value };
  if (key === "relationship_to_user") {
    return {
      ...prev,
      executor_relationship_to_user: value,
      executor_relationship_to_user_other: value === "__other" ? prev.executor_relationship_to_user_other : "",
    };
  }
  if (key === "relationship_to_user_other") return { ...prev, executor_relationship_to_user_other: value };
  if (key === "contact_email") return { ...prev, executor_contact_email: value };
  if (key === "contact_phone") return { ...prev, executor_contact_phone: value };
  if (key === "authority_level") {
    return {
      ...prev,
      executor_authority_level: value,
      executor_authority_level_other: value === "__other" ? prev.executor_authority_level_other : "",
    };
  }
  if (key === "authority_level_other") return { ...prev, executor_authority_level_other: value };
  if (key === "jurisdiction") {
    return {
      ...prev,
      executor_jurisdiction: value,
      executor_jurisdiction_other: value === "__other" ? prev.executor_jurisdiction_other : "",
    };
  }
  if (key === "jurisdiction_other") return { ...prev, executor_jurisdiction_other: value };
  if (key === "executor_status") {
    return {
      ...prev,
      executor_status: value,
      executor_status_other: value === "__other" ? prev.executor_status_other : "",
    };
  }
  if (key === "executor_status_other") return { ...prev, executor_status_other: value };
  if (key === "appointed_on") return { ...prev, executor_appointed_on: value };
  if (key === "executor_address") return { ...prev, executor_address: value };
  if (key === "identity_reference") return { ...prev, executor_identity_reference: value };
  if (key === "beneficiary_reference") return { ...prev, executor_beneficiary_reference: value };
  if (key === "instruction_reference") return { ...prev, executor_instruction_reference: value };
  if (key === "notes") return { ...prev, notes: value };
  return prev;
}

function applyTaskConfigFieldChange(prev: EditForm, key: string, value: string): EditForm {
  if (key === "title") return { ...prev, title: value };
  if (key === "description") return { ...prev, task_description: value };
  if (key === "related_asset_id") return { ...prev, task_related_asset_id: value };
  if (key === "assigned_executor_asset_id") return { ...prev, task_assigned_executor_asset_id: value };
  if (key === "assigned_beneficiary_asset_id") return { ...prev, task_assigned_beneficiary_asset_id: value };
  if (key === "priority") {
    return {
      ...prev,
      task_priority: value,
      task_priority_other: value === "__other" ? prev.task_priority_other : "",
    };
  }
  if (key === "priority_other") return { ...prev, task_priority_other: value };
  if (key === "task_status") {
    return {
      ...prev,
      task_status: value,
      task_status_other: value === "__other" ? prev.task_status_other : "",
    };
  }
  if (key === "task_status_other") return { ...prev, task_status_other: value };
  if (key === "due_date") return { ...prev, task_due_date: value };
  if (key === "completion_date") return { ...prev, task_completion_date: value };
  if (key === "instruction_reference") return { ...prev, task_instruction_reference: value };
  if (key === "notes") return { ...prev, notes: value };
  return prev;
}

function buildTaskConfig(
  config: NonNullable<ReturnType<typeof getAssetCategoryFormConfig>>,
  {
    relatedAssetOptions,
    executorOptions,
    beneficiaryOptions,
  }: {
    relatedAssetOptions: Array<{ value: string; label: string }>;
    executorOptions: Array<{ value: string; label: string }>;
    beneficiaryOptions: Array<{ value: string; label: string }>;
  },
) {
  return {
    ...config,
    fields: config.fields.map((field) => {
      if (field.key === "related_asset_id") return { ...field, options: relatedAssetOptions };
      if (field.key === "assigned_executor_asset_id") return { ...field, options: executorOptions };
      if (field.key === "assigned_beneficiary_asset_id") return { ...field, options: beneficiaryOptions };
      return field;
    }),
  };
}

function findOptionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? "";
}

function buildTaskRelatedAssetLabel(row: Record<string, unknown>) {
  const title = String(row.title ?? "").trim() || "Untitled";
  const sectionKey = String(row.section_key ?? "").trim();
  const categoryKey = String(row.category_key ?? "").trim();
  return [title, sectionKey, categoryKey].filter(Boolean).join(" · ");
}

function getWorkspaceSearchPlaceholder({
  isPossessions,
  isCanonicalTask,
  isCanonicalBeneficiary,
  isCanonicalExecutor,
}: {
  isPossessions: boolean;
  isCanonicalTask: boolean;
  isCanonicalBeneficiary: boolean;
  isCanonicalExecutor: boolean;
}) {
  if (isPossessions) return "Find by title, summary, or category...";
  if (isCanonicalTask) return "Search title, linked asset, or assignee...";
  if (isCanonicalBeneficiary) return "Search beneficiary name, type, or status...";
  if (isCanonicalExecutor) return "Search executor name, role, or status...";
  return "Search title, provider, or summary...";
}

function toSelectableValue(
  config: ReturnType<typeof getAssetCategoryFormConfig>,
  fieldKey: string,
  rawValue: string,
) {
  const normalized = rawValue.trim();
  if (!config) return { selected: normalized, other: "" };
  const field = config.fields.find((item) => item.key === fieldKey);
  if (!field?.options?.length) return { selected: normalized, other: "" };
  if (!normalized) return { selected: "", other: "" };
  const valid = field.options.some((option) => option.value === normalized);
  if (valid) return { selected: normalized, other: "" };
  return { selected: "__other", other: normalized };
}

function getFinanceDraft(categoryKey: string, form: EditForm) {
  if (categoryKey === "bank") {
    const values = bankFormToConfigValues(form);
    const accountTypeField = BANK_FORM_CONFIG?.fields.find((field) => field.key === "account_type");
    const countryField = BANK_FORM_CONFIG?.fields.find((field) => field.key === "country");
    const currencyField = BANK_FORM_CONFIG?.fields.find((field) => field.key === "currency");
    const resolvedAccountType = accountTypeField ? resolveConfiguredFieldValue(accountTypeField, values) : form.bank_account_type.trim();
    const resolvedCountry = countryField ? resolveConfiguredFieldValue(countryField, values) : form.country.trim();
    const resolvedCurrency = (currencyField ? resolveConfiguredFieldValue(currencyField, values) : form.currency_code).toUpperCase();
    const resolvedTitle = form.title.trim() || form.bank_name.trim();
    const resolvedBankName = form.bank_name.trim() || form.title.trim();

    return {
      title: resolvedTitle || null,
      providerName: resolvedBankName || null,
      summary: [resolvedAccountType, form.account_holder_name.trim()].filter(Boolean).join(" · ") || null,
      valueMajor: form.value_major || "0",
      currencyCode: resolvedCurrency || "GBP",
      metadata: {
        provider_name: resolvedBankName || null,
        account_type: resolvedAccountType || null,
        account_holder: form.account_holder_name.trim() || null,
        sort_code: form.sort_code.trim() || null,
        account_number: form.account_number.trim() || null,
        iban: form.iban.trim() || null,
        current_balance: form.value_major ? Number(form.value_major) : null,
        valuation_date: form.last_updated_on || null,
        country: resolvedCountry || null,
        currency: resolvedCurrency || null,
        swift_bic: form.swift_bic.trim() || null,
        branch_name: form.branch_name.trim() || null,
        branch_address: form.branch_address.trim() || null,
        bank_contact_phone: form.bank_contact_phone.trim() || null,
        bank_contact_email: form.bank_contact_email.trim() || null,
        online_banking_url: form.online_banking_url.trim() || null,
        notes: form.notes.trim() || null,
      },
    };
  }

  if (categoryKey === "investments") {
    return {
      title: form.investment_provider.trim() || null,
      providerName: form.investment_provider.trim() || null,
      summary: [form.investment_type.trim(), form.investment_reference.trim()].filter(Boolean).join(" · ") || null,
      valueMajor: form.value_major || "0",
      currencyCode: form.currency_code || "GBP",
      metadata: {
        investment_provider: form.investment_provider.trim() || null,
        investment_type: form.investment_type.trim() || null,
        investment_reference: form.investment_reference.trim() || null,
        adviser_name: form.adviser_name.trim() || null,
        adviser_company: form.adviser_company.trim() || null,
        adviser_phone: form.adviser_phone.trim() || null,
        adviser_email: form.adviser_email.trim() || null,
        investment_portal_url: form.investment_portal_url.trim() || null,
        ownership_type: form.ownership_type.trim() || null,
        beneficiary_notes: form.beneficiary_notes.trim() || null,
      },
    };
  }

  if (categoryKey === "pensions") {
    return {
      title: form.pension_provider.trim() || null,
      providerName: form.pension_provider.trim() || null,
      summary: [form.pension_type.trim(), form.pension_member_number.trim()].filter(Boolean).join(" · ") || null,
      valueMajor: form.value_major || "0",
      currencyCode: form.currency_code || "GBP",
      metadata: {
        pension_provider: form.pension_provider.trim() || null,
        pension_type: form.pension_type.trim() || null,
        pension_member_number: form.pension_member_number.trim() || null,
        employer_name: form.employer_name.trim() || null,
        scheme_name: form.scheme_name.trim() || null,
        provider_phone: form.provider_phone.trim() || null,
        provider_email: form.provider_email.trim() || null,
        provider_address: form.provider_address.trim() || null,
        pension_portal_url: form.pension_portal_url.trim() || null,
        pension_beneficiary: form.pension_beneficiary.trim() || null,
      },
    };
  }

  if (categoryKey === "insurance") {
    return {
      title: form.insurer_name.trim() || null,
      providerName: form.insurer_name.trim() || null,
      summary: [form.policy_type.trim(), form.policy_number.trim(), form.insured_item.trim()].filter(Boolean).join(" · ") || null,
      valueMajor: form.cover_amount || "0",
      currencyCode: form.currency_code || "GBP",
      metadata: {
        insurer_name: form.insurer_name.trim() || null,
        policy_type: form.policy_type.trim() || null,
        policy_number: form.policy_number.trim() || null,
        insured_item: form.insured_item.trim() || null,
        cover_amount: form.cover_amount || null,
        renewal_date: form.renewal_date || null,
        insurer_phone: form.insurer_phone.trim() || null,
        insurer_email: form.insurer_email.trim() || null,
        broker_name: form.broker_name.trim() || null,
        broker_contact: form.broker_contact.trim() || null,
      },
    };
  }

  if (categoryKey === "debts") {
    return {
      title: form.creditor_name.trim() || null,
      providerName: form.creditor_name.trim() || null,
      summary: [form.debt_type.trim(), form.debt_reference.trim()].filter(Boolean).join(" · ") || null,
      valueMajor: form.outstanding_balance || "0",
      currencyCode: form.currency_code || "GBP",
      metadata: {
        creditor_name: form.creditor_name.trim() || null,
        debt_type: form.debt_type.trim() || null,
        debt_reference: form.debt_reference.trim() || null,
        outstanding_balance: form.outstanding_balance || null,
        debtor_name: form.debtor_name.trim() || null,
        repayment_amount: form.repayment_amount || null,
        repayment_frequency: form.repayment_frequency.trim() || null,
        interest_rate: form.interest_rate || null,
        creditor_phone: form.creditor_phone.trim() || null,
        creditor_email: form.creditor_email.trim() || null,
        creditor_address: form.creditor_address.trim() || null,
      },
    };
  }

  return {
    title: form.title.trim() || null,
    providerName: form.provider_name.trim() || null,
    summary: form.summary.trim() || null,
    valueMajor: form.value_major || "0",
    currencyCode: form.currency_code || "GBP",
    metadata: {},
  };
}

function getCanonicalAssetDraft(
  categorySlug: "bank-accounts" | "property" | "business-interests" | "digital-assets" | "beneficiaries" | "executors" | "tasks",
  form: EditForm,
  relationOptions?: {
    taskRelationOptions?: Array<{ value: string; label: string }>;
    taskExecutorOptions?: Array<{ value: string; label: string }>;
    taskBeneficiaryOptions?: Array<{ value: string; label: string }>;
  },
) {
  if (categorySlug === "bank-accounts") {
    return getFinanceDraft("bank", form);
  }

  if (categorySlug === "tasks") {
    const values = taskFormToConfigValues(form);
    const priorityField = TASK_FORM_CONFIG?.fields.find((field) => field.key === "priority");
    const statusField = TASK_FORM_CONFIG?.fields.find((field) => field.key === "task_status");
    const resolvedPriority = priorityField ? resolveConfiguredFieldValue(priorityField, values) : form.task_priority.trim();
    const resolvedStatus = statusField ? resolveConfiguredFieldValue(statusField, values) : form.task_status.trim();

    const relatedAssetLabel = findOptionLabel(relationOptions?.taskRelationOptions ?? [], form.task_related_asset_id);
    const assignedExecutorLabel = findOptionLabel(relationOptions?.taskExecutorOptions ?? [], form.task_assigned_executor_asset_id);
    const assignedBeneficiaryLabel = findOptionLabel(relationOptions?.taskBeneficiaryOptions ?? [], form.task_assigned_beneficiary_asset_id);

    return {
      title: form.title.trim() || null,
      providerName: null,
      summary: [resolvedPriority, resolvedStatus, relatedAssetLabel].filter(Boolean).join(" · ") || null,
      valueMajor: "0",
      currencyCode: "GBP",
      metadata: {
        task_title: form.title.trim() || null,
        description: form.task_description.trim() || null,
        related_asset_id: form.task_related_asset_id || null,
        related_asset_label: relatedAssetLabel || null,
        assigned_executor_asset_id: form.task_assigned_executor_asset_id || null,
        assigned_executor_label: assignedExecutorLabel || null,
        assigned_beneficiary_asset_id: form.task_assigned_beneficiary_asset_id || null,
        assigned_beneficiary_label: assignedBeneficiaryLabel || null,
        priority: resolvedPriority || null,
        task_status: resolvedStatus || null,
        due_date: form.task_due_date || null,
        completion_date: form.task_completion_date || null,
        instruction_reference: form.task_instruction_reference.trim() || null,
        notes: form.notes.trim() || null,
      },
    };
  }

  if (categorySlug === "executors") {
    const values = executorFormToConfigValues(form);
    const typeField = EXECUTOR_FORM_CONFIG?.fields.find((field) => field.key === "executor_type");
    const relationshipField = EXECUTOR_FORM_CONFIG?.fields.find((field) => field.key === "relationship_to_user");
    const authorityField = EXECUTOR_FORM_CONFIG?.fields.find((field) => field.key === "authority_level");
    const jurisdictionField = EXECUTOR_FORM_CONFIG?.fields.find((field) => field.key === "jurisdiction");
    const statusField = EXECUTOR_FORM_CONFIG?.fields.find((field) => field.key === "executor_status");
    const resolvedType = typeField ? resolveConfiguredFieldValue(typeField, values) : form.executor_type.trim();
    const resolvedRelationship = relationshipField ? resolveConfiguredFieldValue(relationshipField, values) : form.executor_relationship_to_user.trim();
    const resolvedAuthority = authorityField ? resolveConfiguredFieldValue(authorityField, values) : form.executor_authority_level.trim();
    const resolvedJurisdiction = jurisdictionField ? resolveConfiguredFieldValue(jurisdictionField, values) : form.executor_jurisdiction.trim();
    const resolvedStatus = statusField ? resolveConfiguredFieldValue(statusField, values) : form.executor_status.trim();

    return {
      title: form.title.trim() || null,
      providerName: null,
      summary: [resolvedType, resolvedAuthority, resolvedRelationship].filter(Boolean).join(" · ") || null,
      valueMajor: "0",
      currencyCode: "GBP",
      metadata: {
        full_name: form.title.trim() || null,
        executor_name: form.title.trim() || null,
        executor_type: resolvedType || null,
        relationship_to_user: resolvedRelationship || null,
        contact_email: form.executor_contact_email.trim() || null,
        contact_phone: form.executor_contact_phone.trim() || null,
        authority_level: resolvedAuthority || null,
        jurisdiction: resolvedJurisdiction || null,
        executor_status: resolvedStatus || null,
        appointed_on: form.executor_appointed_on || null,
        executor_address: form.executor_address.trim() || null,
        identity_reference: form.executor_identity_reference.trim() || null,
        beneficiary_reference: form.executor_beneficiary_reference.trim() || null,
        instruction_reference: form.executor_instruction_reference.trim() || null,
        notes: form.notes.trim() || null,
      },
    };
  }

  if (categorySlug === "beneficiaries") {
    const values = beneficiaryFormToConfigValues(form);
    const relationshipField = BENEFICIARY_FORM_CONFIG?.fields.find((field) => field.key === "relationship_to_user");
    const typeField = BENEFICIARY_FORM_CONFIG?.fields.find((field) => field.key === "beneficiary_type");
    const statusField = BENEFICIARY_FORM_CONFIG?.fields.find((field) => field.key === "beneficiary_status");
    const countryField = BENEFICIARY_FORM_CONFIG?.fields.find((field) => field.key === "country_code");
    const resolvedRelationship = relationshipField ? resolveConfiguredFieldValue(relationshipField, values) : form.beneficiary_relationship_to_user.trim();
    const resolvedType = typeField ? resolveConfiguredFieldValue(typeField, values) : form.beneficiary_type.trim();
    const resolvedStatus = statusField ? resolveConfiguredFieldValue(statusField, values) : form.beneficiary_status.trim();
    const resolvedCountry = countryField ? resolveConfiguredFieldValue(countryField, values) : form.beneficiary_country_code.trim();

    return {
      title: form.title.trim() || null,
      providerName: null,
      summary: [resolvedType, resolvedRelationship, form.beneficiary_share_percentage ? `${form.beneficiary_share_percentage}% share` : ""].filter(Boolean).join(" · ") || null,
      valueMajor: "0",
      currencyCode: "GBP",
      metadata: {
        full_name: form.title.trim() || null,
        preferred_name: form.beneficiary_preferred_name.trim() || null,
        relationship_to_user: resolvedRelationship || null,
        date_of_birth: form.beneficiary_date_of_birth || null,
        contact_email: form.beneficiary_contact_email.trim() || null,
        contact_phone: form.beneficiary_contact_phone.trim() || null,
        beneficiary_address: form.beneficiary_address.trim() || null,
        country_code: resolvedCountry || null,
        beneficiary_type: resolvedType || null,
        beneficiary_status: resolvedStatus || null,
        share_percentage: form.beneficiary_share_percentage ? Number(form.beneficiary_share_percentage) : null,
        identification_reference: form.beneficiary_identification_reference.trim() || null,
        notes: form.notes.trim() || null,
      },
    };
  }

  if (categorySlug === "digital-assets") {
    const values = digitalFormToConfigValues(form);
    const assetTypeField = DIGITAL_FORM_CONFIG?.fields.find((field) => field.key === "digital_asset_type");
    const jurisdictionField = DIGITAL_FORM_CONFIG?.fields.find((field) => field.key === "jurisdiction");
    const currencyField = DIGITAL_FORM_CONFIG?.fields.find((field) => field.key === "currency");
    const statusField = DIGITAL_FORM_CONFIG?.fields.find((field) => field.key === "digital_status");
    const resolvedAssetType = assetTypeField ? resolveConfiguredFieldValue(assetTypeField, values) : form.digital_asset_type.trim();
    const resolvedJurisdiction = jurisdictionField ? resolveConfiguredFieldValue(jurisdictionField, values) : form.digital_jurisdiction.trim();
    const resolvedCurrency = (currencyField ? resolveConfiguredFieldValue(currencyField, values) : form.currency_code).toUpperCase();
    const resolvedStatus = statusField ? resolveConfiguredFieldValue(statusField, values) : form.digital_status.trim();

    return {
      title: form.title.trim() || null,
      providerName: form.digital_platform_provider.trim() || form.title.trim() || null,
      summary: [resolvedAssetType, form.digital_platform_provider.trim()].filter(Boolean).join(" · ") || null,
      valueMajor: form.value_major || "0",
      currencyCode: resolvedCurrency || "GBP",
      metadata: {
        asset_name: form.title.trim() || null,
        provider_name: form.digital_platform_provider.trim() || null,
        digital_asset_type: resolvedAssetType || null,
        platform_provider: form.digital_platform_provider.trim() || null,
        wallet_reference: form.digital_wallet_reference.trim() || null,
        jurisdiction: resolvedJurisdiction || null,
        currency_code: resolvedCurrency || null,
        estimated_value: form.value_major ? Number(form.value_major) : null,
        valuation_date: form.digital_valuation_date || null,
        access_contact: form.digital_access_contact.trim() || null,
        digital_status: resolvedStatus || null,
        notes: form.notes.trim() || null,
      },
    };
  }

  if (categorySlug === "business-interests") {
    const values = businessFormToConfigValues(form);
    const businessTypeField = BUSINESS_FORM_CONFIG?.fields.find((field) => field.key === "business_type");
    const jurisdictionField = BUSINESS_FORM_CONFIG?.fields.find((field) => field.key === "jurisdiction");
    const currencyField = BUSINESS_FORM_CONFIG?.fields.find((field) => field.key === "currency");
    const statusField = BUSINESS_FORM_CONFIG?.fields.find((field) => field.key === "business_status");
    const resolvedBusinessType = businessTypeField ? resolveConfiguredFieldValue(businessTypeField, values) : form.business_type.trim();
    const resolvedJurisdiction = jurisdictionField ? resolveConfiguredFieldValue(jurisdictionField, values) : form.business_jurisdiction.trim();
    const resolvedCurrency = (currencyField ? resolveConfiguredFieldValue(currencyField, values) : form.currency_code).toUpperCase();
    const resolvedStatus = statusField ? resolveConfiguredFieldValue(statusField, values) : form.business_status.trim();

    return {
      title: form.title.trim() || null,
      providerName: form.title.trim() || null,
      summary: [resolvedBusinessType, form.business_role_title.trim(), form.business_ownership_percentage ? `${form.business_ownership_percentage}% owned` : ""].filter(Boolean).join(" · ") || null,
      valueMajor: form.value_major || "0",
      currencyCode: resolvedCurrency || "GBP",
      metadata: {
        business_name: form.title.trim() || null,
        provider_name: form.title.trim() || null,
        business_type: resolvedBusinessType || null,
        registration_number: form.business_registration_number.trim() || null,
        jurisdiction: resolvedJurisdiction || null,
        ownership_percentage: form.business_ownership_percentage ? Number(form.business_ownership_percentage) : null,
        currency_code: resolvedCurrency || null,
        estimated_value: form.value_major ? Number(form.value_major) : null,
        valuation_date: form.business_valuation_date || null,
        role_title: form.business_role_title.trim() || null,
        business_status: resolvedStatus || null,
        notes: form.notes.trim() || null,
      },
    };
  }

  const values = propertyFormToConfigValues(form);
  const propertyTypeField = PROPERTY_FORM_CONFIG?.fields.find((field) => field.key === "property_type");
  const ownershipTypeField = PROPERTY_FORM_CONFIG?.fields.find((field) => field.key === "ownership_type");
  const countryField = PROPERTY_FORM_CONFIG?.fields.find((field) => field.key === "property_country");
  const occupancyField = PROPERTY_FORM_CONFIG?.fields.find((field) => field.key === "occupancy_status");
  const tenancyTypeField = PROPERTY_FORM_CONFIG?.fields.find((field) => field.key === "tenancy_type");
  const currencyField = PROPERTY_FORM_CONFIG?.fields.find((field) => field.key === "currency");
  const mortgageField = PROPERTY_FORM_CONFIG?.fields.find((field) => field.key === "mortgage_status");
  const resolvedPropertyType = propertyTypeField ? resolveConfiguredFieldValue(propertyTypeField, values) : form.property_type.trim();
  const resolvedOwnershipType = ownershipTypeField ? resolveConfiguredFieldValue(ownershipTypeField, values) : form.property_ownership_type.trim();
  const resolvedCountry = countryField ? resolveConfiguredFieldValue(countryField, values) : form.property_country.trim();
  const resolvedOccupancyStatus = occupancyField ? resolveConfiguredFieldValue(occupancyField, values) : form.occupancy_status.trim();
  const resolvedTenancyType = tenancyTypeField ? resolveConfiguredFieldValue(tenancyTypeField, values) : form.tenancy_type.trim();
  const resolvedCurrency = (currencyField ? resolveConfiguredFieldValue(currencyField, values) : form.currency_code).toUpperCase();
  const resolvedMortgageStatus = mortgageField ? resolveConfiguredFieldValue(mortgageField, values) : form.mortgage_status.trim();

  return {
    title: form.title.trim() || null,
    providerName: null,
    summary: [resolvedPropertyType, resolvedOwnershipType].filter(Boolean).join(" · ") || null,
    valueMajor: form.value_major || "0",
    currencyCode: resolvedCurrency || "GBP",
    metadata: {
      property_name: form.title.trim() || null,
      property_type: resolvedPropertyType || null,
      ownership_type: resolvedOwnershipType || null,
      property_address: form.property_address.trim() || null,
      property_country: resolvedCountry || null,
      occupancy_status: resolvedOccupancyStatus || null,
      tenant_name: form.tenant_name.trim() || null,
      tenancy_type: resolvedTenancyType || null,
      managing_agent: form.managing_agent.trim() || null,
      managing_agent_contact: form.managing_agent_contact.trim() || null,
      monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
      tenancy_end_date: form.tenancy_end_date || null,
      deposit_scheme_reference: form.deposit_scheme_reference.trim() || null,
      lease_or_tenant_summary: form.lease_or_tenant_summary.trim() || null,
      currency_code: resolvedCurrency || null,
      estimated_value: form.value_major ? Number(form.value_major) : null,
      valuation_date: form.property_valuation_date || null,
      mortgage_status: resolvedMortgageStatus || null,
      mortgage_lender: form.mortgage_lender.trim() || null,
      mortgage_balance: form.mortgage_balance ? Number(form.mortgage_balance) : null,
      notes: form.notes.trim() || null,
    },
  };
}

function resolveCanonicalCategorySlug(sectionKey: string, categoryKey: string) {
  const managedAssetConfig = getManagedAssetWorkspaceConfig(sectionKey, categoryKey);
  if (managedAssetConfig) return managedAssetConfig.canonicalCategorySlug;
  if (sectionKey === "personal" && categoryKey === "beneficiaries") return "beneficiaries" as const;
  if (sectionKey === "personal" && categoryKey === "executors") return "executors" as const;
  if (sectionKey === "personal" && categoryKey === "tasks") return "tasks" as const;
  return null;
}

function ProviderBadge({
  provider,
  fallbackLabel,
  categoryKey,
}: {
  provider: ProviderCatalogRow | null;
  fallbackLabel: string;
  categoryKey?: string;
}) {
  const [failedLogoSrc, setFailedLogoSrc] = useState("");
  const providerLogoSrc = useMemo(
    () => resolveProviderLogoSrc(provider),
    [provider],
  );

  if (providerLogoSrc && failedLogoSrc !== providerLogoSrc) {
    return (
      <div style={logoWrapStyle} aria-label={provider?.display_name ?? "Bank logo"}>
        <img
          src={providerLogoSrc}
          alt={provider?.display_name ?? "Bank logo"}
          width={24}
          height={24}
          style={{ objectFit: "contain", width: "100%", height: "100%", maxWidth: 24, maxHeight: 24, display: "block" }}
          onError={() => {
            setFailedLogoSrc(providerLogoSrc);
          }}
        />
      </div>
    );
  }

  const categoryIcon = categoryKey ? POSSESSION_CATEGORY_ICONS[categoryKey] : null;
  if (categoryIcon) {
    return (
      <div style={categoryBadgeStyle} aria-label={categoryKey}>
        <Icon name={categoryIcon} size={17} />
      </div>
    );
  }

  if (provider?.provider_type === "bank" || categoryKey === "bank") {
    return (
      <div style={badgeStyle} aria-label={provider?.display_name || fallbackLabel}>
        {getProviderInitials(provider?.display_name ?? fallbackLabel)}
      </div>
    );
  }

  const iconName = provider?.icon_text ? null : "folder";
  const text = provider?.icon_text || getProviderInitials(fallbackLabel);
  return (
    <div style={badgeStyle} aria-label={provider?.display_name || fallbackLabel}>
      {iconName ? <Icon name={iconName} size={17} /> : text}
    </div>
  );
}

function resolveProviderLogoSrc(provider: ProviderCatalogRow | null) {
  if (provider?.provider_type === "bank") {
    return provider.provider_key ? `/bank-logos/${provider.provider_key}.png` : "";
  }

  const rawLogoPath = provider?.logo_path?.trim();
  if (!rawLogoPath) return "";
  if (rawLogoPath.startsWith("/")) return rawLogoPath;
  return `/bank-logos/${rawLogoPath.replace(/^.*[\\/]/, "").trim()}`;
}

function getProviderInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function detectProvider(input: string, catalog: ProviderCatalogRow[]) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  const merged = mergeCatalogRows(catalog);
  let best: { score: number; row: ProviderCatalogRow } | null = null;
  for (const item of merged) {
    const terms = [item.provider_key.toLowerCase(), item.display_name.toLowerCase(), ...(item.match_terms ?? []).map((term) => term.toLowerCase())];
    for (const term of terms) {
      if (!term) continue;
      if (normalized === term || normalized.includes(term)) {
        const score = term.length;
        if (!best || score > best.score) best = { score, row: item };
      }
    }
  }
  return best?.row ?? null;
}

function findProviderByKey(providerKey: string | null | undefined, catalog: ProviderCatalogRow[]) {
  const normalizedKey = providerKey?.trim().toLowerCase();
  if (!normalizedKey) return null;
  const merged = mergeCatalogRows(catalog);
  return merged.find((item) => item.provider_key.toLowerCase() === normalizedKey) ?? null;
}

function mergeCatalogRows(rows: ProviderCatalogRow[]) {
  const byKey = new Map<string, ProviderCatalogRow>();
  for (const row of DEFAULT_PROVIDER_CATALOG) byKey.set(row.provider_key, row);
  for (const row of rows) {
    const existing = byKey.get(row.provider_key);
    if (!existing) {
      byKey.set(row.provider_key, row);
      continue;
    }
    byKey.set(row.provider_key, {
      ...existing,
      ...row,
      logo_path: row.logo_path && row.logo_path.trim() ? row.logo_path : existing.logo_path,
      icon_text: row.icon_text && row.icon_text.trim() ? row.icon_text : existing.icon_text,
      match_terms: row.match_terms?.length ? row.match_terms : existing.match_terms,
    });
  }
  return Array.from(byKey.values());
}

function isImageAttachment(item: RecordAttachment) {
  if (item.document_kind === "photo") return true;
  if (item.mime_type?.toLowerCase().startsWith("image/")) return true;
  const lowerPath = item.storage_path.toLowerCase();
  return lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg") || lowerPath.endsWith(".png") || lowerPath.endsWith(".webp");
}

function isPhotoAttachmentRecord(item: Record<string, unknown>) {
  const mimeType = String(item.mime_type ?? "").toLowerCase();
  if (mimeType.startsWith("image/")) return true;
  const storagePath = String(item.storage_path ?? "").toLowerCase();
  return storagePath.endsWith(".jpg") || storagePath.endsWith(".jpeg") || storagePath.endsWith(".png") || storagePath.endsWith(".webp");
}

function mapDocumentRowsToAttachments(rows: Array<Record<string, unknown>>): RecordAttachment[] {
  return rows.map((item) => ({
    id: String(item.id ?? ""),
    record_id: String(item.asset_id ?? ""),
    owner_user_id: String(item.owner_user_id ?? ""),
    storage_bucket: String(item.storage_bucket ?? ""),
    storage_path: String(item.storage_path ?? ""),
    file_name: String(item.file_name ?? ""),
    mime_type: String(item.mime_type ?? ""),
    size_bytes: Number(item.size_bytes ?? 0),
    checksum: typeof item.checksum === "string" ? item.checksum : null,
    created_at: String(item.created_at ?? ""),
    source_table: "documents",
    document_kind: item.document_kind === "photo" ? "photo" : "document",
    parent_label: String(item.parent_label ?? ""),
  }));
}

function mapLegacyAttachmentRowsToAttachments(rows: Array<Record<string, unknown>>): RecordAttachment[] {
  return rows.map((item) => ({
    id: String(item.id ?? ""),
    record_id: String(item.record_id ?? ""),
    owner_user_id: String(item.owner_user_id ?? ""),
    storage_bucket: String(item.storage_bucket ?? ""),
    storage_path: String(item.storage_path ?? ""),
    file_name: String(item.file_name ?? ""),
    mime_type: String(item.mime_type ?? ""),
    size_bytes: Number(item.size_bytes ?? 0),
    checksum: typeof item.checksum === "string" ? item.checksum : null,
    created_at: String(item.created_at ?? ""),
    source_table: "attachments",
    document_kind: isPhotoAttachmentRecord(item) ? "photo" : "document",
  }));
}

async function getAttachmentSignedUrl(item: RecordAttachment, expiresInSeconds: number) {
  return getStoredFileSignedUrl(supabase, {
    storageBucket: item.storage_bucket,
    storagePath: item.storage_path,
    expiresInSeconds,
  });
}

async function uploadAttachmentAfterSave({
  userId,
  recordId,
  file,
}: {
  userId: string;
  recordId: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const isImage = file.type.toLowerCase().startsWith("image/");
  const assetContext = await resolveCanonicalAssetDocumentContext(supabase, {
    assetId: recordId,
    ownerUserId: userId,
  });
  if (!assetContext) {
    return { ok: false, error: "File link warning: asset context could not be resolved." };
  }

  const uploadResult = await createCanonicalAssetDocument(supabase, {
    context: assetContext,
    file,
    kind: isImage ? "photo" : "document",
  });
  if (!uploadResult.ok) {
    return { ok: false, error: `${uploadResult.error}.` };
  }

  return { ok: true };
}

async function loadWorkspaceRows({
  userId,
  sectionKey,
  categoryKey,
  usesCanonicalAssets,
  recordFilter,
}: {
  userId: string;
  sectionKey: string;
  categoryKey: string;
  usesCanonicalAssets: boolean;
  recordFilter?: (row: UniversalRecordRow) => boolean;
}): Promise<{ ok: true; rows: UniversalRecordRow[]; warning?: string } | { ok: false; error: string }> {
  if (!usesCanonicalAssets) {
    const recordsResult = await supabase
      .from("records")
      .select("id,owner_user_id,section_key,category_key,title,provider_name,provider_key,summary,value_minor,currency_code,status,metadata,created_at,updated_at,archived_at")
      .eq("owner_user_id", userId)
      .eq("section_key", sectionKey)
      .eq("category_key", categoryKey)
      .order("created_at", { ascending: false });

    if (recordsResult.error) {
      return { ok: false, error: recordsResult.error.message };
    }
    const rows = (recordsResult.data ?? []) as UniversalRecordRow[];
    assertWorkspaceRowsMatchCategory(rows, { sectionKey, categoryKey });
    return { ok: true, rows: recordFilter ? rows.filter(recordFilter) : rows };
  }

  const walletContext = await resolveWalletContextForRead(supabase, userId);
  const assetSelect = [
    "id",
    "wallet_id",
    "section_key",
    "category_key",
    "title",
    "provider_name",
    "provider_key",
    "summary",
    "value_minor",
    "currency_code",
    "status",
    "metadata_json",
    "created_at",
    "updated_at",
    "archived_at",
  ].join(",");
  const assetsResult = await fetchCanonicalAssets(supabase, {
    userId,
    walletId: walletContext.walletId,
    sectionKey,
    categoryKey,
    select: assetSelect,
  });

  if (assetsResult.error) {
    return { ok: false, error: assetsResult.error.message };
  }

  const rows = ((assetsResult.data ?? []) as unknown[]) as Array<Record<string, unknown>>;
  const ids = rows.map((row) => String(row.id ?? "")).filter(Boolean);
  let sensitivePayloads = new Map<string, Record<string, unknown>>();
  let warning = "";
  try {
    const hydrationResult = await loadSensitiveAssetPayloads(supabase, ids);
    sensitivePayloads = hydrationResult.payloads;
    warning = hydrationResult.warning ?? "";
  } catch (error) {
    warning = error instanceof Error ? error.message : "Could not load encrypted asset fields.";
  }

  const canonicalRows = rows.map((row) => {
    const id = String(row.id ?? "");
    const publicMetadata = (row.metadata_json as Record<string, unknown> | null) ?? {};
    const sensitiveMetadata = sensitivePayloads.get(id) ?? {};
    return {
      id,
      owner_user_id: String(row.owner_user_id ?? userId),
      section_key: String(row.section_key ?? ""),
      category_key: String(row.category_key ?? ""),
      title: typeof row.title === "string" ? row.title : null,
      provider_name:
        typeof publicMetadata.provider_name === "string"
          ? publicMetadata.provider_name
          : typeof row.provider_name === "string"
            ? row.provider_name
            : null,
      provider_key: typeof row.provider_key === "string" ? row.provider_key : null,
      summary: typeof row.summary === "string" ? row.summary : null,
      value_minor: typeof row.value_minor === "number" ? row.value_minor : Number(row.value_minor ?? 0),
      currency_code: typeof row.currency_code === "string" ? row.currency_code : null,
      status: row.status === "archived" ? "archived" : "active",
      metadata: { ...publicMetadata, ...sensitiveMetadata },
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? ""),
      archived_at: typeof row.archived_at === "string" ? row.archived_at : null,
    } satisfies UniversalRecordRow;
  });

  assertWorkspaceRowsMatchCategory(canonicalRows, { sectionKey, categoryKey });
  const filteredRows = recordFilter ? canonicalRows.filter(recordFilter) : canonicalRows;

  if (sectionKey === "finances" && categoryKey === "bank") {
    appendDevBankTrace({
      kind: "bank-load",
      source: "UniversalRecordWorkspace.loadWorkspaceRows",
      timestamp: new Date().toISOString(),
      userId,
      organisationId: walletContext.organisationId,
      walletId: walletContext.walletId,
      assetIds: filteredRows.map((row) => row.id),
      assetCategoryTokens: filteredRows.map((row) =>
        String(row.metadata?.asset_category_token ?? row.metadata?.category_slug ?? "").trim(),
      ),
      titles: filteredRows.map((row) =>
        String(row.metadata?.provider_name ?? row.provider_name ?? row.metadata?.institution_name ?? row.title ?? "").trim(),
      ),
    });
  }

  return {
    ok: true,
    warning,
    rows: filteredRows,
  };
}

async function reloadWorkspace(
  router: ReturnType<typeof useRouter>,
  sectionKey: string,
  categoryKey: string,
  setRecords: (rows: UniversalRecordRow[]) => void,
  setAttachments: (rows: RecordAttachment[]) => void,
  setContacts: (rows: RecordContact[]) => void,
  setStatus: (value: string) => void,
  {
    targetOwnerUserId,
    forceCanonicalRead = false,
    recordFilter,
  }: {
    targetOwnerUserId?: string | null;
    forceCanonicalRead?: boolean;
    recordFilter?: ((row: UniversalRecordRow) => boolean) | undefined;
  } = {},
) {
  const user = await requireUser(router);
  if (!user) return;
  const effectiveOwnerUserId = targetOwnerUserId || user.id;

  const usesCanonicalAssets = Boolean(resolveCanonicalCategorySlug(sectionKey, categoryKey));
  const usesCanonicalAssetReadPath = forceCanonicalRead || Boolean(getManagedAssetWorkspaceConfig(sectionKey, categoryKey)?.readsCanonicalAssets) || usesCanonicalAssets;
  const recordsResult = await loadWorkspaceRows({
    userId: effectiveOwnerUserId,
    sectionKey,
    categoryKey,
    usesCanonicalAssets: usesCanonicalAssetReadPath,
    recordFilter,
  });

  if (!recordsResult.ok) {
    setStatus(`Could not refresh records: ${recordsResult.error}`);
    return;
  }
  const nextRecords = recordsResult.rows;
  if (recordsResult.warning) {
    setStatus(`Records refreshed, but some encrypted fields could not be hydrated: ${recordsResult.warning}`);
  }
  setRecords(nextRecords);
  const ids = nextRecords.map((item) => item.id);
  if (ids.length === 0) {
    setAttachments([]);
    setContacts([]);
    return;
  }

  const [documentsResult, attachmentsResult, contactsResult] = await Promise.all([
    supabase
      .from("documents")
      .select("id,asset_id,owner_user_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,checksum,created_at,document_kind")
      .eq("owner_user_id", effectiveOwnerUserId)
      .in("asset_id", ids)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("attachments")
      .select("id,record_id,owner_user_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,checksum,created_at")
      .eq("owner_user_id", effectiveOwnerUserId)
      .in("record_id", ids)
      .order("created_at", { ascending: false }),
    loadWorkspaceContacts({
      userId: effectiveOwnerUserId,
      ids,
      usesCanonicalAssetReadPath,
    }),
  ]);

  if (documentsResult.error && attachmentsResult.error) {
    setStatus(`Could not refresh attachments: ${documentsResult.error.message}`);
  } else {
    setAttachments(
      mergeWorkspaceAttachments({
        documents: !documentsResult.error
          ? mapDocumentRowsToAttachments((documentsResult.data ?? []) as Array<Record<string, unknown>>)
          : [],
        legacyAttachments: !attachmentsResult.error
          ? mapLegacyAttachmentRowsToAttachments((attachmentsResult.data ?? []) as Array<Record<string, unknown>>)
          : [],
      }),
    );
  }
  if (!contactsResult.ok) setStatus(`Could not refresh contacts: ${contactsResult.error}`);
  setContacts(contactsResult.ok ? contactsResult.rows : []);
}

function toMinorUnits(valueMajorText: string) {
  const parsed = Number(valueMajorText || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

async function loadWorkspaceContacts({
  userId,
  ids,
  usesCanonicalAssetReadPath,
}: {
  userId: string;
  ids: string[];
  usesCanonicalAssetReadPath: boolean;
}): Promise<{ ok: true; rows: RecordContact[] } | { ok: false; error: string }> {
  if (ids.length === 0) return { ok: true, rows: [] };

  if (usesCanonicalAssetReadPath) {
    const linksRes = await supabase
      .from("contact_links")
      .select("id,owner_user_id,contact_id,source_id,source_kind,context_label,role_label,created_at")
      .eq("owner_user_id", userId)
      .eq("source_kind", "asset")
      .in("source_id", ids);
    if (linksRes.error) return { ok: false, error: linksRes.error.message };

    const linkRows = ((linksRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id ?? ""),
      owner_user_id: String(row.owner_user_id ?? userId),
      contact_id: String(row.contact_id ?? ""),
      record_id: String(row.source_id ?? ""),
      contact_name: "",
      contact_email: null,
      contact_phone: null,
      contact_role: typeof row.role_label === "string" ? row.role_label : null,
      relationship: null,
      invite_status: null,
      verification_status: null,
      linked_context: [],
      notes: typeof row.context_label === "string" ? row.context_label : null,
      created_at: String(row.created_at ?? ""),
    })) as RecordContact[];

    return {
      ok: true,
      rows: await mergeRecordContactsWithCanonicalContacts(userId, linkRows),
    };
  }

  const contactsRes = await supabase
    .from("record_contacts")
    .select("id,record_id,owner_user_id,contact_id,contact_name,contact_email,contact_role,notes,created_at")
    .eq("owner_user_id", userId)
    .in("record_id", ids)
    .order("created_at", { ascending: false });
  if (contactsRes.error) return { ok: false, error: contactsRes.error.message };

  const baseRows = ((contactsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id ?? ""),
    record_id: String(row.record_id ?? ""),
    owner_user_id: String(row.owner_user_id ?? userId),
    contact_id: typeof row.contact_id === "string" ? row.contact_id : null,
    contact_name: String(row.contact_name ?? ""),
    contact_email: typeof row.contact_email === "string" ? row.contact_email : null,
    contact_phone: null,
    contact_role: typeof row.contact_role === "string" ? row.contact_role : null,
    relationship: null,
    invite_status: null,
    verification_status: null,
    linked_context: [],
    notes: typeof row.notes === "string" ? row.notes : null,
    created_at: String(row.created_at ?? ""),
  })) as RecordContact[];

  return {
    ok: true,
    rows: await mergeRecordContactsWithCanonicalContacts(userId, baseRows),
  };
}

async function mergeRecordContactsWithCanonicalContacts(userId: string, rows: RecordContact[]) {
  const contactIds = rows.map((row) => String(row.contact_id ?? "").trim()).filter(Boolean);
  if (contactIds.length === 0) return rows;

  let canonicalContacts: CanonicalContactRow[] = [];
  try {
    canonicalContacts = await loadCanonicalContactsByIds(supabase, userId, contactIds);
  } catch {
    return rows;
  }

  const canonicalById = new Map(canonicalContacts.map((row) => [row.id, row]));
  return rows.map((row) => {
    const canonical = row.contact_id ? canonicalById.get(row.contact_id) : null;
    if (!canonical) return row;
    return {
      ...row,
      contact_name: canonical.full_name || row.contact_name,
      contact_email: canonical.email ?? row.contact_email,
      contact_phone: canonical.phone ?? row.contact_phone,
      contact_role: canonical.contact_role ?? row.contact_role,
      relationship: canonical.relationship ?? row.relationship ?? row.contact_role,
      invite_status: canonical.invite_status ?? row.invite_status,
      verification_status: canonical.verification_status ?? row.verification_status,
      linked_context: canonical.linked_context ?? row.linked_context,
    };
  });
}

function toMajorUnits(valueMinor: number | null) {
  const safe = Number(valueMinor ?? 0);
  if (!Number.isFinite(safe)) return 0;
  return safe / 100;
}

function groupByBucket(items: RecordAttachment[]) {
  return items.reduce<Record<string, string[]>>((acc, item) => {
    const key = item.storage_bucket || "vault-docs";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item.storage_path);
    return acc;
  }, {});
}

async function requireUser(router: ReturnType<typeof useRouter>) {
  const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
  if (!user) {
    router.replace("/sign-in");
    return null;
  }
  return user;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const recordCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
  display: "grid",
  gap: 10,
};

const recordActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const detailsPanelStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  padding: 10,
  display: "grid",
  gap: 10,
};

const activePillStyle: CSSProperties = {
  borderRadius: 999,
  background: "#d1fae5",
  color: "#065f46",
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 8px",
};

const archivedPillStyle: CSSProperties = {
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 8px",
};

const logoWrapStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  flexShrink: 0,
  padding: 3,
};

const thumbWrapStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  overflow: "hidden",
  background: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const categoryBadgeStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
};

const badgeStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 700,
  color: "#0f172a",
  textTransform: "uppercase",
};

const maskedRowStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 12,
};

const recordUpdateStampStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
};

const linkedContactLinkStyle: CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 600,
  textDecoration: "none",
};

const confirmationCardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 12,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const inputStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 14,
  width: "100%",
};

const textAreaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 90,
  resize: "vertical",
};

const primaryBtn: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const ghostBtn: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const miniGhostBtn: CSSProperties = {
  ...ghostBtn,
  padding: "4px 8px",
  fontSize: 12,
};

const dangerBtn: CSSProperties = {
  ...ghostBtn,
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff1f2",
};

const inlineLinkBtn: CSSProperties = {
  border: "none",
  padding: 0,
  margin: 0,
  background: "transparent",
  textAlign: "left",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: 13,
  textDecoration: "underline",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};
