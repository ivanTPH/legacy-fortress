/**
 * The admin's "Show test accounts" choice (16 Nov 2026), shared by every Admin page on this device.
 * Off by default; read on each request and sent as the x-lf-include-tests header.
 */
const KEY = "lf:admin:include-tests";
export const INCLUDE_TESTS_EVENT = "lf-admin-include-tests";

export function readIncludeTests() {
  try { return window.localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function writeIncludeTests(value: boolean) {
  try { window.localStorage.setItem(KEY, value ? "1" : "0"); } catch { /* optional */ }
  try { window.dispatchEvent(new CustomEvent(INCLUDE_TESTS_EVENT, { detail: value })); } catch { /* optional */ }
}
