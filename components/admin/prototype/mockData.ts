import type { PlatformRole } from "../../../lib/auth/platformRoles.ts";

export type AdminCaseStatus = "Active" | "Pending" | "Under Review" | "Deceased" | "Access Unlock Pending" | "Rejected" | "Closed";

export type AdminCase = {
  id: string;
  userName: string;
  userEmail: string;
  status: AdminCaseStatus;
  caseType: string;
  lastActivity: string;
  assignedAdmin: string;
  priority: "Normal" | "High" | "Urgent";
  submittedBy: string;
  lifecycleStage: "Evidence submitted" | "Triage" | "Manual review" | "Decision recorded" | "Access unlock" | "Closed";
  executorStatus: "Not contacted" | "Invited" | "Verified" | "Restricted";
  nextAction: string;
};

export type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  role: "Admin" | "Reviewer" | "Support" | "System";
  action: string;
  target: string;
  result: "Success" | "Pending" | "Rejected" | "Blocked";
  governance?: "Consent checked" | "Restricted action" | "Manual review" | "Prototype only";
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  vaultStatus: AdminCaseStatus;
  plan: string;
  lastLogin: string;
  records: number;
  documents: number;
  contacts: number;
};

export type OrganisationStatus = "Active" | "Pending" | "Review" | "Suspended";
export type LicencePlanTier = "Starter" | "Professional" | "Enterprise";
export type BillingStatus = "Current" | "Trial" | "Renewal due" | "Past due" | "Not connected";
export type LicenceStatus = "Active" | "Pending" | "Suspended" | "Expired" | "Review";

export type AdminPrototypeRole = Extract<
  PlatformRole,
  "probate_admin" | "verification_reviewer" | "enterprise_admin" | "licensing_admin" | "super_admin"
>;

export type AdminPrototypeCapability =
  | "probate_review"
  | "verification_review"
  | "enterprise"
  | "licensing"
  | "reports";

export type AdminPrototypeUser = {
  id: string;
  name: string;
  role: AdminPrototypeRole;
  capabilities: AdminPrototypeCapability[];
};

export type Organisation = {
  id: string;
  name: string;
  type: "IFA" | "Solicitors" | "Accountancy" | "Enterprise";
  planId: string;
  licenceType: string;
  clientSeats: number;
  activeClients: number;
  pendingInvitations: number;
  renewalDate: string;
  accountOwner: string;
  status: OrganisationStatus;
  billingContact: string;
  feePlaceholder: string;
  onboardingState: "Ready" | "In rollout" | "Needs setup" | "Restricted";
  healthState: "Healthy" | "Watch" | "At risk" | "Restricted";
  consentReadiness: "Ready" | "Partial" | "Blocked";
  rolloutNote: string;
};

export type LicencePlan = {
  organisationId: string;
  planId: string;
  planName: string;
  planTier: LicencePlanTier;
  monthlyPrice: string;
  annualPrice: string;
  includedSeats: number;
  usedSeats: number;
  clientLimit: number;
  renewalDate: string;
  billingStatus: BillingStatus;
  licenceStatus: LicenceStatus;
  features: string[];
};

export type OrganisationClient = {
  id: string;
  organisationId: string;
  clientName: string;
  vaultCompletion: number;
  willStatus: "Uploaded" | "Missing" | "Review needed";
  willAge: string;
  estateValueBand: string;
  possessionsValueBand: string;
  propertyValueBand: string;
  adviserAppointed: boolean;
  executorAppointed: boolean;
  marketingPreference: "Allowed" | "Not allowed";
  consent: {
    adviserInsights: boolean;
    marketing: boolean;
    lastUpdated: string;
  };
  communicationPreference: "Email" | "Phone" | "Post" | "None";
  lastReviewDate: string;
  nextReviewDue: string;
  assignedProfessional: string;
};

export type OrganisationUser = {
  id: string;
  organisationId: string;
  name: string;
  role: "Organisation Owner" | "Adviser" | "Support" | "Read-only Reviewer";
  status: "Active" | "Invited" | "Suspended";
  assignedClients: number;
  lastActive: string;
};

