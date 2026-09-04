import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { getModuleEditorSectionMetadata } from "../src/lib/page-composition/module-registry-metadata.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) =>
  readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n/gu, "\n");
const jiti = createJiti(import.meta.url);
const {
  HERO_BULK_ACTIONS,
  MODULE_EDITOR_RETURN_PAGE_FORM_FIELD,
  MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM,
  PAGE_BLOCK_BULK_ACTIONS,
  PAGE_BLOCK_PUBLICATION_BULK_ACTIONS,
  isPageModulePubliclyVisible,
  moduleEditHref,
  moduleKindLabel,
  parsePageBlockBulkAction,
  parsePageBlockBulkIds,
  resolveModuleEditorReturnNavigation,
  resolvePageModuleVisibilityFields,
} = await jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>(
  "../src/lib/page-blocks/admin-utils.ts",
);
const { PAGE_MODULE_KINDS } = await jiti.import<
  typeof import("../src/lib/page-blocks/types.ts")
>("../src/lib/page-blocks/types.ts");
const { resolveContentModuleEditorConfig } = await jiti.import<
  typeof import("../src/lib/page-blocks/module-edit-registry.ts")
>("../src/lib/page-blocks/module-edit-registry.ts");
const { asContentConfig } = await jiti.import<
  typeof import("../src/lib/page-blocks/configs.ts")
>("../src/lib/page-blocks/configs.ts");
const { parseHeroContentControlsFormData } = await jiti.import<
  typeof import("../src/lib/hero/hero-content-controls.ts")
>("../src/lib/hero/hero-content-controls.ts");
const { orderPageCompositionRowsForDisplay } = await jiti.import<
  typeof import("../src/app/admin/pages-blocks/pages/[id]/page-blocks/page-blocks-utils.ts")
>(
  "../src/app/admin/pages-blocks/pages/[id]/page-blocks/page-blocks-utils.ts",
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
const pagesClient = read(
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
);
const pagesHeader = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksHeader.tsx",
);
const presentation = read(
  "src/components/admin/page-blocks/ModuleEditorPresentation.tsx",
);
const presentationContract = read(
  "src/lib/page-blocks/module-editor-presentation-contract.ts",
);
const blockEditorHeader = read(
  "src/components/admin/page-blocks/BlockEditorContextHeader.tsx",
);
const heroCtaEditor = read(
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx",
);
const heroContentControls = read("src/lib/hero/hero-content-controls.ts");
const dynamicHero = read("src/components/sections/DynamicHeroSection.tsx");
const projectDetailsHero = read(
  "src/components/projects/details/ProjectDetailsHero.tsx",
);
const assignmentField = read(
  "src/components/admin/page-blocks/ModulePageAssignmentsField.tsx",
);
const crossPageUsageBanner = read(
  "src/components/admin/page-blocks/ModuleCrossPageUsageBanner.tsx",
);
const blockStatusOwner = read("src/lib/page-blocks/admin-utils.ts");
const formSwitchOwner = read("src/components/admin/ui/AdminFormSwitch.tsx");
const blockTypes = read("src/lib/page-blocks/types.ts");
const mediaOwner = read("src/components/admin/media/AdminMediaImageField.tsx");
const routeSlotPolicy = read(
  "src/lib/page-composition/page-assignment-contract.ts",
);
const compatibilityPresentation = read(
  "src/lib/page-composition/module-registry-metadata.ts",
);
const slotMap = read("src/components/admin/page-blocks/PageVisualSlotMap.tsx");
const serverSlotGuard = read(
  "src/app/admin/pages-blocks/pages/page-actions/helpers.ts",
);
const homeProjectsActions = read(
  "src/app/admin/pages-blocks/blocks/content/actions.ts",
);
const cardsActions = read("src/app/admin/pages-blocks/blocks/cards/actions.ts");
const cardsRepeater = read(
  "src/components/admin/page-blocks/editors/AdminCardsItemsField.tsx",
);
const breadcrumbRepeater = read(
  "src/components/admin/page-blocks/editors/BreadcrumbManualItemsField.tsx",
);
const breadcrumbActions = read(
  "src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts",
);
const breadcrumbEditor = read(
  "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
);
const breadcrumbEditRoute = read(
  "src/app/admin/pages-blocks/blocks/breadcrumb/[id]/page.tsx",
);
const breadcrumbListRoute = read(
  "src/app/admin/pages-blocks/blocks/breadcrumb/page.tsx",
);
const breadcrumbConfig = read("src/lib/page-blocks/configs.ts");
const sharedDataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");
const heroPublicLoader = read("src/lib/load-hero-section.ts");
const pageBlockPublicLoader = read("src/lib/page-blocks/load-page-blocks.ts");
const feedPublicLoader = read("src/lib/feed-modules/load-feed-modules.ts");
const featuredPublicLoader = read(
  "src/lib/featured-modules/load-featured-modules.ts",
);
const mediaSidebarPublicLoader = read(
  "src/lib/media-sidebar-modules/load-media-sidebar-modules.ts",
);
const mediaHubPublicLoader = read(
  "src/lib/media-hub-modules/load-media-hub-modules.ts",
);
const pageCompositionLoader = read(
  "src/lib/page-blocks/load-page-composition.ts",
);
const mediaHubRenderPlan = read(
  "src/lib/media-hub-modules/build-media-hub-render-plan.ts",
);
const publicationClosureMigration = read(
  "sql/migrations/20260807120000_system_publication_summary_cards_closure.sql",
);
const pagesListClient = read(
  "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
);
const blocksHub = read("src/app/admin/pages-blocks/blocks/page.tsx");
const blockManager = read(
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
);
const contentManager = read(
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
);
const summaryManager = read(
  "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
);
const mediaHubListRoute = read(
  "src/app/admin/pages-blocks/blocks/media-hub/page.tsx",
);
const mediaSidebarListRoute = read(
  "src/app/admin/pages-blocks/blocks/media-sidebar/page.tsx",
);
const mediaHubActions = read(
  "src/app/admin/pages-blocks/blocks/media-hub/actions.ts",
);
const mediaSidebarActions = read(
  "src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts",
);
const moduleListManagers = [
  blockManager,
  contentManager,
  summaryManager,
  read("src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx"),
];
const pageCompositionRoute = read(
  "src/app/admin/pages-blocks/pages/[id]/page.tsx",
);
const assignmentColumns = read(
  "src/lib/page-blocks/admin-collection-columns.ts",
);
const assignmentGrid = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
);
const assignmentRow = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx",
);
const moduleEditRegistry = read("src/lib/page-blocks/module-edit-registry.ts");
const contentEditRoute = read(
  "src/app/admin/pages-blocks/blocks/content/[id]/page.tsx",
);
const contentEditClient = read(
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
);
const genericContentEditor = read(
  "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
);
const contentSection = read("src/components/sections/ContentSection.tsx");
const topicsIntroSection = read("src/components/topics/TopicsIntroSection.tsx");
const topicsCmsMappers = read("src/components/topics/topics-cms-mappers.ts");
const slotModuleNodes = read(
  "src/components/page-composition/slot-module-nodes.tsx",
);
const slotRenderPlan = read(
  "src/components/page-composition/build-slot-render-plan.ts",
);
const adminQueries = read("src/lib/page-blocks/admin-queries.ts");
const adminRevalidationOwner = read("src/lib/page-blocks/admin-revalidate.ts");
const assignmentModalOwner = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/use-page-blocks-assign-modal.ts",
);
const assignmentContextQuery = read(
  "src/lib/page-blocks/module-assignments-query.ts",
);
const heroDetailRoute = read(
  "src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx",
);
const heroEditor = read(
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
);
const heroText = read(
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroTextFieldRow.tsx",
);
const heroOrderEditor = read(
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor.tsx",
);
const adoptionManifest = read(
  "src/lib/admin/interaction-system/adoption-manifest.ts",
);

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
  pagesClient.includes("<AdminFeedbackRegion") &&
    pagesClient.includes('placement="global"') &&
    feedbackOwner.includes('return placement === "inline" ? (') &&
    !feedbackOwner.includes("stabilizeLayout") &&
    !feedbackOwner.includes("h-[72px]"),
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
  "Page Composition resolves product-facing Hero classification without changing the Content persistence route",
  moduleKindLabel("content", "projects-hub-hero", "projects-hub-hero") ===
    "Hero" &&
    moduleKindLabel(
      "content",
      "projects-hub-listing",
      "projects-hub-listing",
    ) === "Content" &&
    moduleEditRegistry.includes("resolveModuleProductKind") &&
    pagesClient.includes("resolveModuleProductKind") &&
    pagesClient.includes("listKind: assignment.module_kind") &&
    assignmentRow.includes("row.template_slug") &&
    assignmentRow.includes("row.template_variant") &&
    assignmentRow.includes("moduleEditHref(row.module_kind"),
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
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
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
  fieldLayoutAdopters.every((path) => {
    const source = read(path);
    return (
      existsSync(resolve(ROOT, path)) &&
      source.includes("ModuleEditorFieldGrid")
    );
  }),
);

