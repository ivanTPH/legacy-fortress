import Link from "next/link";
import type { NavNode } from "../../navigation/navigation.config";

export default function Breadcrumbs({ items }: { items: NavNode[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="lf-breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.id} className="lf-crumb-wrap">
            {isLast ? (
              <span className="lf-crumb-current">{item.label}</span>
            ) : (
              <Link href={item.path} className="lf-crumb-link">
                {item.label}
              </Link>
            )}
            {!isLast ? <span className="lf-crumb-sep">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
