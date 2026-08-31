import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) =>
  readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n/gu, "\n");
const jiti = createJiti(import.meta.url);

const {
  CONTENT_DISPLAY_FORM_FIELDS,
  TOPICS_LISTING_ITEM_LIMITS,
  TOPICS_LISTING_ITEMS_PER_ROW,
  TOPICS_LISTING_PRESENTATIONS,
  asTopicsListingConfig,
  isTopicsListingTemplate,
} = await jiti.import<typeof import("../src/lib/page-blocks/configs.ts")>(
  "../src/lib/page-blocks/configs.ts",
);
const { getContentModuleEditorKey, resolveContentModuleEditorConfig } =
  await jiti.import<
    typeof import("../src/lib/page-blocks/module-edit-registry.ts")
  >("../src/lib/page-blocks/module-edit-registry.ts");
const { getCategoryAndDescendantIds } = await jiti.import<
  typeof import("../src/lib/admin/content/category-hierarchy.ts")
>("../src/lib/admin/content/category-hierarchy.ts");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const topicsEditor = read(
  "src/components/admin/page-blocks/editors/TopicsListingModuleEditor.tsx",
);
const collectionEditor = read(
  "src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx",
);
const contentDisplaySettings = read(
  "src/components/admin/content/editors/ContentDisplaySettings.tsx",
);
const editorClient = read(
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
);
const editorPage = read(
  "src/app/admin/pages-blocks/blocks/content/[id]/page.tsx",
);
const topicFilterOptionsOwner = read(
  "src/lib/feed-modules/load-topic-filter-options.ts",
);
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const presenter = read("src/components/topics/TopicsListingModule.tsx");
const topicCard = read("src/components/topics/TopicCard.tsx");
const sharedPresenter = read(
  "src/components/collection-modules/CollectionListingPresenter.tsx",
);
const listingShell = read("src/components/topics/TopicsListingContent.tsx");
const topicsPage = read("src/app/(site)/topics/page.tsx");
const publicTopicsAdapter = read("src/lib/topics/load-public-topics.ts");
const publicContentOwner = read("src/lib/content/public-content-read/owner.ts");
const slotNodes = read("src/components/page-composition/slot-module-nodes.tsx");
const slotLayout = read("src/components/page-composition/PageSlotLayout.tsx");
const intro = read("src/components/topics/TopicsIntroSection.tsx");
const featured = read("src/components/featured/FeaturedModuleSection.tsx");
const migration = read(
  "sql/migrations/20260828114621_topics_listing_presentation_phase_1.sql",
);

