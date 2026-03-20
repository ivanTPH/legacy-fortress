type TaskAssetSource = {
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalTaskAsset = {
  title: string;
  description: string;
  related_asset_id: string;
  related_asset_label: string;
  assigned_executor_asset_id: string;
  assigned_executor_label: string;
  assigned_beneficiary_asset_id: string;
  assigned_beneficiary_label: string;
  priority: string;
  task_status: string;
  due_date: string;
  completion_date: string;
  instruction_reference: string;
  notes: string;
  task_summary: string;
};

export type CanonicalTaskEditSeed = {
  title: string;
  description: string;
  related_asset_id: string;
  assigned_executor_asset_id: string;
  assigned_beneficiary_asset_id: string;
  priority: string;
  priority_other: string;
  task_status: string;
  task_status_other: string;
  due_date: string;
  completion_date: string;
  instruction_reference: string;
  notes: string;
};

export function readCanonicalTaskAsset(source: TaskAssetSource): CanonicalTaskAsset {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const title = readString(source.title, metadata["task_title"], metadata["title"]) || "Untitled task";
  const description = readString(metadata["description"], metadata["task_description"]);
  const relatedAssetId = readString(metadata["related_asset_id"]);
  const relatedAssetLabel = readString(metadata["related_asset_label"], metadata["related_record_label"]);
  const assignedExecutorAssetId = readString(metadata["assigned_executor_asset_id"]);
  const assignedExecutorLabel = readString(metadata["assigned_executor_label"]);
  const assignedBeneficiaryAssetId = readString(metadata["assigned_beneficiary_asset_id"]);
  const assignedBeneficiaryLabel = readString(metadata["assigned_beneficiary_label"]);
  const priority = readString(metadata["priority"], metadata["priority_other"]);
  const taskStatus = readString(metadata["task_status"], metadata["status"], metadata["task_status_other"]);
  const dueDate = readString(metadata["due_date"]);
  const completionDate = readString(metadata["completion_date"]);
  const instructionReference = readString(metadata["instruction_reference"]);
  const notes = readString(metadata["notes"]);

  return {
    title,
    description,
    related_asset_id: relatedAssetId,
    related_asset_label: relatedAssetLabel,
    assigned_executor_asset_id: assignedExecutorAssetId,
    assigned_executor_label: assignedExecutorLabel,
    assigned_beneficiary_asset_id: assignedBeneficiaryAssetId,
    assigned_beneficiary_label: assignedBeneficiaryLabel,
    priority,
    task_status: taskStatus,
    due_date: dueDate,
    completion_date: completionDate,
    instruction_reference: instructionReference,
    notes,
    task_summary: [priority, taskStatus, relatedAssetLabel].filter(Boolean).join(" · "),
  };
}

export function normalizeCanonicalTaskMetadata(metadata: Record<string, unknown>) {
  const canonical = readCanonicalTaskAsset({ metadata });

  return {
    ...metadata,
    task_title: canonical.title || null,
    description: canonical.description || null,
    related_asset_id: canonical.related_asset_id || null,
    related_asset_label: canonical.related_asset_label || null,
    assigned_executor_asset_id: canonical.assigned_executor_asset_id || null,
    assigned_executor_label: canonical.assigned_executor_label || null,
    assigned_beneficiary_asset_id: canonical.assigned_beneficiary_asset_id || null,
    assigned_beneficiary_label: canonical.assigned_beneficiary_label || null,
    priority: canonical.priority || null,
    task_status: canonical.task_status || null,
    due_date: canonical.due_date || null,
    completion_date: canonical.completion_date || null,
    instruction_reference: canonical.instruction_reference || null,
    notes: canonical.notes || null,
  };
}

export function buildCanonicalTaskEditSeed(source: TaskAssetSource): CanonicalTaskEditSeed {
  const canonical = readCanonicalTaskAsset(source);

  return {
    title: canonical.title,
    description: canonical.description,
    related_asset_id: canonical.related_asset_id,
    assigned_executor_asset_id: canonical.assigned_executor_asset_id,
    assigned_beneficiary_asset_id: canonical.assigned_beneficiary_asset_id,
    priority: toKnownOrOther(canonical.priority, TASK_PRIORITY_VALUES).selected,
    priority_other: toKnownOrOther(canonical.priority, TASK_PRIORITY_VALUES).other,
    task_status: toKnownOrOther(canonical.task_status, TASK_STATUS_VALUES).selected,
    task_status_other: toKnownOrOther(canonical.task_status, TASK_STATUS_VALUES).other,
    due_date: canonical.due_date,
    completion_date: canonical.completion_date,
    instruction_reference: canonical.instruction_reference,
    notes: canonical.notes,
  };
}

const TASK_PRIORITY_VALUES = ["critical", "high", "medium", "low"];
const TASK_STATUS_VALUES = ["not_started", "in_progress", "waiting", "completed", "blocked", "cancelled"];

function toKnownOrOther(value: string, knownValues: string[]) {
  const normalized = value.trim();
  if (!normalized) return { selected: "", other: "" };
  if (knownValues.includes(normalized)) return { selected: normalized, other: "" };
  return { selected: "__other", other: normalized };
}

function readString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}
