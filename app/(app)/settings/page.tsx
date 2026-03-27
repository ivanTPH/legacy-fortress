"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsOverviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile#account-settings");
  }, [router]);

  return null;
}
