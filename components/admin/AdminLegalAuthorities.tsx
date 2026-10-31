"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminDataTable, { AdminEmptyState, AdminFilterChips, AdminNote, AdminStatStrip, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import Icon from "@/components/ui/Icon";
import IdentityReviewCompare from "@/components/admin/IdentityReviewCompare";

/**
 * Platform Admin › Powers of Attorney. Three separate checks before an authority takes effect:
 * the attorney's identity, the authority, and that it can be used now. Activation is the only
 * step that opens records, and only the areas the owner left ticked (never Wills).
 */

type Authority = {
  id: string;
  ownerName: string;
  attorneyName: string;
  attorneyJoined: boolean;
  attorneyIdVerified: boolean;
  authorityType: string;
  registered: string;
  registrationRef: string | null;
  usableWhen: string;
  scopeAreas: string[];
  status: string;
  activatedAt: string | null;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  createdAt: string;
  updatedAt: string;
  document: { type: string; id: string; fileName: string } | null;
  reviews: Array<{ action: string; messageToOwner: string | null; createdAt: string }>;
  freshCheck?: { id: string; status: string; createdAt: string } | null;
};

type Action = "confirm" | "needs_attention" | "reject" | "activate" | "end";
type Filter = "to_check" | "ready" | "active" | "closed" | "all";

const TYPE_LABEL: Record<string, string> = {
  lpa_property_finance: "LPA · property and finances",
  lpa_health_welfare: "LPA · health and welfare",
  enduring_poa: "Enduring Power of Attorney",
  general_poa: "General Power of Attorney",
  other: "Other legal authority",
};
const AREA_LABEL: Record<string, string> = { profile: "Profile", finances: "Finances", property: "Property", business: "Business", digital: "Digital", possessions: "Possessions", legal: "Legal" };

export function stageOf(item: Pick<Authority, "status" | "activatedAt">): { key: Exclude<Filter, "all">; label: string; badge: string } {
  if (item.status === "pending_check") return { key: "to_check", label: "To check", badge: "pending" };
  if (item.status === "needs_attention") return { key: "to_check", label: "Needs attention", badge: "needs_information" };
  if (item.status === "confirmed" && !item.activatedAt) return { key: "ready", label: "Confirmed · not active", badge: "under_review" };
  if (item.status === "confirmed") return { key: "active", label: "Active", badge: "active" };
  return { key: "closed", label: item.status === "withdrawn" ? "Withdrawn by owner" : item.status === "rejected" ? "Rejected" : "Ended", badge: item.status === "rejected" ? "rejected" : "closed" };
}

