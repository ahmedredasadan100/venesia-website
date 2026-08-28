import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

import { buildPaginationItems } from "../src/components/pagination-model.ts";
import { resolveDistinctHeroDescription } from "../src/lib/hero/hero-content-controls.ts";
import { isRetiredContentBlockTemplateSlug } from "../src/lib/page-blocks/deprecated-block-modules.ts";

const jiti = createJiti(import.meta.url);
const {
  buildMediaHubModuleConfig,
  getDefaultMediaListingPresentation,
  parseMediaHubModuleConfig,
} = await jiti.import<typeof import("../src/lib/media-hub-modules/parse-config.ts")>(
  "../src/lib/media-hub-modules/parse-config.ts",
);
const {
  getMediaHubCollectionCapabilities,
  getMediaHubPresentationVariantCapabilities,
} = await jiti.import<typeof import("../src/lib/media-hub-modules/presentation-contract.ts")>(
  "../src/lib/media-hub-modules/presentation-contract.ts",
);
const { resolveMediaListingConfig } = await jiti.import<
  typeof import("../src/lib/media-hub-modules/listing-presentation.ts")
>("../src/lib/media-hub-modules/listing-presentation.ts");

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
assert.deepEqual(paginationLabels(10, 20), [
  1,
  "start-ellipsis",
  9,
  10,
  11,
  "end-ellipsis",
  20,
]);
for (let currentPage = 1; currentPage <= 100; currentPage += 1) {
  const items = buildPaginationItems(currentPage, 100);
  const pages = items.flatMap((item) => (item.type === "page" ? [item.page] : []));
  assert.ok(items.length <= 7, "pagination must stay bounded");
  assert.ok(pages.includes(currentPage), "pagination must retain the active page");
}

const presentation = {
  eyebrow: "Featured Video",
  title: "فيديو مميز",
  description: "",
  ctaText: "كل الفيديوهات",
  collectionView: {
    layout: "editorial" as const,
    itemsPerRow: 2 as const,
    cardVariant: "default" as const,
  },
};
const contentHierarchy = {
  mode: "featured-first" as const,
  secondaryItemCount: 3,
};
const featuredConfig = buildMediaHubModuleConfig(
  "featured",
  "topics",
  4,
  contentHierarchy,
  presentation,
  {
    placement: "featured",
    mediaType: "video",
    itemLimit: 6,
    presentation: "grid",
    itemsPerRow: 2,
  },
);
assert.deepEqual(featuredConfig, {
  placement: "featured",
  source: "topics",
  type: "video",
  itemLimit: 4,
  contentHierarchy,
  presentation,
});
assert.equal(
  parseMediaHubModuleConfig(featuredConfig, "featured").type,
  "video",
  "Featured Content type must come from module config",
);

const hubFeaturedConfig = parseMediaHubModuleConfig(
  {
    placement: "hub",
    source: "topics",
    type: "press",
    featured: true,
    limit: 1,
    presentation,
  },
  "featured",
);
assert.equal(hubFeaturedConfig.placement, "hub");
assert.equal(hubFeaturedConfig.type, "press");
assert.equal(hubFeaturedConfig.itemLimit, 4);
assert.deepEqual(hubFeaturedConfig.contentHierarchy, contentHierarchy);
assert.equal("sideLimit" in hubFeaturedConfig, false);
assert.equal("listLimit" in hubFeaturedConfig, false);

