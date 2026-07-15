import { isUatEnvironment } from "../../lib/environment/appEnvironment";

export default function UatEnvironmentBanner() {
  if (!isUatEnvironment()) return null;

  return (
    <aside className="lf-uat-environment-banner" role="status" aria-label="UAT test environment">
      <strong>UAT / TEST ENVIRONMENT</strong>
      <span>Use synthetic data only. Do not enter real customer, payment, identity or document details.</span>
    </aside>
  );
}
