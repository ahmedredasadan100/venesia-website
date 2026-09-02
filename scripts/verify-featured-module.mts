import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createJiti } from "jiti";

const ROOT = process.cwd();
const read = (path: string) =>
  readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n/gu, "\n");
const jiti = createJiti(import.meta.url);
const { buildFeaturedModuleConfig, parseFeaturedModuleConfig } =
  await jiti.import<typeof import("../src/lib/featured-modules/config.ts")>(
    "../src/lib/featured-modules/config.ts",
  );
const { resolveFeaturedItemDisplay } = await jiti.import<
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
  "Featured contract separates source, selection, item limit, and presentation",
  [
    "FeaturedSource",
    "FeaturedSelection",
    "FeaturedPresentation",
    "itemLimit",
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
    resolver.includes("new Map") &&
    resolver.includes("manualIds ?? []"),
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
      'isAssignmentPositionAllowed("featured", featured.slot)',
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
    component.includes('presentation.variant === "three-cards"') &&
    component.includes('presentation.variant === "list"') &&
    component.includes('presentation.variant === "single-carousel"') &&
    component.includes('presentation.variant === "group-carousel"'),
);
check(
  "Featured motion presentations directly reuse the shared carousel capability",
  carousel.includes('from "../../hooks/use-auto-carousel"') &&
    carousel.includes('from "../feed-modules/FeedCarouselDots"') &&
    carousel.includes("useAutoCarousel<HTMLDivElement>") &&
    carousel.includes("<FeedCarouselDots") &&
    carousel.includes('autoplay: mode !== "legacy"') &&
    !carousel.includes("useState") &&
    !carousel.includes("setInterval"),
);
check(
  "legacy Featured carousel keeps manual navigation while new motion variants use shared dots",
  component.includes('mode="legacy"') &&
    component.includes('mode="single"') &&
    component.includes('mode="group"') &&
    carousel.includes('mode === "legacy"') &&
    carousel.includes("onClick={goToPrevious}") &&
    carousel.includes("onClick={goToNext}") &&
    carousel.includes("<FeedCarouselDots"),
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
    component.includes("resolveFeaturedItemDisplay(display, item)") &&
    loader.includes("display: config.display") &&
    carousel.includes("display={display}") &&
    !contentCard.includes("item.display.") &&
    !component.includes("item.display."),
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
    editor.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES") &&
    editor.includes("max-h-[28rem]") &&
    editor.includes("overflow-y-auto") &&
    sharedScrollbar.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES") &&
    !editor.includes("scrollbar-width"),
);

