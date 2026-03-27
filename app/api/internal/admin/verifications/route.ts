import { NextResponse } from "next/server";
import { applyVerificationAction, loadVerificationQueue, type VerificationAction } from "@/lib/admin/operations";
import { requireAdminAccess } from "@/lib/admin/access";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const queue = await loadVerificationQueue(admin.adminClient);
  return NextResponse.json({ ok: true, queue });
}

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    requestId?: string;
    action?: VerificationAction;
    reviewNotes?: string | null;
  };

  const requestId = String(body.requestId ?? "").trim();
  const action = body.action;
  if (!requestId || !action || !["approve", "reject", "review"].includes(action)) {
    return NextResponse.json({ ok: false, message: "A valid verification action is required." }, { status: 400 });
  }

  await applyVerificationAction(admin.adminClient, {
    requestId,
    action,
    reviewNotes: body.reviewNotes ?? null,
    reviewedByUserId: admin.access.user.id,
  });

  const queue = await loadVerificationQueue(admin.adminClient);
  return NextResponse.json({ ok: true, queue });
}

