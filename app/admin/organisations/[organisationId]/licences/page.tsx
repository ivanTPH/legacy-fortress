import AdminControlPlaneWorkspace from "@/components/admin/AdminControlPlaneWorkspace";

export default async function AdminOrganisationLicencesPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  return <AdminControlPlaneWorkspace section="organisation-licences" resourceId={organisationId} />;
}
