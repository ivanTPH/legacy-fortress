import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "legacy-fortress-web",
    version: process.env.npm_package_version ?? "0.0.0",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  });
}
