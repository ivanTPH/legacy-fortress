"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  optionLabel,
  personalPossessionCategories,
  personalPossessionSubcategories,
} from "../../../../lib/categoryConfig";
import { formatCurrency } from "../../../../lib/currency";
import { supabase } from "../../../../lib/supabaseClient";
import { sanitizeFileName, validateUploadFile } from "../../../../lib/validation/upload";

type PersonalProfile = {
  full_name: string;
  date_of_birth: string;
  ni_number: string;
  address: string;
  phone: string;
  next_of_kin: string;
};

type PersonalProfileRow = {
  full_name: string | null;
  date_of_birth: string | null;
  ni_number: string | null;
  address: string | null;
  phone: string | null;
  next_of_kin: string | null;
};

type PossessionItem = {
  id: string;
  possession_type: string;
  subcategory: string;
  custom_category: string;
  custom_subcategory: string;
  item_name: string;
  item_details: string;
  estimated_value: number;
  notes: string;
  file_path: string;
};

type PossessionItemRow = {
  id: string;
  possession_type: string | null;
  subcategory: string | null;
  custom_category: string | null;
  custom_subcategory: string | null;
  item_name: string | null;
  item_details: string | null;
  estimated_value: number | null;
  notes: string | null;
  file_path: string | null;
};

const EMPTY_PROFILE: PersonalProfile = {
  full_name: "",
  date_of_birth: "",
  ni_number: "",
  address: "",
  phone: "",
  next_of_kin: "",
};

const EMPTY_POSSESSION: Omit<PossessionItem, "id"> = {
  possession_type: "watches",
  subcategory: "",
  custom_category: "",
  custom_subcategory: "",
  item_name: "",
  item_details: "",
  estimated_value: 0,
  notes: "",
  file_path: "",
};

function mapPossessionRow(row: PossessionItemRow): PossessionItem {
  return {
    id: row.id,
    possession_type: row.possession_type ?? "watches",
    subcategory: row.subcategory ?? "",
    custom_category: row.custom_category ?? "",
    custom_subcategory: row.custom_subcategory ?? "",
    item_name: row.item_name ?? "",
    item_details: row.item_details ?? "",
    estimated_value: Number(row.estimated_value ?? 0),
    notes: row.notes ?? "",
    file_path: row.file_path ?? "",
  };
}