const listingConfig = buildMediaHubModuleConfig(
  "videos",
  "topics",
  4,
  contentHierarchy,
  presentation,
  {
    placement: "listing",
    mediaType: "video",
    itemLimit: 12,
    presentation: "list",
    itemsPerRow: 3,
    display: {
      title: true,
      image: false,
      excerpt: true,
      date: false,
      category: true,
      series: false,
      details: {
        text: "عرض التفاصيل",
        visible: true,
        bold: false,
        alignment: "left",
      },
    },
  },
);
assert.equal(listingConfig.placement, "listing");
assert.deepEqual(listingConfig.listing, {
  itemLimit: 12,
  presentation: "list",
  itemsPerRow: 3,
  display: {
    title: true,
    image: false,
    excerpt: true,
    date: false,
    category: true,
    series: false,
    details: {
      text: "عرض التفاصيل",
      visible: true,
      bold: false,
      alignment: "left",
    },
  },
});
const resolvedAssignedListing = resolveMediaListingConfig(
  {
    modules: [{ isVisible: true, config: listingConfig }],
  } as never,
  "news",
);
assert.equal(
  resolvedAssignedListing.contentType,
  "video",
  "the assigned module Content Type must override the route fallback",
);
assert.deepEqual(resolvedAssignedListing.presentation, listingConfig.listing);
assert.equal("featuredMode" in getDefaultMediaListingPresentation(), false);

const legacyPressFeatured = parseMediaHubModuleConfig(
  {
    placement: "hub",
    source: "topics",
    contentHierarchy: { mode: "uniform", secondaryItemCount: 3 },
    presentation: {
      ...presentation,
      collectionView: {
        layout: "carousel",
        itemsPerRow: 4,
        cardVariant: "default",
      },
    },
  },
  "press",
);
assert.equal(legacyPressFeatured.presentation.collectionView.layout, "featured");
assert.equal(legacyPressFeatured.contentHierarchy?.mode, "uniform");

const legacyHierarchyPresentation = parseMediaHubModuleConfig(
  {
    placement: "hub",
    source: "topics",
    contentHierarchy: { mode: "featured-first", secondaryItemCount: 3 },
    presentation: {
      ...presentation,
      collectionView: {
        layout: "grid",
        itemsPerRow: 3,
        cardVariant: "compact",
      },
    },
  },
  "videos",
);
assert.equal(legacyHierarchyPresentation.presentation.collectionView.layout, "editorial");
assert.equal(legacyHierarchyPresentation.contentHierarchy?.mode, "featured-first");

const authoritativeMosaicPresentation = buildMediaHubModuleConfig(
  "gallery",
  "topics",
  5,
  { mode: "featured-first", secondaryItemCount: 4 },
  {
    ...presentation,
    collectionView: {
      layout: "mosaic",
      itemsPerRow: 3,
      cardVariant: "default",
    },
  },
);
assert.equal(authoritativeMosaicPresentation.presentation.collectionView.layout, "mosaic");
assert.equal(authoritativeMosaicPresentation.contentHierarchy?.mode, "featured-first");
assert.equal(
  parseMediaHubModuleConfig(authoritativeMosaicPresentation, "gallery")
    .presentation.collectionView.layout,
  "mosaic",
);

const expectedPresentationVariants = {
  featured: ["editorial", "featured", "grid", "list"],
  "site-updates": ["timeline", "timeline-digest", "editorial", "featured", "grid", "list"],
  videos: ["editorial", "mosaic", "grid", "list"],
  gallery: ["mosaic", "editorial", "grid", "list"],
  press: ["featured", "editorial", "grid", "list"],
} as const;

