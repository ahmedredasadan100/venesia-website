import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Actual Actions and cache/result owners; isolated Auth, Next, Media and RPC
// transport ports. Tracking/Locations execute existing SQL in disposable PGlite.
// This does not claim browser, authenticated HTTP, live DB or Storage proof.
const root = process.cwd();
const baseline = process.argv.includes("--baseline") ? "25764d20bf8df0424162afadb8d6f9eb604b0dc3" : null;
const read = (file) => baseline && file.startsWith("src/")
  ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" })
  : readFileSync(path.join(root, file), "utf8");
let checks = 0;
const check = (label, actual, expected = true) => {
  assert.deepEqual(actual, expected, label);
  checks += 1;
  console.log(`PASS ${label}`);
};
function loader(ports) {
  const modules = new Map();
  function load(file) {
    const absolute = path.resolve(root, file);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const loadedModule = { exports: {} };
    modules.set(absolute, loadedModule);
    const native = createRequire(absolute);
    const require = (name) => {
      if (name === "server-only") return {};
      const override = Object.entries(ports).find(([suffix]) => name.endsWith(suffix));
      if (override) return override[1];
      if (!name.startsWith(".")) return native(name);
      const candidate = path.resolve(path.dirname(absolute), name);
      return load(/\.tsx?$/.test(candidate) ? candidate : `${candidate}.ts`);
    };
    const output = ts.transpileModule(read(relative), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function("require", "module", "exports", output)(require, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}
function portsFor(rpc, from) {
  const state = { attempts: 0, failures: 0, rpcCalls: 0, mediaWarning: false, committedLeaseFailures: [], uncertaintyCalls: 0 };
  const cache = () => { state.attempts++; if (state.failures-- > 0) throw new Error("injected cache outage"); };
  const synchronization = () => ({ status: state.mediaWarning ? "saved_with_media_sync_warning" : "synced", failureReason: state.mediaWarning ? "injected media warning" : null });
  const ports = {
    "next/cache": { revalidatePath: cache, revalidateTag() {}, updateTag() {} },
    "/auth/require-admin-session": { requireAdminSession: async () => ({ id: 1 }) },
    "/audit-log": { recordCmsAdminAudit: async () => {} },
    "/supabase-admin": { getSupabaseAdmin: () => ({ rpc: async (name, args) => { state.rpcCalls++; return rpc(name, args); }, from }) },
    "/tracking-media-coordination": {
      coordinateTrackingUpdateSave: async ({ mutate }) => ({ value: await mutate(), mediaSynchronization: synchronization() }),
      cleanupDeletedTrackingUpdateMedia: async () => synchronization(),
    },
    "/project-entry-media-coordination": { coordinateProjectEntrySave: async ({ mutate }) => ({ value: await mutate(), mediaSynchronization: synchronization() }) },
    "/synchronization": { synchronizeMediaReferenceWriteScopesAfterDomainMutation: async () => synchronization(), markMediaCatalogRuntimeUncertain: async () => { state.uncertaintyCalls++; } },
    "/write-lease": { acquireMediaReferenceWriteLease: async () => ({ token: "isolated-lease" }), failMediaReferenceWriteLease: async (input) => { state.committedLeaseFailures.push(input.domainWriteCommitted); }, completeMediaReferenceWriteLease: async () => {} },
  };
  return { state, ports };
}
function queryPort(db) {
  return (table) => {
    assert.match(table, /^[a-z_]+$/);
    const filters = [];
    let order = "";
    let selection = "*";
    const result = async (single) => {
      const where = filters.map(([key], index) => `${key}=$${index + 1}`).join(" and ");
      const rows = await db.query(`select ${selection} from public.${table}${where ? ` where ${where}` : ""}${order}`, filters.map(([, value]) => value));
      return { data: single ? rows.rows[0] ?? null : rows.rows, error: null };
    };
    const builder = { select(value) { assert.match(value, /^[a-z_,]+$/); selection = value; return builder; }, eq(key, value) { assert.match(key, /^[a-z_]+$/); filters.push([key, value]); return builder; }, order(key) { assert.match(key, /^[a-z_]+$/); order = ` order by ${key}`; return builder; }, maybeSingle() { return result(true); }, then(resolve, reject) { return result(false).then(resolve, reject); } };
    return builder;
  };
}
const form = (values) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, String(value)); return data; };
const initial = (mode = "create") => ({ status: "idle", mode, revision: 0 });
const fixtureSql = (file) => {
  const match = readFileSync(path.join(root, file), "utf8").match(/await db\.exec\(`([\s\S]*?)`\);/);
  assert.ok(match, `existing isolated fixture ${file}`);
  return match[1];
};
const tracking = new PGlite({ extensions: { pgcrypto } });
const locations = new PGlite({ extensions: { pgcrypto } });
try {
  await tracking.exec(fixtureSql("scripts/verify-project-tracking-detail-postgres.mts"));
  await tracking.exec(read("sql/migrations/20260817170332_project_construction_tracking_detail.sql"));
  const rpcNames = {
    save_project_tracking_profile: ["p_project_id", "p_actor_id", "p_payload"],
    mutate_project_tracking_stage: ["p_project_id", "p_actor_id", "p_action", "p_stage_id", "p_payload"],
    mutate_project_tracking_item: ["p_project_id", "p_stage_id", "p_actor_id", "p_action", "p_item_id", "p_payload"],
    mutate_project_tracking_update: ["p_project_id", "p_item_id", "p_actor_id", "p_action", "p_update_id", "p_payload"],
    reorder_project_tracking_stages: ["p_project_id", "p_actor_id", "p_stage_ids"],
    reorder_project_tracking_items: ["p_project_id", "p_stage_id", "p_actor_id", "p_item_ids"],
  };
  const setup = portsFor(async (name, args) => {
    assert.ok(rpcNames[name], `known RPC ${name}`);
    try { const response = await tracking.query(`select public.${name}(${rpcNames[name].map((_, i) => `$${i + 1}`).join(",")}) as result`, rpcNames[name].map((key) => args[key])); return { data: response.rows[0].result, error: null }; }
    catch (error) { return { data: null, error }; }
  }, queryPort(tracking));
  const trackingLoad = loader(setup.ports);
  const actions = trackingLoad("src/app/admin/projects/tracking-actions.ts");
  const stageInput = { project_id: 1, name: "proof stage", description: "", start_date: "", planned_duration_value: "", planned_duration_unit: "", is_visible: "on" };
  setup.state.failures = 2;
  const stage = await actions.createTrackingStageAction(initial(), form(stageInput));
  check("Tracking create reports committed cache warning", stage.status, "warning");
  check("Tracking cache retry never repeats create RPC", [setup.state.rpcCalls, setup.state.attempts], [1, 2]);
  check("Tracking create preserves saved handoff identity", stage.editHref, `/admin/projects/1/tracking/stages/${stage.entityId}`);
  check("Tracking SQL holds exactly one created stage", (await tracking.query("select count(*)::int as n from project_tracking_stages")).rows[0].n, 1);
  const cases = [
    ["profile", () => actions.saveTrackingProfileAction(initial("edit"), form({ project_id: 1, project_receipt_date: "2026-05-01", license_receipt_date: "", contractor_name: "proof contractor" }))],
    ["stage edit", () => actions.updateTrackingStageAction(initial("edit"), form({ ...stageInput, stage_id: stage.entityId, name: "saved edit" }))],
    ["stage visibility", () => actions.setTrackingStageVisibilityAction(1, stage.entityId, false, "proof stage")],
    ["stage reorder", () => actions.reorderTrackingStagesAction(1, [stage.entityId])],
  ];
  for (const [name, operation] of cases) { setup.state.failures = 2; const result = await operation(); check(`Tracking ${name} retains committed warning (${result.message})`, result.status ?? result.feedbackStatus, "warning"); }
  const itemInput = { project_id: 1, stage_id: stage.entityId, name: "proof item", description: "", status: "in_progress", start_date: "", completion_date: "", is_visible: "on" };
  setup.state.failures = 2;
  const item = await actions.createTrackingItemAction(initial(), form(itemInput));
  check("Tracking item create preserves warning and identity", [item.status, item.result.id], ["warning", item.entityId]);
  for (const [name, operation] of [
    ["item edit", () => actions.updateTrackingItemAction(initial("edit"), form({ ...itemInput, item_id: item.entityId, name: "saved item" }))],
    ["item visibility", () => actions.setTrackingItemVisibilityAction(1, stage.entityId, item.entityId, false, "proof item")],
    ["item reorder", () => actions.reorderTrackingItemsAction(1, stage.entityId, [item.entityId])],
  ]) { setup.state.failures = 2; const result = await operation(); check(`Tracking ${name} retains committed warning`, result.status ?? result.feedbackStatus, "warning"); }
  const updateInput = { project_id: 1, item_id: item.entityId, occurred_on: "2026-06-01", title: "proof update", body: "saved body", publication_status: "draft", image_urls: "", videos_json: "[]" };
  setup.state.failures = 2;
  const update = await actions.createTrackingUpdateAction(initial(), form(updateInput));
  check("Tracking update create preserves warning and identity", [update.status, update.result.id], ["warning", update.entityId]);
  for (const [name, operation] of [
    ["update edit", () => actions.updateTrackingUpdateAction(initial("edit"), form({ ...updateInput, update_id: update.entityId, body: "saved update edit" }))],
    ["update publication", () => actions.setTrackingUpdatePublicationVisibilityAction(1, item.entityId, update.entityId, true, "proof update")],
  ]) { setup.state.failures = 2; const result = await operation(); check(`Tracking ${name} retains committed warning`, result.status ?? result.feedbackStatus, "warning"); }
  const rejected = await actions.deleteTrackingStageAction(1, stage.entityId, "proof stage");
  check("Tracking precommit child protection remains an error", rejected.ok, false);
  check("Tracking failed delete preserves root", (await tracking.query("select count(*)::int as n from project_tracking_stages")).rows[0].n, 1);
  setup.state.mediaWarning = true;
  setup.state.failures = 2;
  const deletedUpdate = await actions.deleteTrackingUpdateAction(1, item.entityId, update.entityId, "proof update");
  check("Tracking media and cache warnings both remain visible", deletedUpdate.code === "saved_with_media_sync_warning" && deletedUpdate.message.includes("تحديث العرض"));
  setup.state.mediaWarning = false;
  for (const [name, operation] of [
    ["item delete", () => actions.deleteTrackingItemAction(1, stage.entityId, item.entityId, "proof item")],
    ["stage delete retry", () => actions.deleteTrackingStageAction(1, stage.entityId, "proof stage")],
  ]) { setup.state.failures = 2; const result = await operation(); check(`Tracking ${name} returns committed warning`, result.feedbackStatus, "warning"); }
  check("Tracking durable child cleanup reaches zero", (await tracking.query("select (select count(*) from project_tracking_stages)+(select count(*) from project_tracking_items)+(select count(*) from project_tracking_updates) as n")).rows[0].n, 0);
  setup.state.failures = 1;
  check("Transient cache retry recovers without warning", (await actions.createTrackingStageAction(initial(), form(stageInput))).status, "success");
  const beforeInvalid = setup.state.rpcCalls;
  check("Tracking validation rejects invalid input before mutation", (await actions.createTrackingStageAction(initial(), form({ ...stageInput, name: "" }))).status, "error");
  check("Tracking invalid input sends no RPC", setup.state.rpcCalls, beforeInvalid);

  for (const invalid of [null, { id: "bad" }, { id: Number.NaN }, { id: 0 }, { id: true }, { id: "92" }, { id: [92] }]) {
    const malformed = portsFor(async () => ({ data: invalid && { ...invalid, project_id: invalid.id }, error: null }), queryPort(tracking));
    const malformedActions = loader(malformed.ports)("src/app/admin/projects/tracking-actions.ts");
    for (const [label, operation] of [
      ["profile", () => malformedActions.saveTrackingProfileAction(initial("edit"), form({ project_id: 1, project_receipt_date: "", license_receipt_date: "", contractor_name: "" }))],
      ["stage", () => malformedActions.createTrackingStageAction(initial(), form(stageInput))],
      ["item", () => malformedActions.createTrackingItemAction(initial(), form(itemInput))],
      ["update", () => malformedActions.createTrackingUpdateAction(initial(), form(updateInput))],
    ]) {
      const result = await operation();
      check(`Malformed ${label} response requires reconciliation without invented identity (${String(invalid?.id)})`, [result.status, result.code, result.entityId, result.result, result.editHref], ["warning", "saved_requires_reconciliation_reload", undefined, undefined, undefined]);
    }
  }
  const wrongIdentity = portsFor(async () => ({ data: { id: 999, project_id: 999, media: [] }, error: null }), queryPort(tracking));
  const wrongActions = loader(wrongIdentity.ports)("src/app/admin/projects/tracking-actions.ts");
  for (const [label, operation] of [
    ["profile", () => wrongActions.saveTrackingProfileAction(initial("edit"), form({ project_id: 1, project_receipt_date: "", license_receipt_date: "", contractor_name: "" }))],
    ["stage", () => wrongActions.updateTrackingStageAction(initial("edit"), form({ ...stageInput, stage_id: 1 }))],
    ["item", () => wrongActions.updateTrackingItemAction(initial("edit"), form({ ...itemInput, item_id: 1 }))],
    ["update", () => wrongActions.updateTrackingUpdateAction(initial("edit"), form({ ...updateInput, update_id: 1 }))],
  ]) { const result = await operation(); check(`Wrong ${label} response identity is not adopted`, [result.status, result.entityId, result.result], ["warning", undefined, undefined]); }
  const invalidMedia = portsFor(async () => ({ data: { id: 92, media: [{}] }, error: null }), queryPort(tracking));
  const invalidMediaLoad = loader(invalidMedia.ports);
  const invalidMediaAction = invalidMediaLoad("src/app/admin/projects/tracking-actions.ts");
  check("Malformed saved media requires reconciliation", (await invalidMediaAction.createTrackingUpdateAction(initial(), form(updateInput))).code, "saved_requires_reconciliation_reload");
  const mediaOwner = invalidMediaLoad("src/lib/admin/media-catalog/domain-write-coordination.ts");
  await assert.rejects(() => mediaOwner.coordinateMediaReferenceDomainMutation({ scopes: [], requestIdentity: "isolated-output-proof", mutate: async () => { throw new mediaOwner.MediaDomainMutationError("tracking_update_committed_result_invalid", true); }, synchronize: async () => { throw new Error("must not synchronize untrusted identity"); } }));
  check("Existing Media owner retains committed-failure lease state", invalidMedia.state.committedLeaseFailures, [true]);
  check("Existing Media owner marks uncertain output for reconciliation", invalidMedia.state.uncertaintyCalls > 0);

  await locations.exec(fixtureSql("scripts/verify-project-location-management.mts"));
  await locations.exec(read("sql/migrations/20260814020750_location_management_foundation.sql"));
  const locationSetup = portsFor(async (_name, args) => {
    try { const response = await locations.query("select row_to_json(r) as result from public.mutate_project_location($1,$2,$3) r", [args.p_action, args.p_location_id ?? null, args.p_payload]); return { data: response.rows[0].result, error: null }; }
    catch (error) { return { data: null, error }; }
  }, queryPort(locations));
  let readFailure = false;
  const locationContract = loader({})("src/lib/admin/projects/location-management-contract.ts");
  locationSetup.ports["/location-management-adapter"] = { loadProjectLocationManagementRow: async (id, level) => {
    if (readFailure) throw new Error("injected readback outage");
    const row = (await locations.query("select * from project_locations where id=$1 and level=$2", [id, level])).rows[0];
    if (!row) return null;
    return { ...row, delete_eligibility: locationContract.resolveProjectLocationDeleteEligibility({ childCount: 0, projectCount: 0 }), visibility_eligibility: locationContract.resolveProjectLocationVisibilityEligibility({ activeChildCount: 0, projectCount: 0 }) };
  } };
  const locationActions = loader(locationSetup.ports)("src/app/admin/projects/locations/actions.ts");
  const locationInput = { level: "governorate", name_ar: "proof governorate", name_en: "", sort_order: 0, is_active: "on" };
  locationSetup.state.failures = 2;
  const location = await locationActions.createProjectLocationAction(initial(), form(locationInput));
  check("Location create preserves canonical row with cache warning", [location.status, location.result.id], ["warning", location.entityId]);
  check("Location cache retry sends one RPC", locationSetup.state.rpcCalls, 1);
  readFailure = true;
  const readback = await locationActions.createProjectLocationAction(initial(), form({ ...locationInput, name_ar: "readback failure" }));
  check("Location committed read failure is warning with identity and no invented row", [readback.status, readback.result, Number.isSafeInteger(readback.entityId)], ["warning", undefined, true]);
  const active = await locationActions.setProjectLocationActiveAction(readback.entityId, "governorate", true);
  check("Location committed visibility read failure cannot roll back", [active.ok, active.feedbackStatus], [true, "warning"]);
  readFailure = false;
  const conflict = await locationActions.createProjectLocationAction(initial(), form(locationInput));
  check("Location duplicate name remains rejected before commit", [conflict.status, conflict.focusTarget], ["error", "name_ar"]);
  locationSetup.state.failures = 2;
  const edited = await locationActions.updateProjectLocationAction(initial("edit"), form({ ...locationInput, id: location.entityId, name_ar: "edited governorate" }));
  check("Location edit warning returns database readback", [edited.status, edited.result.name_ar], ["warning", "edited governorate"]);
  locationSetup.state.failures = 2;
  const deleted = await locationActions.deleteProjectLocationAction(location.entityId, "governorate");
  check("Location delete cache failure remains committed", [deleted.ok, deleted.feedbackStatus], [true, "warning"]);
  check("Location delete did remove its row", (await locations.query("select count(*)::int as n from project_locations where id=$1", [location.entityId])).rows[0].n, 0);
  for (const raw of [null, { id: "bad", level: "governorate" }, { id: 77, level: "city" }, ...[true, "92", [92]].map(id => ({ id, level: "governorate" }))]) {
    const malformed = portsFor(async () => ({ data: raw, error: null }), queryPort(locations));
    const result = await loader(malformed.ports)("src/app/admin/projects/locations/actions.ts").createProjectLocationAction(initial(), form(locationInput));
    check("Location invalid returned identity/level cannot authorize retry or guessed row", [result.status, result.entityId, result.result], ["warning", undefined, undefined]);
  }

  // Project aggregate persistence already has independent SQL proofs. Here the
  // actual Project Actions are tested at their existing committed-result ports.
  let projectCalls = 0;
  const projectRow = { project_id: 91, project_type: "residential", project_slug: "proof-project", slug: "proof-project", featured: false, created_at: "2026-09-13", updated_at: "2026-09-13" };
  const projectSource = { type: "residential", slug: "proof-project", arabic_name: "proof", general_description: "", overview_body: "", hero_image: "", hero_image_alt: "", og_image: "", og_image_alt: "", seo_title: "", seo_description: "", seo_keywords: [], focus_keyword: "", updated_at: "2026-09-13", publication_status: "unpublished", published_at: null, published_by: null, featured: false };
  const projectTables = {
    projects: [{ ...projectSource, id: 1 }, { ...projectSource, id: 2, slug: "proof-project-copy" }, { ...projectSource, id: 91 }],
    project_floor_plans: [], project_media: [], project_videos: [],
  };
  const projectFrom = (table) => {
    assert.ok(Object.hasOwn(projectTables, table), `Unexpected Project table: ${table}`);
    const predicates = [];
    let columns = [];
    const result = (single) => {
      const rows = projectTables[table].filter(row => predicates.every(predicate => predicate(row)))
        .map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
      if (single) assert.ok(rows.length <= 1, "Project maybeSingle must have at most one matching row");
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    const builder = {
      select(value) { assert.match(value, /^[a-z_, ]+$/); columns = value.split(",").map(column => column.trim()); return builder; },
      eq(key, value) { predicates.push(row => row[key] === value); return builder; },
      in(key, values) { assert.ok(Array.isArray(values)); const members = new Set(values); predicates.push(row => members.has(row[key])); return builder; },
      maybeSingle: async () => result(true),
      then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
    };
    return builder;
  };
  check("Project candidate query filters and projects occupied slugs", (await projectFrom("projects").select("slug").in("slug", ["proof-project-copy", "proof-project-copy-2"])).data, [{ slug: "proof-project-copy" }]);
  check("Project empty candidate list returns no rows", (await projectFrom("projects").select("slug").in("slug", [])).data, []);
  check("Project equality and candidate filters intersect", (await projectFrom("projects").select("slug").eq("id", 1).in("slug", ["proof-project-copy"])).data, []);
  const projectSetup = portsFor(async (name, args) => {
    projectCalls++;
    if (!baseline && name === "duplicate_project_admin_entry") check("Project duplicate skips the occupied candidate before its RPC", args.p_seo_proof.expected_result.slug, "proof-project-copy-2");
    return { data: [projectRow], error: null };
  }, projectFrom);
  const payload = { project: { id: null, type: "residential", slug: "proof-project", arabic_name: "proof", publication_status: "unpublished", seo_title: "", seo_description: "" } };
  projectSetup.ports["/project-entry-contract"] = { projectEntryPayloadFromFormData: () => payload, assessProjectEntryPayload: () => ({ fieldErrors: {}, checks: [] }), projectEntryFirstErrorTarget: () => null };
  projectSetup.ports["/project-entry-data"] = { loadProjectEntry: async () => ({ ...payload, project: { ...payload.project, id: 91 } }) };
  projectSetup.ports["/project-publishing-capability"] = { getProjectPublishingReadiness: () => ({ ready: true }), isProjectPublicationStatus: () => true, resolveProjectPublicationAuditOperation: () => "create" };
  const projectLoad = loader(projectSetup.ports);
  for (const [name, operation] of [
    ["create", () => projectLoad("src/app/admin/projects/project-actions/save-entry.ts").saveProjectEntry(initial(), form({}))],
    ["duplicate", () => projectLoad("src/app/admin/projects/project-actions/duplicate.ts").duplicateProjectAjax(1)],
    ["delete", () => projectLoad("src/app/admin/projects/project-actions/delete.ts").deleteProjectAjax(1, true)],
  ]) { projectSetup.state.failures = 2; const before = projectCalls; const result = await operation(); check(`Project ${name} preserves committed warning`, result.status ?? result.feedbackStatus, "warning"); check(`Project ${name} cache retry never repeats mutation`, projectCalls - before, 1); }
  for (const raw of [null, [], [{ project_id: true }], [{ project_id: "91" }], [{ project_id: Number.NaN }]]) {
    const malformed = { ...projectSetup.ports, "/supabase-admin": { getSupabaseAdmin: () => ({ rpc: async () => ({ data: raw, error: null }) }) } };
    const projectActions = loader(malformed)("src/app/admin/projects/project-actions/save-entry.ts");
    const result = await projectActions.saveProjectEntry(initial(), form({}));
    check("Project create invalid result preserves committed warning without guessed identity", [result.status, result.code, result.entityId, result.editHref], ["warning", "saved_requires_reconciliation_reload", undefined, undefined]);
  }
  for (const raw of [null, [], [{ project_id: "bad" }], ...[true, "92", [92]].map(project_id => [{ ...projectRow, project_id }])]) {
    const malformed = { ...projectSetup.ports, "/supabase-admin": { getSupabaseAdmin: () => ({ from: projectFrom, rpc: async () => ({ data: raw, error: null }) }) } };
    const result = await loader(malformed)("src/app/admin/projects/project-actions/duplicate.ts").duplicateProjectAjax(1);
    check("Project duplicate invalid result is warning without invented identity", [result.ok, result.feedbackStatus, result.projectId], [true, "warning", undefined]);
  }
  payload.project.id = 91;
  const wrongProject = { ...projectSetup.ports, "/supabase-admin": { getSupabaseAdmin: () => ({ ...projectSetup.ports["/supabase-admin"].getSupabaseAdmin(), rpc: async () => ({ data: [{ ...projectRow, project_id: 999 }], error: null }) }) } };
  const wrongProjectResult = await loader(wrongProject)("src/app/admin/projects/project-actions/save-entry.ts").saveProjectEntry(initial("edit"), form({ id: 91 }));
  check("Project edit cannot adopt another returned Project identity", [wrongProjectResult.status, wrongProjectResult.entityId, wrongProjectResult.result], ["warning", undefined, undefined]);
  payload.project.id = null;

  const consumer = read("src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx");
  check("Location visibility and deletion adapters preserve warning feedback", (consumer.match(/result\.feedbackStatus === "warning" \? adminActionWarning : adminActionSuccess/g) ?? []).length, 2);
  const modal = read("src/app/admin/projects/locations/ProjectLocationFormModal.tsx");
  check("Location saved-without-readback still closes and invalidates through existing callback", modal.includes("onSaved(state.result);") && !modal.includes("if (!state.result) return;"));
} finally {
  await Promise.all([tracking.close(), locations.close()]);
}
console.log(`Remaining Project proof passed (${checks} checks; disposable SQL + actual Action ports; no live services).`);
