import { ONBOARDING_STEPS } from "../../config/onboarding.config";
import type { OnboardingStepId } from "../../config/onboarding.config";

export default function OnboardingStepProgress({ currentStep }: { currentStep: OnboardingStepId }) {
  const index = ONBOARDING_STEPS.findIndex((step) => step.id === currentStep);
  const progress = Math.max(0, Math.round(((index + 1) / ONBOARDING_STEPS.length) * 100));

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
        <span>Onboarding progress</span>
        <span>{progress}%</span>
      </div>
      <div style={{ width: "100%", height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #2563eb, #0ea5a4)" }} />
      </div>
    </div>
  );
}
