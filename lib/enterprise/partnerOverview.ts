/** Invoice status for the partner, in plain words (UX review 2, 23 Nov 2026). Licences are invoiced by Legacy Fortress. */
export function invoiceLabel(licences: Array<{ billingStatus: string; status: string }>) {
  const live = licences.find((licence) => licence.status === "active") ?? licences[0];
  const status = String(live?.billingStatus ?? "").toLowerCase();
  if (["active", "current"].includes(status)) return "Paid";
  if (["past_due", "overdue"].includes(status)) return "Overdue";
  if (["pending", "manual_review"].includes(status)) return "Awaiting payment";
  if (status === "trial") return "Trial";
  if (["suspended", "cancelled"].includes(status)) return "Stopped";
  return "Not invoiced yet";
}

/** Sign-ups each week for the last 12 weeks (UX review 2, 23 Nov 2026): counts only, from join dates. */
export function weeklyJoins(memberships: Array<{ joinedAt: string | null; status: string }>, now = new Date(), weeks = 12) {
  const day = (now.getUTCDay() + 6) % 7;
  const thisWeek = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day);
  const buckets = Array.from({ length: weeks }, (_, index) => ({ start: thisWeek - (weeks - 1 - index) * 7 * 86400000, count: 0 }));
  for (const member of memberships) {
    if (!member.joinedAt || member.status === "removed") continue;
    const time = new Date(member.joinedAt).getTime();
    const bucket = buckets.find((item) => time >= item.start && time < item.start + 7 * 86400000);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

