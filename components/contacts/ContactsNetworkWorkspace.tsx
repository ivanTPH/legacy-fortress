"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import {
  loadCanonicalContactsForOwner,
  loadCanonicalContactInvitationsForOwner,
  syncCanonicalContact,
  updateCanonicalContactProjectionCaches,
  type CanonicalContactContext,
  type CanonicalContactInviteStatus,
  type CanonicalContactSourceType,
  type CanonicalContactVerificationStatus,
} from "../../lib/contacts/canonicalContacts";
import { normalizeContactGroupKey, resolveContactGroupKey } from "../../lib/contacts/contactGrouping";
import { buildContactLinkValidationKey, evaluateContactLinkValidation, flattenSearchableValue } from "../../lib/contacts/contactLinkValidation";
import { buildLinkedContactRecordHref } from "../../lib/contacts/contactRouting";
import {
  groupLinkedDocumentSources,
  resolveLinkedPreviewTargets,
  type LinkedDocumentSourceItem,
} from "../../lib/contacts/linkedDocumentPreview";
import { resolveContactStatusBadge } from "../../lib/contacts/contactStatus";
import { fetchCanonicalAssets } from "../../lib/assets/fetchCanonicalAssets";
import { resolveWalletContextForRead } from "../../lib/canonicalPersistence";
import { getLegalLinkedContactDefinition, resolveLegalCategoryForAsset } from "../../lib/legalCategories";
import { getStoredFileSignedUrl } from "../../lib/assets/documentLinks";
import { loadPeopleScopeResourcesForOwner, removePeopleContact } from "../../lib/contacts/contactRepository";
import { sendContactInvite } from "../../lib/contacts/sendContactInvite";
import { buildScopedPermissionPayload, normalizeContactPermissionsOverride } from "../../lib/contacts/contactPermissions";
import { resolveOwnerAccessEligibility, type OwnerAccessEligibility } from "../../lib/contacts/accessEligibility";
import ContactInvitationManager from "../../app/(app)/components/dashboard/ContactInvitationManager";
import { useViewerAccess } from "../access/ViewerAccessContext";
import Icon from "../ui/Icon";
import DocumentPreviewDialog, { type DocumentPreviewDialogItem } from "../documents/DocumentPreviewDialog";
import { ROLE_RULES, type AccessActivationStatus, type CollaboratorRole, type SectionKey } from "../../lib/access-control/roles";

type ContactRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  contact_role: string | null;
  relationship: string | null;
  invite_status: CanonicalContactInviteStatus;
  verification_status: CanonicalContactVerificationStatus;
  source_type: CanonicalContactSourceType;
  linked_context: Array<{
    source_kind?: string;
    source_id?: string;
    section_key?: string | null;
    category_key?: string | null;
    label?: string | null;
    role?: string | null;
  }>;
  validation_overrides?: Record<string, { manually_confirmed?: boolean; updated_at?: string }>;
  updated_at: string;
};

type LinkedDocumentPreview = {
  contactId: string;
  item: DocumentPreviewDialogItem;
};

const GROUPS = [
  { key: "executors", label: "Executors", description: "People expected to help administer the estate, trustee duties, or formal authority roles." },
  { key: "family", label: "Family", description: "Family or emergency contacts someone should be able to find first." },
  { key: "advisors", label: "Advisors", description: "Solicitors, accountants, financial advisers, and similar professional contacts." },
  { key: "beneficiaries", label: "Beneficiaries", description: "People named to receive assets, gifts, or beneficiary-linked instructions." },
  { key: "trusted_contacts", label: "Trusted contacts", description: "Other important people linked to live records, providers, or practical next steps." },
] as const;

const RELATIONSHIP_ROLE_OPTIONS = Object.values(ROLE_RULES).filter((rule) => rule.role !== "owner");

