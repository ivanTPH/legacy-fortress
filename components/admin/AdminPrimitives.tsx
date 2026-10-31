import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "../ui/Icon";

export type AdminDataColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  cardLabel?: string;
  /** Phone list rows: hide a column that adds nothing on a small screen. */
  mobile?: "hide";
};

const STATUS_HEADERS = new Set(["Status", "Stage", "Result"]);

export default function AdminDataTable<T>({
  caption,
  description,
  actions,
  columns,
  rows,
  getRowKey,
  emptyState,
}: {
  caption: string;
  description?: ReactNode;
  actions?: ReactNode;
  columns: Array<AdminDataColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  emptyState: ReactNode;
}) {
  return (
    <div className="lf-admin-data-table-wrap">
      {(description || actions) ? (
        <div className="lf-admin-data-toolbar">
          {description ? <div>{description}</div> : <span />}
          {actions ? <div className="lf-admin-data-toolbar-actions">{actions}</div> : null}
        </div>
      ) : null}
      <table className="lf-admin-data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyState}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <div className="lf-admin-data-cards" aria-label={`${caption} list`}>
        {rows.map((row) => {
          // V5.1 phone rows: title, one sub-line, status chip, action or chevron. No field labels.
          const [titleColumn, ...rest] = columns;
          const statusColumn = rest.find((column) => STATUS_HEADERS.has(column.header));
          const actionColumn = rest.find((column) => column.header === "" || column.header === "Actions");
          const metaColumns = rest.filter((column) => column !== statusColumn && column !== actionColumn && column.mobile !== "hide").slice(0, 2);
          return (
            <article key={getRowKey(row)} className="lf-admin-data-card">
              <div className="lf-admin-data-card-main">
                <div className="lf-admin-data-card-title">{titleColumn?.render(row)}</div>
                {metaColumns.length ? <div className="lf-admin-data-card-meta">{metaColumns.map((column) => <span key={column.key}>{column.render(row)}</span>)}</div> : null}
                {statusColumn ? <div className="lf-admin-data-card-status">{statusColumn.render(row)}</div> : null}
              </div>
              {actionColumn ? <div className="lf-admin-data-card-action">{actionColumn.render(row)}</div> : null}
            </article>
          );
        })}
        {rows.length === 0 ? <div className="lf-admin-empty-state">{emptyState}</div> : null}
      </div>
      <style jsx global>{adminPrimitiveCss}</style>
    </div>
  );
}

const STATUS_ICON: Record<string, string> = { success: "check_circle", warning: "hourglass_top", danger: "cancel", neutral: "" };

/** Sentence case for status words: "review_required" → "Review required". */
export function sentenceCaseStatus(value: string) {
  const text = String(value || "Unknown").replace(/[_-]+/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function AdminStatusBadge({ status, label }: { status: string; label?: string }) {
  const normalized = String(status || "unknown").toLowerCase();
  // Negative states first: "inactive" contains "active" and "not_verified" contains "verified".
  const negative = /(^|[_\s-])(not|un|in)[_\s-]?(verified|active|accepted|approved)/.test(normalized);
  const tone = negative
    ? normalized.includes("inactive") ? "danger" : "warning"
    : normalized === "ok" || normalized === "healthy" || normalized.includes("active") || normalized.includes("success") || normalized.includes("accepted") || normalized.includes("verified") || normalized.includes("approved")
    ? "success"
    : normalized === "warning" || normalized === "attention" || normalized.includes("pending") || normalized.includes("sent") || normalized.includes("review") || normalized.includes("required") || normalized.includes("waiting")
      ? "warning"
      : normalized === "error" || normalized === "critical" || normalized.includes("revoked") || normalized.includes("inactive") || normalized.includes("failed") || normalized.includes("rejected")
        ? "danger"
        : "neutral";
  // CONSISTENCY.md: chips carry an icon and a word, never colour alone.
  const icon = normalized === "not measured" || normalized === "unavailable" ? "" : STATUS_ICON[tone];
  return <span className={`lf-admin-status-badge ${tone}`}>{icon ? <Icon name={icon} size={14} /> : null}{label ?? sentenceCaseStatus(status)}</span>;
}

/** Filter chips with counts (V5 admin page template). The selected chip is ink. */
export function AdminFilterChips<K extends string>({ label, options, value, onChange }: {
  label: string;
  options: Array<{ key: K; label: string; count?: number }>;
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="lf-admin-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.key} type="button" aria-pressed={value === option.key} onClick={() => onChange(option.key)}>
          {option.label}{typeof option.count === "number" ? ` · ${option.count}` : ""}
        </button>
      ))}
    </div>
  );
}

