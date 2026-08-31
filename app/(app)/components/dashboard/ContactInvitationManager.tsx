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
  loadPeopleScopeResourcesForOwner,
  loadPeopleInvitationsForOwner,
  mapActivationStatusToVerificationStatus,
  removePeopleContact,
  savePeopleContact,
  savePeopleInvitationProjection,
  updatePeopleContactProjectionCaches,
  type CanonicalContactRow,
} from "../../../../lib/contacts/contactRepository";
import { buildContactsWorkspaceHref, buildLinkedContactRecordHref } from "../../../../lib/contacts/contactRouting";
import { getExistingContactInvitationNotice, getSafeContactInvitationErrorMessage } from "../../../../lib/contacts/invitationLifecycle.ts";
import { sendContactInvite } from "../../../../lib/contacts/sendContactInvite";
import { resolveInvitationBadgeState, type InvitationStatus } from "../../../../lib/contacts/invitationStatus";
import { useVaultPreferences } from "../../../../components/vault/VaultPreferencesContext";
import { getVaultSubsectionsForGroup, isVaultCategoryEnabled, isVaultSubsectionEnabled, type VaultCategoryGroupKey } from "../../../../lib/vaultPreferences";
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

type ScopeItem = {
  sourceKind: "asset" | "record";
  sourceId: string;
  sectionKey: SectionKey;
  categoryKey: string | null;
  label: string;
  meta: string;
  role: string | null;
};

type ScopedResourceGroup = {
  key: string;
  label: string;
  description: string;
  items: ScopeItem[];
};

