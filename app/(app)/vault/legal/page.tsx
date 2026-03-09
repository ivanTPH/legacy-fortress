"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { getSafeUserData } from "../../../../lib/auth/requireActiveUser";

type LegalRow = {
  id: string;
  title: string | null;
  document_type: string | null;
  created_at: string | null;
};

export default function LegalVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<LegalRow[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/signin");
        return;
      }

      const { data, error } = await supabase
        .from("legal_documents")
        .select("id,title,document_type,created_at")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (error) setStatus(`⚠️ Could not load legal records: ${error.message}`);
      setRows((data ?? []) as LegalRow[]);
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Legal Vault</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Review and manage legal records. Use categories for targeted workflows.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/legal" style={primaryStyle}>Open legal categories</Link>
        <Link href="/legal/wills" style={ghostStyle}>Add legal document</Link>
      </div>

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#6b7280" }}>Loading records...</div> : null}

      {!loading && rows.length === 0 ? (
        <div style={{ color: "#6b7280" }}>No legal records yet.</div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <article key={row.id} style={cardStyle}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.title || row.document_type || "Legal document"}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {row.document_type || "Document"} · Added {formatDate(row.created_at)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/vault/legal/${row.id}`} style={ghostStyle}>View</Link>
                <Link href={`/legal/${toCategory(row.document_type)}`} style={ghostStyle}>Manage category</Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function toCategory(documentType: string | null) {
  const value = (documentType || "").toLowerCase();
  if (value.includes("will")) return "wills";
  if (value.includes("trust")) return "trusts";
  if (value.includes("power")) return "power-of-attorney";
  if (value.includes("funeral")) return "funeral-wishes";
  if (value.includes("identity")) return "identity-documents";
  if (value.includes("marriage") || value.includes("divorce")) return "marriage-divorce-documents";
  return "other-legal-documents";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const primaryStyle: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};

const ghostStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "8px 12px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
  display: "grid",
  gap: 10,
};

