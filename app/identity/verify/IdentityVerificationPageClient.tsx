"use client";

import { useEffect, useState } from "react";
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
  const [documentType, setDocumentType] = useState("passport");
  const [scenario, setScenario] = useState("success");
  const [decision, setDecision] = useState<VerificationResponse["decision"] | null>(null);
  const [busy, setBusy] = useState(false);
  const purpose = params.get("purpose") === "step_up_presence" ? "step_up_presence" : "linked_access";
  const hasLinkedContext = Boolean(params.get("grant") || params.get("invitation"));
  const ownerName = params.get("owner") || "the account holder";
  const invitedRole = params.get("role") || "linked role";
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const accessToken = data.session?.access_token ?? "";
      setToken(accessToken);
      if (!accessToken) setStatus("Sign in to continue identity verification.");
    });
    return () => { mounted = false; };
  }, []);

  async function start() {
    if (!token) {
      router.replace(`/sign-in?next=${encodeURIComponent("/identity/verify")}`);
      return;
    }
    setBusy(true);
    setStatus("Starting verification...");
    try {
      const res = await api("/api/identity-verification", {
        method: "POST",
        body: JSON.stringify({
          purpose,
          requestedIdentityLevel: purpose === "step_up_presence" ? 3 : 2,
          accessGrantId: params.get("grant"),
          invitationId: params.get("invitation"),
          simulatorScenario: scenario,
        }),
      });
      if (!res.verification?.id) throw new Error(res.error ?? "Could not start verification.");
      setVerificationId(res.verification.id);
      setStatus(purpose === "step_up_presence" ? "Fresh presence check required." : "Use the synthetic test document to continue.");
      if (purpose === "step_up_presence") await createChallenge(res.verification.id);
    } catch (error) {
      setStatus(readError(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitSyntheticDocument() {
    if (!verificationId) return;
    setBusy(true);
    setStatus("Uploading and extracting document data...");
    try {
      const res = await api(`/api/identity-verification/${verificationId}/document`, { method: "POST", body: JSON.stringify({ synthetic: true, documentType, side: "front" }) });
      if (!res.ok) throw new Error(res.error ?? "Document upload failed.");
      if (res.document?.extractionStatus === "failed") {
        setStatus("The synthetic document check failed. Your verification requires review or another attempt.");
        return;
      }
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

  async function submitSyntheticLivePersonCapture() {
    if (!verificationId || !challengeId) return;
    setBusy(true);
    setStatus("Running synthetic liveness and face comparison...");
    try {
      const res = await api(`/api/identity-verification/${verificationId}/camera`, { method: "POST", body: JSON.stringify({ synthetic: true, challengeId }) });
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
          <p>This controlled flow uses a staging-only synthetic document and live-person result. It does not require real identity or biometric evidence.</p>
        </div>
      </section>

      <section className="lf-auth-form-side">
        <div className="lf-auth-card" style={{ maxWidth: 620 }}>
          <h1>Identity verification</h1>
          <p className="lf-auth-subtext">
            Legacy Fortress needs Level 2 identity assurance before protected linked access. High-risk actions require a fresh Level 3 presence check.
          </p>

          <div className="lf-muted-note" role="status">{status}</div>

          <section style={panelStyle}>
            <strong>STAGING IDENTITY SIMULATOR</strong>
            <span>No genuine identity or biometric verification is performed. Use synthetic data only.</span>
            <label style={{ display: "grid", gap: 6 }}>
              Document type
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} disabled={busy || Boolean(verificationId)}>
                <option value="passport">Passport</option>
                <option value="driving_licence">Driving licence</option>
                <option value="national_identity_document">National identity document</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              Test outcome scenario
              <select value={scenario} onChange={(event) => setScenario(event.target.value)} disabled={busy || Boolean(verificationId)}>
                <option value="success">Successful verification</option>
                <option value="expired">Expired document</option>
                <option value="document-failed">Document authenticity failure</option>
                <option value="blur">Document quality review</option>
                <option value="mismatch">Face mismatch</option>
                <option value="low-confidence">Liveness review</option>
                <option value="liveness-fail">Liveness failure</option>
                <option value="provider-timeout">Provider timeout</option>
                <option value="provider-error">Provider error</option>
              </select>
            </label>
          </section>

          {!verificationId ? (
            <>
              {!hasLinkedContext && purpose !== "step_up_presence" ? <p role="note">Open this check from an accepted linked-access request. A linked-access verification cannot be started from an unbound URL.</p> : null}
            <button className="lf-primary-btn" type="button" onClick={() => void start()} disabled={busy || !token || (purpose !== "step_up_presence" && !hasLinkedContext)}>
              <Icon name="verified_user" size={16} />
              Start verification
            </button>
            </>
          ) : null}

          {verificationId && !challengeId ? (
            <section style={panelStyle}>
              <strong>Document capture</strong>
              <span>Use a generated synthetic document payload. No passport, driving licence or national ID image is uploaded or stored.</span>
              <button className="lf-primary-btn" type="button" onClick={() => void submitSyntheticDocument()} disabled={busy}>
                <Icon name="description" size={16} />
                Use synthetic test document
              </button>
            </section>
          ) : null}

          {challengeId ? (
            <section style={panelStyle}>
              <strong>Live-person check</strong>
              <span>Staging simulator only. No camera permission, selfie or biometric image is required.</span>
              <button className="lf-primary-btn" type="button" onClick={() => void submitSyntheticLivePersonCapture()} disabled={busy}>
                <Icon name="check_circle" size={16} />
                Use synthetic live-person capture
              </button>
            </section>
          ) : null}

          {decision ? (
            <section style={panelStyle}>
              <strong>Decision: {decision.status.replace(/_/g, " ")}</strong>
              <span>Identity level: {decision.identityLevel ?? "not granted"}</span>
              <span>Reason codes: {decision.reasonCodes.join(", ")}</span>
              {decision.status === "verified" ? (
                <section style={confirmationStyle} aria-label="Identity verification complete">
                  <strong>Your identity has been verified</strong>
                  <span>You can now continue to your {labelise(invitedRole)} role for {ownerName}.</span>
                  <span>Your identity check is complete. Authority and estate-access requirements are assessed separately, and access remains subject to the invitation and security policy.</span>
                  <span>Your own Legacy Fortress Personal Vault is separate from this role and can be set up later.</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="lf-primary-btn" type="button" onClick={() => router.replace(`/contact-wallet?grant=${encodeURIComponent(params.get("grant") ?? "")}`)}>
                      Continue to {labelise(invitedRole)} role
                    </button>
                    <button className="lf-link-btn" type="button" onClick={() => router.replace("/account/billing")}>
                      Set up my Personal Vault later
                    </button>
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function readError(error: unknown) {
  const message = error instanceof Error ? error.message : "identity_verification_error";
  if (message === "linked_access_context_required" || message.includes("context_invalid") || message.includes("context_terminal")) return "This identity check is no longer available for the linked access request.";
  if (message.includes("linked_invitation_context") || message.includes("linked_grant_context")) return "This identity check is not linked to an eligible access request.";
  if (message === "experimental_provider_timeout") return "The staging test provider timed out. You can request another attempt.";
  if (message === "experimental_provider_error") return "The staging test provider is unavailable. Try again later.";
  if (message === "synthetic_provider_not_enabled") return "Synthetic staging verification is not enabled for this environment.";
  if (message === "invalid_simulator_scenario" || message.includes("provider") || message.includes("verification_")) return "Identity verification could not continue. Review the current request and try again.";
  return message === "identity_verification_error" ? "Identity verification could not continue." : "Identity verification could not continue. Try again or contact support.";
}

function statusForDecision(status: string) {
  if (status === "verified") return "Verification passed. Access activation remains scoped by the owner grant.";
  if (status === "review_required") return "Verification needs manual review. Protected access remains inactive.";
  return "Verification failed. Protected access remains inactive.";
}

function labelise(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const panelStyle = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 10,
} as const;

const confirmationStyle = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 8,
} as const;
