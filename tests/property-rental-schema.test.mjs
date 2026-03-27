import test from "node:test";
import assert from "node:assert/strict";

import {
  getAssetCategoryFormConfig,
  getCanonicalAssetMetadataFromValues,
  shouldShowAssetField,
  validateAssetFormValues,
} from "../lib/assets/fieldDictionary.ts";
import { readCanonicalPropertyAsset } from "../lib/assets/propertyAsset.ts";
import { mergeWorkspaceSaveMetadata } from "../lib/assets/workspaceSaveMetadata.ts";

test("property schema shows rental fields only when occupancy status is rental_property", () => {
  const config = getAssetCategoryFormConfig("property");
  assert.ok(config);

  const tenantField = config.fields.find((field) => field.key === "tenant_name");
  const commercialField = config.fields.find((field) => field.key === "lease_or_tenant_summary");

  assert.ok(tenantField);
  assert.ok(commercialField);

  assert.equal(shouldShowAssetField(tenantField, { occupancy_status: "main_residence" }), false);
  assert.equal(shouldShowAssetField(tenantField, { occupancy_status: "rental_property" }), true);

  assert.equal(shouldShowAssetField(commercialField, { property_type: "residential" }), false);
  assert.equal(shouldShowAssetField(commercialField, { property_type: "commercial" }), true);
});

test("property schema requires occupancy status and excludes hidden rental metadata", () => {
  const config = getAssetCategoryFormConfig("property");
  assert.ok(config);

  const baseValues = {
    title: "Flat 2",
    property_type: "residential",
    ownership_type: "sole",
    property_address: "1 High Street",
    property_country: "UK",
    occupancy_status: "",
    estimated_value: "450000",
    currency: "GBP",
    valuation_date: "",
    mortgage_status: "none",
    notes: "",
    tenant_name: "Should not persist",
  };

  const errors = validateAssetFormValues(config, baseValues);
  assert.equal(errors.occupancy_status, "Occupancy status is required.");

  const metadata = getCanonicalAssetMetadataFromValues(config, {
    ...baseValues,
    occupancy_status: "main_residence",
  });
  assert.equal(metadata.occupancy_status, "main_residence");
  assert.equal("tenant_name" in metadata, false);
});

test("legacy rental property type normalizes into residential type plus rental occupancy", () => {
  const canonical = readCanonicalPropertyAsset({
    title: "Let Flat",
    metadata_json: {
      property_type: "rental",
      ownership_type: "sole",
      property_address: "2 Station Road",
      property_country: "UK",
    },
  });

  assert.equal(canonical.property_type, "residential");
  assert.equal(canonical.occupancy_status, "rental_property");
});

test("canonical property save metadata keeps canonical property fields instead of dropping them into finance-only metadata", () => {
  const metadata = mergeWorkspaceSaveMetadata({
    baseMetadata: {
      notes: null,
      finance_category: "property",
    },
    financeMetadata: {},
    canonicalMetadata: {
      property_type: "residential",
      ownership_type: "sole",
      property_address: "22 Market Street, York, YO1 4ZZ",
      property_country: "UK",
      occupancy_status: "main_residence",
      mortgage_status: "none",
    },
    usesCanonicalAssets: true,
  });

  assert.equal(metadata.property_type, "residential");
  assert.equal(metadata.ownership_type, "sole");
  assert.equal(metadata.property_country, "UK");
  assert.equal(metadata.occupancy_status, "main_residence");
  assert.equal(metadata.mortgage_status, "none");
});
