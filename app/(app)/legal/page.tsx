"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { LEGAL_CATEGORIES } from "../../../lib/legalCategories";
import { supabase } from "../../../lib/supabaseClient";
import { getSafeUserData } from "@/lib/auth/requireActiveUser";

type LegalRow = {
  id: string;
  category_key: string | null;
  created_at: string | null;
};

export default function LegalOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<LegalRow[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/signin");
        return;
      }

      const { data, error } = await supabase
        .from("records")
        .select("id,category_key,created_at")
        .eq("owner_user_id", userData.user.id)
        .eq("section_key", "legal")
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        setStatus(`⚠️ Could not load legal summary: ${error.message}`);
        setRows([]);
      } else {
        setRows((data ?? []) as LegalRow[]);
      }

      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const counts = useMemo(() => {
    const byType = new Map<string, number>();
    for (const row of rows) {
      const type = row.category_key || "other-legal-documents";
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
    return byType;
  }, [rows]);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Legal</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Choose a legal category to view, add, edit, and manage records.
        </p>
      </div>

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#6b7280" }}>Loading legal categories...</div> : null}

      <div className="lf-content-grid">
        {LEGAL_CATEGORIES.map((category) => {
          const total = counts.get(category.slug) ?? 0;
          return (
            <Link key={category.slug} href={`/legal/${category.slug}`} style={cardStyle}>
              <div style={{ fontWeight: 700 }}>{category.label}</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>{category.description}</div>
              <div style={{ color: "#334155", fontSize: 13 }}>{total} record(s)</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  textDecoration: "none",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 8,
};
