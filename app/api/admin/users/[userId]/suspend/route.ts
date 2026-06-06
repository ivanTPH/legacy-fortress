import { handleSuspendUser } from "@/lib/backend/adminRoleApiHandlers";

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return handleSuspendUser(request, userId);
}
