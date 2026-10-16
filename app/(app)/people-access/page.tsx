import { Suspense } from "react";
import PeopleAccessWorkspace from "../../../components/people-access/PeopleAccessWorkspace";

export default function PeopleAccessPage() {
  return <Suspense fallback={<p role="status">Loading People &amp; Access…</p>}><PeopleAccessWorkspace /></Suspense>;
}
