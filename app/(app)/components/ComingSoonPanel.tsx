type ComingSoonPanelProps = {
  title: string;
  intro: string;
  points: string[];
};

export default function ComingSoonPanel({ title, intro, points }: ComingSoonPanelProps) {
  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 900 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>{title}</h1>
        <p style={{ marginTop: 6, color: "var(--lf-text-secondary)" }}>{intro}</p>
      </div>

      <section
        style={{
          border: "1px solid var(--lf-border)",
          borderRadius: 16,
          padding: 16,
          background: "var(--lf-surface-card)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 700 }}>In development</div>
        <div style={{ color: "var(--lf-text-secondary)", fontSize: 14 }}>
          This section is part of the MVP roadmap and will be available soon.
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--lf-text)", fontSize: 14, lineHeight: 1.5 }}>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
