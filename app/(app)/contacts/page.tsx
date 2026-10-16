import { Suspense } from "react";

import PeopleAccessWorkspace from "../../../components/people-access/PeopleAccessWorkspace";

export default function ContactsPage() {
  return (
    <Suspense fallback={null}>
      <PeopleAccessWorkspace />
    </Suspense>
  );
}