const ctaEditor = read(
  "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
);
const heroDescriptionFormatForm = new FormData();
heroDescriptionFormatForm.set("description_bold", "true");
const heroDescriptionFormatControls = parseHeroContentControlsFormData(
  heroDescriptionFormatForm,
);
check(
  "CTA keeps introductory and short-description copy on the shared one-line field presentation",
  ctaEditor.includes('name="eyebrow"') &&
    ctaEditor.includes('name="description"') &&
    ctaEditor.includes('<ModuleEditorField nature="short-text" span={6}>') &&
    !ctaEditor.includes('<textarea\n                        name="description"') &&
    !ctaEditor.includes("h-[72px]"),
);

check(
  "Hero description uses the shared one-line field and persists Bold through the public Hero contract",
  heroEditor.includes(
    '<ModuleEditorField nature="short-description" span={6}>',
  ) &&
    heroEditor.includes('name="description"') &&
    heroEditor.split('boldName="description_bold"').length - 1 === 2 &&
    heroEditor.includes("boldDefault={controls.descriptionBold}") &&
    !heroEditor.includes("AdminRichTextEditor") &&
    heroText.includes("<input") &&
    !heroText.includes("<textarea") &&
    heroContentControls.includes("descriptionBold: boolean") &&
    heroContentControls.includes('readBoolean(\n      "description_bold"') &&
    heroDescriptionFormatControls.descriptionBold === true &&
    dynamicHero.includes(
      'activeConfig.descriptionBold ? "font-bold" : "font-normal"',
    ) &&
    dynamicHero.includes(
      'config.descriptionBold ? "font-bold" : "font-normal"',
    ) &&
    projectDetailsHero.includes(
      'resolvedPresentation.descriptionBold ? "font-bold" : "font-normal"',
    ),
);

check(
  "shared content-field adoption distinguishes paired short copy from full-width long content",
  read(
    "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
  ).includes('<ModuleEditorField nature="short-description" span={6}>') &&
    read(
      "src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx",
    ).includes('<ModuleEditorField nature="long-content" span={12}>') &&
    read(
      "src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx",
    ).includes('<ModuleEditorField nature="long-content" span={12}>'),
);

const normalizedIntro = asContentConfig({
  eyebrow: "Intro",
  title: "Title",
  subtitle: "Subtitle",
  body: "Description",
  showDescription: false,
  titleBold: false,
  subtitleAlignment: "left",
});

