"use client";

import { useMemo, useState, type CSSProperties } from "react";
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

  if (!open) return null;
  if (!config) return null;

  return (
    <AssetCreateModalContent
      key={config.categorySlug}
      config={config}
      categoryLabel={categoryLabel}
      saving={saving}
      error={error}
      success={success}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function AssetCreateModalContent({
  config,
  categoryLabel,
  saving,
  error,
  success,
  onClose,
  onSubmit,
}: {
  config: AssetCategoryFormConfig;
  categoryLabel: string;
  saving: boolean;
  error: string;
  success: string;
  onClose: () => void;
  onSubmit: (input: AssetQuickCreateInput) => Promise<boolean>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialAssetFormValues(config));
  const errors = useMemo(() => validateAssetFormValues(config, values), [config, values]);

  async function submit() {
    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) return;

    const ok = await onSubmit({ values, config });
    if (!ok) return;

    setValues(buildInitialAssetFormValues(config));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Create ${categoryLabel}`}
      className="lf-mobile-create-dialog"
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
        className="lf-mobile-create-panel"
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--lf-surface-card)",
          borderRadius: 14,
          border: "1px solid var(--lf-border)",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lf-mobile-create-header"><button type="button" className="lf-mobile-create-cancel" onClick={onClose} disabled={saving}>Cancel</button><h2 style={{ margin: 0, fontSize: 18 }}>Create {categoryLabel}</h2></div>

        <ConfigDrivenAssetFields
          config={config}
          values={values}
          errors={errors}
          disabled={saving}
          onChange={(key, nextValue) => {
            setValues((prev) => ({ ...prev, [key]: nextValue }));
          }}
        />

        {error ? <div style={{ color: "var(--lf-destructive)", fontSize: 13 }}>{error}</div> : null}
        {success ? <div style={{ color: "var(--lf-status-approved-text)", fontSize: 13 }}>{success}</div> : null}

        <div className="lf-mobile-create-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="lf-mobile-create-desktop-cancel" onClick={onClose} disabled={saving} style={secondaryButtonStyle}>Cancel</button>
          <button
            className="lf-mobile-create-save"
            type="button"
            disabled={saving || Object.values(errors).some(Boolean)}
            style={primaryButtonStyle}
            onClick={submit}
          >
            {saving ? "Saving..." : "Save record"}
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
  background: "var(--lf-primary-bg)",
  color: "var(--lf-primary-text)",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid var(--lf-border-input)",
  borderRadius: 10,
  padding: "9px 14px",
  background: "var(--lf-surface-card)",
  color: "var(--lf-text)",
  cursor: "pointer",
};
