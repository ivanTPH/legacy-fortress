"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";

/**
 * Settings › Profile "Identity" row (V5.2 design): shows whether the person's ID is verified and
 * takes them to the ID check. Verification confirms who someone is; it never gives access to records.
 */
type Row = { status: string; requested_identity_level: number; verified_at: string | null; expires_at: string | null; verification_purpose: string };

export type IdentityStatus = { tone: "verified" | "waiting" | "todo"; title: string; detail: string; action: string | null };

export function describeIdentityStatus(rows: Row[], now = Date.now()): IdentityStatus {
  // Only the person's own level-2 checks count; case checks for a death report or Power of Attorney don't.
  const own = rows.filter((row) => row.requested_identity_level === 2 && row.verification_purpose !== "admin_review");
  const verified = own.find((row) => row.status === "verified" && (!row.expires_at || Date.parse(row.expires_at) > now));
  const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "";
  if (verified) return { tone: "verified", title: "Identity verified", detail: verified.expires_at ? `Valid until ${date(verified.expires_at)}` : `Verified ${date(verified.verified_at)}`, action: null };
  const latest = own[0];
  if (latest?.status === "review_required") return { tone: "waiting", title: "ID check being reviewed", detail: "A member of our team is checking it. We’ll let you know.", action: "View" };
  if (latest && ["document_required", "document_extracted", "camera_required", "camera_captured"].includes(latest.status)) return { tone: "todo", title: "ID check not finished", detail: "Carry on where you left off.", action: "Continue" };
  if (latest?.status === "verified") return { tone: "todo", title: "ID check expired", detail: "Checks last a year. Do a new one when you’re ready.", action: "Verify your ID" };
  return { tone: "todo", title: "Identity not verified", detail: "Takes about 3 minutes with your passport or driving licence and your phone camera.", action: "Verify your ID" };
}

export default function IdentityStatusRow() {
  const [status, setStatus] = useState<IdentityStatus | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/identity-verification", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { requests?: Row[] };
        if (active && res.ok) setStatus(describeIdentityStatus(json.requests ?? []));
      } catch {
        // Leave the row in its loading state; the check page itself still works.
      }
    })();
    return () => { active = false; };
  }, []);

  const body = <>
    <Icon name={status?.tone === "verified" ? "verified_user" : status?.tone === "waiting" ? "hourglass_top" : "shield"} size={20} />
    <span>{status?.title ?? "Checking identity status…"}<small>{status?.detail ?? ""}</small></span>
    {status?.action ? <em className="lf-identity-status-action">{status.action}</em> : null}
    <Icon name="chevron_right" size={20} />
  </>;
  return <Link href="/identity/verify?next=%2Fprofile" className={`lf-identity-status is-${status?.tone ?? "loading"}`}>{body}</Link>;
}
