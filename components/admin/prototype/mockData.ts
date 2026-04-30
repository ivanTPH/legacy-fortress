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
};

export type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  role: "Admin" | "Reviewer" | "Support" | "System";
  action: string;
  target: string;
  result: "Success" | "Pending" | "Rejected";
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

export const auditEvents: AuditEvent[] = [
  {
    id: "AUD-9001",
    timestamp: "30 Apr 2026, 13:42",
    actor: "Sarah Ahmed",
    role: "Reviewer",
    action: "Viewed death certificate",
    target: "CASE-1842",
    result: "Success",
  },
  {
    id: "AUD-9000",
    timestamp: "30 Apr 2026, 13:39",
    actor: "System",
    role: "System",
    action: "Queued verification case",
    target: "CASE-1842",
    result: "Success",
  },
  {
    id: "AUD-8994",
    timestamp: "29 Apr 2026, 16:05",
    actor: "Daniel Price",
    role: "Admin",
    action: "Approved verification",
    target: "CASE-1827",
    result: "Success",
  },
  {
    id: "AUD-8988",
    timestamp: "29 Apr 2026, 15:58",
    actor: "Maya Lewis",
    role: "Support",
    action: "Viewed user summary",
    target: "USR-448",
    result: "Success",
  },
  {
    id: "AUD-8975",
    timestamp: "26 Apr 2026, 15:24",
    actor: "Sarah Ahmed",
    role: "Reviewer",
    action: "Rejected verification evidence",
    target: "CASE-1803",
    result: "Rejected",
  },
];

export function findCase(caseId: string) {
  return adminCases.find((item) => item.id === caseId) ?? adminCases[0];
}

export function findUser(userId: string) {
  return adminUsers.find((item) => item.id === userId) ?? adminUsers[0];
}