check(
  "presentation contract is limited to Grid and List",
  JSON.stringify(TOPICS_LISTING_PRESENTATIONS) ===
    JSON.stringify(["grid", "list"]),
);
check(
  "items-per-row contract is limited to 2, 3, and 4",
  JSON.stringify(TOPICS_LISTING_ITEMS_PER_ROW) === JSON.stringify([2, 3, 4]),
);
check(
  "item-limit contract is limited to 6, 9, 12, and 24",
  JSON.stringify(TOPICS_LISTING_ITEM_LIMITS) === JSON.stringify([6, 9, 12, 24]),
);
const hierarchyFixture = [
  {
    id: 1,
    name: "الأب",
    slug: "parent",
    parent_id: null,
    sort_order: 0,
    is_active: true,
  },
  {
    id: 2,
    name: "الابن الأول",
    slug: "child-a",
    parent_id: 1,
    sort_order: 0,
    is_active: true,
  },
  {
    id: 3,
    name: "الابن الثاني",
    slug: "child-b",
    parent_id: 1,
    sort_order: 1,
    is_active: true,
  },
];
check(
  "existing hierarchy owner resolves a parent to itself and every descendant",
  JSON.stringify(getCategoryAndDescendantIds(hierarchyFixture, 1).sort()) ===
    JSON.stringify([1, 2, 3]),
);
check(
  "existing hierarchy owner keeps a selected child scoped to itself",
  JSON.stringify(getCategoryAndDescendantIds(hierarchyFixture, 2)) ===
    JSON.stringify([2]),
);
check(
  "valid listing config is preserved",
  JSON.stringify(
    asTopicsListingConfig({
      presentation: "grid",
      itemsPerRow: 4,
      itemLimit: 24,
      display: {
        title: false,
        image: true,
        excerpt: false,
        date: true,
        category: false,
        series: true,
        details: {
          text: "تفاصيل الموضوع",
          visible: false,
          bold: false,
          alignment: "center",
        },
      },
    }),
  ) ===
    JSON.stringify({
      collection: { type: "all" },
      presentation: "grid",
      itemsPerRow: 4,
      itemLimit: 24,
      display: {
        title: false,
        image: true,
        excerpt: false,
        date: true,
        category: false,
        series: true,
        details: {
          text: "تفاصيل الموضوع",
          visible: false,
          bold: false,
          alignment: "center",
        },
      },
    }),
);
check(
  "invalid listing config resolves to safe Phase 1 defaults",
  JSON.stringify(
    asTopicsListingConfig({
      presentation: "carousel",
      itemsPerRow: 8,
      itemLimit: 99,
    }),
  ) ===
    JSON.stringify({
      collection: { type: "all" },
      presentation: "list",
      itemsPerRow: 3,
      itemLimit: 6,
      display: {
        title: true,
        image: true,
        excerpt: true,
        date: true,
        category: true,
        series: true,
        details: {
          text: "اقرأ المزيد",
          visible: true,
          bold: true,
          alignment: "right",
        },
      },
    }),
);
check(
  "category collection is normalized inside the existing Listing config contract",
  JSON.stringify(
    asTopicsListingConfig({
      collection: { type: "category", categorySlug: "topics" },
      presentation: "list",
      itemsPerRow: 3,
      itemLimit: 6,
    }),
  ) ===
    JSON.stringify({
      collection: { type: "category", categorySlug: "topics" },
      presentation: "list",
      itemsPerRow: 3,
      itemLimit: 6,
      display: {
        title: true,
        image: true,
        excerpt: true,
        date: true,
        category: true,
        series: true,
        details: {
          text: "اقرأ المزيد",
          visible: true,
          bold: true,
          alignment: "right",
        },
      },
    }),
);
check(
  "listing template identity resolves through the existing content-module registry",
  isTopicsListingTemplate("topics-listing", null) &&
    getContentModuleEditorKey("topics-listing", "") === "topics-listing",
);
check(
  "listing editor config resolves through the existing content-module contract",
  JSON.stringify(
    resolveContentModuleEditorConfig({
      slug: "topics-listing",
      variant: "topics-listing",
      config: { presentation: "grid", itemsPerRow: 2, itemLimit: 12 },
    }),
  ) ===
    JSON.stringify({
      collection: { type: "all" },
      presentation: "grid",
      itemsPerRow: 2,
      itemLimit: 12,
      display: {
        title: true,
        image: true,
        excerpt: true,
        date: true,
        category: true,
        series: true,
        details: {
          text: "اقرأ المزيد",
          visible: true,
          bold: true,
          alignment: "right",
        },
      },
    }),
);

