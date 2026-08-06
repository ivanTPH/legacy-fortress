import type { ReactNode } from "react";

export type AdminDataColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  cardLabel?: string;
};

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
      <div className="lf-admin-data-cards" aria-label={`${caption} mobile cards`}>
        {rows.map((row) => (
          <article key={getRowKey(row)} className="lf-admin-data-card">
            {columns.map((column) => (
              <div key={column.key} className="lf-admin-data-card-row">
                <span>{column.cardLabel ?? column.header}</span>
                <div>{column.render(row)}</div>
              </div>
            ))}
          </article>
        ))}
        {rows.length === 0 ? <div className="lf-admin-empty-state">{emptyState}</div> : null}
      </div>
      <style jsx global>{adminPrimitiveCss}</style>
    </div>
  );
}

export function AdminStatusBadge({ status }: { status: string }) {
  const normalized = String(status || "unknown").toLowerCase();
  const tone = normalized.includes("active") || normalized.includes("success") || normalized.includes("accepted")
    ? "success"
    : normalized.includes("pending") || normalized.includes("sent") || normalized.includes("review")
      ? "warning"
      : normalized.includes("revoked") || normalized.includes("inactive") || normalized.includes("failed")
        ? "danger"
        : "neutral";
  return <span className={`lf-admin-status-badge ${tone}`}>{String(status || "Unknown").replace(/_/g, " ")}</span>;
}

export function AdminEmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="lf-admin-empty-state">
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
    overflow-wrap: anywhere;
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
    border-bottom: 1px solid #e2e8f0;
    padding: 10px;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  .lf-admin-data-table th {
    color: #334155;
    font-size: 12px;
    letter-spacing: .02em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .lf-admin-data-table small,
  .lf-admin-data-card small {
    color: #64748b;
    display: block;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .lf-admin-status-badge {
    align-items: center;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    display: inline-flex;
    font-size: 12px;
    font-weight: 800;
    min-height: 26px;
    padding: 3px 9px;
    text-transform: capitalize;
  }
  .lf-admin-status-badge.success {
    background: #ecfdf5;
    border-color: #bbf7d0;
    color: #166534;
  }
  .lf-admin-status-badge.warning {
    background: #fffbeb;
    border-color: #fde68a;
    color: #92400e;
  }
  .lf-admin-status-badge.danger {
    background: #fef2f2;
    border-color: #fecaca;
    color: #991b1b;
  }
  .lf-admin-status-badge.neutral {
    background: #f8fafc;
    color: #334155;
  }
  .lf-admin-data-cards {
    display: none;
  }
  .lf-admin-empty-state {
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    color: #475569;
    display: grid;
    gap: 4px;
    padding: 14px;
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
      background: #fff;
      border: 1px solid #e2e8f0;
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
      color: #64748b;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }
  }
`;