export default function ContactsNetworkWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { viewer } = useViewerAccess();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [validationSourceText, setValidationSourceText] = useState<Record<string, string>>({});
  const [, setConfirmingValidationKey] = useState("");
  const [, setAssociationAlerts] = useState<string[]>([]);
  const [addContactGroupKey, setAddContactGroupKey] = useState<string | null>(null);
  const [menuContactId, setMenuContactId] = useState<string | null>(null);
  const [dismissedContactId, setDismissedContactId] = useState<string | null>(null);
  const lastContactTriggerRef = useRef<HTMLElement | null>(null);
  const [documentPreview, setDocumentPreview] = useState<LinkedDocumentPreview | null>(null);
  const [previewTargetsByContextKey, setPreviewTargetsByContextKey] = useState<Map<string, LinkedDocumentSourceItem[]>>(new Map());
  const [, setOpeningDocumentKey] = useState("");
  const [nextOfKinDraft, setNextOfKinDraft] = useState({ fullName: "", relationship: "", email: "", phone: "" });
  const [savingNextOfKin, setSavingNextOfKin] = useState(false);

  const loadContacts = useCallback(async (isMounted: () => boolean = () => true) => {
      setLoading(true);
      setStatus("");
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      if (!isMounted()) return;
      try {
        const ownerUserId = viewer.targetOwnerUserId || user.id;
        const [loaded, invitations] = await Promise.all([
          loadCanonicalContactsForOwner(supabase, ownerUserId),
          loadCanonicalContactInvitationsForOwner(supabase, ownerUserId),
        ]);
        if (!isMounted()) return;
        setContacts(mergeContactsWithInvitations(loaded as ContactRow[], invitations));
      } catch (error) {
        if (!isMounted()) return;
        setStatus(`Could not load contacts network: ${error instanceof Error ? error.message : "Unknown error"}`);
        setContacts([]);
      }
      setLoading(false);
  }, [router, viewer.targetOwnerUserId]);

  useEffect(() => {
    let mounted = true;

    queueMicrotask(() => {
      void loadContacts(() => mounted);
    });
    return () => {
      mounted = false;
    };
  }, [loadContacts]);

  useEffect(() => {
    function handleContactsUpdated() {
      void loadContacts();
    }
    window.addEventListener("lf:contacts-updated", handleContactsUpdated);
    return () => window.removeEventListener("lf:contacts-updated", handleContactsUpdated);
  }, [loadContacts]);

  useEffect(() => {
    let cancelled = false;

    async function loadValidationEvidence() {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      const ownerUserId = viewer.targetOwnerUserId || user?.id;
      if (!ownerUserId) return;

      const contexts = contacts.flatMap((contact) => contact.linked_context ?? []);
      const assetIds = Array.from(new Set(
        contexts
          .filter((item) => item.source_kind === "asset")
          .map((item) => String(item.source_id ?? "").trim())
          .filter(Boolean),
      ));
      const recordIds = Array.from(new Set(
        contexts
          .filter((item) => item.source_kind === "record")
          .map((item) => String(item.source_id ?? "").trim())
          .filter(Boolean),
      ));

      const nextEvidence: Record<string, string> = {};

      const [assetRows, documentRows, recordRows, attachmentRows] = await Promise.all([
        assetIds.length
          ? supabase.from("assets").select("id,title,summary,metadata_json").eq("owner_user_id", ownerUserId).in("id", assetIds)
          : Promise.resolve({ data: [], error: null }),
        assetIds.length
          ? supabase.from("documents").select("id,asset_id,file_name,document_kind,mime_type,storage_bucket,storage_path,created_at").eq("owner_user_id", ownerUserId).in("asset_id", assetIds).is("deleted_at", null)
          : Promise.resolve({ data: [], error: null }),
        recordIds.length
          ? supabase.from("records").select("id,title,summary,metadata").eq("owner_user_id", ownerUserId).in("id", recordIds)
          : Promise.resolve({ data: [], error: null }),
        recordIds.length
          ? supabase.from("attachments").select("id,record_id,file_name,mime_type,storage_bucket,storage_path,created_at").eq("owner_user_id", ownerUserId).in("record_id", recordIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const documentsByAssetId = new Map<string, string[]>();
      const previewSources: LinkedDocumentSourceItem[] = [];
      for (const row of ((documentRows.data ?? []) as Array<Record<string, unknown>>)) {
        const assetId = String(row.asset_id ?? "").trim();
        if (!assetId) continue;
        const items = documentsByAssetId.get(assetId) ?? [];
        items.push([row.file_name, row.document_kind].filter(Boolean).join(" "));
        documentsByAssetId.set(assetId, items);
        if (String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim()) {
          previewSources.push({
            id: String(row.id ?? ""),
            sourceKind: "asset",
            sourceId: assetId,
            fileName: String(row.file_name ?? "").trim(),
            mimeType: String(row.mime_type ?? "application/octet-stream").trim(),
            storageBucket: String(row.storage_bucket ?? "").trim(),
            storagePath: String(row.storage_path ?? "").trim(),
            createdAt: String(row.created_at ?? ""),
          });
        }
      }

      const attachmentsByRecordId = new Map<string, string[]>();
      for (const row of ((attachmentRows.data ?? []) as Array<Record<string, unknown>>)) {
        const recordId = String(row.record_id ?? "").trim();
        if (!recordId) continue;
        const items = attachmentsByRecordId.get(recordId) ?? [];
        items.push(String(row.file_name ?? "").trim());
        attachmentsByRecordId.set(recordId, items);
        if (String(row.storage_bucket ?? "").trim() && String(row.storage_path ?? "").trim()) {
          previewSources.push({
            id: String(row.id ?? ""),
            sourceKind: "record",
            sourceId: recordId,
            fileName: String(row.file_name ?? "").trim(),
            mimeType: String(row.mime_type ?? "application/octet-stream").trim(),
            storageBucket: String(row.storage_bucket ?? "").trim(),
            storagePath: String(row.storage_path ?? "").trim(),
            createdAt: String(row.created_at ?? ""),
          });
        }
      }

      for (const row of ((assetRows.data ?? []) as Array<Record<string, unknown>>)) {
        const id = String(row.id ?? "").trim();
        if (!id) continue;
        nextEvidence[`asset:${id}`] = [
          row.title,
          row.summary,
          flattenSearchableValue(row.metadata_json),
          ...(documentsByAssetId.get(id) ?? []),
        ]
          .filter(Boolean)
          .join(" ");
      }

      for (const row of ((recordRows.data ?? []) as Array<Record<string, unknown>>)) {
        const id = String(row.id ?? "").trim();
        if (!id) continue;
        nextEvidence[`record:${id}`] = [
          row.title,
          row.summary,
          flattenSearchableValue(row.metadata),
          ...(attachmentsByRecordId.get(id) ?? []),
        ]
          .filter(Boolean)
          .join(" ");
      }

      setValidationSourceText(nextEvidence);
      setPreviewTargetsByContextKey(groupLinkedDocumentSources(previewSources));
    }

    void loadValidationEvidence();
    return () => {
      cancelled = true;
    };
  }, [contacts, viewer.targetOwnerUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssociationAlerts() {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      const ownerUserId = viewer.targetOwnerUserId || user?.id;
      if (!ownerUserId) return;

      const wallet = await resolveWalletContextForRead(supabase, ownerUserId);
      const assetsRes = await fetchCanonicalAssets(supabase, {
        userId: ownerUserId,
        walletId: wallet.walletId,
        sectionKeys: ["legal", "personal"],
        select: "id,title,section_key,category_key,metadata_json,created_at",
      });

      if (cancelled) return;
      if (assetsRes.error) {
        setAssociationAlerts([]);
        return;
      }

      const linkedAssetIds = new Set(
        contacts.flatMap((contact) => contact.linked_context ?? [])
          .filter((context) => context.source_kind === "asset")
          .map((context) => String(context.source_id ?? "").trim())
          .filter(Boolean),
      );

      const alerts: string[] = [];
      const assets = (assetsRes.data ?? []) as Array<Record<string, unknown>>;
      const missingRoleLinks = assets.filter((asset) => {
        const resolvedCategory = resolveLegalCategoryForAsset({
          section_key: asset.section_key,
          category_key: asset.category_key,
          title: asset.title,
          metadata_json: (asset.metadata_json as Record<string, unknown> | null) ?? null,
        });
        if (!resolvedCategory) return false;
        if (!getLegalLinkedContactDefinition(resolvedCategory)) return false;
        return !linkedAssetIds.has(String(asset.id ?? ""));
      });

      if (missingRoleLinks.length > 0) {
        alerts.push(
          `${missingRoleLinks.length} legal record${missingRoleLinks.length === 1 ? "" : "s"} require a linked contact role but currently have no contact associated.`,
        );
      }

      const orphanedDocuments = assets.filter((asset) => {
        const sectionKey = String(asset.section_key ?? "").trim().toLowerCase();
        if (sectionKey !== "legal" && sectionKey !== "personal") return false;
        return !linkedAssetIds.has(String(asset.id ?? ""));
      });

      if (orphanedDocuments.length > 0) {
        alerts.push(
          `${orphanedDocuments.length} document-linked record${orphanedDocuments.length === 1 ? "" : "s"} exist in the vault without any associated contact.`,
        );
      }

      setAssociationAlerts(alerts);
    }

    void loadAssociationAlerts();
    return () => {
      cancelled = true;
    };
  }, [contacts, viewer.targetOwnerUserId]);

  const groupedContacts = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    const seenContactIds = new Set<string>();
    const query = search.trim().toLowerCase();
    for (const group of GROUPS) map.set(group.key, []);
    for (const contact of contacts) {
      if (seenContactIds.has(contact.id)) continue;
      if (query && !buildContactSearchText(contact).includes(query)) continue;
      seenContactIds.add(contact.id);
      map.get(resolveContactGroupKey(contact))?.push(contact);
    }
    return map;
  }, [contacts, search]);

  const selectedContactId = String(searchParams.get("contact") ?? "").trim();
  const selectedGroup = normalizeContactGroupKey(searchParams.get("group"));
  const isContactAddMode = Boolean(selectedGroup && searchParams.get("add") === "1");
  const isNextOfKinAddMode = selectedGroup === "family" && isContactAddMode;
  const selectedContactRow = useMemo(
    () => dismissedContactId === selectedContactId ? null : contacts.find((item) => item.id === selectedContactId) ?? null,
    [contacts, dismissedContactId, selectedContactId],
  );

  useEffect(() => {
    setDismissedContactId(null);
  }, [selectedContactId]);

  useEffect(() => {
    if (!isContactAddMode || !selectedGroup || viewer.readOnly) return;
    setAddContactGroupKey(selectedGroup);
  }, [isContactAddMode, selectedGroup, viewer.readOnly]);

  useEffect(() => {
    if (!documentPreview) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDocumentPreview(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [documentPreview]);

  async function confirmLinkedRecord(contact: ContactRow, context: ContactRow["linked_context"][number]) {
    if (viewer.readOnly) return;
    const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
    if (!user) {
      router.replace("/sign-in");
      return;
    }

    const key = buildContactLinkValidationKey({
      source_kind: context.source_kind === "asset" || context.source_kind === "invitation" ? context.source_kind : "record",
      source_id: String(context.source_id ?? ""),
    });
    const ownerUserId = viewer.targetOwnerUserId || user.id;
    const nextOverrides = {
      ...(contact.validation_overrides ?? {}),
      [key]: {
        manually_confirmed: true,
        updated_at: new Date().toISOString(),
      },
    };

    setConfirmingValidationKey(key);
    const updateRes = await supabase
      .from("contacts")
      .update({ validation_overrides: nextOverrides, updated_at: new Date().toISOString() })
      .eq("owner_user_id", ownerUserId)
      .eq("id", contact.id);

    if (updateRes.error) {
      setStatus(`Could not confirm linked record: ${updateRes.error.message}`);
      setConfirmingValidationKey("");
      return;
    }

    const loaded = await loadCanonicalContactsForOwner(supabase, ownerUserId);
    setContacts(loaded as ContactRow[]);
    setConfirmingValidationKey("");
  }

  function openContact(contactId: string, groupKey?: string, trigger?: HTMLElement | null) {
    lastContactTriggerRef.current = trigger ?? document.activeElement as HTMLElement | null;
    setDismissedContactId(null);
    const params = new URLSearchParams();
    params.set("contact", contactId);
    if (groupKey) params.set("group", groupKey);
    router.replace(`/contacts?${params.toString()}`);
    setMenuContactId(null);
  }

  function closeContact() {
    if (selectedContactId) setDismissedContactId(selectedContactId);
    lastContactTriggerRef.current?.focus();
    lastContactTriggerRef.current = null;
    router.replace(selectedGroup ? `/contacts?group=${selectedGroup}` : "/contacts");
  }


  function startAddContact(groupKey = "trusted_contacts") {
    setAddContactGroupKey(groupKey);
    router.replace(groupKey ? `/contacts?group=${groupKey}` : "/contacts");
  }

  async function saveNextOfKinContact() {
    setSavingNextOfKin(true);
    setStatus("");
    try {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      const ownerUserId = viewer.targetOwnerUserId || user?.id;
      if (!ownerUserId) throw new Error("No active owner context was available.");
      await syncCanonicalContact(supabase, {
        ownerUserId,
        fullName: nextOfKinDraft.fullName,
        relationship: nextOfKinDraft.relationship,
        email: nextOfKinDraft.email,
        phone: nextOfKinDraft.phone,
        contactRole: "next_of_kin",
        sourceType: "next_of_kin",
        inviteStatus: "not_invited",
        verificationStatus: "not_verified",
      });
      setNextOfKinDraft({ fullName: "", relationship: "", email: "", phone: "" });
      setAddContactGroupKey(null);
      router.replace("/contacts?group=next-of-kin");
      window.dispatchEvent(new CustomEvent("lf:contacts-updated"));
      await loadContacts();
      setStatus("Next of Kin saved. This designation does not grant vault access; invitations remain a separate action.");
    } catch (error) {
      setStatus(`Could not save Next of Kin: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSavingNextOfKin(false);
    }
  }

  function getPreviewableTargetsForContext(context: ContactRow["linked_context"][number]) {
    return resolveLinkedPreviewTargets(context, previewTargetsByContextKey);
  }

  async function openLinkedDocument(contact: ContactRow, context: ContactRow["linked_context"][number]) {
    const previewTarget = getPreviewableTargetsForContext(context)[0];
    if (!previewTarget) {
      setStatus(`No previewable document is currently linked for ${context.label || formatContextLabel(context)}.`);
      return;
    }

    const relatedHref = buildLinkedContactRecordHref({
      source_kind: context.source_kind === "asset" || context.source_kind === "invitation" ? context.source_kind : "record",
      source_id: String(context.source_id ?? ""),
      section_key: context.section_key ?? null,
      category_key: context.category_key ?? null,
      label: context.label ?? null,
      role: context.role ?? null,
    });

    setOpeningDocumentKey(previewTarget.id);
    const signedUrl = await getStoredFileSignedUrl(supabase, {
      storageBucket: previewTarget.storageBucket,
      storagePath: previewTarget.storagePath,
      expiresInSeconds: 900,
    });
    setOpeningDocumentKey("");

    if (!signedUrl) {
      setStatus(`Could not open ${previewTarget.fileName || "this linked document"} right now.`);
      return;
    }

    const validationKey = buildContactLinkValidationKey({
      source_kind: context.source_kind === "asset" || context.source_kind === "invitation" ? context.source_kind : "record",
      source_id: String(context.source_id ?? ""),
    });

    setDocumentPreview({
      contactId: contact.id,
      item: {
        fileName: previewTarget.fileName || context.label || formatContextLabel(context),
        mimeType: previewTarget.mimeType,
        previewUrl: signedUrl,
        metaLabel: describeLinkedDocumentContext(context),
        helperText: [
          validationSourceText[validationKey],
          context.label,
          context.role,
        ].filter(Boolean).join(" "),
        relatedHref: relatedHref || undefined,
        relatedLabel: relatedHref ? "Open full record" : undefined,
      },
    });
  }

  return (
    <section style={{ display: "grid", gap: 14 }}>
      {!addContactGroupKey ? <h1 style={{ margin: 0, fontSize: 28, color: "#1f1712" }}>People I Trust</h1> : null}
      {!addContactGroupKey ? <section style={panelStyle}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={contactSearchFieldStyle}>
            <span style={contactSearchLabelStyle}>
              <Icon name="search" size={16} />
              Search contacts
            </span>
            <input
              style={contactSearchInputStyle}
              placeholder="Search name, email, role, or linked record..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {!viewer.readOnly ? (
            <button
              type="button"
              style={addPersonActionStyle}
              onClick={() => startAddContact(selectedGroup || "trusted_contacts")}
              title="Add a contact and choose their wallet access"
            >
              <Icon name="person_add" size={16} />
              Add person
            </button>
          ) : null}
        </div>
      </section> : null}

      {!viewer.readOnly && addContactGroupKey ? (
        <section style={addContactGroupKey === "executors" ? { display: "grid", gap: 12 } : addContactPanelStyle} aria-label={addContactGroupKey === "executors" ? "Invite an Executor" : "Add contact and permissions"}>
          {addContactGroupKey === "executors" ? null : (
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{isNextOfKinAddMode ? "Add Next of Kin" : "Add contact"}</h2>
              <button type="button" style={rowTertiaryActionStyle} onClick={() => setAddContactGroupKey(null)}>
                <Icon name="close" size={16} />
                Cancel
              </button>
            </div>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              {isNextOfKinAddMode
                ? "Next of Kin is stored as a canonical contact designation. It does not grant vault access; invitations and permissions stay separate."
                : "The role preset comes from the selected contact group. You can still change the role, tick categories, use My wallet - all, and set view/edit permissions before sending the invite."}
            </p>
          </div>
          )}
          {isNextOfKinAddMode ? (
            <NextOfKinContactForm
              draft={nextOfKinDraft}
              saving={savingNextOfKin}
              onChange={setNextOfKinDraft}
              onSave={() => void saveNextOfKinContact()}
            />
          ) : (
            <ContactInvitationManager
              mode="full"
              guidedExecutor={addContactGroupKey === "executors"}
              initialRole={getAddContactPreset(addContactGroupKey).role}
              initialAllowedSections={getAddContactPreset(addContactGroupKey).sections}
            />
          )}
        </section>
      ) : null}

      {status ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#64748b" }}>Loading contacts network...</div> : null}

      {!loading && !addContactGroupKey ? (
        <div style={{ display: "grid", gap: 18 }}>
          {Array.from(groupedContacts.entries()).filter(([, rows]) => rows.length > 0).map(([groupKey, rows]) => {
            const group = GROUPS.find((item) => item.key === groupKey) ?? GROUPS[0];
            return (
              <section key={groupKey} aria-labelledby={`people-group-${groupKey}`}>
                <div style={simpleGroupHeadingStyle}>
                  <h2 id={`people-group-${groupKey}`} style={{ margin: 0, fontSize: 16 }}>{group.label}</h2>
                  <span style={groupCountStyle}>{rows.length}</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {rows.map((contact) => {
                    const inviteState = getInviteState(contact);
                    const isMenuOpen = menuContactId === contact.id;
                    return (
                      <article key={contact.id} className="lf-contact-row lf-contact-summary-row" style={contactSummaryRowStyle}>
                        <button
                          type="button"
                          className="lf-contact-summary-button"
                          style={contactSummaryButtonStyle}
                          onClick={(event) => openContact(contact.id, groupKey, event.currentTarget)}
                          aria-label={`Open ${contact.full_name || "person"}`}
                        >
                          <span style={{ display: "grid", gap: 3, minWidth: 0, textAlign: "left" }}>
                            <strong style={contactSummaryNameStyle}>{contact.full_name || "Unnamed person"}</strong>
                            <span style={contactSummaryRelationshipStyle}>{formatContactRoleLine(contact)}</span>
                          </span>
                          <span style={contactSummaryStatusStyle} data-tone={inviteState.tone}>{getContactSummaryStatus(contact)}</span>
                        </button>
                        <div className="lf-contact-summary-action" style={contactSummaryActionStyle}>
                          {getPrimaryContactAction(contact) ? <span className="lf-contact-next-action" style={contactNextActionStyle}>{getPrimaryContactAction(contact)}</span> : null}
                          <button
                            type="button"
                            style={overflowButtonStyle}
                            aria-label={`More actions for ${contact.full_name || "person"}`}
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            onClick={() => setMenuContactId((current) => current === contact.id ? null : contact.id)}
                          >
                            <span aria-hidden="true">•••</span>
                          </button>
                          {isMenuOpen ? (
                            <div className="lf-contact-overflow-menu" role="menu">
                              <button type="button" role="menuitem" onClick={(event) => openContact(contact.id, groupKey, event.currentTarget)}>View details</button>
                              {!viewer.readOnly ? <button type="button" role="menuitem" onClick={(event) => openContact(contact.id, groupKey, event.currentTarget)}>Manage relationship</button> : null}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!contacts.length ? (
            <section style={emptyPeopleStyle} aria-label="No people recorded">
              <strong>No people recorded yet.</strong>
              <span>Add someone when you are ready to keep their relationship to your Fortress clear.</span>
              {!viewer.readOnly ? <button type="button" style={rowPrimaryActionStyle} onClick={() => startAddContact("trusted_contacts")}><Icon name="person_add" size={16} />Add person</button> : null}
            </section>
          ) : null}
        </div>
      ) : null}
      {selectedContactRow ? (
        <PersonDetailDrawer
          contact={selectedContactRow}
          readOnly={viewer.readOnly}
          ownerUserId={viewer.targetOwnerUserId || null}
          onSaved={() => { window.dispatchEvent(new CustomEvent("lf:contacts-updated")); void loadContacts(); }}
          onClose={closeContact}
        />
      ) : null}
      {documentPreview ? (
        <DocumentPreviewDialog
          item={documentPreview.item}
          onClose={() => setDocumentPreview(null)}
        />
      ) : null}
    </section>
  );
}

function getContactSummaryStatus(contact: ContactRow) {
  if (contact.verification_status === "active") return "Linked";
  if (["accepted", "pending_verification", "verification_submitted", "verified"].includes(contact.verification_status)) return "Invitation accepted";
  if (contact.invite_status === "invite_sent") return "Invitation awaiting acceptance";
  if (contact.email) return "Invitation not sent";
  return "Recorded";
}

function getPrimaryContactAction(contact: ContactRow) {
  if (contact.invite_status === "invite_sent") return "Follow up";
  if (contact.invite_status === "not_invited" && contact.email) return "Send invitation";
  return "";
}

function canShowAccessManagement(contact: ContactRow) {
  return (contact.verification_status === "verified" || contact.verification_status === "active")
    && contact.contact_role !== "executor";
}

function InvitationProgressTracker({ contact, compact = false }: { contact: ContactRow; compact?: boolean }) {
  const hasInvitation = contact.invite_status !== "not_invited"
    || contact.source_type === "invitation"
    || contact.verification_status !== "not_verified";
  if (!hasInvitation) return null;

  const accepted = ["accepted", "pending_verification", "verification_submitted", "verified", "active"].includes(contact.verification_status);
  const linked = contact.verification_status === "active";
  const verificationRequired = ["pending_verification", "verification_submitted", "verified", "active"].includes(contact.verification_status);
  const stages = [
    { label: "Prepared", complete: true },
    { label: "Sent", complete: contact.invite_status === "invite_sent" || accepted || linked },
    { label: "Accepted", complete: accepted || linked },
    ...(verificationRequired ? [{ label: "Verified", complete: ["verified", "active"].includes(contact.verification_status) }] : []),
    { label: "Linked", complete: linked },
  ];
  const currentIndex = stages.reduce((index, stage, candidateIndex) => stage.complete ? candidateIndex : index, -1);
  const accessibleState = stages.map((stage, index) => `${stage.label} ${stage.complete && index <= currentIndex ? "complete" : "pending"}`).join(", ");

  return (
    <div className={`lf-invitation-tracker${compact ? " is-compact" : ""}`} aria-label={`Invitation progress: ${accessibleState}`}>
      <div className="lf-invitation-tracker-line" aria-hidden="true">
        {stages.map((stage, index) => (
          <span key={stage.label} className="lf-invitation-tracker-stage-wrap">
            <span className={`lf-invitation-tracker-dot${stage.complete && index <= currentIndex ? " is-complete" : ""}${index === currentIndex ? " is-current" : ""}`} />
            {index < stages.length - 1 ? <span className={`lf-invitation-tracker-segment${index < currentIndex ? " is-complete" : ""}`} /> : null}
          </span>
        ))}
      </div>
      <div className="lf-invitation-tracker-labels">
        {stages.map((stage) => <span key={stage.label}>{stage.label}</span>)}
      </div>
    </div>
  );
}

function PersonDetailDrawer({
  contact,
  readOnly,
  ownerUserId,
  onSaved,
  onClose,
}: {
  contact: ContactRow;
  readOnly: boolean;
  ownerUserId: string | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [managementView, setManagementView] = useState<"edit" | "relationship" | "invitation" | "access" | "remove" | null>(null);
  const relatedContexts = (contact.linked_context ?? []).filter((context) => context.source_kind !== "invitation");
  const status = getContactSummaryStatus(contact);
  const inviteState = getInviteState(contact);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="lf-person-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="lf-person-drawer" role="dialog" aria-modal="true" aria-labelledby="person-drawer-title" onClick={(event) => event.stopPropagation()}>
        <div className="lf-person-drawer-header">
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <h2 id="person-drawer-title" style={{ margin: 0, fontSize: 22 }}>{contact.full_name || "Unnamed person"}</h2>
            <span style={contactSummaryRelationshipStyle}>{formatContactRoleLine(contact)}</span>
          </div>
          <button ref={closeRef} type="button" className="lf-person-drawer-close" aria-label="Close person details" onClick={onClose}>×</button>
        </div>

        <div className="lf-person-drawer-content">
          {contact.email ? <div style={drawerContactLineStyle}>{contact.email}</div> : null}
          <div style={contactSummaryStatusStyle} data-tone={inviteState.tone}>{status}</div>
          {contact.invite_status === "invite_sent" ? <p style={drawerExplanationStyle}>You invited this person to connect with your Fortress. Their response is still outstanding.</p> : null}
          {contact.invite_status === "not_invited" && contact.email ? <p style={drawerExplanationStyle}>This person is recorded in People I Trust. You can decide separately whether to invite them.</p> : null}

          <InvitationProgressTracker contact={contact} />

          {relatedContexts.length ? (
            <section style={drawerSectionStyle} aria-labelledby="person-related-heading">
              <span id="person-related-heading" style={drawerSectionLabelStyle}>Related to</span>
              <div style={{ display: "grid", gap: 6 }}>
                {relatedContexts.slice(0, 3).map((context, index) => <span key={`${context.source_id}-${index}`} style={drawerRelatedItemStyle}>{context.label || describeLinkedDocumentContext(context)}</span>)}
              </div>
            </section>
          ) : null}

          {(status === "Linked" || contact.verification_status === "active") ? (
            <p style={drawerExplanationStyle}>This person is securely linked as a relationship. They do not have access to your private Vault merely because they are linked.</p>
          ) : null}

          {!readOnly && (contact.invite_status === "invite_sent" || contact.invite_status === "not_invited") ? (
            <button type="button" style={rowPrimaryActionStyle} onClick={() => setManagementView("invitation")}>
              <Icon name={contact.invite_status === "invite_sent" ? "mail" : "send"} size={16} />
              {contact.invite_status === "invite_sent" ? "Manage invitation" : "Send invitation"}
            </button>
          ) : null}

          {!readOnly ? (
            <div className="lf-person-more-details">
              <button type="button" className="lf-person-more-summary" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((current) => !current)}>••• More</button>
              {moreOpen ? (
                <div className="lf-person-more-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setManagementView("edit"); }}>Edit details</button>
                  <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setManagementView("relationship"); }}>Edit relationship</button>
                  {(contact.invite_status === "invite_sent" || contact.invite_status === "not_invited") ? <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setManagementView("invitation"); }}>Manage invitation</button> : null}
                  {canShowAccessManagement(contact) ? <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setManagementView("access"); }}>Manage access</button> : null}
                  <button type="button" role="menuitem" className="is-danger" onClick={() => { setMoreOpen(false); setManagementView("remove"); }}>Remove person</button>
                </div>
              ) : null}
            </div>
          ) : null}

          {managementView ? (
            <PersonManagementPanel
              contact={contact}
              view={managementView}
              ownerUserId={ownerUserId}
              onBack={() => setManagementView(null)}
              onNavigate={setManagementView}
              onSaved={onSaved}
              readOnly={readOnly}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function PersonManagementPanel({
  contact,
  view,
  ownerUserId,
  readOnly,
  onBack,
  onNavigate,
  onSaved,
}: {
  contact: ContactRow;
  view: "edit" | "relationship" | "invitation" | "access" | "remove";
  ownerUserId: string | null;
  readOnly: boolean;
  onBack: () => void;
  onNavigate: (view: "edit" | "relationship" | "invitation" | "access" | "remove") => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(contact.full_name);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [relationship, setRelationship] = useState(contact.relationship ?? "");
  const [role, setRole] = useState(contact.contact_role ?? "friend_or_family");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [accessSummary, setAccessSummary] = useState<string[] | null>(null);
  const [accessOptions, setAccessOptions] = useState<Array<{ sourceKind: "asset" | "record"; sourceId: string; label: string; sectionKey: string | null }>>([]);
  const [selectedAccessKeys, setSelectedAccessKeys] = useState<string[]>([]);
  const [accessEditOpen, setAccessEditOpen] = useState(false);
  const [accessGrantId, setAccessGrantId] = useState<string | null>(null);
  const [accessInvitationId, setAccessInvitationId] = useState<string | null>(null);
  const [accessCanConfigure, setAccessCanConfigure] = useState(false);
  const [accessEligibility, setAccessEligibility] = useState<OwnerAccessEligibility | null>(null);
  const [accessPermissionLabel, setAccessPermissionLabel] = useState("View only");

  useEffect(() => {
    if (view !== "access") return;
    let cancelled = false;
    async function loadAccess() {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      const ownerId = ownerUserId || user?.id;
      if (!ownerId) return;
      const result = await supabase
        .from("account_access_grants")
        .select("id,invitation_id,linked_user_id,activation_status,permissions_override")
        .eq("owner_user_id", ownerId)
        .eq("contact_id", contact.id)
        .in("activation_status", ["accepted", "pending_verification", "verification_submitted", "verified", "active"]);
      if (cancelled) return;
      if (result.error) {
        setStatus("Access details are not available right now.");
        setAccessSummary([]);
        return;
      }
      const grants = (result.data ?? []) as Array<{ id: string; invitation_id?: string | null; linked_user_id?: string | null; activation_status?: string | null; permissions_override?: Record<string, unknown> | null }>;
      const grant = grants[0] ?? null;
      const permissions = normalizeContactPermissionsOverride(grant?.permissions_override);
      const eligibility = resolveOwnerAccessEligibility({
        invitationStatus: contact.invite_status,
        activationStatus: grant?.activation_status ?? contact.verification_status,
        linkedUserId: grant?.linked_user_id,
        assignedRole: contact.contact_role,
      });
      setAccessGrantId(grant?.id ?? null);
      setAccessInvitationId(grant?.invitation_id ?? contact.linked_context.find((context) => context.source_kind === "invitation")?.source_id ?? null);
      setAccessEligibility(eligibility);
      setAccessPermissionLabel(permissions.read_only === false ? "Can edit" : "View only");
      setSelectedAccessKeys([
        ...permissions.asset_ids.map((id) => `asset:${id}`),
        ...permissions.record_ids.map((id) => `record:${id}`),
      ]);
      setAccessCanConfigure(eligibility === "eligible" && Boolean(grant?.id));
      const scopes = grants
        .flatMap((grant) => {
          const grantPermissions = normalizeContactPermissionsOverride(grant.permissions_override);
          return [
            ...grantPermissions.allowed_sections,
            ...(grantPermissions.asset_ids.length || grantPermissions.record_ids.length ? ["Selected records"] : []),
          ];
        });
      setAccessSummary(Array.from(new Set(scopes)));
      if (grant?.linked_user_id) {
        const resources = await loadPeopleScopeResourcesForOwner(supabase, ownerId);
        if (cancelled) return;
        const allowedSections = new Set(getAccessSectionsForRole(contact.contact_role));
        const options = resources
          .map((resource) => ({ ...resource, normalizedSectionKey: normalizeAccessSectionKey(resource.section_key) }))
          .filter((resource) => !resource.normalizedSectionKey || allowedSections.has(resource.normalizedSectionKey))
          .map((resource) => ({
            sourceKind: resource.source_kind,
            sourceId: resource.id,
            label: resource.title || (resource.source_kind === "asset" ? resource.provider_name : resource.summary) || "Unnamed record",
            sectionKey: resource.normalizedSectionKey,
          }));
        setAccessOptions(options);
        const selectedKeys = [
          ...permissions.asset_ids.map((id) => `asset:${id}`),
          ...permissions.record_ids.map((id) => `record:${id}`),
        ];
        const selectedLabels = options
          .filter((option) => selectedKeys.includes(`${option.sourceKind}:${option.sourceId}`))
          .map((option) => option.label);
        if (selectedLabels.length) setAccessSummary(selectedLabels);
      }
    }
    void loadAccess();
    return () => { cancelled = true; };
  }, [contact.id, ownerUserId, view]);

  async function resolveOwner() {
    const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
    return { user, ownerId: ownerUserId || user?.id || "" };
  }

  async function saveDetails() {
    if (readOnly) return;
    setSaving(true);
    setStatus("");
    const { ownerId } = await resolveOwner();
    if (!ownerId) {
      setStatus("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }
    const result = await supabase
      .from("contacts")
      .update({
        full_name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        relationship: relationship.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_user_id", ownerId)
      .eq("id", contact.id);
    setSaving(false);
    if (result.error) {
      setStatus("Could not save these details.");
      return;
    }
    setStatus("Details saved.");
    onSaved();
  }

  async function saveRelationship() {
    if (readOnly) return;
    setSaving(true);
    setStatus("");
    const { ownerId } = await resolveOwner();
    if (!ownerId) {
      setStatus("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }
    const nextRelationship = relationship.trim() || ROLE_RULES[role as CollaboratorRole]?.label || role;
    const contactUpdate = {
      contact_role: role,
      relationship: nextRelationship,
      updated_at: new Date().toISOString(),
    };
    const result = await supabase
      .from("contacts")
      .update(contactUpdate)
      .eq("owner_user_id", ownerId)
      .eq("id", contact.id);
    if (!result.error) {
      try {
        await updateCanonicalContactProjectionCaches(supabase, {
          ownerUserId: ownerId,
          contact: {
            id: contact.id,
            full_name: contact.full_name,
            email: contact.email,
            relationship: nextRelationship,
            contact_role: role,
          },
        });
        const invitationId = contact.linked_context.find((context) => context.source_kind === "invitation")?.source_id;
        if (invitationId) {
          const assignmentResult = await supabase
            .from("role_assignments")
            .update({ assigned_role: role, updated_at: new Date().toISOString() })
            .eq("owner_user_id", ownerId)
            .eq("invitation_id", invitationId);
          if (assignmentResult.error) throw new Error(assignmentResult.error.message);
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not update this relationship.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setStatus(result.error ? "Could not update this relationship." : "Relationship updated.");
    if (!result.error) onSaved();
  }

  async function updateInvitation(nextStatus: "revoked") {
    if (readOnly) return;
    const invitationId = contact.linked_context.find((context) => context.source_kind === "invitation")?.source_id;
    const { ownerId } = await resolveOwner();
    if (!ownerId || !invitationId) {
      setStatus("This invitation cannot be changed from here.");
      return;
    }
    setSaving(true);
    const result = await supabase
      .from("contact_invitations")
      .update({ invitation_status: nextStatus, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("owner_user_id", ownerId)
      .eq("id", invitationId);
    if (!result.error) {
      await supabase.from("contacts").update({ invite_status: nextStatus, verification_status: nextStatus, updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId).eq("id", contact.id);
      await supabase.from("invitation_events").insert({ owner_user_id: ownerId, invitation_id: invitationId, event_type: nextStatus, payload: { source: "people_drawer" } });
    }
    setSaving(false);
    setStatus(result.error ? "Could not cancel this invitation." : "Invitation cancelled. The person remains in People I Trust.");
    if (!result.error) onSaved();
  }

  async function resendInvitation() {
    if (readOnly) return;
    const invitationId = contact.linked_context.find((context) => context.source_kind === "invitation")?.source_id;
    const { user, ownerId } = await resolveOwner();
    if (!ownerId || !invitationId || !user) {
      setStatus("This invitation cannot be resent from here.");
      return;
    }
    setSaving(true);
    try {
      await sendContactInvite(supabase, {
        ownerUserId: ownerId,
        ownerEmail: user.email,
        contactId: contact.id,
        contactName: contact.full_name,
        contactEmail: contact.email ?? "",
        contactRelationship: contact.relationship,
        assignedRole: toCollaboratorRole(contact.contact_role),
        invitationId,
        invitedAt: new Date().toISOString(),
        activationStatus: toAccessActivationStatus(contact.verification_status),
        resend: true,
        origin: typeof window === "undefined" ? null : window.location.origin,
      });
      setStatus(`Invitation request submitted for ${contact.email}.`);
      onSaved();
    } catch {
      setStatus("Could not resend this invitation.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAccess(nextKeys: string[]) {
    if (readOnly || !accessGrantId || !accessCanConfigure) return;
    const { ownerId } = await resolveOwner();
    if (!ownerId) return;
    setSaving(true);
    const allowedSections = Array.from(new Set(nextKeys
      .map((key) => accessOptions.find((option) => `${option.sourceKind}:${option.sourceId}` === key)?.sectionKey)
      .filter((value): value is SectionKey => Boolean(value))));
    const payload = buildScopedPermissionPayload({
      allowedSections,
      assetIds: nextKeys.filter((key) => key.startsWith("asset:")).map((key) => key.slice(6)),
      recordIds: nextKeys.filter((key) => key.startsWith("record:")).map((key) => key.slice(7)),
      editableAssetIds: [],
      editableRecordIds: [],
      ownerNotes: "",
    });
    const grantUpdate = await supabase.from("account_access_grants").update({ permissions_override: payload, updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId).eq("id", accessGrantId);
    if (!grantUpdate.error) {
      if (accessInvitationId) {
      await supabase.from("role_assignments").update({ permissions_override: payload, updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId).eq("invitation_id", accessInvitationId);
      await supabase.from("contact_invitations").update({ permissions_override: payload, updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId).eq("id", accessInvitationId);
      await supabase.from("invitation_events").insert({ owner_user_id: ownerId, invitation_id: accessInvitationId, event_type: nextKeys.length ? "access_updated" : "access_revoked", payload: { source: "people_drawer", scope_count: nextKeys.length } });
      }
      setSelectedAccessKeys(nextKeys);
      setAccessSummary(nextKeys.length ? ["Selected records"] : []);
      setAccessEditOpen(false);
      setStatus(nextKeys.length ? "Access updated." : "Access removed. The person remains in People I Trust.");
      onSaved();
    } else {
      setStatus("Could not update access.");
    }
    setSaving(false);
  }

  async function removePerson() {
    if (readOnly) return;
    const { ownerId } = await resolveOwner();
    if (!ownerId || !window.confirm(`Remove ${contact.full_name || "this person"}? Existing audit history will be retained.`)) return;
    setSaving(true);
    try {
      await removePeopleContact(supabase, { ownerUserId: ownerId, contactId: contact.id });
      onSaved();
      onBack();
    } catch {
      setStatus("Could not remove this person.");
    } finally {
      setSaving(false);
    }
  }

  const title = view === "edit" ? `Edit ${contact.full_name || "person"}` : view === "relationship" ? `Edit ${contact.full_name || "person"}'s relationship` : view === "invitation" ? `${contact.full_name || "Person"}'s invitation` : view === "access" ? `${contact.full_name || "Person"}'s Vault access` : `Remove ${contact.full_name || "person"}`;

  return (
    <section className="lf-person-management-panel" aria-label={title}>
      <button type="button" className="lf-person-back-button" onClick={onBack}>← Back to {contact.full_name || "person"}</button>
      <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
      {view === "edit" ? (
        <div className="lf-person-edit-form">
          <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span>Phone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <button type="button" style={rowPrimaryActionStyle} disabled={saving || !name.trim()} onClick={() => void saveDetails()}>Save changes</button>
        </div>
      ) : null}
      {view === "relationship" ? (
        <div className="lf-person-edit-form">
          <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}>{RELATIONSHIP_ROLE_OPTIONS.map((option) => <option key={option.role} value={option.role}>{option.label}</option>)}</select></label>
          <label><span>Relationship</span><input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="For example, friend or family" /></label>
          <span style={drawerExplanationStyle}>Changing a relationship does not grant Vault access. Sharing records remains a separate owner decision.</span>
          <button type="button" style={rowPrimaryActionStyle} disabled={saving} onClick={() => void saveRelationship()}>Save relationship</button>
        </div>
      ) : null}
      {view === "invitation" ? (
        <div className="lf-person-focused-panel">
          <span style={drawerExplanationStyle}>{contact.invite_status === "invite_sent" ? "Status: Awaiting response" : "This person is recorded but has not been invited."}</span>
          {contact.email ? <span style={drawerContactLineStyle}>{contact.email}</span> : <span style={drawerExplanationStyle}>Add an email address in Edit details before sending an invitation.</span>}
          {contact.invite_status === "invite_sent" ? <button type="button" style={rowPrimaryActionStyle} disabled={saving} onClick={() => void resendInvitation()}>Resend invitation</button> : null}
          {contact.invite_status === "invite_sent" ? <button type="button" style={rowSecondaryActionStyle} disabled={saving} onClick={() => void updateInvitation("revoked")}>Cancel invitation</button> : null}
        </div>
      ) : null}
      {view === "access" ? (
        <div className="lf-person-focused-panel">
          <strong>Vault access</strong>
          {accessSummary === null ? <span style={drawerExplanationStyle}>Checking current access…</span> : accessSummary.length ? <><span style={drawerExplanationStyle}>{accessSummary.length} {accessSummary.length === 1 ? "record" : "records"} shared · {accessPermissionLabel}</span>{accessSummary.map((scope) => <span key={scope} style={drawerRelatedItemStyle}>{humanizeContactTerm(scope)}</span>)}{accessCanConfigure ? <div className="lf-person-access-actions"><button type="button" style={rowPrimaryActionStyle} onClick={() => setAccessEditOpen((current) => !current)}>{accessEditOpen ? "Close access choices" : "Edit access"}</button><button type="button" style={rowSecondaryActionStyle} disabled={saving} onClick={() => { if (window.confirm(`Remove ${contact.full_name || "this person's"} Vault access?`)) void saveAccess([]); }}>Remove access</button></div> : null}</> : <><strong>None</strong>{accessEligibility === "invitation_pending" ? <><span style={drawerExplanationStyle}>{contact.full_name || "This person"} must accept your invitation before you can share Vault records.</span><button type="button" style={rowPrimaryActionStyle} onClick={() => onNavigate("invitation")}>Manage invitation</button></> : accessEligibility === "not_invited" ? <><span style={drawerExplanationStyle}>Invite this person and wait for them to connect before sharing Vault records.</span><button type="button" style={rowPrimaryActionStyle} onClick={() => onNavigate("invitation")}>Invite this person</button></> : accessEligibility === "verification_required" ? <span style={drawerExplanationStyle}>This person is connected, but needs to complete the required verification before Vault records can be shared.</span> : accessEligibility === "executor_restricted" ? <span style={drawerExplanationStyle}>Being recorded as an executor does not give this person access to your private Vault while you are alive.</span> : accessEligibility === "link_required" ? <span style={drawerExplanationStyle}>This person must finish connecting their Legacy Fortress account before Vault records can be shared.</span> : <><span style={drawerExplanationStyle}>{contact.full_name || "This person"} does not currently have access to your private Vault.</span>{accessCanConfigure ? <button type="button" style={rowPrimaryActionStyle} onClick={() => setAccessEditOpen((current) => !current)}>{accessEditOpen ? "Close access choices" : "Give access"}</button> : null}</>}</>}
          {accessEditOpen && accessCanConfigure ? <div className="lf-person-access-chooser"><strong>Choose what {contact.full_name || "this person"} can access</strong>{accessOptions.length ? accessOptions.map((option) => { const key = `${option.sourceKind}:${option.sourceId}`; return <label key={key}><input type="checkbox" checked={selectedAccessKeys.includes(key)} onChange={() => setSelectedAccessKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{option.label}</label>; }) : <span style={drawerExplanationStyle}>There are no eligible records to share.</span>}<span style={drawerExplanationStyle}>Permission: Can view</span><button type="button" style={rowPrimaryActionStyle} disabled={saving || !accessOptions.length} onClick={() => void saveAccess(selectedAccessKeys)}>Save access</button></div> : null}
        </div>
      ) : null}
      {view === "remove" ? (
        <div className="lf-person-focused-panel">
          <p style={drawerExplanationStyle}>This removes the person from People I Trust. Existing audit history is retained. Any invitation or access relationship is handled by the canonical contact service.</p>
          <button type="button" className="lf-person-danger-button" disabled={saving} onClick={() => void removePerson()}>Remove person</button>
        </div>
      ) : null}
      {status ? <span role="status" style={drawerExplanationStyle}>{status}</span> : null}
    </section>
  );
}

function toCollaboratorRole(value: string | null): CollaboratorRole {
  const allowed: CollaboratorRole[] = ["executor", "professional_advisor", "accountant", "financial_advisor", "lawyer", "friend_or_family"];
  return allowed.includes(value as CollaboratorRole) ? value as CollaboratorRole : "friend_or_family";
}

function toAccessActivationStatus(value: string | null): AccessActivationStatus {
  const allowed: AccessActivationStatus[] = ["invited", "accepted", "pending_verification", "verification_submitted", "verified", "active", "rejected", "revoked"];
  return allowed.includes(value as AccessActivationStatus) ? value as AccessActivationStatus : "invited";
}

function getAccessSectionsForRole(value: string | null): SectionKey[] {
  const role = toCollaboratorRole(value);
  return ["dashboard", ...ROLE_RULES[role].allowedSections] as SectionKey[];
}

function normalizeAccessSectionKey(value: string | null): SectionKey | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "finances") return "financial";
  if (["dashboard", "profile", "personal", "financial", "legal", "property", "business", "digital", "settings"].includes(normalized)) return normalized as SectionKey;
  return null;
}

function formatContextLabel(context: ContactRow["linked_context"][number]) {
  return [context.section_key, context.category_key, context.role].filter(Boolean).join(" · ") || "Linked context";
}

function buildContactSearchText(contact: ContactRow) {
  return [
    contact.full_name,
    contact.email,
    contact.phone,
    contact.contact_role,
    contact.relationship,
    contact.source_type,
    ...(contact.linked_context ?? []).flatMap((context) => [
      context.label,
      context.role,
      context.section_key,
      context.category_key,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function mergeContactsWithInvitations(
  contacts: ContactRow[],
  invitations: Array<{
    id: string;
    contact_id: string | null;
    contact_name: string;
    contact_email: string;
    assigned_role: string;
    invitation_status: string;
    activation_status: string;
    invited_at: string;
    sent_at: string | null;
    linked_context: CanonicalContactContext[];
  }>,
) {
  const mergedById = new Map(contacts.map((contact) => [contact.id, contact]));

  for (const row of invitations) {
    const contactId = String(row.contact_id ?? "").trim();
    const mergedId = contactId || row.id;
    const invitationContext: CanonicalContactContext = {
      source_kind: "invitation",
      source_id: row.id,
      section_key: "dashboard",
      category_key: "contacts",
      label: "Contact invitation",
      role: row.assigned_role || null,
    };
    const linkedContext = mergeLinkedContexts([...(row.linked_context ?? []), invitationContext]);
    const existing = contactId ? mergedById.get(contactId) : null;

    if (existing) {
      mergedById.set(contactId, {
        ...existing,
        full_name: row.contact_name || existing.full_name || "Unnamed contact",
        email: row.contact_email || existing.email,
        contact_role: row.assigned_role || existing.contact_role,
        invite_status: row.sent_at ? "invite_sent" : existing.invite_status,
        verification_status: mapInvitationActivationStatus(row.activation_status),
        source_type: existing.source_type === "manual" ? "invitation" : existing.source_type,
        linked_context: mergeLinkedContexts([...normalizeContactContexts(existing.linked_context ?? []), ...linkedContext]),
        updated_at: row.sent_at || row.invited_at || existing.updated_at,
      });
      continue;
    }

    mergedById.set(mergedId, {
      id: mergedId,
      full_name: row.contact_name || "Unnamed contact",
      email: row.contact_email || null,
      phone: null,
      contact_role: row.assigned_role || "trusted_contact",
      relationship: null,
      invite_status: row.sent_at ? "invite_sent" : "not_invited",
      verification_status: mapInvitationActivationStatus(row.activation_status),
      source_type: "invitation",
      linked_context: linkedContext,
      validation_overrides: {},
      updated_at: row.sent_at || row.invited_at,
    });
  }

  return Array.from(mergedById.values());
}

function mergeLinkedContexts(contexts: CanonicalContactContext[]) {
  const merged = new Map<string, CanonicalContactContext>();
  for (const context of contexts) {
    const key = [
      context.source_kind,
      context.source_id,
      context.section_key ?? "",
      context.category_key ?? "",
      context.role ?? "",
    ].join(":");
    merged.set(key, context);
  }
  return Array.from(merged.values());
}

function normalizeContactContexts(contexts: ContactRow["linked_context"]): CanonicalContactContext[] {
  return (contexts ?? []).filter((context): context is CanonicalContactContext => {
    return (context.source_kind === "asset" || context.source_kind === "record" || context.source_kind === "invitation")
      && Boolean(String(context.source_id ?? "").trim());
  });
}

function mapInvitationActivationStatus(value: string): CanonicalContactVerificationStatus {
  if (value === "active" || value === "verified" || value === "accepted" || value === "invited") return value;
  if (value === "revoked" || value === "rejected") return value;
  if (value === "pending_verification" || value === "verification_submitted") return value;
  return "invited";
}

function describeLinkedDocumentContext(context: ContactRow["linked_context"][number]) {
  const categoryKey = String(context.category_key ?? "").trim().toLowerCase();
  const sectionKey = String(context.section_key ?? "").trim().toLowerCase();

  if (categoryKey === "identity-documents") return "Identity";
  if (categoryKey === "power-of-attorney") return "Power of attorney";
  if (categoryKey === "trusts") return "Trust";
  if (categoryKey === "wills") return "Will";
  if (sectionKey === "finances") return "Finance";
  if (sectionKey === "property") return "Property";
  if (sectionKey === "business") return "Business";
  if (sectionKey === "cars_transport") return "Vehicle";
  if (sectionKey === "personal") return "Personal";
  if (sectionKey === "legal") return "Legal";
  return "Document";
}

function getLinkedDocumentIcon(context: ContactRow["linked_context"][number]) {
  const categoryKey = String(context.category_key ?? "").trim().toLowerCase();
  const sectionKey = String(context.section_key ?? "").trim().toLowerCase();

  if (categoryKey === "identity-documents") return "badge";
  if (categoryKey === "power-of-attorney") return "gavel";
  if (categoryKey === "trusts") return "description";
  if (categoryKey === "wills") return "article";
  if (sectionKey === "finances") return "account_balance";
  if (sectionKey === "property") return "home";
  if (sectionKey === "business") return "storefront";
  if (sectionKey === "cars_transport") return "directions_car";
  if (sectionKey === "personal") return "folder_shared";
  return "description";
}

function summarizeGroupRows(rows: ContactRow[], validationSourceText: Record<string, string>) {
  const readyCount = rows.filter((contact) => getInviteState(contact).label === "Ready to invite").length;
  const sentCount = rows.filter((contact) => getInviteState(contact).label === "Invite sent").length;
  const pendingCount = rows.filter((contact) => getInviteState(contact).label === "Awaiting acceptance").length;
  const linkedCount = rows.filter((contact) => getAssociationState(contact, validationSourceText).tone === "success").length;
  const warningCount = rows.filter((contact) => getAssociationState(contact, validationSourceText).tone === "warning").length;

  return {
    warningCount,
    statusSummary: [
      readyCount ? `${readyCount} ready to invite` : "",
      sentCount ? `${sentCount} invite sent` : "",
      pendingCount ? `${pendingCount} awaiting acceptance` : "",
      linkedCount ? `${linkedCount} linked` : "",
      warningCount ? `${warningCount} action required` : "",
    ].filter(Boolean).join(" · "),
  };
}

function getInviteState(contact: ContactRow) {
  const base = resolveContactStatusBadge({
    email: contact.email,
    inviteStatus: contact.invite_status,
    verificationStatus: contact.verification_status,
  });

  if (base.label === "Ready to send") return { label: "Ready to invite", tone: "neutral" as const };
  if (base.label === "Sent") return { label: "Invite sent", tone: "neutral" as const };
  if (base.label === "Pending") return { label: "Awaiting acceptance", tone: "warning" as const };
  if (base.label === "Accepted") return { label: "Invite accepted", tone: "success" as const };
  return base;
}

function getAssociationState(contact: ContactRow, validationSourceText: Record<string, string>) {
  const contexts = contact.linked_context ?? [];
  if (contexts.length === 0) {
    return { label: "Missing association", tone: "warning" as const };
  }

  const hasValidationWarning = contexts.some((context) => {
    if (context.source_kind !== "asset" && context.source_kind !== "record") return false;
    const validationKey = buildContactLinkValidationKey({
      source_kind: context.source_kind,
      source_id: String(context.source_id ?? ""),
    });
    const manuallyConfirmed = contact.validation_overrides?.[validationKey]?.manually_confirmed === true;
    return evaluateContactLinkValidation({
      contactName: contact.full_name,
      sourceText: [
        validationSourceText[validationKey],
        context.label,
        context.role,
      ].filter(Boolean).join(" "),
      manuallyConfirmed,
    }).state === "warning";
  });

  if (hasValidationWarning) {
    return { label: "Action required", tone: "warning" as const };
  }

  if (contexts.length === 1) {
    return { label: "Related record", tone: "success" as const };
  }

  return { label: `${contexts.length} related records`, tone: "success" as const };
}

function formatContactRoleLine(contact: ContactRow) {
  const relationship = humanizeContactTerm(contact.relationship);
  const role = humanizeContactTerm(contact.contact_role);
  return [relationship, role && role !== relationship ? role : ""].filter(Boolean).join(" · ") || "Relationship not set";
}

function humanizeContactTerm(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    friend_or_family: "Friend or family",
    trusted_contact: "Trusted contact",
    next_of_kin: "Next of kin",
    executor: "Executor",
    attorney: "Attorney",
    beneficiary: "Beneficiary",
    financial_adviser: "Financial adviser",
    solicitor: "Solicitor",
    professional_support: "Professional support",
  };
  return labels[key] || (key ? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "");
}

function formatContactSupportLine(contact: ContactRow) {
  return [contact.email || "No email", contact.phone || "No phone"].join(" · ");
}

function getPrimaryActionLabel(contact: ContactRow) {
  const inviteState = getInviteState(contact).label;
  if (inviteState === "Ready to invite") return "Send invite";
  if (inviteState === "Awaiting acceptance") return "Resend invite";
  if ((contact.linked_context?.length ?? 0) === 0) return "Link records";
  return "Edit access";
}

function getPrimaryActionIcon(contact: ContactRow) {
  const inviteState = getInviteState(contact).label;
  if (inviteState === "Ready to invite") return "send";
  if (inviteState === "Awaiting acceptance") return "forward_to_inbox";
  if ((contact.linked_context?.length ?? 0) === 0) return "link";
  return "edit";
}

function getAddContactPreset(groupKey: string): { role: CollaboratorRole; sections: SectionKey[] } {
  if (groupKey === "executors") {
    return { role: "executor", sections: [] };
  }
  if (groupKey === "advisors") {
    return { role: "professional_advisor", sections: ["financial", "legal", "property", "business"] };
  }
  if (groupKey === "beneficiaries" || groupKey === "family") {
    return { role: "friend_or_family", sections: ["profile", "personal", "legal"] };
  }
  return { role: "friend_or_family", sections: ["profile", "personal"] };
}

function NextOfKinContactForm({
  draft,
  saving,
  onChange,
  onSave,
}: {
  draft: { fullName: string; relationship: string; email: string; phone: string };
  saving: boolean;
  onChange: (draft: { fullName: string; relationship: string; email: string; phone: string }) => void;
  onSave: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="lf-content-grid">
        <label style={contactFormFieldStyle}>
          <span style={contactFormLabelStyle}>Full name *</span>
          <input
            style={contactFormInputStyle}
            value={draft.fullName}
            onChange={(event) => onChange({ ...draft, fullName: event.target.value })}
            placeholder="e.g. Jane Yardley"
          />
        </label>
        <label style={contactFormFieldStyle}>
          <span style={contactFormLabelStyle}>Relationship *</span>
          <select
            style={contactFormInputStyle}
            value={draft.relationship}
            onChange={(event) => onChange({ ...draft, relationship: event.target.value })}
          >
            <option value="">Select relationship</option>
            <option value="spouse">Spouse / partner</option>
            <option value="child">Child</option>
            <option value="parent">Parent</option>
            <option value="sibling">Sibling</option>
            <option value="family">Other family</option>
            <option value="friend">Trusted friend</option>
          </select>
        </label>
        <label style={contactFormFieldStyle}>
          <span style={contactFormLabelStyle}>Email</span>
          <input
            style={contactFormInputStyle}
            value={draft.email}
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
            placeholder="name@example.com"
            type="email"
          />
        </label>
        <label style={contactFormFieldStyle}>
          <span style={contactFormLabelStyle}>Phone</span>
          <input
            style={contactFormInputStyle}
            value={draft.phone}
            onChange={(event) => onChange({ ...draft, phone: event.target.value })}
            placeholder="+44..."
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          style={primaryMenuActionStyle}
          onClick={onSave}
          disabled={saving || !draft.fullName.trim() || !draft.relationship.trim()}
        >
          <Icon name="person_add" size={16} />
          {saving ? "Saving..." : "Save Next of Kin"}
        </button>
        <span style={{ color: "#64748b", fontSize: 13 }}>
          Access is granted only through a separate invitation or permission change.
        </span>
      </div>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "neutral" | "success" | "warning" | "danger" }) {
  const iconName = tone === "success" ? "verified" : tone === "warning" ? "warning" : tone === "danger" ? "error" : "info";

  return (
    <span style={tone === "success" ? positivePillStyle : tone === "warning" ? warningPillStyle : tone === "danger" ? dangerPillStyle : neutralPillStyle}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Icon name={iconName} size={14} />
        {label}
      </span>
    </span>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const alertPanelStyle: CSSProperties = {
  border: "1px solid #fcd34d",
  borderRadius: 16,
  background: "#fffbeb",
  padding: 14,
  display: "grid",
  gap: 10,
};

const addContactPanelStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: 16,
  background: "#f8fbff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const primaryMenuActionStyle: CSSProperties = {
  border: "1px solid #111827",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  padding: "10px 14px",
  minHeight: 44,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};

const addPersonActionStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 8,
  padding: "8px 11px",
  minHeight: 40,
  fontSize: 13,
};

const emptyGroupStyle: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const groupHeaderButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  alignItems: "center",
  cursor: "pointer",
};

const groupCountStyle: CSSProperties = {
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 12,
  fontWeight: 700,
  background: "#e2e8f0",
  color: "#0f172a",
};

const groupWarningStyle: CSSProperties = {
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 12,
  fontWeight: 700,
  background: "#fef3c7",
  color: "#92400e",
};

const contactRowStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 10,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) auto auto",
  gap: 10,
  alignItems: "center",
};

const selectedContactRowStyle: CSSProperties = {
  ...contactRowStyle,
  borderColor: "#2563eb",
  boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.12)",
};

const selectedContactStackStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};

const neutralPillStyle: CSSProperties = {
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  background: "#e2e8f0",
  color: "#0f172a",
};

const positivePillStyle: CSSProperties = {
  ...neutralPillStyle,
  background: "#dcfce7",
  color: "#166534",
};

const warningPillStyle: CSSProperties = {
  ...neutralPillStyle,
  background: "#fef3c7",
  color: "#92400e",
};

const dangerPillStyle: CSSProperties = {
  ...neutralPillStyle,
  background: "#fee2e2",
  color: "#991b1b",
};

const moreLinksStyle: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 600,
};

const linkPillStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "10px 14px",
  minHeight: 44,
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
};

const contactTitleLinkStyle: CSSProperties = {
  fontWeight: 700,
  color: "#0f172a",
  textDecoration: "none",
};

const rowActionsStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const rowPrimaryActionStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const rowSecondaryActionStyle: CSSProperties = {
  ...rowPrimaryActionStyle,
  background: "#f8fafc",
  fontWeight: 600,
};

const rowTertiaryActionStyle: CSSProperties = {
  ...rowPrimaryActionStyle,
  background: "transparent",
  borderStyle: "dashed",
  fontWeight: 600,
};

const selectedAdminStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  borderTop: "none",
  borderRadius: "0 0 14px 14px",
  background: "#f8fbff",
  padding: 12,
  display: "grid",
  gap: 12,
  marginTop: -2,
  marginInline: 10,
};

const selectedActionSummaryStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const selectedActionChipStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid #dbeafe",
  background: "#fff",
  color: "#0f172a",
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const personSummaryStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  border: "1px solid #e8e1dc",
  borderRadius: 10,
  background: "#fffefd",
  padding: 14,
};

const personSummaryLabelStyle: CSSProperties = {
  color: "#7c4a35",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const simpleGroupHeadingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

const contactSummaryRowStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(150px, 0.9fr) minmax(180px, 1fr) minmax(190px, 1.3fr) auto",
  gap: 14,
  alignItems: "center",
  border: "1px solid #e8e1dc",
  borderRadius: 12,
  background: "#fffefd",
  padding: "12px 14px",
};

