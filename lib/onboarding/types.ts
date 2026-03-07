import type { OnboardingStepId } from "../../config/onboarding.config";

export type OnboardingStateRow = {
  user_id: string;
  current_step: OnboardingStepId;
  completed_steps: OnboardingStepId[];
  is_completed: boolean;
  terms_accepted: boolean;
  marketing_opt_in: boolean;
  tour_opt_in: boolean;
};

export type OnboardingContactDraft = {
  id: string;
  full_name: string;
  email: string;
  assigned_role: string;
  created_at: string;
};
