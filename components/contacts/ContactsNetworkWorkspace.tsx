"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import {
  loadCanonicalContactsForOwner,
  syncCanonicalContact,
  type CanonicalContactContext,
  type CanonicalContactInviteStatus,
  type CanonicalContactSourceType,
  type CanonicalContactVerificationStatus,
} from "../../lib/contacts/canonicalContacts";
import { resolveContactGroupKey } from "../../lib/contacts/contactGrouping";
import { buildCanonicalContactEditInput, buildContactProjectionUpdates, buildEditableContactValues, type EditableContactValues } from "../../lib/contacts/contactEditing";
import { buildContactLinkValidationKey, evaluateContactLinkValidation, flattenSearchableValue } from "../../lib/contacts/contactLinkValidation";
import { buildContactsWorkspaceHref, buildLinkedContactRecordHref } from "../../lib/contacts/contactRouting";
import { resolveContactStatusBadge } from "../../lib/contacts/contactStatus";
import ContactInvitationManager from "../../app/(app)/components/dashboard/ContactInvitationManager";
import { useViewerAccess } from "../access/ViewerAccessContext";
import { ActionIconButton, IconButton } from "../ui/IconButton";

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

const GROUPS = [
  { key: "next_of_kin", label: "Next of kin", description: "Family or emergency contacts someone should be able to find first." },
  { key: "executors", label: "Executors", description: "People expected to help administer the estate or carry formal executor duties." },
  { key: "trustees", label: "Trustees", description: "Trust-related contacts who need to remain linked across records and decisions." },
  { key: "advisors", label: "Professional advisors", description: "Solicitors, accountants, financial advisers, and similar professional contacts." },
  { key: "key_contacts", label: "Key contacts", description: "Other important people or provider-facing contacts linked to live records." },
] as const;

