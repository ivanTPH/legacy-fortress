import { redirect } from "next/navigation";

export default function ActionCentrePage() {
  redirect("/dashboard?view=action-centre#action-centre");
}
