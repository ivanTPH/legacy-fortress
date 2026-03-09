"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "../../../../lib/currency";
import { propertyTypeOptions } from "../../../../lib/categoryConfig";
import { supabase } from "../../../../lib/supabaseClient";
import { getSafeUserData } from "../../../../lib/auth/requireActiveUser";
import { sanitizeFileName, validateUploadFile } from "../../../../lib/validation/upload";

type PropertyAsset = {
  id: string;
  property_type: string;
  custom_property_type: string;
  address: string;
  ownership_type: string;
  estimated_value: number;
  mortgage_lender: string;
  mortgage_balance: number;
  insurance_provider: string;
  policy_number: string;
  notes: string;
  file_path: string;
};

type PropertyAssetRow = {
  id: string;
  property_type: string | null;
  custom_property_type: string | null;
  address: string | null;
  ownership_type: string | null;
  estimated_value: number | null;
  mortgage_lender: string | null;
  mortgage_balance: number | null;
  insurance_provider: string | null;
  policy_number: string | null;
  notes: string | null;
  file_path: string | null;
};

const EMPTY: Omit<PropertyAsset, "id"> = {
  property_type: "home",
  custom_property_type: "",
  address: "",
  ownership_type: "sole",
  estimated_value: 0,
  mortgage_lender: "",
  mortgage_balance: 0,
  insurance_provider: "",
  policy_number: "",
  notes: "",
  file_path: "",
};

function mapPropertyAssetRow(row: PropertyAssetRow): PropertyAsset {
  return {
    id: row.id,
    property_type: row.property_type ?? "home",
    custom_property_type: row.custom_property_type ?? "",
    address: row.address ?? "",
    ownership_type: row.ownership_type ?? "sole",
    estimated_value: Number(row.estimated_value ?? 0),
    mortgage_lender: row.mortgage_lender ?? "",
    mortgage_balance: Number(row.mortgage_balance ?? 0),
    insurance_provider: row.insurance_provider ?? "",
    policy_number: row.policy_number ?? "",
    notes: row.notes ?? "",
    file_path: row.file_path ?? "",
  };
}

