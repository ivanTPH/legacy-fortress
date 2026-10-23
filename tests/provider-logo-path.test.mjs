import assert from "node:assert/strict";
import test from "node:test";
import { isApprovedLocalLogoPath, resolveProviderLogoPath } from "../lib/assets/providerLogoPath.mjs";

test("uses only local provider logos and retains the monogram fallback", () => {
  assert.equal(resolveProviderLogoPath({ provider_type: "bank", provider_key: "barclays" }), "/bank-logos/barclays.png");
  assert.equal(resolveProviderLogoPath({ provider_type: "social", logo_path: "/logos/social/facebook.svg" }), "/logos/social/facebook.svg");
  assert.equal(resolveProviderLogoPath({ provider_type: "bank", provider_key: "../private" }), "");
  assert.equal(resolveProviderLogoPath({ provider_type: "social", logo_path: "https://example.com/logo.svg" }), "");
  assert.equal(resolveProviderLogoPath({ provider_type: "social", logo_path: "/logos/../private.svg" }), "");
  assert.equal(resolveProviderLogoPath({ provider_type: "social", logo_path: "/api/private.svg" }), "");
  assert.equal(resolveProviderLogoPath(null), "");
  assert.equal(isApprovedLocalLogoPath("/logos/partners/vetted-logo.svg"), true);
  assert.equal(isApprovedLocalLogoPath("//evil.example/logo.svg"), false);
});
