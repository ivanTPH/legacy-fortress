import AddToFortressPanel from "../components/dashboard/AddToFortressPanel";
import { LFPageHeader } from "../../../components/ui/LFDesignSystem";

export default function AddToFortressPage() {
  return (
    <main className="lf-page-shell" style={{ display: "grid", gap: 16 }}>
      <LFPageHeader title="Add to my Fortress" description="Start with something that matters to you. You can add a simple record now and fill in more details later." />
      <AddToFortressPanel />
    </main>
  );
}
