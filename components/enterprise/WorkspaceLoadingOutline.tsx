/**
 * UX review 2: show the page's outline straight away instead of a "Checking access…" card.
 * Purely visual; access is still checked by the server before any data appears.
 */
export default function WorkspaceLoadingOutline({ label }: { label: string }) {
  return (
    <main className="lf-workspace-outline" aria-busy="true" aria-label={label}>
      <aside className="lf-workspace-outline-sidebar" aria-hidden="true">
        <span className="lf-workspace-outline-brand" />
        {Array.from({ length: 6 }, (_, index) => <span key={index} className="lf-workspace-outline-line" />)}
      </aside>
      <section className="lf-workspace-outline-content" aria-hidden="true">
        <span className="lf-workspace-outline-title" />
        <span className="lf-workspace-outline-line is-wide" />
        <div className="lf-workspace-outline-cards">{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div>
        <span className="lf-workspace-outline-panel" />
      </section>
      <p className="lf-visually-hidden" role="status">{label}</p>
    </main>
  );
}
