import test from "node:test";
import assert from "node:assert/strict";
import { getFlyoutMenuKeyAction, getTopMenuKeyAction } from "../lib/navigation/menuKeyActions.js";

test("top menu actions: arrow keys and enter", () => {
  assert.equal(getTopMenuKeyAction({ key: "ArrowDown", hasChildren: false }), "focus-next");
  assert.equal(getTopMenuKeyAction({ key: "ArrowUp", hasChildren: false }), "focus-prev");
  assert.equal(getTopMenuKeyAction({ key: "ArrowRight", hasChildren: true }), "open-primary");
  assert.equal(getTopMenuKeyAction({ key: "Enter", hasChildren: false }), "navigate");
  assert.equal(getTopMenuKeyAction({ key: " ", hasChildren: false }), "navigate");
  assert.equal(getTopMenuKeyAction({ key: "Escape", hasChildren: false }), "close-all");
});

test("top menu actions: enter/space with children opens submenu", () => {
  assert.equal(getTopMenuKeyAction({ key: "Enter", hasChildren: true }), "open-primary");
  assert.equal(getTopMenuKeyAction({ key: " ", hasChildren: true }), "open-primary");
});

test("flyout menu actions level 2", () => {
  assert.equal(getFlyoutMenuKeyAction({ key: "ArrowRight", hasChildren: true, level: 2 }), "open-secondary");
  assert.equal(getFlyoutMenuKeyAction({ key: "Enter", hasChildren: true, level: 2 }), "open-secondary");
  assert.equal(getFlyoutMenuKeyAction({ key: "Enter", hasChildren: false, level: 2 }), "navigate");
  assert.equal(getFlyoutMenuKeyAction({ key: "Escape", hasChildren: false, level: 2 }), "close-all");
});

test("flyout menu actions level 3", () => {
  assert.equal(getFlyoutMenuKeyAction({ key: "Escape", hasChildren: false, level: 3 }), "close-secondary");
  assert.equal(getFlyoutMenuKeyAction({ key: "Enter", hasChildren: false, level: 3 }), "navigate");
  assert.equal(getFlyoutMenuKeyAction({ key: "ArrowRight", hasChildren: false, level: 3 }), "none");
});

