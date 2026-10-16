import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

// Actual Actions, public reader, schemas and cache owners against in-memory SQL.
// Only IO/framework ports are replaced. No environment file or network is used.
export async function verifyTrackingWriteConsistency(db) {
  const root = process.cwd(), require = createRequire(import.meta.url);
  const modules = new Map(), entries = new Map(), events = [];
  let generation = 0, rejectAdvance = false, rejectMedia = false, mutationCount = 0;
  const tables = ["projects", "project_tracking_stages", "project_tracking_items", "project_tracking_updates", "project_tracking_update_media"];
  const rpcNames = new Set(["project_tracking_public_detail_v1", "mutate_project_tracking_stage", "mutate_project_tracking_item", "mutate_project_tracking_update"]);
  function from(table) {
    assert.ok(tables.includes(table), table);
    const filters = [], orders = [];
    let selection = "", options = {}, range = null, single = false;
    const query = {
      select(value, opts = {}) { selection = value; options = opts; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      order(key, opts = {}) { orders.push([key, opts.ascending !== false]); return query; },
      range(start, end) { range = [start, end]; return query; },
      maybeSingle() { single = true; return query; },
      async then(yes, no) {
        try {
          const snapshot = Object.fromEntries(await Promise.all(tables.map(async name => [name, (await db.query("select * from public." + name)).rows])));
          let rows = snapshot[table].map(row => {
            if (table === "project_tracking_stages" && selection.includes("project_tracking_items("))
              return { ...row, project_tracking_items: snapshot.project_tracking_items.filter(item => item.stage_id === row.id && item.is_visible) };
            if (table === "project_tracking_items")
              return { ...row, project_tracking_updates: [{ count: snapshot.project_tracking_updates.filter(update => update.item_id === row.id && update.publication_status === "published").length }] };
            if (table === "project_tracking_updates") {
              const item = snapshot.project_tracking_items.find(item => item.id === row.item_id);
              return { ...row, project_tracking_items: { ...item, project_tracking_stages: snapshot.project_tracking_stages.find(stage => stage.id === item?.stage_id) } };
            }
            return row;
          });
          for (const [key, value] of filters) {
            // A to-many filter affects the embedded relation, not its parent.
            if (key === "project_tracking_items.is_visible" && table === "project_tracking_stages") continue;
            if (key === "project_tracking_updates.publication_status" && table === "project_tracking_items") continue;
            rows = rows.filter(row => key.split(".").reduce((value, part) => value?.[part], row) === value);
          }
          rows.sort((a, b) => {
            for (const [key, ascending] of orders) {
              const delta = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
              if (delta) return ascending ? delta : -delta;
            }
            return 0;
          });
          const count = rows.length;
          if (range) rows = rows.slice(range[0], range[1] + 1);
          // PostgREST serializes dates; PGlite returns Date instances.
          const data = JSON.parse(JSON.stringify(single ? rows[0] ?? null : rows));
          return yes({ data: options.head ? null : data, error: null, count });
        } catch (error) { return no ? no(error) : Promise.reject(error); }
      },
    };
    return query;
  }
  function rpc(name, args = {}) {
    const promise = (async () => {
      if (name === "read_public_cache_generation") return { data: String(generation), error: null };
      if (name === "advance_public_cache_generation") {
        events.push("advance");
        return rejectAdvance ? { data: null, error: { code: "fixture_unavailable" } } : { data: String(++generation), error: null };
      }
      assert.ok(rpcNames.has(name), name);
      if (name.startsWith("mutate_")) mutationCount++;
      try {
        const params = Object.keys(args).map((key, i) => key + " => $" + (i + 1)).join(",");
        const response = await db.query("select public." + name + "(" + params + ") as value", Object.values(args));
        return { data: response.rows[0].value, error: null };
      } catch (error) {
        // Match supabase-js plain RPC errors.
        return { data: null, error: { code: error.code, message: error.message, details: error.detail } };
      }
    })();
    promise.throwOnError = async () => { const response = await promise; if (response.error) throw response.error; return response; };
    return promise;
  }
  const cachePort = {
    unstable_cache: (read, keys, options) => async (...args) => {
      const key = JSON.stringify([keys, args]);
      if (entries.has(key)) return structuredClone(entries.get(key).value);
      const value = await read(...args);
      entries.set(key, { value: structuredClone(value), tags: options.tags });
      return value;
    },
    revalidatePath: () => {},
    revalidateTag: (tag, profile) => {
      events.push(profile === "max" ? "swr" : "expire");
      // SWR permits a stale next request. Late fills / real Next adapter are
      // separately exercised by verify-public-cache-generation.mts.
      if (profile !== "max") for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
    },
  };
  const stubs = {
    "src/lib/supabase-admin.ts": { getSupabaseAdmin: () => ({ from, rpc }) },
    "src/lib/logging.ts": { logError: () => {}, logWarnWithError: () => {} },
    "src/lib/admin/auth/require-admin-session.ts": { requireAdminSession: async () => ({ id: 1 }) },
    "src/lib/admin/audit-log.ts": { recordCmsAdminAudit: async () => {} },
    "src/lib/admin/audit/cms-audit-actions.ts": { buildCmsAuditAction: () => "fixture" },
    "src/lib/admin/media-catalog/deleted-reference-state.ts": { readUnavailableManagedValues: async () => [] },
    "src/lib/projects/load-published-projects.ts": { loadProjectBySlugResult: () => { throw Error("Unexpected fallback"); } },
    "src/lib/admin/media-catalog/reference-providers.ts": {},
    "src/lib/admin/media-catalog/identity.ts": {},
    "src/lib/admin/media-storage-adapter.ts": {},
    "src/lib/storage/upload-cms-asset.ts": {},
    "src/lib/admin/media-catalog/synchronization.ts": {},
    "src/lib/admin/projects/tracking-media-coordination.ts": {
      coordinateTrackingUpdateSave: async ({ mutate, intendedMedia }) => {
        assert.deepEqual(intendedMedia, [], "This cache fixture must not write media");
        if (rejectMedia) throw new (load("src/lib/admin/media-catalog/write-lease.ts").MediaReferenceWriteLeaseError)("media_write_lease_conflict");
        return { value: await mutate(), mediaSynchronization: { status: "synced" } };
      },
      cleanupDeletedTrackingUpdateMedia: async () => ({ status: "synced" }),
    },
  };
  const allowed = new Set([
    "src/app/admin/projects/tracking-actions.ts", "src/lib/projects/tracking/public-read.ts",
    "src/lib/projects/tracking/contract.ts", "src/lib/admin/projects/tracking-contract.ts",
    "src/lib/admin/entity-list/pagination.ts", "src/lib/admin/admin-action-result.ts",
    "src/lib/cache/public-cache-generation.ts", "src/lib/cache/revalidate-public-cache-tags.ts",
    "src/lib/admin/media-catalog/write-lease.ts", "src/lib/admin/media-catalog/domain-write-coordination.ts",
    "src/lib/admin/media-catalog/reference-sync-contract.ts",
  ]);
  function load(path) {
    if (stubs[path]) return stubs[path];
    if (modules.has(path)) return modules.get(path).exports;
    assert.ok(allowed.has(path), "Unisolated dependency: " + path);
    const commonJsModule = { exports: {} }; modules.set(path, commonJsModule);
    const code = ts.transpileModule(readFileSync(resolve(root, path), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", code)(id => {
      if (id === "server-only") return {};
      if (id === "react") return { cache: fn => fn };
      if (id === "next/cache") return cachePort;
      if (id === "next/navigation") return { unstable_rethrow: () => {} };
      if (["zod", "node:crypto"].includes(id)) return require(id);
      assert.ok(id.startsWith("."), id);
      return load(resolve(dirname(path), id).slice(root.length + 1).replaceAll("\\", "/") + ".ts");
    }, commonJsModule, commonJsModule.exports);
    return commonJsModule.exports;
  }
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousVercel = process.env.VERCEL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  delete process.env.VERCEL;
  try {
    const actions = load("src/app/admin/projects/tracking-actions.ts"), reader = load("src/lib/projects/tracking/public-read.ts");
    const projectId = (await db.query("insert into public.projects(slug,arabic_name,publication_status) values ('tracking-consistency-fixture','Fixture','published') returning id")).rows[0].id;
    const form = values => { const data = new FormData(); for (const [key, value] of Object.entries({ project_id: projectId, ...values })) data.set(key, String(value)); return data; };
    const previous = { status: "idle", mode: "edit", revision: 0 };
    const detail = async () => { const response = await reader.loadProjectTrackingDetail("tracking-consistency-fixture"); assert.equal(response.status, "ready"); return response.detail; };
    const itemIds = [], stageIds = [];
    for (let i = 0; i < 2; i++) {
      const stage = await actions.createTrackingStageAction(previous, form({ name: "Stage " + i, is_visible: "on" }));
      assert.equal(stage.status, "success", JSON.stringify(stage)); stageIds.push(stage.result.id);
      const item = await actions.createTrackingItemAction(previous, form({ stage_id: stage.result.id, name: "Item", status: "in_progress", is_visible: "on" }));
      assert.equal(item.status, "success", JSON.stringify(item)); itemIds.push(item.result.id);
    }
    assert.equal((await detail()).counts.completedStages, 0);
    for (let i = 0; i < 2; i++) {
      const saved = await actions.updateTrackingItemAction(previous, form({ item_id: itemIds[i], stage_id: stageIds[i], name: "Item", status: "completed", completion_date: "2026-10-16", is_visible: "on" }));
      assert.equal(saved.status, "success", JSON.stringify(saved));
      assert.equal((await detail()).counts.completedStages, i + 1, "First request after save must see newly completed stages");
    }
    assert.deepEqual((await detail()).stages.map(stage => stage.status), ["completed", "completed"]);
    assert.ok(events.includes("advance"), "Tracking must use the existing generation fence");
    const updateForm = status => form({ item_id: itemIds[0], title: "Update " + status, body: "Fixture update", occurred_on: "2026-10-16", publication_status: status });
    const published = await actions.createTrackingUpdateAction(previous, updateForm("published"));
    assert.equal(published.status, "success", JSON.stringify(published));
    assert.equal((await detail()).latestUpdate.id, published.result.id);
    assert.equal((await detail()).counts.updates, 1);
    const draft = await actions.createTrackingUpdateAction(previous, updateForm("draft"));
    assert.equal(draft.status, "success"); assert.equal((await detail()).counts.updates, 1);
    assert.equal((await detail()).latestUpdate.id, published.result.id, "New draft stays private");
    console.log("PASS actual Actions -> SQL -> cache owner -> public reader: multiple completed stages, new update, private draft");

    const rejectedStage = await actions.deleteTrackingStageAction(projectId, stageIds[0], "Fixture");
    assert.equal(rejectedStage.ok, false);
    assert.equal(rejectedStage.message, "لا يمكن حذف المرحلة لأنها تحتوي على بنود.");
    const rejectedItem = await actions.deleteTrackingItemAction(projectId, stageIds[0], itemIds[0], "Fixture");
    assert.equal(rejectedItem.ok, false);
    assert.equal(rejectedItem.message, "لا يمكن حذف البند لأنه يحتوي على تحديثات إنشائية محفوظة.");
    assert.equal((await db.query("select count(*)::int as count from project_tracking_stages where project_id=$1", [projectId])).rows[0].count, 2);
    assert.equal((await db.query("select count(*)::int as count from project_tracking_updates where item_id=$1", [itemIds[0]])).rows[0].count, 2);
    console.log("PASS child-protected deletion reports the actual guard and retains stages/items/history");

    rejectAdvance = true;
    const before = mutationCount, attempts = events.filter(event => event === "advance").length;
    const pending = await actions.createTrackingUpdateAction(previous, updateForm("published"));
    assert.equal(pending.status, "warning"); assert.equal(pending.code, "committed_cache_revalidation_pending");
    assert.equal(mutationCount - before, 1, "Cache failure must not replay the committed write");
    assert.equal(events.filter(event => event === "advance").length - attempts, 2);
    rejectAdvance = false;
    console.log("PASS failed cache acknowledgement: committed warning, bounded retry, no duplicate write");
    rejectMedia = true;
    const beforeConflict = mutationCount;
    const conflict = await actions.createTrackingUpdateAction(previous, updateForm("published"));
    assert.equal(conflict.status, "error"); assert.equal(mutationCount, beforeConflict);
    assert.equal(conflict.message, load("src/lib/admin/media-catalog/write-lease.ts").getMediaReferenceWriteLeaseUserMessage("media_write_lease_conflict"));
    console.log("PASS canonical Media lease explanation; no domain write on conflict");
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
  }
}
