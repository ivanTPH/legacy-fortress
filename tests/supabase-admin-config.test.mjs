import test from "node:test";
import assert from "node:assert/strict";

import { getSupabaseAdminConfigIssue } from "../lib/supabaseAdmin.ts";

test("supabase admin config reports malformed service role keys", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "header.payload.";

  try {
    assert.equal(getSupabaseAdminConfigIssue(), "malformed_service_role_key");
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
