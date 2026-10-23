import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const styles = [
  "design_handoff_legacy_fortress 5.2/tokens.css",
  "app/globals.css",
  "components/navigation/founder-test-launcher.css",
].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");

for (const [width, height] of [[320, 568], [390, 844], [402, 874]] as const) {
  test(`Admin drawer keeps its Close control separate and TEST entry reachable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
      <main class="lf-admin-shell lf-admin-shell--platform"><div class="lf-admin-shell-drawer" role="dialog">
        <div class="lf-admin-shell-drawer-panel">
          <div class="lf-admin-shell-drawer-heading"><strong>Platform Admin</strong><button class="lf-admin-shell-drawer-close">Close</button></div>
          <div class="lf-admin-shell-drawer-scroll">
            <div class="lf-admin-shell-drawer-account"><div class="lf-admin-shell-identity">Founder</div></div>
            <aside class="lf-admin-shell-sidebar"><div class="lf-admin-shell-brand">Legacy Fortress</div>
              <nav class="lf-admin-shell-nav">${["Overview", "Verification", "Audit", "Customer users", "Invitations", "Access requests", "Support", "Probate cases", "Organisations", "Licences", "Users & seats", "Registration links", "Reports", "Staff", "Settings"].map((label) => `<div class="lf-admin-shell-nav-group"><a href="#" class="lf-admin-shell-nav-link">${label}</a></div>`).join("")}</nav>
              <button class="lf-founder-launcher-entry">TEST environments</button>
            </aside>
          </div>
        </div>
      </div></main></body></html>`);
    await page.evaluate((css) => { const style = document.createElement("style"); style.textContent = css; document.head.append(style); }, styles);

    const geometry = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".lf-admin-shell-drawer-panel")!;
      const header = document.querySelector<HTMLElement>(".lf-admin-shell-drawer-heading")!;
      const close = document.querySelector<HTMLElement>(".lf-admin-shell-drawer-close")!;
      const scroll = document.querySelector<HTMLElement>(".lf-admin-shell-drawer-scroll")!;
      const first = document.querySelector<HTMLElement>(".lf-admin-shell-nav-link")!;
      const launcher = document.querySelector<HTMLElement>(".lf-founder-launcher-entry")!;
      const rowHeight = first.getBoundingClientRect().height;
      const initialFirstTop = first.getBoundingClientRect().top;
      scroll.scrollTop = scroll.scrollHeight;
      return {
        panelRight: panel.getBoundingClientRect().right,
        headerBottom: header.getBoundingClientRect().bottom,
        closeBottom: close.getBoundingClientRect().bottom,
        initialFirstTop,
        rowHeight,
        closeHeight: close.getBoundingClientRect().height,
        launcherHeight: launcher.getBoundingClientRect().height,
        launcherBottom: launcher.getBoundingClientRect().bottom,
        scrollBottom: scroll.getBoundingClientRect().bottom,
        scrollable: scroll.scrollHeight > scroll.clientHeight,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.panelRight).toBeLessThanOrEqual(width);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width);
    expect(geometry.closeBottom).toBeLessThanOrEqual(geometry.headerBottom);
    expect(geometry.closeHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.rowHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.launcherHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.scrollable).toBe(true);
    expect(geometry.launcherBottom).toBeLessThanOrEqual(geometry.scrollBottom + 1);
    expect(geometry.initialFirstTop).toBeGreaterThanOrEqual(geometry.headerBottom);
  });
}
