import type { CanonicalContactInviteStatus, CanonicalContactVerificationStatus } from "../contacts/canonicalContacts";

export type WorkflowRequiredRole = "owner" | "contact" | "advisor" | "admin";

export type WorkflowStageKey =
  | "profile"
  | "contacts"
  | "personal"
  | "financial"
  | "legal"
  | "property"
  | "business"
  | "digital"
  | "verification";

export type BlockingItem = {
  stageKey: WorkflowStageKey;
  stageName: string;
  blockerLabel: string;
  requiredRole: WorkflowRequiredRole;
  nextRequiredRole: WorkflowRequiredRole | null;
  actionKey: string;
  priority: number;
  isBlocking: boolean;
  href: string;
};

export type BlockingUserContext = {
  profile: {
    hasProfile: boolean;
    hasAddress: boolean;
    hasContact: boolean;
  };
};

export type BlockingContactRecord = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  inviteStatus?: CanonicalContactInviteStatus | null;
  verificationStatus?: CanonicalContactVerificationStatus | null;
};

export type BlockingVerificationRecord = {
  id: string;
  contactName?: string | null;
  requestType?: string | null;
  requestStatus?: string | null;
};

export type BlockingRecords = {
  personal: { total: number };
  financial: { total: number };
  legal: { total: number };
  property: { total: number };
  business: { total: number };
  digital: { total: number };
  contacts?: BlockingContactRecord[];
  verificationRequests?: BlockingVerificationRecord[];
};

export type ActionQueueItem = Pick<
  BlockingItem,
  "stageName" | "blockerLabel" | "requiredRole" | "nextRequiredRole" | "actionKey" | "priority"
>;

export type ActionQueueGroup = {
  requiredRole: WorkflowRequiredRole;
  label: string;
  priority: number;
  items: ActionQueueItem[];
};

type WorkflowStageConfig = {
  label: string;
  href: string;
  priority: number;
};

export const WORKFLOW_STAGE_CONFIG: Record<WorkflowStageKey, WorkflowStageConfig> = {
  profile: { label: "Profile", href: "/profile", priority: 10 },
  contacts: { label: "Contacts", href: "/contacts", priority: 20 },
  personal: { label: "Personal", href: "/personal", priority: 30 },
  financial: { label: "Finances", href: "/finances", priority: 40 },
  legal: { label: "Legal", href: "/legal", priority: 50 },
  property: { label: "Property", href: "/property", priority: 60 },
  business: { label: "Business", href: "/business", priority: 70 },
  digital: { label: "Digital", href: "/vault/digital", priority: 80 },
  verification: { label: "Verification", href: "/internal/admin", priority: 90 },
};

const REQUIRED_ROLE_LABELS: Record<WorkflowRequiredRole, string> = {
  owner: "Owner",
  contact: "Contact",
  advisor: "Advisor",
  admin: "Admin",
};

export function getWorkflowStageConfig(stageKey: WorkflowStageKey) {
  return WORKFLOW_STAGE_CONFIG[stageKey];
}

export function getWorkflowRequiredRoleLabel(requiredRole: WorkflowRequiredRole) {
  return REQUIRED_ROLE_LABELS[requiredRole];
}

export function buildStageActionKey(stageKey: Exclude<WorkflowStageKey, "contacts" | "verification">) {
  return `stage:${stageKey}` as const;
}

export function buildContactActionKey(contactId: string) {
  return `contact:manage:${contactId}`;
}

export function buildVerificationActionKey(requestId: string) {
  return `admin:verification:${requestId}`;
}

export function resolveWorkflowActionHref(actionKey: string) {
  if (actionKey.startsWith("stage:")) {
    const stageKey = actionKey.slice("stage:".length) as WorkflowStageKey;
    return WORKFLOW_STAGE_CONFIG[stageKey]?.href ?? "/dashboard";
  }
  if (actionKey.startsWith("contact:manage:")) {
    const contactId = actionKey.slice("contact:manage:".length).trim();
    return contactId ? `/contacts?contact=${contactId}` : "/contacts";
  }
  if (actionKey.startsWith("admin:verification:")) {
    return "/internal/admin";
  }
  return "/dashboard";
}

export function evaluateCompletionCount(count: number, targetCompleteCount = 1) {
  if (count <= 0) return { status: "not_started" as const, percent: 0, missingItems: targetCompleteCount };
  if (count >= targetCompleteCount) return { status: "complete" as const, percent: 100, missingItems: 0 };
  const percent = Math.max(1, Math.round((count / targetCompleteCount) * 100));
  return { status: "in_progress" as const, percent, missingItems: targetCompleteCount - count };
}

