export type VaultTaskGroup = "todo" | "waiting" | "suggested";

export function getVaultTaskGroup(row: { status: string; taskType?: string }): VaultTaskGroup {
  if (row.status === "Pending") return "waiting";
  if (["Required", "Failed", "Plan limit reached"].includes(row.status) || row.taskType === "user_created") return "todo";
  return "suggested";
}

export function countOpenNeedsYou(rows: readonly { status: string; taskType?: string }[]) {
  return rows.filter((row) => row.status !== "Complete" && getVaultTaskGroup(row) === "todo").length;
}