for (const sectionKey of ["featured", "site-updates", "videos", "gallery", "press"] as const) {
  const capabilities = getMediaHubCollectionCapabilities(sectionKey);
  assert.deepEqual(capabilities.view.layouts, expectedPresentationVariants[sectionKey]);
  assert.equal(
    getMediaHubPresentationVariantCapabilities(sectionKey, "list").itemsPerRow,
    false,
  );
  assert.equal(
    getMediaHubPresentationVariantCapabilities(sectionKey, "editorial").contentHierarchyMode,
    "featured-first",
  );
}
for (const sectionKey of ["videos", "gallery"] as const) {
  const capabilities = getMediaHubCollectionCapabilities(sectionKey);
  assert.ok(capabilities.view.layouts.includes("mosaic"));
  assert.ok(!capabilities.view.layouts.includes("featured"));
  assert.deepEqual(
    getMediaHubPresentationVariantCapabilities(sectionKey, "mosaic"),
    {
      itemsPerRow: false,
      cardVariant: false,
      contentHierarchyMode: "featured-first",
    },
  );
}
assert.equal(
  getMediaHubPresentationVariantCapabilities("press", "featured").itemsPerRow,
  true,
);
assert.ok(getMediaHubCollectionCapabilities("site-updates").view.layouts.includes("timeline"));
assert.equal(
  getMediaHubPresentationVariantCapabilities("site-updates", "timeline").cardVariant,
  false,
);
assert.deepEqual(
  getMediaHubPresentationVariantCapabilities("site-updates", "timeline-digest"),
  {
    itemsPerRow: false,
    cardVariant: false,
    contentHierarchyMode: "uniform",
  },
);

const timelineDigestConfig = buildMediaHubModuleConfig(
  "site-updates",
  "topics",
  4,
  { mode: "featured-first", secondaryItemCount: 4 },
  {
    ...presentation,
    collectionView: {
      layout: "timeline-digest",
      itemsPerRow: 4,
      cardVariant: "compact",
    },
  },
);
assert.equal(timelineDigestConfig.presentation.collectionView.layout, "timeline-digest");
assert.equal(timelineDigestConfig.contentHierarchy?.mode, "uniform");
assert.equal(
  parseMediaHubModuleConfig(timelineDigestConfig, "site-updates")
    .presentation.collectionView.layout,
  "timeline-digest",
);

for (const slug of [
  "media-center-news-listing-shell",
  "media-center-videos-listing-shell",
  "media-center-gallery-listing-shell",
  "media-center-press-listing-shell",
  "media-center-site-updates-listing-shell",
]) {
  assert.equal(isRetiredContentBlockTemplateSlug(slug), true);
}
assert.equal(isRetiredContentBlockTemplateSlug("media-center-news-header"), false);
assert.equal(
  existsSync(resolve(ROOT, "src/components/media-center/media-listing-shell-model.ts")),
  false,
  "Listing Shell runtime owner must be deleted",
);

const heroOwner = read("src/lib/load-hero-section.ts");
for (const forbidden of [
  "loadPublicContentCollection",
  "resolveHeroItems",
  "resolvedItems",
  "featured_media",
  "latest_media",
  "latest_topics",
]) {
  assert.ok(!heroOwner.includes(forbidden), `Hero owner must not contain ${forbidden}`);
}
assert.ok(heroOwner.includes('source_type: "manual"'));
assert.ok(heroOwner.includes("source_id: null"));
assert.ok(heroOwner.includes("source_slug: null"));

const dynamicHero = read("src/components/sections/DynamicHeroSection.tsx");
assert.ok(dynamicHero.includes("resolveDistinctHeroDescription"));
assert.ok(!dynamicHero.includes("resolvedItems"));
assert.ok(!dynamicHero.includes("data-hero-featured-topic"));
assert.ok(!dynamicHero.includes("featuredItem"));
assert.equal(
  resolveDistinctHeroDescription(
    "<p>متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.</p>",
    "متابعة ميدانية لمراحل التنفيذ داخل مشروعات فينيسيا.",
  ),
  "",
);

const heroEditor = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx");
const heroManager = read("src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx");
const heroActions = read("src/app/admin/pages-blocks/blocks/hero/actions.ts");
for (const source of [heroEditor, heroManager]) {
  for (const retiredControl of ['name="source_type"', 'name="source_slug"', 'name="limit_count"']) {
    assert.ok(!source.includes(retiredControl), `Hero Admin must retire ${retiredControl}`);
  }
}
assert.match(
  heroActions,
  /source_type:\s*isDomainBackedHeroTemplateVariant\(variant\)\s*\?\s*"domain-backed"\s*:\s*"manual"/,
  "Hero template writes must classify domain-backed variants without reviving Media Center content sourcing",
);
assert.equal(heroActions.match(/source_type: "manual"/g)?.length, 1);
assert.equal(heroActions.match(/source_id: null/g)?.length, 3);
assert.equal(heroActions.match(/source_slug: null/g)?.length, 3);