const displayForm = new FormData();
displayForm.set("source_kind", "categories");
displayForm.set("category_slug", "reference-category");
displayForm.set("selection_mode", "popular");
displayForm.set("item_limit", "4");
displayForm.set("presentation_variant", "editorial");
displayForm.set("presentation_description", "Reference description");
displayForm.set("show_description", "false");
displayForm.set("description_bold", "true");
displayForm.set("description_alignment", "center");
displayForm.set("show_title_on_page", "on");
displayForm.set("show_category_on_page", "on");
displayForm.set("show_excerpt_on_page", "on");
displayForm.set("category_bold", "true");
displayForm.set("category_alignment", "left");
displayForm.set("series_bold", "false");
displayForm.set("series_alignment", "center");
displayForm.set("excerpt_bold", "true");
displayForm.set("excerpt_alignment", "center");
displayForm.set("date_bold", "true");
displayForm.set("date_alignment", "left");
const builtConfig = buildFeaturedModuleConfig(displayForm);
const builtDisplay = builtConfig.display;
checkEqual(
  "Featured save preserves selection strategy independently from presentation",
  builtConfig.selection,
  { mode: "popular" },
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
    category: {
      bold: builtConfig.presentation.categoryBold,
      alignment: builtConfig.presentation.categoryAlignment,
    },
    series: {
      bold: builtConfig.presentation.seriesBold,
      alignment: builtConfig.presentation.seriesAlignment,
    },
    excerpt: {
      bold: builtConfig.presentation.excerptBold,
      alignment: builtConfig.presentation.excerptAlignment,
    },
    date: {
      bold: builtConfig.presentation.dateBold,
      alignment: builtConfig.presentation.dateAlignment,
    },
    duplicateVisibility: [
      "showCategory",
      "showSeries",
      "showExcerpt",
      "showDate",
    ].map((key) => Object.hasOwn(builtConfig.presentation, key)),
  },
  {
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
  presentation: { variant: "carousel" },
});
checkEqual(
  "legacy Featured carousel config remains readable without migration or behavior remapping",
  {
    selection: legacyCarouselConfig.selection,
    variant: legacyCarouselConfig.presentation.variant,
    itemLimit: legacyCarouselConfig.itemLimit,
  },
  {
    selection: { mode: "automatic" },
    variant: "carousel",
    itemLimit: 4,
  },
);
checkEqual(
  "legacy Featured content formatting resolves to backward-compatible defaults without migration",
  {
    category: {
      bold: legacyCarouselConfig.presentation.categoryBold,
      alignment: legacyCarouselConfig.presentation.categoryAlignment,
    },
    series: {
      bold: legacyCarouselConfig.presentation.seriesBold,
      alignment: legacyCarouselConfig.presentation.seriesAlignment,
    },
    excerpt: {
      bold: legacyCarouselConfig.presentation.excerptBold,
      alignment: legacyCarouselConfig.presentation.excerptAlignment,
    },
    date: {
      bold: legacyCarouselConfig.presentation.dateBold,
      alignment: legacyCarouselConfig.presentation.dateAlignment,
    },
  },
  {
    category: { bold: false, alignment: "right" },
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
    mediaProject: "",
    mediaKind: null,
    mediaDuration: "",
    display: {
      title: true,
      image: true,
      excerpt: true,
      date: true,
      category: false,
      series: true,
      introCard: true,
    },
  },
);
checkEqual(
  "Featured render intersects module choice, public item eligibility, and available values",
  effectiveDisplay,
  {
    title: true,
    image: true,
    excerpt: false,
    date: true,
    category: false,
    series: false,
  },
);

