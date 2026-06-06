import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { getAdminOverviewData } from "@/components/admin/prototype/prototypeDataService";
import {
  PlatformActionRow,
  PlatformSection,
  PlatformStatCard,
  platformCtaStyle,
  platformKpiGridStyle,
  platformSplitGridStyle,
} from "@/components/ui/PlatformPrimitives";
import type { CSSProperties } from "react";

export default function InternalAdminPage() {
  const data = getAdminOverviewData();

  return (
    <AdminPrototypeShell
      title="Admin overview"
      description="Static operations prototype for case management, verification review, access control, and audit visibility."
    >
      <section style={platformKpiGridStyle} aria-label="Probate operations summary">
        <PlatformStatCard icon="folder_managed" label="Open cases" value={String(data.openCases)} detail="Not closed" />
        <PlatformStatCard icon="verified_user" label="Awaiting review" value={String(data.awaitingReview)} detail="Pending or under review" tone={data.awaitingReview ? "warning" : "success"} />
        <PlatformStatCard icon="lock_open" label="Unlock pending" value={String(data.unlockPending)} detail="Approved access queue" tone={data.unlockPending ? "warning" : "default"} />
        <PlatformStatCard icon="group" label="Users in review" value={String(data.usersInReview)} detail="Non-active vault status" />
      </section>

      <section style={platformSplitGridStyle}>
        <PlatformSection
          title="Priority cases"
          detail="Cases that need operational attention first. Static prototype data only."
          icon="assignment_late"
          emphasis="primary"
          action={<Link href="/internal/admin/prototype/cases" style={platformCtaStyle}>View all cases</Link>}
        >
          <div style={{ display: "grid", gap: 8 }}>
            {data.priorityCases.map((item) => (
              <Link key={item.id} href={`/internal/admin/prototype/cases/${item.id}`} style={rowLinkStyle}>
                <PlatformActionRow
                  title={item.userName}
                  detail={item.caseType}
                  status={<AdminStatusBadge status={item.status} />}
                />
              </Link>
            ))}
          </div>
        </PlatformSection>

        <PlatformSection
          title="Recent audit events"
          detail="A compact view of operational activity. No live events are written from the prototype."
          icon="history"
          action={<Link href="/internal/admin/prototype/audit" style={platformCtaStyle}>Open audit</Link>}
        >
          <div style={{ display: "grid", gap: 8 }}>
            {data.recentAuditEvents.map((item) => (
              <PlatformActionRow
                key={item.id}
                title={item.action}
                detail={`${item.actor} · ${item.timestamp}`}
                status={<AdminStatusBadge status={item.result} />}
              />
            ))}
          </div>
        </PlatformSection>
      </section>
    </AdminPrototypeShell>
  );
}

const rowLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "var(--lf-text)",
};
