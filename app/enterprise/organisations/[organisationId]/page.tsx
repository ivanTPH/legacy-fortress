import EnterpriseOrganisationDetailWorkspace from "@/components/enterprise/EnterpriseOrganisationDetailWorkspace";

export default async function EnterpriseOrganisationDetailPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  return <EnterpriseOrganisationDetailWorkspace organisationId={organisationId} />;
}
