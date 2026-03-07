#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const navFile = path.join(root, "config/routeManifest.tsx");
const appRoot = path.join(root, "app/(app)");

const navSource = fs.readFileSync(navFile, "utf8");
const navPaths = Array.from(navSource.matchAll(/path:\s*"([^"]+)"/g)).map((m) => m[1]);
const uniqueNavPaths = Array.from(new Set(navPaths)).sort();

const pageFiles = walk(appRoot).filter((file) => file.endsWith("/page.tsx"));
const pageRoutes = pageFiles
  .map((file) => file.replace(appRoot, ""))
  .map((file) => file.replace(/\/page\.tsx$/, ""))
  .map((route) => (route === "" ? "/" : route));

const explicitRoutes = new Set(
  pageRoutes.filter((route) => !route.includes("[")),
);
const dynamicRoutes = pageRoutes.filter((route) => route.includes("[") && !route.includes("[[...slug]]"));

const hasCatchAll = pageFiles.some((file) => file.includes("[[...slug]]/page.tsx"));

const results = uniqueNavPaths.map((route) => {
  const explicit = explicitRoutes.has(route);
  const dynamic = !explicit && dynamicRoutes.some((pattern) => matchesDynamicRoute(pattern, route));
  const coveredByCatchAll = !explicit && !dynamic && hasCatchAll && !route.startsWith("/vault/") && !route.startsWith("/account/");
  return {
    route,
    explicit,
    dynamic,
    coveredByCatchAll,
    status: explicit ? "explicit" : dynamic ? "dynamic" : coveredByCatchAll ? "catch-all" : "missing",
  };
});

const missing = results.filter((item) => item.status === "missing");
const catchAllOnly = results.filter((item) => item.status === "catch-all");

console.log("Legacy Fortress Route Audit");
console.log("===========================");
console.log(`Navigation paths: ${uniqueNavPaths.length}`);
console.log(`Explicit page routes: ${explicitRoutes.size}`);
console.log(`Catch-all enabled: ${hasCatchAll ? "yes" : "no"}`);
console.log("");
console.log(`Explicitly mapped: ${results.filter((item) => item.status === "explicit").length}`);
console.log(`Dynamic route mapped: ${results.filter((item) => item.status === "dynamic").length}`);
console.log(`Catch-all backed: ${catchAllOnly.length}`);
console.log(`Missing: ${missing.length}`);

if (missing.length) {
  console.log("\nMissing routes:");
  for (const item of missing) console.log(`- ${item.route}`);
}

if (catchAllOnly.length) {
  console.log("\nCatch-all only routes (functional but generic):");
  for (const item of catchAllOnly) console.log(`- ${item.route}`);
}

function matchesDynamicRoute(pattern, route) {
  const patternParts = pattern.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  if (patternParts.length !== routeParts.length) return false;

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const routePart = routeParts[index];
    if (patternPart.startsWith("[") && patternPart.endsWith("]")) continue;
    if (patternPart !== routePart) return false;
  }
  return true;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
