import Link from "next/link";
import BrandMark from "../(app)/components/BrandMark";
import Icon from "@/components/ui/Icon";

const destinations = [
  { label: "Personal Vault", path: "/dashboard", icon: "account_balance_wallet" },
  { label: "Platform Admin", path: "/admin", icon: "admin_panel_settings" },
  { label: "Partner Portal", path: "/enterprise", icon: "domain" },
] as const;

export default function PwaEntryPage() {
  return (
    <main className="lf-entry-shell lf-trust-entry">
      <section className="lf-entry-art">
        <div className="lf-auth-brand-card">
          <BrandMark size={40} />
          <div><div className="lf-auth-brand-title">Legacy Fortress</div><div className="lf-auth-brand-sub">Private estate record vault</div></div>
        </div>
        <div className="lf-entry-copy">
          <div className="lf-entry-eyebrow">Secure access</div>
          <h1>Open your workspace.</h1>
          <p>Choose where to sign in. Each interface checks your account permissions independently.</p>
        </div>
      </section>
      <section className="lf-entry-panel-wrap">
        <div className="lf-entry-panel">
          <div className="lf-entry-panel-top"><div><div className="lf-entry-panel-kicker">Legacy Fortress</div><h2>Choose an interface</h2></div></div>
          <p className="lf-entry-panel-subtext">Your choice sets the destination for this sign-in. It does not grant access to another interface.</p>
          <nav aria-label="Sign-in destinations" className="lf-pwa-entry-destinations">
            {destinations.map((destination) => (
              <Link key={destination.path} href={`/sign-in?next=${encodeURIComponent(destination.path)}`}>
                <Icon name={destination.icon} size={22} />
                <span>{destination.label}</span>
                <Icon name="chevron_right" size={20} />
              </Link>
            ))}
          </nav>
          <p className="lf-entry-panel-subtext">You can also use the authorised TEST environments menu after sign-in, when available to your account.</p>
        </div>
      </section>
    </main>
  );
}
