"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../../../components/ui/Icon";
import InfoTip from "../../../../components/ui/InfoTip";
import { ActionIconButton, IconButton, StatusIcon } from "../../../../components/ui/IconButton";
import {
  ROLE_RULES,
  type AccessActivationStatus,
  type CollaboratorRole,
  type SectionKey,
} from "../../../../lib/access-control/roles";
import { supabase } from "../../../../lib/supabaseClient";
import { getSafeUserData } from "../../../../lib/auth/requireActiveUser";
import InvitationStatusBadge from "./InvitationStatusBadge";
import RoleBadge from "./RoleBadge";
import {
  deleteCanonicalContact,
  loadCanonicalContactsByIds,
  mapActivationStatusToVerificationStatus,
  syncCanonicalContact,
  type CanonicalContactRow,
} from "../../../../lib/contacts/canonicalContacts";
import { buildContactsWorkspaceHref, buildLinkedContactRecordHref } from "../../../../lib/contacts/contactRouting";
import { buildInvitationEmailDraft } from "../../../../lib/contacts/invitations";
import { resolveInvitationBadgeState, type InvitationStatus } from "../../../../lib/contacts/invitationStatus";
import { assertOwnerCanSendInvitation, ensureOwnerPlanProfile } from "../../../../lib/accountPlan";
import { useVaultPreferences } from "../../../../components/vault/VaultPreferencesContext";
import { isVaultCategoryEnabled } from "../../../../lib/vaultPreferences";
import {
  buildScopedPermissionPayload,
  normalizeContactPermissionsOverride,
} from "../../../../lib/contacts/contactPermissions";

type InvitationRow = {
  id: string;
  contact_id: string | null;
  contact_name: string;
  contact_email: string;
  assigned_role: CollaboratorRole;
  invitation_status: InvitationStatus;
  activation_status: AccessActivationStatus;
  invited_at: string;
  sent_at: string | null;
  permissions_override?: Record<string, unknown> | null;
  linked_context: CanonicalContactRow["linked_context"];
};

type RoleAssignmentRow = {
  invitation_id: string;
  assigned_role: CollaboratorRole;
  activation_status: AccessActivationStatus;
  permissions_override?: Record<string, unknown> | null;
};

type ScopeItem = {
  sourceKind: "asset" | "record";
  sourceId: string;
  sectionKey: SectionKey;
  categoryKey: string | null;
  label: string;
  meta: string;
  role: string | null;
};

const ACCESS_SCOPE_OPTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "financial", label: "Finances" },
  { key: "legal", label: "Legal" },
  { key: "property", label: "Property" },
  { key: "business", label: "Business" },
  { key: "personal", label: "Personal" },
  { key: "digital", label: "Digital" },
  { key: "profile", label: "Profile" },
];

