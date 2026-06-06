import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { getCaseListData } from "@/components/admin/prototype/prototypeDataService";
import {
  PlatformChip,
  PlatformInfoTile,
  PlatformNotice,
  PlatformSection,
  PlatformTableScroll,
  platformChipRowStyle,
  platformInfoGridStyle,
} from "@/components/ui/PlatformPrimitives";
import type { CSSProperties, ReactNode } from "react";

export default function AdminCasesPage() {
  const data = getCaseListData();

  return (
    <AdminPrototypeShell
      title="Cases"
      description="Static case management list for verification, support, and controlled access workflows."
    >
      <PlatformNotice icon="shield_lock">
        Probate operations are manual, audit-oriented, and prototype-only. No legal decisioning or automatic access unlock is enabled.
      </PlatformNotice>

      <section style={platformInfoGridStyle} aria-label="Probate lifecycle summary">
        <PlatformInfoTile label="Priority cases" value={String(data.urgentCases)} tone={data.urgentCases ? "warning" : "success"} />
        <PlatformInfoTile label="Pending review" value={String(data.statusCounts.pendingReview)} />
        <PlatformInfoTile label="Unlock pending" value={String(data.statusCounts.unlockPending)} tone={data.statusCounts.unlockPending ? "warning" : "success"} />
        <PlatformInfoTile label="Restricted executors" value={String(data.executorRestrictedCases)} tone={data.executorRestrictedCases ? "warning" : "success"} />
      </section>

      <section style={platformChipRowStyle} aria-label="Case lifecycle stages">
        {Object.entries(data.lifecycleCounts).map(([stage, count]) => (
          <PlatformChip key={stage}>{stage}: {count}</PlatformChip>
        ))}
      </section>

      <section style={toolbarStyle}>
        <input aria-label="Search cases" placeholder="Search by user, case ID, or email" style={inputStyle} />
        <select aria-label="Filter by status" style={selectStyle} defaultValue="all">
          <option value="all">All statuses</option>
          <option>Pending</option>
          <option>Under Review</option>
          <option>Access Unlock Pending</option>
          <option>Closed</option>
        </select>
        <select aria-label="Filter by assignee" style={selectStyle} defaultValue="all">
          <option value="all">All assignees</option>
          <option>Assigned to me</option>
          <option>Unassigned</option>
        </select>
      </section>

      <section style={panelStyle}>
        <div style={statusGroupStyle}>
          <span>Pending review: {data.statusCounts.pendingReview}</span>
          <span>Under review: {data.statusCounts.underReview}</span>
          <span>Unlock pending: {data.statusCounts.unlockPending}</span>
        </div>
        <PlatformTableScroll label="Probate case table">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Status</Th>
                <Th>Lifecycle</Th>
                <Th>Executor</Th>
                <Th>Next action</Th>
                <Th>Last activity</Th>
                <Th>Assigned admin</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.cases.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <Link href={`/internal/admin/prototype/cases/${item.id}`} style={userLinkStyle}>
                      {item.userName}
                      <span style={mutedBlockStyle}>{item.userEmail}</span>
                    </Link>
                  </Td>
                  <Td><AdminStatusBadge status={item.status} /></Td>
                  <Td>{item.lifecycleStage}<span style={mutedBlockStyle}>{item.caseType}</span></Td>
                  <Td>{item.executorStatus}</Td>
                  <Td>{item.nextAction}</Td>
                  <Td>{item.lastActivity}</Td>
                  <Td>{item.assignedAdmin}</Td>
                  <Td><Link href={`/internal/admin/prototype/cases/${item.id}`} style={actionLinkStyle}>Open case</Link></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </PlatformTableScroll>
      </section>

      <PlatformSection
        title="Operational event timeline"
        detail="Static preview of the audit-oriented probate lifecycle. Each entry is non-production and does not unlock access."
        icon="history"
      >
        <div style={timelineGridStyle}>
          {data.operationalTimeline.map((event) => (
            <section key={event.id} style={timelineCardStyle}>
              <strong>{event.label}</strong>
              <span style={mutedBlockStyle}>{event.detail}</span>
              <span style={mutedBlockStyle}>{event.time}</span>
            </section>
          ))}
        </div>
      </PlatformSection>
    </AdminPrototypeShell>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
}

const toolbarStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const inputStyle: CSSProperties = {
  minWidth: 260,
  flex: 1,
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "9px 11px",
};

const selectStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "9px 11px",
  background: "#fff",
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  overflow: "hidden",
};

const statusGroupStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  padding: 12,
  borderBottom: "1px solid var(--lf-border)",
  color: "var(--lf-text-soft)",
  fontSize: 13,
  fontWeight: 700,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "11px 12px",
  borderBottom: "1px solid var(--lf-border)",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  textTransform: "uppercase",
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #f1ece8",
  verticalAlign: "top",
};

const userLinkStyle: CSSProperties = {
  color: "var(--lf-text)",
  fontWeight: 800,
  textDecoration: "none",
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 500,
  marginTop: 2,
};

const actionLinkStyle: CSSProperties = {
  color: "var(--lf-text)",
  fontWeight: 800,
  textDecoration: "none",
};

const timelineGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 10,
};

const timelineCardStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 5,
};
