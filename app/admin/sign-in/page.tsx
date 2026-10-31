import { Suspense } from "react";
import StaffSignIn from "@/components/auth/StaffSignIn";

export default function AdminSignInPage() {
  return <Suspense fallback={null}><StaffSignIn portal="admin" /></Suspense>;
}
