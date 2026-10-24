import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const styles = ["design_handoff_legacy_fortress 5.2/tokens.css", "app/globals.css"]
  .map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");

test("record detail keeps supported People data in a desktop rail and stacks on mobile", async ({ page }) => {
  await page.setContent(`<main style="max-width:960px;margin:auto;padding:16px;box-sizing:border-box">
    <section class="lf-v52-record-detail-grid has-people" style="display:grid;gap:16px;padding:16px;border:1px solid">
      <div class="lf-v52-record-value">Value and date</div>
      <div>Structured details</div>
      <div>Documents</div>
      <aside class="lf-linked-contact-panel-list">People linked to this record</aside>
    </section></main>`);
  await page.addStyleTag({ content: styles });
  for (const [width, expectRail] of [[1280, true], [390, false]] as const) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".lf-v52-record-detail-grid")!;
      const value = document.querySelector<HTMLElement>(".lf-v52-record-value")!;
      const people = document.querySelector<HTMLElement>(".lf-linked-contact-panel-list")!;
      return { columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length, sideBySide: people.getBoundingClientRect().left > value.getBoundingClientRect().right, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(layout.columns).toBe(expectRail ? 2 : 1);
    expect(layout.sideBySide).toBe(expectRail);
    expect(layout.overflow).toBe(false);
  }
});
