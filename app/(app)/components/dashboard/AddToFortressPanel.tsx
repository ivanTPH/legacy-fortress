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
  { key: "finances", title: "Finances", description: "Bank accounts, pensions, investments, insurance, debts", icon: "account_balance_wallet", choices: FINANCE_RECORD_CHOICES },
  { key: "legal", title: "Legal", description: "Wills, powers of attorney, trusts, funeral wishes", icon: "gavel", choices: [
    { label: "Will", description: "Record that it exists and add the document when ready.", href: "/legal/wills?add=1", icon: "history_edu" },
    { label: "Capacity arrangement", description: "Record a power of attorney or related arrangement.", href: "/legal/power-of-attorney?add=1", icon: "shield_person" },
    { label: "Important document", description: "Add a document to the appropriate workspace.", href: "/property/documents?add=1", icon: "description" },
  ] },
  { key: "property", title: "Property", description: "Homes, land, mortgages, rentals", icon: "home", choices: [
    { label: "Property record", description: "Record ownership, location and value.", href: "/vault/property?add=1", icon: "home" },
    { label: "Property document", description: "Keep a deed or supporting file.", href: "/property/documents?add=1", icon: "folder" },
  ] },
  { key: "business", title: "Business", description: "Companies, shareholdings, partnerships", icon: "work", choices: [
    { label: "Business interest", description: "Add a company or business interest.", href: "/vault/business?add=1", icon: "domain" },
    { label: "Employment", description: "Keep workplace and death-in-service details.", href: "/employment?add=1", icon: "work" },
  ] },
  { key: "digital", title: "Digital", description: "Email, social media, subscriptions, devices", icon: "devices", choices: [
    { label: "Digital account", description: "Email, cloud or online services. Do not store passwords.", href: "/vault/digital/records?add=1&digitalType=__other", icon: "devices" },
  ] },
  { key: "possessions", title: "Possessions", description: "Vehicles, jewellery, art, other items", icon: "inventory_2", choices: [
    { label: "Meaningful possession", description: "Jewellery, watches, collections, art or heirlooms.", href: "/vault/personal/records?add=1&possessionCategory=other", icon: "inventory_2" },
    { label: "Wish or instruction", description: "Personal guidance, funeral wishes or pet-care notes.", href: "/personal/wishes?add=1", icon: "edit_note" },
  ] },
];

const PEOPLE_CHOICES: AddChoice[] = [
  { label: "Trusted person", description: "Record someone before deciding whether to invite them.", href: "/contacts?group=trusted-contacts&add=1", icon: "person_add" },
  { label: "Executor", description: "Add a person named to help with your estate.", href: "/contacts?group=executors&add=1", icon: "group" },
  { label: "Family or loved one", description: "Keep a relationship clear without granting access.", href: "/contacts?group=family&add=1", icon: "family_restroom" },
];

const FINANCE_CHOICE_COPY: Record<string, { title: string; description: string }> = {
  "Bank account": { title: "Banks", description: "Current and savings accounts" },
  Pension: { title: "Pensions", description: "Workplace, personal, state" },
  Investment: { title: "Investments", description: "ISAs, shares, funds, bonds" },
  Insurance: { title: "Insurance", description: "Life, home, health, travel" },
  Debt: { title: "Debts", description: "Loans, credit cards, mortgages" },
};

export default function AddToFortressPanel() {
  const { viewer } = useViewerAccess();
  const requestedArea = useSearchParams().get("area");
  const [selectedArea, setSelectedArea] = useState<string | null>(() => ADD_AREAS.some((item) => item.key === requestedArea) ? requestedArea : null);

  if (viewer.mode === "linked") return <RestrictedState reason="Adding records is available in your own vault." />;

  const area = ADD_AREAS.find((item) => item.key === selectedArea);
  const choices = selectedArea === "people" ? PEOPLE_CHOICES : area?.choices;
  return <section className="lf-v52-add-flow" aria-label="Choose what to add">
    <nav className="lf-v52-add-breadcrumb" aria-label="Breadcrumb">
      {choices ? <button type="button" onClick={() => setSelectedArea(null)}><Icon name="chevron_left" size={18} />Add to my Vault</button> : <Link href="/dashboard"><Icon name="chevron_left" size={18} />Home</Link>}
    </nav>
    <header className="lf-v52-add-heading">
      <h1>{area?.title ?? (selectedArea === "people" ? "People" : "Add to my Vault")}</h1>
      <p>{choices ? "Choose a section" : "What would you like to record?"}</p>
    </header>
    {choices ? <>
      <div className="lf-v52-add-choice-grid">{choices.map((choice) => <Link key={choice.href} href={choice.href} className="lf-v52-add-choice">
        <span className="lf-v52-add-choice-head"><span className="lf-v52-add-icon"><Icon name={choice.icon} size={20} /></span><strong>{selectedArea === "finances" ? FINANCE_CHOICE_COPY[choice.label]?.title ?? choice.label : choice.label}</strong><Icon name="chevron_right" size={20} /></span>
        <small>{selectedArea === "finances" ? FINANCE_CHOICE_COPY[choice.label]?.description ?? choice.description : choice.description}</small>
      </Link>)}</div>
    </> : <>
      <div className="lf-v3-destination-grid lf-v52-add-area-grid">{ADD_AREAS.map((item) => <button key={item.key} type="button" className="lf-v52-add-area" onClick={() => setSelectedArea(item.key)}>
        <span className="lf-v52-add-area-head"><span className="lf-v52-add-icon"><Icon name={item.icon} size={22} /></span><strong>{item.title}</strong><Icon name="chevron_right" size={20} /></span>
        <small>{item.description}</small>
      </button>)}</div>
      <p className="lf-v52-add-summary">You only need a name to save a record. Details, values and documents can be added later.</p>
      <button type="button" className="lf-v52-add-people" onClick={() => setSelectedArea("people")}><Icon name="person_add" size={20} />Add a person<Icon name="chevron_right" size={20} /></button>
      <p className="lf-v52-add-note">Adding or inviting a person never shares your records automatically.</p>
    </>}
  </section>;
}
