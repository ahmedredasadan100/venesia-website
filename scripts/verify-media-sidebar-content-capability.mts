import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFile(resolve(root, path), "utf8");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const [
  publicContract,
  configOwner,
  editor,
  editorPage,
  action,
  resolver,
  renderer,
  mediaFacade,
  displayOwner,
] = await Promise.all([
  read("src/lib/content/public-content-read/contract.ts"),
  read("src/lib/media-sidebar-modules/parse-config.ts"),
  read("src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx"),
  read("src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx"),
  read("src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts"),
  read("src/lib/media-sidebar-modules/resolve-widget-items.ts"),
  read("src/components/media-center/MediaSidebar.tsx"),
  read("src/lib/media-center.ts"),
  read("src/lib/page-blocks/configs.ts"),
]);

check(
  "legacy latest rows preserve the former Media News source and display defaults",
  configOwner.includes('if (rawSource === "topics") return fallback') &&
    configOwner.includes('const DEFAULT_PRESENTATION: MediaSidebarPresentation = "list"') &&
    configOwner.includes(
      'source: { kind: "media-center", contentType: "news" }',
    ) &&
    configOwner.includes("const LATEST_DISPLAY_DEFAULTS") &&
    configOwner.includes("category: false") &&
    configOwner.includes("series: false") &&
    configOwner.includes("excerpt: false"),
);

check(
  "legacy popular rows preserve the former all-Media source and metadata defaults",
  configOwner.includes(
    'source: { kind: "media-center", contentType: "all" }',
  ) &&
    configOwner.includes("const POPULAR_DISPLAY_DEFAULTS") &&
    configOwner.includes("category: true") &&
    configOwner.includes("series: true"),
);

check(
  "Public Content Read exposes the reusable category or Media source contract",
  publicContract.includes("export type PublicContentSource<") &&
    publicContract.includes("publicContentSourceContentTypes") &&
    configOwner.includes("PublicContentSource<MediaSidebarMediaContentType>"),
);

check(
  "CMS exposes functional source, dependent filter, latest/popular selection, presentation, and no technical data-source field",
  editor.includes('name="source_kind"') &&
    editor.includes('name="category_slug"') &&
    editor.includes('name="content_type"') &&
    editor.includes('name="widget_key"') &&
    editor.includes('name="presentation"') &&
    editor.includes('label="شكل العرض"') &&
    editor.includes('label="طريقة الاختيار"') &&
    !editor.includes('name="data_source"') &&
    editorPage.includes("loadTopicFilterOptionsForAdmin"),
);

check(
  "CMS adopts the one shared six-field display editor",
  editor.includes("<ContentDisplaySettings") &&
    editor.includes("includeIntroCard={false}") &&
    !editor.includes("TopicFormSwitch") &&
    !editor.includes("AdminFormSwitch"),
);

check(
  "config build validates source and limit and serializes the shared display contract",
  configOwner.includes('formData.get("source_kind")') &&
    configOwner.includes('formData.get("category_slug")') &&
  configOwner.includes('formData.get("content_type")') &&
    configOwner.includes('formData.get("limit")') &&
    configOwner.includes('formData.get("presentation")') &&
    configOwner.includes("buildContentDisplayOptionsFromFormData(formData, false)"),
);

check(
  "one Media Sidebar presentation contract preserves list and owns both motion variants",
  configOwner.includes('"list"') &&
    configOwner.includes('"single-carousel"') &&
    configOwner.includes('"group-carousel"') &&
    renderer.includes('data-media-sidebar-presentation="list"') &&
    renderer.includes('data-media-sidebar-presentation="single-carousel"') &&
    renderer.includes('data-media-sidebar-presentation="group-carousel"'),
);

check(
  "motion presentations reuse the existing shared autoplay and dot owners",
  renderer.includes('from "../../hooks/use-auto-carousel"') &&
    renderer.includes('from "../feed-modules/FeedCarouselDots"') &&
    renderer.includes("useAutoCarousel<HTMLDivElement>") &&
    renderer.includes("<FeedCarouselDots") &&
    renderer.includes("feedCarouselFade") &&
    !configOwner.includes("autoplayMs"),
);

