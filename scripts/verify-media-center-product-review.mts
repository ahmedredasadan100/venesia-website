import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaginationItems } from "../src/components/pagination-model.ts";
import {
  isMediaListingShellPlaceholder,
  resolveMediaListingMainBlocks,
} from "../src/components/media-center/media-listing-shell-model.ts";
import {
  buildMediaHubModuleConfig,
  getDefaultMediaListingPresentation,
  parseMediaHubModuleConfig,
} from "../src/lib/media-hub-modules/parse-config.ts";
import type { ContentBlockConfig } from "../src/lib/page-blocks/configs.ts";
import type { ResolvedPageBlock } from "../src/lib/page-blocks/types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function paginationLabels(currentPage: number, totalPages: number) {
  return buildPaginationItems(currentPage, totalPages).map((item) =>
    item.type === "page" ? item.page : `${item.position}-ellipsis`,
  );
}

assert.deepEqual(paginationLabels(1, 5), [1, 2, 3, 4, 5]);
assert.deepEqual(paginationLabels(1, 20), [1, 2, 3, 4, 5, "end-ellipsis", 20]);
assert.deepEqual(paginationLabels(10, 20), [
  1,
  "start-ellipsis",
  9,
  10,
  11,
  "end-ellipsis",
  20,
]);
assert.deepEqual(paginationLabels(20, 20), [1, "start-ellipsis", 16, 17, 18, 19, 20]);

for (let currentPage = 1; currentPage <= 100; currentPage += 1) {
  const items = buildPaginationItems(currentPage, 100);
  const pages = items.flatMap((item) => (item.type === "page" ? [item.page] : []));
  assert.ok(items.length <= 7, "scalable pagination must stay bounded");
  assert.ok(pages.includes(currentPage), "scalable pagination must retain the active page");
  assert.equal(new Set(pages).size, pages.length, "page links must not be duplicated");
}

const legacyVideoConfig = parseMediaHubModuleConfig(
  { source: "topics", type: "video", limit: 6 },
  "videos",
);
assert.equal(legacyVideoConfig.limit, 6);
assert.equal(legacyVideoConfig.placement, "hub");
assert.ok(legacyVideoConfig.presentation.title);
assert.ok(legacyVideoConfig.presentation.ctaText);

const presentation = {
  eyebrow: "Video Stories",
  title: "مشاهد من فينيسيا",
  description: "وصف قابل للإدارة من الموديول.",
  ctaText: "شاهد كل الفيديوهات",
};
const managedVideoConfig = buildMediaHubModuleConfig(
  "videos",
  "topics",
  { limit: 6 },
  presentation,
);
assert.deepEqual(managedVideoConfig.presentation, presentation);
assert.deepEqual(
  parseMediaHubModuleConfig(managedVideoConfig, "videos").presentation,
  presentation,
);

const listingDefaults = getDefaultMediaListingPresentation("video");
const managedListingConfig = buildMediaHubModuleConfig(
  "videos",
  "topics",
  {},
  presentation,
  {
    placement: "listing",
    mediaType: "video",
    featuredMode: "manual",
    manualTopicId: 42,
    pageSize: 12,
    layout: "vertical",
    columns: 3,
    paginationEnabled: false,
    cardVariant: "compact",
    featuredCtaText: "شاهد الآن",
    cardCtaText: "شاهد التفاصيل",
  },
);
assert.equal(managedListingConfig.placement, "listing");
assert.deepEqual(managedListingConfig.listing, {
  featuredMode: "manual",
  manualTopicId: 42,
  pageSize: 12,
  layout: "vertical",
  columns: 3,
  paginationEnabled: false,
  cardVariant: "compact",
  featuredCtaText: "شاهد الآن",
  cardCtaText: "شاهد التفاصيل",
});
assert.equal(listingDefaults.featuredMode, "automatic");

function contentBlock(
  assignmentId: number,
  slug: string,
  config: ContentBlockConfig,
): Extract<ResolvedPageBlock, { blockType: "content" }> {
  return {
    assignmentId,
    blockType: "content",
    templateId: assignmentId,
    slot: "main",
    sortOrder: assignmentId,
    isVisible: true,
    template: {
      id: assignmentId,
      name: slug,
      slug,
      description: null,
      variant: "default",
      style_preset: "premium-dark",
      status: "published",
      sort_order: assignmentId,
      config,
    },
  };
}