check(
  "generic Content contract owns reusable text-only Intro copy, formatting, and visibility",
  normalizedIntro.eyebrow === "Intro" &&
    normalizedIntro.title === "Title" &&
    normalizedIntro.subtitle === "Subtitle" &&
    normalizedIntro.body === "Description" &&
    normalizedIntro.showDescription === false &&
    normalizedIntro.titleBold === false &&
    normalizedIntro.subtitleAlignment === "left" &&
    !breadcrumbConfig.includes("CONTENT_INTRO_LAYOUTS") &&
    !breadcrumbConfig.includes("CONTENT_INTRO_SPACING_PRESETS") &&
    contentEditClient.includes('block.slug === "topics-intro"') &&
    contentEditClient.includes('block.variant === "intro"'),
);

const genericIntroAdminProof = {
  presentationClass: presentation.includes("className?: string"),
  equalHeight: genericContentEditor.includes('className="h-full"'),
  body: genericContentEditor.includes('name="body"'),
  oneLine: genericContentEditor.includes('className={fieldClassName("h-11")}'),
  adoption: contentEditClient.includes("introPresentation={isGenericIntro}"),
  textOnly:
    !genericContentEditor.includes("AdminMediaImageField") &&
    !genericContentEditor.includes('name="image"') &&
    !genericContentEditor.includes('name="intro_layout"') &&
    !genericContentEditor.includes('name="intro_spacing"'),
  saveBoundary:
    homeProjectsActions.includes('body: cleanText(formData.get("body"))') &&
    !homeProjectsActions.includes('formData.has("intro_layout")'),
};

check(
  "generic Intro Admin keeps four equal-height copy cards, a one-line description, and shared formatting controls",
  Object.values(genericIntroAdminProof).every(Boolean),
);

check(
  "public Intro rendering is shared and binds subtitle plus description without a Topics collection consumer",
  contentSection.includes("export function ContentIntroPresentation") &&
    contentSection.includes("config.subtitle?.trim()") &&
    contentSection.includes("config.body?.trim()") &&
    contentSection.includes('data-content-intro-presentation=""') &&
    !contentSection.includes("data-content-intro-media") &&
    !contentSection.includes('from "next/image"') &&
    topicsIntroSection.includes("ContentIntroPresentation") &&
    slotModuleNodes.includes("<ContentIntroPresentation") &&
    slotModuleNodes.includes("asContentConfig(block.template.config)") &&
    !topicsCmsMappers.includes("mapTopicsIntroBlock") &&
    !topicsIntroSection.includes("loadPublicTopicsListing") &&
    !contentSection.includes("loadPublicTopicsListing") &&
    !genericContentEditor.includes("collection_source") &&
    !genericContentEditor.includes("item_limit") &&
    !genericContentEditor.includes("pagination"),
);

check(
  "Breadcrumb adopts full-width source geometry, compact shared switch presentation, and no redundant manual-link hint",
  breadcrumbEditor.includes('sizing="full"') &&
    !breadcrumbEditor.includes(
      'label="إظهار الرئيسية" value="true" defaultChecked={config.showHome !== false} surface',
    ) &&
    !breadcrumbRepeater.includes(
      "للعناصر اليدوية فقط: اختر الرابط من النظام بدل كتابة مسار داخلي.",
    ),
);

check(
  "module editor headers use the reference meta and action density without nested status pills or a local back arrow",
  blockEditorHeader.includes("meta ?? statusInfo?.label") &&
    !blockEditorHeader.includes("AdminStatusPill") &&
    !blockEditorHeader.includes('aria-hidden="true">→'),
);

check(
  "Hero CTA adopts the shared inline Visibility Bold Alignment toolbar and persists its existing CTA element formatting",
  presentation.indexOf("{renderControls(`إعدادات ${targetLabel}`)}") <
    presentation.indexOf("{child}") &&
    presentation.includes(
      'className="flex min-w-0 items-center justify-between gap-2"',
    ) &&
    !presentation.includes("تنسيق الزر</span>") &&
    heroCtaEditor.includes('boldName="cta_bold"') &&
    heroContentControls.includes("ctaBold: boolean") &&
    heroContentControls.includes('readBoolean("cta_bold", defaults.ctaBold)') &&
    dynamicHero.includes('config.ctaBold ? "font-bold" : "font-medium"') &&
    projectDetailsHero.includes("resolvedPresentation.ctaBold"),
);

check(
  "Hero identity keeps name, display mode, and publication adjacent without stretching selection controls",
  heroEditor.includes(
    "xl:grid-cols-[minmax(16rem,20rem)_max-content_max-content]",
  ) &&
    heroEditor.match(/className="xl:col-span-1!"/g)?.length === 3 &&
    heroEditor.includes(
      '<AdminFormListboxSelect\n            name="variant"',
    ) &&
    !heroEditor.includes(
      '<input type="hidden" name="variant" value="project-detail"',
    ),
);

check(
  "Project Detail Hero adopts shared page assignment and three compact independently ordered action cards",
  heroEditor.includes(
    "<ModuleEditorPagesTab\n                  moduleName={hero.name}",
  ) &&
    !heroEditor.includes("...(!isProjectDetail") &&
    heroOrderEditor.includes('data-project-hero-action-cards=""') &&
    heroOrderEditor.includes("PROJECT_HERO_ACTION_VISIBILITY_FIELDS") &&
    heroOrderEditor.includes('name="project_action_order"') &&
    heroOrderEditor.includes("id={`project-hero-action-${key}`}") &&
    heroOrderEditor.includes('className="grid min-w-0 gap-3 md:grid-cols-3"') &&
    projectDetailsHero.includes("showProjectActions") &&
    projectDetailsHero.includes("gridColumnsClassName") &&
    projectDetailsHero.includes("order.map((key)"),
);

