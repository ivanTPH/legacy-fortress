import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { bearerToken, deviceLabel, hashDeviceToken, newDeviceCheckOn, newDeviceToken, readSessionClaims, trustedBySignIn } from "@/lib/auth/deviceTrust";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET — is this session trusted? A remembered device (x-lf-device) makes a password session trusted.
 * The browser can never mark itself trusted; only this server can, after checking the device token.
 */
export async function GET(request: Request) {
  const access = await requireIdentityApiAccess(request, { allowUnverifiedDevice: true });
  if (!access.ok) return access.response;
  const enforced = await newDeviceCheckOn(access.admin);
  const claims = readSessionClaims(bearerToken(request));
  if (!enforced || trustedBySignIn(claims)) return NextResponse.json({ ok: true, enforced, trusted: true }, { headers: NO_STORE });
  if (!claims.sessionId) return NextResponse.json({ ok: true, enforced, trusted: false }, { headers: NO_STORE });
  const known = await access.admin.from("trusted_sessions").select("session_id").eq("session_id", claims.sessionId).eq("user_id", access.user.id).maybeSingle();
  if (known.data) return NextResponse.json({ ok: true, enforced, trusted: true }, { headers: NO_STORE });
  const deviceToken = (request.headers.get("x-lf-device") ?? "").trim();
  if (deviceToken) {
    const device = await access.admin.from("trusted_devices").select("id,expires_at")
      .eq("user_id", access.user.id).eq("token_hash", hashDeviceToken(access.user.id, deviceToken)).maybeSingle();
    if (device.data && Date.parse(String(device.data.expires_at)) > Date.now()) {
      await access.admin.from("trusted_sessions").upsert({ session_id: claims.sessionId, user_id: access.user.id, method: "remembered_device" }, { onConflict: "session_id" });
      await access.admin.from("trusted_devices").update({ last_used_at: new Date().toISOString() }).eq("id", device.data.id);
      return NextResponse.json({ ok: true, enforced, trusted: true }, { headers: NO_STORE });
    }
  }
  return NextResponse.json({ ok: true, enforced, trusted: false }, { headers: NO_STORE });
}

/** POST — remember this device. Only from a session that has just passed the check (emailed code, two-step). */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request, { allowUnverifiedDevice: true });
  if (!access.ok) return access.response;
  if (!trustedBySignIn(readSessionClaims(bearerToken(request)))) {
    return NextResponse.json({ ok: false, message: "Confirm it's you first." }, { status: 403, headers: NO_STORE });
  }
  const token = newDeviceToken();
  const saved = await access.admin.from("trusted_devices").insert({
    user_id: access.user.id, token_hash: hashDeviceToken(access.user.id, token), label: deviceLabel(request.headers.get("user-agent") ?? ""),
  });
  if (saved.error) return NextResponse.json({ ok: false, message: "This device couldn't be remembered." }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true, token }, { headers: NO_STORE });
}

/** DELETE — forget every remembered device (Settings › Security). The next sign-in on each asks for a code. */
export async function DELETE(request: Request) {
  const access = await requireIdentityApiAccess(request, { allowUnverifiedDevice: true });
  if (!access.ok) return access.response;
  await access.admin.from("trusted_devices").delete().eq("user_id", access.user.id);
  await access.admin.from("trusted_sessions").delete().eq("user_id", access.user.id).eq("method", "remembered_device");
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
