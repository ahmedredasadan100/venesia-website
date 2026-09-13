import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Execute the real action modules. Every infrastructure boundary is injected;
// this proof never imports a database client or performs an external request.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = process.argv.includes("--baseline");
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Network forbidden in isolated action proof"); };
let passed = 0;
const failures = [];

function load(file, dependencies) {
  const source = readFileSync(path.join(root, file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const isolatedModule = { exports: {} };
  Function("exports", "module", "require", compiled)(isolatedModule.exports, isolatedModule, (specifier) => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Uninjected dependency ${file}: ${specifier}`);
    return dependencies[specifier];
  });
  return isolatedModule.exports;
}

const resultOwner = load("src/lib/admin/admin-action-result.ts", {});
const readSource = (file) => readFileSync(path.join(root, file), "utf8");

function harness(kind, options = {}) {
  const calls = { writes: 0, audits: 0, cache: 0, probes: 0, slugs: [], committed: 0 };
  const current = { id: 7, name: "Original", title: "Original", slug: "original", description: "", category_id: 9,
    parent_id: null, sort_order: 1, status: "unpublished", is_active: false, is_featured: false,
    content_type: kind === "media" ? "video" : "article", updated_at: "2026-09-01T00:00:00.000001+00:00" };
  const saved = () => options.missingIdentity ? {} : { id: options.created ? 71 : 7, slug: "saved",
    updated_at: options.missingRevision ? undefined : "2026-09-13T10:00:00.123456+00:00", published_at: null };
  const write = () => {
    calls.writes += 1;
    if (options.writeThrows) throw new Error("Injected unconfirmed write failure");
    if (options.writeError) return { data: null, error: { message: "Injected write rejection" } };
    if (options.missingData) return { data: null, error: null };
    calls.committed += 1;
    return { data: saved(), error: null };
  };
  const supabase = { from() {
    let columns = "";
    let operation = "read";
    let payload = {};
    const query = {
      select(value) { columns = value; return query; },
      eq(key, value) { if (key === "slug") calls.slugs.push(value); return query; },
      neq() { return query; }, is() { return query; }, in() { return query; }, not() { return query; },
      limit() { return query; }, order() { return query; },
      insert(value) { operation = "write"; payload = value; return query; },
      update(value) { operation = "write"; payload = value; return query; },
      delete() { operation = "write"; return query; },
      async maybeSingle() {
        if (operation === "write") {
          const response = write();
          if (response.data) {
            response.data = { ...response.data, ...payload };
            if (options.missingRevision) delete response.data.updated_at;
          }
          return response;
        }
        if (columns === "id") {
          calls.probes += 1;
          if (calls.probes > 60) throw new Error("Isolated probe guard prevented an unbounded loop");
          if (options.probeThrows) throw new Error("Injected slug read throw");
          if (options.probeError) return { data: null, error: { message: "Injected slug read error" } };
          return { data: calls.probes <= (options.collisions ?? 0) ? { id: 99 } : null, error: null };
        }
        if (columns === "id, is_active, status") return { data: { id: 9, is_active: true, status: "published" }, error: null };
        return { data: current, error: null };
      },
      single() { return query.maybeSingle(); },
      then(resolve, reject) {
        return Promise.resolve().then(() => operation === "write" ? write() : { data: [current], error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  const failCache = () => {
    calls.cache += 1;
    if (calls.cache <= (options.cacheFailures ?? 0)) throw new Error("Injected cache failure");
  };
  const cacheOwner = load("src/lib/cache/revalidate-public-cache-tags.ts", {
    "server-only": {}, "next/cache": { revalidatePath() {}, revalidateTag() {}, updateTag() {} },
  });
  const cache = { ...cacheOwner, revalidateTopicsCache: failCache, revalidateMediaCenterCache() {} };
  const audit = { recordCmsAdminAudit: async () => { calls.audits += 1; } };
  const mediaSynchronization = { status: options.mediaWarning ? "saved_with_media_sync_warning" : "synchronized" };
  const coordinatedResult = (value) => options.missingCoordinated ? null : ({ value: options.nullValue ? null : value, mediaSynchronization });
  const coordinate = async ({ mutate }) => coordinatedResult(await mutate());
  class TestRevisionConflict extends Error {}
  class TestLeaseError extends Error {}
  const dependencies = {
    "next/cache": { revalidatePath() {} },
  };
  const imports = [...readSource(kind === "article" ? "src/app/admin/content/topics/article-actions/save.ts"
    : kind === "media" ? "src/app/admin/content/topics/media-actions/save.ts"
    : kind === "taxonomy" ? "src/app/admin/content/taxonomy-form-actions.ts"
    : `src/app/admin/content/${kind}/actions.ts`).matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  for (const name of imports) {
    if (Object.hasOwn(dependencies, name)) continue;
    if (name.includes("admin-action-result")) dependencies[name] = resultOwner;
    else if (name.includes("require-admin-session")) dependencies[name] = { requireAdminSession: async () => ({ id: 1 }) };
    else if (name.includes("cms-audit-actions")) dependencies[name] = { buildCmsAuditAction: (...parts) => parts.join(".") };
    else if (name.endsWith("audit-log")) dependencies[name] = audit;
    else if (name.includes("revalidate-public-cache-tags")) dependencies[name] = cache;
    else if (name.endsWith("revalidate-public-paths")) dependencies[name] = { revalidateMediaCenterPublicPaths() {} };
    else if (name.endsWith("supabase-admin")) dependencies[name] = { getSupabaseAdmin: () => supabase };
    else if (name.includes("domain-write-coordination")) dependencies[name] = { coordinateMediaReferenceEntityMutation: coordinate };
    else if (name.includes("synchronization")) dependencies[name] = { synchronizeMediaReferenceWriteScopesAfterDomainMutation: async () => mediaSynchronization };
    else if (name.includes("write-lease")) dependencies[name] = { MediaReferenceWriteLeaseError: TestLeaseError, getMediaReferenceWriteLeaseUserMessage: () => "lease failure" };
    else if (name.includes("topic-revision")) dependencies[name] = { parseTopicRevisionToken: () => ({ provided: true, value: current.updated_at }), topicRevisionMatches: () => true, TopicRevisionConflictError: TestRevisionConflict };
    else if (name.includes("content-types")) dependencies[name] = { isContentType: () => true, isMediaEditableContentType: () => true, MEDIA_EDITABLE_CONTENT_TYPES: ["video"] };
    else if (name.includes("category-hierarchy")) dependencies[name] = { getAdminContentSeriesCategoryError: () => null, isAdminContentSeriesInCategory: () => true };
    else if (name.includes("taxonomy-mutations")) {
      const mutate = async () => {
        const result = write();
        if (result.error) return { ok: false, code: "revision_conflict" };
        return { ok: true, category: result.data, series: result.data };
      };
      dependencies[name] = { TaxonomyMutationDatabaseError: class extends Error {},
        updateTopicCategoryAtomically: mutate, updateTopicSeriesAtomically: mutate, createTopicSeriesAtomically: mutate,
        moveTopicCategoriesToTrashAtomically: mutate, permanentlyDeleteTopicCategoriesAtomically: mutate,
        restoreTopicCategoriesAtomically: mutate, moveTopicSeriesToTrashAtomically: mutate,
        permanentlyDeleteTopicSeriesAtomically: mutate, restoreTopicSeriesAtomically: mutate };
    } else if (name.includes("taxonomy-form-validation")) {
      const input = () => ({ name: "Saved", slug: "saved", parent_id: null, category_id: 9, is_published: false });
      dependencies[name] = { categoryTaxonomyFormInput: input, seriesTaxonomyFormInput: input,
        categoryTaxonomyFormSchema: { safeParse: (data) => ({ success: true, data }) },
        seriesTaxonomyFormSchema: { safeParse: (data) => ({ success: true, data }) },
        taxonomyFormDataValue: (form, key) => form.get(key), parseTaxonomyExpectedRevision: () => ({ ok: true, value: current.updated_at }) };
    } else if (name.includes("admin-tone-palette")) dependencies[name] = { getDeterministicAdminTone: () => "blue" };
    else if (name === "../editor-actions/revalidate") dependencies[name] = { revalidateUnifiedContentPaths: failCache };
    else if (name === "./create-domain") dependencies[name] = { ArticleSlugConflictError: class extends Error {}, createArticleDomainRecord: async () => {
      const response = write();
      if (response.error || !response.data) throw new Error("Injected create failure");
      return coordinatedResult(response.data);
    } };
    else if (name === "./helpers") dependencies[name] = {
      getPayload: () => ({ title: "Saved", slug: "saved", image: "", imageAlt: "", status: "unpublished", contentType: "video", categoryId: 9, seriesId: null }),
      getDraftBlockingChecks: () => [], getPublishBlockingChecks: () => [], getDraftValidationChecks: () => [], getPublishedValidationChecks: () => [],
      getNormalizedStatus: (status) => status, preserveImage: (value) => value, preserveText: (value) => value,
      uploadTopicImage: async () => "", uploadMediaImage: async () => "", validateId: () => true,
      buildTopicWritePayload: (_p, _c, _s, _status, now) => ({ updated_at: now }),
      buildMediaWritePayload: (_p, _c, _t, _m, now) => ({ updated_at: now }),
      resolveWriteMediaPayload: () => ({ ok: true, mediaPayload: {} }),
    };
    else if (name === "./validation") dependencies[name] = { ensureUniqueSlug: async () => true,
      getCategory: async () => ({ id: 9 }), getSeries: async () => null, getTopicById: async () => current,
      getEditableMediaTopicById: async () => current, resolveMediaSection: async () => ({ ok: true, category: { id: 9 }, contentType: "video" }) };
    else if (name.includes("content-routes")) dependencies[name] = { ADMIN_CONTENT_ROUTES: { topics: "/admin/content/topics" }, adminContentTopicPath: (id) => `/admin/content/topics/${id}` };
    else if (name.includes("links/usage")) dependencies[name] = { getResourceLinkUsageCount: async () => 0 };
    else dependencies[name] = {};
  }
  const file = kind === "article" ? "src/app/admin/content/topics/article-actions/save.ts"
    : kind === "media" ? "src/app/admin/content/topics/media-actions/save.ts"
    : kind === "taxonomy" ? "src/app/admin/content/taxonomy-form-actions.ts"
    : `src/app/admin/content/${kind}/actions.ts`;
  return { actions: load(file, dependencies), calls };
}

const form = (create = false) => { const result = new FormData(); if (!create) result.set("id", "7"); result.set("status", "unpublished"); return result; };
const initial = { status: "idle", mode: "edit", revision: 2 };

async function check(label, run) {
  try { await run(); passed += 1; console.log(`PASS ${label}`); }
  catch (error) { failures.push({ label, message: error.message }); console.log(`FAIL ${label}: ${error.message}`); }
}

try {
  for (const kind of ["article", "media", "taxonomy"]) {
    const commands = kind === "article" ? ["saveArticleContentAdapter"] : kind === "media" ? ["saveMediaContentAdapter"]
      : ["createCategoryForm", "updateCategoryForm", "createSeriesForm", "updateSeriesForm"];
    for (const command of commands) {
      const modes = kind === "taxonomy" ? [command.startsWith("create")] : [false, true];
      for (const created of modes) {
        const label = `${command} ${created ? "create" : "edit"}`;
        for (const cacheFailures of [0, 1, 99]) {
          await check(`${label}: committed result survives ${cacheFailures} cache failures`, async () => {
            const { actions, calls } = harness(kind, { created, cacheFailures });
            const result = await actions[command](initial, form(created));
            assert.equal(result.status, cacheFailures === 99 ? "warning" : "success");
            assert.equal(result.entityId, created ? 71 : 7);
            assert.ok(result.savedRevision);
            assert.equal(Boolean(result.editHref), created);
            assert.equal(result.revision, 3);
            assert.equal(calls.writes, 1);
            assert.equal(calls.audits, 1);
            assert.equal(calls.cache, cacheFailures ? 2 : 1);
          });
        }
        for (const failure of ["writeThrows", "writeError", "missingData", "missingIdentity"]) {
          await check(`${label}: ${failure} cannot become committed success`, async () => {
            const { actions, calls } = harness(kind, { created, cacheFailures: 99, [failure]: true });
            const result = await actions[command](initial, form(created));
            assert.equal(result.status, "error");
            assert.equal(calls.writes, 1);
            assert.equal(calls.cache, 0);
            assert.equal(calls.audits, 0);
            assert.equal(result.editHref, undefined);
          });
        }
        if (kind === "taxonomy") {
          await check(`${label}: missing returned revision cannot become success`, async () => {
            const { actions, calls } = harness(kind, { created, missingRevision: true, cacheFailures: 99 });
            const result = await actions[command](initial, form(created));
            assert.equal(result.status, "error");
            assert.equal(calls.writes, 1);
            assert.equal(calls.cache, 0);
            assert.equal(calls.audits, 0);
          });
        }
        if (kind !== "taxonomy") {
          for (const failure of ["missingCoordinated", "nullValue"]) {
            await check(`${label}: ${failure} returns an unconfirmed-result error`, async () => {
              const { actions, calls } = harness(kind, { created, [failure]: true, cacheFailures: 99 });
              const result = await actions[command](initial, form(created));
              assert.equal(result.status, "error"); assert.equal(result.editHref, undefined);
              assert.equal(calls.writes, 1); assert.equal(calls.audits, 0); assert.equal(calls.cache, 0);
            });
          }
          await check(`${label}: media and cache warnings are both retained`, async () => {
            const { actions, calls } = harness(kind, { created, mediaWarning: true, cacheFailures: 99 });
            const result = await actions[command](initial, form(created));
            assert.equal(result.status, "warning");
            assert.equal(result.code, "saved_with_media_sync_warning");
            assert.match(result.message, /الميديا/);
            assert.match(result.message, /القراءات|العرض/);
            assert.equal(calls.writes, 1);
            assert.equal(calls.audits, 1);
          });
        }
      }
    }
  }
  for (const kind of ["categories", "series"]) {
    const command = kind === "categories" ? "duplicateCategoryAjax" : "duplicateSeriesAjax";
    for (const options of [{ collisions: 2 }, { probeError: true }, { probeThrows: true }, { collisions: 99 }]) {
      await check(`${command}: bounded probes ${JSON.stringify(options)}`, async () => {
        const { actions, calls } = harness(kind, options);
        const result = await actions[command](7);
        if (options.collisions === 2) {
          assert.equal(result.ok, true); assert.equal(calls.writes, 1); assert.equal(calls.probes, 3);
          assert.deepEqual(calls.slugs, ["original-copy", "original-copy-2", "original-copy-3"]);
        } else {
          assert.equal(result.ok, false); assert.equal(calls.writes, 0); assert.equal(calls.audits, 0); assert.equal(calls.cache, 0);
          assert.equal(calls.probes, options.collisions ? 50 : 1);
        }
      });
    }
    for (const cacheFailures of [1, 99]) {
      await check(`${command}: no duplicate INSERT after cache failure`, async () => {
        const { actions, calls } = harness(kind, { cacheFailures });
        const result = await actions[command](7);
        assert.equal(result.ok, true); assert.equal(result.feedbackStatus, cacheFailures === 99 ? "warning" : "success");
        assert.equal(result.entityId, 7); assert.equal(calls.writes, 1); assert.equal(calls.audits, 1); assert.equal(calls.cache, 2);
      });
    }
    for (const failure of ["writeError", "missingData", "missingIdentity"]) {
      await check(`${command}: ${failure} cannot become success or trigger cache retry`, async () => {
        const { actions, calls } = harness(kind, { [failure]: true, cacheFailures: 99 });
        const result = await actions[command](7);
        assert.equal(result.ok, false); assert.equal(calls.writes, 1); assert.equal(calls.audits, 0); assert.equal(calls.cache, 0);
      });
    }
    for (const operation of ["delete", "restore", "permanentlyDelete"]) {
      const lifecycleCommand = `${operation}${kind === "categories" ? "Category" : "Series"}${operation === "delete" && kind === "categories" ? "Safely" : ""}Ajax`;
      await check(`${lifecycleCommand}: cache warning preserves the single committed domain call`, async () => {
        const { actions, calls } = harness(kind, { cacheFailures: 99, mediaWarning: true });
        const result = await actions[lifecycleCommand](7, true);
        assert.equal(result.ok, true); assert.equal(result.feedbackStatus, "warning");
        assert.equal(calls.writes, 1); assert.equal(calls.audits, 1); assert.equal(calls.cache, 2);
        if (operation === "permanentlyDelete" && kind === "categories") {
          assert.equal(result.code, "saved_with_media_sync_warning"); assert.match(result.message, /الميديا/);
        }
      });
      await check(`${lifecycleCommand}: unconfirmed domain call never becomes warning`, async () => {
        const { actions, calls } = harness(kind, { writeThrows: true, cacheFailures: 99 });
        const result = await actions[lifecycleCommand](7, true);
        assert.equal(result.ok, false); assert.equal(calls.writes, 1); assert.equal(calls.audits, 0); assert.equal(calls.cache, 0);
      });
    }
  }
  for (const kind of ["topics", "categories", "series"]) {
    const commands = kind === "topics" ? ["toggleUnifiedContentFeatured", "softDeleteUnifiedContent"]
      : kind === "categories" ? ["toggleCategoryStatusAjax"] : ["toggleSeriesStatusAjax"];
    for (const command of commands) {
      await check(`${command}: committed cache exhaustion stays ok:true`, async () => {
        const { actions, calls } = harness(kind, { cacheFailures: 99 });
        const result = await (kind === "topics" ? actions[command](form()) : actions[command](7, "unpublished"));
        assert.equal(result.ok, true); assert.equal(result.feedbackStatus, "warning");
        assert.equal(calls.writes, 1); assert.equal(calls.audits, 1); assert.equal(calls.cache, 2);
      });
      await check(`${command}: rejected write stays failure without cache or audit`, async () => {
        const { actions, calls } = harness(kind, { cacheFailures: 99, writeError: true });
        const result = await (kind === "topics" ? actions[command](form()) : actions[command](7, "unpublished"));
        assert.equal(result.ok, false); assert.equal(calls.cache, 0); assert.equal(calls.audits, 0);
      });
      for (const failure of ["missingData", "missingIdentity"]) {
        await check(`${command}: ${failure} cannot claim committed success`, async () => {
          const { actions, calls } = harness(kind, { [failure]: true, cacheFailures: 99 });
          const result = await (kind === "topics" ? actions[command](form()) : actions[command](7, "unpublished"));
          assert.equal(result.ok, false); assert.equal(calls.writes, 1); assert.equal(calls.audits, 0); assert.equal(calls.cache, 0);
        });
      }
    }
  }
  await check("shared cache warning projection never converts explicit failure", () => {
    const result = resultOwner.adminActionFailure("failed", "write not confirmed");
    assert.equal(resultOwner.withAdminActionCacheWarning(result, false), result);
  });
} finally { globalThis.fetch = originalFetch; }

console.log(JSON.stringify({ proof: "isolated actual server actions; zero real database/network writes", baseline, passed, failed: failures.length, failures }, null, 2));
if (failures.length && !baseline) process.exitCode = 1;
