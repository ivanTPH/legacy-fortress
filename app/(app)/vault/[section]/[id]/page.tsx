"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatCurrency } from "../../../../../lib/currency";
import { supabase } from "../../../../../lib/supabaseClient";
import { getSafeUserData } from "@/lib/auth/requireActiveUser";

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
    table: "property_assets",
    select: "id,address,property_type,estimated_value,mortgage_balance,notes,created_at,updated_at",
    basePath: "/vault/property",
    title: (row) => (row.address as string) || (row.property_type as string) || "Property",
    value: (row) => formatCurrency(Number(row.estimated_value ?? 0) - Number(row.mortgage_balance ?? 0), "GBP"),
  },
  business: {
    label: "Business record",
    table: "business_interests",
    select: "id,entity_name,entity_type,estimated_value,notes,created_at,updated_at",
    basePath: "/vault/business",
    title: (row) => (row.entity_name as string) || (row.entity_type as string) || "Business record",
    value: (row) => formatCurrency(Number(row.estimated_value ?? 0), "GBP"),
  },
  digital: {
    label: "Digital record",
    table: "digital_assets",
    select: "id,service_name,category,username_or_email,recovery_method,has_2fa,executor_instructions,notes,created_at,updated_at",
    basePath: "/vault/digital",
    title: (row) => (row.service_name as string) || (row.category as string) || "Digital account",
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

      const { data, error } = await supabase
        .from(config.table)
        .select(config.select)
        .eq("id", id)
        .eq("user_id", userData.user.id)
        .maybeSingle();

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
  }, [config, id, router]);

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

    const { error } = await supabase
      .from(config.table)
      .delete()
      .eq("id", id)
      .eq("user_id", userData.user.id);

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
                .filter(([key]) => !["id", "user_id", "created_at", "updated_at"].includes(key))
                .map(([key, value]) => (
                  <div key={key} style={{ display: "grid", gap: 2 }}>
                    <div style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 14, color: "#111827" }}>{formatValue(value)}</div>
                  </div>
                ))}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={config.basePath} style={linkBtnStyle}>Back to section</Link>
              <Link href={`${config.basePath}?edit=${id}`} style={linkBtnStyle}>Edit in section</Link>
              {section === "legal" && row.file_path ? (
                <button type="button" style={buttonStyle} onClick={() => void downloadLegalFile()}>
                  Download file
                </button>
              ) : null}
              <button type="button" style={deleteBtnStyle} disabled={saving} onClick={() => void remove()}>
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
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
