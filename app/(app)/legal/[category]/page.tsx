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
      const [assetsRes, contacts] = await Promise.all([
        fetchCanonicalAssets(supabase, {
          userId: ownerUserId,
          walletId: wallet.walletId,
          sectionKeys: ["legal"],
          select: "id,title,section_key,category_key,metadata_json,created_at",
        }),
        loadCanonicalContactsForOwner(supabase, ownerUserId),
      ]);
      if (cancelled || assetsRes.error) return;
      const linkedAssetIds = new Set(
        contacts.flatMap((contact) => contact.linked_context ?? [])
          .filter((context) => context.source_kind === "asset")
          .map((context) => String(context.source_id ?? "").trim())
          .filter(Boolean),
      );
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
    return <div style={{ color: "#6b7280" }}>Unknown legal category.</div>;
  }

  const associationAlert = getLegalLinkedContactDefinition(category.slug) && missingAssociationCount > 0 ? (
    <div
      style={{
        border: "1px solid #fcd34d",
        borderRadius: 12,
        background: "#fffbeb",
        color: "#92400e",
        fontSize: 13,
        padding: "10px 12px",
        marginBottom: 12,
      }}
    >
      {missingAssociationCount} {category.label.toLowerCase()} record{missingAssociationCount === 1 ? "" : "s"} currently need a linked contact but do not have one yet.
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
