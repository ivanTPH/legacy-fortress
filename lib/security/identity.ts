export function maskNationalInsuranceNumber(value: string | null | undefined) {
  if (!value) return "Not set";
  const clean = value.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 4) return "••••";
  return `${"•".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}
