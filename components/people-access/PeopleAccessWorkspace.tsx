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

export default function PeopleAccessWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { viewer } = useViewerAccess();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingByContact, setPendingByContact] = useState<Record<string, string>>({});
  const [requestRevision, setRequestRevision] = useState(0);
  const requestedView = params.get("view");
  const view = requestedView === "vault-access" ? "vault-access" : requestedView === "sharing" ? "sharing"
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
      title="People & Access"
      description={view === "vault-access" ? "Who can see your Vault now, and who you’ve arranged access for later." : "Keep relationships, requests and record sharing in one place."}
      action={view === "people" && !viewer.readOnly ? <Link className="lf-pa-add" href="/people-access?view=people&group=trusted_contacts&add=1"><Icon name="person_add" size={18} />Add person</Link> : undefined}
    />}
    {!addPersonMode ? <nav className="lf-pa-tabs" aria-label="People and access views">
      <Link href="/people-access?view=people" className={view === "people" ? "is-active" : ""} aria-current={view === "people" ? "page" : undefined}>People</Link>
      <Link href="/people-access?view=vault-access" className={view === "vault-access" ? "is-active" : ""} aria-current={view === "vault-access" ? "page" : undefined}>Vault access</Link>
      <Link href="/people-access?view=requests" className={view === "requests" ? "is-active" : ""} aria-current={view === "requests" ? "page" : undefined}>Requests{pendingCount ? <span className="lf-pa-count">{pendingCount}</span> : null}</Link>
      <Link href="/people-access?view=sharing" className={view === "sharing" ? "is-active" : ""} aria-current={view === "sharing" ? "page" : undefined}>Sharing</Link>
    </nav> : null}
    {view === "vault-access" ? <VaultAccessWorkspace /> : view === "requests"
      ? <AccessRequestsWorkspace embedded onRequestChanged={() => setRequestRevision((current) => current + 1)} onOpenPerson={(contactId) => router.push(`/people-access?view=people&contact=${encodeURIComponent(contactId)}`)} />
      : <ContactsNetworkWorkspace embedded sharingView={view === "sharing"} basePath="/people-access" pendingByContact={pendingByContact} />}
  </section>;
}
