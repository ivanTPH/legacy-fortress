import { Suspense } from "react";
import PlatformOrganisationControlCentre from "@/components/admin/PlatformOrganisationControlCentre";

export default function AdminOrganisationsPage() {
  return <Suspense fallback={null}><PlatformOrganisationControlCentre /></Suspense>;
}
