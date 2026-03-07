import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import type { NavNode } from "../../navigation/navigation.config";

type FlyoutMenuProps = {
  menuId: string;
  level: 2 | 3;
  parentLabel: string;
  items: NavNode[];
  highlightedId: string | null;
  childMenuId?: string;
  activeChainIds: Set<string>;
  onActivateItem: (event: MouseEvent<HTMLAnchorElement>, item: NavNode, level: 2 | 3, anchorEl: HTMLElement) => void;
  onKeyDownItem: (event: KeyboardEvent<HTMLAnchorElement>, item: NavNode, level: 2 | 3) => void;
  topOffset?: number;
};

export default function FlyoutMenu({
  menuId,
  level,
  parentLabel,
  items,
  highlightedId,
  childMenuId,
  activeChainIds,
  onActivateItem,
  onKeyDownItem,
  topOffset,
}: FlyoutMenuProps) {
  if (!items.length) return null;

  return (
    <div
      className={`lf-flyout lf-flyout-l${level}`}
      role="menu"
      id={menuId}
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
            aria-controls={item.children?.length ? childMenuId : undefined}
            className={`lf-flyout-item ${isActive ? "is-active" : ""} ${isOpen ? "is-open" : ""}`}
            onClick={(event) => onActivateItem(event, item, level, event.currentTarget)}
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
