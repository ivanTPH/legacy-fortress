"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ROLE_RULES,
  type AccessActivationStatus,
  type CollaboratorRole,
} from "../../../../lib/access-control/roles";
import { supabase } from "../../../../lib/supabaseClient";
import InvitationStatusBadge, { type InvitationStatus } from "./InvitationStatusBadge";
import RoleBadge from "./RoleBadge";

type InvitationRow = {
  id: string;
  contact_name: string;
  contact_email: string;
  assigned_role: CollaboratorRole;
  invitation_status: InvitationStatus;
  activation_status: AccessActivationStatus;
  invited_at: string;
  sent_at: string | null;
};

type RoleAssignmentRow = {
  invitation_id: string;
  assigned_role: CollaboratorRole;
  activation_status: AccessActivationStatus;
};

const editableStatuses: InvitationStatus[] = ["pending", "accepted", "rejected"];

export default function ContactInvitationManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<InvitationRow[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("professional_advisor");

  const [editingId, setEditingId] = useState<string | null>(null);

  const roleOptions = useMemo(
    () =>
      (Object.keys(ROLE_RULES) as CollaboratorRole[])
        .filter((key) => key !== "owner")
        .map((key) => ({ value: key, label: ROLE_RULES[key].label })),
    [],
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setStatus("");

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const userId = userData.user.id;

    const [invRes, roleRes] = await Promise.all([
      supabase
        .from("contact_invitations")
        .select("id,contact_name,contact_email,assigned_role,invitation_status,invited_at,sent_at")
        .eq("owner_user_id", userId)
        .order("invited_at", { ascending: false }),
      supabase
        .from("role_assignments")
        .select("invitation_id,assigned_role,activation_status")
        .eq("owner_user_id", userId),
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

    const mapped = ((invRes.data ?? []) as Array<{
      id: string;
      contact_name: string | null;
      contact_email: string | null;
      assigned_role: CollaboratorRole | null;
      invitation_status: InvitationStatus | null;
      invited_at: string;
      sent_at: string | null;
    }>).map((row) => {
      const assignment = roleMap.get(row.id);
      return {
        id: row.id,
        contact_name: row.contact_name ?? "",
        contact_email: row.contact_email ?? "",
        assigned_role: assignment?.assigned_role ?? row.assigned_role ?? "professional_advisor",
        invitation_status: row.invitation_status ?? "pending",
        activation_status: assignment?.activation_status ?? "invited",
        invited_at: row.invited_at,
        sent_at: row.sent_at,
      };
    });

    setRows(mapped);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function saveContact() {
    setSaving(true);
    setStatus("");

    try {
      const nameTrim = name.trim();
      const emailTrim = email.trim().toLowerCase();
      if (!nameTrim || !emailTrim) {
        setStatus("❌ Contact name and email are required.");
        return;
      }

      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) {
        router.replace("/signin");
        return;
      }

      const userId = userData.user.id;
      const now = new Date().toISOString();

      if (editingId) {
        const updateRes = await supabase
          .from("contact_invitations")
          .update({ contact_name: nameTrim, contact_email: emailTrim, assigned_role: role, updated_at: now })
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
              updated_at: now,
            },
            { onConflict: "invitation_id" },
          );

        if (assignRes.error) throw assignRes.error;
      } else {
        const insertRes = await supabase
          .from("contact_invitations")
          .insert({
            owner_user_id: userId,
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
          updated_at: now,
        });

        if (assignRes.error) throw assignRes.error;
      }

      setEditingId(null);
      setName("");
      setEmail("");
      setRole("professional_advisor");
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
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256(token);
    const now = new Date().toISOString();

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

    const { error: eventError } = await supabase.from("invitation_events").insert({
      owner_user_id: userData.user.id,
      invitation_id: row.id,
      event_type: resend ? "resent" : "sent",
      payload: { contact_email: row.contact_email, token_hint: token.slice(-6) },
    });

    if (eventError) {
      setStatus(`⚠️ Invite updated but event log failed: ${eventError.message}`);
    } else {
      setStatus(`✅ Invitation ${resend ? "resent" : "sent"}.`);
    }

    await loadRows();
  }

  function startEdit(row: InvitationRow) {
    setEditingId(row.id);
    setName(row.contact_name);
    setEmail(row.contact_email);
    setRole(row.assigned_role);
  }

  async function remove(row: InvitationRow) {
    setStatus("");
    const ok = window.confirm(`Delete ${row.contact_name || row.contact_email}?`);
    if (!ok) return;

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const now = new Date().toISOString();

    const [inv, roleAssign] = await Promise.all([
      supabase
        .from("contact_invitations")
        .update({ invitation_status: "revoked", revoked_at: now, updated_at: now })
        .eq("id", row.id)
        .eq("owner_user_id", userData.user.id),
      supabase
        .from("role_assignments")
        .update({ activation_status: "revoked", updated_at: now })
        .eq("invitation_id", row.id)
        .eq("owner_user_id", userData.user.id),
    ]);

    if (inv.error || roleAssign.error) {
      setStatus(`❌ Could not revoke contact: ${inv.error?.message || roleAssign.error?.message}`);
      return;
    }

    setStatus("✅ Contact revoked.");
    await loadRows();
  }

  async function updateStatus(row: InvitationRow, nextStatus: InvitationStatus) {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const now = new Date().toISOString();
    const patch: Record<string, string> = { invitation_status: nextStatus, updated_at: now };
    if (nextStatus === "accepted") patch.accepted_at = now;
    if (nextStatus === "rejected") patch.rejected_at = now;

    const { error } = await supabase
      .from("contact_invitations")
      .update(patch)
      .eq("id", row.id)
      .eq("owner_user_id", userData.user.id);

    if (error) {
      setStatus(`❌ Status update failed: ${error.message}`);
      return;
    }

    const activationStatus: AccessActivationStatus =
      nextStatus === "accepted" ? "accepted" : nextStatus === "rejected" ? "rejected" : "invited";

    await supabase
      .from("role_assignments")
      .update({ activation_status: activationStatus, updated_at: now })
      .eq("invitation_id", row.id)
      .eq("owner_user_id", userData.user.id);

    await loadRows();
  }

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#fff",
        padding: 14,
        display: "grid",
        gap: 12,
      }}
      aria-label="Contact invitation management"
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 18 }}>Contacts, invitations and roles</h2>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
          Invite trusted contacts, assign roles, and track invitation and activation status.
        </p>
      </div>

      <div className="lf-content-grid">
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} type="email" />
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
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={primaryBtnStyle} disabled={saving} onClick={() => void saveContact()}>
          {saving ? "Saving..." : editingId ? "Update contact" : "Add contact"}
        </button>
        {editingId ? (
          <button
            type="button"
            style={ghostBtnStyle}
            onClick={() => {
              setEditingId(null);
              setName("");
              setEmail("");
              setRole("professional_advisor");
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}

      {loading ? (
        <div style={{ color: "#6b7280" }}>Loading invitations...</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "#6b7280" }}>No contacts invited yet.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={thStyle}>Contact</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Invited</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{row.contact_name}</div>
                    <div style={{ color: "#6b7280" }}>{row.contact_email}</div>
                  </td>
                  <td style={tdStyle}>
                    <RoleBadge role={row.assigned_role} />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <InvitationStatusBadge invitationStatus={row.invitation_status} activationStatus={row.activation_status} />
                      <select
                        value={row.invitation_status}
                        onChange={(e) => void updateStatus(row, e.target.value as InvitationStatus)}
                        style={miniSelectStyle}
                        aria-label={`Update status for ${row.contact_name}`}
                      >
                        {editableStatuses.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td style={tdStyle}>{formatDateTime(row.sent_at ?? row.invited_at)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" style={miniBtnStyle} onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button type="button" style={miniBtnStyle} onClick={() => void remove(row)}>
                        Delete
                      </button>
                      <button type="button" style={miniBtnStyle} onClick={() => void sendInvite(row, Boolean(row.sent_at))}>
                        {row.sent_at ? "Resend" : "Send"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatDateTime(input: string) {
  try {
    return new Date(input).toLocaleString();
  } catch {
    return input;
  }
}

const fieldStyle: CSSProperties = { display: "grid", gap: 6 };
const fieldLabelStyle: CSSProperties = { fontSize: 12, color: "#374151" };
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
const ghostBtnStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  cursor: "pointer",
};
const thStyle: CSSProperties = { padding: "8px 6px", fontSize: 12, color: "#64748b", fontWeight: 600 };
const tdStyle: CSSProperties = { padding: "10px 6px", verticalAlign: "top" };
const miniBtnStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 8,
  padding: "5px 8px",
  fontSize: 12,
  cursor: "pointer",
};
const miniSelectStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "4px 6px",
  fontSize: 12,
  background: "#fff",
};
