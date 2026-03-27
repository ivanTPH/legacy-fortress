import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeCanonicalLinkedContexts } from "../lib/contacts/canonicalContacts.ts";

const TARGET_EMAIL = process.env.SEED_TARGET_EMAIL || "ivanyardley@me.com";
const DEMO_KEY = "bill-smith-review-account-v1";
const DOCUMENT_BUCKET = "vault-docs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const USER_EMAIL = process.env.E2E_USER_EMAIL || TARGET_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || "";

if (!SUPABASE_URL) {
  console.error("Seed blocked: NEXT_PUBLIC_SUPABASE_URL is required.");
  process.exit(1);
}

let supabase = null;

async function main() {
  supabase = await createSeedClient();
  const user = await findUserByEmail(TARGET_EMAIL);
  if (!user) {
    throw new Error(`No auth user found for ${TARGET_EMAIL}.`);
  }

  const wallet = await ensureWalletContext(user.id);
  await upsertProfile(user.id);
  await upsertContactDetails(user.id);
  await upsertAddress(user.id);
  const contacts = await seedContacts(user.id);
  await seedPersonalRecords(user.id, contacts);
  const assets = await seedAssets(user.id, wallet, contacts);
  await seedInvitations(user.id, contacts);
  await seedDocuments(user.id, wallet, assets);
  await normalizeSeedContactContexts(user.id);

  console.log(JSON.stringify({
    seededFor: TARGET_EMAIL,
    userId: user.id,
    walletId: wallet.walletId,
    organisationId: wallet.organisationId,
    contacts: contacts.map((item) => ({ id: item.id, name: item.full_name, role: item.contact_role })),
    assets: assets.map((item) => ({ id: item.id, title: item.title, category: item.category_key })),
  }, null, 2));
}

