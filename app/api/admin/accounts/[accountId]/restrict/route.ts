import { handleRestrictAccount } from "@/lib/backend/adminRoleApiHandlers";

export async function POST(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return handleRestrictAccount(request, accountId);
}
