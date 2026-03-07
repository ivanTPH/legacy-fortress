import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import type { NavNode } from "../../navigation/navigation.config";

type SidebarPrimaryProps = {
  items: NavNode[];
  activeTopId: string | null;
  highlightedTopId: string | null;
  flyoutId?: string;
  onActivateTop: (event: MouseEvent<HTMLAnchorElement>, item: NavNode, anchorEl: HTMLElement) => void;
  onKeyDownTop: (event: KeyboardEvent<HTMLAnchorElement>, item: NavNode) => void;
};

export default function SidebarPrimary({
  items,
  activeTopId,
  highlightedTopId,
  flyoutId,
  onActivateTop,
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
            aria-controls={item.children?.length ? flyoutId : undefined}
            aria-current={isActive ? "page" : undefined}
            className={`lf-nav-item ${isActive ? "is-active" : ""} ${isHighlighted ? "is-open" : ""}`}
            onClick={(event) => onActivateTop(event, item, event.currentTarget)}
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
