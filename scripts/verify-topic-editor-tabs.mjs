import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

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
function hasScopedReviewSection(source, selected) {
  const tree = ts.createSourceFile("ReviewTabs.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), tabs = [], selectors = [];
  const visit = node => { if (ts.isObjectLiteralExpression(node) && node.properties.some(property => ts.isPropertyAssignment(property) && property.name.getText(tree) === "id" && ts.isStringLiteral(property.initializer) && property.initializer.text === "publish")) tabs.push(node); if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "videoPanel") selectors.push(node); ts.forEachChild(node, visit); }; visit(tree);
  const presentation = tabs[0]?.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(tree) === "sectionHeaderPresentation")?.initializer;
  if (selected === "video") {
    const predicate = selectors[0]?.initializer;
    const premium = presentation && ts.isConditionalExpression(presentation) ? presentation.whenTrue : undefined;
    return tabs.length === 1 && selectors.length === 1 && predicate && ts.isBinaryExpression(predicate) && ts.isIdentifier(predicate.left) && predicate.left.text === "contentType" && predicate.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isStringLiteral(predicate.right) && predicate.right.text === "video" &&
      presentation && ts.isConditionalExpression(presentation) && ts.isIdentifier(presentation.condition) && presentation.condition.text === "videoPanel" && premium && ts.isAsExpression(premium) && ts.isStringLiteral(premium.expression) && premium.expression.text === "premium" && ts.isIdentifier(presentation.whenFalse) && presentation.whenFalse.text === "undefined";
  }
  return tabs.length === 1 && (selected ? presentation?.getText(tree) === '"premium" as const' : presentation === undefined);
}
check("Article and Video Review select one canonical Premium Shell Header while other Media retain the existing Section Hero default", hasScopedReviewSection(create, true) && hasScopedReviewSection(edit, true) && hasScopedReviewSection(media, "video") && shell.includes('if (tab.sectionHeaderPresentation !== "premium") return reviewTab;') && shell.includes('sectionHeading: undefined') && shell.includes('sectionDescription: undefined') && shell.includes('sectionHeading={ADMIN_ENTITY_REVIEW_TAB_LABEL}') && shell.includes('sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}'));
check("Review Shell context rejects omitted Article adoption, other Media leakage, changed Video scope and unsupported section presentations", !hasScopedReviewSection(create.replace('sectionHeaderPresentation: "premium" as const,', ''), true) && !hasScopedReviewSection(media.replace('id: "publish",', 'id: "publish", sectionHeaderPresentation: "premium" as const,'), "video") && !hasScopedReviewSection(media.replace('const videoPanel = contentType === "video";', 'const videoPanel = contentType === "gallery";'), "video") && !hasScopedReviewSection(edit.replace('sectionHeaderPresentation: "premium" as const,', 'sectionHeaderPresentation: "panel" as const,'), true));
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
