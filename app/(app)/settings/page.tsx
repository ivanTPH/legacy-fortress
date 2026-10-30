"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../../../components/ui/Icon";
import { getSafeUserData } from "../../../lib/auth/requireActiveUser";
import { supabase } from "../../../lib/supabaseClient";
import { loadProfileIdentityChip } from "../../../lib/profile/workspace";

const GROUPS = [
  { title: "Account", items: [
    { href: "/account/security", icon: "lock", label: "Security", description: "Sign-in, password and verification" },
    { href: "/account/billing", icon: "receipt_long", label: "Billing and account", description: "Plan and payment details" },
  ] },
  { title: "Preferences", items: [
    { href: "/account/my-vault", icon: "apps", label: "My Vault", description: "Choose visible areas and sections" },
    { href: "/account/appearance", icon: "palette", label: "Appearance", description: "Automatic, Light or Dark on this device" },
    { href: "/account/accessibility", icon: "accessibility_new", label: "Accessibility", description: "Text, contrast and reading options" },
    { href: "/account/communications-preferences", icon: "mail", label: "Communications", description: "Choose permitted contact channels" },
    { href: "/account/reminder-preferences", icon: "notifications", label: "Notifications and reminders", description: "Existing reminder preferences" },
  ] },
  { title: "Legal", items: [
    { href: "/account/terms", icon: "description", label: "Terms and conditions", description: "Review account terms" },
  ] },
] as const;

export default function SettingsOverviewPage() {
  const [profile, setProfile] = useState({ name: "Your profile", email: "", avatarUrl: "" });

  useEffect(() => {
    let active = true;
    void getSafeUserData(supabase).then(({ data }) => {
      if (!active || !data.user) return;
      const metadata = data.user.user_metadata as Record<string, unknown>;
      const name = [metadata.full_name, metadata.display_name, metadata.name].find((value): value is string => typeof value === "string" && value.trim().length > 0);
      setProfile({ name: name?.trim() || "Your profile", email: data.user.email ?? "", avatarUrl: "" });
      const user = data.user;
      void loadProfileIdentityChip(supabase, { userId: user.id, email: user.email ?? "" })
        .then((chip) => { if (active) setProfile((current) => ({ ...current, name: chip.displayName || current.name, avatarUrl: chip.avatarUrl })); })
        .catch(() => undefined);
    });
    return () => { active = false; };
  }, []);

  const initials = profile.name === "Your profile" ? "•" : profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return <section className="lf-v52-settings-page" aria-labelledby="settings-title">
    <header className="lf-v52-settings-heading"><h1 id="settings-title">Settings</h1><p>Manage your profile, account and Vault preferences.</p></header>
    <Link href="/profile" className="lf-v52-settings-profile">
      <span className="lf-v52-settings-avatar" aria-hidden="true">{profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" />
      ) : initials}</span>
      <span className="lf-v52-settings-profile-copy"><strong>{profile.name}</strong>{profile.email ? <small>{profile.email}</small> : null}<span>Edit profile</span></span>
      <Icon name="chevron_right" size={20} />
    </Link>
    {GROUPS.map((group) => <section key={group.title} className="lf-v52-settings-group" aria-labelledby={`settings-${group.title.toLowerCase()}`}>
      <h2 id={`settings-${group.title.toLowerCase()}`}>{group.title}</h2>
      <div className="lf-v52-settings-list">{group.items.map((item) => <Link key={item.href} href={item.href}>
        <span className="lf-v52-settings-icon"><Icon name={item.icon} size={20} /></span>
        <span className="lf-v52-settings-row-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
        <Icon name="chevron_right" size={20} />
      </Link>)}</div>
    </section>)}
    <Link href="/support" className="lf-v52-settings-support"><Icon name="help" size={20} />Support<Icon name="chevron_right" size={20} /></Link>
  </section>;
}
