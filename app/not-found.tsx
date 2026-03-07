import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section
        style={{
          width: "100%",
          maxWidth: 560,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fff",
          padding: 20,
          display: "grid",
          gap: 10,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 30 }}>Page not found</h1>
        <p style={{ margin: 0, color: "#64748b" }}>
          The requested URL is invalid or unavailable. Use the links below to continue.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard" style={btnStyle}>
            Go to dashboard
          </Link>
          <Link href="/signin" style={ghostStyle}>
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}

const btnStyle = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};

const ghostStyle = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "8px 12px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};

