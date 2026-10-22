"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../../../components/ui/Icon";
import { getSafeUserData } from "../../../lib/auth/requireActiveUser";
import { supabase } from "../../../lib/supabaseClient";

const GROUPS = [
  {
    title: "Security",
    items: [
      { href: "/account/security", icon: "lock", label: "Password and account security" },
      { href: "/account/accessibility", icon: "accessibility_new", label: "Accessibility" },
    ],
  },
  {
    title: "Notifications",
    items: [
      { href: "/account/communications-preferences", icon: "mail", label: "Communication preferences" },
      { href: "/account/reminder-preferences", icon: "notifications", label: "Reminder preferences" },
    ],
  },
  {
    title: "Your Vault",
    items: [
      { href: "/account/my-vault", icon: "apps", label: "Vault preferences" },
      { href: "/account/billing", icon: "receipt_long", label: "Subscription and billing" },
      { href: "/account/terms", icon: "description", label: "Terms and conditions" },
      { href: "/support", icon: "help", label: "Help and support" },
    ],
  },
] as const;

export default function SettingsOverviewPage() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    void getSafeUserData(supabase).then(({ data }) => {
      if (active) setEmail(data.user?.email ?? "");
    });
    return () => { active = false; };
  }, []);

  return <section className="lf-v51-settings-page" aria-labelledby="settings-title">
    <h1 id="settings-title">Settings</h1>
    <Link href="/profile" className="lf-v51-settings-profile">
      <span className="lf-v51-settings-avatar" aria-hidden="true"><Icon name="person" size={24} /></span>
      <span><strong>Your profile</strong>{email ? <small>{email}</small> : null}</span>
      <Icon name="chevron_right" size={20} />
    </Link>
    {GROUPS.map((group) => <section key={group.title} aria-labelledby={`settings-${group.title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h2 id={`settings-${group.title.toLowerCase().replace(/\s+/g, "-")}`}>{group.title}</h2>
      <div className="lf-v51-settings-list">{group.items.map((item) => <Link key={item.href} href={item.href}>
        <Icon name={item.icon} size={20} /><span>{item.label}</span><Icon name="chevron_right" size={18} />
      </Link>)}</div>
    </section>)}
  </section>;
}
