import { handleProposeRoleChange } from "@/lib/backend/adminRoleApiHandlers";

export async function POST(request: Request) {
  return handleProposeRoleChange(request);
}
