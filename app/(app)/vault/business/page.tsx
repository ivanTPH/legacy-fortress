"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { businessSubtypes, businessTypeOptions, optionLabel } from "../../../../lib/categoryConfig";
import { formatCurrency } from "../../../../lib/currency";
import { supabase } from "../../../../lib/supabaseClient";
import { sanitizeFileName, validateUploadFile } from "../../../../lib/validation/upload";

type BusinessInterest = {
  id: string;
  entity_type: string;
  entity_subtype: string;
  custom_entity_type: string;
  custom_entity_subtype: string;
  entity_name: string;
  registration_number: string;
  ownership_percent: number;
  estimated_value: number;
  advisor_name: string;
  advisor_contact: string;
  notes: string;
  file_path: string;
};

type BusinessInterestRow = {
  id: string;
  entity_type: string | null;
  entity_subtype: string | null;
  custom_entity_type: string | null;
  custom_entity_subtype: string | null;
  entity_name: string | null;
  registration_number: string | null;
  ownership_percent: number | null;
  estimated_value: number | null;
  advisor_name: string | null;
  advisor_contact: string | null;
  notes: string | null;
  file_path: string | null;
};

const EMPTY: Omit<BusinessInterest, "id"> = {
  entity_type: "company",
  entity_subtype: "",
  custom_entity_type: "",
  custom_entity_subtype: "",
  entity_name: "",
  registration_number: "",
  ownership_percent: 0,
  estimated_value: 0,
  advisor_name: "",
  advisor_contact: "",
  notes: "",
  file_path: "",
};

function mapBusinessRow(row: BusinessInterestRow): BusinessInterest {
  return {
    id: row.id,
    entity_type: row.entity_type ?? "company",
    entity_subtype: row.entity_subtype ?? "",
    custom_entity_type: row.custom_entity_type ?? "",
    custom_entity_subtype: row.custom_entity_subtype ?? "",
    entity_name: row.entity_name ?? "",
    registration_number: row.registration_number ?? "",
    ownership_percent: Number(row.ownership_percent ?? 0),
    estimated_value: Number(row.estimated_value ?? 0),
    advisor_name: row.advisor_name ?? "",
    advisor_contact: row.advisor_contact ?? "",
    notes: row.notes ?? "",
    file_path: row.file_path ?? "",
  };
}