type RecentInvitation = {
  id: string;
  contactId: string;
  name: string;
  email: string;
  outcome: "prepared" | "sent";
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

const DEFAULT_INITIAL_ALLOWED_SECTIONS: SectionKey[] = [];

export default function ContactInvitationManager({
  mode = "full",
  guidedExecutor = false,
  selectedContactId = "",
  selectedContactProfile = null,
  initialRole,
  initialAllowedSections = DEFAULT_INITIAL_ALLOWED_SECTIONS,
}: {
  mode?: "full" | "dashboard";
  guidedExecutor?: boolean;
  selectedContactId?: string;
  selectedContactProfile?: Pick<CanonicalContactRow, "id" | "full_name" | "email" | "contact_role" | "linked_context"> | null;
  initialRole?: CollaboratorRole;
  initialAllowedSections?: SectionKey[];
}) {
  const router = useRouter();
  const { preferences } = useVaultPreferences();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [recentlySentById, setRecentlySentById] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<InvitationRow[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("professional_advisor");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [allowedSections, setAllowedSections] = useState<SectionKey[]>([]);
  const [allowedAssetIds, setAllowedAssetIds] = useState<string[]>([]);
  const [allowedRecordIds, setAllowedRecordIds] = useState<string[]>([]);
  const [editableAssetIds, setEditableAssetIds] = useState<string[]>([]);
  const [editableRecordIds, setEditableRecordIds] = useState<string[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [guidedStep, setGuidedStep] = useState<"person" | "role" | "access" | "review">("person");
  const [recentInvitation, setRecentInvitation] = useState<RecentInvitation | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContactId, setDraftContactId] = useState<string | null>(null);
  const isDashboardMode = mode === "dashboard";
  const showInvitationQueue = isDashboardMode;

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
  const statusAction = useMemo(() => {
    if (!status.includes("Starter plan limit reached")) return null;
    return {
      href: "/account/billing?reason=plan-limit",
      label: "Upgrade plan / Manage subscription",
      detail: "Open the subscription panel",
    };
  }, [status]);

  const isRecentlySent = useCallback(
    (rowId: string) => Boolean(recentlySentById[rowId]),
    [recentlySentById],
  );

  const markRecentlySent = useCallback((rowId: string) => {
    setRecentlySentById((current) => ({ ...current, [rowId]: Date.now() }));
    window.setTimeout(() => {
      setRecentlySentById((current) => {
        const next = { ...current };
        delete next[rowId];
        return next;
      });
    }, 2500);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setStatus("");

    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/sign-in");
      return;
    }

    const userId = userData.user.id;

    const [invitationRows, scopeResources] = await Promise.all([
      loadPeopleInvitationsForOwner(supabase, userId),
      loadPeopleScopeResourcesForOwner(supabase, userId),
    ]);

    setRows(invitationRows as InvitationRow[]);
    setScopeItems(scopeResources.map((row) => mapScopeSourceRow(row)).filter((row): row is ScopeItem => Boolean(row)));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (isDashboardMode) return;
    const normalizedContactId = String(selectedContactId ?? "").trim();
    if (!normalizedContactId) {
      const nextRole = initialRole ?? "professional_advisor";
      const allowedByRole = new Set(ROLE_RULES[nextRole].allowedSections);
      setRole(nextRole);
      setAllowedSections(initialAllowedSections.filter((section) => allowedByRole.has(section)));
      if (guidedExecutor) setGuidedStep("person");
      return;
    }
    const selectedRow = rows.find((row) => row.contact_id === normalizedContactId || row.id === normalizedContactId);
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
  }, [guidedExecutor, initialAllowedSections, initialRole, isDashboardMode, rows, selectedContactId, selectedContactProfile]);

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
      const existingDraftInvitation = !currentEditingRow
        ? await loadExistingInvitationForContact(userId, {
            contactId: draftContactId ?? null,
            contactEmail: emailTrim,
          })
        : null;
      const managedInvitation = currentEditingRow ?? existingDraftInvitation;
      const managedInvitationId = editingId ?? existingDraftInvitation?.id ?? null;
      const permissionsOverride = buildScopedPermissionPayload({
        allowedSections,
        ownerNotes,
        assetIds: allowedAssetIds.length > 0 ? allowedAssetIds : [],
        recordIds: allowedRecordIds.length > 0 ? allowedRecordIds : [],
        editableAssetIds,
        editableRecordIds,
      });
      const currentInviteStatus = managedInvitation
        ? mapRowToCanonicalInviteStatus(managedInvitation)
        : "not_invited";
      const currentVerificationStatus = managedInvitation
        ? mapActivationStatusToVerificationStatus(managedInvitation.activation_status)
        : "not_verified";
      const canonicalContact = await savePeopleContact(supabase, {
        ownerUserId: userId,
        existingContactId: managedInvitation?.contact_id ?? draftContactId ?? null,
        fullName: nameTrim,
        email: emailTrim,
        phone: phone.trim() || undefined,
        contactRole: role,
        sourceType: "invitation",
        inviteStatus: currentInviteStatus,
        verificationStatus: currentVerificationStatus,
      });

      if (managedInvitationId) {
        await savePeopleInvitationProjection(supabase, {
          ownerUserId: userId,
          invitationId: managedInvitationId,
          contact: canonicalContact,
          assignedRole: role,
          invitationStatus: managedInvitation?.invitation_status ?? "pending",
          invitedAt: managedInvitation?.invited_at ?? now,
          sentAt: managedInvitation?.sent_at ?? null,
          updatedAt: now,
          permissionsOverride,
          activationStatus: managedInvitation?.activation_status ?? "invited",
        });

        await savePeopleContact(supabase, {
          ownerUserId: userId,
          existingContactId: canonicalContact.id,
          fullName: nameTrim,
          email: emailTrim,
          phone: phone.trim() || undefined,
          contactRole: role,
          sourceType: "invitation",
          inviteStatus: currentInviteStatus,
          verificationStatus: currentVerificationStatus,
          link: {
            sourceKind: "invitation",
            sourceId: managedInvitationId,
            sectionKey: "dashboard",
            categoryKey: "contacts",
            label: "Contact invitation",
            role,
          },
        });
        await updatePeopleContactProjectionCaches(supabase, {
          ownerUserId: userId,
          contact: {
            ...canonicalContact,
            full_name: nameTrim,
            email: emailTrim,
            contact_role: role,
          },
        });
      } else {
        const insertRes = await savePeopleInvitationProjection(supabase, {
          ownerUserId: userId,
          contact: canonicalContact,
          assignedRole: role,
          invitationStatus: "pending",
          invitedAt: now,
          updatedAt: now,
          permissionsOverride,
          activationStatus: "invited",
        });

        await savePeopleContact(supabase, {
          ownerUserId: userId,
          existingContactId: canonicalContact.id,
          fullName: nameTrim,
          email: emailTrim,
          phone: phone.trim() || undefined,
          contactRole: role,
          sourceType: "invitation",
          inviteStatus: "not_invited",
          verificationStatus: "not_verified",
          link: {
            sourceKind: "invitation",
            sourceId: insertRes.id,
            sectionKey: "dashboard",
            categoryKey: "contacts",
            label: "Contact invitation",
            role,
          },
        });
        await updatePeopleContactProjectionCaches(supabase, {
          ownerUserId: userId,
          contact: {
            ...canonicalContact,
            full_name: nameTrim,
            email: emailTrim,
            contact_role: role,
          },
        });

        if (sendAfterSave) {
          const sent = await sendInvite({
            id: String(insertRes.id),
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
          if (sent) {
            resetEditor();
          }
          return;
        }
        if (guidedExecutor) {
          setRecentInvitation({
            id: String(insertRes.id),
            contactId: canonicalContact.id,
            name: nameTrim,
            email: emailTrim,
            outcome: "prepared",
          });
        }
      }

      setEditingId(null);
      setDraftContactId(null);
      setName("");
      setEmail("");
      setPhone("");
      setRole("professional_advisor");
      setOwnerNotes("");
      setAllowedSections([]);
      setAllowedAssetIds([]);
      setAllowedRecordIds([]);
      setEditableAssetIds([]);
      setEditableRecordIds([]);
      setStatus(`✅ ${managedInvitation ? getExistingContactInvitationNotice(managedInvitation.invitation_status) : "Invitation prepared — ready to send."}`);
      await loadRows();
      notifyContactsUpdated();
    } catch (error) {
      setStatus(`❌ Save failed: ${getSafeContactInvitationErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(row: InvitationRow, resend = false) {
    setStatus("");
    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/sign-in");
      return false;
    }

    try {
      const result = await sendContactInvite(supabase, {
        ownerUserId: userData.user.id,
        ownerEmail: userData.user.email ?? null,
        contactId: row.contact_id,
        contactName: row.contact_name,
        contactEmail: row.contact_email,
        assignedRole: row.assigned_role,
        invitationId: row.id,
        invitedAt: row.invited_at,
        activationStatus: row.activation_status,
        permissionsOverride: row.permissions_override ?? null,
        resend,
        origin: typeof window !== "undefined" ? window.location.origin : null,
      });

      if (result.eventWarning) {
        setStatus(`⚠️ Invitation email sent, but event log failed: ${result.eventWarning}`);
      } else {
        setStatus(`✅ Invitation email ${resend ? "resent" : "sent"} to ${row.contact_email}.`);
      }
      markRecentlySent(row.id);
      if (guidedExecutor) {
        setRecentInvitation({
          id: row.id,
          contactId: row.contact_id ?? "",
          name: row.contact_name,
          email: row.contact_email,
          outcome: "sent",
        });
      }
      await loadRows();
      notifyContactsUpdated();
      return true;
    } catch (error) {
      setStatus(`❌ Could not ${resend ? "resend" : "send"} invitation: ${getSafeContactInvitationErrorMessage(error)}`);
      return false;
    }
  }

  function resetEditor() {
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
    setGuidedStep("person");
  }

  function startEdit(row: InvitationRow) {
    const permissions = loadPermissionsOverride(row);
    setEditingId(row.id);
    setDraftContactId(row.contact_id ?? null);
    setName(row.contact_name);
    setEmail(row.contact_email);
    setPhone("");
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
        await removePeopleContact(supabase, {
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
      notifyContactsUpdated();
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

      await removePeopleContact(supabase, {
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
      notifyContactsUpdated();
    } catch (error) {
      setStatus(`❌ Could not delete contact: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function loadExistingInvitationForContact(
    ownerUserId: string,
    {
      contactId,
      contactEmail,
    }: {
      contactId: string | null;
      contactEmail: string;
    },
  ): Promise<InvitationRow | null> {
    let invitationRes = contactId
      ? await supabase
        .from("contact_invitations")
        .select("id,contact_id,contact_name,contact_email,assigned_role,invitation_status,invited_at,sent_at")
        .eq("owner_user_id", ownerUserId)
        .eq("contact_id", contactId)
        .neq("invitation_status", "revoked")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      : { data: null, error: null };
    if (!invitationRes.data && contactEmail) {
      invitationRes = await supabase
        .from("contact_invitations")
        .select("id,contact_id,contact_name,contact_email,assigned_role,invitation_status,invited_at,sent_at")
        .eq("owner_user_id", ownerUserId)
        .eq("contact_email", contactEmail)
        .in("invitation_status", ["pending", "accepted"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    }
    if (invitationRes.error || !invitationRes.data) return null;

    const row = invitationRes.data as Record<string, unknown>;
    const roleRes = await supabase
      .from("role_assignments")
      .select("activation_status,permissions_override")
      .eq("owner_user_id", ownerUserId)
      .eq("invitation_id", String(row.id ?? ""))
      .maybeSingle();
    const assignment = (roleRes.data ?? {}) as Record<string, unknown>;

    return {
      id: String(row.id ?? ""),
      contact_id: typeof row.contact_id === "string" ? row.contact_id : contactId,
      contact_name: String(row.contact_name ?? name),
      contact_email: String(row.contact_email ?? email),
      assigned_role: normalizeCollaboratorRole(row.assigned_role),
      invitation_status: normalizeInvitationStatus(row.invitation_status),
      activation_status: normalizeActivationStatus(assignment.activation_status),
      invited_at: String(row.invited_at ?? new Date().toISOString()),
      sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
      permissions_override: (assignment.permissions_override as Record<string, unknown> | null | undefined)
        ?? null,
      linked_context: [],
    };
  }

  return (
    <section
      style={panelStyle}
      aria-label="Contact invitation management"
    >
      {!guidedExecutor ? <div style={panelHeaderStyle}>
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
      </div> : null}

      {!isDashboardMode && guidedExecutor && !editingId && !draftContactId ? (
        recentInvitation ? (
          <RecentInvitationCard
            invitation={recentInvitation}
            onViewStatus={() => router.push(buildContactsWorkspaceHref(recentInvitation.contactId))}
            onAddAnother={() => {
              setRecentInvitation(null);
              resetEditor();
            }}
          />
        ) : <GuidedExecutorFlow
          step={guidedStep}
          name={name}
          email={email}
          phone={phone}
          role={role}
          roleOptions={roleOptions}
          allowedSections={allowedSections}
          sections={getVisibleAccessScopeOptions(preferences, role)}
          saving={saving}
          status={status}
          onNameChange={setName}
          onEmailChange={setEmail}
          onPhoneChange={setPhone}
          onRoleChange={setRole}
          onStepChange={setGuidedStep}
          onToggleSection={(section) => setAllowedSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section])}
          onSaveLater={() => void saveContact()}
          onSend={() => void saveContact({ sendAfterSave: true })}
          onCancel={resetEditor}
        />
      ) : null}

      {!isDashboardMode && currentEditingRow ? <InvitationStatusPanel row={currentEditingRow} /> : null}

      {!isDashboardMode && !guidedExecutor ? (
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
            <button
              type="button"
              style={walletAllButtonStyle}
              onClick={() => {
                const visibleSections = getVisibleAccessScopeOptions(preferences, role).map((option) => option.key);
                const allSelected = visibleSections.every((section) => allowedSections.includes(section));
                setAllowedSections(allSelected ? [] : visibleSections);
              }}
              title="Toggle every visible wallet category for this contact"
            >
              <Icon name="account_balance_wallet" size={16} />
              My wallet - all
            </button>
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={primaryBtnStyle}
              title={editingId ? "Save contact changes" : draftContactId ? "Save this contact setup" : "Add this contact"}
              disabled={saving}
              onClick={() => void saveContact()}
            >
              <Icon name={(editingId || draftContactId) ? "save" : "person_add"} size={16} />
              {saving ? "Saving..." : (editingId || draftContactId) ? "Save" : "Add contact"}
            </button>
            {!editingId && draftContactId && email.trim() ? (
              <button type="button" style={ghostBtnStyle} title="Save this contact and send the invite email" disabled={saving} onClick={() => void saveContact({ sendAfterSave: true })}>
                <Icon name="send" size={16} />
                {saving ? "Saving..." : "Send invite"}
              </button>
            ) : null}
          </div>

          {allowedSections.length ? (
            <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <span style={fieldLabelStyle}>Linked records and document permissions</span>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Each selected category expands into the actual visible record types and saved records in the vault. Every linked record starts on View, and Edit must be enabled explicitly record by record.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {getScopedResourceGroups(scopeItems, allowedSections, preferences).map((group) => (
                  <div key={group.key} style={resourceGroupStyle}>
                    <div style={{ display: "grid", gap: 2 }}>
                      <strong style={{ fontSize: 13, color: "#0f172a" }}>{group.label}</strong>
                      <span style={{ color: "#64748b", fontSize: 12 }}>{group.description}</span>
                    </div>
                    {group.items.length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {group.items.map((option) => {
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
                            <div key={`${group.key}-${option.sourceKind}:${option.sourceId}`} style={scopePermissionRowStyle}>
                              <div style={{ display: "grid", gap: 2 }}>
                                <span style={{ fontWeight: 600 }}>{option.label}</span>
                                <span style={{ color: "#64748b", fontSize: 12 }}>{option.meta}</span>
                              </div>
                              {href ? (
                                <Link href={href} style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}>
                                  Open record
                                </Link>
                              ) : null}
                              <div style={permissionToggleStyle} role="group" aria-label={`Permission for ${option.label}`}>
                                <button
                                  type="button"
                                  style={editable ? permissionOffButtonStyle : permissionOnButtonStyle}
                                  onClick={() => toggleScopedEditPermission(option, false, setEditableAssetIds, setEditableRecordIds)}
                                  title={`Keep ${option.label} on view access`}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  style={editable ? permissionOnButtonStyle : permissionOffButtonStyle}
                                  onClick={() => toggleScopedEditPermission(option, true, setEditableAssetIds, setEditableRecordIds)}
                                  title={`Allow edit access for ${option.label}`}
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        No saved records are visible here yet, but this resource type remains linked to the selected category.
                      </div>
                    )}
                  </div>
                ))}
                {getScopedResourceGroups(scopeItems, allowedSections, preferences).length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 12 }}>No visible record types are available yet in the selected categories.</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!editingId && draftContactId ? (
            <button type="button" style={dangerBtnStyle} title="Remove this contact and any linked invite access" disabled={saving} onClick={() => void removeSelectedDraftContact()}>
              <Icon name="delete" size={16} />
              Remove
            </button>
          ) : null}
          {(editingId || draftContactId) ? (
            <button
              type="button"
              style={ghostBtnStyle}
              title="Replace this contact while keeping the shared access setup"
              disabled={saving}
              onClick={() => {
                setEditingId(null);
                setDraftContactId(null);
                setName("");
                setEmail("");
                setStatus("Choose the replacement contact details, then save to reuse this access setup.");
              }}
            >
              <Icon name="swap_horiz" size={16} />
              Replace
            </button>
          ) : null}
          {editingId && currentEditingRow && canSendInvite(currentEditingRow) ? (
            <button type="button" style={ghostBtnStyle} title={`Send invite to ${currentEditingRow.contact_email}`} disabled={saving} onClick={() => void sendInvite(currentEditingRow, false)}>
              <Icon name="send" size={16} />
              Send invite
            </button>
          ) : null}
          {editingId && currentEditingRow && canResendInvite(currentEditingRow) ? (
            <button type="button" style={ghostBtnStyle} title={`Send invite again to ${currentEditingRow.contact_email}`} disabled={saving} onClick={() => void sendInvite(currentEditingRow, true)}>
              <Icon name="forward_to_inbox" size={16} />
              Resend invite
            </button>
          ) : null}
          {editingId && currentEditingRow ? (
            <button type="button" style={dangerBtnStyle} title={`Remove ${currentEditingRow.contact_name || currentEditingRow.contact_email}`} disabled={saving} onClick={() => void remove(currentEditingRow)}>
              <Icon name="delete" size={16} />
              Remove
            </button>
          ) : null}
          {editingId ? (
            <button
              type="button"
              style={ghostBtnStyle}
              title="Cancel contact changes"
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
              <Icon name="close" size={16} />
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {status && !guidedExecutor ? (
        <div style={statusAction ? planLimitStatusStyle : statusMessageStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name={status.startsWith("✅") ? "check_circle" : statusAction ? "error" : "info"} size={16} />
            <span>{status}</span>
          </div>
          {statusAction ? (
            <button
              type="button"
              style={planLimitCtaStyle}
              title={statusAction.detail}
              onClick={() => router.push(statusAction.href)}
            >
              <Icon name="open_in_new" size={16} />
              {statusAction.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {showInvitationQueue ? (
      <div style={sectionBlockStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h3 style={sectionTitleStyle}>Invitation queue</h3>
            <p style={sectionIntroStyle}>
              {isDashboardMode
                ? "Review invitation state here, send or resend invites, then open Contacts for contact edits and detailed access management."
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
                            canSendInvite(row) && !isRecentlySent(row.id) ? (
                              <button
                                type="button"
                                style={dashboardStatusActionStyle}
                                title={`Send invite to ${row.contact_email}`}
                                onClick={() => void sendInvite(row, false)}
                              >
                                <StatusIcon icon="send" tone="neutral" label={`Send invite to ${row.contact_email}`} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Send invite</span>
                              </button>
                            ) : (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <StatusIcon {...getInvitationStatusIcon(row, isRecentlySent(row.id))} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{getDashboardInvitationStatusLabel(row, isRecentlySent(row.id))}</span>
                              </div>
                            )
                          ) : (
                            <InvitationStatusBadge invitationStatus={row.invitation_status} activationStatus={row.activation_status} sentAt={row.sent_at} transientStatus={isRecentlySent(row.id) ? "sent" : null} />
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
                            <ActionIconButton
                              action="edit"
                              label={`Edit ${row.contact_name || row.contact_email} in Contacts`}
                              onClick={() => router.push(buildContactsWorkspaceHref(row.contact_id ?? ""))}
                            />
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
                      canSendInvite(row) && !isRecentlySent(row.id) ? (
                        <button
                          type="button"
                          style={dashboardStatusActionStyle}
                          title={`Send invite to ${row.contact_email}`}
                          onClick={() => void sendInvite(row, false)}
                        >
                          <StatusIcon icon="send" tone="neutral" label={`Send invite to ${row.contact_email}`} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Send invite</span>
                        </button>
                      ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <StatusIcon {...getInvitationStatusIcon(row, isRecentlySent(row.id))} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{getDashboardInvitationStatusLabel(row, isRecentlySent(row.id))}</span>
                        </div>
                      )
                    ) : (
                      <InvitationStatusBadge invitationStatus={row.invitation_status} activationStatus={row.activation_status} sentAt={row.sent_at} transientStatus={isRecentlySent(row.id) ? "sent" : null} />
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
                      <ActionIconButton
                        action="edit"
                        label={`Edit ${row.contact_name || row.contact_email} in Contacts`}
                        onClick={() => router.push(buildContactsWorkspaceHref(row.contact_id ?? ""))}
                      />
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
      ) : null}
    </section>
  );
}

function GuidedExecutorFlow({
  step,
  name,
  email,
  phone,
  role,
  roleOptions,
  allowedSections,
  sections,
  saving,
  status,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onRoleChange,
  onStepChange,
  onToggleSection,
  onSaveLater,
  onSend,
  onCancel,
}: {
  step: "person" | "role" | "access" | "review";
  name: string;
  email: string;
  phone: string;
  role: CollaboratorRole;
  roleOptions: Array<{ value: CollaboratorRole; label: string }>;
  allowedSections: SectionKey[];
  sections: Array<{ key: SectionKey; label: string }>;
  saving: boolean;
  status: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onRoleChange: (value: CollaboratorRole) => void;
  onStepChange: (step: "person" | "role" | "access" | "review") => void;
  onToggleSection: (section: SectionKey) => void;
  onSaveLater: () => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  const steps = ["Person", "Role", "Access", "Review and send"];
  const stepIndex = ["person", "role", "access", "review"].indexOf(step);
  const accessLabel = (key: SectionKey) => ({
    financial: "Financial information",
    legal: "Legal documents",
    property: "Property",
    business: "Business",
    digital: "Digital assets",
    personal: "Personal wishes",
    profile: "Profile",
  } as Record<string, string>)[key];

  function continueFromPerson() {
    if (!name.trim() || !email.trim()) return;
    onStepChange("role");
  }

  return (
    <div className="lf-executor-invite-flow" style={guidedFlowStyle} aria-label="Invite an Executor">
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <p style={eyebrowStyle}>Executor invitation</p>
            <h3 style={{ margin: 0, color: "#0f172a", fontSize: 22 }}>Invite an Executor</h3>
          </div>
          <button type="button" style={guidedSecondaryButtonStyle} onClick={onCancel}>Cancel</button>
        </div>
        <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
          Set up the person first, then choose a role and the information they may eventually be able to view.
        </p>
        {status ? <div style={statusMessageStyle} role="status">{status}</div> : null}
      </div>

      <ol style={stepperStyle} aria-label="Invitation steps">
        {steps.map((label, index) => (
          <li key={label} style={index === stepIndex ? activeStepStyle : completedStepStyle}>
            <span style={stepNumberStyle}>{index + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {step === "person" ? (
        <div style={guidedFormGridStyle}>
          <label style={guidedFieldStyle}>
            <span style={guidedLabelStyle}>Name</span>
            <input autoFocus value={name} onChange={(event) => onNameChange(event.target.value)} style={guidedInputStyle} placeholder="Full name" />
          </label>
          <label style={guidedFieldStyle}>
            <span style={guidedLabelStyle}>Email</span>
            <input value={email} onChange={(event) => onEmailChange(event.target.value)} style={guidedInputStyle} type="email" placeholder="name@example.com" />
          </label>
          <label style={guidedFieldStyle}>
            <span style={guidedLabelStyle}>Phone number <span style={{ color: "#64748b", fontWeight: 400 }}>(optional)</span></span>
            <input value={phone} onChange={(event) => onPhoneChange(event.target.value)} style={guidedInputStyle} type="tel" placeholder="Phone number" aria-describedby="executor-phone-help" />
            <span id="executor-phone-help" style={guidedHelpStyle}>You can add this later in contact details.</span>
          </label>
          <div style={guidedActionBarStyle}>
            <span style={guidedHelpStyle}>A valid name and email are needed to continue.</span>
            <button type="button" style={guidedPrimaryButtonStyle} onClick={continueFromPerson} disabled={!name.trim() || !email.trim()}>Continue</button>
          </div>
        </div>
      ) : null}

      {step === "role" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <p style={guidedLabelStyle}>Role</p>
            <div role="radiogroup" aria-label="Choose a role" style={{ display: "grid", gap: 10 }}>
              {roleOptions.map((option) => {
                const selected = role === option.value;
                return (
                  <label key={option.value} style={selected ? selectedRoleCardStyle : roleCardStyle}>
                    <input type="radio" name="executor-invite-role" checked={selected} onChange={() => onRoleChange(option.value)} />
                    <span style={{ display: "grid", gap: 4 }}>
                      <strong>{option.label}</strong>
                      <span style={guidedHelpStyle}>{getRoleDescription(option.value)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p style={guidedNoticeStyle}>Naming an Executor does not itself create legal authority or give immediate access to protected records.</p>
          </div>
          <div style={guidedActionBarStyle}>
            <button type="button" style={guidedSecondaryButtonStyle} onClick={() => onStepChange("person")}>Back</button>
            <button type="button" style={guidedPrimaryButtonStyle} onClick={() => onStepChange("access")}>Continue</button>
          </div>
        </div>
      ) : null}

      {step === "access" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <p style={guidedLabelStyle}>Information this person may eventually be able to VIEW</p>
            <p style={{ margin: "4px 0 12px", color: "#475569", fontSize: 14 }}>
              These choices describe what this person may eventually be allowed to view. Access remains subject to your instructions, their accepted role and estate-access controls.
            </p>
            <div style={categoryGridStyle}>
              {sections.map((section) => {
                const checked = allowedSections.includes(section.key);
                return (
                  <label key={section.key} style={checked ? selectedCategoryStyle : categoryStyle}>
                    <input type="checkbox" checked={checked} onChange={() => onToggleSection(section.key)} />
                    <span>{accessLabel(section.key) || section.label}</span>
                  </label>
                );
              })}
            </div>
            <details style={customizeDetailsStyle}>
              <summary>Customize access</summary>
              <p style={guidedHelpStyle}>Detailed record permissions can be managed after this invitation is saved. Selected categories start as view only; edit access is never granted automatically.</p>
            </details>
          </div>
          <div style={guidedActionBarStyle}>
            <button type="button" style={guidedSecondaryButtonStyle} onClick={() => onStepChange("role")}>Back</button>
            <button type="button" style={guidedPrimaryButtonStyle} onClick={() => onStepChange("review")}>Review invitation</button>
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={reviewSummaryStyle}>
            <strong>Invite {name || "this person"} as your Executor</strong>
            <div><span style={reviewLabelStyle}>Person</span>{name} · {email}</div>
            <div><span style={reviewLabelStyle}>Role</span>Executor</div>
            <div><span style={reviewLabelStyle}>Access selected</span>{allowedSections.length ? allowedSections.map((section) => `${accessLabel(section)} — View only`).join(", ") : "No categories selected yet"}</div>
          </div>
          <p style={guidedNoticeStyle}>They will receive an invitation to create or sign in to Legacy Fortress and accept the Executor role. Identity verification will be required before protected access can be considered. Sending an invitation does not establish legal authority or guarantee access.</p>
          <div style={guidedActionBarStyle}>
            <button type="button" style={guidedSecondaryButtonStyle} onClick={() => onStepChange("access")} disabled={saving}>Back</button>
            <button type="button" style={guidedSecondaryButtonStyle} onClick={onSaveLater} disabled={saving}>{saving ? "Saving..." : "Save and send later"}</button>
            <button type="button" style={guidedPrimaryButtonStyle} onClick={onSend} disabled={saving}>{saving ? "Sending..." : "Send invitation"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecentInvitationCard({
  invitation,
  onViewStatus,
  onAddAnother,
}: {
  invitation: RecentInvitation;
  onViewStatus: () => void;
  onAddAnother: () => void;
}) {
  const sent = invitation.outcome === "sent";
  return (
    <div style={recentInvitationStyle} role="status" aria-live="polite">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Icon name={sent ? "mark_email_read" : "schedule"} size={24} />
        <div style={{ display: "grid", gap: 5 }}>
          <strong style={{ fontSize: 19 }}>{sent ? "Invitation sent" : "Invitation prepared"}</strong>
          <span style={{ fontSize: 14 }}>
            {sent
              ? `We've sent an invitation to ${invitation.name} to become your Executor.`
              : `${invitation.name} is ready to invite. The invitation has not been sent.`}
          </span>
          <span style={guidedHelpStyle}>
            {sent ? "We'll show you here when they accept and complete identity verification." : "Send it later from the invitation status actions."}
          </span>
        </div>
      </div>
      <div style={guidedActionBarStyle}>
        <button type="button" style={guidedSecondaryButtonStyle} onClick={onAddAnother}>Add another person</button>
        {invitation.contactId ? <button type="button" style={guidedPrimaryButtonStyle} onClick={onViewStatus}>View status</button> : null}
      </div>
    </div>
  );
}

function InvitationStatusPanel({ row }: { row: InvitationRow }) {
  const accepted = row.invitation_status === "accepted"
    || ["accepted", "pending_verification", "verification_submitted", "verified", "active"].includes(row.activation_status);
  const identityState = row.activation_status === "verified" || row.activation_status === "active"
    ? "Verified"
    : row.activation_status === "pending_verification" || row.activation_status === "verification_submitted"
      ? "Required"
      : "Not started";
  const accessState = row.activation_status === "active" ? "Active" : row.activation_status === "revoked" ? "Revoked" : "Not currently available";
  const steps = [
    { label: "Invitation prepared", complete: Boolean(row.invited_at), detail: row.invited_at },
    { label: "Invitation sent", complete: Boolean(row.sent_at), detail: row.sent_at },
    { label: "Invitation opened", complete: false, detail: "Not recorded" },
    { label: "Role accepted", complete: accepted, detail: accepted ? "Accepted" : "Pending" },
    { label: "Identity verification", complete: identityState === "Verified", detail: identityState },
    { label: "Authority / access", complete: accessState === "Active", detail: accessState },
  ];

  return (
    <section style={statusPanelStyle} aria-label="Invitation and role status">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <p style={eyebrowStyle}>Role status</p>
          <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{row.contact_name}</h3>
        </div>
        <span style={statusPanelRoleStyle}>{ROLE_RULES[row.assigned_role].label}</span>
      </div>
      <div style={statusPanelGridStyle}>
        {steps.map((step) => (
          <div key={step.label} style={statusPanelStepStyle}>
            <span aria-hidden="true" style={step.complete ? statusCheckStyle : statusPendingStyle}>{step.complete ? "✓" : "○"}</span>
            <span style={{ display: "grid", gap: 2 }}>
              <strong style={{ fontSize: 13 }}>{step.label}</strong>
              <span style={guidedHelpStyle}>{step.detail ? (step.detail === "Not recorded" ? step.detail : formatShortDateTime(step.detail)) : "Pending"}</span>
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>
        Role, identity, authority and access are separate decisions. Identity verification does not establish legal authority or guarantee access.
      </p>
    </section>
  );
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

function formatShortDateTime(input: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(input));
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

function notifyContactsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("lf:contacts-updated"));
}

function getInvitationStatusIcon(row: InvitationRow, recentlySent = false) {
  if (recentlySent) return { icon: "mark_email_read", tone: "neutral" as const, label: "Sent" };
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

function getRoleDescription(role: CollaboratorRole) {
  const descriptions: Partial<Record<CollaboratorRole, string>> = {
    executor: "Someone you have chosen to help deal with your estate after your death.",
    trustee: "Someone appointed to help administer a trust under the relevant arrangements.",
    accountant: "A financial professional who may review the information you choose to share.",
    lawyer: "A legal professional who may review the legal information you choose to share.",
    power_of_attorney: "A person appointed to act for you where the relevant authority permits it.",
    friend_or_family: "Someone you trust to help with practical matters and important records.",
    professional_advisor: "A professional adviser who may review the information you choose to share.",
  };
  return descriptions[role] ?? "A person with a defined role in the information you choose to share.";
}

function loadPermissionsOverride(row: InvitationRow) {
  return normalizeContactPermissionsOverride(row.permissions_override);
}

function getDashboardInvitationStatusLabel(row: InvitationRow, recentlySent = false) {
  if (recentlySent) return "Sent";
  const label = resolveInvitationBadgeState(row.invitation_status, row.activation_status, row.sent_at).label;
  return label === "Ready to send" ? "Send invite" : label;
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

function getScopedResourceGroups(
  items: ScopeItem[],
  sections: SectionKey[],
  preferences: ReturnType<typeof useVaultPreferences>["preferences"],
): ScopedResourceGroup[] {
  const scopedItems = getScopedItemsForSections(items, sections);
  const grouped = new Map<string, ScopedResourceGroup>();

  for (const section of sections) {
    const groupKey = mapSectionToVaultGroup(section);
    if (groupKey && !isVaultCategoryEnabled(preferences, groupKey)) continue;

    const sectionItems = scopedItems.filter((item) => item.sectionKey === section);
    const subsectionDefinitions = groupKey ? getVaultSubsectionsForGroup(groupKey) : [];

    if (subsectionDefinitions.length > 0) {
      for (const subsection of subsectionDefinitions) {
        if (!isVaultSubsectionEnabled(preferences, subsection.key)) continue;
        const subsectionItems = sectionItems.filter(
          (item) => mapSectionCategoryToVaultSubsection(item.sectionKey, item.categoryKey) === subsection.key,
        );
        grouped.set(subsection.key, {
          key: subsection.key,
          label: subsection.label,
          description: subsection.description,
          items: subsectionItems,
        });
      }
      continue;
    }

    grouped.set(section, {
      key: section,
      label: ACCESS_SCOPE_OPTIONS.find((option) => option.key === section)?.label ?? section,
      description: "Visible records in this category can be shared here and upgraded to edit only where needed.",
      items: sectionItems,
    });
  }

  return Array.from(grouped.values());
}

function mapSectionToVaultGroup(sectionKey: SectionKey): VaultCategoryGroupKey | null {
  switch (sectionKey) {
    case "financial":
      return "finances";
    case "legal":
      return "legal";
    case "property":
      return "property";
    case "business":
      return "business";
    case "personal":
      return "personal";
    case "digital":
      return "digital";
    default:
      return null;
  }
}

function mapSectionCategoryToVaultSubsection(sectionKey: SectionKey, categoryKey: string | null): ReturnType<typeof getVaultSubsectionsForGroup>[number]["key"] | null {
  const normalizedCategory = String(categoryKey ?? "").trim().toLowerCase();

  if (sectionKey === "financial") {
    if (normalizedCategory === "bank") return "finances_bank";
    if (normalizedCategory === "pensions") return "finances_pensions";
    if (normalizedCategory === "investments") return "finances_investments";
    if (normalizedCategory === "insurance") return "finances_insurance";
    if (normalizedCategory === "debts") return "finances_debts";
  }

  if (sectionKey === "legal") {
    if (normalizedCategory === "wills") return "legal_wills";
    if (normalizedCategory === "trusts") return "legal_trusts";
    if (normalizedCategory === "power-of-attorney") return "legal_power_of_attorney";
    if (normalizedCategory === "funeral-wishes") return "legal_funeral_wishes";
    if (normalizedCategory === "marriage-divorce-documents") return "legal_marriage_divorce_documents";
    if (normalizedCategory === "identity-documents") return "legal_identity_documents";
    if (normalizedCategory === "other-legal-documents") return "legal_other_legal_documents";
    if (normalizedCategory === "death-certificate") return "legal_death_certificate";
  }

  if (sectionKey === "personal") {
    if (normalizedCategory === "possessions") return "personal_possessions";
    if (normalizedCategory === "subscriptions") return "personal_subscriptions";
    if (normalizedCategory === "social-media") return "personal_social_media";
    if (normalizedCategory === "wishes") return "personal_wishes";
  }

  if (sectionKey === "property") {
    if (normalizedCategory === "property-documents" || normalizedCategory === "documents") return "property_documents";
    return "property_records";
  }

  if (sectionKey === "business") {
    if (normalizedCategory === "employment") return "business_employment";
    return "business_interests";
  }

  return null;
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

function mapScopeSourceRow(row: Record<string, unknown>): ScopeItem | null {
  const sectionKey = normalizeSectionKey(row.section_key);
  const sourceId = String(row.id ?? "").trim();
  if (!sectionKey || !sourceId) return null;
  const sourceKind = row.source_kind === "asset" ? "asset" : "record";
  const fallbackLabel = sourceKind === "asset" ? row.provider_name : row.summary;
  return {
    sourceKind,
    sourceId,
    sectionKey,
    categoryKey: String(row.category_key ?? "").trim() || null,
    label: String(row.title ?? fallbackLabel ?? "Untitled record").trim() || "Untitled record",
    meta: [String(row.category_key ?? "").trim(), sourceKind === "asset" ? "Canonical record" : "Workspace record"].filter(Boolean).join(" · "),
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

function normalizeCollaboratorRole(value: unknown): CollaboratorRole {
  const normalized = String(value ?? "").trim();
  if (normalized && normalized in ROLE_RULES && normalized !== "owner") {
    return normalized as CollaboratorRole;
  }
  return "professional_advisor";
}

function normalizeInvitationStatus(value: unknown): InvitationStatus {
  const normalized = String(value ?? "").trim();
  if (normalized === "accepted" || normalized === "rejected" || normalized === "failed" || normalized === "revoked") return normalized;
  return "pending";
}

function normalizeActivationStatus(value: unknown): AccessActivationStatus {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "accepted"
    || normalized === "pending_verification"
    || normalized === "verification_submitted"
    || normalized === "verified"
    || normalized === "active"
    || normalized === "rejected"
    || normalized === "revoked"
  ) {
    return normalized;
  }
  return "invited";
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

const guidedFlowStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#ffffff",
  padding: 18,
  display: "grid",
  gap: 18,
};
const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const stepperStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};
const activeStepStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 12,
  borderBottom: "2px solid #0f172a",
  padding: "7px 2px",
};
const completedStepStyle: CSSProperties = { ...activeStepStyle, color: "#64748b", fontWeight: 500, borderBottomColor: "#e2e8f0" };
const stepNumberStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f1f5f9",
  border: "1px solid #cbd5e1",
  flex: "0 0 auto",
};
const guidedFormGridStyle: CSSProperties = { display: "grid", gap: 14, maxWidth: 620 };
const guidedFieldStyle: CSSProperties = { display: "grid", gap: 6 };
const guidedLabelStyle: CSSProperties = { color: "#334155", fontSize: 13, fontWeight: 700 };
const guidedInputStyle: CSSProperties = { width: "100%", minHeight: 44, boxSizing: "border-box", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" };
const guidedHelpStyle: CSSProperties = { color: "#64748b", fontSize: 13, lineHeight: 1.45 };
const guidedActionBarStyle: CSSProperties = { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 };
const guidedPrimaryButtonStyle: CSSProperties = { border: "1px solid #111827", background: "#111827", color: "#fff", borderRadius: 8, minHeight: 44, padding: "10px 16px", fontWeight: 700, cursor: "pointer" };
const guidedSecondaryButtonStyle: CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 8, minHeight: 44, padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const roleCardStyle: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, padding: 14, border: "2px solid #0f172a", borderRadius: 10, background: "#f8fafc", cursor: "default" };
const selectedRoleCardStyle: CSSProperties = { ...roleCardStyle, background: "#e2e8f0" };
const guidedNoticeStyle: CSSProperties = { margin: 0, padding: 12, borderLeft: "3px solid #64748b", background: "#f8fafc", color: "#475569", fontSize: 13, lineHeight: 1.5 };
const categoryGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 };
const categoryStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#0f172a", cursor: "pointer" };
const selectedCategoryStyle: CSSProperties = { ...categoryStyle, borderColor: "#0f172a", background: "#f1f5f9", fontWeight: 700 };
const customizeDetailsStyle: CSSProperties = { marginTop: 14, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, color: "#334155" };
const reviewSummaryStyle: CSSProperties = { display: "grid", gap: 10, padding: 14, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#0f172a" };
const reviewLabelStyle: CSSProperties = { display: "inline-block", minWidth: 120, color: "#64748b", fontSize: 12, fontWeight: 700 };
const recentInvitationStyle: CSSProperties = { border: "1px solid #86efac", borderRadius: 12, background: "#f0fdf4", color: "#166534", padding: 18, display: "grid", gap: 16 };
const statusPanelStyle: CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", padding: 14, display: "grid", gap: 14 };
const statusPanelRoleStyle: CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 999, padding: "5px 9px", color: "#334155", fontSize: 12, fontWeight: 700 };
const statusPanelGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 };
const statusPanelStepStyle: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 8, padding: 9, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" };
const statusCheckStyle: CSSProperties = { color: "#166534", fontWeight: 800, fontSize: 17 };
const statusPendingStyle: CSSProperties = { color: "#64748b", fontWeight: 800, fontSize: 17 };

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
const walletAllButtonStyle: CSSProperties = {
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  borderRadius: 999,
  padding: "8px 11px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  width: "fit-content",
};
const inlineActionPanelStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
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
const resourceGroupStyle: CSSProperties = {
  border: "1px solid #dbe3eb",
  borderRadius: 14,
  background: "#f8fafc",
  padding: 12,
  display: "grid",
  gap: 10,
};
const dashboardStatusActionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#fff",
  color: "#0f172a",
  padding: "6px 10px",
  cursor: "pointer",
};
const statusMessageStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#475569",
  fontSize: 13,
  flexWrap: "wrap",
};
const planLimitStatusStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  color: "#991b1b",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
};
const planLimitCtaStyle: CSSProperties = {
  border: "1px solid #b91c1c",
  background: "#fff",
  color: "#991b1b",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};
const thStyle: CSSProperties = { padding: "8px 6px", fontSize: 12, color: "#64748b", fontWeight: 600 };
const tdStyle: CSSProperties = { padding: "10px 6px", verticalAlign: "top" };
