import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { extname } from "node:path";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./isolated-supabase.mts";
import type { LoadedDatabaseSecurityContract } from "./database-rls-security-contract.mts";

type Row = Record<string, unknown>;

/**
 * Sanitized isolated catalog evidence. The caller supplies the live canonical
 * handle outside a transaction. This collector never reads role passwords,
 * user rows, environment values, or a connection string.
 */
export async function captureDatabaseRlsRoleMetadata(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  await handle.query("begin transaction isolation level repeatable read read only");
  try {
    const identity = (await handle.query(`select current_database() as database,
      current_user as current_role, session_user as session_role,
      current_setting('server_version_num') as server_version,
      pg_get_userbyid(d.datdba) as database_owner, d.datacl::text as database_acl
      from pg_database d where d.datname=current_database()`)).rows;
    assert.equal(identity.length, 1);
    assert.equal(identity[0].database, "postgres");
    assert.equal(identity[0].current_role, "postgres");
    const registry = (await handle.query(`select version,name,
      cardinality(statements) as statement_count,
      encode(sha256(convert_to(array_to_json(statements)::text,'UTF8')),'hex') as statements_sha256
      from supabase_migrations.schema_migrations order by version`)).rows;
    const roles = (await handle.query(`select rolname,rolsuper,rolinherit,rolcreaterole,
      rolcreatedb,rolcanlogin,rolreplication,rolbypassrls
      from pg_roles order by rolname`)).rows;
    const memberships = (await handle.query(`select granted.rolname as granted_role,
      member.rolname as member_role,grantor.rolname as grantor_role,
      m.admin_option,m.inherit_option,m.set_option
      from pg_auth_members m join pg_roles granted on granted.oid=m.roleid
      join pg_roles member on member.oid=m.member
      join pg_roles grantor on grantor.oid=m.grantor
      order by granted_role,member_role,grantor_role`)).rows;
    const schemas = (await handle.query(`select n.nspname,pg_get_userbyid(n.nspowner) as owner,
      n.nspacl::text as acl from pg_namespace n
      where n.nspname in ('public','auth','storage','supabase_migrations') order by n.nspname`)).rows;
    const defaults = (await handle.query(`select pg_get_userbyid(d.defaclrole) as creator,
      case when d.defaclnamespace=0 then null else n.nspname end as schema,
      d.defaclobjtype as object_type,d.defaclacl::text as acl
      from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
      order by creator,schema nulls first,object_type`)).rows;
    const tables = (await handle.query(`select c.relname,c.relkind,
      pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,
      c.relacl::text as acl,c.reloptions
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p','v','m') order by c.relname`)).rows;
    const policies = (await handle.query(`select c.relname,p.polname,p.polcmd,p.polpermissive,
      array(select case when role_oid=0 then 'PUBLIC' else pg_get_userbyid(role_oid) end
        from unnest(p.polroles) role_oid order by 1) as roles,
      pg_get_expr(p.polqual,p.polrelid,false) as using_expression,
      pg_get_expr(p.polwithcheck,p.polrelid,false) as with_check_expression
      from pg_policy p join pg_class c on c.oid=p.polrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' order by c.relname,p.polname`)).rows;
    const columnAcls = (await handle.query(`select c.relname,a.attname,a.attacl::text as acl
      from pg_attribute a join pg_class c on c.oid=a.attrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and a.attnum>0 and not a.attisdropped and a.attacl is not null
      order by c.relname,a.attnum`)).rows;
    const effectivePrivileges = (await handle.query(`select r.rolname,c.relname,
      has_table_privilege(r.oid,c.oid,'SELECT') as can_select,
      has_table_privilege(r.oid,c.oid,'INSERT') as can_insert,
      has_table_privilege(r.oid,c.oid,'UPDATE') as can_update,
      has_table_privilege(r.oid,c.oid,'DELETE') as can_delete,
      has_table_privilege(r.oid,c.oid,'TRUNCATE') as can_truncate,
      has_table_privilege(r.oid,c.oid,'REFERENCES') as can_references,
      has_table_privilege(r.oid,c.oid,'TRIGGER') as can_trigger,
      has_table_privilege(r.oid,c.oid,'MAINTAIN') as can_maintain,
      has_any_column_privilege(r.oid,c.oid,'SELECT') as any_column_select,
      has_any_column_privilege(r.oid,c.oid,'INSERT') as any_column_insert,
      has_any_column_privilege(r.oid,c.oid,'UPDATE') as any_column_update,
      has_any_column_privilege(r.oid,c.oid,'REFERENCES') as any_column_references
      from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
      where r.rolname in ('anon','authenticated','service_role','postgres')
      and n.nspname='public' and c.relkind in ('r','p','v','m')
      order by r.rolname,c.relname`)).rows;
    const schemaPrivileges = (await handle.query(`select r.rolname,n.nspname,
      has_schema_privilege(r.oid,n.oid,'USAGE') as can_use,
      has_schema_privilege(r.oid,n.oid,'CREATE') as can_create
      from pg_roles r cross join pg_namespace n
      where r.rolname in ('anon','authenticated','service_role','postgres')
      and n.nspname in ('public','auth','storage','supabase_migrations')
      order by r.rolname,n.nspname`)).rows;
    const sequences = (await handle.query(`select c.relname,pg_get_userbyid(c.relowner) as owner,
      c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='S' order by c.relname`)).rows;
    const functions = (await handle.query(`select p.proname,
      pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig,p.proacl::text as acl,
      pg_get_function_result(p.oid) as result,
      encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as source_sha256
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind in ('f','p') order by p.proname,arguments`)).rows;
    const events = (await handle.query(`select e.evtname,e.evtevent,e.evtenabled,e.evttags,
      pg_get_userbyid(e.evtowner) as owner,n.nspname,p.proname,
      encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as source_sha256
      from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid
      join pg_namespace n on n.oid=p.pronamespace order by e.evtname`)).rows;
    return { identity, registry, roles, memberships, schemas, defaults, tables, policies,
      columnAcls, effectivePrivileges, schemaPrivileges, sequences, functions, events,
      source: "canonical-owned-isolated-handle", rawUserDataRead: false,
      rolePasswordsRead: false, httpBehaviorClaimed: false };
  } finally {
    await handle.query("rollback");
  }
}

