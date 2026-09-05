export type QuorumApproval = {
  approverUserId: string;
  decision: string;
  revokedAt?: string | null;
};

export type QuorumSummary = {
  required: number;
  approved: number;
  remaining: number;
  eligibleApprovers: string[];
};

export function calculateQuorum(requiredApprovals: number, approvals: QuorumApproval[]): QuorumSummary {
  const valid = new Set<string>();
  for (const approval of approvals) {
    if (approval.decision !== "approved" || approval.revokedAt || valid.has(approval.approverUserId)) continue;
    valid.add(approval.approverUserId);
  }
  const required = Math.max(1, Math.floor(requiredApprovals));
  return {
    required,
    approved: valid.size,
    remaining: Math.max(0, required - valid.size),
    eligibleApprovers: [...valid],
  };
}

export function assertIndependentApproval(input: {
  approverUserId: string;
  requesterUserId: string;
  ownerUserId: string;
  existingApprovals: QuorumApproval[];
  caseOpen: boolean;
}) {
  if (!input.caseOpen) throw new Error("sensitive_action_not_pending");
  if (input.approverUserId === input.requesterUserId || input.approverUserId === input.ownerUserId) {
    throw new Error("sensitive_action_self_approval_denied");
  }
  if (input.existingApprovals.some((approval) => approval.approverUserId === input.approverUserId)) {
    throw new Error("sensitive_action_duplicate_approval_denied");
  }
}
