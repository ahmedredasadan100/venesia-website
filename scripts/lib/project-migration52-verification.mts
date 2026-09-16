import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./isolated-supabase.mts";
import type { ApplicationMigrationCheckpoint } from "./isolated-public-application.mts";

const migrationUrl = new URL("../../sql/migrations/20260729150000_project_admin_schema_parity_forward_fix.sql", import.meta.url);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Snapshot = {
  constraints: Record<string, unknown>[];
  columns: Record<string, unknown>[];
  summary: Record<string, unknown>;
  registry: Array<{ version: string; name: string; statementCount: number; statementsSha256: string }>;
};

/** Catalog observer only. The application migration remains the schema owner. */
export function projectMigration52Checkpoint(
  retain: (boundary: "before" | "after", snapshot: Snapshot) => void,
): ApplicationMigrationCheckpoint {
  let before: Snapshot | undefined;
  const sql = readFileSync(migrationUrl, "utf8").replace(/\r\n?/gu, "\n");
  const lock = /lock table([\s\S]*?)in share row exclusive mode;/u.exec(sql);
  assert.ok(lock);
  const tables = [...lock[1].matchAll(/public\.([a-z_]+)/gu)].map(match => match[1]);
  assert.equal(tables.length, 9);
  assert.equal(new Set(tables).size, 9);
  return { version: "20260729150000", async observe(handle: OwnedLocalHandle, boundary) {
    assertOwnedLocalHandle(handle);
    await handle.query("begin transaction isolation level repeatable read read only");
    let snapshot: Snapshot;
    try {
      const constraints = (await handle.query(`select c.oid::text as oid,t.relname as table_name,c.conname as name,
        c.contype as type,to_jsonb(c) as catalog,pg_get_constraintdef(c.oid,false) as definition,
        case when c.contype='c' then pg_get_expr(c.conbin,c.conrelid,false) end as expression,
        array(select a.attname::text from unnest(c.conkey) with ordinality k(attnum,ord)
          join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum order by k.ord) as columns,
        case when c.confrelid<>0 then c.confrelid::regclass::text end as referenced_table,
        array(select a.attname::text from unnest(c.confkey) with ordinality k(attnum,ord)
          join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.attnum order by k.ord) as referenced_columns
        from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
        where n.nspname='public' and t.relname=any($1::text[]) order by t.relname,c.contype,c.conname`, [tables])).rows;
      const columns = (await handle.query(`select t.relname as table_name,a.attnum,a.attname,to_jsonb(a) as catalog,
        pg_get_expr(d.adbin,d.adrelid,false) as default_expression
        from pg_class t join pg_namespace n on n.oid=t.relnamespace join pg_attribute a on a.attrelid=t.oid
        left join pg_attrdef d on d.adrelid=t.oid and d.adnum=a.attnum
        where n.nspname='public' and t.relname=any($1::text[]) and a.attnum>0 order by t.relname,a.attnum`, [tables])).rows;
      const summary = (await handle.query(`select count(*) filter(where c.contype='p')::int as primary_keys,
        count(*) filter(where c.contype='f')::int as foreign_keys,count(*) filter(where c.contype='u')::int as unique_constraints,
        count(*) filter(where c.contype='c')::int as checks,count(*) filter(where c.condeferrable)::int as deferrable,
        count(*) filter(where c.condeferred)::int as initially_deferred,bool_and(c.convalidated) as all_validated,
        bool_and(c.conislocal and c.coninhcount=0 and c.conparentid=0) as all_local,
        bool_and(case when c.contype='c' then not c.connoinherit else c.connoinherit end) as inheritance_flags
        from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
        where n.nspname='public' and t.relname=any($1::text[]) and c.contype in ('p','f','u','c')`, [tables])).rows[0];
      const rows = (await handle.query("select version,name,statements from supabase_migrations.schema_migrations order by version")).rows;
      const registry = rows.map(row => {
        assert.ok(typeof row.version === "string" && typeof row.name === "string" && Array.isArray(row.statements));
        return { version: row.version, name: row.name, statementCount: row.statements.length, statementsSha256: hash(row.statements) };
      });
      snapshot = { constraints, columns, summary, registry };
      await handle.query("commit");
    } catch (error) { await handle.query("rollback").catch(() => undefined); throw error; }
    retain(boundary, snapshot);
    assert.equal(snapshot.constraints.length, 99);
    assert.equal(snapshot.columns.length, 114);
    assert.deepEqual(snapshot.summary, { primary_keys: 9, foreign_keys: 12, unique_constraints: 24, checks: 54,
      deferrable: 7, initially_deferred: 7, all_validated: true, all_local: true, inheritance_flags: true });
    if (boundary === "before") {
      assert.equal(snapshot.registry.length, 51);
      assert.equal(snapshot.registry.at(-1)?.version, "20260729090000");
      before = snapshot;
    } else {
      assert.ok(before);
      assert.deepEqual(snapshot.constraints, before.constraints, "Fresh compatible CHECKs must retain their exact OIDs, names, definitions and properties.");
      assert.equal(snapshot.registry.length, 52);
      assert.deepEqual(snapshot.registry.slice(0, 51), before.registry, "Historical CLI rows must remain unchanged.");
      assert.equal(snapshot.registry.at(-1)?.version, "20260729150000");
      handle.record("project-migration52-parity", { primaryKeys: 9, foreignKeys: 12, uniqueConstraints: 24, checks: 54,
        deferrable: 7, initiallyDeferred: 7, originalConstraintsUnchanged: true, duplicateConstraints: false,
        registryRows: 52, priorRegistryUnchanged: true, canonicalWholeFileRegistryVerified: false });
    }
  } };
}
