import { normalizeVerificationText } from "./lib/verification-text.mjs";
import assert from "node:assert/strict";
import ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

import { buildPublicPaginationItems } from "../src/components/pagination-model.ts";
import { resolveDistinctHeroDescription } from "../src/lib/hero/hero-content-controls.ts";
import { isRetiredContentBlockTemplateSlug } from "../src/lib/page-blocks/deprecated-block-modules.ts";

const jiti = createJiti(import.meta.url);
const {
  buildMediaHubModuleConfig,
  getDefaultMediaListingPresentation,
  parseMediaHubModuleConfig,
} = await jiti.import<
  typeof import("../src/lib/media-hub-modules/parse-config.ts")
>("../src/lib/media-hub-modules/parse-config.ts");
const {
  getMediaHubCollectionCapabilities,
  getMediaHubPresentationVariantCapabilities,
} = await jiti.import<
  typeof import("../src/lib/media-hub-modules/presentation-contract.ts")
>("../src/lib/media-hub-modules/presentation-contract.ts");
const { resolveMediaListingConfig } = await jiti.import<
  typeof import("../src/lib/media-hub-modules/listing-presentation.ts")
>("../src/lib/media-hub-modules/listing-presentation.ts");
const {
  COLLECTION_MODULE_DISPLAY_FORMATTING_CAPABILITY,
  DEFAULT_COLLECTION_DETAILS_ACTION,
  buildCollectionModuleDisplayFormattingFromFormData,
  resolveCollectionModuleDisplayFormatting,
} = await jiti.import<typeof import("../src/lib/page-blocks/configs.ts")>(
  "../src/lib/page-blocks/configs.ts",
);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string) {
  return normalizeVerificationText(readFileSync(resolve(ROOT, path), "utf8"));
}

function paginationLabels(currentPage: number, totalPages: number) {
  return buildPublicPaginationItems(currentPage, totalPages).map((item) =>
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
  const items = buildPublicPaginationItems(currentPage, 100);
  const pages = items.flatMap((item) =>
    item.type === "page" ? [item.page] : [],
  );
  assert.ok(items.length <= 7, "pagination must stay bounded");
  assert.ok(
    pages.includes(currentPage),
    "pagination must retain the active page",
  );
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
  display: resolveCollectionModuleDisplayFormatting({}),
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

const listingDisplay = resolveCollectionModuleDisplayFormatting({
  title: true,
  image: false,
  excerpt: true,
  date: false,
  category: true,
  series: false,
  titleBold: false,
  titleAlignment: "center",
  categoryBold: true,
  categoryAlignment: "left",
  seriesBold: true,
  seriesAlignment: "center",
  excerptBold: true,
  excerptAlignment: "left",
  dateBold: true,
  dateAlignment: "center",
  details: {
    text: "عرض التفاصيل",
    visible: true,
    bold: false,
    alignment: "left",
  },
});
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
    display: listingDisplay,
  },
);
assert.equal(listingConfig.placement, "listing");
assert.deepEqual(listingConfig.listing, {
  itemLimit: 12,
  presentation: "list",
  itemsPerRow: 3,
  display: listingDisplay,
});
const resolvedAssignedListing = resolveMediaListingConfig(
  {
    assignmentId: 17,
    isVisible: true,
    config: listingConfig,
  } as never,
);
assert.ok(resolvedAssignedListing);
assert.equal(resolvedAssignedListing.assignmentId, 17);
assert.equal(
  resolvedAssignedListing.contentType,
  "video",
  "the assigned module Content Type must be the only Listing content source",
);
assert.deepEqual(resolvedAssignedListing.presentation, listingConfig.listing);
assert.equal(
  resolveMediaListingConfig({
    assignmentId: 18,
    isVisible: false,
    config: listingConfig,
  } as never),
  null,
  "a hidden Listing assignment must not resolve to fallback content",
);
assert.equal("featuredMode" in getDefaultMediaListingPresentation(), false);
assert.deepEqual(
  getDefaultMediaListingPresentation().display,
  resolveCollectionModuleDisplayFormatting({}),
);
assert.deepEqual(DEFAULT_COLLECTION_DETAILS_ACTION, {
  text: "اقرأ المزيد",
  visible: true,
  bold: false,
  alignment: "right",
});
assert.equal(
  COLLECTION_MODULE_DISPLAY_FORMATTING_CAPABILITY.id,
  "collection-module-display-formatting",
);
assert.equal(
  Object.keys(COLLECTION_MODULE_DISPLAY_FORMATTING_CAPABILITY.fields).length,
  7,
);

const formattingFormData = new FormData();
for (const field of ["title", "image", "category", "series", "excerpt", "date"]) {
  formattingFormData.set(`show_${field}_on_page`, "true");
}
for (const field of ["title", "category", "series", "excerpt", "date"]) {
  formattingFormData.set(`${field}_bold`, field === "title" ? "true" : "false");
  formattingFormData.set(`${field}_alignment`, field === "series" ? "left" : "right");
}
formattingFormData.set("details_text", "عرض التفاصيل");
formattingFormData.set("show_details", "true");
formattingFormData.set("details_bold", "false");
formattingFormData.set("details_alignment", "center");
const savedFormatting = buildCollectionModuleDisplayFormattingFromFormData(
  formattingFormData,
);
assert.equal(savedFormatting.seriesAlignment, "left");
assert.equal(savedFormatting.details.alignment, "center");

const parsedListingFormatting = parseMediaHubModuleConfig(
  {
    placement: "listing",
    source: "topics",
    type: "news",
    presentation,
    listing: {
      itemLimit: 6,
      presentation: "list",
      itemsPerRow: 3,
      display: savedFormatting,
    },
  },
  "site-updates",
).listing?.display;
assert.equal(parsedListingFormatting?.seriesAlignment, "left");
assert.equal(parsedListingFormatting?.details.alignment, "center");
const parsedHubFormatting = parseMediaHubModuleConfig(
  {
    placement: "hub",
    source: "topics",
    type: "video",
    itemLimit: 4,
    display: savedFormatting,
    presentation,
  },
  "videos",
).display;
assert.equal(parsedHubFormatting?.seriesAlignment, "left");
assert.equal(parsedHubFormatting?.details.alignment, "center");

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
assert.equal(
  legacyPressFeatured.presentation.collectionView.layout,
  "featured",
);
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
assert.equal(
  legacyHierarchyPresentation.presentation.collectionView.layout,
  "editorial",
);
assert.equal(
  legacyHierarchyPresentation.contentHierarchy?.mode,
  "featured-first",
);

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
assert.equal(
  authoritativeMosaicPresentation.presentation.collectionView.layout,
  "mosaic",
);
assert.equal(
  authoritativeMosaicPresentation.contentHierarchy?.mode,
  "featured-first",
);
assert.equal(
  parseMediaHubModuleConfig(authoritativeMosaicPresentation, "gallery")
    .presentation.collectionView.layout,
  "mosaic",
);

