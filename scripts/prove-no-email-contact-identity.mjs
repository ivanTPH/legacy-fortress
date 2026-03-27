#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  loadCanonicalContactsByIds,
  syncCanonicalContact,
  unlinkCanonicalContactSource,
} from "../lib/contacts/canonicalContacts.ts";

loadEnvFile();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DEFAULT_OWNER_EMAIL = process.env.E2E_USER_EMAIL || "";
const DEFAULT_OWNER_PASSWORD = process.env.E2E_USER_PASSWORD || "";
const uniqueTag = Date.now();
const OWNER_EMAIL = process.env.SMOKE_OWNER_EMAIL || DEFAULT_OWNER_EMAIL || `ivanyardley+lf-no-email-proof-${uniqueTag}@me.com`;
const OWNER_PASSWORD = process.env.SMOKE_OWNER_PASSWORD || DEFAULT_OWNER_PASSWORD || "OwnerSmoke123!";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !OWNER_EMAIL || !OWNER_PASSWORD) {
  throw new Error("Missing required env for no-email contact proof.");
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const adminClient = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
const recordId = crypto.randomUUID();
const contactName = `No Email Contact ${uniqueTag}`;

if (adminClient && OWNER_EMAIL !== DEFAULT_OWNER_EMAIL) {
  const provisionedOwner = await ensureOwnerUserExists(adminClient, OWNER_EMAIL, OWNER_PASSWORD);
  await ensureOwnerBootstrapState(adminClient, provisionedOwner.id);
}

const auth = await client.auth.signInWithPassword({
  email: OWNER_EMAIL,
  password: OWNER_PASSWORD,
});

if (auth.error || !auth.data.user) {
  throw auth.error || new Error("Could not sign in owner for no-email contact proof.");
}

const ownerUserId = auth.data.user.id;

const first = await syncCanonicalContact(client, {
  ownerUserId,
  fullName: contactName,
  email: null,
  contactRole: "executor",
  relationship: "friend",
  sourceType: "record_contact",
  link: {
    sourceKind: "record",
    sourceId: recordId,
    sectionKey: "legal",
    categoryKey: "wills",
    label: "Executor name",
    role: "executor",
  },
});

let proofError = null;

try {
  await unlinkCanonicalContactSource(client, {
    ownerUserId,
    sourceKind: "record",
    sourceId: recordId,
  });

  const resaved = await syncCanonicalContact(client, {
    ownerUserId,
    existingContactId: first.id,
    fullName: contactName,
    email: null,
    contactRole: "executor",
    relationship: "friend",
    sourceType: "record_contact",
    link: {
      sourceKind: "record",
      sourceId: recordId,
      sectionKey: "legal",
      categoryKey: "wills",
      label: "Executor name",
      role: "executor",
    },
  });

  assert.equal(resaved.id, first.id);

  const hydrated = await loadCanonicalContactsByIds(client, ownerUserId, [first.id]);
  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0]?.id, first.id);
  assert.equal(
    (hydrated[0]?.linked_context ?? []).some((context) => context.source_kind === "record" && context.source_id === recordId),
    true,
  );

  const duplicateCheck = await client
    .from("contacts")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("full_name", contactName)
    .is("email", null);
  if (duplicateCheck.error) throw duplicateCheck.error;
  assert.equal((duplicateCheck.data ?? []).length, 1);

  console.log(JSON.stringify({
    ownerUserId,
    recordId,
    contactName,
    canonicalContactId: first.id,
    duplicateCount: (duplicateCheck.data ?? []).length,
    linkedContextRestored: true,
  }, null, 2));
} catch (error) {
  proofError = error;
  throw error;
} finally {
  if (!proofError) {
    await client.from("contact_links").delete().eq("owner_user_id", ownerUserId).eq("source_kind", "record").eq("source_id", recordId);
    await client.from("contacts").delete().eq("owner_user_id", ownerUserId).eq("id", first.id);
  }
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function ensureOwnerUserExists(admin, email, password) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((user) => String(user.email ?? "").toLowerCase() === email.toLowerCase());
  if (existing) {
    const update = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (update.error) throw update.error;
    return existing;
  }
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error || new Error(`Could not create owner ${email}`);
  }
  return created.data.user;
}

async function ensureOwnerBootstrapState(admin, userId) {
  const now = new Date().toISOString();

  const onboardingRes = await admin
    .from("user_onboarding_state")
    .upsert({
      user_id: userId,
      current_step: "complete",
      completed_steps: ["identity", "verification", "consent", "personal_details", "complete"],
      is_completed: true,
      terms_accepted: true,
      marketing_opt_in: false,
      updated_at: now,
    }, { onConflict: "user_id" });
  if (onboardingRes.error) throw onboardingRes.error;

  const termsRes = await admin
    .from("terms_acceptances")
    .upsert({
      user_id: userId,
      terms_version: "legacy-fortress-2026-03",
      accepted: true,
      accepted_at: now,
      source: "prove_no_email_contact_identity",
      updated_at: now,
    }, { onConflict: "user_id" });
  if (termsRes.error) throw termsRes.error;
}
