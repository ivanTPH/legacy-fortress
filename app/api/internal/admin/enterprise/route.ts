import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import {
  buildEnterpriseReportExportDecision,
  createEnterpriseInvitation,
  createEnterpriseLicence,
  createEnterpriseOrganisation,
  EnterpriseOperationError,
  loadEnterprisePortfolio,
  saveEnterpriseView,
  updateEnterpriseInvitationStatus,
} from "@/lib/admin/enterpriseOperations";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "organisation:manage");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
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
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "").trim();

  try {
    if (action === "create_organisation") {
      const organisation = await createEnterpriseOrganisation(admin.adminClient, admin.access, body);
      await recordEnterpriseAudit(request, admin, "Enterprise organisation created", "organisation", organisation.id, organisation.name);
      return NextResponse.json({ ok: true, organisation, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
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
) {
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: resourceType === "licence" ? "billing_licence_placeholder" : "admin_approval",
    action,
    result: "success",
    resourceType,
    resourceId,
    resourceLabel,
    route: new URL(request.url).pathname,
    metadata: {
      private_vault_content_excluded: true,
      document_content_excluded: true,
      financial_values_excluded: true,
    },
  });
}
