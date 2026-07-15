"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExecutorsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/contacts?group=executors");
  }, [router]);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Opening executor contacts</h1>
      <p style={{ margin: 0, color: "#64748b" }}>
        Executors now live in Contacts. Taking you to that grouped view.
      </p>
    </main>
  );
}
