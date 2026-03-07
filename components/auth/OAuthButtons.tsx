"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type OAuthButtonsProps = {
  nextPath?: string;
};

export default function OAuthButtons({ nextPath = "/onboarding" }: OAuthButtonsProps) {
  const [status, setStatus] = useState("");

  async function oauth(provider: "google" | "apple") {
    setStatus("Redirecting...");
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (error) setStatus(`Could not start ${provider} sign-in: ${error.message}`);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button type="button" className="lf-link-btn" onClick={() => void oauth("google")}>
        Continue with Google
      </button>
      <button type="button" className="lf-link-btn" onClick={() => void oauth("apple")}>
        Continue with Apple
      </button>
      {status ? <div className="lf-muted-note">{status}</div> : null}
    </div>
  );
}
