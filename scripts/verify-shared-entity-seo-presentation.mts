import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

import {
  ADMIN_ENTITY_SEO_ADOPTION_MANIFEST,
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE,
} from "../src/lib/admin/seo/entity-seo-adoption-manifest.ts";
import {
  ENTITY_SEO_FIELD_NAMES,
  readEntitySeoFormData,
  toEntitySeoPersistence,
  validateEntitySeoValues,
} from "../src/lib/seo/entity-seo-types.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const occurrences = (source: string, token: string) => source.split(token).length - 1;

const paths = {
  shared: "src/components/admin/seo/AdminEntitySeoPanel.tsx",
  contract: "src/lib/seo/entity-seo-types.ts",
  score: "src/lib/admin/seo-score.ts",
  loader: "src/lib/admin/content/load-unified-content.ts",
  topic: "src/components/admin/SeoPanel.tsx",
  project: "src/components/admin/projects/entry/ProjectSeoPanel.tsx",
  media: "src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx",
  mediaForm: "src/components/admin/content/editors/media/MediaContentForm.tsx",
  page: "src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx",
  migration: "sql/migrations/20260803153000_shared_entity_seo_capability.sql",
} as const;
const pageRoute = read("src/app/admin/pages-blocks/pages/[id]/page.tsx");
const pageClient = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
const pageAdminQueries = read("src/lib/page-blocks/admin-queries.ts");
const seoResolver = read("src/lib/seo/resolve-seo-metadata.ts");
const seoUtils = read("src/lib/seo/seo-utils.ts");

const source = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, read(path)]),
) as Record<keyof typeof paths, string>;

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const fieldNames = [
  "seoTitle",
  "seoDescription",
  "focusKeyword",
  "seoKeywords",
  "canonicalUrl",
  "robotsIndex",
  "robotsFollow",
  "ogImage",
  "ogImageAlt",
] as const;

check(
  "one existing Entity SEO module owns the final nine-field data and persistence contract",
  source.contract.includes("export const ENTITY_SEO_FIELD_NAMES") &&
    source.contract.includes("export type EntitySeoValues") &&
    source.contract.includes("export type EntitySeoPersistenceRecord") &&
    source.contract.includes("readEntitySeoFormData") &&
    source.contract.includes("toEntitySeoPersistence") &&
    source.contract.includes("validateEntitySeoValues") &&
    fieldNames.every((field) => source.contract.includes(`${field}:`)),
);

check(
  "one existing SEO Score owner exposes one input and one official output contract",
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.scoreContractOwner === paths.score &&
    source.score.includes("export type SeoScoreInput") &&
    source.score.includes("export type SeoScoreOutput") &&
    source.score.includes("export function analyzeEntitySeo(input: SeoScoreInput): SeoScoreOutput") &&
    source.score.includes("score: number") &&
    !source.score.includes("export function analyzeTopicSeo") &&
    !source.score.includes("export type EntitySeoScoreInput"),
);

check(
  "Editor, Entity List, and Metrics consume the same SEO Score contract and official score",
  source.shared.includes("analyzeEntitySeo(analysisInput)") &&
    source.shared.includes("{analysis.score}") &&
    source.shared.includes("analysis.metrics.map") &&
    source.shared.includes("analysisExtension.resolveFaq(analysisState)") &&
    !source.shared.includes(".overallScore") &&
    !source.shared.includes(".seoScore") &&
    !source.shared.includes("analysisExtension?.analyze") &&
    source.loader.includes("return analyzeEntitySeo({") &&
    source.loader.includes("}).score") &&
    source.loader.includes("getUnifiedContentSeoScore(row)") &&
    !source.loader.includes("analyzeTopicSeo") &&
    !source.loader.includes(".overallScore") &&
    !source.loader.includes(".seoScore"),
);

check(
  "all eligible editor declarations submit the complete SEO Score input contract",
  source.topic.includes('profile: "article"') &&
    source.topic.includes("faq: props.faq ?? []") &&
    [source.project, source.media, source.page].every(
      (adapter) => adapter.includes('profile: "entity"') && adapter.includes("faq: []"),
    ),
);

check(
  "the migration makes Topic and Page schemas match the established Project SEO column contract",
  ["public.topics", "public.pages"].every((table) => source.migration.includes(`alter table ${table}`)) &&
    ["focus_keyword", "canonical_url", "robots_index", "robots_follow", "og_image", "og_image_alt"].every(
      (column) => source.migration.includes(column),
    ) &&
    occurrences(source.migration, "alter column seo_keywords type text[]") === 2 &&
    occurrences(source.migration, "char_length(seo_title) <= 60") === 2 &&
    occurrences(source.migration, "char_length(seo_description) <= 160") === 2 &&
    occurrences(source.migration, "og_image is null or btrim(og_image_alt) <> ''") === 2,
);

