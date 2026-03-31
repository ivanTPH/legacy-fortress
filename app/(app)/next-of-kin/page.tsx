import { redirect } from "next/navigation";

export default function NextOfKinRedirectPage() {
  redirect("/contacts?group=next-of-kin");
}