const featuredResolver = read("src/lib/media-hub-modules/resolve-hub-section-data.ts");
assert.ok(featuredResolver.includes("getFeaturedMediaItems(type, 1)"));
assert.ok(featuredResolver.includes('config.placement === "listing"'));
assert.ok(!featuredResolver.includes("getMediaListingPage"));
assert.ok(!featuredResolver.includes("latestNews"));
assert.ok(!featuredResolver.includes("featuredNews"));
assert.ok(!featuredResolver.includes("news[0]"));

const publicFacade = read("src/lib/media-center.ts");
const publicProvider = read("src/lib/media-center/unified-provider.ts");
const publicOwner = read("src/lib/content/public-content-read/owner.ts");
assert.ok(publicFacade.includes("unifiedGetMediaItemsLimited"));
assert.ok(publicFacade.includes("featuredOnly: true"));
assert.ok(publicProvider.includes('featured: options.featuredOnly ? "only" : "none"'));
assert.ok(publicOwner.includes("loadPublicContentCollection"));
assert.ok(!publicOwner.includes("fallbackResult"));

const featuredComponent = read("src/components/media-center/MediaCenterHubFeatured.tsx");
assert.ok(featuredComponent.startsWith('"use client"'));
assert.ok(featuredComponent.includes("contentHierarchy?.secondaryItemCount"));
assert.ok(featuredComponent.includes("presentation.collectionView"));
assert.ok(featuredComponent.includes("useState"));
assert.ok(featuredComponent.includes("sliderEnabled"));
assert.ok(featuredComponent.includes("data-featured-slider"));
assert.ok(featuredComponent.includes("data-slider-news-group"));
assert.ok(featuredComponent.includes("aria-current"));
assert.ok(!featuredComponent.includes("latest"));

const listingPage = read("src/components/media-center/MediaListingPage.tsx");
const mediaCompositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
const slotRenderPlan = read("src/components/page-composition/build-slot-render-plan.ts");
const venisiaMediaHubLayout = read("src/components/page-composition/VenesiaThemeMediaHubLayout.tsx");
assert.ok(mediaCompositionLoader.includes('hubModule.config.placement === "listing"'));
assert.ok(mediaCompositionLoader.includes("slots[hubModule.slot].push"));
assert.ok(slotRenderPlan.includes('kind: "media-hub"'));
assert.ok(venisiaMediaHubLayout.includes("renderVenesiaThemeMediaHubNodes"));
assert.ok(
  !listingPage.includes("module.config.type === config.mediaType"),
  "Featured Content type must come from assigned module config, not the route config",
);
assert.ok(listingPage.includes("resolveMediaListingConfig"));
assert.ok(listingPage.includes("resolvedModule.contentType"));
assert.ok(listingPage.includes("getMediaListingPage({"));
assert.ok(!listingPage.includes("ListingShell"));
assert.ok(!listingPage.includes("isMediaListingShellPublished"));
assert.ok(!listingPage.includes("featuredSelection"));
assert.ok(
  !listingPage.includes("featuredNodes") && !listingPage.includes("renderMediaHubSections"),
  "Featured Content must follow its Assignment Position through the shared slot renderer",
);

const shellLayout = read("src/components/media-center/MediaCenterShellLayout.tsx");
for (const forbidden of ["ListingShell", "listing-shell", "Placeholder", "hasListingPresentationModule"]) {
  assert.ok(!shellLayout.includes(forbidden), `Media layout must retire ${forbidden}`);
}
assert.ok(shellLayout.includes("<PageSlotLayout"));
assert.ok(shellLayout.includes("mainAfter={children}"));
assert.ok(!shellLayout.includes("getSlotBlocks") && !shellLayout.includes("SlotModulesRenderer"));

const compositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
assert.ok(compositionLoader.includes("queryMediaHubModules(pageSlug)"));
assert.ok(!compositionLoader.includes('pageSlug === "media-center"'));

const listingPresentation = read("src/lib/media-hub-modules/listing-presentation.ts");
assert.ok(listingPresentation.includes('module.config.placement === "listing"'));
for (const retiredField of ["featuredMode", "manualTopicId", "featuredSelection"]) {
  assert.ok(!listingPresentation.includes(retiredField));
}

const editor = read("src/components/admin/page-blocks/MediaHubModuleEditClient.tsx");
const action = read("src/app/admin/pages-blocks/blocks/media-hub/actions.ts");
const sharedCollectionEditor = read("src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx");
assert.ok(editor.includes('name="media_type"'));
assert.ok(editor.includes('name="placement" value={parsedInitial.placement}'));
assert.ok(editor.includes("نوع المحتوى المميز"));
assert.ok(editor.includes("CollectionPresentationFields"));
assert.ok(editor.includes("CollectionModuleEditor"));
assert.ok(editor.includes('label: "نوع المحتوى"'));
assert.ok(editor.includes('name: "content_type"'));
assert.ok(editor.includes('value: "list", label: "قائمة"'));
assert.ok(!editor.includes("شكل الكروت"));
assert.ok(!editor.includes("تفعيل ترقيم الصفحات"));
assert.ok(!editor.includes("نص زر الكارت"));
assert.ok(!editor.includes("نوع الموديول"));
assert.ok(!editor.includes('name="page_size"'));
assert.ok(!editor.includes('name="listing_layout"'));
assert.ok(!editor.includes('name="listing_columns"'));
assert.ok(!action.includes('formData.get("page_size")'));
assert.ok(!action.includes('formData.get("listing_layout")'));
assert.ok(!action.includes('formData.get("listing_columns")'));
assert.ok(!editor.includes("مصدر البيانات"));
assert.ok(action.includes('placementInput === "featured"'));
for (const fieldName of [
  "show_title_on_page",
  "show_image_on_page",
  "show_excerpt_on_page",
  "show_date_on_page",
  "show_category_on_page",
  "show_series_on_page",
]) {
  assert.ok(action.includes(`\"${fieldName}\"`));
}
assert.ok(action.includes("buildCollectionDetailsActionFromFormData(formData)"));
for (const detailsField of [
  'name="details_text"',
  'showName="show_details"',
  'boldName="details_bold"',
  'alignmentName="details_alignment"',
]) {
  assert.ok(sharedCollectionEditor.includes(detailsField));
}
for (const retiredField of ["side_limit", "list_limit", "featured_mode", "manual_topic_id"]) {
  assert.ok(!editor.includes(retiredField));
  assert.ok(!action.includes(retiredField));
}

