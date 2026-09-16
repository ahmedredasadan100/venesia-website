import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertMigrationSourceProvenance } from "./migration-provenance.mjs";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./isolated-supabase.mts";
import { createFreshFooterSettings, DEFAULT_FOOTER_SLOTS } from "../../src/lib/footer/defaults.ts";
import { evaluateFooterReadiness } from "../../src/lib/footer/footer-settings-readiness.ts";
import { FOOTER_SETTING_KEYS } from "../../src/lib/footer/types.ts";
import { HOME_MODULE_SLUGS } from "../../src/lib/page-blocks/home-module-slugs.ts";
import { evaluateFooterCompositionProof } from "../../src/lib/seo/footer-public-composition-proof.ts";

export const FOOTER_COMPOSITION_MIGRATION60_VERSION = "20260805090000";
const sourceUrl = new URL("../../sql/migrations/20260805090000_footer_public_composition_truth_closure.sql", import.meta.url);
const homeTestId = 900000;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sourceDigest = (source: string) => createHash("sha256").update(source).digest("hex");
type Options = { historical?: boolean; verifyFailures?: boolean };
type Json = Record<string, unknown>;
const object = (value: unknown): Json => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Json;
};

export function readFooterCompositionMigration60(): string {
  const sql = readFileSync(sourceUrl, "utf8").replace(/\r\n?/gu, "\n");
  assertMigrationSourceProvenance({ version: FOOTER_COMPOSITION_MIGRATION60_VERSION,
    name: "footer_public_composition_truth_closure", sql });
  return sql;
}

function evidence(outputDir: string, filename: string, value: unknown) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Logical data/catalog/history only. Sequence values are intentionally excluded:
 * PostgreSQL sequence advancement is not transactional, unlike the asserted state. */
export async function captureFooterComposition60(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  await handle.query("begin transaction isolation level repeatable read read only");
  try {
    const relations = (await handle.query(`select c.oid::text as oid,c.relname,c.relkind,
      pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as acl
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','v','m','p') order by c.relname`)).rows;
    const columns = (await handle.query(`select c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) as type,
      a.attnotnull,a.attidentity,a.attgenerated,a.attislocal,a.attinhcount,pg_get_expr(d.adbin,d.adrelid,false) as default_expression
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where n.nspname='public' and c.relkind in ('r','v','m','p') and a.attnum>0 order by c.relname,a.attnum`)).rows;
    const constraints = (await handle.query(`select c.relname,to_jsonb(k) as catalog,pg_get_constraintdef(k.oid,false) as definition
      from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' order by c.relname,k.conname`)).rows;
    const indexes = (await handle.query(`select c.relname,to_jsonb(i) as catalog,pg_get_indexdef(i.indexrelid) as definition
      from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' order by c.relname,i.indexrelid`)).rows;
    const triggers = (await handle.query(`select c.relname,to_jsonb(t) as catalog,pg_get_triggerdef(t.oid,false) as definition
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' order by c.relname,t.tgname`)).rows;
    const functions = (await handle.query(`select p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,
      p.proconfig,p.proacl::text as acl,pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_function_result(p.oid) as result,md5(pg_get_functiondef(p.oid)) as definition_md5
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind in ('f','p') order by p.proname,arguments`)).rows;
    const registry = (await handle.query("select version,name,statements from supabase_migrations.schema_migrations order by version")).rows.map(row => ({
      version: row.version, name: row.name, statementCount: Array.isArray(row.statements) ? row.statements.length : -1,
      statementsSha256: digest(row.statements),
    }));
    const rowDigests: Record<string, { count: number; sha256: string }> = {};
    for (const row of relations.filter(row => row.relkind === "r")) {
      assert.ok(typeof row.relname === "string" && /^[a-z_][a-z0-9_]*$/u.test(row.relname));
      const hashes = (await handle.query(`select md5(to_jsonb(t)::text) as row_hash from public."${row.relname}" t order by 1`)).rows;
      rowDigests[row.relname] = { count: hashes.length, sha256: digest(hashes) };
    }
    await handle.query("commit");
    return { relations, columns, constraints, indexes, triggers, functions, registry, rowDigests };
  } catch (error) { await handle.query("rollback").catch(() => undefined); throw error; }
}

