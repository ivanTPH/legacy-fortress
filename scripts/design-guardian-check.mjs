import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const authority = path.join(root, "design/brand-guardian");
const manifest = JSON.parse(fs.readFileSync(path.join(authority, "DESIGN_SOURCE_MANIFEST.json"), "utf8"));

for (const entry of manifest.files) {
  const file = path.join(authority, entry.path);
  assert.equal(fs.existsSync(file), true, `missing governed design source: ${entry.path}`);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  assert.equal(hash, entry.sha256, `design source checksum changed: ${entry.path}`);
}

const iconSource = fs.readFileSync(path.join(root, "components/ui/Icon.tsx"), "utf8");
const navSource = fs.readFileSync(path.join(root, "app/(app)/components/NavIcons.tsx"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
const financeSource = fs.readFileSync(path.join(root, "app/(app)/finances/page.tsx"), "utf8");
const sidebarSource = fs.readFileSync(path.join(root, "app/(app)/components/navigation/SidebarPrimary.tsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

for (const identifier of ["space_dashboard", "add_circle", "task_alt", "account_balance_wallet", "gavel", "home", "work", "devices", "inventory_2", "group", "key", "help", "settings"]) {
  assert.match(iconSource, new RegExp(identifier), `missing canonical icon mapping: ${identifier}`);
}
assert.match(iconSource, /material-symbols-rounded/);
assert.doesNotMatch(iconSource, /material-symbols-outlined/);
assert.match(cssSource, /font-family: "Material Symbols Rounded"/);
assert.match(navSource, /space_dashboard/);
assert.doesNotMatch(dashboardSource, /plus button/i);
assert.doesNotMatch(dashboardSource, /Your Fortress Records/);
assert.doesNotMatch(dashboardSource, /Search dashboard records/);
assert.match(financeSource, /lf-finance-section-card/);
assert.match(financeSource, /lf-finance-empty-tile/);
assert.doesNotMatch(financeSource, /DashboardAssetSummaryCard/);
assert.match(sidebarSource, /lf-nav-group-label/);

for (const forbidden of ["lucide-react", "@heroicons", "react-icons"]) {
  const files = ["components/ui/Icon.tsx", "app/(app)/components/NavIcons.tsx", "components/ui/LFDesignSystem.tsx"];
  for (const relative of files) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, relative), "utf8"), new RegExp(forbidden), `legacy icon library in governed component: ${forbidden}`);
  }
}

console.log(`Design Guardian PASS: ${manifest.files.length} source checksums, canonical icon map, governed copy and component-library checks passed.`);