check(
  "CMS source choice is first and second choice is dependent",
  editor.indexOf('name="source_kind"') <
    editor.indexOf('name="category_slug"') &&
    editor.includes('name="content_type"'),
);
check(
  "CMS exposes every Featured selection strategy and presentation variant from the owner registries",
  editor.includes("FEATURED_SELECTION_MODES.map") &&
    editor.includes("FEATURED_SELECTION_LABELS_AR[value]") &&
    editor.includes("presentationOptions.map") &&
    editor.includes("FEATURED_PRESENTATION_LABELS_AR[value]"),
);
const featuredDisplaySettingsIndex = editor.indexOf(
  'data-featured-display-settings=""',
);
const featuredDisplayCardIndexes = [
  'showName="show_eyebrow"',
  'showName="show_title"',
  'showName="show_description"',
  'showName="show_image_on_page"',
  'showName="show_category_on_page"',
  'showName="show_series_on_page"',
  'showName="show_excerpt_on_page"',
  'showName="show_date_on_page"',
  'showName="show_cta"',
].map((token) => editor.indexOf(token, featuredDisplaySettingsIndex));
check(
  "CMS editor adopts nine ordered shared display-control cards and delegates item-title visibility to the item contract",
  [
    "MODULE_EDITOR_CONTROL_CARD_CLASS_NAME",
    "<AdminFormGrid columns={4}",
    "مصدر المحتوى",
    "طريقة العرض",
    "إعدادات العرض",
    'name="presentation_variant"',
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
    'boldName="category_bold"',
    'alignmentName="category_alignment"',
    'boldName="series_bold"',
    'alignmentName="series_alignment"',
    'boldName="excerpt_bold"',
    'alignmentName="excerpt_alignment"',
    'boldName="date_bold"',
    'alignmentName="date_alignment"',
    'className="mt-4 grid items-start gap-4 md:grid-cols-3"',
    'name="show_title_on_page"',
    'value={String(config.display.title)}',
    "<ModuleEditorVisibilityAlignRow",
    'name="eyebrow"',
    'name="title"',
    'name="cta_text"',
  ].every((token) => editor.includes(token)) &&
    featuredDisplaySettingsIndex >= 0 &&
    featuredDisplayCardIndexes.every(
      (index, position, indexes) =>
        index > featuredDisplaySettingsIndex &&
        (position === 0 || index > indexes[position - 1]),
    ) &&
    (editor.match(/<ModuleEditorVisibilityAlignRow/g) ?? []).length === 9 &&
    (editor.match(/controlMode="visibility-only"/g) ?? []).length === 1 &&
    !editor.includes("<ContentDisplaySettings") &&
    !editor.includes("FeaturedDisplayVisibility") &&
    !editor.includes("AdminFormSwitch") &&
    !editor.includes('alignmentName="display_') &&
    !editor.includes("min-h-36") &&
    /<input\s+type="hidden"\s+name="show_title_on_page"\s+value=\{String\(config\.display\.title\)\}/u.test(
      editor,
    ) &&
    !editor.includes("<textarea") &&
    !editor.includes('<textarea name="presentation_description"') &&
    !editor.includes(">\n                      Presentation\n"),
);
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
  "Featured extends the shared text-formatting contract to category, series, excerpt, and date",
  sharedDisplayContract.includes(
    "CONTENT_DISPLAY_FORMATTABLE_TEXT_FIELDS",
  ) &&
    sharedDisplayContract.includes("ContentDisplayFormattableTextField") &&
    sharedDisplayContract.includes(
      "Field in PageBlockFormattableTextField as `show${CapitalizedTextField<Field>}`",
    ) &&
    ["category", "series", "excerpt", "date"].every(
      (field) =>
        sharedDisplayContract.includes(`"${field}"`) &&
        new RegExp(
          `resolvePageBlockTextFormat\\(\\s*presentationRaw,\\s*"${field}"`,
          "u",
        ).test(config),
    ) &&
    [
      "categoryBold: z.boolean()",
      'categoryAlignment: z.enum(["right", "center", "left"])',
      "seriesBold: z.boolean()",
      'seriesAlignment: z.enum(["right", "center", "left"])',
      "excerptBold: z.boolean()",
      'excerptAlignment: z.enum(["right", "center", "left"])',
      "dateBold: z.boolean()",
      'dateAlignment: z.enum(["right", "center", "left"])',
      "visibility: false",
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
  ["category", "series", "excerpt", "date"].every(
    (field) =>
      contentCard.includes(
        `resolvePageBlockTextFormat(presentation, "${field}")`,
      ) &&
      component.includes(
        `resolvePageBlockTextFormat(presentation, "${field}")`,
      ),
  ) &&
    contentCard.includes("pageBlockTextAlignClass") &&
    contentCard.includes("pageBlockTextPlacementClass") &&
    component.includes("pageBlockTextAlignClass") &&
    component.includes("pageBlockTextPlacementClass") &&
    component.includes("presentation={presentation}") &&
    carousel.includes("presentation={presentation}"),
);
check(
  "Featured metadata stays in a padded flow with stacked taxonomy and independent date across both card paths",
  contentCard.includes('data-featured-metadata-area=""') &&
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
    component.includes('data-featured-metadata-area=""') &&
    component.includes('data-featured-taxonomy-stack=""') &&
    component.includes('className="grid -translate-y-2 gap-1"') &&
    component.includes("mt-2 min-h-12 line-clamp-2") &&
    component.includes("mt-2 min-h-10 line-clamp-2") &&
    component.includes(
      "text-sm font-medium leading-5 text-white/70 drop-shadow-",
    ) &&
    component.includes("<PublicGoldPill>") &&
    component.includes("text-sm leading-5 text-[#D8B87A]") &&
    !component.includes('bg-[#05070B]/45') &&
    !contentCard.includes(
      'className="flex flex-wrap items-center gap-3 text-xs text-white/55"',
    ) &&
    !component.includes(
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
  "Media Hub mutation boundary rejects the retired Featured section",
  read("src/app/admin/pages-blocks/blocks/media-hub/actions.ts").includes(
    'sectionKey === "featured"',
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
    topicsPage.includes("excludeIds"),
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

console.log(`Featured Module verification passed (${passed} checks).`);
