"use client";

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandMark from "./components/BrandMark";
import Icon from "../../components/ui/Icon";
import Breadcrumbs from "./components/navigation/Breadcrumbs";
import FlyoutMenu from "./components/navigation/FlyoutMenu";
import MobileNavTree from "./components/navigation/MobileNavTree";
import SidebarPrimary from "./components/navigation/SidebarPrimary";
import { accountNavigation, mainNavigation, type NavNode } from "./navigation/navigation.config";
import { getBreadcrumbsByPath, getChildrenById, getOpenMenuChain, normalizePath } from "./navigation/navigation.utils";
import { computeFlyoutTop } from "../../lib/navigation/flyoutPosition";
import { trackClientEvent } from "../../lib/observability/clientEvents";
import { getFlyoutMenuKeyAction, getTopMenuKeyAction } from "../../lib/navigation/menuKeyActions";
import { initialMenuState, menuReducer, type MenuCloseReason } from "../../lib/navigation/menuState";
import { bootstrapAuthenticatedUser } from "../../lib/auth/bootstrap";
import { buildProtectedSignInRedirect, isFinalSignedOutAuthEvent, waitForActiveUser } from "../../lib/auth/session";
import { appendDevBankRequestTrace, isDevBankTraceEnabled } from "../../lib/devSmoke";
import { appendProfileAvatarTrace, maskAvatarUrl } from "../../lib/profile/avatarTrace";
import { loadProfileIdentityChip, resolveProfileIdentityDisplayName } from "../../lib/profile/workspace";
import { buildDashboardSearchHref } from "../../lib/records/discovery";
import { supabase } from "../../lib/supabaseClient";
import { ViewerAccessProvider } from "../../components/access/ViewerAccessContext";
import { VaultPreferencesProvider } from "../../components/vault/VaultPreferencesContext";
import { AccessibilityPreferencesProvider } from "../../components/accessibility/AccessibilityPreferencesContext";
import WorkspaceSwitcher from "../../components/navigation/WorkspaceSwitcher";
import { DEMO_EXPERIENCE_LABEL, DEMO_EXPERIENCE_SUBLABEL, isDemoSessionUser } from "../../lib/demo/config";
import {
  canViewPath,
  clearStoredLinkedGrantId,
  filterNavigationTreeForViewer,
  getRoleLabel,
  hasLinkedAccountAccess,
  getStoredLinkedGrantId,
  loadViewerAccessState,
  setStoredLinkedGrantId,
  type ViewerAccessState,
} from "../../lib/access-control/viewerAccess";
import {
  filterNodesByVaultPreferences,
  getDefaultVaultPreferences,
  loadVaultPreferences,
} from "../../lib/vaultPreferences";
import {
  getDefaultAccessibilityPreferences,
  loadAccessibilityPreferences,
} from "../../lib/accessibilityPreferences";
import {
  normalizePlatformRole,
} from "../../lib/auth/platformRoles";
import {
  getTestPersona,
  isTestPersonaAccessEnabled,
  TEST_PERSONA_QUERY_PARAM,
  TEST_PERSONA_STORAGE_KEY,
} from "../../lib/testPersonas";

