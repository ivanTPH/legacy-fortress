"use client";

import { useId } from "react";
import { shouldShowAssetField, type AssetCategoryFormConfig } from "../../../lib/assets/fieldDictionary";
import {
  DateInput,
  FileUploadPlaceholder,
  FormField,
  NumberInput,
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

  return (
    <>
      {config.fields.map((field) => {
        if (!shouldShowAssetField(field, values)) {
          return null;
        }
        const value = values[field.key] ?? "";
        const showOther = field.supportsOther && value === "__other" && field.otherKey;
        const fieldId = `${fieldIdPrefix}-${config.categorySlug}-${field.key}`;
        const otherFieldId = field.otherKey ? `${fieldId}-other` : undefined;

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

            {showOther ? (
              <FormField
                fieldId={otherFieldId}
                label={`${field.label} (Other)`}
                required
                error={field.otherKey ? errors[field.otherKey] : undefined}
                helpText="Provide a custom value"
              >
                <TextInput
                  id={otherFieldId}
                  ariaLabel={`${field.label} (Other)`}
                  value={field.otherKey ? (values[field.otherKey] ?? "") : ""}
                  onChange={(next) => {
                    if (field.otherKey) onChange(field.otherKey, next);
                  }}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  disabled={disabled}
                />
              </FormField>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
