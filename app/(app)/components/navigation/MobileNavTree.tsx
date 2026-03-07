import Link from "next/link";
import type { NavNode } from "../../navigation/navigation.config";

type MobileNavTreeProps = {
  items: NavNode[];
  expandedIds: Set<string>;
  activeChainIds: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: () => void;
};

export default function MobileNavTree({
  items,
  expandedIds,
  activeChainIds,
  onToggle,
  onNavigate,
}: MobileNavTreeProps) {
  return (
    <div className="lf-mobile-tree">
      {items.map((item) => {
        const expanded = expandedIds.has(item.id);
        const active = activeChainIds.has(item.id);
        const hasChildren = Boolean(item.children?.length);

        return (
          <div key={item.id} className="lf-mobile-tree-node" aria-expanded={hasChildren ? expanded : undefined}>
            <div className={`lf-mobile-tree-row ${active ? "is-active" : ""}`}>
              <Link href={item.path} className="lf-mobile-tree-link" onClick={onNavigate}>
                <span className="lf-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
              {hasChildren ? (
                <button type="button" className="lf-mobile-expand" onClick={() => onToggle(item.id)}>
                  {expanded ? "−" : "+"}
                </button>
              ) : null}
            </div>

            {hasChildren && expanded ? (
              <div className="lf-mobile-tree-children">
                {item.children?.map((child) => {
                  const childActive = activeChainIds.has(child.id);
                  const childHasChildren = Boolean(child.children?.length);
                  const childExpanded = expandedIds.has(child.id);
                  return (
                    <div key={child.id} className="lf-mobile-subnode">
                      <div className={`lf-mobile-tree-row is-child ${childActive ? "is-active" : ""}`}>
                        <Link href={child.path} className="lf-mobile-tree-link" onClick={onNavigate}>
                          <span>{child.label}</span>
                        </Link>
                        {childHasChildren ? (
                          <button type="button" className="lf-mobile-expand" onClick={() => onToggle(child.id)}>
                            {childExpanded ? "−" : "+"}
                          </button>
                        ) : null}
                      </div>

                      {childHasChildren && childExpanded ? (
                        <div className="lf-mobile-tree-children is-level3">
                          {child.children?.map((leaf) => (
                            <Link key={leaf.id} href={leaf.path} className={`lf-mobile-leaf ${activeChainIds.has(leaf.id) ? "is-active" : ""}`} onClick={onNavigate}>
                              {leaf.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
