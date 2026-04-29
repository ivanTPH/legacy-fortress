import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import Icon from "../../../../components/ui/Icon";
import { IconButton } from "../../../../components/ui/IconButton";

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
  inlineSummary?: boolean;
  actionLabel?: string;
  actionIcon?: string;
  hideItems?: boolean;
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
  inlineSummary = false,
  actionLabel,
  actionIcon = "open_in_new",
  hideItems = false,
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
      <div style={summaryLinkStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={iconStyle}>{icon}</span>
            <span style={titleStyle}>{title}</span>
          </div>
          <IconButton
            icon={actionIcon}
            label={actionLabel ?? `Open ${title}`}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              router.push(href);
            }}
          />
        </div>
        {inlineSummary ? (
          <div style={inlineSummaryStyle}>
            <span style={valueStyle}>{obscured ? "Restricted" : value}</span>
            <span style={detailStyle}>{obscured ? "Detail hidden for this role" : detail}</span>
          </div>
        ) : (
          <>
            <div style={valueStyle}>{obscured ? "Restricted" : value}</div>
            <div style={detailStyle}>{obscured ? "Detail hidden for this role" : detail}</div>
          </>
        )}
        {overview ? <div style={overviewWrapStyle}>{overview}</div> : null}
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8, display: "grid", gap: 6 }}>
        {!hideItems && items.length ? (
          items.slice(0, 4).map((item) => (
            <Link key={item.id} href={item.href} style={itemLinkStyle} className="lf-dashboard-item-link">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="chevron_right" size={16} />
                {item.label}
              </span>
              {item.meta ? <span style={{ color: "#94a3b8", fontSize: 12 }}>{item.meta}</span> : null}
            </Link>
          ))
        ) : !hideItems && onEmptyActionClick ? (
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
        ) : !hideItems ? (
          <Link href={href} style={itemLinkStyle}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="open_in_new" size={16} />
              {emptyActionLabel}
            </span>
          </Link>
        ) : null}
        <div style={footerStyle}>
          <span style={dateStyle}>{formatDateStamp(addedAt)}</span>
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
  gap: 12,
  height: "100%",
  border: "1px solid #e8e1dc",
  borderRadius: 12,
  padding: 22,
  background: "#fff",
  textDecoration: "none",
  color: "#111827",
  boxShadow: "0 1px 2px rgba(33,17,13,0.025)",
};

const summaryLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  display: "grid",
  gap: 12,
  alignContent: "start",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minHeight: 40,
};

const iconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "linear-gradient(180deg, #3a2118 0%, #21110d 100%)",
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
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1.2,
};

const detailStyle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const inlineSummaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  flexWrap: "wrap",
};

const itemLinkStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  border: "1px solid #eee8e3",
  borderRadius: 10,
  padding: "9px 10px",
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 13,
};

const overviewWrapStyle: CSSProperties = {
  border: "1px solid #eee8e3",
  borderRadius: 12,
  background: "#fffefd",
  padding: 10,
};
