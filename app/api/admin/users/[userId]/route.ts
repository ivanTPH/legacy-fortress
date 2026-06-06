import { handleGetAdminUser } from "@/lib/backend/adminRoleApiHandlers";

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return handleGetAdminUser(request, userId);
}
