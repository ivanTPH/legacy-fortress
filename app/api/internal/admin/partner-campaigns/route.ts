import { NextResponse } from "next/server";
import { requireEnterpriseAccess, requireAdminCapability } from "@/lib/admin/access";
import { createAggregateReport, createPartnerCampaign, createPartnerCohortRequest, evaluatePartnerCohort } from "@/lib/privacy-security/partner";

export async function POST(request: Request) {
  const admin = await requireEnterpriseAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "partner.campaign.manage");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    organisationId?: string;
    purpose?: string;
    definition?: Record<string, unknown>;
    candidateUserIds?: string[];
    cohortRequestId?: string;
    name?: string;
    channel?: string;
    syntheticRunMarker?: string;
  };
  const organisationId = String(body.organisationId ?? "");
  if (!organisationId) return NextResponse.json({ ok: false, message: "organisationId is required." }, { status: 400 });
  if (admin.access.enterpriseScope?.organisationScoped && !admin.access.enterpriseScope.organisationIds.includes(organisationId)) {
    return NextResponse.json({ ok: false, message: "Organisation is outside this enterprise admin scope." }, { status: 403 });
  }
  try {
    if (body.action === "create_cohort") {
      const cohort = await createPartnerCohortRequest(admin.adminClient, {
        organisationId,
        requestedByUserId: admin.access.user.id,
        purpose: String(body.purpose ?? "partner_campaign"),
        definition: body.definition ?? {},
        syntheticRunMarker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, cohort }, { status: 201 });
    }
    if (body.action === "evaluate_cohort") {
      if (!body.cohortRequestId) return NextResponse.json({ ok: false, message: "cohortRequestId is required." }, { status: 400 });
      const cohort = await evaluatePartnerCohort(admin.adminClient, {
        cohortRequestId: body.cohortRequestId,
        candidateUserIds: body.candidateUserIds ?? [],
        channel: body.channel ?? "email",
      });
      return NextResponse.json({ ok: true, aggregate: cohort });
    }
    if (body.action === "create_campaign") {
      const campaign = await createPartnerCampaign(admin.adminClient, {
        organisationId,
        cohortRequestId: body.cohortRequestId ?? null,
        createdByUserId: admin.access.user.id,
        name: String(body.name ?? "Partner campaign"),
        purpose: String(body.purpose ?? "partner_campaign"),
        channel: body.channel ?? "email",
        syntheticRunMarker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, campaign }, { status: 201 });
    }
    if (body.action === "add_audience_member") {
      return NextResponse.json({ ok: false, message: "Raw audience-list APIs are disabled; use closed-loop aggregate evaluation." }, { status: 403 });
    }
    if (body.action === "create_aggregate_report") {
      const report = await createAggregateReport(admin.adminClient, {
        organisationId,
        metrics: { eligible: Number((body.definition ?? {}).eligible ?? 0), suppressed: Number((body.definition ?? {}).suppressed ?? 0) },
        syntheticRunMarker: body.syntheticRunMarker ?? null,
      });
      return NextResponse.json({ ok: true, report });
    }
    return NextResponse.json({ ok: false, message: "unsupported_partner_campaign_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "partner_campaign_error";
    return NextResponse.json({ ok: false, message: /secret|token|jwt/i.test(message) ? "partner_campaign_error" : message }, { status: message.includes("rejected") ? 400 : 500 });
  }
}

export async function GET(request: Request) {
  const admin = await requireEnterpriseAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "partner.campaign.read");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  const url = new URL(request.url);
  const organisationId = url.searchParams.get("organisationId");
  if (!organisationId) return NextResponse.json({ ok: false, message: "organisationId is required." }, { status: 400 });
  if (admin.access.enterpriseScope?.organisationScoped && !admin.access.enterpriseScope.organisationIds.includes(organisationId)) {
    return NextResponse.json({ ok: false, message: "Organisation is outside this enterprise admin scope." }, { status: 403 });
  }
  const [campaigns, cohorts, reports] = await Promise.all([
    admin.adminClient.from("partner_campaigns").select("id,name,purpose,channel,status,aggregate_only,sent_count,suppressed_count,created_at").eq("organisation_id", organisationId).order("created_at", { ascending: false }).limit(25),
    admin.adminClient.from("partner_cohort_requests").select("id,purpose,status,analytical_eligible_count,marketing_eligible_count,threshold_result,policy_result,created_at").eq("organisation_id", organisationId).order("created_at", { ascending: false }).limit(25),
    admin.adminClient.from("partner_aggregate_reports").select("id,report_type,metrics,threshold_result,created_at").eq("organisation_id", organisationId).order("created_at", { ascending: false }).limit(25),
  ]);
  if (campaigns.error || cohorts.error || reports.error) return NextResponse.json({ ok: false, message: "partner_report_load_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, campaigns: campaigns.data ?? [], cohorts: cohorts.data ?? [], reports: reports.data ?? [], rawAudienceListReturned: false });
}
