import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createElement, Fragment } from "react";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const editor = read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx");
const sharedRichTextEditor = read("src/components/admin/AdminRichTextEditor.tsx");
const faq = read("src/components/admin/content/editors/article/FaqEditor.tsx");
const seo = read("src/components/admin/SeoPanel.tsx");
const sharedSeo = read("src/components/admin/seo/AdminEntitySeoPanel.tsx");
const review = read("src/components/admin/content-workflow/ContentReviewPanel.tsx");
const sharedReview = read("src/components/admin/review/AdminEntityReviewPanel.tsx");
const publishing = read("src/components/admin/content/editors/ContentPublishingOptions.tsx");
const create = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const edit = read("src/components/admin/content/editors/ArticleEditor.tsx");
const media = read("src/components/admin/content/editors/media/MediaContentForm.tsx");
const shell = read("src/components/admin/content/editors/ContentEditorShell.tsx");
const basic = read("src/components/admin/content/editors/ContentBasicDataPanel.tsx");
const helper = read("src/app/admin/content/topics/article-actions/helpers.ts");
const publicPage = read("src/app/(site)/topics/[slug]/page.tsx");
const migration = read("sql/migrations/20260721143000_topics_page_display_settings.sql");
const displaySettings = read("src/components/admin/content/editors/ContentDisplaySettings.tsx");
const topicSwitch = read("src/components/admin/content/editors/article/TopicFormSwitch.tsx");
const sharedSwitch = read("src/components/admin/ui/AdminFormSwitch.tsx");
const previewCapability = read("src/lib/admin/interaction-system/entity-preview-capability.ts");
const contentPreviewCapability = read("src/lib/admin/content/entity-preview-capabilities.ts");
const previewActions = read("src/components/admin/ui/AdminEntityPreviewActions.tsx");
const tabsOwner = read("src/components/admin/ui/AdminModuleTabs.tsx");
const navigationEvent = read("src/components/admin/content/editors/content-editor-navigation.ts");

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check("Article content adopts the shared visual editor once", editor.match(/<AdminRichTextEditor\b/g)?.length === 1 && editor.includes('storageFormat="markdown"') && editor.includes("enableArticleStructure"));
check("shared visual toolbar owns paragraph, H2, H3, bold, lists and links", ["setParagraph()", "toggleHeading({ level: 2 })", "toggleHeading({ level: 3 })", "toggleBold()", "toggleBulletList()", "toggleOrderedList()", "setLink"].every((token) => sharedRichTextEditor.includes(token)));
check("shared editor keeps native TipTap keyboard and RTL semantics", sharedRichTextEditor.includes("<EditorContent editor={editor}") && sharedRichTextEditor.includes('dir: "rtl"') && sharedRichTextEditor.includes("StarterKit.configure"));
check("content toolbar has no retired Markdown textarea engine", !editor.includes("<textarea") && !editor.includes("replaceSelection") && !editor.includes("prefixSelection"));
check("content statistics retain heading and internal-link analysis", ["H2", "H3", "روابط داخلية"].every((label) => editor.includes(`label="${label}"`)) && editor.includes("markdownInternalLinks + htmlInternalLinks"));
check("keyword density remains in SEO rather than the body owner", !editor.includes("keywordDensity") && seo.includes('"keyword-density"') && sharedSeo.includes("analysis.metrics.map") && sharedSeo.includes("data-admin-entity-seo-metric={metric.id}"));

check("FAQ uses shared confirmation and drag reorder", faq.includes("AdminConfirmDialog") && !faq.includes("window.confirm") && faq.includes("draggable") && faq.includes("onDrop"));
check("FAQ owns its visibility fields once", faq.match(/name="show_faq_on_page"/g)?.length === 1 && faq.match(/name="show_faq_title_on_page"/g)?.length === 1 && !displaySettings.includes('name="show_faq_on_page"'));
check("FAQ visibility survives empty-list saves", helper.includes("faqEditorPresent") && helper.includes("!payload.faqEditorPresent"));
check("public FAQ obeys both display flags", publicPage.includes("topic.showFaqOnPage && topic.faq.length") && publicPage.includes("topic.showFaqTitleOnPage"));
check("FAQ migrations remain additive", migration.includes("show_faq_on_page boolean not null default true") && migration.includes("show_faq_title_on_page boolean not null default true"));