const hierarchyOwner = read("src/lib/collection-modules/content-hierarchy.ts");
const viewOwner = read("src/lib/collection-modules/collection-view.ts");
const quantityOwner = read("src/lib/collection-modules/item-limit.ts");
const capabilityFields = read("src/components/admin/page-blocks/CollectionModuleFields.tsx");
const mediaCapabilityAdapter = read("src/lib/media-hub-modules/presentation-contract.ts");
const mediaListingResolver = read("src/lib/media-hub-modules/listing-presentation.ts");
const mediaListingPage = read("src/components/media-center/MediaListingPage.tsx");
const mediaListingContent = read("src/components/media-center/MediaListingContent.tsx");
const mediaListingCard = read("src/components/media-center/MediaContentCard.tsx");
const topicsListingPresenter = read("src/components/topics/TopicsListingModule.tsx");
const topicsListingCard = read("src/components/topics/TopicCard.tsx");
const sharedListingPresenter = read(
  "src/components/collection-modules/CollectionListingPresenter.tsx",
);
assert.ok(hierarchyOwner.includes('"uniform"'));
assert.ok(hierarchyOwner.includes('"featured-first"'));
assert.ok(hierarchyOwner.includes("secondaryItemCount"));
assert.ok(!hierarchyOwner.includes("MediaHub"));
assert.ok(viewOwner.includes("CollectionViewCapabilities"));
assert.ok(viewOwner.includes("itemsPerRow"));
assert.ok(viewOwner.includes("getCollectionViewVariantCapabilities"));
assert.ok(viewOwner.includes("legacyLayoutAliases"));
assert.ok(!viewOwner.includes("MediaHub"));
assert.ok(quantityOwner.includes("parseCollectionItemLimit"));
assert.ok(capabilityFields.includes('name="item_limit"'));
assert.ok(capabilityFields.includes('name="content_hierarchy_mode"'));
assert.ok(capabilityFields.includes('name="secondary_item_count"'));
assert.ok(capabilityFields.includes('name="collection_layout"'));
assert.ok(capabilityFields.includes('name="items_per_row"'));
assert.ok(capabilityFields.includes('name="collection_card_variant"'));
assert.ok(capabilityFields.includes('label="طريقة العرض"'));
assert.ok(capabilityFields.includes('activeLayout === "featured"'));
assert.ok(capabilityFields.includes('mosaic: "فسيفساء بصرية"'));
assert.ok(capabilityFields.includes('timeline: "خط زمني بالبطاقات"'));
assert.ok(capabilityFields.includes('"timeline-digest": "موجز زمني"'));
assert.ok(sharedCollectionEditor.includes("ContentDisplaySettings"));
assert.ok(
  sharedCollectionEditor.includes(
    "sm:col-span-2 lg:col-start-3 lg:row-start-1 lg:row-span-2",
  ),
);
assert.ok(!sharedCollectionEditor.includes("additionalSettings"));
assert.ok(mediaListingResolver.includes("resolveMediaListingConfig"));
assert.ok(mediaListingPage.includes("resolvedModule.contentType"));
assert.ok(mediaListingPage.includes("displayOverrides={presentation.display}"));
assert.ok(mediaListingPage.includes("page?: string"));
assert.ok(mediaListingPage.includes("requestedPage"));
assert.ok(mediaListingPage.includes("currentPage={listing.currentPage}"));
assert.ok(mediaListingPage.includes("totalPages={listing.totalPages}"));
assert.ok(mediaListingCard.includes("displayOverrides: CollectionDisplayOverrides"));
assert.ok(mediaListingCard.includes("<CollectionListingCard"));
assert.ok(!mediaListingCard.includes("MediaListingCardVariant"));
assert.ok(!mediaListingPage.includes("paginationEnabled"));
assert.ok(!mediaListingPage.includes("cardVariant"));
assert.ok(!mediaListingPage.includes("cardCtaText"));
assert.ok(mediaListingContent.includes("<CollectionListingPresentation"));
assert.ok(mediaListingContent.includes('import Pagination from "../Pagination"'));
assert.ok(mediaListingContent.includes("currentPage={currentPage}"));
assert.ok(mediaListingContent.includes("totalPages={totalPages}"));
assert.ok(topicsListingPresenter.includes("<CollectionListingPresentation"));
assert.ok(topicsListingCard.includes("<CollectionListingCard"));
assert.ok(mediaListingCard.includes("<CollectionListingCard"));
assert.ok(!mediaListingContent.includes("GRID_COLUMN_CLASSES"));
assert.ok(!topicsListingPresenter.includes("GRID_COLUMNS"));
assert.ok(!sharedListingPresenter.includes("Pagination"));
assert.ok(sharedListingPresenter.includes("items.slice(0, itemLimit)"));
assert.ok(sharedListingPresenter.includes("GRID_COLUMN_CLASSES[itemsPerRow]"));
assert.ok(sharedListingPresenter.includes("display.details.visible"));
assert.ok(sharedListingPresenter.includes("display.details.text"));
assert.ok(!sharedListingPresenter.includes("اقرأ المزيد"));
for (const forbiddenDomain of [
  "topics",
  "media",
  "news",
  "gallery",
  "projects",
]) {
  assert.ok(
    !sharedListingPresenter.toLowerCase().includes(forbiddenDomain),
    `Shared Collection Presenter must not know ${forbiddenDomain}`,
  );
}
for (const sectionKey of ["featured", "site-updates", "videos", "gallery", "press"]) {
  assert.ok(mediaCapabilityAdapter.includes(`${sectionKey}:`) || mediaCapabilityAdapter.includes(`"${sectionKey}":`));
}
for (const presenterPath of [
  "src/components/media-center/MediaCenterHubFeatured.tsx",
  "src/components/media-center/MediaCenterHubTimeline.tsx",
  "src/components/media-center/MediaCenterHubVideos.tsx",
  "src/components/media-center/MediaCenterHubGallery.tsx",
  "src/components/media-center/MediaCenterHubPress.tsx",
]) {
  assert.ok(read(presenterPath).includes("presentation.collectionView"));
}

