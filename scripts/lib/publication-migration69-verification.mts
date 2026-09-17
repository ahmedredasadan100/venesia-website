import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./isolated-supabase.mts";

export const PUBLICATION_MIGRATION69_VERSION = "20260807120000";
const sourceUrl = new URL("../../sql/migrations/20260807120000_system_publication_summary_cards_closure.sql", import.meta.url);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Row = Record<string, unknown>;
type StatusRow = { id: string; status: string | null; unrelatedHash: string; compatibilityHash: string;
  compatibilityValue: boolean | null };

/** Bounded source evidence for this migration, not a SQL execution/parser owner.
 * Only complete top-level statements can prove its DDL/DML contract. Comments
 * are trivia; quoted values/identifiers remain case-sensitive; dollar bodies
 * are opaque so PL/pgSQL strings cannot masquerade as executable outer DDL.
 * Catalog/row semantics remain owned by verifyPublication69Transition below. */
function publicationStatements(sql: string): string[] {
  const statements: string[] = [];
  let tokens: string[] = [];
  let offset = 0;
  while (offset < sql.length) {
    const rest = sql.slice(offset);
    const trivia = /^(?:\s+|--[^\r\n]*)/u.exec(rest);
    if (trivia) { offset += trivia[0].length; continue; }
    if (rest.startsWith("/*")) {
      offset += 2;
      let depth = 1;
      while (depth && offset < sql.length) {
        if (sql.startsWith("/*", offset)) { depth++; offset += 2; }
        else if (sql.startsWith("*/", offset)) { depth--; offset += 2; }
        else offset++;
      }
      assert.equal(depth, 0, "Unterminated publication SQL comment.");
      continue;
    }
    const delimiter = /^(?:\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)/u.exec(rest)?.[0];
    if (delimiter) {
      const end = sql.indexOf(delimiter, offset + delimiter.length);
      assert.ok(end >= 0, "Unterminated publication SQL body.");
      tokens.push("<quoted-body>");
      offset = end + delimiter.length;
      continue;
    }
    const quote = sql[offset];
    if (quote === "'" || quote === '"') {
      const start = offset++;
      const escaped = quote === "'" && /(?:^|[^A-Za-z_0-9])e$/iu.test(sql.slice(0, start));
      let closed = false;
      while (offset < sql.length) {
        if (escaped && sql[offset] === "\\") { offset += 2; continue; }
        if (sql[offset++] !== quote) continue;
        if (sql[offset] === quote) { offset++; continue; }
        closed = true;
        break;
      }
      assert.ok(closed, "Unterminated publication SQL literal/identifier.");
      tokens.push(sql.slice(start, offset));
      continue;
    }
    if (quote === ";") {
      if (tokens.length) statements.push(tokens.join(" "));
      tokens = [];
      offset++;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z_0-9$]*/u.exec(rest)?.[0];
    tokens.push(word ? word.toLowerCase() : quote);
    offset += word?.length ?? 1;
  }
  assert.equal(tokens.length, 0, "Publication SQL must terminate every outer statement.");
  return statements;
}

function publicationEntries(statements: string[]) {
  return statements.flatMap(statement => {
    const match = /^alter table public \. ([a-z_]+) alter column ([a-z_]+) set default 'unpublished'$/u.exec(statement);
    return match ? [{ table: match[1], column: match[2] }] : [];
  });
}

/** Source-only companion to the existing catalog transition proof. Accept
 * formatting/trivia changes, but fail closed on unreviewed DDL/DML shapes. */
