import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { getModuleEditorSectionMetadata } from "../src/lib/page-composition/module-registry-metadata.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const jiti = createJiti(import.meta.url);
const {
  HERO_BULK_ACTIONS,
  MODULE_EDITOR_RETURN_PAGE_FORM_FIELD,
  MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM,
  PAGE_BLOCK_BULK_ACTIONS,
  PAGE_BLOCK_PUBLICATION_BULK_ACTIONS,
  isPageModulePubliclyVisible,
  moduleEditHref,
  parsePageBlockBulkAction,
  parsePageBlockBulkIds,
  resolveModuleEditorReturnNavigation,
  resolvePageModuleVisibilityFields,
} = await jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>(
  "../src/lib/page-blocks/admin-utils.ts",
);
const { PAGE_MODULE_KINDS } = await jiti.import<typeof import("../src/lib/page-blocks/types.ts")>(
  "../src/lib/page-blocks/types.ts",
);

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function rejects(run: () => unknown) {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

const tabsOwner = read("src/components/admin/ui/AdminModuleTabs.tsx");
const feedbackOwner = read("src/components/admin/AdminFeedbackProvider.tsx");
const pagesClient = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
const pagesHeader = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksHeader.tsx");
const presentation = read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx");
const presentationContract = read("src/lib/page-blocks/module-editor-presentation-contract.ts");
const blockEditorHeader = read("src/components/admin/page-blocks/BlockEditorContextHeader.tsx");
const assignmentField = read("src/components/admin/page-blocks/ModulePageAssignmentsField.tsx");
const crossPageUsageBanner = read("src/components/admin/page-blocks/ModuleCrossPageUsageBanner.tsx");
const blockStatusOwner = read("src/lib/page-blocks/admin-utils.ts");
const formSwitchOwner = read("src/components/admin/ui/AdminFormSwitch.tsx");
const blockTypes = read("src/lib/page-blocks/types.ts");
const mediaOwner = read("src/components/admin/media/AdminMediaImageField.tsx");
const routeSlotPolicy = read("src/lib/page-composition/route-slot-policy.ts");
const compatibilityPresentation = read("src/lib/page-composition/module-registry-metadata.ts");
const slotMap = read("src/components/admin/page-blocks/PageVisualSlotMap.tsx");
const serverSlotGuard = read("src/app/admin/pages-blocks/pages/page-actions/helpers.ts");
const contentActions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const cardsActions = read("src/app/admin/pages-blocks/blocks/cards/actions.ts");
const cardsRepeater = read("src/components/admin/page-blocks/editors/AdminCardsItemsField.tsx");
const breadcrumbRepeater = read("src/components/admin/page-blocks/editors/BreadcrumbManualItemsField.tsx");
const breadcrumbActions = read("src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts");
const heroPublicLoader = read("src/lib/load-hero-section.ts");
const pageBlockPublicLoader = read("src/lib/page-blocks/load-page-blocks.ts");
const feedPublicLoader = read("src/lib/feed-modules/load-feed-modules.ts");
const mediaSidebarPublicLoader = read("src/lib/media-sidebar-modules/load-media-sidebar-modules.ts");
const mediaHubPublicLoader = read("src/lib/media-hub-modules/load-media-hub-modules.ts");
const mediaSidebarRenderer = read("src/components/media-center/MediaSidebar.tsx");
const mediaHubRenderPlan = read("src/lib/media-hub-modules/build-media-hub-render-plan.ts");
const publicationClosureMigration = read("sql/migrations/20260807120000_system_publication_summary_cards_closure.sql");
const pagesListClient = read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx");
const blocksHub = read("src/app/admin/pages-blocks/blocks/page.tsx");
const blockManager = read("src/components/admin/page-blocks/BlockModuleManagerClient.tsx");
const contentManager = read("src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx");
const summaryManager = read("src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx");
const mediaHubListRoute = read("src/app/admin/pages-blocks/blocks/media-hub/page.tsx");
const mediaSidebarListRoute = read("src/app/admin/pages-blocks/blocks/media-sidebar/page.tsx");
const mediaHubActions = read("src/app/admin/pages-blocks/blocks/media-hub/actions.ts");
const mediaSidebarActions = read("src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts");
const moduleListManagers = [
  blockManager,
  contentManager,
  summaryManager,
  read("src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx"),
];
const pageCompositionRoute = read("src/app/admin/pages-blocks/pages/[id]/page.tsx");
const assignmentColumns = read("src/lib/page-blocks/admin-collection-columns.ts");
const assignmentGrid = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx");
const assignmentRow = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx");
const adminQueries = read("src/lib/page-blocks/admin-queries.ts");
const adminRevalidationOwner = read("src/lib/page-blocks/admin-revalidate.ts");
const assignmentContextQuery = read("src/lib/page-blocks/module-assignments-query.ts");
const heroDetailRoute = read("src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx");
const adoptionManifest = read("src/lib/admin/interaction-system/adoption-manifest.ts");

check(
  "all shared module managers scope visibility pending to the active row",
  moduleListManagers.every(
    (source) =>
      source.includes("instant.getRowInteraction") &&
      source.includes('pendingAction === "visibility"') &&
      !source.includes("interaction.isBlocked") &&
      !source.includes("instant.rowPending?.rowId") &&
      !source.includes("instant.rowPending !== null"),
  ),
);
check(
  "module manager search and pagination exclude row mutation pending",
  !blockManager.includes("pending: collectionBusy") &&
    !blockManager.includes("pending={collectionBusy}") &&
    !contentManager.includes("pending: table.isPending") &&
    !contentManager.includes("pending={table.isPending}") &&
    !summaryManager.includes("pending={instant.bulkInteraction") &&
    moduleListManagers.every(
      (source) =>
        !source.includes("pending: isBusy") &&
        !source.includes("pending={isBusy}"),
    ),
);

check(
  "Page Composition feedback uses the global shared location without a reserved feedback viewport",
  pagesClient.includes('<AdminFeedbackRegion') &&
    pagesClient.includes('placement="global"') &&
    feedbackOwner.includes('return placement === "inline" ? (') &&
    !feedbackOwner.includes("stabilizeLayout") &&
    !feedbackOwner.includes('h-[72px]'),
);

check(
  "Page Modules summary is owned by the shared Section Hero",
  tabsOwner.includes("sectionSummary") &&
    pagesClient.includes("PageModuleKindsSummary") &&
    pagesClient.includes("sectionSummary:") &&
    pagesClient.includes("مرجع موديولات الصفحة ${page.title || page.slug}") &&
    !pagesClient.includes("PageModuleKindsBar") &&
    !pagesHeader.includes("{usedModuleKinds.length}"),
);

check(
  "field nature controls responsive spans and long content defaults to full width",
  presentation.includes("ModuleEditorFieldGrid") &&
    presentation.includes("ModuleEditorField") &&
    presentationContract.includes('"short-description": { defaultSpan: 6') &&
    presentationContract.includes('"long-content": { defaultSpan: 12') &&
    presentationContract.includes('canonical: "eyebrow"') &&
    presentationContract.includes('labelAr: "النص التمهيدي"'),
);

const fieldLayoutAdopters = [
  "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
  "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
  "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
  "src/components/admin/page-blocks/editors/AboutApproachModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
  "src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/ProjectsHubMapModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx",
];

check(
  "all eligible field-layout editors adopt the shared presentation contract",
  fieldLayoutAdopters.every((path) => existsSync(resolve(ROOT, path)) && read(path).includes("ModuleEditorFieldGrid")),
);

const fieldLayoutSources = fieldLayoutAdopters.map(read).join("\n");
check(
  "Page Block editor sections use their full content width",
  !fieldLayoutSources.includes("max-w-") &&
    !presentation.includes("max-w-") &&
    presentationContract.includes('"long-content": { defaultSpan: 12'),
);

check(
  "semantic section headings are shared and generic editor headings stay suppressed",
  compatibilityPresentation.includes("eyebrowAr: null") &&
    compatibilityPresentation.includes("sectionHeadingAr: null") &&
    compatibilityPresentation.includes('sectionChrome: "implicit"') &&
    presentation.includes("ModuleEditorSectionHeading") &&
    presentation.includes("data-module-editor-section-heading") &&
    !fieldLayoutSources.includes("<h2") &&
    !compatibilityPresentation.includes('sectionHeadingAr: "محتوى الموديول"') &&
    blockEditorHeader.includes("eyebrow?: ReactNode"),
);

check(
  "assignment UI keeps only conditional multi-page guidance",
  !assignmentField.includes("helperText") &&
    !assignmentField.includes("اختر الصفحات التي تستخدم هذا الموديول") &&
    !assignmentField.includes("يظهر في الصفحات") &&
    /sectionHeadingAr:\s*"الظهور في الصفحات",\s*sectionDescriptionAr:\s*null/.test(compatibilityPresentation) &&
    crossPageUsageBanner.includes("if (assignments.length <= 1) return null"),
);

const repeaterAdopters = [
  "src/components/admin/page-blocks/editors/AdminCardsItemsField.tsx",
  "src/components/admin/page-blocks/editors/BreadcrumbManualItemsField.tsx",
  "src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/ProjectsHubMapModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx",
];

check(
  "eligible repeaters use the shared three-column card presentation",
  presentation.includes("lg:grid-cols-2 xl:grid-cols-3") &&
    repeaterAdopters.every((path) => {
      const source = read(path);
      return source.includes("ModuleEditorRepeaterGrid") && source.includes("ModuleEditorRepeaterCard");
    }),
);

check(
  "dynamic Card and Breadcrumb repeaters preserve add, remove, reorder, and structured save wiring",
  [cardsRepeater, breadcrumbRepeater].every((source) =>
    source.includes("moveItem") || source.includes("moveRow"),
  ) &&
    cardsRepeater.includes("addItem") &&
    cardsRepeater.includes("removeItem") &&
    cardsRepeater.includes('prefix={`item_${index}`}') &&
    cardsActions.includes("index < 12") &&
    breadcrumbRepeater.includes("addItem") &&
    breadcrumbRepeater.includes("removeItem") &&
    breadcrumbRepeater.includes('prefix={`manual_item_${index}`}') &&
    breadcrumbActions.includes("index < 8"),
);

const heroVisibility = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx");
const heroText = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroTextFieldRow.tsx");
const binaryPresentationSources = [
  heroVisibility,
  heroText,
  read("src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx"),
  read("src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx"),
].join("\n");
check(
  "binary Page Block state delegates to the shared switch",
  presentation.includes("AdminFormSwitch") &&
    heroVisibility.includes("AdminFormSwitch") &&
    heroText.includes("AdminFormSwitch") &&
    !heroVisibility.includes("aria-pressed={show}") &&
    !heroText.includes("aria-pressed={show}") &&
    !binaryPresentationSources.includes("aria-pressed={bold}"),
);

const statusEditorAdopters = [
  "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
  "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
  "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
];
const statusEditorSources = statusEditorAdopters.map(read);
const statusActionAdopters = [
  "src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts",
  "src/app/admin/pages-blocks/blocks/cards/actions.ts",
  "src/app/admin/pages-blocks/blocks/content/actions.ts",
  "src/app/admin/pages-blocks/blocks/cta/actions.ts",
  "src/app/admin/pages-blocks/blocks/feed/actions.ts",
  "src/app/admin/pages-blocks/blocks/media-hub/actions.ts",
  "src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts",
  "src/app/admin/pages-blocks/blocks/hero/actions.ts",
];
const statusActionSources = statusActionAdopters.map(read);
const bulkActionAdopters = [
  ["src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts", "bulkBreadcrumbBlocks"],
  ["src/app/admin/pages-blocks/blocks/cards/actions.ts", "bulkCardsBlocks"],
  ["src/app/admin/pages-blocks/blocks/content/actions.ts", "bulkContentBlocks"],
  ["src/app/admin/pages-blocks/blocks/cta/actions.ts", "bulkCtaBlocks"],
  ["src/app/admin/pages-blocks/blocks/feed/actions.ts", "bulkFeedModules"],
  ["src/app/admin/pages-blocks/blocks/hero/actions.ts", "bulkHeroTemplates"],
] as const;
const heroManager = read("src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx");
const lifecycleTables = [
  "content_block_templates",
  "cta_block_templates",
  "cards_block_templates",
  "breadcrumb_block_templates",
  "feed_module_templates",
  "media_sidebar_module_templates",
  "media_hub_module_templates",
] as const;
const allowedStatusConstraint = "check (status in ('published', 'unpublished'))";

check(
  "Page Block bulk input owner accepts only supported actions and positive safe-integer ids",
  parsePageBlockBulkAction("publish", PAGE_BLOCK_BULK_ACTIONS) === "publish" &&
    parsePageBlockBulkAction("show", HERO_BULK_ACTIONS) === "show" &&
    JSON.stringify(parsePageBlockBulkIds(["1", "2,3", "1"])) === "[1,2,3]" &&
    [null, "", "archive"].every((action) =>
      rejects(() => parsePageBlockBulkAction(action, PAGE_BLOCK_BULK_ACTIONS)),
    ) &&
    [
      [],
      [""],
      ["0"],
      ["-1"],
      ["1.5"],
      ["NaN"],
      ["1,,2"],
      ["1e2"],
      ["0x10"],
      ["+1"],
      ["9007199254740992"],
    ].every((ids) => rejects(() => parsePageBlockBulkIds(ids))),
);

check(
  "all Page Block bulk actions validate the shared strict contract before database or revalidation work",
  bulkActionAdopters.every(([sourceFile, functionName]) => {
    const source = read(sourceFile);
    const start = source.indexOf(`export async function ${functionName}`);
    const nextExport = source.indexOf("\nexport ", start + 1);
    const body = source.slice(start, nextExport === -1 ? undefined : nextExport);
    const actionValidation = body.indexOf("parsePageBlockBulkAction(");
    const idValidation = body.indexOf("parsePageBlockBulkIds(");
    const databaseWork = body.indexOf("getSupabaseAdmin()");
    const revalidation = body.search(/revalidate(?:BlockModulePaths|HeroAdmin)\(/u);
    return (
      start >= 0 &&
      actionValidation >= 0 &&
      idValidation >= 0 &&
      databaseWork > actionValidation &&
      databaseWork > idValidation &&
      revalidation > actionValidation &&
      revalidation > idValidation
    );
  }),
);

check(
  "persisted module lifecycle is binary across database and editor contracts",
  blockStatusOwner.includes('BLOCK_STATUSES: PageBlockStatus[] = ["published", "unpublished"]') &&
    blockTypes.includes('PageBlockStatus = "published" | "unpublished"') &&
    lifecycleTables.every((table) =>
      publicationClosureMigration.includes(`update public.${table} set status = 'unpublished' where status is distinct from 'published'`) &&
      publicationClosureMigration.includes(`constraint ${table}_status_check`) &&
      publicationClosureMigration.includes(allowedStatusConstraint),
    ) &&
    presentation.includes("export function ModuleEditorStatusSwitch") &&
    presentation.includes('name="status"') &&
    presentation.includes('value="published"') &&
    presentation.includes('uncheckedValue="unpublished"') &&
    formSwitchOwner.indexOf('<input type="hidden" name={name} value={uncheckedValue}') <
      formSwitchOwner.indexOf('type="checkbox"') &&
    blockStatusOwner.includes('formData.getAll(key).at(-1)') &&
    statusEditorSources.every((source) =>
      source.includes("ModuleEditorStatusSwitch"),
    ) &&
    statusEditorSources.every((source) =>
      !source.includes("MODULE_EDITOR_STATUS_OPTIONS") &&
      !/<AdminFormListboxSelect\b[^>]*\bname="status"/.test(source),
    ) &&
    statusActionSources.every((source) =>
      source.includes("parseFormStatus(formData)"),
    ) &&
    heroManager.includes("ModuleEditorStatusSwitch") &&
    !heroManager.includes('name="is_published"'),
);

check(
  "compact Block Editor content tabs do not repeat their tab title in a second heading card",
  ["breadcrumb", "cards", "cta"].every((moduleKind) => {
    const metadata = getModuleEditorSectionMetadata(moduleKind, "content");
    return metadata?.sectionChrome === "implicit" &&
      metadata.sectionHeadingAr === null &&
      metadata.sectionDescriptionAr === null;
  }),
);

const groupedContentEditors = [
  "src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
];
check(
  "Content editors distinguish short and long content through the shared presentation owner",
  presentation.includes("export function ModuleEditorContentGroup") &&
    presentation.includes("data-module-editor-content-group") &&
    groupedContentEditors.every((path) => {
      const source = read(path);
      return source.includes('<ModuleEditorContentGroup kind="short">') &&
        source.includes('<ModuleEditorContentGroup kind="long">');
    }),
);

const mediaHubEditor = read("src/components/admin/page-blocks/MediaHubModuleEditClient.tsx");
const mediaSidebarEditor = read("src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx");
const scopedModuleEditors = [
  ...statusEditorSources,
  heroManager,
].join("\n");

check(
  "module editor labels are Arabic and fixed data sources are not fake selects",
  [
    'label="Variant"',
    'label="Source"',
    'label="Background Style"',
    "Primary CTA Label",
    "Secondary CTA Label",
    ">Limit<",
    "Image Position Class",
  ].every((staleLabel) => !scopedModuleEditors.includes(staleLabel)) &&
    /<input\s+type="hidden"\s+name="data_source"\s+value="topics"/u.test(mediaHubEditor) &&
    mediaSidebarEditor.includes('name="data_source"') &&
    !/<AdminFormListboxSelect\b[^>]*\bname="data_source"/u.test(mediaHubEditor) &&
    !/<AdminFormListboxSelect\b[^>]*\bname="data_source"/u.test(mediaSidebarEditor),
);

check(
  "one shared contract resolves public visibility for every Page Module kind",
  PAGE_MODULE_KINDS.length === 8 &&
    PAGE_MODULE_KINDS.every(() =>
      isPageModulePubliclyVisible(true, "published") &&
      !isPageModulePubliclyVisible(false, "published") &&
      !isPageModulePubliclyVisible(true, "unpublished") &&
      !isPageModulePubliclyVisible(false, "unpublished"),
    ) &&
    resolvePageModuleVisibilityFields(true, "unpublished").is_visible === true &&
    resolvePageModuleVisibilityFields(true, "unpublished").is_publicly_visible === false &&
    blockStatusOwner.includes("export function isPageModulePubliclyVisible") &&
    blockStatusOwner.includes("isPublishedPageBlockStatus(templateStatus)") &&
    [
      heroPublicLoader,
      pageBlockPublicLoader,
      feedPublicLoader,
      mediaSidebarPublicLoader,
      mediaHubPublicLoader,
    ].every((source) => source.includes("isPageModulePubliclyVisible")) &&
    (adminQueries.match(/\.\.\.resolvePageModuleVisibilityFields\(/g)?.length ?? 0) === 8,
);

check(
  "Page Composition rows expose effective public truth without overwriting assignment truth",
  blockTypes.includes("is_publicly_visible: boolean") &&
    pagesClient.includes("isPageModulePubliclyVisible") &&
    pagesClient.includes("row.is_publicly_visible") &&
    assignmentGrid.includes("row.is_publicly_visible") &&
    slotMap.includes("row.is_publicly_visible") &&
    assignmentRow.includes("const templatePublished = isPublishedPageBlockStatus") &&
    assignmentRow.includes('disabledReason: "انشر الموديول أولًا') &&
    !pagesClient.includes("router.refresh") &&
    !pagesClient.includes("forceRerender"),
);

check(
  "Page Composition status cells keep the compact shared state contract",
  assignmentGrid.includes("ADMIN_DATA_GRID_COLUMNS.statusCompact") &&
    assignmentRow.includes('display="visibility"') &&
    !assignmentRow.includes('{isVisible ? "ظاهر" : "مخفي"}') &&
    !assignmentRow.includes('{isVisible ? "ظاهر للعامة" : "غير ظاهر للعامة"}'),
);

check(
  "Page Module editors preserve one validated Page Composition return contract",
  MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM === "returnPageId" &&
    MODULE_EDITOR_RETURN_PAGE_FORM_FIELD === "return_page_id" &&
    moduleEditHref("media-hub", 15, { returnPageId: 17 }) ===
      "/admin/pages-blocks/blocks/media-hub/15?returnPageId=17" &&
    moduleEditHref("media-hub", 15) ===
      "/admin/pages-blocks/blocks/media-hub/15" &&
    resolveModuleEditorReturnNavigation("17")?.backHref ===
      "/admin/pages-blocks/pages/17?tab=modules" &&
    resolveModuleEditorReturnNavigation("../17") === null &&
    assignmentRow.includes("returnPageId: row.page_id") &&
    presentation.includes("resolveModuleEditorReturnNavigation") &&
    presentation.includes("MODULE_EDITOR_RETURN_PAGE_FORM_FIELD") &&
    statusActionSources.every((source) =>
      source.includes("withModuleEditorReturnContextFromForm"),
    ) &&
    read("src/app/admin/pages-blocks/pages/page-actions/assignment-duplicate.ts")
      .includes("withModuleEditorReturnPageId"),
);

check(
  "Page Module mutations invalidate literal public and Admin paths with the Next 16 contract",
  adminRevalidationOwner.includes("revalidatePath(normalizedPath);") &&
    adminRevalidationOwner.includes("revalidatePath(`/admin/pages-blocks/pages/${pageId}`);") &&
    !adminRevalidationOwner.includes('revalidatePath(normalizedPath, "page")') &&
    !adminRevalidationOwner.includes('revalidatePath(`/admin/pages-blocks/pages/${pageId}`, "page")'),
);

check(
  "public rendering still requires both published template state and visible assignment state",
  blockStatusOwner.includes("export function isPublishedPageBlockStatus") &&
    blockStatusOwner.includes('return value === "published"') &&
    pageBlockPublicLoader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)") &&
    feedPublicLoader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)") &&
    mediaSidebarPublicLoader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)") &&
    mediaSidebarRenderer.includes(".filter((widget) => widget.isVisible)") &&
    mediaHubPublicLoader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)") &&
    mediaHubRenderPlan.includes(".filter((module) => module.isVisible)"),
);

