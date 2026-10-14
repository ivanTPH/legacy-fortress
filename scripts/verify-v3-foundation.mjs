// Render only the local foundation CSS and font; no app server or Supabase is contacted.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, webkit } from "@playwright/test";

const css = readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', "");
const font = readFileSync("public/fonts/material-symbols-rounded.woff2");
const origin = "http://127.0.0.1:3012";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="lf-shell" data-lf-text-size="default" data-lf-contrast="default" data-lf-spacing="default">
  <aside class="lf-sidebar"><div class="lf-brand-row"><span class="lf-brand-glyph"><span class="lf-icon material-symbols-rounded" style="font-size:24px;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24">apps</span></span><span class="lf-brand-title">Legacy Fortress</span></div></aside>
  <main class="lf-main-content"><h1 style="font-size:var(--lf-type-page);line-height:var(--lf-type-page-line);letter-spacing:-.02em;margin:0">Design foundation</h1>
  <p style="max-width:640px">Your recorded information, in one place.</p>
  <p id="secondary" class="lf-muted-note">Secondary text and locally bundled rounded icons.</p>
  <button class="lf-icon-btn" type="button" aria-label="Open settings"><span id="app-icon" class="lf-icon material-symbols-rounded" style="font-size:20px;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20">settings</span></button>
  <section style="margin-top:24px;background:var(--lf-surface);border:1px solid var(--lf-border);border-radius:var(--lf-radius-card);padding:20px;max-width:600px">Version 3 card surface</section>
  </main></div></body></html>`;

for (const [engine, name] of [[chromium, "chrome"], [webkit, "webkit"]]) {
  const browser = await engine.launch(name === "chrome" ? { channel: "chrome", headless: true } : { headless: true });
  for (const [width, height, kind] of [[1440, 900, "desktop"], [390, 844, "mobile"]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.route(`${origin}/__phase1_harness`, (route) => route.fulfill({ contentType: "text/html", body: html }));
    await page.route(`${origin}/fonts/material-symbols-rounded.woff2`, (route) => route.fulfill({ contentType: "font/woff2", body: font }));
    await page.goto(`${origin}/__phase1_harness`, { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async () => {
      const loaded = await document.fonts.load('24px "Material Symbols Rounded"', "apps");
      const style = getComputedStyle(document.documentElement);
      return {
        loadedFonts: loaded.length,
        font: getComputedStyle(document.body).fontFamily,
        text: getComputedStyle(document.body).color,
        canvas: getComputedStyle(document.body).backgroundColor,
        secondary: getComputedStyle(document.getElementById("secondary")).color,
        iconFont: getComputedStyle(document.getElementById("app-icon")).fontFamily,
        inkToken: style.getPropertyValue("--lf-ink").trim(),
        radiusToken: style.getPropertyValue("--lf-radius-card").trim(),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    assert.ok(result.loadedFonts > 0, `${name} ${kind}: rounded font did not load`);
    assert.equal(result.inkToken, "#2b1714");
    assert.equal(result.radiusToken, "12px");
    assert.match(result.font, /-apple-system|BlinkMacSystemFont|SF Pro Text|Segoe UI|Roboto/);
    assert.match(result.iconFont, /Material Symbols Rounded/);
    assert.equal(result.text, "rgb(31, 23, 21)");
    assert.equal(result.secondary, "rgb(107, 95, 90)");
    assert.equal(result.canvas, kind === "mobile" ? "rgb(246, 243, 240)" : "rgb(250, 248, 246)");
    assert.equal(result.overflow, false, `${name} ${kind}: horizontal overflow`);
    const accessibility = await page.evaluate(() => {
      const shell = document.querySelector(".lf-shell");
      const normalSize = parseFloat(getComputedStyle(shell).fontSize);
      shell.dataset.lfTextSize = "large";
      shell.dataset.lfContrast = "high";
      return {
        normalSize,
        largeSize: parseFloat(getComputedStyle(shell).fontSize),
        highContrastText: getComputedStyle(document.getElementById("secondary")).color,
        glyphColor: getComputedStyle(document.querySelector(".lf-brand-glyph .lf-icon")).color,
      };
    });
    assert.ok(accessibility.largeSize > accessibility.normalSize, `${name} ${kind}: large text did not scale`);
    assert.equal(accessibility.highContrastText, "rgb(0, 0, 0)");
    assert.equal(accessibility.glyphColor, "rgb(255, 255, 255)");
    await page.evaluate(() => { const shell = document.querySelector(".lf-shell"); shell.dataset.lfTextSize = "default"; shell.dataset.lfContrast = "default"; });
    if (name === "chrome") await page.screenshot({ path: `test-results/design/v3-foundation-${kind}-${width}x${height}.png` });
    console.log(JSON.stringify({ browser: name, viewport: `${width}x${height}`, ...result, accessibility }));
    await context.close();
  }
  await browser.close();
}
