"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandMark from "./components/BrandMark";
import Breadcrumbs from "./components/navigation/Breadcrumbs";
import FlyoutMenu from "./components/navigation/FlyoutMenu";
import MobileNavTree from "./components/navigation/MobileNavTree";
import SidebarPrimary from "./components/navigation/SidebarPrimary";
import { accountNavigation, mainNavigation, type NavNode } from "./navigation/navigation.config";
import { getBreadcrumbsByPath, getChildrenById, getOpenMenuChain, normalizePath } from "./navigation/navigation.utils";
import { computeFlyoutTop } from "../../lib/navigation/flyoutPosition";
import { getOrCreateOnboardingState } from "../../lib/onboarding";
import { supabase } from "../../lib/supabaseClient";

const FLYOUT_CLOSE_DELAY_MS = 170;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [initials, setInitials] = useState("LF");

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileExpandedIds, setMobileExpandedIds] = useState<Set<string>>(new Set());

  const [openPrimaryId, setOpenPrimaryId] = useState<string | null>(null);
  const [openSecondaryId, setOpenSecondaryId] = useState<string | null>(null);
  const [level2Top, setLevel2Top] = useState(80);
  const [level3Top, setLevel3Top] = useState(80);

  const closeTimerRef = useRef<number | null>(null);
  const navWrapRef = useRef<HTMLDivElement | null>(null);

  const topLevelItems = mainNavigation.filter((item) => item.isEnabled !== false);
  const accountItems = accountNavigation.filter((item) => item.isEnabled !== false);

  const activeChain = useMemo(() => getOpenMenuChain(pathname), [pathname]);
  const activeChainIds = useMemo(() => new Set(activeChain.map((node) => node.id)), [activeChain]);

  const activePrimary = activeChain[0] ?? null;
  const effectivePrimaryId = openPrimaryId ?? activePrimary?.id ?? null;
  const level2Items = getChildrenById(effectivePrimaryId);

  const activeSecondary = activeChain[1] ?? null;
  const effectiveSecondaryId =
    openSecondaryId ??
    (activeSecondary && level2Items.some((item) => item.id === activeSecondary.id) ? activeSecondary.id : null);
  const level3Items = getChildrenById(effectiveSecondaryId);

  const breadcrumbs = useMemo(() => {
    const byConfig = getBreadcrumbsByPath(pathname);
    if (byConfig.length) return byConfig;

    const segments = normalizePath(pathname)
      .split("/")
      .filter(Boolean)
      .map((segment, index, arr) => ({
        id: `fallback-${index}`,
        label: segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        path: `/${arr.slice(0, index + 1).join("/")}`,
      }));

    return segments as NavNode[];
  }, [pathname]);

  const currentNode = breadcrumbs[breadcrumbs.length - 1] ?? null;

  const clearFlyoutClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleFlyoutClose = useCallback(() => {
    clearFlyoutClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenPrimaryId(null);
      setOpenSecondaryId(null);
    }, FLYOUT_CLOSE_DELAY_MS);
  }, [clearFlyoutClose]);

  useEffect(() => {
    let mounted = true;

    async function guard() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace("/signin");
        return;
      }

      const onboarding = await getOrCreateOnboardingState(supabase, data.user.id);
      if (!onboarding.is_completed) {
        router.replace("/onboarding");
        return;
      }

      if (!mounted) return;
      const nextEmail = data.user.email ?? "";
      setEmail(nextEmail);
      setInitials(makeInitials(nextEmail));
    }

    void guard();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/signin");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!navWrapRef.current?.contains(target)) {
        clearFlyoutClose();
        setOpenPrimaryId(null);
        setOpenSecondaryId(null);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [clearFlyoutClose]);

  useEffect(() => () => clearFlyoutClose(), [clearFlyoutClose]);

  function openPrimary(nodeId: string | null) {
    clearFlyoutClose();
    setOpenPrimaryId(nodeId);
    setOpenSecondaryId(null);
  }

  function openSecondary(nodeId: string | null) {
    clearFlyoutClose();
    setOpenSecondaryId(nodeId);
  }

  function resolveFlyoutTop(anchorEl: HTMLElement | undefined, itemCount: number) {
    if (!anchorEl || !navWrapRef.current || !window) return null;
    const wrapRect = navWrapRef.current.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();

    return computeFlyoutTop({
      anchorTop: anchorRect.top,
      anchorHeight: anchorRect.height,
      containerTop: wrapRect.top,
      viewportHeight: window.innerHeight,
      itemCount,
    });
  }

  function openPrimaryFromAnchor(node: NavNode, anchorEl?: HTMLElement) {
    if (!node.children?.length) {
      setOpenPrimaryId(null);
      setOpenSecondaryId(null);
      return;
    }

    const top = resolveFlyoutTop(anchorEl, node.children.length);
    if (typeof top === "number") setLevel2Top(top);
    openPrimary(node.id);
  }

  function openSecondaryFromAnchor(node: NavNode, anchorEl?: HTMLElement) {
    if (!node.children?.length) {
      setOpenSecondaryId(null);
      return;
    }

    const top = resolveFlyoutTop(anchorEl, node.children.length);
    if (typeof top === "number") setLevel3Top(top);
    openSecondary(node.id);
  }

  function navigateTo(path: string) {
    router.push(path);
    setOpenPrimaryId(null);
    setOpenSecondaryId(null);
  }

  function onTopKeyDown(event: KeyboardEvent<HTMLAnchorElement>, item: NavNode) {
    const currentIndex = topLevelItems.findIndex((node) => node.id === item.id);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + delta + topLevelItems.length) % topLevelItems.length;
      const nextId = topLevelItems[nextIndex]?.id;
      if (!nextId) return;
      const nextElement = document.querySelector<HTMLElement>(`[data-nav-id='${nextId}']`);
      nextElement?.focus();
    }

    if (event.key === "ArrowRight" && item.children?.length) {
      event.preventDefault();
      openPrimary(item.id);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpenPrimaryId(null);
      setOpenSecondaryId(null);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (item.children?.length) {
        openPrimary(item.id);
      } else {
        navigateTo(item.path);
      }
    }
  }

  function onFlyoutKeyDown(event: KeyboardEvent<HTMLAnchorElement>, item: NavNode, level: 2 | 3) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (level === 3) {
        setOpenSecondaryId(null);
      } else {
        setOpenPrimaryId(null);
      }
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && item.children?.length && level === 2) {
      event.preventDefault();
      openSecondary(item.id);
      return;
    }

    if (event.key === "ArrowRight" && item.children?.length && level === 2) {
      event.preventDefault();
      openSecondary(item.id);
    }
  }

  const signOut = async () => {
    setMobileNavOpen(false);
    await supabase.auth.signOut();
    router.replace("/signin");
  };

  return (
    <div className="lf-shell">
      <div className="lf-nav-wrap" ref={navWrapRef} onMouseEnter={clearFlyoutClose} onMouseLeave={scheduleFlyoutClose}>
        <aside className="lf-sidebar">
          <div className="lf-brand-row">
            <BrandMark size={44} />
            <div>
              <div className="lf-brand-title">Legacy Fortress</div>
              <div className="lf-brand-subtitle">Estate Command Center</div>
            </div>
          </div>

          <label className="lf-search-wrap">
            <span className="lf-search-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="M16.5 16.5 21 21" />
              </svg>
            </span>
            <input className="lf-search" placeholder="Search" aria-label="Search" />
          </label>

          <SidebarPrimary
            items={topLevelItems}
            activeTopId={activePrimary?.id ?? null}
            highlightedTopId={effectivePrimaryId}
            onHoverTop={(id, anchorEl) => {
              const node = topLevelItems.find((item) => item.id === id);
              if (!node) return;
              openPrimaryFromAnchor(node, anchorEl);
            }}
            onFocusTop={(id, anchorEl) => {
              const node = topLevelItems.find((item) => item.id === id);
              if (!node) return;
              openPrimaryFromAnchor(node, anchorEl);
            }}
            onKeyDownTop={onTopKeyDown}
          />

          <div className="lf-sidebar-foot">
            <nav aria-label="Account and preferences" className="lf-account-nav">
              {accountItems.map((item) => {
                const isActive = normalizePath(pathname) === normalizePath(item.path);
                return (
                  <Link key={item.id} href={item.path} className={`lf-account-link ${isActive ? "is-active" : ""}`}>
                    <span className="lf-nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="lf-user-card">
              <div className="lf-user-avatar">{initials}</div>
              <div>
                <div className="lf-user-name">Secure Account</div>
                <div className="lf-user-email">{email || "Signed in"}</div>
              </div>
              <button className="lf-signout" onClick={signOut} type="button">
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {effectivePrimaryId && level2Items.length ? (
          <FlyoutMenu
            level={2}
            parentLabel={activePrimary?.label ?? "submenu"}
            items={level2Items}
            highlightedId={effectiveSecondaryId}
            activeChainIds={activeChainIds}
            onHoverItem={(id, anchorEl) => {
              const node = level2Items.find((item) => item.id === id);
              if (!node) return;
              openSecondaryFromAnchor(node, anchorEl);
            }}
            onFocusItem={(id, anchorEl) => {
              const node = level2Items.find((item) => item.id === id);
              if (!node) return;
              openSecondaryFromAnchor(node, anchorEl);
            }}
            onKeyDownItem={onFlyoutKeyDown}
            topOffset={level2Top}
          />
        ) : null}

        {effectiveSecondaryId && level3Items.length ? (
          <FlyoutMenu
            level={3}
            parentLabel={activeSecondary?.label ?? "submenu"}
            items={level3Items}
            highlightedId={null}
            activeChainIds={activeChainIds}
            onHoverItem={() => undefined}
            onFocusItem={() => undefined}
            onKeyDownItem={onFlyoutKeyDown}
            topOffset={level3Top}
          />
        ) : null}
      </div>

      <div className="lf-content-wrap">
        <header className="lf-topbar">
          <button
            className="lf-menu-btn"
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-expanded={mobileNavOpen}
            aria-label="Toggle navigation menu"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="lf-topbar-main">
            <Breadcrumbs items={breadcrumbs} />
            <div className="lf-topbar-title">{currentNode?.label ?? "Dashboard"}</div>
            {currentNode?.description ? <div className="lf-topbar-desc">{currentNode.description}</div> : null}
          </div>

          <div className="lf-topbar-pill">Private · Encrypted</div>
        </header>

        {mobileNavOpen ? (
          <>
            <button
              className="lf-mobile-backdrop"
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="lf-mobile-drawer" aria-label="Mobile Navigation">
              <div className="lf-brand-row">
                <BrandMark size={40} />
                <div>
                  <div className="lf-brand-title">Legacy Fortress</div>
                  <div className="lf-brand-subtitle">Estate Command Center</div>
                </div>
              </div>

              <MobileNavTree
                items={topLevelItems}
                expandedIds={new Set([...activeChainIds, ...mobileExpandedIds])}
                activeChainIds={activeChainIds}
                onToggle={(id) => {
                  setMobileExpandedIds((prev) => {
                    const copy = new Set(prev);
                    if (copy.has(id)) copy.delete(id);
                    else copy.add(id);
                    return copy;
                  });
                }}
                onNavigate={() => setMobileNavOpen(false)}
              />

              <nav aria-label="Account and preferences" className="lf-account-nav">
                {accountItems.map((item) => {
                  const isActive = normalizePath(pathname) === normalizePath(item.path);
                  return (
                    <Link
                      key={item.id}
                      href={item.path}
                      className={`lf-account-link ${isActive ? "is-active" : ""}`}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <span className="lf-nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="lf-sidebar-foot">
                <div className="lf-user-card">
                  <div className="lf-user-avatar">{initials}</div>
                  <div>
                    <div className="lf-user-name">Secure Account</div>
                    <div className="lf-user-email">{email || "Signed in"}</div>
                  </div>
                  <button className="lf-signout" onClick={signOut} type="button">
                    Sign out
                  </button>
                </div>
              </div>
            </aside>
          </>
        ) : null}

        <main className="lf-main-content">{children}</main>
      </div>
    </div>
  );
}

function makeInitials(email: string) {
  if (!email) return "LF";
  const local = email.split("@")[0] || "lf";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
