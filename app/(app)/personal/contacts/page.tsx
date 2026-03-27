import { redirect } from "next/navigation";

export default async function PersonalContactsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  const contact = resolvedSearchParams?.contact;
  const selectedContactId = Array.isArray(contact) ? contact[0] : contact;
  if (selectedContactId) {
    params.set("contact", selectedContactId);
  }
  redirect(params.toString() ? `/contacts?${params.toString()}` : "/contacts");
}
