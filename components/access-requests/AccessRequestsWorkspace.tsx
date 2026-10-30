"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useViewerAccess } from "../access/ViewerAccessContext";
import { supabase } from "../../lib/supabaseClient";
import { getSafeUserData } from "../../lib/auth/requireActiveUser";
import { sanitizeFileName, validateUploadFile } from "../../lib/validation/upload";
import Icon from "../ui/Icon";
import { Banner, Button, EmptyState, Sheet } from "../ui/V3Primitives";

type Assignment = {
  id: string;
  assigned_role: string;
  activation_status: string;
  invitation_id: string;
};

type InvitationLookup = {
  id: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
};

type ContactLookup = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type VerificationRow = {
  id: string;
  owner_user_id?: string;
  role_assignment_id: string | null;
  request_type: string;
  request_status: string;
  evidence_document_path: string | null;
  submitted_at: string;
  review_notes?: string | null;
  requester_name?: string;
  requester_email?: string;
  assigned_role?: string;
  contact_id?: string | null;
};

type OwnerDecision = "approved" | "rejected";

async function hydrateRequesters(rows: VerificationRow[], knownAssignments: Assignment[]) {
  const roleIds = Array.from(new Set([
    ...rows.map((row) => row.role_assignment_id).filter(Boolean),
    ...knownAssignments.map((row) => row.id),
  ])) as string[];
  if (roleIds.length === 0) return rows;

  const roleRes = await supabase
    .from("role_assignments")
    .select("id,invitation_id,assigned_role,activation_status")
    .in("id", roleIds);
  const roleRows = ((roleRes.data ?? []) as Assignment[]);
  const roleMap = new Map(roleRows.map((row) => [row.id, row]));

  const invitationIds = Array.from(new Set(roleRows.map((row) => row.invitation_id).filter(Boolean)));
  const invitationRes = invitationIds.length
    ? await supabase
        .from("contact_invitations")
        .select("id,contact_id,contact_name,contact_email")
        .in("id", invitationIds)
    : { data: [], error: null };
  const invitations = (invitationRes.data ?? []) as InvitationLookup[];
  const invitationMap = new Map(invitations.map((row) => [row.id, row]));

  const contactIds = Array.from(new Set(invitations.map((row) => row.contact_id).filter(Boolean))) as string[];
  const contactRes = contactIds.length
    ? await supabase.from("contacts").select("id,full_name,email").in("id", contactIds)
    : { data: [], error: null };
  const contactMap = new Map(((contactRes.data ?? []) as ContactLookup[]).map((row) => [row.id, row]));

  return rows.map((row) => {
    const role = row.role_assignment_id ? roleMap.get(row.role_assignment_id) : null;
    const invitation = role?.invitation_id ? invitationMap.get(role.invitation_id) : null;
    const contact = invitation?.contact_id ? contactMap.get(invitation.contact_id) : null;
    return {
      ...row,
      requester_name: contact?.full_name || invitation?.contact_name || "Unknown requester",
      requester_email: contact?.email || invitation?.contact_email || "",
      assigned_role: role?.assigned_role || row.assigned_role || "",
      contact_id: contact?.id ?? null,
    };
  });
}

