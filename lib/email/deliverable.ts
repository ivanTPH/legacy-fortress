/** Real addresses only: synthetic test domains (example.*, *.test, *.invalid, localhost) are never emailed. */
export function isDeliverableAddress(email: string | null | undefined) {
  const address = String(email ?? "").trim().toLowerCase();
  if (!address.includes("@")) return false;
  const domain = address.slice(address.lastIndexOf("@") + 1);
  return !/(^|\.)(test|example|invalid|localhost)$/.test(domain) && !/^example\.(com|org|net)$/.test(domain);
}
