import { redirect } from "next/navigation";

/**
 * Retired (owner-approved UX review, Stage 3): the old Personal overview repeated other areas and wasn't in the menu.
 * Possessions is the Personal area; the sub-pages (/personal/wishes etc.) keep their own routes.
 */
export default function PersonalOverviewPage() {
  redirect("/vault/personal");
}
