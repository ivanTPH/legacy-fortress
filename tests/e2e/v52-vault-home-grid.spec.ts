import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const styles = [
  "design_handoff_legacy_fortress 5.2/tokens.css",
  "app/v3-primitives.css",
  "app/v3-screens.css",
].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");

for (const [width, height, textScale, expectedColumns] of [
  [320, 568, 1, 1],
  [390, 844, 1, 2],
  [402, 874, 1, 2],
  [390, 844, 1.25, 1],
  [1280, 800, 1, 3],
] as const) {
  test(`Vault Home categories fit ${width}x${height} at ${textScale}x text`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">
      <div class="lf-shell" data-lf-text-size="${textScale > 1 ? "large" : "normal"}" style="width:100%; box-sizing:border-box; padding:16px">
        <div class="lf-v3-screen-overview is-dashboard is-v51-owner"><section class="lf-v3-vault-overview">
          <h2>Your vault</h2><div class="lf-v3-vault-grid">${["Finances", "Legal", "Property", "Business", "Digital", "Possessions"].map((title) => `<a class="lf-v3-vault-tile" href="#${title.toLowerCase()}"><span class="lf-v3-vault-tile-heading"><span class="lf-v3-icon-tile lf-v3-icon-tile--36" aria-hidden="true">●</span><strong>${title}</strong><span aria-hidden="true">›</span></span><span class="lf-v3-vault-tile-meta"><strong>123 records</strong><small>Updated recently</small></span></a>`).join("")}</div>
        </section></div>
      </div></body></html>`);
    await page.evaluate(({ css, textScale }) => {
      const style = document.createElement("style");
      style.textContent = `${css}\n${textScale > 1 ? `html { font-size: ${16 * textScale}px; }` : ""}`;
      document.head.append(style);
    }, { css: styles, textScale });

    const geometry = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".lf-v3-vault-grid")!;
      const tiles = [...grid.querySelectorAll<HTMLElement>(".lf-v3-vault-tile")];
      const labels = [...grid.querySelectorAll<HTMLElement>(".lf-v3-vault-tile-heading strong, .lf-v3-vault-tile-meta strong")];
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        documentWidth: document.documentElement.scrollWidth,
        minTarget: Math.min(...tiles.map((tile) => tile.getBoundingClientRect().height)),
        clippedText: labels.some((label) => label.scrollWidth > label.clientWidth + 1),
        truncatedText: labels.some((label) => getComputedStyle(label).textOverflow === "ellipsis"),
      };
    });
    expect(geometry.columns).toBe(expectedColumns);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width);
    expect(geometry.minTarget).toBeGreaterThanOrEqual(44);
    expect(geometry.clippedText).toBe(false);
    expect(geometry.truncatedText).toBe(false);
  });
}
