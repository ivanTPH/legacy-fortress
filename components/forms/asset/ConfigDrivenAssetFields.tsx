"use client";

import { useId } from "react";
import { shouldShowAssetField, type AssetCategoryFormConfig } from "../../../lib/assets/fieldDictionary";
import {
  DateInput,
  FileUploadPlaceholder,
  FormField,
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

  return (
    <>
      {config.fields.map((field) => {
        if (!shouldShowAssetField(field, values)) {
          return null;
        }
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
      })}
    </>
  );
}
