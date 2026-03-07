"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { legalSubtypes, legalTypeOptions } from "../../../../lib/categoryConfig";
import { supabase } from "../../../../lib/supabaseClient";
import { sanitizeFileName, validateUploadFile } from "../../../../lib/validation/upload";

type LegalDoc = {
  id: string;
  user_id: string;
  document_type: string | null;
  title: string | null;
  notes: string | null;
  file_path: string;
  created_at: string;
  document_date: string | null;
  document_subtype: string | null;
  custom_document_type: string | null;
  custom_document_subtype: string | null;
};

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

function fmtDateTime(s: string) {
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function fmtDateOnly(s: string | null) {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

export default function LegalVaultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [documentType, setDocumentType] = useState(searchParams.get("type") || "will");
  const [documentSubtype, setDocumentSubtype] = useState("");
  const [customDocumentType, setCustomDocumentType] = useState("");
  const [customDocumentSubtype, setCustomDocumentSubtype] = useState("");
  const [title, setTitle] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedExecutorIds, setSelectedExecutorIds] = useState<Record<string, boolean>>({});

  const [newExecName, setNewExecName] = useState("");
  const [newExecEmail, setNewExecEmail] = useState("");
  const [newExecPhone, setNewExecPhone] = useState("");
  const [savingExec, setSavingExec] = useState(false);

  const [contactEdits, setContactEdits] = useState<Record<string, { full_name: string; email: string; phone: string }>>({});
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const selectedExecutors = useMemo(() => {
    const ids = new Set(Object.keys(selectedExecutorIds).filter((id) => selectedExecutorIds[id]));
    return contacts.filter((c) => ids.has(c.id));
  }, [selectedExecutorIds, contacts]);

  const requireUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      router.replace("/signin");
      return null;
    }
    return data.user;
  }, [router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setStatus("");

    const user = await requireUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [docsRes, contactsRes] = await Promise.all([
      supabase
        .from("legal_documents")
        .select("id,user_id,document_type,title,notes,file_path,created_at,document_date,document_subtype,custom_document_type,custom_document_subtype")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contacts")
        .select("id,full_name,email,phone")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (docsRes.error) setStatus("⚠️ Could not load documents: " + docsRes.error.message);
    if (contactsRes.error) {
      setStatus((prev) =>
        prev
          ? `${prev} | ⚠️ Could not load contacts: ${contactsRes.error.message}`
          : `⚠️ Could not load contacts: ${contactsRes.error.message}`
      );
    }

    const docsData = (docsRes.data ?? []) as LegalDoc[];
    const contactsData = (contactsRes.data ?? []) as Contact[];

    setDocs(docsData);
    setContacts(contactsData);

    const edits: Record<string, { full_name: string; email: string; phone: string }> = {};
    for (const c of contactsData) {
      edits[c.id] = { full_name: c.full_name ?? "", email: c.email ?? "", phone: c.phone ?? "" };
    }
    setContactEdits(edits);

    setLoading(false);
  }, [requireUser]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const fromQuery = searchParams.get("type");
    if (!fromQuery) return;
    setDocumentType(fromQuery);
  }, [searchParams]);

  async function addExecutor() {
    setStatus("");
    const name = newExecName.trim();
    const email = newExecEmail.trim();
    const phone = newExecPhone.trim();

    if (!name) {
      setStatus("❗ Executor name is required.");
      return;
    }

    setSavingExec(true);
    try {
      const user = await requireUser();
      if (!user) return;

      let res;
      if (email) {
        res = await supabase
          .from("contacts")
          .upsert(
            { user_id: user.id, full_name: name, email, phone: phone || null },
            { onConflict: "user_id,email" }
          )
          .select("id,full_name,email,phone");
      } else {
        res = await supabase
          .from("contacts")
          .insert({ user_id: user.id, full_name: name, email: null, phone: phone || null })
          .select("id,full_name,email,phone");
      }

      if (res.error) {
        setStatus("❌ Could not save executor: " + res.error.message);
        return;
      }

      setNewExecName("");
      setNewExecEmail("");
      setNewExecPhone("");

      await loadAll();
      setStatus("✅ Executor saved");
    } finally {
      setSavingExec(false);
    }
  }

  async function saveContact(contactId: string) {
    setStatus("");
    const user = await requireUser();
    if (!user) return;

    const edit = contactEdits[contactId];
    if (!edit?.full_name?.trim()) {
      setStatus("❗ Name is required.");
      return;
    }

    const payload = {
      full_name: edit.full_name.trim(),
      email: edit.email.trim() || null,
      phone: edit.phone.trim() || null,
    };

    const { error } = await supabase.from("contacts").update(payload).eq("id", contactId).eq("user_id", user.id);
    if (error) {
      setStatus("❌ Save failed: " + error.message);
      return;
    }

    setEditingContactId(null);
    await loadAll();
    setStatus("✅ Executor updated");
  }

  async function deleteContact(contactId: string) {
    setStatus("");
    const ok = window.confirm("Delete this executor/contact?");
    if (!ok) return;

    const user = await requireUser();
    if (!user) return;

    const { error } = await supabase.from("contacts").delete().eq("id", contactId).eq("user_id", user.id);
    if (error) {
      setStatus("❌ Delete failed: " + error.message);
      return;
    }

    setSelectedExecutorIds((prev) => {
      const copy = { ...prev };
      delete copy[contactId];
      return copy;
    });

    if (editingContactId === contactId) setEditingContactId(null);

    await loadAll();
    setStatus("✅ Executor deleted");
  }

  async function viewOrDownload(path: string, fileNameHint?: string) {
    setStatus("");
    const { data, error } = await supabase.storage.from("vault-docs").download(path);

    if (error || !data) {
      setStatus("❌ Download failed: " + (error?.message ?? "Unknown error"));
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileNameHint || path.split("/").pop() || "document";
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function deleteDoc(id: string, path: string) {
    setStatus("");
    const ok = window.confirm("Delete this document?");
    if (!ok) return;

    const user = await requireUser();
    if (!user) return;

    const storageRes = await supabase.storage.from("vault-docs").remove([path]);
    if (storageRes.error) {
      setStatus("❌ Storage delete failed: " + storageRes.error.message);
      return;
    }

    const dbRes = await supabase.from("legal_documents").delete().eq("id", id).eq("user_id", user.id);
    if (dbRes.error) {
      setStatus("❌ Database delete failed: " + dbRes.error.message);
      return;
    }

    setStatus("✅ Deleted");
    await loadAll();
  }

  async function uploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("");

    const validation = validateUploadFile(file, {
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: 10 * 1024 * 1024,
    });
    if (!validation.ok) {
      setStatus(`❌ ${validation.error}. Allowed: PDF, JPG, PNG. Max: 10MB.`);
      e.target.value = "";
      return;
    }

    const safeTitle = title.trim();
    if (!safeTitle) {
      setStatus("❗ Please enter a Document title before selecting a file.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const user = await requireUser();
      if (!user) return;

      const filePath = `${user.id}/${Date.now()}_${sanitizeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage.from("vault-docs").upload(filePath, file, { upsert: false });
      if (uploadError) {
        setStatus("❌ Upload failed: " + uploadError.message);
        return;
      }

      const { data: insertedDocs, error: insertError } = await supabase
        .from("legal_documents")
        .insert({
          user_id: user.id,
          document_type: documentType,
          document_subtype: documentSubtype || null,
          custom_document_type: documentType === "other" ? customDocumentType || null : null,
          custom_document_subtype:
            documentSubtype === "other" ? customDocumentSubtype || null : null,
          title: safeTitle,
          document_date: documentDate || null,
          notes: notes.trim() || null,
          file_path: filePath,
        })
        .select("id");

      if (insertError || !insertedDocs?.[0]?.id) {
        setStatus("❌ Database save failed: " + (insertError?.message ?? "No document id returned"));
        return;
      }

      const legalDocumentId = insertedDocs[0].id as string;
      const execIds = Object.keys(selectedExecutorIds).filter((id) => selectedExecutorIds[id]);

      if (execIds.length > 0) {
        const { error: linkErr } = await supabase.from("legal_document_participants").insert(
          execIds.map((contactId) => ({
            user_id: user.id,
            legal_document_id: legalDocumentId,
            contact_id: contactId,
            role: "executor",
          }))
        );

        if (linkErr) setStatus("⚠️ Document uploaded, but linking executors failed: " + linkErr.message);
        else setStatus("✅ Uploaded (executors linked)");
      } else {
        setStatus("✅ Uploaded");
      }

      setTitle("");
      setDocumentDate("");
      setNotes("");
      setDocumentSubtype("");
      setCustomDocumentType("");
      setCustomDocumentSubtype("");
      setSelectedExecutorIds({});
      await loadAll();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1100 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Legal Vault</h1>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Store your Will, LPA, insurance policies and key legal documents.
        </p>
      </div>

      {status ? <div style={{ color: "#6b7280" }}>{status}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Executors</div>

          <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>Add new executor</div>
            <input placeholder="Name" value={newExecName} onChange={(e) => setNewExecName(e.target.value)} style={inputStyle} />
            <input placeholder="Email" value={newExecEmail} onChange={(e) => setNewExecEmail(e.target.value)} style={inputStyle} />
            <input placeholder="Phone" value={newExecPhone} onChange={(e) => setNewExecPhone(e.target.value)} style={inputStyle} />
            <button onClick={addExecutor} disabled={savingExec} style={primaryBtn}>
              {savingExec ? "Saving…" : "Save executor"}
            </button>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 8 }}>Saved executors</div>

          {loading ? (
            <div style={{ color: "#6b7280" }}>Loading…</div>
          ) : contacts.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No saved executors yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {contacts.map((c) => {
                const edit = contactEdits[c.id] || { full_name: "", email: "", phone: "" };
                const isEditing = editingContactId === c.id;

                return (
                  <div key={c.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, display: "grid", gap: 8 }}>
                    {isEditing ? (
                      <>
                        <input
                          placeholder="Name"
                          value={edit.full_name}
                          onChange={(e) => setContactEdits((prev) => ({ ...prev, [c.id]: { ...edit, full_name: e.target.value } }))}
                          style={inputStyle}
                        />
                        <input
                          placeholder="Email"
                          value={edit.email}
                          onChange={(e) => setContactEdits((prev) => ({ ...prev, [c.id]: { ...edit, email: e.target.value } }))}
                          style={inputStyle}
                        />
                        <input
                          placeholder="Phone"
                          value={edit.phone}
                          onChange={(e) => setContactEdits((prev) => ({ ...prev, [c.id]: { ...edit, phone: e.target.value } }))}
                          style={inputStyle}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => saveContact(c.id)} style={ghostBtn}>Save</button>
                          <button onClick={() => { setEditingContactId(null); loadAll(); }} style={ghostBtn}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 800 }}>{c.full_name}</div>
                        <div style={{ fontSize: 13, color: "#6b7280" }}>
                          {c.email || "No email"}{c.phone ? ` · ${c.phone}` : ""}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setEditingContactId(c.id)} style={ghostBtn}>Edit</button>
                          <button onClick={() => deleteContact(c.id)} style={ghostBtn}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Upload document</div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={labelStyle}>
              <span style={labelText}>Document type</span>
              <select
                value={documentType}
                onChange={(e) => {
                  setDocumentType(e.target.value);
                  setDocumentSubtype("");
                  if (e.target.value !== "other") setCustomDocumentType("");
                  setCustomDocumentSubtype("");
                }}
                style={inputStyle}
              >
                {legalTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {documentType === "other" ? (
              <label style={labelStyle}>
                <span style={labelText}>Custom document type</span>
                <input
                  value={customDocumentType}
                  onChange={(e) => setCustomDocumentType(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. International trust directive"
                />
              </label>
            ) : null}

            {(legalSubtypes[documentType] ?? []).length > 0 ? (
              <label style={labelStyle}>
                <span style={labelText}>Document subtype</span>
                <select
                  value={documentSubtype}
                  onChange={(e) => {
                    setDocumentSubtype(e.target.value);
                    if (e.target.value !== "other") setCustomDocumentSubtype("");
                  }}
                  style={inputStyle}
                >
                  <option value="">Select subtype</option>
                  {(legalSubtypes[documentType] ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {documentSubtype === "other" ? (
              <label style={labelStyle}>
                <span style={labelText}>Custom document subtype</span>
                <input
                  value={customDocumentSubtype}
                  onChange={(e) => setCustomDocumentSubtype(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. Utility legacy instruction"
                />
              </label>
            ) : null}

            <label style={labelStyle}>
              <span style={labelText}>Document title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
            </label>

            <label style={labelStyle}>
              <span style={labelText}>Document date (signed) — enter manually</span>
              <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} style={inputStyle} />
            </label>

            <label style={labelStyle}>
              <span style={labelText}>Notes</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
            </label>

            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Select executors for this document</div>

              {contacts.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 13 }}>Add an executor on the left first.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {contacts.map((c) => (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={!!selectedExecutorIds[c.id]}
                        onChange={(e) => setSelectedExecutorIds((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                      />
                      <span style={{ fontSize: 13 }}>
                        <strong>{c.full_name}</strong>
                        <span style={{ color: "#6b7280" }}>
                          {c.email ? ` · ${c.email}` : ""}{c.phone ? ` · ${c.phone}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {selectedExecutors.length > 0 ? (
                <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
                  Selected: {selectedExecutors.map((x) => x.full_name).join(", ")}
                </div>
              ) : null}
            </div>

            <label style={labelStyle}>
              <span style={labelText}>Choose file</span>
              <input type="file" onChange={uploadFile} disabled={uploading} />
            </label>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Documents</div>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading…</div>
        ) : docs.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No documents uploaded yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {docs.map((d) => (
              <div key={d.id} style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900 }}>
                    {d.title || "(Untitled)"}{" "}
                    <span style={{ fontWeight: 700, color: "#6b7280" }}>
                      · {d.document_type === "other" ? d.custom_document_type || "document" : d.document_type || "document"}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Signed: {fmtDateOnly(d.document_date) || "—"} · Uploaded: {fmtDateTime(d.created_at)}
                    {d.document_subtype ? ` · ${d.document_subtype === "other" ? d.custom_document_subtype || "Other subtype" : d.document_subtype}` : ""}
                    {d.notes ? ` · Notes: ${d.notes}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => viewOrDownload(d.file_path, d.title || undefined)} style={ghostBtn}>
                    View / Download
                  </button>
                  <button onClick={() => deleteDoc(d.id, d.file_path)} style={ghostBtn}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  padding: 16,
  borderRadius: 16,
  background: "#fff",
};

const labelStyle: React.CSSProperties = { display: "grid", gap: 6 };
const labelText: React.CSSProperties = { fontSize: 13, color: "#374151" };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  fontSize: 15,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
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