check(
  "Topic, Project, Media Topic, and Page adapters all delegate presentation to the same owner",
  [source.topic, source.project, source.media, source.page].every(
    (adapter) => occurrences(adapter, "<AdminEntitySeoPanel") === 1,
  ) &&
    source.mediaForm.includes("<MediaEntitySeoPanel") &&
    !source.mediaForm.includes('name="seo_title"') &&
    !source.page.includes('name="seo_title"'),
);

check(
  "Page SEO adopts the shared Site Settings title template and current Page Composition copy",
  source.page.includes("seoTitleSuffix={props.titleSuffix}") &&
    source.page.includes('name="page_content" value={props.content}') &&
    source.page.includes("content: props.content") &&
    pageClient.includes("content={seo.content}") &&
    pageClient.includes("titleSuffix={seo.titleSuffix}") &&
    pageRoute.includes("getSeoTitleSuffix(globalSeo)") &&
    pageRoute.includes("assignmentsData.seoContent") &&
    pageAdminQueries.includes("extractPageBlockSeoText") &&
    pageAdminQueries.includes("isPageModulePubliclyVisible"),
);

check(
  "one SEO metadata owner composes the final title without a persisted parallel template",
  seoUtils.includes("export function getSeoTitleSuffix") &&
    seoUtils.includes("export function composeSeoTitle") &&
    seoResolver.includes("getSeoTitleSuffix(global)") &&
    seoResolver.includes("composeSeoTitle(") &&
    source.shared.includes("data-admin-seo-title-template") &&
    source.shared.includes("effectiveSeoTitle"),
);

check(
  "the historical entity-fallback presentation contract is removed",
  !source.shared.includes("entity_fallback") &&
    !source.topic.includes("entity_fallback") &&
    !source.shared.includes("data-admin-entity-seo-social-source") &&
    occurrences(source.shared, "<AdminMediaImageField") === 1 &&
    source.shared.includes("name={fieldNames.ogImage}") &&
    source.shared.includes("name={fieldNames.ogImageAlt}"),
);

check(
  "Open Graph preview uses explicit override, entity image, then the actual resolved fallback",
  source.shared.includes("const previewImage =") &&
    source.shared.includes("live.ogImage.trim()") &&
    source.shared.includes("live.image.trim()") &&
    source.shared.includes("resolvedFallback?.image") &&
    source.shared.includes("live.ogImageAlt.trim()") &&
    source.shared.includes("resolvedFallback?.imageAlt") &&
    source.shared.includes("url(${previewImage})") &&
    source.shared.includes("aria-label={previewImageAlt || title}"),
);

const persistenceFiles = [
  read("src/app/admin/content/topics/article-actions/helpers.ts"),
  read("src/app/admin/content/topics/media-actions/helpers.ts"),
  read("src/app/admin/pages-blocks/pages/page-seo-actions.ts"),
  read("src/lib/admin/projects/project-entry-contract.ts"),
];
check(
  "every save owner reads or validates the shared persistence contract without a parallel field parser",
  persistenceFiles.every((file) => file.includes("readEntitySeoFormData")) &&
    persistenceFiles.every((file) => file.includes("validateEntitySeoValues") || file.includes("toEntitySeoPersistence")) &&
    persistenceFiles.slice(0, 3).every((file) => file.includes("toEntitySeoPersistence")),
);

const resolver = read("src/lib/seo/resolve-seo-metadata.ts");
const generator = read("src/lib/seo/generate-public-metadata.ts");
check(
  "public metadata has one EntitySeoData contract and no Page-specific parallel resolver contract",
  !source.contract.includes("PageSeoData") &&
    !source.contract.includes("pageSeo?:") &&
    !resolver.includes("input.pageSeo") &&
    generator.includes("mergeEntitySeoData(input.entitySeo, pageSeo)") &&
    resolver.includes("const entityOgImage = pickString(input.entitySeo?.ogImage)") &&
    resolver.indexOf("const entityOgImage") < resolver.indexOf("const specificImage") &&
    resolver.includes("entityOgImage,"),
);

check(
  "Topic, Project, Page, and Media public routes expose explicit OG alt, canonical, and robots through the shared resolver",
  read("src/app/(site)/topics/[slug]/page.tsx").includes("ogImageAlt: topic.ogImage") &&
    read("src/app/(site)/projects/[slug]/page.tsx").includes("ogImageAlt: project.seo.ogImage?.alt") &&
    read("src/app/(site)/[...slug]/page.tsx").includes("entitySeoDataFromPersistence(page)") &&
    ["canonical: item.canonicalUrl", "robotsIndex: item.robotsIndex", "robotsFollow: item.robotsFollow", "ogImageAlt: item.ogImageAlt"].every(
      (token) => read("src/lib/media-center/generate-media-detail-metadata.ts").includes(token),
    ),
);

