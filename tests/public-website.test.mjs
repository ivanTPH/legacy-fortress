import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";

// The public website (owner decision 7 Nov 2026): served at the app's own address, with sign-in unchanged.
const pages = ["index", "how-it-works", "pricing", "partners", "contact", "privacy", "terms"];

test("each website page is served at its own address", () => {
  const config = fs.readFileSync("next.config.ts", "utf8");
  assert.match(config, /source: "\/", destination: "\/site\/index.html"/);
  assert.match(config, /"how-it-works", "pricing", "partners", "contact", "privacy", "terms"/);
  for (const page of pages) assert.ok(fs.existsSync(`public/site/${page}.html`), page);
  for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) assert.ok(fs.existsSync(`public/site/audio/scene-${n}.mp3`));
});

test("sign in and start free go to the app in the same window, never to another address", () => {
  for (const page of pages) {
    const html = fs.readFileSync(`public/site/${page}.html`, "utf8");
    assert.doesNotMatch(html, /test\.mylegacyfortress\.com|_blob|\.dc\.html|target="_blank"/, page);
    assert.doesNotMatch(html, /fonts\.googleapis/, `${page} uses local fonts (the app's security policy blocks outside stylesheets)`);
  }
  const home = fs.readFileSync("public/site/index.html", "utf8");
  assert.match(home, /href="\/sign-in" data-signin/);
  assert.match(home, /href="\/sign-up" data-signup/);
});

test("signed-in people are offered their Vault; the website never reads what's in the session", () => {
  const js = fs.readFileSync("public/site/site.js", "utf8");
  assert.match(js, /\/\^sb-\.\+-auth-token\$\/\.test\(localStorage\.key\(i\)/);
  assert.doesNotMatch(js, /getItem\([^)]*auth-token/, "never reads the session itself");
  assert.match(js, /'\/dashboard'/);
});

test("forms say plainly that nothing is sent yet on TEST", () => {
  for (const page of ["contact", "partners"]) {
    assert.match(fs.readFileSync(`public/site/${page}.html`, "utf8"), /TEST site: messages aren’t sent anywhere yet/);
  }
});

test("the tour opens from guided set-up with one clear way back (pages can't be framed: X-Frame-Options DENY)", () => {
  const js = fs.readFileSync("public/site/site.js", "utf8");
  const css = fs.readFileSync("public/site/site.css", "utf8");
  assert.match(js, /from=setup/);
  assert.match(js, /href="\/onboarding\?step=welcome"/);
  assert.match(css, /html\.lf-from-setup a\[data-signup\]\{display:none!important\}/);
  const setup = fs.readFileSync("app/onboarding/OnboardingPageClient.tsx", "utf8");
  assert.match(setup, /href="\/how-it-works\?from=setup"/);
  assert.doesNotMatch(setup, /<iframe/);
  assert.match(fs.readFileSync("next.config.ts", "utf8"), /frame-ancestors 'none'/, "framing stays blocked");
});
