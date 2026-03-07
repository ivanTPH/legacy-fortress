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
