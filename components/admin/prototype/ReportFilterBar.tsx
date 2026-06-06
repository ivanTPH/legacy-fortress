"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Icon from "../../ui/Icon";
import { reportFilterDefinitions, type ReportFilters } from "./reportInsights";
import type { Organisation } from "./mockData";

type ReportFilterBarProps = {
  filters: ReportFilters;
  organisations: Organisation[];
  lockedOrganisationName?: string;
  activeChips: Array<{ key: keyof ReportFilters; label: string }>;
  clearHref: string;
};

export default function ReportFilterBar({
  filters,
  organisations,
  lockedOrganisationName,
  activeChips,
  clearHref,
}: ReportFilterBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [runStatus, setRunStatus] = useState("Report has not been run in this view yet.");
  const runLabel = useMemo(() => {
    if (!activeChips.length) return "all safe prototype records";
    return activeChips.map((chip) => chip.label).join(", ");
  }, [activeChips]);

  function updateFilter(key: keyof ReportFilters, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    setRunStatus("Filters changed. Run report to refresh the visible result summary.");
  }

  function runReport() {
    setRunStatus(`Report run for ${runLabel}. Results below now reflect the selected safe filters.`);
  }

  return (
    <section style={filterBarStyle} aria-label="Report filters">
      <div style={filterHeaderStyle}>
        <div>
          <h2 style={h2Style}>
            <Icon name="filter_alt" size={19} />
            Report filters
          </h2>
          <p style={helperTextStyle}>Combine filters to narrow the prototype report. Values remain banded and mock-only.</p>
        </div>
        <div style={headerActionsStyle}>
          <button type="button" style={runButtonStyle} onClick={runReport}>
            Run report
          </button>
          {activeChips.length ? <Link href={clearHref} style={clearLinkStyle}>Clear all</Link> : null}
        </div>
      </div>

      <div style={controlsGridStyle}>
        {lockedOrganisationName ? (
          <div style={lockedControlStyle}>
            <span style={labelStyle}>Organisation</span>
            <strong>{lockedOrganisationName}</strong>
          </div>
        ) : (
          <label style={controlStyle}>
            <span style={labelStyle}>Organisation</span>
            <select value={filters.orgId ?? ""} onChange={(event) => updateFilter("orgId", event.target.value)} style={selectStyle}>
              <option value="">All organisations</option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>{organisation.name}</option>
              ))}
            </select>
          </label>
        )}

        {reportFilterDefinitions.map((definition) => (
          <label key={definition.key} style={controlStyle}>
            <span style={labelStyle}>{definition.label}</span>
            <select
              value={filters[definition.key] ?? ""}
              onChange={(event) => updateFilter(definition.key, event.target.value)}
              style={selectStyle}
            >
              <option value="">Any</option>
              {definition.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {activeChips.length ? (
        <div style={chipRowStyle} aria-label="Active report filters">
          {activeChips.map((chip) => (
            <span key={`${chip.key}-${chip.label}`} style={activeChipStyle}>{chip.label}</span>
          ))}
        </div>
      ) : (
        <p style={emptyFilterTextStyle}>No filters applied. Showing all safe prototype records in scope.</p>
      )}

      <div style={runStatusStyle} role="status" aria-live="polite">
        <strong>Run state</strong>
        <span>{runStatus}</span>
      </div>
    </section>
  );
}

const filterBarStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 12,
};

const filterHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
  flexWrap: "wrap",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const helperTextStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "var(--lf-text-soft)",
  fontSize: 13,
};

const controlsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const controlStyle: CSSProperties = {
  display: "grid",
  gap: 5,
};

const lockedControlStyle: CSSProperties = {
  border: "1px solid #d8cec3",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  padding: "8px 10px",
  display: "grid",
  gap: 4,
};

const labelStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
};

const selectStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: "8px 9px",
  fontSize: 13,
  fontWeight: 700,
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const activeChipStyle: CSSProperties = {
  border: "1px solid #d8cec3",
  borderRadius: 999,
  background: "#f5f1ec",
  color: "var(--lf-bronze)",
  padding: "6px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const clearLinkStyle: CSSProperties = {
  color: "var(--lf-bronze)",
  fontWeight: 800,
  textDecoration: "none",
  fontSize: 13,
};

const runButtonStyle: CSSProperties = {
  border: "1px solid var(--lf-bronze-strong)",
  borderRadius: 8,
  background: "var(--lf-bronze-strong)",
  color: "#fff",
  padding: "8px 11px",
  fontSize: 13,
  fontWeight: 850,
  cursor: "pointer",
};

const emptyFilterTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 13,
};

const runStatusStyle: CSSProperties = {
  border: "1px solid #e7ddd4",
  borderRadius: 8,
  background: "#fffefd",
  color: "var(--lf-text)",
  padding: "9px 10px",
  display: "grid",
  gap: 3,
  fontSize: 13,
};