const mediaAdopters = [
  "src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx",
];
check(
  "shared Page Block image fields own preview, replace, remove, alt text, and clear persistence",
  mediaOwner.includes("altName") &&
    mediaOwner.includes("allowRemove") &&
    mediaOwner.includes('updateValue("")') &&
    mediaOwner.includes('setAltValue("")') &&
    mediaAdopters.every((path) => read(path).includes("altName=")) &&
    contentActions.includes('optionalImagePath(formData, "image_main")') &&
    contentActions.includes('cleanText(formData.get("image_main_alt")) || undefined'),
);

check(
  "route and module compatibility is one contract used by selectors, server validation, and presentation",
  routeSlotPolicy.includes("MODULE_SLOT_CONTRACT") &&
    routeSlotPolicy.includes("getAssignableSlotsForRoute") &&
    routeSlotPolicy.includes("getPreferredSlotsForModuleKind") &&
    compatibilityPresentation.includes("getPreferredSlotsForModuleKind") &&
    slotMap.includes("getSlotCompatibilityLabel") &&
    serverSlotGuard.includes("isSlotAllowedForRoute"),
);

const retiredHint = resolve(ROOT, "src/components/admin/page-blocks/ModuleDependencyHintsPanel.tsx");
const scopedPresentationSources = [
  ...fieldLayoutAdopters,
  ...repeaterAdopters,
  "src/components/admin/page-blocks/BlockEditorContextHeader.tsx",
  "src/components/admin/page-blocks/ModuleCrossPageUsageBanner.tsx",
].map(read).join("\n");