check(
  "the shared Search Preview still owns canonical, title, description, Index, and Follow presentation",
  ["{canonical}", "{title}", "{description}", 'label="Robots"', 'label="Links"'].every(
    (token) => source.shared.includes(token),
  ) && source.shared.includes('data-admin-seo-control-order="index-follow-canonical"'),
);

check(
  "the canonical 45-60 and 120-160 standards drive presentation and affected validation",
  source.contract.includes("min: 45, max: 60") &&
    source.contract.includes("min: 120, max: 160") &&
    read("src/lib/admin/seo-length-standards.ts").includes("ENTITY_SEO_LIMITS") &&
    !read("src/app/admin/content/topics/article-actions/save.ts").includes("> 70") &&
    !read("src/lib/admin/content-workflow/topic-publish-validation.ts").includes("<= 170"),
);

check(
  "the shared owner remains form-neutral and owns the one accordion preview/analysis disclosure",
  !source.shared.includes("<form") &&
    occurrences(source.shared, "<AdminSingleOpenAccordion") === 1 &&
    source.shared.includes("search-result-preview") &&
    source.shared.includes("open-graph-preview") &&
    source.shared.includes("live-seo-analysis"),
);

check(
  "correction buttons remain non-submitting and provide shared focus fallback after navigation",
  source.shared.includes('type="button"') &&
    source.shared.includes("new CustomEvent(navigationEventName") &&
    source.shared.includes("document.getElementById(target.targetId)") &&
    source.shared.includes("focus({ preventScroll: true })"),
);

check(
  "all eligible entity editors are closed while non-entity SEO utilities remain explicit exceptions",
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.globalClosed === true &&
    ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.allowedClaim === "eligible_entity_seo_capability_closed" &&
    !ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.some((entry) => entry.classification === ("legacy_generic_gap" as never)) &&
    ["topic-article-seo", "project-seo", "page-seo", "media-topic-seo"].every((id) =>
      ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.some((entry) => entry.id === id && entry.classification === "adopted"),
    ) &&
    ["global-seo-settings", "seo-redirects", "sitemap-monitor", "category-series-seo"].every((id) =>
      ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.some((entry) => entry.id === id && entry.classification !== "adopted"),
    ),
);

check(
  "every recorded manifest source exists",
  ADMIN_ENTITY_SEO_ADOPTION_MANIFEST.every((entry) =>
    entry.sourceFiles.every((sourceFile) => existsSync(sourceFile)),
  ),
);

const formData = new FormData();
formData.set(ENTITY_SEO_FIELD_NAMES.seoTitle, "  عنوان موحّد  ");
formData.set(ENTITY_SEO_FIELD_NAMES.seoDescription, "  وصف موحّد  ");
formData.set(ENTITY_SEO_FIELD_NAMES.focusKeyword, "  كلمة  ");
formData.set(ENTITY_SEO_FIELD_NAMES.seoKeywords, "alpha، beta, alpha");
formData.set(ENTITY_SEO_FIELD_NAMES.canonicalUrl, "https://example.com/entity");
formData.set(ENTITY_SEO_FIELD_NAMES.robotsIndex, "false");
formData.set(ENTITY_SEO_FIELD_NAMES.robotsFollow, "true");
formData.set(ENTITY_SEO_FIELD_NAMES.ogImage, "/images/entity-og.jpg");
formData.set(ENTITY_SEO_FIELD_NAMES.ogImageAlt, "  صورة المشاركة  ");
const parsed = readEntitySeoFormData(formData);
const persisted = toEntitySeoPersistence(parsed);
check(
  "the shared form and persistence contract normalizes all nine fields once",
  parsed.seoTitle === "عنوان موحّد" &&
    parsed.seoKeywords.join("|") === "alpha|beta" &&
    persisted.canonical_url === "https://example.com/entity" &&
    persisted.robots_index === false &&
    persisted.robots_follow === true &&
    persisted.og_image === "/images/entity-og.jpg" &&
    persisted.og_image_alt === "صورة المشاركة",
);