const placeholderBlock = contentBlock(1, "media-center-news-listing-shell", {
  eyebrow: "",
  title: "Listing shell",
  subtitle: "Publish or replace to show CMS content above the listing.",
  body: "",
  alignment: "start",
});
const configuredBlock = contentBlock(2, "media-center-news-header", {
  eyebrow: "Latest Update",
  title: "أخبار فينيسيا",
  subtitle: "متابعة مستمرة من داخل الـCMS.",
});

assert.equal(isMediaListingShellPlaceholder(placeholderBlock), true);
assert.deepEqual(
  resolveMediaListingMainBlocks("media-center-news", [placeholderBlock]),
  [],
);

const emptySiteUpdatesShell = contentBlock(
  4,
  "media-center-site-updates-listing-shell",
  {
    eyebrow: "",
    title: "",
    subtitle: "",
    body: "",
    alignment: "start",
  },
);
assert.equal(isMediaListingShellPlaceholder(emptySiteUpdatesShell), true);
assert.deepEqual(
  resolveMediaListingMainBlocks("media-center-site-updates", [emptySiteUpdatesShell]),
  [],
);
assert.deepEqual(
  resolveMediaListingMainBlocks("media-center-news", [placeholderBlock, configuredBlock]),
  [configuredBlock],
);
assert.deepEqual(resolveMediaListingMainBlocks("media-center-news", []), []);

const partiallyManagedListingShell = contentBlock(
  3,
  "media-center-videos-listing-shell",
  {
    eyebrow: "Video Stories",
    title: "Listing shell",
    subtitle: "Publish or replace to show CMS content above the listing.",
    body: "Managed listing introduction.",
    alignment: "start",
  },
);
const [normalizedListingShell] = resolveMediaListingMainBlocks(
  "media-center-videos",
  [partiallyManagedListingShell],
);
assert.equal(normalizedListingShell?.blockType, "content");
if (normalizedListingShell?.blockType === "content") {
  assert.equal(normalizedListingShell.template.config.eyebrow, "Video Stories");
  assert.equal(normalizedListingShell.template.config.body, "Managed listing introduction.");
  assert.equal(normalizedListingShell.template.config.title, "");
  assert.equal(normalizedListingShell.template.config.subtitle, "");
}

const hubComponents = [
  "MediaCenterHubFeatured.tsx",
  "MediaCenterHubTimeline.tsx",
  "MediaCenterHubVideos.tsx",
  "MediaCenterHubGallery.tsx",
  "MediaCenterHubPress.tsx",
];
for (const component of hubComponents) {
  const source = read(`src/components/media-center/${component}`);
  assert.ok(
    source.includes("MediaCenterHubSectionHeader") && source.includes("presentation={presentation}"),
    `${component} must adopt the shared CMS presentation owner`,
  );
}

const videosSource = read("src/components/media-center/MediaCenterHubVideos.tsx");
assert.ok(videosSource.includes("smallVideos.map"));
assert.ok(!videosSource.includes("smallVideos.slice"));

const listingConfigSource = read("src/lib/media-center/listing-page-config.ts");
assert.ok(!/^\s+(title|eyebrow|description):/m.test(listingConfigSource));
assert.ok(!listingConfigSource.includes("showFeaturedNews"));
assert.ok(!listingConfigSource.includes("actionLabel"));

const shellConfigSource = read("src/lib/media-center-page-config.ts");
assert.ok(!/^\s+(title|eyebrow|subtitle):/m.test(shellConfigSource));

const listingContentSource = read("src/components/media-center/MediaListingContent.tsx");
assert.ok(!listingContentSource.includes("title: string"));
assert.ok(!listingContentSource.includes("eyebrow: string"));
assert.ok(!listingContentSource.includes("description: string"));
for (const contract of ["layout", "columns", "paginationEnabled", "cardVariant", "cardCtaText"]) {
  assert.ok(listingContentSource.includes(contract), `listing content must adopt ${contract}`);
}

