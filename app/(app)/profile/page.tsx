"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  SettingsCard,
  SettingsPageShell,
  StatusNote,
  ghostBtn,
  gridStyle,
  primaryBtn,
} from "../components/settings/SettingsPrimitives";
import InfoTip from "../../../components/ui/InfoTip";
import {
  COUNTRY_OPTIONS,
} from "../../../lib/assets/fieldDictionary";
import {
  DateInput,
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
  buildProfileAvatarStoragePath,
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
import {
  appendProfileAvatarTrace,
  clearProfileAvatarTrace,
  isProfileAvatarTraceEnabled,
  maskAvatarStoragePath,
  maskAvatarUrl,
  profileAvatarTraceEventName,
  readProfileAvatarTrace,
} from "../../../lib/profile/avatarTrace";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { useAccessibilityPreferences } from "../../../components/accessibility/AccessibilityPreferencesContext";
import {
  saveAccessibilityPreferences,
  type AccessibilityPreferences,
} from "../../../lib/accessibilityPreferences";

const PROFILE_AVATAR_INPUT_ID = "profile-avatar-input";

export default function ProfilePage() {
  const router = useRouter();
  const { viewer } = useViewerAccess();
  const { preferences: accessibilityPreferences, setPreferences: setAccessibilityPreferences } = useAccessibilityPreferences();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAccessibility, setSavingAccessibility] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<ProfileWorkspaceForm>(EMPTY_PROFILE_FORM);
  const [support, setSupport] = useState<ProfileWorkspaceSupport>({
    avatarPathSupported: true,
    firstNameSupported: true,
    lastNameSupported: true,
  });
  const [savedForm, setSavedForm] = useState<ProfileWorkspaceForm>(EMPTY_PROFILE_FORM);
  const [savedMaskedNi, setSavedMaskedNi] = useState("Not set");
  const [savedAvatarPreviewUrl, setSavedAvatarPreviewUrl] = useState("");
  const [savedAvatarBucket, setSavedAvatarBucket] = useState<string>("");
  const [savedSupport, setSavedSupport] = useState<ProfileWorkspaceSupport>({
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
  const [avatarTraceLines, setAvatarTraceLines] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [accessibilityDraft, setAccessibilityDraft] = useState<AccessibilityPreferences>(accessibilityPreferences);
  const pendingAvatarFileRef = useRef<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const editorPanelRef = useRef<HTMLElement | null>(null);

  const avatarTraceEnabled = useMemo(
    () => typeof window !== "undefined" && isProfileAvatarTraceEnabled(),
    [],
  );

  useEffect(() => {
    if (!avatarTraceEnabled || typeof window === "undefined") return;
    clearProfileAvatarTrace();
    const sync = () => setAvatarTraceLines(readProfileAvatarTrace());
    sync();
    window.addEventListener(profileAvatarTraceEventName(), sync);
    return () => {
      window.removeEventListener(profileAvatarTraceEventName(), sync);
    };
  }, [avatarTraceEnabled]);

  useEffect(() => {
    setAccessibilityDraft(accessibilityPreferences);
  }, [accessibilityPreferences]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      try {
        const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
        appendProfileAvatarTrace(`[profile-load] session=${user ? "present" : "missing"} user=${user?.id ?? "<none>"}`);
        if (!user) {
          router.replace("/sign-in");
          return;
        }

        const loaded = await loadProfileWorkspace(supabase, {
          userId: viewer.targetOwnerUserId || user.id,
          baseEmail: viewer.mode === "linked" ? "" : user.email ?? "",
        });
        if (!mounted) return;
        setForm(loaded.form);
        setMaskedNi(loaded.maskedNi);
        setAvatarPreviewUrl(loaded.avatarPreviewUrl);
        setAvatarBucket(loaded.avatarBucket);
        setSupport(loaded.support);
        setSavedForm(loaded.form);
        setSavedMaskedNi(loaded.maskedNi);
        setSavedAvatarPreviewUrl(loaded.avatarPreviewUrl);
        setSavedAvatarBucket(loaded.avatarBucket);
        setSavedSupport(loaded.support);
        pendingAvatarFileRef.current = null;
        setPendingAvatarFile(null);
        setPendingAvatarPreviewUrl("");
        setAvatarPathToDelete("");
        setEditorOpen(false);
        appendProfileAvatarTrace(
          `[profile-load] row_avatar_path=${maskAvatarStoragePath(loaded.form.avatar_path)} preview_url=${maskAvatarUrl(loaded.avatarPreviewUrl)}`,
        );
        if (loaded.notice) setStatus(loaded.notice);
      } catch (error) {
        appendProfileAvatarTrace(
          `[profile-load:error] message=${error instanceof Error ? error.message : String(error)}`,
        );
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
  }, [router, viewer.mode, viewer.targetOwnerUserId]);

  useEffect(() => {
    if (!pendingAvatarFile) {
      setPendingAvatarPreviewUrl("");
      appendProfileAvatarTrace("[preview-stage] no");
      return;
    }

    const objectUrl = URL.createObjectURL(pendingAvatarFile);
    setPendingAvatarPreviewUrl(objectUrl);
    appendProfileAvatarTrace(
      `[preview-stage] yes name=${pendingAvatarFile.name} type=${pendingAvatarFile.type || "unknown"}`,
    );
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pendingAvatarFile]);

  const canSave = useMemo(() => !loading && !saving && !avatarUploading, [loading, saving, avatarUploading]);
  const savedSummaryAvatarUrl = avatarPreviewUrl;
  const displayedAvatarUrl = pendingAvatarPreviewUrl || (avatarPathToDelete ? "" : avatarPreviewUrl);
  const hasPendingProfileMediaChange = Boolean(pendingAvatarFile || avatarPathToDelete);
  const hasSavedAvatar = Boolean(form.avatar_path && !avatarPathToDelete);
  const hasStagedAvatarSelection = Boolean(pendingAvatarFile);
  const hasRecentPhotoSuccess = status.startsWith("✅") && /profile picture|photo|Profile saved/i.test(status);
  const summaryName = [form.first_name, form.last_name].filter(Boolean).join(" ").trim() || form.display_name || "No name saved";
  const profileReadiness = useMemo(() => {
    const identityReady = Boolean(summaryName && summaryName !== "No name saved" && form.primary_email);
    const contactReady = Boolean(form.mobile_number || form.telephone || form.notification_email);
    const addressReady = Boolean(form.house_name_or_number || form.street_name || form.city || form.post_code || form.country);
    return {
      identityReady,
      contactReady,
      addressReady,
      completed: [identityReady, contactReady, addressReady].filter(Boolean).length,
    };
  }, [
    form.city,
    form.country,
    form.house_name_or_number,
    form.mobile_number,
    form.notification_email,
    form.post_code,
    form.primary_email,
    form.street_name,
    form.telephone,
    summaryName,
  ]);
  const summaryAvatarFallback = useMemo(() => {
    const base = summaryName && summaryName !== "No name saved" ? summaryName : form.primary_email || "LF";
    return base
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "LF";
  }, [summaryName, form.primary_email]);

  useEffect(() => {
    if (!avatarTraceEnabled) return;
    appendProfileAvatarTrace(
      `[summary-render] image_shown=${savedSummaryAvatarUrl ? "yes" : "no"} reason=${savedSummaryAvatarUrl ? "saved-avatar-url" : "no-saved-avatar-url"}`,
    );
  }, [avatarTraceEnabled, savedSummaryAvatarUrl]);

  useEffect(() => {
    appendProfileAvatarTrace(`[mode] ${editorOpen ? "edit" : "summary"}`);
    appendProfileAvatarTrace(`[edit-render] shown=${editorOpen ? "yes" : "no"}`);
    if (!editorOpen) return;
    editorPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editorOpen]);

  function clearStagedAvatarFile() {
    pendingAvatarFileRef.current = null;
    setPendingAvatarFile(null);
    appendProfileAvatarTrace("[file-select] no reason=cleared");
  }

  function restoreSavedState() {
    pendingAvatarFileRef.current = null;
    setPendingAvatarFile(null);
    setPendingAvatarPreviewUrl("");
    setAvatarPathToDelete("");
    setForm(savedForm);
    setMaskedNi(savedMaskedNi);
    setAvatarPreviewUrl(savedAvatarPreviewUrl);
    setAvatarBucket(savedAvatarBucket);
    setSupport(savedSupport);
  }

  function triggerAvatarPicker() {
    avatarInputRef.current?.click();
  }

  function onAvatarInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      appendProfileAvatarTrace("[file-select] no reason=no-file");
      return;
    }
    onSelectAvatar(file);
    event.currentTarget.value = "";
  }

  async function saveAccessibility() {
    if (viewer.readOnly) return;
    setSavingAccessibility(true);
    setStatus("");

    try {
      const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      const saved = await saveAccessibilityPreferences(supabase, user.id, accessibilityDraft);
      setAccessibilityPreferences(saved);
      setAccessibilityDraft(saved);
      setStatus("Accessibility preferences saved.");
    } catch (error) {
      setStatus(`Could not save accessibility preferences: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSavingAccessibility(false);
    }
  }

  async function save() {
    if (viewer.readOnly) {
      setStatus("This profile is view-only in linked access mode.");
      return;
    }
    setSaving(true);
    setStatus("");
    let uploadedAvatarPath = "";
    let uploadedAvatarBucket = "";
    let profileWriteCompleted = false;
    let avatarPersistedAfterReload = false;
    const stagedAvatarFile = pendingAvatarFileRef.current ?? pendingAvatarFile;
    appendProfileAvatarTrace(
      `[save-click] avatar_change_pending=${hasPendingProfileMediaChange ? "yes" : "no"} file_selected=${stagedAvatarFile ? "yes" : "no"} staged_avatar_path=${maskAvatarStoragePath(form.avatar_path)}`,
    );

    try {
      const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
      appendProfileAvatarTrace(`[save] session=${user ? "present" : "missing"} user=${user?.id ?? "<none>"}`);
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      const previousAvatarPath = form.avatar_path;
      let nextForm = { ...form };
      let nextAvatarPreviewUrl = avatarPreviewUrl;
      let nextAvatarBucket = avatarBucket;

      if (stagedAvatarFile) {
        setAvatarUploading(true);
        appendProfileAvatarTrace(
          `[upload] attempted bucket=avatars|vault-docs path=${maskAvatarStoragePath(buildProfileAvatarStoragePath(user.id, stagedAvatarFile.name))}`,
        );
        let uploadedAvatar;
        try {
          uploadedAvatar = await uploadProfileAvatarFile(supabase, {
            userId: user.id,
            file: stagedAvatarFile,
          });
        } catch (error) {
          appendProfileAvatarTrace(
            `[upload] failure reason=${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
        uploadedAvatarPath = uploadedAvatar.path;
        uploadedAvatarBucket = uploadedAvatar.bucket;
        appendProfileAvatarTrace(
          `[upload] success bucket=${uploadedAvatar.bucket} tried=${uploadedAvatar.attemptedBuckets.join("|")} path=${maskAvatarStoragePath(uploadedAvatar.path)} preview_url=${maskAvatarUrl(uploadedAvatar.previewUrl)}`,
        );
        nextForm = { ...nextForm, avatar_path: uploadedAvatar.path };
        nextAvatarPreviewUrl = uploadedAvatar.previewUrl;
        nextAvatarBucket = uploadedAvatar.bucket;
      }

      appendProfileAvatarTrace(`[profile-save] attempted avatar_path=${maskAvatarStoragePath(nextForm.avatar_path)}`);
      const saveResult = await saveProfileWorkspace(supabase, {
        userId: user.id,
        form: nextForm,
        support,
      });
      profileWriteCompleted = true;
      appendProfileAvatarTrace(
        `[profile-save] avatar_path_written=${maskAvatarStoragePath(nextForm.avatar_path)} avatar_supported=${saveResult.support.avatarPathSupported ? "yes" : "no"}`,
      );

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
      const reloaded = await loadProfileWorkspace(supabase, {
        userId: user.id,
        baseEmail: user.email ?? "",
      });
      appendProfileAvatarTrace(
        `[profile-reload] avatar_path_read_back=${maskAvatarStoragePath(reloaded.form.avatar_path)}`,
      );
      appendProfileAvatarTrace(
        `[preview-url] source=profile resolved=${reloaded.avatarPreviewUrl ? "yes" : "no"} reason=${reloaded.avatarPreviewUrl ? "signed-url-created" : "signed-url-missing"} url=${maskAvatarUrl(reloaded.avatarPreviewUrl)}`,
      );
      if (uploadedAvatarPath && reloaded.form.avatar_path !== uploadedAvatarPath) {
        throw new Error("Profile row did not persist the uploaded avatar path.");
      }
      if (uploadedAvatarPath && !reloaded.avatarPreviewUrl) {
        avatarPersistedAfterReload = reloaded.form.avatar_path === uploadedAvatarPath;
        throw new Error("Avatar path saved, but a usable preview URL could not be resolved.");
      }
      if (!uploadedAvatarPath && avatarPathToDelete && reloaded.form.avatar_path) {
        throw new Error("Avatar removal did not persist to the profile row.");
      }
      avatarPersistedAfterReload = Boolean(!uploadedAvatarPath || reloaded.form.avatar_path === uploadedAvatarPath);
      setForm(reloaded.form);
      setMaskedNi(reloaded.maskedNi || saveResult.maskedNi);
      setAvatarPreviewUrl(reloaded.avatarPreviewUrl || nextAvatarPreviewUrl);
      setAvatarBucket(reloaded.avatarBucket || nextAvatarBucket);
      setSupport(reloaded.support);
      setSavedForm(reloaded.form);
      setSavedMaskedNi(reloaded.maskedNi || saveResult.maskedNi);
      setSavedAvatarPreviewUrl(reloaded.avatarPreviewUrl || nextAvatarPreviewUrl);
      setSavedAvatarBucket(reloaded.avatarBucket || nextAvatarBucket);
      setSavedSupport(reloaded.support);
      pendingAvatarFileRef.current = null;
      setPendingAvatarFile(null);
      setAvatarPathToDelete("");
      appendProfileAvatarTrace("[edit-open] no reason=save-success");
      appendProfileAvatarTrace("[save-success] return-to-summary=yes");
      setEditorOpen(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("lf-profile-updated", {
            detail: {
              displayName:
                reloaded.form.display_name.trim()
                || [reloaded.form.first_name, reloaded.form.last_name].filter(Boolean).join(" ").trim()
                || (user.email ?? "").split("@")[0]
                || "Secure Account",
              avatarUrl: reloaded.avatarPreviewUrl || nextAvatarPreviewUrl,
            },
          }),
        );
      }
      appendProfileAvatarTrace("[sidebar-refresh] event_dispatched=yes");
      setStatus(uploadedAvatarPath ? "✅ Photo updated" : avatarPathToDelete ? "✅ Photo removed" : `✅ ${saveResult.status}`);
    } catch (error) {
      appendProfileAvatarTrace(
        `[save:error] message=${error instanceof Error ? error.message : String(error)}`,
      );
      if (uploadedAvatarPath && (!profileWriteCompleted || !avatarPersistedAfterReload)) {
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

    pendingAvatarFileRef.current = file;
    setPendingAvatarFile(file);
    setAvatarPathToDelete(form.avatar_path || avatarPathToDelete);
    setEditorOpen(true);
    appendProfileAvatarTrace(`[file-select] yes name=${file.name} type=${file.type || "unknown"} size=${file.size}`);
    setStatus("");
    setStatus("✅ Profile picture ready. Confirm and save profile to persist.");
  }

  function removeAvatar() {
    if (!form.avatar_path && !pendingAvatarFile) return;
    clearStagedAvatarFile();
    setAvatarPathToDelete(form.avatar_path || avatarPathToDelete);
    setEditorOpen(true);
    setStatus("✅ Profile picture removal staged. Confirm and save profile to persist.");
  }

  const sendPasswordReset = async () => {
    if (viewer.readOnly) {
      setStatus("Password reset is only available in your own account.");
      return;
    }
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
      subtitle="Keep the identity, contact, and address details an executor, family member, or advisor would expect to find first."
    >
      {!editorOpen ? (
      <SettingsCard title="Saved profile summary" description="These are the core details someone would rely on first to confirm identity, make contact, and trust the record.">
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
                {savedSummaryAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={savedSummaryAvatarUrl} alt="Saved profile picture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{summaryAvatarFallback}</span>
                )}
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {summaryName}
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>{form.primary_email || "No email saved"}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {[form.house_name_or_number, form.street_name, form.town, form.city, form.post_code, form.country]
                    .filter(Boolean)
                    .join(", ") || "No address saved"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={profileReadiness.completed === 3 ? readyPillStyle : reviewPillStyle}>
                {profileReadiness.completed === 3 ? "Profile ready for trusted review" : `${profileReadiness.completed} of 3 essentials in place`}
              </span>
              <span style={microPillStyle}>Identity {profileReadiness.identityReady ? "saved" : "needs review"}</span>
              <span style={microPillStyle}>Contact {profileReadiness.contactReady ? "saved" : "needs review"}</span>
              <span style={microPillStyle}>Address {profileReadiness.addressReady ? "saved" : "needs review"}</span>
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Main phone: {form.mobile_number || form.telephone || "Not set"} · Notification email: {form.notification_email || "Not set"}
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>National Insurance: {maskedNi}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {!viewer.readOnly ? (
                <button
                  type="button"
                  style={ghostBtn}
                  onClick={() => {
                    appendProfileAvatarTrace("[edit-open] yes");
                    setEditorOpen(true);
                  }}
                >
                  <Icon name="edit" size={16} />
                  Edit profile
                </button>
              ) : (
                <span style={{ color: "#475569", fontSize: 13 }}>
                  View-only access. Profile changes stay with the account holder.
                </span>
              )}
              <StatusNote message={status} />
            </div>
          </div>
        )}
      </SettingsCard>
      ) : null}

      {editorOpen ? (
      <SettingsCard title="Edit profile" description="Keep your saved identity, contact, and address details clear enough for someone else to trust and use.">
        <section ref={editorPanelRef}>
        {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}

        <div style={{ display: "grid", gap: 12, padding: 14, border: "1px solid #e5e7eb", borderRadius: 14, background: "#fcfcfd" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <Icon name="account_box" size={18} />
              Profile photo
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Upload PNG, JPG, or WebP up to 2MB.
            </div>
          </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 18,
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
              <span style={{ fontWeight: 700, fontSize: 24 }}>{summaryAvatarFallback}</span>
            )}
          </div>

          <div style={{ display: "grid", gap: 10, alignItems: "start" }}>
            {!hasStagedAvatarSelection ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label
                  htmlFor={PROFILE_AVATAR_INPUT_ID}
                  role="button"
                  style={{
                    ...ghostBtn,
                    position: "relative",
                    overflow: "hidden",
                    opacity: avatarUploading || saving ? 0.6 : 1,
                    cursor: avatarUploading || saving ? "not-allowed" : "pointer",
                    pointerEvents: avatarUploading || saving ? "none" : "auto",
                  }}
                  aria-disabled={avatarUploading || saving}
                >
                  <input
                    id={PROFILE_AVATAR_INPUT_ID}
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onAvatarInputChange}
                    disabled={avatarUploading || saving}
                    aria-label="Choose profile photo"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: avatarUploading || saving ? "not-allowed" : "pointer",
                    }}
                  />
                  <Icon name={hasSavedAvatar ? "photo_camera" : "add_a_photo"} size={16} />
                  {hasSavedAvatar ? "Change photo" : "Add photo"}
                </label>
                {hasRecentPhotoSuccess ? (
                  <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>Photo updated</span>
                ) : null}
              </div>
            ) : (
              <>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Staged preview ready: {pendingAvatarFile?.name}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" disabled={!canSave} style={primaryBtn} onClick={() => void save()}>
                    <Icon name="save" size={16} />
                    {saving ? "Saving..." : "Save photo"}
                  </button>
                  <button
                    type="button"
                    style={ghostBtn}
                    onClick={() => {
                      clearStagedAvatarFile();
                      setAvatarPathToDelete("");
                    }}
                    disabled={saving || avatarUploading}
                  >
                    <Icon name="close" size={16} />
                    Cancel
                  </button>
                </div>
              </>
            )}

            {avatarPathToDelete && !hasStagedAvatarSelection ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Saved photo will be removed when you save.
              </div>
            ) : null}
          </div>
        </div>

        {status.startsWith("❌") ? <StatusNote message={status} /> : null}
        </div>

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
        </section>
      </SettingsCard>
      ) : null}

      {editorOpen ? (
      <SettingsCard title="Contact details" description="Add the phone numbers and email addresses someone should use if they need to reach you or verify your details.">
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
      ) : null}

      {editorOpen ? (
      <SettingsCard title="Address" description="Store the main residential address that should appear across profile, legal, and account records.">
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
      ) : null}

      {editorOpen ? (
      <SettingsCard title="Sensitive identity" description="National Insurance details stay masked in the interface and encrypted at rest.">
        <div style={gridStyle}>
          <FormField label="Current NI number" iconName="shield_lock">
            <TextInput value={maskedNi} onChange={() => undefined} disabled />
          </FormField>
          <FormField label="Update NI number" iconName="badge" helpText="Saved through the encrypted identity RPC only.">
            <TextInput value={form.ni_input} onChange={(value) => setForm({ ...form, ni_input: value.toUpperCase() })} disabled={saving} placeholder="QQ 12 34 56 C" />
          </FormField>
        </div>
      </SettingsCard>
      ) : null}

      {editorOpen ? (
      <SettingsCard title="Preferences and account" description="Set the display defaults that keep the rest of the workspace consistent and easy to review.">
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
          <button
            type="button"
            style={ghostBtn}
            onClick={() => {
              restoreSavedState();
              appendProfileAvatarTrace("[edit-open] no reason=user-close");
              setEditorOpen(false);
            }}
            disabled={saving || avatarUploading}
          >
            <Icon name="close" size={16} />
            Close editor
          </button>
          <button type="button" style={ghostBtn} onClick={() => void sendPasswordReset()}>
            <Icon name="lock_reset" size={16} />
            Send password reset
          </button>
        </div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          For password change, recovery options, and mobile verification controls, open Security settings.
        </div>
      </SettingsCard>
      ) : null}

      <div id="account-settings">
      <div id="accessibility-settings">
      <SettingsCard
        title="Accessibility and guided help"
        description="Set the reading and guidance preferences that make the workspace easier to use across dashboard, support, contacts, and records."
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 14 }}>Personal accessibility preferences</strong>
          <InfoTip
            label="Explain accessibility preferences"
            message="Choose larger text, stronger contrast, roomier spacing, read-aloud support, and a guided help mode. These settings apply across the signed-in workspace."
          />
        </div>
        <div style={gridStyle}>
          <FormField label="Text size" iconName="format_size">
            <SelectInput
              value={accessibilityDraft.textSize}
              onChange={(value) => setAccessibilityDraft((current) => ({ ...current, textSize: value as AccessibilityPreferences["textSize"] }))}
              options={[
                { value: "default", label: "Standard" },
                { value: "large", label: "Large" },
                { value: "xlarge", label: "Extra large" },
              ]}
              disabled={savingAccessibility}
            />
          </FormField>
          <FormField label="Contrast mode" iconName="contrast">
            <SelectInput
              value={accessibilityDraft.contrastMode}
              onChange={(value) => setAccessibilityDraft((current) => ({ ...current, contrastMode: value as AccessibilityPreferences["contrastMode"] }))}
              options={[
                { value: "default", label: "Standard" },
                { value: "high", label: "High contrast" },
              ]}
              disabled={savingAccessibility}
            />
          </FormField>
          <FormField label="Layout spacing" iconName="open_in_full">
            <SelectInput
              value={accessibilityDraft.spacingMode}
              onChange={(value) => setAccessibilityDraft((current) => ({ ...current, spacingMode: value as AccessibilityPreferences["spacingMode"] }))}
              options={[
                { value: "default", label: "Standard" },
                { value: "comfortable", label: "More space" },
              ]}
              disabled={savingAccessibility}
            />
          </FormField>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={preferenceToggleStyle}>
            <input
              type="checkbox"
              checked={accessibilityDraft.helpWizardEnabled}
              onChange={(event) => setAccessibilityDraft((current) => ({ ...current, helpWizardEnabled: event.target.checked }))}
            />
            <span>
              <strong>Help wizard</strong>
              <span style={preferenceHelpStyle}>Show guided next-step hints in places like Support and contact access setup.</span>
            </span>
          </label>
          <label style={preferenceToggleStyle}>
            <input
              type="checkbox"
              checked={accessibilityDraft.readAloudEnabled}
              onChange={(event) => setAccessibilityDraft((current) => ({ ...current, readAloudEnabled: event.target.checked }))}
            />
            <span>
              <strong>Read aloud support</strong>
              <span style={preferenceHelpStyle}>Enable spoken guidance controls where read-aloud support is offered.</span>
            </span>
          </label>
        </div>
        {!viewer.readOnly ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={primaryBtn} disabled={savingAccessibility} onClick={() => void saveAccessibility()}>
              <Icon name="save" size={16} />
              {savingAccessibility ? "Saving..." : "Save accessibility preferences"}
            </button>
            <button type="button" style={ghostBtn} disabled={savingAccessibility} onClick={() => setAccessibilityDraft(accessibilityPreferences)}>
              <Icon name="restart_alt" size={16} />
              Reset changes
            </button>
          </div>
        ) : null}
      </SettingsCard>
      </div>

      <SettingsCard title="Account settings" description="Security, billing, terms, communications, and reminders now stay linked from Profile so account controls have one clear home.">
        <div className="lf-content-grid">
          {[
            { href: "/profile#accessibility-settings", label: "Accessibility", desc: "Text size, contrast, spacing, read aloud, and guided help preferences." },
            { href: "/account/security", label: "Security", desc: "Password, recovery, and mobile verification controls." },
            { href: "/account/billing", label: "Billing and Account", desc: "Plan status, limits, and subscription readiness." },
            { href: "/account/my-vault", label: "My Vault", desc: "Choose which category groups and subsections stay visible across your workspace." },
            { href: "/account/terms", label: "Terms and Conditions", desc: "Review the current terms status and acceptance record." },
            { href: "/account/communications-preferences", label: "Communications Preferences", desc: "Choose how service updates reach you." },
            { href: "/account/reminder-preferences", label: "Reminder Preferences", desc: "Control reminder timing and destinations." },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={accountLinkCardStyle}>
              <div style={{ fontWeight: 700 }}>{item.label}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>{item.desc}</div>
            </Link>
          ))}
        </div>
      </SettingsCard>
      </div>

      {avatarTraceEnabled ? (
        <SettingsCard title="DEV avatar trace" description="Temporary local trace for upload, save, reload, and sidebar hydrate.">
          <div style={{ display: "grid", gap: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
            {avatarTraceLines.length ? avatarTraceLines.map((line, index) => (
              <div key={`${index}-${line}`}>{line}</div>
            )) : (
              <div style={{ color: "#64748b" }}>No avatar trace entries yet.</div>
            )}
          </div>
        </SettingsCard>
      ) : null}
    </SettingsPageShell>
  );
}

const microPillStyle = {
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  background: "#f3f4f6",
  color: "#334155",
} as const;

const preferenceToggleStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
} as const;

const preferenceHelpStyle = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  marginTop: 4,
} as const;

const reviewPillStyle = {
  ...microPillStyle,
  background: "#fff7ed",
  color: "#9a3412",
};

const readyPillStyle = {
  ...microPillStyle,
  background: "#ecfdf3",
  color: "#166534",
};

const accountLinkCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
  textDecoration: "none",
  color: "#111827",
  display: "grid",
  gap: 6,
} as const;
