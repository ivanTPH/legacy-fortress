import AdminControlPlaneWorkspace from "@/components/admin/AdminControlPlaneWorkspace";

export default async function AdminVerificationDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <AdminControlPlaneWorkspace section="verification-detail" resourceId={caseId} />;
}