const mediaHubPresenter = read("src/components/media-center/renderMediaHubSections.tsx");
const featuredCollection = read("src/components/media-center/MediaCenterHubFeaturedCollection.tsx");
const editorialCollection = read("src/components/media-center/MediaCenterHubFeatured.tsx");
const mosaicCollection = read("src/components/media-center/MediaCenterHubMosaic.tsx");
const standardCollection = read("src/components/media-center/MediaCenterCollectionItems.tsx");
const timelineCollection = read("src/components/media-center/MediaCenterHubTimeline.tsx");
assert.ok(mediaHubPresenter.includes('layout === "featured"'));
assert.ok(mediaHubPresenter.includes('layout === "editorial"'));
assert.ok(mediaHubPresenter.includes('layout === "mosaic"'));
assert.ok(mediaHubPresenter.includes('sliderEnabled={data.kind === "featured"}'));
assert.ok(mediaHubPresenter.includes('showDateWhenAvailable={data.kind === "videos"}'));
assert.ok(!mediaHubPresenter.includes('hierarchyMode === "featured-first"'));
assert.ok(!mediaHubPresenter.includes('layout === "editorial" || data.kind === "featured"'));
assert.ok(mediaHubPresenter.indexOf('layout === "editorial"') < mediaHubPresenter.indexOf('data.kind === "featured"'));
assert.ok(featuredCollection.includes('1: "grid-cols-1"'));
assert.ok(featuredCollection.includes('2: "grid-cols-1 @xl/slot-module:grid-cols-2"'));
assert.ok(featuredCollection.includes('3: "grid-cols-1 @xl/slot-module:grid-cols-2"'));
assert.ok(featuredCollection.includes('4: "grid-cols-1 @md/slot-module:grid-cols-2 @xl/slot-module:grid-cols-4"'));
assert.ok(featuredCollection.includes("FEATURED_ACTION_LABELS"));
assert.ok(editorialCollection.includes('@2xl/slot-module:grid-cols-[1.1fr_0.9fr]'));
assert.ok(editorialCollection.includes('layout: "list"'));
assert.ok(editorialCollection.includes('cardVariant: "compact"'));
assert.ok(editorialCollection.includes('className="group block h-full"'));
assert.ok(editorialCollection.includes('@2xl/slot-module:[&>div]:auto-rows-fr'));
assert.ok(editorialCollection.includes("data-slider-news-group"));
assert.ok(editorialCollection.includes("@2xl/slot-module:row-start-2"));
assert.ok(editorialCollection.includes("showDateWhenAvailable"));
assert.ok(standardCollection.includes("showDateWhenAvailable"));
assert.ok(mosaicCollection.includes("contentHierarchy?.secondaryItemCount"));
assert.ok(mosaicCollection.includes('@xl/slot-module:grid-cols-[1.05fr_0.95fr]'));
assert.ok(mosaicCollection.includes("grid items-stretch gap-3"));
assert.ok(mosaicCollection.includes("@xl/slot-module:auto-rows-fr"));
assert.ok(mosaicCollection.includes("@xl/slot-module:aspect-auto"));
assert.ok(!mosaicCollection.includes('href="/media-center/gallery"'));
assert.ok(!mosaicCollection.includes('href="/media-center/videos"'));
assert.ok(timelineCollection.includes('layout === "timeline-digest"'));
assert.ok(timelineCollection.includes("data-presentation-variant={layout}"));
assert.ok(timelineCollection.includes("grid-cols-[92px_minmax(0,1fr)]"));
assert.ok(timelineCollection.includes('@xl/slot-module:grid-cols-[130px_1fr]'));
assert.ok(timelineCollection.includes('"flex h-full flex-col"'));
assert.ok(timelineCollection.includes("relative flex flex-1 flex-col gap-4"));
assert.ok(timelineCollection.includes('isTimelineDigest ? "256px" : "160px"'));
assert.ok(timelineCollection.includes('"mt-2 line-clamp-2 text-base font-semibold leading-7'));
assert.ok(timelineCollection.includes('"mt-2 line-clamp-2 text-xs leading-6'));
assert.ok(mediaHubPresenter.includes('className="h-full"'));
assert.equal(
  existsSync(resolve(ROOT, "src/components/media-center/MediaCenterHubTimelineDigest.tsx")),
  false,
);

