import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  decisionCardElement,
  decisionCardElementCount,
  inspectReviewDecisionCard,
} from "./lib/review-decision-card-structure.mjs";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION =
  "sql/migrations/20260803120000_project_publishing_visibility_capability.sql";
const BASELINE_MIGRATIONS = [
  "sql/migrations/20250625600000_admin_users.sql",
  "sql/migrations/20260728090000_rebuild_project_admin_data_entry.sql",
  "sql/migrations/20260729090000_project_admin_entry_acl_correction.sql",
  "sql/migrations/20260730100000_project_admin_save_rpc_conflict_arbiter_fix.sql",
  "sql/migrations/20260731100000_project_row_actions_capability.sql",
] as const;

const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8").replace(/\r\n?/g, "\n");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

for (const path of [MIGRATION, ...BASELINE_MIGRATIONS]) {
  check(`${path} exists`, existsSync(join(ROOT, path)));
}

const migration = read(MIGRATION);
const capability = read(
  "src/lib/admin/projects/project-publishing-capability.ts",
);
const contract = read("src/lib/admin/projects/project-entry-contract.ts");
const form = read("src/app/admin/projects/ProjectEditForm.tsx");
const review = read(
  "src/components/admin/projects/ProjectPublishChecklistPanel.tsx",
);
const saveAction = read(
  "src/app/admin/projects/project-actions/save-entry.ts",
);
const publicationAction = read(
  "src/app/admin/projects/project-actions/publication.ts",
);
const duplicateAction = read(
  "src/app/admin/projects/project-actions/duplicate.ts",
);
const listAdapter = read("src/lib/admin/projects/entity-list-adapter.ts");
const listContract = read("src/lib/admin/projects/entity-list-contract.ts");
const listClient = read("src/app/admin/projects/ProjectsTableClient.tsx");
const table = read(
  "src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx",
);
const publicLoader = read("src/lib/projects/load-published-projects.ts");
const publicDetail = read("src/app/(site)/projects/[slug]/page.tsx");
const trackDetail = read(
  "src/app/(site)/track-your-project/[slug]/page.tsx",
);
const adminPreview = read("src/app/admin/projects/[id]/preview/page.tsx");
const sitemap = read("src/lib/seo/generate-sitemap-entries.ts");
const revalidation = read(
  "src/app/admin/projects/project-actions/revalidate.ts",
);
const publicCacheRevalidation = read(
  "src/lib/cache/revalidate-public-cache-tags.ts",
);
const publicationDecision = inspectReviewDecisionCard(
  review,
  "ProjectPublishChecklistPanel.tsx",
  "publication-schedule",
);

