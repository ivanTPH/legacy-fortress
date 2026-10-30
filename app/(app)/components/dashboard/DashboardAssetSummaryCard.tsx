import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
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
  addHref?: string;
  addLabel?: string;
  hideItems?: boolean;
  emptyState?: boolean;
  showAddAction?: boolean;
  referenceTile?: boolean;
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
  addHref,
  addLabel,
  hideItems = false,
  emptyState = false,
  showAddAction = true,
  referenceTile = false,
}: DashboardAssetSummaryCardProps) {
  const router = useRouter();

  function onCardClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a")) return;
    router.push(href);
  }

  return (
    referenceTile ? (
      <div
        className={`lf-dashboard-reference-tile ${className}`.trim()}
        role="group"
        onClick={() => router.push(href)}
        aria-label={`${title} summary`}
      >
        <Link href={href} className="lf-dashboard-reference-tile-header" aria-label={`Open ${title}`}>
          <span className="lf-dashboard-reference-tile-icon">{icon}</span>
          <span className="lf-dashboard-reference-tile-title">{title}</span>
          <Icon name="chevron_right" size={20} />
        </Link>
        <div className="lf-dashboard-reference-tile-footer">
          <span className={obscured ? "is-obscured" : ""}>{obscured ? "Restricted" : Number(value) === 0 ? "Nothing yet" : `${value} ${detail}`}</span>
          <span>{addedAt ? `Updated ${formatDateStamp(addedAt)}` : "Add first record"}</span>
        </div>
      </div>
    ) : (
    <div
      className={`lf-dashboard-summary-card ${className}`.trim()}
      style={cardStyle}
      role="group"
      onClick={onCardClick}
      aria-label={`${title} summary`}
    >
      <div className="lf-dashboard-summary-main" style={summaryLinkStyle}>
        <div className="lf-dashboard-summary-header" style={headerStyle}>
          <Link
            href={href}
            className="lf-dashboard-summary-title-wrap"
            aria-label={`Open ${title}`}
            style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", alignItems: "start", gap: 8, minWidth: 0, color: "inherit", textDecoration: "none" }}
          >
            <span className="lf-dashboard-summary-icon" style={iconStyle}>{icon}</span>
            <span className="lf-dashboard-summary-title" style={titleStyle}>{title}</span>
          </Link>
          {showAddAction && addHref ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconButton
                icon="add"
                label={addLabel ?? `Add ${title.toLowerCase()}`}
                style={{ width: 38, height: 38 }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  router.push(addHref);
                }}
              />
            </span>
          ) : showAddAction && !emptyState && onEmptyActionClick ? (
            <button
              type="button"
              aria-label={emptyActionLabel}
              title={emptyActionLabel}
              style={emptyPrimaryIconStyle}
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
              <Icon name="add" size={22} />
            </button>
          ) : showAddAction ? (
            <Link
              href={href}
              aria-label={emptyActionLabel}
              title={emptyActionLabel}
              style={emptyPrimaryIconStyle}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <Icon name="add" size={22} />
            </Link>
          ) : null}
        </div>
        {!emptyState && inlineSummary ? (
          <div className="lf-dashboard-summary-count" style={inlineSummaryStyle}>
            <span className="lf-dashboard-summary-value" style={valueStyle}>{obscured ? "Restricted" : value}</span>
            <span className="lf-dashboard-summary-detail" style={detailStyle}>{obscured ? "Detail hidden for this role" : detail}</span>
          </div>
        ) : !emptyState ? (
          <>
            <div className="lf-dashboard-summary-value" style={valueStyle}>{obscured ? "Restricted" : value}</div>
            <div className="lf-dashboard-summary-detail" style={detailStyle}>{obscured ? "Detail hidden for this role" : detail}</div>
          </>
        ) : showAddAction && addHref ? null : showAddAction && onEmptyActionClick ? (
          <button
            type="button"
            style={emptyPrimaryActionStyle}
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
            <span style={emptyPrimaryLabelStyle}>{emptyActionLabel}</span>
          </button>
        ) : showAddAction && !emptyState ? (
          <Link href={href} style={emptyPrimaryActionStyle}>
            <span style={emptyPrimaryLabelStyle}>{emptyActionLabel}</span>
          </Link>
        ) : null}
        {overview ? <div style={overviewWrapStyle}>{overview}</div> : null}
      </div>

      <div className="lf-dashboard-summary-footer" style={emptyState ? emptyFooterStyle : footerWrapStyle}>
        {!emptyState && !hideItems && items.length ? (
          items.slice(0, 4).map((item) => (
            <Link key={item.id} href={item.href} style={itemLinkStyle} className="lf-dashboard-item-link">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="chevron_right" size={16} />
                {item.label}
              </span>
              {item.meta ? <span style={{ color: "var(--lf-text-secondary)", fontSize: 12 }}>{item.meta}</span> : null}
            </Link>
          ))
        ) : !emptyState && !hideItems && onEmptyActionClick ? (
          <button
            type="button"
            style={{ ...itemLinkStyle, background: "var(--lf-surface-card)", width: "100%", textAlign: "left", cursor: "pointer" }}
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
        ) : !emptyState && !hideItems ? (
          <Link href={href} style={itemLinkStyle}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="open_in_new" size={16} />
              {emptyActionLabel}
            </span>
          </Link>
        ) : null}
        {!emptyState ? (
          <div className="lf-dashboard-summary-date-row" style={footerStyle}>
            <span className="lf-dashboard-summary-date" style={dateStyle}>{formatDateStamp(addedAt)}</span>
          </div>
        ) : null}
      </div>
    </div>
    )
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
  border: "1px solid var(--lf-border)",
  borderRadius: 12,
  padding: 22,
  background: "var(--lf-surface-card)",
  textDecoration: "none",
  color: "var(--lf-text)",
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
  color: "var(--lf-primary-text)",
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
  color: "var(--lf-text-secondary)",
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const footerWrapStyle: CSSProperties = {
  borderTop: "1px solid #f1f5f9",
  paddingTop: 8,
  display: "grid",
  gap: 6,
};

const emptyFooterStyle: CSSProperties = {
  borderTop: "1px solid #f1f5f9",
  paddingTop: 8,
  minHeight: 62,
};

const valueStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1.2,
};

const detailStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--lf-text-secondary)",
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
  border: "1px solid var(--lf-divider)",
  borderRadius: 10,
  padding: "9px 10px",
  textDecoration: "none",
  color: "var(--lf-text)",
  fontSize: 13,
};

const emptyPrimaryActionStyle: CSSProperties = {
  display: "inline-block",
  justifySelf: "start",
  border: 0,
  padding: 0,
  background: "transparent",
  color: "var(--lf-text-secondary)",
  textDecoration: "none",
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1.2,
  cursor: "pointer",
};

const emptyPrimaryLabelStyle: CSSProperties = {
  color: "#a4afbf",
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1.2,
};

const emptyPrimaryIconStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid #e5e0dc",
  background: "var(--lf-surface-card)",
  color: "#7f8794",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  cursor: "pointer",
};

const overviewWrapStyle: CSSProperties = {
  border: "1px solid var(--lf-divider)",
  borderRadius: 12,
  background: "var(--lf-surface-card)",
  padding: 10,
};
