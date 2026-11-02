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

export function ReviewerIdentityCheck({ purpose, accessGrantId, invitationId, returnTo, caseRef = null }: { purpose: "linked_access" | "registration_required" | "admin_review"; accessGrantId: string | null; invitationId: string | null; returnTo: string | null; caseRef?: { type: "death_report" | "legal_authority"; id: string } | null }) {
  const [step, setStep] = useState<Step>("loading");
  const [requestId, setRequestId] = useState("");
  const [consent, setConsent] = useState(false);
  const [docType, setDocType] = useState<DocType>("passport");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [docSaved, setDocSaved] = useState(false);
  const [challenge, setChallenge] = useState<{ id: string; prompt: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    // A fresh check for a case always starts new.
    if (caseRef) { queueMicrotask(() => { if (active) setStep("intro"); }); return () => { active = false; }; }
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
  }, [caseRef]);

  async function start() {
    setBusy(true); setError("");
    try {
      const json = await call("/api/identity-verification", { method: "POST", body: JSON.stringify({ purpose: caseRef ? "admin_review" : purpose, requestedIdentityLevel: 2, accessGrantId, invitationId, consentAcknowledged: consent, caseType: caseRef?.type ?? null, caseId: caseRef?.id ?? null }) });
      setRequestId(json.verification.id);
      setStep("document");
    } catch (cause) { setError(friendly(cause)); }
    finally { setBusy(false); }
  }

  function chooseDocument(file: File | null) {
    setDocFile(file);
    setDocPreview((previous) => { if (previous) URL.revokeObjectURL(previous); return file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null; });
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
      setDocSaved(true);
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

  async function uploadSelfie(file: File, frames: Array<{ direction: "left" | "right"; file: File }> = []) {
    if (!challenge) return;
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("challengeId", challenge.id);
      for (const frame of frames) form.set(`frame_${frame.direction}`, frame.file);
      await call(`/api/identity-verification/${requestId}/camera`, { method: "POST", body: form });
      const result = await call(`/api/identity-verification/${requestId}/complete`, { method: "POST" });
      setStep(result.decision?.status === "verified" ? "verified" : "waiting");
    } catch (cause) {
      setError(friendly(cause));
      if (cause instanceof Error && cause.message === "presence_challenge_expired") { setChallenge(null); }
    } finally { setBusy(false); }
  }

  const progress = ["Document", "Selfie", "Check"];
  const current = step === "document" ? 0 : step === "selfie" ? 1 : step === "waiting" || step === "verified" ? 2 : -1;

  return <section className="lf-auth-card lf-trust-card lf-idv">
    {current >= 0 ? <ol className="lf-idv-progress" aria-label="Steps">{progress.map((label, index) => <li key={label} className={index < current || step === "verified" ? "is-done" : index === current ? "is-current" : ""}><span aria-hidden="true">{index < current || step === "verified" ? <Icon name="check" size={14} /> : index + 1}</span>{label}</li>)}</ol> : null}

    {step === "loading" ? <p className="lf-muted-note">Loading…</p> : null}

    {step === "intro" || step === "failed" ? <>
      <h1>{caseRef ? "Confirm it’s you" : "Prove who you are"}</h1>
      {caseRef ? <p>Because this is an important step, we ask for a fresh photo of your ID and a live selfie. A person on our team looks at them before anything changes.</p> : null}
      {step === "failed" ? <p className="lf-va-error" role="alert">Your last check couldn’t be approved. You can try again.</p> : null}
      <p className="lf-idv-lead">It takes about 3 minutes.</p>
      <ul className="lf-idv-needs">
        <li><Icon name="badge" size={22} />Photograph your passport or driving licence</li>
        <li><Icon name="photo_camera" size={22} />Take a selfie, turning your head when asked</li>
        <li><Icon name="notifications" size={22} />We tell you the result by email and in the app</li>
      </ul>
      <p className="lf-idv-note"><Icon name="lock" size={18} />Checking your ID doesn’t give you access to anything. Your photos are only used for this check, then deleted.</p>
      <label className="lf-idv-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to Legacy Fortress checking my ID using these photos.</span></label>
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
      <button className="lf-primary-btn" type="button" disabled={!consent || busy} onClick={() => void start()}>{busy ? "Starting…" : "Start"}</button>
    </> : null}

    {step === "document" ? <>
      <h1>Your document</h1>
      <fieldset className="lf-idv-doc-types">
        <legend>Which document?</legend>
        {([["passport", "Passport"], ["driving_licence", "Driving licence"], ["national_identity_document", "National ID card"]] as const).map(([value, label]) => <label key={value} className={docType === value ? "is-selected" : ""}><input type="radio" name="idv-doc" checked={docType === value} onChange={() => setDocType(value)} />{label}</label>)}
      </fieldset>
      <p className="lf-idv-lead">Photo page, flat, all four corners showing.</p>
      <label className={`lf-idv-file${docPreview ? " has-preview" : ""}`}>
        {docPreview ? <><img src={docPreview} alt="Your document photo" /><span className="lf-idv-saved"><Icon name="check_circle" size={18} />Photo taken · tap to retake</span></> : <><Icon name="photo_camera" size={24} /><span>Take a photo</span></>}
        <input type="file" accept="image/jpeg,image/png,application/pdf" capture="environment" onChange={(event) => chooseDocument(event.currentTarget.files?.[0] ?? null)} />
      </label>
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
      <button className="lf-primary-btn lf-idv-sticky" type="button" disabled={!docFile || busy} onClick={() => void uploadDocument()}>{busy ? "Uploading…" : "Use this photo"}</button>
    </> : null}

    {step === "selfie" ? <>
      {docSaved ? <p className="lf-idv-saved"><Icon name="check_circle" size={18} />Document photo received</p> : null}
      <h1>Your selfie</h1>
      <p className="lf-idv-lead">Hold the phone at eye level. Take off glasses if you can. Then follow the arrows.</p>
      {!challenge ? <p className="lf-muted-note">Getting ready…</p> : null}
      {challenge ? <SelfieCamera busy={busy} order={motionOrder(challenge.prompt)} onCapture={(file, frames) => void uploadSelfie(file, frames)} /> : null}
      {error ? <p className="lf-va-error" role="alert">{error}</p> : null}
    </> : null}

    {step === "waiting" ? <>
      <h1>{caseRef ? "Thank you" : "We’re checking your ID"}</h1>
      {caseRef ? <p>A person on our team will look at your photos together with the {caseRef.type === "death_report" ? "death certificate" : "authority"}. If they need anything else, we’ll ask you.</p> : null}
      <p className="lf-idv-saved"><Icon name="check_circle" size={18} />Document and selfie received</p>
      <p hidden={Boolean(caseRef)} className="lf-idv-lead">A person on our team will check your photos, usually within one working day.</p>
      <p className="lf-idv-lead">We’ll email you and show the result under the bell <Icon name="notifications" size={18} /> and in Settings › Profile.</p>
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

function motionOrder(prompt: string): Array<"left" | "right"> {
  const left = prompt.indexOf("LEFT");
  const right = prompt.indexOf("RIGHT");
  return left >= 0 && right >= 0 && right < left ? ["right", "left"] : ["left", "right"];
}

type Shot = "straight" | "left" | "right";
const SHOT_LABEL: Record<Shot, string> = { straight: "Look straight ahead", left: "Turn to your LEFT", right: "Turn to your RIGHT" };

function SelfieCamera({ busy, order, onCapture }: { busy: boolean; order: Array<"left" | "right">; onCapture: (file: File, frames: Array<{ direction: "left" | "right"; file: File }>) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<"off" | "on" | "unavailable">("off");
  const [shot, setShot] = useState<Shot | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [taken, setTaken] = useState<Array<{ label: string; url: string }>>([]);
  useEffect(() => () => { taken.forEach((item) => URL.revokeObjectURL(item.url)); }, [taken]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraState("on");
    } catch {
      setCameraState("unavailable");
    }
  }

  function grab(): Promise<File> {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video) { reject(new Error("no_camera")); return; }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 960;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob ? resolve(new File([blob], "selfie.jpg", { type: "image/jpeg" })) : reject(new Error("capture_failed")), "image/jpeg", 0.9);
    });
  }

  async function wait(seconds: number) {
    for (let left = seconds; left > 0; left -= 1) { setCountdown(left); await new Promise((resolve) => setTimeout(resolve, 1000)); }
    setCountdown(0);
  }

  async function runSequence() {
    setTaken([]);
    setShot("straight"); await wait(3);
    const straight = await grab();
    setTaken((current) => [...current, { label: "Straight", url: URL.createObjectURL(straight) }]);
    const frames: Array<{ direction: "left" | "right"; file: File }> = [];
    for (const direction of order) {
      setShot(direction); await wait(2);
      const file = await grab();
      frames.push({ direction, file });
      setTaken((current) => [...current, { label: direction === "left" ? "Left" : "Right", url: URL.createObjectURL(file) }]);
    }
    setShot(null);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onCapture(straight, frames);
  }

  return <div className="lf-idv-camera">
    <div className="lf-idv-camera-frame" hidden={cameraState !== "on"}>
      <video ref={videoRef} playsInline muted aria-label="Camera preview" />
      {shot ? <div className="lf-idv-camera-cue" role="status" aria-live="assertive">
        {shot !== "straight" ? <Icon name={shot === "left" ? "arrow_back" : "arrow_forward"} size={40} /> : null}
        <strong>{SHOT_LABEL[shot]}</strong>
        {countdown ? <span>{countdown}</span> : null}
      </div> : null}
    </div>
    {taken.length ? <ul className="lf-idv-taken" aria-label="Photos taken">{taken.map((item) => <li key={item.label}><img src={item.url} alt={`${item.label} photo`} /><span><Icon name="check_circle" size={14} />{item.label}</span></li>)}</ul> : null}
    {busy ? <p className="lf-idv-saved" role="status"><Icon name="cloud_upload" size={18} />Photos taken. Sending them securely…</p> : null}
    {cameraState === "on" ? <button className="lf-primary-btn lf-idv-sticky" type="button" disabled={busy || shot !== null} onClick={() => void runSequence()}><Icon name="photo_camera" size={18} />{busy ? "Sending…" : shot ? "Hold still…" : taken.length ? "Try again" : "Start"}</button>
      : cameraState === "off" ? <button className="lf-primary-btn lf-idv-sticky" type="button" onClick={() => void startCamera()}><Icon name="videocam" size={18} />Turn on camera</button>
      : <>
        <p className="lf-muted-note">We couldn’t open the camera here. You can take a selfie instead, but then a person checks it, which takes longer.</p>
        <label className="lf-idv-file"><Icon name="photo_camera" size={22} /><span>Take a selfie</span>
          <input type="file" accept="image/jpeg,image/png" capture="user" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onCapture(file, []); }} />
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