const editorFieldNames = Array.from(
  collectionEditor.matchAll(/name="([^"]+)"/gu),
  (match) => match[1],
);
check(
  "Collection is the first editor control before Presentation and Display",
  collectionEditor.indexOf("name={selection.name}") <
    collectionEditor.indexOf('name="presentation"') &&
    collectionEditor.indexOf('name="presentation"') <
      collectionEditor.indexOf('name="items_per_row"') &&
    !collectionEditor.includes("content-type") &&
    !topicsEditor.includes("contentType"),
);
check(
  "shared Admin editor declares only Collection, Presentation, and shared Display controls",
  JSON.stringify([...new Set(editorFieldNames)].sort()) ===
    JSON.stringify([
      "details_text",
      "item_limit",
      "items_per_row",
      "presentation",
    ]) && topicsEditor.includes('name: "collection"'),
);
check(
  "Collection uses the shared Listbox UI and participates in FormData",
  collectionEditor.includes("<AdminFormListboxSelect") &&
    collectionEditor.includes("name={selection.name}") &&
    topicsEditor.includes('name: "collection"') &&
    !collectionEditor.includes('aria-readonly="true"') &&
    topicsEditor.includes('value: "all-topics"') &&
    !collectionEditor.includes('name="content_type"') &&
    !topicsEditor.includes('value: "topics"'),
);
check(
  "Collection editor uses standard sections and keeps its controls in a fixed four-column Admin card grid",
  collectionEditor.match(/<ModuleEditorSection>/gu)?.length === 2 &&
    collectionEditor.includes('className="space-y-6"') &&
    collectionEditor.includes("<ModuleEditorSectionHeading") &&
    collectionEditor.includes("<AdminFormGrid columns={4}") &&
    collectionEditor.match(/MODULE_EDITOR_CONTROL_CARD_CLASS_NAME/gu)
      ?.length === 5 &&
    !collectionEditor.includes("ModuleEditorFieldGrid") &&
    !collectionEditor.includes("data-collection-editor-layer") &&
    !collectionEditor.includes("eyebrow="),
);
check(
  "Collection is presented as Category without redundant helper copy",
  collectionEditor.includes("label={selection.label}") &&
    topicsEditor.includes('label: "التصنيف"') &&
    !collectionEditor.includes('label="المجموعة"') &&
    !topicsEditor.includes('label: "المجموعة"') &&
    !topicsEditor.includes(
      "اختر كل الموضوعات أو تصنيف الموضوعات الذي سيعرضه الموديول.",
    ) &&
    !collectionEditor.includes("hint={collection.hint}"),
);
check(
  "Collection options adopt the shared Admin category-tree depth contract",
  collectionEditor.includes("depth?: number;"),
);
check(
  "Listing reuses the exact Topic display-settings card owner for six overrides",
  collectionEditor.includes(
    'from "../../content/editors/ContentDisplaySettings"',
  ) &&
    collectionEditor.includes("<ContentDisplaySettings") &&
    collectionEditor.includes("includeIntroCard={false}") &&
    collectionEditor.includes("إعدادات العرض") &&
    contentDisplaySettings.includes("sm:grid-cols-2 lg:grid-cols-4") &&
    contentDisplaySettings.includes("<TopicFormSwitch") &&
    [
      "show_title_on_page",
      "show_image_on_page",
      "show_excerpt_on_page",
      "show_date_on_page",
      "show_category_on_page",
      "show_series_on_page",
    ].every((name) => contentDisplaySettings.includes(`name="${name}"`)),
);
check(
  "Collection options reuse the existing published Topics hierarchy owner",
  editorPage.includes("loadTopicFilterOptionsForAdmin") &&
    editorPage.includes("topicCategoryOptions") &&
    editorClient.includes("categoryOptions={topicCategoryOptions}") &&
    topicsEditor.includes("categoryOptions.map") &&
    topicsEditor.includes("depth: category.depth") &&
    topicFilterOptionsOwner.includes('.from("topic_categories")') &&
    topicFilterOptionsOwner.includes("buildAdminCategoryTree") &&
    topicFilterOptionsOwner.includes("flattenAdminCategoryTree") &&
    topicFilterOptionsOwner.includes("parent_id") &&
    topicFilterOptionsOwner.includes('.eq("status", "published")') &&
    topicFilterOptionsOwner.includes('.is("deleted_at", null)'),
);
check(
  "items-per-row control is conditional on Grid and preserved as hidden in List",
  topicsEditor.includes('supportedPresentations: ["grid"]') &&
    collectionEditor.includes("supportsItemsPerRow") &&
    collectionEditor.includes('type="hidden"') &&
    collectionEditor.includes('name="items_per_row"'),
);
check(
  "existing Content editor adopts the dedicated Listing editor",
  editorClient.includes("TopicsListingModuleEditor") &&
    editorClient.includes('editorKey === "topics-listing"') &&
    editorClient.includes('value="topics-listing"'),
);

const listingActionStart = actions.indexOf("function buildTopicsListingConfig");
const listingActionEnd = actions.indexOf(
  "function buildSearchPlatformConfig",
  listingActionStart,
);
const listingAction = actions.slice(listingActionStart, listingActionEnd);
check(
  "save owner validates every Phase 1 option against the shared contract",
  !listingAction.includes('formData.get("content_type")') &&
    listingAction.includes('formData.get("collection")') &&
    listingAction.includes("loadTopicFilterOptionsForAdmin") &&
    listingAction.includes("filterOptions.categories.some") &&
    listingAction.includes("TOPICS_LISTING_PRESENTATIONS.includes") &&
    listingAction.includes("TOPICS_LISTING_ITEMS_PER_ROW.includes") &&
    listingAction.includes("TOPICS_LISTING_ITEM_LIMITS.includes"),
);
check(
  "save owner persists Collection, presentation, and shared module display overrides",
  /return\s*\{\s*collection,[\s\S]*presentation:[\s\S]*itemsPerRow:[\s\S]*itemLimit:[\s\S]*display:[\s\S]*\};/u.test(
    listingAction,
  ) &&
    listingAction.includes(
      "buildContentDisplayOptionsFromFormData(formData, false)",
    ) &&
    Object.values(CONTENT_DISPLAY_FORM_FIELDS).every((name) =>
      contentDisplaySettings.includes(`name="${name}"`),
    ) &&
    listingAction.includes(
      "buildCollectionDetailsActionFromFormData(formData)",
    ) &&
    !/(featured|latest|manual|search|pagination|carousel|masonry)/iu.test(
      listingAction,
    ),
);
check(
  "unsupported collection values cannot be persisted",
  listingAction.includes('collectionValue === "all-topics"') &&
    listingAction.includes('collectionValue.startsWith("category:")') &&
    listingAction.includes("مجموعة الموضوعات المختارة غير مدعومة"),
);

