"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import type { AssetFieldOption } from "../../../lib/assets/fieldDictionary";
import Icon from "../../ui/Icon";

type SharedProps = {
  label: string;
  iconName?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: ReactNode;
};

export function FormField({ label, iconName, required = false, error, helpText, children }: SharedProps) {
  return (
    <label style={fieldWrapStyle}>
      <span style={labelStyle}>
        {iconName ? <Icon name={iconName} size={16} style={{ color: "#475569" }} /> : null}
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      <ValidationText error={error} helpText={helpText} />
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} disabled={disabled} />;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return <input type="number" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} disabled={disabled} />;
}

export function TextAreaInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
      disabled={disabled}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AssetFieldOption[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} disabled={disabled}>
      <option value="">{placeholder ?? "Select an option"}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function DateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return <input type="date" value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} disabled={disabled} />;
}

export function ToggleInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" style={value === "yes" ? toggleActiveStyle : toggleStyle} disabled={disabled} onClick={() => onChange("yes")}>
        Yes
      </button>
      <button type="button" style={value === "no" ? toggleActiveStyle : toggleStyle} disabled={disabled} onClick={() => onChange("no")}>
        No
      </button>
    </div>
  );
}

export function FileUploadPlaceholder() {
  return (
    <div style={filePlaceholderStyle}>
      Document upload integration coming next.
    </div>
  );
}

export function FileDropzone({
  label,
  accept,
  file,
  onFileSelect,
  onClear,
  disabled = false,
}: {
  label: string;
  accept: string;
  file: File | null;
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) onFileSelect(nextFile);
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      style={{
        ...dropzoneStyle,
        borderColor: isDragging ? "#0f172a" : "#cbd5e1",
        background: isDragging ? "#f8fafc" : "#fff",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        style={{ display: "none" }}
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          if (nextFile) onFileSelect(nextFile);
          event.currentTarget.value = "";
        }}
      />
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="upload_file" size={18} />
          <strong style={{ fontSize: 13 }}>{label}</strong>
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>Drag and drop or click to choose a file</div>
        {file ? (
          <div style={filePreviewStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {previewUrl ? (
                <img src={previewUrl} alt={file.name} style={previewImageStyle} />
              ) : (
                <Icon name="description" size={16} />
              )}
              <span style={{ fontSize: 13 }}>{file.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>{formatBytes(file.size)}</span>
              {onClear ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClear();
                  }}
                  style={clearButtonStyle}
                >
                  <Icon name="close" size={16} />
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ValidationText({ error, helpText }: { error?: string; helpText?: string }) {
  if (error) {
    return <span style={{ color: "#b91c1c", fontSize: 12 }}>{error}</span>;
  }
  if (helpText) {
    return <span style={{ color: "#64748b", fontSize: 12 }}>{helpText}</span>;
  }
  return <span style={{ color: "#94a3b8", fontSize: 12 }}>Required fields are marked *</span>;
}

export const fieldWrapStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

export const labelStyle: CSSProperties = {
  fontSize: 13,
  color: "#334155",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

const toggleStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  background: "#fff",
};

const toggleActiveStyle: CSSProperties = {
  ...toggleStyle,
  background: "#111827",
  borderColor: "#111827",
  color: "#fff",
};

const filePlaceholderStyle: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 12,
  color: "#64748b",
};

const dropzoneStyle: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 12,
  padding: 12,
  outline: "none",
};

const filePreviewStyle: CSSProperties = {
  marginTop: 4,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "8px 10px",
  background: "#f8fafc",
};

const previewImageStyle: CSSProperties = {
  width: 28,
  height: 28,
  objectFit: "cover",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
};

const clearButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 8,
  padding: "4px 8px",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  cursor: "pointer",
  fontSize: 12,
};

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
