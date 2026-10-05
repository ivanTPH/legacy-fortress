"use client";

import Icon from "../../../../components/ui/Icon";
import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";

type AddChoice = { label: string; description: string; href: string; icon: string };
type AddGroup = { title: string; choices: AddChoice[] };

const ADD_GROUPS: AddGroup[] = [
  {
    title: "Money & property",
    choices: [
      { label: "Property", description: "Home, ownership and supporting records.", href: "/property?add=1", icon: "home" },
      { label: "Bank account", description: "Institution and a useful description, never a password.", href: "/finances/bank?add=1", icon: "account_balance" },
      { label: "Savings or investments", description: "Start with the provider and account context.", href: "/finances/investments?add=1", icon: "savings" },
      { label: "Pension or insurance", description: "Keep the provider and policy context findable.", href: "/finances/pensions?add=1", icon: "shield" },
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
    return (
      <section className="lf-add-to-fortress-panel" aria-labelledby="add-to-fortress-title">
        <div className="lf-add-to-fortress-heading">
          <span className="lf-legacy-guidance-icon"><Icon name="lock" size={18} /></span>
          <span>
            <span className="lf-legacy-guidance-eyebrow">Read-only access</span>
            <h2 id="add-to-fortress-title">Add to my Fortress</h2>
          </span>
        </div>
        <p className="lf-add-to-fortress-intro">Only the Fortress owner can add or change estate records.</p>
      </section>
    );
  }

  return (
    <section className="lf-add-to-fortress-panel" aria-labelledby="add-to-fortress-title">
      <div className="lf-add-to-fortress-heading">
        <span className="lf-legacy-guidance-icon"><Icon name="add_circle" size={18} /></span>
        <span>
          <span className="lf-legacy-guidance-eyebrow">Build this at your pace</span>
          <h2 id="add-to-fortress-title">Add to my Fortress</h2>
        </span>
      </div>
      <p className="lf-add-to-fortress-intro">Start with one useful record. You can add detail, documents and people later, when it makes sense.</p>
      <div className="lf-add-to-fortress-groups">
        {ADD_GROUPS.map((group) => (
          <div className="lf-add-to-fortress-group" key={group.title}>
            <h3>{group.title}</h3>
            <div className="lf-add-to-fortress-choices">
              {group.choices.map((choice) => (
                <a className="lf-add-to-fortress-choice" href={choice.href} key={choice.href}>
                  <span className="lf-add-to-fortress-choice-icon"><Icon name={choice.icon} size={16} /></span>
                  <span><strong>{choice.label}</strong><small>{choice.description}</small></span>
                  <Icon name="arrow_forward" size={15} />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
