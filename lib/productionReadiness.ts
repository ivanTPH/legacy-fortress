export type ProductionReadinessArea = "api" | "auth" | "billing" | "data" | "release" | "security";

export type ProductionReadinessItem = {
  area: ProductionReadinessArea;
  boundary: string;
  currentMode: "static" | "mock" | "compatibility" | "guarded-live";
  futureIntegration: string;
  mustNotDoYet: string;
};

export const PRODUCTION_READINESS_ITEMS: ProductionReadinessItem[] = [
  {
    area: "api",
    boundary: "admin prototype data service",
    currentMode: "static",
    futureIntegration: "Replace static service functions with permission-aware API calls.",
    mustNotDoYet: "Do not fetch real enterprise, probate, or vault data from prototype routes.",
  },
  {
    area: "auth",
    boundary: "test persona and admin prototype role context",
    currentMode: "mock",
    futureIntegration: "Map production sessions to server-verified roles and capabilities.",
    mustNotDoYet: "Do not treat persona switching as production authentication.",
  },
  {
    area: "billing",
    boundary: "consumer billing and enterprise licence management",
    currentMode: "guarded-live",
    futureIntegration: "Connect subscription, renewal, and licence states behind server-side billing services.",
    mustNotDoYet: "Do not expose payment provider data or enable prototype commercial actions.",
  },
  {
    area: "data",
    boundary: "canonical assets, documents, contacts, and compatibility layers",
    currentMode: "compatibility",
    futureIntegration: "Backfill legacy section_entries into canonical workspaces where safe.",
    mustNotDoYet: "Do not remove compatibility reads or perform destructive migrations.",
  },
  {
    area: "release",
    boundary: "build, route, and shared-component regression checks",
    currentMode: "guarded-live",
    futureIntegration: "Promote focused checks into a repeatable release gate.",
    mustNotDoYet: "Do not deploy unreviewed scratch files or unrelated dirty work.",
  },
  {
    area: "security",
    boundary: "browser security headers and CSP migration",
    currentMode: "guarded-live",
    futureIntegration: "Tighten the enforced baseline Content-Security-Policy after inline style/script dependencies are removed or nonce-backed.",
    mustNotDoYet: "Do not enforce a strict CSP until the current inline dashboard and admin surfaces have been migrated.",
  },
];

export function getProductionReadinessByArea(area: ProductionReadinessArea) {
  return PRODUCTION_READINESS_ITEMS.filter((item) => item.area === area);
}

export function getProductionReadinessChecklist() {
  return {
    items: PRODUCTION_READINESS_ITEMS,
    rule: "Keep prototype/static boundaries explicit until backend, auth, billing, and migration services are production-ready.",
  };
}
