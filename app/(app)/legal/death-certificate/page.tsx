"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyDeathCertificateRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/access-requests");
  }, [router]);

  return <div style={{ color: "#6b7280" }}>Redirecting to Access Requests…</div>;
}
