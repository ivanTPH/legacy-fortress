import type { CanonicalContactContext } from "./canonicalContacts";

export function buildContactsWorkspaceHref(contactId?: string | null) {
  const normalizedContactId = String(contactId ?? "").trim();
  if (!normalizedContactId) return "/contacts";

  const params = new URLSearchParams({
    contact: normalizedContactId,
  });
  return `/contacts?${params.toString()}`;
}

export function buildLinkedContactRecordHref(context: CanonicalContactContext) {
  const pathname = resolveLinkedContactRecordPath(context);
  if (!pathname) return "";

  const params = new URLSearchParams();
  if (context.source_kind === "asset") params.set("asset", context.source_id);
  if (context.source_kind === "record") params.set("record", context.source_id);

  return params.size ? `${pathname}?${params.toString()}` : pathname;
}

function resolveLinkedContactRecordPath(context: CanonicalContactContext) {
  const sectionKey = String(context.section_key ?? "").trim().toLowerCase();
  const categoryKey = String(context.category_key ?? "").trim().toLowerCase();

  if (sectionKey === "legal" && categoryKey) return `/legal/${categoryKey}`;
  if (sectionKey === "finances" && categoryKey) return `/finances/${categoryKey}`;
  if (sectionKey === "personal" && categoryKey === "beneficiaries") return "/personal/beneficiaries";
  if (sectionKey === "personal" && categoryKey === "executors") return "/trust";
  if (sectionKey === "personal" && categoryKey === "tasks") return "/personal/tasks";
  if (sectionKey === "personal" && categoryKey === "subscriptions") return "/personal/subscriptions";
  if (sectionKey === "personal" && categoryKey === "social-media") return "/personal/social-media";
  if (sectionKey === "personal" && categoryKey === "personal") return "/vault/personal";
  if (sectionKey === "property") return context.source_kind === "asset" ? "/vault/property" : "/property";
  if (sectionKey === "business") return "/business";
  if (sectionKey === "digital") return "/vault/digital";
  if (sectionKey === "cars_transport") return "/cars-transport";

  return "";
}
