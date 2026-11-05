"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { DOCUMENT_EXTRACTION_EVENT, saveConfirmedDocumentDate, stageBankPrefill, type DocumentExtractionEventDetail } from "@/lib/documents/extraction/client";
import { formatDocumentDate, type DocumentDateFinding } from "@/lib/documents/extraction/documentDates";

/**
 * V5.2 "We found in this document" for account details read from a statement.
 * Suggestions only: nothing changes until the owner chooses. Numbers show as "ending 7781".
 */
export default function DocumentFindings({ recordId, table, onDateSaved }: {
  recordId: string;
  /** Where this record lives, so a confirmed date can be saved on it. */
  table?: "assets" | "records";
  onDateSaved?: (metadata: Record<string, unknown>) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<DocumentExtractionEventDetail | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onExtraction = (event: Event) => {
      const detail = (event as CustomEvent<DocumentExtractionEventDetail>).detail;
      if (detail?.recordId !== recordId) return;
      setDismissed(false);
      setState(detail);
    };
    window.addEventListener(DOCUMENT_EXTRACTION_EVENT, onExtraction);
    return () => window.removeEventListener(DOCUMENT_EXTRACTION_EVENT, onExtraction);
  }, [recordId]);

  if (!state || dismissed) return null;
  if (state.status === "reading") {
    return <p className="lf-v52-finding-status" role="status"><Icon name="document_scanner" size={18} />Reading the document for names and details…</p>;
  }
  const result = state.result;
  if (state.status === "failed" || !result?.ok) {
    return <p className="lf-v52-finding-status" role="status">The document was saved. We couldn’t read it for suggestions this time.</p>;
  }
  if (!result.readable) {
    return <p className="lf-v52-finding-status" role="status">The document was saved. We couldn’t find readable text in it.</p>;
  }
  const account = result.account;
  const people = result.peopleSuggested ?? 0;
  if (result.dateFinding && table) {
    return <DateFinding finding={result.dateFinding} recordId={recordId} table={table} onSaved={onDateSaved} onClose={() => setDismissed(true)} people={people} />;
  }
  if (!account) {
    return <p className="lf-v52-finding-status" role="status">{people ? `We found ${people === 1 ? "1 person" : `${people} people`} named in this document. Review them under People linked to this record.` : "We read the document and found nothing to suggest."}</p>;
  }

  const d = account.display;
  const title = [d.provider, d.accountType].filter(Boolean).join(" · ") || "Bank account";
  const ending = d.accountEnding ? `ending ${d.accountEnding}` : "";
  const balance = d.closingBalance ? new Intl.NumberFormat("en-GB", { style: "currency", currency: d.currency || "GBP" }).format(Number(d.closingBalance)) : null;
  const asOf = d.asOf ? new Date(d.asOf).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

  // A new account is a question first: nothing is added until the owner says yes and then checks the details.
  if (account.status === "new_account") {
    return (
      <section className="lf-v52-findings" aria-labelledby={`findings-${recordId}`}>
        <h3 id={`findings-${recordId}`}>This looks like a new bank account</h3>
        <div className="lf-v52-finding-row">
          <span className="lf-v52-finding-icon" aria-hidden="true"><Icon name="account_balance" size={20} /></span>
          <div className="lf-v52-finding-copy">
            <strong>{title}{ending ? ` ${ending}` : ""}</strong>
            <small>Not in your Vault yet.{balance ? ` Closing balance ${balance}${asOf ? ` on ${asOf}` : ""}.` : ""} Page {account.page}.</small>
          </div>
        </div>
        <p className="lf-v52-finding-question">Do you want to add it to your Vault? You’ll check every detail before anything is saved, and this statement will move to the new account.</p>
        <div className="lf-v52-finding-actions">
          <button type="button" className="lf-v52-finding-primary" onClick={() => { stageBankPrefill(account.prefill, state.documentId); router.push("/finances/bank?add=1&prefill=document"); }}>Yes, check the details</button>
          <button type="button" onClick={() => setDismissed(true)}>No, keep it here</button>
        </div>
        {people ? <p className="lf-v52-finding-note">We also found {people === 1 ? "1 person" : `${people} people`} to review under People linked to this record.</p> : null}
        <p className="lf-v52-finding-note">Read inside Legacy Fortress and never shared. It can make mistakes, so check before you save.</p>
      </section>
    );
  }

  return (
    <section className="lf-v52-findings" aria-labelledby={`findings-${recordId}`}>
      <h3 id={`findings-${recordId}`}>We found in this document</h3>
      <div className="lf-v52-finding-row">
        <span className="lf-v52-finding-icon" aria-hidden="true"><Icon name="account_balance" size={20} /></span>
        <div className="lf-v52-finding-copy">
          <strong>{title}{ending ? ` ${ending}` : ""}</strong>
          <small>
            {account.status === "matches_this_record" ? "Matches this account." : "Matches a different account in your Vault."}
            {balance ? ` Closing balance ${balance}${asOf ? ` on ${asOf}` : ""}.` : ""} Page {account.page}.
          </small>
        </div>
      </div>
      <div className="lf-v52-finding-actions">
        {account.status === "matches_other_record" && account.otherRecordId ? (
          <Link className="lf-v52-finding-primary" href={`/finances/bank?asset=${encodeURIComponent(account.otherRecordId)}`}>Open that account</Link>
        ) : null}
        <button type="button" onClick={() => setDismissed(true)}>{account.status === "matches_this_record" ? "Done" : "Keep here"}</button>
      </div>
      {people ? <p className="lf-v52-finding-note">We also found {people === 1 ? "1 person" : `${people} people`} to review under People linked to this record.</p> : null}
      <p className="lf-v52-finding-note">Read inside Legacy Fortress and never shared. It can make mistakes, so check before you save.</p>
    </section>
  );
}