check(
  "Projects Hub and Project Detail Hero remain distinct editors with shared navigation between their owners",
  contentEditRoute.includes('.from("hero_templates")') &&
    contentEditRoute.includes('.eq("variant", "project-detail")') &&
    contentEditRoute.includes("withModuleEditorReturnPageId(") &&
    contentEditRoute.includes("?tab=buttons") &&
    contentEditClient.includes('id: "details"') &&
    contentEditClient.includes("moduleSlug={presentationSlug}") &&
    contentEditClient.includes("PROJECT_HERO_ACTION_KEYS.map") &&
    contentEditClient.includes("data-related-project-hero-action-card") &&
    contentEditClient.includes(
      "href={`${links.buttons}#project-hero-action-${key}`}",
    ) &&
    contentEditClient.indexOf("<ProjectDetailHeroEditorLinks") >
      contentEditClient.indexOf('id: "details"') &&
    compatibilityPresentation.includes('navigationLabelAr: "شرائح الهيرو"') &&
    compatibilityPresentation.includes('navigationLabelAr: "زر التفاصيل"') &&
    compatibilityPresentation.includes('navigationLabelAr: "Hero التفاصيل"') &&
    !contentEditClient.includes("show_project_download_action") &&
    heroDetailRoute.includes('resolvedSearch.tab === "buttons"') &&
    heroEditor.includes("initialTabId={initialTabId}"),
);

const sharedIdentityAdopters = [
  "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
  "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
  "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
];
check(
  "module editors adopt the shared identity strip before tabs and preserve internal metadata without an empty Settings tab",
  presentation.includes("export function ModuleEditorIdentitySection") &&
    presentation.includes("data-module-editor-identity") &&
    sharedIdentityAdopters.every((path) => {
      const source = read(path);
      return (
        source.indexOf("<ModuleEditorIdentitySection") <
          source.indexOf("<ModuleEditorTabs") &&
        !source.includes("<ModuleEditorSettingsComposition") &&
        !source.includes('id: "settings"') &&
        !source.includes('id: "meta"')
      );
    }),
);

check(
  "Hero image metrics eagerly read the canonical public DOM without duplicating rendering geometry",
  heroEditor.includes('querySelector<HTMLElement>("[data-hero-family]")') &&
    heroEditor.includes("Rendered Hero Area:") &&
    heroEditor.includes("Safe Visible Source Area:") &&
    heroEditor.includes("frameWindow.getComputedStyle(image)") &&
    heroEditor.includes("hero.getBoundingClientRect()") &&
    heroEditor.includes("data-hero-rendered-area-state={state.status}") &&
    !heroEditor.includes('loading="lazy"') &&
    !heroEditor.includes("h-[min(62vh,580px)]"),
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
  "assignment UI groups standalone and family pages in two shared cards with premium shared selection",
  !assignmentField.includes("helperText") &&
    !assignmentField.includes("اختر الصفحات التي تستخدم هذا الموديول") &&
    !assignmentField.includes("يظهر في الصفحات") &&
    assignmentField.includes('data-module-page-groups=""') &&
    assignmentField.includes('title: "الصفحات الرئيسية"') &&
    assignmentField.includes('title: "مجموعات الصفحات"') &&
    assignmentField.includes("familyRootSegments") &&
    assignmentField.includes('presentation="premium"') &&
    /sectionHeadingAr:\s*"الظهور في الصفحات",\s*sectionDescriptionAr:\s*null/.test(
      compatibilityPresentation,
    ) &&
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
  "eligible repeaters use the shared responsive card presentation",
  presentation.includes("lg:grid-cols-2") &&
    presentation.includes("columns?: 2 | 3") &&
    presentation.includes(
      'columns === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3"',
    ) &&
    repeaterAdopters.every((path) => {
      const source = read(path);
      return (
        source.includes("ModuleEditorRepeaterGrid") &&
        source.includes("ModuleEditorRepeaterCard")
      );
    }),
);

check(
  "dynamic Card and Breadcrumb repeaters preserve add, remove, reorder, and structured save wiring",
  [cardsRepeater, breadcrumbRepeater].every(
    (source) => source.includes("moveItem") || source.includes("moveRow"),
  ) &&
    cardsRepeater.includes("addItem") &&
    cardsRepeater.includes("removeItem") &&
    cardsRepeater.includes("prefix={`item_${index}`}") &&
    cardsActions.includes("index < 12") &&
    breadcrumbRepeater.includes("addItem") &&
    breadcrumbRepeater.includes("removeItem") &&
    breadcrumbRepeater.includes("prefix={`manual_item_${index}`}") &&
    breadcrumbActions.includes("index < 8"),
);

const resolvedAboutIntro = resolveContentModuleEditorConfig({
  slug: "about-intro",
  variant: "about-intro",
  config: {
    title: "من نحن",
    beats: [{ num: "01", title: "البداية من الأرض", text: "محتوى فعلي" }],
  },
});
const resolvedAboutIntroBeats = (
  resolvedAboutIntro as { beats?: Array<{ title?: string }> }
).beats;
check(
  "Content editors receive one canonical server read model and rehydrate by persisted revision",
  moduleEditRegistry.includes(
    "export function resolveContentModuleEditorConfig",
  ) &&
    contentEditRoute.includes("resolveContentModuleEditorConfig({") &&
    contentEditRoute.includes("config={config}") &&
    !contentEditRoute.includes("block={block}") &&
    !contentEditClient.includes("block.config") &&
    contentEditClient.includes("config: unknown") &&
    contentEditClient.includes("key={`${block.id}:${block.updated_at}`}") &&
    resolvedAboutIntroBeats?.[0]?.title === "البداية من الأرض",
);

check(
  "Content composition cannot source editor-owned data from a Cards template",
  !slotRenderPlan.includes("about-intro-beats") &&
    !slotRenderPlan.includes("about-documentary-beats") &&
    !slotModuleNodes.includes('bySlug.get("about-documentary-beats")') &&
    !slotModuleNodes.includes("mapAboutDocumentaryBeatsBlock") &&
    slotModuleNodes.includes("mapAboutIntroBeatsFromBlock(block)"),
);

check(
  "shared identity composition aligns publication with naturally sized labeled controls",
  presentation.includes("data-module-editor-identity") &&
    presentation.includes(
      "xl:grid-cols-[minmax(16rem,20rem)_max-content_max-content]",
    ) &&
    presentation.includes("surface={false}") &&
    presentation.includes("items-end pb-1.5"),
);

