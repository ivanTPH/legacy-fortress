import { handleListAdminUsers } from "@/lib/backend/adminRoleApiHandlers";

export async function GET(request: Request) {
  return handleListAdminUsers(request);
}
