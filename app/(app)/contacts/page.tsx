import { Suspense } from "react";

import ContactsNetworkWorkspace from "../../../components/contacts/ContactsNetworkWorkspace";

export default function ContactsPage() {
  return (
    <Suspense fallback={null}>
      <ContactsNetworkWorkspace />
    </Suspense>
  );
}
