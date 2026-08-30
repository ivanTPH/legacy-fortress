"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "../../(app)/components/BrandMark";
import Icon from "../../../components/ui/Icon";
import { supabase } from "../../../lib/supabaseClient";

type VerificationResponse = {
  ok: boolean;
  verification?: {
    id: string;
    status: string;
    requestedIdentityLevel: number;
    purpose: string;
  };
  document?: {
    extractionStatus: string;
    extractionConfidence: number;
    extractionWarnings: string[];
  };
  challenge?: {
    id: string;
    prompt: string;
    expiresAt: string;
  };
  liveness?: {
    result: string;
    confidence: number;
  };
  decision?: {
    status: string;
    identityLevel: number | null;
    reasonCodes: string[];
    requiresManualReview: boolean;
    expiresAt: string | null;
  };
  error?: string;
};

export default function IdentityVerificationPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [verificationId, setVerificationId] = useState(params.get("request") ?? "");
  const [challengeId, setChallengeId] = useState("");
  const [status, setStatus] = useState("Preparing identity verification...");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("passport");
  const [scenario, setScenario] = useState("success");
  const [cameraBlob, setCameraBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [decision, setDecision] = useState<VerificationResponse["decision"] | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const accessToken = data.session?.access_token ?? "";
      setToken(accessToken);
      if (!accessToken) setStatus("Sign in to continue identity verification.");
    });
    return () => {
      mounted = false;
      stopCamera();
    };
  }, [stopCamera]);

  async function start() {
    if (!token) {
      router.replace(`/sign-in?next=${encodeURIComponent("/identity/verify")}`);
      return;
    }
    setBusy(true);
    setStatus("Starting verification...");
    try {
      const purpose = params.get("purpose") === "step_up_presence" ? "step_up_presence" : "linked_access";
      const res = await api("/api/identity-verification", {
        method: "POST",
        body: JSON.stringify({
          purpose,
          requestedIdentityLevel: purpose === "step_up_presence" ? 3 : 2,
          accessGrantId: params.get("grant"),
          invitationId: params.get("invitation"),
        }),
      });
      if (!res.verification?.id) throw new Error(res.error ?? "Could not start verification.");
      setVerificationId(res.verification.id);
      setStatus(purpose === "step_up_presence" ? "Fresh presence check required." : "Upload a synthetic UAT identity document to continue.");
      if (purpose === "step_up_presence") await createChallenge(res.verification.id);
    } catch (error) {
      setStatus(readError(error));
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument() {
    if (!verificationId || !documentFile) return;
    setBusy(true);
    setStatus("Uploading and extracting document data...");
    try {
      const form = new FormData();
      const syntheticName = `${documentType}-${scenario}-${documentFile.name}`;
      form.set("file", new File([documentFile], syntheticName, { type: documentFile.type }));
      form.set("side", "front");
      const res = await api(`/api/identity-verification/${verificationId}/document`, { method: "POST", body: form });
      if (!res.ok) throw new Error(res.error ?? "Document upload failed.");
      setStatus(res.document?.extractionWarnings?.length ? "Document extracted with warnings. Continue to camera capture." : "Document extracted. Continue to camera capture.");
      await createChallenge(verificationId);
    } catch (error) {
      setStatus(readError(error));
    } finally {
      setBusy(false);
    }
  }

  async function createChallenge(id = verificationId) {
    const res = await api(`/api/identity-verification/${id}/challenge`, { method: "POST" });
    if (!res.challenge?.id) throw new Error(res.error ?? "Could not create camera challenge.");
    setChallengeId(res.challenge.id);
    setStatus(res.challenge.prompt);
  }

  async function openCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus("Camera ready. Capture only when your face is aligned with the challenge.");
    } catch {
      setCameraError("Camera is unavailable or permission was denied. Use the upload fallback for controlled UAT.");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera frame is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setCameraBlob(blob);
        stopCamera();
        setStatus("Camera capture staged. Submit it for liveness and 1:1 comparison.");
      }
    }, "image/png");
  }

  async function submitCamera() {
    if (!verificationId || !challengeId || !cameraBlob) return;
    setBusy(true);
    setStatus("Submitting live capture...");
    try {
      const form = new FormData();
      form.set("challengeId", challengeId);
      form.set("file", new File([cameraBlob], `live-camera-${scenario}.png`, { type: "image/png" }));
      const res = await api(`/api/identity-verification/${verificationId}/camera`, { method: "POST", body: form });
      if (!res.ok) throw new Error(res.error ?? "Camera capture failed.");
      setStatus("Liveness evaluated. Completing provider decision...");
      const final = await api(`/api/identity-verification/${verificationId}/complete`, { method: "POST" });
      if (!final.decision) throw new Error(final.error ?? "Verification decision failed.");
      setDecision(final.decision);
      setStatus(statusForDecision(final.decision.status));
      if (final.decision.status === "verified") {
        await api(`/api/identity-verification/${verificationId}/cleanup`, { method: "POST" }).catch(() => null);
      }
    } catch (error) {
      setStatus(readError(error));
    } finally {
      setBusy(false);
    }
  }

  async function api(path: string, init: RequestInit = {}): Promise<VerificationResponse> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const res = await fetch(path, { ...init, headers });
    const json = await res.json().catch(() => ({ ok: false, error: "invalid_json_response" }));
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  }

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={38} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Identity verification</div>
          </div>
        </div>
        <div className="lf-auth-art-copy">
          <h2>Verify identity before protected access.</h2>
          <p>This controlled flow compares your supplied identity document portrait with a fresh camera capture. It does not search across people.</p>
        </div>
      </section>

      <section className="lf-auth-form-side">
        <div className="lf-auth-card" style={{ maxWidth: 620 }}>
          <h1>Identity verification</h1>
          <p className="lf-auth-subtext">
            Legacy Fortress needs Level 2 identity assurance before protected linked access. High-risk actions require a fresh Level 3 presence check.
          </p>

          <div className="lf-muted-note" role="status">{status}</div>

          {!verificationId ? (
            <button className="lf-primary-btn" type="button" onClick={() => void start()} disabled={busy || !token}>
              <Icon name="verified_user" size={16} />
              Start verification
            </button>
          ) : null}

          {verificationId && !challengeId ? (
            <section style={panelStyle}>
              <strong>Document capture</strong>
              <span>Staging verification — test results only. Use generated synthetic identity imagery; this does not establish genuine biometric identity.</span>
              <label style={{ display: "grid", gap: 6 }}>
                Document type
                <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} disabled={busy}>
                  <option value="passport">Passport</option>
                  <option value="driving_licence">Driving licence</option>
                  <option value="national_identity_document">National identity document</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                Staging test scenario
                <select value={scenario} onChange={(event) => setScenario(event.target.value)} disabled={busy}>
                  <option value="success">Successful checks</option>
                  <option value="expired">Expired document</option>
                  <option value="document-failed">Document authenticity failure</option>
                  <option value="blur">Document quality review</option>
                  <option value="mismatch">Face comparison mismatch</option>
                  <option value="low-confidence">Liveness review</option>
                  <option value="liveness-fail">Liveness failure</option>
                </select>
              </label>
              <input
                aria-label="Upload identity document"
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={(event) => setDocumentFile(event.currentTarget.files?.[0] ?? null)}
              />
              <button className="lf-primary-btn" type="button" onClick={() => void uploadDocument()} disabled={busy || !documentFile}>
                <Icon name="upload" size={16} />
                Upload document
              </button>
            </section>
          ) : null}

          {challengeId ? (
            <section style={panelStyle}>
              <strong>Live camera capture</strong>
              <span>Camera access starts only when requested and stops after capture or when you leave this page.</span>
              <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", borderRadius: 8, background: "#0f172a", aspectRatio: "16 / 9" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="lf-link-btn" type="button" onClick={() => void openCamera()}>
                  <Icon name="photo_camera" size={16} />
                  Open camera
                </button>
                <button className="lf-link-btn" type="button" onClick={captureFrame}>
                  <Icon name="center_focus_strong" size={16} />
                  Capture
                </button>
              </div>
              {cameraError ? <div className="lf-muted-note" role="alert">{cameraError}</div> : null}
              <label style={{ display: "grid", gap: 6 }}>
                UAT upload fallback
                <input
                  aria-label="Upload live capture fallback"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => setCameraBlob(event.currentTarget.files?.[0] ?? null)}
                />
              </label>
              <button className="lf-primary-btn" type="button" onClick={() => void submitCamera()} disabled={busy || !cameraBlob}>
                <Icon name="check_circle" size={16} />
                Submit capture
              </button>
            </section>
          ) : null}

          {decision ? (
            <section style={panelStyle}>
              <strong>Decision: {decision.status.replace(/_/g, " ")}</strong>
              <span>Identity level: {decision.identityLevel ?? "not granted"}</span>
              <span>Reason codes: {decision.reasonCodes.join(", ")}</span>
              {decision.status === "verified" ? <span>Protected access activation is now server-side eligible and remains scoped by Phase 1 RLS.</span> : null}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : "Identity verification failed.";
}

function statusForDecision(status: string) {
  if (status === "verified") return "Verification passed. Access activation remains scoped by the owner grant.";
  if (status === "review_required") return "Verification needs manual review. Protected access remains inactive.";
  return "Verification failed. Protected access remains inactive.";
}

const panelStyle = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 10,
} as const;
