import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const {
  applyAdminUserLifecycleUpdate,
  planAdminUserLifecycleUpdate,
} = await import("../lib/admin/operations.ts");
const {
  AdminLifecycleError,
  checkAdminLifecycleRateLimit,
  noStoreJson,
  resetAdminLifecycleRateLimitForTests,
  toAdminLifecycleSafeError,
} = await import("../lib/admin/lifecycleSecurity.ts");
const {
  isAdminAccessGranted,
  MASTER_ADMIN_EMAIL,
} = await import("../lib/admin/access.ts");

const root = process.cwd();

class FakeSupabaseClient {
  constructor({ adminRows = [], auditFails = false } = {}) {
    this.adminRows = adminRows.map((row) => ({ ...row }));
    this.auditRows = [];
    this.auditFails = auditFails;
    this.updateCalls = 0;
  }

  from(table) {
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
    this.patch = null;
    this.insertRow = null;
    this.countMode = false;
  }

  select(_columns, options = {}) {
    this.countMode = Boolean(options.count);
    return this;
  }

  update(patch) {
    this.patch = patch;
    return this;
  }

  insert(row) {
    this.insertRow = row;
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ op: "neq", column, value });
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  single() {
    return this.execute({ single: true });
  }

  maybeSingle() {
    return this.execute({ single: true, maybe: true });
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute({ single = false, maybe = false } = {}) {
    if (this.table === "audit_events" && this.insertRow) {
      if (this.client.auditFails) return { data: null, error: { message: "relation audit_events failed" } };
      const row = { id: `audit-${this.client.auditRows.length + 1}`, ...this.insertRow };
      this.client.auditRows.push(row);
      return { data: { id: row.id }, error: null };
    }

    if (this.table !== "admin_users") return { data: single ? null : [], error: null, count: 0 };
    const matches = this.client.adminRows.filter((row) => this.filters.every((filter) => {
      if (filter.op === "eq") return row[filter.column] === filter.value;
      if (filter.op === "neq") return row[filter.column] !== filter.value;
      return true;
    }));

    if (this.countMode) return { data: null, error: null, count: matches.length };

    if (this.patch) {
      this.client.updateCalls += 1;
      const target = matches[0];
      if (!target) return { data: null, error: { message: "admin_users missing target" } };
      Object.assign(target, this.patch);
      return { data: { ...target }, error: null };
    }

    if (single) {
      if (!matches[0] && maybe) return { data: null, error: null };
      if (!matches[0]) return { data: null, error: { message: "admin_users missing target" } };
      return { data: { ...matches[0] }, error: null };
    }

    return { data: matches.map((row) => ({ ...row })), error: null };
  }
}

function adminRow(overrides = {}) {
  return {
    id: "admin-1",
    email_normalized: "target@example.com",
    user_id: "target-user",
    display_name: "Target Admin",
    status: "active",
    is_master: false,
    role: "support_agent",
    granted_by_user_id: "actor-user",
    created_at: "2026-07-19T00:00:00.000Z",
    updated_at: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

test("admin lifecycle update refuses to mutate unless an audit event id is supplied", async () => {
  const client = new FakeSupabaseClient({
    adminRows: [
      adminRow({ id: "target-admin", role: "support_agent" }),
      adminRow({ id: "master-admin", email_normalized: "master@example.com", role: "super_admin", is_master: true }),
    ],
  });
  const plan = await planAdminUserLifecycleUpdate(client, {
    adminUserId: "target-admin",
    action: "change_role",
    role: "auditor",
    actorUserId: "actor-user",
    reason: "least privilege",
  });

  await assert.rejects(
    () => applyAdminUserLifecycleUpdate(client, plan, { auditEventId: "" }),
    (error) => error instanceof AdminLifecycleError && error.code === "ADMIN_AUDIT_FAILED",
  );
  assert.equal(client.updateCalls, 0);
  assert.equal(client.adminRows.find((row) => row.id === "target-admin").role, "support_agent");
});

test("admin lifecycle update mutates only after audit id is present", async () => {
  const client = new FakeSupabaseClient({
    adminRows: [
      adminRow({ id: "target-admin", role: "support_agent" }),
      adminRow({ id: "master-admin", email_normalized: "master@example.com", role: "super_admin", is_master: true }),
    ],
  });
  const plan = await planAdminUserLifecycleUpdate(client, {
    adminUserId: "target-admin",
    action: "change_role",
    role: "auditor",
    actorUserId: "actor-user",
    reason: "least privilege",
  });

  const result = await applyAdminUserLifecycleUpdate(client, plan, { auditEventId: "audit-1" });
  assert.equal(result.after.role, "auditor");
  assert.equal(client.updateCalls, 1);
});

test("protected master identity cannot be deactivated or demoted", async () => {
  const client = new FakeSupabaseClient({
    adminRows: [
      adminRow({
        id: "protected-master",
        email_normalized: MASTER_ADMIN_EMAIL,
        user_id: "master-user",
        role: "super_admin",
        is_master: true,
      }),
      adminRow({ id: "other-master", email_normalized: "other-master@example.com", role: "super_admin", is_master: true }),
    ],
  });

  await assert.rejects(
    () => planAdminUserLifecycleUpdate(client, {
      adminUserId: "protected-master",
      action: "deactivate",
      actorUserId: "other-user",
      reason: "test",
    }),
    (error) => error instanceof AdminLifecycleError && error.code === "ADMIN_PROTECTED_ACCOUNT",
  );
  await assert.rejects(
    () => planAdminUserLifecycleUpdate(client, {
      adminUserId: "protected-master",
      action: "change_role",
      role: "support_agent",
      actorUserId: "other-user",
      reason: "test",
    }),
    (error) => error instanceof AdminLifecycleError && error.code === "ADMIN_PROTECTED_ACCOUNT",
  );
});

test("disabled admin rows are rejected on the next server access check", () => {
  assert.equal(isAdminAccessGranted("viewer@example.com", { status: "inactive", is_master: false }), false);
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, { status: "inactive", is_master: true }), false);
  assert.equal(isAdminAccessGranted(MASTER_ADMIN_EMAIL, { status: "active", is_master: true }), true);
});

