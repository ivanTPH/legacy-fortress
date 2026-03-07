import test from "node:test";
import assert from "node:assert/strict";

import { initialMenuState, menuReducer } from "../lib/navigation/menuState.ts";

test("menuReducer toggles primary and collapses secondary deterministically", () => {
  let state = initialMenuState;
  state = menuReducer(state, { type: "toggle_primary", id: "legal", top: 120 });
  assert.equal(state.openPrimaryId, "legal");
  assert.equal(state.openSecondaryId, null);
  assert.equal(state.level2Top, 120);

  state = menuReducer(state, { type: "toggle_secondary", id: "wills", top: 130 });
  assert.equal(state.openSecondaryId, "wills");
  assert.equal(state.level3Top, 130);

  state = menuReducer(state, { type: "collapse_secondary" });
  assert.equal(state.openPrimaryId, "legal");
  assert.equal(state.openSecondaryId, null);
});

test("menuReducer close_all clears open chain and optionally closes mobile state", () => {
  let state = {
    ...initialMenuState,
    openPrimaryId: "legal",
    openSecondaryId: "wills",
    mobileNavOpen: true,
    mobileExpandedIds: new Set(["legal"]),
  };

  state = menuReducer(state, { type: "close_all", reason: "outside_click", closeMobile: false });
  assert.equal(state.openPrimaryId, null);
  assert.equal(state.openSecondaryId, null);
  assert.equal(state.mobileNavOpen, true);

  state = menuReducer(state, { type: "close_all", reason: "route_change" });
  assert.equal(state.mobileNavOpen, false);
  assert.equal(state.mobileExpandedIds.size, 0);
});
