import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Real scoring, payload builders, save actions and media rebind; infrastructure
// is injected. No external service, mutation or server is used by this proof.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const moduleLoader = require("node:module");
const originalLoad = moduleLoader._load;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Network forbidden in Topics SEO proof"); };
moduleLoader._load = (specifier, parent, isMain) => specifier === "server-only" ? {}
  : specifier === "next/navigation" ? { redirect() { throw new Error("Unexpected redirect"); } }
    : originalLoad(specifier, parent, isMain);
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};
const actual = (file) => require(path.join(root, file));
const read = (file) => readFileSync(path.join(root, file), "utf8");
function load(file, dependencies) {
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const isolated = { exports: {} };
  Function("exports", "module", "require", compiled)(isolated.exports, isolated, (specifier) => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Uninjected dependency ${file}: ${specifier}`);
    return dependencies[specifier];
  });
  return isolated.exports;
}
const scoreOwner = actual("src/lib/admin/seo-score.ts");
const originalAnalyze = scoreOwner.analyzeEntitySeo;
let analyses = 0;
let analysisFailure = false;
scoreOwner.analyzeEntitySeo = (input) => {
  analyses += 1;
  if (analysisFailure) throw new Error("Injected SEO analysis failure");
  return originalAnalyze(input);
};
const seo = actual("src/lib/admin/seo/entity-seo-persistence.ts");
const article = actual("src/app/admin/content/topics/article-actions/helpers.ts");
const media = actual("src/app/admin/content/topics/media-actions/helpers.ts");
const revision = actual("src/lib/admin/content/topic-revision.ts");
const actionResult = actual("src/lib/admin/admin-action-result.ts");
const category = { id: 9, name: "مقالات", slug: "articles" };
const now = "2026-09-01T00:00:00.000Z";
const initial = { status: "idle", mode: "edit", revision: 0 };
function form(type = "article", create = false) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    title: "دليل مفصل لاختيار موقع المشروع المناسب", slug: "project-location-guide",
    excerpt: "وصف مفصل يساعد على اختيار موقع المشروع ودراسة المرافق المحيطة والخدمات المتاحة.",
    content: "<h2>موقع المشروع</h2><p>دليل تفصيلي عن موقع المشروع والخدمات المحيطة.</p>",
    image: "/images/topics/original.jpg", image_alt: "صورة موقع المشروع",
    seo_title: "دليل موقع المشروع والخدمات المحيطة", seo_description: "وصف موقع المشروع والخدمات والمرافق وخطوات اختيار الموقع المناسب.",
    focus_keyword: "موقع المشروع", category_id: "9", content_type: type,
    status: "unpublished", expected_updated_at: now,
  })) result.set(key, value);
  if (!create) result.set("id", "42");
  return result;
}
function persisted(row) {
  return Object.fromEntries(seo.PERSISTED_ENTITY_SEO_FIELDS.map((key) => [key, row[key]]));
}
function assertCorrect(row) {
  const input = seo.toTopicSeoScoreInput(row);
  assert.equal(row.seo_score, originalAnalyze(input).score);
  assert.equal(row.seo_score_version, scoreOwner.ENTITY_SEO_SCORE_VERSION);
  assert.equal(row.seo_score_input_hash, seo.entitySeoInputHash(input));
}
function fixture(type = "article") {
  const row = type === "article"
    ? article.buildTopicWritePayload(article.getPayload(form()), category, null, "unpublished", now)
    : media.buildMediaWritePayload(media.getPayload(form(type)), category, type, null, now);
  return { ...row, id: 42, created_at: now, created_by: 1, updated_by: 1, views_count: 0 };
}
function database(initialRow, options = {}) {
  const state = { row: structuredClone(initialRow), writes: [], leases: 0, reads: [], comparisons: [] };
  const client = { from(table) {
    assert.equal(table, "topics");
    let payload = null;
    let insert = false;
    let columns = "";
    const filters = [];
    const query = {
      select(value) { columns = value; return query; },
      update(value) { payload = value; return query; },
      insert(value) { payload = value; insert = true; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      is(key, value) { filters.push([key, value]); return query; },
      in(key, value) { filters.push([key, value]); return query; },
      async maybeSingle() {
        if (!payload) {
          state.reads.push(columns);
          if (columns === "id" && filters.some(([key]) => key === "slug")) return { data: null, error: null };
          return { data: structuredClone(state.row), error: null };
        }
        options.beforeWrite?.(state);
        state.writes.push(structuredClone(payload));
        state.comparisons.push(filters);
        const matched = insert || filters.every(([key, value]) => Array.isArray(value)
          ? value.includes(state.row[key]) : (typeof state.row[key] === "object" && state.row[key] !== null
            ? JSON.stringify(state.row[key]) === value : String(state.row[key]) === String(value)));
        if (!matched) return { data: null, error: null };
        if (options.reject) return { data: null, error: { message: "Injected rejection" } };
        state.row = { ...state.row, ...payload, ...(insert ? { id: 71 } : {}) };
        options.afterWrite?.(state);
        return options.lostResponse ? { data: null, error: { message: "Lost response" } }
          : { data: structuredClone(state.row), error: null };
      },
      single() { return query.maybeSingle(); },
    };
    return query;
  } };
  const coordinate = async ({ mutate, intendedRow }) => {
    state.leases += 1;
    assertCorrect(intendedRow);
    return { value: await mutate(), mediaSynchronization: { status: "synchronized" } };
  };
  return { state, client, coordinate };
}
function actionHarness(kind, options = {}) {
  const db = database(options.row ?? fixture(kind === "media" ? "news" : "article"), options);
  const helper = kind === "media" ? media : article;
  const common = {
    "server-only": {},
    "next/cache": { revalidatePath() {} },
  };
  class LeaseError extends Error {}
  const dependenciesFor = (file) => {
    const dependencies = { ...common };
    for (const match of read(file).matchAll(/from\s+["']([^"']+)["']/g)) {
      const name = match[1];
      if (Object.hasOwn(dependencies, name)) continue;
      if (name.endsWith("entity-seo-persistence")) dependencies[name] = seo;
      else if (name.endsWith("supabase-admin")) dependencies[name] = { getSupabaseAdmin: () => db.client };
      else if (name.endsWith("require-admin-session")) dependencies[name] = { requireAdminSession: async () => ({ id: 1 }) };
      else if (name.endsWith("domain-write-coordination")) dependencies[name] = { coordinateMediaReferenceEntityMutation: db.coordinate };
      else if (name.endsWith("write-lease")) dependencies[name] = { MediaReferenceWriteLeaseError: LeaseError };
      else if (name.endsWith("topic-revision")) dependencies[name] = revision;
      else if (name.endsWith("admin-action-result")) dependencies[name] = actionResult;
      else if (name.endsWith("audit-log")) dependencies[name] = { recordCmsAdminAudit: async () => {} };
      else if (name.endsWith("cms-audit-actions")) dependencies[name] = { buildCmsAuditAction: () => "topic.save" };
      else if (name.endsWith("revalidate-public-cache-tags")) dependencies[name] = {
        revalidateTopicsCache() {}, revalidateMediaCenterCache() {},
        runBoundedPublicCacheRevalidation: async (run) => { await run(); return { ok: true, attempts: 1 }; },
      };
      else if (name.endsWith("revalidate-public-paths")) dependencies[name] = { revalidateMediaCenterPublicPaths() {} };
      else if (name === "../editor-actions/revalidate") dependencies[name] = { revalidateUnifiedContentPaths() {} };
      else if (name.endsWith("content-routes")) dependencies[name] = { ADMIN_CONTENT_ROUTES: { topics: "/admin/content/topics" }, adminContentTopicPath: () => "/admin/content/topics/71" };
      else if (name.endsWith("category-hierarchy")) dependencies[name] = { getAdminContentSeriesCategoryError: () => null };
      else if (name.endsWith("content-types")) dependencies[name] = actual("src/lib/admin/content/content-types.ts");
      else if (name === "./helpers") dependencies[name] = { ...helper,
        getDraftBlockingChecks: () => [], getPublishBlockingChecks: () => [],
        getDraftValidationChecks: () => [], getPublishedValidationChecks: () => [],
      };
      else if (name === "./validation") dependencies[name] = {
        ensureUniqueSlug: async () => true, getCategory: async () => category,
        getSeries: async () => null, getTopicById: async () => structuredClone(db.state.row),
        getEditableMediaTopicById: async () => structuredClone(db.state.row),
        resolveMediaSection: async () => ({ ok: true, category, contentType: "news" }),
      };
      else if (name === "./create-domain") {
        const createFile = "src/app/admin/content/topics/article-actions/create-domain.ts";
        dependencies[name] = load(createFile, dependenciesFor(createFile));
      } else dependencies[name] = {};
    }
    return dependencies;
  };
  const file = kind === "duplicate" ? "src/app/admin/content/topics/actions.ts"
    : `src/app/admin/content/topics/${kind === "media" ? "media" : "article"}-actions/save.ts`;
  return { ...db, actions: load(file, dependenciesFor(file)) };
}
function rebindHarness(options = {}) {
  const db = database(options.row ?? fixture(), options);
  const registry = load("src/lib/admin/media-catalog/reference-providers.ts", {
    "server-only": {}, "node:util": require("node:util"),
    "../../storage/upload-cms-asset": { parseManagedStorageAsset: () => null },
    "../../supabase-admin": { getSupabaseAdmin: () => db.client },
    "../content/content-types": actual("src/lib/admin/content/content-types.ts"),
    "../../content/public-content-path": { resolvePublicContentPath: () => "/topics/fixture" },
    "./identity": { getCanonicalMediaIdentityKey: () => "fixture", parseLegacyPublicMediaAsset: () => null },
    "../seo/entity-seo-persistence": seo,
  });
  const provider = registry.getMediaReferenceProvider("topics");
  const rebind = (from, to, fieldKey = "image") => provider.rebind({
    domainKey: "topics", entityIdentity: "42", fieldKey, publicValue: from,
  }, to);
  return { ...db, rebind };
}
let passed = 0;
async function check(label, run) {
  analysisFailure = false;
  await run();
  passed += 1;
  console.log(`PASS ${label}`);
}
try {
  await check("Article create/edit persist exact score provenance and reuse unchanged SEO", () => {
    const row = fixture();
    assertCorrect(row);
    analyses = 0;
    const edited = article.buildTopicWritePayload({ ...article.getPayload(form()), isFeatured: true }, category, null, "unpublished", now, row);
    assert.equal(analyses, 0);
    assert.deepEqual(persisted(edited), persisted(row));
    const changed = article.buildTopicWritePayload({ ...article.getPayload(form()), content: "<p>Changed source</p>" }, category, null, "unpublished", now, row);
    assert.equal(analyses, 1);
    assertCorrect(changed);
    assert.notEqual(changed.seo_score_input_hash, row.seo_score_input_hash);
  });
  await check("Every media type derives from its final stored body, cover and metadata", () => {
    for (const type of actual("src/lib/admin/content/content-types.ts").MEDIA_EDITABLE_CONTENT_TYPES) {
      const row = fixture(type);
      assertCorrect(row);
      assert.equal(row.content, ["video", "gallery"].includes(type) ? "" : media.getPayload(form(type)).content);
    }
  });
  for (const kind of ["article", "media"]) {
    for (const create of [false, true]) {
      await check(`${kind} ${create ? "create" : "edit"}: one atomic domain write`, async () => {
        const h = actionHarness(kind);
        const fn = h.actions[kind === "article" ? "saveArticleContentAdapter" : "saveMediaContentAdapter"];
        const result = await fn(initial, form(kind === "media" ? "news" : "article", create));
        assert.equal(result.status, "success");
        assert.equal(h.state.writes.length, 1);
        assertCorrect(h.state.row);
        if (!create) assert.ok(h.state.comparisons[0].some(([key, value]) => key === "updated_at" && value === now));
      });
      await check(`${kind} ${create ? "create" : "edit"}: analysis failure is structured before write coordination`, async () => {
        const h = actionHarness(kind);
        const input = form(kind === "media" ? "news" : "article", create);
        input.set("title", "Changed title forces analysis");
        analysisFailure = true;
        const result = await h.actions[kind === "article" ? "saveArticleContentAdapter" : "saveMediaContentAdapter"](initial, input);
        assert.equal(result.status, "error");
        assert.match(result.message, /SEO analysis failure/);
        assert.equal(h.state.leases, 0);
        assert.equal(h.state.writes.length, 0);
      });
    }
    await check(`${kind} edit: concurrent SEO revision rejects the entire write`, async () => {
      const h = actionHarness(kind, { beforeWrite: ({ row }) => { row.updated_at = "2026-09-02T00:00:00.000Z"; row.seo_description = "Concurrent description"; } });
      const oldTuple = persisted(h.state.row);
      const result = await h.actions[kind === "article" ? "saveArticleContentAdapter" : "saveMediaContentAdapter"](initial, form(kind === "media" ? "news" : "article"));
      assert.equal(result.status, "error");
      assert.equal(result.code, revision.TOPIC_REVISION_CONFLICT_CODE);
      assert.deepEqual(persisted(h.state.row), oldTuple);
    });
  }
  await check("Duplicate overwrites copied provenance for its final title and slug", async () => {
    const h = actionHarness("duplicate");
    const previousHash = h.state.row.seo_score_input_hash;
    const result = await h.actions.duplicateUnifiedContent(form());
    assert.equal(result.ok, true);
    assert.equal(h.state.writes.length, 1);
    assertCorrect(h.state.row);
    assert.notEqual(h.state.row.seo_score_input_hash, previousHash);
  });
  await check("Duplicate analysis failure cannot reach coordination or insert", async () => {
    const h = actionHarness("duplicate");
    analysisFailure = true;
    const result = await h.actions.duplicateUnifiedContent(form());
    assert.equal(result.ok, false);
    assert.equal(h.state.leases, 0);
    assert.equal(h.state.writes.length, 0);
  });
  await check("Import uses the same atomic article domain create owner", () => {
    assert.match(read("src/app/admin/content/topics/article-actions/batch-import.ts"), /await createArticleDomainRecord\(/);
    assert.match(read("src/app/admin/content/topics/article-actions/create-domain.ts"), /buildTopicWritePayload\(/);
  });
  await check("Media rebind and compensation persist score with field under full revision CAS", async () => {
    const h = rebindHarness();
    const previous = persisted(h.state.row);
    await h.rebind("/images/topics/original.jpg", "/images/topics/rebound.jpg");
    assertCorrect(h.state.row);
    assert.notEqual(h.state.row.seo_score_input_hash, previous.seo_score_input_hash);
    assert.ok(h.state.comparisons[0].some(([key, value]) => key === "updated_at" && value === now));
    for (const column of [...seo.TOPIC_SEO_SOURCE_COLUMNS, ...seo.PERSISTED_ENTITY_SEO_FIELDS, "updated_at"]) {
      assert.ok(h.state.reads[0].split(", ").includes(column), `Missing snapshot input ${column}`);
    }
    await h.rebind("/images/topics/rebound.jpg", "/images/topics/original.jpg");
    assertCorrect(h.state.row);
    assert.deepEqual(persisted(h.state.row), previous);
    assert.equal(h.state.writes.length, 2);
  });
  await check("Media rebind rejects changes to another SEO input without overwriting it", async () => {
    const h = rebindHarness({ beforeWrite: ({ row }) => { row.updated_at = "2026-09-02T00:00:00.000Z"; row.title = "Concurrent title"; } });
    await assert.rejects(h.rebind("/images/topics/original.jpg", "/images/topics/rebound.jpg"), /rebind_concurrent_change/);
    assert.equal(h.state.row.image, "/images/topics/original.jpg");
    assert.equal(h.state.row.title, "Concurrent title");
  });
  await check("Media rebind provenance CAS catches concurrent SEO changes sharing updated_at", async () => {
    const h = rebindHarness({ beforeWrite: ({ row }) => {
      row.title = "Concurrent title in the same millisecond";
      Object.assign(row, seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row)));
    } });
    await assert.rejects(h.rebind("/images/topics/original.jpg", "/images/topics/rebound.jpg"), /rebind_concurrent_change/);
    assert.equal(h.state.row.updated_at, now);
    assert.equal(h.state.row.image, "/images/topics/original.jpg");
    assertCorrect(h.state.row);
  });
  await check("Media rebind analysis failure leaves source and tuple untouched", async () => {
    const h = rebindHarness();
    const original = structuredClone(h.state.row);
    analysisFailure = true;
    await assert.rejects(h.rebind("/images/topics/original.jpg", "/images/topics/rebound.jpg"), /SEO analysis failure/);
    assert.equal(h.state.writes.length, 0);
    assert.deepEqual(h.state.row, original);
  });
  await check("Lost rebind response requires both new media and the complete intended tuple", async () => {
    const confirmed = rebindHarness({ lostResponse: true });
    await confirmed.rebind("/images/topics/original.jpg", "/images/topics/rebound.jpg");
    assertCorrect(confirmed.state.row);
    const uncertain = rebindHarness({ lostResponse: true, afterWrite: ({ row }) => { row.seo_score_input_hash = "b".repeat(64); } });
    await assert.rejects(uncertain.rebind("/images/topics/original.jpg", "/images/topics/rebound.jpg"), (error) => {
      assert.match(error.message, /state_uncertain/);
      assert.equal(error.writeMayHaveCommitted, true);
      return true;
    });
  });
  await check("Media payload rebind does not recompute unrelated SEO or add source reads", async () => {
    const row = fixture();
    row.media_payload = { image: "/images/topics/original.jpg" };
    const h = rebindHarness({ row });
    const original = persisted(row);
    analyses = 0;
    await h.rebind("/images/topics/original.jpg", "/images/topics/rebound.jpg", "media_payload");
    assert.equal(analyses, 0);
    assert.equal(h.state.reads[0], "id, media_payload");
    assert.deepEqual(persisted(h.state.row), original);
    assert.deepEqual(Object.keys(h.state.writes[0]).sort(), ["media_payload", "updated_at"]);
  });
  console.log(`Topics SEO persistence verified (${passed} checks).`);
} finally {
  globalThis.fetch = originalFetch;
  moduleLoader._load = originalLoad;
  scoreOwner.analyzeEntitySeo = originalAnalyze;
}