check(
  "save builds the Media Sidebar config at its current owner and passes that row to coordination",
  action.includes("buildMediaSidebarModuleConfig(widgetKey, formData)") &&
    action.includes("intendedRow: nextRow") &&
    action.replace(/\s+/gu, "").includes('"media-sidebar",id,nextRow,parsePageIdsFromForm(formData),actor'),
);
const sidebarUpdate = action.slice(action.indexOf("export async function updateMediaSidebarModule"));
const atomicMigration = await read("sql/migrations/20260912224809_shared_composition_menu_atomic_completion.sql");
check(
  "update validates stored config inside the atomic template and assignment transaction",
  sidebarUpdate.replace(/\s+/gu, "").includes('saveModuleTemplateWithPageAssignments("media-sidebar"') &&
    !sidebarUpdate.includes("isPersistedMediaSidebarModuleConfigEqual") &&
    atomicMigration.includes("execute format('select to_jsonb(t) from public.%I t where id=$1',v_template_table)") &&
    atomicMigration.includes("v_saved_template->'config' is distinct from p_payload->'template'->'config'") &&
    atomicMigration.indexOf("message='template_saved_config_mismatch'") < atomicMigration.lastIndexOf("delete from public.%I where template_id=$1"),
);

check(
  "runtime delegates every content read to Public Content Read without parallel latest/popular queries",
  resolver.includes("loadPublicContentCollection") &&
    resolver.includes("publicContentSourceContentTypes(config.source)") &&
    resolver.includes(
      'sort: widget.widgetKey === "popular" ? "most-viewed" : "newest"',
    ) &&
    !resolver.includes("popularOnly") &&
    !resolver.includes("getMediaSidebarLatest") &&
    !resolver.includes("getMediaSidebarPopular") &&
    !mediaFacade.includes("getMediaSidebarLatest") &&
    !mediaFacade.includes("getMediaSidebarPopular"),
);

check(
  "hidden assignments stop before Public Content Read",
  resolver.includes('if (!widget.isVisible || !isContentConfig(config))') &&
    resolver.indexOf('if (!widget.isVisible || !isContentConfig(config))') <
      resolver.indexOf("loadPublicContentCollection({"),
);

check(
  "one shared item-display resolver intersects CMS choice, item truth, and available values",
  displayOwner.includes("export function resolveContentItemDisplay") &&
    resolver.includes("resolveContentItemDisplay(config.display, item.display") &&
    ["title", "image", "category", "series", "excerpt", "date"].every(
      (field) => renderer.includes(`item.display.${field}`),
    ),
);

check(
  "navigation sections stay domain-specific and outside content selection",
  configOwner.includes('source: "navigation"') &&
    resolver.includes("!isContentConfig(config)") &&
    renderer.includes('case "sections"') &&
    renderer.includes('widget.config.source !== "navigation"'),
);


