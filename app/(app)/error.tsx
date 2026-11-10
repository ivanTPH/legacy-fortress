"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reloadOnceForNewVersion } from "../../lib/errors/recovery";

/** Something in a Vault page failed in the browser. Keeps the menus around it and offers a calm way on. */
export default function VaultPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    console.error("[LF] page error", error?.name, error?.message, error?.digest ?? "");
    if (reloadOnceForNewVersion(error)) queueMicrotask(() => setReloading(true));
  }, [error]);
  if (reloading) return <p className="lf-inline-status" role="status">Updating to the latest version…</p>;
  return (
    <section className="lf-page-error" role="alert">
      <h1>Sorry, this page didn’t load</h1>
      <p>Nothing in your Vault has been changed. Please try again. If it keeps happening, let us know through Support.</p>
      <div>
        <button type="button" className="lf-inbox-primary" onClick={() => reset()}>Try again</button>
        <Link href="/dashboard" className="lf-inbox-secondary">Go to Home</Link>
      </div>
    </section>
  );
}
