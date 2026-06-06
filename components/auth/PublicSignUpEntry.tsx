"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BrandMark from "../../app/(app)/components/BrandMark";
import Icon from "../ui/Icon";
import SignUpForm from "./SignUpForm";

export default function PublicSignUpEntry() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/onboarding";

  return (
    <main className="lf-entry-shell">
      <section className="lf-entry-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={40} />
          <div>
            <div className="lf-auth-brand-title">Legacy Fortress</div>
            <div className="lf-auth-brand-sub">Private estate record vault</div>
          </div>
        </div>

        <div className="lf-entry-copy">
          <div className="lf-entry-eyebrow">Private setup</div>
          <h1>Start your secure legacy vault.</h1>
          <p>
            Create your account, then continue into guided setup for the records, documents, and trusted people your family may need later.
          </p>
        </div>

        <div className="lf-entry-brand-note" aria-hidden>
          <BrandMark size={40} />
          <strong>Guided onboarding</strong>
          <p>Begin with the essentials, then build out finances, legal records, property, wishes, and trusted contact access.</p>
        </div>
      </section>

      <section className="lf-entry-panel-wrap">
        <div className="lf-entry-panel">
          <div className="lf-entry-panel-top">
            <div>
              <div className="lf-entry-panel-kicker">Create account</div>
              <h2>Set up access</h2>
            </div>
            <Link href="/sign-in" className="lf-entry-demo-link">Sign in</Link>
          </div>

          <p className="lf-entry-panel-subtext">
            Use your own email and a strong password. You will verify your email before your vault is fully active.
          </p>

          <SignUpForm nextPath={nextPath} compact />

          <div className="lf-entry-footnote">
            <span><Icon name="lock" size={14} /> Private workspace</span>
            <span><Icon name="description" size={14} /> Guided setup</span>
            <span><Icon name="verified_user" size={14} /> Email verification</span>
          </div>
        </div>
      </section>
    </main>
  );
}
