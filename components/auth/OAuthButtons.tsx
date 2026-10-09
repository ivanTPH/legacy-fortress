"use client";

import { useState } from "react";
import Icon from "../ui/Icon";
import { getConfiguredAuthProviders, type AuthProvider } from "../../lib/auth/authProviders";

type OAuthButtonsProps = {
  nextPath?: string;
};

export default function OAuthButtons({ nextPath = "/onboarding" }: OAuthButtonsProps) {
  const [status, setStatus] = useState("");
  const providers = getConfiguredAuthProviders();

  async function oauth(provider: AuthProvider) {
    setStatus("Redirecting...");
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` : undefined;
    const { supabase } = await import("../../lib/supabaseClient");

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (error) setStatus(`Could not start ${provider} sign-in: ${error.message}`);
  }

  return (
    providers.length > 0 ? <div style={{ display: "grid", gap: 8 }}>
      {providers.map((provider) => (
        <button key={provider} type="button" className="lf-link-btn" onClick={() => void oauth(provider)}>
          <Icon name="login" size={16} />
          Continue with {provider === "google" ? "Google" : "Apple"}
        </button>
      ))}
      {status ? <div className="lf-muted-note">{status}</div> : null}
    </div> : null
  );
}
