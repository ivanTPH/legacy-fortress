import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = fs.readFileSync(path.join(root, "config/routeManifest.tsx"), "utf8");
const navPaths = Array.from(manifest.matchAll(/path:\s*"([^"]+)"/g)).map((m) => m[1]);
const uniqueNavPaths = Array.from(new Set(navPaths));

const appRoot = path.join(root, "app");
const pageFiles = walk(appRoot).filter((file) => file.endsWith("/page.tsx"));
const pageRoutes = pageFiles.map((file) => toUrlPath(file.replace(appRoot, "").replace(/\/page\.tsx$/, "") || "/"));
const explicitRoutes = new Set(pageRoutes.filter((route) => !route.includes("[")));
const dynamicRoutes = pageRoutes.filter((route) => route.includes("["));

test("all visible routes in manifest are implemented explicitly or by dynamic page", () => {
  const missing = uniqueNavPaths.filter((route) => {
    if (explicitRoutes.has(route)) return false;
    return !dynamicRoutes.some((pattern) => matchesDynamic(pattern, route));
  });
  assert.deepEqual(missing, []);
});

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function toUrlPath(route) {
  const clean = route
    .split("/")
    .filter(Boolean)
    .filter((part) => !(part.startsWith("(") && part.endsWith(")")))
    .join("/");
  return clean ? `/${clean}` : "/";
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

