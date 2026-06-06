import { NextResponse } from "next/server";

const ALLOWED_EVENT_PREFIXES = [
  "auth.callback.",
  "profile.avatar.",
  "shell.navigation.",
] as const;

type ClientEventPayload = {
  eventName?: unknown;
  payload?: unknown;
  pathname?: unknown;
  timestamp?: unknown;
};

export async function POST(request: Request) {
  let body: ClientEventPayload | null = null;
  try {
    body = (await request.json()) as ClientEventPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const eventName = typeof body.eventName === "string" ? body.eventName.slice(0, 120) : "";
  if (!ALLOWED_EVENT_PREFIXES.some((prefix) => eventName.startsWith(prefix))) {
    return NextResponse.json({ ok: false, error: "unsupported_event" }, { status: 400 });
  }

  const safePayload = sanitizePayload(body.payload);
  const pathname = typeof body.pathname === "string" ? body.pathname.slice(0, 200) : "";
  const timestamp = typeof body.timestamp === "string" ? body.timestamp.slice(0, 40) : new Date().toISOString();

  console.info("[lf:client-event]", JSON.stringify({
    eventName,
    pathname,
    timestamp,
    payload: safePayload,
  }));

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function sanitizePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(source).slice(0, 12)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("email") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("password") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("phone")
    ) {
      continue;
    }
    if (typeof raw === "string") safe[key] = raw.slice(0, 200);
    if (typeof raw === "number" && Number.isFinite(raw)) safe[key] = raw;
    if (typeof raw === "boolean") safe[key] = raw;
    if (raw === null) safe[key] = null;
  }
  return safe;
}
