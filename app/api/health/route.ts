import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "legacy-fortress-web",
    timestamp: new Date().toISOString(),
  });
}