check(
  "pure Listing presenter receives topics and config without a read owner import",
  presenter.includes("topics: Topic[]") &&
    presenter.includes("config: TopicsListingBlockConfig") &&
    presenter.includes("<CollectionListingPresentation") &&
    !/(loadPublicTopicsListing|supabase|searchParams|Pagination|FeaturedTopic)/u.test(
      presenter,
    ),
);
check(
  "pure Listing presenter implements only Grid or List and the item limit",
  presenter.includes("presentation={config.presentation}") &&
    presenter.includes("itemLimit={config.itemLimit}") &&
    presenter.includes("itemsPerRow={config.itemsPerRow}") &&
    sharedPresenter.includes("items.slice(0, itemLimit)") &&
    !/(carousel|masonry|editorial|infinite|loadMore|cardVariant)/iu.test(
      presenter,
    ),
);
check(
  "Listing passes its resolved display decision to every card",
  presenter.includes("displayOverrides={config.display}"),
);
check(
  "shared Details control owns text, visibility, Bold, and three alignments",
  collectionEditor.includes('label="زر التفاصيل"') &&
    collectionEditor.includes('name="details_text"') &&
    collectionEditor.includes('showName="show_details"') &&
    collectionEditor.includes('boldName="details_bold"') &&
    collectionEditor.includes('alignmentName="details_alignment"') &&
    sharedPresenter.includes("display.details.visible") &&
    sharedPresenter.includes("display.details.text") &&
    !sharedPresenter.includes("اقرأ المزيد"),
);
check(
  "Display cards keep the approved hierarchy and Details occupies the adjacent two-row slot",
  contentDisplaySettings.indexOf('name="show_category_on_page"') <
    contentDisplaySettings.indexOf('name="show_excerpt_on_page"') &&
    contentDisplaySettings.indexOf('name="show_series_on_page"') <
      contentDisplaySettings.indexOf('name="show_date_on_page"') &&
    contentDisplaySettings.includes("{children}") &&
    collectionEditor.includes(
      "sm:col-span-2 lg:col-start-3 lg:row-start-1 lg:row-span-2",
    ),
);
check(
  "module display values override Topic defaults while non-Listing cards keep existing defaults",
  topicCard.includes("displayOverrides?.title ?? true") &&
    topicCard.includes("displayOverrides?.image ?? true") &&
    topicCard.includes("displayOverrides?.excerpt ?? true") &&
    topicCard.includes("displayOverrides?.date ?? showDateOnPage") &&
    topicCard.includes("displayOverrides?.category ?? showCategoryOnPage") &&
    topicCard.includes("displayOverrides?.series ?? showSeriesOnPage") &&
    topicCard.includes(
      "displayOverrides?.details ?? DEFAULT_COLLECTION_DETAILS_ACTION",
    ) &&
    sharedPresenter.includes("display.title") &&
    sharedPresenter.includes("display.excerpt") &&
    sharedPresenter.includes("display.image"),
);
check(
  "every desktop items-per-row value maps directly to its requested column count",
  sharedPresenter.includes('2: "@2xl/slot-module:grid-cols-2"') &&
    sharedPresenter.includes('3: "@2xl/slot-module:grid-cols-3"') &&
    sharedPresenter.includes('4: "@2xl/slot-module:grid-cols-4"') &&
    !sharedPresenter.includes("@5xl/slot-module:grid-cols"),
);
check(
  "Grid cards stretch equally while title and excerpt lengths are clamped without reserved blank lines",
  sharedPresenter.includes("grid grid-cols-1 items-stretch gap-6") &&
    sharedPresenter.includes("grid h-full min-h-[430px]") &&
    sharedPresenter.includes("@2xl/collection-listing-card:min-h-0") &&
    sharedPresenter.includes('className="line-clamp-2 text-2xl') &&
    sharedPresenter.includes('className="line-clamp-3 leading-7') &&
    !sharedPresenter.includes("line-clamp-2 min-h-") &&
    !sharedPresenter.includes("line-clamp-3 min-h-"),
);
check(
  "card metadata and media keep stable visual positions",
  sharedPresenter.includes("mb-2 flex min-h-7") &&
    sharedPresenter.includes("flex min-h-5 w-full items-center") &&
    sharedPresenter.includes('className="relative mt-auto block h-[180px]'),
);
check(
  "Details stays inside the existing metadata row without increasing card height",
  sharedPresenter.includes("showDate || showSupplementalMeta || showDetails") &&
    sharedPresenter.includes('data-collection-listing-details=""') &&
    !sharedPresenter.includes("mt-2 inline-flex min-h-10") &&
    sharedPresenter.includes('"mr-auto ml-0 text-left"') &&
    sharedPresenter.includes('"ml-auto mr-0 text-right"'),
);
check(
  "card copy uses compact natural spacing in both Grid and List",
  sharedPresenter.includes(
    'className="flex min-w-0 flex-1 flex-col gap-1.5"',
  ) && sharedPresenter.includes("grid h-full min-h-[430px] gap-5 p-5"),
);
check(
  "existing page shell delegates topic-card mapping to the pure Listing presenter",
  listingShell.includes("<TopicsListingModule") &&
    !listingShell.includes("<TopicCard"),
);
check(
  "Pagination remains outside the pure Listing presenter and Featured is an independent Page Module",
  listingShell.includes('import PublicPagination from "../Pagination"') &&
    !listingShell.includes("FeaturedTopic") &&
    topicsPage.includes("composition.featuredModules") &&
    !presenter.includes("Pagination") &&
    !presenter.includes("FeaturedTopic"),
);

