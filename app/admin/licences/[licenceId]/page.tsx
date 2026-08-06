import AdminControlPlaneWorkspace from "@/components/admin/AdminControlPlaneWorkspace";

export default async function AdminLicenceDetailPage({ params }: { params: Promise<{ licenceId: string }> }) {
  const { licenceId } = await params;
  return <AdminControlPlaneWorkspace section="licence-detail" resourceId={licenceId} />;
}
