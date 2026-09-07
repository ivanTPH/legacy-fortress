import { NextResponse } from "next/server";

function errorCode(error: unknown) {
  return error instanceof Error ? error.message.split(":", 1)[0] : "sensitive_action_error";
}

export function sensitiveActionErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "sensitive_action_error");
  const code = errorCode(error);
  const status = code === "sensitive_action_not_found" ? 404
    : code === "sensitive_action_expired" ? 410
      : code === "sensitive_action_duplicate_approval_denied" || code === "sensitive_action_not_pending" || /duplicate|unique constraint/i.test(message) ? 409
        : code === "active_estate_participant_required" || code === "estate_identity_level_required" || code === "level_3_required_for_sensitive_action" || code === "level_3_required_for_sensitive_action_approval" || code === "sensitive_action_self_approval_denied" || code.startsWith("estate_permission_required") ? 403
          : 500;
  const publicError = status === 500 ? "sensitive_action_error" : code;
  return NextResponse.json({ ok: false, error: publicError }, { status });
}
