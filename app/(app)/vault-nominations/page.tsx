"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Icon from "../../../components/ui/Icon";
import { PageHeader } from "../../../components/ui/V3Primitives";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { firstName, loadMyNominations, requestEarlyAccess, type MyNomination } from "../../../lib/vaultAccess/vaultAccess";

/**
 * What a nominee sees before release (va-r4, va-r6, va-r7). Only the owner's name, the kind
 * and the state. Never record names, counts, values, documents or what the nomination covers.
 */
export default function VaultNominationsPage() {
  const [items, setItems] = useState<MyNomination[] | null>(null);
  const [asking, setAsking] = useState("");

  const load = useCallback(async () => {
    const user = await waitForActiveUser(supabase);
    if (!user) { setItems([]); return; }
    setItems(await loadMyNominations(supabase));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const user = await waitForActiveUser(supabase);
      const loaded = user ? await loadMyNominations(supabase) : [];
      if (active) setItems(loaded);
    })();
    return () => { active = false; };
  }, []);

  const askingItem = items?.find((item) => item.ref === asking);
  if (askingItem) return <AskForAccess item={askingItem} onDone={async () => { setAsking(""); await load(); }} />;

  return <section className="lf-va-nominee">
    <PageHeader title="Vaults you’re nominated for" description="Someone has arranged for you to see part of their Vault later. Until then you can’t see anything in it." />
    {items === null ? <p className="lf-va-muted">Loading…</p> : items.length === 0 ? <div className="lf-va-empty">
      <Icon name="bookmark" size={24} />
      <div><strong>No nominations</strong>
      <p>If someone nominates you and tells you, it shows here. <Link className="lf-va-link" href="/dashboard">Back to My Vault</Link></p></div>
    </div> : items.map((item) => <NominationCard key={item.ref} item={item} onAsk={() => setAsking(item.ref)} />)}
  </section>;
}

function NominationCard({ item, onAsk }: { item: MyNomination; onAsk: () => void }) {
  const name = firstName(item.ownerName);
  if (item.releaseStage === "released") {
    return <article className="lf-va-nominee-card">
      <header>
        <h2>{item.ownerName}’s Vault</h2>
        <div className="lf-va-nominee-chips"><span className="lf-va-chip is-ok"><Icon name="lock_open" size={16} />Released · view only</span></div>
      </header>
      <p>The release has been approved. Choose {item.ownerName}’s Vault in the Vault switcher to see what {name} chose to share with you. You can view, not change or delete.</p>
    </article>;
  }
  if (item.releaseStage === "in_progress") {
    return <article className="lf-va-nominee-card">
      <header>
        <h2>{item.ownerName}’s Vault</h2>
        <div className="lf-va-nominee-chips"><span className="lf-va-chip is-wait"><Icon name="hourglass_top" size={16} />Release in progress</span></div>
      </header>
      <ol className="lf-va-release-steps" aria-label="Release steps">
        <li className="is-done"><span aria-hidden="true"><Icon name="check" size={16} /></span><div><strong>Death reported</strong></div></li>
        <li className="is-current"><span aria-hidden="true"><Icon name="hourglass_top" size={16} /></span><div><strong>Evidence being reviewed</strong><small>Our team checks the death certificate and the grant of probate.</small></div></li>
        <li><span aria-hidden="true">3</span><div><strong>Death verified</strong></div></li>
        <li><span aria-hidden="true">4</span><div><strong>Release approved</strong></div></li>
      </ol>
      <p className="lf-va-muted"><Icon name="lock" size={16} />You can’t see anything in {name}’s Vault until the release is approved. We’ll let you know.</p>
    </article>;
  }
  return <article className="lf-va-nominee-card">
    <header>
      <h2>{name} has nominated you</h2>
      <div className="lf-va-nominee-chips">
        <span className="lf-va-chip"><Icon name="bookmark_added" size={16} />{item.kind === "attorney" ? "Under a Power of Attorney" : `After ${name}’s death`}</span>
        <span className="lf-va-chip"><Icon name="lock" size={16} />Locked until release</span>
      </div>
    </header>
    <div>
      <h3>What this means</h3>
      <p>If {name} dies and the release is approved, you’ll be able to see what {name} chose for you. Until then you can’t see anything in {name}’s Vault, including what’s in it.</p>
    </div>
    <dl className="lf-va-nominee-steps">
      <div><dt>You joined</dt><dd><Icon name="check" size={16} />Done</dd></div>
      <div><dt>Release</dt><dd><Icon name="hourglass_top" size={16} />Not started</dd></div>
    </dl>
    <div className="lf-va-nominee-actions">
      <h3>If you need to</h3>
      {item.openRequest
        ? <p className="lf-va-muted"><Icon name="schedule" size={16} />You’ve asked {name} for access now. {name} decides.</p>
        : <button type="button" className="lf-va-action-row" onClick={onAsk}><span><Icon name="contact_support" size={18} />Ask {name} for access now<small>{name} decides</small></span><Icon name="chevron_right" size={18} /></button>}
      <Link className="lf-va-action-row" href={`/estate/report-death?nomination=${encodeURIComponent(item.ref)}`}><span><Icon name="assignment_late" size={18} />Report a death<small>Starts the release checks</small></span><Icon name="chevron_right" size={18} /></Link>
    </div>
  </article>;
}

function AskForAccess({ item, onDone }: { item: MyNomination; onDone: () => Promise<void> }) {
  const name = firstName(item.ownerName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  async function send() {
    setSending(true); setError("");
    try { await requestEarlyAccess(supabase, item.ref, message); await onDone(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your request wasn’t sent."); }
    finally { setSending(false); }
  }
  return <section className="lf-va-nominee">
    <button type="button" className="lf-va-back" onClick={() => void onDone()}><Icon name="chevron_left" size={20} />{item.ownerName}’s Vault</button>
    <PageHeader title={`Ask ${name} for access now`} description={`${name} gets a request in their To do and decides whether to share anything. Asking doesn’t give you access.`} />
    <article className="lf-va-nominee-card">
      <label className="lf-va-field" htmlFor="va-ask-message">Message to {name} · Optional
        <textarea id="va-ask-message" rows={4} maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="For example, I’m sorting the house insurance and need the policy details." />
      </label>
      <p className="lf-va-muted"><Icon name="info" size={16} />If {name} can’t respond because they’re ill, a Power of Attorney may apply instead. If {name} has died, report a death.</p>
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
      <div className="lf-va-dialog-footer">
        <button type="button" className="lf-va-secondary" onClick={() => void onDone()}>Cancel</button>
        <button type="button" className="lf-va-primary" disabled={sending} onClick={() => void send()}>{sending ? "Sending…" : "Send request"}</button>
      </div>
    </article>
  </section>;
}
