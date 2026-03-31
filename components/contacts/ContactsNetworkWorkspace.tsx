"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import {
  loadCanonicalContactsForOwner,
  type CanonicalContactContext,
  type CanonicalContactInviteStatus,
  type CanonicalContactSourceType,
  type CanonicalContactVerificationStatus,
} from "../../lib/contacts/canonicalContacts";
import { resolveContactGroupKey } from "../../lib/contacts/contactGrouping";
import { buildContactLinkValidationKey, evaluateContactLinkValidation, flattenSearchableValue } from "../../lib/contacts/contactLinkValidation";
import { buildContactsWorkspaceHref, buildLinkedContactRecordHref } from "../../lib/contacts/contactRouting";
import {
  buildLinkedDocumentLookupKey,
  groupLinkedDocumentSources,
  resolveLinkedPreviewTargets,
  type LinkedDocumentSourceItem,
} from "../../lib/contacts/linkedDocumentPreview";
import { resolveContactStatusBadge } from "../../lib/contacts/contactStatus";
import { fetchCanonicalAssets } from "../../lib/assets/fetchCanonicalAssets";
import { resolveWalletContextForRead } from "../../lib/canonicalPersistence";
import { getLegalLinkedContactDefinition, resolveLegalCategoryForAsset } from "../../lib/legalCategories";
import { getStoredFileSignedUrl } from "../../lib/assets/documentLinks";
import ContactInvitationManager from "../../app/(app)/components/dashboard/ContactInvitationManager";
import { useViewerAccess } from "../access/ViewerAccessContext";
import Icon from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import InfoTip from "../ui/InfoTip";
import DocumentPreviewDialog, { type DocumentPreviewDialogItem } from "../documents/DocumentPreviewDialog";

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

