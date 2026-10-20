import { normalizeVerificationText } from "./lib/verification-text.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import ts from "typescript";
import { Children, Fragment, createElement, isValidElement, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getModuleEditorHeaderMetadata, getModuleEditorSectionMetadata, resolveModuleEditorCompositionApplicability, SLOT_MODULE_SLUG_METADATA, MODULE_KIND_METADATA, MODULE_EDITOR_TAB_LABELS } from "../src/lib/page-composition/module-registry-metadata.ts";
import { collectExecutableSourceGraph, graphUsesExecutableBinding } from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) =>
  normalizeVerificationText(readFileSync(resolve(ROOT, path), "utf8"));
const jiti = createJiti(import.meta.url, { fsCache: false, jsx: { runtime: "automatic" } });
const {
  HERO_BULK_ACTIONS,
  MODULE_EDITOR_RETURN_PAGE_FORM_FIELD,
  MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM,
  MODULE_EDITOR_TAB_FORM_FIELD,
  PAGE_BLOCK_BULK_ACTIONS,
  PAGE_BLOCK_PUBLICATION_BULK_ACTIONS,
  isPageModulePubliclyVisible,
  moduleEditHref,
  moduleKindLabel,
  parsePageBlockBulkAction,
  parsePageBlockBulkIds,
  parseModuleEditorTabId,
  resolveModuleEditorReturnNavigation,
  resolveModuleEditorTabId,
  resolvePageModuleVisibilityFields,
  withModuleEditorReturnContextFromForm,
  withModuleEditorReturnPageId,
} = await jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>(
  "../src/lib/page-blocks/admin-utils.ts",
);
const { PAGE_MODULE_KINDS } = await jiti.import<
  typeof import("../src/lib/page-blocks/types.ts")
>("../src/lib/page-blocks/types.ts");
const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } = await jiti.import<
  typeof import("../src/lib/admin/form-system/adoption-manifest.ts")
>("../src/lib/admin/form-system/adoption-manifest.ts");
const { getContentModuleEditorKey, resolveContentModuleEditorConfig } = await jiti.import<
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

