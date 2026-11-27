"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Icon from "../ui/Icon";

const DISMISS_KEY = "lf:add-photo-prompt:dismissed";

/**
 * "Add a photo of yourself?" (owner, 27 Nov 2026). Shown after someone adds a social media or online account, only
 * if they have no profile photo yet and haven't said "Not now". Facebook, LinkedIn and others don't let apps take
 * your profile picture, so we offer the two things that work: take a selfie, or choose one from your photos.
 */
export default function AddPhotoPrompt({ show }: { show: boolean }) {
  const [state, setState] = useState<"checking" | "ask" | "saving" | "done" | "hidden">("checking");
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!show) return;
    let active = true;
    void (async () => {
      try {
        if (window.localStorage.getItem(DISMISS_KEY)) { if (active) setState("hidden"); return; }
      } catch { /* storage unavailable: still ask */ }
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) { if (active) setState("hidden"); return; }
      const response = await fetch("/api/profile/identity-chip", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
      const json = (await response?.json().catch(() => null)) as { avatarUrl?: string } | null;
      if (active) setState(json && !json.avatarUrl ? "ask" : "hidden");
    })();
    return () => { active = false; };
  }, [show]);

  if (!show || state === "checking" || state === "hidden") return null;

  const notNow = () => {
    try { window.localStorage.setItem(DISMISS_KEY, new Date().toISOString()); } catch { /* optional */ }
    setState("hidden");
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setState("saving");
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const body = new FormData();
      body.set("photo", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` }, body });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !json?.ok) throw new Error(json?.error || "We couldn't save that photo. Please try again.");
      const chip = await fetch("/api/profile/identity-chip", { headers: { Authorization: `Bearer ${token ?? ""}` }, cache: "no-store" }).then((res) => res.json()).catch(() => null) as { avatarUrl?: string } | null;
      window.dispatchEvent(new CustomEvent("lf-profile-updated", { detail: { avatarUrl: chip?.avatarUrl ?? "" } }));
      setState("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't save that photo. Please try again.");
      setState("ask");
    }
  };

  if (state === "done") {
    return <div className="lf-add-photo-prompt is-done" role="status"><Icon name="check_circle" size={22} /><p>Photo added. You can change it any time in Profile.</p><button type="button" onClick={() => setState("hidden")}>Close</button></div>;
  }

  return (
    <section className="lf-add-photo-prompt" aria-label="Add a photo of yourself">
      <span className="lf-add-photo-prompt-icon" aria-hidden="true"><Icon name="add_a_photo" size={24} /></span>
      <div>
        <strong>Add a photo of yourself?</strong>
        <p>It helps the people you share your Vault with recognise you. Facebook and LinkedIn don&apos;t let us use your profile picture, so take a quick selfie or choose one from your photos.</p>
        {error ? <p className="lf-add-photo-prompt-error" role="alert">{error}</p> : null}
        <div className="lf-add-photo-prompt-actions">
          <button type="button" className="is-primary" disabled={state === "saving"} onClick={() => cameraRef.current?.click()}><Icon name="photo_camera" size={18} />Take a selfie</button>
          <button type="button" disabled={state === "saving"} onClick={() => libraryRef.current?.click()}><Icon name="photo_library" size={18} />Choose from photos</button>
          <button type="button" className="is-quiet" disabled={state === "saving"} onClick={notNow}>Not now</button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={(event) => void upload(event.target.files?.[0])} />
        <input ref={libraryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(event) => void upload(event.target.files?.[0])} />
        {state === "saving" ? <p role="status">Saving your photo…</p> : null}
      </div>
    </section>
  );
}
