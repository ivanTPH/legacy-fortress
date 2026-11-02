"use client";

import { useRef, useState, type ReactNode } from "react";
import Icon from "../ui/Icon";

/** A row that clears when swiped left or right (touch), or with its × button (everyone). */
export default function SwipeToClear({ label, onClear, children }: { label: string; onClear: () => void; children: ReactNode }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(0);
  const threshold = 90;

  function clear(direction: number) {
    setLeaving(direction || -1);
    window.setTimeout(onClear, 160);
  }

  return <div className={`lf-swipe-row${leaving ? " is-leaving" : ""}`} style={{ transform: leaving ? `translateX(${leaving * 110}%)` : `translateX(${dx}px)` }}
    onTouchStart={(event) => { const touch = event.touches[0]; start.current = { x: touch.clientX, y: touch.clientY }; }}
    onTouchMove={(event) => {
      if (!start.current) return;
      const touch = event.touches[0];
      const moveX = touch.clientX - start.current.x;
      if (Math.abs(touch.clientY - start.current.y) > Math.abs(moveX)) return; // scrolling, not swiping
      setDx(moveX);
    }}
    onTouchEnd={() => { if (Math.abs(dx) > threshold) clear(Math.sign(dx)); else setDx(0); start.current = null; }}>
    <span className={`lf-swipe-hint${dx ? " is-visible" : ""}`} aria-hidden="true"><Icon name="delete_sweep" size={20} />Clear</span>
    {children}
    <button type="button" className="lf-swipe-clear" aria-label={`Clear: ${label}`} onClick={() => clear(-1)}><Icon name="close" size={18} /></button>
  </div>;
}
