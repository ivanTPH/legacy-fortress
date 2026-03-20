"use client";

import { useMemo, useState } from "react";
import { getFieldsByAssetType } from "@/config/assetFields";

type DynamicAssetFormProps = {
  assetTypeId: string;
  onSubmit?: (values: Record<string, string>) => void;
};

export default function DynamicAssetForm({
  assetTypeId,
  onSubmit,
}: DynamicAssetFormProps) {
  const fields = useMemo(() => getFieldsByAssetType(assetTypeId), [assetTypeId]);
  const [values, setValues] = useState<Record<string, string>>({});

  function updateValue(fieldId: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (onSubmit) onSubmit(values);
    console.log("Dynamic asset form submission:", { assetTypeId, values });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
      {fields.map((field) => {
        const value = values[field.id] ?? "";

        if (field.type === "textarea") {
          return (
            <label
              key={field.id}
              style={{ display: "grid", gap: 6, fontSize: 14 }}
            >
              <span>
                {field.label} {field.required ? "*" : ""}
              </span>
              <textarea
                value={value}
                placeholder={field.placeholder ?? ""}
                onChange={(e) => updateValue(field.id, e.target.value)}
                rows={4}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: 12,
                }}
              />
            </label>
          );
        }

        if (field.type === "dropdown") {
          return (
            <label
              key={field.id}
              style={{ display: "grid", gap: 6, fontSize: 14 }}
            >
              <span>
                {field.label} {field.required ? "*" : ""}
              </span>
              <select
                value={value}
                onChange={(e) => updateValue(field.id, e.target.value)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <option value="">Select an option</option>
                <option value="current">Current</option>
                <option value="savings">Savings</option>
                <option value="joint">Joint</option>
                <option value="other">Other</option>
              </select>
            </label>
          );
        }

        const inputType =
          field.type === "date"
            ? "date"
            : field.type === "number" || field.type === "currency"
            ? "number"
            : "text";

        return (
          <label
            key={field.id}
            style={{ display: "grid", gap: 6, fontSize: 14 }}
          >
            <span>
              {field.label} {field.required ? "*" : ""}
            </span>
            <input
              type={inputType}
              value={value}
              placeholder={field.placeholder ?? ""}
              onChange={(e) => updateValue(field.id, e.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 12,
              }}
            />
          </label>
        );
      })}

      <button
        type="submit"
        style={{
          border: "none",
          borderRadius: 10,
          padding: "12px 16px",
          background: "#0f172a",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Save Asset
      </button>
    </form>
  );
}