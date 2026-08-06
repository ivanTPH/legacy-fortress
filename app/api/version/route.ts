import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      name: "legacy-fortress-web",
      version: process.env.npm_package_version ?? "0.0.0",
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      buildId: getRuntimeBuildId(),
      commitSha: getRuntimeCommitSha(),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}

function getRuntimeBuildId() {
  return getRuntimeCommitSha()?.slice(0, 12) || process.env.LF_BUILD_ID || "unknown";
}

function getRuntimeCommitSha() {
  const fromEnv =
    process.env.LF_BUILD_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.SOURCE_COMMIT ||
    process.env.COOLIFY_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "";
  if (/^[0-9a-f]{7,40}$/i.test(fromEnv)) return fromEnv;
  try {
    const childProcess = (process as typeof process & {
      getBuiltinModule?: (name: "node:child_process") => { execSync: (command: string, options: { encoding: "utf8"; stdio: ["ignore", "pipe", "ignore"] }) => string };
    }).getBuiltinModule?.("node:child_process");
    const commit = childProcess?.execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() ?? "";
    return /^[0-9a-f]{7,40}$/i.test(commit) ? commit : null;
  } catch {
    return null;
  }
}
