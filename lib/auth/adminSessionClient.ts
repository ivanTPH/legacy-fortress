import { sharedRead } from "../sharedRead.ts";

export type AdminSessionResponse = { status: number; ok: boolean; payload: Record<string, unknown> | null };

/**
 * GET /api/internal/admin/session, shared for a few seconds: the account menu and the workspace switcher both asked
 * on every page load (speed, 23 Nov 2026). The server still decides; this only avoids asking twice.
 */
export function fetchAdminSession(token: string): Promise<AdminSessionResponse> {
  return sharedRead(`admin-session:${token.slice(-16)}`, async () => {
    const response = await fetch("/api/internal/admin/session", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: response.status, ok: response.ok, payload };
  });
}
