import { handleListWorkspaces } from "@/lib/backend/adminRoleApiHandlers";

export async function GET(request: Request) {
  return handleListWorkspaces(request);
}
