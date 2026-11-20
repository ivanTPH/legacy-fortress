import { NextResponse } from "next/server";
import { adminHasCapability, requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { sendHelpReply } from "@/lib/admin/helpReplies";

/**
 * POST { messageId, text } — reply to a Help message from the Admin Inbox (stage 3, 20 Nov 2026).
 * Needs support:manage. Audited without the reply text; the customer's email only says a reply is waiting.
 */
export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "support:manage");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  const body = (await request.json().catch(() => ({}))) as { messageId?: unknown; text?: unknown };
  const messageId = String(body.messageId ?? "").replace(/^message:/, "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return NextResponse.json({ ok: false, message: "That message couldn’t be found." }, { status: 400 });
  const result = await sendHelpReply(admin.adminClient, { messageId, text: String(body.text ?? ""), adminUserId: admin.access.user.id });
  if (!result.ok) return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  if (adminHasCapability(admin.access, "audit:write")) {
    try {
      await recordAdminAuditEvent(admin.adminClient, admin.access, {
        category: "admin_review", action: "Replied to a Help message", result: "success", resourceType: "case",
        resourceId: messageId, resourceLabel: "Help message", route: "/api/internal/admin/help-reply",
        metadata: { reply_id: result.replyId, emailed: result.emailed },
      });
    } catch { /* the reply is saved; audit is best effort here as elsewhere */ }
  }
  return NextResponse.json({ ok: true, replyId: result.replyId, emailed: result.emailed });
}