export function assertPublication69Source(sql: string, expectedTables: readonly string[]) {
  const statements = publicationStatements(sql);
  assert.equal(statements[0], "begin", "Publication transition must be transactional.");
  assert.equal(statements.at(-1), "commit", "Publication transition must commit after validation.");
  assert.equal(statements.filter(statement => /^(?:begin|commit|rollback)\b/u.test(statement)).length, 2);
  const entries = publicationEntries(statements);
  assert.equal(expectedTables.length, 13);
  assert.equal(new Set(expectedTables).size, 13);
  assert.deepEqual(entries.map(entry => entry.table).sort(), [...expectedTables].sort(), "Publication table inventory drifted.");
  const exactlyOnce = (statement: string) => {
    const indices = statements.flatMap((value, index) => value === statement ? [index] : []);
    assert.equal(indices.length, 1, `Expected one executable statement: ${statement}`);
    return indices[0];
  };
  const pages = { constraint: -1, mapping: -1, validation: -1 };
  for (const { table, column } of entries) {
    assert.equal(column, table === "projects" ? "publication_status" : "status");
    const relation = `public . ${table}`;
    const constraint = `${table}_${column}_check`;
    const prefix = `alter table ${relation} `;
    const alters = statements.filter(statement => statement.startsWith(prefix));
    const defaultIndex = exactlyOnce(`${prefix}alter column ${column} set default 'unpublished'`);
    const notNullIndex = exactlyOnce(`${prefix}alter column ${column} set not null`);
    const additions = alters.filter(statement => statement.includes(" add constraint "));
    assert.equal(additions.length, 1, `${table}: missing/ambiguous final CHECK.`);
    const add = additions[0].slice(prefix.length);
    const checkSource = table === "pages"
      ? add.replace(/^drop constraint pages_status_check , /u, "") : add;
    if (table === "pages") assert.notEqual(checkSource, add, "Pages must replace the legacy CHECK atomically.");
    const check = /^add constraint ([a-z_]+) check \( ([a-z_]+) in \( ('[^']*') , ('[^']*') \) \)( not valid)?$/u.exec(checkSource);
    assert.ok(check, `${table}: unrecognized final CHECK contract.`);
    assert.equal(check[1], constraint, `${table}: CHECK name differs.`);
    assert.equal(check[2], column, `${table}: CHECK column differs.`);
    assert.deepEqual([check[3], check[4]].sort(), ["'published'", "'unpublished'"], `${table}: allowed statuses differ.`);
    assert.equal(Boolean(check[5]), table === "pages", `${table}: CHECK validation mode differs.`);
    const addIndex = exactlyOnce(additions[0]);
    const mapping = table === "topic_categories"
      ? `update ${relation} set status = case when status = 'published' then 'published' else 'unpublished' end , is_active = ( status = 'published' )`
      : table === "hero_templates"
        ? `update ${relation} set status = case when is_visible then 'published' else 'unpublished' end where status is null or status not in ( 'published' , 'unpublished' )`
        : `update ${relation} set ${column} = 'unpublished' where ${column} is distinct from 'published'`;
    const mappingIndex = exactlyOnce(mapping);
    assert.equal(statements.filter(statement => statement.startsWith(`update ${relation} `)).length, 1,
      `${table}: unexpected additional normalization/write.`);
    assert.ok(mappingIndex < defaultIndex && mappingIndex < notNullIndex, `${table}: mapping must precede column finalization.`);
    if (table === "pages") {
      const lockIndex = exactlyOnce(`lock table ${relation} in access exclusive mode`);
      const validationIndex = exactlyOnce(`${prefix}validate constraint ${constraint}`);
      assert.ok(lockIndex < addIndex && addIndex < mappingIndex && mappingIndex < validationIndex,
        "Pages require lock -> compatible CHECK -> mapping -> VALIDATE.");
      assert.equal(alters.length, 4, "Unexpected Pages DDL can invalidate the proved contract.");
      Object.assign(pages, { constraint: addIndex, mapping: mappingIndex, validation: validationIndex });
    } else {
      const dropIndex = exactlyOnce(`${prefix}drop constraint if exists ${constraint}`);
      assert.ok(mappingIndex < dropIndex && dropIndex < addIndex, `${table}: CHECK replacement ordering differs.`);
      if (table === "hero_templates") {
        assert.ok(exactlyOnce(`${prefix}add column if not exists status text`) < mappingIndex);
      }
      assert.equal(alters.length, table === "hero_templates" ? 5 : 4, `${table}: unexpected publication DDL.`);
    }
  }
  // Extra writes, CTE-wrapped writes or table DDL cannot borrow proof from the
  // reviewed statements. Function/DO bodies are covered by existing runtime and
  // provenance proofs; their quoted contents are never positive source evidence.
  for (const statement of statements) {
    if (/^(?:update|alter table)\b/u.test(statement)) {
      assert.ok(entries.some(({ table }) => statement.startsWith(`update public . ${table} `)
        || statement.startsWith(`alter table public . ${table} `)), "Unreviewed publication relation.");
    }
    assert.ok(!/^(?:with|insert|delete|merge|truncate|drop table|create table|set|reset|savepoint|release|end|abort|start|prepare|execute|call)\b/u.test(statement),
      "Unreviewed outer write/DDL/session control in publication migration.");
  }
  return { entries, pages };
}