const listingPageSource = read("src/components/media-center/MediaListingPage.tsx");
assert.ok(listingPageSource.includes("resolveMediaListingPresentation"));
assert.ok(listingPageSource.includes("resolveMediaListingFeaturedSelection"));
assert.ok(!listingPageSource.includes('presentation.featuredMode ==='));
assert.ok(listingPageSource.includes("MediaFeaturedHero"));
assert.ok(!listingPageSource.includes("FeaturedNews"));
const listingPresentationSource = read("src/lib/media-hub-modules/listing-presentation.ts");
assert.ok(listingPresentationSource.includes('module.config.placement === "listing"'));
assert.ok(listingPresentationSource.includes('featuredMode: "disabled"'));
assert.ok(listingPresentationSource.includes('presentation.featuredMode === "automatic"'));
assert.ok(listingPresentationSource.includes('{ mode: "automatic" }'));
assert.ok(listingPresentationSource.includes('{ mode: "manual", topicId: presentation.manualTopicId }'));

const shellSource = read("src/components/media-center/MediaCenterShellLayout.tsx");
assert.ok(shellSource.includes("resolveMediaListingMainBlocks"));
assert.ok(shellSource.includes("MediaListingShellPlaceholder"));
assert.ok(shellSource.includes("!composition.hasCompositionError"));
assert.ok(shellSource.includes("mainBlocks.length === 0"));
assert.ok(shellSource.includes("hasListingPresentationModule"));
assert.ok(shellSource.includes('module.config.placement === "listing"'));
assert.ok(!shellSource.includes("listingMainBlocks.length === 0"));

const listingRouteConsumers = {
  news: "news",
  videos: "videos",
  gallery: "gallery",
  press: "press",
  "site-updates": "site-updates",
} as const;
for (const [route, configKey] of Object.entries(listingRouteConsumers)) {
  const routeSource = read(`src/app/(site)/media-center/${route}/page.tsx`);
  assert.ok(
    routeSource.includes(`<MediaListingPage configKey="${configKey}"`),
    `${route} must adopt the shared Media Listing Page owner`,
  );
}

const cacheOwnerSource = read("src/lib/cache/revalidate-public-cache-tags.ts");
assert.ok(cacheOwnerSource.includes('import { revalidatePath, revalidateTag, updateTag } from "next/cache"'));
assert.ok(cacheOwnerSource.includes("updateTag(tag)"));
assert.match(
  cacheOwnerSource,
  /export function revalidatePageCompositionCache\(\) \{\s+updatePublicCacheTags\(PUBLIC_CACHE_TAG_GROUPS\.pageComposition\);\s+\}/,
  "Page Composition writes must expire their shared cache immediately",
);

const paginationSource = read("src/components/Pagination.tsx");
assert.ok(paginationSource.startsWith('"use client"'));
assert.ok(paginationSource.includes("useLayoutEffect"));
assert.ok(paginationSource.includes("retainedViewportTopRef"));
assert.ok(paginationSource.includes("window.scrollBy(0, delta)"));
assert.equal(
  paginationSource.match(/onNavigate=\{retainViewportPosition\}/g)?.length,
  3,
);

const editorSource = read("src/components/admin/page-blocks/MediaHubModuleEditClient.tsx");
for (const fieldName of ["eyebrow", "title", "presentation_description", "cta_text"]) {
  assert.ok(editorSource.includes(`name="${fieldName}"`), `missing CMS field ${fieldName}`);
}
for (const fieldName of [
  "featured_mode",
  "manual_topic_id",
  "page_size",
  "listing_layout",
  "listing_columns",
  "pagination_enabled",
  "card_variant",
  "featured_cta_text",
  "card_cta_text",
]) {
  assert.ok(editorSource.includes(`name="${fieldName}"`), `missing listing CMS field ${fieldName}`);
}

const actionSource = read("src/app/admin/pages-blocks/blocks/media-hub/actions.ts");
assert.ok(actionSource.includes("buildMediaHubModuleConfig"));
assert.ok(actionSource.includes('formData.get("presentation_description")'));
assert.ok(actionSource.includes('formData.get("cta_text")'));
assert.ok(actionSource.includes('formData.get("featured_mode")'));
assert.ok(actionSource.includes('formData.get("manual_topic_id")'));

const compositionSource = read("src/lib/page-blocks/load-page-composition.ts");
assert.ok(compositionSource.includes("queryMediaHubModules(pageSlug, { enrich: pageSlug === \"media-center\" })"));

