export default function GuidedTourPrompt({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ color: "#6b7280", fontSize: 14 }}>
        Take a quick guided tour to learn how to add assets, upload documents, and manage access.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="lf-primary-btn" type="button" onClick={onStart}>Start tour now</button>
        <button className="lf-link-btn" type="button" onClick={onSkip}>Skip for now</button>
      </div>
    </div>
  );
}