check(
  "permanent module hints and conflicting visible terminology remain retired",
  !existsSync(retiredHint) &&
    !scopedPresentationSources.includes("MODULE HINTS") &&
    !scopedPresentationSources.includes("الفتحة المفضلة") &&
    !/\b(?:Eyebrow|Kicker|Pre-title)\b/.test(scopedPresentationSources),
);

check(
  "Cards item requirements are enforced by validation instead of helper copy",
  cardsActions.includes("assertValidCardsItems") &&
    cardsActions.includes("تحتاج عنوانًا ووصفًا مختصرًا") &&
    !read("src/components/admin/page-blocks/CardsModuleEditClient.tsx").includes("تحتاج عنوانًا ووصفًا مختصرًا"),
);

check(
  "Cards repeater keeps the shared three-column owner and a compact eyebrow-title-description field order",
  presentation.includes("lg:grid-cols-2 xl:grid-cols-3") &&
    cardsRepeater.includes("ModuleEditorRepeaterGrid") &&
    cardsRepeater.indexOf("MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr") <
      cardsRepeater.indexOf("item_${index}_title") &&
    cardsRepeater.indexOf("item_${index}_title") <
      cardsRepeater.indexOf("MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr") &&
    !cardsRepeater.includes("xl:grid-cols-1"),
);

