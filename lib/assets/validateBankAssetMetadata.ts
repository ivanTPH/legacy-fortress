/** Shared service validation for both owner-created and owner-edited bank assets. */
export function validateBankAssetMetadata(metadata: Record<string, unknown>) {
  const isDashboardQuickRecord = metadata["dashboard_quick_record"] === true;
  const providerName = String(metadata["provider_name"] ?? metadata["institution_name"] ?? "").trim();
  const accountType = String(metadata["account_type"] ?? "").trim();
  const accountHolder = String(metadata["account_holder"] ?? metadata["account_holder_name"] ?? "").trim();
  const country = String(metadata["country"] ?? metadata["country_code"] ?? "").trim();
  const currency = String(metadata["currency"] ?? metadata["currency_code"] ?? "").trim();

  if (!providerName) throw new Error("Provider Name is required.");
  if (!accountType) throw new Error("Account Type is required.");
  if (!isDashboardQuickRecord && !accountHolder) throw new Error("Account Holder is required.");
  if (!country) throw new Error("Country is required.");
  if (!currency) throw new Error("Currency is required.");
}
