import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import {
  buildEnterpriseReportExportDecision,
  createEnterpriseInvitation,
  createEnterpriseLicence,
  createEnterpriseOrganisation,
  deleteOrArchiveEnterpriseOrganisation,
  EnterpriseOperationError,
  getEnterpriseOrganisationDetail,
  loadEnterprisePortfolio,
  saveEnterpriseView,
  transitionEnterpriseOrganisation,
  updateEnterpriseOrganisation,
  updateEnterpriseInvitationStatus,
} from "@/lib/admin/enterpriseOperations";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "organisation:view");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const organisationId = new URL(request.url).searchParams.get("organisationId");
  if (organisationId) {
    const detail = await getEnterpriseOrganisationDetail(admin.adminClient, organisationId);
    await recordEnterpriseAudit(request, admin, "Enterprise organisation viewed", "organisation", detail.organisation.id, detail.organisation.name, "success", {
      private_vault_content_excluded: true,
      document_content_excluded: true,
      financial_values_excluded: true,
    }).catch(() => null);
    return NextResponse.json({ ok: true, detail });
  }

  const portfolio = await loadEnterprisePortfolio(admin.adminClient, admin.access);
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "report_access",
    action: "Enterprise operations portfolio opened",
    result: "success",
    resourceType: "report",
    resourceLabel: "Enterprise operations portfolio",
    route: "/api/internal/admin/enterprise",
    metadata: {
      organisation_count: portfolio.summary.organisations,
      vault_content_excluded: true,
      financial_values_excluded: true,
      document_content_excluded: true,
    },
  }).catch(() => null);
  return NextResponse.json({ ok: true, portfolio });
}

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "organisation:manage");
  if (denied) {
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "restricted_action_blocked",
      action: "Enterprise organisation action denied",
      result: "blocked",
      resourceType: "organisation",
      route: new URL(request.url).pathname,
      policyDecision: "blocked",
      metadata: {
        required_capability: denied.capability,
        private_vault_content_excluded: true,
        document_content_excluded: true,
        financial_values_excluded: true,
      },
    }).catch(() => null);
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "").trim();

  try {
    if (action === "create_organisation") {
      const organisation = await createEnterpriseOrganisation(admin.adminClient, admin.access, body);
      await recordEnterpriseAudit(request, admin, "Enterprise organisation created", "organisation", organisation.id, organisation.name, "success", {
        status: organisation.status,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, organisation, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "update_organisation") {
      const result = await updateEnterpriseOrganisation(admin.adminClient, String(body.organisationId ?? ""), body);
      await recordEnterpriseAudit(request, admin, "Enterprise organisation updated", "organisation", result.after.id, result.after.name, "success", {
        changed_fields: result.changedFields,
        previous_status: result.before.status,
        next_status: result.after.status,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, organisation: result.after, changedFields: result.changedFields, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "transition_organisation") {
      const result = await transitionEnterpriseOrganisation(admin.adminClient, admin.access, String(body.organisationId ?? ""), String(body.status ?? ""), body.reason);
      await recordEnterpriseAudit(request, admin, `Enterprise organisation ${result.after.status}`, "organisation", result.after.id, result.after.name, "success", {
        previous_status: result.before.status,
        next_status: result.after.status,
        reason_present: Boolean(body.reason),
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, organisation: result.after, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "delete_or_archive_organisation") {
      const result = await deleteOrArchiveEnterpriseOrganisation(admin.adminClient, admin.access, String(body.organisationId ?? ""), body.reason);
      await recordEnterpriseAudit(request, admin, result.mode === "deleted" ? "Enterprise organisation deleted" : "Enterprise organisation archived", "organisation", result.before.id, result.before.name, "success", {
        mode: result.mode,
        dependency_counts: result.dependencyCounts,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, mode: result.mode, organisation: result.mode === "archived" ? result.after : null, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "create_licence") {
      const licence = await createEnterpriseLicence(admin.adminClient, admin.access, body);
      await recordEnterpriseAudit(request, admin, "Enterprise licence created", "licence", licence.id, licence.plan);
      return NextResponse.json({ ok: true, licence, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "invite_organisation_admin" || action === "invite_enterprise_user") {
      const invitation = await createEnterpriseInvitation(admin.adminClient, admin.access, {
        ...body,
        invitationType: action === "invite_organisation_admin" ? "organisation_admin" : "enterprise_user",
      });
      await recordEnterpriseAudit(request, admin, "Enterprise invitation sent", "access_policy", invitation.id, invitation.email);
      return NextResponse.json({ ok: true, invitation, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "update_invitation") {
      const invitation = await updateEnterpriseInvitationStatus(
        admin.adminClient,
        String(body.invitationId ?? ""),
        String(body.status ?? ""),
      );
      await recordEnterpriseAudit(request, admin, `Enterprise invitation ${invitation.status}`, "access_policy", invitation.id, invitation.email);
      return NextResponse.json({ ok: true, invitation, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "save_view") {
      const view = await saveEnterpriseView(admin.adminClient, admin.access, body);
      await recordEnterpriseAudit(request, admin, "Enterprise saved view created", "report", String(view.id ?? ""), String(view.name ?? ""));
      return NextResponse.json({ ok: true, view, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "export_report") {
      const decision = await buildEnterpriseReportExportDecision(admin.adminClient, admin.access, body);
      await recordAdminAuditEvent(admin.adminClient, admin.access, {
        category: "report_export_attempt",
        action: "Enterprise report export requested",
        result: decision.ok ? "pending" : "blocked",
        resourceType: "report",
        resourceLabel: String(decision.reportType),
        route: "/api/internal/admin/enterprise",
        policyDecision: decision.ok ? "allowed" : "blocked",
        metadata: {
          cohort: decision.cohort,
          minimum_cohort: decision.minimumCohort,
          private_vault_content_excluded: true,
        },
      });
      return NextResponse.json({ ok: decision.ok, decision }, { status: decision.ok ? 202 : 403 });
    }

    return NextResponse.json({ ok: false, message: "Choose a valid enterprise action." }, { status: 400 });
  } catch (error) {
    if (error instanceof EnterpriseOperationError) {
      if (error.status === 409) {
        await recordAdminAuditEvent(admin.adminClient, admin.access, {
          category: "admin_approval",
          action: "Enterprise organisation action rejected",
          result: "blocked",
          resourceType: "organisation",
          resourceId: String(body.organisationId ?? ""),
          route: new URL(request.url).pathname,
          policyDecision: "blocked",
          metadata: {
            code: error.code,
            requested_action: action,
            private_vault_content_excluded: true,
          },
        }).catch(() => null);
      }
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "enterprise_action_failed", message: "Could not complete enterprise action safely." }, { status: 500 });
  }
}

async function recordEnterpriseAudit(
  request: Request,
  admin: Awaited<ReturnType<typeof requireAdminAccess>> & { ok: true },
  action: string,
  resourceType: "organisation" | "licence" | "access_policy" | "report",
  resourceId: string,
  resourceLabel: string | null,
  result: "success" | "blocked" | "rejected" | "pending" = "success",
  metadata: Record<string, unknown> = {},
) {
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: resourceType === "licence" ? "billing_licence_placeholder" : "admin_approval",
    action,
    result,
    resourceType,
    resourceId,
    resourceLabel,
    route: new URL(request.url).pathname,
    metadata: {
      private_vault_content_excluded: true,
      document_content_excluded: true,
      financial_values_excluded: true,
      ...metadata,
    },
  });
}
