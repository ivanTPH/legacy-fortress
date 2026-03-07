"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { digitalCategoryOptions, digitalSubcategories, optionLabel } from "../../../../lib/categoryConfig";
import { supabase } from "../../../../lib/supabaseClient";
import { sanitizeFileName, validateUploadFile } from "../../../../lib/validation/upload";

type DigitalRecord = {
  id: string;
  category: string;
  subcategory: string;
  custom_category: string;
  custom_subcategory: string;
  service_name: string;
  username_or_email: string;
  recovery_method: string;
  has_2fa: boolean;
  executor_instructions: string;
  notes: string;
  file_path: string;
};

type DigitalRecordRow = {
  id: string;
  category: string | null;
  subcategory: string | null;
  custom_category: string | null;
  custom_subcategory: string | null;
  service_name: string | null;
  username_or_email: string | null;
  recovery_method: string | null;
  has_2fa: boolean | null;
  executor_instructions: string | null;
  notes: string | null;
  file_path: string | null;
};

const EMPTY: Omit<DigitalRecord, "id"> = {
  category: "email",
  subcategory: "",
  custom_category: "",
  custom_subcategory: "",
  service_name: "",
  username_or_email: "",
  recovery_method: "",
  has_2fa: false,
  executor_instructions: "",
  notes: "",
  file_path: "",
};

function mapDigitalRow(row: DigitalRecordRow): DigitalRecord {
  return {
    id: row.id,
    category: row.category ?? "email",
    subcategory: row.subcategory ?? "",
    custom_category: row.custom_category ?? "",
    custom_subcategory: row.custom_subcategory ?? "",
    service_name: row.service_name ?? "",
    username_or_email: row.username_or_email ?? "",
    recovery_method: row.recovery_method ?? "",
    has_2fa: Boolean(row.has_2fa),
    executor_instructions: row.executor_instructions ?? "",
    notes: row.notes ?? "",
    file_path: row.file_path ?? "",
  };
}