for (const field of ["seoTitle", "seoDescription", "focusKeyword", "seoKeywords", "canonicalUrl", "robotsIndex", "robotsFollow", "ogImage", "ogImageAlt"]) {
  check(`SEO field adapter retains ${field}`, seo.includes("ENTITY_SEO_FIELD_NAMES") && sharedSeo.includes(`fieldNames.${field}`));
}
check("SEO avoids duplicate slug and image-alt owners", !seo.includes('name="slug"') && !seo.includes('name="image_alt"'));
check("SEO adapter keeps the public article path", seo.includes('publicPathPrefix="/topics"'));
check("SEO adapter adds typed topic analysis to the shared panel", seo.includes('profile: "article"') && seo.includes("resolveFaq: (state) => state.faq") && seo.includes("analysisExtension={createTopicAnalysisExtension") && sharedSeo.includes("analyzeEntitySeo(analysisInput)") && sharedSeo.includes("analysis.issues.map"));

check("publishing owns status, featured, popular and date without a save engine", publishing.includes('name="status"') && publishing.includes('name="is_featured"') && publishing.includes('name="is_popular"') && publishing.includes("TopicDateLabelField") && !publishing.includes("SaveBar"));
check("publishing and display switches delegate to the shared switch DOM", topicSwitch.match(/<AdminFormSwitch\b/g)?.length === 1 && !topicSwitch.includes("<input") && sharedSwitch.match(/type="checkbox"/g)?.length === 1 && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => displaySettings.includes(`name="${name}"`)));
check("review stays read-only and separates three guidance analyses from blocking Validation", ["جاهزية المحتوى", "جاهزية الصور وAlt", "تحليل SEO"].every((label) => review.includes(label)) && sharedReview.includes("التحقق العام (Validation)") && sharedReview.includes('variant="guidance"') && sharedReview.includes('variant="validation"') && !review.includes('<input type="hidden" name="status"') && ![review, sharedReview].some((source) => source.includes("AdminSingleOpenAccordion")));
check("article adapters slot the shared publishing owner into the shared dashboard", [create, edit].every((source) => /<ContentReviewPanel\b[\s\S]*?publishingOptions=\{[\s\S]*?<ContentPublishingOptions\b/.test(source)));

check("create and edit use exactly one unified shell", [create, edit].every((source) => source.match(/<ContentEditorShell\b/g)?.length === 1));
check("shell owns one shared tab renderer and one action row", shell.match(/<AdminModuleTabs\b/g)?.length === 1 && shell.match(/<AdminFormActions\b/g)?.length === 1);
check("shared content shell preserves the existing Review Section Hero default and shared context owner", ["مراجعة المحتوى وحالة النشر", "راجع جاهزية المحتوى وإعدادات الظهور، ثم عالج الملاحظات قبل النشر."].every((label) => shell.includes(label)) && shell.includes('if (tab.id !== "publish") return tab;') && shell.includes("...CONTENT_REVIEW_TAB_SECTION") && shell.includes("tabs={presentedTabs}") && !review.includes("data-admin-tab-section-heading"));
function assertUnifiedReviewTransport(create, edit, media, shell, publishing) {
  const parse = source => ts.createSourceFile("ReviewTabs.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes = (root, predicate) => { const found = []; const visit = node => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }; visit(root); return found; };
  const unwrap = node => { while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node))) node = node.expression; return node; };
  const property = (node, name) => node.properties.filter(ts.isPropertyAssignment).find(value => value.name.getText() === name)?.initializer;
  const elements = (root, name) => nodes(root, node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === name);
  const attribute = (node, name) => { const value = node.attributes.properties.find(value => ts.isJsxAttribute(value) && value.name.getText() === name)?.initializer; return value && ts.isStringLiteral(value) ? value.text : value && ts.isJsxExpression(value) ? value.expression?.getText() : undefined; };
  const importOwner = (tree, name, path) => assert.ok(tree.statements.filter(ts.isImportDeclaration).some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === path && node.importClause?.name?.text === name), `Canonical ${name} import`);
  const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, jsxFactory: "createElement", jsxFragmentFactory: "Fragment" } }).outputText;
  const typesTree = parse(read("src/lib/admin/content/content-types.ts"));
  const typeDeclarations = ["CONTENT_TYPES", "MEDIA_EDITABLE_CONTENT_TYPES"].map(name => { const statement = typesTree.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(value => value.name.getText(typesTree) === name)); assert.ok(statement); return statement.getText(typesTree).replace(/^export\s+/u, ""); });
  const mediaTypes = new Function(compile(typeDeclarations.join("\n")) + ";return MEDIA_EDITABLE_CONTENT_TYPES;")();
  assert.ok(mediaTypes.length > 0 && new Set(mediaTypes).size === mediaTypes.length);
  function consumer(source, kind) {
    const tree = parse(source), mediaConsumer = kind === "media";
    importOwner(tree, "ContentEditorShell", mediaConsumer ? "../ContentEditorShell" : "./ContentEditorShell");
    importOwner(tree, "ContentReviewPanel", mediaConsumer ? "../../../content-workflow/ContentReviewPanel" : "../../content-workflow/ContentReviewPanel");
    importOwner(tree, "ContentPublishingOptions", mediaConsumer ? "../ContentPublishingOptions" : "./ContentPublishingOptions");
    const builders = nodes(tree, node => ts.isFunctionDeclaration(node) && node.name?.text === "renderTabs"); assert.equal(builders.length, 1);
    const returns = builders[0].body.statements.filter(ts.isReturnStatement); assert.equal(returns.length, 1); const array = unwrap(returns[0].expression); assert.ok(array && ts.isArrayLiteralExpression(array));
    const tabs = array.elements.filter(ts.isObjectLiteralExpression).filter(node => { const id = unwrap(property(node, "id")); return id && ts.isStringLiteral(id) && id.text === "publish"; }); assert.equal(tabs.length, 1);
    const tab = tabs[0], metadata = {};
    assert.ok(tab.properties.every(ts.isPropertyAssignment)); assert.equal(new Set(tab.properties.map(value => value.name.getText(tree))).size, tab.properties.length, "Publish metadata has no duplicate or spread override");
    for (const name of ["id", "navigationLabel", "sectionHeaderPresentation", "icon"]) { const value = unwrap(property(tab, name)); assert.ok(value && ts.isStringLiteral(value)); metadata[name] = value.text; }
    assert.deepEqual(metadata, { id: "publish", navigationLabel: "المراجعة", sectionHeaderPresentation: "premium", icon: "publish" });
    const shellUses = elements(tree, "ContentEditorShell"); assert.equal(shellUses.length, 1); assert.equal(attribute(shellUses[0], "tabs"), "renderTabs");
    const content = unwrap(property(tab, "content")); assert.ok(content && ts.isJsxSelfClosingElement(content) && content.tagName.getText(tree) === "ContentReviewPanel", "Actual returned publish tab keeps its Review owner");
    assert.equal(attribute(content, "presentation"), "panel");
    assert.equal(attribute(content, "formId"), mediaConsumer ? "formId" : kind === "create" ? "topic-create-form" : "topic-edit-form");
    const option = content.attributes.properties.find(node => ts.isJsxAttribute(node) && node.name.getText(tree) === "publishingOptions")?.initializer;
    const publisher = option && ts.isJsxExpression(option) ? unwrap(option.expression) : undefined;
    assert.ok(publisher && ts.isJsxSelfClosingElement(publisher) && publisher.tagName.getText(tree) === "ContentPublishingOptions");
    assert.equal(attribute(publisher, "presentation"), "panel");
    for (const name of ["status", "featured", "popular", "publishedAt", "dateLabel"]) assert.equal(attribute(publisher, name), attribute(content, name), `Review and native Publish retain the same ${name}`);
    assert.ok(attribute(publisher, "status") && attribute(publisher, "draftDisplayDate")?.startsWith("getTopicDraftDisplayDate("));
    if (mediaConsumer) assert.ok(tree.statements.filter(ts.isImportDeclaration).some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../../../../lib/admin/content/content-types" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(value => !value.propertyName && value.name.text === "MediaEditableContentType")) && source.includes("contentType: MediaEditableContentType;"), "All Media kinds use the canonical type owner");
    return metadata;
  }
  const metadata = [consumer(create, "create"), consumer(edit, "edit"), consumer(media, "media")];
  const tree = parse(shell);
  for (const [name, path] of [["AdminCard", "../../ui/AdminCard"]]) importOwner(tree, name, path);
  for (const name of ["AdminModuleSectionHeader", "AdminModuleTabs"]) assert.ok(tree.statements.filter(ts.isImportDeclaration).some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../ui/AdminModuleTabs" && (name === "AdminModuleTabs" ? node.importClause?.name?.text === name : node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(value => !value.propertyName && value.name.text === name))), `Canonical Shell ${name}`);
  for (const [name, path] of [["ADMIN_ENTITY_REVIEW_TAB_LABEL", "../../../../lib/admin/review/entity-review-presentation"], ["ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME", "../../../../lib/admin/admin-ui-styles"], ["ADMIN_FORM_STACK_CLASS_NAME", "../../ui"]]) assert.ok(tree.statements.filter(ts.isImportDeclaration).some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === path && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(value => !value.propertyName && value.name.text === name)), `Canonical Shell metadata ${name}`);
  const frames = tree.statements.filter(ts.isFunctionDeclaration).filter(node => node.name?.text === "ContentEditorShellFrame"); assert.equal(frames.length, 1);
  const statements = frames[0].body.statements.filter(ts.isVariableStatement).filter(node => node.declarationList.declarations.some(value => value.name.getText(tree) === "presentedTabs")); assert.equal(statements.length, 1);
  const map = statements[0].declarationList.declarations[0].initializer; assert.ok(map && ts.isCallExpression(map) && map.expression.getText(tree) === "tabs.map" && map.arguments.length === 1 && ts.isArrowFunction(map.arguments[0]));
  const renderedTabs = elements(frames[0], "AdminModuleTabs"); assert.equal(renderedTabs.length, 1); assert.equal(attribute(renderedTabs[0], "tabs"), "presentedTabs");
  const section = tree.statements.filter(ts.isVariableStatement).find(node => node.declarationList.declarations.some(value => value.name.getText(tree) === "CONTENT_REVIEW_TAB_SECTION")); assert.ok(section);
  const Card = () => null, Header = () => null, reviewLabel = "المراجعة", surface = "canonical-charcoal", stack = "canonical-stack";
  const run = new Function("tabs", "formId", "createElement", "Fragment", "AdminCard", "AdminModuleSectionHeader", "ADMIN_ENTITY_REVIEW_TAB_LABEL", "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME", "ADMIN_FORM_STACK_CLASS_NAME", compile(section.getText(tree) + "\n" + statements[0].getText(tree)) + ";return presentedTabs;");
  const ordinary = { id: "basic", content: createElement("input", { name: "title", defaultValue: "retained" }) }, content = createElement("input", { name: "status", defaultValue: "unpublished" }), indicator = createElement("span", null, "retained");
  let cases = 0;
  for (const [kind, selected] of [["article-create", metadata[0]], ["article-edit", metadata[1]], ...mediaTypes.map(kind => [kind, metadata[2]])]) {
    const input = { ...selected, content, indicator }, result = run([ordinary, input], kind, createElement, Fragment, Card, Header, reviewLabel, surface, stack);
    assert.equal(result[0], ordinary); const publish = result[1]; assert.equal(publish.id, "publish"); assert.equal(publish.indicator, indicator); assert.equal(publish.navigationLabel, reviewLabel);
    assert.equal(publish.sectionHeading, undefined); assert.equal(publish.sectionDescription, undefined); assert.equal(publish.icon, "publish");
    assert.equal(publish.content.type, "div"); assert.equal(publish.content.props.className, stack); assert.equal(publish.content.props.children.length, 2);
    const [card, preserved] = publish.content.props.children; assert.equal(preserved, content); assert.equal(card.type, Card); assert.equal(card.props.presentation, "premium");
    const header = card.props.children; assert.equal(header.type, Header); assert.equal(header.props.id, `${kind}-review-publish`); assert.equal(header.props.sectionHeading, reviewLabel); assert.equal(header.props.sectionDescription, "راجع جاهزية المحتوى وإعدادات الظهور، ثم عالج الملاحظات قبل النشر.");
    assert.equal(header.props.icon, "publish"); assert.equal(header.props.sectionHeaderPresentation, "premium"); assert.equal(header.props.sectionHeaderClassName, surface); assert.equal(header.props.standalone, true); cases += 1;
  }
  const aliasProperties = nodes(parse(tabsOwner), node => ts.isPropertySignature(node) && node.name.getText() === "sectionHeaderPresentation"); assert.equal(aliasProperties.length, 1); assert.ok(aliasProperties[0].type && ts.isUnionTypeNode(aliasProperties[0].type));
  const aliases = aliasProperties[0].type.types.map(value => { assert.ok(ts.isLiteralTypeNode(value) && ts.isStringLiteral(value.literal)); return value.literal.text; });
  const fallbackAliases = [undefined, ...aliases.filter(value => value !== "premium")];
  for (const presentation of fallbackAliases) {
    const input = { id: "publish", content, indicator, ...(presentation === undefined ? {} : { sectionHeaderPresentation: presentation }) };
    const [publish] = run([input], "unselected", createElement, Fragment, Card, Header, reviewLabel, surface, stack);
    assert.equal(publish.id, input.id); assert.equal(publish.content, content); assert.equal(publish.indicator, indicator); assert.equal(publish.navigationLabel, reviewLabel); assert.equal(publish.sectionHeading, "مراجعة المحتوى وحالة النشر"); assert.equal(publish.sectionDescription, "راجع جاهزية المحتوى وإعدادات الظهور، ثم عالج الملاحظات قبل النشر."); cases += 1;
  }
  const publishTree = parse(publishing), functions = publishTree.statements.filter(ts.isFunctionDeclaration).filter(node => node.name?.text === "ContentPublishingOptions"); assert.equal(functions.length, 1);
  importOwner(publishTree, "AdminFormSwitch", "../../ui/AdminFormSwitch"); importOwner(publishTree, "TopicFormSwitch", "./article/TopicFormSwitch");
  const state = nodes(functions[0], node => ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.name.elements.map(value => value.name?.getText()).join(",") === "published,setPublished"); assert.equal(state.length, 1); assert.equal(state[0].initializer?.getText(), 'useState(status === "published")');
  const native = elements(functions[0], "input").filter(node => attribute(node, "name") === "status"); assert.equal(native.length, 1); assert.equal(attribute(native[0], "type"), "hidden"); assert.equal(attribute(native[0], "value"), 'published ? "published" : "unpublished"');
  const toggles = elements(functions[0], "AdminFormSwitch"); assert.equal(toggles.length, 1); assert.equal(attribute(toggles[0], "checked"), "published"); assert.equal(attribute(toggles[0], "onChange"), "(event) => setPublished(event.target.checked)");
  assert.deepEqual(elements(functions[0], "TopicFormSwitch").map(node => [attribute(node, "name"), attribute(node, "defaultChecked")]), [["is_featured", "featured"], ["is_popular", "popular"]]);
  assert.equal(attribute(elements(functions[0], "TopicDateLabelField")[0], "defaultValue"), "dateLabel");
  return { mediaTypes, cases, fallbackAliases };
}
const unifiedReview = assertUnifiedReviewTransport(create, edit, media, shell, publishing);
check("Article Create/Edit and every canonical Media type select one shared Premium Review Header with intact native Publish and generic Shell fallback", unifiedReview.cases === unifiedReview.mediaTypes.length + 2 + unifiedReview.fallbackAliases.length);
const reviewShellTree = ts.createSourceFile("Shell.tsx", shell, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let reviewHeader;
const findReviewHeader = node => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(reviewShellTree) === "AdminModuleSectionHeader") reviewHeader = node; ts.forEachChild(node, findReviewHeader); }; findReviewHeader(reviewShellTree); assert.ok(reviewHeader);
const inactiveShellHeader = shell.slice(0, reviewHeader.getStart(reviewShellTree)) + `{false && ${reviewHeader.getText(reviewShellTree)}}` + shell.slice(reviewHeader.end);
for (const [name, values] of [
  ["omitted Article selection", [create.replace('sectionHeaderPresentation: "premium" as const,', ''), edit, media, shell, publishing]],
  ["Video-only Media selection", [create, edit, media.replace('sectionHeaderPresentation: "premium" as const,', 'sectionHeaderPresentation: videoPanel ? "premium" as const : undefined,'), shell, publishing]],
  ["unsupported Article selection", [create, edit.replace('sectionHeaderPresentation: "premium" as const,', 'sectionHeaderPresentation: "panel" as const,'), media, shell, publishing]],
  ["disconnected tab producer", [create.replace('tabs={renderTabs}', 'tabs={[]}'), edit, media, shell, publishing]],
  ["parallel Review owner", [create, edit, media.replace('from "../../../content-workflow/ContentReviewPanel"', 'from "../../../content-workflow/ParallelReview"'), shell, publishing]],
  ["disconnected native Publish", [create, edit, media.replace('<ContentPublishingOptions', '<ParallelPublishingOptions'), shell, publishing]],
  ["wrong publish identity", [create.replace('id: "publish",', 'id: "other-publish",'), edit, media, shell, publishing]],
  ["lost context indicator", [create, edit, media, shell.replace('indicator: tab.indicator,', 'indicator: undefined,'), publishing]],
  ["lost Shell content", [create, edit, media, shell.replace('{tab.content}', '{null}'), publishing]],
  ["inactive Shell Header", [create, edit, media, inactiveShellHeader, publishing]],
  ["duplicate Shell heading", [create, edit, media, shell.replace('sectionHeading: undefined,', 'sectionHeading: "duplicate",'), publishing]],
  ["changed generic Shell fallback", [create, edit, media, shell.replace('if (tab.sectionHeaderPresentation !== "premium") return reviewTab;', 'if (false) return reviewTab;'), publishing]],
  ["wrong native status", [create, edit, media, shell, publishing.replace('name="status"', 'name="other_status"')]],
  ["lost unchecked status", [create, edit, media, shell, publishing.replace('published ? "published" : "unpublished"', 'published ? "published" : "published"')]],
  ["disconnected native toggle", [create, edit, media, shell, publishing.replace('setPublished(event.target.checked)', 'setPublished(false)')]],
  ["wrong featured binding", [create, edit, media, shell, publishing.replace('defaultChecked={featured}', 'defaultChecked={popular}')]],
  ["wrong native initial status", [create, edit, media, shell, publishing.replace('useState(status === "published")', 'useState(true)')]],
  ["duplicate Review selection", [create, edit, media.replace('id: "publish",', 'id: "publish", sectionHeaderPresentation: "premium" as const,'), shell, publishing]],
]) {
  assert.ok(values.some((value, index) => value !== [create, edit, media, shell, publishing][index]), `Effective negative ${name}`);
  assert.throws(() => assertUnifiedReviewTransport(...values), name); check(`Unified Review rejects ${name}`, true);
}
check("shell binds tab navigation to one shared event", shell.includes("navigationEventName={CONTENT_EDITOR_NAVIGATION_EVENT}") && navigationEvent.includes('"content-editor:navigate"'));
check("create and edit mount every article tab capability once", [create, edit].every((source) => ["ContentBasicDataPanel", "TopicMarkdownEditor", "FaqEditor", "SeoPanel", "ContentPublishingOptions", "ContentReviewPanel"].every((token) => source.match(new RegExp(`<${token}\\b`, "g"))?.length === 1)));
function hasDisplayTabTransfer(source, expectedTabs) {
  const tree = ts.createSourceFile("ContentEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), tabs = [], owners = [];
  const visit = node => {
    if (ts.isObjectLiteralExpression(node)) {
      const id = node.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(tree) === "id")?.initializer;
      if (id && ts.isStringLiteral(id) && expectedTabs.includes(id.text)) tabs.push({ id: id.text, node });
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === "ContentDisplaySettings") owners.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const display = tabs.find(tab => tab.id === "display"), basic = tabs.find(tab => tab.id === "basic");
  return tabs.map(tab => tab.id).join("|") === expectedTabs.join("|") && owners.length === 1 && display && basic &&
    display.node.pos <= owners[0].pos && owners[0].end <= display.node.end && !basic.node.getText(tree).includes("displaySettings=") &&
    !source.includes("<form") && !display.node.getText(tree).includes("sectionHeading:") &&
    display.node.getText(tree).includes('navigationLabel: "إعدادات العرض"') && owners[0].attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(tree) === "sectionHeading" && ts.isStringLiteral(property.initializer) && property.initializer.text === "إعدادات العرض");
}
check("Article Create/Edit preserve five tabs with one independent canonical Display owner and no Basic duplicate", [create, edit].every(source => hasDisplayTabTransfer(source, ["basic", "display", "faq", "seo", "publish"])));
check("Media preserves its common tabs with one canonical Display owner and no added FAQ capability", hasDisplayTabTransfer(media, ["basic", "display", "seo", "publish"]) && !media.includes('id: "faq"'));
function hasMediaTabSeparation(source) {
  const tree = ts.createSourceFile("MediaContentForm.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes = predicate => { const result = []; const visit = node => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }; visit(tree); return result; };
  const property = (node, name) => node?.properties.find(row => ts.isPropertyAssignment(row) && row.name.getText(tree) === name)?.initializer;
  const unwrap = node => { while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node))) node = node.expression; return node; };
  const textIs = (node, value) => Boolean(node && ts.isStringLiteral(node) && node.text === value);
  const identifierIs = (node, value) => Boolean(node && ts.isIdentifier(node) && node.text === value);
  const isKind = (node, kind) => Boolean(node && ts.isBinaryExpression(node) && identifierIs(node.left, "contentType") && node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && textIs(node.right, kind));
  const render = nodes(node => ts.isFunctionDeclaration(node) && node.name?.text === "renderTabs");
  const returned = render[0]?.body?.statements.find(ts.isReturnStatement)?.expression;
  if (render.length !== 1 || !returned || !ts.isArrayLiteralExpression(returned) || returned.elements.length !== 5) return false;
  const [basicTab, mediaSpread, displayTab, seoTab, publishTab] = returned.elements;
  if (![basicTab, displayTab, seoTab, publishTab].every(ts.isObjectLiteralExpression) ||
    !["basic", "display", "seo", "publish"].every((id, index) => textIs(property([basicTab, displayTab, seoTab, publishTab][index], "id"), id)) || !ts.isSpreadElement(mediaSpread)) return false;
  const conditional = unwrap(mediaSpread.expression), condition = conditional && ts.isConditionalExpression(conditional) ? unwrap(conditional.condition) : null;
  if (!condition || !ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.BarBarToken || !isKind(condition.left, "video") || !isKind(condition.right, "gallery") ||
    !ts.isArrayLiteralExpression(conditional.whenTrue) || conditional.whenTrue.elements.length !== 1 || !ts.isArrayLiteralExpression(conditional.whenFalse) || conditional.whenFalse.elements.length !== 0) return false;
  const mediaTab = conditional.whenTrue.elements[0], label = property(mediaTab, "navigationLabel"), content = unwrap(property(mediaTab, "content"));
  if (!ts.isObjectLiteralExpression(mediaTab) || !identifierIs(property(mediaTab, "id"), "contentType") || !textIs(unwrap(property(mediaTab, "icon")), "media") ||
    !label || !ts.isConditionalExpression(label) || !isKind(label.condition, "video") || !textIs(label.whenTrue, "الفيديو") || !textIs(label.whenFalse, "معرض الصور") ||
    !content || !ts.isJsxElement(content) || content.openingElement.tagName.getText(tree) !== "AdminCard" ||
    !content.openingElement.attributes.properties.some(row => ts.isJsxAttribute(row) && row.name.getText(tree) === "presentation" && textIs(row.initializer, "premium")) ||
    content.children.filter(ts.isJsxExpression).length !== 1 || !identifierIs(content.children.find(ts.isJsxExpression)?.expression, "bodyEditor")) return false;
  const basics = nodes(node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === "ContentBasicDataPanel");
  const slot = basics[0]?.attributes.properties.find(row => ts.isJsxAttribute(row) && row.name.getText(tree) === "contentEditor")?.initializer;
  const expression = slot && ts.isJsxExpression(slot) ? slot.expression : null;
  const body = nodes(node => ts.isVariableDeclaration(node) && identifierIs(node.name, "bodyEditor"));
  const specialized = nodes(node => ts.isVariableDeclaration(node) && identifierIs(node.name, "specializedBodyEditor"));
  const specializedExpression = unwrap(specialized[0]?.initializer);
  const galleryExpression = specializedExpression && ts.isConditionalExpression(specializedExpression) ? specializedExpression.whenFalse : null;
  const branchOwns = (node, owner) => { const matches = nodes(row => (ts.isJsxOpeningElement(row) || ts.isJsxSelfClosingElement(row)) && row.tagName.getText(tree) === owner); return Boolean(node && matches.length === 1 && matches[0].pos > node.pos && matches[0].end <= node.end); };
  const owners = ["MediaVideoFields", "AdminMediaGalleryField", "TopicMarkdownEditor"];
  return basics.length === 1 && basics[0].pos > basicTab.pos && basics[0].end < basicTab.end && expression && ts.isConditionalExpression(expression) &&
    expression.condition.getText(tree) === 'adapter.body === "markdown"' && identifierIs(expression.whenTrue, "bodyEditor") && expression.whenFalse.kind === ts.SyntaxKind.NullKeyword &&
    body.length === 1 && body[0].initializer && body[0].initializer.getText(tree).includes("{specializedBodyEditor}") && specialized.length === 1 &&
    specializedExpression && ts.isConditionalExpression(specializedExpression) && specializedExpression.condition.getText(tree) === 'adapter.body === "video"' && branchOwns(specializedExpression.whenTrue, "MediaVideoFields") &&
    galleryExpression && ts.isConditionalExpression(galleryExpression) && galleryExpression.condition.getText(tree) === 'adapter.body === "gallery"' && branchOwns(galleryExpression.whenTrue, "AdminMediaGalleryField") && branchOwns(galleryExpression.whenFalse, "TopicMarkdownEditor") &&
    owners.every(owner => { const matches = nodes(node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === owner); return matches.length === 1 && matches[0].pos > specialized[0].pos && matches[0].end < specialized[0].end; });
}
check("Video and Gallery insert their typed media tab immediately after Basic while Markdown stays in Content", hasMediaTabSeparation(media));
for (const [label, from, to] of [
  ["Video capability leaked to News", 'contentType === "video" || contentType === "gallery"', 'contentType === "news" || contentType === "gallery"'],
  ["Gallery capability omitted", 'contentType === "video" || contentType === "gallery"', 'contentType === "video" || contentType === "video"'],
  ["Wrong typed media id", 'id: contentType,', 'id: "media",'],
  ["Wrong Video label", 'navigationLabel: contentType === "video" ? "الفيديو" : "معرض الصور"', 'navigationLabel: contentType === "video" ? "المحتوى" : "معرض الصور"'],
  ["Wrong Gallery label", 'navigationLabel: contentType === "video" ? "الفيديو" : "معرض الصور"', 'navigationLabel: contentType === "video" ? "الفيديو" : "المحتوى"'],
  ["Wrong specialized Video owner", 'adapter.body === "video" ? (', 'adapter.body === "gallery" ? ('],
  ["Specialized fields duplicated in Basic", 'contentEditor={adapter.body === "markdown" ? bodyEditor : null}', 'contentEditor={bodyEditor}'],
  ["Specialized media disconnected", '{bodyEditor}', '{null}'],
]) {
  check(`Media tab negative rejects ${label}`, media.includes(from) && !hasMediaTabSeparation(media.replace(from, to)));
}
check("negative Display tab fixtures reject lost owner, duplicated Basic injection, missing tab and duplicate Section Hero", [create, edit, media].every(source => {
  const expected = source === media ? ["basic", "display", "seo", "publish"] : ["basic", "display", "faq", "seo", "publish"];
  return !hasDisplayTabTransfer(source.replace("<ContentDisplaySettings", "<ParallelDisplaySettings"), expected) &&
    !hasDisplayTabTransfer(source.replace("<ContentBasicDataPanel", "<ContentBasicDataPanel displaySettings={<ContentDisplaySettings />}"), expected) &&
    !hasDisplayTabTransfer(source.replace('id: "display"', 'id: "missing-display"'), expected) &&
    !hasDisplayTabTransfer(source.replace('navigationLabel: "إعدادات العرض",', 'navigationLabel: "إعدادات العرض", sectionHeading: "إعدادات العرض",'), expected);
}));
check("tab content has no retired standalone content tab", !create.includes('id: "content"') && !edit.includes('id: "content"'));
check("basic tab injects the canonical Markdown owner", basic.includes("contentEditor") && create.match(/<TopicMarkdownEditor/g)?.length === 1 && edit.match(/<TopicMarkdownEditor/g)?.length === 1);

