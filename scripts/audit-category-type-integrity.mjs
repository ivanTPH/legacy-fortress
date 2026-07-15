import { createClient } from "@supabase/supabase-js";
import {
  CATEGORY_TYPE_DEFINITIONS,
  resolveCategoryTypeOption,
} from "../lib/assets/categoryTypeIntegrity.mjs";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_ROLE
  || process.env.SUPABASE_ADMIN_KEY
  || process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  throw new Error("A local Supabase service-role/admin key is required for the audit.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const financeDefinitions = CATEGORY_TYPE_DEFINITIONS.filter((definition) => definition.sectionKey === "finances");

function readType(row, definition) {
  const metadata = row.metadata_json ?? row.metadata ?? {};
  return metadata[definition.typeField] ?? "";
}

function inferFinanceCategory(value) {
  for (const definition of financeDefinitions) {
    if (resolveCategoryTypeOption(definition.sectionKey, definition.categoryKey, value)) {
      return definition.categoryKey;
    }
  }
  return null;
}

function classify(row, source) {
  const definition = financeDefinitions.find((item) => item.categoryKey === row.category_key);
  if (!definition) return null;
  const typeValue = readType(row, definition);
  if (!String(typeValue ?? "").trim()) return null;
  if (resolveCategoryTypeOption(definition.sectionKey, definition.categoryKey, typeValue)) return null;
  const inferred = inferFinanceCategory(typeValue);
  return {
    source,
    id: row.id,
    owner_user_id: row.owner_user_id,
    current_category: row.category_key,
    current_type: typeValue,
    inferred_category: inferred,
    confidence: inferred ? "deterministic" : "ambiguous",
    recommended_action: inferred
      ? `Move to finances/${inferred} and preserve id-linked documents, attachments and contacts.`
      : "Flag for owner/admin review before changing category.",
  };
}

const [recordsRes, assetsRes] = await Promise.all([
  supabase
    .from("records")
    .select("id,owner_user_id,section_key,category_key,metadata")
    .eq("section_key", "finances"),
  supabase
    .from("assets")
    .select("id,owner_user_id,section_key,category_key,metadata_json")
    .eq("section_key", "finances")
    .is("deleted_at", null),
]);

if (recordsRes.error) throw new Error(recordsRes.error.message);
if (assetsRes.error) throw new Error(assetsRes.error.message);

const findings = [
  ...(recordsRes.data ?? []).map((row) => classify(row, "records")),
  ...(assetsRes.data ?? []).map((row) => classify(row, "assets")),
].filter(Boolean);

console.log(JSON.stringify({
  checked: {
    records: recordsRes.data?.length ?? 0,
    assets: assetsRes.data?.length ?? 0,
  },
  finding_count: findings.length,
  findings,
}, null, 2));