const PROFILE_AVATAR_CACHE_KEY = "lf:profile-avatar:last-good";
type AuthState = "checking" | "ready" | "redirecting" | "none" | "error";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("Secure Account");
  const [initials, setInitials] = useState("LF");
  const [avatarUrl, setAvatarUrl] = useState(() => readCachedProfileAvatarUrl());
  const [confirmedAvatarUrl, setConfirmedAvatarUrl] = useState("");
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [isDemoExperience, setIsDemoExperience] = useState(false);
  const [viewerAccess, setViewerAccess] = useState<ViewerAccessState | null>(null);
  const [vaultPreferences, setVaultPreferences] = useState(getDefaultVaultPreferences);
  const [accessibilityPreferences, setAccessibilityPreferences] = useState(getDefaultAccessibilityPreferences);
  const [shellSearchState, setShellSearchState] = useState(() => ({
    pathname,
    value: readShellSearchFromLocation(pathname),
  }));
  const [devSmokeMode] = useState(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return false;
    return new URLSearchParams(window.location.search).get("lf_dev_smoke") === "1";
  });
  const [prototypePreviewMode, setPrototypePreviewMode] = useState(false);
  const effectiveAuthState = devSmokeMode || prototypePreviewMode ? "ready" : authState;
  const effectiveEmail = devSmokeMode ? "smoke-user@legacy-fortress.local" : email;
  const effectiveDisplayName = devSmokeMode ? "Smoke User" : displayName;
  const effectiveInitials = devSmokeMode ? "SU" : initials;
  const effectiveAvatarUrl = devSmokeMode ? "" : avatarUrl;
  const renderedAvatarUrl = !devSmokeMode && effectiveAvatarUrl && confirmedAvatarUrl === effectiveAvatarUrl ? confirmedAvatarUrl : "";
  const shellSearch = shellSearchState.pathname === pathname ? shellSearchState.value : readShellSearchFromLocation(pathname);
  const setFreshAvatarUrl = useCallback((value: string) => {
    const next = String(value ?? "").trim();
    if (!next) {
      appendProfileAvatarTrace("[sidebar-avatar:set] ignored_empty_value=yes");
      return;
    }
    cacheProfileAvatarUrl(next);
    setAvatarUrl(next);
  }, []);

  const [menuState, dispatchMenu] = useReducer(menuReducer, initialMenuState);
  const navWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!effectiveAvatarUrl) {
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      setConfirmedAvatarUrl(effectiveAvatarUrl);
      appendProfileAvatarTrace("[sidebar-avatar:preload] result=loaded");
    };
    image.onerror = () => {
      if (cancelled) return;
      setConfirmedAvatarUrl("");
      appendProfileAvatarTrace("[sidebar-avatar:preload] result=failed");
    };
    image.src = effectiveAvatarUrl;

    return () => {
      cancelled = true;
    };
  }, [effectiveAvatarUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || !isTestPersonaAccessEnabled()) return;

    function refreshPrototypeContext() {
      const url = new URL(window.location.href);
      const queryRole = normalizePlatformRole(url.searchParams.get("role"));
      const adminFlag = url.searchParams.get("admin") === "true";
      const prototypeFlag = url.searchParams.get("prototype") === "true";
      const persona = getTestPersona(url.searchParams.get(TEST_PERSONA_QUERY_PARAM))
        ?? getTestPersona(window.localStorage.getItem(TEST_PERSONA_STORAGE_KEY));
      setPrototypePreviewMode(Boolean(persona || (queryRole && adminFlag && prototypeFlag)));
    }

    refreshPrototypeContext();
    window.addEventListener("storage", refreshPrototypeContext);
    window.addEventListener("lf-test-persona-change", refreshPrototypeContext);
    return () => {
      window.removeEventListener("storage", refreshPrototypeContext);
      window.removeEventListener("lf-test-persona-change", refreshPrototypeContext);
    };
  }, []);

  const baseTopLevelItems = mainNavigation.filter((item) => item.isEnabled !== false);
  const baseAccountItems = accountNavigation.filter((item) => item.isEnabled !== false);
  const resolvedViewerAccess = viewerAccess ?? {
    mode: "owner",
    grantId: null,
    sessionUserId: "",
    targetOwnerUserId: "",
    accountHolderName: effectiveDisplayName,
    linkedContactId: null,
    linkedContactName: "",
    viewerRole: "owner",
    activationStatus: "active",
    readOnly: false,
    canUpgradeToOwnAccount: false,
    permissionsOverride: {
      allowedSections: [],
      assetIds: [],
      recordIds: [],
      editableAssetIds: [],
      editableRecordIds: [],
      explicitPermissions: [],
    },
    identityAssuranceLevel: 1,
    requiredIdentityLevel: 1,
    vaultLifecycleState: "OWNER_ACTIVE",
    assignedAssetIds: [],
    assignedRecordIds: [],
    editableAssetIds: [],
    editableRecordIds: [],
    assignedSectionKeys: [],
  } satisfies ViewerAccessState;
  const topLevelItems = useMemo(
    () => filterNodesByVaultPreferences(filterNavigationTreeForViewer(baseTopLevelItems, resolvedViewerAccess), vaultPreferences),
    [baseTopLevelItems, resolvedViewerAccess, vaultPreferences],
  );
  const dashboardNavigationItems = useMemo(
    () => stripNavigationChildren(topLevelItems),
    [topLevelItems],
  );
  const accountItems = useMemo(
    () => filterNodesByVaultPreferences(filterNavigationTreeForViewer(baseAccountItems, resolvedViewerAccess), vaultPreferences),
    [baseAccountItems, resolvedViewerAccess, vaultPreferences],
  );

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
        label: toFriendlyPathLabel(segment),
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
    if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return;
    if (!isDevBankTraceEnabled()) return;

    type FetchWithTraceState = typeof window.fetch & {
      __lfBankTraceWrapped?: boolean;
      __lfBankTraceOriginal?: typeof window.fetch;
    };

    const currentFetch = window.fetch as FetchWithTraceState;
    if (currentFetch.__lfBankTraceWrapped) return;

    const originalFetch = currentFetch.bind(window);

    function classifyRequestStage(method: string, url: URL) {
      const pathname = window.location.pathname;
      if (!url.pathname.includes("/rest/v1/")) return "other";
      if (pathname.startsWith("/finances/bank")) {
        if (method === "POST" || method === "PATCH" || method === "PUT") return "submit";
        return "page-load-or-reload";
      }
      if (pathname.startsWith("/dashboard")) {
        return "dashboard-load";
      }
      return "other";
    }

    const wrappedFetch: FetchWithTraceState = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(requestUrl, window.location.origin);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const isPostgrest = url.pathname.includes("/rest/v1/");
      const isAssetsRequest = url.pathname.includes("/rest/v1/assets");

      const requestHeaders = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const tracedHeaders = {
        acceptProfile: requestHeaders.get("accept-profile") ?? "",
        contentProfile: requestHeaders.get("content-profile") ?? "",
        prefer: requestHeaders.get("prefer") ?? "",
        xClientInfo: requestHeaders.get("x-client-info") ?? "",
      };

      let bodyPreview = "";
      if (typeof init?.body === "string") {
        bodyPreview = init.body;
      }

      if (isPostgrest) {
        appendDevBankRequestTrace(
          `[network:${isAssetsRequest ? "assets" : "postgrest"}] helper=app-layout-fetch stage=${classifyRequestStage(method, url)} method=${method} url=${url.origin}${url.pathname} query=${url.search || "<none>"} headers=${JSON.stringify(tracedHeaders)} body=${bodyPreview || "<none>"}`,
        );
      }

      try {
        const response = await originalFetch(input, init);
        if (isPostgrest && !response.ok) {
          const cloned = response.clone();
          const errorBody = await cloned.text().catch(() => "");
          appendDevBankRequestTrace(
            `[network-error:${isAssetsRequest ? "assets" : "postgrest"}] helper=app-layout-fetch stage=${classifyRequestStage(method, url)} status=${response.status} body=${errorBody || "<empty>"}`,
          );
        }
        return response;
      } catch (error) {
        appendDevBankRequestTrace(
          `[network-throw:${isAssetsRequest ? "assets" : "postgrest"}] helper=app-layout-fetch stage=${classifyRequestStage(method, url)} message=${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }) as FetchWithTraceState;

    wrappedFetch.__lfBankTraceWrapped = true;
    wrappedFetch.__lfBankTraceOriginal = originalFetch;
    window.fetch = wrappedFetch;

    return () => {
      const activeFetch = window.fetch as FetchWithTraceState;
      if (activeFetch.__lfBankTraceOriginal) {
        window.fetch = activeFetch.__lfBankTraceOriginal;
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (devSmokeMode) return () => { mounted = false; };

    async function hydrateAuthenticatedSession(user: {
      id: string;
      email?: string | null;
      user_metadata?: unknown;
      app_metadata?: unknown;
    }) {
      if (!mounted) return;
      const userId = user.id;
      const nextEmail = user.email ?? "";
      setEmail(nextEmail);
      setIsDemoExperience(
        isDemoSessionUser({
          email: nextEmail,
          userMetadata: user.user_metadata,
          appMetadata: user.app_metadata,
        }),
      );
      await hydrateUserChip(userId, nextEmail, mounted, setDisplayName, setInitials, setFreshAvatarUrl);
      if (!mounted) return;
      try {
        const nextViewer = await loadViewerAccessState(supabase, userId, {
          preferredGrantId: getStoredLinkedGrantId(),
          fallbackDisplayName: nextEmail.split("@")[0] || "Secure Account",
        });
        if (!mounted) return;
        setViewerAccess(nextViewer);
      } catch {
        if (!mounted) return;
        setViewerAccess({
          mode: "owner",
          grantId: null,
          sessionUserId: userId,
          targetOwnerUserId: userId,
          accountHolderName: nextEmail.split("@")[0] || "Secure Account",
          linkedContactId: null,
          linkedContactName: "",
          viewerRole: "owner",
          activationStatus: "active",
          readOnly: false,
          canUpgradeToOwnAccount: false,
          permissionsOverride: {
            allowedSections: [],
            assetIds: [],
            recordIds: [],
            editableAssetIds: [],
            editableRecordIds: [],
            explicitPermissions: [],
          },
          identityAssuranceLevel: 1,
          requiredIdentityLevel: 1,
          vaultLifecycleState: "OWNER_ACTIVE",
          assignedAssetIds: [],
          assignedRecordIds: [],
          editableAssetIds: [],
          editableRecordIds: [],
          assignedSectionKeys: [],
        });
      }
      setAuthState("ready");
    }

    async function guard() {
      if (!mounted) return;
      try {
        const user = await waitForActiveUser(supabase, { attempts: 6, delayMs: 120 });
        if (!mounted) return;
        if (!user) {
          setIsDemoExperience(false);
          setAuthState("none");
          return;
        }

        let bootstrapDestination = "/onboarding?required=1";
        let onboardingCompleted = true;
        try {
          const bootstrap = await bootstrapAuthenticatedUser(supabase, { userId: user.id });
          bootstrapDestination = bootstrap.destination;
          onboardingCompleted = bootstrap.onboardingComplete;
        } catch {
          onboardingCompleted = false;
        }
        if (!onboardingCompleted) {
          try {
            onboardingCompleted = await hasLinkedAccountAccess(supabase, user.id);
          } catch {
            onboardingCompleted = false;
          }
        }
        if (!mounted) return;
        if (!onboardingCompleted) {
          setAuthState("redirecting");
          router.replace(bootstrapDestination);
          return;
        }

        await hydrateAuthenticatedSession(user);
      } catch {
        if (!mounted) return;
        setAuthState("error");
      }
    }

    void guard();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (!session) {
        if (event === "INITIAL_SESSION") {
          return;
        }
        if (isFinalSignedOutAuthEvent(event)) {
          setViewerAccess(null);
          setIsDemoExperience(false);
          setAuthState("none");
          return;
        }
        void (async () => {
          const confirmedUser = await waitForActiveUser(supabase, { attempts: 2, delayMs: 100 });
          if (!mounted) return;
          if (confirmedUser) {
            await hydrateAuthenticatedSession(confirmedUser);
            return;
          }
          if (!mounted) return;
          setViewerAccess(null);
          setIsDemoExperience(false);
          setAuthState("none");
        })();
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        void hydrateAuthenticatedSession(session.user);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [devSmokeMode, router, setFreshAvatarUrl]);

  useEffect(() => {
    if (effectiveAuthState === "none" && !devSmokeMode) {
      const search = typeof window === "undefined" ? "" : window.location.search;
      router.replace(buildProtectedSignInRedirect(pathname, search));
    }
  }, [effectiveAuthState, devSmokeMode, pathname, router]);

  useEffect(() => {
    let mounted = true;
    if (devSmokeMode) {
      return () => {
        mounted = false;
      };
    }
    if (effectiveAuthState !== "ready") {
      return () => {
        mounted = false;
      };
    }

    async function hydratePreferences() {
      try {
        const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
        if (!mounted || !user) return;
        const ownerUserId = resolvedViewerAccess.targetOwnerUserId || user.id;
        const nextPreferences = await loadVaultPreferences(supabase, ownerUserId);
        if (!mounted) return;
        setVaultPreferences(nextPreferences);
      } catch {
        if (!mounted) return;
        setVaultPreferences(getDefaultVaultPreferences());
      }
    }

    void hydratePreferences();
    return () => {
      mounted = false;
    };
  }, [devSmokeMode, effectiveAuthState, resolvedViewerAccess.targetOwnerUserId]);

  useEffect(() => {
    let mounted = true;
    if (devSmokeMode) {
      return () => {
        mounted = false;
      };
    }
    if (effectiveAuthState !== "ready") {
      return () => {
        mounted = false;
      };
    }

    async function hydrateAccessibility() {
      try {
        const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
        if (!mounted || !user) return;
        const nextPreferences = await loadAccessibilityPreferences(supabase, user.id);
        if (!mounted) return;
        setAccessibilityPreferences(nextPreferences);
      } catch {
        if (!mounted) return;
        setAccessibilityPreferences(getDefaultAccessibilityPreferences());
      }
    }

    void hydrateAccessibility();
    return () => {
      mounted = false;
    };
  }, [devSmokeMode, effectiveAuthState]);

  useEffect(() => {
    if (effectiveAuthState !== "ready" || !viewerAccess || viewerAccess.mode !== "linked") return;
    if (!canViewPath(pathname, viewerAccess)) {
      router.replace("/dashboard");
    }
  }, [effectiveAuthState, pathname, router, viewerAccess]);

  useEffect(() => {
    if (devSmokeMode || typeof window === "undefined") return;

    async function refreshUserChip() {
      const user = await waitForActiveUser(supabase, { attempts: 2, delayMs: 80 });
      if (!user) return;
      const nextEmail = user.email ?? "";
      setEmail(nextEmail);
      await hydrateUserChip(user.id, nextEmail, true, setDisplayName, setInitials, setFreshAvatarUrl);
    }

    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ displayName?: string; avatarUrl?: string }>).detail;
      if (detail?.displayName) {
        setDisplayName(detail.displayName);
        setInitials(makeInitials(detail.displayName));
      }
      if (typeof detail?.avatarUrl === "string") {
        setFreshAvatarUrl(detail.avatarUrl);
      }
      void refreshUserChip();
    };

    window.addEventListener("lf-profile-updated", onProfileUpdated);
    return () => {
      window.removeEventListener("lf-profile-updated", onProfileUpdated);
    };
  }, [devSmokeMode, setFreshAvatarUrl]);

  useEffect(() => {
    appendProfileAvatarTrace(
      `[sidebar-render] image_shown=${renderedAvatarUrl ? "yes" : "no"} reason=${renderedAvatarUrl ? "usable-avatar-url" : "fallback-initials"}`,
    );
  }, [renderedAvatarUrl]);

  useEffect(() => {
    function onDocClick(event: Event) {
      const target = event.target as Node;
      if (!navWrapRef.current?.contains(target)) closeNavigationState("outside_click", false);
    }

    document.addEventListener("pointerdown", onDocClick, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onDocClick, { capture: true });
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

  function navigateBack() {
    closeNavigationState("item_select", false);
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }

  function submitShellSearch() {
    const destination = buildDashboardSearchHref(shellSearch);
    closeNavigationState("item_select", false);
    router.push(destination);
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
    clearStoredLinkedGrantId();
    setIsDemoExperience(false);
    await supabase.auth.signOut();
    router.replace("/sign-in");
  };

  const viewerContextValue = useMemo(
    () => ({
      viewer: resolvedViewerAccess,
      setLinkedGrant: (grantId: string) => {
        setStoredLinkedGrantId(grantId);
        setViewerAccess((current) => current ? { ...current, grantId } : current);
      },
      clearLinkedGrant: () => {
        clearStoredLinkedGrantId();
        setViewerAccess((current) => current
          ? {
              mode: "owner",
              grantId: null,
              sessionUserId: current.sessionUserId,
              targetOwnerUserId: current.sessionUserId,
              accountHolderName: effectiveDisplayName,
              linkedContactId: null,
              linkedContactName: "",
              viewerRole: "owner",
              activationStatus: "active",
              readOnly: false,
              canUpgradeToOwnAccount: false,
              permissionsOverride: {
                allowedSections: [],
                assetIds: [],
                recordIds: [],
                editableAssetIds: [],
                editableRecordIds: [],
                explicitPermissions: [],
              },
              identityAssuranceLevel: 1,
              requiredIdentityLevel: 1,
              vaultLifecycleState: "OWNER_ACTIVE",
              assignedAssetIds: [],
              assignedRecordIds: [],
              editableAssetIds: [],
              editableRecordIds: [],
              assignedSectionKeys: [],
            }
          : current);
        router.push("/dashboard");
      },
    }),
    [effectiveDisplayName, resolvedViewerAccess, router],
  );
  const normalizedPathname = normalizePath(pathname);
  const topbarTitle = normalizedPathname === "/dashboard"
    ? "Dashboard"
    : currentNode?.label ?? "Dashboard";
  const topbarBreadcrumbs = normalizedPathname === "/dashboard" ? [] : breadcrumbs.slice(0, -1);
  const showBackButton = normalizedPathname !== "/dashboard";

  if (effectiveAuthState !== "ready") {
    const sessionTitle = effectiveAuthState === "error"
      ? "Session needs attention"
      : effectiveAuthState === "none"
        ? "Redirecting to sign in"
        : effectiveAuthState === "redirecting"
          ? "Redirecting"
          : "Checking session";
    const sessionMessage = effectiveAuthState === "error"
      ? "We could not validate your session. Please sign in again to continue."
      : effectiveAuthState === "none"
        ? "Taking you back to secure sign in..."
        : effectiveAuthState === "redirecting"
          ? "Taking you to the next required setup step..."
          : "Validating your secure session...";
    return (
      <main className="lf-auth">
        <section className="lf-auth-form-side">
          <div className="lf-auth-card">
            <h1>{sessionTitle}</h1>
            <p className="lf-auth-subtext">{sessionMessage}</p>
            {effectiveAuthState === "error" ? (
              <button className="lf-primary-btn" type="button" onClick={() => router.replace(buildProtectedSignInRedirect(pathname, typeof window === "undefined" ? "" : window.location.search))}>
                Return to sign in
              </button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <ViewerAccessProvider value={viewerContextValue}>
    <AccessibilityPreferencesProvider value={{ preferences: accessibilityPreferences, setPreferences: setAccessibilityPreferences }}>
    <VaultPreferencesProvider value={{ preferences: vaultPreferences, setPreferences: setVaultPreferences }}>
    <div
      className="lf-shell"
      data-lf-text-size={accessibilityPreferences.textSize}
      data-lf-contrast={accessibilityPreferences.contrastMode}
      data-lf-spacing={accessibilityPreferences.spacingMode}
      data-lf-contextual-help={accessibilityPreferences.contextualHelpEnabled ? "true" : "false"}
      data-lf-help-wizard={accessibilityPreferences.helpWizardEnabled ? "true" : "false"}
      data-lf-read-aloud={accessibilityPreferences.readAloudEnabled ? "true" : "false"}
    >
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
              <div className="lf-brand-subtitle">Your secure legacy vault</div>
            </div>
          </div>

          <form
            className="lf-search-wrap"
            onSubmit={(event) => {
              event.preventDefault();
              submitShellSearch();
            }}
            role="search"
            aria-label="Search dashboard records"
          >
            <span className="lf-search-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="M16.5 16.5 21 21" />
              </svg>
            </span>
            <input
              className="lf-search"
              placeholder="Search dashboard records"
              aria-label="Search dashboard records"
              value={shellSearch}
              onChange={(event) => setShellSearchState({ pathname, value: event.target.value })}
            />
          </form>

          <SidebarPrimary
            items={dashboardNavigationItems}
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
              event.preventDefault();
              navigateTo(item.path);
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

            <div className="lf-sidebar-actions">
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
              event.preventDefault();
              navigateTo(item.path);
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
            onActivateItem={(event, item) => {
              event.preventDefault();
              navigateTo(item.path);
            }}
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
            <Breadcrumbs items={topbarBreadcrumbs} />
            <div className="lf-topbar-heading">
              {showBackButton ? (
                <button className="lf-topbar-back" type="button" onClick={navigateBack} aria-label="Go back">
                  <Icon name="arrow_back" size={16} />
                  <span>Back</span>
                </button>
              ) : null}
              <div className="lf-topbar-title">{topbarTitle}</div>
            </div>
          </div>

          <div className="lf-topbar-actions">
            <WorkspaceSwitcher
              currentPathname={pathname}
              compact
              governanceContext="Personal Vault · role-aware workspace switch"
            />
            <div
              className="lf-topbar-security"
              aria-label={
                resolvedViewerAccess.mode === "linked"
                  ? `${getRoleLabel(resolvedViewerAccess.viewerRole)} view-only access`
                  : "Private and secure account"
              }
              title={
                resolvedViewerAccess.mode === "linked"
                  ? `${getRoleLabel(resolvedViewerAccess.viewerRole)} view-only access`
                  : "Private and secure account"
              }
            >
              <Icon name={resolvedViewerAccess.mode === "linked" ? "visibility_lock" : "verified_user"} size={16} />
            </div>
            <Link href="/profile" className="lf-topbar-user" aria-label={`Edit account details for ${effectiveDisplayName}`} title={effectiveDisplayName}>
              <div className="lf-topbar-user-copy">
                <div className="lf-topbar-user-greeting">Hello</div>
                <div className="lf-topbar-user-name">{effectiveDisplayName}</div>
              </div>
              <span
                className="lf-topbar-user-avatar"
                aria-label={`Signed-in account picture for ${effectiveDisplayName}`}
                role="img"
                data-avatar-ready={renderedAvatarUrl ? "true" : "false"}
              >
                {renderedAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="lf-topbar-user-avatar-img" src={renderedAvatarUrl} alt="" aria-hidden="true" />
                ) : null}
                <span className="lf-topbar-user-avatar-fallback">{effectiveInitials || "LF"}</span>
              </span>
            </Link>
          </div>
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
                  <div className="lf-brand-subtitle">Your secure legacy vault</div>
                </div>
              </div>

              <WorkspaceSwitcher
                currentPathname={pathname}
                compact
                alwaysShow
                governanceContext="Mobile navigation · role-aware workspace switch"
              />

              <MobileNavTree
                items={dashboardNavigationItems}
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
                  <span
                    className="lf-user-avatar"
                    aria-label={`Signed-in account picture for ${effectiveDisplayName}`}
                    role="img"
                    data-avatar-ready={renderedAvatarUrl ? "true" : "false"}
                  >
                    {renderedAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="lf-topbar-user-avatar-img" src={renderedAvatarUrl} alt="" aria-hidden="true" />
                    ) : null}
                    <span className="lf-topbar-user-avatar-fallback">{effectiveInitials || "LF"}</span>
                  </span>
                  <div>
                    <div className="lf-user-name">{effectiveDisplayName}</div>
                    <div className="lf-user-email">{effectiveEmail || "Signed in"}</div>
                  </div>
                  <button className="lf-signout" onClick={signOut} type="button">
                    Sign out
                  </button>
                </div>
              </div>
            </aside>
          </>
        ) : null}

        <main className="lf-main-content">
          {isDemoExperience ? (
            <section
              style={{
                border: "1px solid #c7d2fe",
                background: "#eef2ff",
                borderRadius: 14,
                padding: 12,
                marginBottom: 14,
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontWeight: 700 }}>{DEMO_EXPERIENCE_LABEL} · {DEMO_EXPERIENCE_SUBLABEL}</div>
              <div style={{ color: "#475569", fontSize: 13 }}>
                You are viewing synthetic review data in a separate demo account. Admin controls and owner credentials are not part of this session.
              </div>
            </section>
          ) : null}
          {resolvedViewerAccess.mode === "linked" ? (
            <section
              style={{
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                borderRadius: 14,
                padding: 12,
                marginBottom: 14,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", minWidth: 0 }}>
                <span
                  aria-label={`Estate owner initials for ${resolvedViewerAccess.accountHolderName}`}
                  role="img"
                  style={linkedOwnerAvatarStyle}
                >
                  {makeInitials(resolvedViewerAccess.accountHolderName)}
                </span>
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                    Estate owner context
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    Viewing {resolvedViewerAccess.accountHolderName}&apos;s estate records
                  </div>
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    Signed-in reviewer: {resolvedViewerAccess.linkedContactName || effectiveDisplayName} · Role: {getRoleLabel(resolvedViewerAccess.viewerRole)} · View-only unless the owner grants specific edit access.
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    This linked view does not replace your own account. If you want your own private estate record, you can start one separately at any time.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="lf-link-btn" onClick={() => viewerContextValue.clearLinkedGrant()}>
                  Return to my own account
                </button>
                <Link href="/onboarding" className="lf-primary-btn">
                  Start your own secure account
                </Link>
              </div>
            </section>
          ) : null}
          {children}
        </main>
      </div>
    </div>
    </VaultPreferencesProvider>
    </AccessibilityPreferencesProvider>
    </ViewerAccessProvider>
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

async function hydrateUserChip(
  userId: string,
  email: string,
  mounted: boolean,
  setDisplayName: (value: string) => void,
  setInitials: (value: string) => void,
  setAvatarUrl: (value: string) => void,
) {
  const serverProfile = await loadServerProfileIdentityChip(email);
  const fallbackProfile = !serverProfile?.avatarUrl
    ? await loadProfileIdentityChip(supabase, { userId, email }).catch(() => null)
    : null;
  const profile = {
    displayName: serverProfile?.displayName || fallbackProfile?.displayName || resolveProfileIdentityDisplayName("", email),
    avatarUrl: serverProfile?.avatarUrl || fallbackProfile?.avatarUrl || "",
    telephone: serverProfile?.telephone || fallbackProfile?.telephone || "",
  };
  if (!mounted) return;
  appendProfileAvatarTrace(
    `[preview-url] source=sidebar resolved=${profile.avatarUrl ? "yes" : "no"} reason=${profile.avatarUrl ? "signed-url-created" : "signed-url-missing"} url=${maskAvatarUrl(profile.avatarUrl)}`,
  );
  appendProfileAvatarTrace(
    `[sidebar-hydrate] user=${userId} display=${profile.displayName || "<none>"} avatar_url=${maskAvatarUrl(profile.avatarUrl)}`,
  );
  setDisplayName(profile.displayName);
  setInitials(makeInitials(profile.displayName));
  const stableAvatarUrl = await loadServerProfileAvatarDataUrl();
  if (stableAvatarUrl) {
    appendProfileAvatarTrace("[sidebar-hydrate] stable_avatar_url=resolved");
    setAvatarUrl(stableAvatarUrl);
    return;
  }

  if (profile.avatarUrl) {
    appendProfileAvatarTrace("[sidebar-hydrate] signed_avatar_url=used_as_fallback");
    setAvatarUrl(profile.avatarUrl);
    return;
  }

  appendProfileAvatarTrace("[sidebar-hydrate] avatar_preserved=empty_lookup");
}

function readShellSearchFromLocation(pathname: string) {
  if (typeof window === "undefined" || normalizePath(pathname) !== "/dashboard") return "";
  return new URLSearchParams(window.location.search).get("search") ?? "";
}

function readCachedProfileAvatarUrl() {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(PROFILE_AVATAR_CACHE_KEY) ?? "";
  } catch {
    return "";
  }
}

function cacheProfileAvatarUrl(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROFILE_AVATAR_CACHE_KEY, value);
  } catch {
    // Session storage can reject large data URLs. The in-memory state still holds the avatar.
  }
}

async function loadServerProfileIdentityChip(email: string) {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token ?? "";
    if (!token) return null;

    const response = await fetch("/api/profile/identity-chip", {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      displayName?: string;
      avatarUrl?: string;
      telephone?: string;
    } | null;
    if (!payload?.ok) return null;

    return {
      displayName: payload.displayName?.trim() || resolveProfileIdentityDisplayName("", email),
      avatarUrl: payload.avatarUrl ?? "",
      telephone: payload.telephone ?? "",
    };
  } catch {
    return null;
  }
}

async function loadServerProfileAvatarDataUrl() {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token ?? "";
    if (!token) return "";

    const response = await fetch("/api/profile/avatar", {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return "";
    const blob = await response.blob();
    if (!blob.size) return "";
    return await blobToDataUrl(blob);
  } catch {
    return "";
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

function toFriendlyPathLabel(segment: string) {
  const cleaned = segment.trim();
  if (!cleaned) return "Untitled record";

  // Hide internal IDs in breadcrumb/title fallbacks for dynamic detail routes.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) {
    return "Untitled record";
  }

  if (/^[A-Za-z0-9_-]{20,}$/.test(cleaned)) {
    return "Untitled record";
  }

  return cleaned.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripNavigationChildren(items: NavNode[]): NavNode[] {
  return items.map((item) => ({
    ...item,
    children: [],
  }));
}

const linkedOwnerAvatarStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: "1px solid #cbd5e1",
  background: "#e2e8f0",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 800,
  flexShrink: 0,
};
