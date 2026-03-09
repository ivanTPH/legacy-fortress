"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  optionLabel,
  personalPossessionCategories,
  personalPossessionSubcategories,
} from "../../lib/categoryConfig";
import { waitForActiveUser } from "../../lib/auth/session";
import { formatCurrency } from "../../lib/currency";
import { supabase } from "../../lib/supabaseClient";
import { sanitizeFileName, validateUploadFile } from "../../lib/validation/upload";

type RecordStatus = "active" | "archived";
type WorkspaceVariant = "default" | "possessions" | "trusted_contacts";

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
};

type RecordContact = {
  id: string;
  record_id: string;
  owner_user_id: string;
  contact_name: string;
  contact_email: string | null;
  contact_role: string | null;
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
  bank_account_type: string;
  account_holder_name: string;
  sort_code: string;
  account_number: string;
  iban: string;
  swift_bic: string;
  branch_name: string;
  branch_address: string;
  bank_contact_phone: string;
  bank_contact_email: string;
  online_banking_url: string;
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
  bank_account_type: "",
  account_holder_name: "",
  sort_code: "",
  account_number: "",
  iban: "",
  swift_bic: "",
  branch_name: "",
  branch_address: "",
  bank_contact_phone: "",
  bank_contact_email: "",
  online_banking_url: "",
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
  { provider_key: "facebook", display_name: "Facebook", provider_type: "social", match_terms: ["facebook", "meta"], logo_path: null, icon_text: "f", active: true },
  { provider_key: "instagram", display_name: "Instagram", provider_type: "social", match_terms: ["instagram", "insta"], logo_path: null, icon_text: "ig", active: true },
  { provider_key: "x", display_name: "X", provider_type: "social", match_terms: ["twitter", "x.com", "x"], logo_path: null, icon_text: "x", active: true },
  { provider_key: "linkedin", display_name: "LinkedIn", provider_type: "social", match_terms: ["linkedin"], logo_path: null, icon_text: "in", active: true },
  { provider_key: "tiktok", display_name: "TikTok", provider_type: "social", match_terms: ["tiktok", "tik tok"], logo_path: null, icon_text: "tt", active: true },
  { provider_key: "youtube", display_name: "YouTube", provider_type: "social", match_terms: ["youtube"], logo_path: null, icon_text: "yt", active: true },
  { provider_key: "barclays", display_name: "Barclays", provider_type: "bank", match_terms: ["barclays"], logo_path: "/logos/banks/barclays.svg", icon_text: null, active: true },
  { provider_key: "hsbc", display_name: "HSBC", provider_type: "bank", match_terms: ["hsbc"], logo_path: "/logos/banks/hsbc.svg", icon_text: null, active: true },
  { provider_key: "lloyds", display_name: "Lloyds", provider_type: "bank", match_terms: ["lloyds", "lloyds bank"], logo_path: "/logos/banks/lloyds.svg", icon_text: null, active: true },
  { provider_key: "natwest", display_name: "NatWest", provider_type: "bank", match_terms: ["natwest", "nat west"], logo_path: "/logos/banks/natwest.svg", icon_text: null, active: true },
  { provider_key: "monzo", display_name: "Monzo", provider_type: "bank", match_terms: ["monzo"], logo_path: "/logos/banks/monzo.svg", icon_text: null, active: true },
  { provider_key: "netflix", display_name: "Netflix", provider_type: "subscription", match_terms: ["netflix"], logo_path: null, icon_text: "n", active: true },
  { provider_key: "spotify", display_name: "Spotify", provider_type: "subscription", match_terms: ["spotify"], logo_path: null, icon_text: "sp", active: true },
  { provider_key: "amazon-prime", display_name: "Amazon Prime", provider_type: "subscription", match_terms: ["amazon prime", "prime video"], logo_path: null, icon_text: "ap", active: true },
  { provider_key: "disney-plus", display_name: "Disney+", provider_type: "subscription", match_terms: ["disney+", "disney plus"], logo_path: null, icon_text: "d+", active: true },
  { provider_key: "apple-music", display_name: "Apple Music", provider_type: "subscription", match_terms: ["apple music"], logo_path: null, icon_text: "am", active: true },
  { provider_key: "bmw", display_name: "BMW", provider_type: "vehicle", match_terms: ["bmw"], logo_path: null, icon_text: "bmw", active: true },
  { provider_key: "ford", display_name: "Ford", provider_type: "vehicle", match_terms: ["ford"], logo_path: null, icon_text: "fd", active: true },
  { provider_key: "mercedes", display_name: "Mercedes-Benz", provider_type: "vehicle", match_terms: ["mercedes", "mercedes-benz"], logo_path: null, icon_text: "mb", active: true },
  { provider_key: "tesla", display_name: "Tesla", provider_type: "vehicle", match_terms: ["tesla"], logo_path: null, icon_text: "t", active: true },
];

