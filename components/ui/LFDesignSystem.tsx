"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Icon from "./Icon";

export function LFButton({
  children,
  variant = "primary",
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "text"; icon?: string }) {
  return (
    <button className={`lf-ui-button lf-ui-button-${variant} ${className}`.trim()} {...props}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

export function LFIconTile({ icon, size = "large" }: { icon: string; size?: "small" | "medium" | "large" }) {
  return <span className={`lf-ui-icon-tile lf-ui-icon-tile-${size}`}><Icon name={icon} size={size === "small" ? 18 : 20} /></span>;
}

export function LFCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`lf-ui-card ${className}`.trim()}>{children}</section>;
}

export function LFPageHeader({
  title,
  description,
  action,
  actionNode,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string; icon?: string };
  actionNode?: ReactNode;
}) {
  return (
    <div className="lf-ui-page-header">
      <div className="lf-ui-page-header-copy">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actionNode ?? (action?.label === "Add record" ? <AddAssetLink href={action.href} /> : action ? <Link className="lf-ui-button lf-ui-button-primary" href={action.href}>{action.icon ? <Icon name={action.icon} size={18} /> : null}{action.label}</Link> : null)}
    </div>
  );
}

export function AddAssetLink({ href }: { href: string }) {
  return <Link className="lf-v4-add-asset" href={href} aria-label="Add record" title="Add record"><Icon name="add" size={20} /><span className="lf-v4-add-label">Add record</span></Link>;
}

export function AddDocumentControl({ accept, onFilesSelected, disabled = false, multiple = false }: { accept: string; onFilesSelected: (files: File[]) => void; disabled?: boolean; multiple?: boolean }) {
  return <label className="lf-v4-add-document" title="Add document"><Icon name="note_add" size={20} /><span className="lf-v4-add-label">Add document</span><input type="file" aria-label="Add document" accept={accept} multiple={multiple} disabled={disabled} onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); if (files.length) onFilesSelected(files); event.currentTarget.value = ""; }} /></label>;
}

export function LFStatsStrip({ items }: { items: Array<{ label: string; value: string; suffix?: string }> }) {
  return (
    <div className="lf-ui-stats-strip">
      {items.map((item) => (
        <div className="lf-ui-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value} {item.suffix ? <small>{item.suffix}</small> : null}</strong>
        </div>
      ))}
    </div>
  );
}

export function LFEmptyTile({ icon, title, description, href }: { icon: string; title: string; description: string; href: string }) {
  return (
    <Link className="lf-ui-empty-tile" href={href}>
      <LFIconTile icon={icon} />
      <span><strong>{title}</strong><small>{description}</small></span>
      <Icon name="add_circle" size={20} />
    </Link>
  );
}

export function LFVaultAreaTile({
  title,
  description,
  icon,
  href,
  state,
  count,
  updatedAt,
}: {
  title: string;
  description: string;
  icon: string;
  href: string;
  state: "loading" | "populated" | "empty";
  count?: number;
  updatedAt?: string | null;
}) {
  const summary = state === "loading"
    ? "Loading your records..."
    : state === "empty"
      ? "Not added yet"
      : `${count ?? 0} ${(count ?? 0) === 1 ? "record" : "records"}${updatedAt ? ` · Updated ${formatVaultDate(updatedAt)}` : ""}`;

  return (
    <Link href={href} className={`lf-vault-area-tile is-${state}`} aria-busy={state === "loading" || undefined}>
      <span className="lf-vault-area-tile-icon"><Icon name={icon} size={20} /></span>
      <span className="lf-vault-area-tile-copy">
        <strong>{title}</strong>
        <small>{summary}</small>
        {state === "empty" ? <em>{description}</em> : null}
      </span>
      <Icon name={state === "empty" ? "add_circle" : "chevron_right"} size={20} />
    </Link>
  );
}

function formatVaultDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "date unavailable"
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
