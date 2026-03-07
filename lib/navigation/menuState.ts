export type MenuCloseReason =
  | "item_select"
  | "outside_click"
  | "escape"
  | "route_change"
  | "breakpoint_change"
  | "focus_leave"
  | "parent_collapse";

export type MenuState = {
  openPrimaryId: string | null;
  openSecondaryId: string | null;
  level2Top: number;
  level3Top: number;
  mobileNavOpen: boolean;
  mobileExpandedIds: Set<string>;
  lastClosedAt: number;
};

export type MenuAction =
  | { type: "toggle_primary"; id: string; top?: number | null }
  | { type: "toggle_secondary"; id: string; top?: number | null }
  | { type: "collapse_secondary" }
  | { type: "close_all"; reason: MenuCloseReason; closeMobile?: boolean }
  | { type: "toggle_mobile_nav" }
  | { type: "set_mobile_nav"; open: boolean }
  | { type: "toggle_mobile_expand"; id: string };

export const initialMenuState: MenuState = {
  openPrimaryId: null,
  openSecondaryId: null,
  level2Top: 80,
  level3Top: 80,
  mobileNavOpen: false,
  mobileExpandedIds: new Set<string>(),
  lastClosedAt: 0,
};

export function menuReducer(state: MenuState, action: MenuAction): MenuState {
  switch (action.type) {
    case "toggle_primary": {
      if (state.openPrimaryId === action.id) {
        return {
          ...state,
          openPrimaryId: null,
          openSecondaryId: null,
          lastClosedAt: Date.now(),
        };
      }
      return {
        ...state,
        openPrimaryId: action.id,
        openSecondaryId: null,
        level2Top: typeof action.top === "number" ? action.top : state.level2Top,
      };
    }

    case "toggle_secondary": {
      if (state.openSecondaryId === action.id) {
        return {
          ...state,
          openSecondaryId: null,
          lastClosedAt: Date.now(),
        };
      }
      return {
        ...state,
        openSecondaryId: action.id,
        level3Top: typeof action.top === "number" ? action.top : state.level3Top,
      };
    }

    case "collapse_secondary":
      return {
        ...state,
        openSecondaryId: null,
        lastClosedAt: Date.now(),
      };

    case "close_all": {
      return {
        ...state,
        openPrimaryId: null,
        openSecondaryId: null,
        mobileNavOpen: action.closeMobile === false ? state.mobileNavOpen : false,
        mobileExpandedIds: action.closeMobile === false ? state.mobileExpandedIds : new Set<string>(),
        lastClosedAt: Date.now(),
      };
    }

    case "toggle_mobile_nav":
      return {
        ...state,
        mobileNavOpen: !state.mobileNavOpen,
      };

    case "set_mobile_nav":
      return {
        ...state,
        mobileNavOpen: action.open,
      };

    case "toggle_mobile_expand": {
      const next = new Set(state.mobileExpandedIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return {
        ...state,
        mobileExpandedIds: next,
      };
    }

    default:
      return state;
  }
}
