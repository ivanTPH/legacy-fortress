import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import Icon from "../../../../components/ui/Icon";
import { LFPageHeader } from "../../../../components/ui/LFDesignSystem";

export function SettingsPageShell({ title, subtitle, children, compact = false }: { title: string; subtitle: string; children: ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? "lf-settings-page-shell lf-v52-settings-compact" : "lf-settings-page-shell"}>
      <Link href="/settings" className="lf-v52-settings-back"><Icon name="arrow_back" size={20} />Settings</Link>
      <LFPageHeader title={title} description={compact ? undefined : subtitle} />
      {children}
    </div>
  );
}

export function SettingsCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="lf-settings-card">
      <div className="lf-settings-card-heading">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="lf-settings-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StatusNote({ message }: { message: string }) {
  if (!message) return null;
  return <div className="lf-settings-status-note" role="status">{message}</div>;
}

export const cardStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: "var(--lf-radius-card)",
  padding: 22,
  background: "var(--lf-surface-card)",
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
  border: "1px solid var(--lf-border-input)",
  borderRadius: "var(--lf-radius-input)",
  fontSize: 16,
  background: "var(--lf-surface-card)",
  color: "var(--lf-text)",
};

export const textAreaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 110,
  resize: "vertical",
};

export const primaryBtn: CSSProperties = {
  padding: "10px 12px",
  minHeight: 44,
  borderRadius: "var(--lf-radius-input)",
  border: "1px solid var(--lf-primary-bg)",
  background: "var(--lf-primary-bg)",
  color: "var(--lf-primary-text)",
  cursor: "pointer",
  fontSize: 16,
};

export const ghostBtn: CSSProperties = {
  padding: "10px 12px",
  minHeight: 44,
  borderRadius: "var(--lf-radius-input)",
  border: "1px solid var(--lf-border-control)",
  background: "var(--lf-surface-card)",
  color: "var(--lf-text)",
  cursor: "pointer",
  fontSize: 16,
};
