import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import type { MediaReferenceSynchronizationResult } from "../../src/lib/admin/media-catalog/reference-sync-contract";

type QueryResult = { data: unknown; error: { message: string } | null };
type Read = { table: string; filters: Array<[string, unknown]> };
type Entry = { floor_plans: Array<{ id: number; details: Array<{ label: string; value: string }> }> };

export async function verifyProjectEntryReadScheduling(root: string) {
  const source = readFileSync(resolve(root, "src/lib/admin/projects/project-entry-data.ts"), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const project = { id: 40, type: "residential", overview_media_type: "image", publication_status: "unpublished" };
  const plan = { id: 50, name: "First plan" };
  const detail = { id: 60, floor_plan_id: 50, label: "Area", value: "100" };

  function load(responses: Record<string, QueryResult | Promise<QueryResult>>, reads: Read[]) {
    const supabase = { from(table: string) {
      const filters: Read["filters"] = [];
      const query: Record<string, unknown> = {};
      for (const method of ["select", "order", "maybeSingle", "or"]) query[method] = () => query;
      for (const method of ["eq", "in"]) query[method] = (key: string, value: unknown) => {
        filters.push([key, value]);
        return query;
      };
      query.then = (accept: (result: QueryResult) => unknown, reject: (error: unknown) => unknown) => {
        reads.push({ table, filters });
        return Promise.resolve(responses[table] ?? { data: [], error: null }).then(accept, reject);
      };
      return query;
    } };
    const dependencies: Record<string, unknown> = {
      "server-only": {},
      "../../supabase-admin": { getSupabaseAdmin: () => supabase },
      "./project-entry-contract": { createEmptyProjectEntry: () => ({ project: {} }) },
      "./location-management-contract": { PROJECT_LOCATION_LEVELS: ["governorate", "city", "main_area", "sub_area"] },
      "./project-publishing-capability": { isProjectPublicationStatus: (value: string) => ["published", "unpublished"].includes(value) },
    };
    const commonJsModule = { exports: {} as { loadProjectEntry: (id: number) => Promise<Entry | null> } };
    Function("module", "exports", "require", output)(commonJsModule, commonJsModule.exports, (specifier: string) => {
      assert.ok(specifier in dependencies, `unexpected Project read-owner dependency ${specifier}`);
      return dependencies[specifier];
    });
    return commonJsModule.exports.loadProjectEntry;
  }
  let passed = 0;
  const ok = (label: string) => { passed += 1; console.log(`PASS ${label}`); };
  let releaseFeatures!: (value: QueryResult) => void;
  const features = new Promise<QueryResult>((resolve) => { releaseFeatures = resolve; });
  const reads: Read[] = [];
  const pending = load({
    projects: { data: project, error: null },
    project_floor_plans: { data: [plan], error: null },
    project_floor_plan_details: { data: [detail], error: null },
    project_features: features,
  }, reads)(40);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const startedBeforeUnrelatedRead = reads.map((read) => read.table);
  releaseFeatures({ data: [], error: null });
  const entry = await pending;
  assert.ok(startedBeforeUnrelatedRead.includes("project_floor_plan_details"), "plan details must start while unrelated features remain pending");
  assert.equal(reads.length, 9, "valid Project aggregate retains exactly nine reads");
  assert.equal(new Set(reads.map((read) => read.table)).size, 9, "each relation is read only once");
  assert.deepEqual(reads.find((read) => read.table === "project_floor_plan_details")?.filters, [["floor_plan_id", [50]]]);
  assert.deepEqual(entry?.floor_plans[0].details.map(({ label, value }) => ({ label, value })), [{ label: "Area", value: "100" }]);
  ok("Project details start after plan IDs without waiting for unrelated children; bounded reads and mapping remain correct");

  for (const rootState of [{ data: null, error: null }, { data: null, error: { message: "root error" } }]) {
    const emptyReads: Read[] = [];
    const result = load({ projects: rootState }, emptyReads)(40);
    if (rootState.error) await assert.rejects(result, /root error/);
    else assert.equal(await result, null);
    assert.deepEqual(emptyReads.map((read) => read.table), ["projects"]);
  }
  ok("Project absence and root errors never load aggregate children");

  for (const planState of [{ data: [], error: null }, { data: [plan], error: { message: "plan error" } }]) {
    const emptyReads: Read[] = [];
    const result = load({ projects: { data: project, error: null }, project_floor_plans: planState }, emptyReads)(40);
    if (planState.error) await assert.rejects(result, /plan error/);
    else assert.deepEqual((await result)?.floor_plans, []);
    assert.equal(emptyReads.some((read) => read.table === "project_floor_plan_details"), false);
  }
  ok("Empty or failed plans do not initiate a details query");

  const errors = {
    projects: { data: project, error: null },
    project_floor_plans: { data: [plan], error: null },
    project_floor_plan_details: { data: null, error: { message: "detail error" } },
  };
  await assert.rejects(load(errors, [])(40), /detail error/);
  await assert.rejects(load({ ...errors, project_features: { data: null, error: { message: "feature error" } } }, [])(40), (error: unknown) =>
    error instanceof Error && error.message.includes("feature error") && !error.message.includes("detail error"));
  ok("Project child and details failures retain existing error priority without partial aggregate success");
  return passed;
}

/** Actual Project and domain coordinators; only read, lease and sync ports are isolated. */
export async function verifyProjectEntryMediaPreflight(root: string) {
  type Domain = "project_floor_plans" | "project_media" | "project_videos";
  type Deleted = {
    floor_plan_ids: number[]; media_ids: number[]; video_ids: number[];
    feature_ids: number[]; floor_plan_detail_ids: number[];
  };
  type Scope = { domainKey: string; entityIdentity: string; values: unknown[] };
  type Target = { domainKey: string; entityIdentity: string; leaseEntityIdentity: string };
  type Cleanup = { domainKey: string; entityIdentity: string };
  type Saved = { id: number; slug: string; updatedAt: string };
  type Lease = { token: string; primaryEntityIdentity: string };
  type Options = {
    deleted?: Partial<Deleted>;
    projectId?: number | null;
    errorStage?: "before" | "after";
    errorTables?: Domain[];
    missingIdentity?: Domain;
    mutationError?: Error;
    noLease?: boolean;
    syncWarning?: boolean;
    emptyChildren?: boolean;
  };
  const domains: Domain[] = ["project_floor_plans", "project_media", "project_videos"];
  const savedRows: Record<Domain, Array<{ id: number; client_key: string }>> = {
    project_floor_plans: [{ id: 501, client_key: "plan-new" }],
    project_media: [{ id: 701, client_key: "media-new" }],
    project_videos: [{ id: 901, client_key: "video-new" }],
  };

  function fixture(options: Options = {}) {
    const state = {
      reads: [] as Array<{ table: Domain; stage: "before" | "after"; projectId: number }>,
      events: [] as string[], mutations: 0,
      acquired: [] as Array<{ scopes: Scope[]; actorId: number; requestIdentity: string }>,
      completed: [] as Array<{ lease: Lease; identity: string }>,
      failed: [] as Array<{ failureCode: string; domainWriteCommitted: boolean }>,
      sync: [] as Array<{ targets: Target[]; leaseToken: string | null; cleanup: Cleanup[] }>,
      uncertain: [] as string[][],
    };
    const projectId = options.projectId === undefined ? 40 : options.projectId;
    const saved = { id: projectId ?? 41, slug: "fixture-project", updatedAt: "2026-09-18T00:00:00Z" };
    const deleted: Deleted = { floor_plan_ids: [], media_ids: [], video_ids: [], feature_ids: [], floor_plan_detail_ids: [], ...options.deleted };
    const payload = {
      project: { image: "/root.jpg", hero_image: "", small_box_image: "", overview_main_image: "", og_image: "" },
      floor_plans: options.emptyChildren ? [] : [{ client_key: "plan-new", architectural_image: "/plan.jpg", furnishing_image: "" }],
      media: options.emptyChildren ? [] : [{ client_key: "media-new", image: "/gallery.jpg" }],
      videos: options.emptyChildren ? [] : [{ client_key: "video-new", poster_image: "/poster.jpg" }],
      deleted,
    };
    const syncResult: MediaReferenceSynchronizationResult = options.syncWarning ? {
      status: "saved_with_media_sync_warning", code: "media_reference_sync_failed", domainKey: "projects", entityIdentity: String(saved.id),
      failureReason: "fixture_sync_warning", requiresReconciliation: true, mediaSynchronizationState: "uncertain", uncertainties: ["fixture_sync_warning"],
    } : {
      status: "synced", code: "media_reference_sync_succeeded", domainKey: "projects", entityIdentity: String(saved.id),
      failureReason: null, requiresReconciliation: false, mediaSynchronizationState: "synced", uncertainties: [], referenceCount: 4, explicitEmpty: false,
    };
    const lease: Lease = { token: "fixture-lease", primaryEntityIdentity: "" };
    const referencePort = { buildMediaReferenceWriteScope: (domainKey: string, entityIdentity: string, row: unknown) => ({ domainKey, entityIdentity, values: [row] }) };
    const syncPort = {
      synchronizeMediaReferenceWriteScopesAfterDomainMutation: async (targets: Target[], leaseToken: string | null, cleanup: Cleanup[]) => {
        state.events.push("synchronize"); state.sync.push({ targets, leaseToken, cleanup }); return syncResult;
      },
      markMediaCatalogRuntimeUncertain: async (reasons: string[]) => { state.uncertain.push(reasons); },
    };
    const ports: Record<string, unknown> = {
      "server-only": {},
      "../../supabase-admin": { getSupabaseAdmin: () => ({ from(table: Domain) {
        assert.ok(domains.includes(table), `Unexpected preflight table ${table}`);
        return { select(columns: string) {
          assert.equal(columns, "id,client_key");
          return { eq(key: string, value: number) {
            assert.equal(key, "project_id");
            const stage = state.mutations ? "after" : "before";
            state.events.push(`read:${stage}:${table}`); state.reads.push({ table, stage, projectId: value });
            const error = options.errorStage === stage && (options.errorTables ?? domains).includes(table)
              ? { message: `${stage}:${table}` } : null;
            const data = stage === "before"
              ? [{ id: 60, client_key: `removed:${table}` }, { id: 61, client_key: `retained:${table}` }]
              : options.missingIdentity === table || options.emptyChildren ? [] : savedRows[table];
            return Promise.resolve({ data, error });
          } };
        } };
      } }) },
      "../media-catalog/reference-providers": referencePort,
      "./reference-providers": referencePort,
      "../media-catalog/synchronization": syncPort,
      "./synchronization": syncPort,
      "./write-lease": {
        acquireMediaReferenceWriteLease: async (input: { scopes: Scope[]; actorId: number; requestIdentity: string }) => {
          state.events.push("acquire"); state.acquired.push(input);
          lease.primaryEntityIdentity = input.scopes[0].entityIdentity;
          return options.noLease ? null : lease;
        },
        completeMediaReferenceWriteLease: async (value: Lease, identity: string) => { state.events.push("complete"); state.completed.push({ lease: value, identity }); },
        failMediaReferenceWriteLease: async (input: { failureCode: string; domainWriteCommitted: boolean }) => { state.events.push("fail"); state.failed.push(input); },
      },
    };
    const modules = new Map<string, { exports: Record<string, unknown> }>();
    function load(file: string): Record<string, unknown> {
      const cached = modules.get(file); if (cached) return cached.exports;
      const mod = { exports: {} as Record<string, unknown> }; modules.set(file, mod);
      const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      Function("module", "exports", "require", code)(mod, mod.exports, (specifier: string) => {
        if (specifier in ports) return ports[specifier];
        if (specifier === "../media-catalog/domain-write-coordination") return load("src/lib/admin/media-catalog/domain-write-coordination.ts");
        if (specifier === "./reference-sync-contract") return load("src/lib/admin/media-catalog/reference-sync-contract.ts");
        throw new Error(`Unexpected Project coordinator dependency ${specifier}`);
      });
      return mod.exports;
    }
    const coordinate = load("src/lib/admin/projects/project-entry-media-coordination.ts").coordinateProjectEntrySave as (input: {
      actorId: number; projectId: number | null; payload: typeof payload; mutate: () => Promise<Saved>;
    }) => Promise<{ value: Saved; mediaSynchronization: MediaReferenceSynchronizationResult; lease: Lease | null }>;
    const run = () => coordinate({ actorId: 7, projectId, payload, mutate: async () => {
      state.events.push("mutate"); state.mutations++;
      if (options.mutationError) throw options.mutationError;
      return saved;
    } });
    return { state, run, saved, syncResult, payload, lease };
  }

  let passed = 0;
  const ok = (label: string) => { passed++; console.log(`PASS ${label}`); };
  for (const deleted of [{}, { feature_ids: [80], floor_plan_detail_ids: [81] }]) {
    const h = fixture({ deleted }); const result = await h.run();
    assert.deepEqual(h.state.reads, domains.map(table => ({ table, stage: "after", projectId: 40 })));
    assert.deepEqual(h.state.events, ["acquire", "mutate", ...domains.map(table => `read:after:${table}`), "synchronize", "complete"]);
    assert.equal(h.state.mutations, 1); assert.equal(h.state.acquired.length, 1); assert.equal(h.state.sync.length, 1);
    assert.equal(h.state.acquired[0].actorId, 7); assert.match(h.state.acquired[0].requestIdentity, /^project-entry:/);
    assert.deepEqual(h.state.sync[0].targets.map(row => [row.domainKey, row.entityIdentity]), [["projects", "40"], [domains[0], "501"], [domains[1], "701"], [domains[2], "901"]]);
    assert.deepEqual(h.state.sync[0].targets.map(row => row.leaseEntityIdentity), h.state.acquired[0].scopes.map(row => row.entityIdentity));
    assert.equal(h.state.sync[0].leaseToken, h.lease.token); assert.deepEqual(h.state.sync[0].cleanup, []);
    assert.strictEqual(result.value, h.saved); assert.strictEqual(result.mediaSynchronization, h.syncResult); assert.strictEqual(result.lease, h.lease);
    assert.deepEqual(h.state.failed, []); assert.deepEqual(h.state.uncertain, []);
  }
  ok("Project Save without media-child tombstones skips only three preflight reads and preserves actor, lease, mutation, persisted IDs and return values");

  for (const [index, key] of ["floor_plan_ids", "media_ids", "video_ids"].entries()) {
    const h = fixture({ deleted: { [key]: [60, 999] } }); const result = await h.run();
    assert.deepEqual(h.state.reads, ["before", "after"].flatMap(stage => domains.map(table => ({ table, stage, projectId: 40 }))));
    assert.deepEqual(h.state.events.slice(0, 5), [...domains.map(table => `read:before:${table}`), "acquire", "mutate"]);
    assert.deepEqual(h.state.sync[0].cleanup, [{ domainKey: domains[index], entityIdentity: "60" }], "cleanup is domain-bound, requested and previously owned only");
    assert.equal(h.state.mutations, 1); assert.equal(h.state.sync.length, 1); assert.strictEqual(result.mediaSynchronization, h.syncResult);
  }
  ok("Each nonempty media deletion list retains all preflight reads and exact project-owned tombstone cleanup without duplicate writes");

  for (const errorTables of [...domains.map(table => [table]), domains]) {
    const h = fixture({ deleted: { floor_plan_ids: [60] }, errorStage: "before", errorTables });
    await assert.rejects(h.run(), { message: `project_media_preflight_failed:before:${errorTables[0]}` });
    assert.equal(h.state.reads.length, 3); assert.equal(h.state.acquired.length, 0); assert.equal(h.state.mutations, 0); assert.equal(h.state.sync.length, 0);
    assert.deepEqual(h.state.failed, []); assert.deepEqual(h.state.completed, []);
  }
  ok("Nonempty deletion preflight failures preserve error priority and stop before lease acquisition or domain mutation");

  for (const missingIdentity of domains) {
    const h = fixture({ missingIdentity }); const result = await h.run();
    assert.equal(h.state.reads.length, 3); assert.equal(h.state.mutations, 1); assert.equal(h.state.sync.length, 0);
    assert.strictEqual(result.value, h.saved); assert.equal(result.mediaSynchronization.status, "saved_with_media_sync_warning");
    assert.match(result.mediaSynchronization.failureReason ?? "", new RegExp(`^project_media_identity_mapping_incomplete:${missingIdentity}:`));
    assert.equal(h.state.failed.length, 1); assert.equal(h.state.failed[0].domainWriteCommitted, true); assert.equal(h.state.completed.length, 0); assert.equal(h.state.uncertain.length, 1);
  }
  ok("Missing post-save child identities retain committed-save warnings and fail the lease without synchronization, completion or write retry");

  for (const table of domains) {
    const h = fixture({ errorStage: "after", errorTables: [table] }); const result = await h.run();
    assert.equal(h.state.mutations, 1); assert.equal(h.state.reads.length, 3); assert.equal(h.state.sync.length, 0);
    assert.equal(result.mediaSynchronization.failureReason, `project_media_preflight_failed:after:${table}`);
    assert.equal(result.mediaSynchronization.status, "saved_with_media_sync_warning"); assert.strictEqual(result.value, h.saved);
    assert.equal(h.state.failed[0].domainWriteCommitted, true); assert.equal(h.state.completed.length, 0);
  }
  ok("Post-save child read failures remain required and retain committed-save warning semantics after the empty-deletion shortcut");

  for (const deleted of [{}, { media_ids: [60] }]) {
    const error = new Error("fixture_domain_write_failed"); const h = fixture({ deleted, mutationError: error });
    await assert.rejects(h.run(), value => value === error);
    assert.equal(h.state.mutations, 1); assert.equal(h.state.reads.length, "media_ids" in deleted ? 3 : 0);
    assert.deepEqual(h.state.reads.map(row => row.stage), h.state.reads.map(() => "before"));
    assert.equal(h.state.failed.length, 1); assert.equal(h.state.failed[0].domainWriteCommitted, false);
    assert.equal(h.state.sync.length, 0); assert.equal(h.state.completed.length, 0); assert.equal(h.state.uncertain.length, 0);
  }
  ok("Domain mutation failures preserve the exact error and never retry or initiate post-save reads on either deletion branch");

  for (const noLease of [false, true]) {
    const h = fixture({ syncWarning: true, noLease }); const result = await h.run();
    assert.strictEqual(result.value, h.saved); assert.strictEqual(result.mediaSynchronization, h.syncResult);
    assert.equal(h.state.mutations, 1); assert.equal(h.state.sync.length, 1); assert.equal(h.state.completed.length, 0);
    assert.equal(h.state.failed.length, noLease ? 0 : 1); assert.equal(h.state.uncertain.length, 1);
    assert.equal(h.state.sync[0].leaseToken, noLease ? null : h.lease.token);
  }
  ok("Synchronization warnings preserve exact caller results with managed or null leases and never replay the saved mutation");

  {
    const h = fixture({ projectId: null }); const result = await h.run();
    assert.deepEqual(h.state.reads, domains.map(table => ({ table, stage: "after", projectId: 41 })));
    assert.equal(h.state.mutations, 1); assert.equal(h.state.sync[0].targets[0].entityIdentity, "41");
    assert.match(h.state.sync[0].targets[0].leaseEntityIdentity, /^project-create:/);
    assert.equal(h.state.completed[0].identity, h.lease.primaryEntityIdentity); assert.strictEqual(result.value, h.saved);
  }
  {
    const h = fixture({ emptyChildren: true, noLease: true }); const result = await h.run();
    assert.equal(h.state.reads.length, 3); assert.equal(h.state.sync[0].targets.length, 1);
    assert.equal(h.state.sync[0].leaseToken, null); assert.equal(h.state.completed.length, 0); assert.equal(result.lease, null);
  }
  ok("Create identities and media-empty existing projects retain all post-save reads, root synchronization and null-lease behavior");
  return passed;
}