const publicContractSource = read("src/lib/content/public-content-read/contract.ts");
const publicOwnerSource = read("src/lib/content/public-content-read/owner.ts");
const mediaProviderSource = read("src/lib/media-center/unified-provider.ts");
const hubDataSource = read("src/lib/media-hub-modules/resolve-hub-section-data.ts");
assert.ok(publicContractSource.includes("PublicContentFeaturedSelection"));
assert.ok(publicContractSource.includes("absence never falls back to latest"));
assert.ok(publicOwnerSource.includes("resolveFeaturedSelection"));
assert.ok(publicOwnerSource.includes('featured: "only"'));
assert.ok(!publicOwnerSource.includes("fallbackResult"));
assert.ok(!publicOwnerSource.includes("featured fallback"));
assert.ok(mediaProviderSource.includes("contentTypes: [params.type]"));
assert.ok(mediaProviderSource.includes("featuredSelection: params.featuredSelection"));
assert.ok(hubDataSource.includes('featuredSelection: { mode: "automatic" }'));
assert.ok(!hubDataSource.includes("news.find"));
assert.ok(!hubDataSource.includes("news[0]"));
assert.ok(editorSource.includes("المحتوى المميّز فقط"));
assert.ok(editorSource.includes("عند عدم وجود محتوى مميّز لن يظهر الـHero"));

const featuredOwnerCandidates = [
  "src/components/media-center/MediaListingPage.tsx",
  "src/lib/media-hub-modules/resolve-hub-section-data.ts",
  "src/lib/media-center/unified-provider.ts",
];
for (const candidate of featuredOwnerCandidates) {
  const source = read(candidate);
  assert.ok(
    !/featured[^\n]{0,120}(?:\?\?|\|\|)[^\n]{0,80}(?:latest|\[0\])/iu.test(source),
    `${candidate} must not own a Latest featured fallback`,
  );
}

const topicsClientSource = read("src/components/admin/content/TopicsListClient.tsx");
const instantMutationSource = read("src/lib/admin/entity-list/data-engine/instant-mutation.ts");
const featuredToggleQaSource = read("tests/e2e/qa-media-center-featured-toggle.mjs");
assert.ok(topicsClientSource.includes("useAdminEntityInstantMutation"));
assert.ok(topicsClientSource.includes("reconcileSuccess"));
assert.ok(topicsClientSource.includes("is_featured: confirmedFeatured"));
assert.ok(instantMutationSource.includes("request.optimistic(helpers)"));
assert.ok(instantMutationSource.includes("request.reconcileSuccess(result"));
assert.ok(instantMutationSource.includes('refetchType: "active"'));
for (const forbidden of ["router.refresh", "forceUpdate", "forceRerender", "setRows("]) {
  assert.ok(!topicsClientSource.includes(forbidden), `Topics Featured mutation must not use ${forbidden}`);
  assert.ok(!instantMutationSource.includes(forbidden), `Instant Mutation owner must not use ${forbidden}`);
}
for (const proof of [
  "Menu exposes the unfeature command",
  "Optimistic update changes aria-pressed before Server Action completion",
  "Spinner ends after reconcile and invalidation",
  "Final star is unfilled",
  "Final database truth is unfeatured",
  "Visibility row action remains available",
  "More row action remains available",
]) {
  assert.ok(featuredToggleQaSource.includes(proof), `Featured Toggle QA is missing: ${proof}`);
}

const listingMigration = read("sql/migrations/20260815092555_media_center_listing_presentation.sql");
for (const slug of [
  "media-listing-presentation-news",
  "media-listing-presentation-videos",
  "media-listing-presentation-gallery",
  "media-listing-presentation-press",
  "media-listing-presentation-site-updates",
]) {
  assert.ok(listingMigration.includes(slug), `missing seeded listing template ${slug}`);
}
assert.equal(listingMigration.match(/\"featuredMode\":\"automatic\"/g)?.length, 5);
assert.ok(!listingMigration.match(/create\s+(table|function|view|trigger)/iu));
assert.ok(listingMigration.includes("public.mutate_page_composition("));
assert.ok(listingMigration.includes("'sync_template_pages'"));
assert.ok(listingMigration.includes("'kind', 'media_hub'"));
assert.ok(listingMigration.includes("'default_slot', 'main'"));
assert.ok(listingMigration.includes("'page_ids', jsonb_build_array(v_listing.page_id)"));
assert.ok(!listingMigration.match(/insert\s+into\s+public\.page_media_hub_module_assignments/iu));

console.log("Media Center product review verification passed.");
