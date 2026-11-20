"use client";

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import Icon from "./Icon";

/**
 * The app's own confirmation box (UX review 2, owner go-ahead 20 Nov 2026), in place of the browser's
 * "OK / Cancel". Says in plain words what will happen. Resolves true only when the action button is chosen;
 * Escape, the backdrop and Cancel all resolve false.
 *
 *   if (!(await confirmDialog({ title: "Delete “My Will”?", body: "…", confirmLabel: "Delete", tone: "danger" }))) return;
 */
export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "lf-confirm-host";
    document.body.appendChild(host);
    const root = createRoot(host);
    const previousFocus = document.activeElement as HTMLElement | null;
    const finish = (value: boolean) => {
      root.unmount();
      host.remove();
      previousFocus?.focus?.();
      resolve(value);
    };
    root.render(<ConfirmBox {...options} onDone={finish} />);
  });
}

function ConfirmBox({ title, body, confirmLabel = "Continue", cancelLabel = "Cancel", tone = "default", onDone }: ConfirmOptions & { onDone: (value: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    // Destructive actions start on Cancel, so a stray Enter never deletes.
    (tone === "danger" ? cancelRef : confirmRef).current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onDone(false); }
      if (event.key === "Tab") {
        const order = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        const index = order.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        order[(index + (event.shiftKey ? order.length - 1 : 1)) % order.length]?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone, tone]);
  return (
    <div className="lf-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onDone(false); }}>
      <div className="lf-confirm" role="alertdialog" aria-modal="true" aria-labelledby="lf-confirm-title" aria-describedby={body ? "lf-confirm-body" : undefined}>
        {tone === "danger" ? <span className="lf-confirm-icon" aria-hidden="true"><Icon name="delete" size={22} /></span> : null}
        <h2 id="lf-confirm-title">{title}</h2>
        {body ? <p id="lf-confirm-body">{body}</p> : null}
        <div className="lf-confirm-actions">
          <button ref={cancelRef} type="button" className="lf-confirm-cancel" onClick={() => onDone(false)}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className={`lf-confirm-ok${tone === "danger" ? " is-danger" : ""}`} onClick={() => onDone(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
