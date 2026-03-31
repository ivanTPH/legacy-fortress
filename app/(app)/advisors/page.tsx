import { redirect } from "next/navigation";

export default function AdvisorsRedirectPage() {
  redirect("/contacts?group=advisors");
}
