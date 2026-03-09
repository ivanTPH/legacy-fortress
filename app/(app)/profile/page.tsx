"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Field,
  SettingsCard,
  SettingsPageShell,
  StatusNote,
  ghostBtn,
  gridStyle,
  inputStyle,
  primaryBtn,
  textAreaStyle,
} from "../components/settings/SettingsPrimitives";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { isMissingColumnError, isMissingRelationError } from "../../../lib/supabaseErrors";
import { maskNationalInsuranceNumber } from "../../../lib/security/identity";
import { normalizePhone, normalizePostCode, sanitizeAddress, sanitizeName } from "../../../lib/validation/profile";
import { sanitizeFileName, validateUploadFile } from "../../../lib/validation/upload";

type ProfileForm = {
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
  post_code: string;
  date_of_birth: string;
  about: string;
  notification_email: string;
  preferred_currency: string;
  language: string;
  ni_input: string;
};

const EMPTY: ProfileForm = {
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
  post_code: "",
  date_of_birth: "",
  about: "",
  notification_email: "",
  preferred_currency: "GBP",
  language: "English",
  ni_input: "",
};

function isMissingAvatarPathError(error: { message?: string } | null) {
  return isMissingColumnError(error, "avatar_path");
}

const AVATAR_BUCKET_CANDIDATES = ["vault-docs", "avatars"] as const;