async function createSeedClient() {
  if (SERVICE_ROLE_KEY) {
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminCheck = await adminClient.from("user_profiles").select("id").limit(1);
    if (!adminCheck.error) {
      return adminClient;
    }
  }

  if (!ANON_KEY || !USER_PASSWORD) {
    throw new Error("Seed blocked: valid SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY with E2E_USER_PASSWORD is required.");
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await userClient.auth.signInWithPassword({
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });
  if (signIn.error || !signIn.data.user) {
    throw signIn.error || new Error("Could not authenticate seed user.");
  }
  if (String(signIn.data.user.email ?? "").toLowerCase() !== TARGET_EMAIL.toLowerCase()) {
    throw new Error(`Seed authenticated as ${signIn.data.user.email}, but target email is ${TARGET_EMAIL}.`);
  }
  return userClient;
}

async function findUserByEmail(email) {
  const currentUser = await supabase.auth.getUser();
  if (!currentUser.error && currentUser.data.user) {
    const user = currentUser.data.user;
    if (String(user.email ?? "").toLowerCase() === email.toLowerCase()) {
      return user;
    }
  }

  if (!supabase.auth.admin?.listUsers) {
    return null;
  }

  let page = 1;
  while (page < 20) {
    const result = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw result.error;
    const found = result.data.users.find((item) => String(item.email ?? "").toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (result.data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function ensureWalletContext(userId) {
  let organisationId = "";
  const orgRes = await supabase.from("organisations").select("id").eq("owner_user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (orgRes.error) throw orgRes.error;
  if (orgRes.data?.id) {
    organisationId = String(orgRes.data.id);
  } else {
    const created = await supabase.from("organisations").insert({ owner_user_id: userId, name: "Bill Smith review organisation" }).select("id").single();
    if (created.error || !created.data?.id) throw created.error || new Error("Could not create organisation.");
    organisationId = String(created.data.id);
  }

  let walletId = "";
  const walletRes = await supabase.from("wallets").select("id").eq("owner_user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (walletRes.error) throw walletRes.error;
  if (walletRes.data?.id) {
    walletId = String(walletRes.data.id);
    await supabase.from("wallets").update({ organisation_id: organisationId }).eq("id", walletId).eq("owner_user_id", userId);
  } else {
    const created = await supabase
      .from("wallets")
      .insert({
        owner_user_id: userId,
        organisation_id: organisationId,
        label: "Primary wallet",
        status: "active",
      })
      .select("id")
      .single();
    if (created.error || !created.data?.id) throw created.error || new Error("Could not create wallet.");
    walletId = String(created.data.id);
  }

  return { organisationId, walletId };
}

async function upsertProfile(userId) {
  const res = await supabase.from("user_profiles").upsert({
    user_id: userId,
    display_name: "Bill Smith",
    first_name: "Bill",
    last_name: "Smith",
    about: "Synthetic populated review account for Legacy Fortress product validation.",
    notification_email: TARGET_EMAIL,
    preferred_currency: "GBP",
    language: "English",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (res.error) throw res.error;
}

async function upsertContactDetails(userId) {
  const res = await supabase.from("contact_details").upsert({
    user_id: userId,
    secondary_email: TARGET_EMAIL,
    telephone: "01904 555204",
    mobile_number: "07700 900210",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (res.error) throw res.error;
}

async function upsertAddress(userId) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    house_name_or_number: "14",
    street_name: "Orchard Lane",
    town: "York",
    city: "York",
    country: "United Kingdom",
    post_code: "YO1 2AB",
    updated_at: now,
  };

  let write = await supabase.from("addresses").upsert(payload, { onConflict: "user_id" });
  if (!write.error) return;

  const legacyPayload = {
    ...payload,
    country: "UK",
  };
  write = await supabase.from("address_book").upsert(legacyPayload, { onConflict: "user_id" });
  if (write.error) throw write.error;
}

async function seedContacts(userId) {
  const contacts = [
    {
      full_name: "Sarah Smith",
      email: "sarah.smith.synthetic@example.test",
      phone: "07700 900111",
      contact_role: "family_contact",
      relationship: "spouse_partner",
      invite_status: "not_invited",
      verification_status: "not_verified",
      source_type: "next_of_kin",
      linked_context: [{ source_kind: "record", source_id: "next-of-kin", section_key: "personal", category_key: "next-of-kin", label: "Next of kin", role: "spouse_partner" }],
    },
    {
      full_name: "Emma Carter",
      email: "emma.carter.synthetic@example.test",
      phone: "07700 900112",
      contact_role: "executor",
      relationship: "friend",
      invite_status: "invite_sent",
      verification_status: "invited",
      source_type: "executor_asset",
      linked_context: [
        { source_kind: "asset", source_id: "executor-primary", section_key: "personal", category_key: "executors", label: "Primary executor", role: "executor" },
        { source_kind: "asset", source_id: "trustee-context", section_key: "legal", category_key: "trusts", label: "Family trust trustee", role: "trustee" },
      ],
    },
    {
      full_name: "James Patel",
      email: "james.patel.synthetic@example.test",
      phone: "07700 900113",
      contact_role: "lawyer",
      relationship: "solicitor",
      invite_status: "accepted",
      verification_status: "verified",
      source_type: "invitation",
      linked_context: [{ source_kind: "invitation", source_id: "advisor-lawyer", section_key: "dashboard", category_key: "contacts", label: "Solicitor", role: "lawyer" }],
    },
    {
      full_name: "Naomi Reed",
      email: "naomi.reed.synthetic@example.test",
      phone: "07700 900114",
      contact_role: "accountant",
      relationship: "accountant",
      invite_status: "not_invited",
      verification_status: "not_verified",
      source_type: "invitation",
      linked_context: [{ source_kind: "invitation", source_id: "advisor-accountant", section_key: "dashboard", category_key: "contacts", label: "Accountant", role: "accountant" }],
    },
    {
      full_name: "Olivia Grant",
      email: "olivia.grant.synthetic@example.test",
      phone: "0207 000 1001",
      contact_role: "bank_contact",
      relationship: "provider_contact",
      invite_status: "not_invited",
      verification_status: "not_verified",
      source_type: "manual",
      linked_context: [{ source_kind: "asset", source_id: "hsbc-current", section_key: "finances", category_key: "bank", label: "HSBC current account", role: "bank_contact" }],
    },
  ];

  const results = [];
  for (const contact of contacts) {
    const emailNormalized = contact.email.toLowerCase();
    const existing = await findExistingSeedContact(userId, {
      fullName: contact.full_name,
      emailNormalized,
      phone: contact.phone,
      contactRole: contact.contact_role,
    });

    const payload = {
      user_id: userId,
      owner_user_id: userId,
      full_name: contact.full_name,
      email: contact.email,
      email_normalized: emailNormalized,
      phone: contact.phone,
      contact_role: contact.contact_role,
      relationship: contact.relationship,
      linked_context: contact.linked_context,
      invite_status: contact.invite_status,
      verification_status: contact.verification_status,
      source_type: contact.source_type,
      updated_at: new Date().toISOString(),
    };

    const write = existing?.id
      ? await supabase
        .from("contacts")
        .update({
          ...payload,
          linked_context: mergeLinkedContext(existing.linked_context, contact.linked_context),
        })
        .eq("id", existing.id)
        .eq("owner_user_id", userId)
        .select("id,full_name,contact_role,linked_context")
        .single()
      : await supabase
        .from("contacts")
        .insert(payload)
        .select("id,full_name,contact_role,linked_context")
        .single();

    if (write.error || !write.data) throw write.error || new Error("Could not seed contact.");
    results.push(write.data);
  }
  return results;
}

async function findExistingSeedContact(userId, {
  fullName,
  emailNormalized,
  phone,
  contactRole,
}) {
  if (emailNormalized) {
    const byEmail = await supabase
      .from("contacts")
      .select("id,linked_context")
      .eq("owner_user_id", userId)
      .eq("email_normalized", emailNormalized)
      .maybeSingle();
    if (byEmail.error) throw byEmail.error;
    if (byEmail.data) return byEmail.data;
  }

  const byName = await supabase
    .from("contacts")
    .select("id,linked_context")
    .eq("owner_user_id", userId)
    .eq("full_name", fullName)
    .eq("phone", phone)
    .eq("contact_role", contactRole)
    .maybeSingle();
  if (byName.error) throw byName.error;
  return byName.data;
}

function mergeLinkedContext(existing, incoming) {
  const current = Array.isArray(existing) ? existing : [];
  const additions = Array.isArray(incoming) ? incoming : [];
  const merged = [...current];
  for (const nextItem of additions) {
    const duplicateIndex = merged.findIndex((item) =>
      item?.source_kind === nextItem?.source_kind
      && (item?.source_id === nextItem?.source_id
        || (
          item?.section_key === nextItem?.section_key
          && item?.category_key === nextItem?.category_key
          && item?.label === nextItem?.label
          && item?.role === nextItem?.role
        )),
    );
    if (duplicateIndex >= 0) {
      merged[duplicateIndex] = nextItem;
    } else {
      merged.push(nextItem);
    }
  }

  const seen = new Set();
  return merged.filter((item) => {
    const key = JSON.stringify({
      source_kind: item?.source_kind ?? null,
      source_id: item?.source_id ?? null,
      section_key: item?.section_key ?? null,
      category_key: item?.category_key ?? null,
      label: item?.label ?? null,
      role: item?.role ?? null,
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function seedAssets(userId, wallet, contacts) {
  const contactByName = new Map(contacts.map((item) => [item.full_name, item]));
  const assets = [
    {
      title: "HSBC Everyday Current",
      section_key: "finances",
      category_key: "bank",
      provider_name: "HSBC",
      summary: "current_account · Sarah Smith",
      value_minor: 425000,
      currency_code: "GBP",
      metadata_json: {
        provider_name: "HSBC",
        account_type: "current_account",
        account_holder: "Bill Smith",
        current_balance: 4250,
        valuation_date: "2026-03-20",
        country: "UK",
        currency: "GBP",
        notes: "Synthetic review current account",
        asset_category_token: "bank-accounts",
        demo_seed_key: DEMO_KEY,
      },
      contactName: "Olivia Grant",
    },
    {
      title: "NS&I Savings Account",
      section_key: "finances",
      category_key: "bank",
      provider_name: "NS&I",
      summary: "savings_account · Bill Smith",
      value_minor: 1825000,
      currency_code: "GBP",
      metadata_json: {
        provider_name: "NS&I",
        account_type: "savings_account",
        account_holder: "Bill Smith",
        current_balance: 18250,
        valuation_date: "2026-03-19",
        country: "UK",
        currency: "GBP",
        notes: "Synthetic emergency savings",
        asset_category_token: "bank-accounts",
        demo_seed_key: DEMO_KEY,
      },
    },
    {
      title: "14 Orchard Lane",
      section_key: "property",
      category_key: "property",
      provider_name: null,
      summary: "residential_property · sole · main_residence",
      value_minor: 67500000,
      currency_code: "GBP",
      metadata_json: {
        property_name: "14 Orchard Lane",
        property_type: "residential_property",
        ownership_type: "sole",
        property_address: "14 Orchard Lane, York, YO1 2AB",
        property_country: "UK",
        occupancy_status: "main_residence",
        estimated_value: 675000,
        valuation_date: "2026-03-18",
        mortgage_lender: "Nationwide",
        mortgage_balance: 112000,
        title_reference: "YNK-ORCHARD-14",
        notes: "Synthetic family home record",
        demo_seed_key: DEMO_KEY,
      },
    },
    {
      title: "Last Will and Testament",
      section_key: "personal",
      category_key: "executors",
      provider_name: null,
      summary: "executor · primary · friend",
      value_minor: 0,
      currency_code: "GBP",
      metadata_json: {
        full_name: "Emma Carter",
        executor_name: "Emma Carter",
        executor_type: "executor",
        relationship_to_user: "friend",
        authority_level: "primary",
        jurisdiction: "UK",
        executor_status: "active",
        appointed_on: "2024-10-02",
        beneficiary_reference: "Family beneficiaries",
        instruction_reference: "Will oversight",
        notes: "Synthetic primary executor linked to will",
        demo_seed_key: DEMO_KEY,
      },
      contactName: "Emma Carter",
    },
    {
      title: "Property and financial affairs LPA",
      section_key: "legal",
      category_key: "power-of-attorney",
      provider_name: null,
      summary: "Power of attorney on file",
      value_minor: 0,
      currency_code: "GBP",
      metadata_json: {
        document_title: "Property and financial affairs LPA",
        notes: "Synthetic power of attorney record",
        demo_seed_key: DEMO_KEY,
      },
    },
    {
      title: "Riverside Pension Scheme",
      section_key: "finances",
      category_key: "pensions",
      provider_name: "Aviva",
      summary: "workplace_pension · nominated beneficiary on file",
      value_minor: 2480000,
      currency_code: "GBP",
      metadata_json: {
        provider_name: "Aviva",
        pension_type: "workplace_pension",
        member_name: "Bill Smith",
        estimated_value: 24800,
        valuation_date: "2026-03-17",
        nominated_beneficiary: "Sarah Smith",
        notes: "Synthetic pension record",
        demo_seed_key: DEMO_KEY,
      },
    },
    {
      title: "Family protection insurance",
      section_key: "finances",
      category_key: "insurance",
      provider_name: "Legal & General",
      summary: "life_cover · Sarah Smith",
      value_minor: 50000000,
      currency_code: "GBP",
      metadata_json: {
        insurer_name: "Legal & General",
        policy_type: "life_cover",
        policy_holder: "Bill Smith",
        insured_subject: "Bill Smith",
        cover_amount: 500000,
        renewal_date: "2026-11-01",
        notes: "Synthetic life cover",
        demo_seed_key: DEMO_KEY,
      },
    },
    {
      title: "Bill Smith Consulting Ltd",
      section_key: "business",
      category_key: "business",
      provider_name: null,
      summary: "limited_company · active",
      value_minor: 1500000,
      currency_code: "GBP",
      metadata_json: {
        business_name: "Bill Smith Consulting Ltd",
        business_type: "limited_company",
        registration_number: "BSCL-2026-001",
        jurisdiction: "UK",
        ownership_percentage: 100,
        business_status: "active",
        notes: "Synthetic business interest",
        demo_seed_key: DEMO_KEY,
      },
    },
    {
      title: "Review pension nominations",
      section_key: "personal",
      category_key: "tasks",
      provider_name: null,
      summary: "high · open · Riverside Pension Scheme",
      value_minor: 0,
      currency_code: "GBP",
      metadata_json: {
        task_title: "Review pension nominations",
        related_asset_label: "Riverside Pension Scheme",
        related_asset_id: null,
        priority: "high",
        task_status: "open",
        due_date: "2026-04-30",
        notes: "Synthetic review task",
        demo_seed_key: DEMO_KEY,
      },
    },
  ];

  const inserted = [];
  for (const asset of assets) {
    const existing = await supabase
      .from("assets")
      .select("id,title,category_key")
      .eq("owner_user_id", userId)
      .eq("wallet_id", wallet.walletId)
      .eq("section_key", asset.section_key)
      .eq("category_key", asset.category_key)
      .eq("title", asset.title)
      .maybeSingle();
    if (existing.error) throw existing.error;

    const payload = {
      owner_user_id: userId,
      organisation_id: wallet.organisationId,
      wallet_id: wallet.walletId,
      section_key: asset.section_key,
      category_key: asset.category_key,
      title: asset.title,
      provider_name: asset.provider_name,
      provider_key: null,
      summary: asset.summary,
      value_minor: asset.value_minor,
      currency_code: asset.currency_code,
      visibility: "private",
      status: "active",
      metadata_json: asset.metadata_json,
      updated_at: new Date().toISOString(),
    };

    let assetId = existing.data?.id ? String(existing.data.id) : "";
    if (assetId) {
      const update = await supabase.from("assets").update(payload).eq("id", assetId).eq("owner_user_id", userId);
      if (update.error) throw update.error;
    } else {
      const insert = await supabase.from("assets").insert(payload).select("id,title,category_key").single();
      if (insert.error || !insert.data?.id) throw insert.error || new Error("Could not create seeded asset.");
      assetId = String(insert.data.id);
    }

    if (asset.contactName) {
      const contact = contactByName.get(asset.contactName);
      if (contact) {
        const existingLink = await supabase
          .from("contact_links")
          .select("id")
          .eq("owner_user_id", userId)
          .eq("source_kind", "asset")
          .eq("source_id", assetId)
          .maybeSingle();
        if (existingLink.error) throw existingLink.error;

        const linkPayload = {
          owner_user_id: userId,
          contact_id: contact.id,
          source_kind: "asset",
          source_id: assetId,
          section_key: asset.section_key,
          category_key: asset.category_key,
          context_label: asset.title,
          role_label: asset.metadata_json.executor_type ?? contact.contact_role ?? null,
          updated_at: new Date().toISOString(),
        };

        const linkWrite = existingLink.data?.id
          ? await supabase
            .from("contact_links")
            .update(linkPayload)
            .eq("id", existingLink.data.id)
            .eq("owner_user_id", userId)
          : await supabase.from("contact_links").insert(linkPayload);
        if (linkWrite.error) throw linkWrite.error;

      }
    }

    inserted.push({ id: assetId, title: asset.title, category_key: asset.category_key, section_key: asset.section_key });
  }
  return inserted;
}

async function seedPersonalRecords(userId, contacts) {
  const sarah = contacts.find((item) => item.full_name === "Sarah Smith");
  if (!sarah) return;

  const existingRecord = await supabase
    .from("records")
    .select("id,metadata")
    .eq("owner_user_id", userId)
    .eq("section_key", "personal")
    .eq("category_key", "next-of-kin")
    .eq("title", "Sarah Smith")
    .maybeSingle();
  if (existingRecord.error) throw existingRecord.error;

  const recordPayload = {
    owner_user_id: userId,
    section_key: "personal",
    category_key: "next-of-kin",
    title: "Sarah Smith",
    provider_name: "07700 900111",
    provider_key: null,
    summary: "spouse_partner · sarah.smith.synthetic@example.test",
    value_minor: 0,
    currency_code: "GBP",
    metadata: {
      relationship: "spouse_partner",
      mobile_phone: "07700 900111",
      notes: "Synthetic next of kin contact",
      demo_seed_key: DEMO_KEY,
    },
    updated_at: new Date().toISOString(),
  };

  let recordId = existingRecord.data?.id ? String(existingRecord.data.id) : "";
  if (recordId) {
    const update = await supabase.from("records").update(recordPayload).eq("id", recordId).eq("owner_user_id", userId);
    if (update.error) throw update.error;
  } else {
    const insert = await supabase.from("records").insert(recordPayload).select("id").single();
    if (insert.error || !insert.data?.id) throw insert.error || new Error("Could not create next-of-kin record.");
    recordId = String(insert.data.id);
  }

  const existingRecordContact = await supabase
    .from("record_contacts")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("record_id", recordId)
    .maybeSingle();
  if (existingRecordContact.error) throw existingRecordContact.error;

  const recordContactPayload = {
    owner_user_id: userId,
    record_id: recordId,
    contact_id: sarah.id,
    contact_name: "Sarah Smith",
    contact_email: "sarah.smith.synthetic@example.test",
    contact_role: "spouse_partner",
    notes: "Synthetic next of kin link",
  };
  const recordContactWrite = existingRecordContact.data?.id
    ? await supabase.from("record_contacts").update(recordContactPayload).eq("id", existingRecordContact.data.id).eq("owner_user_id", userId)
    : await supabase.from("record_contacts").insert(recordContactPayload);
  if (recordContactWrite.error) throw recordContactWrite.error;

  const existingLink = await supabase
    .from("contact_links")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("source_kind", "record")
    .eq("source_id", recordId)
    .maybeSingle();
  if (existingLink.error) throw existingLink.error;

  const linkPayload = {
    owner_user_id: userId,
    contact_id: sarah.id,
    source_kind: "record",
    source_id: recordId,
    section_key: "personal",
    category_key: "next-of-kin",
    context_label: "Next of kin",
    role_label: "spouse_partner",
    updated_at: new Date().toISOString(),
  };
  const linkWrite = existingLink.data?.id
    ? await supabase.from("contact_links").update(linkPayload).eq("id", existingLink.data.id).eq("owner_user_id", userId)
    : await supabase.from("contact_links").insert(linkPayload);
  if (linkWrite.error) throw linkWrite.error;

  const contactUpdate = await supabase
    .from("contacts")
    .update({
      linked_context: mergeLinkedContext(sarah.linked_context, [{
        source_kind: "record",
        source_id: recordId,
        section_key: "personal",
        category_key: "next-of-kin",
        label: "Next of kin",
        role: "spouse_partner",
      }]),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sarah.id)
    .eq("owner_user_id", userId);
  if (contactUpdate.error) throw contactUpdate.error;
}

async function seedInvitations(userId, contacts) {
  const invitationContacts = contacts.filter((item) => ["James Patel", "Naomi Reed", "Emma Carter"].includes(item.full_name));
  const roleMap = new Map([
    ["James Patel", "lawyer"],
    ["Naomi Reed", "accountant"],
    ["Emma Carter", "executor"],
  ]);
  const activationMap = new Map([
    ["James Patel", "verified"],
    ["Naomi Reed", "invited"],
    ["Emma Carter", "invited"],
  ]);
  for (const contact of invitationContacts) {
    const now = new Date().toISOString();
    const assigned_role = roleMap.get(contact.full_name) || "professional_advisor";
    const existingInvitation = await supabase
      .from("contact_invitations")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("contact_email", `${contact.full_name.toLowerCase().replace(/\s+/g, ".")}.synthetic@example.test`)
      .eq("assigned_role", assigned_role)
      .maybeSingle();
    if (existingInvitation.error) throw existingInvitation.error;

    const invitationPayload = {
      owner_user_id: userId,
      contact_id: contact.id,
      contact_name: contact.full_name,
      contact_email: `${contact.full_name.toLowerCase().replace(/\s+/g, ".")}.synthetic@example.test`,
      assigned_role,
      invitation_status: assigned_role === "lawyer" ? "accepted" : "pending",
      invited_at: now,
      sent_at: now,
      updated_at: now,
    };

    const invitation = existingInvitation.data?.id
      ? await supabase
        .from("contact_invitations")
        .update(invitationPayload)
        .eq("id", existingInvitation.data.id)
        .eq("owner_user_id", userId)
        .select("id")
        .single()
      : await supabase
        .from("contact_invitations")
        .insert(invitationPayload)
        .select("id")
        .single();
    if (invitation.error || !invitation.data?.id) throw invitation.error || new Error("Could not upsert invitation.");

    const existingRoleAssignment = await supabase
      .from("role_assignments")
      .select("id")
      .eq("invitation_id", invitation.data.id)
      .maybeSingle();
    if (existingRoleAssignment.error) throw existingRoleAssignment.error;

    const roleAssignment = existingRoleAssignment.data?.id
      ? await supabase
        .from("role_assignments")
        .update({
          owner_user_id: userId,
          invitation_id: invitation.data.id,
          assigned_role,
          activation_status: activationMap.get(contact.full_name) || "invited",
          updated_at: now,
        })
        .eq("id", existingRoleAssignment.data.id)
      : await supabase
        .from("role_assignments")
        .insert({
          owner_user_id: userId,
          invitation_id: invitation.data.id,
          assigned_role,
          activation_status: activationMap.get(contact.full_name) || "invited",
          updated_at: now,
        });
    if (roleAssignment.error) throw roleAssignment.error;

    const existingInvitationLink = await supabase
      .from("contact_links")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("source_kind", "invitation")
      .eq("source_id", invitation.data.id)
      .maybeSingle();
    if (existingInvitationLink.error) throw existingInvitationLink.error;

    const invitationLinkPayload = {
      owner_user_id: userId,
      contact_id: contact.id,
      source_kind: "invitation",
      source_id: invitation.data.id,
      section_key: "dashboard",
      category_key: "contacts",
      context_label: "Synthetic invitation",
      role_label: assigned_role,
      updated_at: now,
    };
    const invitationLinkWrite = existingInvitationLink.data?.id
      ? await supabase
        .from("contact_links")
        .update(invitationLinkPayload)
        .eq("id", existingInvitationLink.data.id)
        .eq("owner_user_id", userId)
      : await supabase.from("contact_links").insert(invitationLinkPayload);
    if (invitationLinkWrite.error) throw invitationLinkWrite.error;

    const invitationContextWrite = await supabase
      .from("contacts")
      .update({
        invite_status: assigned_role === "lawyer" ? "accepted" : "invite_sent",
        verification_status: activationMap.get(contact.full_name) || "invited",
        updated_at: now,
      })
      .eq("id", contact.id)
      .eq("owner_user_id", userId);
    if (invitationContextWrite.error) throw invitationContextWrite.error;
  }
}

async function normalizeSeedContactContexts(userId) {
  const contactsRes = await supabase
    .from("contacts")
    .select("id,owner_user_id,linked_context")
    .eq("owner_user_id", userId);
  if (contactsRes.error) throw contactsRes.error;

  const linksRes = await supabase
    .from("contact_links")
    .select("contact_id,source_kind,source_id,section_key,category_key,context_label,role_label")
    .eq("owner_user_id", userId);
  if (linksRes.error) throw linksRes.error;

  const linksByContact = new Map();
  for (const link of linksRes.data ?? []) {
    const contactId = String(link.contact_id ?? "");
    if (!contactId) continue;
    const current = linksByContact.get(contactId) ?? [];
    current.push({
      source_kind: link.source_kind,
      source_id: link.source_id,
      section_key: link.section_key ?? null,
      category_key: link.category_key ?? null,
      label: link.context_label ?? null,
      role: link.role_label ?? null,
    });
    linksByContact.set(contactId, current);
  }

  for (const contact of contactsRes.data ?? []) {
    const contactId = String(contact.id ?? "");
    if (!contactId) continue;
    const authoritativeContexts = linksByContact.get(contactId) ?? [];
    if (!authoritativeContexts.length) continue;
    const existingContexts = Array.isArray(contact.linked_context) ? contact.linked_context : [];
    const normalizedContexts = normalizeCanonicalLinkedContexts(existingContexts, authoritativeContexts);
    const update = await supabase
      .from("contacts")
      .update({
        linked_context: normalizedContexts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId)
      .eq("owner_user_id", userId);
    if (update.error) throw update.error;
  }
}

async function seedDocuments(userId, wallet, assets) {
  const assetByTitle = new Map(assets.map((item) => [item.title, item]));
  const docs = [
    { title: "Last Will and Testament", file: "will-overview.txt", kind: "document" },
    { title: "Last Will and Testament", file: "executor-instructions.doc", kind: "document", mimeType: "application/msword" },
    { title: "14 Orchard Lane", file: "property-title-summary.txt", kind: "document" },
    { title: "Riverside Pension Scheme", file: "pension-summary.txt", kind: "document" },
    { title: "HSBC Everyday Current", file: "bank-statement-summary.txt", kind: "document" },
  ];

  for (const doc of docs) {
    const asset = assetByTitle.get(doc.title);
    if (!asset) continue;
    const absolutePath = path.join(process.cwd(), "public", "demo-docs", doc.file);
    const body = await readFile(absolutePath);
    const storagePath = `demo-review/${userId}/${asset.id}/${doc.file}`;
    await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, body, {
      upsert: true,
      contentType: doc.mimeType || "text/plain",
    });

    const existing = await supabase
      .from("documents")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("asset_id", asset.id)
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.id) continue;

    const insert = await supabase.from("documents").insert({
      organisation_id: wallet.organisationId,
      wallet_id: wallet.walletId,
      asset_id: asset.id,
      owner_user_id: userId,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: storagePath,
      file_name: doc.file,
      mime_type: doc.mimeType || "text/plain",
      size_bytes: body.byteLength,
      checksum: crypto.createHash("sha256").update(body).digest("hex"),
      document_kind: doc.kind,
    });
    if (insert.error) throw insert.error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
