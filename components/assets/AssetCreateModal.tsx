"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AssetCreateModalCore from "../../app/(app)/components/dashboard/AssetCreateModal";
import type { AssetQuickCreateInput } from "../../app/(app)/components/dashboard/AssetCreateModal";
import { createAsset } from "../../lib/assets/createAsset";
import { resolveConfiguredFieldValue, getCanonicalAssetMetadataFromValues } from "../../lib/assets/fieldDictionary";
import { waitForActiveUser } from "../../lib/auth/session";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  assetTypeId: string;
  open: boolean;
  onClose: () => void;
};

export default function AssetCreateModal({ assetTypeId, open, onClose }: Props) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const categorySlug = useMemo(() => toCategorySlug(assetTypeId), [assetTypeId]);
  const categoryLabel = useMemo(() => {
    if (categorySlug === "bank-accounts") return "Bank account";
    if (categorySlug === "property") return "Property";
    if (categorySlug === "business-interests") return "Business interest";
    if (categorySlug === "digital-assets") return "Digital account";
    return "Asset";
  }, [categorySlug]);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 130 });
      if (!mounted) return;
      setUserId(user?.id ?? "");
    }

    if (open) void loadUser();

    return () => {
      mounted = false;
    };
  }, [open]);

  async function onSubmit(input: AssetQuickCreateInput) {
    if (!userId) {
      setError("You must be signed in to create assets.");
      return false;
    }

    const titleField = input.config.fields.find((field) => field.key === "title");
    const title = titleField
      ? resolveConfiguredFieldValue(titleField, input.values)
      : `${input.values["title"] ?? ""}`;

    if (!title.trim()) {
      setError("Title is required.");
      return false;
    }

    setSaving(true);
    setError("");

    try {
      const created = await createAsset(supabase, {
        userId,
        categorySlug,
        title: title.trim(),
        metadata: getCanonicalAssetMetadataFromValues(input.config, input.values),
        visibility: "private",
      });

      onClose();
      router.replace(`/dashboard?created=1&category=${encodeURIComponent(categorySlug)}&createdId=${encodeURIComponent(created.id)}`);
      router.refresh();
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not create asset.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <AssetCreateModalCore
      open={open}
      categorySlug={categorySlug}
      categoryLabel={categoryLabel}
      saving={saving}
      error={error}
      success=""
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function toCategorySlug(assetTypeId: string): "bank-accounts" | "property" | "business-interests" | "digital-assets" {
  const normalized = assetTypeId.trim().toLowerCase();
  if (normalized === "bank-account" || normalized === "bank-accounts" || normalized === "bank") return "bank-accounts";
  if (normalized === "property") return "property";
  if (normalized === "business-interest" || normalized === "business-interests" || normalized === "business") return "business-interests";
  if (normalized === "digital-asset" || normalized === "digital-assets" || normalized === "digital") return "digital-assets";
  return "bank-accounts";
}
