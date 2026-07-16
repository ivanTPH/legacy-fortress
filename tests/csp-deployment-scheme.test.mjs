import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

async function loadGeneratedConfig(env) {
  const source = fs.readFileSync("next.config.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    process: { env },
    URL,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(compiled, sandbox, { filename: "next.config.ts" });

  return sandbox.module.exports.default;
}

async function loadGeneratedCsp(env) {
  const config = await loadGeneratedConfig(env);
  const headerGroups = await config.headers();
  const rootHeaders = headerGroups.find((group) => group.source === "/:path*")?.headers ?? [];
  return rootHeaders.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
}

function assertBaselineSecurityDirectives(csp) {
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /img-src 'self' data: blob: https:/);
  assert.match(csp, /font-src 'self' data: https:/);
  assert.match(csp, /connect-src 'self' https:/);
  assert.match(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
}

test("HTTP deployment CSP omits upgrade-insecure-requests without weakening other directives", async () => {
  const csp = await loadGeneratedCsp({
    NODE_ENV: "production",
    COOLIFY_URL: "http://staging.example.test",
  });

  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  assertBaselineSecurityDirectives(csp);
});

test("HTTPS deployment CSP includes upgrade-insecure-requests and preserves other directives", async () => {
  const csp = await loadGeneratedCsp({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://staging.example.test",
  });

  assert.match(csp, /upgrade-insecure-requests/);
  assertBaselineSecurityDirectives(csp);
});

test("production CSP keeps upgrade-insecure-requests when no deployment URL is configured", async () => {
  const csp = await loadGeneratedCsp({
    NODE_ENV: "production",
  });

  assert.match(csp, /upgrade-insecure-requests/);
  assertBaselineSecurityDirectives(csp);
});

test("browser bundles receive only public Supabase configuration from build env", async () => {
  const config = await loadGeneratedConfig({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://staging.example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-service-role",
  });

  assert.deepEqual(JSON.parse(JSON.stringify(config.env)), {
    NEXT_PUBLIC_SUPABASE_URL: "https://staging.example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
  });
});