const pageBlockCollectionHeaders = [
  pagesListClient,
  blocksHub,
  blockManager,
  contentManager,
  summaryManager,
  heroManager,
  pageCompositionRoute,
];
check(
  "Page Blocks collection and composition headers use the shared context owner with unified Arabic eyebrows",
  pageBlockCollectionHeaders.every((source) =>
    source.includes("AdminPageContextHeader") && !source.includes("AdminPageHeader"),
  ) &&
    !pageBlockCollectionHeaders.join("\n").includes("Admin Panel") &&
    !pageBlockCollectionHeaders.join("\n").includes("PAGES CONTROL") &&
    !pageBlockCollectionHeaders.join("\n").includes("HERO MODULE") &&
    !blocksHub.includes("Generic CMS Layer") &&
    adoptionManifest.includes('engineLabel: "إدارة الصفحات والموديولات"'),
);

check(
  "Page Composition exposes the mandatory shared Slot contract in columns, filters, sorting, and rows",
  assignmentColumns.includes('{ key: "slot", label: "الموضع", defaultVisible: true, hideable: false }') &&
    assignmentGrid.includes('sortProps("slot")') &&
    assignmentGrid.includes(">الموضع</") &&
    assignmentRow.includes("LAYOUT_SLOT_LABELS_AR[normalizeLayoutSlot(row.slot)]") &&
    pagesClient.includes('paramKey: "slot"') &&
    pagesClient.includes("PAGE_LAYOUT_SLOT_ORDER.map") &&
    pagesClient.includes('slot: (row: PageBlockAssignmentRow)') &&
    pagesClient.includes('values={{ module_type: moduleType, slot, visibility }}'),
);

