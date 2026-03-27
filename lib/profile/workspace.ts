import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError, isMissingRelationError } from "../supabaseErrors";
import { maskNationalInsuranceNumber } from "../security/identity";
import { normalizePhone, normalizePostCode, sanitizeAddress, sanitizeName } from "../validation/profile";
import { sanitizeFileName } from "../validation/upload";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS } from "../assets/fieldDictionary";

type AnySupabaseClient = SupabaseClient;

export type ProfileWorkspaceForm = {
  avatar_path: string;
  first_name: string;
  last_name: string;
  display_name: string;
  primary_email: string;
  secondary_email: string;
  telephone: string;
  mobile_number: string;
  house_name_or_number: string;
  street_name: string;
  town: string;
  city: string;
  country: string;
  country_other: string;
  post_code: string;
  date_of_birth: string;
  about: string;
  notification_email: string;
  preferred_currency: string;
  language: string;
  language_other: string;
  ni_input: string;
};

export type ProfileWorkspaceSupport = {
  avatarPathSupported: boolean;
  firstNameSupported: boolean;
  lastNameSupported: boolean;
};

export type LoadedProfileWorkspace = {
  form: ProfileWorkspaceForm;
  maskedNi: string;
  avatarPreviewUrl: string;
  avatarBucket: string;
  support: ProfileWorkspaceSupport;
  notice: string;
};

export type ProfileIdentityChip = {
  displayName: string;
  avatarUrl: string;
  telephone: string;
};

export function resolveProfileIdentityDisplayName(profileDisplayName: string | null | undefined, email: string) {
  return profileDisplayName?.trim() || email.split("@")[0] || "Secure Account";
}

export function buildProfileAvatarStoragePath(userId: string, fileName: string, now = Date.now()) {
  return `${userId}/avatar-${now}-${sanitizeFileName(fileName)}`;
}

export const EMPTY_PROFILE_FORM: ProfileWorkspaceForm = {
  avatar_path: "",
  first_name: "",
  last_name: "",
  display_name: "",
  primary_email: "",
  secondary_email: "",
  telephone: "",
  mobile_number: "",
  house_name_or_number: "",
  street_name: "",
  town: "",
  city: "",
  country: "",
  country_other: "",
  post_code: "",
  date_of_birth: "",
  about: "",
  notification_email: "",
  preferred_currency: "GBP",
  language: "English",
  language_other: "",
  ni_input: "",
};

export const PROFILE_LANGUAGE_OPTIONS = [
  { label: "English", value: "English" },
  { label: "Welsh", value: "Welsh" },
  { label: "French", value: "French" },
  { label: "German", value: "German" },
  { label: "Spanish", value: "Spanish" },
  { label: "Other", value: "__other" },
];

export const PROFILE_CURRENCY_OPTIONS = CURRENCY_OPTIONS.filter((option) => option.value !== "__other");
export const AVATAR_BUCKET_CANDIDATES = ["avatars", "vault-docs"] as const;

