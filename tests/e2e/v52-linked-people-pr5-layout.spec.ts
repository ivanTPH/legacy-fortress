import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const styles = ["design_handoff_legacy_fortress 5.2/tokens.css", "app/globals.css"]
  .map((file) => readFileSync(file, "utf8")).join("\n");

async function render(page: import("@playwright/test").Page) {
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><main style="width:100%;max-width:1100px;padding:12px;box-sizing:border-box">
    <section class="lf-v52-record-people lf-linked-people">
      <h2>People linked to this account</h2>
      <ul class="lf-v52-record-person-list"><li><span class="lf-v52-record-person-avatar">MH</span><div class="lf-v52-record-person-copy">
        <strong>Maya Hale</strong><small>Joint account holder · Sister</small>
        <span class="lf-linked-people-states"><span class="lf-linked-people-chip is-good">Joined</span><span class="lf-linked-people-chip is-good">ID verified</span></span>
        <small>Added by you from People</small><details class="lf-linked-people-row-menu"><summary>More actions</summary><span class="lf-linked-people-row-actions"><a href="#contact">View / Edit contact</a><button>Edit record role</button><a href="#access">Manage access</a><button>Unlink from record</button></span></details>
      </div></li></ul><button class="lf-linked-people-action">Add another person</button>
    </section></main>
    <div class="lf-linked-people-overlay"><div class="lf-linked-people-dialog is-entry is-full-mobile" role="dialog" aria-modal="true" aria-labelledby="test-title">
      <div class="lf-linked-people-dialog-header"><div class="lf-linked-people-drag-handle"></div><h3 id="test-title">Choose a person</h3><button class="lf-linked-people-dialog-close" aria-label="Close linked people dialog">×</button></div>
      <div class="lf-linked-people-dialog-body"><div class="lf-linked-people-form"><label>Search your People<input type="search" placeholder="Name, email or telephone"></label>
        <div class="lf-linked-people-picker"><button aria-pressed="true"><strong>Amir Cole</strong><span>Brother · amir@example.test · 07700 900123</span><small>Selected</small></button></div>
        <fieldset class="lf-linked-people-role-choices"><legend>Role on this record</legend><button aria-pressed="true">Joint account holder</button><button aria-pressed="false">Adviser</button><button aria-pressed="false">Other</button></fieldset>
        <div class="lf-linked-people-actions"><button>Cancel</button><button>Save person and relationship</button></div>
      </div></div></div></div>`);
  await page.addStyleTag({ content: styles });
}

test("mobile picker fits 320px and 390px with accessible controls in light, dark and large text", async ({ page }) => {
  await render(page);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    const chipContrast = await page.locator(".lf-linked-people-chip.is-good").first().evaluate((chip) => {
      const color = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => { const srgb = channel / 255; return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4; });
      const luminance = (value: string) => { const [r, g, b] = color(value); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const style = getComputedStyle(chip);
      const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    });
    expect(chipContrast).toBeGreaterThanOrEqual(4.5);
    for (const [width, textScale] of [[320, 1], [390, 1], [320, 2], [390, 2]]) {
      await page.evaluate((scale) => { document.documentElement.style.fontSize = `${16 * scale}px`; }, textScale);
      await page.setViewportSize({ width, height: 760 });
      const geometry = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(".lf-linked-people-dialog")!.getBoundingClientRect();
        const controls = [...document.querySelectorAll<HTMLElement>(".lf-linked-people-dialog button, .lf-linked-people-dialog input")].map((item) => ({ label: item.textContent?.trim() || item.getAttribute("aria-label"), rect: item.getBoundingClientRect() }));
        return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, panelLeft: panel.left, panelRight: panel.right, controls: controls.map(({ label, rect }) => ({ label, left: rect.left, right: rect.right, height: rect.height })) };
      });
      expect(geometry.pageWidth).toBeLessThanOrEqual(width);
      expect(geometry.panelLeft).toBeGreaterThanOrEqual(0);
      expect(geometry.panelRight).toBeLessThanOrEqual(width + 1);
      expect(geometry.controls.filter((item) => item.height < 43.5 || item.left < -1 || item.right > width + 1)).toEqual([]);
      if (process.env.LINKED_PEOPLE_PROOF && theme === "light" && width === 390 && textScale === 1) await page.screenshot({ path: "/private/tmp/lf-linked-people-picker-390.png" });
    }
  }
  await page.setViewportSize({ width: 390, height: 430 });
  const save = page.getByRole("button", { name: "Save person and relationship" });
  await save.scrollIntoViewIfNeeded();
  const keyboardSized = await save.boundingBox();
  expect(keyboardSized).not.toBeNull();
  expect(keyboardSized!.y + keyboardSized!.height).toBeLessThanOrEqual(431);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await save.focus();
  expect(await save.evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe("none");
});

test("desktop entry is a right panel and the saved offer is a centred dialog", async ({ page }) => {
  await render(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const entry = await page.locator(".lf-linked-people-dialog").boundingBox();
  expect(entry).not.toBeNull();
  expect(entry!.x + entry!.width).toBeCloseTo(1280, 0);
  expect(entry!.width).toBeLessThanOrEqual(440);
  await page.locator(".lf-linked-people-dialog").evaluate((dialog) => { dialog.classList.remove("is-entry", "is-full-mobile"); dialog.classList.add("is-offer"); });
  const offer = await page.locator(".lf-linked-people-dialog").boundingBox();
  expect(offer).not.toBeNull();
  expect(Math.abs(offer!.x + offer!.width / 2 - 640)).toBeLessThan(2);
  if (process.env.LINKED_PEOPLE_PROOF) await page.screenshot({ path: "/private/tmp/lf-linked-people-desktop-offer.png" });
});
