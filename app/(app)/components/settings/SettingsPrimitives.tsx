import type { CSSProperties, ReactNode } from "react";
import { LFPageHeader } from "../../../../components/ui/LFDesignSystem";

export function SettingsPageShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="lf-settings-page-shell" style={{ display: "grid", gap: 24, maxWidth: 960 }}>
      <LFPageHeader title={title} description={subtitle} />
      {children}
    </div>
  );
}

export function SettingsCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="lf-settings-card" style={cardStyle}>
      <div style={{ display: "grid", gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
        {description ? <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}

export function StatusNote({ message }: { message: string }) {
  if (!message) return null;
  return <div style={{ color: "#6b7280", fontSize: 13 }}>{message}</div>;
}

export const cardStyle: CSSProperties = {
  border: "1px solid #EBE4DE",
  borderRadius: 12,
  padding: 22,
  background: "#fff",
  display: "grid",
  gap: 18,
  boxShadow: "none",
};

export const gridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #E6DFD9",
  borderRadius: 8,
  fontSize: 15,
  background: "#FFFFFF",
};

export const textAreaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 110,
  resize: "vertical",
};

export const primaryBtn: CSSProperties = {
  padding: "10px 12px",
  minHeight: 36,
  borderRadius: 8,
  border: "1px solid #2B1714",
  background: "#2B1714",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
};

export const ghostBtn: CSSProperties = {
  padding: "10px 12px",
  minHeight: 36,
  borderRadius: 8,
  border: "1px solid #E6DFD9",
  background: "#FFFFFF",
  color: "#2B1714",
  cursor: "pointer",
  fontSize: 13,
};
