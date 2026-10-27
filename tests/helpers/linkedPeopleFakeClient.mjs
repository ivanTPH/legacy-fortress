import assert from "node:assert/strict";

export function createLinkedPeopleFakeClient({ ownerId = "owner-1", sessionUserId = ownerId, locked = false } = {}) {
  const db = {
    assets: [{ id: "asset-1", owner_user_id: ownerId, deleted_at: null }, { id: "asset-2", owner_user_id: ownerId, deleted_at: null }],
    records: [{ id: "record-1", owner_user_id: ownerId }, { id: "record-2", owner_user_id: ownerId }],
    contacts: [], record_links: [], contact_links: [], contact_invitations: [], role_assignments: [], account_access_grants: [],
  };
  const writes = [];
  let failLinkOnce = false;
  let nextId = 1;

  class Query {
    constructor(table) { this.table = table; this.filters = []; this.action = "read"; }
    select() { return this; }
    eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
    neq(key, value) { this.filters.push((row) => row[key] !== value); return this; }
    in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
    is(key, value) { this.filters.push((row) => row[key] === value); return this; }
    order() { return this; }
    limit() { return this; }
    insert(payload) { this.action = "insert"; this.payload = payload; return this; }
    update(payload) { this.action = "update"; this.payload = payload; return this; }
    async run() {
      const rows = db[this.table];
      assert.ok(rows, `unexpected table ${this.table}`);
      if (this.action === "read") return { data: rows.filter((row) => this.filters.every((filter) => filter(row))), error: null };
      assert.notEqual(this.table, "account_access_grants", "linking and inviting must not mutate access grants");
      if (this.action === "insert") {
        writes.push({ table: this.table, payload: this.payload });
        if (this.table === "record_links" && failLinkOnce) {
          failLinkOnce = false;
          return { data: null, error: { code: "500", message: "synthetic link failure" } };
        }
        if (this.table === "record_links" && rows.some((row) => row.owner_user_id === this.payload.owner_user_id && row.record_type === this.payload.record_type && row.record_id === this.payload.record_id && row.person_id === this.payload.person_id && row.removed_at === null)) {
          return { data: null, error: { code: "23505", message: "duplicate link" } };
        }
        const row = { id: `${this.table}-${nextId++}`, created_at: "2026-10-27T10:00:00Z", updated_at: "2026-10-27T10:00:00Z", removed_at: null, ...this.payload };
        rows.push(row);
        return { data: row, error: null };
      }
      const matched = rows.filter((row) => this.filters.every((filter) => filter(row)));
      for (const row of matched) Object.assign(row, this.payload);
      writes.push({ table: this.table, payload: this.payload });
      return { data: matched, error: null };
    }
    async maybeSingle() { const result = await this.run(); return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data ?? null }; }
    async single() { const result = await this.maybeSingle(); return result.data ? result : { data: null, error: result.error ?? { message: "no row" } }; }
    then(resolve, reject) { return this.run().then(resolve, reject); }
  }

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: sessionUserId, email: "owner@example.test" } }, error: null }) },
    rpc: async (name, args) => {
      assert.equal(name, "lf_vault_allows_owner_mutation");
      return { data: !locked && sessionUserId === args.p_owner_user_id, error: null };
    },
    from(table) { return new Query(table); },
  };
  return {
    client, db, writes,
    seedContact(person) {
      const row = { id: person.id ?? `person-${nextId++}`, owner_user_id: ownerId, full_name: person.full_name, email: person.email ?? null, email_normalized: person.email?.toLowerCase() ?? null, phone: person.phone ?? null, relationship: person.relationship ?? null, contact_role: person.contact_role ?? null, linked_context: [], invite_status: person.invite_status ?? "not_invited", verification_status: "not_verified", source_type: "manual", created_at: "2026-10-27T10:00:00Z", updated_at: "2026-10-27T10:00:00Z" };
      db.contacts.push(row); return row;
    },
    failNextLink() { failLinkOnce = true; },
  };
}
