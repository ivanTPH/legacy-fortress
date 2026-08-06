import AdminControlPlaneWorkspace from "@/components/admin/AdminControlPlaneWorkspace";

export default async function AdminOrganisationInvitationsPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  return <AdminControlPlaneWorkspace section="organisation-invitations" resourceId={organisationId} />;
}
