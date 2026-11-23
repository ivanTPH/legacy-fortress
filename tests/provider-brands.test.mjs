import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { findProviderBrand, PROVIDER_BRANDS, tileColourFor, tileLetter, tileTextColour } from "../lib/assets/providerBrands.mjs";
import { isApprovedLocalLogoPath, resolveProviderLogoPath } from "../lib/assets/providerLogoPath.mjs";

test("well-known providers: names typed loosely still match", () => {
  assert.equal(findProviderBrand("Quilters")?.key, "quilter");
  assert.equal(findProviderBrand("Lloyds Bank plc")?.key, "lloyds");
  assert.equal(findProviderBrand("Bank of Scotland")?.key, "bank-of-scotland");
  assert.equal(findProviderBrand("Legal & General")?.key, "legal-and-general");
  assert.equal(findProviderBrand("My Aviva pension")?.key, "aviva");
  assert.equal(findProviderBrand("Some local credit union"), null);
});

test("every logo is a real repository file at an approved path; banks no longer point at missing files", () => {
  const logos = PROVIDER_BRANDS.filter((brand) => brand.logo);
  assert.ok(logos.length >= 25);
  for (const brand of logos) {
    assert.ok(isApprovedLocalLogoPath(brand.logo), brand.logo);
    assert.ok(existsSync(new URL(`../public${brand.logo}`, import.meta.url)), brand.logo);
  }
  assert.equal(resolveProviderLogoPath({ provider_type: "bank", provider_key: "natwest", display_name: "NatWest" }), "/logos/finance/natwest.png");
  assert.equal(resolveProviderLogoPath({ provider_type: "bank", provider_key: "santander", display_name: "Santander" }), "");
  assert.equal(new Set(PROVIDER_BRANDS.map((brand) => brand.key)).size, PROVIDER_BRANDS.length, "keys are unique");
});

test("tiles: steady colour, readable text, first letter", () => {
  assert.equal(tileColourFor("Acme Savings"), tileColourFor("acme savings"));
  assert.equal(tileTextColour("#FFD900"), "#1F1A17");
  assert.equal(tileTextColour("#00474F"), "#FFFFFF");
  assert.equal(tileLetter("The People’s Pension"), "P");
  assert.equal(tileLetter("first direct"), "F");
});
