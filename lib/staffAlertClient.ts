import { supabase } from "./supabaseClient";

/**
 * Browser: after sending something that needs staff, ask the server to alert them (owner decision 23 Nov 2026).
 * Best effort: the message or record is already saved and Admin's Inbox shows it either way.
 */
export async function tellStaff(kind: "help_message" | "poa_check") {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/staff-alerts", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
  } catch { /* best effort */ }
}