export default function ContactsNetworkWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { viewer } = useViewerAccess();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [showAccessReview, setShowAccessReview] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [validationSourceText, setValidationSourceText] = useState<Record<string, string>>({});
  const [confirmingValidationKey, setConfirmingValidationKey] = useState("");
  const [contactForm, setContactForm] = useState<EditableContactValues>({
    fullName: "",
    email: "",
    phone: "",
    contactRole: "",
    relationship: "",
  });

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

      const [
        assetRows,
        documentRows,
        recordRows,
        attachmentRows,
      ] = await Promise.all([
        assetIds.length
          ? supabase.from("assets").select("id,title,summary,metadata_json").eq("owner_user_id", ownerUserId).in("id", assetIds)
          : Promise.resolve({ data: [], error: null }),
        assetIds.length
          ? supabase.from("documents").select("asset_id,file_name,document_kind").eq("owner_user_id", ownerUserId).in("asset_id", assetIds).is("deleted_at", null)
          : Promise.resolve({ data: [], error: null }),
        recordIds.length
          ? supabase.from("records").select("id,title,summary,metadata").eq("owner_user_id", ownerUserId).in("id", recordIds)
          : Promise.resolve({ data: [], error: null }),
        recordIds.length
          ? supabase.from("attachments").select("record_id,file_name").eq("owner_user_id", ownerUserId).in("record_id", recordIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const documentsByAssetId = new Map<string, string[]>();
      for (const row of ((documentRows.data ?? []) as Array<Record<string, unknown>>)) {
        const assetId = String(row.asset_id ?? "").trim();
        if (!assetId) continue;
        const items = documentsByAssetId.get(assetId) ?? [];
        items.push([row.file_name, row.document_kind].filter(Boolean).join(" "));
        documentsByAssetId.set(assetId, items);
      }

      const attachmentsByRecordId = new Map<string, string[]>();
      for (const row of ((attachmentRows.data ?? []) as Array<Record<string, unknown>>)) {
        const recordId = String(row.record_id ?? "").trim();
        if (!recordId) continue;
        const items = attachmentsByRecordId.get(recordId) ?? [];
        items.push(String(row.file_name ?? "").trim());
        attachmentsByRecordId.set(recordId, items);
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
    }

    void loadValidationEvidence();
    return () => {
      cancelled = true;
    };
  }, [contacts, viewer.targetOwnerUserId]);

  const groupedContacts = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    for (const group of GROUPS) map.set(group.key, []);
    for (const contact of contacts) {
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

  const invitesNeedingAttention = useMemo(
    () => contacts.filter((item) => item.invite_status === "invite_sent" || item.invite_status === "accepted" || item.verification_status !== "verified").length,
    [contacts],
  );

  const selectedContactId = String(searchParams.get("contact") ?? "").trim();
  const selectedContact = useMemo(
    () => {
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
    },
    [contacts, selectedContactId],
  );

  useEffect(() => {
    if (viewer.readOnly || loading || !selectedContactId) return;
    const selected = contacts.find((item) => item.id === selectedContactId);
    if (!selected) return;
    setShowAccessReview(true);
    setEditingContactId(selected.id);
    setContactForm(buildEditableContactValues(selected));
  }, [contacts, loading, selectedContactId, viewer.readOnly]);

  async function saveEditedContact() {
    if (viewer.readOnly || !editingContactId) return;

    const fullName = contactForm.fullName.trim();
    if (!fullName) {
      setStatus("Contact name is required.");
      return;
    }

    setSavingContact(true);
    setStatus("");

    try {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      const current = contacts.find((item) => item.id === editingContactId);
      if (!current) {
        setStatus("Could not find the selected contact.");
        return;
      }

      await syncCanonicalContact(
        supabase,
        buildCanonicalContactEditInput({
          ownerUserId: viewer.targetOwnerUserId || user.id,
          current,
          values: contactForm,
        }),
      );

      const now = new Date().toISOString();
      const updates = buildContactProjectionUpdates(contactForm);

      await Promise.all([
        supabase
          .from("contact_invitations")
          .update({ ...updates.invitations, updated_at: now })
          .eq("owner_user_id", viewer.targetOwnerUserId || user.id)
          .eq("contact_id", editingContactId),
        supabase
          .from("record_contacts")
          .update(updates.recordContacts)
          .eq("owner_user_id", viewer.targetOwnerUserId || user.id)
          .eq("contact_id", editingContactId),
      ]);

      setEditingContactId(null);
      setStatus("Contact updated.");
      router.replace(buildContactsWorkspaceHref(editingContactId));
      const loaded = await loadCanonicalContactsForOwner(supabase, viewer.targetOwnerUserId || user.id);
      setContacts(loaded as ContactRow[]);
    } catch (error) {
      setStatus(`Could not update contact: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSavingContact(false);
    }
  }

  function startEdit(contact: ContactRow) {
    if (viewer.readOnly) return;
    setEditingContactId(contact.id);
    setContactForm(buildEditableContactValues(contact));
    router.replace(buildContactsWorkspaceHref(contact.id));
  }

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

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Review the full contacts network someone may need to understand quickly across family, executors, trustees, advisers, and other key contacts.
        </p>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Each contact appears once with a clear primary role, then shows the linked records and responsibilities that give them context.
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
          <Link href="/trust" style={linkPillStyle}>Review executors / trustees</Link>
          <button type="button" style={accessReviewBtnStyle} onClick={() => setShowAccessReview((prev) => !prev)}>
            {showAccessReview ? "Hide access review" : `Review invitations & access${invitesNeedingAttention ? ` (${invitesNeedingAttention})` : ""}`}
          </button>
        </div>
      </section>

      {status ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#64748b" }}>Loading contacts network...</div> : null}

      {!viewer.readOnly && selectedContactId ? (
        <section style={panelStyle}>
          <div style={{ display: "grid", gap: 3 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Selected contact admin</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Manage the selected contact here, including invite state, role, permissions, notes, deletion, and exact linked-record scope.
            </div>
          </div>
          <ContactInvitationManager
            mode="full"
            selectedContactId={selectedContactId}
            selectedContactProfile={selectedContact}
          />
        </section>
      ) : null}

      {!viewer.readOnly && editingContactId && !selectedContactId ? (
        <section style={panelStyle}>
          <div style={{ display: "grid", gap: 3 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Edit contact</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Update the shared contact record here, then use the invitation access review below for resend, deletion, notes, role, and permission controls.
            </div>
          </div>
          <div className="lf-content-grid">
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Name</span>
              <input value={contactForm.fullName} onChange={(event) => setContactForm((prev) => ({ ...prev, fullName: event.target.value }))} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Email</span>
              <input value={contactForm.email} onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))} style={inputStyle} type="email" />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Phone</span>
              <input value={contactForm.phone} onChange={(event) => setContactForm((prev) => ({ ...prev, phone: event.target.value }))} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Role</span>
              <input value={contactForm.contactRole} onChange={(event) => setContactForm((prev) => ({ ...prev, contactRole: event.target.value }))} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Relationship</span>
              <input value={contactForm.relationship} onChange={(event) => setContactForm((prev) => ({ ...prev, relationship: event.target.value }))} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={accessReviewBtnStyle} disabled={savingContact} onClick={() => void saveEditedContact()}>
              {savingContact ? "Saving..." : "Save contact"}
            </button>
            <button
              type="button"
              style={ghostBtnStyle}
              onClick={() => {
                setEditingContactId(null);
                setContactForm({ fullName: "", email: "", phone: "", contactRole: "", relationship: "" });
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {!loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          {GROUPS.map((group) => {
            const rows = groupedContacts.get(group.key) ?? [];
            return (
              <section key={group.key} style={panelStyle}>
                <div style={{ display: "grid", gap: 3 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{group.label} <span style={{ color: "#64748b", fontWeight: 600, fontSize: 14 }}>{rows.length}</span></div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{group.description}</div>
                </div>
                {rows.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13 }}>No contacts in this group yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {rows.map((contact) => (
                      <article
                        key={contact.id}
                        style={contact.id === selectedContactId ? selectedContactCardStyle : contactCardStyle}
                        className="lf-contact-card"
                        data-contact-id={contact.id}
                      >
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <Link href={buildContactsWorkspaceHref(contact.id)} style={contactTitleLinkStyle}>
                              {contact.full_name || "Unnamed contact"}
                            </Link>
                            <StatusPill {...resolveContactStatusBadge({
                              email: contact.email,
                              inviteStatus: contact.invite_status,
                              verificationStatus: contact.verification_status,
                            })} />
                            {!viewer.readOnly ? (
                              <ActionIconButton action="edit" label={`Edit ${contact.full_name || "contact"}`} onClick={() => startEdit(contact)} />
                            ) : null}
                          </div>
                          <div style={{ color: "#475569", fontSize: 13 }}>
                            {[contact.relationship, contact.contact_role].filter(Boolean).join(" · ") || "Role or relationship not set"}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 13 }}>
                            {contact.email || "No email"}{" · "}{contact.phone || "No phone"}
                          </div>
                          <div style={{ color: "#475569", fontSize: 12, fontWeight: 600 }}>
                            Linked roles and records
                          </div>
                          <div style={{ display: "grid", gap: 8 }}>
                            {(contact.linked_context ?? []).map((context, index) => {
                              const href = buildLinkedContactRecordHref({
                                source_kind: context.source_kind === "asset" || context.source_kind === "invitation" ? context.source_kind : "record",
                                source_id: String(context.source_id ?? ""),
                                section_key: context.section_key ?? null,
                                category_key: context.category_key ?? null,
                                label: context.label ?? null,
                                role: context.role ?? null,
                              });
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

                              return (
                                <div key={`${contact.id}-${index}`} style={linkedContextRowStyle}>
                                  {href ? (
                                    <Link href={href} style={contextLinkStyle} title={`Open ${context.label || formatContextLabel(context)}`}>
                                      {context.label || formatContextLabel(context)}
                                    </Link>
                                  ) : (
                                    <span style={contextPillStyle}>{context.label || formatContextLabel(context)}</span>
                                  )}
                                  {validation ? <ValidationBadge validation={validation} /> : null}
                                  {validation?.state === "warning" && selectedContactId === contact.id && !viewer.readOnly ? (
                                    <IconButton
                                      icon="verified"
                                      label={`Confirm ${context.label || formatContextLabel(context)} is the correct record for ${contact.full_name}`}
                                      onClick={() => void confirmLinkedRecord(contact, context)}
                                      disabled={confirmingValidationKey === validationKey}
                                    />
                                  ) : null}
                                  {validation?.state === "warning" && selectedContactId === contact.id ? (
                                    <div style={validationHelpStyle}>{validation.warning}</div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      {!viewer.readOnly && showAccessReview && !selectedContactId ? (
        <section style={panelStyle}>
          <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Invitation access review</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
              Review invitations, role assignments, resend state, notes, and access permissions here when you need the fuller management view.
          </div>
        </div>
          <ContactInvitationManager
            mode="full"
            selectedContactId={selectedContactId}
            selectedContactProfile={selectedContact}
          />
        </section>
      ) : null}
    </section>
  );
}

function formatContextLabel(context: ContactRow["linked_context"][number]) {
  return [context.section_key, context.category_key, context.role].filter(Boolean).join(" · ") || "Linked context";
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
  if (tone === "success") return <span style={positivePillStyle}>{label}</span>;
  if (tone === "warning") return <span style={warningPillStyle}>{label}</span>;
  if (tone === "danger") return <span style={dangerPillStyle}>{label}</span>;
  return <span style={neutralPillStyle}>{label}</span>;
}

function ValidationBadge({
  validation,
}: {
  validation: ReturnType<typeof evaluateContactLinkValidation>;
}) {
  if (validation.state === "matched") {
    return <span style={matchedValidationStyle}>{validation.label}</span>;
  }
  if (validation.state === "confirmed") {
    return <span style={confirmedValidationStyle}>{validation.label}</span>;
  }
  return <span style={warningPillStyle}>{validation.label}</span>;
}

const panelStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const contactCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 12,
};

const selectedContactCardStyle: CSSProperties = {
  ...contactCardStyle,
  borderColor: "#2563eb",
  boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.12)",
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

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const fieldLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 14,
  width: "100%",
};

const contextPillStyle: CSSProperties = {
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  background: "#eff6ff",
  color: "#1d4ed8",
};

const contextLinkStyle: CSSProperties = {
  ...contextPillStyle,
  textDecoration: "none",
  fontWeight: 600,
};

const linkedContextRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const matchedValidationStyle: CSSProperties = {
  ...neutralPillStyle,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const confirmedValidationStyle: CSSProperties = {
  ...neutralPillStyle,
  background: "#dcfce7",
  color: "#166534",
};

const validationHelpStyle: CSSProperties = {
  color: "#92400e",
  fontSize: 12,
};

const linkPillStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "7px 10px",
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 13,
};

const accessReviewBtnStyle: CSSProperties = {
  ...linkPillStyle,
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const ghostBtnStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const contactTitleLinkStyle: CSSProperties = {
  fontWeight: 700,
  color: "#0f172a",
  textDecoration: "none",
};
