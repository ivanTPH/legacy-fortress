import Link from "next/link";
import type { KeyboardEvent } from "react";
import type { NavNode } from "../../navigation/navigation.config";

type SidebarPrimaryProps = {
  items: NavNode[];
  activeTopId: string | null;
  highlightedTopId: string | null;
  onHoverTop: (id: string | null, anchorEl?: HTMLElement) => void;
  onFocusTop: (id: string | null, anchorEl?: HTMLElement) => void;
  onKeyDownTop: (event: KeyboardEvent<HTMLAnchorElement>, item: NavNode) => void;
};

export default function SidebarPrimary({
  items,
  activeTopId,
  highlightedTopId,
  onHoverTop,
  onFocusTop,
  onKeyDownTop,
}: SidebarPrimaryProps) {
  return (
    <nav aria-label="Primary navigation" className="lf-nav" role="menu">
      {items.map((item) => {
        const isActive = item.id === activeTopId;
        const isHighlighted = item.id === highlightedTopId;
        return (
          <Link
            key={item.id}
            href={item.path}
            data-nav-id={item.id}
            role="menuitem"
            aria-haspopup={item.children?.length ? "menu" : undefined}
            aria-expanded={isHighlighted ? "true" : undefined}
            aria-current={isActive ? "page" : undefined}
            className={`lf-nav-item ${isActive ? "is-active" : ""} ${isHighlighted ? "is-open" : ""}`}
            onMouseEnter={(event) => onHoverTop(item.id, event.currentTarget)}
            onFocus={(event) => onFocusTop(item.id, event.currentTarget)}
            onKeyDown={(event) => onKeyDownTop(event, item)}
          >
            <span className="lf-nav-icon">{item.icon}</span>
            <span className="lf-nav-label">{item.label}</span>
            {item.children?.length ? <span className="lf-nav-chevron">›</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
