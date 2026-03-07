import Link from "next/link";
import type { CSSProperties } from "react";
import { getBreadcrumbsByPath, getNavNodeByPath, normalizePath } from "../navigation/navigation.utils";

type CatchAllPageProps = {
  params: { slug?: string[] };
};

type ActionLink = {
  label: string;
  href: string;
};

function pathFromSlug(slug: string[] | undefined) {
  if (!slug || slug.length === 0) return "/dashboard";
  return normalizePath(`/${slug.join("/")}`);
}

function actionsForPath(path: string): ActionLink[] {
  if (path.startsWith("/legal")) {
    return [
      { label: "Add legal record", href: "/vault/legal" },
      { label: "Manage legal documents", href: "/vault/legal" },
      { label: "Review participants", href: "/vault/legal" },
    ];
  }

  if (path.startsWith("/finances")) {
    return [
      { label: "Add account", href: "/vault/financial" },
      { label: "Manage finances", href: "/vault/financial" },
      { label: "Open bank view", href: "/finances/bank" },
    ];
  }

  if (path.startsWith("/personal")) {
    return [
      { label: "Add possession", href: "/vault/personal" },
      { label: "Manage possessions", href: "/vault/personal" },
      { label: "Review profile", href: "/profile" },
    ];
  }

  if (path.startsWith("/property")) {
    return [
      { label: "Add property", href: "/vault/property" },
      { label: "Edit property", href: "/vault/property" },
      { label: "View records", href: "/vault/property" },
    ];
  }

  if (path.startsWith("/business")) {
    return [
      { label: "Add business interest", href: "/vault/business" },
      { label: "Manage businesses", href: "/vault/business" },
      { label: "View records", href: "/vault/business" },
    ];
  }

  return [{ label: "Back to dashboard", href: "/dashboard" }];
}

export default function CategoryLandingPage({ params }: CatchAllPageProps) {
  const { slug } = params;
  const path = pathFromSlug(slug);
  const node = getNavNodeByPath(path);

  if (!node) {
    const segments = path.split("/").filter(Boolean);
    const title = segments.length
      ? segments[segments.length - 1].replace(/-/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())
      : "Section";

    return (
      <section style={shellStyle}>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        <p style={{ margin: "4px 0 0", color: "#667085" }}>
          This route is available and can be mapped to a dedicated managed section.
        </p>
        <div style={panelStyle}>
          <div style={{ fontWeight: 700 }}>Unknown route mapping</div>
          <div style={{ color: "#667085" }}>Path: {path}</div>
          <Link href="/dashboard" style={linkStyle}>
            Back to dashboard
          </Link>
        </div>
      </section>
    );
  }

  const chain = getBreadcrumbsByPath(path);
  const children = node.children?.filter((child) => child.isEnabled !== false) ?? [];
  const actions = actionsForPath(path);

  return (
    <section style={shellStyle}>
      <h1 style={{ margin: 0, fontSize: 28 }}>{node.label}</h1>
      <p style={{ margin: "4px 0 0", color: "#667085" }}>
        {node.description ?? "Use this category page to add, edit, and manage records in this section."}
      </p>

      <div style={panelStyle}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Category overview</div>
        <div style={{ color: "#667085", fontSize: 14 }}>{chain.map((item) => item.label).join(" / ")}</div>

        <div className="lf-content-grid">
          {actions.map((action) => (
            <Link key={`${action.label}-${action.href}`} href={action.href} style={cardLinkStyle}>
              <div style={{ fontWeight: 600 }}>{action.label}</div>
              <div style={{ color: "#667085", fontSize: 13 }}>Open working screen</div>
            </Link>
          ))}
        </div>

        {children.length ? (
          <div className="lf-content-grid">
            {children.map((child) => (
              <Link key={child.id} href={child.path} style={cardLinkStyle}>
                <div style={{ fontWeight: 600 }}>{child.label}</div>
                <div style={{ color: "#667085", fontSize: 13 }}>{child.description ?? "Open category"}</div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  maxWidth: 1100,
};

const panelStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 10,
};

const linkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#0f172a",
  fontWeight: 600,
};

const cardLinkStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  textDecoration: "none",
  color: "#0f172a",
  display: "grid",
  gap: 6,
};
