import { handleSubmitRoleChange } from "@/lib/backend/adminRoleApiHandlers";

export async function POST(request: Request) {
  return handleSubmitRoleChange(request);
}
