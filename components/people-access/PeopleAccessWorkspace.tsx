"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSafeUserData } from "../../lib/auth/requireActiveUser";
import { supabase } from "../../lib/supabaseClient";
import { useViewerAccess } from "../access/ViewerAccessContext";
import AccessRequestsWorkspace from "../access-requests/AccessRequestsWorkspace";
import ContactsNetworkWorkspace from "../contacts/ContactsNetworkWorkspace";
import VaultAccessWorkspace from "./VaultAccessWorkspace";
import Icon from "../ui/Icon";
import { PageHeader } from "../ui/V3Primitives";

const VIEW_DESCRIPTION: Record<string, string> = {
  people: "The people in your circle, and whether they’ve joined.",
  shared: "Who can see your records today.",
  sharing: "Who can see each record today.",
  after: "Who gets access after your death, and to what.",
  requests: "Things waiting for your decision.",
};

export default function PeopleAccessWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { viewer } = useViewerAccess();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingByContact, setPendingByContact] = useState<Record<string, string>>({});
  const [requestRevision, setRequestRevision] = useState(0);
  const requestedView = params.get("view");
  // Four tabs (owner-approved UX review, Stage 3): People, Shared now, After I die, Requests.
  // Older links still work: vault-access opens Shared now (early-access requests are answered there); sharing is record by record.
  const view = requestedView === "after" || requestedView === "later" ? "after"
    : requestedView === "shared" || requestedView === "vault-access" ? "shared"
    : requestedView === "sharing" ? "sharing"
    : requestedView === "requests" || ((pathname === "/access-requests" || pathname === "/access") && requestedView !== "people") ? "requests" : "people";
  const addPersonMode = view === "people" && params.get("add") === "1" && !viewer.readOnly;

  useEffect(() => {
    if (viewer.mode === "linked" || pathname === "/people-access") return;
    const next = new URLSearchParams(params.toString());
    next.set("view", view);
    router.replace(`/people-access?${next.toString()}`);
  }, [params, pathname, router, view, viewer.mode]);

  useEffect(() => {
    if (viewer.mode === "linked") return;
    let active = true;
    async function loadPendingCount() {
      const { data } = await getSafeUserData(supabase);
      if (!data.user) return;
      const result = await supabase.from("verification_requests")
        .select("id,request_type,role_assignment_id")
        .eq("owner_user_id", data.user.id)
        .in("request_status", ["pending", "submitted"]);
      if (result.error) { if (active) setPendingCount(null); return; }
      const pending = (result.data ?? []).filter((row) => row.request_type !== "death_certificate");
      if (active) setPendingCount(new Set(pending.map((row) => row.id)).size);
      const assignmentIds = [...new Set(pending.map((row) => row.role_assignment_id).filter(Boolean))] as string[];
      if (!assignmentIds.length) { if (active) setPendingByContact({}); return; }
      const assignments = await supabase.from("role_assignments").select("id,invitation_id").eq("owner_user_id", data.user.id).in("id", assignmentIds);
      if (assignments.error) return;
      const invitationIds = [...new Set((assignments.data ?? []).map((row) => row.invitation_id).filter(Boolean))] as string[];
      if (!invitationIds.length) { if (active) setPendingByContact({}); return; }
      const invitations = await supabase.from("contact_invitations").select("id,contact_id").eq("owner_user_id", data.user.id).in("id", invitationIds);
      if (invitations.error) return;
      const invitationByAssignment = new Map((assignments.data ?? []).map((row) => [row.id, row.invitation_id]));
      const contactByInvitation = new Map((invitations.data ?? []).map((row) => [row.id, row.contact_id]));
      const next: Record<string, string> = {};
      for (const request of pending) {
        const contactId = contactByInvitation.get(invitationByAssignment.get(request.role_assignment_id) ?? "");
        if (contactId) next[contactId] = request.id;
      }
      if (active) setPendingByContact(next);
    }
    void loadPendingCount();
    return () => { active = false; };
  }, [viewer.mode, view, requestRevision]);

  // The linked requester's estate/evidence journey retains its existing guarded surface.
  if (viewer.mode === "linked") return <AccessRequestsWorkspace />;

  return <section className={addPersonMode ? "lf-pa-page is-add-person" : "lf-pa-page"}>
    {addPersonMode ? <div className="lf-v52-add-person-page-header"><Link href="/people-access?view=people"><Icon name="chevron_left" size={20} />People</Link><h1>Add a person</h1></div> : <PageHeader
      title="People"
      description={VIEW_DESCRIPTION[view]}
      action={view === "people" && !viewer.readOnly ? <Link className="lf-pa-add" href="/people-access?view=people&group=trusted_contacts&add=1"><Icon name="person_add" size={18} />Add person</Link> : undefined}
    />}
    {!addPersonMode ? <nav className="lf-pa-tabs lf-pa-tabs--four" aria-label="People views">
      <Link href="/people-access?view=people" className={view === "people" ? "is-active" : ""} aria-current={view === "people" ? "page" : undefined}>People</Link>
      <Link href="/people-access?view=shared" className={view === "shared" || view === "sharing" ? "is-active" : ""} aria-current={view === "shared" || view === "sharing" ? "page" : undefined}>Shared now</Link>
      <Link href="/people-access?view=after" className={view === "after" ? "is-active" : ""} aria-current={view === "after" ? "page" : undefined}>After I die</Link>
      <Link href="/people-access?view=requests" className={view === "requests" ? "is-active" : ""} aria-current={view === "requests" ? "page" : undefined}>Requests{pendingCount ? <span className="lf-pa-count">{pendingCount}</span> : null}</Link>
    </nav> : null}
    {view === "shared" ? <VaultAccessWorkspace mode="now" /> : view === "after" ? <VaultAccessWorkspace mode="later" /> : view === "requests"
      ? <AccessRequestsWorkspace embedded onRequestChanged={() => setRequestRevision((current) => current + 1)} onOpenPerson={(contactId) => router.push(`/people-access?view=people&contact=${encodeURIComponent(contactId)}`)} />
      : <ContactsNetworkWorkspace embedded sharingView={view === "sharing"} basePath="/people-access" pendingByContact={pendingByContact} />}
  </section>;
}
