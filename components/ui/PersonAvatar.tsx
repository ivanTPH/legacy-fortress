"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * A person's photo where they have one (owner, 27 Nov 2026), otherwise their initials. Photos come only from people
 * who accepted an invitation and linked their account; see lib/people/photos.ts.
 */
let photosPromise: Promise<Record<string, string>> | null = null;
let photosLoadedAt = 0;

export function loadPeoplePhotos(force = false): Promise<Record<string, string>> {
  // Signed links last an hour; refresh well before that.
  if (!force && photosPromise && Date.now() - photosLoadedAt < 30 * 60 * 1000) return photosPromise;
  photosLoadedAt = Date.now();
  photosPromise = (async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return {};
      const response = await fetch("/api/people/photos", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) return {};
      const json = (await response.json().catch(() => null)) as { photos?: Record<string, string> } | null;
      return json?.photos ?? {};
    } catch {
      return {};
    }
  })();
  return photosPromise;
}

export function usePeoplePhotos() {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void loadPeoplePhotos().then((value) => { if (active) setPhotos(value); });
    return () => { active = false; };
  }, []);
  return photos;
}

export function personInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export default function PersonAvatar({ name, photoUrl, className = "" }: { name: string; photoUrl?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !failed;
  return (
    <span className={`${className} lf-person-photo-avatar${showPhoto ? " has-photo" : ""}`.trim()} aria-hidden="true">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage links
        <img src={photoUrl ?? ""} alt="" onError={() => setFailed(true)} />
      ) : personInitials(name)}
    </span>
  );
}