export function deriveBlockingState(userContext: BlockingUserContext, records: BlockingRecords): BlockingItem[] {
  const blockers: BlockingItem[] = [];
  const profileScore =
    Number(userContext.profile.hasProfile) +
    Number(userContext.profile.hasAddress) +
    Number(userContext.profile.hasContact);

  if (profileScore < 3) {
    const missing: string[] = [];
    if (!userContext.profile.hasProfile) missing.push("identity");
    if (!userContext.profile.hasContact) missing.push("contact details");
    if (!userContext.profile.hasAddress) missing.push("address");
    blockers.push(createBlockingItem({
      stageKey: "profile",
      blockerLabel: `Complete ${missing.join(", ")} in your profile.`,
      requiredRole: "owner",
      actionKey: buildStageActionKey("profile"),
      priorityOffset: 0,
    }));
  }

  addCountBlocker(blockers, "personal", records.personal.total, "Add at least one personal record.");
  addCountBlocker(blockers, "financial", records.financial.total, "Add at least one financial record.");
  addCountBlocker(blockers, "legal", records.legal.total, "Add at least one legal record.");
  addCountBlocker(blockers, "property", records.property.total, "Add at least one property record.");
  addCountBlocker(blockers, "business", records.business.total, "Add at least one business record.");
  addCountBlocker(blockers, "digital", records.digital.total, "Add at least one digital record.");

  for (const contact of records.contacts ?? []) {
    const contactName = String(contact.fullName ?? "").trim() || "This contact";
    const inviteStatus = String(contact.inviteStatus ?? "").trim().toLowerCase();
    const verificationStatus = String(contact.verificationStatus ?? "").trim().toLowerCase();
    if (inviteStatus === "not_invited" && String(contact.email ?? "").trim()) {
      blockers.push(createBlockingItem({
        stageKey: "contacts",
        blockerLabel: `${contactName} is ready for an invite email.`,
        requiredRole: "owner",
        actionKey: buildContactActionKey(contact.id),
        priorityOffset: 5,
      }));
      continue;
    }
    if (inviteStatus === "invite_sent") {
      blockers.push(createBlockingItem({
        stageKey: "contacts",
        blockerLabel: `${contactName} still needs to accept the invitation.`,
        requiredRole: "contact",
        actionKey: buildContactActionKey(contact.id),
        priorityOffset: 10,
      }));
      continue;
    }
    if (verificationStatus === "accepted" || verificationStatus === "pending_verification" || verificationStatus === "verification_submitted") {
      blockers.push(createBlockingItem({
        stageKey: "verification",
        blockerLabel: `${contactName} needs verification review before access can activate.`,
        requiredRole: "admin",
        actionKey: buildContactActionKey(contact.id),
        priorityOffset: 0,
      }));
    }
  }

  for (const request of records.verificationRequests ?? []) {
    const status = String(request.requestStatus ?? "").trim().toLowerCase();
    if (!status || !["pending", "submitted"].includes(status)) continue;
    const requestLabel = String(request.contactName ?? "").trim() || "A linked contact";
    const requestType = String(request.requestType ?? "").trim() || "verification";
    blockers.push(createBlockingItem({
      stageKey: "verification",
      blockerLabel: `${requestLabel} has a ${requestType} request awaiting review.`,
      requiredRole: "admin",
      actionKey: buildVerificationActionKey(request.id),
      priorityOffset: status === "submitted" ? -5 : 0,
    }));
  }

  return blockers
    .sort((left, right) => left.priority - right.priority || left.stageName.localeCompare(right.stageName) || left.blockerLabel.localeCompare(right.blockerLabel))
    .map((item) => ({ ...item, nextRequiredRole: item.isBlocking ? item.requiredRole : null }));
}

export function buildActionQueueGroups(items: BlockingItem[]): ActionQueueGroup[] {
  const blockingItems = items.filter((item) => item.isBlocking && item.nextRequiredRole);
  const groups = new Map<WorkflowRequiredRole, ActionQueueGroup>();

  for (const item of blockingItems) {
    const role = item.nextRequiredRole as WorkflowRequiredRole;
    const existing = groups.get(role);
    if (existing) {
      existing.items.push(toActionQueueItem(item));
      existing.priority = Math.min(existing.priority, item.priority);
      continue;
    }
    groups.set(role, {
      requiredRole: role,
      label: getWorkflowRequiredRoleLabel(role),
      priority: item.priority,
      items: [toActionQueueItem(item)],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((left, right) => left.priority - right.priority || left.stageName.localeCompare(right.stageName)),
    }))
    .sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
}

function createBlockingItem({
  stageKey,
  blockerLabel,
  requiredRole,
  actionKey,
  priorityOffset,
}: {
  stageKey: WorkflowStageKey;
  blockerLabel: string;
  requiredRole: WorkflowRequiredRole;
  actionKey: string;
  priorityOffset: number;
}): BlockingItem {
  const config = WORKFLOW_STAGE_CONFIG[stageKey];
  return {
    stageKey,
    stageName: config.label,
    blockerLabel,
    requiredRole,
    nextRequiredRole: requiredRole,
    actionKey,
    priority: config.priority + priorityOffset,
    isBlocking: true,
    href: resolveWorkflowActionHref(actionKey),
  };
}

function addCountBlocker(
  blockers: BlockingItem[],
  stageKey: Exclude<WorkflowStageKey, "profile" | "contacts" | "verification">,
  count: number,
  blockerLabel: string,
) {
  const progress = evaluateCompletionCount(count);
  if (progress.status === "complete") return;
  blockers.push(createBlockingItem({
    stageKey,
    blockerLabel,
    requiredRole: "owner",
    actionKey: buildStageActionKey(stageKey),
    priorityOffset: progress.status === "in_progress" ? 5 : 0,
  }));
}

function toActionQueueItem(item: BlockingItem): ActionQueueItem {
  return {
    stageName: item.stageName,
    blockerLabel: item.blockerLabel,
    requiredRole: item.requiredRole,
    nextRequiredRole: item.nextRequiredRole,
    actionKey: item.actionKey,
    priority: item.priority,
  };
}
