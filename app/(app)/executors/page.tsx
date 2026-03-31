import { redirect } from "next/navigation";

export default function ExecutorsRedirectPage() {
  redirect("/contacts?group=executors");
}
