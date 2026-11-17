import { Suspense } from "react";
import { redirect } from "next/navigation";
import AccessSharingWorkspace from "../../../components/access/AccessSharingWorkspace";

/**
 * Who can see one record (?asset= or ?record=) keeps this page. The old overview is retired into People › Shared now
 * (owner-approved UX review, Stage 3), so a plain link lands there.
 */
export default async function AccessSharingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (!params.asset && !params.record) redirect("/people-access?view=shared");
  return <Suspense fallback={null}><AccessSharingWorkspace /></Suspense>;
}
