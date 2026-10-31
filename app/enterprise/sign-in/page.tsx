import { Suspense } from "react";
import StaffSignIn from "@/components/auth/StaffSignIn";

export default function PartnerSignInPage() {
  return <Suspense fallback={null}><StaffSignIn portal="partner" /></Suspense>;
}
