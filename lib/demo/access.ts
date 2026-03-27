import crypto from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRoleLabel } from "../access-control/viewerAccess";
import type { CollaboratorRole } from "../access-control/roles";
import { syncCanonicalContact } from "../contacts/canonicalContacts";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "../supabaseAdmin";
import {
  DEMO_ACCOUNT_HOLDER_NAME,
  DEMO_ENVIRONMENT_KEY,
  DEMO_EXPERIENCE_LABEL,
  DEMO_EXPERIENCE_SUBLABEL,
  DEMO_OWNER_EMAIL,
  DEMO_REVIEWER_EMAIL,
  DEMO_REVIEWER_NAME,
  DEMO_REVIEWER_ROLE,
  normalizeDemoEmail,
} from "./config";

type AnySupabaseClient = SupabaseClient;

export type DemoEnvironmentSummary = {
  ownerUserId: string;
  reviewerUserId: string;
  contactId: string;
  grantId: string;
  seededAssetCount: number;
  reviewerRole: CollaboratorRole;
};

export type DemoSessionPayload = DemoEnvironmentSummary & {
  actionLink: string;
  emailOtp: string;
  redirectTo: string;
  reviewerEmail: string;
  accountHolderName: string;
  roleLabel: string;
  experienceLabel: string;
  experienceSublabel: string;
};

export function getDemoAdminClient() {
  const client = createSupabaseAdminClient();
  return {
    client,
    issue: client ? null : getSupabaseAdminConfigIssue() ?? "missing_demo_admin_client",
  };
}

export async function prepareDemoSession({
  origin,
  adminClient,
}: {
  origin: string;
  adminClient?: AnySupabaseClient | null;
}): Promise<DemoSessionPayload> {
  const client = adminClient ?? getDemoAdminClient().client;
  if (!client) {
    throw new Error("Demo access is unavailable in this environment.");
  }

  const summary = (await loadPreparedDemoEnvironment(client)) ?? await ensureDemoEnvironment(client);
  const redirectTo = new URL("/auth/callback?next=/dashboard", resolveDemoRedirectOrigin(origin)).toString();
  const linkRes = await client.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_REVIEWER_EMAIL,
    options: {
      redirectTo,
      data: {
        full_name: DEMO_REVIEWER_NAME,
        lf_demo_account: true,
        lf_demo_kind: "reviewer",
        lf_demo_environment: DEMO_ENVIRONMENT_KEY,
      },
    },
  });

  if (linkRes.error || !linkRes.data.properties.action_link) {
    throw new Error(linkRes.error?.message || "Could not generate the demo access link.");
  }

  return {
    ...summary,
    actionLink: linkRes.data.properties.action_link,
    emailOtp: linkRes.data.properties.email_otp,
    redirectTo,
    reviewerEmail: DEMO_REVIEWER_EMAIL,
    accountHolderName: DEMO_ACCOUNT_HOLDER_NAME,
    roleLabel: getRoleLabel(DEMO_REVIEWER_ROLE as never),
    experienceLabel: DEMO_EXPERIENCE_LABEL,
    experienceSublabel: DEMO_EXPERIENCE_SUBLABEL,
  };
}

