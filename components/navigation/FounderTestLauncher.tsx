"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import { supabase } from "@/lib/supabaseClient";
import "./founder-test-launcher.css";

type Context = "vault" | "admin" | "partner";

const destinations: Array<{ id: Context; name: string; path: string; icon: string }> = [
  { id: "vault", name: "Personal Vault", path: "/dashboard", icon: "account_balance_wallet" },
  { id: "admin", name: "Platform Admin", path: "/admin", icon: "admin_panel_settings" },
  { id: "partner", name: "Partner Portal", path: "/enterprise", icon: "domain" },
];

export function useFounderTestLauncherAccess() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    let latestCheck = 0;
    async function check(token?: string) {
      const checkId = ++latestCheck;
      if (!token) { if (mounted) setAvailable(false); return; }
      try {
        const response = await fetch("/api/internal/test/environments", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const allowed = response.ok && (await response.json()).available === true;
        if (mounted && checkId === latestCheck) setAvailable(allowed);
      } catch { if (mounted && checkId === latestCheck) setAvailable(false); }
    }

    void supabase.auth.getSession().then(({ data }) => check(data.session?.access_token)).catch(() => { if (mounted) setAvailable(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void check(session?.access_token); });
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  return available;
}

export default function FounderTestLauncher({ current, available }: { current: Context; available: boolean }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!available) queueMicrotask(() => setOpen(false)); }, [available]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      // Keep focus inside the sheet, including when launched from a mobile drawer.
      event.stopPropagation();
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  if (!available) return null;
  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  return <>
    <button ref={triggerRef} type="button" className="lf-founder-launcher-entry" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
      <span className="lf-founder-launcher-test">TEST</span><span>Test environments</span><Icon name="chevron_right" size={20} />
    </button>
    {open && typeof document !== "undefined" ? createPortal(
      <div className="lf-founder-launcher-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div ref={dialogRef} className="lf-founder-launcher-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="lf-founder-launcher-heading"><button ref={closeRef} type="button" onClick={close}>Close</button><h2 id={titleId}><span className="lf-founder-launcher-test">TEST</span> Environments</h2></div>
          <div className="lf-founder-launcher-list">
            {destinations.map((destination) => <div className="lf-founder-launcher-row" key={destination.id}>
              <span className="lf-founder-launcher-mark"><Icon name={destination.icon} size={22} /></span>
              <span className="lf-founder-launcher-copy"><strong>{destination.name}</strong><small>{destination.path}</small></span>
              {destination.id === current ? <span className="lf-founder-launcher-current"><Icon name="check_circle" size={18} /> Here</span>
                : <a href={destination.path} target="_blank" rel="noopener noreferrer" aria-label={`Open ${destination.name} in a new tab`} onClick={close}>Open <Icon name="open_in_new" size={17} /></a>}
            </div>)}
          </div>
          <p className="lf-founder-launcher-note"><Icon name="lock" size={18} />These links carry no account information or permissions. Each destination applies its existing sign-in and access checks.</p>
        </div>
      </div>, document.body,
    ) : null}
  </>;
}
