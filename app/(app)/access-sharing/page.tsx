import { Suspense } from "react";
import AccessSharingWorkspace from "../../../components/access/AccessSharingWorkspace";

export default function AccessSharingPage() {
  return <Suspense fallback={null}><AccessSharingWorkspace /></Suspense>;
}
