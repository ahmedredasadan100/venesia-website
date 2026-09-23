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
    const seo = loadEntitySeoPersistenceOwner();
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