check(
  "Breadcrumb editor keeps empty manual state, internal identity, and assignment-owned placement",
  breadcrumbRepeater.includes("return initial;") &&
    !breadcrumbRepeater.includes("empty-breadcrumb-0") &&
    breadcrumbRepeater.includes("{rows.length ? (") &&
    breadcrumbRepeater.includes("current.filter") &&
    breadcrumbEditor.includes('className="items-end"') &&
    breadcrumbEditor.includes('sizing="full"') &&
    breadcrumbEditor.includes('className="flex h-full items-end pb-1.5"') &&
    !breadcrumbEditor.includes('surface className="h-full"') &&
    (breadcrumbEditor.match(/span=\{4\}/g)?.length ?? 0) >= 3 &&
    presentation.includes("className={`h-full ${className}`.trim()}") &&
    !breadcrumbEditor.includes("ModuleEditorTechnicalIdentity") &&
    !breadcrumbEditor.includes(
      'name="variant"\n                      label="نمط العرض"',
    ) &&
    blockManager.includes('technicalIdentityMode?: "editable" | "internal"') &&
    blockManager.includes('variantFieldMode?: "editable" | "internal"') &&
    blockManager.includes("blockSearchPlaceholder(") &&
    blockManager.includes('technicalIdentityMode === "editable"') &&
    blockManager.includes('variantFieldMode === "editable"') &&
    !blockManager.includes(
      'placeholder: "ابحث باسم البلوك أو المعرّف أو النمط…"',
    ) &&
    blockManager.includes("slug?: string") &&
    blockManager.includes("variant?: string") &&
    breadcrumbListRoute.includes(
      '.select("id,name,description,status,updated_at")',
    ) &&
    !breadcrumbListRoute.includes('select("id,name,slug') &&
    breadcrumbEditRoute.includes(
      '.select("id,name,description,style_preset,status,config")',
    ) &&
    !breadcrumbEditRoute.includes('.select("*")') &&
    pagesClient.includes(
      'placeholder: "ابحث باسم الموديول أو نوعه أو موضع العرض…"',
    ) &&
    !pagesClient.includes(
      "${LAYOUT_SLOT_LABELS_AR[normalizeLayoutSlot(row.slot)]} ${row.template_id}",
    ) &&
    getModuleEditorSectionMetadata("breadcrumb", "settings")
      ?.sectionDescriptionAr ===
      "أدر اسم الموديول ووصفه الداخلي وحالة النشر." &&
    breadcrumbActions.includes("resolveUniqueSlug") &&
    breadcrumbActions.includes('.select("slug,variant")') &&
    breadcrumbConfig.includes("deserializeAdminLink(row.link)"),
);

check(
  "Page Composition free ordering uses the shared grip with keyboard parity and atomic persistence",
  sharedDataGrid.includes("export function AdminDataGridReorderHandle") &&
    sharedDataGrid.includes('aria-keyshortcuts="ArrowUp ArrowDown Home End"') &&
    assignmentRow.includes("AdminDataGridReorderHandle") &&
    assignmentGrid.includes("onDragStart") &&
    assignmentGrid.includes("onDrop") &&
    pagesClient.includes("handleReorderAssignment") &&
    pagesClient.includes("reorderPageComposition("),
);

check(
  "Page Composition presents the page structure top-to-bottom without reversing persisted row order",
  orderPageCompositionRowsForDisplay([
    { module_kind: "content" },
    { module_kind: "feed" },
    { module_kind: "hero" },
    { module_kind: "breadcrumb" },
    { module_kind: "cards" },
  ])
    .map((row) => row.module_kind)
    .join(",") === "hero,breadcrumb,content,feed,cards" &&
    pagesClient.includes(
      "orderPageCompositionRowsForDisplay(instant.rows)",
    ) &&
    pagesClient.includes("initialRows: pageDisplayRows") &&
    pagesClient.includes("setRows(pageDisplayRows)"),
);

const heroVisibility = read(
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx",
);
check(
  "binary Page Block state delegates to the shared switch",
  presentation.includes("AdminFormSwitch") &&
    heroVisibility.includes("ModuleEditorVisibilityAlignRow as default") &&
    heroText.includes("HeroVisibilityAlignRow") &&
    !heroText.includes("AdminFormSwitch") &&
    !heroVisibility.includes("aria-pressed={show}") &&
    !heroText.includes("aria-pressed={show}") &&
    presentation.includes("AdminTextFormatControls") &&
    !heroVisibility.includes("ALIGN_OPTIONS") &&
    !heroVisibility.includes("function toolClass") &&
    presentation.includes("name={boldName}") &&
    presentation.includes("value={String(hasBoldControl ? bold : boldDefault)}"),
);