export default function DigitalVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<DigitalRecord[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fatalError, setFatalError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      try {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          throw authError;
        }

        const user = userData.user;
        if (!user) {
          if (!mounted) return;
          setStatus("Your session has expired. Redirecting to sign in...");
          setLoading(false);
          setShowForm(true);
          router.replace("/signin");
          return;
        }

        const { data, error } = await supabase
          .from("digital_assets")
          .select("id,category,subcategory,custom_category,custom_subcategory,service_name,username_or_email,recovery_method,has_2fa,executor_instructions,notes,file_path")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!mounted) return;

        if (error) {
          setItems([]);
          setShowForm(true);
          setStatus("⚠️ Could not load digital records yet (table may not exist).");
        } else {
          const mapped = ((data ?? []) as DigitalRecordRow[]).map(mapDigitalRow);
          setItems(mapped);
          if (mapped.length === 0) {
            setShowForm(true);
          }
        }
      } catch (error) {
        if (!mounted) return;
        setItems([]);
        setShowForm(true);
        setFatalError(error instanceof Error ? error.message : "Unknown runtime error.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (item: DigitalRecord) => {
    setShowForm(true);
    setEditingId(item.id);
    setForm({
      category: item.category,
      subcategory: item.subcategory,
      custom_category: item.custom_category,
      custom_subcategory: item.custom_subcategory,
      service_name: item.service_name,
      username_or_email: item.username_or_email,
      recovery_method: item.recovery_method,
      has_2fa: item.has_2fa,
      executor_instructions: item.executor_instructions,
      notes: item.notes,
      file_path: item.file_path,
    });
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reload = async (userId: string) => {
    try {
    const { data, error } = await supabase
      .from("digital_assets")
      .select("id,category,subcategory,custom_category,custom_subcategory,service_name,username_or_email,recovery_method,has_2fa,executor_instructions,notes,file_path")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        setStatus("✅ Saved, but refresh failed");
        return;
      }

      setItems(((data ?? []) as DigitalRecordRow[]).map(mapDigitalRow));
    } catch (error) {
      setStatus(`✅ Saved, but refresh failed (${error instanceof Error ? error.message : "unknown error"})`);
    }
  };

  const save = async () => {
    setSaving(true);
    setStatus("");

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw authError;
      }
      const user = userData.user;
      if (!user) {
        setStatus("Your session has expired. Redirecting to sign in...");
        router.replace("/signin");
        return;
      }

      const payload = {
        user_id: user.id,
        category: form.category,
        subcategory: form.subcategory || null,
        custom_category: form.category === "other" ? form.custom_category || null : null,
        custom_subcategory: form.subcategory === "other" ? form.custom_subcategory || null : null,
        service_name: form.service_name || null,
        username_or_email: form.username_or_email || null,
        recovery_method: form.recovery_method || null,
        has_2fa: form.has_2fa,
        executor_instructions: form.executor_instructions || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      const res = editingId
        ? await supabase.from("digital_assets").update(payload).eq("id", editingId).eq("user_id", user.id)
        : await supabase.from("digital_assets").insert(payload);

      if (res.error) {
        setStatus("❌ Save failed: " + res.error.message);
        return;
      }

      await reload(user.id);
      resetForm();
      setStatus("✅ Saved");
    } catch (error) {
      setStatus(`❌ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setStatus("");
    const ok = window.confirm("Delete this digital record?");
    if (!ok) return;

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = userData.user;
      if (!user) {
        setStatus("Your session has expired. Redirecting to sign in...");
        router.replace("/signin");
        return;
      }

      const { error } = await supabase.from("digital_assets").delete().eq("id", id).eq("user_id", user.id);
      if (error) {
        setStatus("❌ Delete failed: " + error.message);
        return;
      }

      setItems((current) => current.filter((item) => item.id !== id));
      if (editingId === id) resetForm();
      setStatus("✅ Deleted");
    } catch (error) {
      setStatus(`❌ Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const uploadAttachment = async (itemId: string, file: File) => {
    const validation = validateUploadFile(file, {
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: 10 * 1024 * 1024,
    });
    if (!validation.ok) {
      setStatus(`❌ ${validation.error}. Allowed: PDF, JPG, PNG up to 10MB.`);
      return;
    }
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }
    const filePath = `${userData.user.id}/digital/${Date.now()}-${sanitizeFileName(file.name)}`;
    const upload = await supabase.storage.from("vault-docs").upload(filePath, file, { upsert: false });
    if (upload.error) {
      setStatus(`❌ Upload failed: ${upload.error.message}`);
      return;
    }
    const { error } = await supabase
      .from("digital_assets")
      .update({ file_path: filePath, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("user_id", userData.user.id);
    if (error) {
      setStatus(`❌ Upload link failed: ${error.message}`);
      return;
    }
    await reload(userData.user.id);
    setStatus("✅ Document uploaded");
  };

  const downloadAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("vault-docs").download(path);
    if (error || !data) {
      setStatus(`❌ Download failed: ${error?.message ?? "Unknown error"}`);
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() || "digital-document";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1040 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Digital Vault</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>
          Save digital account references, recovery guidance and executor instructions so critical
          access paths are not lost.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button onClick={() => setShowForm(true)} style={primaryBtn}>Add digital record</button>
          {showForm ? (
            <button
              onClick={() => {
                resetForm();
                setStatus("");
              }}
              style={ghostBtn}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div style={safeUseNote}>
        For security, do not store plaintext passwords here. Use this section for account
        references, recovery methods, 2FA context and executor notes only.
      </div>

      {fatalError ? <div style={{ color: "#b91c1c", fontSize: 13 }}>❌ Runtime error: {fatalError}</div> : null}
      {status && !showForm ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div>
      ) : null}

      <section style={card}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={cardTitle}>Your digital records</h2>
          <p style={cardText}>
            Keep one record per service or account. Prioritise clarity for non-technical executors.
          </p>
        </div>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No digital records added yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} style={rowStyle}>
                <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 800 }}>
                    {item.service_name || "(Service name not set)"}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {[item.category === "other"
                      ? item.custom_category || "Other"
                      : labelForCategory(item.category),
                      item.subcategory
                        ? item.subcategory === "other"
                          ? item.custom_subcategory || "Other subtype"
                          : optionLabel(
                              digitalSubcategories[item.category] ?? [],
                              item.subcategory,
                              item.subcategory,
                            )
                        : null,
                      item.username_or_email ? `Login: ${item.username_or_email}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    2FA: {item.has_2fa ? "Enabled" : "Not recorded"}
                  </div>
                  {item.recovery_method ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Recovery: {item.recovery_method}
                    </div>
                  ) : null}
                  {item.executor_instructions ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Executor instructions: {item.executor_instructions}
                    </div>
                  ) : null}
                  {item.notes ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>{item.notes}</div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => startEdit(item)} style={ghostBtn}>Edit</button>
                  <button onClick={() => remove(item.id)} style={ghostBtn}>Delete</button>
                  <label style={ghostBtn}>
                    Upload
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadAttachment(item.id, file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {item.file_path ? <button onClick={() => void downloadAttachment(item.file_path)} style={ghostBtn}>View file</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {!showForm ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>Use “Add digital record” above to create a record.</div>
        ) : null}
      </section>

      {showForm ? (
        <section style={card}>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={cardTitle}>{editingId ? "Edit digital record" : "Digital account details"}</h2>
            <p style={cardText}>
              Record service metadata and recovery guidance only. Do not add passwords in this form.
            </p>
          </div>

          <div style={fieldGrid}>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value,
                    subcategory: "",
                    custom_category: e.target.value === "other" ? form.custom_category : "",
                    custom_subcategory: "",
                  })
                }
                style={inputStyle}
              >
                {digitalCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {form.category === "other" ? (
              <Field label="Custom category">
                <input
                  value={form.custom_category}
                  onChange={(e) => setForm({ ...form, custom_category: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Niche web service"
                />
              </Field>
            ) : null}

            {(digitalSubcategories[form.category] ?? []).length > 0 ? (
              <Field label="Subcategory">
                <select
                  value={form.subcategory}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subcategory: e.target.value,
                      custom_subcategory: e.target.value === "other" ? form.custom_subcategory : "",
                    })
                  }
                  style={inputStyle}
                >
                  <option value="">Select subcategory</option>
                  {(digitalSubcategories[form.category] ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {form.subcategory === "other" ? (
              <Field label="Custom subcategory">
                <input
                  value={form.custom_subcategory}
                  onChange={(e) => setForm({ ...form, custom_subcategory: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Secure community forum"
                />
              </Field>
            ) : null}

            <Field label="Service name">
              <input
                value={form.service_name}
                onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                style={inputStyle}
                placeholder="e.g. Google, Apple, Netflix"
              />
            </Field>

            <Field label="Username or email">
              <input
                value={form.username_or_email}
                onChange={(e) => setForm({ ...form, username_or_email: e.target.value })}
                style={inputStyle}
                placeholder="Account login identifier"
              />
            </Field>

            <Field label="Recovery method">
              <input
                value={form.recovery_method}
                onChange={(e) => setForm({ ...form, recovery_method: e.target.value })}
                style={inputStyle}
                placeholder="e.g. Recovery email, backup codes location"
              />
            </Field>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.has_2fa}
              onChange={(e) => setForm({ ...form, has_2fa: e.target.checked })}
            />
            <span style={{ fontSize: 13, color: "#374151" }}>Two-factor authentication is enabled</span>
          </label>

          <Field label="Executor instructions">
            <input
              value={form.executor_instructions}
              onChange={(e) => setForm({ ...form, executor_instructions: e.target.value })}
              style={inputStyle}
              placeholder="Practical guidance for trusted executor access steps"
            />
          </Field>

          <Field label="Notes">
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={inputStyle}
              placeholder="Optional notes"
            />
          </Field>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={save} disabled={saving} style={primaryBtn}>
              {saving ? "Saving..." : editingId ? "Update record" : "Save record"}
            </button>
            {status ? <span style={{ color: "#6b7280", fontSize: 13 }}>{status}</span> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}

function labelForCategory(category: string) {
  switch (category) {
    case "email":
      return "Email";
    case "social":
      return "Social";
    case "cloud":
      return "Cloud";
    case "finance":
      return "Financial";
    case "subscription":
      return "Subscription";
    case "domains":
      return "Domains";
    case "devices":
      return "Devices";
    case "crypto_access":
      return "Crypto access";
    default:
      return "Other";
  }
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const safeUseNote: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#f9fafb",
  color: "#4b5563",
  fontSize: 13,
  lineHeight: 1.5,
  padding: "10px 12px",
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
};

const cardText: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.5,
};

const fieldGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  fontSize: 15,
  background: "#fff",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 14,
  flexWrap: "wrap",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
};