async function insertHomeTestIdentity(handle: OwnedLocalHandle) {
  await handle.query(`insert into public.pages(id,title,slug,path,page_type,status,is_system)
    overriding system value values($1,'الرئيسية','home','/','home','published',true)`, [homeTestId]);
}

/** Explicit controlled historical scenario, NEVER a fresh-install recipe. The
 * product Footer preset owns the values; fixtures only create this test input. */
export async function seedHistoricalFooterComposition60(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const counts = (await handle.query(`select (select count(*) from public.pages where slug='home' or path='/')::int as home,
    (select count(*) from public.site_settings where key='footer.slots')::int as slots`)).rows[0];
  assert.deepEqual(counts, { home: 0, slots: 0 });
  await handle.query("insert into public.site_settings(key,value) values('footer.slots',$1::jsonb)", [JSON.stringify(DEFAULT_FOOTER_SLOTS)]);
  const text = DEFAULT_FOOTER_SLOTS.slots.find(slot => slot.type === "text");
  const contact = DEFAULT_FOOTER_SLOTS.slots.find(slot => slot.type === "contact");
  const media = DEFAULT_FOOTER_SLOTS.slots.find(slot => slot.type === "media");
  assert.ok(text?.type === "text" && contact && media);
  const textConfig = object(text.config);
  const brand = { title: textConfig.title ?? "", tagline: textConfig.body ?? "",
    contactHeading: contact.heading ?? "", mediaHeading: media.heading ?? "" };
  const updated = await handle.query("update public.site_settings set value=$1::jsonb where key='footer.brand'", [JSON.stringify(brand)]);
  assert.equal(updated.rowCount, 1);
  await insertHomeTestIdentity(handle);
  const templates = (await handle.query(`select id,slug,status from public.content_block_templates where slug=any($1::text[])`, [[...HOME_MODULE_SLUGS]])).rows;
  assert.equal(templates.length, HOME_MODULE_SLUGS.length);
  for (const [index, slug] of HOME_MODULE_SLUGS.entries()) {
    const template = templates.filter(row => row.slug === slug);
    assert.equal(template.length, 1);
    assert.equal(template[0].status, "published");
    await handle.query(`insert into public.page_content_block_assignments(id,page_id,template_id,slot,sort_order,is_visible)
      values($1,$2,$3,'main',$4,true)`, [homeTestId + index + 1, homeTestId, template[0].id, (index + 1) * 10]);
  }
}