/**
 * "This Will looks like it was signed on 12 March 2014. Save this date?" (owner decision 5 Nov 2026).
 * The owner confirms or ignores it; an expiry date in the past is pointed out, never refused.
 */
function DateFinding({ finding, recordId, table, onSaved, onClose, people }: {
  finding: DocumentDateFinding;
  recordId: string;
  table: "assets" | "records";
  onSaved?: (metadata: Record<string, unknown>) => void;
  onClose: () => void;
  people: number;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const isWill = finding.kind === "will_signed_on";
  const when = formatDocumentDate(finding.date);
  const expired = !isWill && finding.date < new Date().toISOString().slice(0, 10);
  async function save() {
    setSaving(true);
    const saved = await saveConfirmedDocumentDate(table, recordId, finding.kind, finding.date);
    setSaving(false);
    if (!saved.ok) { setMessage("We couldn’t save the date. You can add it when you edit this record."); return; }
    onSaved?.(saved.metadata);
    setMessage(isWill ? "Saved. We’ll suggest checking your Will every 3 years from this date." : "Saved. We’ll remind you about 3 months before it expires.");
  }
  return (
    <section className="lf-v52-findings" aria-labelledby={`date-finding-${recordId}`}>
      <h3 id={`date-finding-${recordId}`}>{isWill ? "When was this Will signed?" : expired ? "This document has expired" : "When does this document expire?"}</h3>
      <div className="lf-v52-finding-row">
        <span className="lf-v52-finding-icon" aria-hidden="true"><Icon name={isWill ? "history_edu" : "event_available"} size={20} /></span>
        <div className="lf-v52-finding-copy">
          <strong>{isWill ? `Signed ${when}` : `${expired ? "Expired" : "Expires"} ${when}`}</strong>
          <small>Found on page {finding.page}.{expired ? " If you have a newer one, add it too and we’ll mark this one as replaced." : ""}</small>
        </div>
      </div>
      {message ? <p className="lf-v52-finding-question" role="status">{message}</p> : (
        <>
          <p className="lf-v52-finding-question">{isWill ? "Is this the date the Will was signed? We use it to suggest a check every 3 years." : "Is this the expiry date? We’ll remind you about 3 months before."}</p>
          <div className="lf-v52-finding-actions">
            <button type="button" className="lf-v52-finding-primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Yes, save this date"}</button>
            <button type="button" onClick={onClose}>No, that’s not right</button>
          </div>
        </>
      )}
      {message ? <div className="lf-v52-finding-actions"><button type="button" onClick={onClose}>Done</button></div> : null}
      {people ? <p className="lf-v52-finding-note">We also found {people === 1 ? "1 person" : `${people} people`} to review under People linked to this record.</p> : null}
      <p className="lf-v52-finding-note">Read inside Legacy Fortress and never shared. It can make mistakes, so check before you save.</p>
    </section>
  );
}