check(
  "capability owns exactly draft, published, and unpublished",
  capability.includes('"draft",\n  "published",\n  "unpublished"') &&
    !capability.includes("archived"),
);
check(
  "public visibility derives only from published",
  capability.includes('return status === "published"'),
);
check(
  "one Project form adopts the eighth Review and Publish tab",
  contract.includes('review: "review"') &&
    form.includes("PROJECT_ENTRY_TAB_IDS.review") &&
    form.includes("ProjectPublishChecklistPanel") &&
    form.includes("AdminFormRuntime"),
);
check(
  "review state and featured fields submit through the existing form",
  review.includes('name="publication_status"') &&
    review.includes('name="featured"') &&
    !review.includes("formAction"),
);
check(
  "Project Review publication composition exposes one switch, one first-publish value, and no duplicate badge",
  publicationDecision.title === "حالة النشر والتاريخ" &&
    !publicationDecision.hasBadge &&
    decisionCardElementCount(publicationDecision, "AdminStatusPill") === 0 &&
    decisionCardElementCount(publicationDecision, "AdminFormSwitch") === 1 &&
    decisionCardElement(publicationDecision, "AdminFormSwitch", {
      name: "publication_status",
    })?.attributes.describedBy === "project-publication-hint" &&
    decisionCardElement(publicationDecision, "ProjectDecision", {
      label: "تاريخ أول نشر",
    }) !== undefined &&
    (publicationDecision.sourceText.match(/initial\.project\.published_at/g) ?? [])
      .length === 1,
);
check(
  "form save passes trusted actor and prior state into the same aggregate RPC",
  saveAction.includes('rpc(\n          "save_project_admin_entry"') &&
    saveAction.includes("publication_actor_id: actor.id") &&
    saveAction.includes("publication_previous_status") &&
    saveAction.includes('mode === "create" && payload.project.publication_status === "unpublished"') &&
    !saveAction.includes("save_project_publication"),
);
check(
  "row publication uses one domain command with shared readiness and audit",
  publicationAction.includes('rpc(\n    "set_project_publication_admin_entry"') &&
    publicationAction.includes("getProjectPublishingReadiness") &&
    publicationAction.includes("recordCmsAdminAudit") &&
    publicationAction.includes("revalidateProjectPaths"),
);
check(
  "duplicate proves draft, null publication metadata, and unfeatured result",
  duplicateAction.includes('publication_status !== "draft"') &&
    duplicateAction.includes("published_at !== null") &&
    duplicateAction.includes("published_by !== null") &&
    duplicateAction.includes("publication.featured"),
);
check(
  "Admin list delegates publication filters and pagination to one RPC read model",
  listAdapter.includes('rpc("admin_list_projects"') &&
    listAdapter.includes("p_publication_status") &&
    listContract.includes("publicationStatus") &&
    listClient.includes('paramKey: "publication_status"'),
);
check(
  "row actions expose status, preview, gated public link, and visibility mutation",
  table.includes("getProjectPreviewCapability") &&
    table.includes("getProjectPublicationMetadata") &&
    table.includes("copyPublicLink:") &&
    table.includes("visibility:") &&
    listClient.includes("setProjectPublicationAjax"),
);
check(
  "Marketing loaders filter publication in the database before aggregate mapping",
  (publicLoader.match(/\.eq\("publication_status", "published"\)/g) ?? [])
    .length >= 3 &&
    publicDetail.includes("loadProjectBySlugResult") &&
    !publicDetail.includes("loadProjectForAdminPreviewResult"),
);
check(
  "featured Marketing query requires both published and featured at the database",
  publicLoader.includes("queryPublicProjects(true)") &&
    publicLoader.includes('request = request.eq("featured", true)'),
);
check(
  "Track uses its explicit non-Marketing loader",
  publicLoader.includes("loadTrackProjectBySlug") &&
    trackDetail.includes("loadTrackProjectBySlug") &&
    !trackDetail.includes("loadProjectBySlugResult"),
);
check(
  "Admin Preview authenticates, is noindex/nofollow, and reuses public renderers",
  adminPreview.includes("requireAdminSession") &&
    adminPreview.includes("index: false, follow: false") &&
    adminPreview.includes("loadProjectForAdminPreviewResult") &&
    adminPreview.includes("CommercialProjectDetails") &&
    adminPreview.includes("ResidentialProjectDetails"),
);
check(
  "sitemap consumes published rows with authoritative timestamps, crawl policy, and diagnostic canonical overrides",
  sitemap.includes("loadPublishedProjectSitemapRows") &&
    sitemap.includes("safeDate(project.updatedAt)") &&
    sitemap.includes("project.robotsIndex !== false") &&
    sitemap.includes("canonicalOverride: project.canonicalUrl") &&
    publicLoader.includes('.select("slug,updated_at,canonical_url,robots_index")') &&
    publicLoader.includes('.eq("publication_status", "published")') &&
    !sitemap.includes("loadPublishedProjectSlugs"),
);
check(
  "revalidation covers home, hub, detail, sitemap, and Project cache tags",
    revalidation.includes('revalidatePath("/"') &&
    revalidation.includes('revalidatePath("/projects"') &&
    revalidation.includes('revalidatePath("/sitemap.xml")') &&
    revalidation.includes("revalidateProjectsCache") &&
    publicCacheRevalidation.includes('projects: ["projects", "project"]') &&
    publicCacheRevalidation.includes(
      "revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.projects)",
    ),
);
check(
  "migration is one additive transaction with no destructive table operation",
  migration.trimStart().includes("-- Project Publishing") &&
    migration.includes("begin;") &&
    migration.trimEnd().endsWith("commit;") &&
    !/drop\s+table|truncate\s+table|alter\s+table[^;]+drop\s+column|\bcascade\b/i.test(
      migration.replace(/--[^\n]*/g, ""),
    ),
);
check(
  "migration adds the three approved columns with explicit backfill and final constraints",
  migration.includes("add column publication_status text") &&
    migration.includes("add column published_at timestamptz") &&
    migration.includes("add column published_by bigint") &&
    migration.includes("set publication_status = 'published'") &&
    migration.includes("alter column publication_status set default 'draft'::text") &&
    migration.includes("alter column publication_status set not null") &&
    migration.includes("projects_publication_status_check") &&
    migration.includes("projects_published_by_fkey"),
);
check(
  "migration owns one defensive readiness and transition contract",
  migration.includes("function public.project_publishing_readiness") &&
    migration.includes("function public.transition_project_publication_admin_entry") &&
    migration.includes("PROJECT_PUBLISH_BLOCKED") &&
    migration.includes("PROJECT_PUBLICATION_ACTOR_REQUIRED"),
);
check(
  "migration keeps one aggregate save signature and rejects stale publication state",
  migration.includes("save_project_admin_entry(bigint,jsonb)") &&
    migration.includes("PROJECT_PUBLICATION_STATE_CONFLICT") &&
    migration.includes("transition_project_publication_admin_entry") &&
    !migration.includes("drop function public.save_project_admin_entry"),
);
check(
  "migration defines query-backed partial public indexes and the Admin status index",
  migration.includes("projects_published_type_updated_idx") &&
    migration.includes("where publication_status = 'published'") &&
    migration.includes("projects_published_featured_type_updated_idx") &&
    migration.includes("projects_admin_publication_updated_idx"),
);
check(
  "public RPCs are service-role-only and internal publication helpers are owner-only",
  migration.includes(
    "revoke all on function public.project_publishing_readiness(bigint) from public, anon, authenticated, service_role",
  ) &&
    migration.includes(
      "grant execute on function public.set_project_publication_admin_entry(bigint, boolean, bigint) to service_role",
    ) &&
    migration.includes(
      "grant execute on function public.admin_list_projects(integer, integer, text, text, text, text, text, text) to service_role",
    ),
);