/** Derive the affected inventory from this migration's actual default contract. */
export function readPublication69Contract() {
  const sql = readFileSync(sourceUrl, "utf8").replace(/\r\n?/gu, "\n");
  const entries = publicationEntries(publicationStatements(sql));
  assert.equal(entries.length, 13, "Migration69's reviewed entity inventory changed.");
  assert.equal(new Set(entries.map(entry => entry.table)).size, entries.length);
  assert.ok(entries.every(entry => entry.column === (entry.table === "projects" ? "publication_status" : "status")));
  return { sql, sourceSha256: createHash("sha256").update(sql).digest("hex"), entries };
}

export type Publication69Snapshot = {
  sourceSha256: string;
  statuses: Array<{ table: string; column: string; columnPresent: boolean; count: number;
    counts: Row[]; tableDataHash: string; unrelatedDataHash: string; compatibilityDataHash: string }>;
  rows: Record<string, StatusRow[]>;
  pages: StatusRow[];
  pagesMapping: Row[];
  checkEvaluations: Row[];
  relations: Row[];
  columns: Row[];
  constraints: Row[];
  indexes: Row[];
  triggers: Row[];
  views: Row[];
  functions: Row[];
  registry: Row[];
};

/** Evaluate the actual catalog CHECK and the unchanged source mapping using
 * SELECT inputs. This never inserts or updates a synthetic legacy status. */
export async function evaluatePagePublication69Mapping(handle: OwnedLocalHandle, constraints: Row[]): Promise<Row[]> {
  assertOwnedLocalHandle(handle);
  const { sql } = readPublication69Contract();
  assert.match(sql, /update public\.pages\s+set status = 'unpublished'\s+where status is distinct from 'published';/u);
  const checks = constraints.filter(row => row.relname === "pages" && row.conname === "pages_status_check" && row.contype === "c");
  assert.equal(checks.length, 1);
  const check = checks[0];
  assert.deepEqual(check.columns, ["status"]);
  assert.ok(typeof check.expression === "string" && check.expression.length > 0);
  return (await handle.query(`with inputs as (select unnest($1::text[]) as status),
    original as (select status,(${check.expression}) as original_accepts from inputs),
    mapped as (select status as input_status,
      case when status is distinct from 'published' then 'unpublished' else status end as status from inputs),
    evaluated as (select input_status,status as mapped_status,(${check.expression}) as accepts_mapped from mapped)
    select evaluated.*,original.original_accepts from evaluated join original
      on original.status is not distinct from evaluated.input_status
    order by evaluated.input_status nulls first`, [["draft", "published", "hidden", "archived", "unpublished"]])).rows;
}

