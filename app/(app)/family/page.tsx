import { redirect } from "next/navigation";

export default function FamilyRedirectPage() {
  redirect("/contacts?group=family");
}
