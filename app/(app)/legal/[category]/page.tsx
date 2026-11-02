"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import UniversalRecordWorkspace from "../../../../components/records/UniversalRecordWorkspace";
import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";
import { waitForActiveUser } from "../../../../lib/auth/session";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchCanonicalAssets } from "../../../../lib/assets/fetchCanonicalAssets";
import { resolveWalletContextForRead } from "../../../../lib/canonicalPersistence";
import { loadCanonicalContactsForOwner } from "../../../../lib/contacts/canonicalContacts";
import { assetMatchesLegalCategory, getLegalCategoryBySlug, getLegalLinkedContactDefinition, usesCanonicalLegalAssetRead } from "../../../../lib/legalCategories";

export default function LegalCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = getLegalCategoryBySlug(params.category || "");
  const { viewer } = useViewerAccess();
  const [missingAssociationCount, setMissingAssociationCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadAssociationState() {
      if (!category || !getLegalLinkedContactDefinition(category.slug)) {
        setMissingAssociationCount(0);
        return;
      }
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      const ownerUserId = viewer.targetOwnerUserId || user?.id;
      if (!ownerUserId) return;
      const wallet = await resolveWalletContextForRead(supabase, ownerUserId);
      const [assetsRes, contacts, recordLinks] = await Promise.all([
        fetchCanonicalAssets(supabase, {
          userId: ownerUserId,
          walletId: wallet.walletId,
          sectionKeys: ["legal"],
          select: "id,title,section_key,category_key,metadata_json,created_at",
        }),
        loadCanonicalContactsForOwner(supabase, ownerUserId),
        // People linked through the V5.2 "Your attorney / Executors" section count too.
        supabase.from("record_links").select("record_id").eq("owner_user_id", ownerUserId).eq("record_type", "asset").is("removed_at", null),
      ]);
      if (cancelled || assetsRes.error) return;
      const linkedAssetIds = new Set([
        ...contacts.flatMap((contact) => contact.linked_context ?? [])
          .filter((context) => context.source_kind === "asset")
          .map((context) => String(context.source_id ?? "").trim())
          .filter(Boolean),
        ...((recordLinks.data ?? []) as Array<{ record_id: string }>).map((row) => String(row.record_id)),
      ]);
      const matchingAssets = ((assetsRes.data ?? []) as Array<Record<string, unknown>>).filter((row) =>
        assetMatchesLegalCategory({
          section_key: row.section_key,
          category_key: row.category_key,
          title: row.title,
          metadata_json: (row.metadata_json as Record<string, unknown> | null) ?? null,
        }, category.slug),
      );
      setMissingAssociationCount(
        matchingAssets.filter((row) => !linkedAssetIds.has(String(row.id ?? ""))).length,
      );
    }
    void loadAssociationState();
    return () => {
      cancelled = true;
    };
  }, [category, viewer.targetOwnerUserId]);

  if (!category) {
    return <div style={{ color: "var(--lf-text-secondary)" }}>Unknown legal category.</div>;
  }

  const associationAlert = getLegalLinkedContactDefinition(category.slug) && missingAssociationCount > 0 ? (
    <div
      style={{
        border: "1px solid #fcd34d",
        borderRadius: 12,
        background: "var(--lf-status-pending-bg)",
        color: "var(--lf-status-pending-text)",
        fontSize: 13,
        padding: "10px 12px",
        marginBottom: 12,
      }}
    >
      {missingAssociationCount === 1 ? "One" : missingAssociationCount} {category.slug === "wills" ? `Will${missingAssociationCount === 1 ? " doesn’t" : "s don’t"} name an executor yet.` : category.slug === "power-of-attorney" ? `Power${missingAssociationCount === 1 ? " of Attorney doesn’t" : "s of Attorney don’t"} name your attorney yet.` : `record${missingAssociationCount === 1 ? " doesn’t" : "s don’t"} have a linked person yet.`} Open {missingAssociationCount === 1 ? "it" : "each one"} to add them.
    </div>
  ) : null;

  if (category.slug === "wills") {
    return (
      <>
        {associationAlert}
        <UniversalRecordWorkspace
          sectionKey="legal"
          categoryKey="wills"
          title={`Legal · ${category.label}`}
          subtitle={category.description}
        />
      </>
    );
  }

  if (usesCanonicalLegalAssetRead(category.slug)) {
    return (
      <>
        {associationAlert}
        <UniversalRecordWorkspace
          sectionKey="legal"
          categoryKey={category.slug}
          title={`Legal · ${category.label}`}
          subtitle={category.description}
          forceCanonicalRead
          recordFilter={(row) => assetMatchesLegalCategory(row, category.slug)}
        />
      </>
    );
  }

  return (
    <>
      {associationAlert}
      <UniversalRecordWorkspace
        sectionKey="legal"
        categoryKey={category.slug}
        title={`Legal · ${category.label}`}
        subtitle={category.description}
      />
    </>
  );
}
