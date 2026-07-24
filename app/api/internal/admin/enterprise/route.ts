import { NextResponse } from "next/server";
import { requireEnterpriseAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import {
  buildEnterpriseReportExportDecision,
  createEnterpriseEnrolmentLink,
  createEnterpriseInvitation,
  createEnterpriseLicence,
  changeEnterpriseLicenceSeats,
  createEnterpriseSeatReservation,
  createEnterpriseOrganisation,
  deleteOrArchiveEnterpriseOrganisation,
  EnterpriseOperationError,
  getEnterpriseLicenceDetail,
  getEnterpriseOrganisationDetail,
  loadEnterprisePortfolio,
  renewEnterpriseLicence,
  saveEnterpriseView,
  transitionEnterpriseMembership,
  transitionEnterpriseLicence,
  transitionEnterpriseOrganisation,
  updateEnterpriseLicence,
  updateEnterpriseEnrolmentLinkStatus,
  updateEnterpriseOrganisation,
  updateEnterpriseInvitationStatus,
} from "@/lib/admin/enterpriseOperations";

export async function GET(request: Request) {
  const admin = await requireEnterpriseAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "organisation:view");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const url = new URL(request.url);
  const organisationId = url.searchParams.get("organisationId");
  const licenceId = url.searchParams.get("licenceId");
  if (licenceId) {
    const licenceDenied = requireAdminCapability(admin.access, "licence:view");
    if (licenceDenied) return NextResponse.json({ ok: false, message: licenceDenied.message, capability: licenceDenied.capability }, { status: licenceDenied.status });
    const detail = await getEnterpriseLicenceDetail(admin.adminClient, licenceId);
    const scopeDenied = assertEnterpriseOrganisationScope(admin.access, detail.licence.organisationId);
    if (scopeDenied) return scopeDenied;
    await recordEnterpriseAudit(request, admin, "Enterprise licence viewed", "licence", detail.licence.id, detail.licence.plan, "success", {
      private_vault_content_excluded: true,
      document_content_excluded: true,
      financial_values_excluded: true,
    }).catch(() => null);
    return NextResponse.json({ ok: true, detail });
  }
  if (organisationId) {
    const scopeDenied = assertEnterpriseOrganisationScope(admin.access, organisationId);
    if (scopeDenied) return scopeDenied;
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
  const admin = await requireEnterpriseAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "").trim();
  const requiredCapability = capabilityForEnterpriseAction(action);
  const denied = requiredCapability ? requireAdminCapability(admin.access, requiredCapability) : null;
  if (denied) {
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "restricted_action_blocked",
      action: action.startsWith("licence") || action.includes("_licence") ? "Enterprise licence action denied" : "Enterprise organisation action denied",
      result: "blocked",
      resourceType: action.startsWith("licence") || action.includes("_licence") ? "licence" : "organisation",
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
  const scopeDenied = await assertEnterpriseActionScope(admin, action, body);
  if (scopeDenied) return scopeDenied;

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
      await recordEnterpriseAudit(request, admin, "Enterprise licence created", "licence", licence.id, licence.plan, "success", {
        organisation_id: licence.organisationId,
        purchased_seats: licence.purchasedSeats,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, licence, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "update_licence") {
      const result = await updateEnterpriseLicence(admin.adminClient, String(body.licenceId ?? ""), body);
      await recordEnterpriseAudit(request, admin, "Enterprise licence updated", "licence", result.after.id, result.after.plan, "success", {
        changed_fields: result.changedFields,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, licence: result.after, changedFields: result.changedFields, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "change_licence_seats") {
      const result = await changeEnterpriseLicenceSeats(admin.adminClient, String(body.licenceId ?? ""), body);
      await recordEnterpriseAudit(request, admin, result.after.purchasedSeats > result.before.purchasedSeats ? "Enterprise licence seats increased" : "Enterprise licence seats reduced", "licence", result.after.id, result.after.plan, "success", {
        old_purchased_seats: result.before.purchasedSeats,
        new_purchased_seats: result.after.purchasedSeats,
        committed_seats: result.committedSeats,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, licence: result.after, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "transition_licence") {
      const result = await transitionEnterpriseLicence(admin.adminClient, String(body.licenceId ?? ""), String(body.status ?? ""), body.reason);
      await recordEnterpriseAudit(request, admin, `Enterprise licence ${result.after.status}`, "licence", result.after.id, result.after.plan, "success", {
        previous_status: result.before.status,
        next_status: result.after.status,
        reason_present: Boolean(body.reason),
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, licence: result.after, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "renew_licence") {
      const result = await renewEnterpriseLicence(admin.adminClient, admin.access, String(body.licenceId ?? ""), body);
      await recordEnterpriseAudit(request, admin, "Enterprise licence renewed", "licence", result.after.id, result.after.plan, "success", {
        renewal_id: result.renewalId,
        previous_renewal_date: result.before.renewalDate,
        new_renewal_date: result.after.renewalDate,
        previous_purchased_seats: result.before.purchasedSeats,
        new_purchased_seats: result.after.purchasedSeats,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, licence: result.after, renewalId: result.renewalId, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "reserve_licence_seat") {
      const result = await createEnterpriseSeatReservation(admin.adminClient, String(body.licenceId ?? ""), body);
      await recordEnterpriseAudit(request, admin, "Enterprise licence seat reserved", "licence", result.licence.id, result.licence.plan, "success", {
        seat_id: result.seatId,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, seatId: result.seatId, licence: result.licence, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "invite_organisation_admin" || action === "invite_enterprise_user") {
      const invitation = await createEnterpriseInvitation(admin.adminClient, admin.access, {
        ...body,
        invitationType: action === "invite_organisation_admin" ? "organisation_admin" : "enterprise_user",
      });
      await recordEnterpriseAudit(request, admin, action === "invite_organisation_admin" ? "Enterprise organisation administrator invitation sent" : "Enterprise user invitation sent", "access_policy", invitation.id, invitation.email, "success", {
        organisation_id: invitation.organisationId,
        licence_id: invitation.licenceId,
        seat_id: invitation.seatId,
        role_template: invitation.roleTemplate,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, invitation, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "update_invitation") {
      const invitation = await updateEnterpriseInvitationStatus(
        admin.adminClient,
        String(body.invitationId ?? ""),
        String(body.status ?? ""),
      );
      await recordEnterpriseAudit(request, admin, `Enterprise invitation ${invitation.status}`, "access_policy", invitation.id, invitation.email, "success", {
        organisation_id: invitation.organisationId,
        licence_id: invitation.licenceId,
        seat_released: ["revoked", "expired", "failed"].includes(invitation.status),
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, invitation, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "transition_membership") {
      const result = await transitionEnterpriseMembership(admin.adminClient, String(body.membershipId ?? ""), String(body.status ?? ""), body.reason);
      await recordEnterpriseAudit(request, admin, `Enterprise membership ${result.after.status}`, "access_policy", result.after.id, result.after.email, "success", {
        organisation_id: result.after.organisationId,
        licence_id: result.after.licenceId,
        seat_id: result.after.seatId,
        previous_status: result.before.status,
        next_status: result.after.status,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, membership: result.after, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "create_enrolment_link") {
      const link = await createEnterpriseEnrolmentLink(admin.adminClient, admin.access, body);
      await recordEnterpriseAudit(request, admin, "Enterprise enrolment link created", "access_policy", link.id, link.displayName, "success", {
        organisation_id: link.organisationId,
        licence_id: link.licenceId,
        max_claims: link.maxClaims,
        approval_required: link.approvalRequired,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, enrolmentLink: link, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "update_enrolment_link") {
      const link = await updateEnterpriseEnrolmentLinkStatus(admin.adminClient, String(body.enrolmentLinkId ?? ""), String(body.status ?? ""));
      await recordEnterpriseAudit(request, admin, `Enterprise enrolment link ${link.status}`, "access_policy", link.id, link.displayName, "success", {
        organisation_id: link.organisationId,
        licence_id: link.licenceId,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, enrolmentLink: link, portfolio: await loadEnterprisePortfolio(admin.adminClient, admin.access) });
    }

    if (action === "validate_bulk_invitations") {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const portfolio = await loadEnterprisePortfolio(admin.adminClient, admin.access);
      const emails = new Set<string>();
      const validation = rows.map((row, index) => {
        const entry = row && typeof row === "object" ? row as Record<string, unknown> : {};
        const email = String(entry.email ?? "").trim().toLowerCase();
        const issues: string[] = [];
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("invalid_email");
        if (emails.has(email)) issues.push("duplicate_row");
        emails.add(email);
        if (!entry.licence_id) issues.push("missing_licence");
        return { index, email, valid: issues.length === 0, issues };
      });
      await recordEnterpriseAudit(request, admin, "Enterprise bulk invitation validated", "access_policy", "", "Bulk invitation CSV", "success", {
        rows: rows.length,
        valid_rows: validation.filter((row) => row.valid).length,
        synthetic_run_marker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, validation, portfolio });
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
          action: action.includes("licence") ? "Enterprise licence action rejected" : "Enterprise organisation action rejected",
          result: "blocked",
          resourceType: action.includes("licence") ? "licence" : "organisation",
          resourceId: String(body.licenceId ?? body.organisationId ?? ""),
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

function capabilityForEnterpriseAction(action: string) {
  if (["create_organisation", "update_organisation", "transition_organisation", "delete_or_archive_organisation"].includes(action)) return "organisation:manage" as const;
  if (action === "create_licence") return "licence:create" as const;
  if (action === "update_licence") return "licence:edit" as const;
  if (action === "change_licence_seats" || action === "reserve_licence_seat") return "licence:seats" as const;
  if (action === "renew_licence") return "licence:renew" as const;
  if (action === "transition_licence") return "licence:lifecycle" as const;
  if (["invite_organisation_admin", "invite_enterprise_user", "update_invitation"].includes(action)) return "enterprise.invitation.manage" as const;
  if (action === "transition_membership") return "enterprise.membership.manage" as const;
  if (["create_enrolment_link", "update_enrolment_link"].includes(action)) return "enterprise.enrolment_link.manage" as const;
  if (action === "validate_bulk_invitations") return "enterprise.invitation.manage" as const;
  if (action === "save_view") return "enterprise.report.read" as const;
  if (action === "export_report") return "enterprise.export.request" as const;
  return null;
}

function assertEnterpriseOrganisationScope(access: { enterpriseScope?: { organisationScoped: boolean; organisationIds: string[] } }, organisationId: string | null | undefined) {
  const scope = access.enterpriseScope;
  if (!scope?.organisationScoped) return null;
  if (organisationId && scope.organisationIds.includes(organisationId)) return null;
  return NextResponse.json({ ok: false, code: "enterprise_scope_denied", message: "Enterprise organisation access is restricted." }, { status: 403 });
}

async function assertEnterpriseActionScope(
  admin: Awaited<ReturnType<typeof requireEnterpriseAccess>> & { ok: true },
  action: string,
  body: Record<string, unknown>,
) {
  if (!admin.access.enterpriseScope?.organisationScoped) return null;
  if (action === "create_organisation") {
    return NextResponse.json({ ok: false, code: "enterprise_scope_denied", message: "Organisation-scoped users cannot create organisations." }, { status: 403 });
  }

  let organisationId = typeof body.organisationId === "string" ? body.organisationId : "";
  const licenceId = typeof body.licenceId === "string" ? body.licenceId : "";
  const membershipId = typeof body.membershipId === "string" ? body.membershipId : "";
  const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
  const enrolmentLinkId = typeof body.enrolmentLinkId === "string" ? body.enrolmentLinkId : "";

  if (!organisationId && licenceId) {
    const res = await admin.adminClient.from("enterprise_licences").select("organisation_id").eq("id", licenceId).maybeSingle();
    organisationId = String(res.data?.organisation_id ?? "");
  }
  if (!organisationId && membershipId) {
    const res = await admin.adminClient.from("enterprise_memberships").select("organisation_id").eq("id", membershipId).maybeSingle();
    organisationId = String(res.data?.organisation_id ?? "");
  }
  if (!organisationId && invitationId) {
    const res = await admin.adminClient.from("enterprise_invitations").select("organisation_id").eq("id", invitationId).maybeSingle();
    organisationId = String(res.data?.organisation_id ?? "");
  }
  if (!organisationId && enrolmentLinkId) {
    const res = await admin.adminClient.from("enterprise_enrolment_links").select("organisation_id").eq("id", enrolmentLinkId).maybeSingle();
    organisationId = String(res.data?.organisation_id ?? "");
  }
  if (!organisationId && action === "validate_bulk_invitations" && Array.isArray(body.rows)) {
    const licenceIds = [...new Set(body.rows
      .map((row) => row && typeof row === "object" ? String((row as Record<string, unknown>).licence_id ?? (row as Record<string, unknown>).licenceId ?? "") : "")
      .filter(Boolean))];
    if (licenceIds.length > 0) {
      const res = await admin.adminClient.from("enterprise_licences").select("organisation_id").in("id", licenceIds);
      const organisationIds = [...new Set((res.data ?? []).map((row) => String(row.organisation_id ?? "")).filter(Boolean))];
      const scope = admin.access.enterpriseScope;
      if (organisationIds.length > 0 && organisationIds.every((id) => scope?.organisationIds.includes(id))) return null;
    }
  }

  return assertEnterpriseOrganisationScope(admin.access, organisationId);
}

async function recordEnterpriseAudit(
  request: Request,
  admin: Awaited<ReturnType<typeof requireEnterpriseAccess>> & { ok: true },
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