export default function AccessRequestsWorkspace({ embedded = false, onOpenPerson, onRequestChanged }: { embedded?: boolean; onOpenPerson?: (contactId: string) => void; onRequestChanged?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { viewer } = useViewerAccess();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [requests, setRequests] = useState<VerificationRow[]>([]);
  const [savingRequestId, setSavingRequestId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [decision, setDecision] = useState<OwnerDecision | null>(null);
  const [requestFilter, setRequestFilter] = useState<"all" | "pending" | "approved" | "declined" | "history">("all");
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const requestTriggerRef = useRef<HTMLElement | null>(null);
  const isLinkedRequester = viewer.mode === "linked";
  const selectedRequestId = embedded ? searchParams.get("request") : null;

  useEffect(() => {
    const dialog = confirmationRef.current;
    if (!dialog) return;
    if (decision && !dialog.open) dialog.showModal();
    if (!decision && dialog.open) dialog.close();
  }, [decision]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
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
          .select("id,owner_user_id,role_assignment_id,request_type,request_status,evidence_document_path,submitted_at,review_notes")
          .eq("owner_user_id", ownerUserId)
          .order("submitted_at", { ascending: false }),
      ]);

      if (!mounted) return;
      const nextAssignments = (assignmentRes.data ?? []) as Assignment[];
      const nextRequests = (requestRes.data ?? []) as VerificationRow[];
      const hydratedRequests = await hydrateRequesters(nextRequests, nextAssignments);
      if (!mounted) return;

      setAssignments(nextAssignments);
      setRequests(hydratedRequests);
      if (nextAssignments[0]) setSelectedAssignment(nextAssignments[0].id);
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router, viewer.targetOwnerUserId]);

  const ownerAccessRequests = useMemo(
    () => requests.filter((item) => item.request_type !== "death_certificate"),
    [requests],
  );
  const pendingOwnerRequests = ownerAccessRequests.filter((item) => ["pending", "submitted"].includes(item.request_status));
  const previousOwnerRequests = ownerAccessRequests.filter((item) => !["pending", "submitted"].includes(item.request_status));
  const filteredOwnerRequests = ownerAccessRequests.filter((item) => requestFilter === "all"
    || (requestFilter === "pending" && ["pending", "submitted"].includes(item.request_status))
    || (requestFilter === "approved" && item.request_status === "approved")
    || (requestFilter === "declined" && ["rejected", "declined"].includes(item.request_status))
    || (requestFilter === "history" && !["pending", "submitted"].includes(item.request_status)));
  const selectedRequest = ownerAccessRequests.find((item) => item.id === selectedRequestId) ?? null;
  const deathCertificateRequests = useMemo(
    () => requests.filter((item) => item.request_type === "death_certificate"),
    [requests],
  );

  async function decideOwnerRequest(item: VerificationRow, nextStatus: OwnerDecision) {
    if (item.request_type === "death_certificate") {
      setStatus("Death certificate evidence is reviewed in the application verification dashboard.");
      return;
    }
    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/sign-in");
      return;
    }

    setSavingRequestId(item.id);
    const update = await supabase
      .from("verification_requests")
      .update({
        request_status: nextStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userData.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("owner_user_id", viewer.targetOwnerUserId || userData.user.id)
      .neq("request_type", "death_certificate")
      .in("request_status", ["pending", "submitted"])
      .select("id")
      .maybeSingle();

    setSavingRequestId("");
    if (update.error || !update.data) {
      setStatus(update.error ? `Could not ${nextStatus === "approved" ? "approve" : "reject"} request: ${update.error.message}` : "This request has already changed. Refresh to see its current status.");
      return;
    }

    setRequests((current) => current.map((row) => row.id === item.id ? { ...row, request_status: nextStatus } : row));
    onRequestChanged?.();
    setStatus(`${item.requester_name || "Requester"} request ${nextStatus}. Record sharing is unchanged.`);
  }

  async function submitEvidence(file: File) {
    const validation = validateUploadFile(file, {
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: 10 * 1024 * 1024,
    });
    if (!validation.ok) {
      setStatus(`Upload blocked: ${validation.error}. Allowed: PDF, JPG, PNG up to 10MB.`);
      return;
    }
    if (!selectedAssignment) {
      setStatus("Select an executor or power-of-attorney assignment first.");
      return;
    }
    if (!isLinkedRequester) {
      setStatus("Death certificate evidence is submitted by an invited executor or attorney, not by the wallet owner.");
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
      setStatus(`Upload failed: ${upload.error.message}`);
      setUploading(false);
      return;
    }

    const { error } = await supabase.from("verification_requests").insert({
      owner_user_id: viewer.targetOwnerUserId,
      role_assignment_id: selectedAssignment,
      request_type: "death_certificate",
      request_status: "submitted",
      evidence_document_path: path,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setUploading(false);
    if (error) {
      setStatus(`Request save failed: ${error.message}`);
      return;
    }

    setStatus("Access request submitted to application verification.");
    const refresh = await supabase
      .from("verification_requests")
      .select("id,owner_user_id,role_assignment_id,request_type,request_status,evidence_document_path,submitted_at,review_notes")
      .eq("owner_user_id", viewer.targetOwnerUserId)
      .order("submitted_at", { ascending: false });
    setRequests(await hydrateRequesters((refresh.data ?? []) as VerificationRow[], assignments));
  }

  if (isLinkedRequester) {
    return (
      <section style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Request elevated access</h1>
          <p style={{ margin: 0, color: "var(--lf-text-secondary)" }}>
            Use this only when you were invited into another person&apos;s wallet and need elevated access, such as executor access after bereavement. Evidence is routed to the application verification dashboard, not the wallet owner&apos;s personal account.
          </p>
        </div>

        {status ? <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>{status}</div> : null}

        <section style={workflowGridStyle}>
          {[
            ["1. Existing invitation", "You must already have a linked executor or power-of-attorney assignment from the wallet owner."],
            ["2. Evidence submission", "Upload death certificate evidence only when you need access beyond the permissions previously granted."],
            ["3. Application review", "Application administrators verify the evidence, identity, relationship, and audit trail before access changes."],
          ].map(([title, description]) => (
            <article key={title} style={stepCardStyle}>
              <div style={{ fontWeight: 700 }}>{title}</div>
              <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>{description}</div>
            </article>
          ))}
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Submit death certificate evidence</h2>
          {loading ? <div style={{ color: "var(--lf-text-secondary)" }}>Loading...</div> : null}
          {!loading && assignments.length === 0 ? (
            <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>
              No executor or power-of-attorney assignment is available for evidence submission yet.
            </div>
          ) : null}

          {!loading && assignments.length > 0 ? (
            <>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--lf-text-secondary)", fontSize: 12 }}>Role assignment</span>
                <select value={selectedAssignment} onChange={(event) => setSelectedAssignment(event.target.value)} style={inputStyle}>
                  {assignments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatLabel(item.assigned_role)} - {formatLabel(item.activation_status)}
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
          <h2 style={{ margin: 0, fontSize: 18 }}>Submitted evidence</h2>
          {deathCertificateRequests.length === 0 ? (
            <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>No death certificate evidence has been submitted from this linked access view.</div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            {deathCertificateRequests.map((item) => (
              <article key={item.id} style={rowStyle}>
                <div style={{ fontWeight: 700 }}>{formatLabel(item.request_type)}</div>
                <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>
                  Status: {formatLabel(item.request_status)} - Submitted {new Date(item.submitted_at).toLocaleString()}
                </div>
                {item.evidence_document_path ? <div style={{ color: "var(--lf-status-approved-text)", fontSize: 13 }}>Evidence received for application review.</div> : null}
              </article>
            ))}
          </div>
        </section>
      </section>
    );
  }

  if (embedded) {
    const closeRequest = () => {
      setDecision(null);
      router.replace("/people-access?view=requests");
    };
    const openRequest = (item: VerificationRow, trigger: HTMLElement) => {
      requestTriggerRef.current = trigger;
      setStatus("");
      router.push(`/people-access?view=requests&request=${encodeURIComponent(item.id)}`);
    };
    const renderRequest = (item: VerificationRow) => <article key={item.id} className="lf-pa-request-row">
      <span className="lf-pa-request-avatar" aria-hidden="true">{item.requester_name?.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?"}</span>
      <div className="lf-pa-request-copy"><strong>{item.requester_name || "Unknown requester"}</strong><span>{formatRequestedAccess(item)} · Submitted {new Date(item.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></div>
      <span className="lf-pa-request-status">{formatLabel(item.request_status)}</span>
      <Button onClick={(event) => openRequest(item, event.currentTarget)}>Review request<Icon name="chevron_right" size={17} /></Button>
    </article>;

    return <section className="lf-pa-requests">
      {status ? <Banner tone={status.startsWith("Could not") || status.startsWith("This request") ? "danger" : "success"}>{status}</Banner> : null}
      <div className="lf-pa-request-filters" role="group" aria-label="Filter access requests">{([[
        "all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["declined", "Declined"], ["history", "History"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={requestFilter === key} onClick={() => setRequestFilter(key)}>{label}</button>)}</div>
      {requestFilter === "all" ? <section aria-labelledby="pa-pending-heading">
        <h2 id="pa-pending-heading">Awaiting your decision{pendingOwnerRequests.length ? ` · ${pendingOwnerRequests.length}` : ""}</h2>
        {loading ? <p role="status">Loading requests…</p> : pendingOwnerRequests.length ? <div className="lf-pa-request-list">{pendingOwnerRequests.map(renderRequest)}</div> : <EmptyState icon="inbox" title="No requests waiting" description="New access requests will appear here." />}
      </section> : <section aria-label={`${requestFilter} access requests`}>{loading ? <p role="status">Loading requests…</p> : filteredOwnerRequests.length ? <div className="lf-pa-request-list">{filteredOwnerRequests.map(renderRequest)}</div> : <EmptyState icon="inbox" title={`No ${requestFilter} requests`} description="Requests matching this filter will appear here." />}</section>}
      {requestFilter === "all" && previousOwnerRequests.length ? <details className="lf-pa-previous"><summary>Previous decisions · {previousOwnerRequests.length}</summary><div className="lf-pa-request-list">{previousOwnerRequests.map(renderRequest)}</div></details> : null}
      <details className="lf-access-request-guidance"><summary>How access requests work</summary><p>A request is reviewed here. Record sharing is changed separately through the person&apos;s selected records. Death certificate evidence is reviewed by application administrators.</p></details>
      <section className="lf-pa-escalation"><Icon name="lock" size={20} /><div><h2>Death certificate escalation</h2><p>Invited executors or attorneys submit evidence from their linked view. Application administrators review it; submitting evidence does not grant access.</p></div></section>
      {!loading && selectedRequestId && !selectedRequest ? <Banner tone="warning">This request is not available in your current account.</Banner> : null}
      <Sheet open={Boolean(selectedRequest)} title="Review request" onClose={closeRequest} preserveSidebar returnFocusTo={requestTriggerRef}
        footer={selectedRequest && ["pending", "submitted"].includes(selectedRequest.request_status) ? <div className="lf-pa-review-actions"><Button variant="primary" disabled={Boolean(savingRequestId)} onClick={() => setDecision("approved")}>Approve request</Button><Button disabled={Boolean(savingRequestId)} onClick={() => setDecision("rejected")}>Decline request</Button></div> : undefined}>
        {selectedRequest ? <div className="lf-pa-review">
          <div><strong>{selectedRequest.requester_name || "Unknown requester"}</strong><p>{formatLabel(selectedRequest.assigned_role || "linked contact")}</p></div>
          <section className="lf-pa-review-card"><h3>Request</h3><dl><div><dt>Requested</dt><dd>{formatRequestedAccess(selectedRequest)}</dd></div><div><dt>Submitted</dt><dd>{new Date(selectedRequest.submitted_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Status</dt><dd>{formatLabel(selectedRequest.request_status)}</dd></div></dl></section>
          <section className="lf-pa-review-card"><h3>Supporting information</h3><p>Only the request information available to this account is shown. Protected evidence remains in its existing review workflow.</p></section>
          <section className="lf-pa-review-card"><h3>Current sharing</h3><p>Review this person&apos;s selected records separately. A request decision does not change record access.</p>{selectedRequest.contact_id && onOpenPerson ? <button type="button" className="lf-pa-text-action" onClick={() => onOpenPerson(selectedRequest.contact_id!)}>Review shared records</button> : null}</section>
          {["pending", "submitted"].includes(selectedRequest.request_status) ? <Banner tone="warning">Approving this request does not automatically share another record.</Banner> : <p role="status">{selectedRequest.request_status === "approved" ? "Request approved; record sharing is unchanged." : `Request ${formatLabel(selectedRequest.request_status)}.`}</p>}
        </div> : null}
      </Sheet>
      <dialog ref={confirmationRef} className="lf-pa-confirm" onCancel={(event) => { event.preventDefault(); event.stopPropagation(); setDecision(null); }} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} aria-labelledby="pa-confirm-title">
        <h2 id="pa-confirm-title">{decision === "approved" ? "Approve this request?" : "Decline this request?"}</h2>
        <p>{decision === "approved" ? "Approval records your decision. It does not share any additional record." : "The person’s current record sharing will remain unchanged."}</p>
        <div className="lf-pa-review-actions"><Button variant="primary" disabled={Boolean(savingRequestId)} onClick={() => { if (selectedRequest && decision) void decideOwnerRequest(selectedRequest, decision); setDecision(null); }}>{decision === "approved" ? "Confirm approval" : "Confirm decline"}</Button><Button onClick={() => setDecision(null)}>Cancel</Button></div>
      </dialog>
    </section>;
  }

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Access Requests</h1>
        <p style={{ margin: 0, color: "var(--lf-text-secondary)" }}>
          Review people who have asked for access beyond what you already gave them. Say yes or no here; use Contacts to manage existing people, names, emails, deletion, and detailed permission toggles.
        </p>
      </div>

      {status ? <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>{status}</div> : null}

      <details className="lf-access-request-guidance">
        <summary>How access requests work</summary>
        <section style={workflowGridStyle}>
        {[
          ["1. Request received", "An invited person asks to view a category, view a record, add a document, or perform another action they do not currently have."],
          ["2. Owner decision", "You see their name, email, requested access, and can approve or reject the request."],
          ["3. Contacts controls", "Current access is edited in Contacts, where names, emails, removal, roles, and category permissions are managed."],
          ["4. Evidence escalation", "Death certificate evidence is routed to application verification, not approved from your personal wallet."],
        ].map(([title, description]) => (
          <article key={title} style={stepCardStyle}>
            <div style={{ fontWeight: 700 }}>{title}</div>
            <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>{description}</div>
          </article>
        ))}
        </section>
      </details>

      <section style={cardStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Requests awaiting your decision</h2>
          <p style={{ margin: 0, color: "var(--lf-text-secondary)", fontSize: 13 }}>
            This is only for new or changed access requests. People who already have access are managed from Contacts.
          </p>
        </div>

        {loading ? <div style={{ color: "var(--lf-text-secondary)" }}>Loading...</div> : null}
        {!loading && ownerAccessRequests.length === 0 ? (
          <div style={emptyStateStyle}>
            <strong>No access requests waiting.</strong>
            <span>When someone asks for more access, their name, email, requested access, and yes/no decision will appear here.</span>
          </div>
        ) : null}

        <div className="lf-access-owner-list" style={{ display: "grid", gap: 8 }}>
          {ownerAccessRequests.map((item) => (
            <article key={item.id} style={rowStyle}>
              <div style={requestRowHeaderStyle}>
                <div style={{ display: "grid", gap: 3 }}>
                  <strong>{item.requester_name || "Unknown requester"}</strong>
                  <span style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>{item.requester_email || "No email on request"}</span>
                </div>
                <span style={statusPillStyle}>{formatLabel(item.request_status)}</span>
              </div>
              <div style={requestDetailGridStyle}>
                <Info label="Requested access" value={formatRequestedAccess(item)} />
                <Info label="Role" value={formatLabel(item.assigned_role || "linked contact")} />
                <Info label="Submitted" value={new Date(item.submitted_at).toLocaleString()} />
              </div>
              {item.review_notes ? <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>Note: {item.review_notes}</div> : null}
              <div className="lf-access-owner-actions" style={ownerActionRowStyle}>
                <button
                  type="button"
                  style={approveButtonStyle}
                  disabled={savingRequestId === item.id}
                  onClick={() => void decideOwnerRequest(item, "approved")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  style={rejectButtonStyle}
                  disabled={savingRequestId === item.id}
                  onClick={() => void decideOwnerRequest(item, "rejected")}
                >
                  Reject
                </button>
                <Link href="/contacts" style={secondaryLinkStyle}>
                  Edit in Contacts
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Current access lives in Contacts</h2>
        <p style={{ margin: 0, color: "var(--lf-text-secondary)", fontSize: 13 }}>
          Contacts is where you view everyone already invited or stored, update their name or email, delete them, and tick or toggle exactly what wallet sections they can view or edit.
        </p>
        <Link href="/contacts" style={buttonLabelStyle}>
          Manage contacts and permissions
        </Link>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Death certificate escalation</h2>
        <p style={{ margin: 0, color: "var(--lf-text-secondary)", fontSize: 13 }}>
          You do not submit or approve death certificate evidence for your own wallet. If an invited executor or attorney needs post-death access, they submit evidence from their linked view and application administrators review it in the verification dashboard.
        </p>
      </section>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ color: "var(--lf-text-secondary)", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: "var(--lf-text)", fontSize: 13, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function formatRequestedAccess(item: VerificationRow) {
  return formatLabel(item.request_type || "access change");
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

const workflowGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const stepCardStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 14,
  background: "var(--lf-surface-card)",
  padding: 12,
  display: "grid",
  gap: 6,
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 16,
  background: "var(--lf-surface-card)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const rowStyle: CSSProperties = {
  border: "1px solid var(--lf-divider)",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 10,
};

const requestRowHeaderStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const requestDetailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const emptyStateStyle: CSSProperties = {
  border: "1px dashed var(--lf-border-input)",
  borderRadius: 12,
  background: "var(--lf-surface-page)",
  color: "var(--lf-text-secondary)",
  padding: 12,
  display: "grid",
  gap: 4,
  fontSize: 13,
};

const ownerActionRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const inputStyle: CSSProperties = {
  border: "1px solid var(--lf-border-input)",
  borderRadius: 10,
  padding: "9px 10px",
  width: "100%",
  fontSize: 14,
};

const buttonLabelStyle: CSSProperties = {
  border: "1px solid var(--lf-primary-bg)",
  background: "var(--lf-primary-bg)",
  color: "var(--lf-primary-text)",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  textDecoration: "none",
};

const approveButtonStyle: CSSProperties = {
  ...buttonLabelStyle,
  borderColor: "#166534",
  background: "#166534",
};

const rejectButtonStyle: CSSProperties = {
  ...buttonLabelStyle,
  borderColor: "#991b1b",
  background: "var(--lf-destructive)",
};

const secondaryLinkStyle: CSSProperties = {
  ...buttonLabelStyle,
  borderColor: "var(--lf-border-input)",
  background: "var(--lf-surface-card)",
  color: "var(--lf-text)",
};

const statusPillStyle: CSSProperties = {
  border: "1px solid var(--lf-border-input)",
  borderRadius: 999,
  background: "var(--lf-surface-page)",
  color: "var(--lf-text)",
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 800,
};
