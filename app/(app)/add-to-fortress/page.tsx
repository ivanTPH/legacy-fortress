import AddToFortressPanel from "../components/dashboard/AddToFortressPanel";

export default function AddToFortressPage() {
  return (
    <main className="lf-page-shell" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: 0, color: "#7c5b4c", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Build your Fortress
        </p>
        <h1 style={{ margin: 0, color: "#1f1712", fontSize: 28 }}>Add to my Fortress</h1>
        <p style={{ margin: 0, maxWidth: 680, color: "#64748b" }}>
          Start with something that matters to you. You can add a simple record now and fill in more details later.
        </p>
      </div>
      <AddToFortressPanel />
    </main>
  );
}
