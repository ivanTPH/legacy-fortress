export type TestPersonaId =
  | "free-subscriber"
  | "paid-subscriber"
  | "executor"
  | "adviser"
  | "partner-organisation-user"
  | "commercial-admin"
  | "probate-admin"
  | "super-admin";

export type TestPersonaArea = "Consumer" | "Trust / Estate" | "Enterprise" | "Operations";

export type TestPersona = {
  id: TestPersonaId;
  label: string;
  area: TestPersonaArea;
  description: string;
  roleSummary: string;
  capabilities: string[];
  restrictedAreas: string[];
  dashboardState: string[];
  previewHref: string;
};

export const TEST_PERSONA_STORAGE_KEY = "lf:test-persona";
export const TEST_PERSONA_QUERY_PARAM = "testPersona";
export const TEST_PERSONA_ENABLE_ENV = "NEXT_PUBLIC_ENABLE_TEST_PERSONAS";

export function isTestPersonaAccessEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_TEST_PERSONAS === "true" || process.env.NODE_ENV !== "production";
}

export const TEST_PERSONAS: TestPersona[] = [
  {
    id: "free-subscriber",
    label: "Free consumer subscriber",
    area: "Consumer",
    description: "A vault owner on the starter plan with upgrade prompts and plan limits visible.",
    roleSummary: "Consumer owner, starter plan",
    capabilities: ["Consumer dashboard", "Basic vault records", "Starter subscription prompts"],
    restrictedAreas: ["Premium invite limits", "Enterprise dashboards", "Probate operations"],
    dashboardState: ["Upgrade prompts visible", "Plan-limited actions route to billing", "Consumer navigation only"],
    previewHref: "/dashboard?testPersona=free-subscriber",
  },
  {
    id: "paid-subscriber",
    label: "Paid consumer subscriber",
    area: "Consumer",
    description: "A vault owner with paid-plan messaging and premium features shown as available.",
    roleSummary: "Consumer owner, paid plan",
    capabilities: ["Consumer dashboard", "Premium vault features", "Trusted contact invitations"],
    restrictedAreas: ["Enterprise dashboards", "Probate operations"],
    dashboardState: ["Premium prompts reduced", "Invite limits shown as available", "Consumer navigation only"],
    previewHref: "/dashboard?testPersona=paid-subscriber",
  },
  {
    id: "executor",
    label: "Executor",
    area: "Trust / Estate",
    description: "A trusted person reviewing restricted vault access in a read-only estate context.",
    roleSummary: "Trusted contact with executor responsibilities",
    capabilities: ["Restricted vault preview", "Access-request status", "Read-only estate context"],
    restrictedAreas: ["Owner settings", "Billing", "Admin and enterprise dashboards"],
    dashboardState: ["Read-only language", "No owner-only actions", "Access status clearly labelled"],
    previewHref: "/dashboard?testPersona=executor",
  },
  {
    id: "adviser",
    label: "Adviser",
    area: "Trust / Estate",
    description: "A professional adviser with consent-bound preview behaviour and restricted vault visibility.",
    roleSummary: "Adviser preview, consent-bound",
    capabilities: ["Consent-aware preview", "Adviser-safe guidance", "Restricted client context"],
    restrictedAreas: ["Unconsented client insights", "Owner settings", "Probate operations"],
    dashboardState: ["Consent restrictions visible", "No sensitive values exposed", "Adviser actions clearly limited"],
    previewHref: "/dashboard?testPersona=adviser",
  },
  {
    id: "partner-organisation-user",
    label: "Partner organisation user",
    area: "Enterprise",
    description: "A professional organisation user with enterprise prototype access and consent restrictions.",
    roleSummary: "Organisation user, enterprise preview",
    capabilities: ["Enterprise dashboard", "Organisation portfolio summaries", "Consent-restricted reporting"],
    restrictedAreas: ["Probate operations", "Unrestricted exports", "Campaign sending"],
    dashboardState: ["Enterprise prototype routes available", "Campaign actions disabled", "Client values shown as bands"],
    previewHref: "/internal/admin/prototype/enterprise?role=enterprise_admin",
  },
  {
    id: "commercial-admin",
    label: "Commercial admin",
    area: "Enterprise",
    description: "A licensing-focused internal user for organisation management and commercial reporting review.",
    roleSummary: "Commercial and licensing operations",
    capabilities: ["Enterprise dashboard", "Licences", "Reports", "Campaign shell"],
    restrictedAreas: ["Probate case operations unless separately granted", "Live payment actions", "Client exports"],
    dashboardState: ["Licensing navigation visible", "Static enterprise mock data", "Disabled campaign and export actions"],
    previewHref: "/internal/admin/prototype/enterprise?role=licensing_admin",
  },
  {
    id: "probate-admin",
    label: "Probate admin",
    area: "Operations",
    description: "An operations user who can review probate cases and verifications without enterprise access.",
    roleSummary: "Probate operations",
    capabilities: ["Cases", "Verifications", "Users", "Access", "Audit"],
    restrictedAreas: ["Enterprise dashboard", "Licences", "Reports", "Campaigns"],
    dashboardState: ["Probate navigation visible", "Enterprise routes show restricted state", "No real operations enabled"],
    previewHref: "/internal/admin/prototype/cases?role=probate_admin",
  },
  {
    id: "super-admin",
    label: "Super admin",
    area: "Operations",
    description: "A combined internal role that can preview both probate and enterprise prototype areas.",
    roleSummary: "Full prototype access",
    capabilities: ["Probate operations", "Enterprise dashboard", "Licences", "Reports", "Campaign shell"],
    restrictedAreas: ["Real backend actions", "Live exports", "Production auth bypasses"],
    dashboardState: ["Both prototype navigation groups visible", "Access gates still labelled", "Static mock data only"],
    previewHref: "/internal/admin/prototype?role=super_admin",
  },
];

export function getTestPersona(id: string | null | undefined) {
  if (!id) return null;
  return TEST_PERSONAS.find((persona) => persona.id === id) ?? null;
}

export function isTestPersonaId(id: string | null | undefined): id is TestPersonaId {
  return Boolean(getTestPersona(id));
}

export function getAdminPrototypeRoleForTestPersona(id: string | null | undefined) {
  switch (id) {
    case "partner-organisation-user":
      return "enterprise_admin";
    case "commercial-admin":
      return "licensing_admin";
    case "probate-admin":
      return "probate_admin";
    case "super-admin":
      return "super_admin";
    default:
      return null;
  }
}