export type DatabaseRlsRoleMetadata = Awaited<ReturnType<typeof captureDatabaseRlsRoleMetadata>>;

const sqlIdentifier = (value: string): string => {
  assert.match(value, /^[a-z_][a-z0-9_]*$/u, "Untrusted SQL identifier.");
  return `"${value}"`;
};

const sqlState = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" && /^[A-Z0-9]{5}$/u.test(error.code) ? error.code : null;
};

const record = (value: unknown): Row => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Row;
};

/** Only this QA harness needs Node resolution for the existing pure TS owners. */
export async function loadCanonicalFooterRoleProofOwners() {
  type ResolveContext = { parentURL?: string };
  type ResolveResult = { url: string };
  type NextResolve = (specifier: string, context: ResolveContext) => ResolveResult;
  // The project's older @types/node predates this native Node 24 API.
  const { registerHooks } = nodeModule as unknown as {
    registerHooks(hooks: { resolve(specifier: string, context: ResolveContext, nextResolve: NextResolve): ResolveResult }): { deregister(): void };
  };
  assert.equal(typeof registerHooks, "function", "The isolated QA harness requires native Node registerHooks.");
  const sourceRoot = new URL("../../src/", import.meta.url);
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      try { return nextResolve(specifier, context); }
      catch (error) {
        const relative = specifier.startsWith("./") || specifier.startsWith("../");
        const missing = error !== null && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND";
        if (!missing || !relative || extname(specifier) || specifier.includes("?") || specifier.includes("#")
          || !context.parentURL?.startsWith(sourceRoot.href)) throw error;
        const candidate = new URL(`${specifier}.ts`, context.parentURL);
        if (!candidate.href.startsWith(sourceRoot.href)) throw error;
        return nextResolve(candidate.href, context);
      }
    },
  });
  try {
    const defaults = await import("../../src/lib/footer/defaults.ts");
    const readiness = await import("../../src/lib/footer/footer-settings-readiness.ts");
    const types = await import("../../src/lib/footer/types.ts");
    return { DEFAULT_FOOTER_SLOTS: defaults.DEFAULT_FOOTER_SLOTS,
      createFreshFooterSettings: defaults.createFreshFooterSettings,
      evaluateFooterReadiness: readiness.evaluateFooterReadiness, FOOTER_SETTING_KEYS: types.FOOTER_SETTING_KEYS };
  } finally { hook.deregister(); }
}

