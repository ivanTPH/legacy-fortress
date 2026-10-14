import Link from "next/link";
import { Fragment, type KeyboardEvent, type MouseEvent } from "react";
import Icon from "../../../../components/ui/Icon";
import type { NavNode } from "../../navigation/navigation.config";

type SidebarPrimaryProps = {
  items: NavNode[];
  activeTopId: string | null;
  highlightedTopId: string | null;
  flyoutId?: string;
  onActivateTop: (event: MouseEvent<HTMLElement>, item: NavNode, anchorEl: HTMLElement) => void;
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
    <nav aria-label="Primary navigation" className="lf-nav">
      {items.map((item) => {
        const isActive = item.id === activeTopId;
        const isHighlighted = item.id === highlightedTopId;
        return (
          <Fragment key={item.id}>
            {item.id === "finances" ? <span className="lf-nav-group-label">Vault</span> : null}
            {item.id === "people-contacts" ? <span className="lf-nav-group-label">Sharing</span> : null}
            <div className={`lf-nav-row ${isActive ? "is-active" : ""}`}>
              <Link
                href={item.path}
                data-nav-id={item.id}
                aria-current={isActive ? "page" : undefined}
                className={`lf-nav-item ${isActive ? "is-active" : ""} ${isHighlighted ? "is-open" : ""}`}
                data-nav-leaf={!item.children?.length ? "true" : "false"}
                onClick={(event) => onActivateTop(event, item, event.currentTarget)}
                onKeyDown={(event) => onKeyDownTop(event, item)}
              >
                <span className="lf-nav-icon">{item.icon}</span>
                <span className="lf-nav-label">{item.label}</span>
              </Link>
              {item.children?.length ? <button type="button" className="lf-nav-expand" aria-label={`Show ${item.label} sections`} aria-expanded={isHighlighted} aria-controls={flyoutId} onClick={(event) => onActivateTop(event, item, event.currentTarget)}><Icon name="chevron_right" size={18} /></button> : null}
            </div>
          </Fragment>
        );
      })}
    </nav>
  );
}
