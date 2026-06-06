import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultAccessibilityPreferences,
  normalizeAccessibilityPreferences,
} from "../lib/accessibilityPreferences.ts";

test("accessibility preferences default safely", () => {
  assert.deepEqual(getDefaultAccessibilityPreferences(), {
    textSize: "default",
    contrastMode: "default",
    spacingMode: "default",
    contextualHelpEnabled: true,
    helpWizardEnabled: false,
    readAloudEnabled: false,
  });
});

test("accessibility preferences normalize supported values only", () => {
  assert.deepEqual(
    normalizeAccessibilityPreferences({
      textSize: "xlarge",
      contrastMode: "high",
      spacingMode: "comfortable",
      contextualHelpEnabled: false,
      helpWizardEnabled: true,
      readAloudEnabled: true,
    }),
    {
      textSize: "xlarge",
      contrastMode: "high",
      spacingMode: "comfortable",
      contextualHelpEnabled: false,
      helpWizardEnabled: true,
      readAloudEnabled: true,
    },
  );
});

test("contextual help remains enabled unless explicitly disabled", () => {
  assert.equal(normalizeAccessibilityPreferences({}).contextualHelpEnabled, true);
  assert.equal(normalizeAccessibilityPreferences({ contextualHelpEnabled: true }).contextualHelpEnabled, true);
  assert.equal(normalizeAccessibilityPreferences({ contextualHelpEnabled: false }).contextualHelpEnabled, false);
});
