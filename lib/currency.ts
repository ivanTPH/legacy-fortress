export function formatCurrency(value: number, currency: string): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const code = (currency || "GBP").toUpperCase();

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
    }).format(safeValue);
  } catch {
    return `${safeValue.toFixed(2)} ${code}`;
  }
}

/** Whole pounds for totals and tiles (owner decision 10 Nov 2026); records keep their pence. */
export function formatCurrencyWhole(value: number, currency: string): string {
  const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
  const code = (currency || "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(safeValue);
  } catch {
    return `${safeValue} ${code}`;
  }
}