check("shared tabs expose the editor preset", tabsOwner.includes('variant?: "pills" | "segmented" | "underline" | "editor"') && tabsOwner.includes("ADMIN_EDITOR_TAB_CONTAINER_CLASS_NAME") && tabsOwner.includes("ADMIN_EDITOR_TAB_CLASS_NAME"));
check("editor tabs keep a one-row overflow geometry", ["flex-nowrap", "overflow-x-auto", "shrink-0", "whitespace-nowrap"].every((token) => tabsOwner.includes(token)));
check("tab panels stay mounted while inactive", tabsOwner.includes("tabs.map((tab) =>") && tabsOwner.includes("hidden={tab.id !== activeId}"));
check("tab semantics and keyboard navigation remain accessible", ['role="tablist"', 'role="tab"', 'role="tabpanel"', "aria-selected={isActive}", "tabIndex={isActive ? 0 : -1}", 'event.key === "ArrowRight"', 'event.key === "ArrowLeft"'].every((token) => tabsOwner.includes(token)));
check("validation navigation activates and focuses the requested tab field", tabsOwner.includes("focusNavigationTarget(targetId)") && tabsOwner.includes("window.addEventListener(navigationEventName, navigate)"));

check("edit-only preview remains capability driven outside the shared shell", previewCapability.includes("resolveAdminEntityPreviewActions") && contentPreviewCapability.includes("buildAdminContentPreviewCapability") && previewActions.includes("resolveAdminEntityPreviewActions") && edit.match(/<AdminEntityPreviewActions\b/g)?.length === 1 && edit.indexOf("<AdminEntityPreviewActions capability={previewCapability}") < edit.indexOf("<ContentEditorShell") && !create.includes("AdminEntityPreviewActions") && !publishing.includes("next/link"));
check("retired topic-only tab and publishing owners are not referenced", ![create, edit, shell].some((source) => source.includes("TopicEditTabs") || source.includes("TopicPublishingOptions")));

console.log(`verify:topic-editor-tabs passed (${passed} assertions)`);
