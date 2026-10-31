"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSafeUserData } from "../../lib/auth/requireActiveUser";
import { supabase } from "../../lib/supabaseClient";
import {
  AREA_LABEL,
  AUTHORITY_AREAS,
  AUTHORITY_CHOICES,
  AUTHORITY_LABEL,
  loadAuthorityDocuments,
  recordLegalAuthority,
  withdrawLegalAuthority,
  type AuthorityDocument,
  type AuthorityType,
  cancelVaultNomination,
  firstName,
  describeHistory,
  grantHasEnded,
  grantIsOpen,
  loadGrantRecordTitles,
  loadVaultAccessHistory,
  setVaultAccessEndDate,
  stopVaultAccess,
  type VaultAccessHistoryItem,
  answerEarlyAccessRequest,
  loadOpenEarlyAccessRequests,
  type EarlyAccessRequest,
  type VaultGrant,
  loadVaultAccess,
  loadVaultRecordOptions,
  saveVaultNomination,
  vaultAccessAvailable,
  type VaultAccessPerson,
  type VaultAccessSnapshot,
  type VaultNomination,
  type VaultRecordOption,
} from "../../lib/vaultAccess/vaultAccess";
import Icon from "../ui/Icon";

/**
 * People & Access › Vault access (V5.2 Vault Access va-w1–w4).
 * Lists who can see now, who is nominated for later, legal authorities and ended access.
 * Nominating never gives access; every confirmation says "Access now: none".
 */

type Row = {
  key: string;
  group: "now" | "later" | "authority" | "ended";
  person: VaultAccessPerson | undefined;
  covers: string;
  kind: string;
  condition: string;
  chips: Array<{ tone: "ok" | "wait" | "neutral" | "stop"; icon: string; label: string }>;
  nomination?: VaultNomination;
};

const GROUP_TITLE: Record<Row["group"], string> = { now: "Can see now", later: "Nominated for later", authority: "Legal authority", ended: "Ended" };

