"use client";

import { Suspense } from "react";
import PeopleAccessWorkspace from "../../../components/people-access/PeopleAccessWorkspace";

/** Canonical estate/access entry point; legacy /access-requests remains a compatibility alias. */
export default function AccessPage() {
  return <Suspense fallback={<p role="status">Loading People &amp; Access…</p>}><PeopleAccessWorkspace /></Suspense>;
}