export const adminCases: AdminCase[] = [
  {
    id: "CASE-1842",
    userName: "Margaret Ellis",
    userEmail: "margaret.ellis@example.com",
    status: "Under Review",
    caseType: "Death certificate verification",
    lastActivity: "30 Apr 2026, 13:42",
    assignedAdmin: "Sarah Ahmed",
    priority: "Urgent",
    submittedBy: "Thomas Ellis",
    lifecycleStage: "Manual review",
    executorStatus: "Verified",
    nextAction: "Confirm evidence match and record reviewer decision",
  },
  {
    id: "CASE-1839",
    userName: "Robert Haines",
    userEmail: "robert.haines@example.com",
    status: "Pending",
    caseType: "Executor access request",
    lastActivity: "30 Apr 2026, 10:18",
    assignedAdmin: "Unassigned",
    priority: "High",
    submittedBy: "Helen Haines",
    lifecycleStage: "Triage",
    executorStatus: "Invited",
    nextAction: "Assign reviewer and request missing certificate detail",
  },
  {
    id: "CASE-1827",
    userName: "Priya Shah",
    userEmail: "priya.shah@example.com",
    status: "Access Unlock Pending",
    caseType: "Approved verification",
    lastActivity: "29 Apr 2026, 16:05",
    assignedAdmin: "Daniel Price",
    priority: "High",
    submittedBy: "Anika Shah",
    lifecycleStage: "Access unlock",
    executorStatus: "Verified",
    nextAction: "Prepare controlled access unlock after final audit check",
  },
  {
    id: "CASE-1811",
    userName: "William Turner",
    userEmail: "william.turner@example.com",
    status: "Active",
    caseType: "Support review",
    lastActivity: "28 Apr 2026, 09:31",
    assignedAdmin: "Maya Lewis",
    priority: "Normal",
    submittedBy: "William Turner",
    lifecycleStage: "Evidence submitted",
    executorStatus: "Not contacted",
    nextAction: "Check support request scope before routing",
  },
  {
    id: "CASE-1803",
    userName: "Grace O'Connor",
    userEmail: "grace.oconnor@example.com",
    status: "Closed",
    caseType: "Verification rejected",
    lastActivity: "26 Apr 2026, 15:24",
    assignedAdmin: "Sarah Ahmed",
    priority: "Normal",
    submittedBy: "Sean O'Connor",
    lifecycleStage: "Closed",
    executorStatus: "Restricted",
    nextAction: "No action. Evidence rejected and access remains restricted",
  },
];

export const adminUsers: AdminUser[] = [
  {
    id: "USR-552",
    name: "Margaret Ellis",
    email: "margaret.ellis@example.com",
    vaultStatus: "Under Review",
    plan: "Family Vault",
    lastLogin: "24 Apr 2026, 18:02",
    records: 27,
    documents: 14,
    contacts: 6,
  },
  {
    id: "USR-448",
    name: "Robert Haines",
    email: "robert.haines@example.com",
    vaultStatus: "Pending",
    plan: "Essential",
    lastLogin: "18 Apr 2026, 11:40",
    records: 9,
    documents: 3,
    contacts: 2,
  },
  {
    id: "USR-391",
    name: "Priya Shah",
    email: "priya.shah@example.com",
    vaultStatus: "Access Unlock Pending",
    plan: "Family Vault",
    lastLogin: "12 Apr 2026, 08:15",
    records: 41,
    documents: 22,
    contacts: 8,
  },
];

export const organisations: Organisation[] = [
  {
    id: "ORG-1001",
    name: "Northbridge Wealth LLP",
    type: "IFA",
    planId: "PLAN-PRO-001",
    licenceType: "Professional Portfolio",
    clientSeats: 250,
    activeClients: 184,
    pendingInvitations: 21,
    renewalDate: "31 Mar 2027",
    accountOwner: "Amelia Grant",
    status: "Active",
    billingContact: "finance@northbridge.example",
    feePlaceholder: "Commercial terms agreed offline",
    onboardingState: "Ready",
    healthState: "Healthy",
    consentReadiness: "Ready",
    rolloutNote: "Adviser seats active; portfolio reporting available for consented clients.",
  },
  {
    id: "ORG-1002",
    name: "Harrington & Co Solicitors",
    type: "Solicitors",
    planId: "PLAN-PRO-002",
    licenceType: "Probate Partner",
    clientSeats: 120,
    activeClients: 79,
    pendingInvitations: 8,
    renewalDate: "15 Jan 2027",
    accountOwner: "Julian Reed",
    status: "Active",
    billingContact: "accounts@harrington.example",
    feePlaceholder: "Placeholder annual licence",
    onboardingState: "Ready",
    healthState: "Watch",
    consentReadiness: "Partial",
    rolloutNote: "Probate workflow preview live; consent refresh needed for several client records.",
  },
  {
    id: "ORG-1003",
    name: "Ledger House Accountants",
    type: "Accountancy",
    planId: "PLAN-STARTER-001",
    licenceType: "Client Review",
    clientSeats: 80,
    activeClients: 42,
    pendingInvitations: 15,
    renewalDate: "30 Nov 2026",
    accountOwner: "Priya Nair",
    status: "Review",
    billingContact: "billing@ledgerhouse.example",
    feePlaceholder: "Pilot pricing pending",
    onboardingState: "Needs setup",
    healthState: "At risk",
    consentReadiness: "Blocked",
    rolloutNote: "Renewal and consent setup need attention before wider rollout.",
  },
  {
    id: "ORG-1004",
    name: "Whitestone Employee Benefits",
    type: "Enterprise",
    planId: "PLAN-ENT-001",
    licenceType: "Enterprise Benefits",
    clientSeats: 1000,
    activeClients: 612,
    pendingInvitations: 96,
    renewalDate: "01 May 2027",
    accountOwner: "Marcus Hill",
    status: "Pending",
    billingContact: "partnerships@whitestone.example",
    feePlaceholder: "Enterprise licence placeholder",
    onboardingState: "In rollout",
    healthState: "Watch",
    consentReadiness: "Partial",
    rolloutNote: "Pilot rollout in progress; campaign and export features remain disabled.",
  },
];

