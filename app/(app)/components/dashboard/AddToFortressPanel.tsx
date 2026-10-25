"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";
import Icon from "../../../../components/ui/Icon";
import { RestrictedState } from "../../../../components/ui/V3Primitives";
import { FINANCE_RECORD_CHOICES } from "../../../../lib/vault/addRecordTypes";

type AddChoice = { label: string; description: string; href: string; icon: string };
type AddArea = { key: string; title: string; description: string; icon: string; choices: AddChoice[] };

const ADD_AREAS: AddArea[] = [
  { key: "finances", title: "Finances", description: "Accounts, pensions, investments and insurance.", icon: "account_balance_wallet", choices: FINANCE_RECORD_CHOICES },
  { key: "legal", title: "Legal", description: "Wills, powers of attorney and important papers.", icon: "gavel", choices: [
    { label: "Will", description: "Record that it exists and add the document when ready.", href: "/legal/wills?add=1", icon: "history_edu" },
    { label: "Capacity arrangement", description: "Record a power of attorney or related arrangement.", href: "/legal/power-of-attorney?add=1", icon: "shield_person" },
    { label: "Important document", description: "Add a document to the appropriate workspace.", href: "/property/documents?add=1", icon: "description" },
  ] },
  { key: "property", title: "Property", description: "Homes, deeds and valuations.", icon: "home", choices: [
    { label: "Property record", description: "Record ownership, location and value.", href: "/vault/property?add=1", icon: "home" },
    { label: "Property document", description: "Keep a deed or supporting file.", href: "/property/documents?add=1", icon: "folder" },
  ] },
  { key: "business", title: "Business", description: "Interests and employment records.", icon: "work", choices: [
    { label: "Business interest", description: "Add a company or business interest.", href: "/vault/business?add=1", icon: "domain" },
    { label: "Employment", description: "Keep workplace and death-in-service details.", href: "/employment?add=1", icon: "work" },
  ] },
  { key: "digital", title: "Digital", description: "Accounts, platforms and online services.", icon: "devices", choices: [
    { label: "Digital account", description: "Email, cloud or online services. Do not store passwords.", href: "/vault/digital/records?add=1&digitalType=__other", icon: "devices" },
  ] },
  { key: "possessions", title: "Possessions", description: "Things you own and wishes you want recorded.", icon: "inventory_2", choices: [
    { label: "Meaningful possession", description: "Jewellery, watches, collections, art or heirlooms.", href: "/vault/personal/records?add=1&possessionCategory=other", icon: "inventory_2" },
    { label: "Wish or instruction", description: "Personal guidance, funeral wishes or pet-care notes.", href: "/personal/wishes?add=1", icon: "edit_note" },
  ] },
];

const PEOPLE_CHOICES: AddChoice[] = [
  { label: "Trusted person", description: "Record someone before deciding whether to invite them.", href: "/contacts?group=trusted-contacts&add=1", icon: "person_add" },
  { label: "Executor", description: "Add a person named to help with your estate.", href: "/contacts?group=executors&add=1", icon: "group" },
  { label: "Family or loved one", description: "Keep a relationship clear without granting access.", href: "/contacts?group=family&add=1", icon: "family_restroom" },
];

export default function AddToFortressPanel() {
  const { viewer } = useViewerAccess();
  const requestedArea = useSearchParams().get("area");
  const [selectedArea, setSelectedArea] = useState<string | null>(() => ADD_AREAS.some((item) => item.key === requestedArea) ? requestedArea : null);

  if (viewer.mode === "linked") return <RestrictedState reason="Adding records is available in your own vault." />;

  const area = ADD_AREAS.find((item) => item.key === selectedArea);
  const choices = selectedArea === "people" ? PEOPLE_CHOICES : area?.choices;
  return <section className="lf-v52-add-flow" aria-label="Choose what to add">
    {choices ? <>
      <button type="button" className="lf-v52-add-back" onClick={() => setSelectedArea(null)}><Icon name="arrow_back" size={20} />Areas</button>
      <h2>{area?.title ?? "People"}</h2>
      <p>Choose a section, then add a record using its existing form.</p>
      <div className="lf-v52-add-choice-list">{choices.map((choice) => <Link key={choice.href} href={choice.href} className="lf-v52-add-choice">
        <span className="lf-v52-add-icon"><Icon name={choice.icon} size={20} /></span>
        <span><strong>{choice.label}</strong><small>{choice.description}</small></span>
        <Icon name="chevron_right" size={20} />
      </Link>)}</div>
    </> : <>
      <h2>Choose an area</h2>
      <div className="lf-v3-destination-grid lf-v52-add-area-grid">{ADD_AREAS.map((item) => <button key={item.key} type="button" className="lf-v52-add-area" onClick={() => setSelectedArea(item.key)}>
        <span className="lf-v52-add-icon"><Icon name={item.icon} size={22} /></span>
        <strong>{item.title}</strong><Icon name="chevron_right" size={20} />
        <small>{item.description}</small>
      </button>)}</div>
      <button type="button" className="lf-v52-add-people" onClick={() => setSelectedArea("people")}><Icon name="person_add" size={20} />Add a person<Icon name="chevron_right" size={20} /></button>
      <p className="lf-v52-add-note">Adding or inviting a person never shares your records automatically.</p>
    </>}
  </section>;
}
