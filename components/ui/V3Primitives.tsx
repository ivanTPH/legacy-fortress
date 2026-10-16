"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import Icon from "./Icon";

type Tone = "neutral" | "success" | "warning" | "danger";
type ButtonVariant = "primary" | "secondary" | "text" | "icon";
type V3ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> } & (
  | { variant: "icon"; icon: string; label: string; children?: never }
  | { variant?: Exclude<ButtonVariant, "icon">; icon?: string; label?: string }
);

export function Button({
  variant = "secondary",
  icon,
  label,
  children,
  className = "",
  type = "button",
  ref,
  ...props
}: V3ButtonProps) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`lf-v3-button lf-v3-button--${variant} ${className}`.trim()}
      aria-label={variant === "icon" ? label : props["aria-label"]}
      title={variant === "icon" ? label : props.title}
    >
      {icon ? <Icon name={icon} size={variant === "icon" ? 20 : 18} /> : null}
      {variant === "icon" ? null : children}
    </button>
  );
}

export function IconTile({ icon, size = 36, className = "" }: { icon: string; size?: 30 | 32 | 36 | 48; className?: string }) {
  return <span className={`lf-v3-icon-tile lf-v3-icon-tile--${size} ${className}`.trim()} aria-hidden="true"><Icon name={icon} size={size === 48 ? 24 : 20} /></span>;
}

export function Chip({ children, tone = "neutral", icon, className = "" }: { children: ReactNode; tone?: Tone; icon?: string; className?: string }) {
  return <span className={`lf-v3-chip lf-v3-chip--${tone} ${className}`.trim()}>{icon ? <Icon name={icon} size={16} /> : null}{children}</span>;
}

export function Card({ children, className = "", href, ...props }: HTMLAttributes<HTMLElement> & { href?: string }) {
  if (href) return <Link href={href} className={`lf-v3-card lf-v3-card--link ${className}`.trim()} aria-label={props["aria-label"]}>{children}</Link>;
  return <section {...props} className={`lf-v3-card ${className}`.trim()}>{children}</section>;
}