export const licencePlans: LicencePlan[] = [
  {
    organisationId: "ORG-1001",
    planId: "PLAN-PRO-001",
    planName: "Professional Portfolio",
    planTier: "Professional",
    monthlyPrice: "Prototype: £449/mo",
    annualPrice: "Prototype: £4,800/yr",
    includedSeats: 250,
    usedSeats: 184,
    clientLimit: 250,
    renewalDate: "31 Mar 2027",
    billingStatus: "Current",
    licenceStatus: "Active",
    features: ["Organisation dashboard", "Consent-gated client insights", "Adviser seat management", "Review opportunity reports"],
  },
  {
    organisationId: "ORG-1002",
    planId: "PLAN-PRO-002",
    planName: "Probate Partner",
    planTier: "Professional",
    monthlyPrice: "Prototype: £399/mo",
    annualPrice: "Prototype: £4,200/yr",
    includedSeats: 120,
    usedSeats: 79,
    clientLimit: 120,
    renewalDate: "15 Jan 2027",
    billingStatus: "Current",
    licenceStatus: "Active",
    features: ["Probate workflow preview", "Executor access reporting", "Organisation user roles", "Audit-ready activity preview"],
  },
  {
    organisationId: "ORG-1003",
    planId: "PLAN-STARTER-001",
    planName: "Client Review",
    planTier: "Starter",
    monthlyPrice: "Prototype: £149/mo",
    annualPrice: "Prototype: £1,500/yr",
    includedSeats: 80,
    usedSeats: 42,
    clientLimit: 80,
    renewalDate: "30 Nov 2026",
    billingStatus: "Renewal due",
    licenceStatus: "Review",
    features: ["Basic organisation profile", "Banded client summaries", "Consent readiness overview"],
  },
  {
    organisationId: "ORG-1004",
    planId: "PLAN-ENT-001",
    planName: "Enterprise Benefits",
    planTier: "Enterprise",
    monthlyPrice: "Prototype: custom",
    annualPrice: "Prototype: commercial terms",
    includedSeats: 1000,
    usedSeats: 612,
    clientLimit: 1000,
    renewalDate: "01 May 2027",
    billingStatus: "Trial",
    licenceStatus: "Pending",
    features: ["Enterprise rollout tracking", "Large portfolio summaries", "Campaign readiness shell", "Platform-mediated outreach controls"],
  },
];

export const adminPrototypeUsers: AdminPrototypeUser[] = [
  {
    id: "ADM-001",
    name: "Sarah Ahmed",
    role: "super_admin",
    capabilities: ["probate_review", "verification_review", "enterprise", "licensing", "reports"],
  },
  {
    id: "ADM-002",
    name: "Daniel Price",
    role: "probate_admin",
    capabilities: ["probate_review", "verification_review"],
  },
  {
    id: "ADM-003",
    name: "Amelia Grant",
    role: "enterprise_admin",
    capabilities: ["enterprise", "reports"],
  },
  {
    id: "ADM-004",
    name: "Maya Lewis",
    role: "licensing_admin",
    capabilities: ["enterprise", "licensing", "reports"],
  },
];

