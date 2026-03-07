import Link from "next/link";
import type { KeyboardEvent } from "react";
import type { NavNode } from "../../navigation/navigation.config";

type FlyoutMenuProps = {
  level: 2 | 3;
  parentLabel: string;
  items: NavNode[];
  highlightedId: string | null;
  activeChainIds: Set<string>;
  onHoverItem: (id: string | null, anchorEl?: HTMLElement) => void;
  onFocusItem: (id: string | null, anchorEl?: HTMLElement) => void;
  onKeyDownItem: (event: KeyboardEvent<HTMLAnchorElement>, item: NavNode, level: 2 | 3) => void;
  topOffset?: number;
};

export default function FlyoutMenu({
  level,
  parentLabel,
  items,
  highlightedId,
  activeChainIds,
  onHoverItem,
  onFocusItem,
  onKeyDownItem,
  topOffset,
}: FlyoutMenuProps) {
  if (!items.length) return null;

  return (
    <div
      className={`lf-flyout lf-flyout-l${level}`}
      role="menu"
      aria-label={`${parentLabel} submenu`}
      style={typeof topOffset === "number" ? { top: topOffset } : undefined}
    >
      {items.map((item) => {
        const isActive = activeChainIds.has(item.id);
        const isOpen = highlightedId === item.id;
        return (
          <Link
            key={item.id}
            href={item.path}
            role="menuitem"
            aria-haspopup={item.children?.length ? "menu" : undefined}
            aria-expanded={isOpen ? "true" : undefined}
            className={`lf-flyout-item ${isActive ? "is-active" : ""} ${isOpen ? "is-open" : ""}`}
            onMouseEnter={(event) => onHoverItem(item.id, event.currentTarget)}
            onFocus={(event) => onFocusItem(item.id, event.currentTarget)}
            onKeyDown={(event) => onKeyDownItem(event, item, level)}
          >
            <span className="lf-flyout-label">{item.label}</span>
            {item.children?.length ? <span className="lf-flyout-chevron">›</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
