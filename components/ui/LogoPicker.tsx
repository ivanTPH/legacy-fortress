"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import BrandMark from "./BrandMark";
import Icon from "./Icon";

/**
 * A dropdown that shows each option's logo beside its name (owner request 27 Nov 2026): many people recognise a
 * provider's logo more easily than its name. A standard <select> cannot show pictures, so this is a listbox that
 * works the same way from the keyboard (arrows, Home, End, Enter, Escape, typing a letter) and with screen readers.
 */
export type LogoPickerOption = { value: string; label: string; logo?: string | null; detail?: string | null; icon?: string };

export default function LogoPicker({
  id,
  ariaLabel,
  value,
  options,
  placeholder,
  onChange,
}: {
  id?: string;
  ariaLabel?: string;
  value: string;
  options: LogoPickerOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const generatedId = useId();
  const buttonId = id ?? `${generatedId}-button`;
  const listId = `${generatedId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openAt = (index: number) => {
    setOpen(true);
    setActive(Math.max(0, Math.min(options.length - 1, index)));
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!options.length) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (open) setActive((index) => Math.min(options.length - 1, index + 1)); else openAt(selectedIndex);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) setActive((index) => Math.max(0, index - 1)); else openAt(selectedIndex);
        break;
      case "Home":
        if (open) { event.preventDefault(); setActive(0); }
        break;
      case "End":
        if (open) { event.preventDefault(); setActive(options.length - 1); }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open && active >= 0) choose(active); else openAt(selectedIndex);
        break;
      case "Escape":
        if (open) { event.preventDefault(); setOpen(false); }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const letter = event.key.toLowerCase();
          const start = open ? active + 1 : 0;
          const order = [...options.slice(start), ...options.slice(0, start)];
          const match = order.find((option) => option.label.toLowerCase().startsWith(letter));
          if (match) openAt(options.indexOf(match));
        }
    }
  };

  return (
    <div className="lf-logo-picker" ref={rootRef}>
      <button
        type="button"
        id={buttonId}
        className="lf-logo-picker-button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={onKeyDown}
      >
        {selected ? <BrandMark name={selected.label} logoPath={selected.logo ?? undefined} categoryIcon={selected.icon} /> : null}
        <span className={selected ? "lf-logo-picker-value" : "lf-logo-picker-placeholder"}>
          {selected ? selected.label : placeholder}
          {selected?.detail ? <small>{selected.detail}</small> : null}
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} size={22} />
      </button>
      {open ? (
        <ul className="lf-logo-picker-list" role="listbox" id={listId} ref={listRef} aria-label={ariaLabel}>
          {options.length ? options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={option.value === value}
              className={`lf-logo-picker-option${index === active ? " is-active" : ""}${option.value === value ? " is-selected" : ""}`}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <BrandMark name={option.label} logoPath={option.logo ?? undefined} categoryIcon={option.icon} />
              <span>
                {option.label}
                {option.detail ? <small>{option.detail}</small> : null}
              </span>
              {option.value === value ? <Icon name="check" size={20} /> : null}
            </li>
          )) : <li className="lf-logo-picker-empty" role="option" aria-selected={false} aria-disabled="true">Nothing to choose yet</li>}
        </ul>
      ) : null}
    </div>
  );
}
