#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestFile = path.join(root, "config/routeManifest.tsx");
const appDir = path.join(root, "app");

const manifest = fs.readFileSync(manifestFile, "utf8");
const paths = Array.from(manifest.matchAll(/path:\s*"([^"]+)"/g)).map((m) => m[1]);
const uniquePaths = Array.from(new Set(paths)).sort();

const pageFiles = walk(appDir).filter((file) => file.endsWith("/page.tsx"));
const routeMap = pageFiles.map((file) => {
  const rel = file.replace(appDir, "").replace(/\/page\.tsx$/, "") || "/";
  return { route: toUrlPath(rel), file: path.relative(root, file) };
});
const explicit = routeMap.filter((entry) => !entry.route.includes("["));
const dynamic = routeMap
  .filter((entry) => entry.route.includes("["))
  .sort((a, b) => (a.route.includes("[[...slug]]") ? 1 : 0) - (b.route.includes("[[...slug]]") ? 1 : 0));

const rows = uniquePaths.map((href) => {
  const explicitRow = explicit.find((entry) => entry.route === href);
  const explicitMatch = Boolean(explicitRow);
  const dynamicRow = !explicitMatch ? dynamic.find((entry) => matchesDynamic(entry.route, href)) : null;
  const dynamicMatch = Boolean(dynamicRow);
  const status = explicitMatch || dynamicMatch ? "implemented" : "missing";
  const file = explicitMatch ? explicitRow.file : dynamicMatch ? dynamicRow.file : "n/a";
  return {
    label: labelFromPath(href),
    source: "config/routeManifest.tsx",
    href,
    pageFile: file,
    implemented: status,
    mobile: "responsive",
  };
});

const lines = [];
lines.push("# Route Matrix");
lines.push("");
lines.push("| Label | Source component | Href | Expected page file | Implemented status | Mobile status |");
lines.push("|---|---|---|---|---|---|");
for (const row of rows) {
  lines.push(
    `| ${escapePipe(row.label)} | ${row.source} | ${row.href} | ${escapePipe(row.pageFile)} | ${row.implemented} | ${row.mobile} |`,
  );
}

const out = path.join(root, "docs/route-matrix.md");
fs.writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${out}`);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function matchesDynamic(pattern, target) {
  if (pattern.includes("[[...slug]]")) return true;
  const p = pattern.split("/").filter(Boolean);
  const t = target.split("/").filter(Boolean);
  if (p.length !== t.length) return false;
  for (let i = 0; i < p.length; i += 1) {
    const part = p[i];
    if (part.startsWith("[") && part.endsWith("]")) continue;
    if (part !== t[i]) return false;
  }
  return true;
}

function labelFromPath(route) {
  const part = route.split("/").filter(Boolean).at(-1) || "Home";
  return part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toUrlPath(route) {
  const clean = route
    .split("/")
    .filter(Boolean)
    .filter((part) => !(part.startsWith("(") && part.endsWith(")")))
    .join("/");
  return clean ? `/${clean}` : "/";
}

function escapePipe(value) {
  return String(value).replace(/\|/g, "\\|");
}
