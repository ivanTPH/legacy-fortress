import { NextResponse } from "next/server.js";
import {
  roleManagementAuditRepository,
  roleManagementRoleRepository,
  roleManagementUserRepository,
  roleManagementWorkspaceRepository,
} from "../../components/admin/prototype/roleManagementService.ts";
import {
  roleApiError,
  validateAuditEventPayload,
  validateRoleChangeRequest,
  type AuditEventListRequestDto,
  type RoleChangeRequestDto,
  type WorkspaceContextListRequestDto,
} from "./rolePermissionContracts.ts";
import { requireAdminApiAccess } from "./adminApiGuard.ts";

export async function handleListAdminUsers(request: Request) {
  const guard = requireAdminApiAccess(request);
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const result = await roleManagementUserRepository.listRegisteredIndividuals({
    account_id: url.searchParams.get("accountId"),
    include_platform_admins: url.searchParams.get("includePlatformAdmins") !== "false",
  }, guard.context);
  return json(result);
}

export async function handleGetAdminUser(request: Request, userId: string) {
  const guard = requireAdminApiAccess(request);
  if (!guard.ok) return guard.response;
  const result = await roleManagementUserRepository.getRegisteredIndividual({ user_id: userId }, guard.context);
  return json(result, result.ok ? 200 : 404);
}

export async function handleListRoles(request: Request) {
  const guard = requireAdminApiAccess(request);
  if (!guard.ok) return guard.response;
  const result = await roleManagementRoleRepository.listRoleTemplates(guard.context);
  return json(result);
}

export async function handleProposeRoleChange(request: Request) {
  return roleChange(request, "propose");
}

export async function handleValidateRoleChange(request: Request) {
  return roleChange(request, "validate");
}

export async function handleSubmitRoleChange(request: Request) {
  return roleChange(request, "submit");
}

export async function handleSuspendUser(request: Request, userId: string) {
  const body = await readJson(request);
  const merged = {
    ...body,
    target: {
      ...(typeof body === "object" && body && "target" in body ? (body as { target?: object }).target : {}),
      target_user_id: userId,
    },
    action_type: "admin_suspension",
    dangerous_action: "suspend_user",
  };
  return roleChange(request, "suspend", merged);
}

export async function handleRestrictAccount(request: Request, accountId: string) {
  const body = await readJson(request);
  const merged = {
    ...body,
    target: {
      ...(typeof body === "object" && body && "target" in body ? (body as { target?: object }).target : {}),
      target_account_id: accountId,
    },
    action_type: "account_access_restriction",
  };
  return roleChange(request, "restrict", merged);
}

export async function handleListAuditEvents(request: Request) {
  const guard = requireAdminApiAccess(request);
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const input: AuditEventListRequestDto = {
    user_id: url.searchParams.get("userId"),
    account_id: url.searchParams.get("accountId"),
    limit: Number(url.searchParams.get("limit") ?? "") || undefined,
  };
  const result = await roleManagementAuditRepository.listAuditEvents(input, guard.context);
  return json(result);
}

export async function handleEmitAuditEvent(request: Request) {
  const guard = requireAdminApiAccess(request);
  if (!guard.ok) return guard.response;
  const body = await readJson(request);
  if (!validateAuditEventPayload(body)) {
    return json(roleApiError("invalid_payload", "Audit event payload failed validation."), 400);
  }
  const result = await roleManagementAuditRepository.emitAuditEvent(body, guard.context);
  return json(result);
}

export async function handleListWorkspaces(request: Request) {
  const guard = requireAdminApiAccess(request);
  if (!guard.ok) return guard.response;
  const input: WorkspaceContextListRequestDto = {
    roles: guard.roles,
    trusted_role_claims: guard.context.principal?.trustedRoleClaims ?? false,
  };
  const result = await roleManagementWorkspaceRepository.listAvailableWorkspaceContexts(input, guard.context);
  return json(result);
}

async function roleChange(
  request: Request,
  action: "propose" | "validate" | "submit" | "suspend" | "restrict",
  providedBody?: unknown,
) {
  const guard = requireAdminApiAccess(request);
  if (!guard.ok) return guard.response;
  const body = providedBody ?? await readJson(request);
  if (!validateRoleChangeRequest(body)) {
    return json(roleApiError("invalid_payload", "Role change request failed validation."), 400);
  }

  const input = body as RoleChangeRequestDto;
  const result = action === "propose"
    ? await roleManagementRoleRepository.proposeRoleChange(input, guard.context)
    : action === "validate"
      ? await roleManagementRoleRepository.validatePermissionChange(input, guard.context)
      : action === "submit"
        ? await roleManagementRoleRepository.submitPermissionChange(input, guard.context)
        : action === "suspend"
          ? await roleManagementRoleRepository.suspendUser(input, guard.context)
          : await roleManagementRoleRepository.restrictAccountAccess(input, guard.context);

  return json(result, result.ok ? 200 : result.error.code === "confirmation_required" ? 409 : 403);
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function json(result: unknown, status = 200) {
  return NextResponse.json({
    ...(typeof result === "object" && result ? result : { ok: false, error: { code: "invalid_payload", message: "Invalid result." } }),
    mock: true,
    persistence: "mock_only",
  }, { status });
}
