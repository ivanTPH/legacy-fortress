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

/**
 * Money owed (owner decision, 27 Nov 2026): a true minus sign plus the word "owed", e.g. "−£12,000 owed".
 * Never colour alone: the brick colour (.lf-amount-owed) is only an extra hint, so the meaning survives
 * colour-blindness, poor eyesight and screen readers.
 */
export function formatOwed(value: number, currency: string, options: { whole?: boolean } = {}): string {
  const amount = Math.abs(Number(value) || 0);
  const text = options.whole === false ? formatCurrency(amount, currency) : formatCurrencyWhole(amount, currency);
  return `\u2212${text} owed`;
}