check(
  "shared formatting row owns a payload-clean visibility-only mode",
  presentation.includes('controlMode?: "text"') &&
    presentation.includes('controlMode: "visibility-only"') &&
    presentation.includes("alignmentName?: never") &&
    presentation.includes("data-module-editor-control-mode={controlMode}") &&
    presentation.includes("{alignmentName ? (") &&
    presentation.includes("hasAlignmentControl || hasBoldControl"),
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
  [
    "src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts",
    "bulkBreadcrumbBlocks",
  ],
  ["src/app/admin/pages-blocks/blocks/cards/actions.ts", "bulkCardsBlocks"],
  ["src/app/admin/pages-blocks/blocks/content/actions.ts", "bulkContentBlocks"],
  ["src/app/admin/pages-blocks/blocks/cta/actions.ts", "bulkCtaBlocks"],
  ["src/app/admin/pages-blocks/blocks/feed/actions.ts", "bulkFeedModules"],
  ["src/app/admin/pages-blocks/blocks/hero/actions.ts", "bulkHeroTemplates"],
] as const;
const heroManager = read(
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
);
const lifecycleTables = [
  "content_block_templates",
  "cta_block_templates",
  "cards_block_templates",
  "breadcrumb_block_templates",
  "feed_module_templates",
  "media_sidebar_module_templates",
  "media_hub_module_templates",
] as const;
const allowedStatusConstraint =
  "check (status in ('published', 'unpublished'))";

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
    const body = source.slice(
      start,
      nextExport === -1 ? undefined : nextExport,
    );
    const actionValidation = body.indexOf("parsePageBlockBulkAction(");
    const idValidation = body.indexOf("parsePageBlockBulkIds(");
    const databaseWork = body.indexOf("getSupabaseAdmin()");
    const revalidation = body.search(
      /revalidate(?:BlockModulePaths|HeroAdmin)\(/u,
    );
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
  blockStatusOwner.includes(
    'BLOCK_STATUSES: PageBlockStatus[] = ["published", "unpublished"]',
  ) &&
    blockTypes.includes('PageBlockStatus = "published" | "unpublished"') &&
    lifecycleTables.every(
      (table) =>
        publicationClosureMigration.includes(
          `update public.${table} set status = 'unpublished' where status is distinct from 'published'`,
        ) &&
        publicationClosureMigration.includes(
          `constraint ${table}_status_check`,
        ) &&
        publicationClosureMigration.includes(allowedStatusConstraint),
    ) &&
    presentation.includes("export function ModuleEditorStatusSwitch") &&
    presentation.includes('name="status"') &&
    presentation.includes('value="published"') &&
    presentation.includes('uncheckedValue="unpublished"') &&
    formSwitchOwner.indexOf(
      '<input type="hidden" name={name} value={uncheckedValue}',
    ) < formSwitchOwner.indexOf('type="checkbox"') &&
    blockStatusOwner.includes("formData.getAll(key).at(-1)") &&
    statusEditorSources.every(
      (source) =>
        source.includes("ModuleEditorStatusSwitch") ||
        source.includes("ModuleEditorIdentitySection"),
    ) &&
    statusEditorSources.every(
      (source) =>
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
    return (
      metadata?.sectionChrome === "implicit" &&
      metadata.sectionHeadingAr === null &&
      metadata.sectionDescriptionAr === null
    );
  }),
);

const groupedContentEditors = [
  "src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
];
check(
  "Content editors distinguish short and long content through the shared formatting-card owner",
  presentation.includes("export function ModuleEditorVisibilityAlignRow") &&
    presentation.includes("data-module-editor-control-row") &&
    groupedContentEditors.every((path) => {
      const source = read(path);
      return (
        source.includes("ModuleEditorVisibilityAlignRow") &&
        source.includes('showName="show_description"') &&
        source.includes('boldName="description_bold"') &&
        source.includes('alignmentName="description_alignment"') &&
        source.includes("minHeight={72}")
      );
    }) &&
    read(
      "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
    ).includes("ModuleEditorVisibilityAlignRow"),
);

const unifiedFormattingEditors = [
  "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
  "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
  "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/AboutApproachModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
  "src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
  "src/components/admin/page-blocks/editors/ProjectsHubMapModuleEditor.tsx",
];
const formattingContract = read("src/lib/page-blocks/configs.ts");
check(
  "one additive Formatting Contract owns visibility, Bold, and all physical alignments across text templates",
  formattingContract.includes(
    'PAGE_BLOCK_TEXT_ALIGNMENTS = ["right", "center", "left"]',
  ) &&
    formattingContract.includes("PageBlockTextFormattingConfig") &&
    formattingContract.includes("resolvePageBlockTextFormat") &&
    formattingContract.includes("buildPageBlockTextFormattingPatch") &&
    unifiedFormattingEditors.every((path) =>
      read(path).includes("ModuleEditorVisibilityAlignRow"),
    ) &&
    [
      "src/app/admin/pages-blocks/blocks/content/actions.ts",
      "src/app/admin/pages-blocks/blocks/cta/actions.ts",
      "src/app/admin/pages-blocks/blocks/cards/actions.ts",
      "src/lib/featured-modules/config.ts",
      "src/app/admin/pages-blocks/blocks/media-hub/actions.ts",
      "src/lib/feed-modules/parse-feed-config.ts",
    ].every((path) =>
      read(path).includes("buildPageBlockTextFormattingPatch"),
    ) &&
    [
      "src/components/sections/ContentSection.tsx",
      "src/components/sections/CtaSection.tsx",
      "src/components/sections/CardsSection.tsx",
      "src/components/collection-modules/CollectionSectionHeader.tsx",
      "src/components/sidebar-feeds/SidebarFeedPanel.tsx",
    ].every(
      (path) =>
        read(path).includes("Alignment") ||
        read(path).includes("pageBlockTextAlignClass"),
    ),
);

const adminFormGridOwner = read("src/components/admin/ui/AdminFormRuntime.tsx");
const projectsHubHeroEditor = read(
  "src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx",
);
const projectsHubFeaturedEditor = read(
  "src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx",
);
const projectsHubListingEditor = read(
  "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
);
const homeProjectsEditor = read(
  "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
);
const homeProjectsMapper = read("src/components/home/home-projects-mappers.ts");
const homeProjectsRenderer = read(
  "src/components/home/HomeProjectsSection.tsx",
);
const contentActions = read(
  "src/app/admin/pages-blocks/blocks/content/actions.ts",
);

