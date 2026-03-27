import Link from "next/link";
import type { CompletionItem } from "../../../../lib/dashboard/completion";
import { humanizeCompletionStatus } from "../../../../lib/dashboard/completion";

type CompletionChecklistProps = {
  items: CompletionItem[];
};

export default function CompletionChecklist({ items }: CompletionChecklistProps) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#fff",
        padding: 14,
        display: "grid",
        gap: 10,
      }}
      aria-label="Completion checklist"
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 18 }}>What a strong record still needs</h2>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
          See which parts of the record an executor could rely on today, and where a little more detail would make the account safer and easier to use.
        </p>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {items.map((item) => (
          <li key={item.section}>
            <Link
              href={item.href}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                border: "1px solid #eef2f7",
                borderRadius: 12,
                padding: 10,
                textDecoration: "none",
                color: "#111827",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusDot status={item.status} />
                  <span style={{ fontWeight: 700 }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{humanizeCompletionStatus(item.status)}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                  {item.missingItems > 0 ? `${item.missingItems} item(s) still to review` : "Ready for someone else to review"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{item.percent}%</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {item.status === "complete" ? "Review details" : "Improve next"}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusDot({ status }: { status: CompletionItem["status"] }) {
  const color = status === "complete" ? "#059669" : status === "in_progress" ? "#d97706" : "#9ca3af";
  return (
    <span
      aria-hidden
      style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }}
    />
  );
}
