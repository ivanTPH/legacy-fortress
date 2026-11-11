"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * A row that behaves like Apple Mail (owner decisions 11 Nov 2026), for touch only; a mouse gets the hover buttons.
 * Swipe right reveals `right` (Read/Unread); a long swipe right runs `onLongRight` straight away.
 * Swipe left reveals `left` (Later, Done/Clear); a long swipe left runs `onLongLeft` straight away.
 * The message slides over the buttons and keeps its full width, so its words never squash.
 * Press and hold runs `onHold` (the quick-actions menu). `disabled` turns gestures off (while selecting).
 * Every one of these actions is also reachable by visible buttons, so nothing depends on discovering a gesture.
 */
const REVEAL = 56;
const LONG = 0.6; // fraction of the row width for a long swipe
const HOLD_MS = 550;
export const SWIPE_BUTTON_WIDTH = 76; // matches .lf-swipe-button

export default function SwipeRow({ left, right, leftCount, rightCount, onLongLeft, onLongRight, onHold, open, onOpenChange, disabled = false, children }: {
  left: ReactNode;
  right: ReactNode;
  /** How many buttons each side holds, so the row slides exactly far enough. */
  leftCount: number;
  rightCount: number;
  onLongLeft?: () => void;
  onLongRight?: () => void;
  onHold?: () => void;
  open: "left" | "right" | null;
  onOpenChange: (side: "left" | "right" | null) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number; width: number; base: number; moved: boolean } | null>(null);
  const hold = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<number | null>(null);

  function clearHold() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  }
  const resting = open === "left" ? -leftCount * SWIPE_BUTTON_WIDTH : open === "right" ? rightCount * SWIPE_BUTTON_WIDTH : 0;
  const offset = drag ?? (disabled ? 0 : resting);
  const showing = offset < 0 ? "left" : offset > 0 ? "right" : null;

  return (
    <div
      className="lf-swipe"
      data-open={open ?? undefined}
      onPointerDown={(event) => {
        suppressClick.current = false; // only the click that ends a swipe is swallowed, never the next tap
        if (disabled || event.pointerType !== "touch") return;
        start.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.getBoundingClientRect().width, base: resting, moved: false };
        clearHold();
        if (onHold) hold.current = window.setTimeout(() => { suppressClick.current = true; start.current = null; onHold(); }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        const from = start.current;
        if (!from) return;
        const x = event.clientX - from.x, y = event.clientY - from.y;
        if (!from.moved && Math.abs(y) > 12 && Math.abs(y) > Math.abs(x)) { start.current = null; clearHold(); setDrag(null); return; } // scrolling
        if (Math.abs(x) > 8) { from.moved = true; clearHold(); }
        if (from.moved) setDrag(Math.max(-from.width, Math.min(from.width, from.base + x)));
      }}
      onPointerUp={() => {
        const from = start.current;
        clearHold();
        start.current = null;
        const moved = drag ?? 0;
        setDrag(null);
        if (!from || !from.moved) return;
        suppressClick.current = true;
        if (moved < -from.width * LONG && onLongLeft) { onOpenChange(null); onLongLeft(); }
        else if (moved > from.width * LONG && onLongRight) { onOpenChange(null); onLongRight(); }
        else if (moved < -REVEAL) onOpenChange("left");
        else if (moved > REVEAL) onOpenChange("right");
        else onOpenChange(null);
      }}
      onPointerCancel={() => { clearHold(); start.current = null; setDrag(null); }}
      onClickCapture={(event) => {
        if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
      }}
    >
      <div className="lf-swipe-actions is-right" data-showing={showing === "right" || undefined}>{right}</div>
      <div className="lf-swipe-actions is-left" data-showing={showing === "left" || undefined}>{left}</div>
      <div className={`lf-swipe-content${drag !== null ? " is-dragging" : ""}`} style={offset ? { transform: `translateX(${offset}px)` } : undefined}>{children}</div>
    </div>
  );
}
