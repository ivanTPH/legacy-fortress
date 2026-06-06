import type { OrganisationClient } from "./mockData";
import { buildPrototypeAuditPreviewEvents, type PlatformAuditEvent } from "../../../lib/audit/auditEvents.ts";

export type GovernanceSurface = "enterprise_dashboard" | "reports" | "client_insights" | "campaigns";

export type ConsentGovernanceSummary = {
  surface: GovernanceSurface;
  clientsInScope: number;
  adviserInsightAllowed: number;
  adviserInsightRestricted: number;
  marketingAllowed: number;
  marketingRestricted: number;
  exportState: "disabled";
  exportReason: string;
  restrictedDataRule: string;
  auditRequirement: string;
  safeguards: string[];
};

export type AuditPreviewEvent = PlatformAuditEvent;

export function buildConsentGovernanceSummary(
  clients: OrganisationClient[],
  surface: GovernanceSurface,
): ConsentGovernanceSummary {
  const adviserInsightAllowed = clients.filter((client) => client.consent.adviserInsights).length;
  const marketingAllowed = clients.filter((client) => client.consent.adviserInsights && client.consent.marketing).length;

  return {
    surface,
    clientsInScope: clients.length,
    adviserInsightAllowed,
    adviserInsightRestricted: clients.length - adviserInsightAllowed,
    marketingAllowed,
    marketingRestricted: clients.length - marketingAllowed,
    exportState: "disabled",
    exportReason: "Exports are disabled until consent enforcement, permission checks, and audit logging are production-backed.",
    restrictedDataRule: "Only consent-cleared, banded, non-document signals may appear in prototype reports.",
    auditRequirement: "Future report, campaign, export, and access actions must create an audit event before completion.",
    safeguards: [
      "Adviser insight consent gates detailed insight generation.",
      "Marketing consent gates campaign-ready counts.",
      "Exact financial values, documents, notes, and account details remain hidden.",
      "Prototype actions cannot export, send, unlock, or alter client access.",
    ],
  };
}

export function buildAuditPreviewEvents(surface: GovernanceSurface): AuditPreviewEvent[] {
  return buildPrototypeAuditPreviewEvents(surface);
}

export function canShowDetailedInsights(client: OrganisationClient) {
  return client.consent.adviserInsights === true;
}

export function canIncludeInOutreachAudience(client: OrganisationClient) {
  return client.consent.adviserInsights === true && client.consent.marketing === true;
}
