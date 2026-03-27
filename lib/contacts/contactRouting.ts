export function buildContactsWorkspaceHref(contactId?: string | null) {
  const normalizedContactId = String(contactId ?? "").trim();
  if (!normalizedContactId) return "/contacts";

  const params = new URLSearchParams({
    contact: normalizedContactId,
  });
  return `/contacts?${params.toString()}`;
}
