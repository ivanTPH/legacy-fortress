"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { waitForActiveUser } from "../../lib/auth/session";
import { trackClientEvent } from "../../lib/observability/clientEvents";
import { supabase } from "../../lib/supabaseClient";
import { isMissingRelationError, toSafeSupabaseMessage } from "../../lib/supabaseErrors";
import { formatCurrency } from "../../lib/currency";
import { sanitizeFileName, validateUploadFile } from "../../lib/validation/upload";

type SectionEntry = {
  id: string;
  title: string;
  summary: string;
  estimated_value: number;
  details_text: string;
  file_path: string;
  created_at: string;
};

type SectionEntryRow = {
  id: string;
  title: string | null;
  summary: string | null;
  estimated_value: number | null;
  details: Record<string, unknown> | null;
  file_path: string | null;
  created_at: string | null;
};

type SectionWorkspaceProps = {
  sectionKey: string;
  categoryKey: string;
  title: string;
  subtitle: string;
  addLabel?: string;
  uploadsRequireCanonicalParent?: boolean;
  uploadBlockedMessage?: string;
};

const EMPTY_FORM = {
  title: "",
  summary: "",
  estimated_value: "0",
  details_text: "",
};

export default function SectionWorkspace({
  sectionKey,
  categoryKey,
  title,
  subtitle,
  addLabel = "Add record",
  uploadsRequireCanonicalParent = false,
  uploadBlockedMessage = "Uploads are blocked until a canonical parent asset can be selected.",
}: SectionWorkspaceProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<SectionEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [tableUnavailable, setTableUnavailable] = useState(false);
  const directUploadsEnabled = !uploadsRequireCanonicalParent;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setStatus("");
      const user = await requireUser(router);
      if (!user) return;

      const { data, error } = await supabase
        .from("section_entries")
        .select("id,title,summary,estimated_value,details,file_path,created_at")
        .eq("user_id", user.id)
        .eq("section_key", sectionKey)
        .eq("category_key", categoryKey)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        setRows([]);
        if (isMissingRelationError(error, "section_entries")) {
          setTableUnavailable(true);
          trackClientEvent("schema.drift.detected", { relation: "section_entries", source: "workspace.load" });
          setStatus("This section is temporarily unavailable while data tables are being prepared. Please try again shortly.");
        } else {
          setStatus(`⚠️ Could not load records: ${toSafeSupabaseMessage(error, "Unknown error")}`);
        }
      } else {
        setTableUnavailable(false);
        const mapped = ((data ?? []) as SectionEntryRow[]).map((row) => ({
          id: row.id,
          title: row.title ?? "",
          summary: row.summary ?? "",
          estimated_value: Number(row.estimated_value ?? 0),
          details_text: String((row.details?.details_text as string | undefined) ?? ""),
          file_path: row.file_path ?? "",
          created_at: row.created_at ?? "",
        }));
        setRows(mapped);
      }
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [router, sectionKey, categoryKey]);

  const totalValue = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.estimated_value ?? 0), 0),
    [rows],
  );

  async function reload() {
    if (tableUnavailable) return;
    const user = await requireUser(router);
    if (!user) return;
    const { data, error } = await supabase
      .from("section_entries")
      .select("id,title,summary,estimated_value,details,file_path,created_at")
      .eq("user_id", user.id)
      .eq("section_key", sectionKey)
      .eq("category_key", categoryKey)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingRelationError(error, "section_entries")) {
        setTableUnavailable(true);
        trackClientEvent("schema.drift.detected", { relation: "section_entries", source: "workspace.reload" });
        setStatus("This section is temporarily unavailable while data tables are being prepared.");
      }
      return;
    }
    setRows(
      ((data ?? []) as SectionEntryRow[]).map((row) => ({
        id: row.id,
        title: row.title ?? "",
        summary: row.summary ?? "",
        estimated_value: Number(row.estimated_value ?? 0),
        details_text: String((row.details?.details_text as string | undefined) ?? ""),
        file_path: row.file_path ?? "",
        created_at: row.created_at ?? "",
      })),
    );
  }

  async function save() {
    if (tableUnavailable) {
      setStatus("Cannot save yet. Section data table is unavailable.");
      return;
    }
    setSaving(true);
    setStatus("");
    const user = await requireUser(router);
    if (!user) {
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      section_key: sectionKey,
      category_key: categoryKey,
      title: form.title.trim() || null,
      summary: form.summary.trim() || null,
      estimated_value: Number(form.estimated_value || 0),
      details: { details_text: form.details_text.trim() || "" },
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("section_entries").update(payload).eq("id", editingId).eq("user_id", user.id)
      : await supabase.from("section_entries").insert(payload);

    if (result.error) {
      if (isMissingRelationError(result.error, "section_entries")) {
        setTableUnavailable(true);
        trackClientEvent("schema.drift.detected", { relation: "section_entries", source: "workspace.save" });
        setStatus("Cannot save right now because this section table is unavailable.");
      } else {
        setStatus(`❌ Save failed: ${toSafeSupabaseMessage(result.error, "Unknown error")}`);
      }
      setSaving(false);
      return;
    }

    setStatus("✅ Saved");
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    await reload();
    setSaving(false);
  }

  async function remove(id: string) {
    if (tableUnavailable) return;
    const ok = window.confirm("Delete this record?");
    if (!ok) return;

    const user = await requireUser(router);
    if (!user) return;

    const current = rows.find((row) => row.id === id);
    if (current?.file_path) {
      await supabase.storage.from("vault-docs").remove([current.file_path]);
    }

    const { error } = await supabase.from("section_entries").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      if (isMissingRelationError(error, "section_entries")) {
        setTableUnavailable(true);
        trackClientEvent("schema.drift.detected", { relation: "section_entries", source: "workspace.delete" });
        setStatus("Cannot delete right now because this section table is unavailable.");
      } else {
        setStatus(`❌ Delete failed: ${toSafeSupabaseMessage(error, "Unknown error")}`);
      }
      return;
    }

    setStatus("✅ Deleted");
    setRows((prev) => prev.filter((row) => row.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setShowForm(false);
    }
  }

  function startEdit(row: SectionEntry) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      summary: row.summary,
      estimated_value: String(row.estimated_value),
      details_text: row.details_text,
    });
    setShowForm(true);
  }

  async function uploadLegacyAttachment(rowId: string, file: File) {
    if (tableUnavailable) {
      setStatus("Upload unavailable until section data tables are ready.");
      return;
    }
    const validation = validateUploadFile(file, {
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: 10 * 1024 * 1024,
    });
    if (!validation.ok) {
      setStatus(`❌ ${validation.error}. Allowed: PDF, JPG, PNG up to 10MB.`);
      return;
    }

    const user = await requireUser(router);
    if (!user) return;

    setUploadingFor(rowId);
    setStatus("");
    const filePath = `${user.id}/section/${sectionKey}/${categoryKey}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const upload = await supabase.storage.from("vault-docs").upload(filePath, file, { upsert: false });
    if (upload.error) {
      setUploadingFor(null);
      setStatus(`❌ Upload failed: ${upload.error.message}`);
      return;
    }

    const { error } = await supabase
      .from("section_entries")
      .update({ file_path: filePath, updated_at: new Date().toISOString() })
      .eq("id", rowId)
      .eq("user_id", user.id);

    setUploadingFor(null);
    if (error) {
      if (isMissingRelationError(error, "section_entries")) {
        setTableUnavailable(true);
        trackClientEvent("schema.drift.detected", { relation: "section_entries", source: "workspace.upload" });
        setStatus("File uploaded but record linkage is unavailable because the section table is missing.");
      } else {
        setStatus(`❌ Upload linked failed: ${toSafeSupabaseMessage(error, "Unknown error")}`);
      }
      return;
    }

    setStatus("✅ File uploaded");
    await reload();
  }

  async function downloadAttachment(path: string) {
    const { data, error } = await supabase.storage.from("vault-docs").download(path);
    if (error || !data) {
      setStatus(`❌ Download failed: ${error?.message ?? "Unknown error"}`);
      return;
    }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = path.split("/").pop() || "document";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{subtitle}</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button style={primaryBtn} onClick={() => setShowForm(true)} disabled={tableUnavailable}>{addLabel}</button>
        {showForm ? <button style={ghostBtn} onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}>Cancel</button> : null}
        <span style={{ color: "#64748b", fontSize: 13 }}>Total tracked value: {formatCurrency(totalValue, "GBP")}</span>
      </div>

      {status ? <div style={{ color: "#64748b", fontSize: 13 }}>{status}</div> : null}

      {showForm && !tableUnavailable ? (
        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{editingId ? "Edit record" : "Add record"}</h2>
          <div className="lf-content-grid">
            <label style={fieldStyle}><span style={labelStyle}>Title</span><input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label style={fieldStyle}><span style={labelStyle}>Summary</span><input style={inputStyle} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
            <label style={fieldStyle}><span style={labelStyle}>Estimated value</span><input type="number" style={inputStyle} value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></label>
            <label style={fieldStyle}><span style={labelStyle}>Details</span><textarea style={textAreaStyle} value={form.details_text} onChange={(e) => setForm({ ...form, details_text: e.target.value })} /></label>
          </div>
          <button style={primaryBtn} disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save record"}</button>
        </section>
      ) : null}

      {loading || tableUnavailable || rows.length > 0 ? (
      <section style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Saved records</h2>
        {loading ? <div style={{ color: "#64748b" }}>Loading records...</div> : null}
        {!loading && tableUnavailable ? <div style={{ color: "#64748b" }}>Section table unavailable. Run latest migrations and refresh.</div> : null}
        {!loading && !tableUnavailable && rows.length === 0 ? <div style={{ color: "#64748b" }}>No records yet.</div> : null}
        {!loading && !tableUnavailable ? (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <article key={row.id} style={rowCardStyle}>
                <div style={{ display: "grid", gap: 3 }}>
                  <div style={{ fontWeight: 700 }}>{row.title || "Untitled record"}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{row.summary || "No summary provided."}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>
                  Added {formatDate(row.created_at)} · {formatCurrency(row.estimated_value, "GBP")}
                </div>
                {!directUploadsEnabled ? (
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Parent asset required: attach documents from the relevant asset workspace.
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={ghostBtn} onClick={() => startEdit(row)}>Edit</button>
                  <button style={dangerBtn} onClick={() => void remove(row.id)}>Delete</button>
                  {!directUploadsEnabled ? (
                    <button
                      type="button"
                      style={ghostBtn}
                      onClick={() => setStatus(uploadBlockedMessage)}
                    >
                      Attach from asset
                    </button>
                  ) : (
                    <label style={ghostBtn}>
                      {uploadingFor === row.id ? "Uploading..." : "Upload file"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadLegacyAttachment(row.id, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  )}
                  {row.file_path ? <button style={ghostBtn} onClick={() => void downloadAttachment(row.file_path)}>View / download</button> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
      ) : null}
    </section>
  );
}

async function requireUser(router: ReturnType<typeof useRouter>) {
  const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
  if (!user) {
    router.replace("/signin");
    return null;
  }
  return user;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const rowCardStyle: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
  display: "grid",
  gap: 10,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const inputStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 14,
  width: "100%",
};

const textAreaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 90,
  resize: "vertical",
};

const primaryBtn: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const dangerBtn: CSSProperties = {
  ...ghostBtn,
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff1f2",
};
