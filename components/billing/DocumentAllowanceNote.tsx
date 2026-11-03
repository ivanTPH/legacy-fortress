"use client";

import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { loadBillingStatus, showPremiumSheet, type BillingStatus } from "../../lib/billing/client";

/**
 * "92 of 100 documents" (owner decision 3 Nov 2026): a gentle warning from 90% of the allowance, with the way
 * to get more. `always` shows the count even below that (Billing). Nothing is ever blocked from here.
 */
export default function DocumentAllowanceNote({ always = false }: { always?: boolean }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  useEffect(() => { void loadBillingStatus().then(setStatus); }, []);
  if (!status || !status.documentsIncluded) return null;
  const { documentsUsed: used, documentsIncluded: included, plan } = status;
  const near = used >= Math.floor(included * 0.9);
  if (!near && !always) return null;
  const full = used >= included;
  return (
    <div className={`lf-doc-allowance${near ? " is-near" : ""}`} role={near ? "status" : undefined}>
      <Icon name="description" size={20} />
      <div>
        <strong>{used} of {included} documents</strong>
        <span>{full ? (plan === "premium" ? "You’ve used your included documents. Add 100 more to keep uploading." : "The free plan holds 10 documents. Premium includes 100.")
          : near ? "You’re close to your allowance. A multi-page PDF counts as one document."
          : "A multi-page PDF counts as one document."}</span>
      </div>
      {near ? <button type="button" className="lf-sg-secondary" onClick={() => showPremiumSheet(plan === "premium" ? "documentPack" : "storage")}>
        {plan === "premium" ? "Add 100 documents" : "Upgrade"}
      </button> : null}
    </div>
  );
}
