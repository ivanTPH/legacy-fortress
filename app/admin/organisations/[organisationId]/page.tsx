import { Suspense } from "react";
import PlatformOrganisationControlCentre from "@/components/admin/PlatformOrganisationControlCentre";

export default async function AdminOrganisationDetailPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  return <Suspense fallback={null}><PlatformOrganisationControlCentre organisationId={organisationId} /></Suspense>;
}