export default function PersonalVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPossession, setSavingPossession] = useState(false);
  const [status, setStatus] = useState("");

  const [profile, setProfile] = useState<PersonalProfile>(EMPTY_PROFILE);

  const [possessions, setPossessions] = useState<PossessionItem[]>([]);
  const [possessionForm, setPossessionForm] = useState(EMPTY_POSSESSION);
  const [showPossessionForm, setShowPossessionForm] = useState(false);
  const [editingPossessionId, setEditingPossessionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
      try {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = userData.user;

        if (!user) {
          router.replace("/signin");
          return;
        }

        const [profileRes, possessionsRes] = await Promise.all([
          supabase
            .from("personal_profiles")
            .select("full_name,date_of_birth,ni_number,address,phone,next_of_kin")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("personal_possessions")
            .select("id,possession_type,subcategory,custom_category,custom_subcategory,item_name,item_details,estimated_value,notes,file_path")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (!mounted) return;

        if (profileRes.error) {
          setStatus("⚠️ Could not load personal profile yet (table may not exist).");
        } else if (profileRes.data) {
          const row = profileRes.data as PersonalProfileRow;
          setProfile({
            full_name: row.full_name ?? "",
            date_of_birth: row.date_of_birth ?? "",
            ni_number: row.ni_number ?? "",
            address: row.address ?? "",
            phone: row.phone ?? "",
            next_of_kin: row.next_of_kin ?? "",
          });
        }

        if (possessionsRes.error) {
          setPossessions([]);
          setStatus((prev) =>
            prev
              ? `${prev} | ⚠️ Possessions could not load yet (table may not exist).`
              : "⚠️ Possessions could not load yet (table may not exist)."
          );
          setShowPossessionForm(true);
        } else {
          const mapped = ((possessionsRes.data ?? []) as PossessionItemRow[]).map(mapPossessionRow);
          setPossessions(mapped);
          if (mapped.length === 0) {
            setShowPossessionForm(true);
          }
        }
      } catch (error) {
        if (!mounted) return;
        setStatus(`⚠️ Could not load personal area: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setStatus("");

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = userData.user;

      if (!user) {
        router.replace("/signin");
        return;
      }

      const payload = { user_id: user.id, ...profile };

      const { error } = await supabase
        .from("personal_profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) setStatus("❌ Save failed: " + error.message);
      else setStatus("✅ Personal profile saved");
    } catch (error) {
      setStatus(`❌ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const resetPossessionForm = () => {
    setPossessionForm(EMPTY_POSSESSION);
    setEditingPossessionId(null);
    setShowPossessionForm(false);
  };

  const savePossession = async () => {
    setSavingPossession(true);
    setStatus("");

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = userData.user;

      if (!user) {
        router.replace("/signin");
        return;
      }

      const payload = {
        user_id: user.id,
        possession_type: possessionForm.possession_type,
        subcategory: possessionForm.subcategory || null,
        custom_category:
          possessionForm.possession_type === "other" ? possessionForm.custom_category || null : null,
        custom_subcategory:
          possessionForm.subcategory === "other" ? possessionForm.custom_subcategory || null : null,
        item_name: possessionForm.item_name || null,
        item_details: possessionForm.item_details || null,
        estimated_value: Number(possessionForm.estimated_value || 0),
        notes: possessionForm.notes || null,
        updated_at: new Date().toISOString(),
      };

      const res = editingPossessionId
        ? await supabase
            .from("personal_possessions")
            .update(payload)
            .eq("id", editingPossessionId)
            .eq("user_id", user.id)
        : await supabase.from("personal_possessions").insert(payload);

      if (res.error) {
        setStatus("❌ Possession save failed: " + res.error.message);
        return;
      }

      const { data, error } = await supabase
        .from("personal_possessions")
        .select("id,possession_type,subcategory,custom_category,custom_subcategory,item_name,item_details,estimated_value,notes,file_path")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setStatus("✅ Saved, but possession refresh failed");
      } else {
        setPossessions(((data ?? []) as PossessionItemRow[]).map(mapPossessionRow));
        resetPossessionForm();
        setStatus("✅ Possession saved");
      }
    } catch (error) {
      setStatus(`❌ Possession save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSavingPossession(false);
    }
  };

  const editPossession = (item: PossessionItem) => {
    setShowPossessionForm(true);
    setEditingPossessionId(item.id);
    setPossessionForm({
      possession_type: item.possession_type,
      subcategory: item.subcategory,
      custom_category: item.custom_category,
      custom_subcategory: item.custom_subcategory,
      item_name: item.item_name,
      item_details: item.item_details,
      estimated_value: item.estimated_value,
      notes: item.notes,
      file_path: item.file_path,
    });
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removePossession = async (id: string) => {
    const ok = window.confirm("Delete this possession item?");
    if (!ok) return;

    setStatus("");

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = userData.user;
      if (!user) {
        router.replace("/signin");
        return;
      }

      const { error } = await supabase
        .from("personal_possessions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        setStatus("❌ Delete failed: " + error.message);
        return;
      }

      setPossessions((current) => current.filter((item) => item.id !== id));
      if (editingPossessionId === id) resetPossessionForm();
      setStatus("✅ Possession deleted");
    } catch (error) {
      setStatus(`❌ Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const uploadPossessionFile = async (id: string, file: File) => {
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

    const filePath = `${userData.user.id}/personal/${Date.now()}-${sanitizeFileName(file.name)}`;
    const upload = await supabase.storage.from("vault-docs").upload(filePath, file, { upsert: false });
    if (upload.error) {
      setStatus(`❌ Upload failed: ${upload.error.message}`);
      return;
    }

    const { error } = await supabase
      .from("personal_possessions")
      .update({ file_path: filePath, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userData.user.id);
    if (error) {
      setStatus(`❌ Upload link failed: ${error.message}`);
      return;
    }

    const refreshed = await supabase
      .from("personal_possessions")
      .select("id,possession_type,subcategory,custom_category,custom_subcategory,item_name,item_details,estimated_value,notes,file_path")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    setPossessions(((refreshed.data ?? []) as PossessionItemRow[]).map(mapPossessionRow));
    setStatus("✅ File uploaded");
  };

  const downloadPossessionFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("vault-docs").download(path);
    if (error || !data) {
      setStatus(`❌ Download failed: ${error?.message ?? "Unknown error"}`);
      return;
    }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = path.split("/").pop() || "possession-file";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const selectedSubcategories = personalPossessionSubcategories[possessionForm.possession_type] ?? [];
  const itemLabel = getItemLabel(possessionForm.possession_type);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 1040 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Personal Vault</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>
          Capture identity, family essentials, and possession categories so an executor can start
          quickly and locate key items.
        </p>
      </div>

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}

      <section style={card}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={cardTitle}>Personal profile</h2>
          <p style={cardText}>Identity and next-of-kin details used throughout the estate record.</p>
        </div>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading…</div>
        ) : (
          <>
            <div style={fieldGrid}>
              <Field label="Full name">
                <input
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  style={inputStyle}
                />
              </Field>

              <Field label="Date of birth">
                <input
                  value={profile.date_of_birth}
                  onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                  placeholder="YYYY-MM-DD"
                  style={inputStyle}
                />
              </Field>

              <Field label="National Insurance number">
                <input
                  value={profile.ni_number}
                  onChange={(e) => setProfile({ ...profile, ni_number: e.target.value })}
                  style={inputStyle}
                />
              </Field>

              <Field label="Phone">
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Address">
              <input
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                style={inputStyle}
              />
            </Field>

            <Field label="Next of kin">
              <input
                value={profile.next_of_kin}
                onChange={(e) => setProfile({ ...profile, next_of_kin: e.target.value })}
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={saveProfile} disabled={savingProfile} style={primaryBtn}>
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </div>
          </>
        )}
      </section>

      <section style={card}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={cardTitle}>Possessions</h2>
          <p style={cardText}>
            Follow the category-first flow from Personal reference screens: choose a possession type,
            then capture item details.
          </p>
        </div>

        <div style={fieldGrid}>
          <Field label="Possession type">
            <select
              value={possessionForm.possession_type}
              onChange={(e) =>
                setPossessionForm({
                  ...possessionForm,
                  possession_type: e.target.value,
                  subcategory: "",
                  custom_category: e.target.value === "other" ? possessionForm.custom_category : "",
                  custom_subcategory: "",
                })
              }
              style={inputStyle}
            >
              {personalPossessionCategories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          {possessionForm.possession_type === "other" ? (
            <Field label="Custom category">
              <input
                value={possessionForm.custom_category}
                onChange={(e) =>
                  setPossessionForm({ ...possessionForm, custom_category: e.target.value })
                }
                style={inputStyle}
                placeholder="e.g. Family heirloom"
              />
            </Field>
          ) : null}

          {selectedSubcategories.length > 0 ? (
            <Field label="Subcategory">
              <select
                value={possessionForm.subcategory}
                onChange={(e) =>
                  setPossessionForm({
                    ...possessionForm,
                    subcategory: e.target.value,
                    custom_subcategory:
                      e.target.value === "other" ? possessionForm.custom_subcategory : "",
                  })
                }
                style={inputStyle}
              >
                <option value="">Select subcategory</option>
                {selectedSubcategories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {possessionForm.subcategory === "other" ? (
            <Field label="Custom subcategory">
              <input
                value={possessionForm.custom_subcategory}
                onChange={(e) =>
                  setPossessionForm({ ...possessionForm, custom_subcategory: e.target.value })
                }
                style={inputStyle}
                placeholder="e.g. Racing vintage model"
              />
            </Field>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setShowPossessionForm(true)} style={primaryBtn}>Continue</button>
          {showPossessionForm ? (
            <button
              onClick={() => {
                resetPossessionForm();
                setStatus("");
              }}
              style={ghostBtn}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {showPossessionForm ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              {itemLabel} details and supporting context. Upload document handling can be layered in
              later without changing this category structure.
            </div>

            <div style={fieldGrid}>
              <Field label={itemLabel}>
                <input
                  value={possessionForm.item_name}
                  onChange={(e) =>
                    setPossessionForm({ ...possessionForm, item_name: e.target.value })
                  }
                  style={inputStyle}
                  placeholder={`e.g. ${itemLabel}`}
                />
              </Field>

              <Field label="Estimated value (GBP)">
                <input
                  type="number"
                  step="0.01"
                  value={String(possessionForm.estimated_value)}
                  onChange={(e) =>
                    setPossessionForm({
                      ...possessionForm,
                      estimated_value: Number(e.target.value),
                    })
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Details">
              <input
                value={possessionForm.item_details}
                onChange={(e) =>
                  setPossessionForm({ ...possessionForm, item_details: e.target.value })
                }
                style={inputStyle}
                placeholder="Model, serial number, storage location, authenticity details"
              />
            </Field>

            <Field label="Notes for executor">
              <input
                value={possessionForm.notes}
                onChange={(e) => setPossessionForm({ ...possessionForm, notes: e.target.value })}
                style={inputStyle}
                placeholder="Optional handover/retrieval notes"
              />
            </Field>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={savePossession} disabled={savingPossession} style={primaryBtn}>
                {savingPossession
                  ? "Saving…"
                  : editingPossessionId
                    ? "Update possession"
                    : "Save possession"}
              </button>
            </div>
          </div>
        ) : null}

        {possessions.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No possession records added yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {possessions.map((item) => (
              <div key={item.id} style={rowStyle}>
                <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 800 }}>{item.item_name || "(Unnamed possession)"}</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {[
                      item.possession_type === "other"
                        ? item.custom_category || "Other"
                        : optionLabel(personalPossessionCategories, item.possession_type),
                      item.subcategory
                        ? item.subcategory === "other"
                          ? item.custom_subcategory || "Other subtype"
                          : optionLabel(
                              personalPossessionSubcategories[item.possession_type] ?? [],
                              item.subcategory,
                              item.subcategory,
                            )
                        : null,
                      item.estimated_value
                        ? `Value: ${formatCurrency(item.estimated_value, "GBP")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {item.item_details ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>{item.item_details}</div>
                  ) : null}
                  {item.notes ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>{item.notes}</div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => editPossession(item)} style={ghostBtn}>Edit</button>
                  <button onClick={() => removePossession(item.id)} style={ghostBtn}>Delete</button>
                  <label style={ghostBtn}>
                    Upload
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadPossessionFile(item.id, file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {item.file_path ? <button onClick={() => void downloadPossessionFile(item.file_path)} style={ghostBtn}>View file</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getItemLabel(possessionType: string) {
  switch (possessionType) {
    case "watches":
      return "Watch";
    case "jewellery":
      return "Jewellery item";
    case "cars_vehicles":
      return "Vehicle";
    case "art":
      return "Art piece";
    case "electronics":
      return "Electronic item";
    case "pets":
      return "Pet record";
    default:
      return "Item";
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