const [sharedPresentation, usageBanner, sharedTabs, displayControls, gridOwner, ...displayTabConsumers] = await Promise.all([
  read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx"),
  read("src/components/admin/page-blocks/ModuleCrossPageUsageBanner.tsx"),
  read("src/components/admin/ui/AdminModuleTabs.tsx"),
  read("src/components/admin/content/editors/ContentDisplaySettings.tsx"),
  read("src/components/admin/ui/AdminFormRuntime.tsx"),
  read("src/components/admin/content/editors/ArticleCreateEditor.tsx"),
  read("src/components/admin/content/editors/ArticleEditor.tsx"),
  read("src/components/admin/content/editors/media/MediaContentForm.tsx"),
]);
function displaySyntax(input: string) {
  const tree = ts.createSourceFile("DisplayConsumer.tsx", input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const find = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const nodes: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) nodes.push(node); ts.forEachChild(node, visit); };
    visit(root);
    return nodes;
  };
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name,
  );
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const initializer = attribute(node, name)?.initializer;
    return initializer && ts.isStringLiteral(initializer) ? initializer.text : initializer && ts.isJsxExpression(initializer) ? initializer.expression?.getText(tree) : undefined;
  };
  return { tree, find, attribute, value };
}
function hasOptionalCanonicalDisplaySection(input: string) {
  const { tree, find, value } = displaySyntax(input);
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ContentDisplaySettings");
  const parameter = owner?.parameters[0];
  const heading = parameter && ts.isObjectBindingPattern(parameter.name) ? parameter.name.elements.find((node) => ts.isIdentifier(node.name) && node.name.text === "sectionHeading") : undefined;
  const optional = parameter?.type && ts.isTypeLiteralNode(parameter.type) ? parameter.type.members.some((node) => ts.isPropertySignature(node) && node.name.getText(tree) === "sectionHeading" && node.questionToken) : false;
  const returned = owner?.body?.statements.find(ts.isReturnStatement)?.expression;
  if (!heading || heading.initializer || !optional || !returned || !ts.isConditionalExpression(returned) || returned.condition.getText(tree) !== "sectionHeading" || returned.whenFalse.getText(tree) !== "displayControls") return false;
  const branch = ts.isParenthesizedExpression(returned.whenTrue) ? returned.whenTrue.expression : returned.whenTrue;
  if (!ts.isJsxElement(branch) || branch.openingElement.tagName.getText(tree) !== "AdminCard" || value(branch.openingElement, "presentation") !== "premium" || value(branch.openingElement, "className") !== "min-w-0 p-3") return false;
  const children = branch.children.filter((node) => ts.isJsxSelfClosingElement(node) || ts.isJsxExpression(node) && node.expression);
  if (children.length !== 2 || !ts.isJsxSelfClosingElement(children[0]!) || !ts.isJsxExpression(children[1]!) || children[1].expression?.getText(tree) !== "displayControls") return false;
  const header = children[0];
  return header.tagName.getText(tree) === "AdminModuleSectionHeader" && value(header, "id") === "content-display-settings-heading" && value(header, "sectionHeading") === "sectionHeading" &&
    value(header, "icon") === "settings" && value(header, "sectionHeaderPresentation") === "premium" && value(header, "sectionHeaderClassName") === "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME" &&
    find(tree, ts.isImportDeclaration).some((node) => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../ui/AdminModuleTabs" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((binding) => !binding.propertyName && binding.name.text === "AdminModuleSectionHeader"));
}
function hasIndependentDisplayTab(input: string) {
  const { tree, find, attribute, value } = displaySyntax(input);
  const calls = find(tree, ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText(tree) === "ContentDisplaySettings");
  const basics = find(tree, (node): node is ts.JsxOpeningLikeElement => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)).filter((node) => node.tagName.getText(tree) === "ContentBasicDataPanel");
  const call = calls[0];
  const tabs = find(tree, ts.isObjectLiteralExpression).filter((node) => node.properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(tree) === "id" && ts.isStringLiteral(property.initializer) && property.initializer.text === "display"));
  return Boolean(calls.length === 1 && call && tabs.length === 1 && find(tabs[0]!, ts.isJsxSelfClosingElement).includes(call) &&
    value(call, "sectionHeading") === "إعدادات العرض" && value(call, "columns") === "4" && value(call, "presentation") === "premium-inline" &&
    basics.length === 1 && basics.every((node) => !attribute(node, "displaySettings")));
}
function hasSidebarControlsOnly(input: string) {
  const { tree, find, attribute, value } = displaySyntax(input);
  const calls = find(tree, ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText(tree) === "ContentDisplaySettings");
  return calls.length === 1 && !attribute(calls[0]!, "sectionHeading") && value(calls[0]!, "columns") === "3" && value(calls[0]!, "presentation") === "premium" && value(calls[0]!, "includeIntroCard") === "false";
}
function hasSidebarCanonicalSections(input: string) {
  const { tree, find, attribute, value } = displaySyntax(input);
  const canonical = (name: string, path: string) => find(tree, ts.isImportDeclaration).some(node =>
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === path && node.importClause?.namedBindings &&
    ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => !binding.propertyName && binding.name.text === name));
  const elements = find(tree, (node): node is ts.JsxOpeningLikeElement => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node));
  const sections = elements.filter(node => node.tagName.getText(tree) === "ModuleEditorSection");
  const inside = (node: ts.Node, parent: ts.JsxOpeningLikeElement) => node.pos > parent.pos && node.end < parent.parent.end;
  const selection = sections.find(node => value(node, "title") === "اختيار المحتوى");
  const display = sections.find(node => value(node, "title") === "إعدادات العرض");
  if (!canonical("ModuleEditorSection", "./ModuleEditorPresentation") ||
      !["AdminCard", "AdminFormGrid", "AdminFormListboxSelect", "AdminFormField"].every(name => canonical(name, "../ui")) ||
      sections.length !== 2 || !selection || !display || selection.pos >= display.pos) return false;
  const controls = (section: ts.JsxOpeningLikeElement) => elements.filter(node => inside(node, section) && ["AdminFormListboxSelect", "input"].includes(node.tagName.getText(tree)));
  const selectionControls = controls(selection), displayControls = controls(display);
  if (selectionControls.map(node => value(node, "name")).join("|") !== "source_kind|category_slug|content_type|widget_key|limit" ||
      displayControls.map(node => value(node, "name")).join("|") !== "presentation") return false;
  const rows = [
    ["source_kind", "مصدر المحتوى", "sourceKind", "setSourceKind"],
    ["category_slug", "التصنيف", "categorySlug", "setCategorySlug"],
    ["content_type", "نوع محتوى المركز الإعلامي", "contentType", "setContentType"],
    ["widget_key", "طريقة الاختيار", "widgetKey", "handleWidgetChange"],
    ["presentation", "شكل العرض", "presentation", "setPresentation"],
  ];
  for (const [name, label, state, setter] of rows) {
    const control = [...selectionControls, ...displayControls].find(node => value(node, "name") === name);
    if (!control || value(control, "label") !== label || value(control, "value") !== state || value(control, "sizing") !== "full") return false;
    const change = attribute(control, "onChange")?.initializer;
    const expression = change && ts.isJsxExpression(change) ? change.expression : undefined;
    if (!expression || !(ts.isIdentifier(expression) && expression.text === setter || find(expression, ts.isCallExpression).some(call => call.expression.getText(tree) === setter))) return false;
    if (!elements.some(card => card.tagName.getText(tree) === "AdminCard" && value(card, "presentation") === "premium" && inside(control, card))) return false;
  }
  const limit = selectionControls.find(node => value(node, "name") === "limit");
  const limitField = elements.find(node => node.tagName.getText(tree) === "AdminFormField" && limit && inside(limit, node));
  const limitChange = limit && attribute(limit, "onChange")?.initializer;
  return Boolean(limit && limitField && value(limitField, "label") === "عدد العناصر" && attribute(limitField, "required") &&
    value(limit, "type") === "number" && value(limit, "min") === "1" && value(limit, "max") === "60" && value(limit, "value") === "limit" && attribute(limit, "required") &&
    limitChange && find(limitChange, ts.isCallExpression).some(call => call.expression.getText(tree) === "setLimit") &&
    elements.some(node => node.tagName.getText(tree) === "AdminFormGrid" && inside(node, selection) && value(node, "columns") === "2") &&
    elements.some(node => node.tagName.getText(tree) === "AdminFormGrid" && inside(node, display) && value(node, "columns") === "3") &&
    elements.some(node => node.tagName.getText(tree) === "ContentDisplaySettings" && inside(node, display)));
}
const pagesComposition = sharedPresentation.slice(
  sharedPresentation.indexOf("export function ModuleEditorPagesTab("),
  sharedPresentation.indexOf("export function ModuleEditorFeedbackSlot("),
);
check(
  "all Sidebar members adopt the shared editor without ID or slug allowlists and preserve tab IDs",
  !editor.includes("block.slug") &&
    !/block\.id\s*(?:===|!==|==|!=)/u.test(editor) &&
    !editor.includes("media-sidebar-sections") &&
    !editor.includes("media-sidebar-latest") &&
    !editor.includes("media-sidebar-popular") &&
    (editor.match(/<ModuleEditorTabs\b/gu) ?? []).length === 1 &&
    (editor.match(/id: "(?:content|pages)"/gu) ?? []).join(",") === 'id: "content",id: "pages"' &&
    !editor.includes("<AdminModuleTabs"),
);
check(
  "family Sections, labelled fields, ordered controls and callbacks directly adopt existing shared premium owners",
  hasSidebarCanonicalSections(editor) &&
    (editor.match(/sectionHeaderPresentation: "control"/gu) ?? []).length === 2 &&
    !editor.includes("MODULE_EDITOR_CONTROL_CARD_CLASS_NAME") &&
    !/import[^;]*\.(?:css|scss)["']/u.test(editor),
);
const sidebarSyntax = displaySyntax(editor);
const sidebarFields = sidebarSyntax.find(sidebarSyntax.tree, ts.isJsxSelfClosingElement);
const sourceField = sidebarFields.find(node => sidebarSyntax.value(node, "name") === "source_kind");
const widgetField = sidebarFields.find(node => sidebarSyntax.value(node, "name") === "widget_key");
assert.ok(sourceField && widgetField && sourceField.pos < widgetField.pos);
const reorderedSidebar = editor.slice(0, sourceField.getStart(sidebarSyntax.tree)) + widgetField.getText(sidebarSyntax.tree) +
  editor.slice(sourceField.end, widgetField.getStart(sidebarSyntax.tree)) + sourceField.getText(sidebarSyntax.tree) + editor.slice(widgetField.end);
check("Sidebar composition negatives reject removed Sections/Fields, lost or renamed labels, detached callbacks and reordered native controls", [
  editor.replaceAll("ModuleEditorSection", "UnownedSection"),
  editor.replaceAll("AdminFormField", "UnownedField"),
  editor.replace('label="مصدر المحتوى"', 'aria-label="مصدر المحتوى"'),
  editor.replace('label="شكل العرض"', 'label="عنوان غير صحيح"'),
  editor.replace("onChange={setCategorySlug}", "onChange={unownedChange}"),
  reorderedSidebar,
].every(input => { assert.notEqual(input, editor, "Negative must change actual Sidebar source"); return !hasSidebarCanonicalSections(input); }));
check(
  "family display switches stay mounted through source changes but excluded from navigation FormData",
  (editor.match(/<ContentDisplaySettings\b/gu) ?? []).length === 1 &&
    /<fieldset\s+hidden=\{widgetKey === "sections"\}\s+disabled=\{widgetKey === "sections"\}[\s\S]*?<ContentDisplaySettings[\s\S]*?<\/fieldset>/u.test(editor) &&
    !/widgetKey !== "sections" \? \(\s*<fieldset/u.test(editor) &&
    ["title", "image", "category", "series", "excerpt", "date"].every((field) => editor.includes("initialContentConfig.display." + field)) &&
    editor.includes("MEDIA_SIDEBAR_WIDGET_DEFAULTS[nextWidgetKey].defaultLimit ?? limit"),
);
check(
  "usage notice suppression belongs to the shared pages owner and keeps its default outside the family",
  pagesComposition.includes("showUsageBanner = true") &&
    pagesComposition.includes("showUsageBanner?: boolean") &&
    /\{showUsageBanner \? \([\s\S]*?<ModuleCrossPageUsageBanner[\s\S]*?\) : null\}/u.test(pagesComposition) &&
    editor.includes("showUsageBanner={false}") &&
    !editor.includes("<ModuleCrossPageUsageBanner") &&
    usageBanner.includes("للقراءة والتنبيه فقط") &&
    !/<(?:button|form|input)\b/u.test(usageBanner),
);
check(
  "family page assignments keep authoritative rows and position management through the unified shared composition",
  /<ModuleEditorPagesTab\b(?=[^>]*showUsageBanner=\{false\})(?![^>]*\bpresentation=)[^>]*\/>/u.test(editor) &&
    !pagesComposition.includes("presentation?:") &&
    pagesComposition.includes("<ModulePageAssignmentsField") &&
    pagesComposition.includes("pages={assignmentContext.pages}") &&
    pagesComposition.includes("assignedPageIds={assignmentContext.assignments.map(") &&
    pagesComposition.includes("(row) => row.page_id") &&
    !editor.includes("<ModulePageAssignmentsField"),
);
check(
  "the display owner delegates the optional 3/2/1 layout to AdminFormGrid and retains its exact default layout",
  /<ContentDisplaySettings\s+columns=\{3\}/u.test(editor) &&
    displayControls.includes('columns?: ComponentProps<typeof AdminFormGrid>["columns"]') &&
    displayControls.includes('from "../../ui/AdminFormRuntime"') &&
    displayControls.includes('<AdminFormGrid columns={columns} density={presentation === "premium-inline" ? "compact" : undefined}>{controls}</AdminFormGrid>') &&
    displayControls.includes('{columns === undefined ? controls : (') &&
    displayControls.includes('className={columns === undefined') &&
    displayControls.includes('"grid scroll-mt-24 gap-3 sm:grid-cols-2 lg:grid-cols-4"') &&
    gridOwner.includes('"grid-cols-1 md:grid-cols-2 xl:grid-cols-3"') &&
    (displayControls.match(/<TopicFormSwitch\b/gu) ?? []).length === 7 &&
    ["title", "image", "category", "series", "excerpt", "date", "intro_card"].every((field) =>
      (displayControls.match(new RegExp('name="show_' + field + '_on_page"', "gu")) ?? []).length === 1,
    ) &&
    displayControls.includes("includeIntroCard = true") &&
    displayControls.includes('id="content-display-settings"') &&
    displayControls.includes("{children}"),
);
check(
  "the optional canonical Display section leaves Sidebar controls-only while Article create, edit and Media use one independent four-column tab",
  hasOptionalCanonicalDisplaySection(displayControls) && hasSidebarControlsOnly(editor) &&
    displayTabConsumers.length === 3 && displayTabConsumers.every(hasIndependentDisplayTab),
);
check(
  "negative Display adoption fixtures reject forced defaults, parallel headers, Sidebar opt-in and duplicate or misplaced consumer controls",
  !hasOptionalCanonicalDisplaySection(displayControls.replace("  sectionHeading,", '  sectionHeading = "forced",')) &&
    !hasOptionalCanonicalDisplaySection(displayControls.replace("<AdminModuleSectionHeader", "<ParallelSectionHeader")) &&
    !hasOptionalCanonicalDisplaySection(displayControls.replace(") : displayControls;", ") : <AdminCard>{displayControls}</AdminCard>;")) &&
    !hasSidebarControlsOnly(editor.replace("<ContentDisplaySettings", '<ContentDisplaySettings sectionHeading="unexpected"')) &&
    displayTabConsumers.every((consumer) => !hasIndependentDisplayTab(consumer.replace('id: "display"', 'id: "basic"')) &&
      !hasIndependentDisplayTab(consumer.replace("<ContentBasicDataPanel", "<ContentBasicDataPanel displaySettings={parallelDisplay}")) &&
      !hasIndependentDisplayTab(consumer.replace("<ContentDisplaySettings", '<ContentDisplaySettings sectionHeading="duplicate"'))),
);
check(
  "inactive tabs remain mounted under the existing tabs and native save owners",
  sharedTabs.includes("hidden={tab.id !== activeId}") &&
    sharedTabs.includes("{tab.content}") &&
    editor.includes("<form action={updateAction}>") &&
    editor.includes("<AdminFormPendingFields>") &&
    editor.includes("<ModuleEditorIdentitySection") &&
    editor.includes("<ModuleEditorSaveArea />") &&
    editor.includes('name="description"') &&
    editor.includes('value={block.description ?? ""}'),
);

const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
const configContract = await jiti.import<typeof import("../src/lib/media-sidebar-modules/parse-config.ts")>(
  resolve(root, "src/lib/media-sidebar-modules/parse-config.ts"),
);
const metadataContract = await jiti.import<typeof import("../src/lib/page-composition/module-registry-metadata.ts")>(
  resolve(root, "src/lib/page-composition/module-registry-metadata.ts"),
);
function form(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}
const contentFields = {
  source_kind: "media-center", content_type: "news", limit: "9", presentation: "list",
  show_title_on_page: "on", show_category_on_page: "on", show_excerpt_on_page: "on",
};
const expectedDisplay = { title: true, image: false, category: true, series: false, excerpt: true, date: false };
for (const widget of ["latest", "popular"] as const) {
  for (const source of [
    { fields: { source_kind: "categories", category_slug: "qa-category" }, value: { kind: "categories", categorySlug: "qa-category" } },
    { fields: { source_kind: "media-center", content_type: "all" }, value: { kind: "media-center", contentType: "all" } },
    { fields: { source_kind: "media-center", content_type: "video" }, value: { kind: "media-center", contentType: "video" } },
  ]) {
    for (const presentation of ["list", "single-carousel", "group-carousel"] as const) {
      for (const limit of [1, 60]) {
        const built = configContract.buildMediaSidebarModuleConfig(widget, form({
          ...contentFields, ...source.fields, presentation, limit: String(limit),
        } as Record<string, string>));
        assert.deepEqual(built, { source: source.value, limit, presentation, display: expectedDisplay });
        assert.deepEqual(configContract.parseMediaSidebarModuleConfig(built, widget), built);
      }
    }
  }
}
check("real build/read preserves both content widgets, source branches, all presentations, six display flags and 1/60 bounds", true);
for (const limit of ["", "0", "61", "1.5", "invalid", "-1"]) {
  assert.throws(() => configContract.buildMediaSidebarModuleConfig("latest", form({ ...contentFields, limit })), /بين 1 و60/u);
}
assert.throws(() => configContract.buildMediaSidebarModuleConfig("latest", form({ ...contentFields, source_kind: "categories", category_slug: "" })), /اختر تصنيف/u);
assert.throws(() => configContract.buildMediaSidebarModuleConfig("latest", form({ ...contentFields, content_type: "invalid" })), /نوع محتوى صالح/u);
assert.throws(() => configContract.buildMediaSidebarModuleConfig("latest", form({ ...contentFields, presentation: "invalid" })), /شكل عرض صالح/u);
assert.throws(() => configContract.parseMediaSidebarWidgetKey("invalid"));
check("real validation keeps invalid widget, filter, presentation and capacity inputs rejected", true);
assert.deepEqual(configContract.buildMediaSidebarModuleConfig("sections", form({
  ...contentFields, limit: "invalid", presentation: "invalid", category_slug: "unused",
})), { source: "navigation", menuParent: configContract.MEDIA_SIDEBAR_DEFAULT_MENU_PARENT });
check("navigation sections keep their canonical save shape without serializing inactive content fields", true);
assert.deepEqual(configContract.parseMediaSidebarModuleConfig({ source: "topics" }, "latest"), {
  source: { kind: "media-center", contentType: "news" }, limit: 3, presentation: "list",
  display: { title: true, image: true, category: false, series: false, excerpt: false, date: true },
});
assert.deepEqual(configContract.parseMediaSidebarModuleConfig({ source: "topics" }, "popular"), {
  source: { kind: "media-center", contentType: "all" }, limit: 4, presentation: "list",
  display: { title: true, image: true, category: true, series: true, excerpt: false, date: true },
});
check("actual legacy rows retain latest and popular source, count and display defaults", true);
const storedFamilyFixtures = [
  {
    widgetKey: "sections" as const,
    config: { source: "navigation", menuParent: "/media-center" },
    expected: { source: "navigation", menuParent: "/media-center" },
  },
  {
    widgetKey: "latest" as const,
    config: { type: "news", limit: 3, source: "topics" },
    expected: {
      source: { kind: "media-center", contentType: "news" }, limit: 3, presentation: "list",
      display: { title: true, image: true, category: false, series: false, excerpt: false, date: true },
    },
  },
  {
    widgetKey: "popular" as const,
    config: { limit: 4, source: "topics", isPopular: true },
    expected: {
      source: { kind: "media-center", contentType: "all" }, limit: 4, presentation: "list",
      display: { title: true, image: true, category: true, series: true, excerpt: false, date: true },
    },
  },
];
for (const fixture of storedFamilyFixtures) {
  const before = JSON.stringify(fixture.config);
  assert.deepEqual(configContract.parseMediaSidebarModuleConfig(fixture.config, fixture.widgetKey), fixture.expected);
  assert.equal(JSON.stringify(fixture.config), before);
}
check("all three observed family record shapes retain navigation and legacy defaults without rewriting stored data", true);
for (const slug of [undefined, "media-sidebar-sections", "media-sidebar-latest", "media-sidebar-popular", "future-sidebar-consumer"]) {
  const content = metadataContract.getModuleEditorSectionMetadata("media-sidebar", "content", slug);
  const pages = metadataContract.getModuleEditorSectionMetadata("media-sidebar", "pages", slug);
  assert.equal(content?.navigationLabelAr, "إعدادات المحتوى");
  assert.equal(pages?.navigationLabelAr, "الظهور");
  assert.equal(content?.sectionHeadingAr, "إعدادات الشريط الجانبي");
  assert.equal(content?.sectionDescriptionAr, "حدّد مصدر المحتوى وطريقة الاختيار وعدد العناصر المعروضة.");
  assert.equal(content?.icon, "media");
  assert.equal(pages?.operationalRole, "visibility");
}
for (const slug of ["media-sidebar-sections", "media-sidebar-latest", "media-sidebar-popular"]) {
  assert.equal(metadataContract.SLOT_MODULE_SLUG_METADATA[slug], undefined);
}
check("family metadata supplies both unchanged tab IDs for current and future members without slug overrides", true);

console.log(
  `Media Sidebar content capability verification passed (${passed} checks).`,
);
