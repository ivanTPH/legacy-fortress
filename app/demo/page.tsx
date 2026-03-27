"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "../(app)/components/BrandMark";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { waitForActiveUser } from "../../lib/auth/session";
import { supabase } from "../../lib/supabaseClient";

type DemoSessionResponse = {
  ok: boolean;
  message?: string;
  demo?: {
    actionLink: string;
    emailOtp: string;
    reviewerEmail: string;
    accountHolderName: string;
    roleLabel: string;
    experienceLabel: string;
    experienceSublabel: string;
  };
};

export default function DemoAccessPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState("");

  const highlights = useMemo(
    () => [
      "Estate readiness dashboard",
      "Bank and finance records with attachments",
      "Legal documents and supporting files",
      "Contacts network with roles and statuses",
    ],
    [],
  );

  async function startDemo() {
    setStarting(true);
    setStatus("");
    try {
      const res = await fetch("/api/demo/session", {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as DemoSessionResponse;
      if (!res.ok || !json.ok || !json.demo?.reviewerEmail || !json.demo?.emailOtp) {
        setStatus(json.message || "Demo access is unavailable right now.");
        return;
      }
      setStatus(`Opening the ${json.demo.experienceLabel.toLowerCase()}...`);
      const otpResult = await supabase.auth.verifyOtp({
        email: json.demo.reviewerEmail,
        token: json.demo.emailOtp,
        type: "magiclink",
      });
      if (otpResult.error) {
        setStatus(otpResult.error.message || "Could not sign in to the demo account.");
        return;
      }

      const user = await waitForActiveUser(supabase, { attempts: 8, delayMs: 150 });
      if (!user) {
        setStatus("Demo sign-in completed, but no browser session became active.");
        return;
      }

      const bootstrap = await bootstrapAuthenticatedUser(supabase, {
        userId: user.id,
        nextPath: "/dashboard",
      });
      router.replace(bootstrap.destination);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Demo access is unavailable right now.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={38} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Demo account</div>
          </div>
        </div>

        <div className="lf-auth-art-copy">
          <h2>Explore a synthetic review environment.</h2>
          <p>Open a separate, non-admin demo account that shows a realistic Bill Smith estate record without using owner or admin credentials.</p>
        </div>
      </section>

      <section className="lf-auth-form-side">
        <div className="lf-auth-card" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0 }}>Review the product safely</h1>
            <p className="lf-auth-subtext" style={{ margin: 0 }}>
              You will enter a view-only reviewer account. The data is synthetic, the environment is resettable, and admin controls are intentionally separate from this path.
            </p>
          </div>

          <section
            style={{
              border: "1px solid #dbe3eb",
              borderRadius: 14,
              padding: 14,
              background: "#f8fafc",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700 }}>What you will see</div>
            <div style={{ color: "#475569", fontSize: 14 }}>
              A populated Bill Smith review account with linked, view-only access.
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", display: "grid", gap: 6 }}>
              {highlights.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 14,
              background: "#fff",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 700 }}>Start here</div>
            <div style={{ color: "#475569", fontSize: 14 }}>
              Begin on the dashboard, then open Finances, Legal, and Contacts to see the clearest examples of records, attachments, and trusted access.
            </div>
          </section>

          <button type="button" className="lf-primary-btn" onClick={() => void startDemo()} disabled={starting}>
            {starting ? "Opening demo..." : "Open demo account"}
          </button>

          {status ? <div className="lf-muted-note" role="alert">{status}</div> : null}

          <div className="lf-muted-note" style={{ display: "grid", gap: 4 }}>
            <div>This route signs in a separate demo reviewer account, not the owner or admin account.</div>
            <div>Records and attachments are view-only in the demo, and admin operations stay intentionally out of sight.</div>
          </div>

          <p className="lf-muted-note" style={{ margin: 0 }}>
            Need your own workspace instead? <Link className="lf-inline-link" href="/sign-up">Create account</Link>
          </p>
          <p className="lf-muted-note" style={{ margin: 0 }}>
            Already have credentials? <Link className="lf-inline-link" href="/sign-in">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
