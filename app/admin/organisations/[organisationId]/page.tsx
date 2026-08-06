import AdminControlPlaneWorkspace from "@/components/admin/AdminControlPlaneWorkspace";

export default async function AdminOrganisationDetailPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  return <AdminControlPlaneWorkspace section="organisation-detail" resourceId={organisationId} />;
}