const registeredModuleEditorEntries = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
  (
    entry,
  ): entry is (typeof ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST)[number] & {
    registryModuleKind: (typeof PAGE_MODULE_KINDS)[number];
  } => "registryModuleKind" in entry && entry.registryModuleKind !== undefined,
);
const moduleEditorExecutableGraph = collectExecutableSourceGraph({
  root: ROOT,
  entrySourceFiles: registeredModuleEditorEntries.flatMap(
    (entry) => entry.sourceFiles,
  ),
  symbolAware: true,
});
const executableModuleEditorSources = [...moduleEditorExecutableGraph].map(
  ([path, file]) => ({ path, source: file.getFullText() }),
);
const moduleEditorRootSources = executableModuleEditorSources.filter(
  ({ source }) =>
    source.includes("<ModuleEditorHeader") &&
    source.includes("<ModuleEditorTabs"),
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
const cardsEditor = read("src/components/admin/page-blocks/CardsModuleEditClient.tsx");
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
const contentClientAst = ts.createSourceFile("ContentModuleEditClient.tsx", contentEditClient, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const contentClientFunction = contentClientAst.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ContentModuleEditClient");
assert.ok(contentClientFunction?.body);
const hubNavigationDeclarations = contentClientFunction.body.statements.filter((node) =>
  ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) =>
    ts.isIdentifier(declaration.name) && ["projectsHubPage", "usesProjectsHubPageNavigation", "projectsHubNavigation"].includes(declaration.name.text),
  ),
);
assert.equal(hubNavigationDeclarations.length, 3);
const resolveActualHubNavigation = new Function("assignmentContext", "editorKey", ts.transpileModule(
  `${hubNavigationDeclarations.map((node) => node.getText(contentClientAst)).join("\n")}\nreturn projectsHubNavigation;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText) as (context: { pages: { id: number; slug: string; path: string }[] }, key: string) => { backHref: string; backLabel: string } | null;
const hubEditorKeys = ["projects-hub-hero", "projects-hub-featured", "projects-hub-map"];
check("Hub editors resolve arbitrary canonical Page identity from existing assignment context and safely fall back when absent", hubEditorKeys.every((key) =>
  resolveActualHubNavigation({ pages: [{ id: 36, slug: "other", path: "/other" }, { id: 813, slug: "projects", path: "/projects" }] }, key)?.backHref === "/admin/pages-blocks/pages/813" &&
  resolveActualHubNavigation({ pages: [] }, key)?.backHref === "/admin/pages-blocks/blocks/content" &&
  resolveActualHubNavigation({ pages: [{ id: 36, slug: "projects", path: "/other" }] }, key)?.backHref === "/admin/pages-blocks/blocks/content",
) && resolveActualHubNavigation({ pages: [{ id: 813, slug: "projects", path: "/projects" }] }, "projects-hub-listing")?.backHref === "/admin/pages-blocks/blocks/content");
check("Explicit Page return retains priority over the Hub default", resolveModuleEditorReturnNavigation("812", "/admin/pages-blocks/pages?q=QA")?.backHref === "/admin/pages-blocks/pages/812?tab=modules&return_to=%2Fadmin%2Fpages-blocks%2Fpages%3Fq%3DQA" && presentation.indexOf("if (returnNavigation)") < presentation.indexOf('return "backHref" in props'));
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

const fieldLayoutAdopters = executableModuleEditorSources.filter(
  ({ path, source }) =>
    path !== "src/components/admin/page-blocks/ModuleEditorPresentation.tsx" &&
    source.includes("<ModuleEditorField"),
);

check(
  "all eligible field-layout editors adopt the shared presentation contract",
  fieldLayoutAdopters.length > 0 &&
    fieldLayoutAdopters.every(({ path, source }) => {
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
  "CTA family adopts five flat functional tabs while preserving fixed fields and inactive native FormData",
  (() => {
    const tree = ts.createSourceFile("CtaModuleEditClient.tsx", ctaEditor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const elements: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    const tagged = (tag: string) => elements.filter(node => node.tagName.getText(tree) === tag);
    const attr = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) => node.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(tree) === name);
    const tabs = tagged("ModuleEditorTabs");
    assert.equal(tabs.length, 1);
    const initializer = attr(tabs[0], "tabs")?.initializer;
    assert.ok(initializer && ts.isJsxExpression(initializer) && initializer.expression && ts.isArrayLiteralExpression(initializer.expression));
    const tabRows = initializer.expression.elements.map(node => {
      assert.ok(ts.isObjectLiteralExpression(node));
      const id = node.properties.find((prop): prop is ts.PropertyAssignment => ts.isPropertyAssignment(prop) && prop.name.getText(tree) === "id");
      assert.ok(id && ts.isStringLiteral(id.initializer));
      return { id: id.initializer.text, source: node.getText(tree) };
    });
    assert.deepEqual(tabRows.map(row => row.id), ["content", "images", "cta", "presentation", "pages"]);
    const panel = (id: string) => tabRows.find(row => row.id === id)!.source;
    for (const field of ["eyebrow", "title", "description", "highlight"]) {
      assert.ok(panel("content").includes('name="' + field + '"'));
      assert.ok(panel("content").includes('showName="show_' + field + '"'));
      assert.ok(panel("content").includes('boldName="' + field + '_bold"'));
      assert.ok(panel("content").includes('alignmentName="' + field + '_alignment"'));
    }
    assert.equal(tagged("ModuleEditorField").filter(node => attr(node, "nature")?.initializer?.getText(tree) === '"short-text"' && attr(node, "span")?.initializer?.getText(tree) === "{6}").length, 4);
    assert.equal(tagged("ModuleEditorVisibilityAlignRow").length, 5);
    assert.ok(panel("cta").includes('showName="show_cta"') && panel("cta").includes('boldName="cta_bold"') && panel("cta").includes('alignmentName="cta_alignment"'));
    for (const id of ["images", "presentation", "pages"]) assert.ok(panel(id).includes('sectionHeaderPresentation: "control"'));
    assert.ok(panel("presentation").includes('name="background_style"'));
    for (const style of ["dark", "gold", "gradient"]) assert.ok(panel("presentation").includes('value: "' + style + '"'));
    assert.equal(tagged("AdminMediaImageField").length, 1);
    const media = tagged("AdminMediaImageField")[0];
    assert.equal(attr(media, "name")?.initializer?.getText(tree), '"background_image"');
    assert.ok(attr(media, "defaultValue")?.initializer?.getText(tree).includes("config.backgroundImage"));
    assert.equal(attr(media, "altName"), undefined);
    assert.ok(panel("images").includes("<AdminMediaImageField"));
    assert.equal(tagged("AdminLinkField").length, 2);
    for (const prefix of ["primary_cta", "secondary_cta"]) {
      const field = tagged("AdminLinkField").find(node => attr(node, "prefix")?.initializer?.getText(tree) === '"' + prefix + '"');
      assert.ok(field && attr(field, "showAnchor"));
      assert.ok(panel("cta").includes('name="' + prefix + '_label"') && panel("cta").includes('prefix="' + prefix + '"'));
      assert.equal(attr(field, "presentation")?.initializer?.getText(tree), '"inline"');
    }
    const pages = tagged("ModuleEditorPagesTab");
    assert.equal(pages.length, 1);
    assert.equal(attr(pages[0], "presentation")?.initializer?.getText(tree), '"premium"');
    assert.equal(attr(pages[0], "showUsageBanner")?.initializer?.getText(tree), "{false}");
    assert.equal(attr(pages[0], "assignmentContext")?.initializer?.getText(tree), "{assignmentContext}");
    for (const [name, value] of [["id", "{block.id}"], ["slug", "{block.slug}"], ["variant", '{block.variant ?? "band"}'], ["style_preset", '{block.style_preset ?? "premium-dark"}']]) {
      const input = tagged("input").filter(node => attr(node, "name")?.initializer?.getText(tree) === '"' + name + '"');
      assert.equal(input.length, 1);
      assert.equal(attr(input[0], "type")?.initializer?.getText(tree), '"hidden"');
      assert.equal(attr(input[0], "value")?.initializer?.getText(tree), value);
    }
    assert.equal(tagged("AdminFormPendingFields").length, 1);
    assert.equal(tagged("ModuleEditorIdentitySection").length, 1);
    assert.equal(tagged("ModuleEditorSaveArea").length, 1);
    assert.equal(attr(tagged("form")[0], "action")?.initializer?.getText(tree), "{updateAction}");
    assert.ok(!ctaEditor.includes("AdminRichTextEditor") && !ctaEditor.includes("<textarea"));
    assert.ok(!/block\.(?:id|slug)\s*={2,3}|\.module\.css/.test(ctaEditor));
    const tabsOwner = read("src/components/admin/ui/AdminModuleTabs.tsx");
    assert.ok(tabsOwner.includes("hidden={tab.id !== activeId}") && tabsOwner.includes("{tab.content}"));
    return true;
  })(),
);

check(
  "CTA family uses existing premium headers and metadata without overriding saved entity names or other families",
  (() => {
    assert.ok((ctaEditor.match(/presentation="premium"/g)?.length ?? 0) >= 6);
    assert.ok(ctaEditor.includes("<AdminCard") && ctaEditor.includes("<AdminFormControlHeader") && ctaEditor.includes("<AdminFormGrid columns={2}"));
    const metadata = MODULE_KIND_METADATA.cta.editorSections!;
    for (const [id, label] of [["content", MODULE_EDITOR_TAB_LABELS.text], ["images", MODULE_EDITOR_TAB_LABELS.images], ["cta", MODULE_EDITOR_TAB_LABELS.cta], ["presentation", "إعدادات العرض"], ["pages", MODULE_EDITOR_TAB_LABELS.visibility]]) {
      assert.equal(metadata[id].navigationLabelAr, label);
      assert.equal(resolveModuleEditorTabId(id, ["content", "images", "cta", "presentation", "pages"]), id);
    }
    for (const id of ["content", "cta"]) assert.equal(metadata[id].sectionChrome, "implicit");
    for (const id of ["images", "presentation"]) assert.ok(metadata[id].sectionHeadingAr && metadata[id].sectionDescriptionAr);
    assert.equal(metadata.pages.sectionHeadingAr, "الظهور في الصفحات");
    assert.equal(metadata.pages.sectionDescriptionAr, null);
    const header = ctaEditor.slice(ctaEditor.indexOf("<ModuleEditorHeader"), ctaEditor.indexOf("<form"));
    assert.ok(header.includes("entityName={block.name}") && !header.includes("moduleSlug="));
    for (const name of ["دعوة محفوظة", "اسم محدث"]) assert.equal(getModuleEditorHeaderMetadata("cta", undefined, name)?.titleAr, name);
    assert.equal(getModuleEditorHeaderMetadata("cta", "topics-insight-cta", "اسم محفوظ")?.titleAr, SLOT_MODULE_SLUG_METADATA["topics-insight-cta"].labelAr);
    assert.ok(!/navigationLabelAr=|sectionHeadingAr=|sectionDescriptionAr=/.test(ctaEditor));
    return true;
  })(),
);

check(
  "CTA save and public-read paths retain canonical assignment, permission, formatting and link owners",
  (() => {
    const action = read("src/app/admin/pages-blocks/blocks/cta/actions.ts");
    const loader = read("src/lib/page-blocks/load-page-blocks.ts");
    assert.ok(action.includes("requireAdminSession()") && action.includes("coordinateMediaReferenceEntityMutation"));
    assert.ok(action.includes('backgroundImage: cleanText(formData.get("background_image"))'));
    assert.ok(action.includes("buildPageBlockTextFormattingPatch") && action.includes("linkFieldFromFormData"));
    assert.match(action, /saveModuleTemplateWithPageAssignments\(\s*"cta",\s*id,\s*nextRow,\s*parsePageIdsFromForm\(formData\),\s*actor\s*,?\s*\)/);
    assert.ok(action.includes("withModuleEditorReturnContextFromForm"));
    assert.ok(loader.includes("resolveCtaBlockConfigLinks(asCtaConfig(template.config))"));
    assert.ok(loader.includes("isPageModulePubliclyVisible(row.is_visible, template.status)"));
    return true;
  })(),
);

check(
  "Hero description uses the shared one-line field and persists Bold through the public Hero contract",
  heroEditor.includes("<HeroTextFieldRow") &&
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
  "Breadcrumb adopts full-width source controls and embedded switches without a redundant manual-link hint",
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
  heroEditor.includes("<ModuleEditorIdentitySection") &&
    heroEditor.includes('nameLabel="اسم الهيرو"') &&
    heroEditor.includes("status={hero.status}") &&
    heroEditor.includes(
      '<AdminFormListboxSelect\n          name="variant"',
    ) &&
    !heroEditor.includes(
      "xl:grid-cols-[minmax(16rem,20rem)_max-content_max-content]",
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
    heroOrderEditor.includes('<ModuleEditorRepeaterGrid presentation="premium">') &&
    projectDetailsHero.includes("showProjectActions") &&
    projectDetailsHero.includes("gridColumnsClassName") &&
    projectDetailsHero.includes("order.map((key)"),
);

check(
  "Hero premium composition preserves flat legacy tabs, variant capabilities and native field ownership",
  (() => {
    const tree = ts.createSourceFile("HeroEditClient.tsx", heroEditor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const nodes: ts.Node[] = [];
    const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
    visit(tree);
    const elements = nodes.filter((node): node is ts.JsxOpeningLikeElement => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node));
    const tagged = (tag: string) => elements.filter(node => node.tagName.getText(tree) === tag);
    const attr = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(tree) === name);
    const value = (node: ts.JsxOpeningLikeElement, name: string) => attr(node, name)?.initializer?.getText(tree).replace(/\s+/gu, " ");
    const variable = (name: string) => nodes.find((node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText(tree) === name)?.initializer;
    const tabs = tagged("ModuleEditorTabs");
    assert.equal(tabs.length, 1);
    const tabInput = attr(tabs[0], "tabs")?.initializer;
    assert.ok(tabInput && ts.isJsxExpression(tabInput) && tabInput.expression && ts.isArrayLiteralExpression(tabInput.expression));
    const tabRows = nodes.filter((node): node is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(node) && node.pos >= tabInput.pos && node.end <= tabInput.end).flatMap(node => {
      const id = node.properties.find((prop): prop is ts.PropertyAssignment => ts.isPropertyAssignment(prop) && prop.name.getText(tree) === "id");
      if (!id || !ts.isStringLiteral(id.initializer)) return [];
      const header = node.properties.find((prop): prop is ts.PropertyAssignment => ts.isPropertyAssignment(prop) && prop.name.getText(tree) === "sectionHeaderPresentation");
      assert.ok(header && header.initializer.getText(tree).startsWith('"control"'));
      return [{ id: id.initializer.text, source: node.getText(tree) }];
    });
    assert.deepEqual(tabRows.map(row => row.id), ["content", "buttons", "media", "order", "display"]);
    assert.ok(tabInput.getText(tree).includes("...(!isStandardInternal"));
    assert.equal(value(tabs[0], "initialTabId"), "{initialTabId}");
    assert.equal(tagged("ModuleEditorSection").length, 0, "Premium field owners must not retain a duplicate section surface");
    const content = variable("contentTab");
    assert.ok(content && ts.isConditionalExpression(content) && content.condition.getText(tree) === "isProjectDetail");
    assert.ok(content.whenTrue.getText(tree).includes('<AdminFormGrid columns={2}>'));
    assert.ok(content.whenFalse.getText(tree).includes('<AdminFormGrid columns={2}>'));
    const textRows = tagged("HeroTextFieldRow");
    assert.deepEqual(textRows.map(node => value(node, "name")), ['"eyebrow"', '"title"', '"highlight"', '"subtitle"', '"description"']);
    for (const row of textRows) {
      const name = value(row, "name")!.slice(1, -1);
      const suffix = name[0].toUpperCase() + name.slice(1);
      assert.equal(value(row, "defaultValue"), `{String(config.${name} ?? "")}`);
      assert.equal(value(row, "showName"), `"show_${name}"`);
      assert.equal(value(row, "boldName"), `"${name}_bold"`);
      assert.equal(value(row, "alignmentName"), `"${name}_alignment"`);
      assert.equal(value(row, "showDefault"), `{controls.show${suffix}}`);
      assert.equal(value(row, "boldDefault"), `{controls.${name}Bold}`);
      assert.equal(value(row, "alignmentDefault"), `{controls.${name}Alignment}`);
    }
    assert.ok(attr(textRows[4], "preserveRichText"));
    const detailRows = tagged("HeroVisibilityAlignRow").filter(node => node.pos >= content.whenTrue.pos && node.end <= content.whenTrue.end);
    assert.deepEqual(detailRows.map(node => value(node, "boldName")), ['"eyebrow_bold"', '"title_bold"', '"subtitle_bold"', '"description_bold"']);
    assert.ok(detailRows.every(node => value(node, "presentation") === '"premium"' && attr(node, "icon")));
    assert.ok(!content.whenTrue.getText(tree).includes("<HeroTextFieldRow"));
    for (const [name, expected] of [["show_highlight", "false"], ["highlight_bold", "false"], ["highlight_alignment", "right"]]) {
      const input = tagged("input").find(node => value(node, "name") === `"${name}"`);
      assert.ok(input && value(input, "type") === '"hidden"' && value(input, "value") === `"${expected}"`);
    }
    const galleries = tagged("AdminImagePathListField");
    assert.deepEqual(galleries.map(node => value(node, "name")), ['"images"', '"mobile_images"']);
    for (const [index, gallery] of galleries.entries()) {
      const viewport = index === 0 ? "desktop" : "mobile";
      assert.equal(value(gallery, "mediaSlot"), `{resolveHeroMediaSlot(guidanceVariant, "${viewport}")}`);
      assert.equal(value(gallery, "defaultValue"), index === 0 ? "{imagesText}" : "{mobileImagesText}");
      assert.equal(value(gallery, "density"), '"compact"');
      assert.equal(value(gallery, "actionPresentation"), '"card"');
      assert.equal(value(gallery, "showGuidance"), "{false}");
      assert.equal(value(gallery, "showReferenceLabel"), "{false}");
      assert.ok(nodes.some(node => ts.isConditionalExpression(node) && node.condition.getText(tree) === "!isProjectDetail" && gallery.pos >= node.whenTrue.pos && gallery.end <= node.whenTrue.end));
    }
    const composition = tagged("AdminFormListboxSelect").find(node => value(node, "name") === '"image_composition"');
    assert.ok(composition && value(composition, "sizing") === '"full"' && value(composition, "options") === "{HERO_IMAGE_COMPOSITION_OPTIONS_AR}");
    assert.ok(value(composition, "label")?.includes("<AdminFormControlHeader"));
    assert.ok(heroEditor.includes("ref={surfaceRef}") && heroEditor.includes("ref={iframeRef}"));
    assert.ok(heroEditor.includes('<HeroRenderedAreaCard previewPath={previewPath} />'));
    const pages = tagged("ModuleEditorPagesTab");
    assert.equal(pages.length, 1);
    assert.equal(value(pages[0], "presentation"), '"premium"');
    assert.equal(value(pages[0], "assignmentContext"), "{assignmentContext}");
    assert.equal(attr(pages[0], "showUsageBanner"), undefined, "Hero must retain the existing shared usage banner");
    assert.ok(tabRows.find(row => row.id === "display")!.source.includes("<ModuleEditorPagesTab"));
    const runtime = tagged("AdminFormRuntime");
    assert.equal(runtime.length, 1);
    assert.equal(value(runtime[0], "redirectAction"), "{updateHeroTemplateDetails}");
    assert.equal(tagged("ModuleEditorSaveArea").length, 1);
    assert.equal(MODULE_KIND_METADATA.hero.editorSections!.content.navigationLabelAr, MODULE_EDITOR_TAB_LABELS.text);
    assert.equal(MODULE_KIND_METADATA.hero.editorSections!.display.operationalRole, "visibility");
    assert.ok(!/\.module\.css|<AdminRichTextEditor|hero\.id\s*={2,3}/u.test(heroEditor));
    return true;
  })(),
);

check(
  "Hero premium children preserve raw description, both native CTA links and isolated project action ownership",
  (() => {
    const inspect = (source: string) => {
      const tree = ts.createSourceFile("HeroChild.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const nodes: ts.Node[] = [];
      const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
      visit(tree);
      const tagged = (tag: string) => nodes.filter((node): node is ts.JsxOpeningLikeElement => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === tag);
      const attr = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(tree) === name);
      const value = (node: ts.JsxOpeningLikeElement, name: string) => attr(node, name)?.initializer?.getText(tree).replace(/\s+/gu, " ");
      return { tree, nodes, tagged, attr, value };
    };
    const text = inspect(heroText);
    const textFormat = text.tagged("HeroVisibilityAlignRow");
    assert.equal(textFormat.length, 1);
    assert.equal(text.value(textFormat[0], "presentation"), '"premium"');
    for (const name of ["alignmentName", "showName", "boldName", "alignmentDefault", "showDefault", "enableAlignment", "enableBold", "boldDefault"]) assert.equal(text.value(textFormat[0], name), `{${name}}`);
    const textInputs = text.tagged("input");
    assert.equal(textInputs.length, 2);
    assert.equal(text.value(textInputs[0], "name"), "{name}");
    assert.equal(text.value(textInputs[0], "value"), "{text === initialText ? defaultValue : text}");
    assert.equal(text.value(textInputs[1], "name"), "{preserveRichText ? `${name}_editor` : name}");
    assert.equal(text.value(textInputs[1], "aria-label"), "{label}");
    assert.equal(text.value(textInputs[1], "onChange"), "{(event) => setText(event.target.value)}");
    const cta = inspect(heroCtaEditor);
    const domainBranch = cta.nodes.find((node): node is ts.IfStatement => ts.isIfStatement(node) && node.expression.getText(cta.tree) === 'linkSource === "project-domain"');
    assert.ok(domainBranch);
    const domain = inspect(domainBranch.thenStatement.getText(cta.tree));
    assert.equal(domain.tagged("AdminLinkField").length, 0);
    assert.equal(domain.tagged("AdminCard").length, 0);
    assert.equal(domain.value(domain.tagged("input")[0], "name"), '"primary_cta_label"');
    assert.equal(domain.attr(domain.tagged("HeroVisibilityAlignRow")[0], "presentation"), undefined);
    const adminRows = cta.tagged("HeroVisibilityAlignRow").filter(node => node.pos > domainBranch.end);
    assert.equal(adminRows.length, 1);
    assert.equal(cta.value(adminRows[0], "presentation"), '"premium"');
    for (const [name, expected] of [["alignmentName", '"cta_alignment"'], ["showName", '"show_cta"'], ["boldName", '"cta_bold"'], ["alignmentDefault", "{alignmentDefault}"], ["boldDefault", "{boldDefault}"], ["enableAlignment", "{enableAlignment}"], ["showDefault", "{showDefault}"]]) assert.equal(cta.value(adminRows[0], name), expected);
    assert.equal(cta.tagged("AdminCard").length, 2);
    assert.ok(cta.tagged("AdminCard").every(node => cta.value(node, "presentation") === '"premium"'));
    assert.equal(cta.tagged("AdminFormControlHeader").length, 2);
    assert.deepEqual(cta.tagged("AdminFormGrid").map(node => cta.value(node, "columns")), ["{2}", "{1}", "{1}"]);
    assert.equal(cta.tagged("AdminLinkField").length, 2);
    for (const prefix of ["primary", "secondary"]) {
      const link = cta.tagged("AdminLinkField").find(node => cta.value(node, "prefix") === `"${prefix}_cta"`);
      assert.ok(link && cta.attr(link, "showAnchor"));
      assert.equal(cta.value(link, "defaultValue"), `{${prefix}Link}`);
      assert.equal(cta.value(link, "presentation"), '"inline"');
      assert.equal(cta.value(link, "actionPresentation"), '"bare"');
      const input: ts.JsxOpeningLikeElement[] = cta.tagged("input").filter(node => node.pos > domainBranch.end && cta.value(node, "name") === `"${prefix}_cta_label"`);
      assert.equal(input.length, 1);
      assert.equal(cta.value(input[0], "defaultValue"), `{${prefix}Label}`);
      assert.equal(cta.value(input[0], "maxLength"), "{100}");
      assert.ok(cta.attr(input[0], "aria-label"));
    }
    const actionSource = heroOrderEditor.slice(heroOrderEditor.indexOf("function ProjectHeroActionOrderEditor"), heroOrderEditor.indexOf("export default function HeroElementOrderEditor"));
    const actions = inspect(actionSource);
    assert.equal(actions.tagged("ModuleEditorRepeaterGrid").length, 1);
    assert.equal(actions.attr(actions.tagged("ModuleEditorRepeaterGrid")[0], "columns"), undefined);
    assert.ok(/export function ModuleEditorRepeaterGrid\(\{\s*children,\s*columns = 3,/u.test(presentation), "The adopted repeater retains its canonical three-column default");
    assert.equal(actions.value(actions.tagged("ModuleEditorRepeaterGrid")[0], "presentation"), '"premium"');
    assert.equal(actions.tagged("ModuleEditorRepeaterCard").length, 1);
    assert.equal(actions.value(actions.tagged("ModuleEditorRepeaterCard")[0], "presentation"), '"premium"');
    const switches = actions.tagged("AdminFormSwitch");
    assert.equal(switches.length, 1);
    for (const [name, expected] of [["name", "{PROJECT_HERO_ACTION_VISIBILITY_FIELDS[key]}"], ["value", '"true"'], ["uncheckedValue", '"false"'], ["defaultChecked", "{visibility[key]}"]]) assert.equal(actions.value(switches[0], name), expected);
    assert.ok(actions.attr(switches[0], "embedded"));
    assert.equal(actions.attr(switches[0], "surface"), undefined);
    const buttons = actions.tagged("AdminActionButton");
    assert.equal(buttons.length, 2);
    for (const [index, button] of buttons.entries()) {
      assert.equal(actions.attr(button, "type"), undefined);
      assert.equal(actions.attr(button, "href"), undefined);
      assert.ok(read("src/components/admin/ui/AdminActionButton.tsx").includes('type = "button"'), "Shared move actions remain native non-submit buttons");
      assert.equal(actions.value(button, "disabled"), index === 0 ? "{index === 0}" : "{index === order.length - 1}");
      assert.equal(actions.value(button, "onClick"), index === 0 ? "{() => move(index, -1)}" : "{() => move(index, 1)}");
      assert.ok(actions.attr(button, "aria-label"));
    }
    const defaultOrder = heroOrderEditor.slice(heroOrderEditor.indexOf("export default function HeroElementOrderEditor"));
    assert.ok(defaultOrder.includes('name="hero_element_order"') && defaultOrder.includes("normalizeHeroElementOrder"));
    assert.ok(!defaultOrder.includes("ModuleEditorRepeaterCard") && !defaultOrder.includes("ModuleEditorRepeaterGrid"));
    assert.ok(!heroText.includes("<textarea") && !heroCtaEditor.includes("useState"));
    return true;
  })(),
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

check(
  "module editors adopt the shared identity strip before tabs and preserve internal metadata without an empty Settings tab",
  presentation.includes("export function ModuleEditorIdentitySection") &&
    presentation.includes("data-module-editor-identity") &&
    moduleEditorRootSources.length === PAGE_MODULE_KINDS.length &&
    moduleEditorRootSources.every(({ source }) => {
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
  "Hero measurement control retains canonical geometry without verbose source/crop diagnostics",
  heroEditor.includes('querySelector<HTMLElement>("[data-hero-family]")') &&
    heroEditor.includes("Rendered Hero Area:") &&
    !heroEditor.includes("Visible Source Area (current viewport):") &&
    heroEditor.includes("visibleSourceWidth") &&
    !heroEditor.includes("commitMetrics(image.naturalWidth, image.naturalHeight)") &&
    heroEditor.includes("commitMetrics(sourceProbe.naturalWidth, sourceProbe.naturalHeight)") &&
    heroEditor.includes("frameWindow.getComputedStyle(image)") &&
    heroEditor.includes("hero.getBoundingClientRect()") &&
    heroEditor.includes("data-hero-rendered-area-state={state.status}") &&
    !heroEditor.includes('loading="lazy"') &&
    !heroEditor.includes("h-[min(62vh,580px)]"),
);

const fieldLayoutSources = fieldLayoutAdopters
  .map(({ source }) => source)
  .join("\n");
check(
  "Page Block editor sections use their full content width",
  !fieldLayoutSources.includes("max-w-") &&
    !presentation.replaceAll("max-w-full", "").includes("max-w-") &&
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

const repeaterAdopters = executableModuleEditorSources.filter(
  ({ path, source }) =>
    path !== "src/components/admin/page-blocks/ModuleEditorPresentation.tsx" &&
    source.includes("<ModuleEditorRepeaterGrid"),
);

check(
  "eligible repeaters use the shared responsive card presentation",
  presentation.includes("lg:grid-cols-2") &&
    presentation.includes("columns?: 2 | 3") &&
    presentation.includes(
      'columns === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3"',
    ) &&
    repeaterAdopters.length > 0 &&
    repeaterAdopters.every(({ source }) => {
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
    cardsRepeater.includes("renderHref(item, index)") &&
    cardsEditor.includes("renderHref={renderCardHref}") &&
    cardsEditor.includes("prefix={`item_${index}`}") &&
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
  "Content editors receive one canonical server read model and delegate revision acceptance to the shared form guard",
  moduleEditRegistry.includes(
    "export function resolveContentModuleEditorConfig",
  ) &&
    contentEditRoute.includes("resolveContentModuleEditorConfig({") &&
    contentEditRoute.includes("config={config}") &&
    !contentEditRoute.includes("block={block}") &&
    !contentEditClient.includes("block.config") &&
    contentEditClient.includes("config: unknown") &&
    contentEditClient.includes("key={block.id} savedRevision={block.updated_at}") &&
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
  "shared identity composition keeps the module name inline and aligns publication with naturally sized controls",
  presentation.includes("data-module-editor-identity") &&
    presentation.includes('data-module-editor-name-field=""') &&
    presentation.includes('data-module-editor-identity-control=""') &&
    presentation.includes(
      'className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-3"',
    ) &&
    presentation.includes(
      "[&>[data-admin-form-listbox]]:grid-cols-[max-content_minmax(0,1fr)]",
    ) &&
    presentation.includes(
      "xl:grid-cols-[minmax(20rem,26rem)_max-content_max-content]",
    ) &&
    presentation.includes("surface={false}") &&
    presentation.includes('className="flex h-full items-center"'),
);

check(
  "Breadcrumb editor keeps empty manual state, internal identity, and assignment-owned placement",
  breadcrumbRepeater.includes("return initial;") &&
    !breadcrumbRepeater.includes("empty-breadcrumb-0") &&
    breadcrumbRepeater.includes("{rows.length ? (") &&
    breadcrumbRepeater.includes("current.filter") &&
    breadcrumbEditor.includes('sizing="full"') &&
    breadcrumbEditor.includes('embedded') &&
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

check(
  "Page Composition visual map keeps the fixed Hero above composable peers in the Hero region",
  slotMap.includes("function compareRowsInSlot(") &&
    slotMap.includes('if (slot === "hero")') &&
    slotMap.includes('first.module_kind === "hero"') &&
    slotMap.includes('second.module_kind === "hero"') &&
    slotMap.includes("return firstIsHero ? -1 : 1") &&
    slotMap.includes("comparePageAssignmentOrder(") &&
    slotMap.includes("compareRowsInSlot(slot, first, second)"),
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
    presentation.includes("value={String(submittedBold)}") &&
    presentation.includes("preserveUnsetBold = false") &&
    presentation.includes("preserveUnsetBold ? boldDefault : (boldDefault ?? false)") &&
    presentation.includes("const submittedBold = hasBoldControl") &&
    presentation.includes("boldName && submittedBold !== undefined"),
);

check(
  "CTA alone opts into absent Bold preservation while the shared formatter keeps existing boolean defaults",
  (() => {
    assert.ok(ctaEditor.includes("preserveUnsetBold") && ctaEditor.includes("boldDefault={config.ctaBold}"));
    assert.ok(presentation.includes("preserveUnsetBold?: boolean") && presentation.includes("preserveUnsetBold = false"));
    assert.ok(presentation.includes("useState<boolean | undefined>") && presentation.includes("boldName && submittedBold !== undefined"));
    assert.ok(presentation.includes("bold={hasBoldControl ? (bold ?? false) : undefined}") && presentation.includes("onBoldChange={hasBoldControl ? setBold : undefined}"));
    const action = read("src/app/admin/pages-blocks/blocks/cta/actions.ts");
    assert.ok(action.includes('{ field: "cta", bold: formData.has("cta_bold") }'));
    for (const { path, source } of moduleEditorRootSources) {
      if (path !== "src/components/admin/page-blocks/CtaModuleEditClient.tsx") assert.ok(!source.includes("preserveUnsetBold"));
    }
    return true;
  })(),
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

const statusEditorSources = moduleEditorRootSources.map(({ source }) => source);
const statusActionAdopters = PAGE_MODULE_KINDS.map(
  (moduleKind) =>
    `src/app/admin/pages-blocks/blocks/${moduleKind}/actions.ts`,
);
const statusActionSources = statusActionAdopters.map(read);

function discoverBulkActionFunctions(sourceFile: string) {
  const source = read(sourceFile);
  return [...source.matchAll(/export async function ([A-Za-z0-9_]+)/gu)]
    .flatMap((match) => {
      const start = match.index;
      const nextExport = source.indexOf("\nexport ", start + 1);
      const body = source.slice(
        start,
        nextExport === -1 ? undefined : nextExport,
      );
      return body.includes("parsePageBlockBulkAction(")
        ? [{ sourceFile, functionName: match[1]!, body }]
        : [];
    });
}

const bulkActionAdopters = statusActionAdopters.flatMap(
  discoverBulkActionFunctions,
);
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
  bulkActionAdopters.length === PAGE_MODULE_KINDS.length &&
    bulkActionAdopters.every(({ functionName, body }) => {
      const start = body.indexOf(`export async function ${functionName}`);
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
    statusEditorSources.length === PAGE_MODULE_KINDS.length &&
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
        (path.endsWith("/AboutIntroModuleEditor.tsx")
          ? source.includes('minHeight={fullDescriptionEditor ? undefined : 72}') &&
            source.includes('toolbarMode={fullDescriptionEditor ? "full" : "none"}') &&
            source.includes('? { controlMode: "visibility-only" as const }') &&
            source.includes(': { boldName: "description_bold", alignmentName: "description_alignment", boldDefault: descriptionFormat.bold, alignmentDefault: descriptionFormat.alignment }') &&
            source.includes('legacyHtmlFormatting={fullDescriptionEditor ?')
          : source.includes('controlMode="visibility-only"') &&
            source.includes('toolbarMode="full"') &&
            source.includes('legacyHtmlFormatting={{ boldName: "description_bold", bold: descriptionFormat.bold, alignmentName: "description_alignment", alignment: descriptionFormat.alignment }}') &&
            source.includes('altLabel="النص البديل للصورة (Alt Text)"') &&
            source.includes("enableArticleStructure") &&
            source.includes("enableTextAlign"))
      );
    }) &&
    read(
      "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
    ).includes("ModuleEditorVisibilityAlignRow"),
);

const unifiedFormattingEditors = executableModuleEditorSources.filter(
  ({ path, source }) =>
    path.endsWith(".tsx") &&
    path !== "src/components/admin/page-blocks/ModuleEditorPresentation.tsx" &&
    /(?:boldName|alignmentName|name="[a-z0-9_]+_(?:bold|alignment)")/u.test(
      source,
    ),
);
const formattingContract = read("src/lib/page-blocks/configs.ts");
check(
  "one additive Formatting Contract owns visibility, Bold, and all physical alignments across text templates",
  formattingContract.includes(
    'PAGE_BLOCK_TEXT_ALIGNMENTS = ["right", "center", "left"]',
  ) &&
    formattingContract.includes("PageBlockTextFormattingConfig") &&
    formattingContract.includes("resolvePageBlockTextFormat") &&
    formattingContract.includes("buildPageBlockTextFormattingPatch") &&
    unifiedFormattingEditors.length > 0 &&
    unifiedFormattingEditors.every(({ path }) => {
      const graph = collectExecutableSourceGraph({
        root: ROOT,
        entrySourceFiles: [path],
        symbolAware: true,
      });
      if (path === "src/components/admin/AdminRichTextEditor.tsx") {
        const editor = read(path);
        return [...graph.values()].some((file) => file.getFullText().includes("export default function AdminTextFormatControls")) &&
          editor.includes('<AdminTextFormatControls') &&
          editor.includes('storageFormat === "html" ? legacyHtmlFormatting : undefined') &&
          editor.includes('name={legacyFormatting.boldName} value={legacyBold ? "true" : "false"}') &&
          editor.includes('name={legacyFormatting.alignmentName} value={legacyFormatting.alignment}');
      }
      return [...graph.values()].some((file) =>
        file.getFullText().includes("ModuleEditorVisibilityAlignRow"),
      );
    }) &&
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
  adminFormGridOwner.includes("columns?: 1 | 2 | 3 | 4 | 5 | 6 | 12") &&
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
    /<AdminFormGrid\s+columns=\{[1-6]\}/u.test(projectsHubFeaturedEditor) &&
    projectsHubFeaturedEditor.includes('name="show_slider_dots"') &&
    projectsHubFeaturedEditor.includes("actions={") &&
    /<AdminFormGrid\s+columns=\{[1-6]\}/u.test(projectsHubListingEditor) &&
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
      0) === PAGE_MODULE_KINDS.length,
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

const pagesReturnPath = "/admin/pages-blocks/pages?q=QA+Page&page=2&page_size=20&sort=title&direction=desc";
for (const kind of PAGE_MODULE_KINDS) {
  const edit = new URL(moduleEditHref(kind, 15, { returnPageId: 17, returnTo: pagesReturnPath }), "http://internal.invalid");
  assert.equal(edit.pathname, `/admin/pages-blocks/blocks/${kind}/15`);
  assert.equal(edit.searchParams.get("returnPageId"), "17");
  assert.equal(edit.searchParams.get("return_to"), pagesReturnPath);
  const submitted = new FormData();
  submitted.set(MODULE_EDITOR_RETURN_PAGE_FORM_FIELD, "17");
  submitted.set("return_to", edit.searchParams.get("return_to")!);
  const saved = new URL(withModuleEditorReturnContextFromForm(`${edit.pathname}?saved=1&tab=buttons`, submitted), edit.origin);
  assert.equal(saved.searchParams.get("saved"), "1");
  assert.equal(saved.searchParams.get("tab"), "buttons");
  assert.equal(saved.searchParams.get("returnPageId"), "17");
  assert.equal(saved.searchParams.get("return_to"), pagesReturnPath);
  const back = new URL(resolveModuleEditorReturnNavigation(saved.searchParams.get("returnPageId"), saved.searchParams.get("return_to"))!.backHref, edit.origin);
  assert.equal(back.pathname, "/admin/pages-blocks/pages/17");
  assert.equal(back.searchParams.get("tab"), "modules");
  assert.equal(back.searchParams.get("return_to"), pagesReturnPath);
  const selectedTab = kind === "hero" ? "display" : "pages";
  submitted.set(MODULE_EDITOR_TAB_FORM_FIELD, selectedTab);
  const savedPanel = new URL(withModuleEditorReturnContextFromForm(`${edit.pathname}?saved=1&notice=saved_with_media_sync_warning#saved-panel`, submitted), edit.origin);
  assert.equal(savedPanel.searchParams.get("tab"), selectedTab);
  assert.equal(savedPanel.searchParams.get("saved"), "1");
  assert.equal(savedPanel.searchParams.get("notice"), "saved_with_media_sync_warning");
  assert.equal(savedPanel.searchParams.get("returnPageId"), "17");
  assert.equal(savedPanel.searchParams.get("return_to"), pagesReturnPath);
  assert.equal(savedPanel.hash, "#saved-panel");
  assert.equal(resolveModuleEditorTabId(savedPanel.searchParams.get("tab"), ["content", selectedTab]), selectedTab);
}
for (const rejectedTab of ["", "../content", "Content", "pages&saved=0", "pages#content", "display\n", "a".repeat(49), ["pages"], null]) {
  assert.equal(parseModuleEditorTabId(rejectedTab), null);
  assert.equal(resolveModuleEditorTabId(rejectedTab, ["content", "pages"]), "content");
  const submitted = new FormData();
  if (typeof rejectedTab === "string") submitted.set(MODULE_EDITOR_TAB_FORM_FIELD, rejectedTab);
  assert.equal(withModuleEditorReturnContextFromForm("/admin/pages-blocks/blocks/content/15?saved=1&notice=kept", submitted), "/admin/pages-blocks/blocks/content/15?saved=1&notice=kept");
}
assert.equal(resolveModuleEditorTabId("retired-panel", ["content", "pages"]), "content");
assert.equal(resolveModuleEditorTabId("retired-panel", ["content", "buttons"], "buttons"), "buttons");
assert.equal(resolveModuleEditorTabId("pages", []), "");
assert.equal(resolveModuleEditorTabId("pages", ["content", "pages"], "content"), "pages");
const noPageContext = new FormData();
noPageContext.set(MODULE_EDITOR_TAB_FORM_FIELD, "display");
assert.equal(withModuleEditorReturnContextFromForm("/admin/pages-blocks/blocks/hero/15?saved=1&tab=content", noPageContext), "/admin/pages-blocks/blocks/hero/15?saved=1&tab=display");
assert.equal(withModuleEditorReturnContextFromForm("/admin/pages-blocks/blocks/hero/15?saved=1&notice=kept&tab=content#saved-panel", noPageContext), "/admin/pages-blocks/blocks/hero/15?saved=1&notice=kept&tab=display#saved-panel");
check(
  "Module editor save preserves only an actual selected panel through the existing tabs and redirect owners",
  presentation.includes('resolveModuleEditorTabId(searchParams.get("tab"), tabIds, initialTabId)') &&
    presentation.includes("controlledActiveTabId === undefined ? selectedTabId : controlledActiveTabId") &&
    presentation.includes("if (controlledActiveTabId === undefined) setSelectedTabId(tabId)") &&
    presentation.includes("onActiveTabChange?.(tabId)") &&
    presentation.includes("name={MODULE_EDITOR_TAB_FORM_FIELD} value={activeTabId}") &&
    presentation.includes("onActiveTabChange={handleActiveTabChange}"),
);
for (const rejectedTarget of [
  "https://example.test/admin/pages-blocks/pages?q=QA", "//example.test/admin/pages-blocks/pages",
  "/\\example.test/admin/pages-blocks/pages", "/admin/content/topics?q=QA", "/admin/pages-blocks/pages/18?q=QA",
  "/admin/pages-blocks/pages-extra?q=QA", "/admin/pages-blocks/pages\n?q=QA",
]) {
  assert.equal(resolveModuleEditorReturnNavigation("17", rejectedTarget)?.backHref, "/admin/pages-blocks/pages/17?tab=modules");
  const submitted = new FormData();
  submitted.set(MODULE_EDITOR_RETURN_PAGE_FORM_FIELD, "17");
  submitted.set("return_to", rejectedTarget);
  assert.equal(withModuleEditorReturnContextFromForm("/admin/pages-blocks/blocks/content/15?saved=1", submitted), "/admin/pages-blocks/blocks/content/15?saved=1&returnPageId=17");
}
assert.equal(withModuleEditorReturnPageId("/admin/pages-blocks/blocks/hero/15?tab=buttons", "17", pagesReturnPath), `/admin/pages-blocks/blocks/hero/15?tab=buttons&returnPageId=17&return_to=${encodeURIComponent(pagesReturnPath)}`);
assert.equal(withModuleEditorReturnPageId("/admin/pages-blocks/blocks/hero/15", "../17", pagesReturnPath), "/admin/pages-blocks/blocks/hero/15");
check(
  "Pages list query survives title/action open, SEO save, assignment/map edit, module save and contextual return through shared owners",
  pagesListClient.includes("writeAdminEntityListQuery(pagesQueryContract, controller.query)") &&
    (pagesListClient.match(/adminFormEditHref\(`/gu)?.length ?? 0) === 2 &&
    pagesListClient.includes("[currentListPath, instant.getRowInteraction, supportedSortFields]") &&
    read("src/app/admin/pages-blocks/pages/[id]/page.tsx").includes("resolveAdminFormReturnPath(resolvedSearchParams?.return_to") &&
    read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksHeader.tsx").includes("resolveAdminFormReturnPath(returnTo") &&
    read("src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx").includes("adminFormEditHref(`/admin/pages-blocks/pages/${props.pageId}?tab=seo`, props.returnTo") &&
    pagesClient.includes("adminFormEditHref(redirectTo, returnTo") &&
    assignmentGrid.includes("returnTo={returnTo}") && assignmentRow.includes("returnTo,") &&
    slotMap.includes("returnPageId: row.page_id, returnTo") &&
    presentation.includes('name="return_to"') &&
    presentation.includes('resolveAdminFormReturnPath(searchParams.get("return_to")'),
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

const mediaAdopters = executableModuleEditorSources.filter(({ source }) =>
  source.includes("<AdminMediaImageField"),
);
const mediaAltAdopters = mediaAdopters.filter(({ source }) =>
  source.includes("altName="),
);
check(
  "all executable Page Block image fields delegate preview, replace, remove, and clear behavior to the shared owner while alt-enabled consumers preserve alt persistence",
  mediaOwner.includes("altName") &&
    mediaOwner.includes("allowRemove") &&
    mediaOwner.includes('data-admin-media-image-card="selected"') &&
    mediaOwner.includes('data-admin-media-image-card="add"') &&
    mediaOwner.includes("استبدال") &&
    mediaOwner.includes("إزالة") &&
    !mediaOwner.includes('justify-between" : "justify-end') &&
    mediaOwner.includes('updateValue("")') &&
    mediaOwner.includes('setAltValue("")') &&
    mediaAdopters.length > 0 &&
    mediaAdopters.every(({ source }) => !source.includes('type="file"')) &&
    mediaAltAdopters.length > 0 &&
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

const assignmentFeedbackAst = ts.createSourceFile("assignment.ts", assignmentModalOwner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const assignmentFeedbackTransitions: ts.IfStatement[] = [];
const findAssignmentFeedbackTransition = (node: ts.Node): void => {
  if (ts.isIfStatement(node) && node.expression.getText(assignmentFeedbackAst) === "assignPending !== prevAssignPending") assignmentFeedbackTransitions.push(node);
  ts.forEachChild(node, findAssignmentFeedbackTransition);
};
findAssignmentFeedbackTransition(assignmentFeedbackAst);
assert.equal(assignmentFeedbackTransitions.length, 1);
const assignmentFeedbackTransition = new Function("state", "callbacks",   "with (state) { with (callbacks) { " + assignmentFeedbackTransitions[0].getText(assignmentFeedbackAst) + " } }");
for (const scenario of [
  { state: { ok: true, message: null, feedbackStatus: "success" }, expected: ["تم ربط الموديول بالصفحة.", "success"] },
  { state: { ok: true, message: "accepted", feedbackStatus: "success" }, expected: ["accepted", "success"] },
  { state: { ok: true, message: "cache warning", feedbackStatus: "warning" }, expected: ["cache warning", "warning"] },
  { state: { ok: false, message: "rejected" }, expected: ["rejected"] },
]) {
  const messages: unknown[][] = [], dismissals: number[] = [];
  assignmentFeedbackTransition({ assignPending: false, prevAssignPending: true, showAssignModal: true, activeAssignState: scenario.state, assignModalSession: 7, assignSubmitSession: 7 }, {
    setPrevAssignPending() {}, setAssignSubmitSession() {}, setAssignVisible() {},
    setAssignDismissSession(value: number) { dismissals.push(value); },
    setActionMessage(...args: unknown[]) { messages.push(args); },
  });
  assert.deepEqual(messages, [scenario.expected]);
  assert.deepEqual(dismissals, scenario.state.ok ? [7] : []);
}
check("Submitted assignment success survives modal dismissal; warning and rejection keep their outcomes", true);

const assignmentCreateActions = read("src/app/admin/pages-blocks/pages/page-actions/assignment-create.ts");
check(
  "Page assignment creation consumes the canonical revalidated Action render without an extra refresh roundtrip",
  !assignmentModalOwner.includes("router.refresh") &&
    !assignmentModalOwner.includes("assignRefreshNonce") &&
    assignmentModalOwner.includes("setAssignDismissSession(assignModalSession)") &&
    assignmentModalOwner.includes("templateOptions.filter((template) => !assignedTemplateIds.has(template.id))") &&
    ["assignPageBlock", "assignHeroModule", "assignMediaSidebarModule", "assignMediaHubModule"].every(
      (action) => assignmentModalOwner.replace(/\s+/gu, "").includes(`useActionState(${action},`) && assignmentCreateActions.includes(`export async function ${action}(`),
    ),
);


// Execute the current Actions and settlement owners; only Auth, persistence and
// cache delivery are controlled ports. Cache-only retries must never repeat a write.
function assignmentDeclarations(path: string, names: readonly string[]) {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
  return names.map((name) => {
    const declaration = source.statements.find((node) =>
      (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
      (ts.isVariableStatement(node) && node.declarationList.declarations.some((item) => ts.isIdentifier(item.name) && item.name.text === name)),
    );
    assert.ok(declaration, name + " remains owned by " + path);
    return declaration.getText(source).replace(/^export\s+/u, "");
  }).join("\n");
}
const assignmentActionNames = ["assignPageBlock", "assignHeroModule", "assignMediaSidebarModule", "assignMediaHubModule"] as const;
const assignmentBehaviorSource = [
  assignmentDeclarations("src/lib/admin/admin-action-result.ts", ["adminActionSuccess", "adminActionWarning", "withAdminActionCacheWarning"]),
  assignmentDeclarations("src/lib/cache/revalidate-public-cache-tags.ts", ["PUBLIC_CACHE_REVALIDATION_MAX_ATTEMPTS", "runBoundedPublicCacheRevalidation"]),
  assignmentDeclarations("src/lib/page-blocks/admin-revalidate.ts", ["revalidateCommittedPageBlockAction"]),
  assignmentDeclarations("src/app/admin/pages-blocks/pages/page-actions/helpers.ts", ["success", "failure", "databaseAssignmentKind", "revalidateCommittedPageBlockResult"]),
  assignmentDeclarations("src/app/admin/pages-blocks/pages/page-actions/assignment-create.ts", ["resolveRequestedSortOrder", "saveAssignment", ...assignmentActionNames]),
].join("\n");
const assignmentParsing = await jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>("../src/lib/page-blocks/admin-utils.ts");
type AssignmentObservedResult = { ok: boolean; feedbackStatus?: string; message?: string };
for (const actionName of assignmentActionNames) {
  for (const outcome of ["healthy", "cache-failed", "write-rejected", "policy-denied"] as const) {
    const events: string[] = [];
    const ports = {
      requireAdminSession: async () => ({ id: 77, username: "owned-assignment-control" }),
      pageExists: async () => true,
      positionPolicyFailure: async () => outcome === "policy-denied" ? { ok: false, message: "position denied" } : null,
      mutatePageComposition: async (pageId: number, operation: string, payload: { template_id?: number; hero_id?: number }) => {
        assert.equal(pageId, 813);
        assert.equal(operation, actionName === "assignHeroModule" ? "save_hero_assignment" : "save_assignment");
        assert.equal(payload.template_id ?? payload.hero_id, 421);
        events.push("write");
        if (outcome === "write-rejected") throw new Error("controlled write rejection");
        events.push("committed");
        return { id: 421 };
      },
      revalidatePageBlocksPath: async (pageId: number) => {
        assert.equal(pageId, 813);
        assert.ok(events.includes("committed"), "cache settlement requires an acknowledged write");
        events.push("cache");
        if (outcome === "cache-failed") throw new Error("controlled cache delivery failure");
      },
      nextPageCompositionSortOrder: async () => 4,
      getHeroAssignmentConflicts: async () => [],
      getDefaultAssignmentPosition: () => "body",
      BLOCK_MODULE_REGISTRY: { cards: {} },
      cleanText: assignmentParsing.cleanText,
      parseNumber: assignmentParsing.parseNumber,
      parseFormBoolean: assignmentParsing.parseFormBoolean,
      console: { error: () => events.push("cache-warning-recorded") },
    };
    const actual = new Function(...Object.keys(ports), ts.transpileModule(
      assignmentBehaviorSource + "\nreturn {" + assignmentActionNames.join(",") + "};",
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
    ).outputText)(...Object.values(ports)) as Record<typeof assignmentActionNames[number], (previous: { ok: false }, data: FormData) => Promise<AssignmentObservedResult>>;
    const data = new FormData();
    for (const [key, value] of Object.entries({ page_id: "813", template_id: "421", block_type: "cards", slot: "body", is_visible: "true" })) data.set(key, value);
    const result = await actual[actionName]({ ok: false }, data);
    const expectedEvents = outcome === "policy-denied" ? [] : outcome === "write-rejected" ? ["write"] : outcome === "cache-failed" ? ["write", "committed", "cache", "cache", "cache-warning-recorded"] : ["write", "committed", "cache"];
    assert.deepEqual(events, expectedEvents, actionName + ": " + outcome);
    assert.equal(result.ok, outcome === "healthy" || outcome === "cache-failed");
    if (result.ok) assert.equal(result.feedbackStatus, outcome === "cache-failed" ? "warning" : "success");
    if (outcome === "write-rejected") assert.equal(result.message, "controlled write rejection");
    if (outcome === "policy-denied") assert.equal(result.message, "position denied");
    check(actionName + " preserves " + outcome + " without replaying the domain command", true);
  }
}

const retiredHint = resolve(
  ROOT,
  "src/components/admin/page-blocks/ModuleDependencyHintsPanel.tsx",
);
const scopedPresentationSources = [
  ...fieldLayoutAdopters.map(({ source }) => source),
  ...repeaterAdopters.map(({ source }) => source),
  blockEditorHeader,
  crossPageUsageBanner,
].join("\n");

check(
  "permanent module hints and conflicting visible terminology remain retired",
  !existsSync(retiredHint) &&
    !scopedPresentationSources.includes("MODULE HINTS") &&
    !scopedPresentationSources.includes("الفتحة المفضلة") &&
    !/\b(?:Eyebrow|Kicker|Pre-title)\b/.test(scopedPresentationSources),
);

check(
  "Cards family adopts four flat premium tabs without losing fields, link ownership or inactive native FormData",
  (() => {
    const tree = ts.createSourceFile("CardsModuleEditClient.tsx", cardsEditor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const elements: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    const tagged = (tag: string) => elements.filter(node => node.tagName.getText(tree) === tag);
    const attr = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) => node.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(tree) === name);
    const tabs = tagged("ModuleEditorTabs");
    assert.equal(tabs.length, 1);
    const initializer = attr(tabs[0], "tabs")?.initializer;
    assert.ok(initializer && ts.isJsxExpression(initializer) && initializer.expression && ts.isArrayLiteralExpression(initializer.expression));
    const tabRows = initializer.expression.elements.map(node => {
      assert.ok(ts.isObjectLiteralExpression(node));
      const id = node.properties.find((prop): prop is ts.PropertyAssignment => ts.isPropertyAssignment(prop) && prop.name.getText(tree) === "id");
      assert.ok(id && ts.isStringLiteral(id.initializer));
      return { id: id.initializer.text, source: node.getText(tree) };
    });
    assert.deepEqual(tabRows.map(row => row.id), ["content", "cards", "presentation", "pages"]);
    const panel = (id: string) => tabRows.find(row => row.id === id)!.source;
    for (const field of ["eyebrow", "title", "description"]) {
      assert.ok(panel("content").includes('name="' + field + '"'));
      assert.ok(panel("content").includes('showName="show_' + field + '"'));
      assert.ok(panel("content").includes('boldName="' + field + '_bold"'));
      assert.ok(panel("content").includes('alignmentName="' + field + '_alignment"'));
    }
    const textRows = tagged("ModuleEditorVisibilityAlignRow");
    assert.equal(textRows.length, 3);
    for (const row of textRows) assert.equal(attr(row, "presentation")?.initializer?.getText(tree), '"premium"');
    assert.equal(tagged("ModuleEditorField").filter(node => attr(node, "nature")?.initializer?.getText(tree) === '"short-text"' && attr(node, "span")?.initializer?.getText(tree) === "{6}").length, 2);
    assert.equal(tagged("ModuleEditorField").filter(node => attr(node, "nature")?.initializer?.getText(tree) === '"long-content"' && attr(node, "span")?.initializer?.getText(tree) === "{12}").length, 1);
    assert.equal(tagged("textarea").length, 1);
    assert.equal(attr(tagged("textarea")[0], "name")?.initializer?.getText(tree), '"description"');
    const repeaters = tagged("AdminCardsItemsField");
    assert.equal(repeaters.length, 1);
    assert.equal(attr(repeaters[0], "presentation")?.initializer?.getText(tree), '"premium"');
    assert.equal(attr(repeaters[0], "items")?.initializer?.getText(tree), "{config.items ?? []}");
    assert.equal(attr(repeaters[0], "minItems")?.initializer?.getText(tree), "{1}");
    assert.ok(attr(repeaters[0], "showIcon"));
    assert.equal(attr(repeaters[0], "renderHref")?.initializer?.getText(tree), "{renderCardHref}");
    assert.ok(panel("cards").includes("<AdminCardsItemsField") && !panel("content").includes("<AdminCardsItemsField"));
    const links = tagged("AdminLinkField");
    assert.equal(links.length, 1);
    assert.equal(attr(links[0], "prefix")?.initializer?.getText(tree), "{`item_${index}`}" );
    assert.ok(attr(links[0], "showAnchor"));
    assert.equal(attr(links[0], "presentation")?.initializer?.getText(tree), '"inline"');
    assert.equal(attr(links[0], "actionPresentation")?.initializer?.getText(tree), '"bare"');
    assert.ok(attr(links[0], "defaultValue")?.initializer?.getText(tree).includes("linkDefaultFromContainer(item"));
    assert.ok(panel("presentation").includes('name="columns"') && panel("presentation").includes("String(config.columns ?? 3)"));
    for (const columns of [2, 3, 4]) assert.ok(panel("presentation").includes('value: "' + columns + '"'));
    for (const id of ["presentation", "pages"]) assert.ok(panel(id).includes('sectionHeaderPresentation: "control"'));
    const pages = tagged("ModuleEditorPagesTab");
    assert.equal(pages.length, 1);
    assert.equal(attr(pages[0], "presentation")?.initializer?.getText(tree), '"premium"');
    // Preserve the original Cards warning and placement details, which the assignment rows do not replace.
    assert.equal(attr(pages[0], "showUsageBanner"), undefined, "Cards must retain the existing shared usage banner default");
    assert.ok(presentation.includes("showUsageBanner = true") && presentation.includes("{showUsageBanner ? ("));
    assert.ok(presentation.includes("<ModuleCrossPageUsageBanner") && presentation.includes("assignments={assignmentContext.assignments}"));
    assert.ok(crossPageUsageBanner.includes("if (assignments.length <= 1) return null;"));
    assert.ok(crossPageUsageBanner.includes("تنبيه: موديول مشترك بين عدة صفحات") && crossPageUsageBanner.includes("أي تعديل على المحتوى سيظهر في"));
    assert.ok(crossPageUsageBanner.includes("resolveLayoutRegionAdminLabel(row.slot, row.region_admin_label)") && crossPageUsageBanner.includes("row.page_path"));
    assert.equal(attr(pages[0], "assignmentContext")?.initializer?.getText(tree), "{assignmentContext}");
    for (const [name, value] of [["id", "{block.id}"], ["slug", "{block.slug}"], ["variant", '{block.variant ?? "glass"}'], ["style_preset", '{block.style_preset ?? "premium-dark"}']]) {
      const input = tagged("input").filter(node => attr(node, "name")?.initializer?.getText(tree) === '"' + name + '"');
      assert.equal(input.length, 1);
      assert.equal(attr(input[0], "type")?.initializer?.getText(tree), '"hidden"');
      assert.equal(attr(input[0], "value")?.initializer?.getText(tree), value);
    }
    for (const tag of ["AdminFormPendingFields", "ModuleEditorIdentitySection", "ModuleEditorSaveArea"]) assert.equal(tagged(tag).length, 1);
    assert.equal(attr(tagged("form")[0], "action")?.initializer?.getText(tree), "{updateAction}");
    assert.ok(!cardsEditor.includes("AdminRichTextEditor") && !cardsEditor.includes("AdminMediaImageField"));
    assert.ok(!/block\.(?:id|slug)\s*={2,3}|\.module\.css/.test(cardsEditor));
    const tabsOwner = read("src/components/admin/ui/AdminModuleTabs.tsx");
    assert.ok(tabsOwner.includes("hidden={tab.id !== activeId}") && tabsOwner.includes("{tab.content}"));
    return true;
  })(),
);

check(
  "Cards metadata owns functional tab names and singular headers while preserving saved entity names",
  (() => {
    const metadata = MODULE_KIND_METADATA.cards.editorSections!;
    for (const [id, label] of [["content", MODULE_EDITOR_TAB_LABELS.text], ["cards", MODULE_EDITOR_TAB_LABELS.cards], ["presentation", "إعدادات العرض"], ["pages", MODULE_EDITOR_TAB_LABELS.visibility]]) {
      assert.equal(metadata[id].navigationLabelAr, label);
      assert.equal(resolveModuleEditorTabId(id, ["content", "cards", "presentation", "pages"]), id);
    }
    for (const id of ["content", "cards"]) {
      assert.equal(metadata[id].sectionChrome, "implicit");
      assert.equal(metadata[id].sectionHeadingAr, null);
      assert.equal(metadata[id].sectionDescriptionAr, null);
    }
    assert.ok(metadata.presentation.sectionHeadingAr && metadata.presentation.sectionDescriptionAr);
    const header = cardsEditor.slice(cardsEditor.indexOf("<ModuleEditorHeader"), cardsEditor.indexOf("<form"));
    assert.ok(header.includes("entityName={block.name}") && !header.includes("moduleSlug="));
    for (const name of ["بطاقات محفوظة", "اسم محدث"]) assert.equal(getModuleEditorHeaderMetadata("cards", undefined, name)?.titleAr, name);
    assert.ok(!/navigationLabelAr=|sectionHeadingAr=|sectionDescriptionAr=/.test(cardsEditor));
    return true;
  })(),
);

check(
  "Cards premium repeater is opt-in and preserves default creation, stable rows, limits and canonical save owners",
  (() => {
    assert.ok(cardsRepeater.includes('presentation?: "default" | "premium"') && cardsRepeater.includes('presentation = "default"'));
    assert.ok(cardsRepeater.includes('presentation === "premium"'));
    assert.ok(cardsRepeater.includes("<ModuleEditorRepeaterGrid presentation={presentation} columns={3}>"));
    assert.match(cardsRepeater, /<ModuleEditorRepeaterCard[\s\S]*?presentation=\{presentation\}/);
    assert.ok(cardsRepeater.includes("<AdminFormControlHeader") && cardsRepeater.includes('presentation="leading-icon"') && cardsRepeater.includes("<AdminActionButton"));
    for (const token of ["minItems = 1", "maxItems = 12", "showIcon = true", "padItems(items, minItems).slice(0, maxItems)", "key={item.clientKey}", "function updateItem(", "function moveItem(", "function removeItem(", "function addItem(", "if (nextIndex < 0 || nextIndex >= rows.length) return;", "[next[index], next[nextIndex]] = [next[nextIndex], next[index]];", "if (rows.length <= minItems) return;", "if (rows.length >= maxItems) return;", "renderHref(item, index)"]) assert.ok(cardsRepeater.includes(token), token);
    for (const field of ["icon", "title", "body"]) assert.ok(cardsRepeater.includes("item_${index}_" + field));
    for (const condition of ["disabled={index === 0}", "disabled={index === rows.length - 1}", "disabled={rows.length <= minItems}"]) assert.equal(cardsRepeater.split(condition).length - 1, 2);
    assert.ok(cardsRepeater.includes('<h3 className="text-sm font-semibold text-white">{label}</h3>'));
    assert.ok(cardsRepeater.includes('className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15 disabled:cursor-not-allowed disabled:opacity-40"'));
    assert.ok(blockManager.includes("<AdminCardsItemsField items={[]} minItems={1} />"));
    assert.ok(!/AdminRichTextEditor|AdminMediaImageField|duplicateItem/.test(cardsRepeater));
    assert.ok(cardsActions.includes("index < 12") && cardsActions.includes('formData.get("items_json")') && cardsActions.includes("assertValidCardsItems"));
    assert.ok(cardsActions.includes("requireAdminSession()") && cardsActions.includes("coordinateMediaReferenceEntityMutation"));
    assert.match(cardsActions, /saveModuleTemplateWithPageAssignments\(\s*"cards",\s*id,\s*nextRow,\s*parsePageIdsFromForm\(formData\),\s*actor\s*,?\s*\)/);
    assert.ok(cardsActions.includes("withModuleEditorReturnContextFromForm"));
    const loader = read("src/lib/page-blocks/load-page-blocks.ts");
    assert.ok(loader.includes("resolveCardsBlockConfigLinks") && loader.includes("asCardsConfig(template.config)"));
    return true;
  })(),
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
      "regionLabels[normalizeLayoutSlot(row.slot)]",
    ) &&
    assignmentRow.includes("AdminListboxSelect") &&
    pagesClient.includes("handleDisplayPositionChange") &&
    pagesClient.includes("updatePageBlockAssignment(") &&
    pagesClient.includes("<PageVisualSlotMap assignments={instant.rows}") &&
    pagesClient.includes("reconcileSuccess:") &&
    pagesClient.includes('paramKey: "slot"') &&
    pagesClient.includes("options: regions.map((region) => ({") &&
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
  "Page Blocks read owners join assigned metadata, preload the canonical Layout and default Content summaries, and keep other picker catalogs on demand",
  adminQueries.includes("content_block_templates(id,name,slug,status,variant,config)") &&
    adminQueries.includes("hero_templates(id,name,slug,status,variant,config)") &&
    adminQueries.includes("const template = row.content_block_templates;") &&
    adminQueries.includes("const template = row.hero_templates;") &&
    adminQueries.includes("getPageModuleTemplateOptionsForAdmin(kind: PageModuleKind)") &&
    adminQueries.includes('getPageModuleTemplateOptionsForAdmin("content").catch(() => null)') &&
    pageCompositionRoute.includes("initialContentTemplates={assignmentsData.initialContentTemplates}") &&
    !pageCompositionRoute.includes("templates={assignmentsData.templates}") &&
    assignmentContextQuery.includes("const pageById = new Map") &&
    !assignmentContextQuery.includes("pages(title,slug,path)") &&
    heroDetailRoute.includes("getHeroModuleAssignmentContext(heroId)") &&
    !heroDetailRoute.includes('.from("pages")') &&
    !heroDetailRoute.includes("hero_assignments(") &&
    pageCompositionRoute.includes(
      "const [pageResult, preference, assignmentsResult, globalSeo, layoutsResult] = await Promise.all",
    ) &&
    pageCompositionRoute.includes("loadPageCompositionLayouts()") &&
    pageCompositionRoute.includes("loadPageRegionsForPage(page.id)") &&
    !pageCompositionRoute.includes(
      "assignmentsData = await getPageModuleAssignmentsForAdmin",
    ),
);

check(
  "shared link presentation exposes resolved destination beside accessible icon actions and stacked Anchor for every variant",
  (() => {
    const owner = read("src/components/admin/ui/AdminLinkField.tsx");
    return owner.includes('data-admin-link-field={presentation}') &&
      owner.includes('data-admin-link-destination=""') &&
      owner.includes('previewDisplay?.title') && owner.includes('previewDisplay?.publicPath') &&
      !owner.includes('if (presentation === "inline")') &&
      owner.includes('data-admin-link-controls=""') &&
      owner.includes('className="flex min-w-0 items-center gap-2"') &&
      owner.includes('variant={actionPresentation === "bare" ? "gold-ghost" : "gold"} size="icon"') &&
      owner.includes('variant={actionPresentation === "bare" ? "danger-ghost" : "danger"} size="icon"') &&
      owner.includes('<span className="sr-only">{chooseLinkLabel}</span>') &&
      owner.includes('<span className="sr-only">{clearLinkLabel}</span>') &&
      owner.includes('onClick={() => setPickerOpen(true)}') &&
      owner.includes('onClick={() => setLink(emptyAdminLink())}') &&
      owner.includes('<span className="block">Anchor (اختياري)</span>') && owner.includes('adminFormLabelClassName()');
  })(),
);
check(
  "Content button composition preserves Story and Home Projects functional groups through shared owners while Header/Footer retain their defaults",
  adminFormGridOwner.includes('presentation?: "plain" | "control-cards"') &&
    (() => {
      const introPath = "src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx";
      const intro = read(introPath);
      const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [introPath] });
      const bindings = [
        { sourceFile: "src/components/admin/ui/AdminCard.tsx", exportNames: ["default"] },
        { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportNames: ["AdminFormControlHeader"] },
        { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportNames: ["AdminFormGrid"] },
        { sourceFile: "src/components/admin/ui/AdminFormListboxSelect.tsx", exportNames: ["default"] },
        { sourceFile: "src/components/admin/ui/AdminLinkField.tsx", exportNames: ["default"] },
        { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportNames: ["adminChoiceButtonClassName"] },
      ];
      const parsed = [intro, contentEditClient].map((text, index) =>
        ts.createSourceFile("content-presentation-" + index + ".tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
      const hasStylesheetImport = parsed.some((tree) => tree.statements.some((node) =>
        ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.endsWith(".css")));
      let saveAreaOverridesDefault = false;
      const inspectSaveArea = (node: ts.Node) => {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          ts.isIdentifier(node.tagName) && node.tagName.text === "ModuleEditorSaveArea") {
          saveAreaOverridesDefault ||= node.attributes.properties.some((attribute) =>
            ts.isJsxAttribute(attribute) && attribute.name.getText(parsed[1]) === "className");
        }
        ts.forEachChild(node, inspectSaveArea);
      };
      inspectSaveArea(parsed[1]);
      return bindings.every((binding) => graphUsesExecutableBinding({ root: ROOT, graph, bindings: [binding] })) &&
        intro.includes('<ModuleEditorField nature="link" span={4}>') &&
        intro.includes('<ModuleEditorField nature="standard" span={8}>') &&
        intro.includes('<AdminFormGrid columns={2}') &&
        intro.includes('data-home-story-button-panel="data"') &&
        intro.includes('data-home-story-button-panel="appearance"') &&
        intro.includes('data-home-story-button-card="target"') &&
        intro.includes('data-home-story-button-card={name}') &&
        intro.includes('<AdminCard presentation="premium"') &&
        intro.includes('<AdminFormControlHeader') &&
        intro.includes('className={ADMIN_FORM.choiceGroup}') &&
        intro.includes('className={adminChoiceButtonClassName(active, "", "compact")}') &&
        intro.includes('<ModuleEditorSectionHeading intent="cta">') &&
        intro.includes('icon === "arrow" ? (') &&
        intro.includes('<input type="hidden" name="button_icon_position" value={iconPosition} />') &&
        intro.includes('name="button_open_target"') &&
        intro.includes('defaultValue={config.button?.target === "_blank" ? "_blank" : "_self"}') &&
        !hasStylesheetImport && !saveAreaOverridesDefault &&
        !contentEditClient.includes('sectionHeaderClassName:');
    })() &&
    (() => {
      const file = "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx";
      const source = read(file);
      type Element = ts.JsxElement | ts.JsxSelfClosingElement;
      const opening = (node: Element) => ts.isJsxElement(node) ? node.openingElement : node;
      const tag = (node: Element) => opening(node).tagName.getText();
      const attribute = (node: Element, name: string) => opening(node).attributes.properties.find(
        (entry): entry is ts.JsxAttribute => ts.isJsxAttribute(entry) && entry.name.getText() === name,
      );
      const textAttribute = (node: Element, name: string) => {
        const value = attribute(node, name)?.initializer;
        return value && ts.isStringLiteral(value) ? value.text : undefined;
      };
      const elements = (root: ts.Node) => {
        const found: Element[] = [];
        const visit = (node: ts.Node) => { if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) found.push(node); ts.forEachChild(node, visit); };
        visit(root); return found;
      };
      const nearest = (node: ts.Node, predicate: (element: Element) => boolean): Element | undefined => {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if ((ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent)) && predicate(parent)) return parent;
        }
        return undefined;
      };
      function inspect(text: string) {
        const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const declaration = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "HomeProjectsPlacementEditor");
        assert.ok(declaration?.body);
        const returned = declaration.body.statements.find(ts.isReturnStatement)?.expression;
        assert.ok(returned);
        const nodes = elements(returned);
        const one = (matches: Element[], label: string) => { assert.equal(matches.length, 1, label); return matches[0]; };
        const panels = nodes.filter(node => textAttribute(node, "data-premium-cta-panel") !== undefined);
        assert.equal(panels.length, 2, "Home Projects CTA has exactly two functional panels");
        const data = one(panels.filter(node => textAttribute(node, "data-premium-cta-panel") === "data"), "One CTA data panel");
        const appearance = one(panels.filter(node => textAttribute(node, "data-premium-cta-panel") === "appearance"), "One CTA appearance panel");
        const panelOf = (node: ts.Node) => nearest(node, element => textAttribute(element, "data-premium-cta-panel") !== undefined);
        for (const panel of panels) {
          const owned = nodes.filter(node => panelOf(node) === panel);
          const surfaces = owned.filter(node => tag(node) === "AdminCard" && textAttribute(node, "presentation") === "premium" &&
            !nearest(node, ancestor => tag(ancestor) === "AdminCard" && panelOf(ancestor) === panel));
          assert.equal(surfaces.length, 1, "Each functional CTA panel has one outer shared Premium surface");
          const heading = one(owned.filter(node => tag(node) === "ModuleEditorSectionHeading" && textAttribute(node, "intent") === "cta"), "Each CTA panel has one semantic heading");
          assert.ok(nearest(heading, ancestor => ancestor === surfaces[0]), "Panel heading belongs to its shared surface");
          assert.ok(owned.some(node => tag(node) === "p" && ts.isJsxElement(node) && node.children.some(child => ts.isJsxText(child) && child.text.trim())), "Each CTA panel explains its function");
        }
        const label = one(nodes.filter(node => tag(node) === "input" && textAttribute(node, "name") === "footer_cta_label"), "One persisted CTA label");
        const link = one(nodes.filter(node => tag(node) === "AdminLinkField" && textAttribute(node, "prefix") === "footer_cta"), "One canonical CTA link field");
        assert.equal(panelOf(label), data, "CTA label belongs to data panel");
        assert.equal(panelOf(link), data, "CTA link belongs to data panel");
        const showAnchor = attribute(link, "showAnchor");
        assert.ok(!showAnchor || (showAnchor.initializer && ts.isJsxExpression(showAnchor.initializer) && showAnchor.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword), "Home Projects does not acquire Story-only Anchor controls");
        assert.ok(!nodes.some(node => /^(?:footer_cta|button)_(?:icon|icon_position|anchor)$/u.test(textAttribute(node, "name") ?? "")), "Home Projects does not acquire unsupported Story presentation fields");
        const controls = nodes.filter(node => textAttribute(node, "data-premium-cta-control") !== undefined);
        assert.equal(controls.length, 3, "Appearance has exactly the existing visibility, target and alignment controls");
        const bindings = [
          ["visibility", "VisibilityToggle", "show_footer_cta"],
          ["target", "AdminFormListboxSelect", "footer_cta_open_target"],
          ["alignment", "AlignmentChoice", "footer_cta_alignment"],
        ] as const;
        const fields = new Map<string, Element>(), wrappers = new Map<string, Element>();
        for (const [kind, component, name] of bindings) {
          const wrapper = one(controls.filter(node => textAttribute(node, "data-premium-cta-control") === kind), `One ${kind} control group`);
          const field = one(nodes.filter(node => tag(node) === component && textAttribute(node, "name") === name), `One actual ${kind} field`);
          assert.equal(panelOf(wrapper), appearance, `${kind} group belongs to appearance panel`);
          assert.equal(panelOf(field), appearance, `${kind} field belongs to appearance panel`);
          assert.equal(nearest(field, node => textAttribute(node, "data-premium-cta-control") !== undefined), wrapper, `${kind} field is inside its own group`);
          fields.set(kind, field); wrappers.set(kind, wrapper);
        }
        return { tree, appearance, fields, wrappers };
      }
      const current = inspect(source);
      const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [file], symbolAware: true });
      for (const binding of [
        { sourceFile: "src/components/admin/ui/AdminCard.tsx", exportNames: ["default"] },
        { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportNames: ["ModuleEditorFieldGrid", "ModuleEditorField", "ModuleEditorSectionHeading"] },
        { sourceFile: "src/components/admin/ui/AdminLinkField.tsx", exportNames: ["default"] },
        { sourceFile: "src/components/admin/ui/AdminFormListboxSelect.tsx", exportNames: ["default"] },
        { sourceFile: "src/components/admin/ui/AdminFormSwitch.tsx", exportNames: ["default"] },
        { sourceFile: "src/components/admin/ui/AdminTextFormatControls.tsx", exportNames: ["default"] },
      ]) assert.ok(graphUsesExecutableBinding({ root: ROOT, graph, bindings: [binding] }), `${binding.sourceFile} remains the executable shared owner`);
      const edit = (changes: { node: ts.Node; text: string }[]) => changes.sort((a, b) => b.node.getStart(current.tree) - a.node.getStart(current.tree)).reduce(
        (result, change) => result.slice(0, change.node.getStart(current.tree)) + change.text + result.slice(change.node.end), source,
      );
      const flatten = (node: Element) => {
        assert.ok(ts.isJsxElement(node));
        return node.openingElement.getText(current.tree) + node.closingElement.getText(current.tree) + source.slice(node.openingElement.end, node.closingElement.getStart(current.tree));
      };
      const alignment = current.wrappers.get("alignment")!;
      const visibilityField = current.fields.get("visibility")!, targetField = current.fields.get("target")!;
      const probes = [
        ["flattened appearance cards", edit([{ node: current.appearance, text: flatten(current.appearance) }])],
        ["orphaned alignment", edit([{ node: alignment, text: flatten(alignment) }])],
        ["swapped group membership", edit([{ node: visibilityField, text: targetField.getText(current.tree) }, { node: targetField, text: visibilityField.getText(current.tree) }])],
      ] as const;
      const nativeInventory = (text: string) => elements(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))
        .map(node => `${tag(node)}:${textAttribute(node, "name") ?? ""}:${textAttribute(node, "prefix") ?? ""}`).sort();
      for (const [label, changed] of probes) {
        assert.deepEqual(nativeInventory(changed), nativeInventory(source), `${label} retains all component and field tokens`);
        assert.ok(rejects(() => inspect(changed)), `Composition guard rejects ${label} even when every token remains present`);
      }
      // These existing paired CTA modes share the same label/link grouping risk,
      // while their own visibility/formatting and project-domain contracts differ.
      for (const [pairedFile, functionName] of [
        ["src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx", "HeroCtaFields"],
        ["src/components/admin/page-blocks/CtaModuleEditClient.tsx", "CtaModuleEditClient"],
      ]) {
        const pairedSource = read(pairedFile);
        const inspectPair = (text: string) => {
          const tree = ts.createSourceFile(pairedFile, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
          const declaration = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === functionName);
          assert.ok(declaration?.body);
          // Hero's project-domain early return intentionally owns no link picker.
          const returned = declaration.body.statements.filter(ts.isReturnStatement).at(-1)?.expression;
          assert.ok(returned);
          const nodes = elements(returned), pairs: { card: Element; link: Element }[] = [];
          for (const prefix of ["primary_cta", "secondary_cta"]) {
            const labels = nodes.filter(node => tag(node) === "input" && textAttribute(node, "name") === `${prefix}_label`);
            const links = nodes.filter(node => tag(node) === "AdminLinkField" && textAttribute(node, "prefix") === prefix);
            assert.equal(labels.length, 1, `${functionName} has one ${prefix} label`);
            assert.equal(links.length, 1, `${functionName} has one ${prefix} link`);
            const card = nearest(labels[0], node => tag(node) === "AdminCard" && textAttribute(node, "presentation") === "premium");
            assert.ok(card, `${functionName} ${prefix} label has a shared Premium card`);
            assert.equal(nearest(links[0], node => tag(node) === "AdminCard" && textAttribute(node, "presentation") === "premium"), card, `${functionName} ${prefix} label and matching link share their closest Premium card`);
            pairs.push({ card, link: links[0] });
          }
          assert.notEqual(pairs[0].card, pairs[1].card, `${functionName} keeps its two button data groups distinct`);
          return { tree, pairs };
        };
        const paired = inspectPair(pairedSource);
        const pairedGraph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [pairedFile], symbolAware: true });
        for (const binding of [
          { sourceFile: "src/components/admin/ui/AdminCard.tsx", exportNames: ["default"] },
          { sourceFile: "src/components/admin/ui/AdminLinkField.tsx", exportNames: ["default"] },
        ]) assert.ok(graphUsesExecutableBinding({ root: ROOT, graph: pairedGraph, bindings: [binding] }), `${functionName} retains ${binding.sourceFile}`);
        const replace = (changes: { node: ts.Node; text: string }[]) => changes.sort((a, b) => b.node.getStart(paired.tree) - a.node.getStart(paired.tree)).reduce(
          (result, change) => result.slice(0, change.node.getStart(paired.tree)) + change.text + result.slice(change.node.end), pairedSource,
        );
        const card = paired.pairs[0].card;
        assert.ok(ts.isJsxElement(card));
        const flattened = replace([{ node: card, text: card.openingElement.getText(paired.tree) + card.closingElement.getText(paired.tree) + pairedSource.slice(card.openingElement.end, card.closingElement.getStart(paired.tree)) }]);
        const swapped = replace([
          { node: paired.pairs[0].link, text: paired.pairs[1].link.getText(paired.tree) },
          { node: paired.pairs[1].link, text: paired.pairs[0].link.getText(paired.tree) },
        ]);
        for (const [label, changed] of [["flattened data card", flattened], ["swapped link membership", swapped]]) {
          assert.deepEqual(nativeInventory(changed), nativeInventory(pairedSource), `${functionName} ${label} retains every component and field token`);
          assert.ok(rejects(() => inspectPair(changed)), `${functionName} rejects ${label}`);
        }
      }
      return true;
    })() &&
    heroCtaEditor.includes('<AdminFormGrid columns={1}>') &&
    heroEditor.includes('<AdminFormGrid columns={2}') &&
    heroEditor.includes('<HeroRenderedAreaCard previewPath={previewPath} />'),
);
check(
  "shared premium presentation is opt-in and shared control chrome preserves the standard field scale",
  (() => {
    const card = read("src/components/admin/ui/AdminCard.tsx");
    const defaultCard = card.slice(card.lastIndexOf("\n  return ("));
    const form = read("src/components/admin/ui/AdminForm.tsx");
    const styles = read("src/lib/admin/admin-ui-styles.ts");
    return card.includes('presentation?: "default" | "premium"') &&
      card.includes('presentation = "default"') &&
      card.includes('if (presentation === "premium")') &&
      card.includes('interactive = false') &&
      defaultCard.includes('relative overflow-hidden rounded-[28px] border border-white/10 bg-[#080B10]/78 shadow-[0_18px_70px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl') &&
      defaultCard.includes('hover:-translate-y-0.5 hover:border-[#D8B87A]/28 hover:bg-[#10131A]/82') &&
      defaultCard.includes('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-[#D8B87A]/38 to-transparent') &&
      !defaultCard.includes('ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME') &&
      form.includes('data-admin-form-control-header=""') &&
      form.includes('className="text-sm font-semibold text-white"') &&
      form.includes('className="text-xs leading-5 text-white/55"') &&
      form.includes('size-10 shrink-0') && form.includes('[&>svg]:size-5') &&
      styles.includes('export function adminChoiceButtonClassName(active: boolean, extra = "", density: "default" | "compact" = "default")') &&
      styles.includes('choiceGroup: "flex min-w-0 flex-wrap gap-2"');
  })(),
);
check(
  "single-image previews stay bounded and open in the shared modal while compact and gallery densities remain explicit",
  (mediaOwner.match(/max-w-sm/g)?.length === 2) &&
    mediaOwner.includes(': "relative h-44"}') &&
    mediaOwner.includes('style={cardPresentation ? { aspectRatio, maxWidth:') &&
    mediaOwner.includes('min(100%, calc(min(40vh, 24rem) * ${aspectRatio}))') &&
    mediaOwner.includes('dimensions.width / dimensions.height : 16 / 9') &&
    mediaOwner.includes('loadedDimensions?.value === value') &&
    mediaOwner.includes('width: image.naturalWidth, height: image.naturalHeight') &&
    mediaOwner.includes('cardPresentation ? "aspect-video" : "h-44 max-w-sm"') &&
    mediaOwner.includes('variant = "default"') &&
    mediaOwner.includes('cardPresentation = variant === "card"') &&
    mediaOwner.includes('cardPresentation ? "object-contain" : "object-cover"') &&
    mediaOwner.includes(': `relative w-full max-w-sm overflow-hidden rounded-2xl border') &&
    mediaOwner.includes('data-admin-media-image-preview-trigger') &&
    mediaOwner.includes('<VenesiaModal') &&
    mediaOwner.includes('open={previewOpen && presentation === "active"}') &&
    mediaOwner.includes('aria-haspopup="dialog"') &&
    mediaOwner.includes('className="object-contain"') &&
    mediaOwner.includes('compactAspectClassName = "aspect-[4/3]"') &&
    !mediaOwner.split('if (variant === "compact")')[1].split('\n  const cardPresentation')[0].includes('max-w-sm') &&
    (() => { const gallery = read("src/components/admin/media/AdminMediaGalleryField.tsx");
      return gallery.includes('grid-cols-1 md:grid-cols-2') &&
        gallery.includes('grid-cols-1 md:grid-cols-3 xl:grid-cols-4') &&
        gallery.includes('aspect-[4/3]') && gallery.includes('AdminMediaOriginalDimensions');
    })(),
);

check(
  "CTA module uses the shared one-column form grid inside each CTA card without joined text/link columns",
  (() => { const cta = read("src/components/admin/page-blocks/CtaModuleEditClient.tsx"); const links = cta.slice(cta.indexOf('id: "cta"'), cta.indexOf('id: "presentation"')); return (links.split('<AdminFormGrid columns={1}>').length === 3) && !cta.includes("grid-cols-[minmax(0,1fr)_auto]") && !cta.includes("rounded-e-none"); })(),
);

check(
  "Hero gallery actions reuse the shared image-card overlay while default, bare and structured gallery contracts remain intact",
  await (async () => {
    const gallery = read("src/components/admin/media/AdminMediaGalleryField.tsx");
    const tree = ts.createSourceFile("AdminMediaGalleryField.tsx", gallery, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const nodes: ts.Node[] = [];
    function visit(node: ts.Node) { nodes.push(node); ts.forEachChild(node, visit); }
    visit(tree);
    const defaultBinding = nodes.find((node): node is ts.BindingElement => ts.isBindingElement(node) && node.name.getText(tree) === "actionPresentation");
    assert.equal(defaultBinding?.initializer?.getText(tree), '"default"');
    assert.ok(gallery.includes('actionPresentation?: "default" | "bare" | "card"'));
    const nativeOverlay = nodes.find((node): node is ts.ConditionalExpression => ts.isConditionalExpression(node) && node.condition.getText(tree) === 'actionPresentation === "default"');
    const actionRail = nodes.find((node): node is ts.ConditionalExpression => ts.isConditionalExpression(node) && node.condition.getText(tree) === 'actionPresentation === "bare"');
    assert.ok(nativeOverlay && actionRail);
    const footerGate = actionRail.parent;
    assert.ok(ts.isConditionalExpression(footerGate) && footerGate.condition.getText(tree) === 'actionPresentation === "card"' && footerGate.whenTrue.getText(tree) === "null");
    const cardAction = nodes.find((node): node is ts.ConditionalExpression => ts.isConditionalExpression(node) && node.condition.getText(tree) === 'actionPresentation === "card"' && node.whenTrue.getText(tree).includes("<AdminMediaImageActions"));
    assert.ok(cardAction && cardAction.whenFalse.getText(tree) === "null");
    const sharedActionCalls = nodes.filter((node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "AdminMediaImageActions");
    assert.equal(sharedActionCalls.length, 1, "Gallery must delegate to one shared media action rail");
    let frame: ts.Node = cardAction.parent;
    while (frame.parent && !ts.isJsxElement(frame)) frame = frame.parent;
    assert.ok(ts.isJsxElement(frame) && frame.openingElement.getText(tree).includes('className="relative aspect-[4/3]"'));
    assert.ok(frame.children.some(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "AdminMediaPreview" && node.end < cardAction.pos), "Actions remain siblings after the preview, including missing/deleted media states");
    assert.ok(gallery.includes('controlsOverlay={actionPresentation === "card"}'));
    assert.ok(gallery.includes('import { AdminMediaImageActions } from "./AdminMediaImageField"'));
    assert.ok(!gallery.includes("absolute bottom-3 left-3 flex gap-2"), "Gallery must not copy the image action rail presentation");
    assert.equal(nativeOverlay.whenFalse.getText(tree), "null", "The bare rail must not duplicate the original remove overlay");
    assert.ok(nativeOverlay.whenTrue.getText(tree).includes('className="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 hover:text-white"'));
    assert.ok(actionRail.whenFalse.getText(tree).includes('className="cursor-pointer shrink-0 rounded-lg border border-[#D8B87A]/30 px-2.5 py-1 text-[11px] font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/10"'));
    assert.ok(actionRail.whenTrue.getText(tree).includes('className="inline-flex shrink-0 items-center gap-1"'));
    assert.ok(gallery.includes('import AdminActionButton from "../ui/AdminActionButton"') && gallery.includes('import { AdminDataGridActionIcon } from "../ui/AdminDataGrid"'));
    assert.equal((actionRail.whenTrue.getText(tree).match(/<AdminActionButton\b/gu) ?? []).length, 2);
    assert.equal((actionRail.whenTrue.getText(tree).match(/<AdminDataGridActionIcon\b/gu) ?? []).length, 2);
    for (const glyph of ["copy-link", "delete"]) assert.ok(actionRail.whenTrue.getText(tree).includes(`<AdminDataGridActionIcon action="${glyph}" size="lg" />`));
    assert.equal(gallery.split("<label className={ADMIN_FORM.labelStack}>").length - 1, 2);
    for (const attribute of ["name={props.altName}", "name={props.captionName}", "value={item.alt}", "value={item.caption}", 'updateItem(index, "alt", event.target.value)', 'updateItem(index, "caption", event.target.value)']) assert.ok(gallery.includes(attribute));
    assert.equal(read("src/components/admin/page-blocks/AdminImagePathListField.tsx").trim(), 'export { default } from "../media/AdminMediaGalleryField";');
    for (const consumer of ["src/components/admin/content/editors/media/MediaContentForm.tsx", "src/components/admin/projects/tracking/TrackingForms.tsx"]) {
      const source = read(consumer);
      assert.ok(source.includes("<AdminMediaGalleryField"));
      assert.ok(!source.includes("actionPresentation="), `${consumer} must retain the default gallery actions`);
    }
    const structured = read("src/components/admin/content/editors/media/MediaContentForm.tsx");
    for (const attribute of ['valueMode="items"', 'name="gallery_image_url"', 'altName="gallery_image_alt"', 'captionName="gallery_image_caption"', 'focusTargetId="gallery_image_url"', 'altFocusTargetId="gallery_image_alt"']) assert.ok(structured.includes(attribute));
    const tracking = read("src/components/admin/projects/tracking/TrackingForms.tsx");
    assert.ok(tracking.includes('name="image_urls"') && tracking.includes('selectionMode="multiple"'));

    const [{ default: ActionButton }, { AdminDataGridActionIcon }, { adminMediaPresentationState }] = await Promise.all([
      jiti.import<typeof import("../src/components/admin/ui/AdminActionButton.tsx")>("../src/components/admin/ui/AdminActionButton.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminDataGrid.tsx")>("../src/components/admin/ui/AdminDataGrid.tsx"),
      jiti.import<typeof import("../src/components/admin/media/AdminDeletedMediaNotice.tsx")>("../src/components/admin/media/AdminDeletedMediaNotice.tsx"),
    ]);
    const imageTree = ts.createSourceFile("AdminMediaImageField.tsx", mediaOwner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const mediaActionNode = imageTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminMediaImageActions");
    assert.ok(mediaActionNode);
    const compiledMediaActions = ts.transpileModule(mediaActionNode.getText(imageTree), {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const actionExports: Partial<typeof import("../src/components/admin/media/AdminMediaImageField.tsx")> = {};
    new Function("React", "exports", "AdminActionButton", "AdminDataGridActionIcon", compiledMediaActions)({ createElement }, actionExports, ActionButton, AdminDataGridActionIcon);
    const MediaActions = actionExports.AdminMediaImageActions;
    assert.ok(MediaActions);
    for (const glyph of ["restore", "delete"]) assert.ok(mediaActionNode.getText(imageTree).includes(`<AdminDataGridActionIcon action="${glyph}" size="md" />`));
    assert.ok(mediaOwner.includes('"children" | "size" | "variant" | "className" | "href" | "form" | "type"'), "Consumers cannot override the shared media action presentation");
    let selectedActions: ts.ConditionalExpression | undefined;
    function findImageActions(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(imageTree) === "selectedActions" && node.initializer && ts.isConditionalExpression(node.initializer)) selectedActions = node.initializer;
      ts.forEachChild(node, findImageActions);
    }
    findImageActions(imageTree);
    assert.ok(selectedActions && selectedActions.condition.getText(imageTree) === "cardPresentation");
    assert.ok(selectedActions.whenTrue.getText(imageTree).includes("<AdminMediaImageActions") && !selectedActions.whenTrue.getText(imageTree).includes("<AdminActionButton"));
    const renderImageActions = new Function("React", "AdminMediaImageActions", ts.transpileModule(
      `function render({ triggerId, replaceLabel, focusTargetId, label, pickerOpen, ariaDescribedBy, setPickerOpen, allowRemove, updateValue }) { return (${selectedActions.whenTrue.getText(imageTree)}); }`,
      { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } },
    ).outputText + "\nreturn render;")({ createElement }, MediaActions) as (context: Record<string, unknown>) => ReactNode;
    for (const allowRemove of [false, true]) for (const focusTargetId of [undefined, "field-focus"]) for (const pickerOpen of [false, true]) {
      const calls: unknown[] = [];
      const image = renderImageActions({ triggerId: "field-trigger", replaceLabel: "اختيار بديل", focusTargetId, label: "الصورة", pickerOpen, ariaDescribedBy: "image-error", allowRemove, setPickerOpen: (value: boolean) => calls.push(value), updateValue: (value: string) => calls.push(value) });
      const html = renderToStaticMarkup(createElement("div", null, image));
      assert.equal((html.match(/<button\b/gu) ?? []).length, allowRemove ? 2 : 1);
      assert.ok(html.includes('id="field-trigger"') && html.includes('title="اختيار بديل"') && html.includes(`aria-label="${focusTargetId ? "الصورة" : "اختيار بديل"}"`));
      assert.ok(html.includes(`aria-expanded="${pickerOpen}"`) && html.includes('aria-describedby="image-error"') && html.includes('aria-haspopup="dialog"'));
      assert.ok(isValidElement<Parameters<typeof MediaActions>[0]>(image));
      const click = {} as Parameters<NonNullable<typeof image.props.replace.onClick>>[0];
      image.props.replace.onClick?.(click);
      image.props.remove?.onClick?.(click);
      assert.deepEqual(calls, allowRemove ? [true, ""] : [true], "Existing ImageField keeps its original open and clear operations, including allowRemove");
    }
    // Execute the unchanged source expressions with real action/icon owners.
    // The fixture supplies only the surrounding row state and callback observers.
    const compileAction = (expression: ts.Expression) => new Function(
      "React", "AdminActionButton", "AdminDataGridActionIcon", "adminMediaPresentationState", "AdminMediaImageActions",
      ts.transpileModule(`function render({ actionPresentation = ${defaultBinding!.initializer!.getText(tree)}, itemsMode, index, props, label, item, referenceState, pickerOpen, replaceIndex, hasUrlError, openReplace, removeAt }) { return (${expression.getText(tree)}); }`, {
        compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
      }).outputText + "\nreturn render;",
    )({ createElement }, ActionButton, AdminDataGridActionIcon, adminMediaPresentationState, MediaActions) as (context: Record<string, unknown>) => ReactNode;
    const renderOverlay = compileAction(nativeOverlay);
    const renderRail = compileAction(footerGate);
    const renderCard = compileAction(cardAction);
    for (const itemsMode of [false, true]) for (const state of ["active", "deleted", "missing", "unavailable"]) {
      const index = itemsMode ? 0 : 1;
      const calls: [string, number][] = [];
      const context = {
        itemsMode, index, props: { name: "gallery_url", focusTargetId: "gallery-focus" }, label: "المعرض", item: { url: "/fixture.webp" },
        referenceState: { deleted: state === "deleted" ? ["/fixture.webp"] : [], missing: state === "missing" ? ["/fixture.webp"] : [], available: state !== "unavailable" },
        pickerOpen: itemsMode, replaceIndex: index, hasUrlError: itemsMode,
        openReplace: (next: number) => calls.push(["replace", next]), removeAt: (next: number) => calls.push(["remove", next]),
      };
      const render = (actionPresentation?: "default" | "bare" | "card") => {
        const props = { ...context, ...(actionPresentation ? { actionPresentation } : {}) };
        return [renderOverlay(props), renderRail(props), renderCard(props)];
      };
      const markup = (nodes: ReactNode[]) => renderToStaticMarkup(createElement("div", null, ...nodes));
      const normal = markup(render());
      assert.equal(markup(render("default")), normal, "Omitting the opt-in must exactly retain default action markup");
      const bareNodes = render("bare");
      const bare = markup(bareNodes);
      for (const [mode, html] of [["default", normal], ["bare", bare], ["card", markup(render("card"))]]) {
        const buttons = Array.from(html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gu), match => match[0]);
        assert.equal(buttons.length, 2, `${mode} must expose exactly one replace and one remove action`);
        const replace = buttons.find(button => button.includes('data-admin-media-gallery-action="replace"'))!;
        const remove = buttons.find(button => button.includes('data-admin-media-gallery-action="remove"'))!;
        assert.ok(replace && remove && buttons.every(button => button.includes('type="button"')));
        assert.ok(replace.includes('aria-haspopup="dialog"') && replace.includes(`aria-expanded="${itemsMode}"`));
        assert.equal(replace.includes('id="gallery-focus"'), itemsMode);
        assert.equal(replace.includes('aria-describedby="gallery_url-error"'), itemsMode);
        assert.ok(remove.includes(`aria-label="إزالة الصورة ${index + 1} من المعرض"`));
        const replaceLabel = state === "deleted" || state === "missing" ? "اختيار بديل" : "استبدال";
        if (mode === "bare") {
          assert.ok(replace.includes(`aria-label="${replaceLabel}"`) && replace.includes(`title="${replaceLabel}"`));
          assert.ok(html.includes('data-admin-media-gallery-actions="bare"') && html.includes("gap-1"));
          assert.ok(buttons.every(button => button.includes("size-11 shrink-0 p-0") && button.includes("border-transparent bg-transparent") && button.includes("focus-visible:outline") && button.includes('class="size-5.5 shrink-0"')));
          assert.ok(replace.includes("text-[#D8B87A]") && remove.includes("text-red-400"));
          assert.ok(!html.includes("absolute right-2 top-2"));
        } else if (mode === "card") {
          assert.ok(replace.includes(`aria-label="${replaceLabel}"`) && replace.includes(`title="${replaceLabel}"`));
          assert.equal((html.match(/data-admin-media-image-actions="true"/gu) ?? []).length, 1);
          assert.ok(html.includes("absolute bottom-3 left-3 flex gap-2 rounded-2xl bg-[#080B10]/95 p-1"));
          assert.ok(buttons.every(button => button.includes("size-11 shrink-0 p-0") && button.includes("focus-visible:outline") && button.includes('class="size-4.5 shrink-0"')));
          assert.ok(replace.includes("border-[#D8B87A]/30 bg-[#D8B87A]/12") && remove.includes("border-red-500/20 bg-red-500/10"));
          for (const [button, action] of [[replace, "restore"], [remove, "delete"]] as const) assert.ok(button.includes(renderToStaticMarkup(createElement(AdminDataGridActionIcon, { action, size: "md" }))));
          assert.ok(!html.includes("data-admin-media-gallery-actions") && !html.includes("absolute right-2 top-2"));
        } else {
          assert.ok(replace.includes(`>${replaceLabel}</button>`) && remove.includes(">×</button>"));
          assert.ok(!html.includes("data-admin-media-gallery-actions") && !html.includes("<svg"));
        }
      }
      function invokeActions(node: ReactNode) {
        if (!isValidElement<Record<string, unknown>>(node)) return;
        if (node.type === MediaActions && isValidElement<Parameters<typeof MediaActions>[0]>(node)) {
          invokeActions(MediaActions(node.props));
          return;
        }
        if (node.props["data-admin-media-gallery-action"] && typeof node.props.onClick === "function") node.props.onClick();
        for (const child of Children.toArray(node.props.children as ReactNode)) invokeActions(child);
      }
      for (const mode of [undefined, "bare", "card"] as const) {
        calls.length = 0;
        render(mode).forEach(invokeActions);
        assert.deepEqual(calls.sort(([a], [b]) => a.localeCompare(b)), [["remove", index], ["replace", index]], "Every presentation calls the original row-index callbacks exactly once");
      }
    }
    return true;
  })(),
);

check(
  "image position, Gallery metadata and affected Intro textarea labels adopt current shared layout owners",
  (() => {
    const single = read("src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx");
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const gallery = read("src/components/admin/media/AdminMediaGalleryField.tsx");
    return single.includes('<AdminFormGrid columns={2}>') &&
      single.includes('<AdminCard presentation="premium"') &&
      single.includes('variant="card"') &&
      single.includes('adminChoiceButtonClassName(active, "", "compact")') &&
      !single.includes('presentation="control-cards"') &&
      single.includes('name="image_position" value={imagePosition}') &&
      single.includes("ADMIN_FORM.labelStack") &&
      !single.includes('className="block space-y-1.5"') &&
      !intro.includes('className="block space-y-1.5"') &&
      (gallery.match(/<label className={ADMIN_FORM.labelStack}>/g)?.length === 2) &&
      gallery.includes('name={props.altName}') && gallery.includes('name={props.captionName}');
  })(),
);
check(
  "aligned field rows remain opt-in at AdminFormGrid and Featured preserves its existing inputs",
  (() => {
    const grid = read("src/components/admin/ui/AdminFormRuntime.tsx");
    const featured = read("src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx");
    return grid.includes('presentation = "plain"') &&
      grid.includes('presentation === "aligned-fields"') &&
      grid.includes('[&>*]:grid-rows-subgrid') &&
      grid.includes('[&>*]:space-y-0') &&
      featured.includes('<AdminFormGrid columns={3}') &&
      !featured.includes('presentation="aligned-fields"') &&
      featured.includes('name="selection_mode"') &&
      featured.includes('name="limit"') && featured.includes('max={48}') &&
      featured.includes('name="autoplay_ms"') && featured.includes('step={500}') &&
      featured.includes('defaultValue={config.autoplayMs}');
  })(),
);


check(
  "Story header opts into the canonical saved entity name while other registry headers remain unchanged",
  (() => {
    const registry = SLOT_MODULE_SLUG_METADATA["home-story"];
    for (const name of ["من نحن", "اسم جديد", "  اسم محفوظ  "]) {
      assert.equal(getModuleEditorHeaderMetadata("content", "home-story", name)?.titleAr, name.trim());
    }
    for (const name of ["", "  ", null, undefined]) {
      assert.equal(getModuleEditorHeaderMetadata("content", "home-story", name)?.titleAr, registry.labelAr);
    }
    assert.equal(getModuleEditorHeaderMetadata("content", "home-story", "من نحن")?.descriptionAr, registry.descriptionAr);
    for (const [slug, metadata] of Object.entries(SLOT_MODULE_SLUG_METADATA)) {
      if (slug === "home-story") continue;
      assert.equal(metadata.editorTitleSource, undefined, slug + " has no new adoption");
      assert.equal(getModuleEditorHeaderMetadata("content", slug, "اسم خاص")?.titleAr, metadata.labelAr, slug);
    }
    const client = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
    const page = read("src/app/admin/pages-blocks/blocks/content/[id]/page.tsx");
    const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
    return registry.editorTitleSource === "entity-name" && client.includes('entityName={block.name}') &&
      page.includes('from("content_block_templates")') && actions.includes('cleanText(formData.get("name"))');
  })(),
);
check(
  "Story description preserves inherited formatting inside the opt-in HTML editor and keeps short field controls",
  (() => {
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const editor = read("src/components/admin/AdminRichTextEditor.tsx");
    return intro.includes('? { controlMode: "visibility-only" as const }') &&
      intro.includes('legacyHtmlFormatting={fullDescriptionEditor ?') &&
      intro.includes('boldName="eyebrow_bold" alignmentName="eyebrow_alignment"') &&
      intro.includes('boldName="title_bold" alignmentName="title_alignment"') &&
      editor.includes('storageFormat === "html" ? legacyHtmlFormatting : undefined') &&
      editor.includes('defaultAlignment: legacyAlignment ?? "right"') &&
      editor.includes('name={legacyFormatting.boldName} value={legacyBold ? "true" : "false"}') &&
      editor.includes('name={legacyFormatting.alignmentName} value={legacyFormatting.alignment}') &&
      editor.includes('if (!hasUserInteractedRef.current) return;') &&
      editor.includes('if (legacyFormatting) setAdoptedLegacySource(legacySource)');
  })(),
);
check(
  "Story image actions use standard accessible icon buttons and preserve the existing alt/reorder fields",
  (() => {
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const action = read("src/components/admin/ui/AdminActionButton.tsx");
    return intro.includes('imageAlt: "النص البديل للصورة (Alt Text)"') &&
      intro.includes('title={fieldLabels.imageMain} icon={<StoryControlIcon icon="image" />}') && intro.includes('title={fieldLabels.imageSecondary} icon={<StoryControlIcon icon="image" />}') &&
      (intro.match(/onClick=\{swapHomeStoryImages\}/g)?.length === 2) &&
      intro.includes('altName="image_main_alt"') && intro.includes('altName="image_secondary_alt"') &&
      mediaOwner.includes('const selectedActions = cardPresentation ? (') &&
      mediaOwner.includes('<AdminActionButton {...remove} size="icon" variant="danger">') &&
      mediaOwner.includes('remove={allowRemove ? {') && mediaOwner.includes('onClick: () => updateValue("")') &&
      mediaOwner.includes('"aria-label": focusTargetId ? label : replaceLabel') &&
      action.includes('...accessibleAttributes') && action.includes('size-11 shrink-0 p-0');
  })(),
);


check(
  "card Media actions share canonical glyphs, preserve default icon scale, and stay inside the preview as siblings",
  (() => {
    const grid = read("src/components/admin/ui/AdminDataGrid.tsx");
    return mediaOwner.includes('import { AdminDataGridActionIcon } from "../ui/AdminDataGrid"') &&
      mediaOwner.includes('<AdminDataGridActionIcon action="restore" size="md" />') &&
      mediaOwner.includes('<AdminDataGridActionIcon action="delete" size="md" />') &&
      !mediaOwner.includes("<svg") &&
      mediaOwner.includes('absolute bottom-3 left-3 flex gap-2 rounded-2xl bg-[#080B10]/95 p-1') &&
      mediaOwner.includes('data-admin-media-image-actions') &&
      mediaOwner.includes('min-h-20 min-w-[min(100%,8rem)] max-h-[min(40vh,24rem)]') &&
      (mediaOwner.match(/\{selectedActions\}/g)?.length === 1) &&
      mediaOwner.includes('</AdminMediaPreview>\n            {selectedActions}') &&
      grid.includes('size = "sm"') &&
      grid.includes('size === "md" ? "size-4.5 shrink-0" : ADMIN_DATA_GRID_RULES.actionIcon');
  })(),
);
check(
  "all existing action glyphs retain their default markup; the opt-in scale changes only the shared size class",
  (() => {
    const source = read("src/components/admin/ui/AdminDataGrid.tsx");
    const tree = ts.createSourceFile("AdminDataGrid.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const actionType = tree.statements.find((node): node is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(node) && node.name.text === "AdminDataGridAction");
    assert.ok(actionType && ts.isUnionTypeNode(actionType.type));
    const iconNode = tree.statements.find((node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === "AdminDataGridActionIcon");
    const rules = tree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
      .find(node => node.name.getText(tree) === "ADMIN_DATA_GRID_RULES");
    assert.ok(iconNode && rules?.initializer && ts.isAsExpression(rules.initializer) && ts.isObjectLiteralExpression(rules.initializer.expression));
    const iconRule = rules.initializer.expression.properties.find(node => ts.isPropertyAssignment(node) && node.name.getText(tree) === "actionIcon");
    assert.ok(iconRule && ts.isPropertyAssignment(iconRule) && ts.isStringLiteral(iconRule.initializer));
    // Execute the actual owner function with its real scale token; no JSX or paths are copied into QA.
    const compiled = ts.transpileModule(iconNode.getText(tree), {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const ownerExports: Partial<typeof import("../src/components/admin/ui/AdminDataGrid.tsx")> = {};
    new Function("React", "exports", "ADMIN_DATA_GRID_RULES", compiled)({ createElement }, ownerExports, { actionIcon: iconRule.initializer.text });
    const AdminDataGridActionIcon = ownerExports.AdminDataGridActionIcon;
    assert.ok(AdminDataGridActionIcon);

    for (const member of actionType.type.types) {
      assert.ok(ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal));
      const action: import("../src/components/admin/ui/AdminDataGrid.tsx").AdminDataGridAction =
        member.literal.text as import("../src/components/admin/ui/AdminDataGrid.tsx").AdminDataGridAction;
      for (const isCurrentlyHidden of [false, true]) for (const active of [false, true]) {
        const props = { action, isCurrentlyHidden, active };
        const normal = renderToStaticMarkup(createElement(AdminDataGridActionIcon, props));
        assert.ok(normal.includes('class="h-4 w-4 shrink-0"'));
        assert.equal(renderToStaticMarkup(createElement(AdminDataGridActionIcon, { ...props, size: "sm" })), normal);
        const medium = renderToStaticMarkup(createElement(AdminDataGridActionIcon, { ...props, size: "md" }));
        assert.equal(medium.replace('class="size-4.5 shrink-0"', 'class="h-4 w-4 shrink-0"'), normal);
        const large = renderToStaticMarkup(createElement(AdminDataGridActionIcon, { ...props, size: "lg" }));
        assert.equal(large.replace('class="size-5.5 shrink-0"', 'class="h-4 w-4 shrink-0"'), normal);
      }
    }
    return true;
  })(),
);

check(
  "Story CTA adopts compact shared choices and unframed link actions without changing headers, defaults or field ownership",
  (() => {
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const field = read("src/components/admin/ui/AdminLinkField.tsx");
    const action = read("src/components/admin/ui/AdminActionButton.tsx");
    return intro.includes('const showCta = isHomeStory &&') &&
      intro.includes('actionPresentation={isHomeStory ? "bare" : "default"}') &&
      field.includes('actionPresentation = "default"') &&
      field.includes('import { AdminDataGridActionIcon } from "./AdminDataGrid"') &&
      field.includes('<AdminDataGridActionIcon action="copy-link" size="lg" />') &&
      field.includes('<AdminDataGridActionIcon action="delete" size="lg" />') &&
      field.includes('className="size-5"') &&
      action.includes('"gold-ghost": "border-transparent bg-transparent text-[#D8B87A] hover:bg-[#D8B87A]/10 hover:text-[#F2D99B]"') &&
      action.includes('"danger-ghost": "border-transparent bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"') &&
      action.includes('variant = "dark"') && action.includes('size = "default"') &&
      action.includes('"size-11 shrink-0 p-0"') &&
      intro.includes('<AdminFormControlHeader presentation="leading-icon" title={label} description={description} icon={<StoryControlIcon icon={illustration} />} />') &&
      intro.includes('label={<AdminFormControlHeader presentation="leading-icon" title="فتح الرابط" description="حدد كيف يتم فتح الرابط." icon={<StoryControlIcon icon="link" />} />}');
  })(),
);
check(
  "Story closure adopts shared control headers and 22px unframed link actions without changing registry-owned text or other defaults",
  (() => {
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const link = read("src/components/admin/ui/AdminLinkField.tsx");
    const tabs = read("src/components/admin/ui/AdminModuleTabs.tsx");
    const clientTree = ts.createSourceFile("ContentModuleEditClient.tsx", contentEditClient, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let storyTabs: ts.ConditionalExpression | undefined;
    let searchTabsSource = "";
    const existingTabSources = new Map<string, string>();
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(clientTree) === "homeStoryTabs" && node.initializer && ts.isConditionalExpression(node.initializer)) storyTabs = node.initializer;
      if (ts.isVariableDeclaration(node) && node.name.getText(clientTree) === "searchPlatformTabs") searchTabsSource = node.getText(clientTree);
      if (ts.isVariableDeclaration(node) && ["aboutIntroTabs", "homeTrustTabs", "homeContactTabs"].includes(node.name.getText(clientTree))) existingTabSources.set(node.name.getText(clientTree), node.getText(clientTree));
      ts.forEachChild(node, visit);
    };
    visit(clientTree);
    assert.ok(storyTabs && ts.isArrayLiteralExpression(storyTabs.whenTrue));
    const adopted: string[] = [];
    for (const tab of storyTabs.whenTrue.elements) {
      if (!ts.isObjectLiteralExpression(tab)) continue;
      const fields = Object.fromEntries(tab.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(clientTree), p.initializer]));
      if (!fields.sectionHeaderPresentation) continue;
      const value = ts.isAsExpression(fields.sectionHeaderPresentation) ? fields.sectionHeaderPresentation.expression : fields.sectionHeaderPresentation;
      assert.ok(ts.isStringLiteral(fields.id) && ts.isStringLiteral(value));
      assert.equal(value.text, "control");
      adopted.push(fields.id.text);
    }
    assert.deepEqual(adopted, ["images", "cta", "pages"]);
    // Search adds its own headers; the existing adopters retain their coverage.
    assert.ok(searchTabsSource, "Search adopts headers in its own tab composition");
    assert.equal((searchTabsSource.match(/sectionHeaderPresentation: "control"/g) ?? []).length, 2);
    for (const [name, expected] of [["aboutIntroTabs", 2], ["homeTrustTabs", 1], ["homeContactTabs", 3]] as const) {
      assert.equal((existingTabSources.get(name)?.match(/sectionHeaderPresentation: "control"/g) ?? []).length, expected, `${name} retains its existing header adoption independent of new Content families`);
    }
    for (const [id, title] of [["images", "صور قسم القصة"], ["cta", "زر قسم القصة"]]) assert.equal(getModuleEditorSectionMetadata("content", id, "home-story")?.sectionHeadingAr, title);
    assert.equal(getModuleEditorSectionMetadata("content", "text", "home-story")?.sectionHeadingAr, null);
    return intro.includes('imageMain: "الصورة الرئيسية"') && intro.includes('imageSecondary: "الصورة الثانوية"') &&
      !intro.includes('icon={1}') && !intro.includes('icon={2}') &&
      intro.includes('<AdminFormControlHeader presentation="leading-icon" title={fieldLabels.imageMain} icon={<StoryControlIcon icon="image" />} />') &&
      intro.includes('<AdminFormControlHeader presentation="leading-icon" title={fieldLabels.imageSecondary} icon={<StoryControlIcon icon="image" />} />') &&
      (intro.match(/onClick=\{swapHomeStoryImages\}/g) ?? []).length === 2 &&
      tabs.includes('tab.sectionHeaderPresentation === "control"') && tabs.includes('import { AdminFormControlHeader } from "./AdminForm"') &&
      tabs.includes('title={<span role="heading" aria-level={2}>{tab.sectionHeading}</span>}') &&
      tabs.includes('description={tab.sectionDescription}') && tabs.includes('icon={<AdminModuleTabIcon name={tab.icon ?? "section"} />}') &&
      tabs.includes('className="text-lg font-semibold leading-6 text-white sm:text-xl sm:leading-7"') &&
      link.includes('data-admin-link-actions="" className="inline-flex shrink-0 items-center gap-1"') &&
      link.includes(') : linkActions}') && link.includes('actionPresentation = "default"');
  })(),
);
check(
  "compact choice density changes only geometry and preserves selection, focus, disabled states and default classes",
  (() => {
    const source = read("src/lib/admin/admin-ui-styles.ts");
    const tree = ts.createSourceFile("admin-ui-styles.ts", source, ts.ScriptTarget.Latest, true);
    const node = tree.statements.find((entry): entry is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(entry) && entry.name?.text === "adminChoiceButtonClassName");
    assert.ok(node);
    const compiled = ts.transpileModule(node.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const ownerExports: Partial<typeof import("../src/lib/admin/admin-ui-styles.ts")> = {};
    new Function("exports", compiled)(ownerExports);
    const choice = ownerExports.adminChoiceButtonClassName;
    assert.ok(choice);
    for (const selected of [false, true]) for (const extra of ["", "test-extra"]) {
      const normal = choice(selected, extra), compact = choice(selected, extra, "compact");
      assert.equal(choice(selected, extra, "default"), normal);
      assert.equal(compact.replace("min-h-9", "min-h-11").replace("rounded-[10px]", "rounded-2xl").replace("px-3 py-1.5", "px-4 py-2"), normal);
      assert.ok(normal.includes("min-h-11") && !normal.includes("min-h-9"));
      assert.ok(compact.includes("min-h-9") && !compact.includes("min-h-11"));
      for (const classes of [normal, compact]) {
        for (const token of ["text-sm", "focus-visible:outline-2", "disabled:cursor-not-allowed", "disabled:opacity-45"]) assert.ok(classes.includes(token));
        assert.ok(classes.includes(selected ? "border-[#D8B87A]" : "hover:border-[#D8B87A]/30"));
      }
    }
    return true;
  })(),
);

check(
  "control headers opt into a single leading icon and gold divider while preserving default presentation and scale",
  (() => {
    const source = read("src/components/admin/ui/AdminForm.tsx");
    const tree = ts.createSourceFile("AdminForm.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const node = tree.statements.find((entry): entry is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(entry) && entry.name?.text === "AdminFormControlHeader");
    assert.ok(node);
    const compiled = ts.transpileModule(node.getText(tree), {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const ownerExports: Partial<typeof import("../src/components/admin/ui/AdminForm.tsx")> = {};
    new Function("React", "exports", compiled)({ createElement }, ownerExports);
    const Header = ownerExports.AdminFormControlHeader;
    assert.ok(Header);
    for (const description of [undefined, "Header description"]) for (const icon of [undefined, createElement("svg", { "data-original-glyph": "" }), 1]) {
      const props = { title: "Header title", description, icon };
      const normal = renderToStaticMarkup(createElement(Header, props));
      assert.equal(renderToStaticMarkup(createElement(Header, { ...props, presentation: "default" })), normal);
      assert.ok(normal.startsWith('<span data-admin-form-control-header="" class="flex min-w-0 items-start justify-between gap-3">'));
      assert.ok(!normal.includes("data-admin-form-control-presentation") && !normal.includes("via-[#D8B87A]/45"));
      if (icon) {
        assert.ok(normal.indexOf("Header title") < normal.indexOf('aria-hidden="true"'));
        assert.ok(normal.includes('border-white/10 bg-white/[0.045] text-white/85 [&amp;&gt;svg]:size-5'));
      }
      const leading = renderToStaticMarkup(createElement(Header, { ...props, presentation: "leading-icon" }));
      assert.ok(leading.includes('data-admin-form-control-presentation="leading-icon"'));
      assert.equal((leading.match(/data-original-glyph/g) ?? []).length, typeof icon === "object" ? 1 : 0);
      assert.equal(leading.split("via-[#D8B87A]/45").length - 1, icon ? 1 : 0);
      if (icon) assert.ok(leading.indexOf('aria-hidden="true"') < leading.indexOf("via-[#D8B87A]/45") && leading.indexOf("via-[#D8B87A]/45") < leading.indexOf("Header title"));
      for (const markup of [normal, leading]) {
        assert.ok(markup.includes('class="text-sm font-semibold text-white">Header title'));
        if (description) assert.ok(markup.includes('class="text-xs leading-5 text-white/55">Header description'));
      }
    }
    return true;
  })(),
);

check(
  "premium setting groups compose the real shared surface, header and native control owners without duplicate chrome or field drift",
  await (async () => {
    const [{ default: Card }, { AdminFormControlHeader: Header }, { AdminFormGrid: Grid }, { default: Select }, { default: Checkbox }, { default: Switch }, styles] = await Promise.all([
      jiti.import<typeof import("../src/components/admin/ui/AdminCard.tsx")>("../src/components/admin/ui/AdminCard.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminForm.tsx")>("../src/components/admin/ui/AdminForm.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminFormRuntime.tsx")>("../src/components/admin/ui/AdminFormRuntime.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminFormListboxSelect.tsx")>("../src/components/admin/ui/AdminFormListboxSelect.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminCheckbox.tsx")>("../src/components/admin/ui/AdminCheckbox.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminFormSwitch.tsx")>("../src/components/admin/ui/AdminFormSwitch.tsx"),
      jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
    ]);
    const selectProps = {
      id: "composition-scope", name: "composition_scope", defaultValue: "all", sizing: "full" as const,
      options: [{ value: "all", label: "كل الخيارات" }, { value: "selected", label: "اختيارات محددة" }],
    };
    const checkboxProps = { name: "composition_choices", label: "الخيار الأول", value: "first", defaultChecked: true };
    const switchProps = { name: "composition_enabled", defaultChecked: true, uncheckedValue: "false", value: "true" };
    const selectHeader = createElement(Header, { title: "نطاق الإعداد", description: "اختر نطاقًا.", presentation: "leading-icon", icon: createElement("svg", { "data-composition-icon": "" }) });
    const choicesHeader = createElement(Header, { title: createElement("span", { id: "composition-choices-title" }, "خيارات المجموعة"), description: "يمكن تحديد أكثر من خيار.", presentation: "leading-icon" });
    const switchHeader = createElement(Header, { title: "إظهار المجموعة", description: createElement("span", { id: "composition-switch-description", "aria-hidden": true }, "تحكم في ظهور المجموعة."), presentation: "leading-icon" });
    const cardProps = { presentation: "premium", className: "h-full p-3", children: null } satisfies Parameters<typeof Card>[0];
    const gridProps = { columns: 3, children: null } satisfies Parameters<typeof Grid>[0];
    const groups = [
      createElement(Card, { ...cardProps, key: "scope" }, createElement(Select, { ...selectProps, label: selectHeader })),
      createElement(Card, { ...cardProps, key: "choices" }, createElement("fieldset", { "aria-labelledby": "composition-choices-title" }, choicesHeader, createElement(Grid, { ...gridProps, columns: 2 }, [
        createElement("label", { key: "first" }, createElement(Checkbox, checkboxProps), "الخيار الأول"),
        createElement("label", { key: "second" }, createElement(Checkbox, { ...checkboxProps, label: "الخيار الثاني", value: "second", defaultChecked: false }), "الخيار الثاني"),
      ]))),
      createElement(Card, { ...cardProps, key: "visibility" }, createElement(Switch, { ...switchProps, embedded: true, label: switchHeader, describedBy: "composition-switch-description" })),
    ];
    const html = renderToStaticMarkup(createElement("form", { dir: "rtl" }, createElement(Grid, gridProps, groups)));
    assert.equal((html.match(/<section\b/gu) ?? []).length, 3, "Each functional group has one premium surface, not a nested replacement surface");
    assert.equal(html.split(styles.ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME).length - 1, 3);
    assert.equal((html.match(/data-admin-form-control-header=""/gu) ?? []).length, 3, "Exactly one shared header labels each group");
    for (const title of ["نطاق الإعداد", "خيارات المجموعة", "إظهار المجموعة"]) assert.equal(html.split(title).length - 1, 1);
    assert.equal((html.match(/data-composition-icon=""/gu) ?? []).length, 1, "Optional decoration remains optional and is not duplicated");
    assert.equal((html.match(/data-admin-form-grid="plain"/gu) ?? []).length, 2, "A grouped choice may use the same nested grid owner");
    assert.ok(html.includes("grid-cols-1 md:grid-cols-2 xl:grid-cols-3") && html.includes('dir="rtl"'));
    assert.ok(html.includes('aria-labelledby="composition-scope-label"') && html.includes('id="composition-scope-label"'));
    assert.ok(html.includes('aria-labelledby="composition-choices-title"') && html.includes('id="composition-choices-title"'));
    assert.ok(html.includes('aria-describedby="composition-switch-description"') && html.includes('id="composition-switch-description"'));
    assert.ok(html.includes('data-admin-form-switch-surface="embedded"') && !html.includes('data-admin-form-switch-surface="compact"'));
    assert.equal((html.match(/<label\b/gu) ?? []).length, 3, "Only the two checkbox labels and the native switch label are rendered");
    const nativeSelect = html.match(/<select\b[^>]*>[\s\S]*?<\/select>/u)?.[0];
    assert.ok(nativeSelect?.includes('name="composition_scope"') && nativeSelect.includes('value="all" selected=""'));
    const selectAlone = renderToStaticMarkup(createElement(Select, { ...selectProps, label: "نطاق الإعداد" }));
    assert.equal(nativeSelect, selectAlone.match(/<select\b[^>]*>[\s\S]*?<\/select>/u)?.[0], "Premium headers cannot change the original native Select payload");
    const inputs = Array.from(html.matchAll(/<input\b[^>]*>/gu), match => match[0]);
    assert.equal(inputs.length, 4, "Two choices plus the original switch fallback/checkbox remain the complete input set");
    const standaloneCheckbox = renderToStaticMarkup(createElement(Checkbox, checkboxProps)).match(/<input\b[^>]*>/u)?.[0];
    assert.equal(inputs[0], standaloneCheckbox, "Grouping does not change Checkbox scale, name, selected value or semantics");
    assert.ok(inputs[1].includes('value="second"') && !inputs[1].includes('checked=""'));
    assert.ok(inputs[2].includes('type="hidden"') && inputs[2].includes('name="composition_enabled"') && inputs[2].includes('value="false"'));
    assert.ok(inputs[3].includes('role="switch"') && inputs[3].includes('name="composition_enabled"') && inputs[3].includes('value="true"') && inputs[3].includes('checked=""'));
    assert.equal(html.split('class="relative inline-flex h-5 w-9 shrink-0"').length - 1, 1, "The containing card never enlarges the shared switch track");
    assert.equal(html.includes('grid-cols-['), false, "The composition adds no private column geometry");
    return true;
  })(),
);

check(
  "Story and opt-in About text/image cards share presentation while legacy About defaults remain unchanged",
  (() => {
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const storyImages = intro.split('{isHomeStory ? (')[1]?.split(') : (')[0] ?? "";
    const editor = read("src/components/admin/AdminRichTextEditor.tsx");
    return (intro.match(/presentation=\{premium \? "premium" : "card"\}/g)?.length === 4) &&
      intro.includes('toolbarMode={fullDescriptionEditor ? "full" : "none"}') &&
      intro.includes('minHeight={fullDescriptionEditor ? undefined : 72}') &&
      intro.includes('enableArticleStructure={fullDescriptionEditor}') &&
      intro.includes('enableTextAlign={fullDescriptionEditor}') &&
      intro.includes('showLabel={!fullDescriptionEditor}') &&
      (storyImages.match(/variant="card"/g)?.length === 2) &&
      storyImages.includes('<AdminFormGrid columns={2}>') &&
      (storyImages.match(/<AdminCard presentation="premium"/g)?.length === 2) &&
      editor.includes('storageFormat = "html"') && editor.includes('showLabel = true') &&
      presentation.includes('presentation = "card"') &&
      presentation.includes('if (presentation === "premium")') &&
      presentation.includes('<AdminFormControlHeader title={label} description={description} icon={icon} presentation="compact-inline" />');
  })(),
);
check(
  "Story rich HTML adopts canonical heading semantics and paragraph alignment without altering renderer defaults",
  (() => {
    const story = read("src/components/home/HomeStorySection.tsx");
    const renderer = read("src/components/content/RichTextContent.tsx");
    return story.includes('mode="rich"') && story.includes('demoteHeadings') &&
      story.includes('pageBlockTextAlignClass(descriptionFormat.alignment, "container")') &&
      story.includes('article-rich-text') &&
      renderer.includes('demoteHeadings = false') &&
      renderer.includes('demoteHeadings ? demoteArticleHeadingHierarchy(html) : html') &&
      renderer.includes('const html = renderRichTextHtml(raw)');
  })(),
);

check(
  "Story page visibility opts into the shared assignment/grid/header owners without changing other consumers",
  (() => {
    // The approved Search family adds one assignment opt-in; all four prior
    // adopters remain protected by the exact total and their own tab contracts.
    assert.equal((contentEditClient.match(/assignmentContext=\{assignmentContext\} presentation="premium"/g) ?? []).length, 5);
    assert.ok(assignmentField.includes('presentation = "default"') && read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx").includes('presentation?: "default" | "premium"'));
    for (const owner of ["AdminFormGrid", "AdminCard", "AdminFormControlHeader", "AdminToneBadge", "AdminCheckbox", "AdminModuleTabIcon"]) assert.ok(assignmentField.includes(owner));
    assert.ok(assignmentField.includes('<AdminFormGrid columns={2}>'));
    assert.ok(assignmentField.includes('group.pages.filter((page) => selectedSet.has(page.id)).length'));
    assert.equal((assignmentField.match(/useState</g) ?? []).length, 1, "Counts must derive from selection, not a second state");
    assert.ok(assignmentField.includes('checked={premium ? selectedSet.has(page.id) : undefined}'));
    assert.ok(assignmentField.includes('defaultChecked={premium ? undefined : assignedSet.has(page.id)}'));
    assert.ok(assignmentField.includes('name="page_ids"') && assignmentField.includes('assignedSet.has(page.id) ? ('));
    assert.ok(assignmentField.includes('"/admin/pages-blocks/pages/" + page.id'));
    assert.ok(!assignmentField.includes("onClick=") && !assignmentField.includes('type="checkbox"'));
    assert.ok(assignmentField.includes('form?.addEventListener("reset", reset)'));
    assert.equal(getModuleEditorSectionMetadata("content", "pages", "home-story")?.sectionDescriptionAr, "حدد الصفحات التي يظهر بها الموديول.");
    for (const slug of ["home-projects", "vision-goals"]) {
      assert.equal(getModuleEditorSectionMetadata("content", "pages", slug)?.sectionDescriptionAr, null);
    }
    const tree = ts.createSourceFile("assignments.tsx", assignmentField, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const functions = tree.statements.filter((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && ["pagePathSegments", "groupPages"].includes(n.name?.text ?? ""));
    assert.equal(functions.length, 2);
    const group = new Function(ts.transpileModule(functions.map(n => n.getText(tree)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn groupPages;") as () => (pages: { id: number; title: string; path: string }[]) => { primaryPages: {id: number}[]; familyPages: {id: number}[] };
    const pages = ["/", "/about", "/media-center/news", "/media-center", "/media-center/gallery?sort=asc", "/projects"].map((path, i) => ({ id: i + 1, title: path, path }));
    const grouped = group()(pages);
    assert.deepEqual(grouped.primaryPages.map(p => p.id), [1, 2, 6]);
    assert.deepEqual(grouped.familyPages.map(p => p.id), [4, 3, 5]);
    assert.deepEqual(group()([]), { primaryPages: [], familyPages: [] });
    return true;
  })(),
);

check(
  "About Intro adopts four flat tabs with retained inactive fields, shared premium cards and fixed media roles",
  (() => {
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const tabs = read("src/components/admin/ui/AdminModuleTabs.tsx");
    const tree = ts.createSourceFile("ContentModuleEditClient.tsx", contentEditClient, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let aboutTabs: ts.ConditionalExpression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "aboutIntroTabs" && node.initializer && ts.isConditionalExpression(node.initializer)) aboutTabs = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.ok(aboutTabs && ts.isArrayLiteralExpression(aboutTabs.whenTrue));
    const value = aboutTabs.whenTrue.getText(tree);
    assert.ok(value.includes('["text", "images", "cards"] as const') && value.includes('id: "pages"'));
    assert.ok(value.includes('editorMode="about-intro" section={section} presentation="premium"'));
    assert.ok(value.includes('<ModuleEditorPagesTab') && value.includes('assignmentContext={assignmentContext} presentation="premium"'));
    assert.ok(contentEditClient.includes('nowrap tabs={aboutIntroTabs} activePanelContext={activePanelContext}'));
    assert.ok(contentEditClient.includes('{usesAboutIntroConfig ? <input type="hidden" name="config_schema" value="about-intro" /> : null}'));
    assert.ok(contentEditClient.includes('{isHomeStory ? <input type="hidden" name="include_story_cta" value="1" /> : null}'));
    assert.ok(tabs.includes('hidden={tab.id !== activeId}') && tabs.includes('{tab.content}'));
    for (const [id, label] of [["text", "النصوص"], ["images", "الصور"], ["cards", "البطاقات"], ["pages", "الظهور"]]) {
      assert.equal(getModuleEditorSectionMetadata("content", id, "about-intro")?.navigationLabelAr, label);
    }
    assert.equal(getModuleEditorSectionMetadata("content", "pages", "about-intro")?.sectionDescriptionAr, "حدد الصفحات التي يظهر بها الموديول.");
    assert.ok(intro.includes('presentation = "default"') && intro.includes('const premium = isHomeStory || presentation === "premium"'));
    assert.ok(intro.includes('(section === "all" || section === "cards")'));
    assert.ok(intro.includes('ModuleEditorRepeaterGrid presentation={presentation}'));
    assert.ok(intro.includes('rows={3}') && intro.includes('name={`beat_${index}_text`}'));
    assert.ok(intro.includes('.slice(0, 3)') && intro.includes('while (rows.length < 3)'));
    assert.ok(intro.includes('toolbarMode={fullDescriptionEditor ? "full" : "none"}') && intro.includes('enableArticleStructure={fullDescriptionEditor}'));
    const mediaFields = intro.slice(intro.indexOf('const aboutImageFields'), intro.indexOf('  return (\n    <div className={isHomeStory'));
    for (const key of ["main", "secondary", "accent"]) assert.ok(mediaFields.includes('key: "' + key + '"'));
    assert.ok(mediaFields.includes('name={"image_" + slot.key}') && mediaFields.includes('altName={"image_" + slot.key + "_alt"}'));
    assert.ok(mediaFields.includes('variant={premium ? "card" : "default"}') && mediaFields.includes('browseFolder="images/about"'));
    assert.ok(!mediaFields.includes('onClick=') && !mediaFields.includes('useState') && !mediaFields.includes('AdminFormSwitch'));
    assert.ok(presentation.includes('<AdminFormGrid columns={columns} className={className}>{children}</AdminFormGrid>'));
    assert.ok(presentation.includes('className={`min-w-0 space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4 ${className}`.trim()}'));
    return true;
  })(),
);


check(
  "Functional tab names have one metadata source without renaming distinct functions or navigation IDs",
  (() => {
    assert.deepEqual(MODULE_EDITOR_TAB_LABELS, { text: "النصوص", images: "الصور", cards: "البطاقات", visibility: "الظهور", cta: "الزر والرابط" });
    const functions: Partial<Record<string, keyof typeof MODULE_EDITOR_TAB_LABELS>> = { text: "text", images: "images", image: "images", media: "images", cards: "cards", cta: "cta" };
    for (const owner of [...Object.values(MODULE_KIND_METADATA), ...Object.values(SLOT_MODULE_SLUG_METADATA)]) {
      for (const [id, section] of Object.entries(owner.editorSections ?? {})) {
        if (section.operationalRole === "visibility") assert.equal(section.navigationLabelAr, MODULE_EDITOR_TAB_LABELS.visibility);
        const functional = functions[id];
        if (functional) assert.equal(section.navigationLabelAr, MODULE_EDITOR_TAB_LABELS[functional]);
      }
    }
    assert.equal(getModuleEditorSectionMetadata("hero", "buttons")?.navigationLabelAr, MODULE_EDITOR_TAB_LABELS.cta);
    assert.equal(getModuleEditorSectionMetadata("hero", "buttons", "projects-hub-hero")?.navigationLabelAr, "زر التفاصيل");
    assert.equal(getModuleEditorSectionMetadata("content", "content", "vision-goals")?.navigationLabelAr, MODULE_EDITOR_TAB_LABELS.text);
    assert.equal(getModuleEditorSectionMetadata("featured", "content")?.navigationLabelAr, "مصدر المحتوى");
    for (const label of Object.values(MODULE_EDITOR_TAB_LABELS)) {
      assert.equal(compatibilityPresentation.split('"' + label + '"').length - 1, 1, label + " is declared once in metadata");
    }
    assert.ok(!/navigationLabelAr:\s*"(النص|الصورة|الصفحات|الأزرار)"/.test(compatibilityPresentation));
    for (const id of ["text", "images", "cards", "pages"]) {
      assert.equal(resolveModuleEditorTabId(id, ["text", "images", "cards", "pages"]), id);
    }
    return true;
  })(),
);

check(
  "About Intro opts into the shared full HTML editor and safe public hierarchy without changing storage or card descriptions",
  (() => {
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const section = read("src/components/modules/WhoWeAreModuleSection.tsx");
    assert.ok(intro.includes('descriptionToolbar = "limited"') && intro.includes('const fullDescriptionEditor = isHomeStory || descriptionToolbar === "full"'));
    assert.equal((contentEditClient.match(/descriptionToolbar="full"/g) ?? []).length, 1);
    assert.ok(contentEditClient.includes('editorMode="about-intro" section={section} presentation="premium" descriptionToolbar="full"'));
    assert.ok(intro.includes('legacyHtmlFormatting={fullDescriptionEditor ?') && intro.includes('enableTextAlign={fullDescriptionEditor}'));
    assert.equal((intro.match(/<AdminRichTextEditor/g) ?? []).length, 1);
    assert.ok(intro.includes('name={`beat_${index}_text`}') && intro.includes('rows={3}'));
    assert.ok(section.includes('mode="rich"') && section.includes("demoteHeadings") && section.includes("article-rich-text"));
    assert.ok(section.includes('pageBlockTextAlignClass(descriptionFormat.alignment, "container")'));
    assert.ok(!section.includes("dangerouslySetInnerHTML"));
    return true;
  })(),
);


check(
  "Shared grid adds six columns without coupling card count to layout; Home Trust opts into two columns",
  (() => {
    const tree = ts.createSourceFile("AdminFormRuntime.tsx", adminFormGridOwner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const node = tree.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === "AdminFormGrid");
    assert.ok(node);
    const output = ts.transpileModule(node.getText(tree).replace(/^export /, ""), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
    const grid = new Function("React", output + "\nreturn AdminFormGrid;")({ createElement }) as (props: Record<string, unknown>) => { props: { className: string; children: unknown } };
    for (const [columns, classes] of [
      [1, "grid-cols-1"], [2, "grid-cols-1 md:grid-cols-2"], [3, "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"],
      [4, "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"], [5, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"],
      [6, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"], [12, "grid-cols-1 xl:grid-cols-12"],
    ] as const) {
      const result = grid({ columns, children: ["one", "two", "three", "four"] });
      assert.equal(result.props.className, "grid min-w-0 gap-4 [&>*]:min-w-0 " + classes);
      assert.deepEqual(result.props.children, ["one", "two", "three", "four"], "Layout must not pad or truncate cards");
    }
    for (const children of [["one"], ["one", "two", "three"]]) {
      assert.deepEqual(grid({ columns: 2, children }).props.children, children, "Odd field counts remain intact without placeholder cards or forced balancing");
    }
    assert.equal(grid({}).props.className, grid({ columns: 2 }).props.className);
    assert.ok(grid({ columns: 3, presentation: "aligned-fields" }).props.className.includes("grid-cols-1 md:grid-cols-3"));
    const editor = read("src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx");
    assert.ok(editor.includes('<ModuleEditorRepeaterGrid columns={isHomeTrust ? 2 : 3} presentation="premium">'));
    assert.ok(editor.includes('.slice(0, 4)') && editor.includes('while (rows.length < 4)'));
    assert.ok(presentation.includes('<AdminFormGrid columns={columns} className={className}>{children}</AdminFormGrid>'));
    assert.ok(!editor.includes("grid-cols-") && !editor.includes('name="columns"'));
    return true;
  })(),
);


check(
  "Home Trust preserves flat tabs, full HTML, premium cards and assignments while Principles shares the approved presentation",
  (() => {
    const tree = ts.createSourceFile("ContentModuleEditClient.tsx", contentEditClient, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let tabs: ts.ConditionalExpression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "homeTrustTabs" && node.initializer && ts.isConditionalExpression(node.initializer)) tabs = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.ok(tabs && ts.isArrayLiteralExpression(tabs.whenTrue));
    const entries = tabs.whenTrue.elements.map(node => {
      assert.ok(ts.isObjectLiteralExpression(node));
      return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(tree), p.initializer.getText(tree)]));
    });
    assert.deepEqual(entries.map(e => e.id), ['"content"', '"cards"', '"pages"'], "Retain content/pages IDs; no empty images tab");
    assert.ok(entries[0].content.includes('editorMode="home-trust" section="text"'));
    assert.ok(entries[1].content.includes('editorMode="home-trust" section="cards"'));
    assert.ok(entries[2].content.includes('ModuleEditorPagesTab') && entries[2].content.includes('presentation="premium"'));
    assert.equal(entries[2].sectionHeaderPresentation, '"control" as const');
    assert.ok(contentEditClient.includes('tabs={homeTrustTabs} activePanelContext={activePanelContext}'));
    assert.equal((contentEditClient.match(/editorMode="home-trust"/g) ?? []).length, 2);
    for (const [id, label] of [["content", MODULE_EDITOR_TAB_LABELS.text], ["cards", MODULE_EDITOR_TAB_LABELS.cards], ["pages", MODULE_EDITOR_TAB_LABELS.visibility]]) {
      assert.equal(getModuleEditorSectionMetadata("content", id, "home-trust")?.navigationLabelAr, label);
      assert.equal(resolveModuleEditorTabId(id, ["content", "cards", "pages"]), id);
    }
    assert.equal(getModuleEditorSectionMetadata("content", "pages", "home-trust")?.sectionDescriptionAr, "حدد الصفحات التي يظهر بها الموديول.");
    const editor = read("src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx");
    assert.ok(editor.includes('section = "all"') && editor.includes('editorMode = "about-principles"'));
    assert.ok(editor.includes('isHomeTrust && showText ? <input type="hidden" name="include_home_trust_intro"'));
    assert.ok(editor.includes('{showCards ? <input type="hidden" name="principle_count"'));
    assert.equal((editor.match(/<AdminRichTextEditor/g) ?? []).length, 1);
    assert.ok(editor.includes('name="principles_intro"') && editor.includes('defaultValue={config.description ?? ""}'));
    assert.ok(editor.includes('toolbarMode="full"') && editor.includes('enableArticleStructure') && editor.includes('enableTextAlign'));
    assert.ok(editor.includes('controlMode="visibility-only"') && editor.includes('legacyHtmlFormatting={{ boldName: "description_bold"'));
    assert.ok(editor.includes('alignmentName: "description_alignment", alignment: descriptionFormat.alignment'));
    assert.ok(!editor.includes('storageFormat=') && !editor.includes('enableH1') && !editor.includes('dangerouslySetInnerHTML'));
    assert.ok(editor.includes('presentation="premium"') && editor.includes('icon={isHomeTrust ? <AdminModuleTabIcon'));
    assert.equal((editor.match(/<textarea/g) ?? []).length, 1);
    assert.ok(editor.includes('onChange={(event) => updateItem(index, { description: event.target.value })}') && editor.includes('rows={3}'));
    assert.ok(editor.includes('actions={!isHomeTrust ? (') && editor.includes('if (items.length >= 6) return;'));
    assert.ok(editor.includes('variant="card"') && editor.includes('contentModuleMediaSlot("home-trust")'));
    assert.ok(editor.includes('altName=') && editor.includes('_image_alt'));
    const section = read("src/components/home/HomeTrustSection.tsx");
    assert.ok(section.includes('mode="rich"') && section.includes("demoteHeadings") && section.includes("article-rich-text home-trust-intro"));
    assert.ok(section.includes("resolved.formatting.description?.visible") && !section.includes("dangerouslySetInnerHTML"));
    return true;
  })(),
);


check(
  "Home Contact opts into shared premium presentation while preserving fixed contact slots, flat tab IDs and plain text storage",
  (() => {
    const tree = ts.createSourceFile("ContentModuleEditClient.tsx", contentEditClient, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let tabs: ts.ConditionalExpression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "homeContactTabs" && node.initializer && ts.isConditionalExpression(node.initializer)) tabs = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.ok(tabs && ts.isArrayLiteralExpression(tabs.whenTrue));
    const entries = tabs.whenTrue.elements.map(node => {
      assert.ok(ts.isObjectLiteralExpression(node));
      return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(tree), p.initializer.getText(tree)]));
    });
    assert.deepEqual(entries.map(e => e.id), ['"text"', '"image"', '"cta"', '"contacts"', '"pages"']);
    for (const [i, section] of ["text", "image", "cta", "contacts"].entries()) assert.ok(entries[i].content.includes('editorMode="home-contact" section="' + section + '"'));
    for (const i of [2,3,4]) assert.equal(entries[i].sectionHeaderPresentation, '"control" as const');
    assert.ok(entries[4].content.includes('ModuleEditorPagesTab') && entries[4].content.includes('presentation="premium"'));
    for (const [id, key] of [["text","text"],["image","images"],["cta","cta"],["contacts","cards"],["pages","visibility"]] as const) assert.equal(getModuleEditorSectionMetadata("content", id, "home-contact")?.navigationLabelAr, MODULE_EDITOR_TAB_LABELS[key]);
    assert.equal(getModuleEditorSectionMetadata("content", "contacts", "about-cta")?.navigationLabelAr, "وسائل التواصل");
    assert.equal(getModuleEditorSectionMetadata("content", "pages", "home-contact")?.sectionDescriptionAr, "حدد الصفحات التي يظهر بها الموديول.");
    const editor = read("src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx");
    assert.ok(editor.includes('editorMode = "about-cta"') && editor.includes('const CONTACT_SLOTS = 4'));
    assert.ok(editor.includes('Array.from({ length: CONTACT_SLOTS }') && editor.includes('key={row.uid}'));
    assert.equal((editor.match(/<textarea/g) ?? []).length, 2);
    assert.ok(editor.includes('name="description"') && !editor.includes("AdminRichTextEditor"));
    assert.ok(editor.includes('columns={isHomeContact ? 2 : 3} presentation="premium"'));
    assert.ok(editor.includes('variant="card"') && editor.includes('altName="image_alt"'));
    assert.equal((editor.match(/actionPresentation="bare"/g) ?? []).length, 2);
    assert.ok(editor.includes('const ReorderButton = AdminActionButton'));
    assert.ok(editor.includes('onClick={() => moveRow(index, -1)}') && editor.includes('onClick={() => moveRow(index, 1)}'));
    assert.ok(editor.includes('row.icon === "whatsapp"') && editor.includes('_secondary_value'));
    assert.ok(!editor.includes("addRow") && !editor.includes("removeRow") && !editor.includes("grid-cols-"));
    const publicSection = read("src/components/home/HomeContactSection.tsx");
    assert.ok(publicSection.includes('{resolved.description}</p>') && !publicSection.includes("RichTextContent"));
    assert.ok(!publicSection.includes("dangerouslySetInnerHTML"));
    return true;
  })(),
);


check(
  "Active Media Hub modes and Topics listings opt into shared premium presentation while shared defaults and retired exclusions remain stable",
  (() => {
    const collection = read("src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx");
    const topics = read("src/components/admin/page-blocks/editors/TopicsListingModuleEditor.tsx");
    const listing = mediaHubEditor.slice(mediaHubEditor.indexOf("function ListingPresentationFields"), mediaHubEditor.indexOf("export default function"));
    assert.ok(listing.includes('surfacePresentation="premium"'));
    assert.equal((mediaHubEditor.match(/sectionHeaderPresentation: isListing \|\| isActiveHub \? "control" : undefined/g) ?? []).length, 2);
    assert.ok(mediaHubEditor.includes('const isActiveHub = !isListing && sectionKey !== "featured"'));
    assert.ok(mediaHubEditor.includes('presentation={isListing || isActiveHub ? "premium" : "default"}'));
    assert.ok(collection.includes('surfacePresentation?: "default" | "premium"'));
    assert.equal((collection.match(/surfacePresentation = "default"/g) ?? []).length, 2);
    assert.equal((collection.match(/const Section = premium \? AdminCard : ModuleEditorSection/g) ?? []).length, 2);
    assert.ok(collection.includes('<AdminFormGrid columns={3} className="mt-4">{cards}</AdminFormGrid> : cards'));
    assert.ok(collection.includes('const ControlCard = premium ? AdminCard : "div"'));
    assert.equal((collection.match(/presentation=\{premium \? "premium" : "card"\}/g) ?? []).length, 7);
    assert.equal((collection.match(/<ModuleEditorVisibilityAlignRow/g) ?? []).length, 7);
    assert.ok(collection.includes('controlMode="visibility-only"'));
    assert.ok(collection.includes('surfacePresentation={surfacePresentation}'));
    assert.ok(topics.includes('surfacePresentation="premium"'));
    assert.ok(!mediaHubEditor.includes(".module.css") && !collection.includes(".module.css"));
    assert.ok(!mediaHubEditor.includes("AdminRichTextEditor") && !collection.includes("AdminRichTextEditor"));
    return true;
  })(),
);


check(
  "News Listing splits configuration and display through shared owners while preserving existing tab IDs and other consumers",
  (() => {
    const slug = "media-listing-presentation-news";
    for (const [id, label] of [["content", "إعدادات القائمة"], ["presentation", "إعدادات العرض"], ["pages", "الظهور"]]) {
      assert.equal(getModuleEditorSectionMetadata("media-hub", id, slug)?.navigationLabelAr, label);
      assert.equal(resolveModuleEditorTabId(id, ["content", "presentation", "pages"]), id);
    }
    assert.equal(resolveModuleEditorTabId("unknown", ["content", "presentation", "pages"]), "content");
    const sections = SLOT_MODULE_SLUG_METADATA[slug].editorSections!;
    assert.deepEqual({ ...sections.content, navigationLabelAr: "المحتوى" }, MODULE_KIND_METADATA["media-hub"].editorSections.content);
    assert.deepEqual({ ...sections.presentation, navigationLabelAr: "العرض" }, MODULE_KIND_METADATA["media-hub"].editorSections.presentation);
    for (const otherSlug of ["media-listing-presentation-videos", "media-listing-presentation-gallery", "media-listing-presentation-press", "media-listing-presentation-site-updates"]) {
      assert.equal(SLOT_MODULE_SLUG_METADATA[otherSlug]?.editorSections, undefined);
      assert.equal(getModuleEditorSectionMetadata("media-hub", "content", otherSlug)?.navigationLabelAr, "المحتوى");
      assert.equal(getModuleEditorSectionMetadata("media-hub", "pages", otherSlug)?.navigationLabelAr, "الظهور");
    }
    const collection = read("src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx");
    const topics = read("src/components/admin/page-blocks/editors/TopicsListingModuleEditor.tsx");
    assert.ok(collection.includes('section?: "all" | "configuration"'));
    assert.ok(collection.includes('section = "all"') && collection.includes('section === "all"'));
    assert.equal((collection.match(/<CollectionModuleDisplayFormattingFields/g) ?? []).length, 1);
    assert.ok(topics.includes('section={section}') && topics.includes('section = "all"'));
    assert.ok(topics.includes('<CollectionModuleDisplayFormattingFields display={config.display} surfacePresentation="premium" />'));
    assert.ok(mediaHubEditor.includes('getSlotModuleSlugMetadata(block.slug)?.editorSections?.presentation'));
    assert.ok(mediaHubEditor.includes('moduleSlug={splitListingTabs ? block.slug : undefined}'));
    assert.ok(mediaHubEditor.includes('section={splitListingTabs ? "configuration" : "all"}'));
    assert.ok(mediaHubEditor.includes('display={parsedInitial.listing.display}'));
    assert.equal((mediaHubEditor.match(/<ModuleEditorTabs/g) ?? []).length, 1);
    // Split composition delegates the configuration header to ModuleEditorTabs.
    // The implicit display section retains its existing internal header.
    assert.match(collection, /section === "all" \? \(\s*premium \? \([\s\S]*?<AdminFormControlHeader title="إعدادات القائمة"[\s\S]*?<ModuleEditorSectionHeading intent="settings">إعدادات القائمة<\/ModuleEditorSectionHeading>\s*\)\s*\) : null/);
    assert.ok(collection.includes('heading = "إعدادات العرض"'));
    assert.ok(collection.includes('<AdminFormControlHeader title={heading} icon={<AdminModuleTabIcon name="settings" />} presentation="leading-icon" />'));
    assert.equal(sections.content.sectionHeadingAr, MODULE_KIND_METADATA["media-hub"].editorSections.content.sectionHeadingAr);
    assert.equal(sections.content.sectionDescriptionAr, MODULE_KIND_METADATA["media-hub"].editorSections.content.sectionDescriptionAr);
    assert.equal(sections.content.icon, MODULE_KIND_METADATA["media-hub"].editorSections.content.icon);
    assert.equal(sections.presentation.sectionHeadingAr, null);
    assert.equal(sections.presentation.sectionChrome, "implicit");
    return true;
  })(),
);

check(
  "Featured family adopts four functional tabs and canonical Premium controls across source slugs",
  (() => {
    const editor = read("src/components/admin/page-blocks/FeaturedModuleEditClient.tsx");
    for (const slug of [undefined, "media-featured-content-news", "media-featured-content-videos", "media-featured-content-press", "media-featured-content-gallery", "category-featured-fixture"]) {
      for (const [id, label] of [["content", "مصدر المحتوى"], ["text", MODULE_EDITOR_TAB_LABELS.text], ["presentation", "تنسيق عناصر المحتوى"], ["pages", MODULE_EDITOR_TAB_LABELS.visibility]]) {
        assert.equal(getModuleEditorSectionMetadata("featured", id, slug)?.navigationLabelAr, label);
        assert.equal(resolveModuleEditorTabId(id, ["content", "text", "presentation", "pages"]), id);
      }
    }
    assert.ok(editor.includes('moduleSlug={block.slug}'));
    assert.ok(!editor.includes("getSlotModuleSlugMetadata"), "Family adoption must not depend on a News-only slug gate");
    assert.equal((editor.match(/<ModuleEditorTabs/g) ?? []).length, 1);
    assert.equal((editor.match(/<ModuleEditorVisibilityAlignRow/g) ?? []).length, 10);
    assert.equal((editor.match(/controlMode="visibility-only"/g) ?? []).length, 1);
    assert.ok(editor.includes('<ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} presentation="premium"'));
    assert.ok(!editor.includes("AdminRichTextEditor") && !editor.includes(".module.css"));
    return true;
  })(),
);

check(
  "Breadcrumb and Featured preserve functional containment rather than merely importing Premium components",
  (() => {
    const inspect = (source: string) => {
      const tree = ts.createSourceFile("composition.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const elements: (ts.JsxElement | ts.JsxSelfClosingElement)[] = [];
      const variables = new Map<string, ts.Expression>();
      const tabs = new Map<string, ts.Expression>();
      const visit = (node: ts.Node) => {
        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer);
        if (ts.isObjectLiteralExpression(node)) {
          const properties = node.properties.filter((n): n is ts.PropertyAssignment => ts.isPropertyAssignment(n));
          const id = properties.find(n => n.name.getText(tree) === "id")?.initializer;
          const content = properties.find(n => n.name.getText(tree) === "content")?.initializer;
          if (id && ts.isStringLiteral(id) && content) tabs.set(id.text, content);
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
      const tag = (node: typeof elements[number]) => (ts.isJsxElement(node) ? node.openingElement : node).tagName.getText(tree);
      const attribute = (node: typeof elements[number], name: string) => {
        const opening = ts.isJsxElement(node) ? node.openingElement : node;
        return opening.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(tree) === name)?.initializer;
      };
      const literal = (node: ts.Node | undefined, value: string) => !!node && ts.isStringLiteral(node) && node.text === value;
      const contains = (outer: ts.Node, inner: ts.Node) => inner.pos > outer.pos && inner.end < outer.end;
      const within = (outer: ts.Node, name: string) => elements.filter(n => contains(outer, n) && tag(n) === name);
      const named = (name: string) => elements.find(n => literal(attribute(n, "name"), name));
      return { tree, elements, variables, tabs, tag, attribute, literal, contains, within, named };
    };
    const breadcrumbComposition = (source: string) => {
      const x = inspect(source);
      const content = x.tabs.get("content");
      if (!content) return false;
      const cards = x.within(content, "AdminCard");
      if (cards.length !== 3 || cards.some(c => !x.literal(x.attribute(c, "presentation"), "premium"))) return false;
      const controlOwners = ["source", "current_label_override", "show_home"].map(name => {
        const control = x.named(name);
        return control ? cards.filter(c => x.contains(c, control)) : [];
      });
      if (controlOwners.some(owners => owners.length !== 1) || new Set(controlOwners.map(owners => owners[0])).size !== 3) return false;
      const manual = x.within(content, "BreadcrumbManualItemsField");
      return manual.length === 1 && !cards.some(c => x.contains(c, manual[0])) && cards.every(c => c.end < manual[0].pos);
    };
    assert.ok(breadcrumbComposition(breadcrumbEditor));
    assert.ok(!breadcrumbComposition(breadcrumbEditor.replaceAll("AdminCard", "div")), "Imports or field presence without actual control groups must fail");
    assert.ok(!breadcrumbComposition(breadcrumbEditor.replace("<BreadcrumbManualItemsField items={config.manualItems ?? []} />", "")), "The subordinate manual group is required");
    const breadcrumbTree = inspect(breadcrumbEditor);
    const breadcrumbGrid = breadcrumbTree.elements.find(n => breadcrumbTree.tag(n) === "ModuleEditorFieldGrid")!;
    const flattenedControls = ["source", "current_label_override", "show_home"].map(name => breadcrumbTree.named(name)!.getText(breadcrumbTree.tree)).join("\n");
    const flattenedBreadcrumb = breadcrumbEditor.replace(breadcrumbGrid.getText(breadcrumbTree.tree), `<ModuleEditorFieldGrid><AdminCard presentation="premium">${flattenedControls}</AdminCard><AdminCard presentation="premium" /><AdminCard presentation="premium" /></ModuleEditorFieldGrid>`);
    assert.ok(!breadcrumbComposition(flattenedBreadcrumb), "Three retained card tokens cannot conceal controls flattened into one card");
    const featuredComposition = (source: string) => {
      const x = inspect(source);
      const content = x.tabs.get("content"), text = x.tabs.get("text"), display = x.tabs.get("presentation"), pages = x.tabs.get("pages");
      if (!content || !text || !display || !pages || x.tabs.size !== 4) return false;
      const references = (node: ts.Node) => {
        const result: string[] = [];
        const visit = (n: ts.Node) => { if (ts.isJsxExpression(n) && n.expression && ts.isIdentifier(n.expression)) result.push(n.expression.text); ts.forEachChild(n, visit); };
        visit(node); return result;
      };
      if (references(content).join(",") !== "sourceFields,variantFields" || text.getText(x.tree) !== "textFields" || references(display).join(",") !== "displayFields") return false;
      const sourceGroup = x.variables.get("sourceFields"), variantGroup = x.variables.get("variantFields");
      if (!sourceGroup || !variantGroup) return false;
      const displayGroup = x.variables.get("displayFields");
      if (!displayGroup || !references(variantGroup).includes("variantControls") || references(variantGroup).includes("displayControls") || !references(displayGroup).includes("displayControls") || references(displayGroup).includes("variantControls")) return false;
      const sourceOwners = new Map<string, ts.Node>();
      for (const name of ["source_kind", "category_slug", "content_type", "selection_mode", "item_limit"]) {
        const control = x.named(name);
        if (!control || !x.contains(sourceGroup, control)) return false;
        const owners = x.within(sourceGroup, "AdminCard").filter(c => x.contains(c, control));
        const owner = owners.sort((a, b) => (a.end - a.pos) - (b.end - b.pos))[0];
        if (!owner || !x.literal(x.attribute(owner, "presentation"), "premium")) return false;
        sourceOwners.set(name, owner);
      }
      if (new Set(["source_kind", "category_slug", "selection_mode", "item_limit"].map(name => sourceOwners.get(name))).size !== 4 || sourceOwners.get("category_slug") !== sourceOwners.get("content_type")) return false;
      const variant = x.named("presentation_variant");
      if (!variant || !x.contains(variantGroup, variant)) return false;
      const assignments = x.within(pages, "ModuleEditorPagesTab");
      return assignments.length === 1 && x.literal(x.attribute(assignments[0], "presentation"), "premium");
    };
    const featured = read("src/components/admin/page-blocks/FeaturedModuleEditClient.tsx");
    assert.ok(featuredComposition(featured));
    assert.ok(!featuredComposition(featured.replace("{sourceFields}{variantFields}", "{sourceFields}{textFields}{variantFields}")), "Mixing copy with source configuration must fail");
    assert.ok(!featuredComposition(featured.replaceAll("AdminCard", "div")), "Shared imports alone cannot prove actual grouping");
    assert.ok(!featuredComposition(featured.replace("{sourceFields}{variantFields}", "{variantFields}{sourceFields}")), "Presentation configuration must follow source selection");
    assert.ok(!featuredComposition(featured.replace("{variantControls}", "{__swappedControls}").replace("{displayControls}", "{variantControls}").replace("{__swappedControls}", "{displayControls}")), "Counts/navigation and display formatting cannot swap their functional parents");
    const sourceGroup = inspect(featured).variables.get("sourceFields")!.getText();
    assert.ok(!featuredComposition(featured.replace(sourceGroup, sourceGroup.replaceAll('presentation="premium"', 'presentation="default"'))), "Source groups must retain their actual Premium presentation opt-in");
    return true;
  })(),
);

check(
  "Breadcrumb and Featured routes bind their actual editors, canonical serializers and assignment mutation owner",
  (() => {
    const assertBinding = (routeText: string, actionText: string, spec: { kind: string; editor: string; action: string; builder: string }) => {
      const route = ts.createSourceFile("route.tsx", routeText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const imported = route.statements.filter(ts.isImportDeclaration).find(n => ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === "../actions")?.importClause?.namedBindings;
      assert.ok(imported && ts.isNamedImports(imported) && imported.elements.some(n => n.name.text === spec.action && !n.propertyName), "The actual action import is required");
      let bound = false;
      const visit = (node: ts.Node) => {
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(route) === spec.editor) bound = node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(route) === "updateAction" && p.initializer && ts.isJsxExpression(p.initializer) && p.initializer.expression?.getText(route) === spec.action);
        ts.forEachChild(node, visit);
      };
      visit(route); assert.ok(bound, "Route must bind its actual client action");
      const tree = ts.createSourceFile("actions.ts", actionText, ts.ScriptTarget.Latest, true);
      const action = tree.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === spec.action);
      assert.ok(action?.body);
      let builds = false, saves = false;
      const calls = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          if (node.expression.text === spec.builder) builds = node.arguments[0]?.getText(tree) === "formData";
          if (node.expression.text === "saveModuleTemplateWithPageAssignments") saves = ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === spec.kind && node.arguments[3]?.getText(tree) === "parsePageIdsFromForm(formData)";
        }
        ts.forEachChild(node, calls);
      };
      calls(action); assert.ok(builds, "Actual update must call its canonical config builder"); assert.ok(saves, "Actual update must use the correct family and canonical submitted assignments");
    };
    for (const spec of [
      { kind: "breadcrumb", editor: "BreadcrumbModuleEditClient", action: "updateBreadcrumbBlock", builder: "buildBreadcrumbConfig" },
      { kind: "featured", editor: "FeaturedModuleEditClient", action: "updateFeaturedModule", builder: "buildFeaturedModuleConfig" },
    ]) {
      const route = read(`src/app/admin/pages-blocks/blocks/${spec.kind}/[id]/page.tsx`), action = read(`src/app/admin/pages-blocks/blocks/${spec.kind}/actions.ts`);
      assertBinding(route, action, spec);
      assert.throws(() => assertBinding(route.replace(`updateAction={${spec.action}}`, "updateAction={unintendedAction}"), action, spec), /actual client action/);
      assert.throws(() => assertBinding(route, action.replaceAll(`${spec.builder}(formData)`, "unintendedGenericBuilder(formData)"), spec), /canonical config builder/);
      assert.throws(() => assertBinding(route, action.replaceAll(`"${spec.kind}", id, nextRow`, '"wrong-family", id, nextRow'), spec), /correct family/);
    }
    return true;
  })(),
);

check(
  "Premium reference applicability resolves existing metadata and rejects dangling or invented authority",
  (() => {
    const clientFile = "src/components/admin/page-blocks/ContentModuleEditClient.tsx";
    const clientTree = ts.createSourceFile(clientFile, read(clientFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const variables = new Map<string, ts.Expression>();
    const mounts: ts.JsxSelfClosingElement[] = [];
    const collect = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer);
      if (ts.isJsxSelfClosingElement(node)) mounts.push(node);
      ts.forEachChild(node, collect);
    };
    collect(clientTree);
    type Identity = NonNullable<ReturnType<typeof resolveModuleEditorCompositionApplicability>>["applicability"]["source"];
    type Reference = NonNullable<ReturnType<typeof resolveModuleEditorCompositionApplicability>>["reference"];
    const contains = (outer: ts.Node, inner: ts.Node) => inner.pos >= outer.pos && inner.end <= outer.end;
    const assertReferenceAsset = (declaration: Reference) => {
      if (declaration.functionalScope !== "compact-inline-settings") return;
      const asset = declaration.visualReference;
      assert.ok(asset.assetPath.startsWith("docs/references/admin/") && !asset.assetPath.includes("\\") && !asset.assetPath.split("/").includes(".."), "The supplied reference is a repository-local documentation asset");
      const path = resolve(ROOT, asset.assetPath);
      assert.ok(existsSync(path), "The supplied reference asset exists at its declared path");
      assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), asset.sha256, "The durable reference is byte-identical to the supplied image");
    };
    // Bounded AST proof of the actual existing mount. Unsupported expressions fail
    // closed; this does not execute or recreate the editor-selection runtime.
    const assertActualMount = (slug: string, identity: Identity, implicitContentSection = false) => {
      const key = getContentModuleEditorKey(slug, "");
      const evaluate = (node: ts.Expression, visiting = new Set<string>()): string | boolean | null | undefined => {
        if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) return evaluate(node.expression, visiting);
        if (ts.isStringLiteral(node)) return node.text;
        if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
        if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
        if (node.kind === ts.SyntaxKind.NullKeyword) return null;
        if (ts.isIdentifier(node)) {
          if (node.text === "editorKey") return key;
          if (node.text === "section") return identity.section;
          if (node.text === "config") return true; // Every tested contract provides a config object.
          const initializer = variables.get(node.text);
          if (!initializer || visiting.has(node.text)) return undefined;
          return evaluate(initializer, new Set([...visiting, node.text]));
        }
        if (ts.isConditionalExpression(node)) {
          const condition = evaluate(node.condition, visiting);
          return condition === undefined ? undefined : evaluate(condition ? node.whenTrue : node.whenFalse, visiting);
        }
        if (ts.isBinaryExpression(node)) {
          const left = evaluate(node.left, visiting), right = evaluate(node.right, visiting);
          if (left === undefined || right === undefined) return undefined;
          if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) return left === right;
          if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) return left || right;
          if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return left && right;
        }
        return undefined;
      };
      const imports = clientTree.statements.filter(ts.isImportDeclaration).filter(statement => {
        if (!ts.isStringLiteral(statement.moduleSpecifier)) return false;
        return resolve(ROOT, dirname(clientFile), statement.moduleSpecifier.text + ".tsx") === resolve(ROOT, identity.sourceFile);
      });
      const localNames = imports.flatMap(statement => {
        if (identity.exportName === "default") return statement.importClause?.name ? [statement.importClause.name.text] : [];
        const bindings = statement.importClause?.namedBindings;
        return bindings && ts.isNamedImports(bindings) ? bindings.elements.filter(entry => (entry.propertyName ?? entry.name).text === identity.exportName).map(entry => entry.name.text) : [];
      });
      const active = (mount: ts.Node) => {
        for (let ancestor = mount.parent; ancestor; ancestor = ancestor.parent) {
          if (ts.isConditionalExpression(ancestor)) {
            const condition = evaluate(ancestor.condition);
            if (condition === undefined || (contains(ancestor.whenTrue, mount) ? !condition : contains(ancestor.whenFalse, mount) ? !!condition : false)) return false;
          }
          if (ts.isArrowFunction(ancestor) && ancestor.parameters.some(parameter => parameter.name.getText(clientTree) === "section")) {
            const call = ancestor.parent;
            if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== "map") return false;
            let list: ts.Expression = call.expression.expression;
            while (ts.isParenthesizedExpression(list) || ts.isAsExpression(list)) list = list.expression;
            if (!ts.isArrayLiteralExpression(list) || !list.elements.some(element => ts.isStringLiteral(element) && element.text === identity.section)) return false;
          }
        }
        return true;
      };
      const matching = mounts.filter(mount => {
        if (!localNames.includes(mount.tagName.getText(clientTree)) || !active(mount)) return false;
        const value = (name: string) => {
          const attribute = mount.attributes.properties.find((entry): entry is ts.JsxAttribute => ts.isJsxAttribute(entry) && entry.name.getText(clientTree) === name)?.initializer;
          return attribute && ts.isStringLiteral(attribute) ? attribute.text : attribute && ts.isJsxExpression(attribute) && attribute.expression ? evaluate(attribute.expression) : undefined;
        };
        let section = value("section");
        if (section === undefined && implicitContentSection) {
          for (let ancestor = mount.parent; ancestor; ancestor = ancestor.parent) {
            if (!ts.isObjectLiteralExpression(ancestor)) continue;
            const id = ancestor.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(clientTree) === "id");
            const content = ancestor.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(clientTree) === "content");
            if (id && ts.isStringLiteral(id.initializer) && content && contains(content.initializer, mount)) {
              section = id.initializer.text;
              break;
            }
          }
        }
        return section === identity.section && Object.entries(identity.mode).every(([name, expected]) => value(name) === expected);
      });
      assert.equal(matching.length, 1, `${slug}: metadata source/mode/section matches exactly one actual slug-specific editor mount`);
    };
    const declared = Object.entries(SLOT_MODULE_SLUG_METADATA).flatMap(([slug, metadata]) =>
      Object.entries(metadata.editorSections ?? {}).filter(([, section]) => section.composition)
        .map(([sectionId]) => ({ slug, sectionId })),
    );
    assert.ok(declared.length > 0, "The bounded approved reference is discoverable");
    for (const { slug, sectionId } of declared) {
      const resolved = resolveModuleEditorCompositionApplicability(slug, sectionId);
      assert.ok(resolved);
      assertActualMount(slug, resolved.applicability.source, resolved.applicability.functionalScope === "compact-inline-settings");
      assertReferenceAsset(resolved.reference);
      for (const declaration of [resolved.applicability, resolved.reference]) {
        const identity = declaration.source;
        const tree = ts.createSourceFile(identity.sourceFile, read(identity.sourceFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const exported = tree.statements.some(statement => {
          if (ts.isExportAssignment(statement)) return identity.exportName === "default";
          if (!ts.isFunctionDeclaration(statement)) return false;
          const modifiers = ts.getModifiers(statement) ?? [];
          return modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
            (identity.exportName === "default"
              ? modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)
              : statement.name?.text === identity.exportName);
        });
        assert.ok(exported, `${slug}: declared editor export exists`);
        assert.ok(graphUsesExecutableBinding({
          root: ROOT, graph: moduleEditorExecutableGraph,
          bindings: [{ sourceFile: identity.sourceFile, exportNames: [identity.exportName] }],
        }), `${slug}: reference/adopter is reachable through the existing executable consumer graph`);
        assert.equal(identity.section, sectionId, "The declaration identifies its actual section");
      }
    }
    assert.equal(resolveModuleEditorCompositionApplicability("unmapped-isolated-consumer", "cta"), null);
    assert.equal(resolveModuleEditorCompositionApplicability("home-story", "images"), null, "Approval is scoped to CTA rather than the entire editor");
    const copy = () => structuredClone(SLOT_MODULE_SLUG_METADATA);
    const dangling = copy();
    const adopter = dangling["home-projects"].editorSections!.cta.composition!;
    assert.equal(adopter.role, "adopter");
    if (adopter.role === "adopter") adopter.reference.moduleSlug = "unmapped-isolated-consumer";
    assert.throws(() => resolveModuleEditorCompositionApplicability("home-projects", "cta", dangling), /missing/u);
    const cycle = copy();
    cycle["home-story"].editorSections!.cta.composition = structuredClone(cycle["home-projects"].editorSections!.cta.composition!);
    assert.throws(() => resolveModuleEditorCompositionApplicability("home-projects", "cta", cycle), /reference in the same/u);
    const malformed = copy();
    malformed["home-projects"].editorSections!.cta.composition!.source.mode = { editorMode: "" };
    assert.throws(() => resolveModuleEditorCompositionApplicability("home-projects", "cta", malformed), /Invalid/u);
    const wrongScope = copy();
    Object.assign(wrongScope["home-story"].editorSections!.cta.composition!, { functionalScope: "invented-family" });
    assert.throws(() => resolveModuleEditorCompositionApplicability("home-projects", "cta", wrongScope), /Invalid/u);
    const storySource = resolveModuleEditorCompositionApplicability("home-story", "cta")!.applicability.source;
    assert.throws(() => assertActualMount("home-story", { ...storySource, mode: { editorMode: "about-intro" } }), /actual slug-specific/u);
    assert.throws(() => assertActualMount("home-projects", storySource), /actual slug-specific/u);
    const compact = resolveModuleEditorCompositionApplicability("about-approach", "content")!;
    assert.equal(compact.reference.functionalScope, "compact-inline-settings");
    assert.equal(resolveModuleEditorCompositionApplicability("about-approach", "pages"), null, "The compact reference does not approve the whole editor");
    assert.throws(() => assertActualMount("about-approach", { ...compact.applicability.source, section: "pages" }, true), /actual slug-specific/u);
    for (const change of [{ sha256: "not-a-source-hash" }, { inputPlacement: "icon-offset" }, { assetName: "" }, { assetPath: "" }]) {
      const invalid = copy();
      const declaration = invalid["about-approach"].editorSections!.content.composition!;
      assert.ok(declaration.functionalScope === "compact-inline-settings" && declaration.role === "reference");
      Object.assign(declaration.visualReference, change);
      assert.throws(() => resolveModuleEditorCompositionApplicability("about-approach", "content", invalid), /Invalid/u);
    }
    assert.ok(compact.reference.functionalScope === "compact-inline-settings");
    for (const change of [{ sha256: "0".repeat(64) }, { assetPath: "docs/references/admin/missing-reference.png" }, { assetPath: "../compact-inline-settings.png" }]) {
      const invalid = structuredClone(compact.reference);
      Object.assign(invalid.visualReference, change);
      assert.ok(rejects(() => assertReferenceAsset(invalid)), "A plausible but wrong reference path/hash cannot pass source identity acceptance");
    }
    return true;
  })(),
);

check(
  "Compact Inline uses actual shared owners, supported tools and full-width sibling input structure with negative acceptance probes",
  await (async () => {
    const sourceFile = "src/components/admin/page-blocks/ModuleEditorPresentation.tsx";
    const tree = ts.createSourceFile(sourceFile, read(sourceFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const row = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ModuleEditorVisibilityAlignRow");
    const cardClass = tree.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(tree) === "MODULE_EDITOR_CONTROL_CARD_CLASS_NAME"));
    assert.ok(row && cardClass);
    const referenceFile = resolveModuleEditorCompositionApplicability("about-approach", "content")!.reference.source.sourceFile;
    const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [referenceFile], symbolAware: true });
    for (const binding of [
      { sourceFile, exportNames: ["ModuleEditorVisibilityAlignRow"] },
      { sourceFile: "src/components/admin/ui/AdminCard.tsx", exportNames: ["default"] },
      { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportNames: ["AdminFormControlHeader"] },
      { sourceFile: "src/components/admin/ui/AdminFormSwitch.tsx", exportNames: ["default"] },
      { sourceFile: "src/components/admin/ui/AdminTextFormatControls.tsx", exportNames: ["default"] },
    ]) assert.ok(graphUsesExecutableBinding({ root: ROOT, graph, bindings: [binding] }), `The actual reference resolves ${binding.sourceFile}`);
    const referenceTree = ts.createSourceFile(referenceFile, read(referenceFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const referenceRows: ts.JsxElement[] = [];
    const findReferenceRows = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(referenceTree) === "ModuleEditorVisibilityAlignRow") referenceRows.push(node);
      ts.forEachChild(node, findReferenceRows);
    };
    findReferenceRows(referenceTree);
    assert.equal(referenceRows.length, 2, "The reference is its two native short-text rows, not a whole-editor approval");
    const sourceAttribute = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) => {
      const value = node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(referenceTree) === name)?.initializer;
      return value && ts.isStringLiteral(value) ? value.text : undefined;
    };
    for (const [index, field] of ["eyebrow", "title"].entries()) {
      const element = referenceRows[index];
      assert.equal(sourceAttribute(element.openingElement, "presentation"), "premium");
      for (const [attribute, expected] of Object.entries({ showName: `show_${field}`, boldName: `${field}_bold`, alignmentName: `${field}_alignment` })) assert.equal(sourceAttribute(element.openingElement, attribute), expected);
      assert.ok(element.children.some(child => ts.isJsxSelfClosingElement(child) && ["input", "textarea"].includes(child.tagName.getText(referenceTree)) && sourceAttribute(child, "name") === field), "Native input remains directly owned by the reference row");
    }
    const textConsumerFiles = [
      "AboutCtaModuleEditor", "AboutPrinciplesModuleEditor", "ProjectsHubFeaturedModuleEditor", "ProjectsHubListingModuleEditor",
    ].map(name => `src/components/admin/page-blocks/editors/${name}.tsx`);
    const inspectTextSurfaces = (file: string, source: string) => {
      const consumer = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const names = new Map<string, string>();
      for (const statement of consumer.statements.filter(ts.isImportDeclaration)) {
        if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const owner = resolve(ROOT, dirname(file), statement.moduleSpecifier.text);
        const shared = owner === resolve(ROOT, sourceFile.replace(/\.tsx$/u, ""));
        const ui = owner === resolve(ROOT, "src/components/admin/ui");
        const imports = statement.importClause?.namedBindings;
        if ((!shared && !ui) || !imports || !ts.isNamedImports(imports)) continue;
        for (const entry of imports.elements) names.set(entry.name.text, (entry.propertyName ?? entry.name).text);
      }
      const elements: ts.JsxElement[] = [];
      const collect = (node: ts.Node) => { if (ts.isJsxElement(node)) elements.push(node); ts.forEachChild(node, collect); };
      collect(consumer);
      const canonical = (node: ts.JsxElement) => names.get(node.openingElement.tagName.getText(consumer)) ?? node.openingElement.tagName.getText(consumer);
      const isSurface = (node: ts.Node): node is ts.JsxElement => ts.isJsxElement(node) && ["ModuleEditorSection", "AdminFormSection", "AdminCard"].includes(canonical(node));
      const inside = (outer: ts.Node, inner: ts.Node) => outer.pos <= inner.pos && inner.end <= outer.end;
      const isPremiumRow = (node: ts.JsxElement) => canonical(node) === "ModuleEditorVisibilityAlignRow" && node.openingElement.attributes.properties.some(attribute =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(consumer) === "presentation" && attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === "premium");
      const premiumRows = elements.filter(isPremiumRow);
      assert.ok(premiumRows.length, `${file}: actual Premium text rows are present`);
      const ownsHeading = (surface: ts.JsxElement) => {
        const title = surface.openingElement.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(consumer) === "title");
        if (title?.initializer && ts.isStringLiteral(title.initializer) && title.initializer.text.trim()) return true;
        return elements.some(heading => {
          if (!inside(surface, heading) || !["ModuleEditorSectionHeading", "h2", "h3", "legend"].includes(canonical(heading))) return false;
          for (let ancestor = heading.parent; ancestor && ancestor !== surface; ancestor = ancestor.parent) {
            if (isSurface(ancestor) || (ts.isJsxElement(ancestor) && isPremiumRow(ancestor))) return false;
          }
          return true;
        }) || (() => {
          // AdminFormControlHeader is self-closing in the actual repeater group.
          let found = false;
          const visit = (node: ts.Node) => {
            if (node !== surface && (isSurface(node) || (ts.isJsxElement(node) && isPremiumRow(node)))) return;
            if (ts.isJsxSelfClosingElement(node) && names.get(node.tagName.getText(consumer)) === "AdminFormControlHeader") found = true;
            ts.forEachChild(node, visit);
          };
          visit(surface);
          return found;
        })();
      };
      for (const row of premiumRows) for (let ancestor = row.parent; ancestor; ancestor = ancestor.parent) {
        if (isSurface(ancestor)) assert.ok(ownsHeading(ancestor), `${file}: an unheaded enclosing surface cannot repeat the Premium text cards' surface`);
      }
      const grid = elements.find(node => canonical(node) === "ModuleEditorFieldGrid" && premiumRows.some(row => inside(node, row)));
      assert.ok(grid);
      return { consumer, grid };
    };
    for (const file of textConsumerFiles) {
      const source = read(file), { consumer, grid } = inspectTextSurfaces(file, source);
      const text = grid.getText(consumer);
      const wrapped = source.slice(0, grid.getStart(consumer)) + `<__CompactRedundantSurface>${text}</__CompactRedundantSurface>` + source.slice(grid.end);
      const canonicalImport = 'import { ModuleEditorSection as __CompactRedundantSurface } from "../ModuleEditorPresentation";\n';
      assert.ok(rejects(() => inspectTextSurfaces(file, canonicalImport + wrapped)), `${file}: restoring the unheaded actual text wrapper fails while every field/tool and other heading remains`);
      inspectTextSurfaces(file, source.slice(0, grid.getStart(consumer)) + `<div>${text}</div>` + source.slice(grid.end));
    }
    // Extract the actual function as the existing Header guard does. This avoids
    // loading unrelated server actions from the UI barrel, without reimplementing it.
    const [{ default: Card }, { AdminFormControlHeader: Header }, { default: Switch }, { default: Format }] = await Promise.all([
      jiti.import<typeof import("../src/components/admin/ui/AdminCard.tsx")>("../src/components/admin/ui/AdminCard.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminForm.tsx")>("../src/components/admin/ui/AdminForm.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminFormSwitch.tsx")>("../src/components/admin/ui/AdminFormSwitch.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminTextFormatControls.tsx")>("../src/components/admin/ui/AdminTextFormatControls.tsx"),
    ]);
    const compiled = ts.transpileModule(`${cardClass.getText(tree)}\n${row.getText(tree)}`, {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const ownerExports: Partial<typeof import("../src/components/admin/page-blocks/ModuleEditorPresentation.tsx")> = {};
    new Function("React", "exports", "useState", "Children", "AdminCard", "AdminFormControlHeader", "AdminFormSwitch", "AdminTextFormatControls", compiled)(
      { createElement, Fragment }, ownerExports, useState, Children, Card, Header, Switch, Format,
    );
    const Row = ownerExports.ModuleEditorVisibilityAlignRow;
    assert.ok(Row);
    type Element = ts.JsxElement | ts.JsxSelfClosingElement;
    const parse = (html: string) => {
      const rendered = ts.createSourceFile("rendered.tsx", `<main>${html}</main>`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const elements: Element[] = [];
      const collect = (node: ts.Node) => { if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node); ts.forEachChild(node, collect); };
      collect(rendered);
      const opening = (node: Element) => ts.isJsxElement(node) ? node.openingElement : node;
      const attribute = (node: Element, name: string) => {
        const value = opening(node).attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(rendered) === name)?.initializer;
        return value && ts.isStringLiteral(value) ? value.text : undefined;
      };
      const has = (node: Element, name: string) => attribute(node, name) !== undefined;
      const tag = (node: Element) => opening(node).tagName.getText(rendered);
      const within = (outer: ts.Node, inner: ts.Node) => outer.pos <= inner.pos && inner.end <= outer.end;
      return { rendered, elements, attribute, has, tag, within };
    };
    type Expected = { alignment: boolean; bold: boolean; visibility: boolean; child: "none" | "native" | "specialized" };
    const inspect = (html: string, expected: Expected) => {
      const dom = parse(html), { elements, attribute, has, tag, within } = dom;
      const one = (name: string) => { const found = elements.filter(node => has(node, name)); assert.equal(found.length, 1, name); return found[0]; };
      const composition = one("data-module-editor-settings-composition");
      assert.equal(attribute(composition, "data-module-editor-settings-composition"), "compact-inline");
      const header = one("data-module-editor-settings-header");
      assert.equal(header.parent, composition, "Header is a direct row child");
      const sharedHeader = one("data-admin-form-control-header");
      assert.ok(within(header, sharedHeader));
      assert.equal(attribute(sharedHeader, "data-admin-form-control-presentation"), "compact-inline");
      const formats = elements.filter(node => has(node, "data-admin-text-format-controls"));
      assert.equal(formats.length, expected.alignment || expected.bold ? 1 : 0);
      for (const format of formats) { assert.ok(within(header, format), "Formatting belongs in the same header"); assert.equal(attribute(format, "data-admin-text-format-density"), "compact"); }
      const alignments = elements.filter(node => has(node, "data-admin-text-alignment"));
      assert.deepEqual(alignments.map(node => attribute(node, "data-admin-text-alignment")), expected.alignment ? ["right", "center", "left"] : []);
      const bold = elements.filter(node => has(node, "data-admin-text-format-bold"));
      assert.equal(bold.length, expected.bold ? 1 : 0);
      for (const button of [...alignments, ...bold]) { assert.equal(tag(button), "button"); assert.equal(attribute(button, "type"), "button"); assert.ok(within(header, button)); }
      const switches = elements.filter(node => attribute(node, "role") === "switch");
      assert.equal(switches.length, expected.visibility ? 1 : 0);
      for (const control of switches) { assert.equal(tag(control), "input"); assert.equal(attribute(control, "type"), "checkbox"); assert.ok(within(header, control), "Visibility belongs in the same header"); }
      if (formats.length && switches.length) assert.ok(formats[0].pos < switches[0].pos, "Formatting precedes visibility in the RTL DOM");
      const bodies = elements.filter(node => has(node, "data-module-editor-settings-body"));
      assert.equal(bodies.length, expected.child === "none" ? 0 : 1);
      for (const body of bodies) {
        assert.equal(body.parent, composition, "Input body is a header sibling, without an icon column ancestor");
        assert.ok(header.end <= body.pos, "Input follows the complete header");
        if (expected.child === "native") {
          assert.ok(ts.isJsxElement(body));
          const children = body.children.filter((node): node is Element => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node));
          assert.equal(children.length, 1, "A native input body has no reserved icon spacer or offset wrapper");
          assert.equal(attribute(children[0], "name"), "compact_text");
          assert.ok(["input", "textarea"].includes(tag(children[0])));
        } else assert.equal(elements.filter(node => has(node, "data-specialized-child") && within(body, node)).length, 1, "Specialized child composition remains owned by its existing editor");
      }
      return dom;
    };
    const props = { label: "عنوان الإعداد", showName: "show_compact", alignmentName: "compact_alignment", boldName: "compact_bold", alignmentDefault: "left", boldDefault: true, showDefault: false, description: "وصف محفوظ", icon: createElement("svg", { "data-compact-glyph": "" }) } as const;
    const native = (html: string) => { const dom = parse(html); return dom.elements.filter(node => dom.tag(node) === "input" && dom.attribute(node, "name")).map(node => ({ name: dom.attribute(node, "name"), value: dom.attribute(node, "value"), type: dom.attribute(node, "type") })); };
    const cases = [
      { changes: {}, expected: { alignment: true, bold: true, visibility: true, child: "none" } },
      { changes: {}, expected: { alignment: true, bold: true, visibility: true, child: "native" } },
      { changes: { enableAlignment: false }, expected: { alignment: false, bold: true, visibility: true, child: "native" } },
      { changes: { enableBold: false, enableVisibility: false }, expected: { alignment: true, bold: false, visibility: false, child: "none" } },
      { changes: { enableBold: false, enableAlignment: false }, expected: { alignment: false, bold: false, visibility: true, child: "specialized" } },
      { changes: { preserveUnsetBold: true, boldDefault: undefined }, expected: { alignment: true, bold: true, visibility: true, child: "native" } },
    ] satisfies Array<{ changes: Partial<Parameters<typeof Row>[0]>; expected: Expected }>;
    const outputs = cases.map(({ changes, expected }) => {
      const child = expected.child === "none" ? undefined : expected.child === "native" ? createElement("input", { name: "compact_text", defaultValue: "نص أصلي", "aria-label": "النص" }) : createElement("div", { "data-specialized-child": "" }, createElement("textarea", { name: "special_content", defaultValue: "نص متخصص" }));
      const actual = { ...props, ...changes, children: child };
      const html = renderToStaticMarkup(createElement(Row, { ...actual, presentation: "premium" }));
      inspect(html, expected);
      assert.deepEqual(native(html), native(renderToStaticMarkup(createElement(Row, { ...actual, presentation: "card" }))), "Presentation retains original named native payload and unset bold omission");
      assert.equal(renderToStaticMarkup(createElement(Row, actual)), renderToStaticMarkup(createElement(Row, { ...actual, presentation: "card" })), "The default row is unchanged card presentation");
      assert.ok(html.includes("وصف محفوظ"));
      return { html, expected };
    });
    const visibilityProps = { label: "الصورة", showName: "show_image", showDefault: true, controlMode: "visibility-only", presentation: "premium" } as const;
    const visibilityHtml = renderToStaticMarkup(createElement(Row, visibilityProps));
    const visibilityExpected = { alignment: false, bold: false, visibility: true, child: "none" } as const;
    inspect(visibilityHtml, visibilityExpected);
    assert.deepEqual(native(visibilityHtml), [{ name: "show_image", value: "true", type: "hidden" }]);
    const { html, expected } = outputs[1], dom = parse(html);
    const format = dom.elements.find(node => dom.has(node, "data-admin-text-format-controls"))!.getText(dom.rendered);
    const header = dom.elements.find(node => dom.has(node, "data-module-editor-settings-header"))!.getText(dom.rendered);
    const body = dom.elements.find(node => dom.has(node, "data-module-editor-settings-body"))!.getText(dom.rendered);
    const bold = dom.elements.find(node => dom.has(node, "data-admin-text-format-bold"))!.getText(dom.rendered);
    const alignment = dom.elements.find(node => dom.has(node, "data-admin-text-alignment"))!.getText(dom.rendered);
    const mutations = [
      ["format outside header with every token retained", html.replace(format, "").replace("</section>", `${format}</section>`)],
      ["missing supported bold", html.replace(bold, "")],
      ["missing supported alignment", html.replace(alignment, "")],
      ["body nested under header", html.replace(body, "").replace(header, header.replace(/<\/div>$/u, `${body}</div>`))],
      ["reserved input spacer", html.replace(body, body.replace(/<div\b[^>]*>/u, '$&<span aria-hidden="true"></span>'))],
    ];
    for (const [label, changed] of mutations) assert.ok(rejects(() => inspect(changed, expected)), `Compact Inline rejects ${label}`);
    const visibilityDom = parse(visibilityHtml);
    const visibilityHeader = visibilityDom.elements.find(node => visibilityDom.has(node, "data-module-editor-settings-header"))!.getText(visibilityDom.rendered);
    const unsupported = visibilityHtml.replace(visibilityHeader, visibilityHeader.replace(/<\/div>$/u, `${format}</div>`));
    assert.ok(rejects(() => inspect(unsupported, visibilityExpected)), "Visibility-only rejects unsupported format tools even when shared owners are present");
    for (const embedded of [false, true]) {
      const switchProps = { label: "إظهار", name: "default_switch", embedded, defaultChecked: true };
      assert.equal(renderToStaticMarkup(createElement(Switch, switchProps)), renderToStaticMarkup(createElement(Switch, { ...switchProps, embeddedLayout: "stacked" })), "Switch inline layout is explicit and its defaults remain stacked");
    }
    const formatProps = { ariaLabel: "تنسيق", alignment: "right", onAlignmentChange: () => {}, bold: false, onBoldChange: () => {} } as const;
    assert.equal(renderToStaticMarkup(createElement(Format, formatProps)), renderToStaticMarkup(createElement(Format, { ...formatProps, density: "default" })), "Compact tool geometry is explicit");
    console.log("Compact Inline scoped SSR: 7 capability states; 6 structural/tool negatives; 4 actual-consumer unheaded-surface rejection probes. Physical geometry and Owner approval require current Browser evidence.");
    return true;
  })(),
);

check(
  "Premium acceptance executes actual rendered contract states, save-path integrity and evidence rejection probes",
  (() => {
    const output = execFileSync(process.execPath, [
      "scripts/qa-home-story-presentation.mjs", "--premium-adoption-acceptance-offline",
      "--content-premium-output-dir=.tmp-qa/page-block-editor-presentation/current",
    ], { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 4_000_000, timeout: 120_000 });
    // The runner fails closed on any assertion; stdout is scoped technical proof,
    // never a substitute for observed Browser evidence or Owner visual approval.
    process.stdout.write(output);
    return true;
  })(),
);

console.log(
  `Page Block Editor Presentation verification passed (${passed} checks).`,
);