export async function ensureDemoEnvironment(adminClient: AnySupabaseClient): Promise<DemoEnvironmentSummary> {
  const { owner, reviewer } = await ensureDemoUsers(adminClient);

  await ensureDemoOwnerProfileSurface(adminClient, owner.id);
  await assertDemoReviewerIsNotAdmin(adminClient, reviewer.id);
  const seededAssetCount = await loadDemoSeedHealth(adminClient, owner.id);
  if (seededAssetCount < 4) {
    throw new Error("Demo environment is not prepared yet. Run scripts/setup-demo-review-access.mjs first.");
  }

  const invitationId = await ensureDemoInvitation(adminClient, owner.id);
  const contact = await syncCanonicalContact(adminClient, {
    ownerUserId: owner.id,
    fullName: DEMO_REVIEWER_NAME,
    email: DEMO_REVIEWER_EMAIL,
    phone: "0207 000 1002",
    contactRole: DEMO_REVIEWER_ROLE,
    relationship: "demo reviewer",
    sourceType: "manual",
    inviteStatus: "accepted",
    verificationStatus: "verified",
    link: {
      sourceKind: "invitation",
      sourceId: invitationId,
      sectionKey: "dashboard",
      categoryKey: "contacts",
      label: "Demo reviewer invitation",
      role: DEMO_REVIEWER_ROLE,
    },
  });

  const linkedUpdate = await adminClient
    .from("contacts")
    .update({
      linked_user_id: reviewer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contact.id)
    .eq("owner_user_id", owner.id);
  if (linkedUpdate.error) {
    throw new Error(linkedUpdate.error.message);
  }

  const invitationUpdate = await adminClient
    .from("contact_invitations")
    .update({
      contact_id: contact.id,
      contact_name: DEMO_REVIEWER_NAME,
      contact_email: DEMO_REVIEWER_EMAIL,
      assigned_role: DEMO_REVIEWER_ROLE,
      invitation_status: "accepted",
      accepted_user_id: reviewer.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("owner_user_id", owner.id);
  if (invitationUpdate.error) {
    throw new Error(invitationUpdate.error.message);
  }

  const existingGrant = await adminClient
    .from("account_access_grants")
    .select("id")
    .eq("owner_user_id", owner.id)
    .eq("linked_user_id", reviewer.id)
    .eq("assigned_role", DEMO_REVIEWER_ROLE)
    .maybeSingle();
  if (existingGrant.error) {
    throw new Error(existingGrant.error.message);
  }

  const grantPayload = {
    owner_user_id: owner.id,
    linked_user_id: reviewer.id,
    contact_id: contact.id,
    invitation_id: null,
    assigned_role: DEMO_REVIEWER_ROLE,
    relationship: "demo reviewer",
    activation_status: "active",
    permissions_override: {
      demo: true,
      read_only: true,
      environment: DEMO_ENVIRONMENT_KEY,
    },
    updated_at: new Date().toISOString(),
  };

  const grantWrite = existingGrant.data?.id
    ? await adminClient
        .from("account_access_grants")
        .update(grantPayload)
        .eq("id", existingGrant.data.id)
        .select("id")
        .single()
    : await adminClient
        .from("account_access_grants")
        .insert(grantPayload)
        .select("id")
        .single();

  if (grantWrite.error || !grantWrite.data?.id) {
    throw new Error(grantWrite.error?.message || "Could not prepare the demo linked-access grant.");
  }

  return {
    ownerUserId: owner.id,
    reviewerUserId: reviewer.id,
    contactId: contact.id,
    grantId: String(grantWrite.data.id),
    seededAssetCount,
    reviewerRole: DEMO_REVIEWER_ROLE,
  };
}

async function loadPreparedDemoEnvironment(adminClient: AnySupabaseClient): Promise<DemoEnvironmentSummary | null> {
  const demoContact = await adminClient
    .from("contacts")
    .select("id,owner_user_id,linked_user_id,contact_role")
    .eq("email", DEMO_REVIEWER_EMAIL)
    .eq("relationship", "demo reviewer")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (demoContact.error) {
    throw new Error(demoContact.error.message);
  }
  if (!demoContact.data?.id || !demoContact.data.owner_user_id || !demoContact.data.linked_user_id) {
    return null;
  }

  const [grantRes, assetCountRes] = await Promise.all([
    adminClient
      .from("account_access_grants")
      .select("id,assigned_role,activation_status")
      .eq("owner_user_id", demoContact.data.owner_user_id)
      .eq("linked_user_id", demoContact.data.linked_user_id)
      .eq("assigned_role", DEMO_REVIEWER_ROLE)
      .eq("activation_status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", demoContact.data.owner_user_id),
  ]);

  if (grantRes.error) {
    throw new Error(grantRes.error.message);
  }
  if (assetCountRes.error) {
    throw new Error(assetCountRes.error.message);
  }

  const seededAssetCount = Number(assetCountRes.count ?? 0);
  const profileReady = await hasDemoOwnerProfileSurface(adminClient, String(demoContact.data.owner_user_id));
  if (!grantRes.data?.id || seededAssetCount < 4 || !profileReady) {
    return null;
  }

  await assertDemoReviewerIsNotAdmin(adminClient, String(demoContact.data.linked_user_id));

  return {
    ownerUserId: String(demoContact.data.owner_user_id),
    reviewerUserId: String(demoContact.data.linked_user_id),
    contactId: String(demoContact.data.id),
    grantId: String(grantRes.data.id),
    seededAssetCount,
    reviewerRole: DEMO_REVIEWER_ROLE,
  };
}

export async function ensureDemoUsers(adminClient: AnySupabaseClient) {
  const owner = await ensureDemoUser(adminClient, {
    email: DEMO_OWNER_EMAIL,
    displayName: DEMO_ACCOUNT_HOLDER_NAME,
    kind: "owner",
  });
  const reviewer = await ensureDemoUser(adminClient, {
    email: DEMO_REVIEWER_EMAIL,
    displayName: DEMO_REVIEWER_NAME,
    kind: "reviewer",
  });

  return { owner, reviewer };
}

async function ensureDemoUser(
  adminClient: AnySupabaseClient,
  {
    email,
    displayName,
    kind,
  }: {
    email: string;
    displayName: string;
    kind: "owner" | "reviewer";
  },
) {
  const existing = await findAuthUserByEmail(adminClient, email);
  const metadata = {
    full_name: displayName,
    lf_demo_account: true,
    lf_demo_kind: kind,
    lf_demo_environment: DEMO_ENVIRONMENT_KEY,
  };

  if (existing) {
    const update = await adminClient.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        ...metadata,
      },
    });
    if (update.error || !update.data.user) {
      throw new Error(update.error?.message || `Could not refresh the ${kind} demo user.`);
    }
    return update.data.user;
  }

  const created = await adminClient.auth.admin.createUser({
    email,
    password: createDemoPassword(),
    email_confirm: true,
    user_metadata: metadata,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || `Could not create the ${kind} demo user.`);
  }
  return created.data.user;
}

