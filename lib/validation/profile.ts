export function normalizePhone(value: string) {
  return value.replace(/[^+\d]/g, "").slice(0, 18);
}

export function normalizePostCode(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").trim();
}

export function sanitizeName(value: string) {
  return value.replace(/[^a-zA-Z\s'-]/g, "").slice(0, 60);
}

export function sanitizeAddress(value: string) {
  return value.replace(/[<>]/g, "").slice(0, 120);
}
