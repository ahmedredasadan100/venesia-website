import assert from "node:assert/strict";

export const PROJECT_CONTROL_KINDS = Object.freeze(["residential", "commercial"]);
export const PROJECT_CONTROL_PHASES = Object.freeze(["baseline", "draft", "negative", "serverRejected", "saved", "reloaded", "emptyDraft", "emptySaved", "emptyReloaded"]);
export const PROJECT_CONTROL_TABLES = Object.freeze(["project_location_points", "project_features", "project_floor_plans", "project_floor_plan_details", "project_delivery_items", "project_media", "project_videos"]);
export const PROJECT_CONTROL_ASSETS = Object.freeze(["images/projects/c35/hero.jpg", "images/projects/c35/cover.jpg", "images/projects/c35/location-map.jpg"]);
export const PROJECT_CONTROL_VALUES = Object.freeze({
  transport: ["وسيلة أولى للفحص", "وسيلة ثانية للفحص"], road: "محور محفوظ بعد التحرير", distance: "12 دقيقة",
  features: ["ميزة محفوظة أولى", "ميزة محفوظة ثانية", "ميزة جديدة محفوظة"], delivery: ["بند محرر أول", "بند محرر ثان", "بند جديد محفوظ"],
  plan: "مخطط محفوظ محرر", copy: "نسخة مخطط محفوظة", area: "170", copyArea: "175",
  details: [{ label: "غرف محررة", value: "3" }, { label: "حمامات محررة", value: "2" }, { label: "شرفات جديدة", value: "1" }],
  galleryAlts: ["صورة أولى محررة", "صورة ثانية محررة", "صورة جديدة محفوظة"],
  videos: ["https://example.invalid/project-control-first", "https://example.invalid/project-control-second"], posterAlt: "غلاف فيديو المشروع",
});
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
export function projectControlSlug(kind) { assert.ok(PROJECT_CONTROL_KINDS.includes(kind)); return kind === "residential" ? "qa-admin-complete-project" : "qa-admin-complete-commercial-project"; }
export function buildCoreProjectControlsPlan({ manifest, fixtures }) {
  const owners = manifest.filter(row => row.id === "projects-create-edit"); assert.equal(owners.length, 1); assert.equal(owners[0].classification, "shared_adopter");
  assert.ok(Array.isArray(fixtures.projects)); assert.equal(fixtures.projects.length, PROJECT_CONTROL_KINDS.length);
  const recipes = PROJECT_CONTROL_KINDS.map(kind => {
    const rows = fixtures.projects.filter(row => row.kind === kind); assert.equal(rows.length, 1); const row = rows[0];
    assert.ok(Number.isSafeInteger(row.id) && row.id > 0); assert.equal(row.slug, projectControlSlug(kind)); assert.equal(row.editPath, "/admin/projects/" + row.id);
    const surface = kind + ":edit"; assert.ok(owners[0].surfaces.includes(surface)); return { ...row, consumer: owners[0].id, surface, coverage: [] };
  });
  assert.equal(new Set(recipes.map(row => row.id)).size, recipes.length);
  assert.deepEqual(fixtures.assets.map(row => row.objectKey), PROJECT_CONTROL_ASSETS);
  fixtures.assets.forEach(row => assert.equal(row.publicUrl, "/" + row.objectKey));
  return { recipes, automaticAxisCoverage: [], globalClosed: false, boundary: "Concrete optional Project aggregate controls only; no automatic Form-axis promotion." };
}
export function validateProjectControlsRequest(input) {
  assert.ok(input && typeof input === "object" && !Array.isArray(input)); assert.deepEqual(Object.keys(input).sort(), ["id", "kind", "phase", "recipe"]);
  assert.match(input.id, uuid); assert.equal(input.kind, "project-controls-state"); assert.ok(PROJECT_CONTROL_KINDS.includes(input.recipe)); assert.ok(PROJECT_CONTROL_PHASES.includes(input.phase)); return input;
}
const sorted = rows => [...rows].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
const pick = (row, fields) => Object.fromEntries(fields.map(field => [field, row[field] ?? null]));
export function projectGraphProjection(graph) {
  const p = graph.project, take = (name, fields) => sorted(graph[name]).map(row => pick(row, fields));
  return {
    location_points: ["transport", "road", "landmark"].flatMap(kind => sorted(graph.project_location_points.filter(row => row.kind === kind)).map(row => pick(row, ["kind", "label", "distance_text"]))),
    features: take("project_features", ["body"]), delivery_items: take("project_delivery_items", ["body"]),
    floor_plans: sorted(graph.project_floor_plans).map(row => ({ ...pick(row, ["name", "area_text", "featured", "architectural_image", "architectural_image_alt", "furnishing_image", "furnishing_image_alt"]), details: sorted(graph.project_floor_plan_details.filter(detail => Number(detail.floor_plan_id) === Number(row.id))).map(detail => pick(detail, ["label", "value"])) })),
    media: ["overview", "delivery", "gallery"].flatMap(section => sorted(graph.project_media.filter(row => row.section === section)).map(row => pick(row, ["section", "image", "alt_text"]))),
    videos: ["overview", "gallery"].flatMap(section => sorted(graph.project_videos.filter(row => row.section === section)).map(row => ({ ...pick(row, ["section", "video_url", "poster_alt"]), poster_image: row.poster_image ?? "" }))),
    identity: { id: Number(p.id), type: p.type, slug: p.slug, publication_status: p.publication_status },
  };
}
export function expectedProjectControlsProjection(original, fixtures, empty = false) {
  const v = PROJECT_CONTROL_VALUES, first = sorted(original.project_floor_plans)[0], image = fixtures.assets[0].publicUrl;
  const identity = projectGraphProjection(original).identity;
  if (empty) return { location_points: [], features: [], delivery_items: [], floor_plans: [], media: [], videos: [], identity };
  const fields = pick(first, ["architectural_image", "architectural_image_alt", "furnishing_image", "furnishing_image_alt"]);
  const details = [v.details[1], v.details[2]];
  return {
    location_points: [{ kind: "transport", label: v.transport[1], distance_text: v.distance }, { kind: "transport", label: v.transport[0], distance_text: v.distance }, { kind: "road", label: v.road, distance_text: v.distance }],
    features: [{ body: v.features[1] }, { body: v.features[0] }, { body: v.features[2] }], delivery_items: [{ body: v.delivery[1] }, { body: v.delivery[2] }],
    floor_plans: [{ ...fields, name: v.copy, area_text: v.copyArea, featured: true, details }, { ...fields, name: v.plan, area_text: v.area, featured: false, details }],
    media: [{ section: "gallery", image, alt_text: v.galleryAlts[1] }, { section: "gallery", image: fixtures.assets[1].publicUrl, alt_text: v.galleryAlts[0] }, { section: "gallery", image: fixtures.assets[2].publicUrl, alt_text: v.galleryAlts[2] }],
    videos: [{ section: "gallery", video_url: v.videos[1], poster_image: fixtures.assets[2].publicUrl, poster_alt: v.posterAlt }, { section: "gallery", video_url: v.videos[0], poster_image: "", poster_alt: "" }], identity,
  };
}
export function assertProjectControlGraph(graph, original, fixtures, empty = false) {
  assert.deepEqual(projectGraphProjection(graph), expectedProjectControlsProjection(original, fixtures, empty));
  const mutableRoot = new Set(["updated_at", "seo_score", "seo_score_version", "seo_score_input_hash"]);
  const invariant = row => Object.fromEntries(Object.entries(row).filter(([key]) => !mutableRoot.has(key)));
  assert.deepEqual(invariant(graph.project), invariant(original.project), "Optional child edits preserve every original root field, including publication/history/images/location.");
  assert.equal(graph.project.publication_status, "unpublished");
  for (const table of PROJECT_CONTROL_TABLES) {
    const rows = graph[table], old = original[table];
    assert.equal(new Set(rows.map(row => Number(row.id))).size, rows.length);
    assert.equal(new Set(rows.map(row => row.client_key)).size, rows.length);
    for (const row of rows) {
      assert.ok(Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0); assert.match(row.client_key, uuid);
      const previous = old.find(item => item.client_key === row.client_key);
      if (previous) { assert.equal(Number(row.id), Number(previous.id)); assert.equal(row.created_at, previous.created_at); }
      else assert.ok(!old.some(item => Number(item.id) === Number(row.id)), "New client identity must not steal an old physical ID.");
      if (table === "project_floor_plan_details") assert.ok(graph.project_floor_plans.some(plan => Number(plan.id) === Number(row.floor_plan_id)), "No orphan or foreign detail.");
      else assert.equal(Number(row.project_id), Number(original.project.id));
    }
    const partitions = table === "project_location_points" ? ["kind"] : ["project_media", "project_videos"].includes(table) ? ["section"] : table === "project_floor_plan_details" ? ["floor_plan_id"] : [];
    const groups = new Map(); for (const row of rows) { const key = JSON.stringify(partitions.map(name => row[name])); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); }
    for (const group of groups.values()) assert.deepEqual(sorted(group).map(row => Number(row.sort_order)), Array.from({ length: group.length }, (_, i) => i));
  }
  if (!empty) {
    const plan = sorted(original.project_floor_plans)[0], detail = sorted(original.project_floor_plan_details.filter(row => Number(row.floor_plan_id) === Number(plan.id)))[1];
    for (const [table, indexes, expectedIndexes] of [["project_location_points", [0], [2]], ["project_features", [1, 0], [0, 1]], ["project_delivery_items", [1], [0]], ["project_floor_plans", [0], [1]], ["project_media", [1, 0], [0, 1]]]) {
      const before = sorted(original[table]), after = table === "project_location_points" ? graph[table].filter(row => row.kind === "road") : sorted(graph[table]);
      indexes.forEach((index, i) => assert.equal(after[table === "project_location_points" ? 0 : expectedIndexes[i]].client_key, before[index].client_key, "Retained row survives reorder: " + table));
    }
    assert.ok(graph.project_floor_plan_details.some(row => row.client_key === detail.client_key && Number(row.floor_plan_id) === Number(plan.id)));
    const oldKeys = new Set(original.project_floor_plan_details.map(row => row.client_key));
    assert.equal(graph.project_floor_plan_details.filter(row => oldKeys.has(row.client_key)).length, 1, "Copied plan children require fresh identities.");
  }
}

export function projectPayloadGraph(payload) {
 const ordered=(rows,partition)=>rows.map((row,index)=>({...row,sort_order:partition?rows.slice(0,index).filter(previous=>previous[partition]===row[partition]).length:index}));
 const plans=ordered(payload.floor_plans).map((row,index)=>({...row,id:row.id??-index-1}));
 return {project:payload.project,project_location_points:ordered(payload.location_points,"kind"),project_features:ordered(payload.features),project_delivery_items:ordered(payload.delivery_items),project_floor_plans:plans,
 project_floor_plan_details:payload.floor_plans.flatMap((row,index)=>ordered(row.details).map(detail=>({...detail,floor_plan_id:plans[index].id}))),project_media:ordered(payload.media,"section"),project_videos:ordered(payload.videos,"section")};
}
