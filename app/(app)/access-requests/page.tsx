"use client";

import { Suspense } from "react";
import PeopleAccessWorkspace from "../../../components/people-access/PeopleAccessWorkspace";

export default function AccessRequestsPage() {
  return <Suspense fallback={<p role="status">Loading People…</p>}><PeopleAccessWorkspace /></Suspense>;
}
