import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAppearancePreference,
  normalizeAppearancePreference,
  readAppearancePreference,
  saveAppearancePreference,
} from "../lib/appearancePreference.ts";

test("appearance choice is device-local and Automatic restores the OS theme", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const storage = new Map();
  const root = {
    dataset: {},
    removeAttribute(key) { if (key === "data-theme") delete this.dataset.theme; },
  };
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  globalThis.document = { documentElement: root };
  try {
    assert.equal(normalizeAppearancePreference("invalid"), "automatic");
    assert.equal(readAppearancePreference(), "automatic");
    saveAppearancePreference("dark");
    assert.equal(readAppearancePreference(), "dark");
    assert.equal(root.dataset.theme, "dark");
    saveAppearancePreference("automatic");
    assert.equal(root.dataset.theme, undefined);
    applyAppearancePreference("light");
    assert.equal(root.dataset.theme, "light");
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