export async function before60(handle: OwnedLocalHandle, outputDir: string, options: Options = { historical: false }) {
  assertOwnedLocalHandle(handle);
  const source = readFooterCompositionMigration60();
  const baseline = await captureFooterComposition60(handle);
  assert.equal(baseline.registry.length, 59);
  assert.ok(!baseline.registry.some(row => row.version === FOOTER_COMPOSITION_MIGRATION60_VERSION));
  const cases: Array<{ name: string; prepare: () => Promise<unknown> }> = [
    { name: "partial-slots-only", prepare: () => handle.query(
      "insert into public.site_settings(key,value) values('footer.slots',$1::jsonb)", [JSON.stringify(DEFAULT_FOOTER_SLOTS)]) },
    { name: "partial-home-only", prepare: () => insertHomeTestIdentity(handle) },
    { name: "changed-footer-business-seed", prepare: () => handle.query(
      "update public.site_settings set value=jsonb_set(value,'{tagline}',to_jsonb('QA changed seed'::text)) where key='footer.legal'") },
    { name: "added-audit-evidence", prepare: () => handle.query(`insert into public.admin_audit_logs
      (id,actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata)
      values(909999,null,'system:test','qa.negative_input','page_composition',null,'Synthetic negative case','{}'::jsonb)`) },
    { name: "preexisting-provenance-rpc",
      prepare: () => handle.query("create function public.footer_public_composition_provenance() returns jsonb language sql as 'select null::jsonb'") },
    { name: "historical-brand-mismatch",
      prepare: async () => { await seedHistoricalFooterComposition60(handle); await handle.query(
        "update public.site_settings set value=jsonb_set(value,'{title}',to_jsonb('QA mismatch'::text)) where key='footer.brand'"); } },
    { name: "historical-missing-one-assignment",
      prepare: async () => { await seedHistoricalFooterComposition60(handle); await handle.query(
        "delete from public.page_content_block_assignments where id=$1", [homeTestId + 4]); } },
    { name: "missing-page-slug-unique-contract",
      prepare: () => handle.query("alter table public.pages drop constraint pages_slug_key") },
  ];
  const failures: Array<{ name: string; sqlState: string; rolledBack: boolean; fullUnmodifiedMigration: boolean }> = [];
  for (const test of options.verifyFailures === false ? [] : cases) {
    assert.equal(readFooterCompositionMigration60(), source);
    await handle.query("begin");
    let reachedMigration = false, sqlState: string | null = null;
    try {
      await test.prepare();
      reachedMigration = true;
      // Its BEGIN joins the outer transaction. Only a failure before the
      // unchanged COMMIT is accepted. Unexpected success requires disposal.
      await handle.query(source);
    } catch (error) {
      if (!reachedMigration || error === null || typeof error !== "object" || !("code" in error)) throw error;
      sqlState = typeof error.code === "string" ? error.code : null;
    } finally { await handle.query("rollback").catch(() => undefined); }
    assert.equal(sqlState, "P0001", `Negative case unexpectedly succeeded or failed elsewhere: ${test.name}; discard fixture.`);
    // The canonical owned handle intentionally sanitizes PostgreSQL errors to
    // SQLSTATE. This evidence proves fail-closed behavior, not a captured RAISE
    // message or the exact internal assertion branch.
    assert.deepEqual(await captureFooterComposition60(handle), baseline, `Persistent logical state changed: ${test.name}`);
    failures.push({ name: test.name, sqlState, rolledBack: true, fullUnmodifiedMigration: true });
    handle.record("migration60-negative-case", { name: test.name, sqlState, rolledBack: true });
  }
  if (options.historical) {
    await handle.query("begin");
    try { await seedHistoricalFooterComposition60(handle); await handle.query("commit"); }
    catch (error) { await handle.query("rollback").catch(() => undefined); throw error; }
  }
  const prepared = await captureFooterComposition60(handle);
  assert.deepEqual(prepared.registry, baseline.registry);
  const retainedFooterBusiness = (await handle.query(`select key,md5(value::text) as md5 from public.site_settings
    where key in ('footer.contact_items','footer.social_links','footer.legal') order by key`)).rows;
  const result = { sourceSha256: sourceDigest(source), historical: options.historical === true, syntheticHistoricalInput: options.historical === true,
    sequenceRollbackClaimed: false, failuresExecuted: options.verifyFailures !== false, failures, retainedFooterBusiness, baseline, prepared };
  evidence(outputDir, "before60-verification.json", result);
  return result;
}

export async function readFooterComposition60Closure(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const acl = (await handle.query(`select pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,p.proconfig,p.pronargs,
    pg_get_function_result(p.oid) as result,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='footer_public_composition_provenance'`)).rows;
  assert.equal(acl.length, 1);
  assert.deepEqual(acl[0], { owner: "postgres", prosecdef: true, provolatile: "s", proconfig: ['search_path=""'], pronargs: 0,
    result: "jsonb", anon_execute: false, authenticated_execute: false, service_execute: true });
  await handle.query("begin transaction read only");
  try {
    await handle.query("set local role service_role");
    const row = (await handle.query(`select public.footer_public_composition_provenance() as provenance,
      public.global_seo_infrastructure_health() as infrastructure`)).rows[0];
    const provenance = object(row.provenance), infrastructure = object(row.infrastructure);
    await handle.query("commit");
    const proof = evaluateFooterCompositionProof({ singleSource: infrastructure.footer_single_source as boolean,
      orphanSettings: infrastructure.footer_orphan_setting_count as number,
      unresolvedReferences: infrastructure.public_composition_unresolved_reference_count as number,
      historicalAudits: infrastructure.footer_public_composition_audit_count as number,
      publishedHomeAssignments: infrastructure.home_composition_assignment_count as number,
      mediaHubAssignments: infrastructure.media_hub_composition_assignment_count as number,
      mediaSidebarAssignments: infrastructure.media_sidebar_composition_assignment_count as number,
      mediaHeroAssignments: infrastructure.media_hero_composition_assignment_count as number,
    }, { data: provenance, error: null });
    assert.equal(proof.ok, true, "Actual DB receipt failed the current Global SEO owner contract");
    return { acl: acl[0], provenance, infrastructure, proof };
  } catch (error) { await handle.query("rollback").catch(() => undefined); throw error; }
}