/** SELECT-only snapshot. No alternate migrations, mutation probes or seed data. */
export async function capturePublication69(handle: OwnedLocalHandle): Promise<Publication69Snapshot> {
  assertOwnedLocalHandle(handle);
  const { entries, sourceSha256 } = readPublication69Contract();
  const tables = entries.map(entry => entry.table);
  await handle.query("begin transaction isolation level repeatable read read only");
  try {
    const relations = (await handle.query(`select c.oid::text as oid,c.relname,c.relkind,
      pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as acl
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','v','m','p') order by c.relname`)).rows;
    const columns = (await handle.query(`select c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) as type,
      a.attnotnull,a.attidentity,a.attgenerated,a.attislocal,a.attinhcount,a.attisdropped,
      pg_get_expr(d.adbin,d.adrelid,false) as default_expression
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where n.nspname='public' and c.relname=any($1::text[]) and a.attnum>0 order by c.relname,a.attnum`, [tables])).rows;
    const constraints = (await handle.query(`select c.relname,k.conname,k.contype,
      to_jsonb(k) as catalog,pg_get_constraintdef(k.oid,false) as definition,
      pg_get_expr(k.conbin,k.conrelid,false) as expression,
      array(select a.attname::text from unnest(k.conkey) with ordinality key(attnum,ordinal)
        join pg_attribute a on a.attrelid=k.conrelid and a.attnum=key.attnum order by key.ordinal) as columns
      from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' order by c.relname,k.conname`)).rows;
    const indexes = (await handle.query(`select c.relname,to_jsonb(i) as catalog,pg_get_indexdef(i.indexrelid) as definition
      from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' order by c.relname,i.indexrelid`)).rows;
    const triggers = (await handle.query(`select c.relname,t.tgname,to_jsonb(t) as catalog,pg_get_triggerdef(t.oid,false) as definition
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' order by c.relname,t.tgname`)).rows;
    const views = (await handle.query(`select c.relname,c.relkind,c.reloptions,
      encode(sha256(convert_to(pg_get_viewdef(c.oid,false),'UTF8')),'hex') as source_sha256
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('v','m') order by c.relname`)).rows;
    const functions = (await handle.query(`select p.oid::text as oid,p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,
      p.proconfig,p.proacl::text as acl,pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_function_result(p.oid) as result,
      encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as source_sha256
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind in ('f','p') order by p.proname,arguments`)).rows;
    const registry = (await handle.query("select version,name,statements from supabase_migrations.schema_migrations order by version")).rows.map(row => ({
      version: row.version, name: row.name, statementCount: Array.isArray(row.statements) ? row.statements.length : -1,
      statementsSha256: digest(row.statements),
    }));
    const statuses: Publication69Snapshot["statuses"] = [];
    const rows: Record<string, StatusRow[]> = {};
    for (const { table, column } of entries) {
      assert.ok(relations.some(row => row.relname === table && row.relkind === "r"));
      const columnPresent = columns.some(row => row.relname === table && row.attname === column && row.attisdropped === false);
      // Hero publication status is introduced by69; visibility is its original input.
      assert.ok(columnPresent || table === "hero_templates", "Unexpected missing status column.");
      const status = columnPresent ? `"${column}"::text` : "null::text";
      const compatibility = table === "topic_categories" ? "is_active" : table === "hero_templates" ? "is_visible" : null;
      const result = (await handle.query(`select id::text as id,${status} as status,
        md5((to_jsonb(t)-'${column}')::text) as "unrelatedHash",
        md5((to_jsonb(t)-'${column}'${compatibility ? `-'${compatibility}'` : ""})::text) as "compatibilityHash",
        ${compatibility ? `"${compatibility}"` : "null::boolean"} as "compatibilityValue",
        md5(to_jsonb(t)::text) as whole_hash
        from public."${table}" t order by id`)).rows;
      rows[table] = result.map(row => ({ id: String(row.id), status: row.status as string | null,
        unrelatedHash: String(row.unrelatedHash), compatibilityHash: String(row.compatibilityHash),
        compatibilityValue: row.compatibilityValue as boolean | null }));
      const counts = (await handle.query(`select ${status} as status,count(*)::int as count
        from public."${table}" group by 1 order by 1 nulls first`)).rows;
      statuses.push({ table, column, columnPresent, count: result.length, counts,
        tableDataHash: digest(result.map(row => row.whole_hash)),
        unrelatedDataHash: digest(rows[table].map(row => ({ id: row.id, hash: row.unrelatedHash }))),
        compatibilityDataHash: digest(rows[table].map(row => ({ id: row.id, hash: row.compatibilityHash }))) });
    }
    const pagesMapping = await evaluatePagePublication69Mapping(handle, constraints);
    const checkQueries: string[] = [];
    for (const { table, column } of entries) {
      const checks = constraints.filter(row => row.relname === table && row.conname === `${table}_${column}_check` && row.contype === "c");
      assert.ok(checks.length <= 1);
      if (checks.length === 0) continue;
      assert.deepEqual(checks[0].columns, [column]);
      assert.equal(typeof checks[0].expression, "string");
      checkQueries.push(`select '${table}'::text as table_name,"${column}" as input_status,
        (${checks[0].expression}) as accepts from (select unnest($1::text[]) as "${column}") samples`);
    }
    const checkEvaluations = checkQueries.length ? (await handle.query(`${checkQueries.join(" union all ")} order by table_name,input_status nulls first`,
      [[null, "published", "unpublished", "draft", "hidden", "archived", "__qa_invalid__"]])).rows : [];
    await handle.query("commit");
    return { sourceSha256, statuses, rows, pages: rows.pages, pagesMapping, checkEvaluations,
      relations, columns, constraints, indexes, triggers, views, functions, registry };
  } catch (error) { await handle.query("rollback").catch(() => undefined); throw error; }
}

