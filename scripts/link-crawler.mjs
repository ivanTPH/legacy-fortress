#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");

const pageFiles = walk(appDir).filter((file) => file.endsWith("/page.tsx"));
const routes = pageFiles.map((file) => toRoute(file));
const explicit = routes.filter((route) => !route.includes("["));
const dynamic = routes.filter((route) => route.includes("["));

const sourceFiles = walk(path.join(root, "app"))
  .concat(walk(path.join(root, "components")))
  .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"));

const hrefPattern = /href\s*=\s*["'`]([^"'`]+)["'`]/g;
const links = [];

for (const file of sourceFiles) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(hrefPattern)) {
    links.push({ file: rel, href: match[1] });
  }
}

const internal = links.filter((item) => item.href.startsWith("/"));
const unresolved = [];

for (const item of internal) {
  const href = normalize(item.href);
  if (explicit.includes(href)) continue;
  if (dynamic.some((pattern) => matchesDynamic(pattern, href))) continue;
  unresolved.push({ ...item, href });
}

console.log("Internal Link Crawl");
console.log("===================");
console.log(`Pages: ${routes.length}`);
console.log(`Links scanned: ${internal.length}`);
console.log(`Broken links: ${unresolved.length}`);

if (unresolved.length) {
  console.log("\nBroken internal links:");
  for (const row of unresolved) {
    console.log(`- ${row.href} (${row.file})`);
  }
  process.exitCode = 1;
}

function normalize(route) {
  if (route === "/") return "/";
  return route.endsWith("/") ? route.slice(0, -1) : route;
}

function toRoute(file) {
  const rel = file.replace(appDir, "").replace(/\/page\.tsx$/, "");
  const clean = rel
    .split("/")
    .filter(Boolean)
    .filter((part) => !(part.startsWith("(") && part.endsWith(")")))
    .join("/");
  return clean === "" ? "/" : `/${clean}`;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function matchesDynamic(pattern, target) {
  const p = pattern.split("/").filter(Boolean);
  const t = target.split("/").filter(Boolean);

  if (pattern.includes("[[...slug]]")) return true;
  if (p.length !== t.length) return false;

  for (let i = 0; i < p.length; i += 1) {
    const part = p[i];
    if (part.startsWith("[") && part.endsWith("]")) continue;
    if (part !== t[i]) return false;
  }
  return true;
}
