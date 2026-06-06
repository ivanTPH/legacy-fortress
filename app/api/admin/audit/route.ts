import { handleEmitAuditEvent, handleListAuditEvents } from "@/lib/backend/adminRoleApiHandlers";

export async function GET(request: Request) {
  return handleListAuditEvents(request);
}

export async function POST(request: Request) {
  return handleEmitAuditEvent(request);
}
