import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const styles = ["design_handoff_legacy_fortress 5.2/tokens.css", "app/globals.css"]
  .map((file) => readFileSync(file, "utf8")).join("\n");

test("linked-person actions and contact matches fit a small iPhone with 44px targets", async ({ page }) => {
  await page.setContent(`<main style="width:100%;max-width:600px;padding:12px;box-sizing:border-box">
    <section class="lf-v52-record-people lf-linked-people">
      <h2>People linked to this account</h2>
      <ul class="lf-v52-record-person-list"><li><span class="lf-v52-record-person-avatar">MH</span><span class="lf-v52-record-person-copy">
        <strong>Maya Hale</strong><small>Role on this record: Joint account holder</small><small>Relationship in People: Sister</small>
        <span class="lf-linked-people-row-actions"><a href="#contact">View / Edit contact</a><button>Edit record role</button><a href="#access">Manage access</a><button>Unlink from record</button></span>
      </span></li></ul>
      <div class="lf-linked-people-form"><label>Search your People<input type="search" placeholder="Name, email or telephone"></label>
        <div class="lf-linked-people-picker"><button aria-pressed="true"><strong>Amir Cole</strong><span>amir@example.test · 07700 900123</span><small>Selected</small></button></div>
        <label>Role on this record<select><option>Joint account holder</option></select></label>
        <div class="lf-linked-people-actions"><button>Cancel</button><button>Save person and relationship</button></div>
      </div>
    </section></main>`);
  await page.addStyleTag({ content: styles });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 760 });
    const geometry = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      tooSmall: [...document.querySelectorAll<HTMLElement>(".lf-linked-people button, .lf-linked-people a")]
        .filter((item) => item.getBoundingClientRect().height < 43.5).map((item) => item.textContent?.trim()),
    }));
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.tooSmall).toEqual([]);
  }
  await page.getByRole("button", { name: "Edit record role" }).focus();
  expect(await page.getByRole("button", { name: "Edit record role" }).evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe("none");
});
