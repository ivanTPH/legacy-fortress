"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { getLegalCategoryBySlug } from "../../../../lib/legalCategories";
import { supabase } from "../../../../lib/supabaseClient";

type LegalDocRow = {
  id: string;
  title: string | null;
  document_type: string | null;
  document_date: string | null;
  file_path: string | null;
  created_at: string | null;
};

export default function LegalCategoryPage() {
  const router = useRouter();
  const params = useParams<{ category: string }>();
  const category = getLegalCategoryBySlug(params.category || "");

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<LegalDocRow[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!category) {
        router.replace("/legal");
        return;
      }

      setLoading(true);
      setStatus("");

      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) {
        router.replace("/signin");
        return;
      }

      let query = supabase
        .from("legal_documents")
        .select("id,title,document_type,document_date,file_path,created_at")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (category.matchTypes.length === 1) {
        query = query.eq("document_type", category.matchTypes[0]);
      } else {
        query = query.or(category.matchTypes.map((type) => `document_type.eq.${type}`).join(","));
      }

      const { data, error } = await query;
      if (!mounted) return;

      if (error) {
        setStatus(`⚠️ Could not load ${category.label.toLowerCase()}: ${error.message}`);
        setRows([]);
      } else {
        setRows((data ?? []) as LegalDocRow[]);
      }

      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [category, router]);

  const addHref = useMemo(() => {
    if (!category) return "/vault/legal";
    return `/vault/legal?type=${encodeURIComponent(category.documentType)}`;
  }, [category]);

  async function removeRow(row: LegalDocRow) {
    const ok = window.confirm("Delete this legal document?");
    if (!ok) return;

    setStatus("");

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    if (row.file_path) {
      const storageDelete = await supabase.storage.from("vault-docs").remove([row.file_path]);
      if (storageDelete.error) {
        setStatus(`❌ Storage delete failed: ${storageDelete.error.message}`);
        return;
      }
    }

    const { error } = await supabase
      .from("legal_documents")
      .delete()
      .eq("id", row.id)
      .eq("user_id", userData.user.id);

    if (error) {
      setStatus(`❌ Delete failed: ${error.message}`);
      return;
    }

    setRows((current) => current.filter((item) => item.id !== row.id));
    setStatus("✅ Legal document deleted.");
  }

  if (!category) {
    return <div style={{ color: "#6b7280" }}>Unknown legal category.</div>;
  }

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{category.label}</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{category.description}</p>
      </div>

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}

      <div style={toolbarStyle}>
        <Link href={addHref} style={primaryLinkStyle}>Add or upload {category.label.toLowerCase()}</Link>
        <Link href="/vault/legal" style={ghostLinkStyle}>Open full Legal Vault</Link>
      </div>

      {loading ? <div style={{ color: "#6b7280" }}>Loading records...</div> : null}

      {!loading && rows.length === 0 ? (
        <section style={emptyCardStyle}>
          <div style={{ color: "#6b7280" }}>No records in this category yet.</div>
          <Link href={addHref} style={primaryLinkStyle}>Create first record</Link>
        </section>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <article key={row.id} style={itemCardStyle}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 700 }}>{row.title || category.label}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Added {formatDateTime(row.created_at)}{row.document_date ? ` · Dated ${formatDate(row.document_date)}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/vault/legal/${row.id}`} style={ghostLinkStyle}>View details</Link>
                <Link href={`/vault/legal?edit=${row.id}`} style={ghostLinkStyle}>Edit</Link>
                {row.file_path ? (
                  <button type="button" style={ghostButtonStyle} onClick={() => void downloadFile(row.file_path!)}>
                    Download
                  </button>
                ) : null}
                <button type="button" style={dangerButtonStyle} onClick={() => void removeRow(row)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

async function downloadFile(path: string) {
  const { data, error } = await supabase.storage.from("vault-docs").download(path);
  if (error || !data) return;

  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = path.split("/").pop() || "document";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const emptyCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
  display: "grid",
  gap: 10,
};

const itemCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 10,
};

const primaryLinkStyle: CSSProperties = {
  textDecoration: "none",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
};

const ghostLinkStyle: CSSProperties = {
  textDecoration: "none",
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
};

const ghostButtonStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
  ...ghostButtonStyle,
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff1f2",
};
