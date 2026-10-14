import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, ContextSwitcher, Sheet, Switch, Toast } from "../components/ui/V3Primitives";

function Preview() {
  const [checked, setChecked] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [context, setContext] = useState("personal");
  const sheetTrigger = useRef<HTMLButtonElement>(null);
  return <div className="lf-shell" data-lf-text-size="default" data-lf-contrast="default" data-lf-spacing="default" style={{ display: "block", minHeight: "100vh", padding: 32 }}>
    <h1>Interactive primitives</h1>
    <Switch checked={checked} onCheckedChange={setChecked} label="Show area" />
    <Button ref={sheetTrigger} variant="secondary" onClick={() => setSheetOpen(true)}>Open sheet</Button>
    <Button variant="secondary" onClick={() => setToastOpen(true)}>Show toast</Button>
    <ContextSwitcher label={context === "personal" ? "Personal Vault" : "Linked Fortress"} selectedId={context} onSelect={setContext} groups={[{ title: "Your Fortress", options: [{ id: "personal", label: "Personal Vault" }] }, { title: "Linked to you", options: [{ id: "linked", label: "Linked Fortress" }] }]} />
    <Sheet open={sheetOpen} title="Sample sheet" onClose={() => setSheetOpen(false)} returnFocusTo={sheetTrigger} footer={<Button variant="primary" onClick={() => setSheetOpen(false)}>Done</Button>}><p>Keyboard focus stays in this sheet until it closes.</p><Button variant="secondary">Secondary action</Button></Sheet>
    <Toast open={toastOpen} message="Change saved" tone="success" actionLabel="Undo" onAction={() => setToastOpen(false)} onClose={() => setToastOpen(false)} />
  </div>;
}

createRoot(document.getElementById("root")!).render(<Preview />);