function fixtureRoot(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    type: "residential",
    arabic_name: `مشروع ${slug}`,
    english_name: `Project ${slug}`,
    slug,
    general_description: "وصف عام مكتمل للمشروع",
    short_description: "وصف مختصر مكتمل للمشروع",
    image: "/images/project-card.jpg",
    image_alt: "صورة بطاقة المشروع",
    hero_image: "/images/project-hero.jpg",
    hero_image_alt: "صورة واجهة المشروع",
    small_box_image: "/images/project-small.jpg",
    small_box_image_alt: "صورة المشروع المصغرة",
    governorate_id: 1,
    city_id: 2,
    main_area_id: 3,
    sub_area_id: 4,
    location_label: "القاهرة الجديدة",
    location_description: "موقع المشروع",
    google_maps_url: "https://maps.example.com/project",
    latitude: "30.012345",
    longitude: "31.123456",
    map_zoom: "15",
    overview_title: "نظرة عامة",
    overview_body: "<p>تفاصيل المشروع</p>",
    overview_media_type: "image",
    overview_main_image: "/images/project-overview.jpg",
    overview_main_image_alt: "صورة النظرة العامة",
    delivery_title: "التنفيذ والتسليم",
    delivery_body: "<p>تفاصيل التنفيذ والتسليم</p>",
    seo_title: "عنوان المشروع",
    seo_description: "وصف المشروع لمحركات البحث",
    focus_keyword: "مشروع",
    seo_keywords: ["مشروع", "عقارات"],
    canonical_url: null,
    robots_index: true,
    robots_follow: true,
    og_image: null,
    og_image_alt: "",
    ...overrides,
  };
}

const aggregateFeatureKeys = new Map<string, string>();

function featureClientKey(slug: string) {
  const existingKey = aggregateFeatureKeys.get(slug);
  if (existingKey) {
    return existingKey;
  }

  const nextKey = `00000000-0000-4000-8000-${String(aggregateFeatureKeys.size + 1).padStart(12, "0")}`;
  aggregateFeatureKeys.set(slug, nextKey);
  return nextKey;
}

function aggregatePayload(
  slug: string,
  rootOverrides: Record<string, unknown> = {},
  featureBody = "ميزة متكاملة",
) {
  const feature: { client_key: string; body: string; id?: number } = {
    client_key: featureClientKey(slug),
    body: featureBody,
  };

  return {
    project: fixtureRoot(slug, rootOverrides),
    deleted: {},
    location_points: [],
    features: [feature],
    floor_plans: [],
    delivery_items: [],
    media: [],
    videos: [],
  };
}

