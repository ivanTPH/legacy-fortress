"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { assetMatchesLegalCategory, LEGAL_CATEGORIES } from "../../../lib/legalCategories";
import { fetchCanonicalAssets } from "../../../lib/assets/fetchCanonicalAssets";
import { resolveWalletContextForRead } from "../../../lib/canonicalPersistence";
import { supabase } from "../../../lib/supabaseClient";
import { getSafeUserData } from "@/lib/auth/requireActiveUser";
import { isVaultSubsectionEnabled, type VaultSubsectionKey } from "../../../lib/vaultPreferences";

type LegalRow = {
  id: string;
  category_key: string | null;
  created_at: string | null;
};

type LegalAssetRow = {
  id: string;
  section_key: string | null;
  category_key: string | null;
  title: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string | null;
};

export default function LegalOverviewPage() {
  const router = useRouter();
  const { viewer } = useViewerAccess();
  const { preferences } = useVaultPreferences();
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
        router.replace("/sign-in");
        return;
      }
      const ownerUserId = viewer.targetOwnerUserId || userData.user.id;

      const [legacyResult, walletContext] = await Promise.all([
        supabase
          .from("records")
          .select("id,category_key,created_at")
          .eq("owner_user_id", ownerUserId)
          .eq("section_key", "legal")
          .order("created_at", { ascending: false }),
        resolveWalletContextForRead(supabase, ownerUserId),
      ]);

      const canonicalResult = await fetchCanonicalAssets(supabase, {
        userId: ownerUserId,
        walletId: walletContext.walletId,
        sectionKeys: ["legal", "personal"],
        select: "id,title,section_key,category_key,metadata_json,created_at",
      });

      if (!mounted) return;

      if (legacyResult.error || canonicalResult.error) {
        const message = legacyResult.error?.message ?? canonicalResult.error?.message ?? "Unknown error";
        setStatus(`⚠️ Could not load legal summary: ${message}`);
        setRows([]);
      } else {
        const legacyRows = (legacyResult.data ?? []) as LegalRow[];
        const canonicalRows = ((canonicalResult.data ?? []) as LegalAssetRow[]).reduce<LegalRow[]>((result, row) => {
            const matchedCategory = LEGAL_CATEGORIES.find((category) => assetMatchesLegalCategory(row, category.slug));
            if (!matchedCategory) return result;
            result.push({
              id: String(row.id),
              category_key: matchedCategory.slug,
              created_at: row.created_at,
            });
            return result;
          }, []);

        setRows([...legacyRows, ...canonicalRows]);
      }

      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router, viewer.targetOwnerUserId]);

  const counts = useMemo(() => {
    const byType = new Map<string, number>();
    for (const row of rows) {
      const type = row.category_key || "other-legal-documents";
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
    return byType;
  }, [rows]);

  const visibleCategories = useMemo(() => LEGAL_CATEGORIES.filter((category) => isVaultSubsectionEnabled(preferences, mapLegalSlugToPreferenceKey(category.slug))), [preferences]);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Review the core documents an executor would expect to find, from wills and powers of attorney to supporting certificates.
        </p>
      </div>

      {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}
      {loading ? <div style={{ color: "#6b7280" }}>Loading legal categories...</div> : null}

      {visibleCategories.length ? (
      <div className="lf-content-grid">
        {visibleCategories.map((category) => {
          const total = counts.get(category.slug) ?? 0;
          return (
            <Link key={category.slug} href={`/legal/${category.slug}`} style={cardStyle}>
              <div style={{ fontWeight: 700 }}>{category.label}</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>{category.description}</div>
              <div style={{ color: "#334155", fontSize: 13 }}>
                {total === 0 ? "Nothing saved yet" : `${total} record${total === 1 ? "" : "s"} ready to review`}
              </div>
            </Link>
          );
        })}
      </div>
      ) : (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Legal subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      )}
    </section>
  );
}

function mapLegalSlugToPreferenceKey(slug: string): VaultSubsectionKey {
  switch (slug) {
    case "wills":
      return "legal_wills";
    case "trusts":
      return "legal_trusts";
    case "power-of-attorney":
      return "legal_power_of_attorney";
    case "funeral-wishes":
      return "legal_funeral_wishes";
    case "marriage-divorce-documents":
      return "legal_marriage_divorce_documents";
    case "identity-documents":
      return "legal_identity_documents";
    case "death-certificate":
      return "legal_death_certificate";
    default:
      return "legal_other_legal_documents";
  }
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
