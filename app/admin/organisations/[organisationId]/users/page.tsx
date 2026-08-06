import AdminControlPlaneWorkspace from "@/components/admin/AdminControlPlaneWorkspace";

export default async function AdminOrganisationUsersPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  return <AdminControlPlaneWorkspace section="organisation-users" resourceId={organisationId} />;
}
