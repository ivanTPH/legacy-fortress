import { NextResponse } from "next/server";
import { prepareDemoSession } from "@/lib/demo/access";

export async function POST(request: Request) {
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