function allowedActions(item: Authority): Action[] {
  if (item.status === "pending_check" || item.status === "needs_attention") return ["confirm", "needs_attention", "reject"];
  if (item.status === "confirmed" && !item.activatedAt) return ["activate", "needs_attention", "end"];
  if (item.status === "confirmed") return ["end"];
  return [];
}

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day}, ${time}`;
}

const ACTION_LABEL: Record<Action, { idle: string; busy: string }> = {
  confirm: { idle: "Confirm authority", busy: "Confirming…" },
  needs_attention: { idle: "Ask the owner to fix something", busy: "Sending…" },
  reject: { idle: "Reject", busy: "Rejecting…" },
  activate: { idle: "Activate", busy: "Activating…" },
  end: { idle: "End authority", busy: "Ending…" },
};

export default function AdminLegalAuthorities({ authFetch, resourceId, capabilities }: {
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  resourceId: string | null;
  capabilities: string[];
}) {
  const [items, setItems] = useState<Authority[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("to_check");
  const [reason, setReason] = useState("");
  const [messageToOwner, setMessageToOwner] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const canReview = capabilities.includes("verification:review");
  const canDecide = capabilities.includes("verification:decide");

  const load = useCallback(async () => {
    const res = await authFetch("/api/internal/admin/legal-authorities");
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; authorities?: Authority[]; message?: string };
    if (!res.ok || !json.ok) { setError(json.message || "Powers of Attorney couldn’t be loaded."); setItems([]); return; }
    setError("");
    setItems(json.authorities ?? []);
  }, [authFetch]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const result = { to_check: 0, ready: 0, active: 0, closed: 0 };
    for (const item of items ?? []) result[stageOf(item).key] += 1;
    return result;
  }, [items]);

  if (items === null) return <p className="lf-admin-muted">Loading Powers of Attorney…</p>;

  const selected = resourceId ? items.find((item) => item.id === resourceId) ?? null : null;
  if (resourceId) {
    if (!selected) return <AdminEmptyState icon="gavel" title="Authority not found">It may have been removed. <Link href="/admin/authorities">Back to Powers of Attorney</Link></AdminEmptyState>;
    return renderDetail(selected);
  }

  const visible = items.filter((item) => filter === "all" || stageOf(item).key === filter);
  return <>
    {error ? <section className="lf-admin-alert" role="alert">{error}</section> : null}
    <AdminStatStrip label="Powers of Attorney" items={[
      { label: "To check", value: counts.to_check },
      { label: "Confirmed, not active", value: counts.ready },
      { label: "Active", value: counts.active },
      { label: "Closed", value: counts.closed },
    ]} />
    <AdminFilterChips<Filter> label="Show" value={filter} onChange={setFilter} options={[
      { key: "to_check", label: "To check", count: counts.to_check },
      { key: "ready", label: "Ready to activate", count: counts.ready },
      { key: "active", label: "Active", count: counts.active },
      { key: "closed", label: "Closed", count: counts.closed },
      { key: "all", label: "All" },
    ]} />
    <AdminDataTable<Authority>
      caption="Powers of Attorney"
      columns={[
        { key: "attorney", header: "Attorney", render: (item) => <><Link className="lf-admin-cell-title" href={`/admin/authorities/${item.id}`}>{item.attorneyName}</Link><small>for {item.ownerName}</small></> },
        { key: "type", header: "Authority", render: (item) => <>{TYPE_LABEL[item.authorityType] ?? "Legal authority"}<small>{item.scopeAreas.map((area) => AREA_LABEL[area] ?? area).join(", ") || "No areas"}</small></>, mobile: "hide" },
        { key: "id", header: "Attorney ID", render: (item) => item.attorneyIdVerified ? "Verified" : item.attorneyJoined ? "Not verified" : "Not joined", mobile: "hide" },
        { key: "updated", header: "Updated", render: (item) => formatDate(item.updatedAt), mobile: "hide" },
        { key: "status", header: "Status", render: (item) => { const stage = stageOf(item); return <AdminStatusBadge status={stage.badge} label={stage.label} />; } },
      ]}
      rows={visible}
      getRowKey={(item) => item.id}
      emptyState={<AdminEmptyState icon="gavel" title="Nothing here">Authorities owners record appear here for checking.</AdminEmptyState>}
    />
    <AdminNote icon="lock">Recording, checking or confirming an authority never opens records. Only Activate does, and only for the areas the owner chose. Wills are never included.</AdminNote>
  </>;

  async function run(item: Authority, action: Action) {
    if (!reason.trim()) { setNotice("Add decision notes first."); return; }
    setBusy(action);
    setNotice("");
    const res = await authFetch(`/api/internal/admin/legal-authorities/${encodeURIComponent(item.id)}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, reason, messageToOwner }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    setBusy("");
    if (!res.ok || !json.ok) { setNotice(json.message || "That didn’t save. Try again."); return; }
    setReason("");
    setMessageToOwner("");
    setNotice(action === "activate" ? "Activated. The attorney can now see the chosen areas." : action === "end" ? "Ended. The attorney’s access from this authority stopped." : "Saved.");
    await load();
  }

  async function openDocument(item: Authority) {
    setBusy("document");
    const res = await authFetch(`/api/internal/admin/legal-authorities/${encodeURIComponent(item.id)}/document`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; signedUrl?: string; message?: string };
    setBusy("");
    if (!res.ok || !json.ok || !json.signedUrl) { setNotice(json.message || "The document couldn’t be opened."); return; }
    window.open(json.signedUrl, "_blank", "noopener,noreferrer");
  }

  function renderDetail(item: Authority) {
    const stage = stageOf(item);
    const actions = allowedActions(item);
    const decisionAllowed = (action: Action) => action === "needs_attention" ? canReview : canDecide;
    const checks = [
      { title: "The attorney proves who they are", ok: item.attorneyIdVerified && Boolean(item.freshCheck), detail: !item.attorneyJoined ? "Not joined yet" : !item.attorneyIdVerified ? "Joined · ID not verified yet" : item.freshCheck ? "ID verified · fresh check ready to look at below" : item.activatedAt ? "ID verified" : "ID verified · waiting for their fresh check for this authority" },
      { title: "We check the authority", ok: item.status === "confirmed", detail: item.status === "confirmed" ? "Confirmed" : stage.label },
      { title: "It can be used now", ok: Boolean(item.activatedAt), detail: item.activatedAt ? `Active since ${formatDate(item.activatedAt)}` : item.usableWhen === "lacks_capacity_only" ? "Only if the owner lacks mental capacity: confirm capacity evidence before activating" : "With the owner’s agreement: confirm with the owner before activating" },
    ];
    return <div className="lf-admin-detail">
      <header className="lf-admin-detail-head">
        <div>
          <h2>{item.attorneyName}</h2>
          <p>Attorney for {item.ownerName} · recorded {formatDate(item.createdAt)}</p>
        </div>
        <AdminStatusBadge status={stage.badge} label={stage.label} />
      </header>
      <div className="lf-admin-detail-grid">
        <div className="lf-admin-detail-main">
          <section className="lf-admin-table-card" aria-labelledby="poa-checks-title">
            <h2 id="poa-checks-title">Before it takes effect</h2>
            <ol className="lf-admin-poa-checks">
              {checks.map((check, index) => <li key={check.title} className={check.ok ? "is-done" : ""}>
                <span aria-hidden="true">{check.ok ? <Icon name="check" size={16} /> : index + 1}</span>
                <div><strong>{check.title}</strong><small>{check.detail}</small></div>
              </li>)}
            </ol>
          </section>
          {item.freshCheck && item.freshCheck.status === "review_required" ? <IdentityReviewCompare requestId={item.freshCheck.id} canDecide={canDecide} title="Attorney’s fresh ID check" /> : null}
          <section className="lf-admin-table-card" aria-labelledby="poa-details-title">
            <h2 id="poa-details-title">Authority</h2>
            <dl className="lf-admin-keyvalues">
              <div><dt>Type</dt><dd>{TYPE_LABEL[item.authorityType] ?? "Legal authority"}</dd></div>
              <div><dt>Registered</dt><dd>{item.registered === "yes" ? "Yes" : item.registered === "no" ? "Not yet" : "Owner isn’t sure"}{item.registrationRef ? <small>Reference {item.registrationRef}</small> : null}</dd></div>
              <div><dt>Can be used</dt><dd>{item.usableWhen === "lacks_capacity_only" ? "Only if the owner lacks mental capacity" : "With the owner’s agreement"}</dd></div>
              <div><dt>Could see</dt><dd>{item.scopeAreas.map((area) => AREA_LABEL[area] ?? area).join(", ") || "No areas"}<small>View only. Wills are never included.</small></dd></div>
              <div><dt>Document</dt><dd>{item.document ? <button type="button" className="lf-admin-row-button" disabled={busy === "document" || !canReview} onClick={() => void openDocument(item)}>{busy === "document" ? "Opening…" : `Open ${item.document.fileName}`}</button> : "None"}</dd></div>
              {item.withdrawnAt ? <div><dt>Withdrawn</dt><dd>{formatDate(item.withdrawnAt)}<small>{item.withdrawnReason ?? ""}</small></dd></div> : null}
            </dl>
          </section>
          <details className="lf-admin-table-card lf-admin-history">
            <summary><h2>Review history</h2><span>{item.reviews.length} event{item.reviews.length === 1 ? "" : "s"}</span></summary>
            <ol>
              {item.reviews.map((review, index) => <li key={index}>
                <strong>{review.action === "needs_attention" ? "Sent back to the owner" : review.action.charAt(0).toUpperCase() + review.action.slice(1)}</strong>
                <span>{review.messageToOwner ?? ""}</span>
                <small>{formatDate(review.createdAt)}</small>
              </li>)}
              <li><strong>Recorded by the owner</strong><span /><small>{formatDate(item.createdAt)}</small></li>
            </ol>
          </details>
        </div>
        <aside className="lf-admin-detail-rail">
          <section className="lf-admin-table-card lf-admin-form-card" aria-label="Decision">
            <h2>Decision</h2>
            {notice ? <p className="lf-admin-muted" role="status">{notice}</p> : null}
            {actions.length === 0 ? <p className="lf-admin-muted">This authority is closed. Its history stays available.</p> : !(canReview || canDecide) ? <p className="lf-admin-muted">You can look at this authority but your role can’t change it.</p> : <>
              <label className="lf-admin-field">Decision notes (required)
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="What you checked and why" />
              </label>
              <label className="lf-admin-field">Message to the owner · Optional
                <textarea value={messageToOwner} onChange={(event) => setMessageToOwner(event.target.value)} rows={2} maxLength={500} placeholder="Shown to the owner. No record details." />
              </label>
              <div className="lf-admin-decision-actions">
                {actions.filter((action) => action === "needs_attention").map((action) => <button key={action} type="button" className="lf-admin-row-button" disabled={Boolean(busy) || !decisionAllowed(action)} onClick={() => void run(item, action)}>{busy === action ? ACTION_LABEL[action].busy : ACTION_LABEL[action].idle}</button>)}
              </div>
              <div className="lf-admin-decision-footer">
                {actions.includes("reject") ? <button type="button" className="lf-admin-danger-button" disabled={Boolean(busy) || !canDecide} onClick={() => void run(item, "reject")}>{busy === "reject" ? ACTION_LABEL.reject.busy : ACTION_LABEL.reject.idle}</button>
                  : actions.includes("end") ? <button type="button" className="lf-admin-danger-button" disabled={Boolean(busy) || !canDecide} onClick={() => void run(item, "end")}>{busy === "end" ? ACTION_LABEL.end.busy : ACTION_LABEL.end.idle}</button> : <span />}
                {actions.includes("confirm") ? <button type="button" className="lf-admin-primary-button" disabled={Boolean(busy) || !canDecide} onClick={() => void run(item, "confirm")}>{busy === "confirm" ? ACTION_LABEL.confirm.busy : ACTION_LABEL.confirm.idle}</button> : null}
                {actions.includes("activate") ? <button type="button" className="lf-admin-primary-button" disabled={Boolean(busy) || !canDecide || !item.attorneyIdVerified || !item.freshCheck} title={item.attorneyIdVerified && item.freshCheck ? undefined : "The attorney’s ID and a fresh check are needed first"} onClick={() => void run(item, "activate")}>{busy === "activate" ? ACTION_LABEL.activate.busy : ACTION_LABEL.activate.idle}</button> : null}
              </div>
              {actions.includes("activate") && (!item.attorneyIdVerified || !item.freshCheck) ? <p className="lf-admin-muted">Activate is available once the attorney’s ID is verified and you’ve looked at their fresh ID check. They’re asked for it when you confirm the authority.</p> : null}
            </>}
          </section>
          <AdminNote icon="lock">Confirming checks the document only. Activate is the step that lets the attorney see records, and the owner can withdraw it at any time.</AdminNote>
        </aside>
      </div>
    </div>;
  }
}