const SECURITY_VERSION = "20260819040000";
const CLIENT_ROLES = ["anon", "authenticated"] as const;
type ProbeRole = typeof CLIENT_ROLES[number] | "service_role" | "postgres";
const asRole = async (handle: OwnedLocalHandle, role: ProbeRole) => {
  await handle.query(`set local role ${sqlIdentifier(role)}`);
  assert.equal((await handle.query("select current_user as role")).rows[0].role, role);
};
const idOf = (value: unknown): string => {
  const result = String(value);
  assert.match(result, /^[1-9][0-9]*$/u, "Synthetic identifier is invalid.");
  return result;
};
async function expectPrivilegeDenied(handle: OwnedLocalHandle, sql: string, parameters: unknown[] = []) {
  await handle.query("savepoint qa_rls_expected_denial");
  let errorState: string | null = null;
  try { await handle.query(sql, parameters); }
  catch (error) { errorState = sqlState(error); }
  finally {
    await handle.query("rollback to savepoint qa_rls_expected_denial");
    await handle.query("release savepoint qa_rls_expected_denial");
  }
  assert.equal(errorState, "42501", "Expected privilege denial, not payload failure or successful access.");
}
async function tableCounts(handle: OwnedLocalHandle, loaded: LoadedDatabaseSecurityContract) {
  const entries: Array<[string, string]> = [];
  for (const table of loaded.contract.tables) {
    const count = (await handle.query(`select count(*)::text as count from public.${sqlIdentifier(table.name)}`)).rows[0].count;
    assert.equal(typeof count, "string");
    entries.push([table.name, count as string]);
  }
  return Object.fromEntries(entries);
}
async function requireSecurityBoundary(handle: OwnedLocalHandle, loaded: LoadedDatabaseSecurityContract) {
  assertOwnedLocalHandle(handle);
  assert.equal(loaded.migrationVersion, SECURITY_VERSION, "Role proof requires the approved security handoff.");
  const row = (await handle.query("select version from supabase_migrations.schema_migrations order by version desc limit 1")).rows[0];
  assert.equal(row?.version, loaded.migrationVersion, "Run the proof before historical migration 86.");
  assert.equal((await handle.query("select current_user as role")).rows[0].role, "postgres");
}

