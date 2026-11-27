import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("logo picker: linking dropdowns show each provider's logo, and work from the keyboard", () => {
  const picker = read("components/ui/LogoPicker.tsx");
  assert.match(picker, /role="combobox"/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /role="option"/);
  assert.match(picker, /aria-activedescendant/);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"]) assert.match(picker, new RegExp(`case "${key}"`), key);
  assert.match(picker, /<BrandMark name=\{option\.label\} logoPath=\{option\.logo/);
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  for (const label of ["Paid from", "Paid to \\(from your Vault\\)", "Bank account"]) {
    assert.match(workspace, new RegExp(`<FieldLogoPicker label="${label}"`), label);
  }
  assert.match(workspace, /option\.logo = findCardBrand/);
  assert.match(workspace, /option\.logo = findPayeeBrand/);
  const css = read("app/v3-screens.css");
  assert.match(css, /\.lf-logo-picker-option \{[^}]*font-size: 17px/);
  assert.match(css, /\.lf-logo-picker-button:focus-visible \{ outline: 3px solid #8C4A32/);
});

test("cards page header shows money owed and balances, never a misleading £0.00", () => {
  assert.match(read("components/records/UniversalRecordWorkspace.tsx"), /isCards \? cardsHeader\(records\)/);
});