check(
  "specialized Page Block tables retain their declared shared grid, toolbar, pagination, and row-action owners",
  [blockManager, contentManager, summaryManager, heroManager].every((source) =>
    source.includes("AdminDataGrid") &&
    source.includes("AdminEntityListFilters") &&
    source.includes("AdminTablePagination") &&
    source.includes("AdminDataGridRowActions"),
  ),
);

check(
  "Media Hub and Media Sidebar adopt the shared supported Management Collection lifecycle",
  summaryManager.includes("useAdminTable") &&
    summaryManager.includes("AdminDataGridSortLabel") &&
    summaryManager.includes("useAdminGridSelection") &&
    summaryManager.includes("AdminBulkActionBar") &&
    summaryManager.includes("AdminDataGridCheckboxCell") &&
    summaryManager.includes('paramKey: "status"') &&
    summaryManager.includes("AdminDataGridRowActions") &&
    mediaHubListRoute.includes("bulkMediaHubModuleStatuses") &&
    mediaSidebarListRoute.includes("bulkMediaSidebarModuleStatuses") &&
    [mediaHubActions, mediaSidebarActions].every((source) =>
      source.includes("PAGE_BLOCK_PUBLICATION_BULK_ACTIONS") &&
      source.includes("parsePageBlockBulkIds") &&
      source.includes('.in("id", ids)'),
    ) &&
    parsePageBlockBulkAction("publish", PAGE_BLOCK_PUBLICATION_BULK_ACTIONS) === "publish" &&
    rejects(() =>
      parsePageBlockBulkAction("delete", PAGE_BLOCK_PUBLICATION_BULK_ACTIONS),
    ) &&
    adoptionManifest.includes(
      "Create, duplicate, and delete are not supported by the current Media module domain action contract.",
    ),
);

