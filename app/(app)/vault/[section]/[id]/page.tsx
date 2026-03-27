"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatCurrency } from "../../../../../lib/currency";
import { supabase } from "../../../../../lib/supabaseClient";
import { getSafeUserData } from "@/lib/auth/requireActiveUser";
import AttachmentGallery from "../../../../../components/documents/AttachmentGallery";
import { getStoredFileSignedUrl, isPrintableDocumentMimeType } from "../../../../../lib/assets/documentLinks";

type SectionKey = "personal" | "financial" | "legal" | "property" | "business" | "digital";

type SectionConfig = {
  label: string;
  table: string;
  select: string;
  basePath: string;
  title: (row: Record<string, unknown>) => string;
  value?: (row: Record<string, unknown>) => string | null;
};

const SECTION_CONFIG: Record<SectionKey, SectionConfig> = {
  personal: {
    label: "Personal possession",
    table: "personal_possessions",
    select: "id,item_name,possession_type,estimated_value,notes,created_at,updated_at",
    basePath: "/vault/personal",
    title: (row) => (row.item_name as string) || (row.possession_type as string) || "Possession",
    value: (row) => formatCurrency(Number(row.estimated_value ?? 0), "GBP"),
  },
  financial: {
    label: "Financial account",
    table: "financial_accounts",
    select: "id,account_name,account_type,balance,currency,provider,notes,created_at,updated_at",
    basePath: "/vault/financial",
    title: (row) => (row.account_name as string) || (row.provider as string) || "Financial account",
    value: (row) => formatCurrency(Number(row.balance ?? 0), String(row.currency || "GBP")),
  },
  legal: {
    label: "Legal document",
    table: "legal_documents",
    select: "id,title,document_type,document_date,file_path,notes,created_at,updated_at",
    basePath: "/vault/legal",
    title: (row) => (row.title as string) || (row.document_type as string) || "Legal document",
  },
  property: {
    label: "Property record",
    table: "assets",
    select: "id,title,value_minor,currency_code,summary,metadata_json,section_key,category_key,created_at,updated_at",
    basePath: "/vault/property",
    title: (row) => (row.title as string) || ((row.metadata_json as Record<string, unknown> | null)?.property_name as string) || "Property",
    value: (row) => formatCurrency(Number(row.value_minor ?? 0) / 100, String(row.currency_code || "GBP")),
  },
  business: {
    label: "Business record",
    table: "assets",
    select: "id,title,value_minor,currency_code,summary,metadata_json,section_key,category_key,created_at,updated_at",
    basePath: "/vault/business",
    title: (row) => (row.title as string) || ((row.metadata_json as Record<string, unknown> | null)?.business_name as string) || "Business record",
    value: (row) => formatCurrency(Number(row.value_minor ?? 0) / 100, String(row.currency_code || "GBP")),
  },
  digital: {
    label: "Digital record",
    table: "assets",
    select: "id,title,value_minor,currency_code,summary,metadata_json,section_key,category_key,created_at,updated_at",
    basePath: "/vault/digital",
    title: (row) => (row.title as string) || ((row.metadata_json as Record<string, unknown> | null)?.asset_name as string) || "Digital account",
    value: (row) => formatCurrency(Number(row.value_minor ?? 0) / 100, String(row.currency_code || "GBP")),
  },
};

