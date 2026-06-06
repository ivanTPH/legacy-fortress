import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { getVerificationQueueData } from "@/components/admin/prototype/prototypeDataService";
import {
  PlatformActionRow,
  PlatformChip,
  PlatformEmptyState,
  PlatformNotice,
  PlatformSection,
  platformChipRowStyle,
} from "@/components/ui/PlatformPrimitives";
import type { CSSProperties } from "react";

export default function AdminVerificationsPage() {
  const queue = getVerificationQueueData();

  return (
    <AdminPrototypeShell
      title="Verification queue"
      description="Static workflow view for death certificate review, evidence checks, and access unlock readiness."
    >
      <PlatformNotice icon="verified_user">
        Manual verification only. This prototype shows review flow and queue state without automated legal decisions or access unlocks.
      </PlatformNotice>

      <section style={platformChipRowStyle} aria-label="Verification workflow">
        {queue.workflowSteps.map((step) => (
          <PlatformChip key={step}>{step}</PlatformChip>
        ))}
      </section>

      <section style={platformChipRowStyle} aria-label="Verification lifecycle counts">
        {Object.entries(queue.lifecycleCounts).map(([stage, count]) => (
          <PlatformChip key={stage}>{stage}: {count}</PlatformChip>
        ))}
      </section>

      <section style={{ display: "grid", gap: 14 }}>
        {queue.groups.map((group) => (
          <PlatformSection
            key={group.title}
            title={group.title}
            detail={group.detail}
            icon={group.icon}
            action={<span style={countStyle}>{group.rows.length}</span>}
          >
            {group.rows.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {group.rows.map((item) => (
                  <Link key={item.id} href={`/internal/admin/prototype/cases/${item.id}`} style={queueCardStyle}>
                    <PlatformActionRow
                      title={item.userName}
                      detail={`${item.lifecycleStage} · ${item.executorStatus} · ${item.nextAction}`}
                      status={<AdminStatusBadge status={item.status} />}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <PlatformEmptyState title="No cases in this group" detail="New verification work will appear here when the mock case status matches this stage." icon="task_alt" />
            )}
          </PlatformSection>
        ))}
      </section>

      <PlatformSection
        title="Executor workflow realism"
        detail="Static lifecycle events show how executor requests move from evidence submission through manual review to controlled unlock readiness."
        icon="history"
      >
        <div style={timelineGridStyle}>
          {queue.operationalTimeline.map((event) => (
            <section key={event.id} style={timelineCardStyle}>
              <strong>{event.label}</strong>
              <span style={timelineDetailStyle}>{event.detail}</span>
              <span style={timelineDetailStyle}>{event.time}</span>
            </section>
          ))}
        </div>
      </PlatformSection>
    </AdminPrototypeShell>
  );
}

const countStyle: CSSProperties = {
  borderRadius: 999,
  background: "#f1ece8",
  color: "var(--lf-text-soft)",
  padding: "4px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const queueCardStyle: CSSProperties = {
  textDecoration: "none",
  color: "var(--lf-text)",
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

const timelineDetailStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 13,
  lineHeight: 1.4,
};
