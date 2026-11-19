"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "../../../../components/ui/Icon";
import { waitForActiveUser } from "../../../../lib/auth/session";
import { supabase } from "../../../../lib/supabaseClient";
import { listRecentlyDeleted, restoreDeletedItem, RECENTLY_DELETED_DAYS, type DeletedItem } from "../../../../lib/records/recentlyDeleted";
import { SettingsCard, SettingsPageShell, StatusNote } from "../../components/settings/SettingsPrimitives";

const AREA: Record<string, string> = { finances: "Finances", legal: "Legal", property: "Property", business: "Business", digital: "Digital", personal: "Possessions", possessions: "Possessions", vault: "Vault" };

function where(item: DeletedItem) {
  const area = AREA[item.sectionKey] ?? (item.sectionKey ? item.sectionKey.charAt(0).toUpperCase() + item.sectionKey.slice(1) : "");
  const category = item.categoryKey.replace(/[-_]+/g, " ");
  return [area, category ? category.charAt(0).toUpperCase() + category.slice(1) : ""].filter(Boolean).join(" · ");
}

function deletedOn(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Recently deleted (owner approved 30 days, 18 Nov 2026): the owner's own deleted records, restorable for 30 days. */
export default function RecentlyDeletedPage() {
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
    if (!user) return;
    setOwnerId(user.id);
    setItems(await listRecentlyDeleted(supabase, user.id));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function restore(item: DeletedItem) {
    setBusyId(item.id);
    setStatus("");
    const result = await restoreDeletedItem(supabase, ownerId, item);
    setBusyId("");
    if (!result.ok) { setStatus(result.message); return; }
    setItems((current) => current.filter((row) => row.id !== item.id));
    setStatus(`Restored “${item.title}”. It’s back in ${where(item) || "your Vault"}.`);
  }

  return (
    <SettingsPageShell title="Recently deleted" subtitle={`Records you delete stay here for ${RECENTLY_DELETED_DAYS} days, with their documents, then are removed for good.`}>
      <StatusNote message={status} />
      <SettingsCard title="Deleted in the last 30 days" description="Only you can see these. Restoring puts a record back exactly as it was, including who it was shared with.">
        {loading ? <p className="lf-recently-deleted-empty">Loading…</p> : items.length === 0 ? (
          <p className="lf-recently-deleted-empty">Nothing here. When you delete a record, you can restore it from here for 30 days.</p>
        ) : (
          <ul className="lf-recently-deleted-list" aria-label="Recently deleted records">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <span className="lf-recently-deleted-icon" aria-hidden="true"><Icon name="delete" size={20} /></span>
                <span className="lf-recently-deleted-copy">
                  <strong>{item.title}</strong>
                  <small>{where(item)}{where(item) ? " · " : ""}Deleted {deletedOn(item.deletedAt)} · {item.daysLeft === 1 ? "1 day left" : `${item.daysLeft} days left`}</small>
                </span>
                <button type="button" className="lf-recently-deleted-restore" disabled={busyId === item.id} onClick={() => void restore(item)} aria-label={`Restore ${item.title}`}>
                  {busyId === item.id ? "Restoring…" : "Restore"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </SettingsPageShell>
  );
}