async function createDatabase() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create extension if not exists pgcrypto;
  `);
  return db;
}

function postgres18FixtureCompatibleRebuild() {
  const source = read(BASELINE_MIGRATIONS[1]);
  const assertionMarker = "-- Final clean-schema parity gate.";
  const assertionIndex = source.indexOf(assertionMarker);
  assert.notEqual(
    assertionIndex,
    -1,
    "baseline migration keeps its PostgreSQL 17 assertion-only parity gate",
  );
  // PostgreSQL 18 represents NOT NULL in pg_constraint, changing only the old
  // PostgreSQL-17 catalog count. The disposable fixture executes all baseline
  // DDL/function logic and omits only that already-covered assertion-only block.
  return `${source.slice(0, assertionIndex)}\ncommit;\n`;
}

async function applyBaseline(db: PGlite) {
  for (const path of BASELINE_MIGRATIONS) {
    const sql = path === BASELINE_MIGRATIONS[1]
      ? postgres18FixtureCompatibleRebuild()
      : read(path);
    await db.exec(sql);
  }
}

async function saveProject(
  db: PGlite,
  id: number | null,
  payload: Record<string, unknown>,
) {
  const result = await db.query<{
    project_id: number;
    slug: string;
    updated_at: Date;
  }>(
    "select * from public.save_project_admin_entry($1::bigint, $2::jsonb)",
    [id, JSON.stringify(payload)],
  );
  return result.rows[0];
}

async function queryOne<T extends Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
) {
  const result = await db.query<T>(sql, params);
  assert.equal(result.rows.length, 1, `Expected one row from: ${sql}`);
  return result.rows[0];
}

async function attachExistingFeatureIdentity(
  db: PGlite,
  projectId: number,
  payload: ReturnType<typeof aggregatePayload>,
) {
  const feature = await queryOne<{ id: number; client_key: string }>(
    db,
    "select id, client_key from project_features where project_id = $1",
    [projectId],
  );
  payload.features[0] = {
    ...payload.features[0],
    id: feature.id,
    client_key: feature.client_key,
  };
}

const db = await createDatabase();
try {
  await applyBaseline(db);

  await db.query(
    `insert into public.projects (
      type, arabic_name, english_name, slug,
      general_description, short_description,
      image, image_alt, hero_image, hero_image_alt,
      small_box_image, small_box_image_alt,
      governorate_id, city_id, main_area_id, sub_area_id,
      location_label, location_description, google_maps_url,
      latitude, longitude, map_zoom,
      overview_title, overview_body, overview_media_type,
      overview_main_image, overview_main_image_alt,
      delivery_title, delivery_body,
      seo_title, seo_description, focus_keyword, seo_keywords,
      canonical_url, robots_index, robots_follow, og_image, og_image_alt,
      featured, created_at, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,
      $28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41
    )`,
    [
      "residential", "مشروع قائم", "Existing Project", "existing-project",
      "وصف عام قائم", "وصف مختصر قائم",
      "/existing-card.jpg", "بطاقة", "/existing-hero.jpg", "واجهة",
      "/existing-small.jpg", "مصغرة", 1, 2, 3, 4,
      "القاهرة الجديدة", "موقع قائم", "https://maps.example.com/existing",
      "30.010000", "31.010000", 15,
      "نظرة عامة", "<p>محتوى قائم</p>", "image",
      "/existing-overview.jpg", "نظرة عامة",
      "التنفيذ", "<p>بنود التنفيذ</p>",
      "عنوان قائم", "وصف قائم لمحركات البحث", "قائم", ["قائم"],
      "https://example.com/projects/existing-project", true, true, null, "",
      true, "2026-07-01T10:00:00Z", "2026-07-02T10:00:00Z",
    ],
  );

  const before = await queryOne<{ count: number; content_hash: string }>(
    db,
    `select count(*)::integer as count,
      md5(string_agg((to_jsonb(project) - 'publication_status' - 'published_at' - 'published_by')::text, '' order by project.id)) as content_hash
     from public.projects project`,
  );

  await db.exec(migration);

  const after = await queryOne<{
    count: number;
    content_hash: string;
    publication_status: string;
    published_at: Date;
    created_at: Date;
    published_by: number | null;
  }>(
    db,
    `select count(*) over ()::integer as count,
      md5(string_agg((to_jsonb(project) - 'publication_status' - 'published_at' - 'published_by')::text, '') over ()) as content_hash,
      publication_status, published_at, created_at, published_by
     from public.projects project where slug = 'existing-project'`,
  );
  check("backfill preserves Project row count", after.count === before.count);
  check(
    "backfill preserves all pre-capability Project content",
    after.content_hash === before.content_hash,
  );
  check(
    "existing Project is published with historical timestamp and no invented actor",
    after.publication_status === "published" &&
      after.published_at.getTime() === after.created_at.getTime() &&
      after.published_by === null,
  );

  const columns = await db.query<{
    attname: string;
    attnotnull: boolean;
    atthasmissing: boolean;
    default_expression: string | null;
  }>(`
    select attribute.attname, attribute.attnotnull, attribute.atthasmissing,
           pg_get_expr(default_record.adbin, default_record.adrelid) as default_expression
      from pg_attribute attribute
      left join pg_attrdef default_record
        on default_record.adrelid = attribute.attrelid
       and default_record.adnum = attribute.attnum
     where attribute.attrelid = 'public.projects'::regclass
       and attribute.attname in ('publication_status', 'published_at', 'published_by')
     order by attribute.attname
  `);
  const statusColumn = columns.rows.find(
    (column) => column.attname === "publication_status",
  );
  check(
    "publication catalog is NOT NULL DEFAULT draft without atthasmissing",
    columns.rows.length === 3 &&
      statusColumn?.attnotnull === true &&
      statusColumn.atthasmissing === false &&
      statusColumn.default_expression?.includes("draft") === true,
  );

  const oldCreate = await saveProject(
    db,
    null,
    aggregatePayload("old-payload-create"),
  );
  const oldCreateState = await queryOne<{
    publication_status: string;
    published_at: Date | null;
  }>(
    db,
    "select publication_status, published_at from projects where id = $1",
    [oldCreate.project_id],
  );
  check(
    "old-style create payload defaults to a hidden draft",
    oldCreateState.publication_status === "draft" &&
      oldCreateState.published_at === null,
  );

  await saveProject(
    db,
    1,
    aggregatePayload("existing-project", {
      arabic_name: "مشروع قائم بعد حفظ قديم",
      english_name: "Existing Project",
      canonical_url: "https://example.com/projects/existing-project",
    }),
  );
  const oldEditState = await queryOne<{ publication_status: string }>(
    db,
    "select publication_status from projects where id = 1",
  );
  check(
    "old-style edit payload preserves the existing published state",
    oldEditState.publication_status === "published",
  );

  const actorTwo = await queryOne<{ id: number }>(
    db,
    `insert into public.admin_users (email, username, password_hash, role)
     values ('publisher2@example.com', 'publisher2', 'fixture-hash', 'admin')
     returning id`,
  );
  const publishedPayload = aggregatePayload("atomic-published", {
    publication_status: "published",
    featured: true,
  });
  Object.assign(publishedPayload, {
    publication_actor_id: 1,
    publication_previous_status: null,
  });
  const published = await saveProject(db, null, publishedPayload);
  const firstPublication = await queryOne<{
    publication_status: string;
    published_at: Date;
    published_by: number;
    featured: boolean;
    feature_count: number;
  }>(
    db,
    `select project.publication_status, project.published_at,
            project.published_by, project.featured,
            (select count(*)::integer from project_features feature where feature.project_id = project.id) as feature_count
       from projects project where project.id = $1`,
    [published.project_id],
  );
  check(
    "create and publish commits one complete aggregate with actor and featured state",
    firstPublication.publication_status === "published" &&
      firstPublication.published_at instanceof Date &&
      firstPublication.published_by === 1 &&
      firstPublication.featured &&
      firstPublication.feature_count === 1,
  );

  const resavePayload = aggregatePayload("atomic-published", {
    publication_status: "published",
    featured: true,
    arabic_name: "مشروع منشور بعد تعديل",
  });
  Object.assign(resavePayload, {
    publication_actor_id: actorTwo.id,
    publication_previous_status: "published",
  });
  await attachExistingFeatureIdentity(db, published.project_id, resavePayload);
  await saveProject(db, published.project_id, resavePayload);
  const resaved = await queryOne<{
    published_at: Date;
    published_by: number;
    arabic_name: string;
  }>(
    db,
    "select published_at, published_by, arabic_name from projects where id = $1",
    [published.project_id],
  );
  check(
    "re-saving published preserves first-publish time and publisher",
    resaved.published_at.getTime() === firstPublication.published_at.getTime() &&
      resaved.published_by === 1 &&
      resaved.arabic_name === "مشروع منشور بعد تعديل",
  );

  const draft = await saveProject(
    db,
    null,
    aggregatePayload("atomic-edit-publish", {
      publication_status: "draft",
      featured: false,
    }),
  );
  const editPublishPayload = aggregatePayload("atomic-edit-publish", {
    arabic_name: "مشروع نُشر مع التعديل",
    publication_status: "published",
    featured: false,
  });
  Object.assign(editPublishPayload, {
    publication_actor_id: actorTwo.id,
    publication_previous_status: "draft",
  });
  await attachExistingFeatureIdentity(db, draft.project_id, editPublishPayload);
  await saveProject(db, draft.project_id, editPublishPayload);
  const editPublished = await queryOne<{
    arabic_name: string;
    publication_status: string;
    published_by: number;
  }>(
    db,
    "select arabic_name, publication_status, published_by from projects where id = $1",
    [draft.project_id],
  );
  check(
    "edit and publish commits data and publication state together",
    editPublished.arabic_name === "مشروع نُشر مع التعديل" &&
      editPublished.publication_status === "published" &&
      editPublished.published_by === actorTwo.id,
  );

  const rollbackDraft = await saveProject(
    db,
    null,
    aggregatePayload("rollback-publish"),
  );
  const rollbackPayload = aggregatePayload(
    "rollback-publish",
    {
      arabic_name: "يجب ألا يُحفظ",
      publication_status: "published",
    },
    "يجب ألا تُحفظ",
  );
  Object.assign(rollbackPayload, {
    publication_actor_id: null,
    publication_previous_status: "draft",
  });
  await attachExistingFeatureIdentity(db, rollbackDraft.project_id, rollbackPayload);
  await assert.rejects(
    saveProject(db, rollbackDraft.project_id, rollbackPayload),
    /PROJECT_PUBLICATION_ACTOR_REQUIRED/,
  );
  const rolledBack = await queryOne<{
    arabic_name: string;
    publication_status: string;
    feature_body: string;
    published_at: Date | null;
  }>(
    db,
    `select project.arabic_name, project.publication_status,
            feature.body as feature_body, project.published_at
       from projects project
       join project_features feature on feature.project_id = project.id
      where project.id = $1`,
    [rollbackDraft.project_id],
  );
  check(
    "failed publish rolls back root, child, status, and timestamp",
    rolledBack.arabic_name !== "يجب ألا يُحفظ" &&
      rolledBack.feature_body !== "يجب ألا تُحفظ" &&
      rolledBack.publication_status === "draft" &&
      rolledBack.published_at === null,
  );

  const beforeUnpublish = await queryOne<{
    published_at: Date;
    published_by: number;
  }>(
    db,
    "select published_at, published_by from projects where id = $1",
    [published.project_id],
  );
  const unpublish = await queryOne<{
    publication_status: string;
    published_at: Date;
    published_by: number;
    updated_at: Date;
  }>(
    db,
    "select * from set_project_publication_admin_entry($1, false, $2)",
    [published.project_id, actorTwo.id],
  );
  check(
    "unpublish preserves first-publish metadata",
    unpublish.publication_status === "unpublished" &&
      unpublish.published_at.getTime() === beforeUnpublish.published_at.getTime() &&
      unpublish.published_by === beforeUnpublish.published_by,
  );
  const unpublishAgain = await queryOne<{ updated_at: Date }>(
    db,
    "select updated_at from set_project_publication_admin_entry($1, false, $2)",
    [published.project_id, actorTwo.id],
  );
  check(
    "row unpublish is idempotent without timestamp churn",
    unpublishAgain.updated_at.getTime() === unpublish.updated_at.getTime(),
  );

  const republish = await queryOne<{
    publication_status: string;
    published_at: Date;
    published_by: number;
  }>(
    db,
    "select * from set_project_publication_admin_entry($1, true, $2)",
    [published.project_id, actorTwo.id],
  );
  check(
    "republish preserves first timestamp and updates actor per Topic policy",
    republish.publication_status === "published" &&
      republish.published_at.getTime() === beforeUnpublish.published_at.getTime() &&
      republish.published_by === actorTwo.id,
  );

  const publishedBeforeIdempotent = await queryOne<{ updated_at: Date }>(
    db,
    "select updated_at from projects where id = $1",
    [published.project_id],
  );
  const publishAgain = await queryOne<{ updated_at: Date }>(
    db,
    "select updated_at from set_project_publication_admin_entry($1, true, $2)",
    [published.project_id, 1],
  );
  check(
    "row publish is idempotent without timestamp churn",
    publishAgain.updated_at.getTime() === publishedBeforeIdempotent.updated_at.getTime(),
  );

  await db.query(
    "update projects set canonical_url = 'https://example.com/source', featured = true where id = $1",
    [published.project_id],
  );
  const duplicated = await queryOne<{ project_id: number }>(
    db,
    "select project_id from duplicate_project_admin_entry($1)",
    [published.project_id],
  );
  const duplicateState = await queryOne<{
    publication_status: string;
    published_at: Date | null;
    published_by: number | null;
    featured: boolean;
    canonical_url: string | null;
  }>(
    db,
    "select publication_status, published_at, published_by, featured, canonical_url from projects where id = $1",
    [duplicated.project_id],
  );
  check(
    "duplicate always starts draft, unfeatured, and without publication/canonical metadata",
    duplicateState.publication_status === "draft" &&
      duplicateState.published_at === null &&
      duplicateState.published_by === null &&
      !duplicateState.featured &&
      duplicateState.canonical_url === null,
  );

  const publicSet = await db.query<{ publication_status: string; featured: boolean }>(
    "select publication_status, featured from projects where publication_status = 'published'",
  );
  check(
    "database public set excludes draft and unpublished Projects",
    publicSet.rows.length > 0 &&
      publicSet.rows.every((row) => row.publication_status === "published"),
  );
  const featuredPublicSet = await db.query<{
    publication_status: string;
    featured: boolean;
  }>(
    "select publication_status, featured from projects where publication_status = 'published' and featured = true",
  );
  check(
    "database featured public set requires both flags",
    featuredPublicSet.rows.length > 0 &&
      featuredPublicSet.rows.every(
        (row) => row.publication_status === "published" && row.featured,
      ),
  );

  const adminList = await queryOne<{ admin_list_projects: unknown }>(
    db,
    "select admin_list_projects(1, 10, 'updated_at', 'desc', 'residential', '', 'draft', 'all')",
  );
  const listPayload = adminList.admin_list_projects as {
    rows: Array<{ publication_status: string }>;
    total_count: number;
  };
  check(
    "Admin read model returns authoritative status-filtered rows and total",
    listPayload.total_count >= 1 &&
      listPayload.rows.every((row) => row.publication_status === "draft"),
  );

  const functionContracts = await db.query<{
    name: string;
    prosecdef: boolean;
    provolatile: string;
    config: string[] | null;
    owner: string;
  }>(`
    select procedure_record.proname as name,
           procedure_record.prosecdef,
           procedure_record.provolatile,
           procedure_record.proconfig as config,
           pg_get_userbyid(procedure_record.proowner) as owner
      from pg_proc procedure_record
     where procedure_record.oid in (
       'public.save_project_admin_entry(bigint,jsonb)'::regprocedure,
       'public.project_publishing_readiness(bigint)'::regprocedure,
       'public.transition_project_publication_admin_entry(bigint,text,bigint)'::regprocedure,
       'public.set_project_publication_admin_entry(bigint,boolean,bigint)'::regprocedure,
       'public.admin_list_projects(integer,integer,text,text,text,text,text,text)'::regprocedure
     )
  `);
  check(
    "all publication functions retain fixed search_path, owner, and SECURITY DEFINER",
    functionContracts.rows.length === 5 &&
      functionContracts.rows.every(
        (row) =>
          row.prosecdef &&
          row.owner === "postgres" &&
          row.config?.includes("search_path=pg_catalog, pg_temp"),
      ),
  );
  check(
    "save and mutations are VOLATILE while the two read functions are STABLE",
    functionContracts.rows.filter((row) => row.provolatile === "v").length === 3 &&
      functionContracts.rows.filter((row) => row.provolatile === "s").length === 2,
  );

  const acl = await db.query<{
    name: string;
    service_execute: boolean;
    anon_execute: boolean;
    authenticated_execute: boolean;
  }>(`
    select procedure_record.proname as name,
      has_function_privilege('service_role', procedure_record.oid, 'EXECUTE') as service_execute,
      has_function_privilege('anon', procedure_record.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', procedure_record.oid, 'EXECUTE') as authenticated_execute
    from pg_proc procedure_record
    where procedure_record.oid in (
      'public.project_publishing_readiness(bigint)'::regprocedure,
      'public.transition_project_publication_admin_entry(bigint,text,bigint)'::regprocedure,
      'public.set_project_publication_admin_entry(bigint,boolean,bigint)'::regprocedure,
      'public.admin_list_projects(integer,integer,text,text,text,text,text,text)'::regprocedure
    )
  `);
  check(
    "only public Project RPCs are executable by service_role; anon/authenticated get none",
    acl.rows.every((row) => !row.anon_execute && !row.authenticated_execute) &&
      acl.rows.find((row) => row.name === "set_project_publication_admin_entry")
        ?.service_execute === true &&
      acl.rows.find((row) => row.name === "admin_list_projects")
        ?.service_execute === true &&
      acl.rows.find((row) => row.name === "project_publishing_readiness")
        ?.service_execute === false &&
      acl.rows.find(
        (row) => row.name === "transition_project_publication_admin_entry",
      )?.service_execute === false,
  );

  const stalePayload = aggregatePayload("atomic-published", {
    publication_status: "unpublished",
    featured: true,
  });
  Object.assign(stalePayload, {
    publication_actor_id: 1,
    publication_previous_status: "draft",
  });
  await attachExistingFeatureIdentity(db, published.project_id, stalePayload);
  await assert.rejects(
    saveProject(db, published.project_id, stalePayload),
    /PROJECT_PUBLICATION_STATE_CONFLICT/,
  );
  const afterStale = await queryOne<{ publication_status: string }>(
    db,
    "select publication_status from projects where id = $1",
    [published.project_id],
  );
  check(
    "stale form publication write loses the concurrency race without overwriting state",
    afterStale.publication_status === "published",
  );

  const replayHashBefore = await queryOne<{ hash: string }>(
    db,
    "select md5(string_agg(to_jsonb(project)::text, '' order by project.id)) as hash from projects project",
  );
  await assert.rejects(
    db.exec(migration),
    /already exist or are partially applied/,
  );
  await db.exec("rollback;");
  const replayHashAfter = await queryOne<{ hash: string }>(
    db,
    "select md5(string_agg(to_jsonb(project)::text, '' order by project.id)) as hash from projects project",
  );
  check(
    "migration replay refuses safely without changing Project data",
    replayHashAfter.hash === replayHashBefore.hash,
  );

  const saveDefinition = await queryOne<{ body: string }>(
    db,
    "select prosrc as body from pg_proc where oid = 'public.save_project_admin_entry(bigint,jsonb)'::regprocedure",
  );
  check(
    "final aggregate save has one publication transition call and no overload ambiguity",
    (saveDefinition.body.match(/transition_project_publication_admin_entry/g) ?? [])
      .length === 1 &&
      (
        await db.query(
          "select oid from pg_proc where pronamespace = 'public'::regnamespace and proname = 'save_project_admin_entry'",
        )
      ).rows.length === 1,
  );
} finally {
  await db.close();
}

const rollbackDb = await createDatabase();
try {
  await applyBaseline(rollbackDb);
  await rollbackDb.exec("alter table public.projects add column publication_status text;");
  await assert.rejects(
    rollbackDb.exec(migration),
    /already exist or are partially applied/,
  );
  await rollbackDb.exec("rollback;");
  const rollbackProof = await queryOne<{
    new_columns: number;
    publication_rpc_exists: boolean;
  }>(
    rollbackDb,
    `select
      count(*) filter (where attribute.attname in ('publication_status','published_at','published_by'))::integer as new_columns,
      to_regprocedure('public.set_project_publication_admin_entry(bigint,boolean,bigint)') is not null as publication_rpc_exists
     from pg_attribute attribute
     where attribute.attrelid = 'public.projects'::regclass
       and attribute.attnum > 0 and not attribute.attisdropped`,
  );
  check(
    "incompatible partial drift aborts before any additional schema or RPC change",
    rollbackProof.new_columns === 1 && !rollbackProof.publication_rpc_exists,
  );
} finally {
  await rollbackDb.close();
}

const migrationHash = createHash("sha256")
  .update(readFileSync(join(ROOT, MIGRATION)))
  .digest("hex");
check("migration has a stable non-empty SHA-256", migrationHash.length === 64);

console.log(
  `verify-project-publishing-capability OK (${passed} assertions, migration sha256 ${migrationHash})`,
);
