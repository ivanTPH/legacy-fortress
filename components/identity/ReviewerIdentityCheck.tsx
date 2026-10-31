"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";

/**
 * In-house identity check (owner-approved 30 Oct 2026). Document photo → live selfie with a random
 * prompt → a person compares them. Checking ID never gives access to anything by itself.
 */

type Step = "loading" | "intro" | "document" | "selfie" | "waiting" | "verified" | "failed";
type DocType = "passport" | "driving_licence" | "national_identity_document";

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return `Bearer ${data.session?.access_token ?? ""}`;
}

async function call(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", await authHeader());
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json.message ?? json.error ?? `HTTP ${res.status}`));
  return json;
}

const FRIENDLY: Record<string, string> = {
  unsupported_identity_evidence_type: "Use a photo (JPEG or PNG). Documents can also be a PDF.",
  identity_evidence_size_invalid: "That file is too large. Use a photo under 10 MB.",
  presence_challenge_expired: "The prompt expired. Take the selfie again.",
  identity_consent_required: "Tick the box to agree to the check.",
};

function friendly(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return FRIENDLY[message] ?? "That didn’t work. Try again, or contact support if it keeps happening.";
}

export function ReviewerIdentityCheck({ purpose, accessGrantId, invitationId, returnTo }: { purpose: "linked_access" | "registration_required"; accessGrantId: string | null; invitationId: string | null; returnTo: string | null }) {
  const [step, setStep] = useState<Step>("loading");
  const [requestId, setRequestId] = useState("");
  const [consent, setConsent] = useState(false);
  const [docType, setDocType] = useState<DocType>("passport");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [challenge, setChallenge] = useState<{ id: string; prompt: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const json = await call("/api/identity-verification");
        const latest = (json.requests ?? []).find((row: { provider_key: string; requested_identity_level: number }) => row.provider_key === "lf_inhouse_review_v1" && row.requested_identity_level === 2);
        if (!active) return;
        if (latest?.status === "verified" && (!latest.expires_at || Date.parse(latest.expires_at) > Date.now())) { setStep("verified"); return; }
        if (latest?.status === "review_required") { setRequestId(latest.id); setStep("waiting"); return; }
        if (latest && ["document_required", "document_extracted"].includes(latest.status)) { setRequestId(latest.id); setStep("document"); return; }
        if (latest && ["camera_required", "camera_captured"].includes(latest.status)) { setRequestId(latest.id); setStep("selfie"); return; }
        setStep(latest?.status === "failed" ? "failed" : "intro");
      } catch {
        if (active) setStep("intro");
      }
    })();
    return () => { active = false; };
  }, []);

  async function start() {
    setBusy(true); setError("");
    try {
      const json = await call("/api/identity-verification", { method: "POST", body: JSON.stringify({ purpose, requestedIdentityLevel: 2, accessGrantId, invitationId, consentAcknowledged: consent }) });
      setRequestId(json.verification.id);
      setStep("document");
    } catch (cause) { setError(friendly(cause)); }
    finally { setBusy(false); }
  }

  async function uploadDocument() {
    if (!docFile) return;
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("file", docFile);
      form.set("side", "front");
      form.set("documentType", docType);
      const json = await call(`/api/identity-verification/${requestId}/document`, { method: "POST", body: form });
      if (json.document?.extractionStatus === "failed") throw new Error("identity_evidence_size_invalid");
      setStep("selfie");
    } catch (cause) { setError(friendly(cause)); }
    finally { setBusy(false); }
  }

  const issueChallenge = useCallback(async () => {
    setError("");
    try {
      const json = await call(`/api/identity-verification/${requestId}/challenge`, { method: "POST" });
      setChallenge({ id: json.challenge.id, prompt: json.challenge.prompt });
    } catch (cause) { setError(friendly(cause)); }
  }, [requestId]);

  useEffect(() => {
    if (step !== "selfie" || challenge || !requestId) return;
    queueMicrotask(() => { void issueChallenge(); });
  }, [step, challenge, requestId, issueChallenge]);

  async function uploadSelfie(file: File) {
    if (!challenge) return;
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("challengeId", challenge.id);
      await call(`/api/identity-verification/${requestId}/camera`, { method: "POST", body: form });
      await call(`/api/identity-verification/${requestId}/complete`, { method: "POST" });
      setStep("waiting");
    } catch (cause) {
      setError(friendly(cause));
      if (cause instanceof Error && cause.message === "presence_challenge_expired") { setChallenge(null); }
    } finally { setBusy(false); }
  }

  const progress = ["Your document", "A live selfie", "We check"];
  const current = step === "document" ? 0 : step === "selfie" ? 1 : step === "waiting" || step === "verified" ? 2 : -1;

  return <section className="lf-auth-card lf-trust-card lf-idv">
    {current >= 0 ? <ol className="lf-idv-progress" aria-label="Steps">{progress.map((label, index) => <li key={label} className={index < current || step === "verified" ? "is-done" : index === current ? "is-current" : ""}><span aria-hidden="true">{index < current || step === "verified" ? <Icon name="check" size={14} /> : index + 1}</span>{label}</li>)}</ol> : null}

    {step === "loading" ? <p className="lf-muted-note">Loading…</p> : null}

    {step === "intro" || step === "failed" ? <>
      <h1>Prove who you are</h1>
      {step === "failed" ? <p className="lf-va-error" role="alert">Your last check couldn’t be approved. You can try again.</p> : null}
      <ul className="lf-idv-needs">
        <li><Icon name="badge" size={20} />A passport, driving licence or national ID card</li>
        <li><Icon name="photo_camera" size={20} />A quick selfie while you follow a simple prompt</li>
        <li><Icon name="person_search" size={20} />A person on our team compares the two, usually within one working day</li>
      </ul>
      <p className="lf-idv-note"><Icon name="info" size={18} />Checking your ID doesn’t give you access to anything. Your photos are used only for this check and deleted once it’s decided.</p>
      <label className="lf-idv-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to Legacy Fortress checking my ID using these photos.</span></label>
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
      <button className="lf-primary-btn" type="button" disabled={!consent || busy} onClick={() => void start()}>{busy ? "Starting…" : "Start"}</button>
    </> : null}

    {step === "document" ? <>
      <h1>Photograph your document</h1>
      <fieldset className="lf-idv-doc-types">
        <legend>Which document?</legend>
        {([["passport", "Passport"], ["driving_licence", "Driving licence"], ["national_identity_document", "National ID card"]] as const).map(([value, label]) => <label key={value} className={docType === value ? "is-selected" : ""}><input type="radio" name="idv-doc" checked={docType === value} onChange={() => setDocType(value)} />{label}</label>)}
      </fieldset>
      <p className="lf-muted-note">The photo page, flat, in good light, with all four corners showing and no glare.</p>
      <label className="lf-idv-file">
        <Icon name="photo_camera" size={22} />
        <span>{docFile ? docFile.name : "Take a photo or choose one"}</span>
        <input type="file" accept="image/jpeg,image/png,application/pdf" capture="environment" onChange={(event) => setDocFile(event.currentTarget.files?.[0] ?? null)} />
      </label>
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
      <button className="lf-primary-btn" type="button" disabled={!docFile || busy} onClick={() => void uploadDocument()}>{busy ? "Uploading…" : "Continue"}</button>
    </> : null}

    {step === "selfie" ? <>
      <h1>Take a live selfie</h1>
      {challenge ? <p className="lf-idv-prompt"><Icon name="front_hand" size={22} /><span>While you take it: <strong>{challenge.prompt}</strong></span></p> : <p className="lf-muted-note">Getting your prompt…</p>}
      <p className="lf-muted-note">Face the camera, in good light, with your whole face showing. The prompt lasts 15 minutes.</p>
      {challenge ? <SelfieCamera busy={busy} onCapture={(file) => void uploadSelfie(file)} /> : null}
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
    </> : null}

    {step === "waiting" ? <>
      <h1>We’re checking your ID</h1>
      <p>A person on our team is comparing your selfie with your document. This usually takes up to one working day. We’ll let you know when it’s done.</p>
      <p className="lf-idv-note"><Icon name="lock" size={18} />Checking your ID doesn’t give you access to anything. Your photos are deleted once it’s decided.</p>
      {returnTo ? <Link className="lf-primary-btn" href={returnTo}>Continue</Link> : <Link className="lf-primary-btn" href="/dashboard">Back to My Vault</Link>}
    </> : null}

    {step === "verified" ? <>
      <h1>Your ID is verified</h1>
      <p>You don’t need to do anything else. Your check lasts a year.</p>
      <p className="lf-idv-note"><Icon name="info" size={18} />Being verified doesn’t give you access to anything by itself.</p>
      {returnTo ? <Link className="lf-primary-btn" href={returnTo}>Continue</Link> : <Link className="lf-primary-btn" href="/dashboard">Back to My Vault</Link>}
    </> : null}
  </section>;
}

