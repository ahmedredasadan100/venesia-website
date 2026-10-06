import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";
// @ts-expect-error The repository uses pg without separate declarations.
import pg from "pg";
import { loadEntitySeoPersistenceOwner, runEntitySeoBackfill } from "./backfill-entity-seo-scores.mts";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

// Native PostgreSQL cutover proof. Real old/new payload builders, domain create,
// duplicate actions and rebind owner execute against a small SQL transport port.
// Auth, cache, audit and media-lease delivery are explicit infrastructure ports;
// their behavior is not claimed by this test. No HTTP/Browser/timing claim.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const OLD_SHA = "2f367f6454032b109e48b4b798f80c6e8a190374";
type Row = Record<string, unknown>;
type Exports = Record<string, unknown>;
type Reply = { data: unknown; error: { code?: string; message: string } | null; count?: number };
type NativeDatabase = { query(sql: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>; end(): Promise<void> };
const call = <T,>(exports: Exports, name: string, ...args: unknown[]): T => {
  assert.equal(typeof exports[name], "function", `Actual export missing: ${name}`);
  return (exports[name] as (...values: unknown[]) => T)(...args);
};
const identifier = (value: string) => { assert.match(value, /^[a-z_][a-z0-9_]*$/); return `"${value}"`; };
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const tuple = (row: Row) => ({ seo_score: row.seo_score, seo_score_version: row.seo_score_version, seo_score_input_hash: row.seo_score_input_hash });

function nativeTransport(db: NativeDatabase, jsonColumns: Set<string>) {
  const trace: Array<{ table: string; operation: string; columns: string }> = [];
  function from(table: string) {
    identifier(table);
    let operation = "select", columns = "*", payload: Row | null = null;
    let head = false, counted = false, offset = 0, limit: number | null = null;
    const filters: Array<{ key: string; op: string; value: unknown }> = [];
    const orders: string[] = [];
    const bindValue = (key: string, value: unknown) => jsonColumns.has(`${table}.${key}`) && value !== null ? JSON.stringify(value) : value;
    const run = async (): Promise<Reply> => {
      const values: unknown[] = [];
      const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
      const select = columns === "*" ? "*" : columns.split(",").map(column => identifier(column.trim())).join(",");
      const predicates = () => filters.map(({ key, op, value }) => {
        const column = identifier(key);
        if (op === "is") { assert.equal(value, null); return `${column} is null`; }
        if (op === "not-null") return `${column} is not null`;
        if (op === "in") { assert.ok(Array.isArray(value)); return `${column}=any(${param(value)})`; }
        return `${column}${op}${param(bindValue(key, value))}`;
      }).join(" and ");
      trace.push({ table, operation, columns });
      try {
        let result;
        if (operation === "insert") {
          assert.ok(payload); const keys = Object.keys(payload).filter(key => payload![key] !== undefined);
          result = await db.query(`insert into public.${identifier(table)} (${keys.map(identifier)}) values (${keys.map(key => param(bindValue(key, payload![key])))}) returning ${select}`, values);
        } else if (operation === "update") {
          assert.ok(payload); const keys = Object.keys(payload).filter(key => payload![key] !== undefined);
          const sets = keys.map(key => `${identifier(key)}=${param(bindValue(key, payload![key]))}`);
          const where = predicates(); assert.ok(where, "Native test updates must be scoped");
          result = await db.query(`update public.${identifier(table)} set ${sets} where ${where} returning ${select}`, values);
        } else {
          const where = predicates(); const suffix = where ? ` where ${where}` : "";
          let count: number | undefined;
          if (counted) count = Number((await db.query(`select count(*)::int n from public.${identifier(table)}${suffix}`, values)).rows[0].n);
          if (head) return { data: null, error: null, count };
          result = await db.query(`select ${select} from public.${identifier(table)}${suffix}${orders.length ? ` order by ${orders.join(",")}` : ""}${limit === null ? "" : ` limit ${limit} offset ${offset}`}`, values);
          return { data: clone(result.rows), error: null, count };
        }
        return { data: clone(result.rows), error: null };
      } catch (error) {
        const value = error as { code?: string; message?: string };
        return { data: null, error: { code: value.code, message: value.message ?? "Native SQL failed" } };
      }
    };
    const query = {
      select(value = "*", options: { head?: boolean; count?: string } = {}) { columns = value; head = options.head === true; counted = options.count === "exact"; return query; },
      insert(value: Row) { operation = "insert"; payload = value; return query; },
      update(value: Row) { operation = "update"; payload = value; return query; },
      eq(key: string, value: unknown) { filters.push({ key, op: "=", value }); return query; },
      neq(key: string, value: unknown) { filters.push({ key, op: "<>", value }); return query; },
      is(key: string, value: unknown) { filters.push({ key, op: "is", value }); return query; },
      not(key: string, op: string, value: unknown) { assert.equal(op, "is"); assert.equal(value, null); filters.push({ key, op: "not-null", value }); return query; },
      in(key: string, value: unknown[]) { filters.push({ key, op: "in", value }); return query; },
      contains(key: string, value: Row) { filters.push({ key, op: "@>", value }); return query; },
      order(key: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) { orders.push(`${identifier(key)} ${options.ascending === false ? "desc" : "asc"} nulls ${options.nullsFirst === true ? "first" : "last"}`); return query; },
      range(start: number, end: number) { assert.ok(start >= 0 && end >= start); offset = start; limit = end - start + 1; return query; },
      limit(value: number) { assert.ok(Number.isSafeInteger(value) && value > 0); limit = value; return query; },
      returns() { return query; },
      async maybeSingle() { const result = await run(); const rows = result.data as Row[] | null; assert.ok(!rows || rows.length <= 1); return { ...result, data: rows?.[0] ?? null }; },
      async single() { const result = await query.maybeSingle(); if (!result.error) assert.ok(result.data); return result; },
      then(onfulfilled: (value: Reply) => unknown, onrejected?: (reason: unknown) => unknown) { return run().then(onfulfilled, onrejected); },
    };
    return query;
  }
  const rpc = async (name: string, args: Row): Promise<Reply> => {
    identifier(name); const keys = Object.keys(args); const values = keys.map(key => typeof args[key] === "object" && args[key] !== null && !Array.isArray(args[key]) ? JSON.stringify(args[key]) : args[key]);
    try {
      const result = await db.query(`select * from public.${identifier(name)}(${keys.map((key, i) => `${identifier(key)}=>$${i + 1}`)})`, values);
      const scalar = ["admin_content_topic_metrics", "admin_mutate_topics_batch_atomically", "admin_publish_topics_atomically"].includes(name);
      const data = scalar ? result.rows[0]?.[name] : result.rows;
      return { data: clone(data), error: null };
    } catch (error) { const value = error as { code?: string; message?: string }; return { data: null, error: { code: value.code, message: value.message ?? "Native RPC failed" } }; }
  };
  return { from, rpc, trace };
}

// The Supabase-shaped port above is injected only into actual application
// owners. Test-body persistence of their payloads is native fixture setup,
// performed explicitly against the guarded disposable database. It does not
// constitute a script-level application writer or media-coordination adoption.
function nativeTopicsFixture(db: NativeDatabase, jsonColumns: Set<string>) {
  const fields = (payload: Row) => {
    const keys = Object.keys(payload).filter(key => payload[key] !== undefined);
    assert.ok(keys.length > 0); keys.forEach(identifier);
    const values = keys.map(key => jsonColumns.has(`topics.${key}`) && payload[key] !== null ? JSON.stringify(payload[key]) : payload[key]);
    return { keys, values };
  };
  return {
    async insert(payload: Row) {
      const { keys, values } = fields(payload);
      const result = await db.query(`insert into public.topics (${keys.map(identifier).join(",")}) values (${keys.map((_, index) => `$${index + 1}`).join(",")}) returning id`, values);
      assert.equal(result.rowCount, 1); return Number(result.rows[0].id);
    },
    async update(id: number, payload: Row) {
      assert.ok(Number.isSafeInteger(id) && id > 0);
      const { keys, values } = fields(payload);
      const result = await db.query(`update public.topics set ${keys.map((key, index) => `${identifier(key)}=$${index + 1}`).join(",")} where id=$${values.length + 1} returning id`, [...values, id]);
      assert.equal(result.rowCount, 1); assert.equal(Number(result.rows[0].id), id);
    },
  };
}

function sourceRuntime(sourceRoot: string, transport: ReturnType<typeof nativeTransport>, actorId: number, old: boolean) {
  const cache = new Map<string, { exports: Exports }>();
  const files: Array<{ file: string; sha256: string; matchesOldCommit: boolean | null }> = [];
  let analyses = 0;
  class LeaseError extends Error {}
  const coordinate = async (options: { mutate(): Promise<unknown> }) => ({ value: await options.mutate(), mediaSynchronization: { status: "synced" } });
  const ports = new Map<string, Exports>([
    ["src/lib/supabase-admin.ts", { getSupabaseAdmin: () => transport }],
    ["src/lib/admin/auth/require-admin-session.ts", { requireAdminSession: async () => ({ id: actorId }) }],
    ["src/lib/admin/audit-log.ts", { recordCmsAdminAudit: async () => {} }],
    ["src/lib/admin/media-catalog/domain-write-coordination.ts", { coordinateMediaReferenceEntityMutation: coordinate }],
    ["src/lib/admin/media-catalog/write-lease.ts", { MediaReferenceWriteLeaseError: LeaseError, getMediaReferenceWriteLeaseUserMessage: () => "Fixture lease port" }],
    ["src/lib/admin/media-catalog/synchronization.ts", { synchronizeMediaReferenceWriteScopesAfterDomainMutation: async () => ({ status: "synced" }) }],
    ["src/lib/cache/revalidate-public-cache-tags.ts", { revalidateTopicsCache() {}, revalidateMediaCenterCache() {}, runBoundedPublicCacheRevalidation: async (run: () => unknown) => { await run(); return { ok: true, attempts: 1 }; } }],
    ["src/lib/media-center/revalidate-public-paths.ts", { revalidateMediaCenterPublicPaths() {} }],
    ["src/lib/admin/preferences/admin-column-preferences.ts", { saveAdminColumnPreferences: async () => { throw new Error("Preferences outside rehearsal"); } }],
    ["src/lib/logging.ts", { logError() {}, logWarn() {}, logInfo() {} }],
    ["src/lib/storage/upload-cms-asset.ts", { parseManagedStorageAsset: () => null }],
  ]);
  function load(file: string): Exports {
    const absolute = resolve(sourceRoot, file); const normalized = relative(sourceRoot, absolute).replaceAll("\\", "/");
    assert.ok(!normalized.startsWith("..")); if (ports.has(normalized)) return ports.get(normalized)!;
    const previous = cache.get(absolute); if (previous) return previous.exports;
    const source = readFileSync(absolute, "utf8");
    const oldSource = old ? execFileSync("git", ["show", `${OLD_SHA}:${normalized}`], { cwd: ROOT }) : null;
    if (oldSource) assert.equal(source.replaceAll("\r\n", "\n"), oldSource.toString("utf8").replaceAll("\r\n", "\n"), `Frozen old writer drift: ${normalized}`);
    files.push({ file: normalized, sha256: hash(source), matchesOldCommit: oldSource ? true : null });
    const loadedModule = { exports: {} as Exports }; cache.set(absolute, loadedModule);
    const compiled = ts.transpileModule(source, { fileName: absolute, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function("require", "module", "exports", compiled)((specifier: string) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/cache") return { revalidatePath() {}, revalidateTag() {} };
      if (specifier === "next/navigation") return { redirect() { throw new Error("Navigation outside native rehearsal"); } };
      if (!specifier.startsWith(".")) return require(specifier);
      const base = resolve(dirname(absolute), specifier);
      const dependency = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert.ok(dependency, `Unresolved actual source dependency: ${specifier}`);
      return load(relative(sourceRoot, dependency));
    }, loadedModule, loadedModule.exports);
    if (normalized === "src/lib/admin/seo-score.ts") {
      const analyze = loadedModule.exports.analyzeEntitySeo as (input: unknown) => unknown;
      loadedModule.exports.analyzeEntitySeo = (input: unknown) => { analyses++; return analyze(input); };
    }
    return loadedModule.exports;
  }
  return { load, files, analysisCount: () => analyses, infrastructurePorts: [...ports.keys()] };
}

export async function runEntitySeoCutoverPostgres(options: { fixtureConfig: string; migrationLauncher?: string; enforceMigration: string; output: string; ownedHandle?: OwnedLocalHandle }) {
  const config = JSON.parse(readFileSync(resolve(ROOT, options.fixtureConfig), "utf8"));
  const owned = options.ownedHandle;
  if (owned) {
    assertOwnedLocalHandle(owned);
    assert.equal(options.migrationLauncher, undefined, "Owned cutover uses its scoped native connection.");
  }
  if (!owned) {
    const target = new URL(config.databaseUrl);
    assert.ok(target.protocol === "postgres:" || target.protocol === "postgresql:");
    assert.equal(target.search, ""); assert.equal(target.hash, "");
    assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55445"); assert.equal(target.pathname, "/entity_seo_rollout");
  }
  assert.equal(config.disposable, true); assert.equal(config.baselineSha, OLD_SHA);
  assert.ok(relative(resolve(ROOT, ".tmp-qa"), resolve(ROOT, options.output)).startsWith("entity-seo-cutover"));
  pg.types.setTypeParser(20, (value: string) => Number(value));
  // Preserve PostgreSQL microseconds like the PostgREST string contract; Date
  // would truncate the revision token and create a false duplicate conflict.
  pg.types.setTypeParser(1184, (value: string) => value);
  pg.types.setTypeParser(1114, (value: string) => value);
  const db: NativeDatabase = owned ? { query: (sql, values) => owned.query(sql, values), async end() {} }
    : new pg.Client({ connectionString: config.databaseUrl, application_name: "entity-seo-cutover-rehearsal" });
  if (!owned) await (db as NativeDatabase & { connect(): Promise<void> }).connect();
  const runBackfill = (mode: "apply" | "verify") => owned
    ? owned.runEntitySeoBackfill({ mode, entities: ["topics", "projects"] })
    : runEntitySeoBackfill({ connectionString: config.databaseUrl, expectedDatabase: "entity_seo_rollout", entities: ["topics", "projects"], [mode]: true, batchSize: 37 });
  const owner = loadEntitySeoPersistenceOwner();
  const checks: Array<{ stage: string; check: string }> = [];
  const stages: Array<{ stage: string; result: unknown }> = [];
  let stage = "baseline";
  const pass = (check: string) => { checks.push({ stage, check }); console.log(`PASS ${stage}: ${check}`); };
  const one = async (sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as Row;
  const readTopic = (id: number) => one("select * from public.topics where id=$1", [id]);
  const readProject = (id: number) => one("select * from public.projects where id=$1", [id]);
  const assertPending = (row: Row) => assert.deepEqual(tuple(row), { seo_score: null, seo_score_version: null, seo_score_input_hash: null });
  const assertCanonical = (entity: "topics" | "projects", row: Row) => {
    const input = entity === "topics" ? owner.toTopicSeoScoreInput(row as Parameters<typeof owner.toTopicSeoScoreInput>[0]) : owner.toProjectSeoScoreInput(row);
    assert.deepEqual(tuple(row), owner.deriveEntitySeoScore(input));
  };
  const sourceDigest = async () => one(`select
    (select md5(string_agg((to_jsonb(t)-'seo_score'-'seo_score_version'-'seo_score_input_hash')::text,'' order by id)) from public.topics t) as topics,
    (select md5(string_agg((to_jsonb(p)-'seo_score'-'seo_score_version'-'seo_score_input_hash')::text,'' order by id)) from public.projects p) as projects`);
  const jsonColumns = new Set<string>((await db.query("select table_name,column_name from information_schema.columns where table_schema='public' and data_type in ('json','jsonb')")).rows.map((row: Row) => `${row.table_name}.${row.column_name}`));
  const transport = nativeTransport(db, jsonColumns);
  const topicFixture = nativeTopicsFixture(db, jsonColumns);
  const actorId = Number((await one("select id from public.admin_users order by id limit 1")).id);
  const old = sourceRuntime(config.oldSourceRoot, transport, actorId, true);
  const current = sourceRuntime(ROOT, transport, actorId, false);
  const category = await one("select * from public.topic_categories where is_active and deleted_at is null order by id limit 1");
  const rootProject = await readProject(Number((await one("select id from public.projects where slug='synthetic-seo-project-1'")).id));
  const apply = async (phase: "expand" | "enforce") => {
    if (options.migrationLauncher) {
      execFileSync(process.execPath, [resolve(ROOT, options.migrationLauncher), `--phase=${phase}`, `--enforce=${options.enforceMigration}`, "--authorized-isolated-cutover-rehearsal"], { cwd: ROOT, stdio: "inherit", windowsHide: true });
      return;
    }
    const files = phase === "expand" ? ["sql/migrations/20260914004050_entity_seo_persisted_score.sql", "sql/migrations/20260914004118_project_seo_persisted_score.sql"] : [options.enforceMigration];
    for (const file of files) {
      const sql = readFileSync(resolve(ROOT, file), "utf8"); await db.query(sql);
      stages.push({ stage: phase, result: { file, sha256: hash(sql), application: "exact SQL native; official CLI registry-format proof is a separate artifact" } });
    }
  };
  const makeForm = (prefix: string, type = "article") => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ title: "دليل فينيسيا المحلي لاختبار عقد حفظ الموضوعات", slug: `${prefix}-${randomUUID()}`, excerpt: "وصف اصطناعي محلي للاختبار فقط ولا يمثل بيانات منشورة", content: "<h2>فينيسيا</h2><p>محتوى اختبار معزول</p>", image: "/images/venesia-5.png", image_alt: "فينيسيا", category_id: String(category.id), content_type: type, status: "unpublished", seo_title: "", seo_description: "", focus_keyword: "فينيسيا" })) form.set(key, value);
    return form;
  };
  const resultOk = (value: Row) => assert.equal(value.ok, true, `Actual action failed: ${String(value.code ?? value.message ?? "unknown")}`);
  async function topicsWriters(runtime: ReturnType<typeof sourceRuntime>, prefix: string, pending: boolean) {
    const article = runtime.load("src/app/admin/content/topics/article-actions/helpers.ts");
    const media = runtime.load("src/app/admin/content/topics/media-actions/helpers.ts");
    const domain = runtime.load("src/app/admin/content/topics/article-actions/create-domain.ts");
    const actions = runtime.load("src/app/admin/content/topics/actions.ts");
    const form = makeForm(prefix);
    const input = call<Row>(article, "getPayload", form);
    const created = await call<Promise<{ value: { id: number } }>>(domain, "createArticleDomainRecord", { payload: input, category, series: null, status: "unpublished", actorId, now: new Date().toISOString(), requestIdentity: `rehearsal:${prefix}` });
    const articleId = created.value.id;
    let row = await readTopic(articleId); if (pending) assertPending(row); else assertCanonical("topics", row);
    pass(`${prefix} actual Article domain/create/import persistence boundary`);
    const imported = await call<Promise<{ value: { id: number } }>>(domain, "createArticleDomainRecord", { payload: { ...input, slug: `${prefix}-import-${randomUUID()}` }, category, series: null, status: "unpublished", actorId, now: new Date().toISOString(), requestIdentity: `rehearsal:import:${prefix}` });
    assert.ok(imported.value.id !== articleId);
    const changed = call<Row>(article, "buildTopicWritePayload", { ...input, content: "<p>مدخل مقالة معدل أثناء الانتقال</p>" }, category, null, "unpublished", new Date().toISOString(), row);
    await topicFixture.update(articleId, changed);
    row = await readTopic(articleId); if (pending) assertPending(row); else assertCanonical("topics", row); pass(`${prefix} actual Article edit payload`);
    for (const type of ["news", "video", "gallery", "press", "site_update"]) {
      const mediaInput = call<Row>(media, "getPayload", makeForm(`${prefix}-${type}`, type));
      const mediaPayload = type === "video" ? { kind: "video", provider: "youtube", video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnail: null, duration: null } : type === "gallery" ? { kind: "gallery", images: [{ url: "/images/venesia-5.png", alt: "فينيسيا" }] } : null;
      const payload = call<Row>(media, "buildMediaWritePayload", mediaInput, category, type, mediaPayload, new Date().toISOString());
      const id = await topicFixture.insert({ ...payload, created_by: actorId, updated_by: actorId });
      const before = await readTopic(id);
      if (pending) assertPending(before); else assertCanonical("topics", before);
      const next = call<Row>(media, "buildMediaWritePayload", { ...mediaInput, excerpt: "وصف اصطناعي معدل" }, category, type, mediaPayload, new Date().toISOString(), before);
      await topicFixture.update(id, next);
      const after = await readTopic(id); if (pending) assertPending(after); else assertCanonical("topics", after);
      pass(`${prefix} actual ${type} Media create/edit payloads`);
    }
    const actionForm = new FormData(); actionForm.set("id", String(articleId));
    const duplicated = await call<Promise<Row>>(actions, "duplicateUnifiedContent", actionForm); resultOk(duplicated);
    const copyId = Number(duplicated.entityId); const copy = await readTopic(copyId); if (pending) assertPending(copy); else assertCanonical("topics", copy); pass(`${prefix} actual Topics duplicate action`);
    const beforeFlags = tuple(await readTopic(articleId));
    const featuredForm = new FormData(); featuredForm.set("id", String(articleId));
    featuredForm.set("desired_featured", "true");
    resultOk(await call<Promise<Row>>(actions, "toggleUnifiedContentFeatured", featuredForm));
    assert.equal((await readTopic(articleId)).is_featured, true);
    assert.deepEqual(tuple(await readTopic(articleId)), beforeFlags); pass(`${prefix} actual Featured retains derived state`);
    const statusForm = new FormData(); statusForm.set("id", "80"); statusForm.set("next_status", "unpublished");
    const statusBefore = tuple(await readTopic(80)); resultOk(await call<Promise<Row>>(actions, "setUnifiedContentStatus", statusForm));
    statusForm.set("next_status", "published"); resultOk(await call<Promise<Row>>(actions, "setUnifiedContentStatus", statusForm));
    assert.deepEqual(tuple(await readTopic(80)), statusBefore); pass(`${prefix} actual Status both directions retains derived state`);
    const providers = runtime.load("src/lib/admin/media-catalog/reference-providers.ts");
    const provider = call<{ rebind(reference: Row, value: string): Promise<void> }>(providers, "getMediaReferenceProvider", "topics");
    await provider.rebind({ domainKey: "topics", entityIdentity: String(articleId), fieldKey: "image", publicValue: "/images/venesia-5.png" }, "/images/venesia-6.png");
    row = await readTopic(articleId); if (pending) assertPending(row); else assertCanonical("topics", row); pass(`${prefix} actual Media rebind owner`);
    return { articleId, copyId, input, article, actions, provider };
  }
  function projectPayload(prefix: string, fresh: boolean) {
    const project: Row = { ...rootProject, slug: `${prefix}-${randomUUID()}`, code: "CUTOVER-PROOF", publication_status: "unpublished", featured: false, show_on_homepage: false, homepage_order: 0 };
    delete project.id;
    for (const field of owner.PERSISTED_ENTITY_SEO_FIELDS) delete project[field];
    if (fresh) Object.assign(project, owner.deriveEntitySeoScore(owner.toProjectSeoScoreInput(project)));
    return { project, publication_actor_id: actorId, publication_previous_status: null as string | null, location_section_presentation: { show_location_label: true, show_location_tags: true }, deleted: {}, location_points: [], features: [], floor_plans: [], delivery_items: [], media: [], videos: [] };
  }
  async function projectWriters(prefix: string, fresh: boolean) {
    const payload = projectPayload(prefix, fresh);
    const created = await one("select * from public.save_project_admin_entry(null,$1::jsonb)", [JSON.stringify(payload)]);
    const id = Number(created.project_id); let row = await readProject(id);
    assert.equal(row.code, "CUTOVER-PROOF"); if (fresh) assertCanonical("projects", row); else assertPending(row); pass(`${prefix} native Project create / existing code contract`);
    payload.project.overview_body = "<p>تعديل مشروع معزول</p>"; payload.publication_previous_status = "unpublished";
    if (fresh) Object.assign(payload.project, owner.deriveEntitySeoScore(owner.toProjectSeoScoreInput(payload.project)));
    await one("select * from public.save_project_admin_entry($1,$2::jsonb)", [id, JSON.stringify(payload)]);
    row = await readProject(id); if (fresh) assertCanonical("projects", row); else assertPending(row); pass(`${prefix} native Project edit aggregate`);
    const proof = fresh ? call<Row>(current.load("src/lib/admin/projects/project-duplicate-seo.ts"), "buildProjectDuplicateSeoProof", row, 1) : null;
    const copyResult = fresh ? await one("select * from public.duplicate_project_admin_entry($1,$2::jsonb)", [id, JSON.stringify(proof)]) : await one("select * from public.duplicate_project_admin_entry($1)", [id]);
    const copied = await readProject(Number(copyResult.project_id));
    assert.equal(copied.code, `${String(row.code).slice(0, 48)}-COPY-${copied.id}`);
    if (fresh) assertCanonical("projects", copied); else assertPending(copied); pass(`${prefix} native Project duplicate / final allocated code`);
    return { id, payload };
  }
  async function backfill(label: string, mode: "apply" | "verify") {
    const before = await sourceDigest();
    const result = await runBackfill(mode);
    assert.deepEqual(await sourceDigest(), before, "Backfill preserves every non-derived field including editorial timestamps");
    assert.equal(result.complete, true); assert.equal(result.readyForEnforcement, mode === "verify");
    assert.equal(result.counts.conflicted, 0); assert.equal(result.counts.failed, 0); assert.equal(result.counts.unresolved, 0);
    if (mode === "verify") assert.equal(result.counts.written, 0);
    stages.push({ stage: label, result }); pass(`${label}: bounded canonical owner / non-derived field preservation`);
    return result;
  }
  try {
    assert.equal((await one("select current_database() as name")).name, owned ? owned.identity.database : "entity_seo_rollout");
    assert.equal((await one("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='topics' and column_name='seo_score') expanded")).expanded, false);
    assert.equal((await one("select count(*)::int n from supabase_migrations.schema_migrations")).n, 103);
    pass("fresh canonical pre-162 schema/registry and synthetic data");
    const coreSpecs = [
      { signature: "public.save_project_admin_entry_core(bigint,jsonb)", spaces: "      ", oldValue: "v_root ->> 'type',", newValue: "v_root ->> 'type', upper(btrim(coalesce(v_root->>'code', v_root->>'slug')))," },
      { signature: "public.duplicate_project_admin_entry_core(bigint)", spaces: "        ", oldValue: "v_source.type,", newValue: "v_source.type, v_source.code," },
    ];
    const coreDefinitions = new Map<string, string>();
    const projectExpand = readFileSync(resolve(ROOT, "sql/migrations/20260914004118_project_seo_persisted_score.sql"), "utf8");
    const patchBlock = projectExpand.match(/do \$core_insert_code\$[\s\S]*?\$core_insert_code\$;/)?.[0]; assert.ok(patchBlock);
    for (const spec of coreSpecs) {
      const original = String((await one("select pg_get_functiondef($1::regprocedure) as body", [spec.signature])).body).replaceAll("\r\n", "\n");
      coreDefinitions.set(spec.signature, original);
      const unknown = original.replace("AS $function$\n", "AS $function$\n-- isolated unknown-core fingerprint proof\n"); assert.notEqual(unknown, original);
      await db.query("begin");
      try { await db.query(unknown); await assert.rejects(db.query(patchBlock), owned ? { code: "P0001" } : /provenance mismatch/); }
      finally { await db.query("rollback"); }
      assert.equal(String((await one("select pg_get_functiondef($1::regprocedure) as body", [spec.signature])).body).replaceAll("\r\n", "\n"), original);
    }
    pass("native core patch rejects both unknown function bodies; transaction restores exact originals");
    stage = "expand"; await apply("expand"); pass("exact EXPAND migrations applied to the pre-162 native schema");
    for (const spec of coreSpecs) {
      const original = coreDefinitions.get(spec.signature)!;
      const expected = original.replace(`insert into public.projects (\n${spec.spaces}type, arabic_name, english_name, slug,`, `insert into public.projects (\n${spec.spaces}type, code, arabic_name, english_name, slug,`)
        .replace(`) values (\n${spec.spaces}${spec.oldValue}`, `) values (\n${spec.spaces}${spec.newValue}`);
      const actual = String((await one("select pg_get_functiondef($1::regprocedure) as body", [spec.signature])).body).replaceAll("\r\n", "\n");
      assert.equal(actual, expected); stages.push({ stage: "core-code-patch", result: { signature: spec.signature, beforeSha256: hash(original), afterSha256: hash(actual), exactCodeInsertDeltaOnly: true } });
    }
    pass("native core definitions differ only by the authorized code INSERT columns/values");
    const oldRows = await topicsWriters(old, "legacy-expand", true);
    const oldProjects = await projectWriters("legacy-expand", false);
    // Current command writers additionally depend on the later atomic RPC and
    // durable completion contract. Apply their exact SQL to this native cutover
    // fixture only; this overlay is not a canonical full-prefix replay claim.
    stage = "current-action-dependencies";
    for (const file of [
      "sql/migrations/20260925200723_topics_batch_atomic_current_state.sql",
      "sql/migrations/20260926013216_topics_command_completion.sql",
    ]) {
      const sql = readFileSync(resolve(ROOT, file), "utf8");
      await db.query(sql);
      stages.push({ stage, result: { file, sha256: hash(sql), application: "exact native action dependency overlay; canonical full replay is separate" } });
    }
    pass("current Topics command dependencies installed without changing the SEO transition/enforcement sequence");
    stage = "adopt"; await topicsWriters(current, "adopted-expand", false); await projectWriters("adopted-expand", true);
    const loader = current.load("src/lib/admin/content/load-unified-content.ts");
    const metricsBefore = await call<Promise<Row>>(loader, "loadUnifiedContentMetrics"); assert.equal(metricsBefore.error, null); assert.equal(metricsBefore.seoAverage, null); assert.ok(Number(metricsBefore.staleScores) > 0); pass("actual metrics reports unresolved count and null average before backfill");
    const filters = { q: "", view: "active", contentType: "all", categoryId: null, seriesId: null, status: "all", featured: "all", image: "all", sort: "seo_asc", page: 1, pageSize: 10 };
    const lastPendingPage = await call<Promise<{ error: string | null; rows: Row[] }>>(loader, "loadUnifiedContentList", { ...filters, page: 10000 }, []);
    assert.equal(lastPendingPage.error, null); assert.ok(lastPendingPage.rows.length > 0); assert.ok(lastPendingPage.rows.every(row => row.seo_score === null)); pass("actual list displays unresolved null scores last during EXPAND");
    stage = "backfill"; await backfill("initial-apply", "apply"); await backfill("independent-verify", "verify");
    const rerun = await backfill("idempotent-rerun", "apply"); assert.ok(rerun.entities.every(row => row.written === 0 && row.recalculated === 0)); pass("idempotency zero calculation and zero writes");
    stage = "late-legacy";
    const late = await readTopic(oldRows.articleId); const oldPayload = call<Row>(oldRows.article, "buildTopicWritePayload", { ...oldRows.input, excerpt: "مدخل قديم بعداكتمالbackfill" }, category, null, "unpublished", new Date().toISOString(), late);
    await topicFixture.update(oldRows.articleId, oldPayload); assertPending(await readTopic(oldRows.articleId));
    const duplicateForm = new FormData(); duplicateForm.set("id", String(oldRows.copyId)); const lateCopy = await call<Promise<Row>>(oldRows.actions, "duplicateUnifiedContent", duplicateForm); resultOk(lateCopy); assertPending(await readTopic(Number(lateCopy.entityId))); pass("old writer edit and duplicate after backfill cannot preserve stale proof");
    oldProjects.payload.project.overview_body = "<p>تعديل قديم متأخر</p>";
    await one("select * from public.save_project_admin_entry($1,$2::jsonb)", [oldProjects.id, JSON.stringify(oldProjects.payload)]); assertPending(await readProject(oldProjects.id)); pass("late legacy Project edit invalidates prior canonical tuple");
    const lateMetrics = await call<Promise<Row>>(loader, "loadUnifiedContentMetrics"); assert.equal(lateMetrics.seoAverage, null); assert.equal(Number(lateMetrics.staleScores), 2);
    assert.equal((await one("select count(*)::int n from public.projects where seo_score is null")).n, 1);
    await assert.rejects(runBackfill("verify"), (error: unknown) => {
      const blocked = error as { report: { complete: boolean; readyForEnforcement: boolean; counts: { unresolved: number; written: number } } };
      assert.equal(blocked.report.complete, false); assert.equal(blocked.report.readyForEnforcement, false);
      assert.equal(blocked.report.counts.unresolved, 3); assert.equal(blocked.report.counts.written, 0);
      stages.push({ stage: "late-legacy-blocked-verify", result: blocked.report }); return true;
    });
    pass("independent verify blocks enforcement for exactly two unresolved Topics and one Project");
    try { await assert.rejects(db.query(readFileSync(resolve(ROOT, options.enforceMigration), "utf8")), owned ? { code: "23514" } : /ENFORCE blocked/); }
    finally { await db.query("rollback"); }
    assert.equal((await one("select count(*)::int n from pg_trigger where tgname in ('topics_entity_seo_score_transition','projects_entity_seo_score_transition') and tgenabled='O'")).n, 2);
    pass("native ENFORCE rejects unresolved rows and preserves both transition triggers");
    stage = "catchup"; await backfill("catchup-apply", "apply"); await backfill("catchup-verify", "verify");
    stage = "enforce"; await apply("enforce"); pass("strict activation only after complete verification and adopted source gate");
    await topicsWriters(current, "new-strict", false); await projectWriters("new-strict", true);
    const beforeRejected = await sourceDigest();
    await assert.rejects(topicFixture.update(oldRows.articleId, { excerpt: "Unproved legacy SEO change" }));
    await assert.rejects(one("select * from public.save_project_admin_entry($1,$2::jsonb)", [oldProjects.id, JSON.stringify({ ...oldProjects.payload, project: { ...oldProjects.payload.project, overview_body: "Unproved strict edit" } })]));
    await assert.rejects(one("select * from public.duplicate_project_admin_entry($1)", [oldProjects.id]));
    assert.deepEqual(await sourceDigest(), beforeRejected); pass("strict legacy SEO writes and proofless Project duplicate rejected atomically");
    stage = "persisted-read";
    const beforeAnalysis = current.analysisCount(); const metrics = await call<Promise<Row>>(loader, "loadUnifiedContentMetrics"); assert.equal(metrics.error, null); assert.equal(metrics.staleScores, 0); assert.equal(typeof metrics.seoAverage, "number");
    const ascending = await db.query("select id,seo_score from public.topics where deleted_at is null order by seo_score asc nulls last,id asc limit 10");
    const descending = await db.query("select id,seo_score from public.topics where deleted_at is null order by seo_score desc nulls last,id asc limit 10");
    const ascList = await call<Promise<{ error: string | null; rows: Row[] }>>(loader, "loadUnifiedContentList", filters, []);
    const descList = await call<Promise<{ error: string | null; rows: Row[] }>>(loader, "loadUnifiedContentList", { ...filters, sort: "seo_desc" }, []);
    assert.equal(ascList.error, null); assert.equal(descList.error, null);
    assert.deepEqual(ascList.rows.map(row => row.id), ascending.rows.map((row: Row) => row.id));
    assert.deepEqual(descList.rows.map(row => row.id), descending.rows.map((row: Row) => row.id));
    assert.ok(ascending.rows.length === 10 && descending.rows.length === 10); assert.ok(Number(ascending.rows[0].seo_score) <= Number(descending.rows[0].seo_score));
    assert.equal(current.analysisCount(), beforeAnalysis); pass("persisted metrics and native SQL score sorting without read-time analysis");
    const report = { completedAt: new Date().toISOString(), complete: true, baselineSha: OLD_SHA, target: owned ? "127.0.0.1:" + owned.identity.port + "/" + owned.identity.database : "127.0.0.1:55445/entity_seo_rollout", checks, stages,
      sourceEvidence: { old: old.files, adopted: current.files }, infrastructurePorts: old.infrastructurePorts,
      scope: "Native persistence/rollout proof; no HTTP, Browser, authentication, cache, audit delivery or media lease coverage is claimed", projectCoreCodeDeltaVerified: true };
    writeFileSync(resolve(ROOT, options.output), JSON.stringify(report, null, 2)); console.log(`PASS cutover rehearsal: ${checks.length} checks`); return report;
  } catch (error) {
    const value = error as { code?: string; message?: string };
    const report = { completedAt: new Date().toISOString(), complete: false, failedStage: stage, code: value.code ?? "REHEARSAL_ASSERTION", checks, stages, message: value.message?.slice(0, 400) };
    writeFileSync(resolve(ROOT, options.output), JSON.stringify(report, null, 2)); throw error;
  } finally { await db.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const option = (name: string) => { const at = args.indexOf(name); return at < 0 ? "" : args[at + 1]; };
  assert.ok(args.includes("--authorized-isolated-cutover-rehearsal"));
  const fixtureConfig = option("--fixture-config"), migrationLauncher = option("--migration-launcher"), enforceMigration = option("--enforce-migration"), output = option("--output");
  assert.ok(fixtureConfig && enforceMigration && output, "Explicit isolated config, ENFORCE file and evidence output required");
  await runEntitySeoCutoverPostgres({ fixtureConfig, migrationLauncher, enforceMigration, output });
}
