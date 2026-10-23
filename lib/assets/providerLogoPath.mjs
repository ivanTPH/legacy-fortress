/** Only repository-owned logo assets may be displayed in a record. */
export function isApprovedLocalLogoPath(path) {
  return /^\/(?:logos|bank-logos)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:png|svg|webp)$/i.test(String(path ?? ""));
}

export function resolveProviderLogoPath(provider) {
  if (!provider) return "";
  if (provider.provider_type === "bank") {
    const key = String(provider.provider_key ?? "");
    return /^[a-z0-9-]+$/.test(key) ? `/bank-logos/${key}.png` : "";
  }
  const path = String(provider.logo_path ?? "").trim();
  return isApprovedLocalLogoPath(path) ? path : "";
}
