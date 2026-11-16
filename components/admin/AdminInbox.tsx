"use client";

import AdminAccountTags from "@/components/admin/AdminAccountTags";
import { accountSourceLabel } from "@/lib/admin/accountOrigins";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import type { AdminInboxItem, AdminInboxKind } from "@/lib/admin/inbox";
import { INCLUDE_TESTS_EVENT, readIncludeTests, writeIncludeTests } from "@/lib/admin/includeTestsPreference";

/**
 * Admin Inbox (owner decision 16 Nov 2026), in the style of the Vault Inbox: newest first, unread dots, filters.
 * Search stays at the top with Refresh; pull down on a phone to refresh; it also refreshes every minute.
 * Account details and counts only: never record names, values, documents or the people customers invite.
 * Read/unread is remembered on this device.
 */
const FILTERS: Array<[AdminInboxKind | "all", string, string]> = [
  ["all", "All", "inbox"],
  ["accounts", "New accounts", "person_add"],
  ["plans", "Plans", "workspace_premium"],
  ["links", "Links", "link"],
  ["documents", "Documents", "description"],
  ["needs", "Needs you", "priority_high"],
];
const ICONS: Record<AdminInboxKind, string> = { accounts: "person_add", plans: "workspace_premium", links: "link", documents: "description", needs: "priority_high" };
const READ_KEY = "lf:admin-inbox:read";

function loadRead(): string[] {
  try { const value = JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
}
function saveRead(ids: string[]) {
  try { window.localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-3000))); } catch { /* optional */ }
}

export default function AdminInbox({ authFetch }: { authFetch: (input: string, init?: RequestInit) => Promise<Response> }) {
  const [items, setItems] = useState<AdminInboxItem[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<AdminInboxKind | "all">("all");
  const [search, setSearch] = useState("");
  const [includeTests, setIncludeTestsState] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setIncludeTestsState(readIncludeTests()));
    const onChange = (event: Event) => setIncludeTestsState(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(INCLUDE_TESTS_EVENT, onChange);
    return () => window.removeEventListener(INCLUDE_TESTS_EVENT, onChange);
  }, []);
  const setIncludeTests = (value: boolean) => writeIncludeTests(value);
  const [read, setRead] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const pull = useRef<{ y: number; active: boolean } | null>(null);
  const [pulled, setPulled] = useState(0);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await authFetch("/api/internal/admin/inbox");
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: AdminInboxItem[]; generatedAt?: string; message?: string };
      if (!res.ok || !json.ok) { setError(json.message || "The Inbox couldn’t load. Try again."); return; }
      setError("");
      setItems(json.items ?? []);
      setUpdatedAt(json.generatedAt ?? new Date().toISOString());
    } catch {
      setError("The Inbox couldn’t load. Try again.");
    } finally {
      setRefreshing(false);
    }
  }, [authFetch, includeTests]);

  useEffect(() => {
    queueMicrotask(() => setRead(loadRead()));
    const first = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return (items ?? []).filter((item) => (filter === "all" || item.kind === filter)
      && (!words || `${item.title} ${item.detail} ${item.accountEmail ?? ""} ${item.kind === "accounts" ? accountSourceLabel(item.origin) : ""}`.toLowerCase().includes(words)));
  }, [filter, items, search]);
  const count = (kind: AdminInboxKind | "all") => (items ?? []).filter((item) => kind === "all" || item.kind === kind).length;
  const unread = (items ?? []).filter((item) => !read.includes(item.id)).length;

  function markRead(ids: string[]) {
    setRead((current) => { const next = [...new Set([...current, ...ids])]; saveRead(next); return next; });
  }

  return (
    <section
      className="lf-admin-inbox"
      aria-label="Admin Inbox"
      onTouchStart={(event) => { pull.current = window.scrollY <= 0 ? { y: event.touches[0].clientY, active: true } : null; }}
      onTouchMove={(event) => { if (pull.current?.active) setPulled(Math.max(0, Math.min(90, event.touches[0].clientY - pull.current.y))); }}
      onTouchEnd={() => { if (pulled > 70) void load(); pull.current = null; setPulled(0); }}
    >
      {pulled > 10 ? <p className="lf-admin-inbox-pull" role="status">{pulled > 70 ? "Release to refresh" : "Pull to refresh"}</p> : null}
      <div className="lf-admin-inbox-bar">
        <label className="lf-admin-search"><Icon name="search" size={18} /><span className="lf-visually-hidden">Search the Inbox</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by email" />
        </label>
        <button type="button" className="lf-admin-row-button" onClick={() => void load()} disabled={refreshing} aria-label="Refresh">
          <Icon name="refresh" size={20} /><span className="lf-admin-inbox-refresh-label">{refreshing ? "Refreshing…" : "Refresh"}</span>
        </button>
      </div>
      <p className="lf-admin-inbox-summary">
        <strong>{unread} new</strong> · last 30 days{updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
        {unread ? <button type="button" className="lf-admin-inbox-link" onClick={() => markRead((items ?? []).map((item) => item.id))}>Mark all as read</button> : null}
      </p>
      <div className="lf-admin-inbox-filters" role="group" aria-label="Show">
        {FILTERS.map(([key, label, icon]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            <Icon name={icon} size={18} /><span>{label}</span><span className="lf-admin-inbox-count">{count(key)}</span>
          </button>
        ))}
      </div>
      <label className="lf-admin-test-toggle"><input type="checkbox" checked={includeTests} onChange={(event) => setIncludeTests(event.target.checked)} /> Show test accounts</label>
      {error ? <p className="lf-admin-inbox-error" role="alert">{error}</p> : null}
      {items === null && !error ? <p className="lf-admin-muted" role="status">Loading…</p> : null}
      {items !== null && !shown.length ? <p className="lf-admin-muted">{search ? "Nothing matches that search." : "Nothing here in the last 30 days."}</p> : null}
      <ul className="lf-admin-inbox-list">
        {shown.map((item) => {
          const isNew = !read.includes(item.id);
          return (
            <li key={item.id}>
              <Link href={item.href} prefetch={false} className={`lf-admin-inbox-row is-${item.kind}${isNew ? " is-new" : ""}`} onClick={() => markRead([item.id])}>
                <span className="lf-admin-inbox-dot" aria-label={isNew ? "New" : undefined} />
                <span className="lf-admin-inbox-icon" aria-hidden="true"><Icon name={ICONS[item.kind]} size={20} /></span>
                <span className="lf-admin-inbox-copy">
                  <span className="lf-admin-inbox-top"><strong>{item.title}</strong><time dateTime={item.at}>{when(item.at)}</time></span>
                  <span className="lf-admin-inbox-detail">{item.detail}{item.kind === "accounts" ? <AdminAccountTags origin={item.origin} isTest={item.isTest} /> : null}</span>
                </span>
                <Icon name="chevron_right" size={20} />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="lf-admin-muted lf-admin-inbox-note">Account details and counts only. Record names, values, documents and the people customers invite are never shown.</p>
    </section>
  );
}

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