test("last active super admin and self-demotion are blocked", async () => {
  const client = new FakeSupabaseClient({
    adminRows: [
      adminRow({ id: "last-master", role: "super_admin", is_master: true, user_id: "master-user" }),
    ],
  });

  await assert.rejects(
    () => planAdminUserLifecycleUpdate(client, {
      adminUserId: "last-master",
      action: "deactivate",
      actorUserId: "other-user",
      reason: "test",
    }),
    (error) => error instanceof AdminLifecycleError && error.code === "ADMIN_LAST_SUPER_ADMIN",
  );
  await assert.rejects(
    () => planAdminUserLifecycleUpdate(client, {
      adminUserId: "last-master",
      action: "change_role",
      role: "auditor",
      actorUserId: "master-user",
      reason: "test",
    }),
    (error) => error instanceof AdminLifecycleError && error.code === "ADMIN_SELF_ACTION_BLOCKED",
  );
});

test("arbitrary lifecycle roles and statuses are rejected safely", async () => {
  const client = new FakeSupabaseClient({ adminRows: [adminRow({ id: "target-admin" })] });
  await assert.rejects(
    () => planAdminUserLifecycleUpdate(client, {
      adminUserId: "target-admin",
      action: "change_role",
      role: "owner_god_mode",
      actorUserId: "actor-user",
      reason: "test",
    }),
    (error) => error instanceof AdminLifecycleError && error.code === "ADMIN_INVALID_ROLE",
  );
});

test("safe error mapping suppresses raw backend detail", () => {
  const safe = toAdminLifecycleSafeError(new Error("relation admin_users leaked SQL text"));
  assert.equal(safe.code, "ADMIN_INTERNAL_ERROR");
  assert.equal(safe.message, "Could not complete the admin change safely.");
  assert.equal(safe.diagnostic, "relation admin_users leaked SQL text");
});

test("privileged admin JSON responses are no-store and private", async () => {
  const response = noStoreJson({ ok: true });
  assert.equal(response.headers.get("Cache-Control"), "no-store, private");
});

test("admin lifecycle rate limiting is actor scoped and deterministic", () => {
  resetAdminLifecycleRateLimitForTests();
  const common = {
    actorId: "actor-1",
    sourceIp: "127.0.0.1",
    route: "/api/internal/admin/admin-users",
    action: "deactivate",
    now: 1_000,
    limit: 2,
    windowMs: 10_000,
  };
  assert.equal(checkAdminLifecycleRateLimit(common).ok, true);
  assert.equal(checkAdminLifecycleRateLimit({ ...common, now: 1_001 }).ok, true);
  assert.equal(checkAdminLifecycleRateLimit({ ...common, now: 1_002 }).ok, false);
  assert.equal(checkAdminLifecycleRateLimit({ ...common, actorId: "actor-2", now: 1_002 }).ok, true);
});

test("admin-users route is no-store, rate-limited, audit-gated, and suppresses raw errors", () => {
  const route = fs.readFileSync(path.join(root, "app/api/internal/admin/admin-users/route.ts"), "utf8");

  assert.match(route, /noStoreJson/);
  assert.match(route, /checkAdminLifecycleRateLimit/);
  assert.match(route, /recordAdminAuditEvent[\s\S]*applyAdminUserLifecycleUpdate/);
  assert.match(route, /safeAdminErrorResponse\(error\)/);
  assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
});

test("admin lifecycle UI mirrors protected account and safe-error rules", () => {
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminOpsWorkspace.tsx"), "utf8");

  assert.match(workspace, /isProtectedMasterAdmin/);
  assert.match(workspace, /Protected master admin/);
  assert.match(workspace, /window\.confirm/);
  assert.match(workspace, /getAdminActionMessage\(json\.code/);
  assert.match(workspace, /ADMIN_RATE_LIMITED/);
  assert.match(workspace, /ADMIN_AUDIT_FAILED/);
});
