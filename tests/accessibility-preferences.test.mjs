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
      helpWizardEnabled: true,
      readAloudEnabled: true,
    }),
    {
      textSize: "xlarge",
      contrastMode: "high",
      spacingMode: "comfortable",
      helpWizardEnabled: true,
      readAloudEnabled: true,
    },
  );
});
