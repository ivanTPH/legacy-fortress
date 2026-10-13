import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const iconSource = fs.readFileSync(path.join(root, "components/ui/Icon.tsx"), "utf8");
const navSource = fs.readFileSync(path.join(root, "app/(app)/components/NavIcons.tsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

test("customer icon system uses the approved Material Symbols vocabulary", () => {
  for (const name of ["space_dashboard", "gavel", "home", "work", "devices", "inventory_2", "group", "key", "help", "settings"]) {
    assert.match(iconSource, new RegExp(`(?:\\\"|')${name}(?:\\\"|')`), name);
  }
  assert.match(iconSource, /material-symbols-rounded/);
  assert.match(iconSource, /fontVariationSettings/);
  assert.match(cssSource, /font-family: \"Material Symbols Rounded\"/);
});

test("customer navigation maps to the approved icon identifiers", () => {
  for (const name of ["space_dashboard", "group", "gavel", "home", "work", "key", "help"]) {
    assert.match(navSource, new RegExp(`name=\\\"${name}\\\"`), name);
  }
});