const expectedPresentationVariants = {
  featured: ["editorial", "featured", "grid", "list"],
  "site-updates": [
    "timeline",
    "timeline-digest",
    "editorial",
    "featured",
    "grid",
    "list",
  ],
  videos: ["editorial", "mosaic", "grid", "list"],
  gallery: ["mosaic", "editorial", "grid", "list"],
  press: ["featured", "editorial", "grid", "list"],
} as const;

for (const sectionKey of [
  "featured",
  "site-updates",
  "videos",
  "gallery",
  "press",
] as const) {
  const capabilities = getMediaHubCollectionCapabilities(sectionKey);
  assert.deepEqual(
    capabilities.view.layouts,
    expectedPresentationVariants[sectionKey],
  );
  assert.equal(
    getMediaHubPresentationVariantCapabilities(sectionKey, "list").itemsPerRow,
    false,
  );
  assert.equal(
    getMediaHubPresentationVariantCapabilities(sectionKey, "editorial")
      .contentHierarchyMode,
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
assert.ok(
  getMediaHubCollectionCapabilities("site-updates").view.layouts.includes(
    "timeline",
  ),
);
assert.equal(
  getMediaHubPresentationVariantCapabilities("site-updates", "timeline")
    .cardVariant,
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
assert.equal(
  timelineDigestConfig.presentation.collectionView.layout,
  "timeline-digest",
);
assert.equal(timelineDigestConfig.contentHierarchy?.mode, "uniform");
assert.equal(
  parseMediaHubModuleConfig(timelineDigestConfig, "site-updates").presentation
    .collectionView.layout,
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
assert.equal(
  isRetiredContentBlockTemplateSlug("media-center-news-header"),
  false,
);
assert.equal(
  existsSync(
    resolve(ROOT, "src/components/media-center/media-listing-shell-model.ts"),
  ),
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
  assert.ok(
    !heroOwner.includes(forbidden),
    `Hero owner must not contain ${forbidden}`,
  );
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

const heroEditor = read(
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
);
const heroManager = read(
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
);
const heroActions = read("src/app/admin/pages-blocks/blocks/hero/actions.ts");
for (const source of [heroEditor, heroManager]) {
  for (const retiredControl of [
    'name="source_type"',
    'name="source_slug"',
    'name="limit_count"',
  ]) {
    assert.ok(
      !source.includes(retiredControl),
      `Hero Admin must retire ${retiredControl}`,
    );
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

const featuredResolver = read(
  "src/lib/media-hub-modules/resolve-hub-section-data.ts",
);
assert.ok(!featuredResolver.includes("getFeaturedMediaItems"));
assert.ok(
  featuredResolver.includes('if (sectionKey === "featured") return null'),
);
assert.ok(featuredResolver.includes('config.placement === "listing"'));
assert.ok(!featuredResolver.includes("getMediaListingPage"));
assert.ok(!featuredResolver.includes("latestNews"));
assert.ok(!featuredResolver.includes("featuredNews"));
assert.ok(!featuredResolver.includes("news[0]"));

const publicFacade = read("src/lib/media-center.ts");
const publicProvider = read("src/lib/media-center/unified-provider.ts");
const publicOwner = read("src/lib/content/public-content-read/owner.ts");
assert.ok(publicFacade.includes("unifiedGetMediaItemsLimited"));
assert.ok(!publicFacade.includes("getFeaturedMediaItems"));
assert.ok(
  publicProvider.includes('featured: options.featuredOnly ? "only" : "none"'),
);
assert.ok(publicOwner.includes("loadPublicContentCollection"));
assert.ok(!publicOwner.includes("fallbackResult"));

const featuredComponent = read(
  "src/components/media-center/MediaCenterHubFeatured.tsx",
);
assert.ok(featuredComponent.startsWith('"use client"'));
assert.ok(featuredComponent.includes("contentHierarchy?.secondaryItemCount"));
assert.ok(featuredComponent.includes("presentation.collectionView"));
assert.ok(featuredComponent.includes('from "../../hooks/use-auto-carousel"'));
assert.ok(featuredComponent.includes('from "../feed-modules/FeedCarouselDots"'));
assert.ok(featuredComponent.includes("useAutoCarousel<HTMLDivElement>"));
assert.ok(featuredComponent.includes("<FeedCarouselDots"));
assert.ok(featuredComponent.includes("autoplay: false"));
assert.ok(!featuredComponent.includes("useState"));
assert.ok(!featuredComponent.includes("setActiveSliderIndex"));
assert.ok(featuredComponent.includes("sliderEnabled"));
assert.ok(featuredComponent.includes("data-featured-slider"));
assert.ok(featuredComponent.includes("data-slider-news-group"));
assert.ok(featuredComponent.includes("aria-current"));
assert.ok(!featuredComponent.includes("latest"));

const listingPage = read("src/components/media-center/MediaListingPage.tsx");
const listingModule = read("src/components/media-center/MediaListingModule.tsx");
const mediaCompositionLoader = read(
  "src/lib/page-blocks/load-page-composition.ts",
);
const slotRenderPlan = read(
  "src/components/page-composition/build-slot-render-plan.ts",
);
const venisiaMediaHubLayout = read(
  "src/components/page-composition/VenesiaThemeMediaHubLayout.tsx",
);
assert.ok(
  !mediaCompositionLoader.includes('hubModule.config.placement === "listing"'),
);
assert.ok(mediaCompositionLoader.includes("slots[hubModule.slot].push"));
assert.ok(slotRenderPlan.includes('kind: "media-hub"'));
assert.ok(venisiaMediaHubLayout.includes("renderVenesiaThemeMediaHubNodes"));
assert.ok(!listingPage.includes("resolveMediaListingConfig"));
assert.ok(!listingPage.includes("getMediaListingPage({"));
assert.ok(listingModule.includes("resolveMediaListingConfig(module)"));
assert.ok(listingModule.includes("getMediaListingPage({"));
assert.ok(listingModule.includes("resolved.contentType"));
assert.ok(listingModule.includes("data-media-listing-assignment"));
assert.ok(listingModule.includes("publicPath: string"));
assert.ok(listingModule.includes("basePath={publicPath}"));
assert.ok(!listingModule.includes('"/media-center/news"'));
assert.ok(!listingModule.includes("MediaPageShell"));
assert.ok(!listingPage.includes("ListingShell"));
assert.ok(!listingPage.includes("isMediaListingShellPublished"));
assert.ok(!listingPage.includes("featuredSelection"));
assert.ok(
  !listingPage.includes("featuredNodes") &&
    !listingPage.includes("renderMediaHubSections"),
  "Featured Content must follow its Assignment Position through the shared slot renderer",
);

const shellLayout = read(
  "src/components/media-center/MediaCenterShellLayout.tsx",
);
for (const forbidden of [
  "ListingShell",
  "listing-shell",
  "Placeholder",
  "hasListingPresentationModule",
]) {
  assert.ok(
    !shellLayout.includes(forbidden),
    `Media layout must retire ${forbidden}`,
  );
}
assert.ok(shellLayout.includes("<PageSlotLayout"));
assert.ok(
  shellLayout.includes(
    "listingContext={{ publicPath: pageIdentity.href, searchParams }}",
  ),
);
assert.ok(!shellLayout.includes("mainAfter="));
assert.ok(!shellLayout.includes("children:"));
assert.ok(
  !shellLayout.includes("getSlotBlocks") &&
    !shellLayout.includes("SlotModulesRenderer"),
);

const compositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
assert.ok(compositionLoader.includes("queryMediaHubModules(pageSlug)"));
assert.ok(!compositionLoader.includes('pageSlug === "media-center"'));
assert.ok(!compositionLoader.includes("isMediaCenterCmsPageSlug"));

const listingPresentation = read(
  "src/lib/media-hub-modules/listing-presentation.ts",
);
assert.ok(
  listingPresentation.includes('module.config.placement !== "listing"'),
);
assert.ok(!listingPresentation.includes(".find("));
for (const retiredField of [
  "featuredMode",
  "manualTopicId",
  "featuredSelection",
]) {
  assert.ok(!listingPresentation.includes(retiredField));
}

const editor = read(
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
);
const action = read("src/app/admin/pages-blocks/blocks/media-hub/actions.ts");
const mediaHubConfig = read("src/lib/media-hub-modules/parse-config.ts");
// Exercise the actual action's validation/config path before its first write.
// No alternate validation or serializer is implemented by this fixture.
const actionAst = ts.createSourceFile("media-hub/actions.ts", action, ts.ScriptTarget.Latest, true);
const updateNode = actionAst.statements.find(
  (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "updateMediaHubModule",
);
assert.ok(updateNode?.body);
const writeIndex = updateNode.body.statements.findIndex(node =>
  ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(actionAst) === "coordinated"),
);
assert.ok(writeIndex > 0);
const pureAction = ts.transpileModule(
  updateNode.body.statements.slice(0, writeIndex).map(node => node.getText(actionAst)).join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const actionUtils = await jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>("../src/lib/page-blocks/admin-utils.ts");
const mediaContract = await jiti.import<typeof import("../src/lib/media-hub-modules/presentation-contract.ts")>("../src/lib/media-hub-modules/presentation-contract.ts");
const mediaConfigContract = await jiti.import<typeof import("../src/lib/media-hub-modules/parse-config.ts")>("../src/lib/media-hub-modules/parse-config.ts");
const formattingContract = await jiti.import<typeof import("../src/lib/page-blocks/configs.ts")>("../src/lib/page-blocks/configs.ts");
let sessionAllowed = true, sessionCalls = 0;
const validateAndBuild = new Function("owners",
  "const {requireAdminSession,cleanText,parseNumber,parseFormStatus,parseMediaHubSectionKey,buildMediaHubModuleConfig,buildMediaHubContentHierarchy,buildMediaHubCollectionView,buildPageBlockTextFormattingPatch,buildCollectionModuleDisplayFormattingFromFormData}=owners;return async function(formData){" + pureAction + "\nreturn {id,...nextRow};}",
)({
  ...actionUtils, ...mediaContract, ...mediaConfigContract, ...formattingContract,
  requireAdminSession: async () => { sessionCalls++; if (!sessionAllowed) throw Error("Unauthorized fixture"); return { id: "isolated-actor" }; },
}) as (data: FormData) => Promise<{id: number; section_key: string; config: ReturnType<typeof buildMediaHubModuleConfig>}>;
const listingForm = (section = "featured", placement = "listing") => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "11", name: "Isolated News Listing", description: "internal description",
    section_key: section, placement, data_source: "topics", content_type: "news",
    item_limit: "12", presentation: "grid", items_per_row: "4", details_text: "تفاصيل *حرفية* <tag>",
    title: "عنوان محفوظ", eyebrow: "تمهيد محفوظ", presentation_description: "وصف محفوظ",
    cta_text: "استكشف", collection_layout: "editorial", collection_card_variant: "default",
    secondary_item_count: "3", content_hierarchy_mode: "featured-first",
    show_title_on_page: "true", title_bold: "true", title_alignment: "left",
    show_details: "true", details_alignment: "center", status: "published",
  })) form.set(key, value);
  return form;
};
const newsListing = await validateAndBuild(listingForm());
assert.equal(newsListing.section_key, "featured");
assert.equal(newsListing.config.placement, "listing");
assert.equal(newsListing.config.type, "news");
assert.equal(newsListing.config.listing?.itemsPerRow, 4);
assert.equal(newsListing.config.listing?.itemLimit, 12);
assert.equal(newsListing.config.listing?.display.details.text, "تفاصيل *حرفية* <tag>");
const reloadedNews = parseMediaHubModuleConfig(newsListing.config as never, "featured");
const publicNews = resolveMediaListingConfig({isVisible: true, assignmentId: 11, config: reloadedNews} as never);
assert.ok(publicNews);
assert.equal(publicNews.contentType, "news");
assert.deepEqual(publicNews.presentation, newsListing.config.listing);
for (const section of ["featured", "videos", "gallery", "press", "site-updates"]) {
  assert.equal((await validateAndBuild(listingForm(section))).config.placement, "listing");
}
for (const placement of ["hub", "featured", "", "invalid"]) {
  await assert.rejects(validateAndBuild(listingForm("featured", placement)), /المحتوى المميز يُدار من موديول Featured المستقل/);
}
const noPlacement = listingForm(); noPlacement.delete("placement");
await assert.rejects(validateAndBuild(noPlacement), /Featured/);
await assert.rejects(validateAndBuild(listingForm("invalid")), /نوع السكشن غير صالح/);
const invalidType = listingForm(); invalidType.set("content_type", "invalid");
await assert.rejects(validateAndBuild(invalidType), /نوع محتوى القائمة غير صالح/);
const invalidSource = listingForm(); invalidSource.set("data_source", "invalid");
await assert.rejects(validateAndBuild(invalidSource), /مصدر البيانات غير مدعوم/);
const missingName = listingForm(); missingName.delete("name");
await assert.rejects(validateAndBuild(missingName), /بيانات الموديول غير مكتملة/);
assert.equal((await validateAndBuild(listingForm("site-updates", "hub"))).config.placement, "hub");
sessionAllowed = false;
const beforeDenied = sessionCalls;
await assert.rejects(validateAndBuild(listingForm()), /Unauthorized fixture/);
assert.equal(sessionCalls, beforeDenied + 1);
assert.ok(action.includes('await requireAdminSession()'));
assert.ok(action.includes('saveModuleTemplateWithPageAssignments('));
console.log("PASS Media Hub action: listing+featured save/read/public contract; retired Featured, invalid section/source/type/identity and unauthorized requests remain rejected.");

const collectionHeader = read(
  "src/components/collection-modules/CollectionSectionHeader.tsx",
);
const collectionFields = read(
  "src/components/admin/page-blocks/CollectionModuleFields.tsx",
);
const sharedDisplayContract = read("src/lib/page-blocks/configs.ts");
const sharedCollectionEditor = read(
  "src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx",
);
const moduleRegistryMetadata = read(
  "src/lib/page-composition/module-registry-metadata.ts",
);
const mediaHubModuleRegistryMetadata = moduleRegistryMetadata.slice(
  moduleRegistryMetadata.indexOf('"media-hub": {'),
);
assert.ok(!editor.includes('name="media_type"'));
assert.ok(editor.includes('name="placement" value={parsedInitial.placement}'));
assert.ok(!editor.includes("نوع المحتوى المميز"));
assert.ok(editor.includes('.filter((key) => key !== "featured")'));
assert.ok(editor.includes("CollectionPresentationFields"));
assert.ok(editor.includes("CollectionModuleEditor"));
assert.ok(editor.includes('id: "presentation"'));
assert.ok(editor.includes('data-media-hub-editor-presentation=""'));
assert.ok(
  editor.includes("contextLabel={MEDIA_HUB_SECTION_LABELS[sectionKey]}"),
);
assert.ok(editor.includes('heading="تنسيق عناصر المحتوى"'));
assert.ok(!editor.includes("تكوين عرض المحتوى"));
assert.ok(mediaHubModuleRegistryMetadata.includes('navigationLabelAr: "العرض"'));
assert.ok(
  mediaHubModuleRegistryMetadata.includes(
    'sectionDescriptionAr: "حرّر نصوص السكشن مع بقاء إعدادات العرض في قسمها المستقل."',
  ),
);
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
assert.ok(!action.includes('placementInput === "featured"'));
assert.ok(action.includes('sectionKey === "featured"'));
for (const ctaControl of [
  'showName="show_cta"',
  'boldName="cta_bold"',
  'alignmentName="cta_alignment"',
]) {
  assert.ok(editor.includes(ctaControl));
}
assert.ok(action.includes('{ field: "cta" }'));
assert.ok(mediaHubConfig.includes('{ field: "cta" }'));
for (const publicCtaCapability of ["showCta", "ctaBold", "ctaAlignment"]) {
  assert.ok(collectionHeader.includes(publicCtaCapability));
}
assert.ok(
  collectionFields.includes("<AdminCard") &&
    collectionFields.includes("<ModuleEditorFieldGrid>") &&
    !collectionFields.includes("MODULE_EDITOR_CONTROL_CARD_CLASS_NAME") &&
    !collectionFields.includes("surfacePresentation"),
);
for (const editorOrganizationToken of [
  'data-collection-presentation-fields=""',
  "إعدادات النمط المختار",
  'data-collection-presentation-settings={activeLayout}',
  'data-collection-presentation-context=""',
  'name="item_limit"',
  'name="secondary_item_count"',
  'name="items_per_row"',
  'name="collection_card_variant"',
  "{contextLabel}",
  "LAYOUT_SUMMARIES[activeLayout]",
  "variantCapabilities.itemsPerRow",
  "variantCapabilities.cardVariant",
  "mode={variantCapabilities.contentHierarchyMode}",
  'mode === "featured-first"',
]) {
  assert.ok(collectionFields.includes(editorOrganizationToken));
}
assert.equal(collectionFields.match(/span=\{3\}/g)?.length, 4);
assert.ok(!collectionFields.includes("visibleSettingsCount"));
assert.ok(
  action.includes("buildCollectionModuleDisplayFormattingFromFormData(formData)"),
);
assert.ok(!action.includes("buildContentDisplayOptionsFromFormData("));
assert.ok(!action.includes("buildCollectionDetailsActionFromFormData("));
assert.ok(
  sharedDisplayContract.includes(
    "COLLECTION_MODULE_DISPLAY_FORMATTING_CAPABILITY",
  ),
);
assert.ok(
  sharedDisplayContract.includes("resolveCollectionModuleDisplayFormatting"),
);
for (const fieldName of [
  "show_title_on_page",
  "show_image_on_page",
  "show_excerpt_on_page",
  "show_date_on_page",
  "show_category_on_page",
  "show_series_on_page",
]) {
  assert.ok(sharedDisplayContract.includes(`\"${fieldName}\"`));
}
for (const detailsField of [
  'name="details_text"',
  'showName="show_details"',
  'boldName="details_bold"',
  'alignmentName="details_alignment"',
]) {
  assert.ok(sharedCollectionEditor.includes(detailsField));
}
for (const textField of ["title", "category", "series", "excerpt", "date"]) {
  assert.ok(sharedCollectionEditor.includes(`boldName="${textField}_bold"`));
  assert.ok(
    sharedCollectionEditor.includes(
      `alignmentName="${textField}_alignment"`,
    ),
  );
}
assert.ok(sharedCollectionEditor.includes('controlMode="visibility-only"'));
assert.equal(
  sharedCollectionEditor.match(/<ModuleEditorVisibilityAlignRow/gu)?.length,
  7,
);
assert.ok(editor.includes("CollectionModuleDisplayFormattingFields"));
assert.ok(editor.includes('name="presentation_description"'));
assert.ok(editor.includes('aria-label="وصف السكشن"'));
assert.ok(editor.includes('className={fieldClassName("h-11 min-w-0")}'));
assert.ok(!editor.includes('<textarea\n                              name="presentation_description"'));
assert.ok(!editor.includes('className={fieldClassName("h-[72px]'));
for (const retiredField of [
  "side_limit",
  "list_limit",
  "featured_mode",
  "manual_topic_id",
]) {
  assert.ok(!editor.includes(retiredField));
  assert.ok(!action.includes(retiredField));
}

const hierarchyOwner = read("src/lib/collection-modules/content-hierarchy.ts");
const viewOwner = read("src/lib/collection-modules/collection-view.ts");
const quantityOwner = read("src/lib/collection-modules/item-limit.ts");
const capabilityFields = read(
  "src/components/admin/page-blocks/CollectionModuleFields.tsx",
);
const mediaCapabilityAdapter = read(
  "src/lib/media-hub-modules/presentation-contract.ts",
);
const mediaListingResolver = read(
  "src/lib/media-hub-modules/listing-presentation.ts",
);
const mediaListingPage = read(
  "src/components/media-center/MediaListingPage.tsx",
);
const mediaListingModule = read(
  "src/components/media-center/MediaListingModule.tsx",
);
const mediaListingContent = read(
  "src/components/media-center/MediaListingContent.tsx",
);
const mediaListingCard = read(
  "src/components/media-center/MediaContentCard.tsx",
);
const mediaDisplayAdapter = read(
  "src/lib/media-center/collection-display-adapter.ts",
);
const mediaParseConfig = read(
  "src/lib/media-hub-modules/parse-config.ts",
);
const mediaHubRenderer = read(
  "src/components/media-center/renderMediaHubSections.tsx",
);
assert.ok(mediaHubRenderer.includes('module.config.placement === "listing"'));
assert.ok(mediaHubRenderer.includes("<MediaListingModule"));
assert.ok(
  mediaHubRenderer.includes(
    "Boolean(context.listingContext && resolveMediaListingConfig(module))",
  ) &&
    mediaHubRenderer.includes("if (!listingContext) return null") &&
    mediaHubRenderer.includes("publicPath={listingContext.publicPath}") &&
    mediaHubRenderer.includes("searchParams={listingContext.searchParams}"),
  "Media Listing must require positive request context and fail closed when inherited",
);
assert.ok(
  slotRenderPlan.includes("listingContext: context.listingContext"),
  "Media Listing renderability must be decided inside the canonical contextual slot plan",
);
const topicsListingPresenter = read(
  "src/components/topics/TopicsListingModule.tsx",
);
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
assert.ok(capabilityFields.includes('title="طريقة العرض"') && capabilityFields.includes(': "طريقة العرض"'));
assert.ok(capabilityFields.includes("4 لأربعة أعمدة"));
assert.ok(capabilityFields.includes('mosaic: "فسيفساء بصرية"'));
assert.ok(capabilityFields.includes('timeline: "خط زمني بالبطاقات"'));
assert.ok(capabilityFields.includes('"timeline-digest": "موجز زمني"'));
assert.ok(
  sharedCollectionEditor.includes("CollectionModuleDisplayFormattingFields"),
);
assert.ok(
  sharedCollectionEditor.includes(
    'data-collection-display-formatting-capability=""',
  ),
);
assert.ok(!sharedCollectionEditor.includes("additionalSettings"));
assert.ok(mediaListingResolver.includes("resolveMediaListingConfig"));
assert.ok(mediaListingPage.includes("page?: string"));
assert.ok(!mediaListingPage.includes("resolvedModule.contentType"));
assert.ok(!mediaListingPage.includes("displayOverrides={presentation.display}"));
assert.ok(mediaListingModule.includes("resolved.contentType"));
assert.ok(mediaListingModule.includes("displayOverrides={presentation.display}"));
assert.ok(mediaListingModule.includes("requestedPage"));
assert.ok(mediaListingModule.includes("currentPage={listing.currentPage}"));
assert.ok(mediaListingModule.includes("totalPages={listing.totalPages}"));
assert.ok(
  mediaListingCard.includes("displayOverrides: CollectionDisplayOverrides"),
);
assert.ok(mediaListingCard.includes("<CollectionListingCard"));
assert.ok(mediaListingCard.includes("resolveMediaCollectionItemDisplay"));
assert.ok(mediaListingCard.includes("display={display}"));
assert.ok(mediaDisplayAdapter.includes("resolveCollectionModuleItemDisplay"));
assert.ok(!mediaDisplayAdapter.includes("DEFAULT_COLLECTION"));
assert.ok(!mediaDisplayAdapter.includes("FormData"));
assert.ok(mediaParseConfig.includes("resolveCollectionModuleDisplayFormatting"));
assert.ok(mediaParseConfig.includes("display?: ResolvedCollectionModuleDisplayFormatting"));
assert.ok(mediaHubRenderer.includes("module.config.display"));
assert.ok(mediaHubRenderer.includes("display={display}"));
for (const hubPresenter of [
  "src/components/media-center/MediaCenterCollectionItems.tsx",
  "src/components/media-center/MediaCenterHubFeatured.tsx",
  "src/components/media-center/MediaCenterHubFeaturedCollection.tsx",
  "src/components/media-center/MediaCenterHubMosaic.tsx",
  "src/components/media-center/MediaCenterHubTimeline.tsx",
]) {
  const source = read(hubPresenter);
  assert.ok(source.includes("CollectionDisplayOverrides"), hubPresenter);
  assert.ok(source.includes("display"), hubPresenter);
  assert.ok(source.includes("resolveMediaCollectionItemDisplay"), hubPresenter);
  assert.ok(source.includes("pageBlockTextAlignClass"), hubPresenter);
}
assert.ok(!mediaListingCard.includes("MediaListingCardVariant"));
assert.ok(!mediaListingPage.includes("paginationEnabled"));
assert.ok(!mediaListingPage.includes("cardVariant"));
assert.ok(!mediaListingPage.includes("cardCtaText"));
assert.ok(mediaListingContent.includes("<CollectionListingPresentation"));
assert.ok(
  mediaListingContent.includes('import PublicPagination from "../Pagination"'),
);
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
for (const sectionKey of [
  "featured",
  "site-updates",
  "videos",
  "gallery",
  "press",
]) {
  assert.ok(
    mediaCapabilityAdapter.includes(`${sectionKey}:`) ||
      mediaCapabilityAdapter.includes(`"${sectionKey}":`),
  );
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

const mediaHubPresenter = read(
  "src/components/media-center/renderMediaHubSections.tsx",
);
const featuredCollection = read(
  "src/components/media-center/MediaCenterHubFeaturedCollection.tsx",
);
const editorialCollection = read(
  "src/components/media-center/MediaCenterHubFeatured.tsx",
);
const mosaicCollection = read(
  "src/components/media-center/MediaCenterHubMosaic.tsx",
);
const standardCollection = read(
  "src/components/media-center/MediaCenterCollectionItems.tsx",
);
const timelineCollection = read(
  "src/components/media-center/MediaCenterHubTimeline.tsx",
);
assert.ok(mediaHubPresenter.includes('layout === "featured"'));
assert.ok(mediaHubPresenter.includes('layout === "editorial"'));
assert.ok(mediaHubPresenter.includes('layout === "mosaic"'));
assert.ok(
  mediaHubPresenter.includes('sliderEnabled={data.kind === "featured"}'),
);
assert.ok(
  mediaHubPresenter.includes('showDateWhenAvailable={data.kind === "videos"}'),
);
assert.ok(!mediaHubPresenter.includes('hierarchyMode === "featured-first"'));
assert.ok(
  !mediaHubPresenter.includes(
    'layout === "editorial" || data.kind === "featured"',
  ),
);
assert.ok(
  mediaHubPresenter.indexOf('layout === "editorial"') <
    mediaHubPresenter.indexOf('data.kind === "featured"'),
);
assert.ok(featuredCollection.includes('1: "grid-cols-1"'));
assert.ok(
  featuredCollection.includes('2: "grid-cols-1 @xl/slot-module:grid-cols-2"'),
);
assert.ok(
  featuredCollection.includes('3: "grid-cols-1 @xl/slot-module:grid-cols-2"'),
);
assert.ok(
  featuredCollection.includes(
    '4: "grid-cols-1 @md/slot-module:grid-cols-2 @xl/slot-module:grid-cols-4"',
  ),
);
assert.ok(featuredCollection.includes("FEATURED_ACTION_LABELS"));
assert.ok(featuredCollection.includes('from "../../hooks/use-auto-carousel"'));
assert.ok(featuredCollection.includes("useAutoCarousel<HTMLDivElement>"));
assert.ok(featuredCollection.includes("autoplay: false"));
assert.ok(featuredCollection.includes("onClick={goToPrevious}"));
assert.ok(featuredCollection.includes("onClick={goToNext}"));
assert.ok(!featuredCollection.includes("useState"));
assert.ok(!featuredCollection.includes("setStartIndex"));
assert.ok(!featuredCollection.includes("setInterval"));
assert.ok(
  editorialCollection.includes("@2xl/slot-module:grid-cols-[1.1fr_0.9fr]"),
);
assert.ok(editorialCollection.includes('layout: "list"'));
assert.ok(editorialCollection.includes('cardVariant: "compact"'));
assert.ok(editorialCollection.includes('className="group block h-full"'));
assert.ok(
  editorialCollection.includes("@2xl/slot-module:[&>div]:auto-rows-fr"),
);
assert.ok(editorialCollection.includes("data-slider-news-group"));
assert.ok(editorialCollection.includes("@2xl/slot-module:row-start-2"));
assert.ok(editorialCollection.includes("showDateWhenAvailable"));
assert.ok(standardCollection.includes("showDateWhenAvailable"));
assert.ok(mosaicCollection.includes("contentHierarchy?.secondaryItemCount"));
assert.ok(
  mosaicCollection.includes("@xl/slot-module:grid-cols-[1.05fr_0.95fr]"),
);
assert.ok(mosaicCollection.includes("grid items-stretch gap-3"));
assert.ok(mosaicCollection.includes("@xl/slot-module:auto-rows-fr"));
assert.ok(mosaicCollection.includes("@xl/slot-module:aspect-auto"));
assert.ok(!mosaicCollection.includes('href="/media-center/gallery"'));
assert.ok(!mosaicCollection.includes('href="/media-center/videos"'));
assert.ok(timelineCollection.includes('layout === "timeline-digest"'));
assert.ok(timelineCollection.includes("data-presentation-variant={layout}"));
assert.ok(timelineCollection.includes("grid-cols-[92px_minmax(0,1fr)]"));
assert.ok(timelineCollection.includes("@xl/slot-module:grid-cols-[130px_1fr]"));
assert.ok(timelineCollection.includes('"flex h-full flex-col"'));
assert.ok(timelineCollection.includes("relative flex flex-1 flex-col gap-4"));
assert.ok(timelineCollection.includes('isTimelineDigest ? "256px" : "160px"'));
assert.ok(timelineCollection.includes("formatting.titleBold"));
assert.ok(timelineCollection.includes("formatting.titleAlignment"));
assert.ok(timelineCollection.includes("formatting.excerptBold"));
assert.ok(timelineCollection.includes("formatting.excerptAlignment"));
assert.ok(mediaHubPresenter.includes('className="h-full"'));
assert.equal(
  existsSync(
    resolve(
      ROOT,
      "src/components/media-center/MediaCenterHubTimelineDigest.tsx",
    ),
  ),
  false,
);

const blockLoader = read("src/lib/page-blocks/load-page-blocks.ts");
const adminQueries = read("src/lib/page-blocks/admin-queries.ts");
assert.ok(blockLoader.includes("isRetiredContentBlockTemplateSlug"));
assert.ok(adminQueries.includes("if (!template || isRetiredContentBlockTemplateSlug(template.slug)) continue;"));
assert.ok(adminQueries.includes('kind !== "content" || !isRetiredContentBlockTemplateSlug(template.slug)'));

const listingRoutes = [
  "news",
  "videos",
  "gallery",
  "press",
  "site-updates",
] as const;
for (const route of listingRoutes) {
  const source = read(`src/app/(site)/media-center/${route}/page.tsx`);
  assert.ok(source.includes(`<MediaListingPage configKey="${route}"`));
}

const migration = read(
  "sql/migrations/20260816090000_media_center_hero_owner_closure.sql",
);
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
  assert.ok(
    migration.includes(`'${slug}'`),
    `missing Featured Content template ${slug}`,
  );
}
assert.equal(migration.match(/\"placement\":\"featured\"/g)?.length, 5);
assert.equal(migration.match(/\"source\":\"topics\"/g)?.length, 5);
assert.equal(migration.match(/\"featured\":true/g)?.length, 5);
for (const contentType of [
  "news",
  "video",
  "gallery",
  "press",
  "site_update",
]) {
  assert.ok(migration.includes(`\"type\":\"${contentType}\"`));
}
for (const retiredKey of ["featuredMode", "manualTopicId", "featuredCtaText"]) {
  assert.ok(migration.includes(`- '${retiredKey}'`));
}
assert.ok(!migration.match(/create\s+(table|function|view|trigger)/iu));
assert.ok(
  !migration.match(
    /insert\s+into\s+public\.page_(?:content_block|media_hub_module)_assignments/iu,
  ),
);

/** Real-client regression at the existing Hub owner, never a Browser/DB claim. */
async function verifyHubPremiumPreservation() {
  const require = createRequire(import.meta.url), React = require("react") as typeof import("react");
  const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
  type Harness = { load: (file: string, roots?: string[]) => Record<string, unknown>; files: Set<string> };
  type Ports = Map<string, unknown>;
  const { createRemainingContentOwnerHarness } = require("./fixtures/remaining-content-owner-harness.mjs") as { createRemainingContentOwnerHarness: (root: string, options: { sourceOverrides?: Map<string, string>; additionalPorts: Ports }) => Harness };
  const editorFile = "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx", collectionFile = "src/components/admin/page-blocks/CollectionModuleFields.tsx";
  const baselineArg = process.argv.find(value => value.startsWith("--baseline-file=")), overrides = new Map<string, string>();
  if (baselineArg) {
    const snapshot = JSON.parse(readFileSync(baselineArg.slice(16), "utf8")) as { entries: { path: string; hash: string; content: string }[] };
    for (const file of [editorFile, collectionFile]) {
      const entry = snapshot.entries.find(value => value.path.replaceAll("\\", "/") === file); assert.ok(entry, "Captured before source required: " + file);
      const bytes = Buffer.from(entry.content, "base64"); assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.hash.toLowerCase()); overrides.set(file, bytes.toString("utf8"));
    }
  } else {
    const { execFileSync } = await import("node:child_process");
    for (const file of [editorFile, collectionFile]) overrides.set(file, execFileSync("git", ["show", "HEAD:" + file], { cwd: ROOT, windowsHide: true, encoding: "utf8" }));
  }
  const noTransport = async () => { throw Error("Unexpected Hub static transport"); };
  const ports: Ports = new Map<string, unknown>([
    ["next/navigation", { useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => "/admin/pages-blocks/blocks/media-hub/11", useSearchParams: () => new URLSearchParams("tab=content"), redirect: noTransport }],
    ["next/link", { __esModule: true, default: ({ href, children }: { href: string; children: import("react").ReactNode }) => React.createElement("a", { href }, children) }],
    ["next/image", { __esModule: true, default: (input: Record<string, unknown>) => { const props = { ...input }; for (const key of ["fill", "priority", "unoptimized", "quality", "loader"]) delete props[key]; return React.createElement("img", props); } }],
  ]);
  const previousFetch = globalThis.fetch, previousSessionAllowed = sessionAllowed;
  sessionAllowed = true;
  globalThis.fetch = async () => { throw Error("Offline Hub acceptance forbids network"); };
  try {
    const before = createRemainingContentOwnerHarness(ROOT, { sourceOverrides: overrides, additionalPorts: ports }), after = createRemainingContentOwnerHarness(ROOT, { additionalPorts: ports });
    type Field = { name: string; type: string; value: string; checked: boolean; enabled: boolean; submitted: boolean; visible: boolean; min: string | null; max: string | null; required: boolean };
    const native = (html: string): Field[] => {
      const decode = (value: string) => value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/gi, match => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'" }[match.toLowerCase()] ?? match));
      type Frame = { tag: string; hidden: boolean; disabled: boolean; select?: Field; selected?: boolean; textarea?: Field };
      const stack: Frame[] = [], fields: Field[] = [], voids = new Set(["input", "img", "link", "meta", "br", "hr", "source"]);
      for (const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[\w-]+\b[^>]*>|[^<]+/g)) {
        const token = match[0]; if (!token.startsWith("<")) { const textarea = stack.at(-1)?.textarea; if (textarea) textarea.value += decode(token); continue; } if (token.startsWith("<!")) continue;
        if (token.startsWith("</")) { const tag = token.slice(2).match(/^[\w-]+/)![0].toLowerCase(), index = stack.findLastIndex(value => value.tag === tag); assert.ok(index >= 0); stack.length = index; continue; }
        const tag = token.slice(1).match(/^[\w-]+/)![0].toLowerCase(), attrs = Object.fromEntries([...token.slice(tag.length + 1, -1).matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, decode(value ?? "")]));
        const parent = stack.at(-1), hidden = Boolean(parent?.hidden || "hidden" in attrs || (attrs.class ?? "").split(/\s+/).includes("hidden") || /display\s*:\s*none/i.test(attrs.style ?? ""));
        const disabled = Boolean(parent?.disabled || tag === "fieldset" && "disabled" in attrs);
        const frame: Frame = { tag, hidden, disabled };
        if (attrs.name && ["input", "select", "textarea"].includes(tag)) {
          const type = attrs.type || tag, checked = "checked" in attrs, enabled = !disabled && !("disabled" in attrs);
          const field: Field = { name: attrs.name, type, value: attrs.value ?? "", checked, enabled, submitted: enabled && (!["checkbox", "radio"].includes(type) || checked), visible: type !== "hidden" && !hidden, min: attrs.min ?? null, max: attrs.max ?? null, required: "required" in attrs }; fields.push(field); if (tag === "select") frame.select = field; if (tag === "textarea") frame.textarea = field;
        }
        if (tag === "option") { const select = stack.findLast(value => value.select); if (select?.select && (!select.selected || "selected" in attrs)) { select.select.value = attrs.value ?? ""; if ("selected" in attrs) select.selected = true; } }
        if (!voids.has(tag) && !token.endsWith("/>")) stack.push(frame);
      }
      return fields;
    };
    const dataFor = (fields: Field[]) => { const data = new FormData(); for (const field of fields) if (field.submitted) data.append(field.name, field.value); return data; };
    const stable = (fields: Field[]) => fields.map(({ visible, ...field }) => { void visible; return field; }).sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type) || a.value.localeCompare(b.value));
    const assignmentContext = { pages: [{ id: 1, title: "Home", slug: "home", path: "/" }], assignments: [{ id: 11, page_id: 1, template_id: 11, slot: "main", sort_order: 20, is_visible: true, page_title: "Home", page_slug: "home", page_path: "/" }] };
    const render = (harness: Harness, section: string, config: unknown, listing = false) => {
      const Editor = harness.load(resolve(ROOT, editorFile)).default as import("react").ElementType, Feedback = harness.load(resolve(ROOT, "src/components/admin/AdminFeedbackProvider.tsx")).default as import("react").ElementType;
      return renderToStaticMarkup(React.createElement(Feedback, null, React.createElement(Editor, { block: { id: 11, name: "Isolated Hub", slug: listing && section === "featured" ? "media-listing-presentation-news" : "fixture-hub-" + section, description: "Retained internal note", status: "unpublished", section_key: section, config }, assignmentContext, updateAction: noTransport })));
    };
    const cases: Record<string, unknown>[] = [], forms: FormData[] = [];
    const sections = ["site-updates", "videos", "gallery", "press"] as const;
    for (const section of sections) {
      const capabilities = getMediaHubCollectionCapabilities(section);
      for (const layout of capabilities.view.layouts) for (const show of [true, false]) {
        const input = parseMediaHubModuleConfig({ placement: "hub", itemLimit: 9, contentHierarchy: { mode: getMediaHubPresentationVariantCapabilities(section, layout).contentHierarchyMode, secondaryItemCount: 3 }, display: { title: false, image: true, category: false, series: true, excerpt: false, date: true }, presentation: { eyebrow: "Retained eyebrow", title: "Retained title", description: "Retained description", ctaText: "Retained CTA", showEyebrow: show, showTitle: show, showDescription: show, showCta: show, titleBold: true, titleAlignment: "left", descriptionBold: true, descriptionAlignment: "center", collectionView: { layout, itemsPerRow: 3, cardVariant: "compact" } } }, section);
        assert.equal(input.presentation.collectionView.layout, layout, "Requested layout reaches the actual editor without legacy hierarchy remapping");
        const original = native(render(before, section, input)), current = native(render(after, section, input));
        assert.deepEqual(stable(current), stable(original), section + "/" + layout + ": before/after fields, values, limits and successful-control semantics");
        const data = dataFor(current), saved = await validateAndBuild(data), expected = await validateAndBuild(dataFor(original));
        assert.deepEqual(saved.config, expected.config); assert.deepEqual((await validateAndBuild(dataFor(native(render(after, section, saved.config))))).config, saved.config, "Actual client/parser remount parity");
        const variant = getMediaHubPresentationVariantCapabilities(section, layout);
        assert.equal(current.find(field => field.name === "secondary_item_count")?.type, variant.contentHierarchyMode === "featured-first" ? "number" : "hidden");
        assert.equal(current.find(field => field.name === "items_per_row")?.type, variant.itemsPerRow ? "select" : "hidden");
        assert.equal(current.find(field => field.name === "collection_card_variant")?.type, variant.cardVariant ? "select" : "hidden");
        assert.ok(current.filter(field => ["eyebrow", "title", "presentation_description", "cta_text"].includes(field.name)).every(field => field.enabled && field.submitted), "Inactive authored text/formatting stays successful");
        assert.equal(current.find(field => field.name === "presentation_description")?.value, input.presentation.description, "SSR textarea body retains actual authored description");
        cases.push({ section, layout, show, placement: "hub", before: original, after: current, nativeParity: true, canonicalParity: true, remountParity: true, conditional: variant });
        if (show && layout === capabilities.view.defaults.layout) forms.push(data);
      }
    }
    for (const section of ["featured", ...sections] as const) for (const presentation of ["grid", "list"] as const) {
      const config = parseMediaHubModuleConfig({ placement: "listing", type: section === "featured" ? "news" : section === "videos" ? "video" : section === "site-updates" ? "site_update" : section, listing: { presentation, itemsPerRow: 3, itemLimit: 6, display: { title: false, image: true, details: { visible: false, text: "Retained details", bold: true, alignment: "left" } } } }, section);
      const original = native(render(before, section, config, true)), current = native(render(after, section, config, true));
      assert.deepEqual(stable(current), stable(original), "Listing consumer native regression: " + section + "/" + presentation);
      assert.deepEqual((await validateAndBuild(dataFor(current))).config, (await validateAndBuild(dataFor(original))).config);
      cases.push({ section, presentation, placement: "listing", nativeParity: true, canonicalParity: true, fieldCount: current.length });
    }
    // Execute the actual action with only its external transactional write port isolated.
    let writes = 0, failWrite = false, persisted: unknown;
    const assignmentOwner = after.load(resolve(ROOT, "src/lib/page-blocks/sync-module-page-assignments.ts"), ["parsePageIdsFromForm"]);
    const savePorts: Ports = new Map(ports); savePorts.set("next/navigation", { redirect: (href: string) => { throw Object.assign(Error("isolated redirect"), { href }); } });
    savePorts.set("src/lib/page-blocks/sync-module-page-assignments", { parsePageIdsFromForm: assignmentOwner.parsePageIdsFromForm, async saveModuleTemplateWithPageAssignments(kind: string, id: number, row: unknown, pageIds: number[]) { assert.equal(kind, "media-hub"); assert.equal(id, 11); assert.deepEqual(pageIds, [1]); if (failWrite) throw Error("isolated_hub_save_failure"); writes++; persisted = structuredClone(row); return { id, affectedPageIds: pageIds }; } });
    savePorts.set("src/lib/page-blocks/admin-revalidate", { revalidateBlockModulePaths: async () => {}, revalidateCommittedPageBlockAction: async (result: unknown) => result });
    const mutation = createRemainingContentOwnerHarness(ROOT, { additionalPorts: savePorts }), update = mutation.load(resolve(ROOT, "src/app/admin/pages-blocks/blocks/media-hub/actions.ts"), ["updateMediaHubModule"]).updateMediaHubModule as (data: FormData) => Promise<void>;
    for (const data of forms) {
      await assert.rejects(() => update(data), (error: unknown) => Boolean(error && typeof error === "object" && "href" in error && String(error.href).includes("/admin/pages-blocks/blocks/media-hub/11?saved=1")));
      assert.deepEqual((persisted as { config: unknown }).config, (await validateAndBuild(data)).config);
      const accepted = structuredClone(persisted), count = writes; failWrite = true; await assert.rejects(() => update(data), /isolated_hub_save_failure/); assert.equal(writes, count); assert.deepEqual(persisted, accepted); failWrite = false;
    }
    assert.equal(writes, 4);
    const retired = new FormData(); for (const [key, value] of forms[0]) retired.append(key, value); retired.set("section_key", "featured");
    await assert.rejects(() => update(retired), /المحتوى المميز يُدار من موديول Featured المستقل/); assert.equal(writes, 4, "Retired Featured cannot enter the Hub write port");
    const sampleConfig = parseMediaHubModuleConfig({ presentation: { title: "Retained title" } }, "videos"), sampleHtml = render(after, "videos", sampleConfig), sampleFields = native(sampleHtml);
    const inheritedDisabled = native("<fieldset hidden disabled>" + sampleHtml + "</fieldset>");
    assert.equal(inheritedDisabled.length, sampleFields.length); assert.ok(inheritedDisabled.every(field => !field.visible && !field.enabled && !field.submitted), "Ancestor disabled/hidden semantics are observed, never inferred from input attributes alone");
    const missingTitle = sampleFields.filter(field => field.name !== "title");
    assert.throws(() => assert.deepEqual(stable(missingTitle), stable(sampleFields)), "Dropping a real native capability must fail the observer comparison");
    assert.notEqual((await validateAndBuild(dataFor(missingTitle))).config.presentation.title, (await validateAndBuild(dataFor(sampleFields))).config.presentation.title, "Dropped authored values must reach the real parser as a different payload");
    const defaultOwner = (harness: Harness) => {
      const Fields = harness.load(resolve(ROOT, collectionFile)).CollectionPresentationFields as import("react").ElementType, capabilities = getMediaHubCollectionCapabilities("videos");
      return renderToStaticMarkup(React.createElement(Fields, { hierarchy: capabilities.hierarchy.defaults, hierarchyCapabilities: capabilities.hierarchy, view: capabilities.view.defaults, viewCapabilities: capabilities.view, itemLimit: 9, contextLabel: "Videos" }));
    };
    assert.equal(defaultOwner(after), defaultOwner(before), "Existing Collection owner default rendered HTML is unchanged");
    const routeFile = "src/app/admin/pages-blocks/blocks/media-hub/[id]/page.tsx", route = ts.createSourceFile(routeFile, read(routeFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let bound = false; const visit = (node: ts.Node) => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(route) === "MediaHubModuleEditClient") bound = node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(route) === "updateAction" && attribute.initializer?.getText(route) === "{updateMediaHubModule}"); ts.forEachChild(node, visit); }; visit(route); assert.ok(bound, "Actual edit route binds the actual tested update action");
    const outputArg = process.argv.find(value => value.startsWith("--output-dir=")), outputDir = resolve(ROOT, outputArg?.slice(13) ?? ".tmp-qa/media-hub-premium/current"); assert.ok(outputDir.startsWith(resolve(ROOT, ".tmp-qa") + "/") || outputDir.startsWith(resolve(ROOT, ".tmp-qa") + "\\"));
    const files = new Set([...after.files, ...mutation.files, editorFile, collectionFile, routeFile, "scripts/verify-media-center-product-review.mts"]);
    const sourceHashes = Object.fromEntries([...files].sort().map(file => [file, createHash("sha256").update(readFileSync(resolve(ROOT, file))).digest("hex")]));
    await mkdir(outputDir, { recursive: true }); await writeFile(resolve(outputDir, "media-hub-preservation.json"), JSON.stringify({ status: "PASS", baseline: baselineArg?.slice(16) ?? "git HEAD", cases, sourceHashes, lifecycle: { active: sections, retiredFeatured: "excluded; actual mutation denial retained" }, sharedDefaultHtmlParity: true, actualMutationSuccesses: writes, actualMutationFailuresRetainPrior: writes, negativeProof: ["retired Featured rejected before write", "real rendered ancestor hidden+disabled descendants are not successful", "removed native field fails baseline comparison and changes real saved payload", "existing invalid section/source/type/identity and unauthorized action-prefix probes"], nativeStates: "Mounted/HTML-hidden/ancestor-disabled/successful fields observed; computed visibility and user-event transitions need Browser", savePath: "actual route -> updateMediaHubModule -> real config builders -> real parsePageIdsFromForm -> in-memory external transactional write port", acceptance: { functional: "PASS", technicalVisual: "pending Browser", ownerApproval: "pending" }, boundary: { browser: false, network: false, database: false, realAuth: false, publicRendering: false } }, null, 2) + "\n");
    console.log("PASS Media Hub Premium preservation: " + cases.length + " actual-client states, four actual-action successes/failures, listing regression, unchanged default HTML.");
  } finally { globalThis.fetch = previousFetch; sessionAllowed = previousSessionAllowed; }
}

await verifyHubPremiumPreservation();
console.log("Media Center architecture correction verification passed.");
