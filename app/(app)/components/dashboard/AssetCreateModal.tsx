"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import ConfigDrivenAssetFields from "../../../../components/forms/asset/ConfigDrivenAssetFields";
import {
  buildInitialAssetFormValues,
  getAssetCategoryFormConfig,
  validateAssetFormValues,
  type AssetCategoryFormConfig,
} from "../../../../lib/assets/fieldDictionary";

export type AssetQuickCreateInput = {
  values: Record<string, string>;
  config: AssetCategoryFormConfig;
};

export type AssetCreateModalProps = {
  open: boolean;
  categorySlug?: string | null;
  categoryLabel: string;
  saving?: boolean;
  error?: string;
  success?: string;
  onClose: () => void;
  onSubmit: (input: AssetQuickCreateInput) => Promise<boolean>;
};

export default function AssetCreateModal({
  open,
  categorySlug = null,
  categoryLabel,
  saving = false,
  error = "",
  success = "",
  onClose,
  onSubmit,
}: AssetCreateModalProps) {
  const config = useMemo(() => getAssetCategoryFormConfig(categorySlug), [categorySlug]);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!config) {
      setValues({});
      return;
    }
    setValues(buildInitialAssetFormValues(config));
  }, [config, open]);

  const errors = useMemo(() => {
    if (!config) return {};
    return validateAssetFormValues(config, values);
  }, [config, values]);

  if (!open) return null;
  if (!config) return null;
  const activeConfig = config;

  async function submit() {
    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) return;

    const ok = await onSubmit({ values, config: activeConfig });
    if (!ok) return;

    setValues(buildInitialAssetFormValues(activeConfig));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 70,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Create {categoryLabel}</h2>

        <ConfigDrivenAssetFields
          config={activeConfig}
          values={values}
          errors={errors}
          disabled={saving}
          onChange={(key, nextValue) => {
            setValues((prev) => ({ ...prev, [key]: nextValue }));
          }}
        />

        {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
        {success ? <div style={{ color: "#166534", fontSize: 13 }}>{success}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} disabled={saving} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || Object.values(errors).some(Boolean)}
            style={primaryButtonStyle}
            onClick={submit}
          >
            {saving ? "Saving..." : "Create asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

const primaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "9px 14px",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 14px",
  background: "#fff",
  color: "#0f172a",
  cursor: "pointer",
};
