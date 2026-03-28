"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsOverviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/account/my-vault");
  }, [router]);

  return null;
}