export default function ContactsNetworkWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { viewer } = useViewerAccess();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [validationSourceText, setValidationSourceText] = useState<Record<string, string>>({});
  const [confirmingValidationKey, setConfirmingValidationKey] = useState("");
  const [associationAlerts, setAssociationAlerts] = useState<string[]>([]);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<LinkedDocumentPreview | null>(null);
  const [previewTargetsByContextKey, setPreviewTargetsByContextKey] = useState<Map<string, LinkedDocumentSourceItem[]>>(new Map());
  const [openingDocumentKey, setOpeningDocumentKey] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      if (!mounted) return;
      try {
        const loaded = await loadCanonicalContactsForOwner(supabase, viewer.targetOwnerUserId || user.id);
        if (!mounted) return;
        setContacts(loaded as ContactRow[]);
      } catch (error) {
        if (!mounted) return;
        setStatus(`Could not load contacts network: ${error instanceof Error ? error.message : "Unknown error"}`);
        setContacts([]);
      }
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router, viewer.targetOwnerUserId]);

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
    for (const group of GROUPS) map.set(group.key, []);
    for (const contact of contacts) {
      if (seenContactIds.has(contact.id)) continue;
      seenContactIds.add(contact.id);
      map.get(resolveContactGroupKey(contact))?.push(contact);
    }
    return map;
  }, [contacts]);

  const completeness = useMemo(() => {
    const total = contacts.length;
    const withEmail = contacts.filter((item) => item.email).length;
    const withPhone = contacts.filter((item) => item.phone).length;
    const linkedContextCount = contacts.reduce((sum, item) => sum + (item.linked_context?.length ?? 0), 0);
    return { total, withEmail, withPhone, linkedContextCount };
  }, [contacts]);

  const selectedContactId = String(searchParams.get("contact") ?? "").trim();
  const selectedGroup = String(searchParams.get("group") ?? "").trim();
  const selectedContact = useMemo(() => {
    const match = contacts.find((item) => item.id === selectedContactId);
    if (!match) return null;
    return {
      id: match.id,
      full_name: match.full_name,
      email: match.email,
      contact_role: match.contact_role,
      linked_context: (match.linked_context ?? []).filter(
        (context): context is CanonicalContactContext =>
          (context?.source_kind === "asset" || context?.source_kind === "record" || context?.source_kind === "invitation") &&
          Boolean(context?.source_id),
      ),
    };
  }, [contacts, selectedContactId]);

  useEffect(() => {
    const preferredOpenGroup =
      selectedGroup
      || (selectedContactId ? resolveContactGroupKey(contacts.find((item) => item.id === selectedContactId) ?? {}) : "")
      || GROUPS.find((group) => (groupedContacts.get(group.key)?.length ?? 0) > 0)?.key
      || GROUPS[0]?.key
      || null;

    if (!preferredOpenGroup) return;
    if (selectedGroup || selectedContactId) {
      setOpenGroupKey(preferredOpenGroup);
    }
  }, [contacts, groupedContacts, selectedContactId, selectedGroup]);

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

  function openContact(contactId: string, groupKey?: string) {
    const params = new URLSearchParams();
    params.set("contact", contactId);
    if (groupKey) params.set("group", groupKey);
    router.replace(`/contacts?${params.toString()}`);
  }

  function toggleGroup(groupKey: string) {
    setOpenGroupKey((current) => (current === groupKey ? null : groupKey));
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
      <div style={buildCheckMarkerStyle}>CONTACTS BUILD CHECK - DOCUMENT DRAWER V2</div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Use grouped contacts to manage role-linked people, invite state, access scope, and missing record associations without duplicating the same workflow elsewhere.
          </p>
          <InfoTip
            label="Explain the Contacts section"
            message="Use Contacts to invite trusted people, set what they can review or edit, keep internal notes, and jump directly to the linked records that explain why they matter."
          />
        </div>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Each person appears once in their main role group, with invite state, association health, and the next action shown on the row.
        </p>
      </div>

      <section style={panelStyle}>
        <div className="lf-contacts-metrics" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Metric label="Contacts in place" value={String(completeness.total)} />
          <Metric label="With email" value={String(completeness.withEmail)} />
          <Metric label="With phone" value={String(completeness.withPhone)} />
          <Metric label="Linked roles" value={String(completeness.linkedContextCount)} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/personal" style={linkPillStyle}>Review personal records</Link>
          <Link href="/contacts?group=executors" style={linkPillStyle}>Review executors</Link>
        </div>
      </section>

      {associationAlerts.length ? (
        <section style={alertPanelStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 14 }}>Association alerts</strong>
            <InfoTip
              label="Explain missing associations"
              message="These alerts highlight important records that exist in the vault but are not yet linked to a person who can explain, act on, or review them."
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {associationAlerts.map((alert) => (
              <div key={alert} style={{ color: "#92400e", fontSize: 13 }}>{alert}</div>
            ))}
          </div>
        </section>
      ) : null}

      {status ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#64748b" }}>Loading contacts network...</div> : null}

      {!loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          {GROUPS.map((group) => {
            const rows = groupedContacts.get(group.key) ?? [];
            const isOpen = openGroupKey === group.key;
            const groupSummary = summarizeGroupRows(rows, validationSourceText);

            return (
              <section key={group.key} style={panelStyle}>
                <button
                  type="button"
                  style={groupHeaderButtonStyle}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isOpen}
                >
                  <div style={{ display: "grid", gap: 4, textAlign: "left" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{group.label}</div>
                      <span style={groupCountStyle}>{rows.length}</span>
                      {groupSummary.warningCount > 0 ? (
                        <span style={groupWarningStyle}>{groupSummary.warningCount} need linking</span>
                      ) : null}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {groupSummary.statusSummary || group.description}
                    </div>
                  </div>
                  <Icon name={isOpen ? "expand_more" : "chevron_right"} size={18} />
                </button>

                {!isOpen ? null : rows.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13 }}>No contacts in this group yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {rows.map((contact) => {
                      const inviteState = getInviteState(contact);
                      const associationState = getAssociationState(contact, validationSourceText);
                      const linkedContexts = (contact.linked_context ?? []).slice(0, 4);
                      const previewableContexts = linkedContexts.filter((context) => getPreviewableTargetsForContext(context).length > 0);
                      const unresolvedContexts = linkedContexts.filter((context) => getPreviewableTargetsForContext(context).length === 0);
                      const hasLinkedDocuments = previewableContexts.length > 0;
                      const isSelected = contact.id === selectedContactId;

                      return (
                        <div key={contact.id} style={isSelected ? selectedContactStackStyle : undefined}>
                          <div
                            style={isSelected ? selectedContactRowStyle : contactRowStyle}
                            className="lf-contact-row"
                            data-contact-id={contact.id}
                          >
                            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <Link href={buildContactsWorkspaceHref(contact.id)} style={contactTitleLinkStyle}>
                                  {contact.full_name || "Unnamed contact"}
                                </Link>
                                <StatusPill {...inviteState} />
                                <StatusPill {...associationState} />
                              </div>
                              <div style={{ color: "#475569", fontSize: 13 }}>
                                {formatContactRoleLine(contact)}
                              </div>
                              <div style={{ color: "#64748b", fontSize: 12 }}>
                                {formatContactSupportLine(contact)}
                              </div>
                              {linkedContexts.length ? (
                                <div style={linkedDocumentWrapStyle}>
                                  {previewableContexts.map((context, index) => {
                                    const label = context.label || formatContextLabel(context);
                                    const previewTarget = getPreviewableTargetsForContext(context)[0];
                                    return (
                                      <button
                                        key={`${contact.id}-${index}`}
                                        type="button"
                                        style={linkedDocumentIconButtonStyle}
                                        title={`View document: ${label}`}
                                        aria-label={`View document: ${label}`}
                                        onClick={() => void openLinkedDocument(contact, context)}
                                        disabled={!previewTarget || openingDocumentKey === previewTarget.id}
                                      >
                                        <Icon name={getLinkedDocumentIcon(context)} size={14} />
                                        <span style={linkedDocumentIconLabelStyle}>{describeLinkedDocumentContext(context)}</span>
                                      </button>
                                    );
                                  })}
                                  {unresolvedContexts.map((context, index) => (
                                    <span
                                      key={`${contact.id}-unresolved-${index}`}
                                      style={unavailableLinkedDocumentStyle}
                                      title={`No previewable document is available yet for ${context.label || formatContextLabel(context)}`}
                                      aria-label={`Document unavailable for ${context.label || formatContextLabel(context)}`}
                                    >
                                      <Icon name="link_off" size={14} />
                                      <span style={linkedDocumentIconLabelStyle}>Unavailable</span>
                                    </span>
                                  ))}
                                  {(contact.linked_context?.length ?? 0) > 4 ? (
                                    <span style={moreLinksStyle}>+{(contact.linked_context?.length ?? 0) - 4} more</span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            <div style={rowMetaStyle}>
                              <div style={rowMetaItemStyle}>
                                <span style={rowMetaLabelStyle}>Primary action</span>
                                <span style={rowMetaValueStyle}>{getPrimaryActionLabel(contact)}</span>
                              </div>
                            </div>

                            <div style={rowActionsStyle}>
                              <button
                                type="button"
                                style={rowPrimaryActionStyle}
                                title={`${getPrimaryActionLabel(contact)} for ${contact.full_name || "contact"}`}
                                onClick={() => openContact(contact.id, group.key)}
                              >
                                <Icon name={getPrimaryActionIcon(contact)} size={16} />
                                {getPrimaryActionLabel(contact)}
                              </button>
                              <IconButton
                                icon="visibility"
                                label={`View linked document for ${contact.full_name || "contact"}`}
                                onClick={() => {
                                  const firstContext = previewableContexts[0];
                                  if (firstContext) void openLinkedDocument(contact, firstContext);
                                }}
                                disabled={!hasLinkedDocuments}
                              />
                              <IconButton
                                icon="edit"
                                label={`Edit ${contact.full_name || "contact"}`}
                                onClick={() => openContact(contact.id, group.key)}
                              />
                              {(contact.linked_context ?? []).map((context, index) => {
                                const validationKey = buildContactLinkValidationKey({
                                  source_kind: context.source_kind === "asset" || context.source_kind === "invitation" ? context.source_kind : "record",
                                  source_id: String(context.source_id ?? ""),
                                });
                                const manuallyConfirmed = contact.validation_overrides?.[validationKey]?.manually_confirmed === true;
                                const validation = (context.source_kind === "asset" || context.source_kind === "record")
                                  ? evaluateContactLinkValidation({
                                      contactName: contact.full_name,
                                      sourceText: [
                                        validationSourceText[validationKey],
                                        context.label,
                                        context.role,
                                      ].filter(Boolean).join(" "),
                                      manuallyConfirmed,
                                    })
                                  : null;

                                return validation?.state === "warning" && selectedContactId === contact.id && !viewer.readOnly ? (
                                  <IconButton
                                    key={`${contact.id}-${index}-confirm`}
                                    icon="verified"
                                    label={`Confirm ${context.label || formatContextLabel(context)} is the correct record for ${contact.full_name}`}
                                    onClick={() => void confirmLinkedRecord(contact, context)}
                                    disabled={confirmingValidationKey === validationKey}
                                  />
                                ) : null;
                              })}
                              {isSelected ? (
                                <IconButton
                                  icon="close"
                                  label={`Cancel ${contact.full_name || "contact"} selection`}
                                  onClick={() => router.replace(selectedGroup ? `/contacts?group=${selectedGroup}` : "/contacts")}
                                />
                              ) : null}
                            </div>
                          </div>
                          {!viewer.readOnly && isSelected ? (
                            <section style={selectedAdminStyle} aria-label={`Manage selected contact: ${contact.full_name || "contact"}`}>
                              <div style={{ display: "grid", gap: 3 }}>
                                <div style={{ fontSize: 16, fontWeight: 700 }}>Manage selected contact</div>
                                <div style={{ color: "#64748b", fontSize: 13 }}>
                                  Edit, replace, resend, remove, cancel, update permissions, and confirm linked-record associations right here beside the selected row.
                                </div>
                              </div>
                              <ContactInvitationManager
                                mode="full"
                                selectedContactId={selectedContactId}
                                selectedContactProfile={selectedContact}
                              />
                            </section>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
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

function formatContextLabel(context: ContactRow["linked_context"][number]) {
  return [context.section_key, context.category_key, context.role].filter(Boolean).join(" · ") || "Linked context";
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
    return { label: "Linked to record", tone: "success" as const };
  }

  return { label: `Linked to ${contexts.length} records`, tone: "success" as const };
}

function formatContactRoleLine(contact: ContactRow) {
  return [contact.relationship, contact.contact_role].filter(Boolean).join(" · ") || "Role or relationship not set";
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
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
  padding: "7px 10px",
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 13,
};

const contactTitleLinkStyle: CSSProperties = {
  fontWeight: 700,
  color: "#0f172a",
  textDecoration: "none",
};

const rowMetaStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  justifyItems: "start",
};

const rowMetaItemStyle: CSSProperties = {
  display: "grid",
  gap: 2,
};

const rowMetaLabelStyle: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 600,
  textTransform: "uppercase",
};

const rowMetaValueStyle: CSSProperties = {
  fontSize: 13,
  color: "#0f172a",
  fontWeight: 600,
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

const buildCheckMarkerStyle: CSSProperties = {
  borderRadius: 10,
  padding: "10px 12px",
  background: "#dbeafe",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0.2,
};
