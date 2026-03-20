"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import Icon from "../../../components/ui/Icon";
import UniversalRecordWorkspace from "../../../components/records/UniversalRecordWorkspace";

const items = [
  { href: "/profile", label: "Profile details", desc: "Manage personal details, avatar, address, and identity information.", icon: "person" },
  { href: "/vault/personal", label: "Possessions", desc: "View existing possessions first, then add or update records.", icon: "inventory_2" },
  { href: "/personal/beneficiaries", label: "Beneficiaries", desc: "Maintain beneficiary records, shares, and linked supporting documents.", icon: "volunteer_activism" },
  { href: "/personal/tasks", label: "Tasks & Actions", desc: "Track estate actions against real assets, beneficiaries, and executors.", icon: "task" },
  { href: "/personal#next-of-kin", label: "Next of Kin", desc: "Maintain emergency and family contact details.", icon: "groups" },
  { href: "/trust", label: "Executors / Trusted Contacts", desc: "Manage executors and trusted contacts in the shared canonical workspace.", icon: "verified_user" },
  { href: "/personal/subscriptions", label: "Subscriptions", desc: "Track paid subscriptions and renewal details.", icon: "subscriptions" },
  { href: "/personal/social-media", label: "Social media", desc: "Track social platforms and digital profile records.", icon: "alternate_email" },
  { href: "/personal/wishes", label: "Personal Wishes", desc: "Capture personal wishes and guidance notes.", icon: "favorite" },
];

export default function PersonalOverviewPage() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Personal</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Manage profile and personal information, then keep possessions and next-of-kin details up to date.
        </p>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Profile identity data stays in the dedicated top-level profile tables. Supporting documents should be linked from the relevant canonical asset workspace.
        </p>
      </div>
      <div className="lf-content-grid">
        {items.map((item) => (
          <Link key={item.href} href={item.href} style={cardStyle}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <Icon name={item.icon} size={18} />
              {item.label}
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{item.desc}</div>
          </Link>
        ))}
      </div>
      <UniversalRecordWorkspace
        sectionId="next-of-kin"
        sectionKey="personal"
        categoryKey="next-of-kin"
        variant="trusted_contacts"
        title="Personal · Next of Kin"
        subtitle="Store next-of-kin contacts for family, medical, and urgent coordination needs."
      />
    </section>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
  textDecoration: "none",
  color: "#111827",
  display: "grid",
  gap: 8,
};
