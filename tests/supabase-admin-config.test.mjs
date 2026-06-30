import test from "node:test";
import assert from "node:assert/strict";

import { getSupabaseAdminConfigIssue } from "../lib/supabaseAdmin.ts";

test("supabase admin config reports malformed service role keys", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  try {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "header.payload.";
    assert.equal(getSupabaseAdminConfigIssue(), "malformed_service_role_key");

    process.env.SUPABASE_SERVICE_ROLE_KEY = "not-a-service-key";
    assert.equal(getSupabaseAdminConfigIssue(), "malformed_service_role_key");

    process.env.SUPABASE_SERVICE_ROLE_KEY = "   ";
    assert.equal(getSupabaseAdminConfigIssue(), "missing_service_role_key");
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test("supabase admin config accepts JWT and local sb_secret service-role keys", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55421";
  try {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "header.payload.signature";
    assert.equal(getSupabaseAdminConfigIssue(), null);

    process.env.SUPABASE_SERVICE_ROLE_KEY = ["sb", "secret", "localPreviewFixture"].join("_");
    assert.equal(getSupabaseAdminConfigIssue(), null);
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
