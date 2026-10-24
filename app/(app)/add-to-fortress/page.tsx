import AddToFortressPanel from "../components/dashboard/AddToFortressPanel";
import { PageHeader } from "../../../components/ui/V3Primitives";

export default function AddToFortressPage() {
  return (
    <main className="lf-v3-destination">
      <PageHeader title="Add to my Vault" description="Start with something that matters to you. You can add a simple record now and fill in more details later." />
      <AddToFortressPanel />
    </main>
  );
}