/** Actual SQL role behavior, not a PostgREST/HTTP or Admin-session claim. */
export async function verifyDatabaseRlsRoleBehavior(
  handle: OwnedLocalHandle,
  loaded: LoadedDatabaseSecurityContract,
  beforeMetadata?: DatabaseRlsRoleMetadata,
) {
  await requireSecurityBoundary(handle, loaded);
  const { captureDatabaseSecurityCatalog, assertDatabaseSecurityCatalog } = await import("./database-rls-security-contract.mts");
  const metadata = await captureDatabaseRlsRoleMetadata(handle);
  assert.ok(beforeMetadata, "The bounded role proof requires the captured pre-security metadata.");
  assert.equal(beforeMetadata.source, "canonical-owned-isolated-handle");
  const changedGrantTables = metadata.tables.filter(table => beforeMetadata.tables.some(before => before.relname === table.relname && before.acl !== table.acl)).map(table => String(table.relname));
  assert.equal(changedGrantTables.length, 24, "The approved grant correction must cover exactly the proven 24 tables.");
  const catalogBefore = await captureDatabaseSecurityCatalog(handle, loaded);
  const catalogProof = assertDatabaseSecurityCatalog(loaded, catalogBefore);
  const baselineCounts = await tableCounts(handle, loaded);
  const clientTables = loaded.contract.tables.filter(table => table.classification === "A");
  const serverTables = loaded.contract.tables.filter(table => table.classification === "B");
  assert.deepEqual(clientTables.map(table => table.name).sort(), ["menu_items", "menus", "topics"], "These behavioral cases are scoped to the three existing read policies.");
  const { DEFAULT_FOOTER_SLOTS, evaluateFooterReadiness, FOOTER_SETTING_KEYS } = await loadCanonicalFooterRoleProofOwners();
  const footer = { slots: structuredClone(DEFAULT_FOOTER_SLOTS),
    contactItems: [{ label: "QA contact", value: "Synthetic fixture only", href: "mailto:qa@example.invalid", visible: true }],
    socialLinks: [{ platform: "facebook", label: "QA social", href: "https://example.invalid/qa", visible: true }],
    legal: { copyright: "QA isolated verification", tagline: "Synthetic test content" } };
  const readiness = evaluateFooterReadiness(footer);
  assert.equal(readiness.systemValid, true); assert.equal(readiness.publicationReady, true);
  const footerSettings = [{ key: "footer.slots", value: footer.slots }, { key: "footer.contact_items", value: footer.contactItems },
    { key: "footer.social_links", value: footer.socialLinks }, { key: "footer.legal", value: footer.legal }];
  const footerBefore = (await handle.query("select key,value from public.site_settings where key=any($1::text[]) order by key", [[...FOOTER_SETTING_KEYS]])).rows;
  const prefix = `qa-rls-${randomUUID()}`;
  let deniedSelects = 0;
  let deniedWrites = 0;
  let deniedRpcs = 0;
  let policyChecks = 0;
  let privilegedReads = 0;
  let deniedSequenceUses = 0;
  const serviceDmlMatrix: Array<{ table: string; allowed: string[]; denied: string[] }> = [];
  await handle.query("begin");
  try {
    for (const role of CLIENT_ROLES) {
      await asRole(handle, role);
      for (const table of serverTables) {
        await expectPrivilegeDenied(handle, `select count(*) from public.${sqlIdentifier(table.name)}`);
        deniedSelects++;
      }
      for (const sql of ["insert into public.content_block_templates default values",
        "update public.content_block_templates set name=name where false", "delete from public.content_block_templates where false"]) {
        await expectPrivilegeDenied(handle, sql); deniedWrites++;
      }
      const sequence = loaded.contract.sequencePrivileges[0];
      assert.ok(sequence, "The isolated application sequence inventory must be present.");
      await expectPrivilegeDenied(handle, "select nextval($1::regclass)", [`public.${sqlIdentifier(sequence.name)}`]);
      deniedSequenceUses++;
    }
    for (const role of ["service_role", "postgres"] as const) {
      await asRole(handle, role);
      assert.deepEqual(await tableCounts(handle, loaded), baselineCounts);
      privilegedReads += loaded.contract.tables.length;
    }
    await asRole(handle, "service_role");
    for (const name of changedGrantTables) {
      const table = loaded.contract.tables.find(entry => entry.name === name);
      assert.ok(table, "Changed table must be classified by the SQL-owned contract.");
      const granted = new Set([...(table.grants.service_role ?? []), ...(table.grants.PUBLIC ?? [])]);
      const columnRow = (await handle.query(`select a.attname from pg_catalog.pg_attribute a
        where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped
        and a.attgenerated='' and a.attidentity='' order by a.attnum limit 1`, [`public.${sqlIdentifier(name)}`])).rows[0];
      assert.equal(typeof columnRow?.attname, "string", "No safe ordinary column exists for zero-row DML proof.");
      const relation = `public.${sqlIdentifier(name)}`;
      const column = sqlIdentifier(String(columnRow.attname));
      const statements = { INSERT: `insert into ${relation}(${column}) select ${column} from ${relation} where false`,
        UPDATE: `update ${relation} set ${column}=${column} where false`, DELETE: `delete from ${relation} where false` };
      const result = { table: name, allowed: [] as string[], denied: [] as string[] };
      for (const [privilege, sql] of Object.entries(statements)) {
        if (granted.has(privilege)) {
          assert.equal((await handle.query(sql)).rowCount, 0, "Allowed matrix statement must affect zero rows.");
          result.allowed.push(privilege);
        } else { await expectPrivilegeDenied(handle, sql); result.denied.push(privilege); }
      }
      serviceDmlMatrix.push(result);
    }
    const auditTable = loaded.contract.tables.find(table => table.name === "admin_audit_logs");
    assert.ok(auditTable);
    assert.equal([...(auditTable.grants.service_role ?? []), ...(auditTable.grants.PUBLIC ?? [])].includes("TRUNCATE"), false);
    await expectPrivilegeDenied(handle, "truncate public.admin_audit_logs");
    const direct = idOf((await handle.query(`insert into public.content_block_templates(name,slug,status,config)
      values($1,$2,'unpublished','{}'::jsonb) returning id`, ["QA direct CRUD", `${prefix}-direct`])).rows[0].id);
    assert.equal((await handle.query("select name from public.content_block_templates where id=$1", [direct])).rows[0].name, "QA direct CRUD");
    assert.equal((await handle.query("update public.content_block_templates set name=$2 where id=$1 returning name", [direct, "QA direct updated"])).rows[0].name, "QA direct updated");
    assert.equal((await handle.query("delete from public.content_block_templates where id=$1 returning id", [direct])).rows.length, 1);
    const template = idOf((await handle.query(`insert into public.content_block_templates(name,slug,status,config)
      values('QA composition template',$1,'unpublished','{}'::jsonb) returning id`, [`${prefix}-template`])).rows[0].id);
    const page = idOf((await handle.query(`insert into public.pages(title,slug,path,status)
      values('QA composition page',$1,$2,'unpublished') returning id`, [`${prefix}-page`, `/${prefix}`])).rows[0].id);
    const topics: string[] = [];
    for (const [index, status, deleted] of [[0, "published", false], [1, "unpublished", false], [2, "published", true]] as const) {
      topics.push(idOf((await handle.query(`insert into public.topics(slug,title,excerpt,content,image,category,category_slug,status,deleted_at)
        values($1,'QA topic','Synthetic excerpt','Synthetic content','https://example.invalid/qa.png','QA','qa',$2,
          case when $3::boolean then now() else null end) returning id`, [`${prefix}-topic-${index}`, status, deleted])).rows[0].id));
    }
    const menus: string[] = [];
    for (const active of [true, false]) menus.push(idOf((await handle.query(`insert into public.menus(name,slug,location,is_active)
      values('QA policy menu',$1,'footer',$2) returning id`, [`${prefix}-menu-${active ? "active" : "inactive"}`, active])).rows[0].id));
    const menuItems: string[] = [];
    for (const [menu, visible] of [[menus[0], true], [menus[0], false], [menus[1], true]] as const) {
      const value = record((await handle.query("select public.mutate_menu_tree($1,'save_item',$2::jsonb,null,'system:qa-security') as result",
        [menu, JSON.stringify({ item: { label: "QA policy item", item_type: "custom", href: `/${prefix}`, is_visible: visible, sort_order: 0 } })])).rows[0].result);
      menuItems.push(idOf(value.item_id));
    }
    const compositionPayload = { kind: "content", template_id: template, slot: "main", is_visible: false };
    const composition = record((await handle.query("select public.mutate_page_composition($1,'save_assignment',$2::jsonb,null,'system:qa-security') as result",
      [page, JSON.stringify(compositionPayload)])).rows[0].result);
    const assignment = idOf(composition.assignment_id);
    const assigned = (await handle.query("select page_id,template_id,is_visible from public.page_content_block_assignments where id=$1", [assignment])).rows[0];
    assert.equal(idOf(assigned.page_id), page); assert.equal(idOf(assigned.template_id), template); assert.equal(assigned.is_visible, false);
    const saved = record((await handle.query(`select public.save_footer_settings($1::jsonb,null,'system:qa-security',
      'qa.rls.footer','{"fixture":"database-rls-role-verification"}'::jsonb) as result`, [JSON.stringify(footerSettings)])).rows[0].result);
    assert.equal(saved.settings_count, FOOTER_SETTING_KEYS.length);
    const footerRows = (await handle.query("select key,value from public.site_settings where key=any($1::text[]) order by key", [[...FOOTER_SETTING_KEYS]])).rows;
    assert.deepEqual(Object.fromEntries(footerRows.map(row => [String(row.key), row.value])), Object.fromEntries(footerSettings.map(row => [row.key, row.value])));
    const audit = (await handle.query(`select action,metadata->>'persistence_owner' as owner,count(*)::integer as count
      from public.admin_audit_logs where actor_username='system:qa-security'
      group by action,metadata->>'persistence_owner' order by action`)).rows;
    assert.deepEqual(audit, [
      { action: "menu.save_item", owner: "mutate_menu_tree", count: 3 },
      { action: "page_composition.save_assignment", owner: "mutate_page_composition", count: 1 },
      { action: "qa.rls.footer", owner: "save_footer_settings", count: 1 },
    ]);
    for (const role of CLIENT_ROLES) {
      await asRole(handle, role);
      if (role === "anon") {
        assert.deepEqual((await handle.query("select id::text from public.topics where id=any($1::bigint[]) order by id", [topics])).rows, [{ id: topics[0] }]);
      } else {
        await expectPrivilegeDenied(handle, "select id from public.topics where id=any($1::bigint[])", [topics]); deniedSelects++;
      }
      assert.deepEqual((await handle.query("select id::text from public.menus where id=any($1::bigint[]) order by id", [menus])).rows, [{ id: menus[0] }]);
      assert.deepEqual((await handle.query("select id::text from public.menu_items where id=any($1::bigint[]) order by id", [menuItems])).rows, [{ id: menuItems[0] }]);
      policyChecks += role === "anon" ? 3 : 2;
      await expectPrivilegeDenied(handle, "select public.mutate_menu_tree($1,'save_item',$2::jsonb,null,'system:qa-security')", [menus[0], JSON.stringify({ item: { label: "Denied item", item_type: "custom", href: `/${prefix}` } })]);
      await expectPrivilegeDenied(handle, "select public.mutate_page_composition($1,'save_assignment',$2::jsonb,null,'system:qa-security')", [page, JSON.stringify(compositionPayload)]);
      await expectPrivilegeDenied(handle, "select public.save_footer_settings($1::jsonb,null,'system:qa-security','qa.rls.footer','{}'::jsonb)", [JSON.stringify(footerSettings)]);
      deniedRpcs += 3;
    }
    for (const role of ["service_role", "postgres"] as const) {
      await asRole(handle, role);
      for (const [table, ids] of [["topics", topics], ["menus", menus], ["menu_items", menuItems]] as const) {
        assert.equal((await handle.query(`select id from public.${sqlIdentifier(table)} where id=any($1::bigint[])`, [ids])).rows.length, ids.length);
      }
    }
  } finally { await handle.query("rollback"); }
  assert.deepEqual(await tableCounts(handle, loaded), baselineCounts, "Rollback must restore every application table row count.");
  assert.deepEqual((await handle.query("select key,value from public.site_settings where key=any($1::text[]) order by key", [[...FOOTER_SETTING_KEYS]])).rows, footerBefore);
  assert.deepEqual(await captureDatabaseSecurityCatalog(handle, loaded), catalogBefore, "Role proof changed the security catalog.");
  const futureGuard = await verifyUnclassifiedPublicTableGuard(handle, loaded);
  return { catalogProof, rolesCaptured: metadata.roles, roleMembershipsCaptured: metadata.memberships,
    deniedSelects, deniedWrites, deniedRpcs, deniedSequenceUses, policyChecks, privilegedReads,
    serviceDmlMatrix, serviceAuditTruncateDenied: true,
    directCrud: { role: "service_role", table: "content_block_templates", insert: true, read: true, update: true, delete: true },
    atomicWriters: ["mutate_menu_tree", "mutate_page_composition", "save_footer_settings"], canonicalAudits: 5,
    changedGrantTables, futureGuard, syntheticRowsRolledBack: true, footerValuesRestored: true,
    securityCatalogPreserved: true, sequencesRolledBack: false, httpBehaviorClaimed: false, adminSessionCreated: false };
}