async function getAvatarPreview(path: string) {
  for (const bucket of AVATAR_BUCKET_CANDIDATES) {
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (!signed.error && signed.data?.signedUrl) {
      return { bucket, signedUrl: signed.data.signedUrl } as const;
    }
  }
  return null;
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

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [maskedNi, setMaskedNi] = useState("Not set");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPathSupported, setAvatarPathSupported] = useState(true);
  const [avatarBucket, setAvatarBucket] = useState<string>("");
  const [firstNameSupported, setFirstNameSupported] = useState(true);
  const [lastNameSupported, setLastNameSupported] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      try {
        const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
        if (!user) {
          router.replace("/signin");
          return;
        }

        const baseEmail = user.email ?? "";

        const profileWithAll = await supabase
          .from("user_profiles")
          .select("first_name,last_name,display_name,date_of_birth,about,notification_email,preferred_currency,language,avatar_path")
          .eq("user_id", user.id)
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

          profileRes = await supabase
            .from("user_profiles")
            .select(selectColumns)
            .eq("user_id", user.id)
            .maybeSingle();
        }

        setAvatarPathSupported(!missingAvatarPath);
        setFirstNameSupported(!missingFirstName);
        setLastNameSupported(!missingLastName);

        const [contactRes, addressRes, sensitiveRes] = await Promise.all([
          supabase
            .from("contact_details")
            .select("secondary_email,telephone,mobile_number")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("addresses")
            .select("house_name_or_number,street_name,town,city,country,post_code")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("identity_sensitive_data")
            .select("masked_ni_number")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (!mounted) return;

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

        const splitName = splitDisplayName(profile.display_name);
        const resolvedFirstName = missingFirstName
          ? splitName.first
          : (profile.first_name ?? "");
        const resolvedLastName = missingLastName
          ? splitName.last
          : (profile.last_name ?? "");

        if (isMissingRelationError(contactRes.error, "contact_details")) {
          setStatus("Profile loaded. Contact details table is not available in this environment.");
        }
        if (isMissingRelationError(addressRes.error, "addresses")) {
          setStatus("Profile loaded. Address table is not available in this environment.");
        }

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

        setForm({
          avatar_path: profile.avatar_path ?? "",
          first_name: resolvedFirstName,
          last_name: resolvedLastName,
          display_name: profile.display_name ?? "",
          primary_email: baseEmail,
          secondary_email: contact.secondary_email ?? "",
          telephone: contact.telephone ?? "",
          mobile_number: contact.mobile_number ?? "",
          house_name_or_number: address.house_name_or_number ?? "",
          street_name: address.street_name ?? "",
          town: address.town ?? "",
          city: address.city ?? "",
          country: address.country ?? "",
          post_code: address.post_code ?? "",
          date_of_birth: profile.date_of_birth ?? "",
          about: profile.about ?? "",
          notification_email: profile.notification_email ?? baseEmail,
          preferred_currency: profile.preferred_currency ?? "GBP",
          language: profile.language ?? "English",
          ni_input: "",
        });

        const maskedFromDb = (sensitiveRes.data as { masked_ni_number?: string | null } | null)?.masked_ni_number;
        setMaskedNi(maskedFromDb ?? "Not set");

        if (profile.avatar_path) {
          const avatar = await getAvatarPreview(profile.avatar_path);
          if (avatar && mounted) {
            setAvatarPreviewUrl(avatar.signedUrl);
            setAvatarBucket(avatar.bucket);
          } else if (mounted) {
            setAvatarPreviewUrl("");
            setAvatarBucket("");
          }
        } else if (mounted) {
          setAvatarPreviewUrl("");
          setAvatarBucket("");
        }
      } catch (error) {
        if (!mounted) return;
        setStatus(`⚠️ Could not load profile settings: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const canSave = useMemo(() => !loading && !saving && !avatarUploading, [loading, saving, avatarUploading]);

  async function save() {
    setSaving(true);
    setStatus("");

    try {
      const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
      if (!user) {
        router.replace("/signin");
        return;
      }

      const now = new Date().toISOString();
      const normalizedFirstName = sanitizeName(form.first_name) || "";
      const normalizedLastName = sanitizeName(form.last_name) || "";
      const normalizedDisplayName = form.display_name.trim() || [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ").trim() || null;

      const profilePayload: Record<string, string | null> = {
        user_id: user.id,
        display_name: normalizedDisplayName,
        date_of_birth: form.date_of_birth || null,
        about: form.about.trim() || null,
        notification_email: form.notification_email.trim() || form.primary_email,
        preferred_currency: form.preferred_currency || "GBP",
        language: form.language || "English",
        updated_at: now,
      };
      if (firstNameSupported) {
        profilePayload.first_name = normalizedFirstName || null;
      }
      if (lastNameSupported) {
        profilePayload.last_name = normalizedLastName || null;
      }
      if (avatarPathSupported) {
        profilePayload.avatar_path = form.avatar_path || null;
      }

      const contactPayload = {
        user_id: user.id,
        secondary_email: form.secondary_email.trim() || null,
        telephone: normalizePhone(form.telephone) || null,
        mobile_number: normalizePhone(form.mobile_number) || null,
        updated_at: now,
      };

      const addressPayload = {
        user_id: user.id,
        house_name_or_number: sanitizeAddress(form.house_name_or_number) || null,
        street_name: sanitizeAddress(form.street_name) || null,
        town: sanitizeAddress(form.town) || null,
        city: sanitizeAddress(form.city) || null,
        country: sanitizeAddress(form.country) || null,
        post_code: normalizePostCode(form.post_code) || null,
        updated_at: now,
      };

      const profileWritePayload = { ...profilePayload };
      let profileRes = await supabase.from("user_profiles").upsert(profileWritePayload, { onConflict: "user_id" });
      const [contactRes, addressRes] = await Promise.all([
        supabase.from("contact_details").upsert(contactPayload, { onConflict: "user_id" }),
        supabase.from("addresses").upsert(addressPayload, { onConflict: "user_id" }),
      ]);

      if (isMissingAvatarPathError(profileRes.error)) {
        setAvatarPathSupported(false);
        delete profileWritePayload.avatar_path;
        profileRes = await supabase.from("user_profiles").upsert(profileWritePayload, { onConflict: "user_id" });
      }
      if (isMissingColumnError(profileRes.error, "first_name")) {
        setFirstNameSupported(false);
        delete profileWritePayload.first_name;
        profileRes = await supabase.from("user_profiles").upsert(profileWritePayload, { onConflict: "user_id" });
      }
      if (isMissingColumnError(profileRes.error, "last_name")) {
        setLastNameSupported(false);
        delete profileWritePayload.last_name;
        profileRes = await supabase.from("user_profiles").upsert(profileWritePayload, { onConflict: "user_id" });
      }

      const contactTableMissing = isMissingRelationError(contactRes.error, "contact_details");
      const addressTableMissing = isMissingRelationError(addressRes.error, "addresses");

      if (profileRes.error || (contactRes.error && !contactTableMissing) || (addressRes.error && !addressTableMissing)) {
        throw new Error(profileRes.error?.message || contactRes.error?.message || addressRes.error?.message);
      }

      if (form.ni_input.trim()) {
        const rpcRes = await supabase.rpc("set_identity_sensitive_data", {
          p_ni_number: form.ni_input.trim(),
        });

        if (rpcRes.error) {
          throw new Error(rpcRes.error.message);
        }

        setMaskedNi(maskNationalInsuranceNumber(form.ni_input));
        setForm((current) => ({ ...current, ni_input: "" }));
      }

      if (contactTableMissing || addressTableMissing) {
        setStatus("✅ Core profile saved. Contact/address tables are unavailable in this environment.");
      } else {
        setStatus("✅ Profile saved");
      }
    } catch (error) {
      setStatus(`❌ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function onUploadAvatar(file: File) {
    const validation = validateUploadFile(file, {
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      maxBytes: 2 * 1024 * 1024,
    });
    if (!validation.ok) {
      setStatus(`❌ ${validation.error}. Allowed: PNG, JPG, WebP. Max: 2MB.`);
      return;
    }

    setAvatarUploading(true);
    setStatus("");

    try {
      const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
      if (!user) {
        router.replace("/signin");
        return;
      }

      const safeName = sanitizeFileName(file.name);
      const path = `profiles/${user.id}/avatar-${Date.now()}-${safeName}`;

      let chosenBucket = "";
      let uploadError = "";
      for (const bucket of AVATAR_BUCKET_CANDIDATES) {
        const upload = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });
        if (!upload.error) {
          chosenBucket = bucket;
          break;
        }
        uploadError = upload.error.message;
        if (!upload.error.message.toLowerCase().includes("bucket not found")) {
          throw upload.error;
        }
      }

      if (!chosenBucket) {
        throw new Error(uploadError || "No valid storage bucket is configured for avatars.");
      }

      const signed = await supabase.storage.from(chosenBucket).createSignedUrl(path, 3600);
      setAvatarPreviewUrl(signed.data?.signedUrl ?? "");
      setAvatarBucket(chosenBucket);
      setForm((current) => ({ ...current, avatar_path: path }));
      setStatus("✅ Profile picture uploaded. Save profile to persist.");
    } catch (error) {
      setStatus(`❌ Profile picture upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    if (!form.avatar_path) return;

    try {
      const bucketsToTry = avatarBucket
        ? [avatarBucket, ...AVATAR_BUCKET_CANDIDATES.filter((bucket) => bucket !== avatarBucket)]
        : [...AVATAR_BUCKET_CANDIDATES];

      let removed = false;
      for (const bucket of bucketsToTry) {
        const remove = await supabase.storage.from(bucket).remove([form.avatar_path]);
        if (!remove.error) {
          removed = true;
          break;
        }
      }

      if (!removed) {
        throw new Error("Avatar file could not be removed from storage.");
      }
      setForm((current) => ({ ...current, avatar_path: "" }));
      setAvatarPreviewUrl("");
      setAvatarBucket("");
      setStatus("✅ Profile picture removed. Save profile to persist.");
    } catch (error) {
      setStatus(`❌ Could not remove profile picture: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const sendPasswordReset = async () => {
    if (!form.primary_email) {
      setStatus("❌ Signed-in email is required.");
      return;
    }

    const redirectTo = "https://legacy-fortress-web.vercel.app/reset-password";
    const { error } = await supabase.auth.resetPasswordForEmail(form.primary_email, { redirectTo });
    setStatus(error ? `❌ Password reset failed: ${error.message}` : "✅ Password reset email sent");
  };

  return (
    <SettingsPageShell
      title="Profile"
      subtitle="Manage your identity, contact information, address details, and account profile settings."
    >
      <SettingsCard title="Saved profile summary" description="Your current saved details appear here first.">
        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading saved profile...</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  background: "#f8fafc",
                  display: "grid",
                  placeItems: "center",
                  color: "#6b7280",
                  fontSize: 12,
                }}
              >
                {avatarPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreviewUrl} alt="Saved profile picture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  "No picture"
                )}
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {[form.first_name, form.last_name].filter(Boolean).join(" ").trim() || form.display_name || "No name saved"}
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>{form.primary_email || "No email saved"}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {[form.house_name_or_number, form.street_name, form.town, form.city, form.post_code, form.country]
                    .filter(Boolean)
                    .join(", ") || "No address saved"}
                </div>
              </div>
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Phone: {form.mobile_number || form.telephone || "Not set"} · Notification email: {form.notification_email || "Not set"}
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>National Insurance: {maskedNi}</div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Identity and profile picture" description="Primary email is your verified sign-in identity.">
        {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              background: "#f8fafc",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            {avatarPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreviewUrl} alt="Profile picture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              "No picture"
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
              Upload picture
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void onUploadAvatar(file);
                  }
                  event.currentTarget.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
            <button type="button" style={ghostBtn} onClick={removeAvatar}>
              Delete picture
            </button>
          </div>
        </div>

        <div style={gridStyle}>
          <Field label="First name">
            <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Last name">
            <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Display name">
            <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Date of birth">
            <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} style={inputStyle} />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="Contact details" description="Add secondary contact channels for executor communication.">
        <div style={gridStyle}>
          <Field label="Primary email (verified)">
            <input value={form.primary_email} style={{ ...inputStyle, background: "#f9fafb" }} disabled />
          </Field>
          <Field label="Second email address">
            <input
              type="email"
              value={form.secondary_email}
              onChange={(e) => setForm({ ...form, secondary_email: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Telephone number">
            <input
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: normalizePhone(e.target.value) })}
              style={inputStyle}
            />
          </Field>
          <Field label="Mobile number">
            <input
              value={form.mobile_number}
              onChange={(e) => setForm({ ...form, mobile_number: normalizePhone(e.target.value) })}
              style={inputStyle}
            />
          </Field>
          <Field label="Notification email">
            <input
              type="email"
              value={form.notification_email}
              onChange={(e) => setForm({ ...form, notification_email: e.target.value })}
              style={inputStyle}
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="Address" description="Store current address details for profile and legal references.">
        <div style={gridStyle}>
          <Field label="House name or number">
            <input
              value={form.house_name_or_number}
              onChange={(e) => setForm({ ...form, house_name_or_number: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Street name">
            <input value={form.street_name} onChange={(e) => setForm({ ...form, street_name: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Town">
            <input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Country">
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Post code">
            <input
              value={form.post_code}
              onChange={(e) => setForm({ ...form, post_code: normalizePostCode(e.target.value) })}
              style={inputStyle}
              placeholder="SW1A 1AA"
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="Sensitive identity" description="National Insurance number is masked in UI and encrypted at rest.">
        <div style={gridStyle}>
          <Field label="Current NI number">
            <input value={maskedNi} style={{ ...inputStyle, background: "#f9fafb" }} disabled />
          </Field>
          <Field label="Update NI number">
            <input
              value={form.ni_input}
              onChange={(e) => setForm({ ...form, ni_input: e.target.value.toUpperCase() })}
              style={inputStyle}
              placeholder="QQ 12 34 56 C"
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="Preferences and account" description="Account-level defaults for language and valuation display.">
        <div style={gridStyle}>
          <Field label="Preferred currency">
            <select value={form.preferred_currency} onChange={(e) => setForm({ ...form, preferred_currency: e.target.value })} style={inputStyle}>
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
          <Field label="Language">
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} style={inputStyle}>
              <option value="English">English</option>
              <option value="Welsh">Welsh</option>
              <option value="French">French</option>
            </select>
          </Field>
        </div>

        <Field label="About">
          <textarea
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
            style={textAreaStyle}
            placeholder="Optional account context"
          />
        </Field>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" disabled={!canSave} style={primaryBtn} onClick={() => void save()}>
            {saving ? "Saving..." : "Save profile"}
          </button>
          <button type="button" style={ghostBtn} onClick={() => void sendPasswordReset()}>
            Send password reset
          </button>
          <StatusNote message={status} />
        </div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          For password change, recovery options, and mobile verification controls, open Security settings.
        </div>
      </SettingsCard>
    </SettingsPageShell>
  );
}