/** Calls the existing atomic Footer writer with explicit synthetic test values.
 * No SQL repair or persistent content is introduced; the whole call rolls back. */
async function verifyFooterSaveRollback(handle: OwnedLocalHandle) {
  const baseline = await captureFooterComposition60(handle);
  const content = { slots: structuredClone(DEFAULT_FOOTER_SLOTS),
    contactItems: [{ label: "QA contact", value: "Synthetic fixture only", href: "mailto:qa@example.invalid", visible: true }],
    socialLinks: [{ platform: "facebook", label: "QA social", href: "https://example.invalid/qa", visible: true }],
    legal: { copyright: "QA isolated verification", tagline: "Synthetic test content" } };
  const ready = evaluateFooterReadiness(content);
  assert.equal(ready.systemValid, true);
  assert.equal(ready.publicationReady, true);
  const settings = [{ key: "footer.slots", value: content.slots }, { key: "footer.contact_items", value: content.contactItems },
    { key: "footer.social_links", value: content.socialLinks }, { key: "footer.legal", value: content.legal }];
  await handle.query("begin");
  try {
    await handle.query("set local role service_role");
    const saved = object((await handle.query(`select public.save_footer_settings($1::jsonb,null,'system:test',
      'qa.footer.atomic_roundtrip','{"fixture":"migration60-verification"}'::jsonb) as result`, [JSON.stringify(settings)])).rows[0].result);
    assert.equal(saved.settings_count, FOOTER_SETTING_KEYS.length);
    const rows = (await handle.query("select key,value from public.site_settings where key=any($1::text[]) order by key", [[...FOOTER_SETTING_KEYS]])).rows;
    assert.deepEqual(Object.fromEntries(rows.map(row => [String(row.key), row.value])), Object.fromEntries(settings.map(row => [row.key, row.value])));
    const audits = (await handle.query(`select actor_admin_user_id,actor_username,action,entity_type,entity_label,metadata
      from public.admin_audit_logs where action='qa.footer.atomic_roundtrip'`)).rows;
    assert.equal(audits.length, 1);
    assert.deepEqual(audits[0], { actor_admin_user_id: null, actor_username: "system:test", action: "qa.footer.atomic_roundtrip",
      entity_type: "footer_settings", entity_label: "footer.slots", metadata: { fixture: "migration60-verification",
        persisted_keys: [...FOOTER_SETTING_KEYS].sort(), persistence_owner: "save_footer_settings" } });
    const leaf = object((await handle.query("select public.footer_public_composition_provenance() as proof")).rows[0].proof);
    assert.deepEqual(leaf.footer_settings, Object.fromEntries(settings.map(row => [row.key, row.value])));
    assert.equal(leaf.input_state, "proven_fresh");
    assert.equal(leaf.historical_audit_total, 0);
  } finally { await handle.query("rollback"); }
  assert.deepEqual(await captureFooterComposition60(handle), baseline);
  return { atomicWriter: "save_footer_settings", completeSaveReadback: true, canonicalAudit: true,
    receiptReflectsCurrentValues: true, rolledBack: true, sequenceRollbackClaimed: false };
}

