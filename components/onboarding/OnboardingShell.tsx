import type { ReactNode } from "react";
import type { OnboardingStepId } from "../../config/onboarding.config";
import OnboardingStepProgress from "./OnboardingStepProgress";

export default function OnboardingShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: OnboardingStepId;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="lf-auth">
      <section className="lf-auth-art">
        <div className="lf-auth-art-copy">
          <h2>Set up your Legacy Fortress workspace</h2>
          <p>One step at a time. You can continue later where you left off.</p>
        </div>
      </section>

      <section className="lf-auth-form-side">
        <div className="lf-auth-card" style={{ maxWidth: 560 }}>
          <OnboardingStepProgress currentStep={step} />
          <h1>{title}</h1>
          <p className="lf-auth-subtext">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