check(
  "Topics page keeps loadPublicTopicsListing as the public read owner",
  topicsPage.includes(
    'import { loadPublicTopicsListing } from "../../../lib/topics/load-public-topics"',
  ) && topicsPage.includes("await loadPublicTopicsListing({"),
);
check(
  "page supplies the resolved topics and the configured limit without moving read logic",
  topicsPage.includes("itemsPerPage: listingConfig.itemLimit") &&
    topicsPage.includes("topics={visibleTopics}") &&
    topicsPage.includes("listingConfig={listingConfig}"),
);
check(
  "persisted Collection supplies the default category to the existing public read owner",
  topicsPage.includes('listingConfig.collection.type === "category"') &&
    topicsPage.includes(
      "const categorySlug = requestedCategorySlug ?? configuredCategorySlug",
    ) &&
    topicsPage.includes("categorySlug: categorySlug || undefined"),
);
check(
  "Topics adapter delegates the selected category without owning a database read",
  publicTopicsAdapter.includes(
    "categorySlugs: params.categorySlug ? [params.categorySlug] : []",
  ) &&
    !publicTopicsAdapter.includes("getSupabaseAdmin") &&
    !publicTopicsAdapter.includes('.from("topic_categories")'),
);
check(
  "existing Public Content owner expands selected categories through the hierarchy owner",
  publicContentOwner.includes("expandPublicCategoryHierarchy") &&
    publicContentOwner.includes("getCategoryAndDescendantIds") &&
    publicContentOwner.includes('.from("topic_categories")') &&
    publicContentOwner.includes('.eq("status", "published")') &&
    publicContentOwner.includes('.is("deleted_at", null)') &&
    publicContentOwner.includes(
      "categorySlugs: await expandPublicCategoryHierarchy(",
    ),
);
check(
  "existing Page Composition renderer injects the page-owned Listing at assignment order",
  slotNodes.includes('if (slug === "topics-listing")') &&
    slotNodes.includes("context.topicsListingContent") &&
    slotLayout.includes("topicsListingContent?: ReactNode"),
);
check(
  "Intro renderer has no Listing dependency",
  !/(TopicsListing|topics-listing)/u.test(intro),
);
check(
  "Featured renderer has no Listing dependency",
  !/(TopicsListing|topics-listing)/u.test(featured),
);

check(
  "seed registers the template and delegates Assignment writes to the existing owner",
  migration.includes("public.content_block_templates") &&
    migration.includes("public.mutate_page_composition(") &&
    migration.includes("'sync_template_pages'") &&
    !/insert\s+into\s+public\.page_content_block_assignments/iu.test(
      migration,
    ) &&
    !/(create\s+table|alter\s+table|create\s+type)/iu.test(migration),
);
check(
  "immutable seed keeps its original Phase 1 config and the parser supplies display defaults",
  migration.includes('"presentation": "list"') &&
    migration.includes('"itemsPerRow": 3') &&
    migration.includes('"itemLimit": 6') &&
    !migration.includes('"contentType"') &&
    !migration.includes('"collection"') &&
    !/(featured|latest|manual|search|pagination|carousel|masonry)/iu.test(
      migration,
    ),
);

console.log(
  `Topics Listing Presentation Phase 1 verification passed (${passed} checks).`,
);
