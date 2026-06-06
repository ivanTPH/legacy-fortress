import Link from "next/link";
import BrandMark from "../../app/(app)/components/BrandMark";
import Icon from "../ui/Icon";
import SignInForm from "./SignInForm";

export default function PublicHomeEntry({
  nextPath = null,
  resetSuccess = false,
}: {
  nextPath?: string | null;
  resetSuccess?: boolean;
}) {
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
          <div className="lf-entry-eyebrow">Private access</div>
          <h1>Your secure legacy vault.</h1>
          <p>
            Sign in to manage the records, documents, and trusted people your family may need later.
          </p>
        </div>

        <div className="lf-entry-brand-note" aria-hidden>
          <BrandMark size={40} />
          <strong>Legacy Fortress</strong>
          <p>Clear records, controlled access, and calm guidance for sensitive estate planning.</p>
        </div>
      </section>

      <section className="lf-entry-panel-wrap">
        <div className="lf-entry-panel">
          <div className="lf-entry-panel-top">
            <div>
              <div className="lf-entry-panel-kicker">Secure access</div>
              <h2>Sign in</h2>
            </div>
            <Link href="/demo" className="lf-entry-demo-link">Demo</Link>
          </div>

          <p className="lf-entry-panel-subtext">
            Sign in to your authorised workspace. New users can create their vault from a dedicated setup page.
          </p>

          <SignInForm
            nextPath={nextPath}
            compact
            initialStatus={resetSuccess ? "Password updated successfully. Please sign in with your new password." : ""}
          />

          <div className="lf-entry-footnote">
            <span><Icon name="lock" size={14} /> Private workspace</span>
            <span><Icon name="description" size={14} /> Guided setup</span>
            <span><Icon name="person_add" size={14} /> <Link className="lf-inline-link" href="/sign-up">Create account</Link></span>
          </div>
        </div>
      </section>
    </main>
  );
}
