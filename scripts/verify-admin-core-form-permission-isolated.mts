import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { validateFormPermissionFingerprintRequest } from "./fixtures/admin-core-form-permission-replay.mjs";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Read-only verification adapter for the current disposable database.
 * Reuses the public-table logical checksum expression from the existing
 * isolated-application-restore-verification owner; no rows leave PostgreSQL.
 */
export async function readCoreFormPermissionFingerprint(handle: OwnedLocalHandle, input: unknown) {
  assertOwnedLocalHandle(handle);
  const request = validateFormPermissionFingerprintRequest(input);
  const ownedRunId = handle.identity.runId;
  const captured = await handle.withDatabaseConnection(async connection => {
    await connection.query("begin isolation level repeatable read read only");
    let committed = false;
    try {
      await connection.query("set local statement_timeout='15000ms'");
      await connection.query("set local lock_timeout='3000ms'");
      const identity = (await connection.query("select current_database() database,current_user role,current_setting('transaction_read_only') readonly,current_setting('transaction_isolation') isolation")).rows[0];
      assert.equal(identity.database, "postgres");
      assert.equal(identity.role, "postgres", "All-public fingerprint requires the existing owned unrestricted reader.");
      assert.equal(identity.readonly, "on");
      assert.equal(identity.isolation, "repeatable read");
      const tables = (await connection.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(row => String(row.tablename));
      assert.ok(tables.length > 0 && tables.length <= 256, "Unexpected public table inventory size.");
      assert.equal(new Set(tables).size, tables.length);
      assert.ok(tables.includes("admin_audit_logs") && tables.includes("admin_users"), "Audit and identity dependencies are mandatory.");
      assert.ok(tables.every(name => /^[a-z][a-z0-9_]*$/u.test(name)), "Unexpected catalog identifier.");
      const deadline = Date.now() + 25_000;
      // Each owned query re-attests the disposable resource boundary. Aggregate
      // all validated catalog names in one statement, preserving every table's
      // original complete-row checksum without exporting any logical row.
      const statement = tables.map(table =>
        "select '" + table + "'::text as table_name, count(*)::text as count, md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) as hash from public.\"" + table + "\" t",
      ).join(" union all ");
      const rows = (await connection.query("select * from (" + statement + ") fingerprints order by table_name")).rows;
      assert.ok(Date.now() < deadline, "Public fingerprint exceeded its bounded read window.");
      assert.deepEqual(rows.map(row => row.table_name), tables, "Every catalog table must have exactly one ordered checksum.");
      const data = rows.map(row => {
        assert.match(String(row.count), /^(?:0|[1-9][0-9]*)$/u);
        assert.match(String(row.hash), /^[a-f0-9]{32}$/u);
        return { table: String(row.table_name), count: String(row.count), hash: String(row.hash) };
      });
      await connection.query("commit"); committed = true;
      return { publicTableCount: tables.length, publicTableInventorySha256: digest(JSON.stringify(tables)), publicDataSha256: digest(JSON.stringify(data)) };
    } finally {
      if (!committed) await connection.query("rollback");
    }
  });
  assertOwnedLocalHandle(handle);
  return { id: request.id, kind: request.kind, correlationId: request.correlationId, phase: request.phase,
    status: "pass", ownedRunId, ...captured, adminAuditIncluded: true, adminUsersIncluded: true,
    scope: "All current public tables and complete logical rows, including audit and dependent tables; hashes/count only. No row, credential, Auth/Storage schema, sequence or external-provider export." };
}
