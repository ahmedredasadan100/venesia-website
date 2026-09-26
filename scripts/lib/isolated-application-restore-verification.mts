import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { assertOwnedLocalHandle, cleanChildEnvironment, type OwnedLocalHandle } from "./isolated-supabase.mts";

const ROOT = resolve(import.meta.dirname, "../..");
const SCHEMA_FINGERPRINT_SQL = `
select kind,name,md5(definition) as fingerprint from (
select 'table'::text kind,c.relname::text name,
jsonb_build_object('rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped))::text definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p')
union all select 'function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
union all select 'constraint',c.relname||'.'||k.conname,pg_get_constraintdef(k.oid)||'|validated='||k.convalidated::text from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
union all select 'index',c.relname,pg_get_indexdef(c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='i'
union all select 'trigger',c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
union all select 'policy',tablename||'.'||policyname,jsonb_build_array(permissive,roles,cmd,qual,with_check)::text from pg_policies where schemaname='public'
) objects order by kind,name;
`;
export const SECURITY_FINGERPRINT_SQL = `
with objects(kind,name,owner,acl) as (
  select 'schema'::text,n.nspname::text,n.nspowner,coalesce(n.nspacl,acldefault('n',n.nspowner))
  from pg_namespace n where n.nspname='public'
  union all
  select 'relation',c.relname,c.relowner,coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p','v','m','S','f')
  union all
  select 'function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',p.proowner,coalesce(p.proacl,acldefault('f',p.proowner))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
  union all
  select 'type',t.typname,t.typowner,coalesce(t.typacl,acldefault('T',t.typowner))
  from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype in('d','e')
  union all
  select 'default-acl',pg_get_userbyid(d.defaclrole)||'.'||coalesce(n.nspname,'<global>')||'.'||d.defaclobjtype::text,d.defaclrole,d.defaclacl
  from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclnamespace=0 or n.nspname='public'
)
select kind,name,md5(jsonb_build_object('owner',pg_get_userbyid(owner),'acl',(
  select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
    order by pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
  from aclexplode(acl) a
))::text) fingerprint from objects order by kind,name;
`;
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Destructive recovery proof confined to the current disposable application. */
export async function verifyOwnedApplicationRestore(handle: OwnedLocalHandle, outputDirectory: string) {
  assertOwnedLocalHandle(handle);
  const output = resolve(outputDirectory);
  assert.ok(output.startsWith(resolve(ROOT, ".tmp-qa") + sep));
  mkdirSync(output, { recursive: true });
  const databaseId = handle.identity.databaseContainerId;
  assert.match(databaseId, /^[a-f0-9]{64}$/u);
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + "\n");
  const dockerHost = process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock";
  const command = (args: string[], input?: Buffer): Buffer => {
    assertOwnedLocalHandle(handle);
    return execFileSync("docker", ["--host", dockerHost, "exec", ...(input ? ["-i"] : []), databaseId, ...args], {
      ...(input ? { input } : {}), windowsHide: true, env: cleanChildEnvironment() as NodeJS.ProcessEnv,
      maxBuffer: 80_000_000, timeout: 120_000,
    });
  };
  const schema = () => command(["pg_dump", "-U", "supabase_admin", "-d", "postgres", "--schema-only", "-n", "public", "-n", "supabase_migrations"])
    .toString("utf8").replace(/\r\n?/gu, "\n").replace(/^\\(?:un)?restrict .*\n/gmu, "");
  const identityName = "media_reference_write_leases.media_reference_write_leases_identity_check";
  const normalizeIdentity = async () => {
    const definition = (await handle.query(`select pg_get_constraintdef(oid) definition,
      pg_get_expr(conbin,conrelid) expression,convalidated validated from pg_constraint
      where conrelid='public.media_reference_write_leases'::regclass
      and conname='media_reference_write_leases_identity_check'`)).rows[0];
    assert.equal(definition.validated, true);
    await handle.query("create temporary table audit2_restore_constraint_parser (like public.media_reference_write_leases)");
    try {
      await handle.query(`alter table pg_temp.audit2_restore_constraint_parser add constraint audit2_restore_identity ${definition.definition}`);
      const normalized = (await handle.query(`select pg_get_constraintdef(oid) definition from pg_constraint
        where conrelid='pg_temp.audit2_restore_constraint_parser'::regclass and conname='audit2_restore_identity'`)).rows[0].definition;
      return { original: String(definition.definition), expression: String(definition.expression), normalized: String(normalized) };
    } finally { await handle.query("drop table pg_temp.audit2_restore_constraint_parser"); }
  };
  const normalizeSchema = (sql: string, identity: { original: string; normalized: string }) => {
    assert.equal(sql.split(identity.original).length, 2, "Only the measured identity CHECK may be normalized.");
    return sql.replace(identity.original, identity.normalized);
  };
  const snapshot = async () => {
    const tables = (await handle.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
    const data: Array<Record<string, unknown>> = [];
    for (const table of tables) {
      const name = String(table.tablename); assert.match(name, /^[a-z][a-z0-9_]*$/u);
      const row = (await handle.query(`select count(*)::int as count,
        md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) as hash
        from public."${name}" t`)).rows[0];
      data.push({ table: name, ...row });
    }
    const registry = (await handle.query("select version,name,statements from supabase_migrations.schema_migrations order by version")).rows;
    const fingerprints = (await handle.query(SCHEMA_FINGERPRINT_SQL)).rows;
    const identity = await normalizeIdentity();
    const schemaText = schema();
    const normalizedFingerprints = fingerprints.map(row => row.kind === "constraint" && row.name === identityName
      ? { ...row, fingerprint: createHash("md5").update(identity.normalized + "|validated=true").digest("hex") } : row);
    return { data, registry, fingerprints, normalizedFingerprints, identity,
      schemaSha256: digest(schemaText), normalizedSchemaSha256: digest(normalizeSchema(schemaText, identity)) };
  };
  const before = await snapshot(); save("restore-before.json", before);
  save("native-security-fingerprints.json", (await handle.query(SECURITY_FINGERPRINT_SQL)).rows);
  save("native-schema-fingerprints.json", before.fingerprints);
  const schemaBefore = schema(); writeFileSync(resolve(output, "schema-before.sql"), schemaBefore);
  const dump = command(["pg_dump", "-U", "supabase_admin", "-d", "postgres", "-Fc", "-n", "public", "-n", "supabase_migrations"]);
  writeFileSync(resolve(output, "public-registry.dump"), dump);
  await handle.query("drop schema public cascade; drop schema supabase_migrations cascade");
  assert.equal((await handle.query("select count(*)::int count from pg_namespace where nspname in ('public','supabase_migrations')")).rows[0].count, 0);
  // The upstream baseline owns DEFAULT PRIVILEGES under supabase_admin. Restore
  // with that existing owner; never remove ACLs or grant permissions to postgres.
  command(["pg_restore", "-U", "supabase_admin", "-d", "postgres", "--exit-on-error"], dump);
  const after = await snapshot(); save("restore-after.json", after);
  const schemaAfter = schema(); writeFileSync(resolve(output, "schema-after.sql"), schemaAfter);
  assert.deepEqual(after.data, before.data, "Every public table must survive restore exactly.");
  assert.deepEqual(after.registry, before.registry, "Migration registry must survive restore exactly.");
  assert.deepEqual(after.normalizedFingerprints, before.normalizedFingerprints);
  assert.equal(after.normalizedSchemaSha256, before.normalizedSchemaSha256);
  assert.equal(normalizeSchema(schemaAfter, after.identity), normalizeSchema(schemaBefore, before.identity), "DDL and ACLs must match after native parse/deparse of the one measured CHECK.");
  assert.equal(after.identity.normalized, before.identity.normalized);
  const boundaryProof = (await handle.query(`select count(*)::int cases,
    count(*) filter(where (${before.identity.expression}) is distinct from (${after.identity.expression}))::int mismatches
    from (values(null::text),(''),('a'),(repeat('a',120)),(repeat('a',121))) d(domain_key)
    cross join (values(null::text),(''),('a'),(repeat('a',120)),(repeat('a',121))) e(entity_type)
    cross join (values(null::text),(''),('a'),(repeat('a',240)),(repeat('a',241))) i(entity_identity)`)).rows[0];
  assert.deepEqual(boundaryProof, { cases: 125, mismatches: 0 });
  save("constraint-serialization-proof.json", { name: identityName, before: before.identity, after: after.identity,
    nativeParserEquivalent: true, boundariesAndNullSemantics: boundaryProof, allOtherFingerprintsExact: true });
  const invalid = (await handle.query("select public.admin_mutate_topics_batch_atomically(-1,'feature',array[1]::bigint[],null,null) result")).rows[0].result as { ok: boolean; code: string };
  assert.deepEqual(invalid, { ok: false, code: "unauthorized_actor" });
  const actor = (await handle.query("select id from public.admin_users where is_active order by id limit 1")).rows[0];
  const topic = (await handle.query("select id,is_featured,seo_score,seo_score_version,seo_score_input_hash from public.topics where deleted_at is null order by id limit 1")).rows[0];
  assert.ok(actor && topic, "A critical restore proof requires existing synthetic actor and Topic fixtures.");
  for (const action of [topic.is_featured ? "unfeature" : "feature", topic.is_featured ? "feature" : "unfeature"]) {
    const result = (await handle.query("select public.admin_mutate_topics_batch_atomically($1,$2,$3::bigint[],null,null) result", [actor.id, action, [topic.id]])).rows[0].result as { ok: boolean; changedIds: unknown[] };
    assert.equal(result.ok, true); assert.deepEqual(result.changedIds.map(String), [String(topic.id)]);
  }
  const restoredTopic = (await handle.query("select id,is_featured,seo_score,seo_score_version,seo_score_input_hash from public.topics where id=$1", [topic.id])).rows[0];
  assert.deepEqual(restoredTopic, topic);
  const report = { status: "pass", publicTables: before.data.length, registered: before.registry.length,
    head: before.registry.at(-1)?.version, dumpBytes: dump.length, dumpSha256: digest(dump),
    schemaSha256: before.schemaSha256, isolatedLossConfirmed: true, schemaAclRegistryAllPublicDataVerified: true, oneCheckNativeParserNormalized: identityName,
    criticalUnauthorizedActorRejection: true, criticalFeaturedRoundTrip: true, criticalSeoTuplePreserved: true,
    scope: "public and supabase_migrations only; platform schemas, Storage bytes, Auth data, hosted recovery configuration remain outside this proof",
    productionAccess: false };
  save("restore-result.json", report);
  return report;
}
