import Link from "next/link";

export default function ApplicationEnterpriseEntryPage() {
  return (
    <main className="lf-admin-page">
      <section className="lf-admin-panel">
        <p className="lf-admin-eyebrow">Legacy Fortress Enterprise</p>
        <h1>Enterprise workspace not yet enabled</h1>
        <p>
          Enterprise and licence administration is blocked in hosted UAT until organisation, licence, tenant scope,
          and server-side enterprise APIs are connected to real staging data.
        </p>
        <p>
          No tenant counts, licence actions, or organisation dashboards are shown here because they are not yet backed
          by a complete persistence and permission model.
        </p>
        <div className="lf-admin-header-actions">
          <Link className="lf-admin-secondary-link" href="/admin">Return to admin</Link>
          <Link className="lf-admin-secondary-link" href="/dashboard">Return to customer app</Link>
        </div>
      </section>
    </main>
  );
}