export default function PropertyVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<PropertyAsset[]>([]);
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
        const { data: userData, error: authError } = await getSafeUserData(supabase);
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
          .from("property_assets")
          .select("id,property_type,custom_property_type,address,ownership_type,estimated_value,mortgage_lender,mortgage_balance,insurance_provider,policy_number,notes,file_path")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!mounted) return;

        if (error) {
          setItems([]);
          setShowForm(true);
          setStatus("⚠️ Could not load property records yet (table may not exist).");
        } else {
          const mapped = ((data ?? []) as PropertyAssetRow[]).map(mapPropertyAssetRow);
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

  const startEdit = (item: PropertyAsset) => {
    setShowForm(true);
    setEditingId(item.id);
    setForm({
      property_type: item.property_type,
      custom_property_type: item.custom_property_type,
      address: item.address,
      ownership_type: item.ownership_type,
      estimated_value: Number(item.estimated_value || 0),
      mortgage_lender: item.mortgage_lender,
      mortgage_balance: Number(item.mortgage_balance || 0),
      insurance_provider: item.insurance_provider,
      policy_number: item.policy_number,
      notes: item.notes,
      file_path: item.file_path,
    });
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reloadAssets = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("property_assets")
        .select("id,property_type,custom_property_type,address,ownership_type,estimated_value,mortgage_lender,mortgage_balance,insurance_provider,policy_number,notes,file_path")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        setStatus("✅ Saved, but refresh failed");
        return;
      }

      setItems(((data ?? []) as PropertyAssetRow[]).map(mapPropertyAssetRow));
    } catch (error) {
      setStatus(`✅ Saved, but refresh failed (${error instanceof Error ? error.message : "unknown error"})`);
    }
  };

  const save = async () => {
    setSaving(true);
    setStatus("");

    try {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
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
        property_type: form.property_type,
        custom_property_type: form.property_type === "other" ? form.custom_property_type || null : null,
        address: form.address || null,
        ownership_type: form.ownership_type || null,
        estimated_value: Number(form.estimated_value || 0),
        mortgage_lender: form.mortgage_lender || null,
        mortgage_balance: Number(form.mortgage_balance || 0),
        insurance_provider: form.insurance_provider || null,
        policy_number: form.policy_number || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      const res = editingId
        ? await supabase.from("property_assets").update(payload).eq("id", editingId).eq("user_id", user.id)
        : await supabase.from("property_assets").insert(payload);

      if (res.error) {
        setStatus("❌ Save failed: " + res.error.message);
        return;
      }

      await reloadAssets(user.id);
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
    const ok = window.confirm("Delete this property record?");
    if (!ok) return;

    try {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError) throw authError;
      const user = userData.user;
      if (!user) {
        setStatus("Your session has expired. Redirecting to sign in...");
        router.replace("/signin");
        return;
      }

      const { error } = await supabase.from("property_assets").delete().eq("id", id).eq("user_id", user.id);
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

    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const filePath = `${userData.user.id}/property/${Date.now()}-${sanitizeFileName(file.name)}`;
    const upload = await supabase.storage.from("vault-docs").upload(filePath, file, { upsert: false });
    if (upload.error) {
      setStatus(`❌ Upload failed: ${upload.error.message}`);
      return;
    }

    const { error } = await supabase
      .from("property_assets")
      .update({ file_path: filePath, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("user_id", userData.user.id);
    if (error) {
      setStatus(`❌ Upload link failed: ${error.message}`);
      return;
    }

    await reloadAssets(userData.user.id);
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
    a.download = path.split("/").pop() || "property-document";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1040 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Property Vault</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>
          Capture homes, ownership details, mortgage context and key service providers so executors
          can act quickly.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button onClick={() => setShowForm(true)} style={primaryBtn}>Add property</button>
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
          <h2 style={cardTitle}>Your properties</h2>
          <p style={cardText}>
            Keep one record per property. Add estimated values and mortgage details for quick estate
            visibility.
          </p>
        </div>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No property records added yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} style={rowStyle}>
                <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 800 }}>
                    {item.address || "(Address not set)"}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {[item.property_type === "other" ? item.custom_property_type || "Other property" : labelForPropertyType(item.property_type), labelForOwnership(item.ownership_type)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {item.address ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>{item.address}</div>
                  ) : null}
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    Value: {safeFormatCurrency(item.estimated_value)} · Mortgage:{" "}
                    {safeFormatCurrency(item.mortgage_balance)}
                  </div>
                  {(item.mortgage_lender || item.insurance_provider || item.policy_number) && (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {[item.mortgage_lender ? `Lender: ${item.mortgage_lender}` : null,
                        item.insurance_provider ? `Insurance: ${item.insurance_provider}` : null,
                        item.policy_number ? `Policy: ${item.policy_number}` : null]
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

        {!showForm ? <div style={{ color: "#6b7280", fontSize: 13 }}>Use “Add property” above to create a record.</div> : null}
      </section>

      {showForm ? (
        <section style={card}>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={cardTitle}>{editingId ? "Edit property" : "Property details"}</h2>
            <p style={cardText}>
              Add summary-level information for each property. Documents can be linked in later
              iterations.
            </p>
          </div>

          <div style={fieldGrid}>
            <Field label="Property type">
              <select
                value={form.property_type}
                onChange={(e) => setForm({ ...form, property_type: e.target.value, custom_property_type: e.target.value === "other" ? form.custom_property_type : "" })}
                style={inputStyle}
              >
                {propertyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {form.property_type === "other" ? (
              <Field label="Custom property type">
                <input
                  value={form.custom_property_type}
                  onChange={(e) => setForm({ ...form, custom_property_type: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Holiday lodge"
                />
              </Field>
            ) : null}

            <Field label="Ownership type">
              <select
                value={form.ownership_type}
                onChange={(e) => setForm({ ...form, ownership_type: e.target.value })}
                style={inputStyle}
              >
                <option value="sole">Sole ownership</option>
                <option value="joint">Joint ownership</option>
                <option value="trust">Held in trust</option>
                <option value="other">Other</option>
              </select>
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

            <Field label="Mortgage lender">
              <input
                value={form.mortgage_lender}
                onChange={(e) => setForm({ ...form, mortgage_lender: e.target.value })}
                style={inputStyle}
                placeholder="e.g. Halifax"
              />
            </Field>

            <Field label="Mortgage balance (GBP)">
              <input
                type="number"
                step="0.01"
                value={String(form.mortgage_balance)}
                onChange={(e) => setForm({ ...form, mortgage_balance: Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>

            <Field label="Insurance provider">
              <input
                value={form.insurance_provider}
                onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })}
                style={inputStyle}
                placeholder="e.g. Aviva"
              />
            </Field>

            <Field label="Policy number">
              <input
                value={form.policy_number}
                onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
                style={inputStyle}
                placeholder="e.g. HOM-123456"
              />
            </Field>
          </div>

          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              style={inputStyle}
              placeholder="Street, city, postcode"
            />
          </Field>

          <Field label="Notes">
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={inputStyle}
              placeholder="Optional notes for executor context"
            />
          </Field>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={save} disabled={saving} style={primaryBtn}>
              {saving ? "Saving..." : editingId ? "Update property" : "Save property"}
            </button>
            {status ? <span style={{ color: "#6b7280", fontSize: 13 }}>{status}</span> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function safeFormatCurrency(value: number) {
  try {
    return formatCurrency(Number(value || 0), "GBP");
  } catch {
    return "£0.00";
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}

function labelForPropertyType(type: string) {
  switch (type) {
    case "home":
      return "Home";
    case "rental":
      return "Rental";
    case "commercial":
      return "Commercial";
    case "land":
      return "Land";
    default:
      return "Other";
  }
}

function labelForOwnership(type: string) {
  switch (type) {
    case "sole":
      return "Sole ownership";
    case "joint":
      return "Joint ownership";
    case "trust":
      return "Held in trust";
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