export default function VaultAssetDetailPage() {
  const params = useParams<{ section: string; id: string }>();
  const router = useRouter();

  const section = (params.section || "") as SectionKey;
  const id = params.id || "";

  const config = SECTION_CONFIG[section];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!config || !id) {
        router.replace("/dashboard");
        return;
      }

      setLoading(true);
      setStatus("");

      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/signin");
        return;
      }

      let query = supabase
        .from(config.table)
        .select(config.select)
        .eq("id", id);

      if (section === "property" || section === "business" || section === "digital") {
        query = query
          .eq("owner_user_id", userData.user.id)
          .eq("section_key", section)
          .eq("category_key", section === "property" ? "property" : section === "business" ? "business" : "digital")
          .is("deleted_at", null);
      } else {
        query = query.eq("user_id", userData.user.id);
      }

      const { data, error } = await query.maybeSingle();

      if (!mounted) return;

      if (error || !data) {
        setStatus(`⚠️ Could not load ${config.label.toLowerCase()}.`);
        setRow(null);
      } else {
        setRow(data as unknown as Record<string, unknown>);
      }

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [config, id, router, section]);

  const displayTitle = useMemo(() => {
    if (!config || !row) return "Asset detail";
    return config.title(row);
  }, [config, row]);

  if (!config) {
    return <div style={{ color: "#6b7280" }}>Unknown asset section.</div>;
  }

  async function remove() {
    const ok = window.confirm(`Delete this ${config.label.toLowerCase()}?`);
    if (!ok) return;

    setSaving(true);
    setStatus("");

    const { data: userData, error: authError } = await getSafeUserData(supabase);
    if (authError || !userData.user) {
      router.replace("/signin");
      return;
    }

    const action =
      section === "property" || section === "business" || section === "digital"
        ? supabase
            .from(config.table)
            .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("owner_user_id", userData.user.id)
            .eq("section_key", section)
            .eq("category_key", section === "property" ? "property" : section === "business" ? "business" : "digital")
            .is("deleted_at", null)
        : supabase
            .from(config.table)
            .delete()
            .eq("id", id)
            .eq("user_id", userData.user.id);

    const { error } = await action;

    if (error) {
      setStatus(`❌ Delete failed: ${error.message}`);
      setSaving(false);
      return;
    }

    router.replace(config.basePath);
  }

  async function downloadLegalFile() {
    if (section !== "legal" || !row?.file_path || typeof row.file_path !== "string") return;

    setStatus("");
    const { data, error } = await supabase.storage.from("vault-docs").download(row.file_path);
    if (error || !data) {
      setStatus(`❌ Download failed: ${error?.message ?? "Unknown error"}`);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${displayTitle}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function resolveLegalFilePreview() {
    if (section !== "legal" || !row?.file_path || typeof row.file_path !== "string") return null;
    return getStoredFileSignedUrl(supabase, {
      storageBucket: "vault-docs",
      storagePath: row.file_path,
      expiresInSeconds: 120,
    });
  }

  async function printLegalFile() {
    if (section !== "legal" || !row?.file_path || typeof row.file_path !== "string") return;
    const mimeType = inferMimeTypeFromPath(row.file_path);
    if (!isPrintableDocumentMimeType(mimeType)) {
      setStatus("Print is available for PDF and image files only.");
      return;
    }
    const signedUrl = await resolveLegalFilePreview();
    if (!signedUrl) {
      setStatus("Could not prepare legal file for print.");
      return;
    }
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        setTimeout(() => frame.remove(), 2_000);
      }
    };
    frame.src = signedUrl;
  }

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 920 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{displayTitle}</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{config.label} details and management actions.</p>
      </div>

      {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}

      {!loading && !row ? (
        <section style={cardStyle}>
          <div style={{ color: "#6b7280" }}>No record found.</div>
          <Link href={config.basePath} style={linkStyle}>Return to section</Link>
        </section>
      ) : null}

      {!loading && row ? (
        <>
          <section style={cardStyle}>
            <div style={metaGridStyle}>
              <Meta label="Added" value={formatDateTime(String(row.created_at || ""))} />
              <Meta label="Updated" value={formatDateTime(String(row.updated_at || ""))} />
              {config.value ? <Meta label="Value" value={config.value(row)} /> : null}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {Object.entries(row)
                .filter(([key]) => !["id", "user_id", "owner_user_id", "created_at", "updated_at", "metadata_json", "section_key", "category_key"].includes(key))
                .map(([key, value]) => (
                  <div key={key} style={{ display: "grid", gap: 2 }}>
                    <div style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 14, color: "#111827" }}>{formatValue(value)}</div>
                  </div>
                ))}
              {(section === "property" || section === "business" || section === "digital") && row.metadata_json && typeof row.metadata_json === "object"
                ? Object.entries(row.metadata_json as Record<string, unknown>).map(([key, value]) => (
                    <div key={`meta-${key}`} style={{ display: "grid", gap: 2 }}>
                      <div style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 14, color: "#111827" }}>{formatValue(value)}</div>
                    </div>
                  ))
                : null}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={config.basePath} style={linkBtnStyle}>Back to section</Link>
              <Link href={`${config.basePath}?edit=${id}`} style={linkBtnStyle}>Edit in section</Link>
              <button type="button" style={deleteBtnStyle} disabled={saving} onClick={() => void remove()}>
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
            {section === "legal" && row.file_path ? (
              <AttachmentGallery
                items={[
                  {
                    id: String(row.id ?? id),
                    fileName: `${displayTitle}.${inferExtensionFromPath(String(row.file_path ?? ""))}`,
                    mimeType: inferMimeTypeFromPath(String(row.file_path ?? "")),
                    createdAt: String(row.updated_at ?? row.created_at ?? ""),
                  },
                ]}
                emptyText="No file linked."
                onResolvePreviewUrl={() => resolveLegalFilePreview()}
                onDownload={() => void downloadLegalFile()}
                onPrint={() => void printLegalFile()}
              />
            ) : null}
            {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{value ?? "-"}</div>
    </div>
  );
}

function formatDateTime(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function inferExtensionFromPath(path: string) {
  const extension = path.split(".").pop()?.trim().toLowerCase();
  return extension || "file";
}

function inferMimeTypeFromPath(path: string) {
  const extension = inferExtensionFromPath(path);
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "txt") return "text/plain";
  return "application/octet-stream";
}

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const metaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const buttonStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13,
  cursor: "pointer",
};

const deleteBtnStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff1f2",
};

const linkStyle: CSSProperties = {
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 600,
};

const linkBtnStyle: CSSProperties = {
  ...buttonStyle,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};
