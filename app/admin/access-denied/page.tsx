"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminAccessDeniedPage() {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  return (
    <main className="lf-admin-page">
      <section className="lf-admin-panel">
        <p className="lf-admin-eyebrow">Legacy Fortress Admin</p>
        <h1>Access not available</h1>
        <p>
          This account does not currently have permission to use the internal operations area. Your standard Legacy Fortress vault remains separate.
        </p>
        <div className="lf-admin-header-actions">
          <Link className="lf-admin-secondary-link" href="/dashboard">Return to your vault</Link>
          <button type="button" className="lf-admin-secondary-button" onClick={signOut}>Sign out</button>
        </div>
      </section>
    </main>
  );
}
