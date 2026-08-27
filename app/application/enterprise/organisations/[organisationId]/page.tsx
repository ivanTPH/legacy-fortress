import { redirect } from "next/navigation";

export default async function EnterpriseOrganisationDetailPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  redirect(`/enterprise/organisations/${encodeURIComponent(organisationId)}`);
}
