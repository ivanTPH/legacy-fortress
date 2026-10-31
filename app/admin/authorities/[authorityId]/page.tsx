import AdminControlPlaneWorkspace from "@/components/admin/AdminControlPlaneWorkspace";

export default async function AdminAuthorityDetailPage({ params }: { params: Promise<{ authorityId: string }> }) {
  const { authorityId } = await params;
  return <AdminControlPlaneWorkspace section="authority-detail" resourceId={authorityId} />;
}