export default function BusinessVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<BusinessInterest[]>([]);
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
          .from("business_interests")
          .select("id,entity_type,entity_subtype,custom_entity_type,custom_entity_subtype,entity_name,registration_number,ownership_percent,estimated_value,advisor_name,advisor_contact,notes,file_path")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!mounted) return;

        if (error) {
          setItems([]);
          setShowForm(true);
          setStatus("⚠️ Could not load business records yet (table may not exist).");
        } else {
          const mapped = ((data ?? []) as BusinessInterestRow[]).map(mapBusinessRow);
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

  const startEdit = (item: BusinessInterest) => {
    setShowForm(true);
    setEditingId(item.id);
    setForm({
      entity_type: item.entity_type,
      entity_subtype: item.entity_subtype,
      custom_entity_type: item.custom_entity_type,
      custom_entity_subtype: item.custom_entity_subtype,
      entity_name: item.entity_name,
      registration_number: item.registration_number,
      ownership_percent: Number(item.ownership_percent || 0),
      estimated_value: Number(item.estimated_value || 0),
      advisor_name: item.advisor_name,
      advisor_contact: item.advisor_contact,
      notes: item.notes,
      file_path: item.file_path,
    });
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reload = async (userId: string) => {
    try {
    const { data, error } = await supabase
      .from("business_interests")
      .select("id,entity_type,entity_subtype,custom_entity_type,custom_entity_subtype,entity_name,registration_number,ownership_percent,estimated_value,advisor_name,advisor_contact,notes,file_path")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        setStatus("✅ Saved, but refresh failed");
        return;
      }

      setItems(((data ?? []) as BusinessInterestRow[]).map(mapBusinessRow));
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
        entity_type: form.entity_type,
        entity_subtype: form.entity_subtype || null,
        custom_entity_type: form.entity_type === "other" ? form.custom_entity_type || null : null,
        custom_entity_subtype:
          form.entity_subtype === "other" ? form.custom_entity_subtype || null : null,
        entity_name: form.entity_name || null,
        registration_number: form.registration_number || null,
        ownership_percent: Number(form.ownership_percent || 0),
        estimated_value: Number(form.estimated_value || 0),
        advisor_name: form.advisor_name || null,
        advisor_contact: form.advisor_contact || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      const res = editingId
        ? await supabase.from("business_interests").update(payload).eq("id", editingId).eq("user_id", user.id)
        : await supabase.from("business_interests").insert(payload);

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
    const ok = window.confirm("Delete this business record?");
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

      const { error } = await supabase.from("business_interests").delete().eq("id", id).eq("user_id", user.id);
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
    const filePath = `${userData.user.id}/business/${Date.now()}-${sanitizeFileName(file.name)}`;
    const upload = await supabase.storage.from("vault-docs").upload(filePath, file, { upsert: false });
    if (upload.error) {
      setStatus(`❌ Upload failed: ${upload.error.message}`);
      return;
    }
    const { error } = await supabase
      .from("business_interests")
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
    a.download = path.split("/").pop() || "business-document";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1040 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Business Vault</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>
          Record company, partnership and ownership details so executors can identify business
          interests quickly.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button onClick={() => setShowForm(true)} style={primaryBtn}>Add business record</button>
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

      {fatalError ? <div style={{ color: "#b91c1c", fontSize: 13 }}>❌ Runtime error: {fatalError}</div> : null}
      {status && !showForm ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div>
      ) : null}

      <section style={card}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={cardTitle}>Your business interests</h2>
          <p style={cardText}>
            Keep one record per entity. Add estimated value, ownership and advisor context to
            simplify estate handling.
          </p>
        </div>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No business records added yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} style={rowStyle}>
                <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 800 }}>
                    {item.entity_name || "(Entity name not set)"}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {[item.entity_type === "other"
                      ? item.custom_entity_type || "Other entity"
                      : labelForEntityType(item.entity_type),
                      item.entity_subtype
                        ? item.entity_subtype === "other"
                          ? item.custom_entity_subtype || "Other subtype"
                          : optionLabel(
                              businessSubtypes[item.entity_type] ?? [],
                              item.entity_subtype,
                              item.entity_subtype,
                            )
                        : null,
                      item.registration_number ? `Reg: ${item.registration_number}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    Ownership: {Number(item.ownership_percent || 0).toFixed(2)}% · Value:{" "}
                    {safeFormatCurrency(item.estimated_value)}
                  </div>
                  {(item.advisor_name || item.advisor_contact) && (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {[item.advisor_name ? `Advisor: ${item.advisor_name}` : null,
                        item.advisor_contact ? `Contact: ${item.advisor_contact}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
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
          <div style={{ color: "#6b7280", fontSize: 13 }}>Use “Add business record” above to create a record.</div>
        ) : null}
      </section>

      {showForm ? (
        <section style={card}>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={cardTitle}>{editingId ? "Edit business record" : "Business details"}</h2>
            <p style={cardText}>
              Add summary details for each business interest. Keep notes concise and practical for
              executor use.
            </p>
          </div>

          <div style={fieldGrid}>
            <Field label="Entity type">
              <select
                value={form.entity_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    entity_type: e.target.value,
                    entity_subtype: "",
                    custom_entity_type: e.target.value === "other" ? form.custom_entity_type : "",
                    custom_entity_subtype: "",
                  })
                }
                style={inputStyle}
              >
                {businessTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {form.entity_type === "other" ? (
              <Field label="Custom entity type">
                <input
                  value={form.custom_entity_type}
                  onChange={(e) => setForm({ ...form, custom_entity_type: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Family investment vehicle"
                />
              </Field>
            ) : null}

            {(businessSubtypes[form.entity_type] ?? []).length > 0 ? (
              <Field label="Entity subtype">
                <select
                  value={form.entity_subtype}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      entity_subtype: e.target.value,
                      custom_entity_subtype: e.target.value === "other" ? form.custom_entity_subtype : "",
                    })
                  }
                  style={inputStyle}
                >
                  <option value="">Select subtype</option>
                  {(businessSubtypes[form.entity_type] ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {form.entity_subtype === "other" ? (
              <Field label="Custom entity subtype">
                <input
                  value={form.custom_entity_subtype}
                  onChange={(e) => setForm({ ...form, custom_entity_subtype: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Holding structure"
                />
              </Field>
            ) : null}

            <Field label="Entity name">
              <input
                value={form.entity_name}
                onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                style={inputStyle}
                placeholder="e.g. Legacy Fortress Ltd"
              />
            </Field>

            <Field label="Registration number">
              <input
                value={form.registration_number}
                onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                style={inputStyle}
                placeholder="e.g. 12345678"
              />
            </Field>

            <Field label="Ownership percent">
              <input
                type="number"
                step="0.01"
                value={String(form.ownership_percent)}
                onChange={(e) => setForm({ ...form, ownership_percent: Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>

            <Field label="Estimated value (GBP)">
              <input
                type="number"
                step="0.01"
                value={String(form.estimated_value)}
                onChange={(e) => setForm({ ...form, estimated_value: Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>

            <Field label="Advisor name">
              <input
                value={form.advisor_name}
                onChange={(e) => setForm({ ...form, advisor_name: e.target.value })}
                style={inputStyle}
                placeholder="e.g. Jane Smith"
              />
            </Field>

            <Field label="Advisor contact">
              <input
                value={form.advisor_contact}
                onChange={(e) => setForm({ ...form, advisor_contact: e.target.value })}
                style={inputStyle}
                placeholder="Email or phone"
              />
            </Field>
          </div>

          <Field label="Notes">
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={inputStyle}
              placeholder="Optional context for executors"
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

function safeFormatCurrency(value: number) {
  try {
    return formatCurrency(Number(value || 0), "GBP");
  } catch {
    return "£0.00";
  }
}

function labelForEntityType(type: string) {
  switch (type) {
    case "company":
      return "Company";
    case "partnership":
      return "Partnership";
    case "sole_trader":
      return "Sole trader";
    case "shareholding":
      return "Shareholding";
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