const blockLoader = read("src/lib/page-blocks/load-page-blocks.ts");
const adminQueries = read("src/lib/page-blocks/admin-queries.ts");
assert.ok(blockLoader.includes("isRetiredContentBlockTemplateSlug"));
assert.ok(adminQueries.includes("activeContentTemplates"));

const listingRoutes = ["news", "videos", "gallery", "press", "site-updates"] as const;
for (const route of listingRoutes) {
  const source = read(`src/app/(site)/media-center/${route}/page.tsx`);
  assert.ok(source.includes(`<MediaListingPage configKey="${route}"`));
}

const migration = read("sql/migrations/20260816090000_media_center_hero_owner_closure.sql");
assert.ok(migration.includes("source_type = 'manual'"));
assert.ok(migration.includes("source_id = null"));
assert.ok(migration.includes("source_slug = null"));
assert.ok(migration.includes("public.mutate_page_composition("));
assert.ok(migration.includes("$retire_media_center_listing_shells$"));
assert.ok(migration.includes("$sync_media_center_featured_content$"));
assert.ok(migration.includes("$assert_media_center_owner_closure$"));
for (const slug of [
  "media-featured-content-news",
  "media-featured-content-videos",
  "media-featured-content-gallery",
  "media-featured-content-press",
  "media-featured-content-site-updates",
]) {
  assert.ok(migration.includes(`'${slug}'`), `missing Featured Content template ${slug}`);
}
assert.equal(migration.match(/\"placement\":\"featured\"/g)?.length, 5);
assert.equal(migration.match(/\"source\":\"topics\"/g)?.length, 5);
assert.equal(migration.match(/\"featured\":true/g)?.length, 5);
for (const contentType of ["news", "video", "gallery", "press", "site_update"]) {
  assert.ok(migration.includes(`\"type\":\"${contentType}\"`));
}
for (const retiredKey of ["featuredMode", "manualTopicId", "featuredCtaText"]) {
  assert.ok(migration.includes(`- '${retiredKey}'`));
}
assert.ok(!migration.match(/create\s+(table|function|view|trigger)/iu));
assert.ok(!migration.match(/insert\s+into\s+public\.page_(?:content_block|media_hub_module)_assignments/iu));

console.log("Media Center architecture correction verification passed.");
