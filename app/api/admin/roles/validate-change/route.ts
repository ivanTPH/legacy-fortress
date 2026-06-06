import { handleValidateRoleChange } from "@/lib/backend/adminRoleApiHandlers";

export async function POST(request: Request) {
  return handleValidateRoleChange(request);
}
