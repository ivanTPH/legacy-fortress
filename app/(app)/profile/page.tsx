"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SettingsCard,
  SettingsPageShell,
  StatusNote,
  ghostBtn,
  gridStyle,
  primaryBtn,
} from "../components/settings/SettingsPrimitives";
import {
  COUNTRY_OPTIONS,
} from "../../../lib/assets/fieldDictionary";
import {
  DateInput,
  FileDropzone,
  FormField,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "../../../components/forms/asset/AssetFormControls";
import Icon from "../../../components/ui/Icon";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { validateUploadFile } from "../../../lib/validation/upload";
import {
  EMPTY_PROFILE_FORM,
  PROFILE_CURRENCY_OPTIONS,
  PROFILE_LANGUAGE_OPTIONS,
  loadProfileWorkspace,
  removeProfileAvatarFile,
  saveProfileWorkspace,
  uploadProfileAvatarFile,
  type ProfileWorkspaceForm,
  type ProfileWorkspaceSupport,
} from "../../../lib/profile/workspace";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<ProfileWorkspaceForm>(EMPTY_PROFILE_FORM);
  const [support, setSupport] = useState<ProfileWorkspaceSupport>({
    avatarPathSupported: true,
    firstNameSupported: true,
    lastNameSupported: true,
  });
  const [maskedNi, setMaskedNi] = useState("Not set");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarBucket, setAvatarBucket] = useState<string>("");
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreviewUrl, setPendingAvatarPreviewUrl] = useState("");
  const [avatarPathToDelete, setAvatarPathToDelete] = useState("");
  const [profileReviewConfirmed, setProfileReviewConfirmed] = useState(false);

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

        const loaded = await loadProfileWorkspace(supabase, {
          userId: user.id,
          baseEmail: user.email ?? "",
        });
        if (!mounted) return;
        setForm(loaded.form);
        setMaskedNi(loaded.maskedNi);
        setAvatarPreviewUrl(loaded.avatarPreviewUrl);
        setAvatarBucket(loaded.avatarBucket);
        setSupport(loaded.support);
        setPendingAvatarFile(null);
        setProfileReviewConfirmed(false);
        if (loaded.notice) setStatus(loaded.notice);
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

  useEffect(() => {
    if (!pendingAvatarFile) {
      setPendingAvatarPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(pendingAvatarFile);
    setPendingAvatarPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pendingAvatarFile]);

  const canSave = useMemo(() => !loading && !saving && !avatarUploading, [loading, saving, avatarUploading]);
  const displayedAvatarUrl = pendingAvatarPreviewUrl || avatarPreviewUrl;
  const hasPendingProfileMediaChange = Boolean(pendingAvatarFile || avatarPathToDelete);

  async function save() {
    setSaving(true);
    setStatus("");
    let uploadedAvatarPath = "";
    let uploadedAvatarBucket = "";

    try {
      const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
      if (!user) {
        router.replace("/signin");
        return;
      }

      if (hasPendingProfileMediaChange && !profileReviewConfirmed) {
        throw new Error("Confirm the profile media change before saving.");
      }

      const previousAvatarPath = form.avatar_path;
      let nextForm = { ...form };
      let nextAvatarPreviewUrl = avatarPreviewUrl;
      let nextAvatarBucket = avatarBucket;

      if (pendingAvatarFile) {
        setAvatarUploading(true);
        const uploadedAvatar = await uploadProfileAvatarFile(supabase, {
          userId: user.id,
          file: pendingAvatarFile,
        });
        uploadedAvatarPath = uploadedAvatar.path;
        uploadedAvatarBucket = uploadedAvatar.bucket;
        nextForm = { ...nextForm, avatar_path: uploadedAvatar.path };
        nextAvatarPreviewUrl = uploadedAvatar.previewUrl;
        nextAvatarBucket = uploadedAvatar.bucket;
      }

      const saveResult = await saveProfileWorkspace(supabase, {
        userId: user.id,
        form: nextForm,
        support,
      });

      if (uploadedAvatarPath && !saveResult.support.avatarPathSupported) {
        await removeProfileAvatarFile(supabase, {
          path: uploadedAvatarPath,
          avatarBucket: uploadedAvatarBucket,
        });
        nextForm = { ...nextForm, avatar_path: "" };
        nextAvatarPreviewUrl = "";
        nextAvatarBucket = "";
      }

      if (avatarPathToDelete && avatarPathToDelete !== uploadedAvatarPath) {
        await removeProfileAvatarFile(supabase, {
          path: avatarPathToDelete,
          avatarBucket,
        });
      } else if (previousAvatarPath && previousAvatarPath !== nextForm.avatar_path && previousAvatarPath !== avatarPathToDelete) {
        await removeProfileAvatarFile(supabase, {
          path: previousAvatarPath,
          avatarBucket,
        });
      }

      setSupport({ ...saveResult.support });
      setMaskedNi(saveResult.maskedNi);
      setForm({
        ...nextForm,
        ni_input: "",
      });
      setAvatarPreviewUrl(nextAvatarPreviewUrl);
      setAvatarBucket(nextAvatarBucket);
      setPendingAvatarFile(null);
      setAvatarPathToDelete("");
      setProfileReviewConfirmed(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lf-profile-updated"));
      }
      setStatus(`✅ ${saveResult.status}`);
    } catch (error) {
      if (uploadedAvatarPath) {
        try {
          await removeProfileAvatarFile(supabase, {
            path: uploadedAvatarPath,
            avatarBucket: uploadedAvatarBucket,
          });
        } catch {
          // Best-effort cleanup only; preserve the original error for the user.
        }
      }
      setStatus(`❌ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setAvatarUploading(false);
      setSaving(false);
    }
  }

  function onSelectAvatar(file: File) {
    const validation = validateUploadFile(file, {
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      maxBytes: 2 * 1024 * 1024,
    });
    if (!validation.ok) {
      setStatus(`❌ ${validation.error}. Allowed: PNG, JPG, WebP. Max: 2MB.`);
      return;
    }

    setPendingAvatarFile(file);
    setAvatarPathToDelete(form.avatar_path || avatarPathToDelete);
    setProfileReviewConfirmed(false);
    setStatus("");
    setStatus("✅ Profile picture ready. Confirm and save profile to persist.");
  }

  function removeAvatar() {
    if (!form.avatar_path && !pendingAvatarFile) return;
    setAvatarPathToDelete(form.avatar_path || avatarPathToDelete);
    setPendingAvatarFile(null);
    setAvatarPreviewUrl("");
    setForm((current) => ({ ...current, avatar_path: "" }));
    setProfileReviewConfirmed(false);
    setStatus("✅ Profile picture removal staged. Confirm and save profile to persist.");
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

        <FormField
          label="Profile picture"
          iconName="account_box"
          helpText="Upload a profile image only. Supporting estate documents should be linked from the relevant canonical asset workspace."
        >
          <FileDropzone
            label={displayedAvatarUrl ? "Replace profile picture" : "Drop a profile picture here"}
            accept="image/png,image/jpeg,image/webp"
            file={pendingAvatarFile}
            onFileSelect={(file) => {
              onSelectAvatar(file);
            }}
            disabled={avatarUploading || saving}
          />
        </FormField>

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
            {displayedAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayedAvatarUrl} alt="Profile picture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Icon name="person" size={22} />
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {displayedAvatarUrl ? (
              <>
                <a href={displayedAvatarUrl} target="_blank" rel="noreferrer" style={ghostBtn}>
                  <Icon name="open_in_new" size={16} />
                  View picture
                </a>
                <a href={displayedAvatarUrl} download="profile-picture" style={ghostBtn}>
                  <Icon name="download" size={16} />
                  Download
                </a>
                <button type="button" style={ghostBtn} onClick={() => window.open(displayedAvatarUrl, "_blank", "noopener,noreferrer")?.print()}>
                  <Icon name="print" size={16} />
                  Print
                </button>
              </>
            ) : null}
            <button type="button" style={ghostBtn} onClick={() => void removeAvatar()}>
              <Icon name="delete" size={16} />
              Delete picture
            </button>
          </div>
        </div>

        {hasPendingProfileMediaChange ? (
          <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#475569", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={profileReviewConfirmed}
              onChange={(event) => setProfileReviewConfirmed(event.target.checked)}
              disabled={saving || avatarUploading}
            />
            I confirm the profile picture change is correct before saving.
          </label>
        ) : null}

        <div style={gridStyle}>
          <FormField label="First name" iconName="badge" required>
            <TextInput value={form.first_name} onChange={(value) => setForm({ ...form, first_name: value })} disabled={saving} />
          </FormField>
          <FormField label="Last name" iconName="badge" required>
            <TextInput value={form.last_name} onChange={(value) => setForm({ ...form, last_name: value })} disabled={saving} />
          </FormField>
          <FormField label="Preferred name / display name" iconName="person" helpText="Shown across the app when set.">
            <TextInput value={form.display_name} onChange={(value) => setForm({ ...form, display_name: value })} disabled={saving} />
          </FormField>
          <FormField label="Date of birth" iconName="event" helpText="Stored on your profile only and not shown in dashboard summaries.">
            <DateInput value={form.date_of_birth} onChange={(value) => setForm({ ...form, date_of_birth: value })} disabled={saving} />
          </FormField>
        </div>
      </SettingsCard>

      <SettingsCard title="Contact details" description="Add secondary contact channels for executor communication.">
        <div style={gridStyle}>
          <FormField label="Primary email (verified)" iconName="mail" required>
            <TextInput value={form.primary_email} onChange={() => undefined} disabled />
          </FormField>
          <FormField label="Second email address" iconName="alternate_email">
            <TextInput value={form.secondary_email} onChange={(value) => setForm({ ...form, secondary_email: value })} disabled={saving} />
          </FormField>
          <FormField label="Telephone number" iconName="call">
            <TextInput value={form.telephone} onChange={(value) => setForm({ ...form, telephone: value })} disabled={saving} />
          </FormField>
          <FormField label="Mobile number" iconName="smartphone">
            <TextInput value={form.mobile_number} onChange={(value) => setForm({ ...form, mobile_number: value })} disabled={saving} />
          </FormField>
          <FormField label="Notification email" iconName="notifications_active">
            <TextInput value={form.notification_email} onChange={(value) => setForm({ ...form, notification_email: value })} disabled={saving} />
          </FormField>
        </div>
      </SettingsCard>

      <SettingsCard title="Address" description="Store current address details for profile and legal references.">
        <div style={gridStyle}>
          <FormField label="House name or number" iconName="home">
            <TextInput value={form.house_name_or_number} onChange={(value) => setForm({ ...form, house_name_or_number: value })} disabled={saving} />
          </FormField>
          <FormField label="Street name" iconName="signpost">
            <TextInput value={form.street_name} onChange={(value) => setForm({ ...form, street_name: value })} disabled={saving} />
          </FormField>
          <FormField label="Town" iconName="location_city">
            <TextInput value={form.town} onChange={(value) => setForm({ ...form, town: value })} disabled={saving} />
          </FormField>
          <FormField label="City" iconName="location_city">
            <TextInput value={form.city} onChange={(value) => setForm({ ...form, city: value })} disabled={saving} />
          </FormField>
          <FormField label="Country" iconName="public">
            <SelectInput value={form.country} onChange={(value) => setForm({ ...form, country: value })} options={COUNTRY_OPTIONS} disabled={saving} placeholder="Select country" />
          </FormField>
          {form.country === "__other" ? (
            <FormField label="Country (Other)" iconName="edit_location_alt" required>
              <TextInput value={form.country_other} onChange={(value) => setForm({ ...form, country_other: value })} disabled={saving} />
            </FormField>
          ) : null}
          <FormField label="Post code" iconName="markunread_mailbox">
            <TextInput value={form.post_code} onChange={(value) => setForm({ ...form, post_code: value })} disabled={saving} placeholder="SW1A 1AA" />
          </FormField>
        </div>
      </SettingsCard>

      <SettingsCard title="Sensitive identity" description="National Insurance number is masked in UI and encrypted at rest.">
        <div style={gridStyle}>
          <FormField label="Current NI number" iconName="shield_lock">
            <TextInput value={maskedNi} onChange={() => undefined} disabled />
          </FormField>
          <FormField label="Update NI number" iconName="badge" helpText="Saved through the encrypted identity RPC only.">
            <TextInput value={form.ni_input} onChange={(value) => setForm({ ...form, ni_input: value.toUpperCase() })} disabled={saving} placeholder="QQ 12 34 56 C" />
          </FormField>
        </div>
      </SettingsCard>

      <SettingsCard title="Preferences and account" description="Account-level defaults for language and valuation display.">
        <div style={gridStyle}>
          <FormField label="Preferred currency" iconName="currency_exchange">
            <SelectInput value={form.preferred_currency} onChange={(value) => setForm({ ...form, preferred_currency: value })} options={PROFILE_CURRENCY_OPTIONS} disabled={saving} />
          </FormField>
          <FormField label="Language" iconName="translate">
            <SelectInput value={form.language} onChange={(value) => setForm({ ...form, language: value })} options={PROFILE_LANGUAGE_OPTIONS} disabled={saving} />
          </FormField>
          {form.language === "__other" ? (
            <FormField label="Language (Other)" iconName="edit" required>
              <TextInput value={form.language_other} onChange={(value) => setForm({ ...form, language_other: value })} disabled={saving} />
            </FormField>
          ) : null}
        </div>

        <FormField label="Notes" iconName="notes">
          <TextAreaInput value={form.about} onChange={(value) => setForm({ ...form, about: value })} disabled={saving} placeholder="Optional account context" />
        </FormField>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" disabled={!canSave} style={primaryBtn} onClick={() => void save()}>
            <Icon name="save" size={16} />
            {saving ? "Saving..." : "Save profile"}
          </button>
          <button type="button" style={ghostBtn} onClick={() => void sendPasswordReset()}>
            <Icon name="lock_reset" size={16} />
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
