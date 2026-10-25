import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const globals = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const baseVariables = globals.match(/:root \{[\s\S]*?\n\}/)?.[0];
if (!baseVariables) throw new Error("Application design tokens are missing");
const styles = [
  readFileSync(path.join(process.cwd(), "design_handoff_legacy_fortress/tokens.css"), "utf8"),
  baseVariables, "body { font-family: var(--lf-font-sans); }",
  ...["app/v3-primitives.css", "app/v3-screens.css"].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")),
].join("\n");
const areas = ["Finances", "Legal", "Property", "Business", "Digital", "Possessions"];
const finance = ["Banks", "Pensions", "Investments", "Insurance", "Debts"];

function card(title: string, count: number, value?: string) {
  return `<article class="lf-v52-section-tile">
    <a class="lf-v52-section-link" href="#${title.toLowerCase()}"><span class="lf-v3-icon-tile lf-v3-icon-tile--36" aria-hidden="true">●</span><strong>${title}</strong><span class="lf-icon" aria-hidden="true">›</span></a>
    <div class="lf-v52-section-meta"><span class="lf-v52-section-meta-primary"><span>${count ? `${count} record${count === 1 ? "" : "s"}` : "No records yet"}</span>${value ? `<strong>· ${value}</strong>` : ""}</span>${count ? "" : `<a class="lf-v52-section-add" href="#add-${title.toLowerCase()}" aria-label="Add first record in ${title}"><span>Add first record</span><span class="lf-icon">+</span></a>`}</div>
  </article>`;
}

for (const [width, height, largeText, columns] of [
  [320, 568, false, 1], [390, 844, false, 2], [402, 874, false, 2],
  [390, 844, true, 1], [1440, 900, false, 3],
] as const) {
  test(`shared Dashboard and Finances cards fit ${width}px${largeText ? " enlarged text" : ""}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">
      <main class="lf-shell" data-lf-text-size="${largeText ? "large" : "normal"}" style="box-sizing:border-box;width:100%;padding:16px;background:var(--lf-canvas)">
        <section aria-label="Dashboard cards" class="lf-v3-screen-overview is-dashboard"><div class="lf-v52-section-grid">${areas.map((title) => card(title, title === "Finances" ? 3 : 0, title === "Finances" ? "£652,590.00" : undefined)).join("")}</div></section>
        <section aria-label="Finances cards" class="lf-v3-area-page lf-v52-finance-page" style="margin-top:24px"><div class="lf-v52-section-grid">${finance.map((title) => card(title, title === "Banks" ? 2 : title === "Pensions" ? 1 : 0, title === "Banks" ? "£132,245.00" : title === "Pensions" ? "£520,345.00" : undefined)).join("")}</div></section>
      </main></body></html>`);
    await page.addStyleTag({ content: `${styles}\n${largeText ? "html { font-size: 125% !important; }" : ""}` });
    const geometry = await page.evaluate(() => {
      const grids = [...document.querySelectorAll<HTMLElement>(".lf-v52-section-grid")];
      const titles = [...document.querySelectorAll<HTMLElement>(".lf-v52-section-link strong")];
      const targets = [...document.querySelectorAll<HTMLElement>(".lf-v52-section-link, .lf-v52-section-add")];
      return {
        columns: grids.map((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length),
        documentWidth: document.documentElement.scrollWidth,
        clippedTitles: titles.filter((title) => title.scrollWidth > title.clientWidth + 1).map((title) => title.textContent),
        minTarget: Math.min(...targets.map((target) => target.getBoundingClientRect().height)),
      };
    });
    expect(geometry.columns).toEqual([columns, columns]);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width);
    expect(geometry.clippedTitles).toEqual([]);
    expect(geometry.minTarget).toBeGreaterThanOrEqual(44);
    if (!largeText && [390, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`dashboard-finances-${width}.png`), fullPage: true });
  });
}