const POSSESSION_CATEGORY_ICONS: Record<string, string> = {
  jewellery: "💍",
  art: "🖼️",
  electronics: "💻",
  household_contents: "🛋️",
  collectibles: "🏺",
  cars_vehicles: "🚗",
  documents_memorabilia: "📄",
  watches: "⌚",
  pets: "🐾",
  other: "📦",
};

const EXCLUDED_POSSESSION_CATEGORIES = new Set(["cars_vehicles", "vehicles", "transport"]);

export default function UniversalRecordWorkspace({
  sectionKey,
  categoryKey,
  title,
  subtitle,
  variant = "default",
  sectionId,
}: WorkspaceProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [records, setRecords] = useState<UniversalRecordRow[]>([]);
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [contacts, setContacts] = useState<RecordContact[]>([]);
  const [catalog, setCatalog] = useState<ProviderCatalogRow[]>(DEFAULT_PROVIDER_CATALOG);
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [archivingFor, setArchivingFor] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingDocumentFile, setPendingDocumentFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"updated_desc" | "updated_asc" | "value_desc" | "value_asc">("updated_desc");
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const [failedThumbs, setFailedThumbs] = useState<Record<string, boolean>>({});
  const formSectionRef = useRef<HTMLElement | null>(null);

  const isPossessions = variant === "possessions";
  const isTrustedContacts = variant === "trusted_contacts";
  const isFinanceSection = sectionKey === "finances";
  const addLabel = isPossessions ? "Add possession" : isTrustedContacts ? "Add contact" : isFinanceSection ? "Add record" : "Add record";
  const saveLabel = isPossessions ? "Save possession" : isTrustedContacts ? "Save contact" : isFinanceSection ? "Save record" : "Save record";

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setStatus("");
      const user = await requireUser(router);
      if (!user || !mounted) return;

      const [recordsResult, catalogResult] = await Promise.all([
        supabase
          .from("records")
          .select(
            "id,owner_user_id,section_key,category_key,title,provider_name,provider_key,summary,value_minor,currency_code,status,metadata,created_at,updated_at,archived_at",
          )
          .eq("owner_user_id", user.id)
          .eq("section_key", sectionKey)
          .eq("category_key", categoryKey)
          .order("created_at", { ascending: false }),
        supabase
          .from("provider_catalog")
          .select("provider_key,display_name,provider_type,match_terms,logo_path,icon_text,active")
          .eq("active", true),
      ]);

      if (!mounted) return;
      if (recordsResult.error) {
        setStatus(`Could not load records: ${recordsResult.error.message}`);
        setRecords([]);
        setAttachments([]);
        setContacts([]);
        setLoading(false);
        return;
      }

      const nextRecords = (recordsResult.data ?? []) as UniversalRecordRow[];
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

      const [attachmentsResult, contactsResult] = await Promise.all([
        supabase
          .from("attachments")
          .select("id,record_id,owner_user_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,checksum,created_at")
          .eq("owner_user_id", user.id)
          .in("record_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("record_contacts")
          .select("id,record_id,owner_user_id,contact_name,contact_email,contact_role,notes,created_at")
          .eq("owner_user_id", user.id)
          .in("record_id", ids)
          .order("created_at", { ascending: false }),
      ]);

      if (!mounted) return;
      setAttachments((attachmentsResult.data ?? []) as RecordAttachment[]);
      setContacts((contactsResult.data ?? []) as RecordContact[]);
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [categoryKey, router, sectionKey]);

  const totals = useMemo(() => {
    let active = 0;
    let archived = 0;
    let missingValue = 0;
    for (const row of records) {
      const major = toMajorUnits(row.value_minor);
      if (!major) missingValue += 1;
      if (row.status === "archived") archived += major;
      else active += major;
    }
    return { active, archived, missingValue };
  }, [records]);

  const filteredRecords = useMemo(() => {
    let items = [...records];
    if (isPossessions) {
      items = items.filter((row) => !EXCLUDED_POSSESSION_CATEGORIES.has(String(row.metadata?.category ?? "")));
    }
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      items = items.filter((row) => {
        const haystack = [
          row.title,
          row.provider_name,
          row.summary,
          String(row.metadata?.description ?? ""),
          String(row.metadata?.serial_number ?? ""),
          String(row.metadata?.location ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }
    if (isPossessions && categoryFilter !== "all") {
      items = items.filter((row) => String(row.metadata?.category ?? "") === categoryFilter);
    }
    items.sort((a, b) => {
      if (sortBy === "updated_desc") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === "updated_asc") return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (sortBy === "value_desc") return toMajorUnits(b.value_minor) - toMajorUnits(a.value_minor);
      return toMajorUnits(a.value_minor) - toMajorUnits(b.value_minor);
    });
    return items;
  }, [categoryFilter, isPossessions, records, search, sortBy]);

  const activeRecords = filteredRecords.filter((row) => row.status === "active");
  const archivedRecords = filteredRecords.filter((row) => row.status === "archived");

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
    setFormVisible(true);
  }

  function startEdit(row: UniversalRecordRow) {
    const rowContact = contacts.find((item) => item.record_id === row.id);
    const bankName = String(row.metadata?.bank_name ?? row.provider_name ?? "");
    const investmentProvider = String(row.metadata?.investment_provider ?? row.provider_name ?? "");
    const pensionProvider = String(row.metadata?.pension_provider ?? row.provider_name ?? "");
    const insurerName = String(row.metadata?.insurer_name ?? row.provider_name ?? "");
    const creditorName = String(row.metadata?.creditor_name ?? row.provider_name ?? "");
    setEditingId(row.id);
    setForm({
      title: row.title ?? "",
      provider_name: row.provider_name ?? "",
      summary: row.summary ?? "",
      value_major: row.value_minor != null ? String(toMajorUnits(row.value_minor)) : "",
      currency_code: (row.currency_code ?? "GBP").toUpperCase(),
      notes: String((row.metadata?.notes as string | undefined) ?? rowContact?.notes ?? ""),
      contact_name: rowContact?.contact_name ?? "",
      contact_email: rowContact?.contact_email ?? "",
      contact_role: rowContact?.contact_role ?? String(row.metadata?.relationship ?? ""),
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
      bank_account_type: String(row.metadata?.bank_account_type ?? ""),
      account_holder_name: String(row.metadata?.account_holder_name ?? ""),
      sort_code: String(row.metadata?.sort_code ?? ""),
      account_number: String(row.metadata?.account_number ?? ""),
      iban: String(row.metadata?.iban ?? ""),
      swift_bic: String(row.metadata?.swift_bic ?? ""),
      branch_name: String(row.metadata?.branch_name ?? ""),
      branch_address: String(row.metadata?.branch_address ?? ""),
      bank_contact_phone: String(row.metadata?.bank_contact_phone ?? ""),
      bank_contact_email: String(row.metadata?.bank_contact_email ?? ""),
      online_banking_url: String(row.metadata?.online_banking_url ?? ""),
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
    setFormVisible(false);
  }

  async function saveRecord() {
    setSaving(true);
    setStatus("");
    const user = await requireUser(router);
    if (!user) {
      setSaving(false);
      return;
    }

    const financeDraft = getFinanceDraft(categoryKey, form);
    if (!form.title.trim() && !(isFinanceSection && financeDraft.title)) {
      setStatus(isTrustedContacts ? "Please enter the contact's full name before saving." : "Please enter an item title before saving.");
      setSaving(false);
      return;
    }
    if (Number(form.value_major || 0) < 0) {
      setStatus("Estimated value cannot be negative.");
      setSaving(false);
      return;
    }

    const providerInput = (isFinanceSection ? financeDraft.providerName : form.provider_name) ?? "";
    const providerMatch = detectProvider(providerInput, catalog);
    const metadata = {
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
      finance_category: isFinanceSection ? categoryKey : null,
      ...financeDraft.metadata,
    };

    const payload = {
      owner_user_id: user.id,
      section_key: sectionKey,
      category_key: categoryKey,
      title: isFinanceSection ? financeDraft.title : form.title.trim() || null,
      provider_name: isFinanceSection ? financeDraft.providerName : form.provider_name.trim() || null,
      provider_key: providerMatch?.provider_key ?? null,
      summary: isFinanceSection
        ? financeDraft.summary
        : isTrustedContacts
        ? [form.contact_role.trim(), form.contact_email.trim()].filter(Boolean).join(" · ") || null
        : form.summary.trim() || null,
      value_minor: isTrustedContacts ? null : isFinanceSection ? toMinorUnits(financeDraft.valueMajor) : toMinorUnits(form.value_major),
      currency_code: (isFinanceSection ? financeDraft.currencyCode : form.currency_code || "GBP").toUpperCase(),
      metadata,
      updated_at: new Date().toISOString(),
    };

    let recordId = editingId;
    if (editingId) {
      const updateResult = await supabase
        .from("records")
        .update(payload)
        .eq("id", editingId)
        .eq("owner_user_id", user.id)
        .select("id")
        .single();
      if (updateResult.error) {
        setStatus(`Save failed: ${updateResult.error.message}`);
        setSaving(false);
        return;
      }
      recordId = updateResult.data.id;
    } else {
      const insertResult = await supabase.from("records").insert(payload).select("id").single();
      if (insertResult.error) {
        setStatus(`Save failed: ${insertResult.error.message}`);
        setSaving(false);
        return;
      }
      recordId = insertResult.data.id;
    }

    let uploadWarning = "";
    if (recordId) {
      const hasContact =
        form.contact_name.trim() ||
        form.contact_email.trim() ||
        form.contact_role.trim() ||
        (isTrustedContacts && form.title.trim()) ||
        (isTrustedContacts && form.provider_name.trim());
      if (hasContact) {
        await supabase.from("record_contacts").delete().eq("record_id", recordId).eq("owner_user_id", user.id);
        const contactResult = await supabase.from("record_contacts").insert({
          record_id: recordId,
          owner_user_id: user.id,
          contact_name: isTrustedContacts ? form.title.trim() || "Contact" : form.contact_name.trim() || "Contact",
          contact_email: form.contact_email.trim() || null,
          contact_role: form.contact_role.trim() || null,
          notes: form.notes.trim() || null,
        });
        if (contactResult.error) {
          setStatus(`Saved record, but contact failed: ${contactResult.error.message}`);
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
    cancelForm();
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus);
    setSaving(false);
  }

  async function archiveRecord(recordId: string) {
    setArchivingFor(recordId);
    setStatus("");
    const user = await requireUser(router);
    if (!user) {
      setArchivingFor(null);
      return;
    }
    const result = await supabase
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
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus);
  }

  async function deleteRecord(recordId: string) {
    const confirmed = window.confirm("Delete this record permanently?");
    if (!confirmed) return;
    const user = await requireUser(router);
    if (!user) return;

    const relatedAttachments = attachments.filter((item) => item.record_id === recordId);
    if (relatedAttachments.length) {
      const byBucket = groupByBucket(relatedAttachments);
      await Promise.all(Object.entries(byBucket).map(([bucket, paths]) => supabase.storage.from(bucket).remove(paths)));
    }

    const result = await supabase.from("records").delete().eq("id", recordId).eq("owner_user_id", user.id);
    if (result.error) {
      setStatus(`Delete failed: ${result.error.message}`);
      return;
    }
    setStatus("Record deleted.");
    setOpenRecordId((prev) => (prev === recordId ? null : prev));
    if (editingId === recordId) cancelForm();
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus);
  }

  async function uploadAttachment(recordId: string, file: File, kind: "document" | "photo") {
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
    const storageBucket = "vault-docs";
    const storagePath = `${user.id}/records/${sectionKey}/${categoryKey}/${recordId}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const uploadResult = await supabase.storage.from(storageBucket).upload(storagePath, file, { upsert: false });
    if (uploadResult.error) {
      setUploadingFor(null);
      setStatus(`Upload failed: ${uploadResult.error.message}`);
      return;
    }

    const metadataResult = await supabase.from("attachments").insert({
      record_id: recordId,
      owner_user_id: user.id,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      checksum: null,
    });
    setUploadingFor(null);
    if (metadataResult.error) {
      setStatus(`Uploaded file but could not link metadata: ${metadataResult.error.message}`);
      return;
    }

    setStatus(kind === "photo" ? "Photo uploaded." : "Attachment uploaded.");
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus);
  }

  async function removeAttachment(item: RecordAttachment) {
    const confirmed = window.confirm(`Remove "${item.file_name}" from this record?`);
    if (!confirmed) return;
    const user = await requireUser(router);
    if (!user) return;

    const storageResult = await supabase.storage.from(item.storage_bucket).remove([item.storage_path]);
    if (storageResult.error) {
      setStatus(`Could not remove file from storage: ${storageResult.error.message}`);
      return;
    }

    const deleteResult = await supabase
      .from("attachments")
      .delete()
      .eq("id", item.id)
      .eq("owner_user_id", user.id);
    if (deleteResult.error) {
      setStatus(`File removed, but metadata delete failed: ${deleteResult.error.message}`);
      return;
    }
    setStatus("Attachment removed.");
    await reloadWorkspace(router, sectionKey, categoryKey, setRecords, setAttachments, setContacts, setStatus);
  }

  async function openAttachment(item: RecordAttachment) {
    const result = await supabase.storage.from(item.storage_bucket).createSignedUrl(item.storage_path, 120);
    if (result.error || !result.data?.signedUrl) {
      setStatus(`Could not open file: ${result.error?.message ?? "Unknown error"}`);
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const renderRow = (row: UniversalRecordRow) => {
    const providerInput =
      row.provider_name ??
      row.provider_key ??
      String(
        (categoryKey === "bank"
          ? row.metadata?.bank_name
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
    const provider = detectProvider(providerInput, catalog);
    const rowAttachments = attachments.filter((item) => item.record_id === row.id);
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

    return (
      <article key={row.id} style={recordCardStyle}>
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
                fallbackLabel={row.provider_name ?? row.title ?? "Record"}
                categoryKey={isPossessions ? categoryKeyFromRow : undefined}
              />
            )}
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 700 }}>{row.title || "Untitled record"}</div>
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
              ) : isFinanceSection ? (
                <>
                  {categoryKey === "bank" ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {(row.metadata?.bank_account_type as string | undefined) || "Account"} · {(row.metadata?.account_holder_name as string | undefined) || "Holder not set"}
                    </div>
                  ) : null}
                  {categoryKey === "bank" ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {maskAccountNumber(String(row.metadata?.account_number ?? ""))} · Sort code: {String(row.metadata?.sort_code ?? "Not set")}
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
                    {formatCurrency(toMajorUnits(row.value_minor), (row.currency_code ?? "GBP").toUpperCase())} · Updated {formatDate(row.updated_at)}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{row.summary || "No summary provided."}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {categoryLabel ? `${categoryLabel} · ` : ""}
                    {formatCurrency(toMajorUnits(row.value_minor), (row.currency_code ?? "GBP").toUpperCase())}
                    {" · "}
                    Updated {formatDate(row.updated_at)}
                  </div>
                </>
              )}
            </div>
          </div>
          <span style={row.status === "archived" ? archivedPillStyle : activePillStyle}>
            {row.status === "archived" ? "Archived" : "Active"}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={ghostBtn} onClick={() => startEdit(row)}>Edit</button>
          <button type="button" style={ghostBtn} onClick={() => void deleteRecord(row.id)}>Delete</button>
          {isPossessions || isFinanceSection ? (
            <button type="button" style={ghostBtn} onClick={() => setOpenRecordId((prev) => (prev === row.id ? null : row.id))}>
              {isOpen ? "Hide attachments" : "Attachments"}
            </button>
          ) : null}
          {!isPossessions && !isTrustedContacts && !isFinanceSection ? (
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
            ) : isFinanceSection ? (
              <div style={{ color: "#475569", fontSize: 13, display: "grid", gap: 2 }}>
                {categoryKey === "bank" ? <div>IBAN: {String(row.metadata?.iban ?? "Not set")}</div> : null}
                {categoryKey === "bank" ? <div>SWIFT / BIC: {String(row.metadata?.swift_bic ?? "Not set")}</div> : null}
                {categoryKey === "investments" ? <div>Ownership: {String(row.metadata?.ownership_type ?? "Not set")}</div> : null}
                {categoryKey === "pensions" ? <div>Scheme: {String(row.metadata?.scheme_name ?? "Not set")}</div> : null}
                {categoryKey === "insurance" ? <div>Renewal date: {String(row.metadata?.renewal_date ?? "Not set")}</div> : null}
                {categoryKey === "debts" ? <div>Repayment: {String(row.metadata?.repayment_amount ?? "Not set")} ({String(row.metadata?.repayment_frequency ?? "frequency not set")})</div> : null}
                <div>Notes: {String(row.metadata?.notes ?? "No additional notes.")}</div>
              </div>
            ) : (
              <div style={{ color: "#475569", fontSize: 13 }}>
                {(row.metadata?.notes as string | undefined) || "No additional notes."}
              </div>
            )}

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Attachments & photos</div>
              {rowAttachments.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: 13 }}>No files uploaded.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {rowAttachments.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" style={inlineLinkBtn} onClick={() => void openAttachment(item)}>
                        {item.file_name}
                      </button>
                      <button type="button" style={miniGhostBtn} onClick={() => void removeAttachment(item)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isFinanceSection ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Contacts</div>
              {rowContacts.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: 13 }}>No contacts linked.</div>
              ) : (
                rowContacts.map((item) => (
                  <div key={item.id} style={{ color: "#475569", fontSize: 13 }}>
                    {item.contact_name}
                    {item.contact_role ? ` · ${item.contact_role}` : ""}
                    {item.contact_email ? ` · ${item.contact_email}` : ""}
                  </div>
                ))
              )}
            </div>
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

      <section style={cardStyle} ref={formSectionRef}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Existing records</h2>
          <button type="button" style={primaryBtn} onClick={startCreate}>
            {addLabel}
          </button>
        </div>

        {isPossessions ? (
          <div className="lf-content-grid">
            <label style={fieldStyle}>
              <span style={labelStyle}>Search</span>
              <input
                style={inputStyle}
                placeholder="Find by title, serial, location..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Category</span>
              <select style={inputStyle} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {personalPossessionCategories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Sort</span>
              <select style={inputStyle} value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="updated_desc">Recently updated</option>
                <option value="updated_asc">Oldest updated</option>
                <option value="value_desc">Highest value</option>
                <option value="value_asc">Lowest value</option>
              </select>
            </label>
          </div>
        ) : null}

        {loading ? <div style={{ color: "#64748b" }}>Loading records...</div> : null}
        {!loading && activeRecords.length === 0 ? <div style={{ color: "#64748b" }}>No records yet.</div> : null}
        {!loading && activeRecords.length > 0 ? <div style={{ display: "grid", gap: 10 }}>{activeRecords.map(renderRow)}</div> : null}
      </section>

      {archivedRecords.length > 0 ? (
        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Archived records</h2>
          <div style={{ display: "grid", gap: 10 }}>{archivedRecords.map(renderRow)}</div>
        </section>
      ) : null}

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>
            {editingId ? (isTrustedContacts ? "Edit contact" : "Edit record") : isTrustedContacts ? "Add new contact" : "Add new record"}
          </h2>
          {formVisible ? <button type="button" style={ghostBtn} onClick={cancelForm}>Cancel</button> : null}
        </div>

        {!formVisible ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Click <strong>{addLabel}</strong> to create a new record.
          </div>
        ) : isFinanceSection ? (
          <FinanceFields categoryKey={categoryKey} form={form} setForm={setForm} />
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
                <span style={labelStyle}>Contact name</span>
                <input style={inputStyle} value={form.contact_name} onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Contact email</span>
                <input style={inputStyle} value={form.contact_email} onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Contact role</span>
                <input style={inputStyle} value={form.contact_role} onChange={(event) => setForm((prev) => ({ ...prev, contact_role: event.target.value }))} />
              </label>
            </>
          ) : null}
        </div>
        )}

        {formVisible ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(isPossessions || isFinanceSection) && !editingId ? (
              <>
                <label style={ghostBtn}>
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
                </label>
                <label style={ghostBtn}>
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
                </label>
              </>
            ) : null}
            <button type="button" style={primaryBtn} disabled={saving} onClick={() => void saveRecord()}>
              {saving ? "Saving..." : editingId ? "Save changes" : saveLabel}
            </button>
            <button type="button" style={ghostBtn} onClick={cancelForm}>
              Cancel
            </button>
            {editingId ? (
              <button type="button" style={dangerBtn} onClick={() => void deleteRecord(editingId)}>
                Delete
              </button>
            ) : null}
            {editingId ? (
              <>
                <label style={ghostBtn}>
                  Upload document
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
                  Add photo
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
        ) : null}

        {formVisible && editingId ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Current attachments</div>
            {attachments.filter((item) => item.record_id === editingId).length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>No attachments yet for this possession.</div>
            ) : (
              attachments
                .filter((item) => item.record_id === editingId)
                .map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={inlineLinkBtn} onClick={() => void openAttachment(item)}>
                      Open {item.file_name}
                    </button>
                    <button type="button" style={miniGhostBtn} onClick={() => void removeAttachment(item)}>
                      Remove
                    </button>
                  </div>
                ))
            )}
          </div>
        ) : null}
      </section>
    </section>
  );
}

function FinanceFields({
  categoryKey,
  form,
  setForm,
}: {
  categoryKey: string;
  form: EditForm;
  setForm: (value: EditForm | ((prev: EditForm) => EditForm)) => void;
}) {
  if (categoryKey === "bank") {
    return (
      <div className="lf-content-grid">
        <FieldInput label="Bank name" value={form.bank_name} onChange={(value) => setForm((prev) => ({ ...prev, bank_name: value }))} />
        <FieldInput label="Account type" value={form.bank_account_type} onChange={(value) => setForm((prev) => ({ ...prev, bank_account_type: value }))} />
        <FieldInput label="Account holder name" value={form.account_holder_name} onChange={(value) => setForm((prev) => ({ ...prev, account_holder_name: value }))} />
        <FieldInput label="Sort code" value={form.sort_code} onChange={(value) => setForm((prev) => ({ ...prev, sort_code: value }))} />
        <FieldInput label="Account number" value={form.account_number} onChange={(value) => setForm((prev) => ({ ...prev, account_number: value }))} />
        <FieldInput label="Estimated balance" type="number" value={form.value_major} onChange={(value) => setForm((prev) => ({ ...prev, value_major: value }))} />
        <FieldInput label="Currency" value={form.currency_code} onChange={(value) => setForm((prev) => ({ ...prev, currency_code: value.toUpperCase() }))} />
        <FieldInput label="IBAN" value={form.iban} onChange={(value) => setForm((prev) => ({ ...prev, iban: value }))} />
        <FieldInput label="SWIFT / BIC" value={form.swift_bic} onChange={(value) => setForm((prev) => ({ ...prev, swift_bic: value }))} />
        <FieldInput label="Branch name" value={form.branch_name} onChange={(value) => setForm((prev) => ({ ...prev, branch_name: value }))} />
        <FieldInput label="Branch address" value={form.branch_address} onChange={(value) => setForm((prev) => ({ ...prev, branch_address: value }))} />
        <FieldInput label="Bank contact phone" value={form.bank_contact_phone} onChange={(value) => setForm((prev) => ({ ...prev, bank_contact_phone: value }))} />
        <FieldInput label="Bank contact email" value={form.bank_contact_email} onChange={(value) => setForm((prev) => ({ ...prev, bank_contact_email: value }))} />
        <FieldInput label="Online banking URL" value={form.online_banking_url} onChange={(value) => setForm((prev) => ({ ...prev, online_banking_url: value }))} />
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes</span>
          <textarea style={textAreaStyle} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </label>
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
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input type={type} style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function getFinanceDraft(categoryKey: string, form: EditForm) {
  if (categoryKey === "bank") {
    return {
      title: form.bank_name.trim() || null,
      providerName: form.bank_name.trim() || null,
      summary: [form.bank_account_type.trim(), form.account_holder_name.trim()].filter(Boolean).join(" · ") || null,
      valueMajor: form.value_major || "0",
      currencyCode: form.currency_code || "GBP",
      metadata: {
        bank_name: form.bank_name.trim() || null,
        bank_account_type: form.bank_account_type.trim() || null,
        account_holder_name: form.account_holder_name.trim() || null,
        sort_code: form.sort_code.trim() || null,
        account_number: form.account_number.trim() || null,
        iban: form.iban.trim() || null,
        swift_bic: form.swift_bic.trim() || null,
        branch_name: form.branch_name.trim() || null,
        branch_address: form.branch_address.trim() || null,
        bank_contact_phone: form.bank_contact_phone.trim() || null,
        bank_contact_email: form.bank_contact_email.trim() || null,
        online_banking_url: form.online_banking_url.trim() || null,
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

function maskAccountNumber(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\s+/g, "");
  if (!digits) return "Not set";
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
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
  if (provider?.logo_path) {
    return (
      <div style={logoWrapStyle} aria-label={provider.display_name}>
        <Image src={provider.logo_path} alt={provider.display_name} width={24} height={24} style={{ objectFit: "contain" }} />
      </div>
    );
  }

  const categoryIcon = categoryKey ? POSSESSION_CATEGORY_ICONS[categoryKey] : null;
  if (categoryIcon) {
    return (
      <div style={categoryBadgeStyle} aria-label={categoryKey}>
        <span>{categoryIcon}</span>
      </div>
    );
  }

  const text = provider?.icon_text || fallbackLabel.slice(0, 2).toUpperCase();
  return (
    <div style={badgeStyle} aria-label={provider?.display_name || fallbackLabel}>
      {text}
    </div>
  );
}

function detectProvider(input: string, catalog: ProviderCatalogRow[]) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  const merged = mergeCatalogRows(catalog);
  return (
    merged.find((item) => {
      const terms = [item.provider_key.toLowerCase(), item.display_name.toLowerCase(), ...(item.match_terms ?? []).map((term) => term.toLowerCase())];
      return terms.some((term) => normalized.includes(term) || term.includes(normalized));
    }) ?? null
  );
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
      // Keep default/built-in branding when DB row leaves branding empty.
      logo_path: row.logo_path ?? existing.logo_path,
      icon_text: row.icon_text ?? existing.icon_text,
      match_terms: row.match_terms?.length ? row.match_terms : existing.match_terms,
    });
  }
  return Array.from(byKey.values());
}

function isImageAttachment(item: RecordAttachment) {
  if (item.mime_type?.toLowerCase().startsWith("image/")) return true;
  const lowerPath = item.storage_path.toLowerCase();
  return lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg") || lowerPath.endsWith(".png") || lowerPath.endsWith(".webp");
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
  const storageBucket = "vault-docs";
  const isImage = file.type.toLowerCase().startsWith("image/");
  const folder = isImage ? "images" : "documents";
  const storagePath = `users/${userId}/records/${recordId}/${folder}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const uploadResult = await supabase.storage.from(storageBucket).upload(storagePath, file, { upsert: false });
  if (uploadResult.error) {
    return { ok: false, error: `File upload warning: ${uploadResult.error.message}.` };
  }

  const attachmentInsert = await supabase.from("attachments").insert({
    record_id: recordId,
    owner_user_id: userId,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    checksum: null,
  });
  if (attachmentInsert.error) {
    return { ok: false, error: `File linked warning: ${attachmentInsert.error.message}.` };
  }

  return { ok: true };
}

async function reloadWorkspace(
  router: ReturnType<typeof useRouter>,
  sectionKey: string,
  categoryKey: string,
  setRecords: (rows: UniversalRecordRow[]) => void,
  setAttachments: (rows: RecordAttachment[]) => void,
  setContacts: (rows: RecordContact[]) => void,
  setStatus: (value: string) => void,
) {
  const user = await requireUser(router);
  if (!user) return;

  const recordsResult = await supabase
    .from("records")
    .select("id,owner_user_id,section_key,category_key,title,provider_name,provider_key,summary,value_minor,currency_code,status,metadata,created_at,updated_at,archived_at")
    .eq("owner_user_id", user.id)
    .eq("section_key", sectionKey)
    .eq("category_key", categoryKey)
    .order("created_at", { ascending: false });

  if (recordsResult.error) {
    setStatus(`Could not refresh records: ${recordsResult.error.message}`);
    return;
  }
  const nextRecords = (recordsResult.data ?? []) as UniversalRecordRow[];
  setRecords(nextRecords);
  const ids = nextRecords.map((item) => item.id);
  if (ids.length === 0) {
    setAttachments([]);
    setContacts([]);
    return;
  }

  const [attachmentsResult, contactsResult] = await Promise.all([
    supabase
      .from("attachments")
      .select("id,record_id,owner_user_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,checksum,created_at")
      .eq("owner_user_id", user.id)
      .in("record_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("record_contacts")
      .select("id,record_id,owner_user_id,contact_name,contact_email,contact_role,notes,created_at")
      .eq("owner_user_id", user.id)
      .in("record_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  if (attachmentsResult.error) setStatus(`Could not refresh attachments: ${attachmentsResult.error.message}`);
  if (contactsResult.error) setStatus(`Could not refresh contacts: ${contactsResult.error.message}`);
  setAttachments((attachmentsResult.data ?? []) as RecordAttachment[]);
  setContacts((contactsResult.data ?? []) as RecordContact[]);
}

function toMinorUnits(valueMajorText: string) {
  const parsed = Number(valueMajorText || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
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
    router.replace("/signin");
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

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
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
};