const contactSummaryButtonStyle: CSSProperties = {
  minWidth: 0,
  border: 0,
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  display: "grid",
  gap: 3,
  textAlign: "left",
};

const contactSummaryNameStyle: CSSProperties = {
  color: "#1f1712",
  fontSize: 15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const contactSummaryRelationshipStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const contactSummaryStatusStyle: CSSProperties = {
  color: "#475569",
  fontSize: 13,
  fontWeight: 650,
};

const contactSummaryActionStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  minWidth: 0,
};

const contactNextActionStyle: CSSProperties = {
  color: "#7c4a35",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const overflowButtonStyle: CSSProperties = {
  border: "1px solid #e8e1dc",
  borderRadius: 999,
  background: "#fff",
  color: "#475569",
  minWidth: 40,
  minHeight: 40,
  cursor: "pointer",
  letterSpacing: 2,
};

const emptyPeopleStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  justifyItems: "start",
  border: "1px dashed #d7cec7",
  borderRadius: 12,
  padding: 20,
  color: "#475569",
};

const drawerContactLineStyle: CSSProperties = {
  color: "#475569",
  fontSize: 14,
};

const drawerExplanationStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.55,
};

const drawerSectionStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  borderTop: "1px solid #eee8e3",
  paddingTop: 14,
};

const drawerSectionLabelStyle: CSSProperties = {
  color: "#7c4a35",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const drawerRelatedItemStyle: CSSProperties = {
  color: "#1f2937",
  fontSize: 14,
};

const linkedDocumentWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
};

const linkedDocumentIconButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
};

const unavailableLinkedDocumentStyle: CSSProperties = {
  ...linkedDocumentIconButtonStyle,
  background: "#f8fafc",
  color: "#94a3b8",
  cursor: "not-allowed",
  borderStyle: "dashed",
};

const linkedDocumentIconLabelStyle: CSSProperties = {
  lineHeight: 1,
};

const contactSearchFieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 260,
};

const contactSearchLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
};

const contactSearchInputStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 14,
  minWidth: 0,
};

const contactFormFieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const contactFormLabelStyle: CSSProperties = {
  color: "#475569",
  fontSize: 12,
  fontWeight: 800,
};

const contactFormInputStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 11px",
  minHeight: 44,
  fontSize: 14,
  minWidth: 0,
};