async function assertDemoReviewerIsNotAdmin(adminClient: AnySupabaseClient, reviewerUserId: string) {
  const adminRow = await adminClient
    .from("admin_users")
    .select("id,status,is_master")
    .eq("email_normalized", normalizeDemoEmail(DEMO_REVIEWER_EMAIL))
    .maybeSingle();
  if (adminRow.error) {
    throw new Error(adminRow.error.message);
  }
  if (adminRow.data?.is_master || adminRow.data?.status === "active") {
    throw new Error("Demo reviewer is incorrectly flagged for admin access.");
  }

  const inactiveWrite = await adminClient
    .from("admin_users")
    .upsert(
      {
        email_normalized: normalizeDemoEmail(DEMO_REVIEWER_EMAIL),
        user_id: reviewerUserId,
        display_name: DEMO_REVIEWER_NAME,
        status: "inactive",
        is_master: false,
        granted_by_user_id: reviewerUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email_normalized" },
    );
  if (inactiveWrite.error) {
    throw new Error(inactiveWrite.error.message);
  }
}

async function loadDemoSeedHealth(adminClient: AnySupabaseClient, ownerUserId: string) {
  const assetCountRes = await adminClient
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ownerUserId);
  if (assetCountRes.error) {
    throw new Error(assetCountRes.error.message);
  }
  return Number(assetCountRes.count ?? 0);
}

async function hasDemoOwnerProfileSurface(adminClient: AnySupabaseClient, ownerUserId: string) {
  const [contactRes, addressRes] = await Promise.all([
    adminClient
      .from("contact_details")
      .select("secondary_email,telephone,mobile_number")
      .eq("user_id", ownerUserId)
      .maybeSingle(),
    adminClient
      .from("addresses")
      .select("house_name_or_number,street_name,city,post_code")
      .eq("user_id", ownerUserId)
      .maybeSingle(),
  ]);

  const contactReady = !contactRes.error && Boolean(
    String(contactRes.data?.secondary_email ?? "").trim()
    || String(contactRes.data?.telephone ?? "").trim()
    || String(contactRes.data?.mobile_number ?? "").trim(),
  );
  const addressReady = !addressRes.error && Boolean(
    String(addressRes.data?.house_name_or_number ?? "").trim()
    || String(addressRes.data?.street_name ?? "").trim()
    || String(addressRes.data?.city ?? "").trim()
    || String(addressRes.data?.post_code ?? "").trim(),
  );

  return contactReady && addressReady;
}

