import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const source = process.argv[2];
if (!source) throw new Error("Pass the Version 3 Journeys HTML file path.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(source)).href, { waitUntil: "domcontentloaded" });
for (const [id, label] of [["1a", "context-switcher"], ["4a", "step-rail"], ["6c", "timeline"], ["12a", "alerts"]]) {
  const card = page.locator(`[id="${id}"]`).first();
  await card.waitFor();
  await card.screenshot({ path: `docs/design-implementation/screenshots/v3-phase2-reference-${label}.png` });
}
await browser.close();
