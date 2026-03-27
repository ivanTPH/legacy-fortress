"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";
import { supabase } from "../../../../lib/supabaseClient";
import { getSafeUserData } from "../../../../lib/auth/requireActiveUser";
import { sanitizeFileName, validateUploadFile } from "../../../../lib/validation/upload";

type Assignment = {
  id: string;
  assigned_role: string;
  activation_status: string;
  invitation_id: string;
};

type VerificationRow = {
  id: string;
  request_type: string;
  request_status: string;
  evidence_document_path: string | null;
  submitted_at: string;
};

export default function DeathCertificatePage() {
  const router = useRouter();
  const { viewer } = useViewerAccess();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [requests, setRequests] = useState<VerificationRow[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }
      const ownerUserId = viewer.targetOwnerUserId || userData.user.id;

      const [assignmentRes, requestRes] = await Promise.all([
        supabase
          .from("role_assignments")
          .select("id,assigned_role,activation_status,invitation_id")
          .eq("owner_user_id", ownerUserId)
          .in("assigned_role", ["executor", "power_of_attorney"])
          .order("created_at", { ascending: false }),
        supabase
          .from("verification_requests")
          .select("id,request_type,request_status,evidence_document_path,submitted_at")
          .eq("owner_user_id", ownerUserId)
          .order("submitted_at", { ascending: false }),
      ]);

      if (!mounted) return;

      setAssignments((assignmentRes.data ?? []) as Assignment[]);
      setRequests((requestRes.data ?? []) as VerificationRow[]);

      const first = (assignmentRes.data ?? [])[0] as Assignment | undefined;
      if (first) setSelectedAssignment(first.id);
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router, viewer.targetOwnerUserId]);

  async function submitEvidence(file: File) {
    const validation = validateUploadFile(file, {
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: 10 * 1024 * 1024,
    });
    if (!validation.ok) {
      setStatus(`❌ ${validation.error}. Allowed: PDF, JPG, PNG up to 10MB.`);
      return;
    }
    if (!selectedAssignment) {
      setStatus("❌ Select an executor or power-of-attorney assignment first.");
      return;
    }
    if (viewer.readOnly) {
      setStatus("❌ Linked access is view-only. Death certificate verification cannot be submitted from this account.");
      return;
    }

    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/sign-in");
      return;
    }

    setUploading(true);
    setStatus("");
    const path = `${userData.user.id}/verification/${Date.now()}-${sanitizeFileName(file.name)}`;
    const upload = await supabase.storage.from("vault-docs").upload(path, file, { upsert: false });
    if (upload.error) {
      setStatus(`❌ Upload failed: ${upload.error.message}`);
      setUploading(false);
      return;
    }

    const { error } = await supabase.from("verification_requests").insert({
      owner_user_id: userData.user.id,
      role_assignment_id: selectedAssignment,
      request_type: "death_certificate",
      request_status: "submitted",
      evidence_document_path: path,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setUploading(false);
    if (error) {
      setStatus(`❌ Request save failed: ${error.message}`);
      return;
    }

    setStatus("✅ Verification request submitted.");
    const refresh = await supabase
      .from("verification_requests")
      .select("id,request_type,request_status,evidence_document_path,submitted_at")
      .eq("owner_user_id", userData.user.id)
      .order("submitted_at", { ascending: false });
    setRequests((refresh.data ?? []) as VerificationRow[]);
  }

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Death Certificate Verification</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Submit verification evidence to activate executor access after manual review.
        </p>
      </div>

      {status ? <div style={{ color: "#64748b", fontSize: 13 }}>{status}</div> : null}

      <section style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Submit evidence</h2>
        {loading ? <div style={{ color: "#64748b" }}>Loading...</div> : null}
        {!loading && viewer.readOnly ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>
            This linked account is view-only. You can review verification status here, but only the account owner can submit or replace evidence from this workspace today.
          </div>
        ) : null}
        {!loading && assignments.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>
            No executor or power-of-attorney role assignments found. Add invitees from Dashboard first.
          </div>
        ) : null}

        {!loading && assignments.length > 0 && !viewer.readOnly ? (
          <>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>Role assignment</span>
              <select value={selectedAssignment} onChange={(e) => setSelectedAssignment(e.target.value)} style={inputStyle}>
                {assignments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.assigned_role.replace(/_/g, " ")} · {item.activation_status.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label style={buttonLabelStyle}>
              {uploading ? "Uploading..." : "Upload death certificate evidence"}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                style={{ display: "none" }}
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void submitEvidence(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </>
        ) : null}
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Submitted requests</h2>
        {requests.length === 0 ? <div style={{ color: "#64748b" }}>No verification requests submitted yet.</div> : null}
        <div style={{ display: "grid", gap: 8 }}>
          {requests.map((item) => (
            <article key={item.id} style={rowStyle}>
              <div style={{ fontWeight: 700 }}>{item.request_type.replace(/_/g, " ")}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Status: {item.request_status.replace(/_/g, " ")} · Submitted {new Date(item.submitted_at).toLocaleString()}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const rowStyle: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 12,
  padding: 10,
  display: "grid",
  gap: 4,
};

const inputStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "9px 10px",
  width: "100%",
  fontSize: 14,
};

const buttonLabelStyle: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
};