check(
  "Projects editors adopt shared Header and Grid owners without retaining product-noise hints or fixed card CTA copy",
  adminFormGridOwner.includes("columns?: 1 | 2 | 3 | 4 | 5 | 12") &&
    adminFormGridOwner.includes("xl:grid-cols-4") &&
    adminFormGridOwner.includes("xl:grid-cols-5") &&
    presentation.includes("actions?: ReactNode") &&
    presentation.includes("data-module-editor-section-header") &&
    projectsHubHeroEditor.includes(
      '<ModuleEditorFieldGrid className="mt-4">',
    ) &&
    (projectsHubHeroEditor.match(/span=\{3\}/g)?.length ?? 0) === 3 &&
    (projectsHubHeroEditor.match(/className="xl:col-span-2!"/g)?.length ??
      0) === 2 &&
    projectsHubHeroEditor.includes("<AdminFormGrid columns={2}") &&
    !projectsHubHeroEditor.includes(
      "النصوص والصور والروابط وترتيب المشروعات تُقرأ من Projects Domain",
    ) &&
    projectsHubFeaturedEditor.includes("<AdminFormGrid columns={4}") &&
    projectsHubFeaturedEditor.includes('name="show_slider_dots"') &&
    projectsHubFeaturedEditor.includes("actions={") &&
    projectsHubListingEditor.includes("<AdminFormGrid columns={4}") &&
    projectsHubListingEditor.includes("<AdminFormGrid columns={5}") &&
    projectsHubListingEditor.includes('name="show_filter_bar"') &&
    projectsHubListingEditor.includes("actions={") &&
    !projectsHubListingEditor.includes(
      "لا تظهر شريحة لنوع لا توجد له مشروعات منشورة",
    ) &&
    homeProjectsEditor.includes('name="card_cta_label"') &&
    !homeProjectsEditor.includes(
      "يُطبَّق على المشاريع حسب ترتيب الصفحة الرئيسية",
    ) &&
    !homeProjectsEditor.includes("موضع زر «استكشف المشروع»") &&
    [
      formattingContract,
      homeProjectsActions,
      homeProjectsMapper,
      homeProjectsRenderer,
    ].every((source) => source.includes("cardCtaLabel")) &&
    formattingContract.includes("[&_*]:!text-center"),
);

const mediaHubEditor = read(
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
);
const mediaSidebarEditor = read(
  "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
);
const scopedModuleEditors = [...statusEditorSources, heroManager].join("\n");

check(
  "module editor labels are Arabic, fixed sources stay hidden, and configurable content sources use the shared listbox",
  [
    'label="Variant"',
    'label="Source"',
    'label="Background Style"',
    "Primary CTA Label",
    "Secondary CTA Label",
    ">Limit<",
    "Image Position Class",
  ].every((staleLabel) => !scopedModuleEditors.includes(staleLabel)) &&
    /<input\s+type="hidden"\s+name="data_source"\s+value="topics"/u.test(
      mediaHubEditor,
    ) &&
    !mediaSidebarEditor.includes('name="data_source"') &&
    mediaSidebarEditor.includes('name="source_kind"') &&
    mediaSidebarEditor.includes('label="مصدر المحتوى"') &&
    !/<AdminFormListboxSelect\b[^>]*\bname="data_source"/u.test(
      mediaHubEditor,
    ) &&
    !/<AdminFormListboxSelect\b[^>]*\bname="data_source"/u.test(
      mediaSidebarEditor,
    ),
);

check(
  "one shared contract resolves public visibility for every Page Module kind",
  PAGE_MODULE_KINDS.length === 9 &&
    PAGE_MODULE_KINDS.every(
      () =>
        isPageModulePubliclyVisible(true, "published") &&
        !isPageModulePubliclyVisible(false, "published") &&
        !isPageModulePubliclyVisible(true, "unpublished") &&
        !isPageModulePubliclyVisible(false, "unpublished"),
    ) &&
    resolvePageModuleVisibilityFields(true, "unpublished").is_visible ===
      true &&
    resolvePageModuleVisibilityFields(true, "unpublished")
      .is_publicly_visible === false &&
    blockStatusOwner.includes("export function isPageModulePubliclyVisible") &&
    blockStatusOwner.includes("isPublishedPageBlockStatus(templateStatus)") &&
    [
      heroPublicLoader,
      pageBlockPublicLoader,
      feedPublicLoader,
      featuredPublicLoader,
      mediaSidebarPublicLoader,
      mediaHubPublicLoader,
    ].every((source) => source.includes("isPageModulePubliclyVisible")) &&
    (adminQueries.match(/\.\.\.resolvePageModuleVisibilityFields\(/g)?.length ??
      0) === 9,
);

check(
  "Page Composition rows expose effective public truth without overwriting assignment truth",
  blockTypes.includes("is_publicly_visible: boolean") &&
    pagesClient.includes("isPageModulePubliclyVisible") &&
    pagesClient.includes("row.is_publicly_visible") &&
    assignmentGrid.includes("row.is_publicly_visible") &&
    slotMap.includes("row.is_publicly_visible") &&
    assignmentRow.includes(
      "const templatePublished = isPublishedPageBlockStatus",
    ) &&
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
    read(
      "src/app/admin/pages-blocks/pages/page-actions/assignment-duplicate.ts",
    ).includes("withModuleEditorReturnPageId"),
);

check(
  "Page Module mutations invalidate literal public and Admin paths with the Next 16 contract",
  adminRevalidationOwner.includes("revalidatePath(normalizedPath);") &&
    adminRevalidationOwner.includes(
      "revalidatePath(`/admin/pages-blocks/pages/${pageId}`);",
    ) &&
    !adminRevalidationOwner.includes(
      'revalidatePath(normalizedPath, "page")',
    ) &&
    !adminRevalidationOwner.includes(
      'revalidatePath(`/admin/pages-blocks/pages/${pageId}`, "page")',
    ),
);

check(
  "public rendering still requires both published template state and visible assignment state",
  blockStatusOwner.includes("export function isPublishedPageBlockStatus") &&
    blockStatusOwner.includes('return value === "published"') &&
    pageBlockPublicLoader.includes(
      "isPageModulePubliclyVisible(row.is_visible, template.status)",
    ) &&
    feedPublicLoader.includes(
      "isPageModulePubliclyVisible(row.is_visible, template.status)",
    ) &&
    mediaSidebarPublicLoader.includes(
      "isPageModulePubliclyVisible(row.is_visible, template.status)",
    ) &&
    pageCompositionLoader.includes("if (!widget.isVisible) continue;") &&
    mediaHubPublicLoader.includes(
      "isPageModulePubliclyVisible(row.is_visible, template.status)",
    ) &&
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
    mediaOwner.includes('data-admin-media-image-card="selected"') &&
    mediaOwner.includes('data-admin-media-image-card="add"') &&
    mediaOwner.includes("استبدال") &&
    mediaOwner.includes("إزالة") &&
    !mediaOwner.includes('justify-between" : "justify-end') &&
    mediaOwner.includes('updateValue("")') &&
    mediaOwner.includes('setAltValue("")') &&
    mediaAdopters.every((path) => read(path).includes("altName=")) &&
    contentActions.includes('optionalImagePath(formData, "image_main")') &&
    contentActions.includes(
      'cleanText(formData.get("image_main_alt")) || undefined',
    ),
);

check(
  "Page Composition keeps Theme-agnostic Position as the Assignment decision and leaves Presentation module-derived",
  routeSlotPolicy.includes("MODULE_POSITION_CAPABILITIES") &&
    routeSlotPolicy.includes("getAssignablePositions") &&
    routeSlotPolicy.includes('mode: "page"') &&
    routeSlotPolicy.includes("Module Presentation remains module-derived") &&
    routeSlotPolicy.includes("getPageCompositionPositions") &&
    !routeSlotPolicy.includes("pageSlug") &&
    !routeSlotPolicy.includes("AssignmentPresentation") &&
    compatibilityPresentation.includes("getAssignablePositions") &&
    slotMap.includes("getSlotCompatibilityLabel") &&
    serverSlotGuard.includes("isAssignmentPositionAllowed"),
);

check(
  "Page Composition assignment feedback follows only the submitted module action",
  assignmentModalOwner.includes("const activeAssignState =") &&
    assignmentModalOwner.includes("if (activeAssignState.ok)") &&
    assignmentModalOwner.includes(
      "setActionMessage(activeAssignState.message)",
    ) &&
    !assignmentModalOwner.includes("assignState.ok || assignHeroState.ok"),
);

const retiredHint = resolve(
  ROOT,
  "src/components/admin/page-blocks/ModuleDependencyHintsPanel.tsx",
);
const scopedPresentationSources = [
  ...fieldLayoutAdopters,
  ...repeaterAdopters,
  "src/components/admin/page-blocks/BlockEditorContextHeader.tsx",
  "src/components/admin/page-blocks/ModuleCrossPageUsageBanner.tsx",
]
  .map(read)
  .join("\n");

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
    !read(
      "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
    ).includes("تحتاج عنوانًا ووصفًا مختصرًا"),
);

