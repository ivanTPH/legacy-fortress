import { findProviderBrand, PROVIDER_BRANDS } from "./providerBrands.mjs";

/** Only repository-owned logo assets may be displayed in a record. */
export function isApprovedLocalLogoPath(path) {
  return /^\/(?:logos|bank-logos)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:png|svg|webp)$/i.test(String(path ?? ""));
}

export function resolveProviderLogoPath(provider) {
  if (!provider) return "";
  if (provider.provider_type === "bank") {
    // Banks use the well-known providers list (23 Nov 2026); most /bank-logos files were mislabelled images.
    const key = String(provider.provider_key ?? "");
    const brand = PROVIDER_BRANDS.find((item) => item.key === key) ?? findProviderBrand(provider.display_name);
    return brand?.logo ?? "";
  }
  const path = String(provider.logo_path ?? "").trim();
  return isApprovedLocalLogoPath(path) ? path : "";
}
