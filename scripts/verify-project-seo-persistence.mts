import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";
// @ts-expect-error This workspace uses pg without separate declarations.
import { Client } from "pg";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const sourcePath = "src/app/admin/projects/project-actions/duplicate.ts";
const helperPath = "src/lib/admin/projects/project-duplicate-seo.ts";
const ports = new Map<string, unknown>();

function load(path: string, cache = new Map<string, { exports: Record<string, unknown> }>()) {
  const file = resolve(ROOT, path);
  if (ports.has(file)) return ports.get(file) as Record<string, unknown>;
  const prior = cache.get(file);
  if (prior) return prior.exports;
  const loadedModule = { exports: {} as Record<string, unknown> };
  cache.set(file, loadedModule);
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", output)((specifier: string) => {
    if (specifier === "server-only") return {};
    if (!specifier.startsWith(".")) return require(specifier);
    const base = resolve(dirname(file), specifier);
    const target = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")]
      .find((candidate) => ports.has(candidate) || existsSync(candidate));
    assert.ok(target, `Unresolved dependency ${specifier}`);
    return load(target, cache);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const snapshot = Object.freeze({
  arabic_name: "مشروع فينيسيا", slug: "venisia", updated_at: "2026-09-14T10:00:00.000Z",
  general_description: "وصف المشروع", overview_body: "<p>فينيسيا محتوى المشروع</p>",
  hero_image: "/project.webp", hero_image_alt: "فينيسيا", og_image: null, og_image_alt: null,
  seo_title: "", seo_description: "", seo_keywords: ["مباني"], focus_keyword: "فينيسيا",
});

const helper = load(helperPath) as {
  projectDuplicateSlug(slug: string, number: number): string;
  buildProjectDuplicateSeoProof(source: typeof snapshot, number: number): {
    expected_source: Record<string, unknown>; expected_result: Record<string, unknown>;
    expected_updated_at: string; score: { seo_score_input_hash: string };
  };
};
const original = JSON.stringify(snapshot);
const scoreContract = load("src/lib/admin/seo/entity-seo-persistence.ts") as {
  PROJECT_SEO_SOURCE_COLUMNS: readonly string[];
  PERSISTED_ENTITY_SEO_FIELDS: readonly string[];
};
const expectedDuplicateProjection = ["updated_at", ...scoreContract.PROJECT_SEO_SOURCE_COLUMNS].join(",");
const expectedSaveProjection = ["publication_status", "published_at", "slug", ...scoreContract.PERSISTED_ENTITY_SEO_FIELDS].join(",");
const saveSource = readFileSync(resolve(ROOT, "src/app/admin/projects/project-actions/save-entry.ts"), "utf8");
assert.ok(saveSource.includes(`.select("${expectedSaveProjection}")`), "Save projection stays aligned with the persisted tuple and generated Database inference.");
assert.doesNotMatch(saveSource, /if \(mode === "edit"\) \{\s*try \{\s*reconciledBundle/u,
  "Create and edit must both execute the post-save aggregate readback.");
assert.match(saveSource, /persistedEntitySeoScoreMatches\(\s*trustedPayload\.project,\s*reconciledBundle\?\.project/u,
  "Save success must compare the persisted score tuple with the trusted calculation.");
const first = helper.buildProjectDuplicateSeoProof(snapshot, 1);
const second = helper.buildProjectDuplicateSeoProof(snapshot, 2);
assert.equal(first.expected_result.slug, "venisia-copy");
assert.equal(first.expected_result.arabic_name, "مشروع فينيسيا — نسخة");
assert.equal(second.expected_result.slug, "venisia-copy-2");
assert.equal(second.expected_result.arabic_name, "مشروع فينيسيا — نسخة 2");
assert.equal(first.expected_source.slug, "venisia");
assert.equal(first.expected_updated_at, snapshot.updated_at);
assert.notEqual(first.score.seo_score_input_hash, second.score.seo_score_input_hash);
assert.equal(JSON.stringify(snapshot), original, "planning must not mutate source inputs");
assert.throws(() => helper.projectDuplicateSlug("venisia", 0));
assert.throws(() => helper.projectDuplicateSlug("venisia", 10_001));

ports.set(resolve(ROOT, "src/lib/admin/audit/cms-audit-actions.ts"), {
  buildCmsAuditAction: () => "project.duplicate",
});
ports.set(resolve(ROOT, "src/lib/admin/audit-log.ts"), {
  recordCmsAdminAudit: async () => undefined,
});
ports.set(resolve(ROOT, "src/lib/admin/media-catalog/reference-sync-contract.ts"), {
  buildMediaReferenceSynchronizationWarning: () => ({ status: "saved_with_media_sync_warning" }),
});
ports.set(resolve(ROOT, "src/lib/admin/media-catalog/synchronization.ts"), {
  synchronizeMediaReferenceWriteScopesAfterDomainMutation: async () => ({ status: "synchronized" }),
});
ports.set(resolve(ROOT, "src/app/admin/projects/project-actions/helpers.ts"), {
  withProjectMediaSynchronization: (result: Record<string, unknown>) => result,
});
ports.set(resolve(ROOT, "src/app/admin/projects/project-actions/revalidate.ts"), {
  revalidateProjectPaths: () => undefined,
});
ports.set(resolve(ROOT, "src/lib/cache/revalidate-public-cache-tags.ts"), {
  runBoundedPublicCacheRevalidation: async (operation: () => void) => {
    operation();
    return { ok: true };
  },
});
ports.set(resolve(ROOT, "src/lib/admin/auth/require-admin-session.ts"), {
  requireAdminSession: async () => ({ id: 1 }),
});

async function runScenario(errors: Array<string | null>, options: {
  occupied?: string[];
  readFailure?: boolean;
  committedResult?: boolean;
  scoreMismatch?: boolean;
} = {}) {
  const proofs: Array<ReturnType<typeof helper.buildProjectDuplicateSeoProof>> = [];
  let snapshotsRead = 0;
  ports.set(resolve(ROOT, "src/lib/admin/projects/project-entry-data.ts"), {
    loadProjectPostMutationReadback: async () => ({
      publication_status: "unpublished",
      published_at: null,
      published_by: null,
      featured: false,
      ...proofs.at(-1)?.score,
      ...(options.scoreMismatch ? { seo_score_input_hash: "0".repeat(64) } : {}),
    }),
  });
  const database = {
    from(table: string) {
      assert.ok(["projects", "project_floor_plans", "project_media", "project_videos"].includes(table));
      const query = {
        select(columns: string) {
          assert.ok(columns === "id" || columns === "slug" || columns === expectedDuplicateProjection,
            "Duplicate projection must preserve the exact source fields and order without select-star.");
          return query;
        }, eq() { return query; },
        async maybeSingle() {
          snapshotsRead += 1;
          return options.readFailure
            ? { data: null, error: { code: "read_failed" } }
            : { data: { ...snapshot, updated_at: `2026-09-14T10:00:0${snapshotsRead}.000Z` }, error: null };
        },
        async in(_column: string, candidates: string[]) {
          assert.equal(candidates.length, 100);
          return { data: (options.occupied ?? []).map((slug) => ({ slug })), error: null };
        },
      };
      return query;
    },
    async rpc(name: string, input: { p_project_id: number; p_seo_proof: typeof first }) {
      assert.equal(name, "duplicate_project_admin_entry");
      assert.equal(input.p_project_id, 7);
      proofs.push(input.p_seo_proof);
      const error = errors[proofs.length - 1];
      // Empty committed result exercises the action's existing warning path,
      // without running unrelated media/audit/cache services.
      return {
        data: error
          ? null
          : options.committedResult
            ? [{
                project_id: 17,
                project_type: "residential",
                project_slug: input.p_seo_proof.expected_result.slug,
                featured: false,
                created_at: "2026-09-14T10:00:10.000Z",
                updated_at: "2026-09-14T10:00:10.000Z",
              }]
            : [],
        error: error ? { code: error } : null,
      };
    },
  };
  ports.set(resolve(ROOT, "src/lib/supabase-admin.ts"), { getSupabaseAdmin: () => database });
  const action = load(sourcePath) as { duplicateProjectAjax(id: number): Promise<{ ok: boolean; code: string }> };
  const result = await action.duplicateProjectAjax(7);
  return { result, proofs, snapshotsRead };
}

const occupied = await runScenario([null], { occupied: ["venisia-copy"] });
assert.equal(occupied.proofs[0].expected_result.slug, "venisia-copy-2");
assert.equal(occupied.result.code, "project_duplicate_result_invalid");
assert.equal(occupied.proofs.length, 1, "an ambiguous committed result cannot cause a retry");
const recovered = await runScenario(["VSE01", null]);
assert.equal(recovered.proofs.length, 2);
assert.notEqual(recovered.proofs[0].expected_updated_at, recovered.proofs[1].expected_updated_at,
  "a proof conflict must reread source revision before retrying");
const exhausted = await runScenario(["VSE01", "VSE01", "VSE01"]);
assert.equal(exhausted.proofs.length, 3);
assert.equal(exhausted.result.ok, false);
const transport = await runScenario(["FETCH_ERROR"]);
assert.equal(transport.proofs.length, 1, "unknown commit state must never repeat duplication");
const readFailure = await runScenario([], { readFailure: true });
assert.equal(readFailure.proofs.length, 0, "failed source read must not mutate");
const committed = await runScenario([null], { committedResult: true });
assert.equal(committed.result.ok, true);
assert.equal(committed.result.code, undefined, "matching score readback keeps the successful result");
const mismatched = await runScenario([null], { committedResult: true, scoreMismatch: true });
assert.equal(mismatched.result.code, "project_duplicate_seo_result_invalid");
console.log("PASS Project save readback source contract; duplicate score inputs, persisted tuple readback, allocation conflicts, bounded retries, and ambiguous result safety");

if (process.argv.includes("--postgres")) {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf("--fixtureconfig");
  const databaseIndex = args.indexOf("--database");
  const editOnly = args.includes("--edit-only");
  const configPath = configIndex === -1 ? ".tmp-qa/entity-seo-persisted/fixture-config.json" : args[configIndex + 1];
  const expectedDatabase = databaseIndex === -1 ? "entity_seo_test" : args[databaseIndex + 1];
  assert.ok(configPath, "--fixtureconfig requires a local configuration path");
  assert.match(expectedDatabase ?? "", /^entity_seo_(test|validation)$/, "an explicitly authorized disposable database is required");
  const config = JSON.parse(readFileSync(resolve(ROOT, configPath), "utf8"));
  const target = new URL(config.databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "only the isolated loopback database is allowed");
  assert.equal(decodeURIComponent(target.pathname.slice(1)), expectedDatabase, "only the named disposable database is allowed");
  const db = new Client({ connectionString: config.databaseUrl });
  await db.connect();
  const scoreOwner = load("src/lib/admin/seo/entity-seo-persistence.ts") as {
    deriveEntitySeoScore(input: unknown, previous?: unknown): Record<string, unknown>;
    toProjectSeoScoreInput(input: unknown): unknown;
  };
  const derive = (row: unknown, previous?: unknown) => scoreOwner.deriveEntitySeoScore(scoreOwner.toProjectSeoScoreInput(row), previous);
  const one = async (sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0];
  const flush = async () => { await db.query("set constraints all immediate"); await db.query("set constraints all deferred"); };
  const rejectsAtomically = async (operation: () => Promise<unknown>, expected: RegExp) => {
    const before = await one("select count(*)::int as roots, (select count(*)::int from public.project_features) as children from public.projects");
    await db.query("savepoint seo_failure");
    await assert.rejects(async () => { await operation(); await flush(); }, expected);
    await db.query("rollback to savepoint seo_failure");
    await db.query("release savepoint seo_failure");
    const after = await one("select count(*)::int as roots, (select count(*)::int from public.project_features) as children from public.projects");
    assert.deepEqual(after, before, "failed score/aggregate proof cannot leave roots or children behind");
  };
  try {
    const ready = await one("select to_regprocedure('public.duplicate_project_admin_entry(bigint,jsonb)') is not null as ready");
    assert.equal(ready.ready, true, "apply the adopted migrations only after baseline measurement, before invoking this test");
    await db.query("begin");
    const locations = await one(`select governorate.id as governorate_id, city.id as city_id, area.id as main_area_id
      from public.project_locations governorate
      join public.project_locations city on city.parent_id=governorate.id and city.level='city' and city.is_active
      join public.project_locations area on area.parent_id=city.id and area.level='main_area' and area.is_active
      where governorate.level='governorate' and governorate.is_active limit 1`);
    assert.ok(locations, "baseline fixture provides an active Project location hierarchy");
    const actor = await one("select id from public.admin_users order by id limit 1");
    assert.ok(actor, "baseline fixture provides an Admin actor");
    const slug = `seo-proof-${randomUUID()}`;
    const project = {
      type: "residential", code: "SEO-PROOF", arabic_name: "مشروع فينيسيا", english_name: "SEO Proof Project", slug,
      general_description: "وصف مشروع فينيسيا", short_description: "وصف مختصر",
      image: "/images/card.jpg", image_alt: "بطاقة", hero_image: "/images/hero.jpg", hero_image_alt: "فينيسيا",
      small_box_image: "/images/small.jpg", small_box_image_alt: "مصغرة", ...locations, sub_area_id: null,
      location_label: "الموقع", location_description: "وصف الموقع", google_maps_url: "https://maps.example.com/project",
      latitude: "30.012345", longitude: "31.123456", map_zoom: "15",
      overview_title: "نظرة عامة", overview_body: "<p>تفاصيل مشروع فينيسيا</p>", overview_media_type: "image",
      overview_main_image: "/images/overview.jpg", overview_main_image_alt: "نظرة عامة", delivery_title: "التسليم",
      delivery_body: "<p>تفاصيل التسليم</p>", plans_title: "المخططات", gallery_title: "المعرض", location_title: "الموقع",
      seo_title: "", seo_description: "", focus_keyword: "فينيسيا", seo_keywords: ["عقارات"],
      canonical_url: null, robots_index: true, robots_follow: true, og_image: null, og_image_alt: "",
      publication_status: "unpublished", featured: false, show_on_homepage: false, homepage_order: 0, brochure_url: null,
    };
    const payload = {
      project: { ...project, ...derive(project) },
      location_section_presentation: { show_location_label: true, show_location_tags: true },
      publication_actor_id: actor.id, publication_previous_status: null as string | null,
      deleted: {}, location_points: [], features: [{ client_key: randomUUID(), body: "ميزة فينيسيا" }] as Array<Record<string, unknown>>,
      floor_plans: [], delivery_items: [], media: [], videos: [],
    };
    const existing = editOnly
      ? await one("select id, publication_status from public.projects where slug='synthetic-seo-project-1'")
      : null;
    if (editOnly) {
      assert.ok(existing, "edit-only proof requires the named synthetic baseline Project");
      payload.publication_previous_status = existing.publication_status;
    }
    const saved = await one("select * from public.save_project_admin_entry($1, $2::jsonb)", [existing?.id ?? null, JSON.stringify(payload)]);
    await flush();
    const readProject = async (id: number) => (await one("select to_jsonb(project) as project from public.projects project where id=$1", [id])).project;
    let actual = await readProject(saved.project_id);
    assert.equal(actual.seo_score_input_hash, derive(actual).seo_score_input_hash);
    assert.equal(actual.seo_score, derive(actual).seo_score);
    const unchanged = actual.seo_score_input_hash;
    await db.query("update public.projects set featured=true where id=$1", [saved.project_id]);
    await flush();
    assert.equal((await readProject(saved.project_id)).seo_score_input_hash, unchanged, "non-input update retains provenance");
    await rejectsAtomically(() => db.query("update public.projects set overview_body='<p>unproved edit</p>' where id=$1", [saved.project_id]), /seo/i);
    actual = await readProject(saved.project_id);
    assert.equal(actual.overview_body, project.overview_body, "input-only update was fully rolled back");

    payload.project = { ...payload.project, overview_body: "<p>محتوى معدل فينيسيا</p>" };
    Object.assign(payload.project, derive(payload.project, actual));
    payload.publication_previous_status = "unpublished";
    payload.features = (await db.query("select id,client_key,body from public.project_features where project_id=$1", [saved.project_id])).rows;
    await one("select * from public.save_project_admin_entry($1,$2::jsonb)", [saved.project_id, JSON.stringify(payload)]);
    await flush();
    actual = await readProject(saved.project_id);
    assert.notEqual(actual.seo_score_input_hash, unchanged, "edit persists new inputs and provenance atomically");
    assert.equal(actual.seo_score_input_hash, derive(actual).seo_score_input_hash);
    await rejectsAtomically(() => db.query("update public.projects set seo_score_input_hash=$1 where id=$2",
      ["0".repeat(64), saved.project_id]), /seo/i);
    await rejectsAtomically(() => db.query("update public.projects set seo_score=101 where id=$1",
      [saved.project_id]), /seo/i);
    const afterRejectedProofs = await readProject(saved.project_id);
    assert.equal(afterRejectedProofs.seo_score, actual.seo_score);
    assert.equal(afterRejectedProofs.seo_score_input_hash, actual.seo_score_input_hash);

    if (!editOnly) {
    const proof = helper.buildProjectDuplicateSeoProof(actual, 1);
    const copy = await one("select * from public.duplicate_project_admin_entry($1,$2::jsonb)", [saved.project_id, JSON.stringify(proof)]);
    await flush();
    const copied = await readProject(copy.project_id);
    assert.equal(copied.seo_score_input_hash, derive(copied).seo_score_input_hash);
    assert.equal(copied.seo_score, derive(copied).seo_score);
    assert.equal((await one("select count(*)::int as count from public.project_features where project_id=$1", [copy.project_id])).count, 1);
    assert.equal(copied.publication_status, "unpublished");
    assert.equal(copied.featured, false);
    await rejectsAtomically(() => db.query("select * from public.duplicate_project_admin_entry($1,$2::jsonb)", [saved.project_id,
      JSON.stringify({ ...proof, expected_source: { ...proof.expected_source, arabic_name: "stale source" } })]), /SOURCE_CONFLICT/);
    await rejectsAtomically(() => db.query("select * from public.duplicate_project_admin_entry($1,$2::jsonb)", [saved.project_id,
      JSON.stringify({ ...proof, expected_updated_at: "2000-01-01T00:00:00Z" })]), /SOURCE_CONFLICT/);
    await rejectsAtomically(() => db.query("select * from public.duplicate_project_admin_entry($1,$2::jsonb)", [saved.project_id, JSON.stringify(proof)]), /RESULT_CONFLICT/);
    const nextProof = helper.buildProjectDuplicateSeoProof(actual, 2);
    await rejectsAtomically(() => db.query("select * from public.duplicate_project_admin_entry($1,$2::jsonb)", [saved.project_id,
      JSON.stringify({ ...nextProof, score: { ...nextProof.score, seo_score_input_hash: "0".repeat(64) } })]), /seo/i);
    await db.query(`create function pg_temp.reject_project_seo_child() returns trigger language plpgsql as $$
      begin raise exception 'isolated Project child failure'; end $$;
      create trigger project_seo_child_failure before insert on public.project_features
      for each row execute function pg_temp.reject_project_seo_child()`);
    await rejectsAtomically(() => db.query("select * from public.duplicate_project_admin_entry($1,$2::jsonb)", [saved.project_id, JSON.stringify(nextProof)]), /isolated Project child failure/);
    }
    await db.query("rollback");
    console.log(editOnly
      ? "PASS isolated PostgreSQL Project edit/non-input provenance and unproved-input/forged-hash/invalid-score rollback; create/duplicate not tested in edit-only mode"
      : "PASS isolated PostgreSQL Project create/edit/non-input/duplicate provenance and source/allocation/score/child rollback");
  } finally {
    await db.query("rollback").catch(() => undefined);
    await db.end();
  }
}
