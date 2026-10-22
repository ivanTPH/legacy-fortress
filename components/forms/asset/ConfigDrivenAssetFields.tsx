"use client";

import { useId } from "react";
import { shouldShowAssetField, type AssetCategoryFormConfig } from "../../../lib/assets/fieldDictionary";
import Icon from "../../ui/Icon";
import {
  DateInput,
  FileUploadPlaceholder,
  FormField,
  GroupedAssetFormContext,
  NumberInput,
  OtherSelectInput,
  SelectInput,
  TextAreaInput,
  TextInput,
  ToggleInput,
} from "./AssetFormControls";

type ConfigDrivenAssetFieldsProps = {
  config: AssetCategoryFormConfig;
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
};

export default function ConfigDrivenAssetFields({
  config,
  values,
  errors,
  onChange,
  disabled = false,
}: ConfigDrivenAssetFieldsProps) {
  const fieldIdPrefix = useId();

  const visibleFields = config.fields.filter((field) => shouldShowAssetField(field, values));
  const valueKeys = new Set(["estimated_value", "current_balance", "valuation_date"]);
  const valueFields = visibleFields.filter((field) => valueKeys.has(field.key));
  const requiredFields = visibleFields.filter((field) => field.required && !valueKeys.has(field.key));
  const optionalFields = visibleFields.filter((field) => !field.required && !valueKeys.has(field.key));

  function renderField(field: typeof config.fields[number]) {
        const value = values[field.key] ?? "";
        const fieldId = `${fieldIdPrefix}-${config.categorySlug}-${field.key}`;

        if (field.inputType === "select" && field.supportsOther && field.otherKey) {
          const otherKey = field.otherKey;
          return (
            <OtherSelectInput
              key={field.key}
              fieldId={fieldId}
              label={field.label}
              value={value}
              otherValue={values[otherKey] ?? ""}
              onChange={(next) => onChange(field.key, next)}
              onOtherChange={(next) => onChange(otherKey, next)}
              options={field.options ?? []}
              placeholder={field.placeholder}
              required={field.required}
              disabled={disabled}
              error={errors[field.key]}
              otherError={errors[otherKey]}
              helpText={field.helpText}
            />
          );
        }

        return (
          <div key={field.key} style={{ display: "grid", gap: 6 }}>
            <FormField fieldId={fieldId} label={field.label} iconName={field.iconName} required={field.required} error={errors[field.key]} helpText={field.helpText}>
              {field.inputType === "text" ? (
                <TextInput id={fieldId} ariaLabel={field.label} value={value} onChange={(next) => onChange(field.key, next)} placeholder={field.placeholder} disabled={disabled} />
              ) : null}

              {field.inputType === "textarea" ? (
                <TextAreaInput id={fieldId} ariaLabel={field.label} value={value} onChange={(next) => onChange(field.key, next)} placeholder={field.placeholder} disabled={disabled} />
              ) : null}

              {field.inputType === "select" ? (
                <SelectInput
                  id={fieldId}
                  ariaLabel={field.label}
                  value={value}
                  onChange={(next) => onChange(field.key, next)}
                  options={field.options ?? []}
                  placeholder={field.placeholder}
                  disabled={disabled}
                />
              ) : null}

              {field.inputType === "number" || field.inputType === "currency" ? (
                <NumberInput id={fieldId} ariaLabel={field.label} value={value} onChange={(next) => onChange(field.key, next)} placeholder={field.placeholder} disabled={disabled} />
              ) : null}

              {field.inputType === "date" ? (
                <DateInput id={fieldId} ariaLabel={field.label} value={value} onChange={(next) => onChange(field.key, next)} disabled={disabled} />
              ) : null}

              {field.inputType === "toggle" ? (
                <ToggleInput value={value} onChange={(next) => onChange(field.key, next)} disabled={disabled} />
              ) : null}

              {field.inputType === "file" ? <FileUploadPlaceholder /> : null}
            </FormField>
          </div>
        );
  }

  return <GroupedAssetFormContext.Provider value><div className="lf-v4-form-sections">
    {requiredFields.length ? <section className="lf-v4-required-block" aria-label="Required fields"><h3>Required</h3><p className="lf-v51-form-helper">Choose the closest option in each list. Use Other only when none fit.</p><div className="lf-v4-form-grid">{requiredFields.map(renderField)}</div></section> : null}
    {valueFields.length ? <section className="lf-v52-value-block" aria-label="Record value"><h3>Value</h3><p>Use your own recorded estimate. It is not a verified balance.</p><div className="lf-v4-form-grid">{valueFields.map(renderField)}</div></section> : null}
    {optionalFields.length ? <details className="lf-v4-optional-group" open={optionalFields.some((field) => Boolean(errors[field.key])) || undefined}>
      <summary><Icon name="tune" size={20} /><span><strong>Optional details</strong><small>{optionalFields.map((field) => field.label).join(" · ")}</small></span><Icon name="expand_more" size={20} /></summary>
      <div className="lf-v4-form-grid">{optionalFields.map(renderField)}</div>
    </details> : null}
  </div></GroupedAssetFormContext.Provider>;
}
