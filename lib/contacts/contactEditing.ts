import type { CanonicalContactRow, SyncCanonicalContactInput } from "./canonicalContacts";

export type EditableContactValues = {
  fullName: string;
  email: string;
  phone: string;
  contactRole: string;
  relationship: string;
};

export function buildEditableContactValues(contact: Pick<CanonicalContactRow, "full_name" | "email" | "phone" | "contact_role" | "relationship">): EditableContactValues {
  return {
    fullName: String(contact.full_name ?? ""),
    email: String(contact.email ?? ""),
    phone: String(contact.phone ?? ""),
    contactRole: String(contact.contact_role ?? ""),
    relationship: String(contact.relationship ?? ""),
  };
}

export function buildCanonicalContactEditInput({
  ownerUserId,
  current,
  values,
}: {
  ownerUserId: string;
  current: Pick<CanonicalContactRow, "id" | "invite_status" | "verification_status" | "source_type">;
  values: EditableContactValues;
}): SyncCanonicalContactInput {
  return {
    ownerUserId,
    existingContactId: current.id,
    fullName: values.fullName.trim() || "Contact",
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    contactRole: values.contactRole.trim() || null,
    relationship: values.relationship.trim() || null,
    inviteStatus: current.invite_status,
    verificationStatus: current.verification_status,
    sourceType: current.source_type,
  };
}

export function buildContactProjectionUpdates(values: EditableContactValues) {
  const fullName = values.fullName.trim() || "Contact";
  const email = values.email.trim().toLowerCase() || null;
  const contactRole = values.contactRole.trim() || null;

  return {
    invitations: {
      contact_name: fullName,
      contact_email: email,
    },
    recordContacts: {
      contact_name: fullName,
      contact_email: email,
      contact_role: contactRole,
    },
  };
}
