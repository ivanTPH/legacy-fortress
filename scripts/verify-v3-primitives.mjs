import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { chromium, webkit } from "@playwright/test";

// Compile the actual TSX components for a local visual fixture. No app route,
// auth service, or hosted URL is used by this browser check.
const nodeRequire = createRequire(import.meta.url);
const webpack = nodeRequire("next/dist/compiled/webpack/webpack").webpack;
mkdirSync(resolve(".next/v3-preview"), { recursive: true });
const loaderPath = resolve(".next/v3-preview/tsx-loader.cjs");
writeFileSync(loaderPath, 'const ts=require("typescript"); module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},fileName:this.resourcePath}).outputText};');
const bundlePath = resolve(".next/v3-preview/bundle.js");
await new Promise((resolveBuild, rejectBuild) => webpack({
  mode: "development",
  target: "web",
  entry: resolve("scripts/v3-preview-interactions.tsx"),
  output: { path: resolve(".next/v3-preview"), filename: "bundle.js" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "next/link$": resolve("scripts/v3-preview-link.tsx") } },
  module: { rules: [{ test: /\.tsx?$/, use: [{ loader: loaderPath }] }] },
  devtool: false,
}, (error, stats) => error || stats?.hasErrors() ? rejectBuild(error ?? new Error(stats?.toString({ all: false, errors: true }))) : resolveBuild()));
const interactiveBundle = readFileSync(bundlePath);
function loadTsx(file, overrides = {}) {
  const filename = resolve(file);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(resolve("components/ui"));
  compiled.require = (request) => overrides[request] ?? nodeRequire(request);
  compiled._compile(output, filename);
  return compiled.exports;
}

