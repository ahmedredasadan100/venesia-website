import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createTopicSlugSaveHarness } from "./fixtures/remaining-content-owner-harness.mjs";

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
const topicWriteErrors = actual("src/lib/admin/content/topic-write-errors.ts");
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
    "node:async_hooks": require("node:async_hooks"),
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
      else if (name.endsWith("topic-write-errors")) dependencies[name] = topicWriteErrors;
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
    "../projects/project-media-reference-rebind": { persistProjectMediaReferenceRebind: async () => { throw new Error("Project RPC not configured in this fixture"); } },
    "../../page-blocks/admin-queries": { getPageModuleAssignmentsForAdmin: async () => ({ seoContent: {} }) },
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
async function verifyTopicFormDraftDomain() {
  const types = actual("src/lib/admin/content/content-types.ts").CONTENT_TYPES;
  const expiry = Date.now() + 60_000;
  const session = { actorId: 7, sessionVersion: 4, expiresAt: expiry };
  const scope = (contentType = "article", entity = "create") => ({ ...session, contentType, entity });
  const data = (values) => {
    const result = new FormData();
    for (const [key, entries] of Object.entries(values)) for (const value of entries) result.append(key, value);
    return result;
  };
  const baseFields = (type) => revision.collectTopicFormDraftFields(data({
    title: ["Saved title"], slug: ["persisted-slug"], canonical_url: ["https://example.test/topics/persisted-slug"],
    ...(type === "gallery" ? { gallery_image_url: ["/one.jpg", "/two.jpg"], gallery_image_alt: ["One", "Two"], gallery_image_caption: ["First", "Second"] } : {}),
  }), type).fields;
  for (const type of types) for (const entity of ["create", "42"]) {
    await check(`${type} ${entity}: scoped full draft roundtrip preserves raw slug, canonical and applicable native order`, () => {
      const baseline = baseFields(type), fields = structuredClone(baseline);
      fields.title = ["Unsaved عنوان"]; fields.slug = ["draft-"];
      const record = revision.createTopicFormDraft(scope(type, entity), entity === "create" ? null : now, "writer-A", fields, undefined, baseline);
      const parsed = revision.parseTopicFormDraft(JSON.stringify(record), scope(type, entity));
      assert.equal(parsed.status, "valid"); assert.deepEqual(parsed.draft, record);
      assert.equal(parsed.draft.fields.slug[0], "draft-");
      assert.deepEqual(parsed.draft.fields.canonical_url, baseline.canonical_url);
      assert.deepEqual(Object.keys(record.scope).sort(), ["actorId", "contentType", "entity", "expiresAt", "sessionVersion"]);
      assert.deepEqual(Object.keys(fields), [...revision.getTopicFormDraftFieldNames(type)]);
      for (const field of ["video_url", "gallery_image_url", "faq_question", "media_project"]) {
        const applicable = field === "video_url" ? type === "video" : field === "gallery_image_url" ? type === "gallery" : field === "faq_question" ? type === "article" : ["news", "site_update"].includes(type);
        assert.equal(Object.hasOwn(fields, field), applicable);
      }
    });
  }
  await check("Full draft explicitly excludes Auth, server identity/revision, structural flags and upload bytes", () => {
    const capture = revision.collectTopicFormDraftFields(data({
      title: ["Retained"], id: ["42"], content_type: ["article"], expected_updated_at: [now],
      password: ["Private"], access_token: ["Private"], authorization: ["Private"], csrf_token: ["Private"],
      faq_editor_present: ["true"], created_by: ["7"], seo_score: ["100"],
      image: [new Blob(["private bytes"], { type: "image/png" })],
    }), "article");
    assert.deepEqual(capture.excludedFields, ["image"]);
    for (const field of ["id", "content_type", "expected_updated_at", "password", "access_token", "authorization", "csrf_token", "faq_editor_present", "created_by", "seo_score", "image"]) assert.equal(Object.hasOwn(capture.fields, field), false);
    assert.ok(!JSON.stringify(capture.fields).includes("Private"));
    assert.deepEqual(capture.fields.show_title_on_page, [], "Unchecked native switches retain an explicit empty projection");
  });
  await check("Sensitive URL credentials, signed query/fragment and inline file transports are excluded without rewriting", () => {
    for (const url of ["https://user:private@example.test/video", "https://user:private@", "http://user:private@:", "https://example.test/video?access_token=private", "https://example.test/video#token=private", "https://example.test/a?X-Amz-Signature=private", "https://example.test/video?jwt=private", "https://example.test/video?session_token=private", "https://example.test/video?auth_token=private", "https://example.test/video?x-vercel-protection-bypass=private", "https://example.test/video?x-api-key=private", "https://?auth_token=private", "https://?%61uth_token=private", "data:image/png;base64,cHJpdmF0ZQ==", "blob:https://example.test/private"]) {
      const source = data({ video_url: [url], title: ["Retained"] });
      const capture = revision.collectTopicFormDraftFields(source, "video");
      assert.deepEqual(capture.excludedFields, ["video_url"]); assert.equal(Object.hasOwn(capture.fields, "video_url"), false);
      assert.equal(source.get("video_url"), url, "The real field identity must remain untouched");
    }
    const ordinary = "https://www.youtube.com/watch?v=ABC&t=12";
    assert.deepEqual(revision.collectTopicFormDraftFields(data({ video_url: [ordinary] }), "video").fields.video_url, [ordinary]);
    const ordinarySharedUrl = "https://example.test/video?v=ABC&t=12&url=https%3A%2F%2Fexample.test%2Fclip";
    assert.deepEqual(revision.collectTopicFormDraftFields(data({ video_url: [ordinarySharedUrl] }), "video").fields.video_url, [ordinarySharedUrl]);
    const gallery = revision.collectTopicFormDraftFields(data({ gallery_image_url: ["/one.jpg", "https://example.test/two?token=private"], gallery_image_alt: ["One", "Two"], gallery_image_caption: ["First", "Second"] }), "gallery");
    assert.deepEqual(gallery.excludedFields, ["gallery_image_url", "gallery_image_alt", "gallery_image_caption"]);
    assert.ok(!JSON.stringify(gallery.fields).includes("private"));
  });
  await check("Strict full draft parser refuses cross-user, session, record and type recovery", () => {
    const original = scope(), record = revision.createTopicFormDraft(original, now, "writer-A", baseFields("article"));
    for (const changed of [{ actorId: 8 }, { sessionVersion: 5 }, { expiresAt: expiry + 1 }, { entity: "42" }, { contentType: "news" }]) {
      const parsed = revision.parseTopicFormDraft(JSON.stringify(record), { ...original, ...changed });
      assert.deepEqual(parsed, { status: "scope_mismatch" });
    }
    assert.deepEqual(revision.parseTopicFormDraft(JSON.stringify(record), original, expiry), { status: "expired" });
    assert.throws(() => revision.createTopicFormDraft({ ...original, expiresAt: 1 }, now, "writer-A", baseFields("article")), /expired/);
    for (const invalid of [{ actorId: 0 }, { sessionVersion: -1 }, { expiresAt: NaN }, { contentType: "unsupported" }, { entity: "../42" }]) assert.throws(() => revision.getTopicFormDraftKey({ ...original, ...invalid }, "writer-A"), /scope/);
    assert.throws(() => revision.getTopicFormDraftKey(original, "../writer"), /writer/);
  });
  await check("Legacy and future schema records stay opaque, malformed field injection cannot enter restoration", () => {
    const original = revision.createTopicFormDraft(scope(), now, "writer-A", baseFields("article"));
    const withoutBaseline = { ...original };
    delete withoutBaseline.baselineFields;
    for (const [raw, status] of [
      [null, "missing"], ["Unattributed old Markdown", "legacy"], [JSON.stringify(revision.createTopicDraft("Old private content", now)), "legacy"],
      [JSON.stringify({ ...original, version: 3 }), "unsupported"], [JSON.stringify({ ...original, fieldVersion: 2 }), "unsupported"],
      [JSON.stringify(withoutBaseline), "unsupported"], [JSON.stringify({ ...original, savedAt: "invalid" }), "invalid"],
      [JSON.stringify({ ...original, fields: { ...original.fields, password: ["Private"] } }), "invalid"],
      [JSON.stringify({ ...original, baselineFields: { ...original.baselineFields, access_token: ["Private"] } }), "invalid"],
      [JSON.stringify({ ...original, fields: { ...original.fields, title: [3] } }), "invalid"],
      [JSON.stringify({ ...original, extra: "Private" }), "invalid"],
      [JSON.stringify({ ...original, scope: { ...original.scope, token: "Private" } }), "invalid"],
    ]) assert.deepEqual(revision.parseTopicFormDraft(raw, scope()), { status });
    assert.equal(revision.parseTopicDraft("Existing raw Markdown").content, "Existing raw Markdown");
    const oldRecord = revision.createTopicDraft("Existing revision Markdown", now);
    assert.equal(revision.parseTopicDraft(JSON.stringify(oldRecord)).legacy, false);
  });
  await check("Three-way restore retains newer saved fields and defaults same-field conflicts to the saved version", () => {
    const baseline = baseFields("article"), changed = structuredClone(baseline), current = structuredClone(baseline);
    changed.title = ["Local title"]; current.excerpt = ["Newer saved excerpt"];
    const draft = revision.createTopicFormDraft(scope(), now, "writer-A", changed, undefined, baseline);
    const merge = revision.mergeTopicFormDraftFields(draft, current);
    assert.deepEqual(merge.fields.title, ["Local title"]); assert.deepEqual(merge.fields.excerpt, ["Newer saved excerpt"]);
    assert.deepEqual(merge.conflicts, []); assert.deepEqual(merge.fields.slug, baseline.slug);
    current.title = ["Newer saved title"];
    const retained = revision.mergeTopicFormDraftFields(draft, current);
    assert.deepEqual(retained.fields.title, current.title); assert.deepEqual(retained.conflicts, ["title"]); assert.deepEqual(retained.retainedConflicts, ["title"]);
    const chosen = revision.mergeTopicFormDraftFields(draft, current, { title: "draft" });
    assert.deepEqual(chosen.fields.title, changed.title); assert.deepEqual(chosen.retainedConflicts, []);
    delete current.title;
    assert.equal(Object.hasOwn(revision.mergeTopicFormDraftFields(draft, current, { title: "draft" }).fields, "title"), false);
    assert.deepEqual(draft.fields.title, ["Local title"], "Merge never changes the original candidate");
  });
  await check("Gallery three-way conflict preserves whole ordered URL/Alt/Caption rows as one decision", () => {
    const baseline = baseFields("gallery"), changed = structuredClone(baseline), current = structuredClone(baseline);
    for (const name of ["gallery_image_url", "gallery_image_alt", "gallery_image_caption"]) changed[name].reverse();
    current.gallery_image_caption[0] = "Newer saved caption";
    const draft = revision.createTopicFormDraft(scope("gallery", "42"), now, "writer-A", changed, undefined, baseline);
    const retained = revision.mergeTopicFormDraftFields(draft, current);
    assert.deepEqual(retained.conflicts, ["gallery_image_url"]);
    for (const name of ["gallery_image_url", "gallery_image_alt", "gallery_image_caption"]) assert.deepEqual(retained.fields[name], current[name]);
    const chosen = revision.mergeTopicFormDraftFields(draft, current, { gallery_image_url: "draft" });
    for (const name of ["gallery_image_url", "gallery_image_alt", "gallery_image_caption"]) assert.deepEqual(chosen.fields[name], changed[name]);
  });
  await check("Independent writer keys and conditional removal cannot erase another or newer draft", () => {
    const keys = [revision.getTopicFormDraftKey(scope(), "writer-A"), revision.getTopicFormDraftKey(scope(), "writer-B")];
    assert.notEqual(keys[0], keys[1]);
    assert.equal(revision.getTopicFormDraftSessionPrefix(session), `${revision.TOPIC_DRAFT_STORAGE_PREFIX}:form:v2:7:4:${expiry}:`);
    for (const type of types) assert.ok(revision.getTopicFormDraftKey(scope(type, "42"), "writer-C").startsWith(revision.getTopicFormDraftSessionPrefix(session)));
    assert.ok(!revision.getTopicFormDraftKey({ ...scope(), actorId: 8 }, "writer-C").startsWith(revision.getTopicFormDraftSessionPrefix(session)));
    const values = new Map([[keys[0], "Newer writer A"], [keys[1], "Writer B"], ["admin-shell:test:collapsed", "true"], ["venesia-topic-editor-draft-other", "Keep"], ["venesia-topic-editor-draft:topic:article:create", "Legacy opaque"]]);
    const storage = { get length() { return values.size; }, key(index) { return [...values.keys()][index] ?? null; }, getItem(key) { return values.get(key) ?? null; }, removeItem(key) { values.delete(key); } };
    assert.equal(revision.removeTopicFormDraftIfUnchanged(storage, keys[0], "Older writer A"), false);
    assert.equal(revision.removeTopicFormDraftIfUnchanged(storage, "admin-shell:test:collapsed", "true"), false);
    assert.equal(revision.removeTopicFormDraftIfUnchanged(storage, keys[1], "Writer B"), true);
    assert.equal(values.get(keys[0]), "Newer writer A");
    assert.equal(revision.cleanupTopicDraftStorage(storage), 2);
    assert.deepEqual([...values], [["admin-shell:test:collapsed", "true"], ["venesia-topic-editor-draft-other", "Keep"]]);
  });
  await check("Successful logout stops mounted writers before deleting content and emits only isolated session metadata", () => {
    const writerIds = [revision.createTopicDraftWriterId(), revision.createTopicDraftWriterId()];
    for (const writer of writerIds) assert.match(writer, /^[0-9a-f]{32}$/);
    assert.notEqual(writerIds[0], writerIds[1]);
    const previousCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues(bytes) { assert.equal(bytes.byteLength, 16); bytes.fill(0xab); return bytes; } } });
    try { assert.equal(revision.createTopicDraftWriterId(), "ab".repeat(16)); }
    finally { if (previousCrypto) Object.defineProperty(globalThis, "crypto", previousCrypto); else delete globalThis.crypto; }
    const key = revision.getTopicFormDraftKey(scope(), "writer-A");
    const marker = revision.getTopicDraftSessionEndKey(session);
    assert.equal(marker, `${revision.TOPIC_DRAFT_SESSION_END_STORAGE_PREFIX}7:4:${expiry}`);
    assert.equal(marker.startsWith(`${revision.TOPIC_DRAFT_STORAGE_PREFIX}:`), false);
    assert.equal(revision.TOPIC_DRAFT_LOGOUT_STORAGE_KEY.startsWith(`${revision.TOPIC_DRAFT_STORAGE_PREFIX}:`), false);
    assert.throws(() => revision.getTopicDraftSessionEndKey({ ...session, actorId: 0 }), /session/);
    const values = new Map([[key, "Private local content"], ["venesia-topic-editor-draft:topic:article:create", "Opaque legacy"], ["admin-shell:test:collapsed", "true"]]);
    const order = [];
    const storage = { get length() { return values.size; }, key(index) { return [...values.keys()][index] ?? null; }, getItem(name) { return values.get(name) ?? null; }, setItem(name, value) { order.push("metadata"); values.set(name, value); }, removeItem(name) { order.push("remove"); values.delete(name); } };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent(event) {
      assert.equal(event.type, revision.TOPIC_DRAFT_SESSION_END_EVENT); assert.equal(values.has(key), true);
      order.push("stop-writers"); values.set(marker, "1"); return true;
    } } });
    try { assert.equal(revision.cleanupTopicDraftStorage(storage), 2); }
    finally { if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else delete globalThis.window; }
    assert.equal(order[0], "stop-writers"); assert.ok(order.indexOf("metadata") < order.indexOf("remove"));
    assert.deepEqual([...values.keys()].sort(), ["admin-shell:test:collapsed", marker, revision.TOPIC_DRAFT_LOGOUT_STORAGE_KEY].sort());
    assert.ok(!JSON.stringify([...values]).includes("Private")); assert.ok(!JSON.stringify([...values]).includes("Opaque"));
    const expired = revision.getTopicDraftSessionEndKey({ ...session, expiresAt: 1 });
    const malformed = `${revision.TOPIC_DRAFT_SESSION_END_STORAGE_PREFIX}unknown`;
    values.set(expired, "1"); values.set(malformed, "Keep opaque");
    assert.equal(revision.pruneTopicDraftSessionEndMarkers(storage, 2), 1);
    assert.equal(values.has(marker), true); assert.equal(values.has(malformed), true);
    assert.equal(values.has(revision.TOPIC_DRAFT_LOGOUT_STORAGE_KEY), true);
    assert.equal(revision.pruneTopicDraftSessionEndMarkers(storage, expiry), 1);
    assert.equal(values.has(marker), false);
  });
  await check("Server Draft session adapter consumes actual signed expiry without exposing credentials or changing Auth", async () => {
    const auth = actual("src/lib/admin/auth/session.ts"), secret = "isolated-draft-session-secret";
    let token;
    const adapter = load("src/lib/admin/content/topic-draft-session.ts", {
      "server-only": {}, "next/headers": { cookies: async () => ({ get: (name) => { assert.equal(name, auth.ADMIN_SESSION_COOKIE); return token ? { value: token } : undefined; } }) },
      "../auth/session": { ...auth, getAdminAuthConfig: () => ({ configured: true, secret }) },
    });
    for (const ttl of [auth.ADMIN_SESSION_TTL_SEC, auth.ADMIN_SESSION_REMEMBER_TTL_SEC]) {
      token = auth.createAdminSessionToken({ id: 7, username: "Private actor", sessionVersion: 4 }, secret, ttl);
      const metadata = await adapter.resolveTopicDraftSession({ id: 7, session_version: 4 });
      assert.deepEqual(metadata, { actorId: 7, sessionVersion: 4, expiresAt: auth.verifyAdminSessionToken(token, secret).exp * 1000 });
      assert.ok(!JSON.stringify(metadata).includes("Private"));
      await assert.rejects(adapter.resolveTopicDraftSession({ id: 8, session_version: 4 }), /Unauthorized/);
      await assert.rejects(adapter.resolveTopicDraftSession({ id: 7, session_version: 5 }), /Unauthorized/);
    }
    token = auth.createAdminSessionToken({ id: 7, username: "Private actor", sessionVersion: 4 }, secret, -1);
    await assert.rejects(adapter.resolveTopicDraftSession({ id: 7, session_version: 4 }), /Unauthorized/);
    token = undefined; await assert.rejects(adapter.resolveTopicDraftSession({ id: 7, session_version: 4 }), /Unauthorized/);
  });
}
async function verifyTopicSlugSaves() {
  const h = await createTopicSlugSaveHarness(root);
  const proof = { scope: "Actual topic save, payload, validation, public path and canonical owners with in-memory PostgreSQL infrastructure", hostedDatabaseWrites: 0, networkAllowed: false, cases: [] };
  const types = actual("src/lib/admin/content/content-types.ts").CONTENT_TYPES;
  const paths = actual("src/lib/content/public-content-path.ts");
  const seoPolicy = actual("src/lib/seo/resolve-seo-metadata.ts");
  const seoDefaults = actual("src/lib/seo/global-seo-defaults.ts").getGlobalSeoDefaults();
  const publishFixtures = h.owners.load(path.join(root, "scripts/verify-content-publish-validation-truth.mts"), ["base", "inputFor"]);
  const canonical = (type, slug) => seoPolicy.resolveSeoUrlPolicy({ path: paths.resolvePublicContentPath(type, slug) }, seoDefaults).canonical;
  const entries = (type) => Object.entries({
    title: `Valid ${type} title`, slug: `manual-${type.replaceAll("_", "-")}`,
    category_id: "1", status: "unpublished", content: ["video", "gallery"].includes(type) ? "" : "Valid content body",
    excerpt: "Valid excerpt", seo_title: "Saved SEO title", seo_description: "Saved SEO description", focus_keyword: "Saved", image: "", image_alt: "",
    ...(type === "video" ? { video_provider: "youtube", video_url: "https://www.youtube.com/watch?v=dQw4w9WgXc", video_thumbnail: "", video_start_seconds: "0" }
      : type === "gallery" ? { gallery_image_url: "/proof.svg", gallery_image_alt: "Proof alt", gallery_image_caption: "Proof caption" } : {}),
  });
  const record = (type, mode, name, receipt) => proof.cases.push({ type, mode, name, status: "pass", ...receipt });
  try {
    await check("Only SQL23505 on the exact topics slug constraint maps to the shared typed error", () => {
      const errors = h.owners.load(path.join(root, "src/lib/admin/content/topic-write-errors.ts"));
      const create = h.owners.load(path.join(root, "src/app/admin/content/topics/article-actions/create-domain.ts"));
      assert.equal(create.ArticleSlugConflictError, errors.TopicSlugConflictError, "Batch import must retain the same conflict class");
      for (const [error, expected] of [
        [null, false],
        [{ code: "23505", constraint: "topics_slug_key" }, true],
        [{ code: "23505", message: 'duplicate key value violates unique constraint "topics_slug_key"' }, true],
        [{ code: "23505", message: 'duplicate key value violates unique constraint "other_topics_slug_key"' }, false],
        [{ code: "23505", message: 'duplicate key value violates unique constraint "topics_slug_key_extra"' }, false],
        [{ code: "23505", message: 'duplicate key value violates unique constraint "topics_pkey"', details: "Key(title)=(slug topics_slug_key) already exists" }, false],
        [{ code: "23505", constraint: "topics_pkey", message: 'duplicate key value violates unique constraint "topics_slug_key"' }, false],
        [{ code: "23514", constraint: "topics_slug_key" }, false],
        [{ code: "42501", message: "slug write not allowed" }, false],
        [{ message: 'duplicate key value violates unique constraint "topics_slug_key"' }, false],
      ]) assert.equal(errors.isTopicSlugUniqueViolation(error), expected, JSON.stringify(error));
    });
    for (const type of types) {
      let initialRow;
      await check(`${type} create: actual save and reload retain manual slug, canonical and SEO tuple`, async () => {
        await h.reset();
        const saved = await h.save({ contentType: type, mode: "create", entries: entries(type) });
        assert.equal(saved.result.status, "success", JSON.stringify(saved));
        assert.equal(saved.writeAttempts, 1);
        initialRow = saved.row;
        assert.deepEqual(await h.read(initialRow.id), initialRow);
        assert.equal(initialRow.slug, `manual-${type.replaceAll("_", "-")}`);
        assert.equal(initialRow.seo_title, "Saved SEO title");
        assertCorrect(initialRow);
        record(type, "create", "save-reload", { slug: initialRow.slug, canonical: canonical(type, initialRow.slug) });
      });
      await check(`${type} edit: title-only save and reload preserve the public slug and canonical`, async () => {
        const input = entries(type).filter(([key]) => key !== "title");
        input.push(["title", "Changed title retains manual slug"], ["id", String(initialRow.id)], ["expected_updated_at", initialRow.updated_at]);
        const saved = await h.save({ contentType: type, mode: "edit", entries: input });
        assert.equal(saved.result.status, "success", JSON.stringify(saved));
        assert.equal(saved.writeAttempts, 1);
        assert.deepEqual(await h.read(initialRow.id), saved.row);
        assert.equal(saved.row.slug, initialRow.slug);
        assert.equal(canonical(type, saved.row.slug), canonical(type, initialRow.slug));
        assertCorrect(saved.row);
        record(type, "edit", "save-reload", { slug: saved.row.slug, canonical: canonical(type, saved.row.slug) });
      });
      await check(`${type} published edit: title-only changes protect public links, both canonical policies and unrelated fields`, async () => {
        const fixture = publishFixtures.inputFor(type);
        for (const canonicalUrl of [fixture.canonicalUrl, `https://example.com/published-canonical-${type.replaceAll("_", "-")}`]) {
          await h.reset();
          const native = Object.entries({
            title: fixture.title, slug: `published-${type.replaceAll("_", "-")}`, excerpt: fixture.excerpt, content: fixture.content,
            image: fixture.image, image_alt: fixture.imageAlt, category_id: fixture.categorySlug, status: "published",
            seo_title: fixture.seoTitle, seo_description: fixture.seoDescription, focus_keyword: fixture.focusKeyword,
            canonical_url: canonicalUrl, og_image: fixture.ogImage, og_image_alt: fixture.ogImageAlt,
            seo_keywords: "published, retained", robots_index: "true", robots_follow: "true",
            published_at: "2026-10-01", date_label: "تاريخ منشور محفوظ", is_featured: "true", is_popular: "true",
            show_title_on_page: "true", show_image_on_page: "true", show_excerpt_on_page: "true", show_date_on_page: "true",
            show_category_on_page: "true", show_series_on_page: "true", show_intro_card_on_page: "true",
            ...(type === "video" ? { video_provider: fixture.mediaPayload.provider, video_url: fixture.mediaPayload.video_url, video_thumbnail: fixture.mediaPayload.thumbnail ?? "", video_start_seconds: "0" }
              : type === "gallery" ? { gallery_image_url: fixture.mediaPayload.images[0].url, gallery_image_alt: fixture.mediaPayload.images[0].alt ?? "", gallery_image_caption: fixture.mediaPayload.images[0].caption ?? "" } : {}),
          });
          const created = await h.save({ contentType: type, mode: "create", entries: native });
          assert.equal(created.result.status, "success", JSON.stringify(created));
          const before = created.row;
          assert.equal(before.status, "published");
          const publicHref = paths.resolvePublicContentPath(type, before.slug);
          const beforeDerived = canonical(type, before.slug);
          const beforeResolved = seoPolicy.resolveSeoUrlPolicy({ path: publicHref, entitySeo: { canonical: before.canonical_url } }, seoDefaults).canonical;
          const input = native.filter(([key]) => key !== "title");
          input.push(["title", `${fixture.title} بعد تحديث العنوان`], ["id", String(before.id)], ["expected_updated_at", before.updated_at]);
          h.state.revalidations = []; h.state.revalidatedPaths = [];
          const edited = await h.save({ contentType: type, mode: "edit", entries: input });
          assert.equal(edited.result.status, "success", JSON.stringify(edited));
          assert.equal(edited.writeAttempts, 1);
          assert.deepEqual(await h.read(before.id), edited.row);
          for (const key of Object.keys(before).filter(key => !["title", "updated_at", ...seo.PERSISTED_ENTITY_SEO_FIELDS].includes(key))) {
            assert.deepEqual(edited.row[key], before[key], `${type}: title-only edit changed ${key}`);
          }
          assert.equal(edited.row.title, `${fixture.title} بعد تحديث العنوان`);
          assert.equal(edited.row.status, "published");
          assert.equal(paths.resolvePublicContentPath(type, edited.row.slug), publicHref);
          assert.equal(canonical(type, edited.row.slug), beforeDerived);
          assert.equal(seoPolicy.resolveSeoUrlPolicy({ path: publicHref, entitySeo: { canonical: edited.row.canonical_url } }, seoDefaults).canonical, beforeResolved);
          assertCorrect(edited.row);
          assert.deepEqual(h.state.revalidations, [{ contentType: type, id: before.id, oldSlug: before.slug, newSlug: before.slug }]);
          assert.equal(h.state.revalidatedPaths.filter(value => value === publicHref).length, 2, "Both old/new references must invalidate the existing public route");
          record(type, "edit", "published-title-only-protection", { canonicalPolicy: canonicalUrl ? "explicit" : "derived", slug: edited.row.slug, publicHref, storedCanonical: edited.row.canonical_url, resolvedCanonical: beforeResolved, derivedCanonical: beforeDerived, publishingStatus: edited.row.status, publishedAt: edited.row.published_at, revalidation: h.state.revalidations[0], protectedFieldCount: Object.keys(before).length - 5 });
        }
      });
      await check(`${type} explicit slug edit: existing public path revalidation covers both identities`, async () => {
        await h.reset([initialRow]);
        const input = entries(type).filter(([key]) => key !== "slug");
        const nextSlug = `explicit-${initialRow.slug}`;
        input.push(["slug", nextSlug], ["id", String(initialRow.id)], ["expected_updated_at", initialRow.updated_at]);
        const edited = await h.save({ contentType: type, mode: "edit", entries: input });
        assert.equal(edited.result.status, "success", JSON.stringify(edited));
        assert.equal(edited.row.slug, nextSlug);
        assert.deepEqual(h.state.revalidations, [{ contentType: type, id: initialRow.id, oldSlug: initialRow.slug, newSlug: nextSlug }]);
        for (const slug of [initialRow.slug, nextSlug]) assert.ok(h.state.revalidatedPaths.includes(paths.resolvePublicContentPath(type, slug)));
        record(type, "edit", "explicit-slug-revalidation", { oldSlug: initialRow.slug, newSlug: nextSlug, revalidation: h.state.revalidations[0] });
      });
      for (const mode of ["create", "edit"]) {
        for (const outcome of ["slug-conflict", "non-slug-unique", "database-error"]) {
          await check(`${type} ${mode}: actual save preserves ${outcome} failure identity and existing row`, async () => {
            await h.reset(mode === "edit" ? [initialRow] : []);
            const input = entries(type).filter(([key]) => !["slug", "title"].includes(key));
            input.push(["title", "Unique slug word in duplicate title"], ["slug", `candidate-${type.replaceAll("_", "-")}`],
              ...(mode === "edit" ? [["id", String(initialRow.id)], ["expected_updated_at", initialRow.updated_at]] : []));
            const saved = await h.save({ contentType: type, mode, entries: input, outcome });
            assert.equal(saved.result.status, "error", JSON.stringify(saved));
            assert.equal(saved.writeAttempts, 1);
            assert.equal(saved.result.revision, 1);
            assert.equal(Boolean(saved.result.fieldErrors?.slug?.length), outcome === "slug-conflict", JSON.stringify(saved.result));
            assert.equal(saved.result.focusTarget, outcome === "slug-conflict" ? "slug" : undefined);
            if (outcome === "database-error") assert.equal(saved.result.message, "isolated_permission_denied: slug write was rejected");
            else {
              const constraint = outcome === "slug-conflict" ? "topics_slug_key" : "topics_non_slug_fixture_key";
              assert.equal(saved.writeErrors[0].code, "23505");
              assert.equal(saved.writeErrors[0].postgresConstraint, constraint);
              if (outcome === "non-slug-unique") assert.equal(saved.result.message, saved.writeErrors[0].message);
              assert.ok(h.state.reads.some(read => read.table === "topics" && read.filters.some(([, key, value]) => key === "slug" && value === `candidate-${type.replaceAll("_", "-")}`) && read.ids.length === 0), "Database conflict must follow an available-slug preflight");
            }
            assert.equal(h.state.audits, 0);
            for (const before of saved.beforeRows) assert.deepEqual(saved.afterRows.find(row => row.id === before.id), before);
            if (mode === "create") assert.equal(saved.row, null);
            else assert.deepEqual(saved.row, initialRow);
            await h.clearInjectedRows();
            const retried = await h.save({ contentType: type, mode, entries: input, previousState: saved.result });
            assert.equal(retried.result.status, "success", JSON.stringify(retried));
            assert.equal(retried.result.revision, 2);
            assert.equal(retried.row.slug, `candidate-${type.replaceAll("_", "-")}`);
            assert.deepEqual(await h.read(retried.result.entityId), retried.row);
            assertCorrect(retried.row);
            record(type, mode, outcome, { result: saved.result, databaseError: saved.writeErrors[0] ?? null, writeAttempts: saved.writeAttempts, retry: { status: retried.result.status, revision: retried.result.revision, slug: retried.row.slug } });
          });
        }
        await check(`${type} ${mode}: cross-type occupied and trashed slugs fail preflight without a write`, async () => {
          for (const deletedAt of [null, "2026-10-01T00:00:00.000Z"]) {
            const competitor = { id: 900, title: "Preflight competitor", slug: "occupied-cross-type-slug", content_type: type === "article" ? "news" : "article", deleted_at: deletedAt };
            await h.reset([...(mode === "edit" ? [initialRow] : []), competitor]);
            const input = entries(type).filter(([key]) => key !== "slug");
            input.push(["slug", competitor.slug], ...(mode === "edit" ? [["id", String(initialRow.id)], ["expected_updated_at", initialRow.updated_at]] : []));
            const saved = await h.save({ contentType: type, mode, entries: input });
            assert.equal(saved.result.status, "error");
            assert.equal(saved.result.focusTarget, "slug");
            assert.ok(saved.result.fieldErrors.slug.length);
            assert.equal(saved.writeAttempts, 0);
            assert.deepEqual(saved.afterRows, saved.beforeRows);
          }
          record(type, mode, "occupied-and-trashed-preflight", { writeAttempts: 0 });
        });
      }
    }
    const output = process.argv.find(argument => argument.startsWith("--slug-proof-output="))?.slice("--slug-proof-output=".length);
    if (output) await writeFile(path.resolve(root, output), JSON.stringify(proof, null, 2));
  } finally {
    await h.close();
  }
}
try {
  await verifyTopicFormDraftDomain();
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
  await check("Media payload rebind preserves SEO and compares the current row revision", async () => {
    const row = fixture();
    row.media_payload = { image: "/images/topics/original.jpg" };
    const h = rebindHarness({ row });
    const original = persisted(row);
    analyses = 0;
    await h.rebind("/images/topics/original.jpg", "/images/topics/rebound.jpg", "media_payload");
    assert.equal(analyses, 0);
    assert.equal(h.state.reads[0], "id, media_payload, updated_at, slug, content_type");
    assert.deepEqual(persisted(h.state.row), original);
    assert.deepEqual(Object.keys(h.state.writes[0]).sort(), ["media_payload", "updated_at"]);
  });
  await verifyTopicSlugSaves();
  console.log(`Topics SEO persistence verified (${passed} checks).`);
} finally {
  globalThis.fetch = originalFetch;
  moduleLoader._load = originalLoad;
  scoreOwner.analyzeEntitySeo = originalAnalyze;
}
