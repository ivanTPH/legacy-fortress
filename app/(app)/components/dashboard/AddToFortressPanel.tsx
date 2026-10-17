"use client";

import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";
import { Card, RestrictedState, Row } from "../../../../components/ui/V3Primitives";
import { FINANCE_RECORD_CHOICES } from "../../../../lib/vault/addRecordTypes";

type AddChoice = { label: string; description: string; href: string; icon: string };
type AddGroup = { title: string; choices: AddChoice[] };

const ADD_GROUPS: AddGroup[] = [
  {
    title: "Finances & property",
    choices: [
      { label: "Property", description: "Home, ownership and supporting records.", href: "/property?add=1", icon: "home" },
      ...FINANCE_RECORD_CHOICES.map(({ label, description, href, icon }) => ({ label, description, href, icon })),
    ],
  },
  {
    title: "Legal & important documents",
    choices: [
      { label: "Will", description: "Record that it exists and add the document when ready.", href: "/legal/wills?add=1", icon: "gavel" },
      { label: "Capacity arrangement", description: "Record a power of attorney or related arrangement.", href: "/legal/power-of-attorney?add=1", icon: "health_and_safety" },
      { label: "Important document", description: "Add a document to the appropriate workspace.", href: "/property/documents?add=1", icon: "upload_file" },
    ],
  },
  {
    title: "People",
    choices: [
      { label: "Trusted person", description: "Record someone before deciding whether to invite them.", href: "/contacts?group=trusted-contacts&add=1", icon: "person_add" },
      { label: "Executor", description: "Add a person named to help with your estate.", href: "/contacts?group=executors&add=1", icon: "supervisor_account" },
      { label: "Family or loved one", description: "Keep a relationship clear without granting access.", href: "/contacts?group=family&add=1", icon: "family_restroom" },
    ],
  },
  {
    title: "Personal, digital & wishes",
    choices: [
      { label: "Meaningful possession", description: "Jewellery, watches, collections, art or heirlooms.", href: "/vault/personal/records?add=1&possessionCategory=other", icon: "inventory_2" },
      { label: "Digital account", description: "Email, cloud or online services. Do not store passwords.", href: "/vault/digital/records?add=1&digitalType=__other", icon: "devices" },
      { label: "Wish or instruction", description: "Personal guidance, funeral wishes or pet-care notes.", href: "/personal/wishes?add=1", icon: "edit_note" },
    ],
  },
];

export default function AddToFortressPanel() {
  const { viewer } = useViewerAccess();

  if (viewer.mode === "linked") {
    return <RestrictedState reason="Adding records is available in your own vault." />;
  }

  return (
    <section className="lf-v3-destination-grid" aria-label="Choose what to add">
        {ADD_GROUPS.map((group) => (
          <Card key={group.title}>
            <h3>{group.title}</h3>
            {group.choices.map((choice) => <Row key={choice.href} title={choice.label} description={choice.description} icon={choice.icon} href={choice.href} />)}
          </Card>
        ))}
    </section>
  );
}