/** Reviewed negative fixture uses the existing security guard; it installs no policy. */
export async function verifyUnclassifiedPublicTableGuard(handle: OwnedLocalHandle, loaded: LoadedDatabaseSecurityContract) {
  await requireSecurityBoundary(handle, loaded);
  const { captureDatabaseSecurityCatalog, assertDatabaseSecurityCatalog } = await import("./database-rls-security-contract.mts");
  const fixturePath = new URL("../fixtures/database-rls/unclassified-public-table.sql", import.meta.url);
  const source = readFileSync(fixturePath, "utf8").replace(/\r\n/g, "\n");
  const [createStage, enableStage, rollbackStage, extra] = source.split(/^-- QA_RLS_STAGE: (?:ENABLE|ROLLBACK)$/mu);
  assert.equal(extra, undefined); assert.ok(createStage && enableStage && rollbackStage);
  assert.match(createStage, /\bbegin;/u); assert.match(rollbackStage.trim(), /^rollback;$/u);
  const name = "qa_rls_unclassified_probe";
  assert.equal((await handle.query("select to_regclass($1) is null as absent", [`public.${name}`])).rows[0].absent, true);
  const before = await captureDatabaseSecurityCatalog(handle, loaded);
  assertDatabaseSecurityCatalog(loaded, before);
  const registryBefore = (await handle.query("select version,name from supabase_migrations.schema_migrations order by version")).rows;
  const rejected: boolean[] = [];
  let deniedClientSelects = 0;
  try {
    await handle.query(createStage);
    for (const [index, stage] of [null, enableStage].entries()) {
      if (stage) await handle.query(stage);
      const snapshot = await captureDatabaseSecurityCatalog(handle, loaded);
      const probe = snapshot.tables.find(table => table.name === name);
      assert.ok(probe); assert.equal(probe.rlsEnabled, index === 1);
      assertDatabaseSecurityCatalog(loaded, { ...snapshot, tables: snapshot.tables.filter(table => table.name !== name) });
      for (const role of CLIENT_ROLES) {
        assert.deepEqual(probe.effectivePrivileges[role], []);
        assert.deepEqual(probe.effectiveColumnPrivileges[role], []);
        await asRole(handle, role);
        await expectPrivilegeDenied(handle, `select count(*) from public.${sqlIdentifier(name)}`);
        deniedClientSelects++;
      }
      await asRole(handle, "postgres");
      let rejectedForClassification = false;
      try { assertDatabaseSecurityCatalog(loaded, snapshot); }
      catch (error) {
        rejectedForClassification = error instanceof assert.AssertionError
          && error.message.includes("Unclassified, missing or unexpected public application table.");
        if (!rejectedForClassification) throw error;
      }
      assert.equal(rejectedForClassification, true);
      rejected.push(rejectedForClassification);
    }
  } finally { await handle.query(rollbackStage); }
  assert.equal((await handle.query("select to_regclass($1) is null as absent", [`public.${name}`])).rows[0].absent, true);
  assert.deepEqual(await captureDatabaseSecurityCatalog(handle, loaded), before);
  assert.deepEqual((await handle.query("select version,name from supabase_migrations.schema_migrations order by version")).rows, registryBefore);
  return { fixtureSourceSha256: createHash("sha256").update(source).digest("hex"),
    missingClassificationRejected: rejected.length === 2 && rejected.every(Boolean),
    rlsOffRejected: true, rlsOnStillRejected: true, defaultClientPrivilegesDenied: true,
    deniedClientSelects, rolledBack: true, registryChanged: false, outOfBandDdlAutoEnforcementClaimed: false };
}
