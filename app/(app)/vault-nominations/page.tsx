"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../../../components/ui/Icon";
import { PageHeader } from "../../../components/ui/V3Primitives";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { firstName, loadMyNominations, type MyNomination } from "../../../lib/vaultAccess/vaultAccess";

/**
 * va-r4: what a nominee sees before release. Only the owner's name, the kind and the state.
 * Never record names, counts, values, documents or what the nomination covers.
 */
export default function VaultNominationsPage() {
  const [items, setItems] = useState<MyNomination[] | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const user = await waitForActiveUser(supabase);
      if (!user) { if (active) setItems([]); return; }
      const loaded = await loadMyNominations(supabase);
      if (active) setItems(loaded);
    })();
    return () => { active = false; };
  }, []);

  return <section className="lf-va-nominee">
    <PageHeader title="Vaults you’re nominated for" description="Someone has arranged for you to see part of their Vault later. Until then you can’t see anything in it." />
    {items === null ? <p className="lf-va-muted">Loading…</p> : items.length === 0 ? <div className="lf-va-empty">
      <Icon name="bookmark" size={24} />
      <div><strong>No nominations</strong>
      <p>If someone nominates you and tells you, it shows here. <Link className="lf-va-link" href="/dashboard">Back to My Vault</Link></p></div>
    </div> : items.map((item, index) => {
      const name = firstName(item.ownerName);
      const released = item.status === "released";
      return <article key={index} className="lf-va-nominee-card">
        <header>
          <h2>{name} has nominated you</h2>
          <div className="lf-va-nominee-chips">
            <span className="lf-va-chip"><Icon name="bookmark_added" size={16} />{item.kind === "attorney" ? "Under a Power of Attorney" : `After ${name}’s death`}</span>
            <span className={released ? "lf-va-chip is-ok" : "lf-va-chip"}><Icon name={released ? "lock_open" : "lock"} size={16} />{released ? "Released" : "Locked until release"}</span>
          </div>
        </header>
        <div className="lf-va-nominee-block">
          <h3>What this means</h3>
          {released
            ? <p>The release has been approved. Choose {item.ownerName}’s Vault in the Vault switcher to see what {name} chose for you. You can view, not change or delete.</p>
            : <p>If {name} dies and the release is approved, you’ll be able to see what {name} chose for you. Until then you can’t see anything in {name}’s Vault, including what’s in it.</p>}
        </div>
        <dl className="lf-va-nominee-steps">
          <div><dt>You joined</dt><dd><Icon name="check" size={16} />Done</dd></div>
          <div><dt>Release</dt><dd><Icon name={released ? "check" : "hourglass_top"} size={16} />{released ? "Approved" : "Not started"}</dd></div>
        </dl>
        {released ? null : <p className="lf-va-muted"><Icon name="info" size={16} />Nothing else is needed now. Being nominated doesn’t give you access to anything today.</p>}
      </article>;
    })}
  </section>;
}
