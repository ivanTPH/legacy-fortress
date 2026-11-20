"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../../../../components/ui/Icon";
import { waitForActiveUser } from "../../../../lib/auth/session";
import { supabase } from "../../../../lib/supabaseClient";
import { buildExecutorPack, firstSteps, type PackPerson, type PackSourceRow } from "../../../../lib/vault/executorPack";
import { SettingsCard, SettingsPageShell, StatusNote } from "../../components/settings/SettingsPrimitives";

type Loaded = { ownerName: string; rows: PackSourceRow[]; documentCounts: Map<string, number>; people: PackPerson[] };

/**
 * Executor pack (stage 4, 20 Nov 2026): a summary to print or save as a PDF for the people who will sort things out.
 * Owner-only, built here from the owner's own rows; never includes account or policy numbers, addresses or passwords.
 */
export default function ExecutorPackPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [includeValues, setIncludeValues] = useState(false);

  const load = useCallback(async () => {
    try {
      const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
      if (!user) { setError("Sign in to make your executor pack."); return; }
      const [assets, records, documents, attachments, contacts, profile] = await Promise.all([
        supabase.from("assets").select("id,section_key,category_key,title,provider_name,value_minor,currency_code,status,archived_at,deleted_at,metadata:metadata_json").eq("owner_user_id", user.id).is("deleted_at", null).limit(2000),
        supabase.from("records").select("id,section_key,category_key,title,provider_name,value_minor,currency_code,status,archived_at,metadata").eq("owner_user_id", user.id).limit(2000),
        supabase.from("documents").select("asset_id").eq("owner_user_id", user.id).is("deleted_at", null).limit(5000),
        supabase.from("attachments").select("record_id").eq("owner_user_id", user.id).limit(5000),
        supabase.from("contacts").select("full_name,contact_role,relationship,linked_user_id").eq("owner_user_id", user.id).limit(1000),
        supabase.from("user_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      ]);
      if (assets.error && records.error) { setError("Your Vault couldn’t be loaded. Try again in a moment."); return; }
      const counts = new Map<string, number>();
      for (const row of [...((documents.data ?? []) as Array<{ asset_id: string | null }>).map((d) => d.asset_id), ...((attachments.data ?? []) as Array<{ record_id: string | null }>).map((a) => a.record_id)]) {
        if (row) counts.set(row, (counts.get(row) ?? 0) + 1);
      }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const ownerName = String((profile.data as { display_name?: string } | null)?.display_name ?? meta.full_name ?? meta.name ?? "");
      setLoaded({
        ownerName,
        rows: [...((assets.data ?? []) as PackSourceRow[]), ...((records.data ?? []) as PackSourceRow[])],
        documentCounts: counts,
        people: ((contacts.data ?? []) as Array<{ full_name: string | null; contact_role: string | null; relationship: string | null; linked_user_id: string | null }>)
          .map((row) => ({ name: String(row.full_name ?? "").trim() || "Someone", role: row.contact_role, relationship: row.relationship, joined: Boolean(row.linked_user_id) })),
      });
    } catch {
      setError("Your Vault couldn’t be loaded. Try again in a moment.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    document.body.classList.add("lf-print-pack");
    return () => document.body.classList.remove("lf-print-pack");
  }, []);

  const pack = useMemo(() => (loaded ? buildExecutorPack({ ...loaded, includeValues }) : null), [loaded, includeValues]);
  const steps = useMemo(() => firstSteps(typeof window === "undefined" ? "https://www.mylegacyfortress.com" : window.location.origin), []);

  return (
    <SettingsPageShell title="Executor pack" subtitle="A summary of what’s in your Vault and who to contact, to print or save as a PDF and keep with your Will.">
      <SettingsCard title="Before you print">
        <p className="lf-pack-intro">It lists what you have and who it’s with, so your executors know where to look. Account and policy numbers, addresses and passwords are never included.</p>
        <label className="lf-pack-toggle"><input type="checkbox" checked={includeValues} onChange={(event) => setIncludeValues(event.target.checked)} /> Include estimated values</label>
        <div><button type="button" className="lf-pack-print" disabled={!pack} onClick={() => window.print()}><Icon name="print" size={20} />Print or save as PDF</button></div>
        <StatusNote message={error} />
      </SettingsCard>

      {!pack && !error ? <p role="status" className="lf-pack-muted">Preparing your pack…</p> : null}
      {pack ? (
        <article className="lf-pack" aria-label="Executor pack preview">
          <header className="lf-pack-head">
            <p className="lf-pack-eyebrow">Legacy Fortress · Executor pack</p>
            <h2>{pack.ownerName}</h2>
            <p className="lf-pack-muted">Prepared on {pack.preparedOn} · {pack.totals.records} {pack.totals.records === 1 ? "record" : "records"} · {pack.totals.documents} {pack.totals.documents === 1 ? "document" : "documents"} stored</p>
          </header>

          <section>
            <h3>The Will</h3>
            <p>{pack.willNote}</p>
            <p className="lf-pack-line">Where the original is kept: ________________________________</p>
          </section>

          <section>
            <h3>People named</h3>
            {pack.executors.length || pack.attorneys.length ? (
              <ul className="lf-pack-people">
                {pack.executors.map((person, index) => <li key={`e${index}`}><strong>{person.name}</strong> · Executor{person.relationship ? ` · ${person.relationship}` : ""}</li>)}
                {pack.attorneys.map((person, index) => <li key={`a${index}`}><strong>{person.name}</strong> · Attorney{person.relationship ? ` · ${person.relationship}` : ""}</li>)}
              </ul>
            ) : <p className="lf-pack-muted">No executors or attorneys are recorded yet. Add them in People.</p>}
          </section>

          {pack.sections.map((section) => (
            <section key={section.key}>
              <h3>{section.heading}</h3>
              <table className="lf-pack-table">
                <thead><tr><th scope="col">What</th><th scope="col">Type</th><th scope="col">Who it’s with</th>{includeValues ? <th scope="col">Estimated value</th> : null}<th scope="col">Copies in Vault</th></tr></thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td><td>{item.type ?? ""}</td><td>{item.provider ?? ""}</td>
                      {includeValues ? <td>{item.value ?? ""}</td> : null}
                      <td>{item.documents || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
          {!pack.sections.length ? <p className="lf-pack-muted">Nothing has been added to your Vault yet.</p> : null}

          <section>
            <h3>First steps for executors</h3>
            <ol className="lf-pack-steps">{steps.map((line) => <li key={line}>{line}</li>)}</ol>
          </section>
          <p className="lf-pack-foot">This is a summary, not a legal document. Account details stay in Legacy Fortress and are only shared as the owner chose.</p>
        </article>
      ) : null}
    </SettingsPageShell>
  );
}