check(
  "the shared validator rejects invalid canonical and an OG override without alt text",
  validateEntitySeoValues({
    ...parsed,
    canonicalUrl: "/relative-path",
    ogImageAlt: "",
  }).some((issue) => issue.field === ENTITY_SEO_FIELD_NAMES.canonicalUrl) &&
    validateEntitySeoValues({
      ...parsed,
      canonicalUrl: "",
      ogImageAlt: "",
    }).some((issue) => issue.field === ENTITY_SEO_FIELD_NAMES.ogImageAlt),
);

const database = await PGlite.create();
try {
  await database.exec(`
    create schema if not exists public;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create table public.topic_categories (
      id bigint primary key,
      name text,
      slug text,
      color_token text
    );
    create table public.topic_series (
      id bigint primary key,
      name text,
      slug text
    );
    create table public.admin_users (
      id bigint primary key,
      full_name text,
      email text
    );
    create table public.topics (
      id bigint primary key,
      slug text,
      title text not null,
      excerpt text,
      content text,
      image text,
      image_alt text,
      category_id bigint,
      series_id bigint,
      content_type text,
      media_payload jsonb,
      status text,
      is_featured boolean,
      is_popular boolean,
      published_at timestamptz,
      created_at timestamptz,
      updated_at timestamptz,
      created_by bigint,
      updated_by bigint,
      published_by bigint,
      views_count bigint,
      deleted_at timestamptz,
      seo_title text,
      seo_description text,
      focus_keyword text,
      seo_keywords jsonb default '[]'::jsonb,
      canonical_url text,
      robots_index boolean,
      robots_follow boolean,
      faq jsonb,
      date_label text
    );
    create table public.pages (
      id bigint primary key,
      title text not null,
      seo_title text,
      seo_description text,
      seo_keywords jsonb default '[]'::jsonb
    );
    create view public.admin_content_topics
    with (security_invoker = true)
    as
    select topics.id, topics.slug, topics.title, topics.seo_keywords
    from public.topics topics;
    grant all on public.admin_content_topics to anon, authenticated, service_role;
    insert into public.topics (
      id, slug, title, image_alt, seo_title, seo_description, focus_keyword,
      seo_keywords, canonical_url, robots_index, robots_follow
    ) values (
      1, 'topic-fallback', 'Topic fallback', 'Topic image alt', repeat('T', 61),
      repeat('D', 161), null, '["alpha", "beta"]'::jsonb, '/invalid', null, false
    );
    insert into public.pages (id, title, seo_title, seo_description, seo_keywords)
    values (1, 'Page fallback', null, null, '["gamma"]'::jsonb);
  `);
  await database.exec(source.migration);

  const columns = await database.query<{ table_name: string; column_name: string; data_type: string }>(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('topics', 'pages')
      and column_name in ('seo_keywords', 'focus_keyword', 'canonical_url', 'robots_index', 'robots_follow', 'og_image', 'og_image_alt')
  `);
  const keywordColumns = columns.rows.filter((column) => column.column_name === "seo_keywords");
  const topic = await database.query<{
    seo_title: string;
    seo_description: string;
    seo_keywords: string[];
    canonical_url: string | null;
  }>("select seo_title, seo_description, seo_keywords, canonical_url from public.topics where id = 1");
  const page = await database.query<{ focus_keyword: string; seo_keywords: string[]; og_image_alt: string }>(
    "select focus_keyword, seo_keywords, og_image_alt from public.pages where id = 1",
  );
  const viewColumns = await database.query<{ column_name: string }>(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_content_topics'
  `);

  check(
    "the migration executes against the historical Topic and Page schemas and produces one SQL contract",
    keywordColumns.length === 2 &&
      keywordColumns.every((column) => column.data_type === "ARRAY") &&
      columns.rows.filter((column) => column.column_name !== "seo_keywords").length === 12 &&
      topic.rows[0]?.seo_title.length === 60 &&
      topic.rows[0]?.seo_description.length === 160 &&
      topic.rows[0]?.seo_keywords.join("|") === "alpha|beta" &&
      topic.rows[0]?.canonical_url === null &&
      page.rows[0]?.focus_keyword === "" &&
      page.rows[0]?.seo_keywords.join("|") === "gamma" &&
      page.rows[0]?.og_image_alt === "" &&
      ["seo_title", "seo_description", "focus_keyword", "seo_keywords", "canonical_url", "robots_index", "robots_follow", "og_image", "og_image_alt"].every(
        (column) => viewColumns.rows.some((viewColumn) => viewColumn.column_name === column),
      ),
  );

  await assert.rejects(
    database.exec("update public.pages set og_image = '/images/page.jpg', og_image_alt = '' where id = 1"),
  );
  check("the migrated database enforces paired Open Graph image alt text", true);
} finally {
  await database.close();
}

console.log(`\n${passed}/${passed} shared Entity SEO capability checks passed.`);