/** One white card of equal stat columns: label 13 secondary, value 22/600. */
export function AdminStatStrip({ label, items }: { label: string; items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <section className="lf-admin-stat-strip" aria-label={label}>
      {items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
    </section>
  );
}

/** Neutral note box with an icon (info, lock, shield_lock). */
export function AdminNote({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return <p className="lf-admin-note"><Icon name={icon} size={18} /><span>{children}</span></p>;
}

export function AdminMetricCard({
  label,
  value,
  detail,
  href,
  onClick,
  actionLabel,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const body = (
    <>
      <span className="lf-admin-metric-label">{label}</span>
      <strong className="lf-admin-metric-value">{value}</strong>
      {detail ? <small className="lf-admin-metric-detail">{detail}</small> : null}
      {actionLabel ? <span className="lf-admin-metric-action-label">{actionLabel}</span> : null}
      <style jsx global>{adminPrimitiveCss}</style>
    </>
  );

  if (href) {
    return <Link href={href} className="lf-admin-metric-card lf-admin-metric-card--interactive" aria-label={`${typeof value === "string" || typeof value === "number" ? `${value} ` : ""}${label}. Open ${actionLabel ?? label}`} prefetch={false}>{body}<Icon name="chevron_right" size={18} className="lf-admin-metric-chevron" /></Link>;
  }

  if (onClick) {
    return <button type="button" className="lf-admin-metric-card lf-admin-metric-card-button lf-admin-metric-card--interactive" onClick={onClick} aria-label={`${typeof value === "string" || typeof value === "number" ? `${value} ` : ""}${label}. Open ${actionLabel ?? label}`}>{body}<Icon name="chevron_right" size={18} className="lf-admin-metric-chevron" /></button>;
  }

  return <article className="lf-admin-metric-card lf-admin-metric-card--informational">{body}</article>;
}

export function AdminContextHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="lf-admin-context-help">
      <span aria-hidden="true" className="material-symbols-outlined">help</span>
      <span>
        <strong>{label}</strong>
        <small>{children}</small>
      </span>
      <style jsx global>{adminPrimitiveCss}</style>
    </span>
  );
}

export function AdminEmptyState({ title, children, icon }: { title: string; children: ReactNode; icon?: string }) {
  return (
    <div className="lf-admin-empty-state">
      {icon ? <span className="lf-admin-empty-icon" aria-hidden="true"><Icon name={icon} size={22} /></span> : null}
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}

const adminPrimitiveCss = `
  .lf-admin-data-table-wrap {
    width: 100%;
    min-width: 0;
    overflow-x: auto;
  }
  .lf-admin-data-toolbar {
    align-items: center;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    min-width: 0;
  }
  .lf-admin-data-toolbar > div {
    min-width: 0;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .lf-admin-data-toolbar-actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }
  .lf-admin-data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    table-layout: auto;
  }
  .lf-admin-data-table caption {
    height: 1px;
    overflow: hidden;
    position: absolute;
    width: 1px;
  }
  .lf-admin-data-table th,
  .lf-admin-data-table td {
    border-bottom: 1px solid var(--lf-border);
    padding: 10px;
    text-align: left;
    vertical-align: middle;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .lf-admin-data-table th {
    color: var(--lf-text);
    color: var(--lf-text-secondary);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    word-break: keep-all;
  }
  .lf-admin-data-table small,
  .lf-admin-data-card small {
    color: var(--lf-text-secondary);
    display: block;
    line-height: 1.35;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .lf-admin-status-badge {
    align-items: center;
    border: 1px solid var(--lf-border-input);
    border-radius: 999px;
    display: inline-flex;
    font-size: 12px;
    font-weight: 800;
    min-height: 26px;
    padding: 3px 9px;
    gap: 4px;
    white-space: nowrap;
    word-break: keep-all;
  }
  .lf-admin-status-badge.success {
    background: var(--lf-status-approved-bg);
    border-color: var(--lf-status-approved-bg);
    color: var(--lf-status-approved-text);
  }
  .lf-admin-status-badge.warning {
    background: var(--lf-status-pending-bg);
    border-color: var(--lf-status-pending-bg);
    color: var(--lf-status-pending-text);
  }
  .lf-admin-status-badge.danger {
    background: var(--lf-status-rejected-bg);
    border-color: var(--lf-status-rejected-bg);
    color: var(--lf-status-rejected-text);
  }
  .lf-admin-status-badge.neutral {
    background: var(--lf-surface-page);
    color: var(--lf-text);
  }
  .lf-admin-data-cards {
    display: none;
  }
  .lf-admin-metric-card {
    position: relative;
    background: var(--lf-surface-card);
    border: 1px solid #e3dad3;
    border-radius: 12px;
    color: inherit;
    display: grid;
    gap: 6px;
    min-width: 0;
    min-height: 76px;
    padding: 16px;
    text-align: left;
    text-decoration: none;
  }
  .lf-admin-metric-card-button {
    cursor: pointer;
    font: inherit;
  }
  .lf-admin-metric-card--interactive { padding-right: 36px; }
  .lf-admin-metric-card--interactive:hover { background: var(--lf-surface-hover); }
  .lf-admin-metric-card--interactive:active { background: var(--lf-surface-pressed); }
  .lf-admin-metric-card--interactive:focus-visible { outline: 2px solid var(--lf-focus); outline-offset: 2px; }
  .lf-admin-metric-chevron { position: absolute; top: 14px; right: 12px; color: var(--lf-text-secondary); }
  .lf-admin-metric-card--informational { min-height: 0; padding: 8px 0; border: 0; border-radius: 0; background: transparent; }
  .lf-admin-metric-label {
    color: var(--lf-text-secondary);
    font-size: 13px;
    font-weight: 500;
  }
  .lf-admin-metric-value {
    color: var(--lf-text);
    display: block;
    font-size: 22px;
    line-height: 1.1;
    overflow-wrap: break-word;
  }
  .lf-admin-metric-detail {
    color: var(--lf-text-secondary);
    display: block;
    line-height: 1.35;
  }
  .lf-admin-metric-action-label {
    color: #1d4ed8;
    font-size: 13px;
    font-weight: 800;
  }
  .lf-admin-context-help {
    align-items: flex-start;
    background: var(--lf-surface-page);
    border: 1px solid var(--lf-border);
    border-radius: 8px;
    color: var(--lf-text);
    display: inline-flex;
    gap: 8px;
    padding: 9px 10px;
  }
  .lf-admin-context-help .material-symbols-outlined {
    color: var(--lf-text-secondary);
    font-size: 18px;
    line-height: 1.3;
  }
  .lf-admin-context-help strong,
  .lf-admin-context-help small {
    display: block;
  }
  .lf-admin-context-help small {
    color: var(--lf-text-secondary);
    line-height: 1.35;
  }
  .lf-admin-empty-state {
    background: var(--lf-surface-card);
    border: 1px solid var(--lf-border);
    border-radius: 8px;
    color: var(--lf-text-secondary);
    display: grid;
    gap: 4px;
    justify-items: center;
    padding: 24px 16px;
    text-align: center;
  }
  @media (max-width: 720px) {
    .lf-admin-data-table {
      display: none;
    }
    .lf-admin-data-cards {
      display: grid;
      gap: 10px;
      min-width: 0;
    }
    .lf-admin-data-toolbar {
      align-items: stretch;
      display: grid;
    }
    .lf-admin-data-toolbar-actions {
      justify-content: flex-start;
    }
    .lf-admin-data-card {
      background: var(--lf-surface-card);
      border: 1px solid var(--lf-border);
      border-radius: 8px;
      display: grid;
      gap: 10px;
      padding: 12px;
    }
    .lf-admin-data-card > div {
      display: grid;
      gap: 3px;
      min-width: 0;
    }
    .lf-admin-data-card > div > span {
      color: var(--lf-text-secondary);
      font-size: 13px;
      font-weight: 600;
    }
  }
`;