export async function after60(handle: OwnedLocalHandle, outputDir: string, options: Options = { historical: false }) {
  assertOwnedLocalHandle(handle);
  const before = JSON.parse(readFileSync(resolve(outputDir, "before60-verification.json"), "utf8")) as Awaited<ReturnType<typeof before60>>;
  assert.equal(before.historical, options.historical === true);
  assert.equal(sourceDigest(readFooterCompositionMigration60()), before.sourceSha256);
  const snapshot = await captureFooterComposition60(handle);
  assert.equal(snapshot.registry.length, 60);
  assert.deepEqual(snapshot.registry.slice(0, 59), before.prepared.registry);
  assert.equal(snapshot.registry[59].version, FOOTER_COMPOSITION_MIGRATION60_VERSION);
  assert.equal(snapshot.registry[59].name, "footer_public_composition_truth_closure");
  assert.ok(snapshot.registry[59].statementCount > 0);
  const closure = await readFooterComposition60Closure(handle);
  const leaf = closure.provenance, home = object(leaf.home), footer = object(leaf.footer_settings);
  assert.equal(leaf.input_state, options.historical ? "historical_configured" : "proven_fresh");
  assert.equal(closure.infrastructure.media_hub_composition_assignment_count, 5);
  assert.equal(closure.infrastructure.media_sidebar_composition_assignment_count, 18);
  assert.equal(closure.infrastructure.media_hero_composition_assignment_count, 6);
  const historicalCount = options.historical ? 2 : 0;
  assert.equal(leaf.historical_audit_total, historicalCount);
  assert.deepEqual(leaf.historical_audit_counts, { footer_brand_removed: historicalCount / 2, composition_fallback_retired: historicalCount / 2 });
  assert.equal((await handle.query("select count(*)::int as count from public.site_settings where key='footer.brand'")).rows[0].count, 0);
  const identity = (await handle.query("select id::text,title,slug,path,page_type,status,is_system from public.pages where id=$1", [home.id])).rows[0];
  assert.ok(identity);
  assert.equal(identity.slug, "home"); assert.equal(identity.path, "/"); assert.equal(identity.page_type, "home"); assert.equal(identity.is_system, true);
  let writerProof: Awaited<ReturnType<typeof verifyFooterSaveRollback>> | null = null;
  if (options.historical) {
    assert.deepEqual((await handle.query(`select key,md5(value::text) as md5 from public.site_settings
      where key in ('footer.contact_items','footer.social_links','footer.legal') order by key`)).rows, before.retainedFooterBusiness);
    assert.equal(Number(home.id), homeTestId);
    assert.equal(home.status, "published");
    assert.equal(home.assignment_count, 4);
    assert.equal(home.published_assignment_count, 4);
    assert.deepEqual(footer["footer.slots"], DEFAULT_FOOTER_SLOTS);
    const assignments = (await handle.query(`select t.slug,a.sort_order,a.slot,a.is_visible,t.status from public.page_content_block_assignments a
      join public.content_block_templates t on t.id=a.template_id where a.page_id=$1 order by a.sort_order`, [homeTestId])).rows;
    assert.deepEqual(assignments, HOME_MODULE_SLUGS.map((slug, index) => ({ slug, sort_order: (index + 1) * 10,
      slot: "main", is_visible: true, status: "published" })));
  } else {
    assert.equal(home.status, "draft");
    assert.equal(home.assignment_count, 0);
    assert.equal(home.published_assignment_count, 0);
    const expected = createFreshFooterSettings();
    assert.deepEqual(footer, { "footer.slots": expected.slots, "footer.contact_items": expected.contactItems,
      "footer.social_links": expected.socialLinks, "footer.legal": expected.legal });
    const readiness = evaluateFooterReadiness({ slots: footer["footer.slots"], contactItems: footer["footer.contact_items"],
      socialLinks: footer["footer.social_links"], legal: footer["footer.legal"] });
    assert.equal(readiness.systemValid, true);
    assert.equal(readiness.publicationReady, false);
    assert.equal(snapshot.rowDigests.admin_audit_logs.count, 0);
    writerProof = await verifyFooterSaveRollback(handle);
  }
  assert.ok(closure.proof.ok);
  assert.equal(closure.proof.homeStatus, options.historical ? "pass" : "warning");
  assert.equal(closure.proof.footerStatus, options.historical ? "pass" : "warning");
  const result = { sourceSha256: before.sourceSha256, historical: options.historical === true, proof: closure.proof,
    acl: closure.acl, home, footerContentSha256: digest(footer), historicalAudits: historicalCount,
    sourceRegistryPreserved: true, footerPresetParity: true, writerProof, snapshot };
  evidence(outputDir, "after60-verification.json", result);
  handle.record("migration60-verified", { historical: options.historical === true, registryCount: 60,
    historicalAudits: historicalCount, currentOwnerProof: true, atomicFooterRoundtrip: writerProof !== null });
  return result;
}
