"use client";

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
import { waitForActiveUser } from "../../lib/auth/session";
import { trackClientEvent } from "../../lib/observability/clientEvents";
import { getOrCreateOnboardingState } from "../../lib/onboarding";
import { getFlyoutMenuKeyAction, getTopMenuKeyAction } from "../../lib/navigation/menuKeyActions";
import { initialMenuState, menuReducer, type MenuCloseReason } from "../../lib/navigation/menuState";
import { supabase } from "../../lib/supabaseClient";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [initials, setInitials] = useState("LF");
  const [authReady, setAuthReady] = useState(false);

  const [menuState, dispatchMenu] = useReducer(menuReducer, initialMenuState);
  const navWrapRef = useRef<HTMLDivElement | null>(null);

  const topLevelItems = mainNavigation.filter((item) => item.isEnabled !== false);
  const accountItems = accountNavigation.filter((item) => item.isEnabled !== false);

  const activeChain = useMemo(() => getOpenMenuChain(pathname), [pathname]);
  const activeChainIds = useMemo(() => new Set(activeChain.map((node) => node.id)), [activeChain]);

  const activePrimary = activeChain[0] ?? null;
  const level2Items = getChildrenById(menuState.openPrimaryId);

  const activeSecondary = activeChain[1] ?? null;
  const openSecondaryNode = level2Items.find((item) => item.id === menuState.openSecondaryId) ?? null;
  const level3Items = getChildrenById(menuState.openSecondaryId);

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
  const level2FlyoutId = "lf-flyout-level-2";
  const level3FlyoutId = "lf-flyout-level-3";

  const closeNavigationState = useCallback(
    (reason: MenuCloseReason, closeMobile = true) => {
      dispatchMenu({ type: "close_all", reason, closeMobile });
      trackClientEvent("menu.close", { reason, closeMobile });
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    async function guard() {
      const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 150 });
      if (!user) {
        router.replace("/signin");
        return;
      }

      const onboarding = await getOrCreateOnboardingState(supabase, user.id);
      if (!onboarding.is_completed) {
        router.replace("/onboarding");
        return;
      }

      if (!mounted) return;
      const nextEmail = user.email ?? "";
      setEmail(nextEmail);
      setInitials(makeInitials(nextEmail));
      setAuthReady(true);
    }

    void guard();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setAuthReady(false);
        router.replace("/signin");
        return;
      }

      if (!mounted) return;
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        const nextEmail = session.user.email ?? "";
        setEmail(nextEmail);
        setInitials(makeInitials(nextEmail));
        setAuthReady(true);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    function onDocClick(event: Event) {
      const target = event.target as Node;
      if (!navWrapRef.current?.contains(target)) closeNavigationState("outside_click", false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, [closeNavigationState]);

  useEffect(() => {
    queueMicrotask(() => {
      closeNavigationState("route_change");
    });
  }, [pathname, closeNavigationState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const onChange = () => closeNavigationState("breakpoint_change");
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, [closeNavigationState]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeNavigationState("escape");
    }

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [closeNavigationState]);

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

  function navigateTo(path: string) {
    closeNavigationState("item_select");
    router.push(path);
  }

  function onTopKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>, item: NavNode) {
    const currentIndex = topLevelItems.findIndex((node) => node.id === item.id);

    const action = getTopMenuKeyAction({ key: event.key, hasChildren: Boolean(item.children?.length) });

    if (action === "focus-next" || action === "focus-prev") {
      event.preventDefault();
      const delta = action === "focus-next" ? 1 : -1;
      const nextIndex = (currentIndex + delta + topLevelItems.length) % topLevelItems.length;
      const nextId = topLevelItems[nextIndex]?.id;
      if (!nextId) return;
      const nextElement = document.querySelector<HTMLElement>(`[data-nav-id='${nextId}']`);
      nextElement?.focus();
      return;
    }

    if (action === "open-primary" && item.children?.length) {
      event.preventDefault();
      dispatchMenu({ type: "toggle_primary", id: item.id });
      trackClientEvent("menu.open_primary", { id: item.id, via: "keyboard" });
      return;
    }

    if (action === "close-all") {
      event.preventDefault();
      closeNavigationState("escape");
      return;
    }

    if (action === "navigate") {
      event.preventDefault();
      navigateTo(item.path);
    }
  }

  function onFlyoutKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>, item: NavNode, level: 2 | 3) {
    const action = getFlyoutMenuKeyAction({
      key: event.key,
      hasChildren: Boolean(item.children?.length),
      level,
    });

    if (action === "close-all") {
      event.preventDefault();
      closeNavigationState("escape");
      return;
    }

    if (action === "close-secondary") {
      event.preventDefault();
      dispatchMenu({ type: "collapse_secondary" });
      trackClientEvent("menu.close_secondary", { reason: "parent_collapse" });
      return;
    }

    if (action === "open-secondary" && item.children?.length) {
      event.preventDefault();
      dispatchMenu({ type: "toggle_secondary", id: item.id });
      trackClientEvent("menu.open_secondary", { id: item.id, via: "keyboard" });
      return;
    }

    if (action === "navigate") {
      event.preventDefault();
      navigateTo(item.path);
    }
  }

  const signOut = async () => {
    dispatchMenu({ type: "set_mobile_nav", open: false });
    await supabase.auth.signOut();
    router.replace("/signin");
  };

  if (!authReady) {
    return (
      <main className="lf-auth">
        <section className="lf-auth-form-side">
          <div className="lf-auth-card">
            <h1>Checking session</h1>
            <p className="lf-auth-subtext">Validating your secure session...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="lf-shell">
      <div
        className="lf-nav-wrap"
        ref={navWrapRef}
        data-menu-open={menuState.openPrimaryId ? "true" : "false"}
        onBlurCapture={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && navWrapRef.current?.contains(next)) return;
          closeNavigationState("focus_leave", false);
        }}
      >
        <aside className="lf-sidebar">
          <div className="lf-brand-row">
            <BrandMark size={32} priority />
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
            highlightedTopId={menuState.openPrimaryId}
            flyoutId={level2FlyoutId}
            onActivateTop={(event, item, anchorEl) => {
              if (item.children?.length) {
                event.preventDefault();
                const top = resolveFlyoutTop(anchorEl, item.children.length);
                dispatchMenu({ type: "toggle_primary", id: item.id, top });
                trackClientEvent("menu.open_primary", { id: item.id, via: "click" });
                return;
              }
              closeNavigationState("item_select", false);
            }}
            onKeyDownTop={onTopKeyDown}
          />

          <div className="lf-sidebar-foot">
            <nav aria-label="Account and preferences" className="lf-account-nav">
              {accountItems.map((item) => {
                const isActive = normalizePath(pathname) === normalizePath(item.path);
                return (
                  <Link key={item.id} href={item.path} className={`lf-account-link ${isActive ? "is-active" : ""}`} onClick={() => closeNavigationState("item_select")}>
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

        {menuState.openPrimaryId && level2Items.length ? (
          <FlyoutMenu
            menuId={level2FlyoutId}
            level={2}
            parentLabel={activePrimary?.label ?? "submenu"}
            items={level2Items}
            highlightedId={menuState.openSecondaryId}
            childMenuId={level3FlyoutId}
            activeChainIds={activeChainIds}
            onActivateItem={(event, item, _level, anchorEl) => {
              if (item.children?.length) {
                event.preventDefault();
                const top = resolveFlyoutTop(anchorEl, item.children.length);
                dispatchMenu({ type: "toggle_secondary", id: item.id, top });
                trackClientEvent("menu.open_secondary", { id: item.id, via: "click" });
                return;
              }
              closeNavigationState("item_select", false);
            }}
            onKeyDownItem={onFlyoutKeyDown}
            topOffset={menuState.level2Top}
          />
        ) : null}

        {menuState.openSecondaryId && level3Items.length ? (
          <FlyoutMenu
            menuId={level3FlyoutId}
            level={3}
            parentLabel={openSecondaryNode?.label ?? activeSecondary?.label ?? "submenu"}
            items={level3Items}
            highlightedId={null}
            activeChainIds={activeChainIds}
            onActivateItem={() => closeNavigationState("item_select", false)}
            onKeyDownItem={onFlyoutKeyDown}
            topOffset={menuState.level3Top}
          />
        ) : null}
      </div>

      <div className="lf-content-wrap">
        <header className="lf-topbar">
          <button
            className="lf-menu-btn"
            type="button"
            onClick={() => dispatchMenu({ type: "toggle_mobile_nav" })}
            aria-expanded={menuState.mobileNavOpen}
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

        {menuState.mobileNavOpen ? (
          <>
            <button
              className="lf-mobile-backdrop"
              type="button"
              aria-label="Close navigation menu"
              onClick={() => closeNavigationState("outside_click")}
            />
            <aside className="lf-mobile-drawer" aria-label="Mobile Navigation">
              <div className="lf-brand-row">
                <BrandMark size={32} priority />
                <div>
                  <div className="lf-brand-title">Legacy Fortress</div>
                  <div className="lf-brand-subtitle">Estate Command Center</div>
                </div>
              </div>

              <MobileNavTree
                items={topLevelItems}
                expandedIds={new Set([...activeChainIds, ...menuState.mobileExpandedIds])}
                activeChainIds={activeChainIds}
                onToggle={(id) => {
                  dispatchMenu({ type: "toggle_mobile_expand", id });
                }}
                onNavigate={() => closeNavigationState("item_select")}
              />

              <nav aria-label="Account and preferences" className="lf-account-nav">
                {accountItems.map((item) => {
                  const isActive = normalizePath(pathname) === normalizePath(item.path);
                  return (
                    <Link
                      key={item.id}
                      href={item.path}
                      className={`lf-account-link ${isActive ? "is-active" : ""}`}
                      onClick={() => closeNavigationState("item_select")}
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