check(
  "module collection mutations use the Server Action revalidation roundtrip without a parallel reload lifecycle",
  !blockManager.includes("reloadRowsAction") &&
    !blockManager.includes("hydrateRows") &&
    !blockManager.includes("router.refresh") &&
    !heroManager.includes("getHeroTemplateRows") &&
    !heroManager.includes("hydrateRows") &&
    !heroManager.includes("router.refresh") &&
    !contentManager.includes("getContentBlockRows") &&
    !contentManager.includes("hydrateRows") &&
    !contentManager.includes("router.refresh"),
);

check(
  "Page Blocks read owners avoid duplicate template and page payloads while keeping parallel reads",
  adminQueries.includes("const contentTemplateById = new Map") &&
    adminQueries.includes("const heroTemplateById = new Map") &&
    !adminQueries.includes("content_block_templates(name") &&
    !adminQueries.includes("hero_templates(id") &&
    assignmentContextQuery.includes("const pageById = new Map") &&
    !assignmentContextQuery.includes("pages(title,slug,path)") &&
    heroDetailRoute.includes("getHeroModuleAssignmentContext(heroId)") &&
    !heroDetailRoute.includes('.from("pages")') &&
    !heroDetailRoute.includes("hero_assignments(") &&
    pageCompositionRoute.includes("const [pageResult, preference, assignmentsResult] = await Promise.all") &&
    !pageCompositionRoute.includes("assignmentsData = await getPageModuleAssignmentsForAdmin"),
);

console.log(`Page Block Editor Presentation verification passed (${passed} checks).`);
