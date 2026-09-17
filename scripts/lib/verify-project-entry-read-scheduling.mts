import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

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
