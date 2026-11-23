import { NextResponse } from "next/server";
import { prepareDemoSession } from "@/lib/demo/access";
import { isPublicDemoEnabled } from "@/lib/demo/config";

export async function POST(request: Request) {
  // Off unless switched on deliberately, and never on the live site (security review, 23 Nov 2026).
  if (!isPublicDemoEnabled(new URL(request.url).hostname)) {
    return NextResponse.json({ ok: false, message: "Demo access isn’t available." }, { status: 404 });
  }
  try {
    const payload = await prepareDemoSession({
      origin: new URL(request.url).origin,
    });
    return NextResponse.json({
      ok: true,
      demo: payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Demo access is unavailable.",
      },
      { status: 503 },
    );
  }
}
