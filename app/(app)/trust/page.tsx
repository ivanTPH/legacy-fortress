import { redirect } from "next/navigation";

export default async function TrustRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  params.set("group", "trusted-contacts");
  const contact = resolvedSearchParams?.contact;
  const selectedContactId = Array.isArray(contact) ? contact[0] : contact;
  if (selectedContactId) {
    params.set("contact", selectedContactId);
  }
  redirect(`/contacts?${params.toString()}`);
}
