import { Suspense } from "react";
import VerifyDevice from "@/components/auth/VerifyDevice";

export default function VerifyDevicePage() {
  return <Suspense fallback={null}><VerifyDevice /></Suspense>;
}