export default function VaultAccessWorkspace() {
  const [ownerId, setOwnerId] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<VaultAccessSnapshot | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [panelKey, setPanelKey] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<VaultNomination | null>(null);
  const [attorneyFor, setAttorneyFor] = useState("");
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();
  const [requestId, setRequestId] = useState(() => searchParams.get("request") ?? "");
  const [requests, setRequests] = useState<EarlyAccessRequest[]>([]);

  const reload = useCallback(async () => {
    const { data } = await getSafeUserData(supabase);
    const uid = data.user?.id ?? "";
    setOwnerId(uid);
    if (!uid) return;
    const ok = await vaultAccessAvailable(supabase);
    setAvailable(ok);
    if (!ok) return;
    try { setSnapshot(await loadVaultAccess(supabase, uid)); setRequests(await loadOpenEarlyAccessRequests(supabase, uid)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Vault access couldn’t be loaded."); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 6000); return () => window.clearTimeout(t); }, [toast]);

  const rows = useMemo<Row[]>(() => {
    if (!snapshot) return [];
    const person = (id: string | null) => snapshot.people.find((item) => item.id === id);
    const out: Row[] = [];
    for (const grant of snapshot.grants) {
      // Authority access is shown with its authority; empty grants (an invitation only) share nothing.
      if (grant.source !== "owner_grant") continue;
      const count = grant.assetIds.length + grant.recordIds.length;
      const open = grantIsOpen(grant);
      const ended = grantHasEnded(grant);
      if (!open && !ended) continue;
      const records = `${count} record${count === 1 ? "" : "s"}`;
      out.push({
        key: `grant-${grant.id}`, group: open ? "now" : "ended", person: person(grant.personId),
        covers: open && grant.endsAt ? `${records} · until ${shortDate(grant.endsAt)}` : records,
        kind: "Now, while you’re alive", condition: "View only",
        chips: open ? [{ tone: "ok", icon: "visibility", label: `Can see ${records}` }] : [{ tone: "neutral", icon: "event_busy", label: `Ended · ${shortDate(grant.endsAt ?? "")}` }],
      });
    }
    for (const nomination of snapshot.nominations) {
      const who = person(nomination.personId);
      const covers = nomination.scope === "whole_vault"
        ? `Whole Vault${nomination.exceptionCount ? `, except ${nomination.exceptionCount}` : ""}`
        : `${nomination.includeCount} record${nomination.includeCount === 1 ? "" : "s"}`;
      if (nomination.status === "active") {
        out.push({
          key: `nom-${nomination.id}`, group: "later", person: who, covers, nomination,
          kind: "After your death", condition: "After the death is verified and the grant of probate is confirmed",
          chips: [{ tone: "neutral", icon: "bookmark", label: "Nominated" }, identityChip(who), { tone: "neutral", icon: "lock", label: "No access now" }],
        });
      } else {
        out.push({
          key: `nom-${nomination.id}`, group: "ended", person: who, covers, nomination,
          kind: "After your death", condition: nomination.status === "cancelled" ? "Cancelled by you" : "Ended",
          chips: [{ tone: "neutral", icon: "block", label: nomination.status === "cancelled" ? `Cancelled${nomination.cancelledAt ? ` · ${shortDate(nomination.cancelledAt)}` : ""}` : "Ended" }],
        });
      }
    }
    for (const authority of snapshot.authorities) {
      const closed = ["withdrawn", "ended", "rejected"].includes(authority.status);
      out.push({
        key: `auth-${authority.id}`, group: closed ? "ended" : "authority", person: person(authority.personId),
        covers: authority.scopeAreas.length ? authority.scopeAreas.map(capitalise).join(", ") : "No areas yet",
        kind: AUTHORITY_LABEL[authority.authorityType] ?? "Legal authority",
        condition: authority.usableWhen === "lacks_capacity_only" ? "Only if you lack capacity" : "With your consent",
        chips: closed ? [{ tone: "neutral", icon: "block", label: capitalise(authority.status) }]
          : authority.activatedAt ? [{ tone: "ok", icon: "check_circle", label: "In effect" }]
          : [{ tone: "wait", icon: "hourglass_top", label: authority.status === "pending_check" ? "Authority being checked" : authority.status === "needs_attention" ? "Needs attention" : authority.status === "confirmed" ? "Confirmed · not active yet" : capitalise(authority.status) }, { tone: "neutral", icon: "lock", label: "Not in effect" }],
      });
    }
    return out;
  }, [snapshot]);

  const panelRow = rows.find((row) => row.key === panelKey);
  const openRequest = requests.find((item) => item.id === requestId);
  const counts = {
    now: rows.filter((row) => row.group === "now").length,
    later: rows.filter((row) => row.group === "later").length,
    authority: rows.filter((row) => row.group === "authority").length,
    ended: rows.filter((row) => row.group === "ended").length,
  };

  async function doCancel(nomination: VaultNomination) {
    setBusy(true);
    try {
      await cancelVaultNomination(supabase, ownerId, nomination.id);
      setConfirmCancel(null); setPanelKey("");
      const who = snapshot?.people.find((item) => item.id === nomination.personId);
      setToast(`Nomination cancelled.${who ? ` ${firstName(who.name)} has no access later.` : ""}`);
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t cancel the nomination."); }
    finally { setBusy(false); }
  }

  if (available === false) {
    return <section className="lf-va-empty"><Icon name="lock" size={22} /><div><strong>Vault access is being set up</strong><p>Nominations for later will appear here once this feature is switched on.</p></div></section>;
  }
  if (!snapshot) return <p className="lf-va-loading" role="status">{error || "Loading Vault access…"}</p>;

  return (
    <section className="lf-va" aria-label="Vault access">
      <div className="lf-va-toolbar">
        <p className="lf-va-summary">{counts.now} can see records now · {counts.later} nominated for later · {counts.authority} legal {counts.authority === 1 ? "authority" : "authorities"} · {counts.ended} ended</p>
        <button type="button" className="lf-va-primary" onClick={() => setSetupOpen(true)}><Icon name="key" size={18} />Set up Vault access</button>
      </div>
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
      {rows.length === 0 ? (
        <div className="lf-va-empty"><Icon name="key" size={22} /><div><strong>No one has Vault access</strong><p>Nominate someone to see your Vault after your death, or share selected records now. Nominating never gives access straight away.</p></div></div>
      ) : (
        <div className="lf-va-card" role="table" aria-label="Vault access">
          <div className="lf-va-head" role="row"><span role="columnheader">Person</span><span role="columnheader">Covers</span><span role="columnheader">Kind and condition</span><span role="columnheader">Status</span><span aria-hidden="true" /></div>
          {(["now", "later", "authority", "ended"] as const).map((group) => {
            const groupRows = rows.filter((row) => row.group === group);
            if (!groupRows.length) return null;
            return (
              <div key={group} role="rowgroup">
                <div className="lf-va-group" role="row"><span role="cell">{GROUP_TITLE[group]}</span></div>
                {groupRows.map((row) => (
                  <button key={row.key} type="button" className="lf-va-row" role="row" onClick={() => setPanelKey(row.key)} aria-label={`Open Vault access for ${row.person?.name ?? "this person"}`}>
                    <span role="cell" className="lf-va-person"><Avatar name={row.person?.name ?? "?"} /><span><strong>{row.person?.name ?? "Removed person"}</strong><small>{row.person?.relationship ?? "Relationship not recorded"}</small></span></span>
                    <span role="cell" className="lf-va-covers">{row.covers}</span>
                    <span role="cell" className="lf-va-kind">{row.kind}<small>{row.condition}</small></span>
                    <span role="cell" className="lf-va-chips">{row.chips.map((chip) => <Chip key={chip.label} {...chip} />)}</span>
                    <Icon name="chevron_right" size={20} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {panelRow ? (
        <SidePanel title={panelRow.person?.name ?? "Vault access"} subtitle={panelRow.person?.relationship ?? undefined} onClose={() => setPanelKey("")}>
          <PersonAccess row={panelRow} snapshot={snapshot} ownerId={ownerId} onChanged={async (message) => { setToast(message); await reload(); }} onCancel={(nomination) => setConfirmCancel(nomination)} onWithdraw={async (authorityId, reason) => { await withdrawLegalAuthority(supabase, ownerId, authorityId, reason); setPanelKey(""); setToast("Authority marked as withdrawn. It can’t be used."); await reload(); }} />
        </SidePanel>
      ) : null}

      {setupOpen ? <SetupDialog snapshot={snapshot} ownerId={ownerId} onClose={() => setSetupOpen(false)} onSaved={async (message) => { setSetupOpen(false); setToast(message); await reload(); }} onAttorney={(personId) => { setSetupOpen(false); setAttorneyFor(personId); }} /> : null}
      {attorneyFor ? <AttorneyDialog snapshot={snapshot} ownerId={ownerId} personId={attorneyFor} onClose={() => setAttorneyFor("")} onSaved={async (message) => { setAttorneyFor(""); setToast(message); await reload(); }} /> : null}

      {confirmCancel ? (
        <Dialog title="Cancel this nomination?" onClose={() => setConfirmCancel(null)}>
          <p>{firstName(snapshot.people.find((item) => item.id === confirmCancel.personId)?.name ?? "This person")} won’t get access to your Vault after your death. They have no access now, so nothing changes today. This is written to your Record history.</p>
          <p className="lf-va-muted">They stay in People and on the records they’re linked to.</p>
          <div className="lf-va-dialog-footer">
            <button type="button" className="lf-va-secondary" onClick={() => setConfirmCancel(null)}>Keep nomination</button>
            <button type="button" className="lf-va-danger" disabled={busy} onClick={() => void doCancel(confirmCancel)}>{busy ? "Cancelling…" : "Cancel nomination"}</button>
          </div>
        </Dialog>
      ) : null}

      {openRequest ? <EarlyAccessDialog request={openRequest} snapshot={snapshot} ownerId={ownerId} onClose={() => setRequestId("")} onAnswered={async (message) => { setRequestId(""); setToast(message); await reload(); }} /> : null}

      {toast ? <div className="lf-va-toast" role="status">{toast}</div> : null}
    </section>
  );
}

function PersonAccess({ row, snapshot, ownerId, onCancel, onWithdraw, onChanged }: { row: Row; snapshot: VaultAccessSnapshot; ownerId: string; onCancel: (nomination: VaultNomination) => void; onWithdraw: (authorityId: string, reason: string) => Promise<void>; onChanged: (message: string) => Promise<void> }) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const person = row.person;
  const name = firstName(person?.name ?? "This person");
  const nowGrant = snapshot.grants.find((grant) => grant.personId === person?.id && grant.source === "owner_grant" && grantIsOpen(grant));
  const later = snapshot.nominations.find((item) => item.personId === person?.id && item.status === "active");
  const authority = snapshot.authorities.find((item) => item.personId === person?.id && !["withdrawn", "ended", "rejected"].includes(item.status));
  return (
    <div className="lf-va-panel-body">
      <NowAccess grant={nowGrant} name={name} personId={person?.id ?? ""} ownerId={ownerId} onChanged={onChanged} />
      <section className="lf-va-fact">
        <header><strong>Later</strong>{later ? <Chip tone="neutral" icon="bookmark" label="Nominated" /> : <Chip tone="neutral" icon="remove" label="Not nominated" />}</header>
        {later ? (
          <dl>
            <div><dt>Kind</dt><dd>After your death</dd></div>
            <div><dt>Covers</dt><dd>{later.scope === "whole_vault" ? `Whole Vault${later.exceptionCount ? `, except ${later.exceptionCount} record${later.exceptionCount === 1 ? "" : "s"}` : ""}` : `${later.includeCount} selected record${later.includeCount === 1 ? "" : "s"}`}</dd></div>
            <div><dt>Released when</dt><dd>The death is verified, the grant of probate is confirmed and the release is approved</dd></div>
            <div><dt>{name} can</dt><dd>View only</dd></div>
            <div><dt>Told about it</dt><dd>{later.notifyPerson ? "Yes, with no record details" : "No"}</dd></div>
          </dl>
        ) : <p>{name} isn’t nominated to see your Vault after your death.</p>}
      </section>
      {authority ? (
        <section className="lf-va-fact" aria-label="Legal authority">
          <header><strong>Legal authority</strong><Chip tone={authority.activatedAt ? "ok" : "neutral"} icon={authority.activatedAt ? "check_circle" : "pause_circle"} label={authority.activatedAt ? "In effect" : "Not in effect"} /></header>
          <p>{AUTHORITY_LABEL[authority.authorityType] ?? "Legal authority"} · {authority.usableWhen === "lacks_capacity_only" ? "only if you lack mental capacity" : "with your agreement"}</p>
          <div className="lf-va-fact-row"><span>{name}’s identity</span><Chip {...identityChip(person)} /></div>
          <div className="lf-va-fact-row"><span>The authority</span><Chip tone={authority.status === "confirmed" ? "ok" : "wait"} icon={authority.status === "confirmed" ? "check_circle" : "hourglass_top"} label={authority.status === "confirmed" ? "Confirmed" : authority.status === "needs_attention" ? "Needs attention" : "Being checked"} /></div>
          <div className="lf-va-fact-row"><span>Could see</span><span>{authority.scopeAreas.map((area) => AREA_LABEL[area] ?? area).join(", ") || "No areas"}</span></div>
          {authority.reviewMessage ? <p className="lf-va-review-message"><Icon name="support_agent" size={18} /><span><strong>From our review team</strong>{authority.reviewMessage}</span></p> : null}
          {authority.activatedAt ? <p className="lf-va-muted">{name} can see these areas now, view only. Withdrawing stops it at once.</p> : null}
          {withdrawing ? (
            <div className="lf-va-step">
              <label className="lf-va-field" htmlFor="va-withdraw-reason">Why it’s being withdrawn<textarea id="va-withdraw-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example, I cancelled the LPA" /></label>
              {withdrawError ? <p className="lf-va-error" role="alert">{withdrawError}</p> : null}
              <div className="lf-va-dialog-footer"><button type="button" className="lf-va-secondary" onClick={() => setWithdrawing(false)}>Keep it</button><button type="button" className="lf-va-danger" onClick={() => void onWithdraw(authority.id, reason).catch((cause) => setWithdrawError(cause instanceof Error ? cause.message : "Couldn’t withdraw it."))}>Mark as withdrawn</button></div>
            </div>
          ) : <button type="button" className="lf-va-danger-text" onClick={() => setWithdrawing(true)}>Mark the authority as withdrawn</button>}
        </section>
      ) : null}
      <section className="lf-va-fact">
        <div className="lf-va-fact-row"><span>Invitation</span><Chip tone={person?.joined ? "ok" : "neutral"} icon={person?.joined ? "check_circle" : "schedule_send"} label={person?.joined ? "Joined" : capitalise(person?.invitation ?? "Not invited")} /></div>
        <div className="lf-va-fact-row"><span>Identity</span><Chip {...identityChip(person)} /></div>
      </section>
      {person ? <AccessHistory personId={person.id} revision={snapshot} /> : null}
      <p className="lf-va-note"><Icon name="info" size={18} />Nominations, invitations and ID checks never give access. Access opens only when you share records, or after an approved release.</p>
      <div className="lf-va-panel-footer">
        {person ? <Link className="lf-va-secondary" href={`/people-access?view=people&contact=${encodeURIComponent(person.id)}`}>Open person</Link> : <span />}
        {later ? <button type="button" className="lf-va-danger-text" onClick={() => onCancel(later)}>Cancel nomination</button> : null}
      </div>
    </div>
  );
}

function SetupDialog({ snapshot, ownerId, onClose, onSaved, onAttorney }: { snapshot: VaultAccessSnapshot; ownerId: string; onClose: () => void; onSaved: (message: string) => void | Promise<void>; onAttorney: (personId: string) => void }) {
  const [step, setStep] = useState(1);
  const [personId, setPersonId] = useState("");
  const [kind, setKind] = useState<"later" | "now" | "attorney" | "contact">("later");
  const [scope, setScope] = useState<"whole_vault" | "selected">("whole_vault");
  const [options, setOptions] = useState<VaultRecordOption[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nominated = new Set(snapshot.nominations.filter((item) => item.status === "active").map((item) => item.personId));
  const person = snapshot.people.find((item) => item.id === personId);
  const name = firstName(person?.name ?? "this person");

  useEffect(() => { if (step === 3 && !options) void loadVaultRecordOptions(supabase, ownerId).then(setOptions).catch(() => setOptions([])); }, [step, options, ownerId]);

  const chosenRecords = (options ?? []).filter((item) => chosen.includes(`${item.type}:${item.id}`));
  const filtered = (options ?? []).filter((item) => !search.trim() || `${item.title} ${item.area} ${item.section}`.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (item: VaultRecordOption) => {
    const key = `${item.type}:${item.id}`;
    setChosen((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  };

  async function save() {
    if (!person) return;
    setSaving(true); setError("");
    try {
      await saveVaultNomination(supabase, { personId: person.id, scope, records: chosenRecords, notifyPerson: notify });
      await onSaved(`${name} is nominated for later. Access now: none.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t save the nomination."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog title={step === 1 ? "Who is this for?" : step === 2 ? `What should ${name} get?` : step === 3 ? `What should ${name} get after your death?` : "Check and confirm"} eyebrow={`Vault access${person ? ` for ${name}` : ""} · Step ${step} of 4`} onClose={onClose}>
      {step === 1 ? (
        <div className="lf-va-choice-list" role="radiogroup" aria-label="Choose a person">
          {snapshot.people.length === 0 ? <p>Add the person in People first, then set up their Vault access.</p> : null}
          {snapshot.people.map((item) => (
            <label key={item.id} className={`lf-va-choice${personId === item.id ? " is-selected" : ""}`}>
              <input type="radio" name="va-person" value={item.id} checked={personId === item.id} onChange={() => { setPersonId(item.id); setNotify(item.joined); }} />
              <Avatar name={item.name} />
              <span><strong>{item.name}</strong><small>{[item.relationship, nominated.has(item.id) ? "Already nominated for later" : null].filter(Boolean).join(" · ") || "Relationship not recorded"}</small></span>
            </label>
          ))}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="lf-va-choice-list" role="radiogroup" aria-label="Kind of Vault access">
          <Choice name="va-kind" checked={kind === "later"} onChange={() => setKind("later")} title="After my death" detail="Your whole Vault or selected records, released only after the death is verified and the grant of probate is confirmed." />
          <Choice name="va-kind" checked={kind === "now"} onChange={() => setKind("now")} title="Now, while I’m alive" detail="Share selected records with them now. You choose the records in Give access." />
          <Choice name="va-kind" checked={kind === "attorney"} onChange={() => setKind("attorney")} title="Under a Power of Attorney" detail="Record their legal authority. Three separate checks happen before it takes effect." />
          <Choice name="va-kind" checked={kind === "contact"} onChange={() => setKind("contact")} title="Contact only" detail="Keep them in People with no access." />
        </div>
      ) : null}
      {step === 3 ? (
        <div className="lf-va-step">
          <div className="lf-va-choice-list" role="radiogroup" aria-label="What the nomination covers">
            <Choice name="va-scope" checked={scope === "whole_vault"} onChange={() => { setScope("whole_vault"); setChosen([]); }} title="Your whole Vault" detail="Everything in your Vault when it’s released, including records you add later today." />
            <Choice name="va-scope" checked={scope === "selected"} onChange={() => { setScope("selected"); setChosen([]); }} title="Selected records" detail="Only the records you choose. New records aren’t added unless you add them." />
          </div>
          <h3 className="lf-va-subhead">{scope === "whole_vault" ? "Keep out of this nomination · Optional" : `Choose records · ${chosen.length} selected`}</h3>
          <label className="lf-va-search"><Icon name="search" size={18} /><span className="lf-visually-hidden">Search records</span><input id="va-record-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your records" /></label>
          <div className="lf-va-records">
            {options === null ? <p role="status">Loading your records…</p> : filtered.length === 0 ? <p>No records match.</p> : filtered.slice(0, 200).map((item) => (
              <label key={`${item.type}:${item.id}`} className="lf-va-record">
                <input type="checkbox" checked={chosen.includes(`${item.type}:${item.id}`)} onChange={() => toggle(item)} />
                <span><strong>{item.title}</strong><small>{item.area} › {item.section}</small></span>
              </label>
            ))}
          </div>
          <p className="lf-va-note"><Icon name="info" size={18} />Never included: Vaults of other people you’re linked to, and Legacy Fortress staff areas.</p>
        </div>
      ) : null}
      {step === 4 && person ? (
        <div className="lf-va-step">
          <dl className="lf-va-check">
            <div><dt>Person</dt><dd>{person.name}{person.relationship ? ` · ${person.relationship}` : ""}</dd></div>
            <div><dt>Kind</dt><dd>After your death</dd></div>
            <div><dt>Covers</dt><dd>{scope === "whole_vault" ? `Whole Vault${chosen.length ? `, except ${chosen.length} record${chosen.length === 1 ? "" : "s"}` : ""}` : `${chosen.length} selected record${chosen.length === 1 ? "" : "s"}`}<button type="button" className="lf-va-link" onClick={() => setStep(3)}>Change</button></dd></div>
            <div><dt>Released when</dt><dd>The death is verified, the grant of probate is confirmed and the release is approved</dd></div>
            <div><dt>{name} can</dt><dd>View only</dd></div>
          </dl>
          <p className="lf-va-access-now"><Icon name="lock" size={18} /><span><strong>Access now: none.</strong> Confirming doesn’t let {name} see anything today.</span></p>
          <label className="lf-va-notify">
            <span><strong>Tell {name} they’re nominated</strong><small>They’ll see that they’re nominated and nothing else: no record names, values or what’s covered.</small></span>
            <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          </label>
          {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
        </div>
      ) : null}
      <div className="lf-va-dialog-footer">
        {step > 1 ? <button type="button" className="lf-va-secondary" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        {step === 1 ? <button type="button" className="lf-va-primary" disabled={!personId} onClick={() => setStep(2)}>Continue</button> : null}
        {step === 2 ? (
          kind === "later" ? <button type="button" className="lf-va-primary" disabled={nominated.has(personId)} onClick={() => setStep(3)}>{nominated.has(personId) ? "Already nominated" : "Continue"}</button>
          : kind === "now" ? <Link className="lf-va-primary" href={`/people-access?view=people&contact=${encodeURIComponent(personId)}`}>Choose records in Give access</Link>
          : kind === "attorney" ? <button type="button" className="lf-va-primary" onClick={() => onAttorney(personId)}>Continue</button>
          : <button type="button" className="lf-va-primary" onClick={onClose}>Done</button>
        ) : null}
        {step === 3 ? <button type="button" className="lf-va-primary" disabled={scope === "selected" && chosen.length === 0} onClick={() => setStep(4)}>Continue</button> : null}
        {step === 4 ? <button type="button" className="lf-va-primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Confirm nomination"}</button> : null}
      </div>
    </Dialog>
  );
}

function AttorneyDialog({ snapshot, ownerId, personId, onClose, onSaved }: { snapshot: VaultAccessSnapshot; ownerId: string; personId: string; onClose: () => void; onSaved: (message: string) => void | Promise<void> }) {
  const person = snapshot.people.find((item) => item.id === personId);
  const name = firstName(person?.name ?? "this person");
  const [step, setStep] = useState(1);
  const [type, setType] = useState<AuthorityType | "">("");
  const [documents, setDocuments] = useState<AuthorityDocument[] | null>(null);
  const [documentKey, setDocumentKey] = useState("");
  const [registered, setRegistered] = useState<"yes" | "no" | "unknown" | "">("");
  const [reference, setReference] = useState("");
  const [usableWhen, setUsableWhen] = useState<"with_consent" | "lacks_capacity_only" | "">("");
  const [areas, setAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (step === 2 && documents === null) void loadAuthorityDocuments(supabase, ownerId).then(setDocuments).catch(() => setDocuments([])); }, [step, documents, ownerId]);
  const allowed = type ? AUTHORITY_AREAS[type] : [];
  const document = (documents ?? []).find((item) => `${item.type}:${item.id}` === documentKey);
  const healthWelfare = type === "lpa_health_welfare";
  const chooseType = (value: AuthorityType) => { setType(value); setAreas(AUTHORITY_AREAS[value]); if (value === "lpa_health_welfare") setUsableWhen("lacks_capacity_only"); };

  async function save() {
    if (!type || !document || !registered || !(usableWhen || healthWelfare)) return;
    setSaving(true); setError("");
    try {
      await recordLegalAuthority(supabase, ownerId, { personId, authorityType: type, registered, registrationRef: reference, usableWhen: (usableWhen || "lacks_capacity_only") as "with_consent" | "lacks_capacity_only", document, areas });
      await onSaved(`${name}’s authority is recorded. It isn’t in effect yet.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t record the authority."); }
    finally { setSaving(false); }
  }

  const titles = ["", `What authority have you given ${name}?`, `About ${name}’s authority`, `What could ${name} see?`, "Before it takes effect", "Check and confirm"];
  return (
    <Dialog title={titles[step]} eyebrow={`Power of Attorney for ${name} · Step ${step} of 5`} onClose={onClose}>
      {step === 1 ? (
        <div className="lf-va-choice-list" role="radiogroup" aria-label="Kind of authority">
          {AUTHORITY_CHOICES.map((choice) => <Choice key={choice.value} name="va-authority" checked={type === choice.value} onChange={() => chooseType(choice.value)} title={choice.title} detail={choice.detail} />)}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="lf-va-step">
          <h3 className="lf-va-subhead">The document (required)</h3>
          {documents === null ? <p role="status">Loading your documents…</p> : documents.length === 0 ? (
            <p className="lf-va-note"><Icon name="info" size={18} />Upload the signed authority to Legal › Power of Attorney first, then come back.</p>
          ) : (
            <div className="lf-va-records">{documents.slice(0, 100).map((item) => (
              <label key={`${item.type}:${item.id}`} className="lf-va-record"><input type="radio" name="va-authority-doc" checked={documentKey === `${item.type}:${item.id}`} onChange={() => setDocumentKey(`${item.type}:${item.id}`)} /><span><strong>{item.name}</strong><small>{item.where}{item.added ? ` · added ${item.added}` : ""}</small></span></label>
            ))}</div>
          )}
          <h3 className="lf-va-subhead">Registered with the Office of the Public Guardian?</h3>
          <div className="lf-va-segmented" role="radiogroup" aria-label="Registered">
            {([["yes", "Yes"], ["no", "Not yet"], ["unknown", "Not sure"]] as const).map(([value, label]) => <label key={value} className={registered === value ? "is-selected" : ""}><input type="radio" name="va-registered" checked={registered === value} onChange={() => setRegistered(value)} />{label}</label>)}
          </div>
          <label className="lf-va-field" htmlFor="va-reference">Reference number · Optional<input id="va-reference" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={60} placeholder="e.g. 7000-1234-5678" /></label>
          <h3 className="lf-va-subhead">When can {name} use it?</h3>
          <div className="lf-va-choice-list" role="radiogroup" aria-label="When it can be used">
            <Choice name="va-usable" checked={usableWhen === "with_consent"} onChange={() => setUsableWhen("with_consent")} title="While I have mental capacity, with my agreement" detail="" disabled={healthWelfare} />
            <Choice name="va-usable" checked={usableWhen === "lacks_capacity_only"} onChange={() => setUsableWhen("lacks_capacity_only")} title="Only if I lack mental capacity" detail={healthWelfare ? "A health and welfare LPA can only be used this way." : ""} />
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="lf-va-step">
          <p className="lf-va-muted">Ticked to match this authority. You can untick areas. You can’t add areas it doesn’t cover.</p>
          <div className="lf-va-records">
            {Object.keys(AREA_LABEL).filter((area) => area !== "legal").map((area) => {
              const covered = allowed.includes(area);
              return <label key={area} className={`lf-va-record${covered ? "" : " is-disabled"}`}><input type="checkbox" disabled={!covered} checked={covered && areas.includes(area)} onChange={() => setAreas((current) => current.includes(area) ? current.filter((item) => item !== area) : [...current, area])} /><span><strong>{AREA_LABEL[area]}</strong><small>{covered ? "Covered by this authority" : "Not covered by this authority"}</small></span></label>;
            })}
          </div>
          <p className="lf-va-note"><Icon name="info" size={18} />An attorney can’t make or change your Will, so Wills are never included.</p>
        </div>
      ) : null}
      {step === 4 ? (
        <ol className="lf-va-checks">
          <li><span>1</span><div><strong>{name} proves who they are</strong><small>An ID check after they join. It proves identity only.</small></div></li>
          <li><span>2</span><div><strong>We check the authority</strong><small>Our team reviews the document and checks the register where we can.</small></div></li>
          <li><span>3</span><div><strong>It can be used now</strong><small>{usableWhen === "lacks_capacity_only" || healthWelfare ? `You chose “only if I lack mental capacity”. ${name} asks for access and gives evidence; our team decides.` : "You chose “with my agreement”. Our team confirms with you before it takes effect."}</small></div></li>
        </ol>
      ) : null}
      {step === 5 && type ? (
        <div className="lf-va-step">
          <dl className="lf-va-check">
            <div><dt>Attorney</dt><dd>{person?.name}{person?.relationship ? ` · ${person.relationship}` : ""}</dd></div>
            <div><dt>Authority</dt><dd>{AUTHORITY_LABEL[type]}{registered === "yes" ? " · registered" : registered === "no" ? " · not registered yet" : ""}</dd></div>
            <div><dt>Can be used</dt><dd>{usableWhen === "with_consent" && !healthWelfare ? "With your agreement" : "Only if you lack mental capacity"}</dd></div>
            <div><dt>Could see</dt><dd>{areas.map((area) => AREA_LABEL[area]).join(", ") || "No areas"} · view only<button type="button" className="lf-va-link" onClick={() => setStep(3)}>Change</button></dd></div>
          </dl>
          <p className="lf-va-access-now"><Icon name="lock" size={18} /><span><strong>Access now: none.</strong> Recording the authority doesn’t let {name} see anything. It starts only after the checks.</span></p>
          {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
        </div>
      ) : null}
      <div className="lf-va-dialog-footer">
        {step > 1 ? <button type="button" className="lf-va-secondary" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        {step === 1 ? <button type="button" className="lf-va-primary" disabled={!type} onClick={() => setStep(2)}>Continue</button> : null}
        {step === 2 ? <button type="button" className="lf-va-primary" disabled={!document || !registered || !(usableWhen || healthWelfare)} onClick={() => setStep(3)}>Continue</button> : null}
        {step === 3 ? <button type="button" className="lf-va-primary" disabled={areas.length === 0} onClick={() => setStep(4)}>Continue</button> : null}
        {step === 4 ? <button type="button" className="lf-va-primary" onClick={() => setStep(5)}>Continue</button> : null}
        {step === 5 ? <button type="button" className="lf-va-primary" disabled={saving} onClick={() => void save()}>{saving ? "Recording…" : "Record authority"}</button> : null}
      </div>
    </Dialog>
  );
}

function Choice({ name, checked, onChange, title, detail, disabled }: { name: string; checked: boolean; onChange: () => void; title: string; detail: string; disabled?: boolean }) {
  return (
    <label className={`lf-va-choice${checked ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} />
      <span><strong>{title}</strong><small>{detail}</small></span>
    </label>
  );
}

function Dialog({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="lf-va-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={ref} className="lf-va-dialog" role="dialog" aria-modal="true" aria-labelledby="lf-va-dialog-title" tabIndex={-1}>
        <header>{eyebrow ? <small>{eyebrow}</small> : null}<h2 id="lf-va-dialog-title">{title}</h2><button type="button" className="lf-va-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></header>
        <div className="lf-va-dialog-body">{children}</div>
      </div>
    </div>
  );
}

function SidePanel({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="lf-va-scrim lf-va-scrim--panel" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={ref} className="lf-va-panel" role="dialog" aria-modal="true" aria-labelledby="lf-va-panel-title" tabIndex={-1}>
        <header><Avatar name={title} /><span><h2 id="lf-va-panel-title">{title}</h2>{subtitle ? <small>{subtitle}</small> : null}</span><button type="button" className="lf-va-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></header>
        {children}
      </aside>
    </div>
  );
}

function Chip({ tone, icon, label }: { tone: "ok" | "wait" | "neutral" | "stop"; icon: string; label: string }) {
  return <span className={`lf-va-chip is-${tone}`}><Icon name={icon} size={14} />{label}</span>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  return <span className="lf-va-avatar" aria-hidden="true">{initials}</span>;
}

/** "unverified" must never read as verified, and someone who hasn't joined can't have checked their ID. */
function idVerified(person: VaultAccessPerson | undefined) {
  return Boolean(person?.joined) && /^(verified|identity_verified|id_verified|approved)$/i.test(String(person?.identity ?? "").trim());
}

function identityChip(person: VaultAccessPerson | undefined) {
  if (!person?.joined) return { tone: "neutral" as const, icon: "person_add", label: "Not joined yet" };
  return idVerified(person) ? { tone: "ok" as const, icon: "verified_user", label: "ID verified" } : { tone: "neutral" as const, icon: "badge", label: "ID not checked" };
}

function capitalise(value: string) {
  const text = String(value || "").replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}


function NowAccess({ grant, name, personId, ownerId, onChanged }: { grant: VaultGrant | undefined; name: string; personId: string; ownerId: string; onChanged: (message: string) => Promise<void> }) {
  const [titles, setTitles] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"" | "stop" | "end">("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tomorrow] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  useEffect(() => {
    let active = true;
    if (!grant) return;
    void loadGrantRecordTitles(supabase, ownerId, grant).then((value) => { if (active) setTitles(value); });
    return () => { active = false; };
  }, [grant, ownerId]);
  if (!grant) {
    return <section className="lf-va-fact">
      <header><strong>Now</strong><Chip tone="neutral" icon="lock" label="No access" /></header>
      <p>{name} can’t see any of your records.</p>
      {personId ? <Link className="lf-va-link-button" href={`/people-access?view=people&contact=${encodeURIComponent(personId)}`}>Give access</Link> : null}
    </section>;
  }
  const count = grant.assetIds.length + grant.recordIds.length;
  async function run(action: () => Promise<void>, message: string) {
    setSaving(true); setError("");
    try { await action(); setMode(""); setNote(""); await onChanged(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t save."); }
    finally { setSaving(false); }
  }
  return <section className="lf-va-fact" aria-label="Access now">
    <header><strong>Now</strong><Chip tone="ok" icon="visibility" label={`Can see ${count} record${count === 1 ? "" : "s"}`} /></header>
    <ul className="lf-va-record-list">{(titles ?? []).slice(0, 8).map((title, index) => <li key={index}><Icon name="description" size={16} />{title}</li>)}{titles && titles.length > 8 ? <li>and {titles.length - 8} more</li> : null}</ul>
    <dl>
      <div><dt>{name} can</dt><dd>View only</dd></div>
      <div><dt>Until</dt><dd>{grant.endsAt ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(grant.endsAt)) : "You stop it"}</dd></div>
    </dl>
    {mode === "stop" ? <div className="lf-va-step" role="group" aria-label={`Stop ${name}’s access`}>
      <p><strong>Stop {name}’s access?</strong> {name} won’t be able to see {count === 1 ? "this record" : `these ${count} records`} any more. This happens straight away.</p>
      <label className="lf-va-field" htmlFor="va-stop-note">Note for your Record history · Optional<input id="va-stop-note" value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="For example, changed adviser" /></label>
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
      <div className="lf-va-dialog-footer"><button type="button" className="lf-va-secondary" onClick={() => setMode("")}>Keep access</button><button type="button" className="lf-va-danger" disabled={saving} onClick={() => void run(() => stopVaultAccess(supabase, grant.id, note), `${name}’s access stopped.`)}>{saving ? "Stopping…" : "Stop access"}</button></div>
    </div> : mode === "end" ? <div className="lf-va-step" role="group" aria-label="Change end date">
      <label className="lf-va-field" htmlFor="va-end-date">Access ends on<input id="va-end-date" type="date" min={tomorrow} value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <p className="lf-va-muted">Access stops automatically at the end of that day and shows in Ended.</p>
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
      <div className="lf-va-dialog-footer">
        {grant.endsAt ? <button type="button" className="lf-va-secondary" disabled={saving} onClick={() => void run(() => setVaultAccessEndDate(supabase, ownerId, grant.id, null), "End date removed. Access continues until you stop it.")}>Remove end date</button> : <button type="button" className="lf-va-secondary" onClick={() => setMode("")}>Cancel</button>}
        <button type="button" className="lf-va-primary" disabled={saving || !date} onClick={() => void run(() => setVaultAccessEndDate(supabase, ownerId, grant.id, date), "End date saved.")}>{saving ? "Saving…" : "Save end date"}</button>
      </div>
    </div> : <div className="lf-va-actions">
      <Link className="lf-va-action-row" href={`/people-access?view=people&contact=${encodeURIComponent(personId)}`}>Change records<Icon name="chevron_right" size={18} /></Link>
      <button type="button" className="lf-va-action-row" onClick={() => { setDate(grant.endsAt ? grant.endsAt.slice(0, 10) : ""); setMode("end"); }}>{grant.endsAt ? "Change end date" : "Add an end date"}<Icon name="chevron_right" size={18} /></button>
      <button type="button" className="lf-va-danger-text" onClick={() => setMode("stop")}>Stop access</button>
    </div>}
  </section>;
}

function AccessHistory({ personId, revision }: { personId: string; revision: unknown }) {
  const [items, setItems] = useState<VaultAccessHistoryItem[] | null>(null);
  useEffect(() => {
    let active = true;
    void loadVaultAccessHistory(supabase, personId).then((value) => { if (active) setItems(value); });
    return () => { active = false; };
  }, [personId, revision]);
  if (!items || !items.length) return null;
  return <details className="lf-va-fact lf-va-history">
    <summary><strong>Record history</strong><small>{items.length} event{items.length === 1 ? "" : "s"}</small></summary>
    <ol>{items.map((item, index) => { const text = describeHistory(item); return <li key={index}>
      <Icon name={text.icon} size={18} />
      <span><strong>{text.title}</strong><small>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.at))}{item.note ? " · note added" : ""}</small>{item.note ? <em>{item.note}</em> : null}</span>
    </li>; })}</ol>
  </details>;
}


function EarlyAccessDialog({ request, snapshot, ownerId, onClose, onAnswered }: { request: EarlyAccessRequest; snapshot: VaultAccessSnapshot; ownerId: string; onClose: () => void; onAnswered: (message: string) => Promise<void> }) {
  const person = snapshot.people.find((item) => item.id === request.personId);
  const name = firstName(person?.name ?? "This person");
  const nomination = snapshot.nominations.find((item) => item.id === request.nominationId);
  const grant = snapshot.grants.find((item) => item.personId === request.personId && item.source === "owner_grant" && grantIsOpen(item));
  const count = grant ? grant.assetIds.length + grant.recordIds.length : 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decline() {
    setBusy(true); setError("");
    try { await answerEarlyAccessRequest(supabase, ownerId, request.id, "declined"); await onAnswered(`Request answered. Nothing was shared with ${name}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t save."); }
    finally { setBusy(false); }
  }
  return <Dialog title={`${name} asked for access now`} eyebrow="Needs you" onClose={onClose}>
    {request.message ? <blockquote className="lf-va-request-message"><small>{name}’s message · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(request.createdAt))}</small>{request.message}</blockquote> : null}
    <dl className="lf-va-request-facts">
      <div><dt>{name} can see now</dt><dd>{count ? `${count} record${count === 1 ? "" : "s"}` : "Nothing"}</dd></div>
      <div><dt>Arranged for later</dt><dd>{nomination ? (nomination.scope === "whole_vault" ? "Whole Vault after your death" : `${nomination.includeCount} record${nomination.includeCount === 1 ? "" : "s"} after your death`) : "Nothing"}</dd></div>
    </dl>
    <p className="lf-va-muted"><Icon name="info" size={16} />Nothing changes unless you share something. If you do, you choose exactly which records.</p>
    {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
    <div className="lf-va-dialog-footer">
      <button type="button" className="lf-va-secondary" disabled={busy} onClick={() => void decline()}>{busy ? "Saving…" : "Not now"}</button>
      <Link className="lf-va-primary" href={`/people-access?view=people&contact=${encodeURIComponent(request.personId)}`}>Choose records to share</Link>
    </div>
  </Dialog>;
}
