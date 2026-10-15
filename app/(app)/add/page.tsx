"use client";

import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { Card, PageHeader, RestrictedState, Row } from "../../../components/ui/V3Primitives";

const groups = [
  { title: "Money & property", rows: [{ icon: "account_balance_wallet", title: "Finances", description: "Accounts, pensions, investments and policies", href: "/finances" }, { icon: "home", title: "Property", description: "Homes, land and property documents", href: "/property" }, { icon: "work", title: "Business", description: "Business interests and employment", href: "/business" }] },
  { title: "Legal & important documents", rows: [{ icon: "gavel", title: "Legal", description: "Wills, trusts and powers of attorney", href: "/legal" }, { icon: "badge", title: "Identity documents", description: "Important proof of identity", href: "/identity-documents" }] },
  { title: "People", rows: [{ icon: "group", title: "People I Trust", description: "Contacts, invitations and sharing", href: "/contacts" }, { icon: "key", title: "Access requests", description: "Review requests for access", href: "/access-requests" }] },
  { title: "Personal, digital & wishes", rows: [{ icon: "devices", title: "Digital", description: "Accounts, subscriptions and recovery details", href: "/vault/digital" }, { icon: "inventory_2", title: "Possessions", description: "Vehicles, valuables and collections", href: "/vault/personal" }, { icon: "volunteer_activism", title: "Personal wishes", description: "Guidance for people you trust", href: "/personal/wishes" }] },
];

export default function AddPage() {
  const { viewer } = useViewerAccess();
  if (viewer.mode === "linked") return <RestrictedState reason="Adding records is available in your own vault." />;
  return <div className="lf-v3-destination"><PageHeader title="Add to my Fortress" description="Start with something that matters to you. You can add a simple record now and fill in more details later." /><div className="lf-v3-destination-grid">{groups.map((group) => <Card key={group.title}><h2>{group.title}</h2>{group.rows.map((row) => <Row key={row.href} {...row} />)}</Card>)}</div></div>;
}
