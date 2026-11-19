"use client";

import { useEffect, useState } from "react";

type Assignee = { userId: string; name: string };

/**
 * Assign to… (owner decision 19 Nov 2026): a list of registered admins allowed to review ID checks, never a
 * typed name. The server checks the choice again and records it in Audit.
 */
export default function AssignReviewer({ currentReviewerId, busy, load, onAssign }: {
  currentReviewerId: string | null;
  busy: boolean;
  load: () => Promise<Assignee[]>;
  onAssign: (userId: string) => void;
}) {
  const [assignees, setAssignees] = useState<Assignee[] | null>(null);
  const [choice, setChoice] = useState("");
  useEffect(() => {
    let active = true;
    void load().then((list) => { if (active) setAssignees(list); }).catch(() => { if (active) setAssignees([]); });
    return () => { active = false; };
  }, [load]);
  const options = (assignees ?? []).filter((item) => item.userId !== currentReviewerId);
  if (assignees && !options.length) return null;
  return (
    <div className="lf-admin-assign">
      <label htmlFor="lf-assign-reviewer">{currentReviewerId ? "Hand over to" : "Assign to"}</label>
      <div className="lf-admin-assign-row">
        <select id="lf-assign-reviewer" value={choice} onChange={(event) => setChoice(event.target.value)} disabled={!assignees || busy}>
          <option value="">{assignees ? "Choose an admin" : "Loading admins…"}</option>
          {options.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}
        </select>
        <button type="button" className="lf-admin-row-button" disabled={!choice || busy} onClick={() => onAssign(choice)}>{busy ? "Assigning…" : "Assign"}</button>
      </div>
    </div>
  );
}