export const organisationClients: OrganisationClient[] = [
  {
    id: "CL-2001",
    organisationId: "ORG-1001",
    clientName: "Eleanor Price",
    vaultCompletion: 82,
    willStatus: "Review needed",
    willAge: "7 years",
    estateValueBand: "£1m–£2.5m",
    possessionsValueBand: "£75k–£150k",
    propertyValueBand: "£750k–£1.5m",
    adviserAppointed: true,
    executorAppointed: true,
    marketingPreference: "Allowed",
    consent: { adviserInsights: true, marketing: true, lastUpdated: "12 Apr 2026" },
    communicationPreference: "Email",
    lastReviewDate: "12 Apr 2025",
    nextReviewDue: "12 Apr 2026",
    assignedProfessional: "Amelia Grant",
  },
  {
    id: "CL-2002",
    organisationId: "ORG-1001",
    clientName: "James Walker",
    vaultCompletion: 44,
    willStatus: "Missing",
    willAge: "Not uploaded",
    estateValueBand: "£500k–£1m",
    possessionsValueBand: "£25k–£75k",
    propertyValueBand: "£500k–£750k",
    adviserAppointed: false,
    executorAppointed: false,
    marketingPreference: "Allowed",
    consent: { adviserInsights: true, marketing: true, lastUpdated: "08 Jan 2026" },
    communicationPreference: "Phone",
    lastReviewDate: "08 Jan 2024",
    nextReviewDue: "Overdue",
    assignedProfessional: "Ruth Morgan",
  },
  {
    id: "CL-2003",
    organisationId: "ORG-1001",
    clientName: "Sofia Bennett",
    vaultCompletion: 91,
    willStatus: "Uploaded",
    willAge: "2 years",
    estateValueBand: "£2.5m+",
    possessionsValueBand: "£150k+",
    propertyValueBand: "£1.5m+",
    adviserAppointed: true,
    executorAppointed: false,
    marketingPreference: "Not allowed",
    consent: { adviserInsights: true, marketing: false, lastUpdated: "20 Feb 2026" },
    communicationPreference: "Email",
    lastReviewDate: "20 Feb 2026",
    nextReviewDue: "20 Feb 2027",
    assignedProfessional: "Amelia Grant",
  },
  {
    id: "CL-2004",
    organisationId: "ORG-1002",
    clientName: "Peter Langford",
    vaultCompletion: 68,
    willStatus: "Review needed",
    willAge: "9 years",
    estateValueBand: "£1m–£2.5m",
    possessionsValueBand: "£25k–£75k",
    propertyValueBand: "£750k–£1.5m",
    adviserAppointed: false,
    executorAppointed: true,
    marketingPreference: "Allowed",
    consent: { adviserInsights: false, marketing: true, lastUpdated: "02 Sep 2025" },
    communicationPreference: "Post",
    lastReviewDate: "02 Sep 2024",
    nextReviewDue: "Overdue",
    assignedProfessional: "Julian Reed",
  },
  {
    id: "CL-2005",
    organisationId: "ORG-1003",
    clientName: "Harriet Singh",
    vaultCompletion: 36,
    willStatus: "Missing",
    willAge: "Not uploaded",
    estateValueBand: "£250k–£500k",
    possessionsValueBand: "Under £25k",
    propertyValueBand: "£250k–£500k",
    adviserAppointed: false,
    executorAppointed: false,
    marketingPreference: "Allowed",
    consent: { adviserInsights: false, marketing: true, lastUpdated: "Not recorded" },
    communicationPreference: "Email",
    lastReviewDate: "Never",
    nextReviewDue: "Now",
    assignedProfessional: "Priya Nair",
  },
  {
    id: "CL-2006",
    organisationId: "ORG-1004",
    clientName: "Daniel Frost",
    vaultCompletion: 57,
    willStatus: "Uploaded",
    willAge: "6 years",
    estateValueBand: "£500k–£1m",
    possessionsValueBand: "£75k–£150k",
    propertyValueBand: "£500k–£750k",
    adviserAppointed: true,
    executorAppointed: false,
    marketingPreference: "Not allowed",
    consent: { adviserInsights: true, marketing: false, lastUpdated: "15 May 2025" },
    communicationPreference: "None",
    lastReviewDate: "15 May 2025",
    nextReviewDue: "15 May 2026",
    assignedProfessional: "Marcus Hill",
  },
];

