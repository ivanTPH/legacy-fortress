import { redirect } from "next/navigation";

export default async function PersonalContactsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  const contact = resolvedSearchParams?.contact;
  const group = resolvedSearchParams?.group;
  const selectedContactId = Array.isArray(contact) ? contact[0] : contact;
  const selectedGroup = Array.isArray(group) ? group[0] : group;
  if (selectedContactId) {
    params.set("contact", selectedContactId);
  }
  if (selectedGroup) {
    params.set("group", selectedGroup);
  }
  redirect(params.toString() ? `/contacts?${params.toString()}` : "/contacts");
}
