import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import Icon from "../../../../components/ui/Icon";

type AssetItemLink = {
  id: string;
  label: string;
  href: string;
  meta?: string;
};

type DashboardAssetSummaryCardProps = {
  icon: ReactNode;
  title: string;
  href: string;
  addedAt?: string | null;
  value: string;
  detail: string;
  obscured?: boolean;
  items?: AssetItemLink[];
  emptyActionLabel?: string;
  onEmptyActionClick?: () => void;
  className?: string;
  overview?: ReactNode;
};

export default function DashboardAssetSummaryCard({
  icon,
  title,
  href,
  addedAt,
  value,
  detail,
  obscured = false,
  items = [],
  emptyActionLabel = "Add first record",
  onEmptyActionClick,
  className = "",
  overview,
}: DashboardAssetSummaryCardProps) {
  const router = useRouter();

  function onCardClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a")) return;
    router.push(href);
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    router.push(href);
  }

  return (
    <div
      className={className}
      style={cardStyle}
      role="link"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
      aria-label={`${title} summary`}
    >
      <Link href={href} style={summaryLinkStyle}>
        <div style={headerStyle}>
          <span style={iconStyle}>{icon}</span>
          <span style={titleStyle}>{title}</span>
        </div>
        <div style={valueStyle}>{obscured ? "Restricted" : value}</div>
        <div style={detailStyle}>{obscured ? "Detail hidden for this role" : detail}</div>
        {overview ? <div style={overviewWrapStyle}>{overview}</div> : null}
      </Link>

      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8, display: "grid", gap: 6 }}>
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <Link key={item.id} href={item.href} style={itemLinkStyle} className="lf-dashboard-item-link">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="chevron_right" size={16} />
                {item.label}
              </span>
              {item.meta ? <span style={{ color: "#94a3b8", fontSize: 12 }}>{item.meta}</span> : null}
            </Link>
          ))
        ) : onEmptyActionClick ? (
          <button
            type="button"
            style={{ ...itemLinkStyle, background: "#fff", width: "100%", textAlign: "left", cursor: "pointer" }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEmptyActionClick();
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="add_circle" size={16} />
              {emptyActionLabel}
            </span>
          </button>
        ) : (
          <Link href={href} style={itemLinkStyle}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="open_in_new" size={16} />
              {emptyActionLabel}
            </span>
          </Link>
        )}
        <div style={footerStyle}>
          <span style={dateStyle}>Updated {formatDateStamp(addedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function formatDateStamp(input?: string | null) {
  if (!input) return "Not yet added";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(new Date(input));
  } catch {
    return input;
  }
}

const cardStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "1fr auto",
  alignContent: "start",
  gap: 8,
  height: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
  textDecoration: "none",
  color: "#111827",
  boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
};

const summaryLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  display: "grid",
  gap: 8,
  alignContent: "start",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 24,
};

const iconStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 8,
  background: "#111827",
  color: "#fff",
  display: "inline-grid",
  placeItems: "center",
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};

const dateStyle: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const valueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.2,
};

const detailStyle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const itemLinkStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  border: "1px solid #eef2f7",
  borderRadius: 10,
  padding: "6px 8px",
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 13,
};

const overviewWrapStyle: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 10,
};