export async function loadProfileWorkspace(
  client: AnySupabaseClient,
  {
    userId,
    baseEmail,
  }: {
    userId: string;
    baseEmail: string;
  },
): Promise<LoadedProfileWorkspace> {
  const profileWithAll = await client
    .from("user_profiles")
    .select("first_name,last_name,display_name,date_of_birth,about,notification_email,preferred_currency,language,avatar_path")
    .eq("user_id", userId)
    .maybeSingle();

  const missingAvatarPath = isMissingAvatarPathError(profileWithAll.error);
  const missingFirstName = isMissingColumnError(profileWithAll.error, "first_name");
  const missingLastName = isMissingColumnError(profileWithAll.error, "last_name");

  let profileRes = profileWithAll;
  if (missingAvatarPath || missingFirstName || missingLastName) {
    const selectColumns = [
      !missingFirstName ? "first_name" : null,
      !missingLastName ? "last_name" : null,
      "display_name",
      "date_of_birth",
      "about",
      "notification_email",
      "preferred_currency",
      "language",
      !missingAvatarPath ? "avatar_path" : null,
    ]
      .filter(Boolean)
      .join(",");

    profileRes = await client
      .from("user_profiles")
      .select(selectColumns)
      .eq("user_id", userId)
      .maybeSingle();
  }

  const [contactRes, addressRes, sensitiveRes] = await Promise.all([
    client
      .from("contact_details")
      .select("secondary_email,telephone,mobile_number")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("addresses")
      .select("house_name_or_number,street_name,town,city,country,post_code")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("identity_sensitive_data")
      .select("masked_ni_number")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const profile = (profileRes.data ?? {}) as {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    date_of_birth?: string | null;
    about?: string | null;
    notification_email?: string | null;
    preferred_currency?: string | null;
    language?: string | null;
    avatar_path?: string | null;
  };

  const contact = (contactRes.data ?? {}) as {
    secondary_email?: string | null;
    telephone?: string | null;
    mobile_number?: string | null;
  };

  const address = (addressRes.data ?? {}) as {
    house_name_or_number?: string | null;
    street_name?: string | null;
    town?: string | null;
    city?: string | null;
    country?: string | null;
    post_code?: string | null;
  };

  const splitName = splitDisplayName(profile.display_name);
  const countryValue = mapSelectValue(address.country, COUNTRY_OPTIONS);
  const languageValue = mapSelectValue(profile.language, PROFILE_LANGUAGE_OPTIONS);
  const avatar = profile.avatar_path ? await getProfileAvatarPreview(client, profile.avatar_path) : null;
  const resolvedPrimaryEmail =
    baseEmail
    || String(profile.notification_email ?? "").trim()
    || String(contact.secondary_email ?? "").trim();

  let notice = "";
  if (isMissingRelationError(contactRes.error, "contact_details")) {
    notice = "Profile loaded. Contact details table is not available in this environment.";
  } else if (isMissingRelationError(addressRes.error, "addresses")) {
    notice = "Profile loaded. Address table is not available in this environment.";
  }

  return {
    form: {
      avatar_path: profile.avatar_path ?? "",
      first_name: missingFirstName ? splitName.first : (profile.first_name ?? ""),
      last_name: missingLastName ? splitName.last : (profile.last_name ?? ""),
      display_name: profile.display_name ?? "",
      primary_email: resolvedPrimaryEmail,
      secondary_email: contact.secondary_email ?? "",
      telephone: contact.telephone ?? "",
      mobile_number: contact.mobile_number ?? "",
      house_name_or_number: address.house_name_or_number ?? "",
      street_name: address.street_name ?? "",
      town: address.town ?? "",
      city: address.city ?? "",
      country: countryValue.selected,
      country_other: countryValue.other,
      post_code: address.post_code ?? "",
      date_of_birth: profile.date_of_birth ?? "",
      about: profile.about ?? "",
      notification_email: profile.notification_email ?? resolvedPrimaryEmail,
      preferred_currency: profile.preferred_currency ?? "GBP",
      language: languageValue.selected || "English",
      language_other: languageValue.other,
      ni_input: "",
    },
    maskedNi: (sensitiveRes.data as { masked_ni_number?: string | null } | null)?.masked_ni_number ?? "Not set",
    avatarPreviewUrl: avatar?.signedUrl ?? "",
    avatarBucket: avatar?.bucket ?? "",
    support: {
      avatarPathSupported: !missingAvatarPath,
      firstNameSupported: !missingFirstName,
      lastNameSupported: !missingLastName,
    },
    notice,
  };
}

export async function loadProfileIdentityChip(
  client: AnySupabaseClient,
  {
    userId,
    email,
  }: {
    userId: string;
    email: string;
  },
): Promise<ProfileIdentityChip> {
  const profileWithAll = await client
    .from("user_profiles")
    .select("display_name,avatar_path")
    .eq("user_id", userId)
    .maybeSingle();

  let profileRes = profileWithAll;
  if (isMissingAvatarPathError(profileWithAll.error)) {
    profileRes = await client
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
  }

  if (profileRes.error && !isMissingRelationError(profileRes.error, "user_profiles")) {
    throw new Error(profileRes.error.message);
  }

  const profile = (profileRes.data ?? null) as { display_name?: string | null; avatar_path?: string | null } | null;
  const displayName = resolveProfileIdentityDisplayName(profile?.display_name, email);
  const avatar = profile?.avatar_path ? await getProfileAvatarPreview(client, profile.avatar_path) : null;
  const contactRes = await client
    .from("contact_details")
    .select("telephone,mobile_number")
    .eq("user_id", userId)
    .maybeSingle();
  const contact = (!contactRes.error ? (contactRes.data ?? null) : null) as {
    telephone?: string | null;
    mobile_number?: string | null;
  } | null;

  return {
    displayName,
    avatarUrl: avatar?.signedUrl ?? "",
    telephone: String(contact?.telephone ?? contact?.mobile_number ?? "").trim(),
  };
}

export async function saveProfileWorkspace(
  client: AnySupabaseClient,
  {
    userId,
    form,
    support,
  }: {
    userId: string;
    form: ProfileWorkspaceForm;
    support: ProfileWorkspaceSupport;
  },
) {
  const now = new Date().toISOString();
  const normalizedFirstName = sanitizeName(form.first_name) || "";
  const normalizedLastName = sanitizeName(form.last_name) || "";
  const normalizedDisplayName = form.display_name.trim() || [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ").trim() || null;
  const resolvedCountry = sanitizeAddress(resolveSelectValue(form.country, form.country_other)) || null;
  const resolvedLanguage = resolveSelectValue(form.language, form.language_other) || "English";

  if (!normalizedFirstName || !normalizedLastName) {
    throw new Error("First name and last name are required.");
  }
  if (!form.primary_email.trim()) {
    throw new Error("Primary email is required.");
  }

  const profilePayload: Record<string, string | null> = {
    user_id: userId,
    display_name: normalizedDisplayName,
    date_of_birth: form.date_of_birth || null,
    about: form.about.trim() || null,
    notification_email: form.notification_email.trim() || form.primary_email,
    preferred_currency: form.preferred_currency || "GBP",
    language: resolvedLanguage,
    updated_at: now,
  };
  if (support.firstNameSupported) profilePayload.first_name = normalizedFirstName || null;
  if (support.lastNameSupported) profilePayload.last_name = normalizedLastName || null;
  if (support.avatarPathSupported) profilePayload.avatar_path = form.avatar_path || null;

  const contactPayload = {
    user_id: userId,
    secondary_email: form.secondary_email.trim() || null,
    telephone: normalizePhone(form.telephone) || null,
    mobile_number: normalizePhone(form.mobile_number) || null,
    updated_at: now,
  };

  const addressPayload = {
    user_id: userId,
    house_name_or_number: sanitizeAddress(form.house_name_or_number) || null,
    street_name: sanitizeAddress(form.street_name) || null,
    town: sanitizeAddress(form.town) || null,
    city: sanitizeAddress(form.city) || null,
    country: resolvedCountry,
    post_code: normalizePostCode(form.post_code) || null,
    updated_at: now,
  };

  const profileWritePayload = { ...profilePayload };
  let profileRes = await client.from("user_profiles").upsert(profileWritePayload, { onConflict: "user_id" });
  const [contactRes, addressRes] = await Promise.all([
    client.from("contact_details").upsert(contactPayload, { onConflict: "user_id" }),
    client.from("addresses").upsert(addressPayload, { onConflict: "user_id" }),
  ]);

  if (isMissingAvatarPathError(profileRes.error)) {
    support.avatarPathSupported = false;
    delete profileWritePayload.avatar_path;
    profileRes = await client.from("user_profiles").upsert(profileWritePayload, { onConflict: "user_id" });
  }
  if (isMissingColumnError(profileRes.error, "first_name")) {
    support.firstNameSupported = false;
    delete profileWritePayload.first_name;
    profileRes = await client.from("user_profiles").upsert(profileWritePayload, { onConflict: "user_id" });
  }
  if (isMissingColumnError(profileRes.error, "last_name")) {
    support.lastNameSupported = false;
    delete profileWritePayload.last_name;
    profileRes = await client.from("user_profiles").upsert(profileWritePayload, { onConflict: "user_id" });
  }

  const contactTableMissing = isMissingRelationError(contactRes.error, "contact_details");
  const addressTableMissing = isMissingRelationError(addressRes.error, "addresses");
  if (profileRes.error || (contactRes.error && !contactTableMissing) || (addressRes.error && !addressTableMissing)) {
    throw new Error(profileRes.error?.message || contactRes.error?.message || addressRes.error?.message);
  }

  let maskedNi = "Not set";
  if (form.ni_input.trim()) {
    const rpcRes = await client.rpc("set_identity_sensitive_data", {
      p_ni_number: form.ni_input.trim(),
    });
    if (rpcRes.error) {
      throw new Error(rpcRes.error.message);
    }
    maskedNi = maskNationalInsuranceNumber(form.ni_input);
  }

  return {
    support,
    maskedNi,
    status: contactTableMissing || addressTableMissing
      ? "Core profile saved. Contact/address tables are unavailable in this environment."
      : "Profile saved",
  };
}

export async function uploadProfileAvatarFile(
  client: AnySupabaseClient,
  {
    userId,
    file,
  }: {
    userId: string;
    file: File;
  },
) {
  const path = buildProfileAvatarStoragePath(userId, file.name);

  let chosenBucket = "";
  let uploadError = "";
  const attemptedBuckets: string[] = [];
  for (const bucket of AVATAR_BUCKET_CANDIDATES) {
    attemptedBuckets.push(bucket);
    const upload = await client.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (!upload.error) {
      chosenBucket = bucket;
      break;
    }
    uploadError = upload.error.message;
    if (!upload.error.message.toLowerCase().includes("bucket not found")) {
      throw new Error(`Avatar upload failed for bucket ${bucket}: ${upload.error.message}`);
    }
  }

  if (!chosenBucket) {
    throw new Error(uploadError || "No valid storage bucket is configured for avatars.");
  }

  const signed = await client.storage.from(chosenBucket).createSignedUrl(path, 3600);
  return {
    path,
    bucket: chosenBucket,
    previewUrl: signed.data?.signedUrl ?? "",
    attemptedBuckets,
  };
}

export async function removeProfileAvatarFile(
  client: AnySupabaseClient,
  {
    path,
    avatarBucket,
  }: {
    path: string;
    avatarBucket: string;
  },
) {
  const bucketsToTry = avatarBucket
    ? [avatarBucket, ...AVATAR_BUCKET_CANDIDATES.filter((bucket) => bucket !== avatarBucket)]
    : [...AVATAR_BUCKET_CANDIDATES];

  for (const bucket of bucketsToTry) {
    const remove = await client.storage.from(bucket).remove([path]);
    if (!remove.error) return;
  }

  throw new Error("Avatar file could not be removed from storage.");
}

export async function getProfileAvatarPreview(client: AnySupabaseClient, path: string) {
  for (const bucket of AVATAR_BUCKET_CANDIDATES) {
    const signed = await client.storage.from(bucket).createSignedUrl(path, 3600);
    if (!signed.error && signed.data?.signedUrl) {
      return { bucket, signedUrl: signed.data.signedUrl } as const;
    }
  }
  return null;
}

function isMissingAvatarPathError(error: { message?: string } | null) {
  return isMissingColumnError(error, "avatar_path");
}

function splitDisplayName(name: string | null | undefined) {
  const safe = (name ?? "").trim();
  if (!safe) return { first: "", last: "" };
  const parts = safe.split(/\s+/);
  return {
    first: parts[0] ?? "",
    last: parts.slice(1).join(" "),
  };
}

function mapSelectValue(value: string | null | undefined, options: Array<{ value: string }>) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return { selected: "", other: "" };
  return options.some((option) => option.value === normalized)
    ? { selected: normalized, other: "" }
    : { selected: "__other", other: normalized };
}

function resolveSelectValue(selected: string, other: string) {
  return selected === "__other" ? other.trim() : selected.trim();
}