export default function ContactInvitationManager({
  mode = "full",
  selectedContactId = "",
  selectedContactProfile = null,
}: {
  mode?: "full" | "dashboard";
  selectedContactId?: string;
  selectedContactProfile?: Pick<CanonicalContactRow, "id" | "full_name" | "email" | "contact_role" | "linked_context"> | null;
}) {
  const router = useRouter();
  const { preferences } = useVaultPreferences();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<InvitationRow[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("professional_advisor");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [allowedSections, setAllowedSections] = useState<SectionKey[]>([]);
  const [allowedAssetIds, setAllowedAssetIds] = useState<string[]>([]);
  const [allowedRecordIds, setAllowedRecordIds] = useState<string[]>([]);
  const [editableAssetIds, setEditableAssetIds] = useState<string[]>([]);
  const [editableRecordIds, setEditableRecordIds] = useState<string[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContactId, setDraftContactId] = useState<string | null>(null);
  const isDashboardMode = mode === "dashboard";

  const roleOptions = useMemo(
    () =>
      (Object.keys(ROLE_RULES) as CollaboratorRole[])
        .filter((key) => key !== "owner" && key !== "financial_advisor")
        .map((key) => ({ value: key, label: ROLE_RULES[key].label })),
    [],
  );
  const invitationSummary = useMemo(() => {
    const invited = rows.filter((row) => resolveInvitationBadgeState(row.invitation_status, row.activation_status, row.sent_at).label === "Pending").length;
    const accepted = rows.filter((row) => {
      const label = resolveInvitationBadgeState(row.invitation_status, row.activation_status, row.sent_at).label;
      return label === "Accepted" || label === "Verified";
    }).length;
    const readyToSend = rows.filter((row) => resolveInvitationBadgeState(row.invitation_status, row.activation_status, row.sent_at).label === "Ready to send").length;
    return { total: rows.length, invited, accepted, readyToSend };
  }, [rows]);
  const currentEditingRow = useMemo(
    () => (editingId ? rows.find((row) => row.id === editingId) ?? null : null),
    [editingId, rows],
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setStatus("");

    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/sign-in");
      return;
    }

    const userId = userData.user.id;

    const [invRes, roleRes, assetsRes, recordsRes] = await Promise.all([
      supabase
        .from("contact_invitations")
        .select("id,contact_id,contact_name,contact_email,assigned_role,invitation_status,invited_at,sent_at")
        .eq("owner_user_id", userId)
        .order("invited_at", { ascending: false }),
      supabase
        .from("role_assignments")
        .select("invitation_id,assigned_role,activation_status,permissions_override")
        .eq("owner_user_id", userId),
      supabase
        .from("assets")
        .select("id,section_key,category_key,title,provider_name")
        .eq("owner_user_id", userId)
        .is("deleted_at", null)
        .is("archived_at", null),
      supabase
        .from("section_entries")
        .select("id,section_key,category_key,title,summary")
        .eq("user_id", userId),
    ]);

    if (invRes.error) {
      setStatus(`⚠️ Could not load invitations: ${invRes.error.message}`);
      setRows([]);
      setLoading(false);
      return;
    }

    const roleMap = new Map<string, RoleAssignmentRow>();
    for (const row of ((roleRes.data ?? []) as RoleAssignmentRow[])) {
      roleMap.set(row.invitation_id, row);
    }

    const contactIds = ((invRes.data ?? []) as Array<{ contact_id: string | null }>)
      .map((row) => String(row.contact_id ?? "").trim())
      .filter(Boolean);
    let canonicalContacts: CanonicalContactRow[] = [];
    if (contactIds.length > 0) {
      try {
        canonicalContacts = await loadCanonicalContactsByIds(supabase, userId, contactIds);
      } catch (error) {
        setStatus(
          `⚠️ Invitations loaded, but shared contacts could not be resolved: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
    const canonicalById = new Map(canonicalContacts.map((row) => [row.id, row]));

    const mapped = ((invRes.data ?? []) as Array<{
      id: string;
      contact_id: string | null;
      contact_name: string | null;
      contact_email: string | null;
      assigned_role: CollaboratorRole | null;
      invitation_status: InvitationStatus | null;
      invited_at: string;
      sent_at: string | null;
    }>).map((row) => {
      const assignment = roleMap.get(row.id);
      const canonical = row.contact_id ? canonicalById.get(row.contact_id) : null;
      return {
        id: row.id,
        contact_id: row.contact_id ?? canonical?.id ?? null,
        contact_name: canonical?.full_name ?? row.contact_name ?? "",
        contact_email: canonical?.email ?? row.contact_email ?? "",
        assigned_role: assignment?.assigned_role ?? row.assigned_role ?? "professional_advisor",
        invitation_status: row.invitation_status ?? "pending",
        activation_status: assignment?.activation_status ?? "invited",
        invited_at: row.invited_at,
        sent_at: row.sent_at,
        permissions_override: assignment?.permissions_override ?? null,
        linked_context: canonical?.linked_context ?? [],
      };
    });

    setRows(mapped);
    setScopeItems([
      ...(((assetsRes.data ?? []) as Array<Record<string, unknown>>)
        .map((row) => mapScopeAssetRow(row))
        .filter((row): row is ScopeItem => Boolean(row))),
      ...(((recordsRes.data ?? []) as Array<Record<string, unknown>>)
        .map((row) => mapScopeRecordRow(row))
        .filter((row): row is ScopeItem => Boolean(row))),
    ]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (isDashboardMode) return;
    const normalizedContactId = String(selectedContactId ?? "").trim();
    if (!normalizedContactId) return;
    const selectedRow = rows.find((row) => row.contact_id === normalizedContactId);
    if (selectedRow) {
      startEdit(selectedRow);
      return;
    }
    if (!selectedContactProfile || selectedContactProfile.id !== normalizedContactId) return;
    setEditingId(null);
    setDraftContactId(selectedContactProfile.id);
    setName(selectedContactProfile.full_name || "");
    setEmail(selectedContactProfile.email || "");
    setRole(normalizeCollaboratorRole(selectedContactProfile.contact_role));
    setOwnerNotes("");
    setAllowedSections([]);
    setAllowedAssetIds([]);
    setAllowedRecordIds([]);
    setEditableAssetIds([]);
    setEditableRecordIds([]);
  }, [isDashboardMode, rows, selectedContactId, selectedContactProfile]);

  useEffect(() => {
    setAllowedSections((current) => current.filter((section) => ROLE_RULES[role].allowedSections.includes(section)));
  }, [role]);

  useEffect(() => {
    const scopedItems = getScopedItemsForSections(scopeItems, allowedSections);
    setAllowedAssetIds(scopedItems.filter((item) => item.sourceKind === "asset").map((item) => item.sourceId));
    setAllowedRecordIds(scopedItems.filter((item) => item.sourceKind === "record").map((item) => item.sourceId));
    setEditableAssetIds((current) => current.filter((id) => scopedItems.some((item) => item.sourceKind === "asset" && item.sourceId === id)));
    setEditableRecordIds((current) => current.filter((id) => scopedItems.some((item) => item.sourceKind === "record" && item.sourceId === id)));
  }, [allowedSections, scopeItems]);

  async function saveContact({ sendAfterSave = false }: { sendAfterSave?: boolean } = {}) {
    setSaving(true);
    setStatus("");

    try {
      const nameTrim = name.trim();
      const emailTrim = email.trim().toLowerCase();
      if (!nameTrim || !emailTrim) {
        setStatus("❌ Contact name and email are required.");
        return;
      }

      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }

      const userId = userData.user.id;
      const now = new Date().toISOString();
      const currentEditingRow = editingId ? rows.find((row) => row.id === editingId) ?? null : null;
      const permissionsOverride = buildScopedPermissionPayload({
        allowedSections,
        ownerNotes,
        assetIds: allowedAssetIds.length > 0 ? allowedAssetIds : [],
        recordIds: allowedRecordIds.length > 0 ? allowedRecordIds : [],
        editableAssetIds,
        editableRecordIds,
      });
      const currentInviteStatus = currentEditingRow
        ? mapRowToCanonicalInviteStatus(currentEditingRow)
        : "not_invited";
      const currentVerificationStatus = currentEditingRow
        ? mapActivationStatusToVerificationStatus(currentEditingRow.activation_status)
        : "not_verified";
      const canonicalContact = await syncCanonicalContact(supabase, {
        ownerUserId: userId,
        existingContactId: currentEditingRow?.contact_id ?? draftContactId ?? null,
        fullName: nameTrim,
        email: emailTrim,
        contactRole: role,
        sourceType: "invitation",
        inviteStatus: currentInviteStatus,
        verificationStatus: currentVerificationStatus,
      });

      if (editingId) {
        const updateRes = await supabase
          .from("contact_invitations")
          .update({ contact_id: canonicalContact.id, contact_name: nameTrim, contact_email: emailTrim, assigned_role: role, updated_at: now })
          .eq("id", editingId)
          .eq("owner_user_id", userId);

        if (updateRes.error) throw updateRes.error;

        const assignRes = await supabase
          .from("role_assignments")
          .upsert(
            {
              owner_user_id: userId,
              invitation_id: editingId,
              assigned_role: role,
              permissions_override: permissionsOverride,
              updated_at: now,
            },
            { onConflict: "invitation_id" },
          );

        if (assignRes.error) throw assignRes.error;

        await syncCanonicalContact(supabase, {
          ownerUserId: userId,
          existingContactId: canonicalContact.id,
          fullName: nameTrim,
          email: emailTrim,
          contactRole: role,
          sourceType: "invitation",
          inviteStatus: currentInviteStatus,
          verificationStatus: currentVerificationStatus,
          link: {
            sourceKind: "invitation",
            sourceId: editingId,
            sectionKey: "dashboard",
            categoryKey: "contacts",
            label: "Contact invitation",
            role,
          },
        });
      } else {
        const insertRes = await supabase
          .from("contact_invitations")
          .insert({
            owner_user_id: userId,
            contact_id: canonicalContact.id,
            contact_name: nameTrim,
            contact_email: emailTrim,
            assigned_role: role,
            invitation_status: "pending",
            invited_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

        if (insertRes.error || !insertRes.data) throw insertRes.error;

        const assignRes = await supabase.from("role_assignments").insert({
          owner_user_id: userId,
          invitation_id: insertRes.data.id,
          assigned_role: role,
          activation_status: "invited",
          permissions_override: permissionsOverride,
          updated_at: now,
        });

        if (assignRes.error) throw assignRes.error;

        await syncCanonicalContact(supabase, {
          ownerUserId: userId,
          existingContactId: canonicalContact.id,
          fullName: nameTrim,
          email: emailTrim,
          contactRole: role,
          sourceType: "invitation",
          inviteStatus: "not_invited",
          verificationStatus: "not_verified",
          link: {
            sourceKind: "invitation",
            sourceId: insertRes.data.id,
            sectionKey: "dashboard",
            categoryKey: "contacts",
            label: "Contact invitation",
            role,
          },
        });

        if (sendAfterSave) {
          await sendInvite({
            id: String(insertRes.data.id),
            contact_id: canonicalContact.id,
            contact_name: nameTrim,
            contact_email: emailTrim,
            assigned_role: role,
            invitation_status: "pending",
            activation_status: "invited",
            invited_at: now,
            sent_at: null,
            permissions_override: permissionsOverride,
            linked_context: selectedContactProfile?.linked_context ?? [],
          }, false);
          return;
        }
      }

      setEditingId(null);
      setDraftContactId(null);
      setName("");
      setEmail("");
      setRole("professional_advisor");
      setOwnerNotes("");
      setAllowedSections([]);
      setAllowedAssetIds([]);
      setAllowedRecordIds([]);
      setEditableAssetIds([]);
      setEditableRecordIds([]);
      setStatus("✅ Contact saved.");
      await loadRows();
    } catch (error) {
      setStatus(`❌ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(row: InvitationRow, resend = false) {
    setStatus("");
    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/sign-in");
      return;
    }
    if (!resend) {
      const ownerPlan = await ensureOwnerPlanProfile(supabase, userData.user.id);
      const inviteCountRes = await supabase
        .from("contact_invitations")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", userData.user.id)
        .neq("invitation_status", "revoked");
      if (inviteCountRes.error) {
        setStatus(`❌ Could not check invitation allowance: ${inviteCountRes.error.message}`);
        return;
      }
      try {
        assertOwnerCanSendInvitation(ownerPlan, Number(inviteCountRes.count ?? 0));
      } catch (error) {
        setStatus(`❌ ${error instanceof Error ? error.message : "Invitation limit reached."}`);
        return;
      }
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256(token);
    const now = new Date().toISOString();
    const { data: ownerProfile } = await supabase
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const emailDraft = buildInvitationEmailDraft({
      invitationId: row.id,
      token,
      assignedRole: row.assigned_role,
      accountHolderName: String(ownerProfile?.display_name ?? "").trim() || userData.user.email?.split("@")[0] || "the account holder",
    });
    const deliveryResult = await supabase.auth.signInWithOtp({
      email: row.contact_email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(emailDraft.acceptPath)}`
            : undefined,
        data: {
          invitation_id: row.id,
          invitation_role: row.assigned_role,
          account_holder_name:
            String(ownerProfile?.display_name ?? "").trim() || userData.user.email?.split("@")[0] || "the account holder",
          linked_access: "view_only",
        },
      },
    });

    if (deliveryResult.error) {
      setStatus(`❌ Could not ${resend ? "resend" : "send"} invitation email: ${deliveryResult.error.message}`);
      return;
    }

    const { error } = await supabase
      .from("contact_invitations")
      .update({
        invite_token_hash: tokenHash,
        invitation_status: "pending",
        sent_at: now,
        last_sent_at: now,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("owner_user_id", userData.user.id);

    if (error) {
      setStatus(`❌ Could not ${resend ? "resend" : "send"} invitation: ${error.message}`);
      return;
    }

    if (row.contact_id) {
      await syncCanonicalContact(supabase, {
        ownerUserId: userData.user.id,
        existingContactId: row.contact_id,
        fullName: row.contact_name,
        email: row.contact_email,
        contactRole: row.assigned_role,
        sourceType: "invitation",
        inviteStatus: "invite_sent",
        verificationStatus: mapActivationStatusToVerificationStatus(row.activation_status),
        link: {
          sourceKind: "invitation",
          sourceId: row.id,
          sectionKey: "dashboard",
          categoryKey: "contacts",
          label: "Contact invitation",
          role: row.assigned_role,
        },
      });
    }

    const { error: eventError } = await supabase.from("invitation_events").insert({
      owner_user_id: userData.user.id,
      invitation_id: row.id,
      event_type: resend ? "resent" : "sent",
      payload: {
        contact_email: row.contact_email,
        token_hint: token.slice(-6),
        subject: emailDraft.subject,
        preview: emailDraft.preview,
        body_text: emailDraft.bodyText,
        accept_path: emailDraft.acceptPath,
      },
    });

    if (eventError) {
      setStatus(`⚠️ Invitation email sent, but event log failed: ${eventError.message}`);
    } else {
      setStatus(`✅ Invitation email ${resend ? "resent" : "sent"} to ${row.contact_email}.`);
    }

    await loadRows();
  }

  function startEdit(row: InvitationRow) {
    const permissions = loadPermissionsOverride(row);
    setEditingId(row.id);
    setDraftContactId(row.contact_id ?? null);
    setName(row.contact_name);
    setEmail(row.contact_email);
    setRole(row.assigned_role);
    setOwnerNotes(permissions.owner_notes);
    setAllowedSections(permissions.allowed_sections);
    setAllowedAssetIds(permissions.asset_ids);
    setAllowedRecordIds(permissions.record_ids);
    setEditableAssetIds(permissions.editable_asset_ids);
    setEditableRecordIds(permissions.editable_record_ids);
  }

  async function remove(row: InvitationRow) {
    setStatus("");
    const ok = window.confirm(`Delete ${row.contact_name || row.contact_email}? This removes the invitation, linked access, and shared contact entry.`);
    if (!ok) return;

    try {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }

      if (row.contact_id) {
        await deleteCanonicalContact(supabase, {
          ownerUserId: userData.user.id,
          contactId: row.contact_id,
        });
      } else {
        const [grantsRes, invitationRes] = await Promise.all([
          supabase.from("account_access_grants").delete().eq("owner_user_id", userData.user.id).eq("invitation_id", row.id),
          supabase.from("contact_invitations").delete().eq("owner_user_id", userData.user.id).eq("id", row.id),
        ]);
        if (grantsRes.error || invitationRes.error) {
          setStatus(`❌ Could not delete contact: ${grantsRes.error?.message || invitationRes.error?.message}`);
          return;
        }
      }

      setStatus("✅ Contact deleted.");
      if (editingId === row.id) {
        setEditingId(null);
        setOwnerNotes("");
        setAllowedSections([]);
        setAllowedAssetIds([]);
        setAllowedRecordIds([]);
      }
      await loadRows();
    } catch (error) {
      setStatus(`❌ Could not delete contact: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function removeSelectedDraftContact() {
    if (!draftContactId) return;
    const ok = window.confirm(`Delete ${name || "this contact"}? This removes the shared contact entry and any linked invitation access.`);
    if (!ok) return;

    try {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }

      await deleteCanonicalContact(supabase, {
        ownerUserId: userData.user.id,
        contactId: draftContactId,
      });

      setStatus("✅ Contact deleted.");
      setDraftContactId(null);
      setEditingId(null);
      setName("");
      setEmail("");
      setOwnerNotes("");
      setAllowedSections([]);
      setAllowedAssetIds([]);
      setAllowedRecordIds([]);
      setEditableAssetIds([]);
      setEditableRecordIds([]);
      router.push("/contacts");
      await loadRows();
    } catch (error) {
      setStatus(`❌ Could not delete contact: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return (
    <section
      style={panelStyle}
      aria-label="Contact invitation management"
    >
      <div style={panelHeaderStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={sectionIconStyle}>
              <Icon name="contacts" size={16} />
            </div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{isDashboardMode ? "Contacts and invitations" : "Contacts, invitations and roles"}</h2>
          </div>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
            {isDashboardMode
              ? "Review invitation progress here, then open Contacts for contact editing, removal, access notes, and richer controls."
              : "Keep trusted contacts, invitation progress, and assigned access roles easy to review in one place."}
          </p>
        </div>
        {isDashboardMode ? (
          <Link href="/contacts" style={contactsLinkStyle} title="Open Contacts">
            <Icon name="open_in_new" size={16} />
            Open Contacts
          </Link>
        ) : null}
      </div>

      {!isDashboardMode ? (
      <div style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Contacts</span>
          <strong style={summaryValueStyle}>{invitationSummary.total}</strong>
          <span style={summaryHelpStyle}>Tracked here</span>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Pending</span>
          <strong style={summaryValueStyle}>{invitationSummary.invited}</strong>
          <span style={summaryHelpStyle}>Awaiting response</span>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Accepted</span>
          <strong style={summaryValueStyle}>{invitationSummary.accepted}</strong>
          <span style={summaryHelpStyle}>Linked or verified</span>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Ready to send</span>
          <strong style={summaryValueStyle}>{invitationSummary.readyToSend}</strong>
          <span style={summaryHelpStyle}>Saved but unsent</span>
        </div>
      </div>
      ) : null}

      {!isDashboardMode ? (
      <div style={sectionBlockStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={sectionTitleStyle}>{editingId || draftContactId ? "Manage contact" : "Add contact"}</h3>
              <InfoTip
                label="Explain contact access setup"
                message="Invite trusted people, choose the categories they can review, and allow edit access only on the specific records that really need it."
              />
            </div>
            <p style={sectionIntroStyle}>
              Save the selected contact here, then manage role, invitation state, internal notes, category access, and exact linked-record scope from the same shared admin surface.
            </p>
          </div>
        </div>

        <div className="lf-content-grid" style={{ gap: 10 }}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Full name" />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} type="email" placeholder="name@example.com" />
          </label>
          <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as CollaboratorRole)} style={inputStyle}>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
            <span style={fieldLabelStyle}>Owner notes</span>
            <textarea
              value={ownerNotes}
              onChange={(e) => setOwnerNotes(e.target.value)}
              style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
              placeholder="Optional handover or access notes"
            />
          </label>
          <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
            <span style={fieldLabelStyle}>Category access</span>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Choose the visible categories this contact can review. Records beneath each selected category start as view only, then you can allow editing record by record.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {getVisibleAccessScopeOptions(preferences, role)
                .map((option) => {
                  const checked = allowedSections.includes(option.key);
                  return (
                    <label key={option.key} style={scopeChipStyle}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setAllowedSections((current) => checked ? current.filter((item) => item !== option.key) : [...current, option.key]);
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
            </div>
          </div>
          {allowedSections.length ? (
            <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <span style={fieldLabelStyle}>Linked records and document permissions</span>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Each listed record is included through the selected category. Leave it on view only by default, or switch it to edit when the contact should be able to update that exact record.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {getScopedItemsForSections(scopeItems, allowedSections).map((option) => {
                  const editable = option.sourceKind === "asset"
                    ? editableAssetIds.includes(option.sourceId)
                    : editableRecordIds.includes(option.sourceId);
                  const href = buildLinkedContactRecordHref({
                    source_kind: option.sourceKind,
                    source_id: option.sourceId,
                    section_key: option.sectionKey,
                    category_key: option.categoryKey,
                    label: option.label,
                    role: option.role,
                  });

                  return (
                    <div key={`${option.sourceKind}:${option.sourceId}`} style={scopePermissionRowStyle}>
                      <div style={{ display: "grid", gap: 2 }}>
                        <span style={{ fontWeight: 600 }}>{option.label}</span>
                        <span style={{ color: "#64748b", fontSize: 12 }}>{option.meta}</span>
                      </div>
                      {href ? (
                        <Link href={href} style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}>
                          Open
                        </Link>
                      ) : null}
                      <div style={permissionToggleStyle} role="group" aria-label={`Permission for ${option.label}`}>
                        <button
                          type="button"
                          style={editable ? permissionOffButtonStyle : permissionOnButtonStyle}
                          onClick={() => toggleScopedEditPermission(option, false, setEditableAssetIds, setEditableRecordIds)}
                        >
                          View only
                        </button>
                        <button
                          type="button"
                          style={editable ? permissionOnButtonStyle : permissionOffButtonStyle}
                          onClick={() => toggleScopedEditPermission(option, true, setEditableAssetIds, setEditableRecordIds)}
                        >
                          Edit document
                        </button>
                      </div>
                    </div>
                  );
                })}
                {getScopedItemsForSections(scopeItems, allowedSections).length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 12 }}>No saved records are available yet in the selected categories.</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={primaryBtnStyle} disabled={saving} onClick={() => void saveContact()}>
            {saving ? "Saving..." : editingId ? "Update contact" : draftContactId ? "Save access setup" : "Add contact"}
          </button>
          {!editingId && draftContactId && email.trim() ? (
            <button type="button" style={ghostBtnStyle} disabled={saving} onClick={() => void saveContact({ sendAfterSave: true })}>
              {saving ? "Saving..." : "Save and send invite"}
            </button>
          ) : null}
          {!editingId && draftContactId ? (
            <button type="button" style={dangerBtnStyle} disabled={saving} onClick={() => void removeSelectedDraftContact()}>
              Delete contact
            </button>
          ) : null}
          {(editingId || draftContactId) ? (
            <button
              type="button"
              style={ghostBtnStyle}
              disabled={saving}
              onClick={() => {
                setEditingId(null);
                setDraftContactId(null);
                setName("");
                setEmail("");
                setStatus("Choose the replacement contact details, then save to reuse this access setup.");
              }}
            >
              Replace contact
            </button>
          ) : null}
          {editingId && currentEditingRow && canSendInvite(currentEditingRow) ? (
            <button type="button" style={ghostBtnStyle} disabled={saving} onClick={() => void sendInvite(currentEditingRow, false)}>
              Send invite
            </button>
          ) : null}
          {editingId && currentEditingRow && canResendInvite(currentEditingRow) ? (
            <button type="button" style={ghostBtnStyle} disabled={saving} onClick={() => void sendInvite(currentEditingRow, true)}>
              Resend invite
            </button>
          ) : null}
          {editingId && currentEditingRow ? (
            <button type="button" style={dangerBtnStyle} disabled={saving} onClick={() => void remove(currentEditingRow)}>
              Delete contact
            </button>
          ) : null}
          {editingId ? (
            <button
              type="button"
              style={ghostBtnStyle}
              onClick={() => {
                setEditingId(null);
                setDraftContactId(null);
                setName("");
                setEmail("");
                setRole("professional_advisor");
                setOwnerNotes("");
                setAllowedSections([]);
                setAllowedAssetIds([]);
                setAllowedRecordIds([]);
                setEditableAssetIds([]);
                setEditableRecordIds([]);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}

      <div style={sectionBlockStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h3 style={sectionTitleStyle}>Invitation queue</h3>
            <p style={sectionIntroStyle}>
              {isDashboardMode
                ? "Review invitation state here, send or resend from the queue, then open Contacts for contact edits and detailed access management."
                : "Review access roles, invitation state, and the latest action for each contact."}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading invitations...</div>
        ) : rows.length === 0 ? (
          <div style={emptyStateStyle}>
            <Icon name="mail" size={16} />
            No contacts invited yet.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }} className="lf-contact-invitations-table-wrap lf-desktop-only">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} className="lf-contact-invitations-table">
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={thStyle}>Contact</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>{isDashboardMode ? "Date" : "Invited"}</th>
                    <th style={thStyle}>{isDashboardMode ? "Edit" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }} className="lf-contact-invitations-row">
                      <td style={tdStyle} data-label="Contact">
                        <div style={{ display: "grid", gap: 4 }}>
                          <Link href={buildContactsWorkspaceHref(row.contact_id ?? "")} style={contactLinkStyle} title={`Open ${row.contact_name || row.contact_email} in Contacts`}>
                            {row.contact_name}
                          </Link>
                          <div style={{ color: "#6b7280" }}>{row.contact_email}</div>
                        </div>
                      </td>
                      <td style={tdStyle} data-label="Status">
                        <div style={{ display: "grid", gap: 6 }}>
                          {isDashboardMode ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <StatusIcon {...getInvitationStatusIcon(row)} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{getDashboardInvitationStatusLabel(row)}</span>
                            </div>
                          ) : (
                            <InvitationStatusBadge invitationStatus={row.invitation_status} activationStatus={row.activation_status} sentAt={row.sent_at} />
                          )}
                        </div>
                      </td>
                      <td style={tdStyle} data-label="Role">
                        <RoleBadge role={row.assigned_role} />
                      </td>
                      <td style={tdStyle} data-label={isDashboardMode ? "Date" : "Invited"}>{formatShortDate(row.sent_at ?? row.invited_at)}</td>
                      <td style={tdStyle} data-label={isDashboardMode ? "Edit" : "Actions"}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {isDashboardMode ? (
                            <>
                              {canSendInvite(row) ? (
                                <IconButton
                                  icon="send"
                                  label={`Send invitation to ${row.contact_email}`}
                                  onClick={() => void sendInvite(row, false)}
                                />
                              ) : null}
                              {canResendInvite(row) ? (
                                <IconButton
                                  icon="forward_to_inbox"
                                  label={`Resend invitation to ${row.contact_email}`}
                                  onClick={() => void sendInvite(row, true)}
                                />
                              ) : null}
                              <IconButton
                                icon="open_in_new"
                                label={`Open ${row.contact_name || row.contact_email} in Contacts`}
                                onClick={() => router.push(buildContactsWorkspaceHref(row.contact_id ?? ""))}
                              />
                            </>
                          ) : (
                            <>
                              <ActionIconButton action="edit" label={`Edit ${row.contact_name || row.contact_email}`} onClick={() => startEdit(row)} />
                              {canSendInvite(row) ? (
                                <IconButton
                                  icon="send"
                                  label={`Send invitation to ${row.contact_email}`}
                                  onClick={() => void sendInvite(row, false)}
                                />
                              ) : null}
                              {canResendInvite(row) ? (
                                <IconButton
                                  icon="forward_to_inbox"
                                  label={`Resend invitation to ${row.contact_email}`}
                                  onClick={() => void sendInvite(row, true)}
                                />
                              ) : null}
                              <ActionIconButton action="delete" label={`Delete ${row.contact_name || row.contact_email}`} onClick={() => void remove(row)} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lf-mobile-only" style={{ display: "grid", gap: 10 }}>
              {rows.map((row) => (
                <article key={`${row.id}-mobile`} style={mobileCardStyle}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <Link href={buildContactsWorkspaceHref(row.contact_id ?? "")} style={contactLinkStyle} title={`Open ${row.contact_name || row.contact_email} in Contacts`}>
                          {row.contact_name}
                        </Link>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>{row.contact_email}</div>
                      </div>
                      <RoleBadge role={row.assigned_role} />
                    </div>
                    {isDashboardMode ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <StatusIcon {...getInvitationStatusIcon(row)} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{getDashboardInvitationStatusLabel(row)}</span>
                      </div>
                    ) : (
                      <InvitationStatusBadge invitationStatus={row.invitation_status} activationStatus={row.activation_status} sentAt={row.sent_at} />
                    )}
                  </div>

                  <div style={mobileMetaBlockStyle}>
                    <div style={mobileMetaRowStyle}>
                      <span style={mobileMetaLabelStyle}>{isDashboardMode ? "Date" : "Invited"}</span>
                      <span>{formatShortDate(row.sent_at ?? row.invited_at)}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {isDashboardMode ? (
                      <>
                        {canSendInvite(row) ? (
                          <IconButton
                            icon="send"
                            label={`Send invitation to ${row.contact_email}`}
                            onClick={() => void sendInvite(row, false)}
                          />
                        ) : null}
                        {canResendInvite(row) ? (
                          <IconButton
                            icon="forward_to_inbox"
                            label={`Resend invitation to ${row.contact_email}`}
                            onClick={() => void sendInvite(row, true)}
                          />
                        ) : null}
                        <IconButton
                          icon="open_in_new"
                          label={`Open ${row.contact_name || row.contact_email} in Contacts`}
                          onClick={() => router.push(buildContactsWorkspaceHref(row.contact_id ?? ""))}
                        />
                      </>
                    ) : (
                      <>
                        <ActionIconButton action="edit" label={`Edit ${row.contact_name || row.contact_email}`} onClick={() => startEdit(row)} />
                        {canSendInvite(row) ? (
                          <IconButton
                            icon="send"
                            label={`Send invitation to ${row.contact_email}`}
                            onClick={() => void sendInvite(row, false)}
                          />
                        ) : null}
                        {canResendInvite(row) ? (
                          <IconButton
                            icon="forward_to_inbox"
                            label={`Resend invitation to ${row.contact_email}`}
                            onClick={() => void sendInvite(row, true)}
                          />
                        ) : null}
                        <ActionIconButton action="delete" label={`Delete ${row.contact_name || row.contact_email}`} onClick={() => void remove(row)} />
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatShortDate(input: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(new Date(input));
  } catch {
    return input;
  }
}

function canResendInvite(row: InvitationRow) {
  return Boolean(String(row.sent_at ?? "").trim()) && row.invitation_status !== "revoked" && row.activation_status !== "active" && row.activation_status !== "verified";
}

function canSendInvite(row: InvitationRow) {
  return !String(row.sent_at ?? "").trim() && row.invitation_status !== "revoked" && row.activation_status !== "active" && row.activation_status !== "verified";
}

function getInvitationStatusIcon(row: InvitationRow) {
  const state = resolveInvitationBadgeState(row.invitation_status, row.activation_status, row.sent_at);
  if (state.tone === "success") return { icon: "verified", tone: "success" as const, label: state.label };
  if (state.tone === "danger") return { icon: "cancel", tone: "danger" as const, label: state.label };
  if (state.tone === "warning") return { icon: "schedule", tone: "warning" as const, label: state.label };
  return { icon: "mail", tone: "neutral" as const, label: state.label };
}

function mapRowToCanonicalInviteStatus(row: InvitationRow) {
  if (row.invitation_status === "revoked") return "revoked" as const;
  if (row.invitation_status === "rejected") return "rejected" as const;
  if (row.activation_status === "active" || row.activation_status === "verified" || row.activation_status === "accepted" || row.invitation_status === "accepted") {
    return "accepted" as const;
  }
  return row.sent_at ? "invite_sent" as const : "not_invited" as const;
}

function loadPermissionsOverride(row: InvitationRow) {
  return normalizeContactPermissionsOverride(row.permissions_override);
}

function getDashboardInvitationStatusLabel(row: InvitationRow) {
  const label = resolveInvitationBadgeState(row.invitation_status, row.activation_status, row.sent_at).label;
  return label === "Ready to send" ? "Send email" : label;
}

function getVisibleAccessScopeOptions(
  preferences: ReturnType<typeof useVaultPreferences>["preferences"],
  role: CollaboratorRole,
) {
  return ACCESS_SCOPE_OPTIONS
    .filter((option) => ROLE_RULES[role].allowedSections.includes(option.key))
    .filter((option) => {
      if (option.key === "financial") return isVaultCategoryEnabled(preferences, "finances");
      if (option.key === "legal") return isVaultCategoryEnabled(preferences, "legal");
      if (option.key === "property") return isVaultCategoryEnabled(preferences, "property");
      if (option.key === "business") return isVaultCategoryEnabled(preferences, "business");
      if (option.key === "personal") return isVaultCategoryEnabled(preferences, "personal");
      if (option.key === "digital") return isVaultCategoryEnabled(preferences, "digital");
      return true;
    });
}

function getScopedItemsForSections(items: ScopeItem[], sections: SectionKey[]) {
  const allowed = new Set(sections);
  return items.filter((item) => allowed.has(item.sectionKey));
}

function toggleScopedEditPermission(
  item: ScopeItem,
  nextEditable: boolean,
  setEditableAssetIds: Dispatch<SetStateAction<string[]>>,
  setEditableRecordIds: Dispatch<SetStateAction<string[]>>,
) {
  if (item.sourceKind === "asset") {
    setEditableAssetIds((current) =>
      nextEditable
        ? Array.from(new Set([...current, item.sourceId]))
        : current.filter((id) => id !== item.sourceId),
    );
    return;
  }
  setEditableRecordIds((current) =>
    nextEditable
      ? Array.from(new Set([...current, item.sourceId]))
      : current.filter((id) => id !== item.sourceId),
  );
}

function mapScopeAssetRow(row: Record<string, unknown>): ScopeItem | null {
  const sectionKey = normalizeSectionKey(row.section_key);
  const sourceId = String(row.id ?? "").trim();
  if (!sectionKey || !sourceId) return null;
  return {
    sourceKind: "asset",
    sourceId,
    sectionKey,
    categoryKey: String(row.category_key ?? "").trim() || null,
    label: String(row.title ?? row.provider_name ?? "Untitled record").trim() || "Untitled record",
    meta: [String(row.category_key ?? "").trim(), "Canonical record"].filter(Boolean).join(" · "),
    role: null,
  };
}

function mapScopeRecordRow(row: Record<string, unknown>): ScopeItem | null {
  const sectionKey = normalizeSectionKey(row.section_key);
  const sourceId = String(row.id ?? "").trim();
  if (!sectionKey || !sourceId) return null;
  return {
    sourceKind: "record",
    sourceId,
    sectionKey,
    categoryKey: String(row.category_key ?? "").trim() || null,
    label: String(row.title ?? row.summary ?? "Untitled record").trim() || "Untitled record",
    meta: [String(row.category_key ?? "").trim(), "Workspace record"].filter(Boolean).join(" · "),
    role: null,
  };
}

function normalizeSectionKey(value: unknown): SectionKey | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "financial" || normalized === "legal" || normalized === "property" || normalized === "business" || normalized === "personal" || normalized === "digital" || normalized === "profile") {
    return normalized as SectionKey;
  }
  return null;
}

function getScopedLinkOptions(contexts: CanonicalContactRow["linked_context"]) {
  return contexts
    .filter((context) => context.source_kind === "asset" || context.source_kind === "record")
    .map((context) => ({
      sourceKind: context.source_kind,
      sourceId: context.source_id,
      sectionKey: context.section_key ?? null,
      categoryKey: context.category_key ?? null,
      role: context.role ?? null,
      label: context.label || [context.section_key, context.category_key, context.role].filter(Boolean).join(" · ") || "Linked record",
    }));
}

function normalizeCollaboratorRole(value: string | null | undefined): CollaboratorRole {
  const normalized = String(value ?? "").trim();
  if (normalized && normalized in ROLE_RULES && normalized !== "owner") {
    return normalized as CollaboratorRole;
  }
  return "professional_advisor";
}

const panelStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 14,
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const sectionBlockStyle: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 14,
  background: "#fcfdff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
};

const sectionIntroStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const contactLinkStyle: CSSProperties = {
  fontWeight: 700,
  color: "#0f172a",
  textDecoration: "none",
};

const contactsLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 600,
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "7px 10px",
  background: "#fff",
};

const mutedDashStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 16,
};

const sectionIconStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 10,
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#0f172a",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};

const summaryCardStyle: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 14,
  background: "#f8fafc",
  padding: 12,
  display: "grid",
  gap: 4,
};

const summaryLabelStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const summaryValueStyle: CSSProperties = {
  fontSize: 24,
  lineHeight: 1,
  color: "#0f172a",
};

const summaryHelpStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};

const fieldStyle: CSSProperties = { display: "grid", gap: 6 };
const fieldLabelStyle: CSSProperties = { fontSize: 12, color: "#374151" };
const scopeChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #dbe3eb",
  background: "#fff",
  fontSize: 13,
  color: "#0f172a",
};
const inputStyle: CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
};
const primaryBtnStyle: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  cursor: "pointer",
};

const mobileCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
  display: "grid",
  gap: 10,
};

const mobileMetaBlockStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const mobileMetaRowStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const mobileMetaLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  color: "#64748b",
};
const emptyStateStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#64748b",
};
const ghostBtnStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  cursor: "pointer",
};
const scopePermissionRowStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
};
const permissionToggleStyle: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  flexWrap: "wrap",
};
const permissionOnButtonStyle: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
};
const permissionOffButtonStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
};
const dangerBtnStyle: CSSProperties = {
  border: "1px solid #dc2626",
  background: "#fff",
  color: "#b91c1c",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  cursor: "pointer",
};
const thStyle: CSSProperties = { padding: "8px 6px", fontSize: 12, color: "#64748b", fontWeight: 600 };
const tdStyle: CSSProperties = { padding: "10px 6px", verticalAlign: "top" };