export const organisationUsers: OrganisationUser[] = [
  {
    id: "OU-1001",
    organisationId: "ORG-1001",
    name: "Amelia Grant",
    role: "Organisation Owner",
    status: "Active",
    assignedClients: 86,
    lastActive: "01 May 2026, 09:15",
  },
  {
    id: "OU-1002",
    organisationId: "ORG-1001",
    name: "Ruth Morgan",
    role: "Adviser",
    status: "Active",
    assignedClients: 54,
    lastActive: "30 Apr 2026, 16:40",
  },
  {
    id: "OU-1003",
    organisationId: "ORG-1001",
    name: "Theo Clarke",
    role: "Read-only Reviewer",
    status: "Invited",
    assignedClients: 12,
    lastActive: "Invite pending",
  },
  {
    id: "OU-2001",
    organisationId: "ORG-1002",
    name: "Julian Reed",
    role: "Organisation Owner",
    status: "Active",
    assignedClients: 61,
    lastActive: "30 Apr 2026, 11:05",
  },
  {
    id: "OU-2002",
    organisationId: "ORG-1002",
    name: "Nadia Cook",
    role: "Support",
    status: "Active",
    assignedClients: 18,
    lastActive: "29 Apr 2026, 14:22",
  },
  {
    id: "OU-3001",
    organisationId: "ORG-1003",
    name: "Priya Nair",
    role: "Organisation Owner",
    status: "Active",
    assignedClients: 42,
    lastActive: "01 May 2026, 08:55",
  },
  {
    id: "OU-4001",
    organisationId: "ORG-1004",
    name: "Marcus Hill",
    role: "Organisation Owner",
    status: "Active",
    assignedClients: 120,
    lastActive: "30 Apr 2026, 17:35",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "AUD-9001",
    timestamp: "30 Apr 2026, 13:42",
    actor: "Sarah Ahmed",
    role: "Reviewer",
    action: "Viewed death certificate",
    target: "CASE-1842",
    result: "Success",
    governance: "Manual review",
  },
  {
    id: "AUD-9000",
    timestamp: "30 Apr 2026, 13:39",
    actor: "System",
    role: "System",
    action: "Queued verification case",
    target: "CASE-1842",
    result: "Success",
    governance: "Prototype only",
  },
  {
    id: "AUD-8994",
    timestamp: "29 Apr 2026, 16:05",
    actor: "Daniel Price",
    role: "Admin",
    action: "Approved verification",
    target: "CASE-1827",
    result: "Success",
    governance: "Consent checked",
  },
  {
    id: "AUD-8988",
    timestamp: "29 Apr 2026, 15:58",
    actor: "Maya Lewis",
    role: "Support",
    action: "Viewed user summary",
    target: "USR-448",
    result: "Success",
    governance: "Manual review",
  },
  {
    id: "AUD-8975",
    timestamp: "26 Apr 2026, 15:24",
    actor: "Sarah Ahmed",
    role: "Reviewer",
    action: "Rejected verification evidence",
    target: "CASE-1803",
    result: "Rejected",
    governance: "Restricted action",
  },
  {
    id: "AUD-8971",
    timestamp: "26 Apr 2026, 12:10",
    actor: "System",
    role: "System",
    action: "Blocked export attempt",
    target: "Enterprise reports",
    result: "Blocked",
    governance: "Restricted action",
  },
];

export function findCase(caseId: string) {
  return adminCases.find((item) => item.id === caseId) ?? adminCases[0];
}

export function findUser(userId: string) {
  return adminUsers.find((item) => item.id === userId) ?? adminUsers[0];
}

export function findOrganisation(orgId: string) {
  return organisations.find((item) => item.id === orgId) ?? null;
}

export function getOrganisationClients(orgId: string) {
  return organisationClients.filter((item) => item.organisationId === orgId);
}

export function getOrganisationUsers(orgId: string) {
  return organisationUsers.filter((item) => item.organisationId === orgId);
}

export function getLicencePlanForOrganisation(orgId: string) {
  return licencePlans.find((plan) => plan.organisationId === orgId) ?? null;
}

export function getLicenceSeatMetrics() {
  const includedSeats = licencePlans.reduce((sum, plan) => sum + plan.includedSeats, 0);
  const usedSeats = licencePlans.reduce((sum, plan) => sum + plan.usedSeats, 0);
  const clientLimit = licencePlans.reduce((sum, plan) => sum + plan.clientLimit, 0);
  const activeLicences = licencePlans.filter((plan) => plan.licenceStatus === "Active").length;
  const suspendedOrExpiredLicences = licencePlans.filter((plan) => plan.licenceStatus === "Suspended" || plan.licenceStatus === "Expired").length;
  const renewalsDueSoon = licencePlans.filter((plan) => plan.billingStatus === "Renewal due" || plan.licenceStatus === "Review").length;

  return {
    includedSeats,
    usedSeats,
    seatsAvailable: Math.max(includedSeats - usedSeats, 0),
    clientLimit,
    clientsUnderLimit: Math.max(clientLimit - usedSeats, 0),
    activeLicences,
    suspendedOrExpiredLicences,
    renewalsDueSoon,
  };
}
