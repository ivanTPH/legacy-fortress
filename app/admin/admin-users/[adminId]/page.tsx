import AdminControlPlaneWorkspace from "@/components/admin/AdminControlPlaneWorkspace";

export default async function AdminAdminUserDetailPage({ params }: { params: Promise<{ adminId: string }> }) {
  const { adminId } = await params;
  return <AdminControlPlaneWorkspace section="admin-user-detail" resourceId={adminId} />;
}