const catalog = (row: Row): Row => {
  assert.ok(row.catalog !== null && typeof row.catalog === "object" && !Array.isArray(row.catalog));
  return row.catalog as Row;
};
const without = (row: Row, fields: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));

/** Pure comparison of two actual snapshots. It does not supply migration SQL,
 * rewrite history, or infer successful execution from expected target values. */
export function verifyPublication69Transition(before: Publication69Snapshot, after: Publication69Snapshot) {
  const { entries, sql, sourceSha256 } = readPublication69Contract();
  assert.equal(before.sourceSha256, sourceSha256, "Before snapshot used a different69 source.");
  assert.equal(after.sourceSha256, sourceSha256, "After snapshot used a different69 source.");
  assert.equal(before.registry.length, 68);
  assert.equal(before.registry.at(-1)?.version, "20260807090000");
  assert.equal(after.registry.length, 69);
  assert.deepEqual(after.registry.slice(0, 68), before.registry, "Previously registered migrations changed.");
  assert.equal(after.registry[68].version, PUBLICATION_MIGRATION69_VERSION);
  assert.equal(after.registry[68].name, "system_publication_summary_cards_closure");
  assert.ok(Number(after.registry[68].statementCount) > 0);
  assert.match(String(after.registry[68].statementsSha256), /^[a-f0-9]{64}$/u);
  assert.deepEqual(after.relations, before.relations, "Relation ownership/RLS/ACL changed.");
  assert.deepEqual(after.indexes, before.indexes, "Indexes changed.");
  assert.deepEqual(after.views, before.views, "Views changed.");
  const isStatusColumn = (row: Row) => entries.some(entry => row.relname === entry.table && row.attname === entry.column);
  assert.deepEqual(after.columns.filter(row => !isStatusColumn(row)), before.columns.filter(row => !isStatusColumn(row)),
    "A non-publication column changed.");
  const isStatusCheck = (row: Row) => entries.some(entry => row.relname === entry.table
    && row.conname === `${entry.table}_${entry.column}_check` && row.contype === "c");
  assert.deepEqual(after.constraints.filter(row => !isStatusCheck(row)), before.constraints.filter(row => !isStatusCheck(row)),
    "An unrelated constraint changed.");
  let mappedRows = 0;
  for (const { table, column } of entries) {
    const beforeState = before.statuses.filter(row => row.table === table);
    const afterState = after.statuses.filter(row => row.table === table);
    assert.equal(beforeState.length, 1); assert.equal(afterState.length, 1);
    assert.equal(afterState[0].columnPresent, true);
    assert.equal(afterState[0].count, beforeState[0].count, `${table}: row population changed.`);
    assert.ok(afterState[0].counts.every(row => row.status === "published" || row.status === "unpublished"), `${table}: invalid status remains.`);
    const targetColumns = after.columns.filter(row => row.relname === table && row.attname === column);
    assert.equal(targetColumns.length, 1);
    const targetColumn = targetColumns[0];
    assert.equal(targetColumn.type, "text"); assert.equal(targetColumn.attnotnull, true);
    assert.equal(targetColumn.default_expression, "'unpublished'::text");
    assert.equal(targetColumn.attisdropped, false); assert.equal(targetColumn.attislocal, true);
    assert.equal(targetColumn.attinhcount, 0); assert.equal(targetColumn.attidentity, "");
    assert.equal(targetColumn.attgenerated, "");
    const previousColumn = before.columns.find(row => row.relname === table && row.attname === column);
    if (previousColumn) assert.deepEqual(without(targetColumn, ["attnotnull", "default_expression"]),
      without(previousColumn, ["attnotnull", "default_expression"]), `${table}: status column identity changed.`);
    else {
      assert.equal(table, "hero_templates");
      assert.equal(targetColumn.attnum, Math.max(...before.columns.filter(row => row.relname === table).map(row => Number(row.attnum))) + 1);
    }
    const checks = after.constraints.filter(row => row.relname === table && row.conname === `${table}_${column}_check`);
    assert.equal(checks.length, 1); assert.equal(checks[0].contype, "c");
    assert.deepEqual(checks[0].columns, [column]);
    const expression = `(${column} = ANY (ARRAY['published'::text, 'unpublished'::text]))`;
    assert.equal(checks[0].expression, expression);
    assert.equal(checks[0].definition, `CHECK (${expression})`);
    const check = catalog(checks[0]);
    for (const field of ["convalidated", "conislocal"]) assert.equal(check[field], true);
    for (const field of ["condeferrable", "condeferred", "connoinherit"]) assert.equal(check[field], false);
    assert.equal(check.coninhcount, 0);
    for (const field of ["conparentid", "contypid", "confrelid", "conindid"]) assert.equal(String(check[field]), "0");
    assert.equal(check.confkey, null); assert.deepEqual(check.conkey, [targetColumn.attnum]);
    assert.equal(after.constraints.filter(row => row.relname === table && row.contype === "c" && row.expression === expression).length, 1,
      `${table}: duplicate equivalent binary CHECK.`);
    const evaluations = after.checkEvaluations.filter(row => row.table_name === table);
    assert.equal(evaluations.length, 7);
    assert.equal(new Set(evaluations.map(row => row.input_status)).size, 7);
    for (const sample of evaluations) assert.equal(sample.accepts, sample.input_status === null ? null
      : sample.input_status === "published" || sample.input_status === "unpublished", `${table}: CHECK truth table differs.`);
    const priorRows = before.rows[table], nextRows = after.rows[table];
    assert.deepEqual(nextRows.map(row => row.id), priorRows.map(row => row.id), `${table}: row identities changed.`);
    for (const [index, previous] of priorRows.entries()) {
      const next = nextRows[index];
      const expected = table === "hero_templates" && previous.status !== "published" && previous.status !== "unpublished"
        ? previous.compatibilityValue === true ? "published" : "unpublished"
        : previous.status === "published" ? "published" : "unpublished";
      assert.equal(next.status, expected, `${table}: original status mapping changed for ${previous.id}.`);
      if (previous.status !== expected) mappedRows++;
      assert.equal(next.compatibilityHash, previous.compatibilityHash, `${table}: unrelated row data changed for ${previous.id}.`);
      assert.equal(next.compatibilityValue, table === "topic_categories" ? previous.status === "published" : previous.compatibilityValue,
        `${table}: compatibility input changed unexpectedly.`);
      if (table !== "topic_categories") assert.equal(next.unrelatedHash, previous.unrelatedHash, `${table}: non-status data changed.`);
    }
  }
  assert.deepEqual(after.pages.map(row => ({ id: row.id, hash: row.unrelatedHash })),
    before.pages.map(row => ({ id: row.id, hash: row.unrelatedHash })), "Page fields outside status changed.");
  assert.equal(after.pagesMapping.length, 5);
  for (const sample of after.pagesMapping) {
    assert.equal(sample.mapped_status, sample.input_status === "published" ? "published" : "unpublished");
    assert.equal(sample.accepts_mapped, true);
    assert.equal(sample.original_accepts, sample.input_status === "published" || sample.input_status === "unpublished");
  }

  const triggerNames = [...sql.matchAll(/^create trigger ([a-z_]+)/gmu)].map(match => match[1]);
  assert.equal(triggerNames.length, 2);
  const affectedTrigger = (row: Row) => triggerNames.includes(String(row.tgname));
  assert.deepEqual(after.triggers.filter(row => !affectedTrigger(row)), before.triggers.filter(row => !affectedTrigger(row)), "An unrelated trigger changed.");
  for (const name of triggerNames) {
    const actual = after.triggers.filter(row => row.tgname === name);
    assert.equal(actual.length, 1);
    const expectedTable = name === "topic_categories_publication_compatibility" ? "topic_categories" : "hero_templates";
    const field = expectedTable === "topic_categories" ? "is_active" : "is_visible";
    const functionName = expectedTable === "topic_categories" ? "sync_topic_category_publication_compatibility" : "sync_hero_template_publication_compatibility";
    assert.equal(actual[0].relname, expectedTable);
    assert.equal(actual[0].definition, `CREATE TRIGGER ${name} BEFORE INSERT OR UPDATE OF status, ${field} ON public.${expectedTable} FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    const trigger = catalog(actual[0]);
    assert.equal(trigger.tgenabled, "O"); assert.equal(trigger.tgisinternal, false);
    assert.equal(trigger.tgdeferrable, false); assert.equal(trigger.tginitdeferred, false);
  }
  const rewrittenFunctions = [...sql.matchAll(/pg_get_functiondef\('public\.([a-z_][a-z0-9_]*)\([^']*\)'::regprocedure\)/gu)].map(match => match[1]);
  const declaredFunctions = [...sql.matchAll(/^create or replace function public\.([a-z_][a-z0-9_]*)\(/gmu)].map(match => match[1]);
  const affectedFunctions = new Set([...rewrittenFunctions, ...declaredFunctions]);
  assert.deepEqual(after.functions.filter(row => !affectedFunctions.has(String(row.proname))),
    before.functions.filter(row => !affectedFunctions.has(String(row.proname))), "An unrelated function changed.");
  const changedFunctions: string[] = [], createdFunctions: string[] = [];
  for (const name of affectedFunctions) {
    const previous = before.functions.filter(row => row.proname === name), next = after.functions.filter(row => row.proname === name);
    assert.equal(next.length, 1, `${name}: ambiguous function identity.`);
    assert.match(String(next[0].source_sha256), /^[a-f0-9]{64}$/u);
    if (previous.length) {
      assert.equal(previous.length, 1);
      assert.deepEqual(without(next[0], ["source_sha256"]), without(previous[0], ["source_sha256"]), `${name}: function identity or permissions changed.`);
      assert.notEqual(next[0].source_sha256, previous[0].source_sha256);
      changedFunctions.push(name);
    } else {
      assert.ok(name === "sync_topic_category_publication_compatibility" || name === "sync_hero_template_publication_compatibility");
      assert.equal(next[0].owner, "postgres"); assert.equal(next[0].prosecdef, false);
      assert.equal(next[0].provolatile, "v"); assert.deepEqual(next[0].proconfig, ["search_path=public"]);
      assert.equal(next[0].arguments, ""); assert.equal(next[0].result, "trigger");
      // Preserve platform default grants (for example service_role); the
      // unchanged69 source revokes exactly PUBLIC, anon and authenticated.
      assert.equal(typeof next[0].acl, "string");
      assert.ok(String(next[0].acl).includes("postgres=X/postgres"));
      assert.ok(!/(?:^|[,{])(?:anon|authenticated)?=/u.test(String(next[0].acl)));
      createdFunctions.push(name);
    }
  }
  return { status: "PASS" as const, registryBefore: 68, registryAfter: 69, sourceSha256,
    binaryValidatedChecks: entries.length, statusColumnsDefaultAndNotNull: entries.length,
    invalidStatuses: 0, mappedRows, pageUnrelatedFieldsPreserved: true, unchangedIndexesAndViews: true,
    unchangedRelationOwnershipAclRls: true, changedFunctions, createdFunctions, createdOrReplacedTriggers: triggerNames,
    legacyStatusProof: "SELECT-only evaluation of actual CHECK expressions and unchanged mapping",
    registryProvenance: "preserved prior official-CLI registry prefix; no whole-file statement claim" };
}
