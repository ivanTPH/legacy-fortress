"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/**
 * ⓘ button from the approved "Help and info buttons" design (UX review Stage 4): a short answer without leaving the
 * screen, with "Learn more in Help" and "Got it". Phone: bottom sheet. Laptop: a small centred card.
 */
export const HELP_TIPS = {
  invitation: { title: "What is an invitation?", text: (name: string) => `An email asking ${name} to join Legacy Fortress so you can share with them later. It never shows them your records or your values.` },
  identity: { title: "What is an ID check?", text: (name: string) => `When ${name} accepts, they take a photo of their ID and a quick selfie, so we know it’s really them. It doesn’t give them access to anything.` },
  access: { title: "What is Vault access?", text: (name: string) => `You choose exactly which records ${name} can see, now or only after your death. Nothing is shared until you choose it.` },
} as const;

export default function HelpTip({ tip, name = "they" }: { tip: keyof typeof HELP_TIPS; name?: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const content = HELP_TIPS[tip];

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const trigger = triggerRef.current;
    return () => { document.removeEventListener("keydown", onKey); trigger?.focus(); };
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className="lf-help-tip" aria-label={content.title} onClick={() => setOpen(true)}><Icon name="info" size={20} /></button>
    {/* Portalled to the page, so a drawer's transform can't clip it. */}
    {open && typeof document !== "undefined" ? createPortal(<div className="lf-help-tip-layer">
      <div className="lf-help-tip-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="lf-help-tip-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="lf-help-tip-grab" aria-hidden="true" />
        <h2 id={titleId}>{content.title}</h2>
        <p>{content.text(name)}</p>
        <Link href="/support" className="lf-help-tip-more">Learn more in Help</Link>
        <button ref={closeRef} type="button" className="lf-help-tip-done" onClick={() => setOpen(false)}>Got it</button>
      </div>
    </div>, document.body) : null}
  </>;
}
