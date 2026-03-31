import { redirect } from "next/navigation";

export default function TrustedContactsRedirectPage() {
  redirect("/contacts?group=trusted-contacts");
}
