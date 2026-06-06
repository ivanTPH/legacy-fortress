import { handleListRoles } from "@/lib/backend/adminRoleApiHandlers";

export async function GET(request: Request) {
  return handleListRoles(request);
}