check(
  "Cards repeater keeps the shared three-column owner and a compact eyebrow-title-description field order",
  presentation.includes(
    'columns === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3"',
  ) &&
    cardsRepeater.includes("ModuleEditorRepeaterGrid") &&
    cardsRepeater.indexOf("MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr") <
      cardsRepeater.indexOf("item_${index}_title") &&
    cardsRepeater.indexOf("item_${index}_title") <
      cardsRepeater.indexOf(
        "MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr",
      ) &&
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
  pageBlockCollectionHeaders.every(
    (source) =>
      source.includes("AdminPageContextHeader") &&
      !source.includes("AdminPageHeader"),
  ) &&
    !pageBlockCollectionHeaders.join("\n").includes("Admin Panel") &&
    !pageBlockCollectionHeaders.join("\n").includes("PAGES CONTROL") &&
    !pageBlockCollectionHeaders.join("\n").includes("HERO MODULE") &&
    !blocksHub.includes("Generic CMS Layer") &&
    adoptionManifest.includes('engineLabel: "إدارة الصفحات والموديولات"'),
);

check(
  "Page Composition exposes the mandatory shared display-position contract in columns, filters, sorting, and rows",
  assignmentColumns.includes(
    '{ key: "slot", label: "موضع العرض", defaultVisible: true, hideable: false }',
  ) &&
    assignmentGrid.includes('sortProps("slot")') &&
    assignmentGrid.includes(">موضع العرض</") &&
    assignmentRow.includes(
      "LAYOUT_SLOT_LABELS_AR[normalizeLayoutSlot(row.slot)]",
    ) &&
    assignmentRow.includes("AdminListboxSelect") &&
    pagesClient.includes("handleDisplayPositionChange") &&
    pagesClient.includes("updatePageBlockAssignment(") &&
    pagesClient.includes("<PageVisualSlotMap assignments={instant.rows}") &&
    pagesClient.includes("reconcileSuccess:") &&
    pagesClient.includes('paramKey: "slot"') &&
    pagesClient.includes("PAGE_COMPOSITION_POSITIONS.map") &&
    pagesClient.includes("slot: (row: PageBlockAssignmentRow)") &&
    pagesClient.includes(
      "values={{ module_type: moduleType, slot, visibility }}",
    ),
);

check(
  "specialized Page Block tables retain their declared shared grid, toolbar, pagination, and row-action owners",
  [blockManager, contentManager, summaryManager, heroManager].every(
    (source) =>
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
    [mediaHubActions, mediaSidebarActions].every(
      (source) =>
        source.includes("PAGE_BLOCK_PUBLICATION_BULK_ACTIONS") &&
        source.includes("parsePageBlockBulkIds") &&
        source.includes('.in("id", ids)'),
    ) &&
    parsePageBlockBulkAction("publish", PAGE_BLOCK_PUBLICATION_BULK_ACTIONS) ===
      "publish" &&
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
    pageCompositionRoute.includes(
      "const [pageResult, preference, assignmentsResult, globalSeo] = await Promise.all",
    ) &&
    !pageCompositionRoute.includes(
      "assignmentsData = await getPageModuleAssignmentsForAdmin",
    ),
);

console.log(
  `Page Block Editor Presentation verification passed (${passed} checks).`,
);
