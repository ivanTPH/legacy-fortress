import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Become a partner" enquiries (owner decision 23 Nov 2026). Public form → validated here → partner_enquiries
 * (service role only) → Admin Inbox, and staff who manage partners get an alert that names nobody.
 */
export const ORGANISATION_TYPES = ["Employer", "Financial adviser or wealth manager", "Law firm or will writer", "Bank or building society", "Insurer or pension provider", "Charity or membership body", "Other"] as const;
export const MEMBER_BANDS = [
  { value: 100, label: "Up to 100" }, { value: 1000, label: "100 to 1,000" }, { value: 10000, label: "1,000 to 10,000" },
  { value: 50000, label: "10,000 to 50,000" }, { value: 100000, label: "More than 50,000" },
] as const;
export const ENQUIRY_STATUSES = ["new", "contacted", "onboarding", "closed"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export type EnquiryInput = {
  organisationName: string; organisationType: string | null; contactName: string; contactEmail: string;
  contactPhone: string | null; membersEstimate: number | null; message: string | null;
};

const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function validateEnquiry(body: Record<string, unknown>): { ok: true; value: EnquiryInput } | { ok: false; message: string } {
  if (clean(body.website, 200)) return { ok: false, message: "spam" }; // hidden field people never fill in
  const organisationName = clean(body.organisationName, 200);
  const contactName = clean(body.contactName, 120);
  const contactEmail = clean(body.contactEmail, 320).toLowerCase();
  if (organisationName.length < 2) return { ok: false, message: "Add your organisation’s name." };
  if (contactName.length < 2) return { ok: false, message: "Add your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) return { ok: false, message: "Add a work email address we can reply to." };
  const type = clean(body.organisationType, 60);
  const members = Number(body.membersEstimate);
  return {
    ok: true,
    value: {
      organisationName, contactName, contactEmail,
      organisationType: (ORGANISATION_TYPES as readonly string[]).includes(type) ? type : null,
      contactPhone: clean(body.contactPhone, 40) || null,
      membersEstimate: Number.isFinite(members) && members >= 0 ? Math.min(Math.round(members), 10_000_000) : null,
      message: String(body.message ?? "").trim().slice(0, 4000) || null,
    },
  };
}

/** At most 3 enquiries per email an hour, and 30 in total every 10 minutes, so the form can't be flooded. */
export async function enquiryAllowed(client: SupabaseClient, email: string) {
  const hour = new Date(Date.now() - 3600_000).toISOString();
  const tenMinutes = new Date(Date.now() - 600_000).toISOString();
  const [mine, all] = await Promise.all([
    client.from("partner_enquiries").select("id", { count: "exact", head: true }).eq("contact_email", email).gte("created_at", hour),
    client.from("partner_enquiries").select("id", { count: "exact", head: true }).gte("created_at", tenMinutes),
  ]);
  if (mine.error || all.error) return { ok: false as const, unavailable: true };
  return { ok: (mine.count ?? 0) < 3 && (all.count ?? 0) < 30, unavailable: false };
}

export async function saveEnquiry(client: SupabaseClient, value: EnquiryInput) {
  return client.from("partner_enquiries").insert({
    organisation_name: value.organisationName, organisation_type: value.organisationType, contact_name: value.contactName,
    contact_email: value.contactEmail, contact_phone: value.contactPhone, members_estimate: value.membersEstimate, message: value.message,
  }).select("id").single();
}

export type PartnerEnquiry = { id: string; organisationName: string; organisationType: string | null; contactName: string; contactEmail: string; contactPhone: string | null; membersEstimate: number | null; message: string | null; status: EnquiryStatus; at: string };

export async function loadEnquiries(client: SupabaseClient, since: string): Promise<PartnerEnquiry[]> {
  try {
    const { data, error } = await client.from("partner_enquiries")
      .select("id,organisation_name,organisation_type,contact_name,contact_email,contact_phone,members_estimate,message,status,created_at")
      .or(`created_at.gte.${since},status.eq.new`).order("created_at", { ascending: false }).limit(100);
    if (error) return [];
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), organisationName: String(row.organisation_name ?? ""), organisationType: (row.organisation_type as string | null) ?? null,
      contactName: String(row.contact_name ?? ""), contactEmail: String(row.contact_email ?? ""), contactPhone: (row.contact_phone as string | null) ?? null,
      membersEstimate: row.members_estimate == null ? null : Number(row.members_estimate), message: (row.message as string | null) ?? null,
      status: (ENQUIRY_STATUSES as readonly string[]).includes(String(row.status)) ? (row.status as EnquiryStatus) : "new", at: String(row.created_at ?? ""),
    }));
  } catch { return []; }
}
