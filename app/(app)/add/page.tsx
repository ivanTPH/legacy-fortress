"use client";

import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { Card, PageHeader, RestrictedState, Row } from "../../../components/ui/V3Primitives";

const groups = [
  { title: "Money & property", rows: [{ icon: "account_balance_wallet", title: "Finances", href: "/finances" }, { icon: "home", title: "Property", href: "/property" }, { icon: "work", title: "Business", href: "/business" }] },
  { title: "Legal & important documents", rows: [{ icon: "gavel", title: "Legal", href: "/legal" }, { icon: "badge", title: "Identity documents", href: "/identity-documents" }] },
  { title: "People", rows: [{ icon: "group", title: "People I Trust", href: "/contacts" }, { icon: "key", title: "Access requests", href: "/access-requests" }] },
  { title: "Personal, digital & wishes", rows: [{ icon: "devices", title: "Digital", href: "/vault/digital" }, { icon: "inventory_2", title: "Possessions", href: "/vault/personal" }, { icon: "volunteer_activism", title: "Personal wishes", href: "/personal/wishes" }] },
];

export default function AddPage() {
  const { viewer } = useViewerAccess();
  if (viewer.mode === "linked") return <RestrictedState reason="Adding records is available in your own vault." />;
  return <div className="lf-v3-destination"><PageHeader title="Add to my Fortress" description="Choose an area to add or manage a record using its existing secure form." /><div className="lf-v3-destination-grid">{groups.map((group) => <Card key={group.title}><h2>{group.title}</h2>{group.rows.map((row) => <Row key={row.href} {...row} />)}</Card>)}</div></div>;
}
