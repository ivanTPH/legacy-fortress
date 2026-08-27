import { redirect } from "next/navigation";

export default async function ApplicationEnterpriseEntryPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tab = typeof params?.tab === "string" ? params.tab : "";
  const validTabs = new Set(["organisations", "licences", "users", "invitations", "adoption", "reports", "consent", "renewals", "settings"]);
  redirect(validTabs.has(tab) ? `/enterprise?tab=${encodeURIComponent(tab)}` : "/enterprise");
}