async function ensureDemoOwnerProfileSurface(adminClient: AnySupabaseClient, ownerUserId: string) {
  const now = new Date().toISOString();

  const [contactWrite, addressWrite] = await Promise.all([
    adminClient.from("contact_details").upsert({
      user_id: ownerUserId,
      secondary_email: DEMO_OWNER_EMAIL,
      telephone: "01904 555204",
      mobile_number: "07700 900210",
      updated_at: now,
    }, { onConflict: "user_id" }),
    adminClient.from("addresses").upsert({
      user_id: ownerUserId,
      house_name_or_number: "14",
      street_name: "Orchard Lane",
      town: "York",
      city: "York",
      country: "United Kingdom",
      post_code: "YO1 2AB",
      updated_at: now,
    }, { onConflict: "user_id" }),
  ]);

  if (contactWrite.error) {
    throw new Error(contactWrite.error.message);
  }
  if (addressWrite.error) {
    throw new Error(addressWrite.error.message);
  }
}

async function ensureDemoInvitation(adminClient: AnySupabaseClient, ownerUserId: string) {
  const invitation = await adminClient
    .from("contact_invitations")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("contact_email", DEMO_REVIEWER_EMAIL)
    .eq("assigned_role", DEMO_REVIEWER_ROLE)
    .in("invitation_status", ["pending", "accepted"])
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invitation.error) {
    throw new Error(invitation.error.message);
  }

  const now = new Date().toISOString();
  const invitationWrite = invitation.data?.id
    ? await adminClient
        .from("contact_invitations")
        .update({
          contact_name: DEMO_REVIEWER_NAME,
          contact_email: DEMO_REVIEWER_EMAIL,
          assigned_role: DEMO_REVIEWER_ROLE,
          invitation_status: "accepted",
          sent_at: now,
          last_sent_at: now,
          accepted_at: now,
          updated_at: now,
        })
        .eq("id", invitation.data.id)
        .eq("owner_user_id", ownerUserId)
        .select("id")
        .single()
    : await adminClient
        .from("contact_invitations")
        .insert({
          owner_user_id: ownerUserId,
          contact_name: DEMO_REVIEWER_NAME,
          contact_email: DEMO_REVIEWER_EMAIL,
          assigned_role: DEMO_REVIEWER_ROLE,
          invitation_status: "accepted",
          invited_at: now,
          sent_at: now,
          last_sent_at: now,
          accepted_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
  if (invitationWrite.error || !invitationWrite.data?.id) {
    throw new Error(invitationWrite.error?.message || "Could not prepare the demo invitation.");
  }

  const roleAssignment = await adminClient
    .from("role_assignments")
    .upsert(
      {
        owner_user_id: ownerUserId,
        invitation_id: invitationWrite.data.id,
        assigned_role: DEMO_REVIEWER_ROLE,
        activation_status: "active",
        permissions_override: {
          demo: true,
          read_only: true,
          environment: DEMO_ENVIRONMENT_KEY,
        },
        updated_at: now,
      },
      { onConflict: "invitation_id" },
    );
  if (roleAssignment.error) {
    throw new Error(roleAssignment.error.message);
  }

  return String(invitationWrite.data.id);
}

async function findAuthUserByEmail(adminClient: AnySupabaseClient, email: string): Promise<User | null> {
  const normalized = normalizeDemoEmail(email);
  let page = 1;
  while (page <= 20) {
    const result = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) {
      throw new Error(result.error.message);
    }
    const found = result.data.users.find((candidate) => normalizeDemoEmail(candidate.email) === normalized) ?? null;
    if (found) return found;
    if (result.data.users.length < 200) break;
    page += 1;
  }
  return null;
}

function createDemoPassword() {
  return `LfDemo!${crypto.randomBytes(12).toString("hex")}`;
}

function resolveDemoRedirectOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (isLocal && url.port && url.port !== "3000") {
      url.port = "3000";
      return url.origin;
    }
    return url.origin;
  } catch {
    return origin;
  }
}
