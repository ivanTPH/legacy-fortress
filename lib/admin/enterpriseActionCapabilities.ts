import type { AdminCapability } from "./capabilities.ts";

export function capabilityForEnterpriseAction(action: string): AdminCapability | null {
  if (["create_organisation", "update_organisation", "transition_organisation", "delete_or_archive_organisation"].includes(action)) return "organisation:manage";
  if (action === "create_licence") return "licence:create";
  if (action === "update_licence") return "licence:edit";
  if (action === "change_licence_seats" || action === "reserve_licence_seat") return "licence:seats";
  if (action === "renew_licence") return "licence:renew";
  if (action === "transition_licence") return "licence:lifecycle";
  if (["invite_organisation_admin", "invite_enterprise_user", "update_invitation"].includes(action)) return "enterprise.invitation.manage";
  if (action === "transition_membership") return "enterprise.membership.manage";
  if (["create_enrolment_link", "update_enrolment_link"].includes(action)) return "enterprise.enrolment_link.manage";
  if (action === "validate_bulk_invitations") return "enterprise.invitation.manage";
  if (["save_view", "update_view", "delete_view"].includes(action)) return "enterprise.report.read";
  if (action === "export_report") return "enterprise.export.request";
  return null;
}
