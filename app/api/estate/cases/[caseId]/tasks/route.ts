import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { addEstateTask } from "@/lib/estate-administration/service";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as { title?: string; category?: string; status?: string };
    const task = await addEstateTask(access.admin, {
      estateCaseId: caseId,
      actorUserId: access.user.id,
      title: String(body.title ?? "").trim(),
      category: body.category,
      status: body.status,
    });
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
