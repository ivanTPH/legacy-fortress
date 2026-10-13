import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("responsive shared rules protect the shell, drawers, admin and narrow dashboard", () => {
  const css = read("app/globals.css");
  assert.match(css, /max-width: 100vw/);
  assert.match(css, /\.lf-person-drawer,\s*\.lf-action-centre-drawer/);
  assert.match(css, /\.lf-dashboard-overview-grid\s*\{\s*grid-template-columns: 1fr !important/);
  assert.match(css, /\.lf-admin-shell-content,\s*\.lf-admin-prototype-content/);
});

test("mobile task surfaces use calm actions and progressive guidance", () => {
  const css = read("app/globals.css");
  const requests = read("components/access-requests/AccessRequestsWorkspace.tsx");
  assert.match(css, /\.lf-action-centre-row-actions > button/);
  assert.match(css, /background: transparent !important/);
  assert.match(requests, /How access requests work/);
});

test("finance loading never presents an unresolved zero", () => {
  const finances = read("app/(app)/finances/page.tsx");
  assert.match(finances, /loading \? "Loading your finances\.\.\."/);
  assert.match(finances, /className="lf-loading-note"/);
});

test("Vault settings use customer language", () => {
  const settings = read("app/(app)/account/my-vault/page.tsx");
  assert.match(settings, /Choose what appears in your Vault/);
  assert.match(settings, /areas shown/);
  assert.doesNotMatch(settings, /category groups visible/);
});
