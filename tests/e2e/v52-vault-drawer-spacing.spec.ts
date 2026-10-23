import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const labels = ["Add to my Fortress", "Finances", "Legal", "Property", "Business", "Digital", "Possessions"];
const sharedStyles = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const launcherStyles = readFileSync(path.join(process.cwd(), "components/navigation/founder-test-launcher.css"), "utf8");
const tokens = readFileSync(path.join(process.cwd(), "design_handoff_legacy_fortress 5.2/tokens.css"), "utf8");

for (const [width, height, textScale] of [[320, 568, 1], [390, 844, 1], [402, 874, 1], [390, 568, 1.25]] as const) {
  test(`Vault drawer rows stay compact and footer remains reachable at ${width}x${height}, ${textScale}x text`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><aside class="lf-mobile-drawer" aria-label="Mobile Navigation">
      <div class="lf-mobile-drawer-heading"><strong>Your vault</strong><button>Close</button></div>
      <div class="lf-mobile-tree">${labels.map((label) => `<div class="lf-mobile-tree-node"><div class="lf-mobile-tree-row"><a class="lf-mobile-tree-link" href="#">${label}</a></div></div>`).join("")}</div>
      <div class="lf-mobile-drawer-footer"><a class="lf-mobile-drawer-support" href="#">Support</a><a class="lf-mobile-drawer-support" href="#">Settings</a><button class="lf-founder-launcher-entry">TEST environments</button></div>
    </aside></body></html>`);
    await page.evaluate(({ tokens, sharedStyles, launcherStyles, textScale }) => {
      const style = document.createElement("style");
      style.textContent = `${tokens}\n${sharedStyles}\n${launcherStyles}\n${textScale > 1 ? `.lf-mobile-tree-link, .lf-mobile-drawer-support, .lf-founder-launcher-entry { font-size: ${textScale}em !important; }` : ""}`;
      document.head.append(style);
    }, { tokens, sharedStyles, launcherStyles, textScale });

    const geometry = await page.evaluate(() => {
      const drawer = document.querySelector<HTMLElement>(".lf-mobile-drawer")!;
      const tree = document.querySelector<HTMLElement>(".lf-mobile-tree")!;
      const rows = [...document.querySelectorAll<HTMLElement>(".lf-mobile-tree-link")].map((node) => node.getBoundingClientRect());
      const launcher = document.querySelector<HTMLElement>(".lf-founder-launcher-entry")!.getBoundingClientRect();
      tree.scrollTop = tree.scrollHeight;
      const last = rows.at(-1)!;
      return {
        drawerRight: drawer.getBoundingClientRect().right,
        largestRowStep: Math.max(...rows.slice(1).map((row, index) => row.top - rows[index].top)),
        smallestTarget: Math.min(...rows.map((row) => row.height), launcher.height),
        launcherBottom: launcher.bottom,
        treeScrollable: tree.scrollHeight > tree.clientHeight,
        lastRowVisibleAfterScroll: last.bottom - tree.scrollTop <= tree.getBoundingClientRect().bottom + 1,
      };
    });
    expect(geometry.drawerRight).toBeLessThanOrEqual(width);
    expect(geometry.largestRowStep).toBeLessThan(80);
    expect(geometry.smallestTarget).toBeGreaterThanOrEqual(44);
    expect(geometry.launcherBottom).toBeLessThanOrEqual(height);
    if (height === 568) {
      expect(geometry.treeScrollable).toBe(true);
      expect(geometry.lastRowVisibleAfterScroll).toBe(true);
    }
  });
}
