"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Notifications now live in the Inbox, under Updates (owner decision, 10 Nov 2026). Old links still work. */
export default function NotificationsPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/actions?filter=updates"); }, [router]);
  return <p className="lf-inline-status" role="status">Opening your Inbox…</p>;
}
