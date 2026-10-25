import { normalizeVerificationText } from "./lib/verification-text.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

import { createJiti } from "jiti";
import { verifyFeaturedReferenceReadContract } from "./fixtures/page-block-performance-harness.mjs";
import { verifyFeaturedPremiumOffline } from "./qa-featured-editor-preservation.mts";

const ROOT = process.cwd();
const read = (path: string) =>
  normalizeVerificationText(readFileSync(resolve(ROOT, path), "utf8"));
const jiti = createJiti(import.meta.url);
const { buildFeaturedModuleConfig, parseFeaturedModuleConfig } =
  await jiti.import<typeof import("../src/lib/featured-modules/config.ts")>(
    "../src/lib/featured-modules/config.ts",
  );
const {
  FEATURED_PRESENTATION_PROFILES,
  featuredPresentationProfile,
  resolveAvailableFeaturedManualItems,
  resolveFeaturedItemDisplay,
  resolveFeaturedManualEditorSelection,
  resolveFeaturedItemsPerView,
  resolveFeaturedNavigation,
  updateFeaturedManualSelection,
} = await jiti.import<
  typeof import("../src/lib/featured-modules/contract.ts")
>("../src/lib/featured-modules/contract.ts");
let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function checkEqual(label: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const contract = read("src/lib/featured-modules/contract.ts");
const config = read("src/lib/featured-modules/config.ts");
const resolver = read("src/lib/featured-modules/resolve-featured-items.ts");
const loader = read("src/lib/featured-modules/load-featured-modules.ts");
const editorOptions = read("src/lib/featured-modules/load-editor-options.ts");
const editor = read(
  "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
);
const component = read("src/components/featured/FeaturedModuleSection.tsx");
const contentCard = read("src/components/featured/FeaturedContentCard.tsx");
const carousel = read("src/components/featured/FeaturedCarousel.tsx");
const sharedDisplayContract = read("src/lib/page-blocks/configs.ts");
const sharedDisplayEditor = read(
  "src/components/admin/content/editors/ContentDisplaySettings.tsx",
);
const sharedListbox = read("src/components/admin/ui/AdminListboxSelect.tsx");
const sharedScrollbar = read("src/components/venesia-scrollbar-styles.ts");
const composition = read("src/lib/page-blocks/load-page-composition.ts");
const moduleTypes = read("src/lib/page-blocks/types.ts");
const moduleRegistry = read("src/lib/page-blocks/block-module-registry.ts");
const moduleEditorMetadata = read(
  "src/lib/page-composition/module-registry-metadata.ts",
);
const positionContract = read(
  "src/lib/page-composition/page-assignment-contract.ts",
);
const publicContract = read("src/lib/content/public-content-read/contract.ts");
const publicOwner = read("src/lib/content/public-content-read/owner.ts");
const mediaResolver = read(
  "src/lib/media-hub-modules/resolve-hub-section-data.ts",
);
const mediaEditor = read(
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
);
const topicsLoader = read("src/lib/topics/load-public-topics.ts");
const topicsListing = read("src/components/topics/TopicsListingContent.tsx");
const topicsPage = read("src/app/(site)/topics/page.tsx");
const pageSlotLayout = read(
  "src/components/page-composition/PageSlotLayout.tsx",
);
const migration = read(
  "sql/migrations/20260828233733_featured_page_composition_module.sql",
);
const sharedHeader = read(
  "src/components/collection-modules/CollectionSectionHeader.tsx",
);
const mediaHeader = read(
  "src/components/media-center/MediaCenterHubSectionHeader.tsx",
);

check(
  "Featured contract separates source, selection, total limit, per-view count, formatting, navigation, and presentation",
  [
    "FeaturedSource",
    "FeaturedSelection",
    "FeaturedPresentation",
    "itemLimit",
    "itemsPerView",
    "displayFormatting",
    "navigation",
  ].every((marker) => contract.includes(marker)) &&
    !/FeaturedModuleConfig[\s\S]{0,400}\bplacement\b/u.test(contract),
);
check(
  "Featured supports the approved two sources",
  contract.includes('["categories", "media-center"]'),
);
check(
  "Featured owns automatic, latest, popular, and ordered manual selection",
  [
    '"automatic"',
    '"latest"',
    '"popular"',
    '"manual"',
  ].every((marker) => contract.includes(marker)) &&
    contract.includes("topicIds: number[]") &&
    contract.includes("FEATURED_SELECTION_LABELS_AR"),
);
check(
  "Featured contract preserves the legacy carousel and owns the seven current editor presentations",
  [
    '"hero"',
    '"editorial"',
    '"large-card"',
    '"three-cards"',
    '"list"',
    '"carousel"',
    '"single-carousel"',
    '"group-carousel"',
  ].every((marker) => contract.includes(marker)) &&
    contract.includes("FEATURED_EDITOR_PRESENTATION_VARIANTS"),
);
check(
  "presentation parsing is independent from selection parsing",
  config.includes("presentationVariant") &&
    config.includes("selectionMode") &&
    config.includes("featuredModuleConfigSchema"),
);
checkEqual(
  "Featured presentation profiles keep total selection independent from per-view policy",
  {
    hero: resolveFeaturedItemsPerView("hero", 4, 8),
    editorial: resolveFeaturedItemsPerView("editorial", 3, 8),
    largeCard: resolveFeaturedItemsPerView("large-card", 4, 8),
    cards: resolveFeaturedItemsPerView("three-cards", 1, 8),
    cardsDefault: resolveFeaturedItemsPerView("three-cards", undefined, 8),
    list: resolveFeaturedItemsPerView("list", 1, 8),
    listDefault: resolveFeaturedItemsPerView("list", undefined, 8),
    group: resolveFeaturedItemsPerView("group-carousel", 4, 8),
    editorialShortSource: resolveFeaturedItemsPerView("editorial", 4, 1),
    threeCardsShortSource: resolveFeaturedItemsPerView("three-cards", 3, 2),
  },
  {
    hero: 1,
    editorial: 3,
    largeCard: 1,
    cards: 1,
    cardsDefault: 3,
    list: 1,
    listDefault: 8,
    group: 4,
    editorialShortSource: 1,
    threeCardsShortSource: 2,
  },
);
checkEqual(
  "Featured navigation is profile-bound and never leaves a navigable variant without a handle",
  {
    list: resolveFeaturedNavigation("list", {
      showArrows: true,
      showDots: true,
      autoplay: true,
    }),
    hero: resolveFeaturedNavigation("hero", {
      showArrows: false,
      showDots: false,
      autoplay: false,
    }),
    groupDefaults: featuredPresentationProfile("group-carousel")
      .defaultNavigation,
  },
  {
    list: { showArrows: false, showDots: false, autoplay: false },
    hero: { showArrows: false, showDots: true, autoplay: false },
    groupDefaults: { showArrows: false, showDots: true, autoplay: true },
  },
);

check(
  "Featured reads exclusively through Public Content Read",
  resolver.includes("loadPublicContentCollection") &&
    !resolver.includes("getSupabaseAdmin"),
);
check(
  "automatic selection is strict featured-only with no latest fallback",
  resolver.includes(
    'featured: config.selection.mode === "automatic" ? "only" : "none"',
  ) && !/fallback|sourceItems\[0\]/u.test(resolver),
);
check(
  "latest and popular remain selection decisions over the same Public Content Read collection",
  resolver.includes('popularOnly: config.selection.mode === "popular"') &&
    resolver.includes('sort: "newest"') &&
    !resolver.includes("presentation.variant") &&
    !resolver.includes("FeaturedCarousel"),
);
check(
  "latest and popular return Public Content Read results instead of falling through manual selection",
  resolver.includes(
    'if (config.selection.mode !== "manual") return result.items;',
  ) &&
    !resolver.includes(
      'if (config.selection.mode === "automatic") return result.items;',
    ),
);
check(
  "manual selection uses canonical includeIds, applies authored priority before the read limit, and restores order",
  resolver.includes("config.selection.topicIds.slice(0, config.itemLimit)") &&
    resolver.includes("includeIds: manualIds") &&
    resolver.includes("resolveAvailableFeaturedManualItems") &&
    contract.includes("const availableById = new Map") &&
    contract.includes("topicIds.flatMap"),
);
check(
  "Public Content Read formally owns explicit identity filtering",
  publicContract.includes("includeIds?: readonly number[]") &&
    publicOwner.includes('next.in("id", input.includeIds)'),
);

check(
  "Featured is a first-class Page Composition module kind",
  moduleTypes.includes('"featured"') &&
    moduleRegistry.includes("FEATURED_ASSIGNMENT_TABLE") &&
    positionContract.includes("featured: FLEXIBLE_MODULE_POSITION"),
);
check(
  "Page Composition loads Featured for every page without route/domain gates",
  composition.includes("loadFeaturedModuleStateForPageSlug(pageSlug)") &&
    composition.includes(
      'isAssignmentPositionAllowed("featured", featured.slot, regionKeys)',
    ),
);
check(
  "Featured public loader reads only assignment/template state and delegates content selection",
  loader.includes("page_featured_module_assignments") &&
    loader.includes("resolveFeaturedItems") &&
    !loader.includes('.from("topics")'),
);
check(
  "public renderer exposes all presentations from one owner",
  component.includes("data-featured-presentation") &&
    component.includes("FeaturedCarousel") &&
    component.includes('presentation.variant === "list"') &&
    component.includes('presentation.variant === "single-carousel"') &&
    component.includes('presentation.variant === "group-carousel"') &&
    component.includes('mode="editorial"') &&
    component.includes("displayFormatting={module.displayFormatting}") &&
    component.includes("navigation={module.navigation}") &&
    component.includes("itemsPerView={module.itemsPerView}"),
);
check(
  "Featured motion presentations extend the existing shared carousel capability",
  carousel.includes('from "../../hooks/use-auto-carousel"') &&
    carousel.includes('from "../feed-modules/FeedCarouselDots"') &&
    carousel.includes("useAutoCarousel<HTMLDivElement>") &&
    carousel.includes("<FeedCarouselDots") &&
    carousel.includes("autoplay: navigation.autoplay") &&
    carousel.includes("data-featured-items-per-view") &&
    !carousel.includes("data-featured-visible-count") &&
    !carousel.includes("firstVisibleItem") &&
    !carousel.includes("lastVisibleItem") &&
    !carousel.includes("useState") &&
    !carousel.includes("setInterval"),
);
check(
  "Featured navigation controls drive arrows, dots, and autoplay in the one public presenter",
  component.includes('presentation.variant === "carousel"') &&
    component.includes('? "legacy"') &&
    carousel.includes("onClick={goToPrevious}") &&
    carousel.includes("onClick={goToNext}") &&
    carousel.includes("navigation.showArrows") &&
    carousel.includes("navigation.showDots") &&
    carousel.includes("navigation.autoplay") &&
    carousel.includes("<FeedCarouselDots"),
);

check(
  "Featured owns compact navigation and following-module spacing without changing Page Composition",
  carousel.includes(
    'className="mt-3 grid justify-items-center gap-3 [&>div]:mt-0"',
  ) &&
    component.includes('className="relative pb-6 pt-12"') &&
    component.includes('className="relative pb-4 pt-8"') &&
    carousel.includes('from "../feed-modules/feed-grouped-list-contract"') &&
    carousel.includes("maxVisible={FEED_MAX_VISIBLE_DOTS}"),
);

check(
  "shared content display contract owns all six display decisions",
  [
    "ContentDisplayOptions",
    "CONTENT_DISPLAY_FIELDS",
    "CONTENT_DISPLAY_FORM_FIELDS",
    "resolveContentDisplayOptions",
    "buildContentDisplayOptionsFromFormData",
  ].every((token) => sharedDisplayContract.includes(token)) &&
    [
      "show_title_on_page",
      "show_image_on_page",
      "show_category_on_page",
      "show_series_on_page",
      "show_excerpt_on_page",
      "show_date_on_page",
    ].every(
      (name) =>
        sharedDisplayContract.includes(`"${name}"`) &&
        sharedDisplayEditor.includes(`name="${name}"`),
    ),
);
check(
  "Featured contract adopts the shared display capability without a parallel presentation contract",
  contract.includes("display: ContentDisplayOptions") &&
    config.includes(
      "display: buildContentDisplayOptionsFromFormData(formData, false)",
    ) &&
    config.includes("display: resolveContentDisplayOptions({") &&
    !contract.includes("showExcerpt: boolean") &&
    !contract.includes("showDate: boolean"),
);
check(
  "all Featured presentations use one effective item display resolver",
  contract.includes("resolveFeaturedItemDisplay") &&
    contentCard.includes("resolveFeaturedItemDisplay(display, item)") &&
    carousel.includes("resolveFeaturedItemDisplay(display, item)") &&
    loader.includes("display: config.display") &&
    loader.includes("displayFormatting: config.displayFormatting") &&
    carousel.includes("display={display}") &&
    !contentCard.includes("item.display.") &&
    !carousel.includes("item.display."),
);
check(
  "searchable category selection scrolls only through the shared themed listbox viewport",
  editor.includes('name="category_slug"') &&
    editor.includes("searchable") &&
    sharedListbox.includes("ADMIN_FILTER_MENU_SCROLLBAR_CLASSES") &&
    sharedListbox.includes('data-admin-listbox-scroll-viewport=""') &&
    sharedListbox.includes("min-h-0 flex-1") &&
    sharedListbox.includes("flex max-h-[calc(100dvh-24px)] flex-col") &&
    sharedScrollbar.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES") &&
    !editor.includes("scrollbar-width"),
);
check(
  "manual Featured selection adopts the canonical system scrollbar visuals",
  editor.includes('data-featured-manual-items-scroll=""') &&
    editor.includes('<legend className="sr-only">') &&
    editor.includes('data-featured-manual-heading=""') &&
    editor.includes('<AdminFormControlHeader') &&
    editor.includes('title="العناصر اليدوية"') &&
    editor.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES") &&
    editor.includes("max-h-[28rem]") &&
    editor.includes("overflow-y-auto") &&
    sharedScrollbar.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES") &&
    !editor.includes("scrollbar-width"),
);

const availableEditorItems = [
  {
    id: 701,
    contentType: "article" as const,
    title: "العنصر الأول",
    categorySlug: "reference-category",
    publishedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: 503,
    contentType: "article" as const,
    title: "العنصر الثالث",
    categorySlug: "reference-category",
    publishedAt: "2026-08-01T00:00:00.000Z",
  },
];

checkEqual(
  "all available manual IDs resolve without changing authored order",
  resolveFeaturedManualEditorSelection(
    [701, 503],
    availableEditorItems,
  ).map((entry) => ({
    id: entry.id,
    state: entry.state,
    title: entry.item?.title ?? null,
  })),
  [
    { id: 701, state: "resolved", title: "العنصر الأول" },
    { id: 503, state: "resolved", title: "العنصر الثالث" },
  ],
);

const missingMiddleIds = [701, 999001, 503];
const missingMiddleSelection = resolveFeaturedManualEditorSelection(
  missingMiddleIds,
  availableEditorItems,
);
checkEqual(
  "an unavailable ID in the middle becomes a tombstone in the same position",
  missingMiddleSelection.map((entry) => [entry.id, entry.state]),
  [
    [701, "resolved"],
    [999001, "unresolved"],
    [503, "resolved"],
  ],
);

checkEqual(
  "multiple unavailable IDs remain distinct ordered tombstones",
  resolveFeaturedManualEditorSelection(
    [999001, 701, 999002, 503],
    availableEditorItems,
  ).map((entry) => [entry.id, entry.state]),
  [
    [999001, "unresolved"],
    [701, "resolved"],
    [999002, "unresolved"],
    [503, "resolved"],
  ],
);

checkEqual(
  "changing the current option window cannot mutate or reorder authored IDs",
  {
    authored: missingMiddleIds,
    projected: resolveFeaturedManualEditorSelection(
      missingMiddleIds,
      availableEditorItems.slice(0, 1),
    ).map((entry) => entry.id),
  },
  {
    authored: [701, 999001, 503],
    projected: [701, 999001, 503],
  },
);

checkEqual(
  "manual selection changes only through explicit add or remove intent",
  {
    unavailableWindow: resolveFeaturedManualEditorSelection(
      missingMiddleIds,
      [],
    ).map((entry) => entry.id),
    unrelatedRemove: updateFeaturedManualSelection(
      missingMiddleIds,
      123456,
      false,
    ),
    explicitRemove: updateFeaturedManualSelection(
      missingMiddleIds,
      999001,
      false,
    ),
    explicitAdd: updateFeaturedManualSelection(missingMiddleIds, 777, true),
  },
  {
    unavailableWindow: [701, 999001, 503],
    unrelatedRemove: [701, 999001, 503],
    explicitRemove: [701, 503],
    explicitAdd: [701, 999001, 503, 777],
  },
);

checkEqual(
  "a returning source row resolves the original ID without replacement",
  {
    before: missingMiddleSelection[1],
    after: resolveFeaturedManualEditorSelection(missingMiddleIds, [
      ...availableEditorItems,
      {
        id: 999001,
        contentType: "article" as const,
        title: "العنصر العائد",
        categorySlug: "reference-category",
        publishedAt: "2026-09-02T00:00:00.000Z",
      },
    ])[1],
  },
  {
    before: { id: 999001, state: "unresolved", item: null },
    after: {
      id: 999001,
      state: "resolved",
      item: {
        id: 999001,
        contentType: "article",
        title: "العنصر العائد",
        categorySlug: "reference-category",
        publishedAt: "2026-09-02T00:00:00.000Z",
      },
    },
  },
);

const manualPreservationForm = new FormData();
manualPreservationForm.set("source_kind", "categories");
manualPreservationForm.set("category_slug", "reference-category");
manualPreservationForm.set("selection_mode", "manual");
for (const id of [701, 999001, 503, 999002]) {
  manualPreservationForm.append("manual_topic_ids", String(id));
}
manualPreservationForm.set("item_limit", "6");
manualPreservationForm.set("presentation_variant", "group-carousel");
manualPreservationForm.set("items_per_view", "3");
manualPreservationForm.set("show_navigation_arrows", "false");
manualPreservationForm.set("show_navigation_dots", "true");
manualPreservationForm.set("navigation_autoplay", "true");
manualPreservationForm.set("eyebrow", "اختيارات");
manualPreservationForm.set("title", "عنوان محفوظ");
manualPreservationForm.set("presentation_description", "وصف محفوظ");
manualPreservationForm.set("cta_text", "التفاصيل");
manualPreservationForm.set("show_title_on_page", "on");
manualPreservationForm.set("show_image_on_page", "on");
manualPreservationForm.set("show_excerpt_on_page", "on");
const savedManualConfig = buildFeaturedModuleConfig(manualPreservationForm);
const reloadedManualConfig = parseFeaturedModuleConfig(
  JSON.parse(JSON.stringify(savedManualConfig)) as Record<string, unknown>,
);
checkEqual(
  "manual Save and Reload preserve every available and unavailable ID plus presentation settings",
  {
    savedSelection: savedManualConfig.selection,
    reloadedSelection: reloadedManualConfig.selection,
    presentation: {
      variant: reloadedManualConfig.presentation.variant,
      eyebrow: reloadedManualConfig.presentation.eyebrow,
      title: reloadedManualConfig.presentation.title,
      description: reloadedManualConfig.presentation.description,
      ctaText: reloadedManualConfig.presentation.ctaText,
    },
    itemLimit: reloadedManualConfig.itemLimit,
    itemsPerView: reloadedManualConfig.itemsPerView,
    navigation: reloadedManualConfig.navigation,
    display: reloadedManualConfig.display,
  },
  {
    savedSelection: {
      mode: "manual",
      topicIds: [701, 999001, 503, 999002],
    },
    reloadedSelection: {
      mode: "manual",
      topicIds: [701, 999001, 503, 999002],
    },
    presentation: {
      variant: "group-carousel",
      eyebrow: "اختيارات",
      title: "عنوان محفوظ",
      description: "وصف محفوظ",
      ctaText: "التفاصيل",
    },
    itemLimit: 6,
    itemsPerView: 3,
    navigation: { showArrows: false, showDots: true, autoplay: true },
    display: {
      title: true,
      image: true,
      category: false,
      series: false,
      excerpt: true,
      date: false,
    },
  },
);

const automaticPreservationForm = new FormData();
automaticPreservationForm.set("source_kind", "categories");
automaticPreservationForm.set("category_slug", "reference-category");
automaticPreservationForm.set("selection_mode", "automatic");
automaticPreservationForm.append("manual_topic_ids", "999001");
automaticPreservationForm.set("item_limit", "4");
automaticPreservationForm.set("presentation_variant", "list");
automaticPreservationForm.set("items_per_view", "4");
const automaticPreservationConfig = buildFeaturedModuleConfig(
  automaticPreservationForm,
);
checkEqual(
  "Automatic Featured ignores dormant manual fields and keeps its existing contract",
  {
    selection: automaticPreservationConfig.selection,
    variant: automaticPreservationConfig.presentation.variant,
    itemLimit: automaticPreservationConfig.itemLimit,
  },
  { selection: { mode: "automatic" }, variant: "list", itemLimit: 4 },
);

check(
  "every existing presentation preserves the same manual identity contract",
  Object.keys(FEATURED_PRESENTATION_PROFILES).every((variant) => {
    const parsed = parseFeaturedModuleConfig({
      source: { kind: "categories", categorySlug: "reference-category" },
      selection: { mode: "manual", topicIds: missingMiddleIds },
      itemLimit: 4,
      presentation: { variant },
    });
    return (
      parsed.presentation.variant === variant &&
      parsed.selection.mode === "manual" &&
      JSON.stringify(parsed.selection.topicIds) ===
        JSON.stringify(missingMiddleIds)
    );
  }),
);

checkEqual(
  "Public manual projection skips unresolved IDs without fake rows or crashes",
  {
    mixed: resolveAvailableFeaturedManualItems(
      missingMiddleIds,
      availableEditorItems,
    ).map((item) => item.id),
    none: resolveAvailableFeaturedManualItems([999001, 999002], []),
  },
  { mixed: [701, 503], none: [] },
);

check(
  "Featured editor serializes authored IDs and exposes ordered resolved or tombstone state with explicit removal",
  editor.includes("{manualIds.map((id) => (") &&
    !editor.includes("submittedManualIds") &&
    editor.includes('data-featured-manual-selection-order=""') &&
    editor.includes('data-featured-manual-tombstone=""') &&
    editor.includes("data-featured-resolution={entry.state}") &&
    editor.includes("data-featured-manual-remove={entry.id}") &&
    editor.includes("updateFeaturedManualSelection(current, id, checked)"),
);

const displayForm = new FormData();
displayForm.set("source_kind", "categories");
displayForm.set("category_slug", "reference-category");
displayForm.set("selection_mode", "popular");
displayForm.set("item_limit", "4");
displayForm.set("presentation_variant", "editorial");
displayForm.set("items_per_view", "3");
displayForm.set("show_navigation_arrows", "false");
displayForm.set("show_navigation_dots", "true");
displayForm.set("navigation_autoplay", "true");
displayForm.set("presentation_description", "Reference description");
displayForm.set("show_description", "false");
displayForm.set("description_bold", "true");
displayForm.set("description_alignment", "center");
displayForm.set("show_title_on_page", "on");
displayForm.set("show_category_on_page", "on");
displayForm.set("show_excerpt_on_page", "on");
displayForm.set("display_title_bold", "false");
displayForm.set("display_title_alignment", "center");
displayForm.set("display_category_bold", "true");
displayForm.set("display_category_alignment", "left");
displayForm.set("display_series_bold", "false");
displayForm.set("display_series_alignment", "center");
displayForm.set("display_excerpt_bold", "true");
displayForm.set("display_excerpt_alignment", "center");
displayForm.set("display_date_bold", "true");
displayForm.set("display_date_alignment", "left");
const builtConfig = buildFeaturedModuleConfig(displayForm);
const builtDisplay = builtConfig.display;
checkEqual(
  "Featured save preserves selection strategy independently from presentation",
  {
    selection: builtConfig.selection,
    itemLimit: builtConfig.itemLimit,
    itemsPerView: builtConfig.itemsPerView,
    navigation: builtConfig.navigation,
  },
  {
    selection: { mode: "popular" },
    itemLimit: 4,
    itemsPerView: 3,
    navigation: { showArrows: false, showDots: true, autoplay: true },
  },
);
checkEqual(
  "Featured save maps checked and unchecked CMS controls through the shared display contract",
  builtDisplay,
  {
    title: true,
    image: false,
    excerpt: true,
    date: false,
    category: true,
    series: false,
  },
);
checkEqual(
  "Featured description saves through the existing shared formatting contract",
  {
    visible: builtConfig.presentation.showDescription,
    bold: builtConfig.presentation.descriptionBold,
    alignment: builtConfig.presentation.descriptionAlignment,
  },
  { visible: false, bold: true, alignment: "center" },
);
checkEqual(
  "Featured content display formatting saves through the shared text contract without duplicate visibility keys",
  {
    title: {
      bold: builtConfig.displayFormatting.titleBold,
      alignment: builtConfig.displayFormatting.titleAlignment,
    },
    category: {
      bold: builtConfig.displayFormatting.categoryBold,
      alignment: builtConfig.displayFormatting.categoryAlignment,
    },
    series: {
      bold: builtConfig.displayFormatting.seriesBold,
      alignment: builtConfig.displayFormatting.seriesAlignment,
    },
    excerpt: {
      bold: builtConfig.displayFormatting.excerptBold,
      alignment: builtConfig.displayFormatting.excerptAlignment,
    },
    date: {
      bold: builtConfig.displayFormatting.dateBold,
      alignment: builtConfig.displayFormatting.dateAlignment,
    },
    duplicateVisibility: [
      "showCategory",
      "showSeries",
      "showExcerpt",
      "showDate",
    ].map((key) => Object.hasOwn(builtConfig.presentation, key)),
  },
  {
    title: { bold: false, alignment: "center" },
    category: { bold: true, alignment: "left" },
    series: { bold: false, alignment: "center" },
    excerpt: { bold: true, alignment: "center" },
    date: { bold: true, alignment: "left" },
    duplicateVisibility: [false, false, false, false],
  },
);

const legacyDisplay = parseFeaturedModuleConfig({
  source: { kind: "categories", categorySlug: "reference-category" },
  selection: { mode: "automatic" },
  itemLimit: 4,
  presentation: {
    variant: "editorial",
    showExcerpt: false,
    showDate: false,
  },
}).display;
checkEqual(
  "legacy Featured display values remain readable without a migration",
  legacyDisplay,
  {
    title: true,
    image: true,
    excerpt: false,
    date: false,
    category: true,
    series: true,
  },
);

const legacyCarouselConfig = parseFeaturedModuleConfig({
  source: { kind: "categories", categorySlug: "reference-category" },
  selection: { mode: "automatic" },
  itemLimit: 4,
  presentation: {
    variant: "carousel",
    categoryBold: true,
    categoryAlignment: "left",
  },
});
checkEqual(
  "legacy Featured carousel config remains readable without migration or behavior remapping",
  {
    selection: legacyCarouselConfig.selection,
    variant: legacyCarouselConfig.presentation.variant,
    itemLimit: legacyCarouselConfig.itemLimit,
    itemsPerView: legacyCarouselConfig.itemsPerView,
    navigation: legacyCarouselConfig.navigation,
  },
  {
    selection: { mode: "automatic" },
    variant: "carousel",
    itemLimit: 4,
    itemsPerView: 1,
    navigation: { showArrows: true, showDots: false, autoplay: false },
  },
);
checkEqual(
  "legacy Featured content formatting resolves to backward-compatible defaults without migration",
  {
    title: {
      bold: legacyCarouselConfig.displayFormatting.titleBold,
      alignment: legacyCarouselConfig.displayFormatting.titleAlignment,
    },
    category: {
      bold: legacyCarouselConfig.displayFormatting.categoryBold,
      alignment: legacyCarouselConfig.displayFormatting.categoryAlignment,
    },
    series: {
      bold: legacyCarouselConfig.displayFormatting.seriesBold,
      alignment: legacyCarouselConfig.displayFormatting.seriesAlignment,
    },
    excerpt: {
      bold: legacyCarouselConfig.displayFormatting.excerptBold,
      alignment: legacyCarouselConfig.displayFormatting.excerptAlignment,
    },
    date: {
      bold: legacyCarouselConfig.displayFormatting.dateBold,
      alignment: legacyCarouselConfig.displayFormatting.dateAlignment,
    },
  },
  {
    title: { bold: true, alignment: "right" },
    category: { bold: true, alignment: "left" },
    series: { bold: false, alignment: "right" },
    excerpt: { bold: false, alignment: "right" },
    date: { bold: false, alignment: "right" },
  },
);

const effectiveDisplay = resolveFeaturedItemDisplay(
  {
    title: true,
    image: true,
    excerpt: true,
    date: true,
    category: true,
    series: false,
  },
  {
    id: 1,
    contentType: "article",
    slug: "reference-item",
    href: "/topics/reference-item",
    title: "Reference",
    excerpt: "",
    image: "/reference.jpg",
    imageAlt: "",
    category: "Category",
    categorySlug: "category",
    series: "Series",
    seriesSlug: "series",
    date: "2026-08-30",
    publishedAt: "2026-08-30T00:00:00.000Z",
    isFeatured: true,
    isPopular: false,
    viewsCount: 0,
    mediaProject: "",
    mediaKind: null,
    mediaDuration: "",
    display: {
      title: false,
      image: false,
      excerpt: false,
      date: false,
      category: false,
      series: false,
      introCard: true,
    },
  },
);
checkEqual(
  "Featured module visibility is authoritative across every card field while real payload values remain required",
  effectiveDisplay,
  {
    title: true,
    image: true,
    excerpt: false,
    date: true,
    category: true,
    series: false,
  },
);

check(
  "CMS source choice is first and second choice is dependent",
  editor.indexOf('name="source_kind"') <
    editor.indexOf('name="category_slug"') &&
    editor.includes('name="content_type"') &&
    editor.includes("value={sourceKind}") &&
    editor.includes('sourceKind === "categories"') &&
    config.includes("kind === \"categories\" ? { kind, categorySlug } : { kind, contentType }") &&
    resolver.includes("featuredSourceContentTypes(config.source)"),
);
check(
  "every current Featured presentation exposes the complete card payload controls",
  Object.values(FEATURED_PRESENTATION_PROFILES).every(
    (profile) =>
      profile.displayFields.length === 6 &&
      (["image", "title", "excerpt", "date", "category", "series"] as const).every(
        (field) => profile.displayFields.includes(field),
      ),
  ),
);
check(
  "CMS exposes every Featured selection strategy and presentation variant from the owner registries",
  editor.includes("FEATURED_SELECTION_MODES.map") &&
    editor.includes("FEATURED_SELECTION_LABELS_AR[value]") &&
    editor.includes("presentationOptions.map") &&
    editor.includes("FEATURED_PRESENTATION_LABELS_AR[value]"),
);
type FeaturedJsx = ts.JsxElement | ts.JsxSelfClosingElement;
function featuredNodes<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T) {
  const nodes: T[] = [];
  function visit(node: ts.Node) { if (predicate(node)) nodes.push(node); ts.forEachChild(node, visit); }
  visit(root); return nodes;
}
function featuredElements(root: ts.Node, tag: string) {
  return featuredNodes(root, (node): node is FeaturedJsx => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)).filter(node => (ts.isJsxElement(node) ? node.openingElement : node).tagName.getText() === tag);
}
function featuredAttribute(node: FeaturedJsx, name: string, tree: ts.SourceFile) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const attribute = opening.attributes.properties.find((value): value is ts.JsxAttribute => ts.isJsxAttribute(value) && value.name.getText(tree) === name);
  if (!attribute) return undefined;
  const value = attribute.initializer;
  return !value ? "true" : ts.isStringLiteral(value) ? value.text : ts.isJsxExpression(value) ? value.expression?.getText(tree).replace(/\s+/gu, "") : value.getText(tree).replace(/\s+/gu, "");
}
function featuredVariable(tree: ts.SourceFile, name: string) {
  const nodes = featuredNodes(tree, ts.isVariableDeclaration).filter(node => node.name.getText(tree) === name);
  assert.equal(nodes.length, 1, "Actual Featured declaration " + name);
  assert.ok(nodes[0].initializer); return nodes[0].initializer;
}
function featuredGrid(root: ts.Node, variable: string, columns: string, tree: ts.SourceFile) {
  const grids = featuredElements(root, "AdminFormGrid").filter(node => featuredAttribute(node, "columns", tree) === columns && ts.isJsxElement(node) && node.children.some(child => ts.isJsxExpression(child) && child.expression && ts.isIdentifier(child.expression) && child.expression.text === variable));
  assert.equal(grids.length, 1, "Actual shared Grid contains " + variable); return grids[0];
}
function assertFeaturedPresentationSource(editor: string) {
const featuredDisplaySettingsIndex = editor.indexOf(
  "const displayControls =",
);
const featuredDisplayCardIndexes = [
  'showName="show_title_on_page"',
  'showName="show_image_on_page"',
  'showName="show_category_on_page"',
  'showName="show_series_on_page"',
  'showName="show_excerpt_on_page"',
  'showName="show_date_on_page"',
  'showName="show_cta"',
].map((token) => editor.indexOf(token, featuredDisplaySettingsIndex));
assert.ok(
  [
    '<AdminCard presentation="premium"',
    "<AdminFormControlHeader",
    "embedded",
    "<AdminFormGrid columns={4}",
    "مصدر المحتوى",
    "طريقة العرض",
    "العدد المسموح به",
    "إعدادات النمط المختار",
    "تنسيق عناصر المحتوى",
    'name="presentation_variant"',
    'data-featured-variant-settings={presentationVariant}',
    'data-featured-items-per-view-control={',
    'name="items_per_view"',
    'aria-label="العناصر الظاهرة"',
    "presentationProfile.supportsNavigation",
    'name="show_navigation_arrows"',
    'name="show_navigation_dots"',
    'name="navigation_autoplay"',
    'name="presentation_description"',
    'showName="show_eyebrow"',
    'boldName="eyebrow_bold"',
    'alignmentName="eyebrow_alignment"',
    'showName="show_title"',
    'boldName="title_bold"',
    'alignmentName="title_alignment"',
    'showName="show_description"',
    'boldName="description_bold"',
    'alignmentName="description_alignment"',
    "showDefault={descriptionFormat.visible}",
    "boldDefault={descriptionFormat.bold}",
    "alignmentDefault={descriptionFormat.alignment}",
    'showName="show_cta"',
    'boldName="cta_bold"',
    'alignmentName="cta_alignment"',
    'showName="show_title_on_page"',
    'boldName="display_title_bold"',
    'alignmentName="display_title_alignment"',
    'boldName="display_category_bold"',
    'alignmentName="display_category_alignment"',
    'boldName="display_series_bold"',
    'alignmentName="display_series_alignment"',
    'boldName="display_excerpt_bold"',
    'alignmentName="display_excerpt_alignment"',
    'boldName="display_date_bold"',
    'alignmentName="display_date_alignment"',
    '<AdminFormGrid columns={1} className="mt-4">',
    "<ModuleEditorVisibilityAlignRow",
    'name="eyebrow"',
    'name="title"',
    'name="cta_text"',
  ].every((token) => editor.includes(token)) &&
    featuredDisplaySettingsIndex >= 0 &&
    editor.includes('data-featured-display-settings=""') &&
    featuredDisplayCardIndexes.every(
      (index, position, indexes) =>
        index > featuredDisplaySettingsIndex &&
        (position === 0 || index > indexes[position - 1]),
    ) &&
    (editor.match(/<ModuleEditorVisibilityAlignRow/g) ?? []).length === 10 &&
    (editor.match(/controlMode="visibility-only"/g) ?? []).length === 1 &&
    !editor.includes("<ContentDisplaySettings") &&
    !editor.includes("FeaturedDisplayVisibility") &&
    !editor.includes("min-h-36") &&
    !/<input\s+type="hidden"\s+name="show_title_on_page"/u.test(editor) &&
    !editor.includes("<textarea") &&
    !editor.includes('<textarea name="presentation_description"') &&
    !editor.includes(">\n                      Presentation\n"),
);
  const tree = ts.createSourceFile("FeaturedModuleEditClient.tsx", editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const [owner, names] of [
    ["../ui", ["AdminFormField", "AdminFormGrid", "AdminFormSwitch"]],
    ["./ModuleEditorPresentation", ["ModuleEditorSection", "ModuleEditorVisibilityAlignRow"]],
    ["../ui/AdminModuleTabs", ["AdminModuleSectionHeader"]],
  ] as const) for (const name of names) assert.ok(tree.statements.filter(ts.isImportDeclaration).some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === owner && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => !binding.isTypeOnly && !binding.propertyName && binding.name.text === name)), "Canonical Featured owner " + name);
  const variantFields = featuredVariable(tree, "variantFields"), displayFields = featuredVariable(tree, "displayFields");
  const sections = featuredElements(variantFields, "ModuleEditorSection").filter(node => featuredAttribute(node, "id", tree) === "featured-variant-settings-panel");
  assert.equal(sections.length, 1);
  const headers = featuredElements(sections[0], "AdminModuleSectionHeader").filter(node => featuredAttribute(node, "sectionHeading", tree) === "إعدادات النمط المختار" && featuredAttribute(node, "id", tree) === "featured-variant-settings");
  assert.equal(headers.length, 1, "Actual selected-style Section owns its shared Header");
  assert.equal(featuredAttribute(featuredGrid(sections[0], "variantControls", "4", tree), "presentation", tree), "aligned-fields");
  featuredGrid(displayFields, "displayControls", "3", tree);
  const controls = featuredVariable(tree, "displayControls"), rows = featuredElements(controls, "ModuleEditorVisibilityAlignRow");
  const expected = [
    ["show_title_on_page", "عنوان العنصر", "config.display.title", "display_title_bold", "display_title_alignment", "config.displayFormatting.titleBold", "config.displayFormatting.titleAlignment"],
    ["show_image_on_page", "الصورة", "config.display.image"],
    ["show_category_on_page", "التصنيف", "config.display.category", "display_category_bold", "display_category_alignment", "config.displayFormatting.categoryBold", "config.displayFormatting.categoryAlignment"],
    ["show_series_on_page", "السلسلة", "config.display.series", "display_series_bold", "display_series_alignment", "config.displayFormatting.seriesBold", "config.displayFormatting.seriesAlignment"],
    ["show_excerpt_on_page", "المقتطف", "config.display.excerpt", "display_excerpt_bold", "display_excerpt_alignment", "config.displayFormatting.excerptBold", "config.displayFormatting.excerptAlignment"],
    ["show_date_on_page", "التاريخ", "config.display.date", "display_date_bold", "display_date_alignment", "config.displayFormatting.dateBold", "config.displayFormatting.dateAlignment"],
    ["show_cta", "نص الإجراء", "ctaFormat.visible", "cta_bold", "cta_alignment", "ctaFormat.bold", "ctaFormat.alignment"],
  ];
  assert.deepEqual(rows.map(node => featuredAttribute(node, "showName", tree)), expected.map(row => row[0]), "Actual seven payload controls retain native order");
  for (const [index, row] of rows.entries()) for (const [position, name] of ["showName", "label", "showDefault", "boldName", "alignmentName", "boldDefault", "alignmentDefault"].entries()) assert.equal(featuredAttribute(row, name, tree), expected[index][position], "Exact payload binding " + expected[index][0] + " " + name);
  assert.equal(featuredAttribute(rows[1], "controlMode", tree), "visibility-only");
  const variantControls = featuredVariable(tree, "variantControls"), itemControls = featuredElements(variantControls, "FeaturedItemsPerViewControl");
  assert.equal(itemControls.length, 1);
  for (const [name, value] of Object.entries({ variant: "presentationVariant", profile: "presentationProfile", value: "itemsPerView", itemLimit: "Number(itemLimit)", onChange: "setItemsPerView" })) assert.equal(featuredAttribute(itemControls[0], name, tree), value);
  const navigation = featuredNodes(variantControls, ts.isConditionalExpression).filter(node => node.condition.getText(tree) === "presentationProfile.supportsNavigation");
  assert.equal(navigation.length, 1);
  const switches = featuredElements(navigation[0].whenTrue, "AdminFormSwitch"), hidden = featuredElements(navigation[0].whenFalse, "input");
  const names = ["show_navigation_arrows", "show_navigation_dots", "navigation_autoplay"];
  assert.deepEqual(switches.map(node => featuredAttribute(node, "name", tree)), names);
  assert.deepEqual(hidden.map(node => featuredAttribute(node, "name", tree)), names);
  for (const [index, node] of switches.entries()) for (const [name, value] of Object.entries({ value: "true", uncheckedValue: "false", embedded: "true", defaultChecked: ["navigation.showArrows", "navigation.showDots", "navigation.autoplay"][index] })) assert.equal(featuredAttribute(node, name, tree), value);
  for (const node of hidden) { assert.equal(featuredAttribute(node, "type", tree), "hidden"); assert.equal(featuredAttribute(node, "value", tree), "false"); }
}
assertFeaturedPresentationSource(editor);
check("CMS editor separates canonical profile Section/Header/Grid, module heading, and seven ordered payload controls", true);
for (const [name, source] of [
  ["parallel Section owner", editor.replace('from "./ModuleEditorPresentation";', 'from "./ParallelPresentation";')],
  ["missing selected-style Section", editor.replace("<ModuleEditorSection", "<AdminCard").replace("</ModuleEditorSection>", "</AdminCard>")],
  ["disconnected variant controls", editor.replace("{variantControls}", "{null}")],
  ["lost aligned field presentation", editor.replace(' presentation="aligned-fields"', "")],
  ["wrong payload order", editor.replace('showName="show_title_on_page"', 'showName="temporary"').replace('showName="show_image_on_page"', 'showName="show_title_on_page"').replace('showName="temporary"', 'showName="show_image_on_page"')],
  ["wrong payload visibility default", editor.replace("showDefault={config.display.title}", "showDefault={config.display.image}")],
  ["wrong native format name", editor.replace('boldName="display_category_bold"', 'boldName="title_bold"')],
  ["lost image visibility-only mode", editor.replace('controlMode="visibility-only"', 'controlMode="format-only"')],
  ["wrong navigation default", editor.replace("defaultChecked={navigation.showDots}", "defaultChecked={navigation.showArrows}")],
  ["wrong unsupported navigation value", editor.replace('name="show_navigation_arrows"\n          value="false"', 'name="show_navigation_arrows"\n          value="true"')],
  ["disconnected items-per-view callback", editor.replace("onChange={setItemsPerView}", "onChange={setItemLimit}")],
] as const) { assert.notEqual(source, editor, "Effective negative " + name); assert.throws(() => assertFeaturedPresentationSource(source), name); check("Featured presentation source rejects " + name, true); }
check(
  "Featured presentation metadata removes the duplicate outer heading and internal terminology",
  /featured:[\s\S]*?presentation:\s*\{[\s\S]*?sectionHeadingAr: null,[\s\S]*?sectionDescriptionAr: null,[\s\S]*?sectionChrome: "implicit"/u.test(
    moduleEditorMetadata,
  ) &&
    !moduleEditorMetadata.includes('sectionHeadingAr: "Presentation"'),
);
check(
  "Featured adopts the existing shared description and CTA formatting contract end to end",
  [
    'resolvePageBlockTextFormat(\n    presentationRaw,\n    "description",',
    'resolvePageBlockTextFormat(presentationRaw, "cta")',
    '{ field: "description" }',
    '{ field: "cta" }',
    "showDescription: z.boolean()",
    "descriptionBold: z.boolean()",
    'descriptionAlignment: z.enum(["right", "center", "left"])',
    "showCta: z.boolean()",
    "ctaBold: z.boolean()",
    'ctaAlignment: z.enum(["right", "center", "left"])',
  ].every((token) => config.includes(token)) &&
    sharedHeader.includes("presentation.showDescription !== false") &&
    sharedHeader.includes("presentation.descriptionBold") &&
    sharedHeader.includes("presentation.descriptionAlignment") &&
    contentCard.includes('resolvePageBlockTextFormat(presentation, "cta")') &&
    contentCard.includes("ctaFormat.visible") &&
    contentCard.includes("ctaFormat.bold") &&
    contentCard.includes("ctaFormat.alignment"),
);
check(
  "Featured adopts shared payload formatting for title, category, series, excerpt, and date",
  sharedDisplayContract.includes(
    "CONTENT_DISPLAY_FORMATTABLE_TEXT_FIELDS",
  ) &&
    sharedDisplayContract.includes("ContentDisplayFormattableTextField") &&
    sharedDisplayContract.includes("ResolvedCollectionDisplayTextFormatting") &&
    config.includes("resolveCollectionDisplayTextFormatting") &&
    config.includes("displayFormattingRaw") &&
    config.includes("presentationRaw.categoryBold") &&
    contract.includes(
      "displayFormatting: ResolvedCollectionDisplayTextFormatting",
    ) &&
    [
      "titleBold: z.boolean()",
      'titleAlignment: z.enum(["right", "center", "left"])',
      "categoryBold: z.boolean()",
      'categoryAlignment: z.enum(["right", "center", "left"])',
      "seriesBold: z.boolean()",
      'seriesAlignment: z.enum(["right", "center", "left"])',
      "excerptBold: z.boolean()",
      'excerptAlignment: z.enum(["right", "center", "left"])',
      "dateBold: z.boolean()",
      'dateAlignment: z.enum(["right", "center", "left"])',
    ].every((token) => config.includes(token)) &&
    ![
      "showCategory: z.boolean()",
      "showSeries: z.boolean()",
      "showExcerpt: z.boolean()",
      "showDate: z.boolean()",
    ].some((token) => config.includes(token)),
);
check(
  "every Featured public presentation applies content formatting through the two canonical card paths",
  ["title", "category", "series", "excerpt", "date"].every(
    (field) =>
      contentCard.includes(`displayFormatting.${field}`) &&
      carousel.includes(`displayFormatting.${field}`),
  ) &&
    contentCard.includes("pageBlockTextAlignClass") &&
    contentCard.includes("pageBlockTextPlacementClass") &&
    carousel.includes("pageBlockTextAlignClass") &&
    carousel.includes("pageBlockTextPlacementClass") &&
    component.includes("displayFormatting={module.displayFormatting}") &&
    carousel.includes("displayFormatting={displayFormatting}"),
);
function assertFeaturedQuantitySource(editor: string) {
assert.ok(
  editor.includes("العناصر الظاهرة") &&
    editor.includes("العدد المسموح به") &&
    editor.includes('<AdminFormField label="العناصر الظاهرة"') &&
    editor.includes("[color-scheme:dark]") &&
    editor.includes('<AdminFormField label="العدد المسموح به"') &&
    !editor.includes("العناصر الظاهرة في كل مرة") &&
    !editor.includes("يحدد حد الاختيار من المصدر") &&
    !editor.includes("هذه الحقول تخص حمولة الخبر أو المادة نفسها"),
);
  const tree = ts.createSourceFile("FeaturedModuleEditClient.tsx", editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const quantity = tree.statements.filter(ts.isFunctionDeclaration).find(node => node.name?.text === "FeaturedItemsPerViewControl");
  assert.ok(quantity);
  const configurable = featuredElements(quantity, "input").filter(node => featuredAttribute(node, "name", tree) === "items_per_view" && featuredAttribute(node, "type", tree) === "number");
  assert.equal(configurable.length, 1);
  const native = configurable[0];
  assert.ok(native.parent && ts.isJsxElement(native.parent) && native.parent.openingElement.tagName.getText(tree) === "AdminFormField");
  assert.equal(featuredAttribute(native.parent, "label", tree), "العناصر الظاهرة");
  assert.equal(featuredAttribute(native.parent, "required", tree), "true");
  for (const [name, value] of Object.entries({ required: "true", value: "value", min: "resolveFeaturedItemsPerView(variant,policy.min,itemLimit)", max: "resolveFeaturedItemsPerView(variant,policy.max,itemLimit)" })) assert.equal(featuredAttribute(native, name, tree), value);
  const hidden = featuredElements(quantity, "input").filter(node => featuredAttribute(node, "name", tree) === "items_per_view" && featuredAttribute(node, "type", tree) === "hidden");
  assert.equal(hidden.length, 1); assert.equal(featuredAttribute(hidden[0], "value", tree), "value");
  const staticOutputs = featuredElements(quantity, "output");
  assert.equal(staticOutputs.length, 1);
  assert.ok(staticOutputs[0].parent && ts.isJsxElement(staticOutputs[0].parent));
  assert.equal(featuredAttribute(staticOutputs[0].parent, "label", tree), "العناصر الظاهرة");
  const callback = (node: FeaturedJsx, bindings: Record<string, unknown>) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const attribute = opening.attributes.properties.find((value): value is ts.JsxAttribute => ts.isJsxAttribute(value) && value.name.getText(tree) === "onChange")?.initializer;
    assert.ok(attribute && ts.isJsxExpression(attribute) && attribute.expression);
    const compiled = ts.transpileModule("const callback = " + attribute.expression.getText(tree) + ";", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(...Object.keys(bindings), compiled + ";return callback;")(...Object.values(bindings)) as (event: unknown) => void;
  };
  const changed: unknown[] = [];
  callback(native, { onChange: (value: unknown) => changed.push(value) })({ currentTarget: { value: "4" } });
  assert.deepEqual(changed, ["4"], "Quantity keeps its actual controlled callback");
  const limits = featuredElements(tree, "input").filter(node => featuredAttribute(node, "name", tree) === "item_limit");
  assert.equal(limits.length, 1);
  const limit = limits[0];
  assert.ok(limit.parent && ts.isJsxElement(limit.parent) && limit.parent.openingElement.tagName.getText(tree) === "AdminFormField");
  assert.equal(featuredAttribute(limit.parent, "label", tree), "العدد المسموح به");
  assert.equal(featuredAttribute(limit.parent, "required", tree), "true");
  for (const [name, value] of Object.entries({ type: "number", min: "1", max: "12", required: "true", value: "itemLimit" })) assert.equal(featuredAttribute(limit, name, tree), value);
  const raw: unknown[] = [], counts: unknown[] = [];
  const onLimit = callback(limit, { setItemLimit: (value: unknown) => raw.push(value), setItemsPerView: (update: (current: string) => string) => counts.push(update("7")), resolveFeaturedItemsPerView, presentationVariant: "three-cards" });
  onLimit({ currentTarget: { value: "4", valueAsNumber: 4, validity: { valid: true } } });
  assert.deepEqual(raw, ["4"]); assert.deepEqual(counts, [String(resolveFeaturedItemsPerView("three-cards", "7", 4))]);
  onLimit({ currentTarget: { value: "-", valueAsNumber: NaN, validity: { valid: false } } });
  assert.deepEqual(raw, ["4", "-"]); assert.equal(counts.length, 1, "Invalid native edits do not normalize the dependent quantity");
}
assertFeaturedQuantitySource(editor);
check("CMS editor keeps concise canonical Field labels, native quantity policies and controlled callbacks", true);
for (const [name, source] of [
  ["missing numeric Field label", editor.replace('<AdminFormField label="العناصر الظاهرة" required>', "<AdminFormField required>")],
  ["wrong quantity callback", editor.replace("onChange(event.currentTarget.value)", 'onChange("wrong")')],
  ["wrong item-limit callback", editor.replace("setItemLimit(input.value)", 'setItemLimit("wrong")')],
  ["normalizing invalid native edits", editor.replace("if (input.validity.valid)", "if (true)")],
  ["lost native item-limit name", editor.replace('name="item_limit"', 'name="parallel_item_limit"')],
] as const) { assert.notEqual(source, editor, "Effective negative " + name); assert.throws(() => assertFeaturedQuantitySource(source), name); check("Featured quantity source rejects " + name, true); }
check(
  "Cards and list expose a real per-view count while list remains intentionally static",
  /"three-cards":\s*\{[\s\S]*?itemsPerView:\s*\{[\s\S]*?mode:\s*"configurable"[\s\S]*?min:\s*1,[\s\S]*?max:\s*4,/u.test(
    contract,
  ) &&
    /list:\s*\{[\s\S]*?itemsPerView:\s*\{[\s\S]*?mode:\s*"configurable"[\s\S]*?min:\s*1,[\s\S]*?max:\s*12,[\s\S]*?supportsNavigation:\s*false/u.test(
      contract,
    ) &&
    component.includes("items.slice(0, module.itemsPerView).map") &&
    contract.includes('"three-cards": "بطاقات"') &&
    !contract.includes('"three-cards": "3 بطاقات"'),
);
check(
  "Featured metadata stays in a padded flow with stacked taxonomy and independent date across both card paths",
  contentCard.includes('data-featured-metadata-area=""') &&
    contentCard.includes('data-featured-date=""') &&
    contentCard.includes('data-featured-taxonomy-stack=""') &&
    contentCard.includes('className="grid -translate-y-2 gap-1"') &&
    contentCard.includes(
      "relative z-10 mt-auto flex w-full flex-col justify-end",
    ) &&
    contentCard.includes("mt-2 line-clamp-2") &&
    contentCard.includes(
      'size === "large" ? "min-h-14 line-clamp-2" : "min-h-7 line-clamp-1"',
    ) &&
    contentCard.includes(
      '"min-h-[360px] @2xl/slot-module:min-h-[480px]"',
    ) &&
    contentCard.includes('"min-h-[290px]"') &&
    !contentCard.includes("min-h-[420px]") &&
    !contentCard.includes('bg-[#05070B]/75') &&
    contentCard.includes("<PublicGoldPill") &&
    contentCard.includes("? `/topics?category=${encodeURIComponent") &&
    contentCard.includes("text-sm leading-5") &&
    contentCard.includes(
      "text-sm font-medium leading-5 text-white/80 drop-shadow-",
    ) &&
    !contentCard.includes('className="absolute inset-x-0 bottom-0') &&
    carousel.includes('data-featured-metadata-area=""') &&
    carousel.includes('data-featured-date=""') &&
    carousel.includes('data-featured-taxonomy-stack=""') &&
    carousel.includes('className="grid -translate-y-2 gap-1"') &&
    carousel.includes("mt-2 min-h-12 line-clamp-2 text-base leading-7") &&
    carousel.includes("mt-2 min-h-10 line-clamp-2 text-sm leading-6") &&
    carousel.includes(
      "text-sm leading-5 text-white/70 drop-shadow-",
    ) &&
    carousel.includes("<PublicGoldPill>") &&
    carousel.includes("text-sm leading-5 text-[#D8B87A]") &&
    !carousel.includes('bg-[#05070B]/45') &&
    !contentCard.includes(
      'className="flex flex-wrap items-center gap-3 text-xs text-white/55"',
    ) &&
    !carousel.includes(
      'className="flex flex-wrap items-center gap-2 text-xs text-white/38"',
    ),
);
check(
  "CMS category choices come from actual taxonomy owner",
  editorOptions.includes("loadTopicFilterOptionsForAdmin"),
);
check(
  "CMS media types come from the canonical content-type owner",
  editor.includes("MEDIA_EDITABLE_CONTENT_TYPES") &&
    !editor.includes("const MEDIA_TYPES"),
);
check(
  "CMS manual choices are public eligible items from Public Content Read",
  editorOptions.includes("loadPublicContentCollection") &&
    !editorOptions.includes("getSupabaseAdmin"),
);
check("CMS has no placement field", !editor.includes('name="placement"'));

check(
  "Media Hub resolver no longer selects or falls back for Featured",
  !mediaResolver.includes("getFeaturedMediaItems") &&
    mediaResolver.includes('if (sectionKey === "featured") return null'),
);
check(
  "Media Hub editor cannot author another non-listing Featured section",
  mediaEditor.includes('.filter((key) => key !== "featured")') &&
    !mediaEditor.includes('name="media_type"'),
);
check(
  "Media Hub mutation boundary rejects retired non-listing Featured and retains News Listing",
  read("src/app/admin/pages-blocks/blocks/media-hub/actions.ts").includes(
    'sectionKey === "featured" && placement !== "listing"',
  ),
);
check(
  "retired Topics Featured implementation is absent",
  !existsSync(resolve(ROOT, "src/components/topics/FeaturedTopic.tsx")) &&
    !topicsListing.includes("FeaturedTopic"),
);
check(
  "Topics Listing no longer owns Featured selection",
  !topicsLoader.includes("featuredSelection") &&
    topicsPage.includes("composition.featuredModules") &&
    topicsPage.includes("excludeContentIds") &&
    pageSlotLayout.includes(
      "excludeContentIds: composition.featuredModules.flatMap",
    ) &&
    pageSlotLayout.includes("listingContext: resolvedListingContext") &&
    topicsListing.includes("excludeIds: searchQuery ? []") &&
    topicsListing.includes("context.excludeContentIds"),
);

check(
  "shared section header is extracted and adopted by Media plus Featured",
  sharedHeader.includes("CollectionSectionHeaderPresentation") &&
    mediaHeader.includes("CollectionSectionHeader") &&
    component.includes("CollectionSectionHeader"),
);
check(
  "migration creates RLS-protected template and assignment stores",
  migration.includes(
    "create table if not exists public.featured_module_templates",
  ) &&
    migration.includes(
      "create table if not exists public.page_featured_module_assignments",
    ) &&
    (migration.match(/enable row level security/g)?.length ?? 0) === 2,
);
check(
  "migration extends the existing atomic Page Composition owner",
  migration.includes("extend_page_composition_owner") &&
    migration.includes("page_featured_module_assignments") &&
    migration.includes("page_composition_atomic_guard"),
);
check(
  "migration transfers and retires non-listing Media Featured ownership",
  migration.includes("adopt_featured_assignments") &&
    migration.includes("delete from public.media_hub_module_templates") &&
    migration.includes("legacy_media_featured_remaining"),
);
check(
  "migration asserts canonical contract and absence of placement",
  migration.includes("canonical contract drift detected") &&
    migration.includes("template.config ? 'placement'"),
);

await verifyFeaturedPremiumOffline();

await verifyFeaturedReferenceReadContract(ROOT);
check("Featured references preserve category/series semantics and start independent item reads together without unused series", true);

console.log(`Featured Module verification passed (${passed} checks).`);
