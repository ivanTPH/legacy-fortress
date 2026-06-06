export type PersistenceSurfaceStatus = "canonical" | "compatibility" | "legacy";

export type PersistenceSurfaceReadiness = {
  surface: string;
  status: PersistenceSurfaceStatus;
  preferredTable: "assets" | "documents" | "contacts" | "contact_links" | "section_entries";
  compatibilityTable?: "section_entries";
  migrationRisk: "low" | "medium" | "high";
  note: string;
};

export const PERSISTENCE_READINESS_SURFACES: PersistenceSurfaceReadiness[] = [
  {
    surface: "financial/property/business/digital asset records",
    status: "canonical",
    preferredTable: "assets",
    migrationRisk: "low",
    note: "Shared record workspaces should write canonical assets and hydrate sensitive payloads through shared helpers.",
  },
  {
    surface: "record attachments and dashboard documents",
    status: "canonical",
    preferredTable: "documents",
    migrationRisk: "low",
    note: "AttachmentGallery and document workspaces should remain the only document UI surfaces.",
  },
  {
    surface: "contacts, executors, next of kin, advisers",
    status: "compatibility",
    preferredTable: "contacts",
    compatibilityTable: "section_entries",
    migrationRisk: "medium",
    note: "Contacts have canonical entities, but invitation and record projections still need compatibility handling.",
  },
  {
    surface: "legacy generic section workspaces",
    status: "legacy",
    preferredTable: "section_entries",
    compatibilityTable: "section_entries",
    migrationRisk: "high",
    note: "Do not add new module-specific data capture here unless a canonical workspace is unavailable.",
  },
  {
    surface: "support requests",
    status: "legacy",
    preferredTable: "section_entries",
    compatibilityTable: "section_entries",
    migrationRisk: "medium",
    note: "Support still uses section_entries and should move behind a service boundary before schema changes.",
  },
];

export const LEGACY_SECTION_ENTRIES_ALLOWED_SURFACES = [
  "legacy generic section workspaces",
  "support requests",
  "contacts compatibility projection",
] as const;

export const CANONICAL_WORKSPACE_PREFERENCE_RULES = [
  "Use assets for structured finance, property, business, legal, digital, and possession records when a canonical workspace exists.",
  "Use documents plus AttachmentGallery for document storage, preview, download, replace, and remove behaviour.",
  "Use contacts, contact_links, and contact_invitations for people, relationships, executors, advisers, next of kin, and invite state.",
  "Use Action Centre for tasks, reminders, readiness actions, and dashboard operational queues.",
  "Use section_entries only for compatibility surfaces until a safe backfill and migration exists.",
] as const;

export function getPersistenceReadinessReport() {
  return {
    canonical: PERSISTENCE_READINESS_SURFACES.filter((surface) => surface.status === "canonical"),
    compatibility: PERSISTENCE_READINESS_SURFACES.filter((surface) => surface.status === "compatibility"),
    legacy: PERSISTENCE_READINESS_SURFACES.filter((surface) => surface.status === "legacy"),
    rule: "Prefer canonical assets, documents, contacts, and contact_links before introducing new section_entries writes.",
  };
}

export function shouldPreferCanonicalPersistence(surface: string) {
  const normalized = surface.toLowerCase();
  return !normalized.includes("legacy") && !normalized.includes("section_entries");
}

export function isAllowedLegacySectionEntriesSurface(surface: string) {
  const normalized = surface.trim().toLowerCase();
  return LEGACY_SECTION_ENTRIES_ALLOWED_SURFACES.some((allowed) => normalized.includes(allowed));
}

export function describeLegacyPersistenceCoexistence() {
  return {
    allowedLegacySurfaces: LEGACY_SECTION_ENTRIES_ALLOWED_SURFACES,
    preferenceRules: CANONICAL_WORKSPACE_PREFERENCE_RULES,
    migrationPath: [
      "Keep compatibility reads/writes active for existing section_entries data.",
      "Project contact-like legacy entries into canonical contacts/contact_links before adding new people flows.",
      "Backfill canonical assets/documents/contacts behind service boundaries before disabling legacy writes.",
      "Remove legacy section_entries support only after route-level parity and rollback coverage exist.",
    ],
  };
}
