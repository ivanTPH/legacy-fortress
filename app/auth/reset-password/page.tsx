import { redirect } from "next/navigation";

export default function LegacyResetPasswordAlias() {
  redirect("/reset-password");
}
