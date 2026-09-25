import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runApplicationHandoff } from "./lib/isolated-public-application.mts";
import { runIsolatedSupabase } from "./lib/isolated-supabase.mts";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import type { TopicSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";

const root = resolve(import.meta.dirname, "..");
const artifactDir = resolve(root, process.argv[3] ?? ".tmp-qa/public-composition-isolated");
const cliBinary = process.argv[2];
assert.ok(cliBinary, "Pass the pinned official Supabase CLI path.");

await runIsolatedSupabase({
  lockPath: resolve(root, "scripts/fixtures/isolated-supabase/stack.lock.json"),
  artifactDir,
  cliBinary: resolve(cliBinary),
  pgPort: 56211,
  restPort: 56212,
  storagePort: 56213,
  apiPort: 56214,
  async handoff(handle) {
    const migration = await runApplicationHandoff(handle);
    assert.equal(migration.status, "complete");
    const seo = loadEntitySeoPersistenceOwner();
    handle.record("public-composition-migrations", { status: "pass", registered: migration.registered });
    if (process.argv.includes("--browser")) {
      await handle.preparePublicVerification();
      const gates = await handle.runPublicVerification({
        additionalSourceFiles: [
          "src/lib/page-composition/load-page-regions.ts",
          "scripts/verify-public-composition-isolated.mts",
        ],
      });
      assert.deepEqual(gates.gates.map((gate) => gate.name), [
        "normal-build", "product-surface-build", "platform-contracts", "public-e2e",
      ]);
      handle.record("public-composition-browser", { gates: gates.gates.length, status: "pass" });
    }

    const legacy = await handle.query(`select
      (select count(*)::int from public.pages where layout_id <> (select id from public.page_composition_layouts where key='venisia-legacy')) as non_legacy_pages,
      (select count(*)::int from public.page_composition_assignments a join public.pages p on p.id=a.page_id
       where not exists(select 1 from public.page_composition_regions r where r.layout_id=p.layout_id and r.key=a.slot)) as invalid_assignments,
      (select array_agg(key order by sort_order) from public.page_composition_regions
       where layout_id=(select id from public.page_composition_layouts where key='venisia-legacy')) as positions`);
    assert.equal(legacy.rows[0].non_legacy_pages, 0);
    assert.equal(legacy.rows[0].invalid_assignments, 0);
    assert.deepEqual(legacy.rows[0].positions, ["main", "sidebar", "bottom", "footer", "hero"]);

    const layout = await handle.query(`insert into public.page_composition_layouts(key,admin_label)
      values ('isolated-layout','Isolated layout') returning id`);
    const layoutId = layout.rows[0].id;
    await handle.query(`insert into public.page_composition_regions(layout_id,key,admin_label,sort_order)
      values ($1,'north-gallery','North gallery',10)`, [layoutId]);
    const page = await handle.query(`insert into public.pages(title,slug,path,layout_id)
      values ('Isolated region fixture','isolated-region-fixture','/isolated-region-fixture',$1) returning id`, [layoutId]);
    const template = await handle.query(`select id from public.content_block_templates order by id limit 1`);
    assert.equal(template.rows.length, 1);
    await handle.query("select set_config('app.page_composition_write','on',false)");
    await handle.query(`insert into public.page_content_block_assignments(page_id,template_id,slot,sort_order)
      values ($1,$2,'north-gallery',10)`, [page.rows[0].id, template.rows[0].id]);
    await assert.rejects(
      handle.query(`update public.page_content_block_assignments set slot='main'
        where page_id=$1 and template_id=$2`, [page.rows[0].id, template.rows[0].id]),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "23514",
    );
    await assert.rejects(
      handle.query(`update public.page_composition_regions set key='renamed-region'
        where layout_id=$1 and key='north-gallery'`, [layoutId]),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "23514",
    );
    const valid = await handle.query(`select slot from public.page_content_block_assignments
      where page_id=$1 and template_id=$2`, [page.rows[0].id, template.rows[0].id]);
    assert.equal(valid.rows[0].slot, "north-gallery");
    const access = await handle.query(`select
      has_table_privilege('service_role','public.page_composition_regions','SELECT') as service_regions,
      has_table_privilege('anon','public.page_composition_regions','SELECT') as anon_regions,
      has_function_privilege('service_role','public.public_feed_category_counts(jsonb,text[])','EXECUTE') as service_categories,
      has_function_privilege('anon','public.public_feed_category_counts(jsonb,text[])','EXECUTE') as anon_categories`);
    assert.deepEqual(access.rows[0], {
      service_regions: true, anon_regions: false, service_categories: true, anon_categories: false,
    });
    handle.record("public-composition-regions", { legacyCompatible: true, arbitraryRegion: true, crossLayoutRejected: true });

    const actor = await handle.query("select id,username from public.admin_users where is_active order by id limit 1");
    assert.equal(actor.rows.length, 1, "The isolated baseline must provide an active Admin actor.");
    const actorId = Number(actor.rows[0].id);
    const actorUsername = String(actor.rows[0].username);
    const managedPage = await handle.query(`insert into public.pages(title,slug,path,status)
      values ('F03 F07 isolated page','f03-f07-isolated','/f03-f07-isolated','published') returning id`);
    const managedPageId = Number(managedPage.rows[0].id);
    const mutate = async (operation: string, payload: unknown) => {
      const result = await handle.query(`select public.mutate_page_composition($1,$2,$3::jsonb,$4,$5) as result`,
        [managedPageId, operation, JSON.stringify(payload), actorId, actorUsername]);
      return result.rows[0].result as Record<string, unknown>;
    };
    const rejectsSqlState = (operation: Promise<unknown>, state: string) => assert.rejects(
      operation,
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === state,
    );

    const createdLayout = await mutate("save_layout", {
      key: "isolated-editorial", admin_label: "Isolated editorial",
      regions: [
        { key: "hero", admin_label: "Hero", sort_order: 10 },
        { key: "story", admin_label: "Story", sort_order: 20 },
        { key: "rail", admin_label: "Rail", sort_order: 30 },
      ],
      assign_page: true,
    });
    const managedLayoutId = Number(createdLayout.layout_id);
    assert.ok(Number.isSafeInteger(managedLayoutId) && managedLayoutId > 0);
    const layoutReadback = await handle.query(`select l.key,l.admin_label,
      array_agg(r.key order by r.sort_order) regions,
      (select layout_id::int from public.pages where id=$1) page_layout_id
      from public.page_composition_layouts l join public.page_composition_regions r on r.layout_id=l.id
      where l.id=$2 group by l.id`, [managedPageId, managedLayoutId]);
    assert.deepEqual(layoutReadback.rows[0], {
      key: "isolated-editorial", admin_label: "Isolated editorial",
      regions: ["hero", "story", "rail"], page_layout_id: managedLayoutId,
    });

    const managedTemplate = await handle.query(`select id from public.content_block_templates order by id limit 1`);
    assert.equal(managedTemplate.rows.length, 1);
    const managedTemplateId = Number(managedTemplate.rows[0].id);
    await handle.query(`update public.content_block_templates
      set status='published',config='{"title":"Isolated semantic page copy"}'::jsonb where id=$1`, [managedTemplateId]);
    const assignment = await mutate("save_assignment", {
      kind: "content", template_id: managedTemplateId, slot: "story", sort_order: 10, is_visible: true,
    });
    const managedAssignmentId = Number(assignment.assignment_id);
    const assignmentReadback = await handle.query(`select assignment.slot,assignment.sort_order,layout.key layout_key
      from public.page_content_block_assignments assignment
      join public.pages page on page.id=assignment.page_id
      join public.page_composition_layouts layout on layout.id=page.layout_id
      where assignment.id=$1`, [managedAssignmentId]);
    assert.deepEqual(assignmentReadback.rows[0], {
      slot: "story", sort_order: 10, layout_key: "isolated-editorial",
    });
    await rejectsSqlState(mutate("save_assignment", {
      kind: "content", assignment_id: managedAssignmentId, template_id: managedTemplateId,
      slot: "missing-region", sort_order: 10, is_visible: true,
    }), "23514");

    const incompatibleLayout = await mutate("save_layout", {
      key: "isolated-incompatible", admin_label: "Incompatible",
      regions: [{ key: "main", admin_label: "Main", sort_order: 10 }], assign_page: false,
    });
    await rejectsSqlState(mutate("select_layout", { layout_id: Number(incompatibleLayout.layout_id) }), "23514");
    await rejectsSqlState(mutate("save_layout", {
      layout_id: managedLayoutId, key: "isolated-editorial", admin_label: "Must roll back",
      regions: [
        { key: "hero", admin_label: "Hero", sort_order: 10 },
        { key: "rail", admin_label: "Rail", sort_order: 20 },
      ], assign_page: false,
    }), "23514");
    const rollbackReadback = await handle.query(`select l.admin_label,array_agg(r.key order by r.sort_order) regions
      from public.page_composition_layouts l join public.page_composition_regions r on r.layout_id=l.id
      where l.id=$1 group by l.id`, [managedLayoutId]);
    assert.deepEqual(rollbackReadback.rows[0], {
      admin_label: "Isolated editorial", regions: ["hero", "story", "rail"],
    });
    const reorderedLayout = await mutate("save_layout", {
      layout_id: managedLayoutId, key: "isolated-editorial", admin_label: "Isolated editorial updated",
      regions: [
        { key: "rail", admin_label: "Rail", sort_order: 10 },
        { key: "story", admin_label: "Story", sort_order: 20 },
        { key: "hero", admin_label: "Hero", sort_order: 30 },
      ], assign_page: true,
    });
    assert.equal(reorderedLayout.assigned, true);
    const reorderedReadback = await handle.query(`select array_agg(key order by sort_order) regions
      from public.page_composition_regions where layout_id=$1`, [managedLayoutId]);
    assert.deepEqual(reorderedReadback.rows[0].regions, ["rail", "story", "hero"]);
    const legacyId = await handle.query("select id from public.page_composition_layouts where key='venisia-legacy'");
    await rejectsSqlState(mutate("save_layout", {
      layout_id: Number(legacyId.rows[0].id), key: "venisia-legacy", admin_label: "Forbidden",
      regions: [{ key: "main", admin_label: "Main", sort_order: 10 }], assign_page: false,
    }), "23514");

    const pageSeoSource = {
      title: "F03 F07 isolated page", path: "/f03-f07-isolated",
      semanticContent: "Isolated semantic page copy",
      seo_title: "Isolated SEO page", seo_description: "Isolated page description",
      seo_keywords: ["isolated", "page"], focus_keyword: "isolated",
      og_image: "/isolated-page.webp", og_image_alt: "Isolated page",
    };
    const pageScore = seo.deriveEntitySeoScore(seo.toPageSeoScoreInput(pageSeoSource));
    await handle.query(`update public.pages set seo_title=$1,seo_description=$2,seo_keywords=$3,
      focus_keyword=$4,og_image=$5,og_image_alt=$6,seo_score=$7,seo_score_version=$8,seo_score_input_hash=$9
      where id=$10`, [pageSeoSource.seo_title,pageSeoSource.seo_description,pageSeoSource.seo_keywords,
      pageSeoSource.focus_keyword,pageSeoSource.og_image,pageSeoSource.og_image_alt,
      pageScore.seo_score,pageScore.seo_score_version,pageScore.seo_score_input_hash,managedPageId]);
    let pageScoreReadback = await handle.query(`select seo_score,seo_score_version,seo_score_input_hash
      from public.pages where id=$1`, [managedPageId]);
    assert.deepEqual(pageScoreReadback.rows[0], pageScore);
    await handle.query("update public.pages set title='F03 F07 changed title' where id=$1", [managedPageId]);
    pageScoreReadback = await handle.query(`select seo_score,seo_score_version,seo_score_input_hash
      from public.pages where id=$1`, [managedPageId]);
    assert.deepEqual(pageScoreReadback.rows[0], {
      seo_score: null, seo_score_version: null, seo_score_input_hash: null,
    });
    const changedPageScore = seo.deriveEntitySeoScore(seo.toPageSeoScoreInput({
      ...pageSeoSource, title: "F03 F07 changed title",
    }));
    await handle.query(`update public.pages set seo_score=$1,seo_score_version=$2,seo_score_input_hash=$3 where id=$4`,
      [changedPageScore.seo_score,changedPageScore.seo_score_version,changedPageScore.seo_score_input_hash,managedPageId]);
    await mutate("save_layout", {
      layout_id: managedLayoutId, key: "isolated-editorial", admin_label: "Isolated editorial updated",
      regions: [
        { key: "story", admin_label: "Story", sort_order: 10 },
        { key: "rail", admin_label: "Rail", sort_order: 20 },
        { key: "hero", admin_label: "Hero", sort_order: 30 },
      ], assign_page: false,
    });
    pageScoreReadback = await handle.query(`select seo_score,seo_score_version,seo_score_input_hash
      from public.pages where id=$1`, [managedPageId]);
    assert.deepEqual(pageScoreReadback.rows[0], {
      seo_score: null, seo_score_version: null, seo_score_input_hash: null,
    });
    await handle.query(`update public.pages set seo_score=$1,seo_score_version=$2,seo_score_input_hash=$3 where id=$4`,
      [changedPageScore.seo_score,changedPageScore.seo_score_version,changedPageScore.seo_score_input_hash,managedPageId]);
    await mutate("save_assignment", {
      kind: "content", assignment_id: managedAssignmentId, template_id: managedTemplateId,
      slot: "story", sort_order: 20, is_visible: true,
    });
    pageScoreReadback = await handle.query(`select seo_score,seo_score_version,seo_score_input_hash
      from public.pages where id=$1`, [managedPageId]);
    assert.deepEqual(pageScoreReadback.rows[0], {
      seo_score: null, seo_score_version: null, seo_score_input_hash: null,
    });
    await rejectsSqlState(handle.query("update public.pages set seo_score=50 where id=$1", [managedPageId]), "23514");
    const pageDryRun = await handle.runEntitySeoBackfill({ mode: "dry-run", entities: ["pages"] });
    assert.equal(pageDryRun.counts.targeted > 0, true);
    assert.equal(pageDryRun.counts.wouldWrite > 0, true);
    assert.equal(pageDryRun.counts.written, 0);
    const pageApplied = await handle.runEntitySeoBackfill({ mode: "apply", entities: ["pages"] });
    assert.equal(pageApplied.counts.written, pageDryRun.counts.wouldWrite);
    assert.equal(pageApplied.counts.unresolved, 0);
    const pageVerified = await handle.runEntitySeoBackfill({ mode: "verify", entities: ["pages"] });
    assert.equal(pageVerified.readyForEnforcement, true);
    assert.equal(pageVerified.counts.unchanged, pageVerified.counts.targeted);
    const pageIdempotent = await handle.runEntitySeoBackfill({ mode: "apply", entities: ["pages"] });
    assert.equal(pageIdempotent.counts.written, 0);
    assert.equal(pageIdempotent.counts.unchanged, pageIdempotent.counts.targeted);
    const listReadback = await handle.query(`select public.admin_list_pages(1,10,'seo','desc','f03-f07-isolated') result`);
    const listResult = listReadback.rows[0].result as { contract_version: number; rows: Array<{ id: number }> };
    assert.equal(listResult.contract_version, 3);
    assert.equal(listResult.rows[0].id, managedPageId);
    handle.record("f03-f07-page-proof", {
      layoutCreated: true, regionsSavedAndReordered: true, assignmentReadback: true,
      incompatibleAssignmentRejected: true, incompatibleSelectionRejected: true,
      usedRegionRemovalRolledBack: true, legacyProtected: true,
      pageScorePersistedAndReadBack: true, inputChangeInvalidated: true,
      layoutChangeInvalidated: true, compositionChangeInvalidated: true, listContractVersion: 3,
      pageBackfillDryRunApplyVerifyAndIdempotency: true,
    });

    const locations = await handle.query(`select governorate.id::int governorate_id,city.id::int city_id,
      area.id::int main_area_id from public.project_locations governorate
      join public.project_locations city on city.parent_id=governorate.id and city.level='city' and city.is_active
      join public.project_locations area on area.parent_id=city.id and area.level='main_area' and area.is_active
      where governorate.level='governorate' and governorate.is_active limit 1`);
    assert.equal(locations.rows.length, 1);
    const project = {
      type: "residential", code: "SEO-ISOLATED", arabic_name: "مشروع فينيسيا المعزول",
      english_name: "Isolated SEO Project", slug: "seo-isolated-project",
      general_description: "وصف مشروع فينيسيا", short_description: "وصف مختصر",
      image: "/images/card.jpg", image_alt: "بطاقة", hero_image: "/images/hero.jpg", hero_image_alt: "فينيسيا",
      small_box_image: "/images/small.jpg", small_box_image_alt: "مصغرة",
      ...locations.rows[0], sub_area_id: null,
      location_label: "الموقع", location_description: "وصف الموقع",
      google_maps_url: "https://maps.example.com/project", latitude: "30.012345", longitude: "31.123456", map_zoom: "15",
      overview_title: "نظرة عامة", overview_body: "<p>تفاصيل مشروع فينيسيا</p>", overview_media_type: "image",
      overview_main_image: "/images/overview.jpg", overview_main_image_alt: "نظرة عامة",
      delivery_title: "التسليم", delivery_body: "<p>تفاصيل التسليم</p>", plans_title: "المخططات",
      gallery_title: "المعرض", location_title: "الموقع", seo_title: "", seo_description: "",
      focus_keyword: "فينيسيا", seo_keywords: ["عقارات"], canonical_url: null,
      robots_index: true, robots_follow: true, og_image: null, og_image_alt: "",
      publication_status: "unpublished", featured: false, show_on_homepage: false,
      homepage_order: 0, brochure_url: null,
    };
    const projectScore = seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput(project));
    const projectPayload = {
      project: { ...project, ...projectScore },
      location_section_presentation: { show_location_label: true, show_location_tags: true },
      publication_actor_id: actorId, publication_previous_status: null,
      deleted: {}, location_points: [],
      features: [{ client_key: "f03f0700-0000-4000-8000-000000000001", body: "ميزة فينيسيا" }],
      floor_plans: [], delivery_items: [], media: [], videos: [],
    };
    const savedProject = await handle.query(`select * from public.save_project_admin_entry(null,$1::jsonb)`,
      [JSON.stringify(projectPayload)]);
    assert.equal(savedProject.rows.length, 1);
    const savedProjectId = Number(savedProject.rows[0].project_id);
    const projectReadback = await handle.query("select to_jsonb(project) project from public.projects project where id=$1",
      [savedProjectId]);
    const actualProject = projectReadback.rows[0].project as Record<string, unknown>;
    const expectedProjectScore = seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput(actualProject));
    assert.equal(actualProject.seo_score, expectedProjectScore.seo_score);
    assert.equal(actualProject.seo_score_input_hash, expectedProjectScore.seo_score_input_hash);

    const expectedSource = Object.fromEntries(seo.PROJECT_SEO_SOURCE_COLUMNS.map((key) => [key, actualProject[key] ?? null]));
    const expectedResult = {
      ...expectedSource,
      arabic_name: `${String(actualProject.arabic_name)} — نسخة`,
      slug: `${String(actualProject.slug)}-copy`,
    };
    const duplicateProof = {
      expected_updated_at: actualProject.updated_at,
      expected_source: expectedSource,
      expected_result: expectedResult,
      score: seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput({ ...actualProject, ...expectedResult })),
    };
    const duplicatedProject = await handle.query(`select * from public.duplicate_project_admin_entry($1,$2::jsonb)`,
      [savedProjectId, JSON.stringify(duplicateProof)]);
    assert.equal(duplicatedProject.rows.length, 1);
    const duplicateId = Number(duplicatedProject.rows[0].project_id);
    const duplicateReadback = await handle.query("select to_jsonb(project) project from public.projects project where id=$1",
      [duplicateId]);
    const duplicate = duplicateReadback.rows[0].project as Record<string, unknown>;
    const expectedDuplicateScore = seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput(duplicate));
    assert.equal(duplicate.seo_score, expectedDuplicateScore.seo_score);
    assert.equal(duplicate.seo_score_input_hash, expectedDuplicateScore.seo_score_input_hash);
    assert.equal(duplicate.publication_status, "unpublished");
    assert.equal(duplicate.featured, false);
    const projectCountBeforeRejection = await handle.query("select count(*)::int count from public.projects");
    await rejectsSqlState(handle.query(`select * from public.duplicate_project_admin_entry($1,$2::jsonb)`, [
      savedProjectId,
      JSON.stringify({ ...duplicateProof, expected_updated_at: "2000-01-01T00:00:00Z" }),
    ]), "VSE01");
    const projectCountAfterRejection = await handle.query("select count(*)::int count from public.projects");
    assert.equal(projectCountAfterRejection.rows[0].count, projectCountBeforeRejection.rows[0].count);
    handle.record("f07-project-proof", {
      createdWithTuple: true, createReadbackMatched: true, duplicatedWithTuple: true,
      duplicateReadbackMatched: true, staleSourceRejectedAtomically: true,
    });

    const rootCategory = await handle.query(`insert into public.topic_categories(name,slug,sort_order,status)
      values ('Isolated root','isolated-feed-root',1,'published') returning id`);
    const childCategory = await handle.query(`insert into public.topic_categories(name,slug,parent_id,sort_order,status)
      values ('Isolated child','isolated-feed-child',$1,2,'published') returning id`, [rootCategory.rows[0].id]);
    await handle.query(`insert into public.topic_series(name,slug,category_id,status)
      values ('Isolated series','isolated-series-a',$1,'published'),
             ('Empty series','isolated-series-empty',$1,'published')`, [childCategory.rows[0].id]);
    const topics = [
      ["isolated-article-root", "isolated-feed-root", "2020-01-01T00:00:00Z", "published", null],
      ["isolated-article-child-1", "isolated-feed-child", "2020-02-01T00:00:00Z", "published", null],
      ["isolated-article-child-2", "isolated-feed-child", "2020-02-01T00:00:00Z", "published", null],
      ["isolated-article-unpublished", "isolated-feed-child", "2020-03-01T00:00:00Z", "unpublished", null],
      ["e2e-test-isolated-article", "isolated-feed-child", "2020-04-01T00:00:00Z", "published", null],
    ] as const;
    let latestId = 0;
    await handle.query("begin");
    for (const [slug, categorySlug, publishedAt, status, deletedAt] of topics) {
      const inserted = await handle.query(`insert into public.topics
        (slug,title,excerpt,content,image,category,category_slug,series,series_slug,published_at,content_type,status,deleted_at)
        values ($1,$1,'Fixture excerpt','Fixture content','/fixture.jpg','Fixture',$2,'Fixture','isolated-series-a',$3,'article',$4,$5)
        returning id`, [slug, categorySlug, publishedAt, status, deletedAt]);
      const persisted = await handle.query("select * from public.topics where id=$1", [inserted.rows[0].id]);
      const score = seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(persisted.rows[0] as TopicSeoSource));
      await handle.query(`update public.topics set seo_score=$1,seo_score_version=$2,seo_score_input_hash=$3
        where id=$4`, [score.seo_score, score.seo_score_version,
          score.seo_score_input_hash, inserted.rows[0].id]);
      if (slug === "isolated-article-child-2") latestId = Number(inserted.rows[0].id);
    }
    await handle.query("commit");
    handle.record("public-composition-feed-fixture", { insertedArticles: topics.length });
    const counts = await handle.query(`select * from public.public_feed_category_counts($1::jsonb,$2::text[])`, [
      JSON.stringify([
        { id: rootCategory.rows[0].id, slugs: ["isolated-feed-root", "isolated-feed-child"] },
        { id: childCategory.rows[0].id, slugs: ["isolated-feed-child"] },
      ]), ["isolated-series-a"],
    ]);
    const countById = new Map(counts.rows.map((row) => [Number(row.category_id), Number(row.article_count)]));
    handle.record("public-composition-feed-counts", {
      rootCount: countById.get(Number(rootCategory.rows[0].id)) ?? -1,
      childCount: countById.get(Number(childCategory.rows[0].id)) ?? -1,
    });
    assert.equal(countById.get(Number(rootCategory.rows[0].id)), 3);
    assert.equal(countById.get(Number(childCategory.rows[0].id)), 2);
    const legacyCounts = await handle.query(`select
      (select count(*)::int from public.topics where category_slug in ('isolated-feed-root','isolated-feed-child')
       and series_slug='isolated-series-a' and content_type='article' and status='published'
       and deleted_at is null and slug not like 'e2e-test%') as root_count,
      (select count(*)::int from public.topics where category_slug='isolated-feed-child'
       and series_slug='isolated-series-a' and content_type='article' and status='published'
       and deleted_at is null and slug not like 'e2e-test%') as child_count`);
    assert.equal(legacyCounts.rows[0].root_count, 3);
    assert.equal(legacyCounts.rows[0].child_count, 2);
    const representatives = await handle.query(`select * from public.public_feed_series_representatives($1::text[])`, [
      ["isolated-series-a", "isolated-series-empty"],
    ]);
    handle.record("public-composition-feed-series-shape", {
      representativeRows: representatives.rows.length,
      representativeId: Number((representatives.rows[0]?.representative as { id?: number } | undefined)?.id ?? -1),
      expectedId: latestId,
    });
    assert.equal(representatives.rows.length, 1);
    assert.equal(representatives.rows[0].series_slug, "isolated-series-a");
    assert.equal((representatives.rows[0].representative as { id: number }).id, latestId);
    const legacyLatest = await handle.query(`select id from public.topics where series_slug='isolated-series-a'
      and content_type='article' and status='published' and deleted_at is null and slug not like 'e2e-test%'
      order by published_at desc,id desc limit 1`);
    assert.equal(Number(legacyLatest.rows[0].id), latestId);
    handle.record("public-composition-feed", { categoryParity: true, seriesParity: true, emptySeries: true });
  },
});

const cleanup = JSON.parse(readFileSync(resolve(artifactDir, "cleanup.json"), "utf8"));
assert.equal(cleanup.status, "complete");
assert.equal(cleanup.remainingOwnedResources, 0);
console.log("PUBLIC_COMPOSITION_ISOLATED: migrations and cleanup PASS");
