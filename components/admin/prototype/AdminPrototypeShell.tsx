"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

type AdminPrototypeShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

const navItems = [
  { href: "/internal/admin/prototype/cases", label: "Cases" },
  { href: "/internal/admin/prototype/verifications", label: "Verifications" },
  { href: "/internal/admin/prototype/users", label: "Users" },
  { href: "/internal/admin/prototype/access", label: "Access" },
  { href: "/internal/admin/prototype/audit", label: "Audit" },
];

export default function AdminPrototypeShell({ title, description, children }: AdminPrototypeShellProps) {
  const pathname = usePathname();

  return (
    <main style={shellStyle}>
      <aside style={sidebarStyle}>
        <Link href="/internal/admin/prototype" style={brandStyle}>
          <span style={brandMarkStyle}>LF</span>
          <span>
            <strong>Legacy Fortress</strong>
            <span style={brandSubStyle}>Operations prototype</span>
          </span>
        </Link>
        <nav style={{ display: "grid", gap: 4 }} aria-label="Admin prototype navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} style={navItemStyle(active)}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section style={contentStyle}>
        <header style={topbarStyle}>
          <input aria-label="Search admin prototype" placeholder="Search cases, users, audit events" style={searchStyle} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={roleBadgeStyle}>Admin</span>
            <span style={{ color: "#334155", fontSize: 13, fontWeight: 700 }}>Sarah Ahmed</span>
          </div>
        </header>
        <section style={pageHeaderStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, color: "#0f172a" }}>{title}</h1>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.45 }}>{description}</p>
          </div>
          <span style={prototypeBadgeStyle}>Admin prototype — static mock data</span>
        </section>
        {children}
      </section>
    </main>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f3f4f6",
  display: "grid",
  gridTemplateColumns: "240px minmax(0, 1fr)",
  color: "#0f172a",
};

const sidebarStyle: CSSProperties = {
  background: "#111827",
  color: "#fff",
  padding: 18,
  display: "grid",
  alignContent: "start",
  gap: 22,
};

const brandStyle: CSSProperties = {
  color: "#fff",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const brandMarkStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  background: "#374151",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 800,
};

const brandSubStyle: CSSProperties = {
  display: "block",
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 500,
};

function navItemStyle(active: boolean): CSSProperties {
  return {
    color: active ? "#111827" : "#d1d5db",
    background: active ? "#fff" : "transparent",
    borderRadius: 8,
    padding: "10px 11px",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
  };
}

const contentStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  alignContent: "start",
  gap: 18,
  padding: 22,
};

const topbarStyle: CSSProperties = {
  height: 52,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const searchStyle: CSSProperties = {
  width: "min(460px, 100%)",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "9px 11px",
  fontSize: 14,
};

const roleBadgeStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "5px 10px",
  color: "#334155",
  background: "#f8fafc",
  fontSize: 12,
  fontWeight: 800,
};

const pageHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "start",
};

const prototypeBadgeStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 999,
  background: "#fff",
  color: "#475569",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};
