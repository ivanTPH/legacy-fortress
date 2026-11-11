"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * A row that behaves like Apple Mail (owner decision 11 Nov 2026), for touch only; a mouse gets the hover buttons.
 * Swipe right reveals `right` (Read/Unread, Later). Swipe left reveals `left` (Later, Done/Clear). A long swipe left
 * runs `onLongLeft` straight away. Press and hold runs `onHold` (the quick-actions menu). Every one of these actions
 * is also reachable by visible buttons, so nothing depends on discovering a gesture.
 */
const REVEAL = 64;
const LONG = 0.6; // fraction of the row width for "long swipe left"
const HOLD_MS = 550;

export default function SwipeRow({ left, right, onLongLeft, onHold, open, onOpenChange, children }: {
  left: ReactNode;
  right: ReactNode;
  onLongLeft?: () => void;
  onHold?: () => void;
  open: "left" | "right" | null;
  onOpenChange: (side: "left" | "right" | null) => void;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number; width: number; moved: boolean } | null>(null);
  const hold = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [dx, setDx] = useState(0);

  function clearHold() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  }

  return (
    <div
      className="lf-swipe"
      data-open={open ?? undefined}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;
        start.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.getBoundingClientRect().width, moved: false };
        clearHold();
        if (onHold) hold.current = window.setTimeout(() => { suppressClick.current = true; start.current = null; onHold(); }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        const from = start.current;
        if (!from) return;
        const x = event.clientX - from.x, y = event.clientY - from.y;
        if (!from.moved && Math.abs(y) > 12 && Math.abs(y) > Math.abs(x)) { start.current = null; clearHold(); setDx(0); return; } // scrolling
        if (Math.abs(x) > 8) { from.moved = true; clearHold(); }
        if (from.moved) setDx(Math.max(-from.width, Math.min(from.width * 0.5, x)));
      }}
      onPointerUp={() => {
        const from = start.current;
        clearHold();
        start.current = null;
        if (!from || !from.moved) { setDx(0); return; }
        suppressClick.current = true;
        if (dx < -from.width * LONG && onLongLeft) onLongLeft();
        else if (dx < -REVEAL) onOpenChange("left");
        else if (dx > REVEAL) onOpenChange("right");
        else onOpenChange(null);
        setDx(0);
      }}
      onPointerCancel={() => { clearHold(); start.current = null; setDx(0); }}
      onClickCapture={(event) => {
        if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
      }}
    >
      {open === "right" ? <div className="lf-swipe-actions is-right">{right}</div> : null}
      <div className="lf-swipe-content" style={dx ? { transform: `translateX(${dx}px)` } : undefined}>{children}</div>
      {open === "left" ? <div className="lf-swipe-actions is-left">{left}</div> : null}
    </div>
  );
}