export function Row({
  icon,
  title,
  description,
  trailing,
  href,
  onClick,
  action,
  className = "",
}: {
  icon?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  const content = <>{icon ? <IconTile icon={icon} size={32} /> : null}<span className="lf-v3-row-copy"><span className="lf-v3-row-title">{title}</span>{description ? <span className="lf-v3-row-description">{description}</span> : null}</span>{trailing ? <span className="lf-v3-row-trailing">{trailing}</span> : null}{href || onClick ? <Icon name="chevron_right" size={20} className="lf-v3-row-chevron" /> : null}</>;
  return <div className={`lf-v3-row ${className}`.trim()}>
    {href ? <Link className="lf-v3-row-main" href={href}>{content}</Link> : onClick ? <button className="lf-v3-row-main" type="button" onClick={onClick}>{content}</button> : <div className="lf-v3-row-main">{content}</div>}
    {action ? <div className="lf-v3-row-action">{action}</div> : null}
  </div>;
}

export function PageHeader({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children?: ReactNode }) {
  return <header className="lf-v3-page-header">{children}<div className="lf-v3-page-header-main"><div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{action ? <div className="lf-v3-page-header-action">{action}</div> : null}</div></header>;
}

export function Breadcrumb({ items, backHref, backLabel }: { items: { label: string; href?: string }[]; backHref: string; backLabel: string }) {
  return <nav className="lf-v3-breadcrumb" aria-label="Breadcrumb"><Link href={backHref} className="lf-v3-breadcrumb-back" aria-label={`Back to ${backLabel}`}><Icon name="arrow_back" size={18} /><span className="lf-v3-breadcrumb-mobile-label">{backLabel}</span></Link><ol>{items.map((item, index) => <li key={`${item.label}-${index}`}>{index ? <Icon name="chevron_right" size={16} /> : null}{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}

export function Switch({ checked, onCheckedChange, label, small = false, disabled = false }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string; small?: boolean; disabled?: boolean }) {
  return <button type="button" className={`lf-v3-switch${small ? " lf-v3-switch--small" : ""}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onCheckedChange(!checked)}><span aria-hidden="true" /></button>;
}

export function Sheet({ open, title, onClose, children, footer, preserveSidebar = false, returnFocusTo }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; preserveSidebar?: boolean; returnFocusTo?: RefObject<HTMLElement | null> }) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    if (!open) return;
    const previousFocus = returnFocusTo?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.querySelector("dialog[open]")) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panelRef.current.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); queueMicrotask(() => { if (previousFocus?.isConnected) previousFocus.focus(); }); };
  }, [open, returnFocusTo]);
  if (!open) return null;
  return <div className="lf-v3-sheet-layer"><button className={`lf-v3-sheet-scrim${preserveSidebar ? " lf-v3-sheet-scrim--main" : ""}`} type="button" aria-label={`Close ${title}`} onClick={onClose} /><section ref={panelRef} className="lf-v3-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}><header><h2 id={titleId}>{title}</h2><Button variant="icon" icon="close" label={`Close ${title}`} ref={closeRef} onClick={onClose} /></header><div className="lf-v3-sheet-content">{children}</div>{footer ? <footer>{footer}</footer> : null}</section></div>;
}

export function Banner({ tone = "neutral", title, children, action, onDismiss }: { tone?: Tone; title?: string; children: ReactNode; action?: ReactNode; onDismiss?: () => void }) {
  const icon = tone === "danger" ? "error" : tone === "warning" ? "warning" : tone === "success" ? "check_circle" : "info";
  return <aside className={`lf-v3-banner lf-v3-banner--${tone}`} role={tone === "danger" ? "alert" : "status"}><Icon name={icon} size={20} /><div>{title ? <strong>{title}</strong> : null}<span>{children}</span></div>{action ? <div className="lf-v3-banner-action">{action}</div> : null}{onDismiss ? <Button variant="icon" icon="close" label="Dismiss message" onClick={onDismiss} /> : null}</aside>;
}

export function Toast({ open, message, tone = "neutral", actionLabel, onAction, onClose, duration = 5000 }: { open: boolean; message: string; tone?: Tone; actionLabel?: string; onAction?: () => void; onClose: () => void; duration?: number }) {
  useEffect(() => { if (!open || duration <= 0) return; const timeout = window.setTimeout(onClose, duration); return () => window.clearTimeout(timeout); }, [open, duration, onClose]);
  if (!open) return null;
  return <div className={`lf-v3-toast lf-v3-toast--${tone}`} role={tone === "danger" ? "alert" : "status"}><Icon name={tone === "success" ? "check_circle" : tone === "danger" ? "error" : tone === "warning" ? "warning" : "info"} size={18} /><span>{message}</span>{actionLabel && onAction ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}<button type="button" aria-label="Dismiss notification" onClick={onClose}><Icon name="close" size={18} /></button></div>;
}

export function EmptyState({ icon = "inbox", title, description, action }: { icon?: string; title: string; description?: string; action?: ReactNode }) {
  return <section className="lf-v3-empty-state"><IconTile icon={icon} size={48} /><h2>{title}</h2>{description ? <p>{description}</p> : null}{action ? <div>{action}</div> : null}</section>;
}

export function RestrictedState({ title = "Access restricted", reason, action }: { title?: string; reason: string; action?: ReactNode }) {
  return <section className="lf-v3-restricted-state"><Icon name="lock" size={20} /><div><h2>{title}</h2><p>{reason}</p></div>{action ? <div className="lf-v3-restricted-action">{action}</div> : null}</section>;
}

export function ContextBanner({ owner, role, access, switchHref, restricted = false }: { owner: string; role: string; access: string; switchHref: string; restricted?: boolean }) {
  return <aside className="lf-v3-context-banner"><Icon name={restricted ? "visibility_off" : "visibility"} size={18} /><span className="lf-v3-context-name"><strong>{owner}’s Fortress</strong><span className="lf-v3-context-details"> · {role} · {access}</span></span><Link href={switchHref}><span className="lf-v3-context-switch-desktop">Switch to my Vault</span><span className="lf-v3-context-switch-mobile">Switch</span></Link></aside>;
}

export function ContextSwitcher({ label, groups, selectedId, onSelect }: { label: string; groups: { title: string; options: { id: string; label: string; detail?: string; disabled?: boolean }[] }[]; selectedId: string; onSelect: (id: string) => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const options = groups.map((group) => <section key={group.title}><h3>{group.title}</h3>{group.options.map((option) => <button type="button" key={option.id} disabled={option.disabled} aria-current={selectedId === option.id ? "true" : undefined} onClick={() => { detailsRef.current?.removeAttribute("open"); setMobileOpen(false); summaryRef.current?.focus(); onSelect(option.id); }}><span>{option.label}{option.detail ? <small>{option.detail}</small> : null}</span>{selectedId === option.id ? <Icon name="check" size={20} /> : null}</button>)}</section>);
  return <><details ref={detailsRef} className="lf-v3-context-switcher" onKeyDown={(event) => { if (event.key === "Escape") { detailsRef.current?.removeAttribute("open"); summaryRef.current?.focus(); } }}><summary ref={summaryRef} onClick={(event) => { if (window.matchMedia("(max-width: 767px)").matches) { event.preventDefault(); setMobileOpen(true); } }}><span>{label}</span><Icon name="unfold_more" size={20} /></summary><div className="lf-v3-context-menu">{options}</div></details><Sheet open={mobileOpen} title="Switch Fortress" onClose={() => setMobileOpen(false)} returnFocusTo={summaryRef}><div className="lf-v3-context-menu-mobile">{options}</div></Sheet></>;
}

export function Stepper({ steps, current, variant = "bars" }: { steps: string[]; current: number; variant?: "bars" | "rail" }) {
  const active = Math.min(Math.max(current, 0), Math.max(steps.length - 1, 0));
  if (!steps.length) return null;
  return variant === "rail" ? <ol className="lf-v3-step-rail" aria-label="Progress">{steps.map((step, index) => <li key={`${step}-${index}`} className={index < active ? "is-done" : index === active ? "is-current" : "is-todo"} aria-current={index === active ? "step" : undefined}><span>{index < active ? <Icon name="check_circle" size={24} filled /> : index + 1}</span>{step}</li>)}</ol> : <div className="lf-v3-stepper" role="group" aria-label={`Step ${active + 1} of ${steps.length}: ${steps[active]}`}><div aria-hidden="true">{steps.map((step, index) => <span key={`${step}-${index}`} className={index <= active ? "is-active" : ""} />)}</div><p>Step {active + 1} of {steps.length} · <strong>{steps[active]}</strong></p></div>;
}

export function Timeline({ items }: { items: { title: string; detail?: string; status: "done" | "current" | "todo" | "locked" }[] }) {
  return <ol className="lf-v3-timeline">{items.map((item, index) => <li key={`${item.title}-${index}`} className={`is-${item.status}`} aria-current={item.status === "current" ? "step" : undefined}><span className="lf-v3-timeline-icon" aria-hidden="true"><Icon name={item.status === "done" ? "check_circle" : item.status === "locked" ? "lock" : item.status === "current" ? "progress_activity" : "radio_button_unchecked"} size={24} filled={item.status === "done"} /></span><div><span className="sr-only">{item.status === "done" ? "Completed" : item.status === "current" ? "Current step" : item.status === "locked" ? "Locked" : "Not started"}: </span><strong>{item.title}</strong>{item.detail ? <p>{item.detail}</p> : null}</div></li>)}</ol>;
}