const iconModule = loadTsx("components/ui/Icon.tsx");
const ui = loadTsx("components/ui/V3Primitives.tsx", { "./Icon": iconModule });
const css = readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', "") + readFileSync("app/v3-primitives.css", "utf8");
const font = readFileSync("public/fonts/material-symbols-rounded.woff2");
const origin = "http://127.0.0.1:3012";
const Button = ui.Button;
function contrastRatio(a, b) {
  const channels = (hex) => hex.match(/[\da-f]{2}/gi).map((part) => { const value = parseInt(part, 16) / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  const luminance = (hex) => channels(hex).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const first = luminance(a); const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
assert.ok(contrastRatio("6b5f5a", "ffffff") >= 4.5, "secondary text contrast");

function gallery() {
  return h("div", { className: "lf-shell", "data-lf-text-size": "default", "data-lf-contrast": "default", "data-lf-spacing": "default", style: { display: "block", minHeight: "100vh" } },
    h(ui.ContextBanner, { owner: "Sample Owner", role: "Executor", access: "View only", switchHref: "#vault" }),
    h("main", { className: "v3-preview" },
      h(ui.PageHeader, { title: "Shared primitives", description: "Version 3 foundation components at desktop and mobile widths.", action: h(Button, { variant: "primary", icon: "add" }, "Add record") }, h(ui.Breadcrumb, { items: [{ label: "Finances", href: "#finances" }, { label: "Banks" }], backHref: "#finances", backLabel: "Finances" })),
      h("div", { className: "v3-preview-grid" },
        h(ui.Card, { className: "v3-preview-card" }, h("h2", null, "Buttons and status"), h("div", { className: "v3-preview-inline" }, h(Button, { variant: "primary", icon: "person_add" }, "Add person"), h(Button, { variant: "secondary", icon: "edit" }, "Edit"), h(Button, { variant: "text" }, "Learn more"), h(Button, { variant: "icon", icon: "send", label: "Send invitation" })), h("div", { className: "v3-preview-inline" }, h(ui.Chip, { tone: "neutral", icon: "schedule_send" }, "Not invited"), h(ui.Chip, { tone: "warning", icon: "hourglass_top" }, "Awaiting acceptance"), h(ui.Chip, { tone: "success", icon: "check_circle" }, "Verified"), h(ui.Chip, { tone: "danger", icon: "error" }, "Needs attention")), h("div", { className: "v3-preview-inline" }, h("span", null, "Area visible"), h(ui.Switch, { checked: true, onCheckedChange: () => {}, label: "Area visible" }), h("span", null, "Section visible"), h(ui.Switch, { checked: false, small: true, onCheckedChange: () => {}, label: "Section visible" }))),
        h(ui.Card, { className: "v3-preview-card" }, h("h2", null, "Rows and states"), h(ui.Row, { icon: "account_balance", title: "Bank account", description: "Updated 17 Jul 2026", trailing: "£76,213.00", href: "#record" }), h(ui.Row, { icon: "history_edu", title: "Will", description: "One document", href: "#will" }), h(ui.RestrictedState, { title: "Records not shared", reason: "Names and values are hidden.", action: h(Button, { variant: "text" }, "Request access") })),
        h(ui.Card, { className: "v3-preview-card" }, h("h2", null, "Progress"), h(ui.Stepper, { steps: ["Invitation", "Account", "Verify", "Linked"], current: 1 }), h(ui.Stepper, { steps: ["Basics", "Details", "Documents", "Review"], current: 1, variant: "rail" }), h(ui.Timeline, { items: [{ title: "Death reported", status: "done" }, { title: "Evidence being reviewed", status: "current" }, { title: "Authority confirmed", status: "todo" }, { title: "Access granted", status: "locked" }] })),
        h(ui.Card, { className: "v3-preview-card" }, h("h2", null, "Notices and context"), h(ui.Banner, { tone: "neutral", title: "Information" }, "Your access is set by the account owner."), h(ui.Banner, { tone: "warning", title: "Pending" }, "A decision is still required."), h(ui.Banner, { tone: "danger", title: "Action needed" }, "Check this request before continuing."), h(ui.ContextSwitcher, { label: "Personal Vault", selectedId: "personal", groups: [{ title: "Your Fortress", options: [{ id: "personal", label: "Personal Vault" }] }, { title: "Linked to you", options: [{ id: "linked", label: "Sample Owner", detail: "Executor · View only" }] }], onSelect: () => {} })),
        h(ui.Card, { className: "v3-preview-card" }, h(ui.EmptyState, { title: "No requests waiting", description: "New requests will appear here.", action: h(Button, { variant: "secondary" }, "Go to my Vault") })),
      ),
    ),
    h(ui.Toast, { open: true, message: "Changes saved", tone: "success", actionLabel: "Undo", onAction: () => {}, onClose: () => {}, duration: 0 }),
  );
}

const galleryMarkup = renderToStaticMarkup(gallery());
const sheetMarkup = renderToStaticMarkup(h("div", { className: "lf-shell", style: { display: "block", minHeight: "100vh" } }, h("main", { className: "v3-preview" }, h(ui.PageHeader, { title: "People I Trust", description: "Manage the people connected to your Fortress." }), h(ui.Card, { className: "v3-preview-card" }, h(ui.Row, { icon: "group", title: "Sample Person", description: "Family · No vault access", href: "#person" }))), h(ui.Sheet, { open: true, title: "Sample Person", onClose: () => {}, footer: h(Button, { variant: "primary" }, "Give access") }, h(ui.Chip, { tone: "warning" }, "Not invited"), h("p", null, "Choose what this person can see after the access decision is approved."), h(ui.Stepper, { steps: ["Prepared", "Sent", "Accepted", "Verified", "Linked"], current: 0 }))));
assert.match(galleryMarkup, /role="switch"/);
assert.match(galleryMarkup, /aria-label="Send invitation"/);
assert.match(sheetMarkup, /aria-modal="true"/);

const previewCss = `.v3-preview{max-width:960px;margin:0 auto;padding:32px 40px 96px}.v3-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:24px}.v3-preview-card{padding:20px;display:grid;align-content:start;gap:16px}.v3-preview-card h2{font-size:17px;margin:0}.v3-preview-inline{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.v3-preview-card .lf-v3-restricted-state{margin-top:8px}@media(max-width:767px){.v3-preview{padding:24px 16px 96px}.v3-preview-grid{grid-template-columns:1fr;gap:16px}.v3-preview-card{padding:16px}}`;
function documentFor(markup) { return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>${css}\n${previewCss}</style></head><body>${markup}</body></html>`; }
mkdirSync("docs/design-implementation/screenshots", { recursive: true });

for (const [engine, name] of [[chromium, "chrome"], [webkit, "webkit"]]) {
  const browser = await engine.launch(name === "chrome" ? { channel: "chrome", headless: true } : { headless: true });
  for (const [width, height, kind] of [[1440, 900, "desktop"], [390, 844, "mobile"]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.route(`${origin}/__v3_primitives`, (route) => route.fulfill({ contentType: "text/html", body: documentFor(galleryMarkup) }));
    await page.route(`${origin}/__v3_sheet`, (route) => route.fulfill({ contentType: "text/html", body: documentFor(sheetMarkup) }));
    await page.route(`${origin}/__v3_interactive`, (route) => route.fulfill({ contentType: "text/html", body: documentFor('<div id="root"></div><script src="/__v3_bundle.js"></script>') }));
    await page.route(`${origin}/__v3_bundle.js`, (route) => route.fulfill({ contentType: "text/javascript", body: interactiveBundle }));
    await page.route(`${origin}/fonts/material-symbols-rounded.woff2`, (route) => route.fulfill({ contentType: "font/woff2", body: font }));
    await page.goto(`${origin}/__v3_primitives`, { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async () => {
      const loadedFonts = await document.fonts.load('20px "Material Symbols Rounded"', "add");
      const button = document.querySelector(".lf-v3-button--primary");
      const switchElement = document.querySelector(".lf-v3-switch");
      const card = document.querySelector(".lf-v3-card");
      return { loadedFonts: loadedFonts.length, buttonHeight: button.getBoundingClientRect().height, switchHeight: switchElement.getBoundingClientRect().height, switchTrackWidth: switchElement.querySelector("span").getBoundingClientRect().width, cardRadius: getComputedStyle(card).borderRadius, stepBarHeight: document.querySelector(".lf-v3-stepper > div > span").getBoundingClientRect().height, railWidth: document.querySelector(".lf-v3-step-rail").getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(result.loadedFonts > 0, `${name} ${kind}: Rounded font not loaded`);
    assert.ok(result.buttonHeight >= (kind === "mobile" ? 44 : 36));
    assert.ok(result.switchHeight >= 44);
    assert.equal(result.switchTrackWidth, 42);
    assert.equal(result.cardRadius, "12px");
    assert.equal(result.stepBarHeight, 4);
    if (kind === "desktop") assert.equal(result.railWidth, 260);
    assert.equal(result.overflow, false, `${name} ${kind}: overflow`);
    if (kind === "mobile") {
      for (const target of await page.locator(".lf-v3-button,.lf-v3-switch,.lf-v3-row-main,.lf-v3-context-switcher summary,.lf-v3-breadcrumb-back,.lf-v3-toast button").all()) {
        const box = await target.boundingBox();
        if (box) assert.ok(box.height >= 44, `${name}: touch target below 44px`);
      }
    }
    await page.locator(".lf-v3-button--primary").first().focus();
    assert.equal(await page.locator(".lf-v3-button--primary").first().evaluate((button) => getComputedStyle(button).outlineStyle), "solid");
    await page.locator(".lf-v3-context-switcher summary").click();
    assert.equal(await page.locator(".lf-v3-context-switcher").getAttribute("open"), "");
    await page.keyboard.press("Escape");
    // Native details are keyboard operable; the React Escape handler is checked in component source.
    await page.evaluate(() => { const shell = document.querySelector(".lf-shell"); shell.dataset.lfTextSize = "xlarge"; shell.dataset.lfContrast = "high"; shell.dataset.lfSpacing = "comfortable"; });
    const access = await page.evaluate(() => ({ titleSize: parseFloat(getComputedStyle(document.querySelector(".lf-v3-page-header h1")).fontSize), primaryText: getComputedStyle(document.querySelector(".lf-v3-button--primary")).color, contextText: getComputedStyle(document.querySelector(".lf-v3-context-name")).color, rowHeight: document.querySelector(".lf-v3-row-main").getBoundingClientRect().height }));
    assert.ok(access.titleSize > (kind === "mobile" ? 34 : 28));
    assert.equal(access.primaryText, "rgb(255, 255, 255)");
    assert.equal(access.contextText, "rgb(255, 255, 255)");
    assert.ok(access.rowHeight >= 56);
    await page.evaluate(() => { const shell = document.querySelector(".lf-shell"); shell.dataset.lfTextSize = "default"; shell.dataset.lfContrast = "default"; shell.dataset.lfSpacing = "default"; });
    if (name === "chrome") {
      await page.evaluate(() => { document.querySelector(".lf-v3-context-switcher")?.removeAttribute("open"); document.activeElement?.blur(); scrollTo(0, 0); });
      await page.screenshot({ path: `docs/design-implementation/screenshots/v3-phase2-gallery-${kind}-${width}x${height}.png` });
      if (kind === "mobile") await page.screenshot({ path: "docs/design-implementation/screenshots/v3-phase2-gallery-mobile-full.png", fullPage: true });
      await page.goto(`${origin}/__v3_sheet`, { waitUntil: "domcontentloaded" });
      const sheetWidth = await page.locator(".lf-v3-sheet").evaluate((sheet) => sheet.getBoundingClientRect().width);
      assert.equal(sheetWidth, kind === "desktop" ? 448 : 390);
      await page.screenshot({ path: `docs/design-implementation/screenshots/v3-phase2-sheet-${kind}-${width}x${height}.png` });
    }
    await page.goto(`${origin}/__v3_interactive`, { waitUntil: "domcontentloaded" });
    const switchControl = page.getByRole("switch", { name: "Show area" });
    await switchControl.waitFor();
    assert.equal(await switchControl.getAttribute("aria-checked"), "false");
    await switchControl.focus();
    await page.keyboard.press("Space");
    assert.equal(await switchControl.getAttribute("aria-checked"), "true");
    const openSheet = page.getByRole("button", { name: "Open sheet" });
    await openSheet.click();
    const dialog = page.getByRole("dialog", { name: "Sample sheet" });
    await dialog.waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close Sample sheet");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Done");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close Sample sheet");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Open sheet");
    await page.getByRole("button", { name: "Show toast" }).click();
    await page.getByRole("status").waitFor();
    await page.getByRole("button", { name: "Undo" }).click();
    assert.equal(await page.getByRole("status").count(), 0);
    await page.locator(".lf-v3-context-switcher summary").focus();
    await page.keyboard.press("Enter");
    if (kind === "mobile") await page.getByRole("dialog", { name: "Switch Fortress" }).waitFor();
    else assert.equal(await page.locator(".lf-v3-context-switcher").getAttribute("open"), "");
    if (name === "chrome") await page.screenshot({ path: `docs/design-implementation/screenshots/v3-phase2-context-${kind}-${width}x${height}.png` });
    await page.getByRole("button", { name: "Linked Fortress" }).click();
    assert.match(await page.locator(".lf-v3-context-switcher summary").textContent(), /Linked Fortress/);
    console.log(JSON.stringify({ browser: name, viewport: `${width}x${height}`, ...result, accessibility: access }));
    await context.close();
  }
  await browser.close();
}