function SelfieCamera({ busy, onCapture }: { busy: boolean; onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<"off" | "on" | "unavailable">("off");

  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraState("on");
    } catch {
      setCameraState("unavailable");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  return <div className="lf-idv-camera">
    <video ref={videoRef} playsInline muted aria-label="Camera preview" hidden={cameraState !== "on"} />
    {cameraState === "on" ? <button className="lf-primary-btn" type="button" disabled={busy} onClick={capture}><Icon name="photo_camera" size={18} />{busy ? "Sending…" : "Take selfie"}</button>
      : cameraState === "off" ? <button className="lf-primary-btn" type="button" onClick={() => void startCamera()}><Icon name="videocam" size={18} />Turn on camera</button>
      : <>
        <p className="lf-muted-note">We couldn’t open the camera here. Use your phone’s camera instead.</p>
        <label className="lf-idv-file"><Icon name="photo_camera" size={22} /><span>Take a selfie</span>
          <input type="file" accept="image/jpeg,image/png" capture="user" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onCapture(file); }} />
        </label>
      </>}
  </div>;
}

/** Fresh "it's you" check (level 3): a one-time code to the account's email. */
export function PresenceCodeCheck({ returnTo }: { returnTo: string | null }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send() {
    setBusy(true); setError("");
    try { await call("/api/identity-verification/presence-code", { method: "POST", body: JSON.stringify({ action: "send" }) }); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t work."); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError("");
    try { await call("/api/identity-verification/presence-code", { method: "POST", body: JSON.stringify({ action: "verify", code }) }); setDone(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn’t work."); }
    finally { setBusy(false); }
  }

  return <section className="lf-auth-card lf-trust-card lf-idv">
    {done ? <>
      <h1>Thanks, that’s you</h1>
      <p>You can carry on for the next 10 minutes.</p>
      <Link className="lf-primary-btn" href={returnTo || "/dashboard"}>Continue</Link>
    </> : <>
      <h1>Confirm it’s you</h1>
      <p>For this step we need a fresh check. We’ll email a 6-digit code to the address you sign in with.</p>
      {sent ? <>
        <label className="lf-va-field" htmlFor="idv-code">Code from the email
          <input id="idv-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
        </label>
        {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
        <button className="lf-primary-btn" type="button" disabled={busy || code.length !== 6} onClick={() => void verify()}>{busy ? "Checking…" : "Confirm"}</button>
        <button className="lf-link-btn" type="button" disabled={busy} onClick={() => void send()}>Send a new code</button>
      </> : <>
        {error ? <p className="lf-va-error" role="alert">{error}{/verify your id/i.test(error) ? <> <Link href="/identity/verify">Verify your ID</Link></> : null}</p> : null}
        <button className="lf-primary-btn" type="button" disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : "Email me a code"}</button>
      </>}
    </>}
  </section>;
}
