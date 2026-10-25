import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const parsePresentation = (source) => ts.createSourceFile("presentation.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function presentationElements(source, name) {
  const tree = parsePresentation(source), result = [];
  const visit = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === name) result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return result;
}
function presentationAttribute(node, name) {
  const attribute = node.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText() === name);
  if (!attribute) return undefined;
  if (!attribute.initializer) return true;
  return ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : attribute.initializer.expression?.getText();
}
function hasDefault(source, name, property, value) {
  const tree = parsePresentation(source);
  const component = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const binding = component?.parameters[0]?.name;
  return binding && ts.isObjectBindingPattern(binding) && binding.elements.some((element) => element.name.getText(tree) === property && element.initializer?.getText(tree) === value);
}
function preservesDisplayDefault(display, topicSwitch, sidebar, family) {
  const controls = presentationElements(display, "TopicFormSwitch"), forwarded = presentationElements(topicSwitch, "AdminFormSwitch"), sidebarUse = presentationElements(sidebar, "ContentDisplaySettings");
  return hasDefault(display, "ContentDisplaySettings", "embedded", "false") && hasDefault(topicSwitch, "TopicFormSwitch", "embedded", "false") && hasDefault(display, "ContentDisplaySettings", "presentation", '"default"') &&
    controls.length === 7 && controls.every((node) => presentationAttribute(node, "presentation") === "presentation" && presentationAttribute(node, "embedded") === "embedded" && presentationAttribute(node, "embeddedLayout") === 'embedded ? "inline" : undefined') &&
    forwarded.length === 1 && presentationAttribute(forwarded[0], "presentation") === "presentation" && presentationAttribute(forwarded[0], "embedded") === "embedded" && presentationAttribute(forwarded[0], "embeddedLayout") === "embeddedLayout" &&
    sidebarUse.length === 1 && presentationAttribute(sidebarUse[0], "columns") === "3" && presentationAttribute(sidebarUse[0], "presentation") === "premium" && presentationAttribute(sidebarUse[0], "embedded") === undefined &&
    family.every((source) => { const elements = presentationElements(source, "ContentDisplaySettings"); return elements.length === 1 && presentationAttribute(elements[0], "columns") === "4" && presentationAttribute(elements[0], "presentation") === "premium-inline" && presentationAttribute(elements[0], "embedded") === undefined; });
}
function hasPremiumSwitchComposition(source) {
  const tree = parsePresentation(source);
  const canonicalCard = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./AdminCard" && node.importClause?.name?.text === "AdminCard");
  const component = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormSwitch");
  const branch = component?.body?.statements.find((node) => ts.isIfStatement(node) && node.expression.getText(tree) === 'presentation === "premium"');
  const returned = branch && ts.isBlock(branch.thenStatement) && branch.thenStatement.statements.find(ts.isReturnStatement);
  const branchSource = returned?.expression?.getText(tree) ?? "";
  const cards = presentationElements(branchSource, "AdminCard"), labels = presentationElements(branchSource, "label");
  const checkboxes = presentationElements(source, "input").filter((node) => presentationAttribute(node, "type") === "checkbox");
  const native = checkboxes[0];
  return canonicalCard && hasDefault(source, "AdminFormSwitch", "presentation", '"default"') && cards.length === 1 && presentationAttribute(cards[0], "presentation") === "premium" &&
    labels.length === 1 && presentationAttribute(labels[0], "data-admin-form-switch-surface") === "premium" && branchSource.includes("{labelContent}") && branchSource.includes("{switchControl}") && !presentationElements(branchSource, "input").length &&
    checkboxes.length === 1 && presentationAttribute(native, "role") === "switch" && presentationAttribute(native, "name") === "name" && presentationAttribute(native, "checked") === "checked" && presentationAttribute(native, "defaultChecked") === "checked === undefined ? defaultChecked : undefined" && presentationAttribute(native, "onChange") === "onChange" && presentationAttribute(native, "disabled") === "disabled" && presentationAttribute(native, "value") === "value" &&
    source.includes('<input type="hidden" name={name} value={uncheckedValue} />') && source.indexOf('type="hidden"') < source.indexOf('type="checkbox"');
}
function hasPremiumInlineSwitchComposition(source, adapter, display) {
  const tree = parsePresentation(source);
  const component = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormSwitch");
  const branch = component?.body?.statements.find((node) => ts.isIfStatement(node) && node.expression.getText(tree) === 'presentation === "premium-inline"');
  const returned = branch && ts.isBlock(branch.thenStatement) && branch.thenStatement.statements.find(ts.isReturnStatement);
  const branchSource = returned?.expression?.getText(tree) ?? "";
  const cards = presentationElements(branchSource, "AdminCard"), labels = presentationElements(branchSource, "label");
  const spans = presentationElements(branchSource, "span");
  const icon = spans.find((node) => presentationAttribute(node, "aria-hidden") === "true");
  const text = spans.find((node) => presentationAttribute(node, "className") === "min-w-0 flex-1 text-start leading-5");
  const forwarded = presentationElements(adapter, "AdminFormSwitch");
  const displayTree = parsePresentation(display);
  const canonicalIcon = displayTree.statements.some((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === "../../ui/AdminModuleTabs" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((element) => (element.propertyName ?? element.name).text === "AdminModuleTabIcon" && element.name.text === "AdminModuleTabIcon"));
  const controls = presentationElements(display, "TopicFormSwitch");
  return hasPremiumSwitchComposition(source) && source.includes("icon?: ReactNode") && !source.includes("AdminModuleTabIcon") &&
    cards.length === 1 && presentationAttribute(cards[0], "presentation") === "premium" && presentationAttribute(cards[0], "className") === "px-2.5 py-2.5" &&
    labels.length === 1 && presentationAttribute(labels[0], "data-admin-form-switch-surface") === "premium-inline" && presentationAttribute(labels[0], "className")?.includes("flex min-w-0 cursor-pointer items-center gap-1 text-xs leading-5 text-white/70") && !/\b(?:h-|min-h-|max-h-)/.test(branchSource) &&
    icon && presentationAttribute(icon, "className") === "inline-flex size-4 shrink-0 items-center justify-center text-[#D8B87A] [&>svg]:size-4" && text &&
    branchSource.includes("{icon ? (") && branchSource.includes(") : null}") && branchSource.indexOf("{icon}") < branchSource.indexOf("{label}") && branchSource.indexOf("{label}") < branchSource.indexOf("{switchControl}") &&
    !presentationElements(branchSource, "input").length && presentationAttribute(labels[0], "onClick") === undefined &&
    forwarded.length === 1 && presentationAttribute(forwarded[0], "icon") === "icon" && canonicalIcon && controls.length === 7 && controls.every((node) => {
      const attribute = node.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText() === "icon");
      const expression = attribute?.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined;
      return expression && ts.isConditionalExpression(expression) && expression.condition.getText() === 'presentation === "premium-inline"' && expression.whenFalse.getText() === "undefined" && ts.isJsxSelfClosingElement(expression.whenTrue) && expression.whenTrue.tagName.getText() === "AdminModuleTabIcon";
    });
}
function hasPremiumInlineIntroSpan(source) {
  const tree = parsePresentation(source);
  const canonicalItem = tree.statements.some((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === "../../ui/AdminFormRuntime" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((element) => (element.propertyName ?? element.name).text === "AdminFormGridItem" && element.name.text === "AdminFormGridItem"));
  const unwrap = (node) => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  let include, intro;
  const visit = (node) => {
    if (ts.isConditionalExpression(node) && node.condition.getText(tree) === "includeIntroCard") include = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "introControl") intro = node.initializer && unwrap(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (!include || include.whenFalse.getText(tree) !== "null" || !intro || !ts.isJsxSelfClosingElement(intro) || intro.tagName.getText(tree) !== "TopicFormSwitch" || presentationAttribute(intro, "name") !== "show_intro_card_on_page") return false;
  const presentation = unwrap(include.whenTrue);
  if (!ts.isConditionalExpression(presentation) || presentation.condition.getText(tree) !== 'presentation === "premium-inline" && introCardSpan === 2' || presentation.whenFalse.getText(tree) !== "introControl") return false;
  const wrapper = unwrap(presentation.whenTrue);
  if (!ts.isJsxElement(wrapper) || wrapper.openingElement.tagName.getText(tree) !== "AdminFormGridItem") return false;
  const children = wrapper.children.filter((node) => !ts.isJsxText(node) || node.text.trim());
  return canonicalItem && source.includes("introCardSpan?: 1 | 2") && hasDefault(source, "ContentDisplaySettings", "introCardSpan", "2") && presentationElements(source, "AdminFormGridItem").length === 1 && wrapper.openingElement.attributes.properties.length === 1 && presentationAttribute(wrapper.openingElement, "span") === "2" && children.length === 1 && ts.isJsxExpression(children[0]) && children[0].expression?.getText(tree) === "introControl";
}
function hasPanelRichTextViewport(topic, shared) {
  const editors = presentationElements(topic, "AdminRichTextEditor");
  const editor = editors[0];
  const tree = parsePresentation(shared);
  const canonicalScrollbar = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./ui/admin-scrollbar-styles" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((binding) => binding.name.text === "ADMIN_SCROLLBAR_VISUAL_CLASSES" && !binding.propertyName));
  const nodes = [];
  const visit = (node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const viewports = nodes.filter(ts.isJsxElement).filter((node) => presentationAttribute(node.openingElement, "className")?.includes("admin-rich-text-editor min-w-0 flex-1"));
  const viewport = viewports[0];
  const styleAttribute = viewport?.openingElement.attributes.properties.find((node) => ts.isJsxAttribute(node) && node.name.getText(tree) === "style")?.initializer;
  const style = styleAttribute && ts.isJsxExpression(styleAttribute) ? styleAttribute.expression : undefined;
  const styleValues = style && ts.isObjectLiteralExpression(style) ? new Map(style.properties.flatMap((node) => ts.isPropertyAssignment(node) ? [[node.name.getText(tree), node.initializer.getText(tree)]] : ts.isShorthandPropertyAssignment(node) ? [[node.name.text, node.name.text]] : [])) : new Map();
  const viewportChildren = viewport?.children.filter((node) => !ts.isJsxText(node) || node.text.trim()) ?? [];
  const writingSurface = viewportChildren[0];
  const editorProps = nodes.filter((node) => ts.isPropertyAssignment(node) && node.name.getText(tree) === "editorProps").map((node) => node.initializer);
  const preservesRtlEditorProps = editorProps.length === 2 && editorProps.every((props) => {
    if (!ts.isObjectLiteralExpression(props)) return false;
    const attributes = props.properties.find((node) => ts.isPropertyAssignment(node) && node.name.getText(tree) === "attributes")?.initializer;
    return attributes && ts.isObjectLiteralExpression(attributes) && attributes.properties.some((node) => ts.isPropertyAssignment(node) && node.name.getText(tree) === "dir" && node.initializer.getText(tree) === '"rtl"');
  });
  const frame = viewport?.parent;
  const siblings = frame && ts.isJsxElement(frame) ? frame.children.filter((node) => !ts.isJsxText(node) || node.text.trim()) : [];
  return editors.length === 1 && presentationAttribute(editor, "label") === "نص المقال" && presentationAttribute(editor, "showLabel") === "!panel" && presentationAttribute(editor, "minHeight") === "panel ? 300 : compact ? 440 : 620" && presentationAttribute(editor, "maxHeight") === "panel ? 300 : undefined" &&
    presentationAttribute(editor, "name") === "content" && presentationAttribute(editor, "value") === "content" && presentationAttribute(editor, "onValueChange") === "handleValueChange" && presentationAttribute(editor, "readOnly") === "Boolean(pendingDraft)" && presentationAttribute(editor, "scrollbarSide") === 'panel ? "right" : undefined' &&
    hasDefault(shared, "AdminRichTextEditor", "showLabel", "true") && hasDefault(shared, "AdminRichTextEditor", "scrollbarSide", '"auto"') && shared.includes('scrollbarSide?: "auto" | "right"') && canonicalScrollbar && viewports.length === 1 &&
    presentationAttribute(viewport.openingElement, "className") === '`admin-rich-text-editor min-w-0 flex-1 px-4 py-4 ${maxHeight === undefined ? "" : `overscroll-y-contain ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`}`.trim()' &&
    presentationAttribute(viewport.openingElement, "dir") === 'scrollbarSide === "right" ? "ltr" : undefined' && presentationAttribute(viewport.openingElement, "contentEditable") === undefined && !viewport.openingElement.attributes.properties.some((node) => ts.isJsxAttribute(node) && /^on(?:Wheel|Scroll|Key|Touch|Pointer|Mouse)/.test(node.name.getText(tree))) &&
    styleValues.size === 3 && styleValues.get("minHeight") === "minHeight" && styleValues.get("maxHeight") === "maxHeight" && styleValues.get("overflowY") === 'maxHeight === undefined ? undefined : "auto"' &&
    viewportChildren.length === 1 && ts.isJsxSelfClosingElement(writingSurface) && writingSurface.tagName.getText(tree) === "EditorContent" && presentationAttribute(writingSurface, "editor") === "editor" && presentationAttribute(writingSurface, "dir") === "rtl" && writingSurface.attributes.properties.length === 2 && preservesRtlEditorProps &&
    !/::?-webkit-scrollbar|scrollbar-(?:width|color|gutter)\s*:|\b(?:transform|rotate|scale)\s*:/.test(shared) &&
    siblings.length === 2 && ts.isJsxExpression(siblings[0]) && siblings[0].expression?.getText(tree) === "showToolbar ? toolbar : null" && siblings[1] === viewport &&
    shared.includes('"aria-label": label') && shared.includes('aria-label={`شريط أدوات ${label}`}') && shared.includes('min-height: ${maxHeight === undefined ? `${minHeight}px` : `min(${minHeight}px, calc(${maxHeight}px - 2rem))`};');
}
function hasRowsTextareaSizing(source, basic) {
  const textarea = presentationElements(source, "textarea");
  const excerpt = presentationElements(basic, "TopicCharacterField").filter((node) => presentationAttribute(node, "name") === "excerpt");
  const fields = presentationElements(basic, "TopicCharacterField");
  return source.includes('textareaSizing?: "default" | "rows"') && hasDefault(source, "TopicCharacterField", "textareaSizing", '"default"') && hasDefault(source, "TopicCharacterField", "rows", "3") &&
    source.includes('from "../../../../../lib/admin/admin-ui-styles"') && source.includes('adminFormFieldClassName("h-11 rounded-xl px-3 py-2.5")') &&
    textarea.length === 1 && ["id", "name", "rows", "placeholder", "required", "dir"].every((attribute) => presentationAttribute(textarea[0], attribute) === attribute) && textarea[0].attributes.properties.filter((property) => ts.isJsxSpreadAttribute(property) && property.expression.getText() === "valueProps").length === 1 &&
    presentationAttribute(textarea[0], "aria-invalid") === "hasError || undefined" && presentationAttribute(textarea[0], "aria-describedby") === 'hasError ? `${name}-error` : undefined' &&
    presentationAttribute(textarea[0], "className") === '`${className} h-auto${textareaSizing === "rows" ? "" : " min-h-40"} resize-y overflow-y-auto leading-6 ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`' &&
    source.includes("const currentCount = controlled ? value.length : count;") && source.includes("onValueChange?.(event.currentTarget.value)") && source.includes("setCount(event.currentTarget.value.length)") &&
    excerpt.length === 1 && presentationAttribute(excerpt[0], "as") === "textarea" && presentationAttribute(excerpt[0], "rows") === "panel ? 5 : 2" && presentationAttribute(excerpt[0], "textareaSizing") === 'panel ? "rows" : undefined' && fields.filter((node) => presentationAttribute(node, "textareaSizing") !== undefined).length === 1;
}
function hasEqualHeightContentGrid(basic, shared) {
  const tree = parsePresentation(basic), layouts = presentationElements(basic, "AdminFormLayout"), grids = presentationElements(basic, "AdminFormGrid").filter(node => presentationAttribute(node, "presentation") === "equal-height-columns");
  const imported = tree.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === "../../ui/AdminFormRuntime" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => binding.name.text === "AdminFormGrid" && !binding.propertyName));
  const renderAttribute = layouts[0]?.attributes.properties.find(node => ts.isJsxAttribute(node) && node.name.getText() === "renderGrid")?.initializer;
  const render = renderAttribute && ts.isJsxExpression(renderAttribute) ? renderAttribute.expression : undefined;
  if (!imported || layouts.length !== 1 || grids.length !== 1 || !render || !ts.isConditionalExpression(render) || render.condition.getText() !== "panel && !displaySection" || render.whenFalse.getText() !== "undefined" || !ts.isArrowFunction(render.whenTrue)) return false;
  const arrow = render.whenTrue, grid = grids[0], parameter = arrow.parameters[0]?.name;
  const wrapper = grid.parent;
  const children = wrapper && ts.isJsxElement(wrapper) ? wrapper.children.filter(node => !ts.isJsxText(node) || node.text.trim()) : [];
  const imageCards = presentationElements(basic, "AdminCard").filter(node => presentationAttribute(node, "id") === 'panel ? "content-image-field" : undefined');
  const layoutElement = layouts[0].parent, primaryCards = ts.isJsxElement(layoutElement) ? layoutElement.children.filter(node => ts.isJsxElement(node) && node.openingElement.tagName.getText() === "AdminCard") : [];
  const formTree = parsePresentation(shared), owner = formTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormLayout"), bindings = owner?.parameters[0]?.name;
  const panel = owner?.body?.statements.find(node => ts.isIfStatement(node) && node.expression.getText() === 'presentation === "panel"');
  const delegate = panel && ts.isBlock(panel.thenStatement) ? panel.thenStatement.statements.find(node => ts.isIfStatement(node) && node.expression.getText() === "renderGrid") : undefined;
  const returned = delegate && ts.isBlock(delegate.thenStatement) ? delegate.thenStatement.statements.find(ts.isReturnStatement)?.expression : undefined;
  const argument = returned && ts.isCallExpression(returned) && returned.expression.getText() === "renderGrid" ? returned.arguments[0] : undefined;
  const properties = argument && ts.isObjectLiteralExpression(argument) ? new Map(argument.properties.filter(ts.isPropertyAssignment).map(node => [node.name.getText(), node.initializer.getText()])) : new Map();
  return parameter && ts.isObjectBindingPattern(parameter) && parameter.elements.map(node => node.name.getText()).join(",") === "children,className" && grid.attributes.properties.length === 3 && presentationAttribute(grid, "columns") === "1" && presentationAttribute(grid, "className") === "className" && children.length === 1 && ts.isJsxExpression(children[0]) && children[0].expression?.getText() === "children" &&
    shared.includes("renderGrid?: (props: { children: ReactNode; className: string }) => ReactNode") && bindings && ts.isObjectBindingPattern(bindings) && bindings.elements.some(node => node.name.getText() === "renderGrid" && node.initializer === undefined) && properties.size === 2 && properties.get("className") === '`min-w-0 gap-x-3 gap-y-3 ${aside ? "xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]" : ""} ${className}`.trim()' && properties.get("children") === '<>{children}{aside}{secondary ? <div className="min-w-0 xl:col-start-1">{secondary}</div> : null}</>' &&
    shared.includes('`grid min-w-0 items-start gap-3 ${aside ? "xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]" : ""} ${className}`.trim()') && shared.includes('`grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] ${className}`.trim()') &&
    presentationAttribute(layouts[0], "aside")?.startsWith("panel ? imageCard :") && imageCards.length === 1 && presentationAttribute(imageCards[0], "className") === 'panel ? "min-w-0 scroll-mt-24 p-3" : "min-w-0 p-3"' && primaryCards.length === 1 && presentationAttribute(primaryCards[0].openingElement, "className") === 'panel ? "min-w-0 p-3" : "h-full min-w-0 p-3"' && !basic.includes("1.85fr") && !basic.includes("xl:grid-cols-2") && !basic.includes("[&_*]") && !presentationAttribute(grid, "className")?.includes("h-full");
}
function hasPanelDraftNotice(source) {
  const tree = parsePresentation(source);
  const owner = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "AdminPublicRichContentEditor");
  const notices = presentationElements(source, "AdminNotice").filter(node => owner && owner.pos <= node.pos && node.end <= owner.end && presentationAttribute(node, "message") === "تم استرجاع آخر مسودة محفوظة محليًا لهذا المقال.");
  const imported = tree.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === "../../../AdminNotice" && node.importClause?.name?.text === "AdminNotice");
  let callback;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "dismissDraftRestoredNotice") callback = node.initializer; ts.forEachChild(node, visit); };
  visit(tree);
  const handler = callback && ts.isCallExpression(callback) && callback.expression.getText(tree) === "useCallback" && callback.arguments.length === 2 && callback.arguments[1].getText(tree) === "[]" ? callback.arguments[0] : undefined;
  if (!imported || notices.length !== 1 || !handler || !ts.isArrowFunction(handler) || !ts.isBlock(handler.body) || handler.body.statements.length !== 2) return false;
  const statements = handler.body.statements.map(statement => statement.getText(tree).replace(/\s+/g, ""));
  if (statements[0] !== "setDraftRestored(false);" || statements[1] !== 'sectionRef.current?.focus({preventScroll:true});') return false;
  const notice = notices[0];
  let panelBranch, restoredBranch;
  for (let ancestor = notice.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isConditionalExpression(ancestor) && ancestor.condition.getText() === "panel" && ancestor.whenTrue.pos <= notice.pos && notice.end <= ancestor.whenTrue.end) panelBranch = ancestor;
    if (ts.isConditionalExpression(ancestor) && ancestor.condition.getText() === "draftRestored" && ancestor.whenTrue.pos <= notice.pos && notice.end <= ancestor.whenTrue.end) restoredBranch = ancestor;
  }
  return !panelBranch && restoredBranch && restoredBranch.whenFalse.getText() === "null" && presentationAttribute(notice, "message") === "تم استرجاع آخر مسودة محفوظة محليًا لهذا المقال." && presentationAttribute(notice, "variant") === "warning" && presentationAttribute(notice, "presentation") === "compact" && presentationAttribute(notice, "layout") === "stacked" && presentationAttribute(notice, "dismissible") === true && presentationAttribute(notice, "lifecycle") === "manual" && presentationAttribute(notice, "dismissSearchParams") === "[]" && presentationAttribute(notice, "onDismiss") === "dismissDraftRestoredNotice" &&
    presentationElements(source, "section").some(node => presentationAttribute(node, "id") === "topic-content-editor" && presentationAttribute(node, "tabIndex") === "panel ? -1 : undefined");
}
function hasLocalizedMediaCreateTitle(source) {
  const tree = parsePresentation(source);
  const canonicalImport = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.endsWith("/lib/admin/content/content-types") && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((element) => (element.propertyName ?? element.name).text === "getContentTypeLabel" && element.name.text === "getContentTypeLabel"));
  const headers = presentationElements(source, "AdminPageContextHeader");
  return canonicalImport && headers.length === 1 && presentationAttribute(headers[0], "title") === '`إضافة ${getContentTypeLabel(contentType)}`';
}
function hasCanonicalShellFormOwners(source) {
  const tree = parsePresentation(source);
  const canonicalRuntime = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../ui/AdminFormRuntime" && node.importClause?.name?.text === "AdminFormRuntime" && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((element) => (element.propertyName ?? element.name).text === "AdminFormActions" && element.name.text === "AdminFormActions"));
  return canonicalRuntime && presentationElements(source, "AdminFormRuntime").length === 1 && presentationElements(source, "AdminFormActions").length === 1 && !presentationElements(source, "form").length;
}
function hasInjectedDisplaySections(source) {
  const tree = parsePresentation(source);
  let declaration;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "displaySection") declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const unwrap = (node) => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const conditional = declaration?.initializer && unwrap(declaration.initializer);
  if (!conditional || !ts.isConditionalExpression(conditional) || conditional.condition.getText(tree) !== "displaySettings" || conditional.whenFalse.getText(tree) !== "null") return false;
  const presentations = unwrap(conditional.whenTrue);
  if (!ts.isConditionalExpression(presentations) || presentations.condition.getText(tree) !== "panel") return false;
  const branches = [unwrap(presentations.whenTrue), unwrap(presentations.whenFalse)];
  return branches.every((node, index) => {
    if (!ts.isJsxElement(node) || node.openingElement.tagName.getText(tree) !== (index === 0 ? "AdminCard" : "section")) return false;
    const children = node.children.filter((child) => !ts.isJsxText(child) || child.text.trim());
    return children.length === 2 && ts.isJsxSelfClosingElement(children[0]) && children[0].tagName.getText(tree) === "AdminModuleSectionHeader" && presentationAttribute(children[0], "id") === "content-display-settings-heading" && presentationAttribute(children[0], "sectionHeaderPresentation") === (index === 0 ? "premium" : undefined) && ts.isJsxExpression(children[1]) && children[1].expression?.getText(tree) === "displaySettings";
  }) && presentationElements(source, "AdminFormLayout").some((node) => presentationAttribute(node, "secondary") === "panel ? displaySection : undefined") && source.includes("{panel ? null : displaySection}");
}
function hasPremiumContentHeaders(basic, topic) {
  const positivePanelBranch = (node) => {
    for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
      if (ts.isConditionalExpression(ancestor) && ancestor.condition.getText() === "panel" && ancestor.whenTrue.pos <= node.pos && node.end <= ancestor.whenTrue.end) return true;
    }
    return false;
  };
  const canonicalHeader = (source) => parsePresentation(source).statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /\/ui\/AdminModuleTabs$/.test(node.moduleSpecifier.text) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((binding) => binding.name.text === "AdminModuleSectionHeader" && !binding.propertyName));
  const basicHeaders = presentationElements(basic, "AdminModuleSectionHeader"), topicHeaders = presentationElements(topic, "AdminModuleSectionHeader");
  const premium = basicHeaders.filter((node) => presentationAttribute(node, "sectionHeaderPresentation") === "premium");
  const defaults = basicHeaders.filter((node) => presentationAttribute(node, "sectionHeaderPresentation") === undefined);
  const canonicalCharcoal = parsePresentation(basic).statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /\/lib\/admin\/admin-ui-styles$/.test(node.moduleSpecifier.text) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((binding) => binding.name.text === "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME" && !binding.propertyName));
  const preservesLocalIdentity = basicHeaders.every((node) => presentationAttribute(node, "sectionHeaderClassName") === (premium.includes(node) ? "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME" : undefined) && presentationAttribute(node, "style") === undefined) && topicHeaders.every((node) => presentationAttribute(node, "sectionHeaderClassName") === undefined && presentationAttribute(node, "style") === undefined);
  return canonicalHeader(basic) && canonicalHeader(topic) && canonicalCharcoal && preservesLocalIdentity &&
    hasDefault(basic, "ContentBasicDataPanel", "presentation", '"default"') && hasDefault(topic, "AdminPublicRichContentEditor", "presentation", '"default"') &&
    basicHeaders.length === 6 && premium.length === 3 && ["content-basic-data", "content-main-image", "content-display-settings-heading"].every((id) => premium.some((node) => presentationAttribute(node, "id") === id && positivePanelBranch(node))) &&
    defaults.length === 3 && ["content-main-image", "content-display-settings-heading", "content-body"].every((id) => defaults.some((node) => presentationAttribute(node, "id") === id)) &&
    topicHeaders.length === 1 && presentationAttribute(topicHeaders[0], "id") === "content-body" && presentationAttribute(topicHeaders[0], "sectionHeaderPresentation") === "premium" && presentationAttribute(topicHeaders[0], "sectionSummary") === "editorStats" && positivePanelBranch(topicHeaders[0]);
}
function canonicalStyleImports(source, names) {
  return parsePresentation(source).statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /\/lib\/admin\/admin-ui-styles$/.test(node.moduleSpecifier.text) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && names.every((name) => node.importClause.namedBindings.elements.some((binding) => binding.name.text === name && !binding.propertyName)));
}
function optionalPresentationPort(source, componentName, name) {
  const tree = parsePresentation(source), component = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === componentName), binding = component?.parameters[0]?.name;
  return source.includes(`${name}?: string`) && binding && ts.isObjectBindingPattern(binding) && binding.elements.some((element) => element.name.getText(tree) === name && element.initializer === undefined);
}
function hasClassExpression(source, tag, expression) {
  return presentationElements(source, tag).some((node) => presentationAttribute(node, "className") === expression);
}
function variableExpression(source, name) {
  const tree = parsePresentation(source); let value;
  const visit = (node) => { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) value = node.initializer?.getText(tree); ts.forEachChild(node, visit); };
  visit(tree); return value;
}
function hasObservedSlugModes(source) {
  const tree = parsePresentation(source);
  const component = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "TopicSlugInput");
  if (!component?.body) return false;
  const canonicalGenerator = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../../../../lib/admin/slug" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((binding) => binding.name.text === "slugifyFromTitle" && !binding.propertyName));
  const declarations = [], effects = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node)) declarations.push(node);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect") effects.push(node);
    ts.forEachChild(node, visit);
  };
  visit(component);
  const variable = (name) => declarations.find((node) => node.name.getText(tree) === name)?.initializer;
  const state = (name, setter) => declarations.find((node) => ts.isArrayBindingPattern(node.name) && node.name.elements[0]?.name?.getText(tree) === name && node.name.elements[1]?.name?.getText(tree) === setter)?.initializer?.getText(tree);
  const calls = (node) => {
    const result = [];
    const walk = (child) => { if (ts.isCallExpression(child)) result.push(child); ts.forEachChild(child, walk); };
    if (node) walk(node);
    return result;
  };
  const handler = (node, name) => node?.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText(tree) === name)?.initializer?.expression;
  const inputs = presentationElements(source, "input"), buttons = presentationElements(source, "button");
  const input = inputs[0], button = buttons[0];
  const change = handler(input, "onChange"), blur = handler(input, "onBlur"), auto = handler(button, "onClick");
  if (!change || !blur || !auto) return false;
  const changeCalls = calls(change), blurCalls = calls(blur), autoCalls = calls(auto);
  const callsWith = (entries, name, argument) => entries.some((entry) => entry.expression.getText(tree) === name && entry.arguments[0]?.getText(tree) === argument);
  const blurGuard = blur.body?.statements?.find(ts.isIfStatement);
  const blurStatements = blurGuard && ts.isBlock(blurGuard.thenStatement) ? blurGuard.thenStatement.statements : [];
  const blurVariable = (name) => blurStatements.flatMap((node) => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []).find((node) => node.name.getText(tree) === name)?.initializer?.getText(tree);
  const blurFinalization = blurStatements[2];
  const preservedManualBlur = blurStatements.length === 3 && blurVariable("rawValue") === "event.currentTarget.value" && blurVariable("normalized") === "slugifyFromTitle(rawValue)" &&
    blurFinalization && ts.isIfStatement(blurFinalization) && blurFinalization.expression.getText(tree) === "normalized || !rawValue.trim()" && ts.isExpressionStatement(blurFinalization.thenStatement) && blurFinalization.thenStatement.expression.getText(tree) === "setValue(normalized)";
  const title = variable("currentTitle");
  const actualChangeEffect = effects.some((effect) => {
    const callback = effect.arguments[0], dependency = effect.arguments[1];
    if (!callback || !ts.isArrowFunction(callback) || !ts.isBlock(callback.body) || dependency?.getText(tree) !== "[resolvedValue]") return false;
    const statements = callback.body.statements;
    const equality = statements[0];
    const assignment = statements[1];
    const dispatch = calls(callback).find((call) => call.expression.getText(tree) === "inputRef.current?.dispatchEvent");
    const event = dispatch?.arguments[0];
    return statements.length === 3 && ts.isIfStatement(equality) && equality.expression.getText(tree) === "previousValueRef.current === resolvedValue" && ts.isReturnStatement(equality.thenStatement) &&
      ts.isExpressionStatement(assignment) && assignment.expression.getText(tree) === "previousValueRef.current = resolvedValue" &&
      event && ts.isNewExpression(event) && event.expression.getText(tree) === "Event" && event.arguments?.[0] && ts.isStringLiteral(event.arguments[0]) && event.arguments[0].text === "input" &&
      event.arguments[1] && ts.isObjectLiteralExpression(event.arguments[1]) && event.arguments[1].properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(tree) === "bubbles" && property.initializer.kind === ts.SyntaxKind.TrueKeyword);
  });
  return canonicalGenerator && !tree.statements.some((node) => ts.isFunctionDeclaration(node) && /slugify/.test(node.name?.text ?? "")) &&
    state("value", "setValue") === 'useState(defaultValue ?? "")' && state("isManual", "setIsManual") === "useState(draftRestored || Boolean(defaultValue))" &&
    variable("resolvedValue")?.getText(tree) === "titleValue !== undefined && !isManual ? slugifyFromTitle(titleValue) : value" && variable("previousValueRef")?.getText(tree) === "useRef(resolvedValue)" &&
    inputs.length === 1 && presentationAttribute(input, "name") === "slug" && presentationAttribute(input, "value") === "resolvedValue" && presentationAttribute(input, "pattern") === "[a-z0-9]+(-[a-z0-9]+)*" &&
    changeCalls.length === 2 && callsWith(changeCalls, "setValue", "event.target.value") && callsWith(changeCalls, "setIsManual", "true") &&
    blurGuard?.expression.getText(tree) === 'isManual && event.currentTarget.value !== (defaultValue ?? "")' && blurCalls.length === 3 && preservedManualBlur && actualChangeEffect &&
    buttons.length === 1 && presentationAttribute(button, "type") === "button" && title && ts.isConditionalExpression(title) &&
    title.condition.getText(tree) === "titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement" && title.whenTrue.getText(tree) === "titleInput.value" && title.whenFalse.getText(tree) === 'titleValue ?? ""' &&
    auto.getText(tree).includes("inputRef.current?.form") && auto.getText(tree).includes("form?.elements.namedItem(titleInputName)") &&
    autoCalls.length === 4 && callsWith(autoCalls, "setValue", "slugifyFromTitle(currentTitle)") && callsWith(autoCalls, "setIsManual", "false") &&
    effects.some((effect) => effect.getText(tree).includes("if (titleValue !== undefined) return;") && effect.getText(tree).includes("if (isManual) return;") && effect.getText(tree).includes('titleInput.addEventListener("input", syncSlug)'));
}
function hasRecoveredSlugProtection(source, basic, consumers) {
  const slugUses = presentationElements(basic, "TopicSlugInput");
  return hasDefault(source, "TopicSlugInput", "draftRestored", "false") && source.includes("draftRestored?: boolean") &&
    source.includes("useState(draftRestored || Boolean(defaultValue))") &&
    hasDefault(basic, "ContentBasicDataPanel", "slugDraftRestored", "false") && basic.includes("slugDraftRestored?: boolean") &&
    slugUses.length === 1 && presentationAttribute(slugUses[0], "draftRestored") === "slugDraftRestored" &&
    consumers.every(consumer => {
      const basics = presentationElements(consumer, "ContentBasicDataPanel");
      return basics.length === 1 && presentationAttribute(basics[0], "slugDraftRestored") === 'Object.hasOwn(model.recoveryFields ?? {}, "slug")';
    });
}
function hasSavedSlugProtection(source) {
  const tree = parsePresentation(source);
  const component = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "TopicSlugInput");
  if (!component?.body) return false;
  const calls = [];
  const visit = (node) => { if (ts.isCallExpression(node)) calls.push(node); ts.forEachChild(node, visit); };
  visit(component);
  const registrations = calls.filter((node) => ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "addEventListener" && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "admin-form-saved");
  if (registrations.length !== 1) return false;
  const registration = registrations[0], statement = registration.parent, body = statement.parent, callback = body.parent, effect = callback.parent;
  if (!ts.isExpressionStatement(statement) || !ts.isBlock(body) || !ts.isArrowFunction(callback) || !ts.isCallExpression(effect) || effect.expression.getText(tree) !== "useEffect" || effect.arguments[1]?.getText(tree) !== "[]") return false;
  const declarations = body.statements.flatMap((node) => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []);
  const initializer = (name) => declarations.find((node) => node.name.getText(tree) === name)?.initializer;
  const handlerName = registration.arguments[1]?.getText(tree), handler = handlerName && initializer(handlerName);
  const guard = body.statements.find(ts.isIfStatement), cleanup = body.statements.find(ts.isReturnStatement)?.expression;
  if (!handler || !ts.isArrowFunction(handler) || !ts.isBlock(handler.body) || !cleanup || !ts.isArrowFunction(cleanup)) return false;
  const preservedValue = handler.body.statements[0], manualMode = handler.body.statements[1];
  const cleanupCall = cleanup.body;
  return body.statements.length === 6 && initializer("input")?.getText(tree) === "inputRef.current" && initializer("form")?.getText(tree) === "input?.form" &&
    guard?.expression.getText(tree) === "!input || !form" && ts.isReturnStatement(guard.thenStatement) &&
    registration.expression.getText(tree) === "form.addEventListener" && registration.arguments.length === 2 &&
    handler.body.statements.length === 2 && ts.isExpressionStatement(preservedValue) && preservedValue.expression.getText(tree) === "setValue(input.value)" && ts.isExpressionStatement(manualMode) && manualMode.expression.getText(tree) === "setIsManual(true)" &&
    ts.isCallExpression(cleanupCall) && cleanupCall.expression.getText(tree) === "form.removeEventListener" && cleanupCall.arguments.length === 2 && cleanupCall.arguments[0].getText(tree) === '"admin-form-saved"' && cleanupCall.arguments[1].getText(tree) === handlerName;
}
function hasFinalizedSlugSubmission(source) {
  const tree = parsePresentation(source);
  const component = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "TopicSlugInput");
  if (!component?.body) return false;
  const calls = [];
  const visit = (node) => { if (ts.isCallExpression(node)) calls.push(node); ts.forEachChild(node, visit); };
  visit(component);
  const registrations = calls.filter((node) => ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "addEventListener" && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "admin-form-before-submit");
  if (registrations.length !== 1) return false;
  const registration = registrations[0], statement = registration.parent, body = statement.parent, callback = body.parent, effect = callback.parent;
  if (!ts.isExpressionStatement(statement) || !ts.isBlock(body) || !ts.isArrowFunction(callback) || !ts.isCallExpression(effect) || effect.expression.getText(tree) !== "useEffect" || effect.arguments[1]?.getText(tree) !== "[titleInputName, titleValue]") return false;
  const declarations = (block) => block.statements.flatMap((node) => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []);
  const initializer = (block, name) => declarations(block).find((node) => node.name.getText(tree) === name)?.initializer;
  const handlerName = registration.arguments[1]?.getText(tree), handler = handlerName && initializer(body, handlerName);
  const guard = body.statements.find(ts.isIfStatement), cleanup = body.statements.find(ts.isReturnStatement)?.expression;
  if (!handler || !ts.isArrowFunction(handler) || !ts.isBlock(handler.body) || !cleanup || !ts.isArrowFunction(cleanup)) return false;
  const title = initializer(handler.body, "currentTitle"), commit = handler.body.statements[4], cleanupCall = cleanup.body;
  return body.statements.length === 6 && initializer(body, "input")?.getText(tree) === "inputRef.current" && initializer(body, "form")?.getText(tree) === "input?.form" &&
    guard?.expression.getText(tree) === "!input || !form" && ts.isReturnStatement(guard.thenStatement) && registration.expression.getText(tree) === "form.addEventListener" && registration.arguments.length === 2 &&
    handler.body.statements.length === 5 && initializer(handler.body, "titleInput")?.getText(tree) === "form.elements.namedItem(titleInputName)" &&
    title && ts.isConditionalExpression(title) && title.condition.getText(tree) === "titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement" && title.whenTrue.getText(tree) === "titleInput.value" && title.whenFalse.getText(tree) === 'titleValue ?? ""' &&
    initializer(handler.body, "rawValue")?.getText(tree) === "input.value" && initializer(handler.body, "normalized")?.getText(tree) === "slugifyFromTitle(rawValue.trim() || currentTitle)" &&
    commit && ts.isIfStatement(commit) && commit.expression.getText(tree) === "normalized || !rawValue.trim()" && ts.isExpressionStatement(commit.thenStatement) && commit.thenStatement.expression.getText(tree) === "setValue(normalized)" &&
    ts.isCallExpression(cleanupCall) && cleanupCall.expression.getText(tree) === "form.removeEventListener" && cleanupCall.arguments.length === 2 && cleanupCall.arguments[0].getText(tree) === '"admin-form-before-submit"' && cleanupCall.arguments[1].getText(tree) === handlerName;
}
function hasSelectFieldContainers(basic, shared) {
  const opted = presentationElements(basic, "AdminFormGrid").filter(node => presentationAttribute(node, "fieldContainers") !== undefined), grid = opted[0], wrapper = grid?.parent;
  const children = wrapper && ts.isJsxElement(wrapper) ? wrapper.children.filter(node => !ts.isJsxText(node) || node.text.trim()) : [];
  const tags = children.map(node => ts.isJsxElement(node) ? node.openingElement.tagName.getText() : ts.isJsxSelfClosingElement(node) ? node.tagName.getText() : "");
  const returned = presentationElements(shared, "div").find(node => presentationAttribute(node, "data-admin-form-grid") === "presentation");
  return opted.length === 1 && presentationAttribute(grid, "columns") === "3" && presentationAttribute(grid, "presentation") === "aligned-fields" && presentationAttribute(grid, "fieldContainers") === "panel" && grid.attributes.properties.length === 3 && tags.join(",") === "TopicContentTypeControl,label,TopicSeriesFields" &&
    shared.includes("fieldContainers?: boolean") && hasDefault(shared, "AdminFormGrid", "fieldContainers", "false") && variableExpression(shared, "controlCardFrameClassName") === '"[&>*]:rounded-2xl [&>*]:border [&>*]:border-white/10"' && variableExpression(shared, "controlCardPaddingClassName") === '"[&>*]:p-3"' && variableExpression(shared, "controlCardSurfaceClassName") === '`${controlCardFrameClassName} [&>*]:bg-[#05070B] ${controlCardPaddingClassName}`' && variableExpression(shared, "fieldContainerClassName") === 'fieldContainers && presentation !== "control-cards" ? ` ${controlCardFrameClassName} ${controlCardPaddingClassName}` : ""' && variableExpression(shared, "presentationClassName")?.replace(/\s+/g, " ").includes('presentation === "aligned-fields" ? fieldContainers ? "items-stretch" : "items-start [&>*]:row-span-3 [&>*]:grid [&>*]:grid-rows-subgrid [&>*]:items-start [&>*]:gap-2 [&>*]:space-y-0 [&>*>*]:mt-0"') &&
    returned && presentationAttribute(returned, "className") === '`grid min-w-0 ${spacingClassName} [&>*]:min-w-0 ${columnsClassName} ${presentationClassName}${fieldContainerClassName} ${className}`.trim()' && variableExpression(shared, "columnsClassName")?.replace(/\r\n/g, "\n").startsWith('columns === 3 && presentation === "aligned-fields"\n      ? "grid-cols-1 md:grid-cols-3"');
}
function hasCharcoalPresentation(styles, tabs) {
  const tree = parsePresentation(styles);
  const declarations = tree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []);
  const tokenValue = (name, resolving = new Set()) => {
    if (resolving.has(name)) return undefined;
    const value = declarations.find(node => node.name.getText(tree) === name)?.initializer;
    if (!value) return undefined;
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
    if (!ts.isTemplateExpression(value)) return undefined;
    const next = new Set(resolving).add(name);
    let result = value.head.text;
    for (const span of value.templateSpans) {
      if (!ts.isIdentifier(span.expression)) return undefined;
      const nested = tokenValue(span.expression.text, next);
      if (nested === undefined) return undefined;
      result += nested + span.literal.text;
    }
    return result;
  };
  const tabsTree = parsePresentation(tabs);
  const owner = tabsTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "AdminModuleSectionHeader");
  const branch = owner?.body?.statements.find(node => ts.isIfStatement(node) && node.expression.getText(tabsTree) === 'tab.sectionHeaderPresentation === "premium"');
  const parameter = owner?.parameters[0]?.type;
  const standalone = parameter && ts.isIntersectionTypeNode(parameter) && parameter.types.filter(ts.isTypeLiteralNode).flatMap(node => node.members).find(node => ts.isPropertySignature(node) && node.name.getText(tabsTree) === "standalone");
  const header = presentationElements(branch?.getText(tabsTree) ?? "", "header").find(node => presentationAttribute(node, "data-admin-tab-section-presentation") === "premium");
  const className = header && presentationAttribute(header, "className")?.replace(/\s+/g, " ");
  return tokenValue("ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME") === "[--admin-section-header-surface:rgba(8,13,22,0.82)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))]" &&
    tokenValue("ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME") === "overflow-hidden rounded-t-2xl border-b border-white/10 bg-[color:var(--admin-section-header-surface,#080D10)] p-3 ps-6" &&
    tokenValue("ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME") === "flex min-w-0 flex-wrap items-center justify-between gap-3" &&
    tokenValue("ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME") === "relative -mx-3 -mt-3 mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3 overflow-hidden rounded-t-2xl border-b border-white/10 bg-[color:var(--admin-section-header-surface,#080D10)] p-3 ps-6" &&
    canonicalStyleImports(tabs, ["ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME", "ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME", "ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME", "ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME"]) &&
    standalone?.questionToken && standalone.type?.kind === ts.SyntaxKind.BooleanKeyword && variableExpression(tabs, "standalone") === "tab.standalone ?? false" &&
    className === '`${standalone ? `relative ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME} ${ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME}` : ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME} ${tab.sectionHeaderClassName ?? ""}`.trim()' && !tabs.includes("ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME");
}
function hasPanelTypography(basic, topic) {
  const consumers = ["TopicCharacterField", "TopicSlugInput", "TopicContentTypeControl", "TopicSeriesFields", "TopicImageField"];
  const image = presentationElements(basic, "TopicImageField"), rich = presentationElements(topic, "AdminRichTextEditor");
  return canonicalStyleImports(basic, ["ADMIN_FORM", "adminFormLabelClassName", "adminFormHintClassName"]) && canonicalStyleImports(topic, ["ADMIN_FORM", "adminFormHintClassName"]) &&
    variableExpression(basic, "labelClassName") === "panel ? adminFormLabelClassName({ textInset: true }) : undefined" && consumers.every((name) => { const fields = presentationElements(basic, name); return fields.length === (name === "TopicCharacterField" ? 2 : 1) && fields.every((node) => presentationAttribute(node, "labelClassName") === "labelClassName"); }) &&
    hasClassExpression(basic, "label", 'labelClassName ?? "inline-grid min-w-0 max-w-full shrink-0 space-y-1.5"') && hasClassExpression(basic, "span", 'labelClassName === undefined ? "text-xs font-medium text-white/58" : undefined') &&
    image.length === 1 && presentationAttribute(image[0], "guidanceClassName") === "panel ? adminFormHintClassName({ textInset: true }) : undefined" && presentationAttribute(image[0], "originalDimensionsClassName") === "panel ? ADMIN_FORM.helperTextInset : undefined" && rich.length === 1 && presentationAttribute(rich[0], "className") === "panel ? ADMIN_FORM.labelStack : undefined" && presentationAttribute(rich[0], "helperTextClassName") === "panel ? adminFormHintClassName({ textInset: true }) : undefined";
}
function preservesLabelPortDefaults(fields) {
  const pairedText = '`inline-flex items-center gap-2${labelClassName === undefined ? " text-xs font-medium text-white/58" : ""}`';
  const plainText = 'labelClassName === undefined ? "text-xs font-medium text-white/58" : undefined';
  return fields.every(({ source, component, wrapper, fallback, paired }) => component === "TopicImageField" ? hasCanonicalArticleImageMetadata(source) : optionalPresentationPort(source, component, "labelClassName") && hasClassExpression(source, wrapper, `labelClassName ?? "${fallback}"`) && hasClassExpression(source, component === "TopicSlugInput" ? "label" : "span", paired ? pairedText : plainText));
}
function hasCanonicalArticleImageMetadata(source) {
  const owners = presentationElements(source, "AdminMediaImageField");
  if (owners.length !== 1 || presentationElements(source, "textarea").length || presentationElements(source, "input").length) return false;
  const owner = owners[0];
  return optionalPresentationPort(source, "TopicImageField", "labelClassName") &&
    [["altName", "image_alt"], ["defaultAlt", 'defaultAlt ?? ""'], ["metadataPresentation", "panel"], ["metadataLabelClassName", "labelClassName"], ["altRows", "2"], ["showAltCounter", true], ["clearAltOnRemove", "false"], ["altId", "topic-image-alt"]].every(([name, value]) => presentationAttribute(owner, name) === value) &&
    presentationAttribute(owner, "captionName") === undefined && source.includes('altError={<AdminFormError name="image_alt" />}') && source.includes('altWarning={formId ? <AdminMediaAltWarning formId={formId} requiredForPublish /> : null}');
}
function hasSharedLabelTextInset(source) {
  const tree = parsePresentation(source), owner = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "adminFormLabelClassName"), parameter = owner?.parameters[0];
  const returned = owner?.body?.statements.find(ts.isReturnStatement)?.expression;
  return owner?.parameters.length === 1 && parameter.initializer?.getText(tree) === "{}" && parameter.type?.getText(tree) === "{ textInset?: boolean }" &&
    ts.isObjectBindingPattern(parameter.name) && parameter.name.elements.length === 1 && hasDefault(source, "adminFormLabelClassName", "textInset", "false") && owner.body.statements.length === 2 &&
    variableExpression(source, "label") === '`${ADMIN_FORM.labelStack} text-right text-xs font-medium text-white/48`' &&
    ts.isConditionalExpression(returned) && returned.condition.getText(tree) === "textInset" && returned.whenFalse.getText(tree) === "label" &&
    returned.whenTrue.getText(tree) === '`${label} [&>[data-admin-form-label-text]]:min-w-0 [&>[data-admin-form-label-text]]:ps-3`';
}
function hasScopedLabelTextRows(fields, basic, unaffected) {
  const marker = "data-admin-form-label-text", rows = [...fields, { source: basic, component: "category", wrapper: "label", fallback: "inline-grid min-w-0 max-w-full shrink-0 space-y-1.5" }];
  return unaffected.every((source) => !source.includes(marker) && !source.includes("adminFormLabelClassName")) && rows.every(({ source, component, wrapper, fallback }) => {
    if (component === "TopicImageField") return hasCanonicalArticleImageMetadata(source);
    const tree = parsePresentation(source), marked = [];
    const visit = (node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && presentationAttribute(node, marker) !== undefined) marked.push(node);
      ts.forEachChild(node, visit);
    };
    visit(tree);
    const opening = marked[0], row = opening?.parent, parent = row?.parent;
    if (marked.length !== 1 || !ts.isJsxOpeningElement(opening) || presentationAttribute(opening, marker) !== true || opening.tagName.getText(tree) !== (component === "TopicSlugInput" ? "label" : "span") ||
      !ts.isJsxElement(row) || !ts.isJsxElement(parent) || parent.openingElement.tagName.getText(tree) !== wrapper || presentationAttribute(parent.openingElement, "className") !== `labelClassName ?? "${fallback}"`) return false;
    const text = row.getText(tree), names = [];
    const visitChildren = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) names.push(node.tagName.getText(tree));
      ts.forEachChild(node, visitChildren);
    };
    visitChildren(row);
    if (!names.every((name) => ["span", "label", "TopicFieldCounter"].includes(name)) || presentationAttribute(opening, "dir") !== undefined || presentationAttribute(opening, "style") !== undefined) return false;
    if (["TopicCharacterField", "TopicSlugInput", "category"].includes(component) && !text.includes('<span className="text-red-400">*</span>')) return false;
    if (component === "TopicCharacterField" && (!text.includes("{counter}") || variableExpression(source, "counter") !== "<TopicFieldCounter count={currentCount} />" || !text.includes('{required ? <span className="text-red-400">*</span> : null}'))) return false;
    return component !== "TopicImageField" || presentationElements(text, "TopicFieldCounter").some((node) => presentationAttribute(node, "count") === "altLength");
  });
}
function hasOptionalMediaTitleMarker(source) {
  const tree = parsePresentation(source), metadataOwner = [];
  const find = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === "renderMetadataField") metadataOwner.push(node); ts.forEachChild(node, find); }; find(tree);
  const metadataMarkers = metadataOwner.length === 1 ? presentationElements(metadataOwner[0].getText(tree), "span").filter(node => presentationAttribute(node, "data-admin-form-label-text") !== undefined).length : 0;
  const marked = presentationElements(source, "span").filter(node => presentationAttribute(node, "data-admin-form-label-text") !== undefined);
  // The optional card URL entry has its own associated label. Keep the exact
  // two legacy markers protected, and classify only that gated label separately.
  const urlMarkers = marked.filter(node => {
    let associatedLabel = false, optInBranch = false;
    for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
      if (ts.isJsxElement(ancestor) && ancestor.openingElement.tagName.getText() === "label" && presentationAttribute(ancestor.openingElement, "htmlFor") === "urlInputOptions.id") associatedLabel = true;
      if (ts.isConditionalExpression(ancestor) && ancestor.condition.getText() === "urlInputOptions" && ancestor.whenTrue.pos <= node.pos && node.end <= ancestor.whenTrue.end) optInBranch = true;
    }
    return associatedLabel && optInBranch && variableExpression(source, "urlInputOptions") === "cardPresentation ? urlInput : undefined" && source.includes('const cardPresentation = variant === "card"');
  });
  return optionalPresentationPort(source, "AdminMediaImageField", "labelClassName") && marked.length - urlMarkers.length === 2 && urlMarkers.length <= 1 && metadataMarkers === 1 &&
    marked.every(node => presentationAttribute(node, "data-admin-form-label-text") === true) &&
    hasClassExpression(source, "span", 'labelClassName ?? `block text-xs font-semibold ${light ? "text-slate-700" : "text-white/55"}`') &&
    source.includes('{labelClassName ? <span data-admin-form-label-text>{label}</span> : label}') && source.includes('adminFormLabelClassName({ textInset: true })') && source.includes('"../../../lib/admin/admin-ui-styles"');
}
function preservesHelperPortDefaults(rich, image, media, guidance) {
  const richRoot = presentationElements(rich, "div").filter((node) => presentationAttribute(node, "data-admin-rich-text-scope") === "styleScope"), richUse = presentationElements(image, "AdminMediaImageField"), guidanceUses = presentationElements(media, "AdminMediaSlotGuidance");
  return hasDefault(rich, "AdminRichTextEditor", "className", '"space-y-2"') && richRoot.length === 1 && presentationAttribute(richRoot[0], "className") === "className" && optionalPresentationPort(rich, "AdminRichTextEditor", "helperTextClassName") &&
    hasClassExpression(rich, "p", 'helperTextClassName ?? `text-xs leading-6 ${appearance === "light" ? "text-slate-500" : "text-white/45"}`') && optionalPresentationPort(image, "TopicImageField", "guidanceClassName") &&
    richUse.length === 1 && presentationAttribute(richUse[0], "guidanceClassName") === "guidanceClassName" && optionalPresentationPort(media, "AdminMediaImageField", "guidanceClassName") && guidanceUses.filter(node => presentationAttribute(node, "presentation") !== "disclosure").length === 2 && guidanceUses.filter(node => presentationAttribute(node, "presentation") !== "disclosure").every((node) => presentationAttribute(node, "className") === "guidanceClassName" && presentationAttribute(node, "slot") === "mediaSlot") &&
    optionalPresentationPort(guidance, "AdminMediaSlotGuidance", "className") && hasClassExpression(guidance, "p", 'className ?? "text-xs leading-6 text-amber-600 dark:text-[#D8B87A]/75"') && guidance.includes('if (!slot || slot.design?.kind !== "recommended") return null;');
}
function hasSharedHelperTextInset(source) {
  const tree = parsePresentation(source), owner = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "adminFormHintClassName"), parameter = owner?.parameters[0];
  const returned = owner?.body?.statements.find(ts.isReturnStatement)?.expression;
  const form = variableExpression(source, "ADMIN_FORM");
  return owner?.parameters.length === 1 && parameter.initializer?.getText(tree) === "{}" && parameter.type?.getText(tree) === "{ textInset?: boolean }" &&
    ts.isObjectBindingPattern(parameter.name) && parameter.name.elements.length === 1 && hasDefault(source, "adminFormHintClassName", "textInset", "false") && owner.body.statements.length === 2 &&
    /\bhelperTextInset:\s*"min-w-0 ps-3"/.test(form) && variableExpression(source, "hint") === '"block text-right text-[11px] leading-5 text-white/32"' &&
    ts.isConditionalExpression(returned) && returned.condition.getText(tree) === "textInset" && returned.whenFalse.getText(tree) === "hint" && returned.whenTrue.getText(tree) === '`${hint} ${ADMIN_FORM.helperTextInset}`';
}
function hasOriginalDimensionsPresentation(image, media, originalDimensions) {
  const imageUses = presentationElements(image, "AdminMediaImageField"), originalUses = presentationElements(media, "AdminMediaOriginalDimensions").filter(node => presentationAttribute(node, "presentation") !== "disclosure" && presentationAttribute(node, "className") !== undefined);
  const tree = parsePresentation(originalDimensions), owner = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "AdminMediaOriginalDimensions"), ownerSource = owner?.getText(tree) ?? "";
  const paragraphs = presentationElements(ownerSource, "p").filter(node => presentationAttribute(node, "data-media-original") !== undefined);
  return optionalPresentationPort(image, "TopicImageField", "originalDimensionsClassName") && imageUses.length === 1 && presentationAttribute(imageUses[0], "originalDimensionsClassName") === "originalDimensionsClassName" &&
    optionalPresentationPort(media, "AdminMediaImageField", "originalDimensionsClassName") && originalUses.length === 2 && originalUses.every((node) => presentationAttribute(node, "className") === "originalDimensionsClassName" && presentationAttribute(node, "value") === "value" && presentationAttribute(node, "state") === "referenceState") &&
    optionalPresentationPort(originalDimensions, "AdminMediaOriginalDimensions", "className") && paragraphs.length === 1 && presentationAttribute(paragraphs[0], "data-media-original") === "value" && presentationAttribute(paragraphs[0], "className") === '`text-xs leading-6 text-slate-500${className ? ` ${className}` : ""}`' &&
    (ownerSource.match(/<bdi>\{original.width\}/g)?.length === 2) && ownerSource.includes('data-admin-media-dimension="original"') && ownerSource.includes('if (!value) return null;') && ownerSource.includes('const original = state?.originals.find(item => item.value === value);') && ownerSource.includes('original?.width && original.height ? <bdi>{original.width} × {original.height} px</bdi> : state ? "غير متاحة" : "جارٍ قراءة أبعاد الأصل…"');
}
function hasScopedDescriptionRemoval(edit, create, shell, runtime) {
  const editBasic = presentationElements(edit, "ContentBasicDataPanel"), createBasic = presentationElements(create, "ContentBasicDataPanel"), actions = presentationElements(shell, "AdminFormActions");
  return editBasic.length === 1 && presentationAttribute(editBasic[0], "description") === undefined && !edit.includes("حدّث المحتوى الأساسي والتصنيف والصورة وإعدادات الظهور.") &&
    createBasic.length === 1 && presentationAttribute(createBasic[0], "description") === "اكتب المحتوى الأساسي واضبط التصنيف والصورة وإعدادات الظهور." && actions.length === 1 && presentationAttribute(actions[0], "description") === "null" && !shell.includes("احفظ التغييرات أو أغلق النموذج.") &&
    hasDefault(runtime, "AdminFormActions", "description", '"احفظ التغييرات أو أغلق النموذج."');
}

const [
  contentTypes,
  newPage,
  editPage,
  createEditor,
  editEditor,
  shell,
  basicPanel,
  formDefinition,
  categorySelect,
  seriesFields,
  typeControl,
  slugInput,
  imageField,
  markdownEditor,
  displaySettings,
  faqEditor,
  publishingOptions,
  helpers,
  validation,
  publicLoader,
  publicPage,
  publicLayout,
  publicPath,
  migration,
] = await Promise.all([
  read("src/lib/admin/content/content-types.ts"),
  read("src/app/admin/content/topics/new/page.tsx"),
  read("src/app/admin/content/topics/[id]/page.tsx"),
  read("src/components/admin/content/editors/ArticleCreateEditor.tsx"),
  read("src/components/admin/content/editors/ArticleEditor.tsx"),
  read("src/components/admin/content/editors/ContentEditorShell.tsx"),
  read("src/components/admin/content/editors/ContentBasicDataPanel.tsx"),
  read("src/components/admin/content/editors/content-form-definition.ts"),
  read("src/components/admin/content/editors/ContentCategorySelect.tsx"),
  read("src/components/admin/content/editors/article/TopicSeriesFields.tsx"),
  read("src/components/admin/content/editors/TopicContentTypeControl.tsx"),
  read("src/components/admin/content/editors/article/TopicSlugInput.tsx"),
  read("src/components/admin/content/editors/article/TopicImageField.tsx"),
  read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx"),
  read("src/components/admin/content/editors/ContentDisplaySettings.tsx"),
  read("src/components/admin/content/editors/article/FaqEditor.tsx"),
  read("src/components/admin/content/editors/ContentPublishingOptions.tsx"),
  read("src/app/admin/content/topics/article-actions/helpers.ts"),
  read("src/app/admin/content/topics/article-actions/validation.ts"),
  read("src/lib/topics/load-public-topics.ts"),
  read("src/app/(site)/topics/[slug]/page.tsx"),
  read("src/components/InternalPageLayout.tsx"),
  read("src/lib/content/public-content-path.ts"),
  read("sql/migrations/20260721143000_topics_page_display_settings.sql"),
]);

for (const value of ["article", "news", "press", "site_update", "video", "gallery"]) {
  check(`content type ${value} remains registered`, contentTypes.includes(`"${value}",`) && contentTypes.includes(`${value}: {`));
}

check("new route selects the article create adapter", newPage.includes('<ArticleCreateEditor') && newPage.includes('contentType === "article"'));
check("Media Create uses the existing canonical localized content-type label", hasLocalizedMediaCreateTitle(newPage));
check("Media Create label rejects raw type keys and a parallel label owner", !hasLocalizedMediaCreateTitle(newPage.replace("getContentTypeLabel(contentType)", "contentType")) && !hasLocalizedMediaCreateTitle(newPage.replace('/lib/admin/content/content-types"', '/lib/admin/content/parallel-content-types"')));
check("edit route selects the article edit adapter", editPage.includes('<ArticleEditor') && editPage.includes('editorKind === "article"'));
check("article create and edit each delegate to one shared shell", [createEditor, editEditor].every((source) => source.match(/<ContentEditorShell\b/g)?.length === 1 && !source.includes("<form")));
check("shared shell exclusively owns the canonical form runtime and actions", hasCanonicalShellFormOwners(shell));
check("shared shell rejects parallel owners, duplicate actions and a local form", !hasCanonicalShellFormOwners(shell.replace('from "../../ui/AdminFormRuntime"', 'from "../../ui/ParallelRuntime"')) && !hasCanonicalShellFormOwners(`${shell}\nconst duplicate = <AdminFormActions />;`) && !hasCanonicalShellFormOwners(`${shell}\nconst localForm = <form />;`));
check("shared shell owns typed form identity", shell.includes('name="content_type"') && shell.includes('name="id"') && shell.includes('entityKey={`content:${contentType}`}'));
check("article modes and shared save action stay explicit", createEditor.includes('mode="create"') && editEditor.includes('mode="edit"') && [createEditor, editEditor].every((source) => source.includes("action={saveContentForm}")));
check("article create-to-edit form IDs remain stable", createEditor.includes('formId="topic-create-form"') && editEditor.includes('formId="topic-edit-form"'));
check("article editors preserve the media-catalog save signal", [createEditor, editEditor].every((source) => source.match(/<TopicMediaCatalogSyncSignal\b/g)?.length === 1));

for (const id of ["basic", "display", "faq", "seo", "publish"]) {
  check(`article create and edit retain the ${id} tab`, [createEditor, editEditor].every((source) => source.match(new RegExp(`id: "${id}"`, "g"))?.length === 1));
}
check("shared shell renders declarative editor tabs through its shared presentation layer", shell.includes("<AdminModuleTabs") && shell.includes('variant="editor"') && shell.includes("tabs={presentedTabs}") && shell.includes("tabs.map((tab) =>"));
check("legacy content tab remains absent", !createEditor.includes('id: "content"') && !editEditor.includes('id: "content"'));

check("article adapters mount every article-specific capability once", [createEditor, editEditor].every((source) => ["ContentBasicDataPanel", "TopicMarkdownEditor", "FaqEditor", "SeoPanel", "ContentPublishingOptions", "ContentReviewPanel"].every((owner) => source.match(new RegExp(`<${owner}\\b`, "g"))?.length === 1)));
check("shared basic owner keeps title, excerpt, slug, image, category, series and injected body", basicPanel.includes('name="title"') && basicPanel.includes('name="excerpt"') && basicPanel.includes("<TopicSlugInput") && basicPanel.includes("<TopicImageField") && basicPanel.includes("<ContentCategorySelect") && basicPanel.includes("<TopicSeriesFields") && basicPanel.match(/\{contentEditor\}/g)?.length === 1);
check(
  "content type remains display-only inside the common identity",
  basicPanel.includes("<TopicContentTypeControl") &&
    !/<(?:input|select|textarea)\b[^>]*\bname=/.test(typeControl),
);
check(
  "category submits one stable category_id control through the shared form listbox",
  categorySelect.match(/<AdminFormListboxSelect\b/g)?.length === 1 &&
    categorySelect.includes('name="category_id"') &&
    categorySelect.includes('focusTargetId="content-category-listbox"') &&
    !categorySelect.includes("<select"),
);
check(
  "category hierarchy delegates indentation to the shared listbox depth contract",
  categorySelect.includes("depth: category.depth") &&
    !categorySelect.includes('repeat(category.depth)'),
);
check(
  "only the persisted Category bypasses published-and-active selectability",
  categorySelect.includes("category.id !== persistedSelectionId") &&
    categorySelect.includes('category.status === "published"') &&
    categorySelect.includes("category.is_active === true") &&
    basicPanel.includes("persistedSelectionId"),
);
check(
  "series retains one series_id owner and stable target through the shared form listbox",
  seriesFields.match(/<AdminFormListboxSelect\b/g)?.length === 1 &&
    seriesFields.includes('name="series_id"') &&
    seriesFields.includes('focusTargetId="content-series-listbox"') &&
    !seriesFields.includes('<input type="hidden" name="series_id"'),
);
check("Slug preserves raw manual typing, protected persisted defaults and explicit Auto through the canonical generator and committed input notification", hasObservedSlugModes(slugInput));
check("Slug modes reject per-keystroke canonicalization, blur normalization of untouched persisted defaults, swallowed nonempty invalid drafts and loss of manual protection", !hasObservedSlugModes(slugInput.replace("setValue(event.target.value)", "setValue(slugifyFromTitle(event.target.value))")) && !hasObservedSlugModes(slugInput.replace('isManual && event.currentTarget.value !== (defaultValue ?? "")', "isManual")) && !hasObservedSlugModes(slugInput.replaceAll("if (normalized || !rawValue.trim())", "if (true)")) && !hasObservedSlugModes(slugInput.replace("useState(draftRestored || Boolean(defaultValue))", "useState(false)")) && !hasObservedSlugModes(slugInput.replace("titleValue !== undefined && !isManual ?", "titleValue !== undefined ?")));
check("Slug observation rejects silent Auto, non-bubbling events, changed dependency and an initial false dirty notification", !hasObservedSlugModes(slugInput.replace('inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));', "")) && !hasObservedSlugModes(slugInput.replace("bubbles: true", "bubbles: false")) && !hasObservedSlugModes(slugInput.replace("}, [resolvedValue]);", "}, []);")) && !hasObservedSlugModes(slugInput.replace("useRef(resolvedValue)", 'useRef("")')));
check("Slug Auto rejects a parallel generator, global title lookup, stale controlled-title priority and accidental submit", !hasObservedSlugModes(slugInput.replace('/lib/admin/slug"', '/lib/admin/parallel-slug"')) && !hasObservedSlugModes(slugInput.replaceAll("form?.elements.namedItem(titleInputName)", 'document.querySelector("[name=title]")')) && !hasObservedSlugModes(slugInput.replace("slugifyFromTitle(currentTitle)", 'slugifyFromTitle(titleValue ?? currentTitle)')) && !hasObservedSlugModes(slugInput.replace('type="button"', 'type="submit"')));
check("A successful save on the input's own form protects its live slug without normalizing or notifying a value change and cleans up its existing lifecycle listener", hasSavedSlugProtection(slugInput));
const savedSlugMutations = [
  ['form.addEventListener("admin-form-saved", protectSavedSlug);', ""],
  ['form.addEventListener("admin-form-saved", protectSavedSlug);', 'document.addEventListener("admin-form-saved", protectSavedSlug);'],
  ['const form = input?.form;', 'const form = document.querySelector("form");'],
  ['return () => form.removeEventListener("admin-form-saved", protectSavedSlug);', ""],
  ['form.removeEventListener("admin-form-saved", protectSavedSlug)', 'form.removeEventListener("admin-form-saved", () => {})'],
  ["setValue(input.value)", "setValue(resolvedValue)"],
  ["setValue(input.value)", "setValue(slugifyFromTitle(input.value))"],
  ["setValue(input.value);", 'setValue(input.value); input.dispatchEvent(new Event("input", { bubbles: true }));'],
  ["setIsManual(true);", "setIsManual(false);"],
];
check("Saved Slug protection rejects a missing or global listener, wrong form, lost cleanup, wrong callback, stale value, normalization, dirty notification and continued automatic mode", savedSlugMutations.every(([before, after]) => slugInput.includes(before) && !hasSavedSlugProtection(slugInput.replace(before, after))));
check("Slug finalizes its live draft through the existing own-form pre-submit lifecycle with current title fallback, invalid-value retention and matching cleanup", hasFinalizedSlugSubmission(slugInput));
const slugFinalizationMutations = [
  ['form.addEventListener("admin-form-before-submit", finalizeSlug);', ""],
  ['form.addEventListener("admin-form-before-submit", finalizeSlug);', 'document.addEventListener("admin-form-before-submit", finalizeSlug);'],
  ['return () => form.removeEventListener("admin-form-before-submit", finalizeSlug);', ""],
  ['form.removeEventListener("admin-form-before-submit", finalizeSlug)', 'form.removeEventListener("admin-form-before-submit", () => {})'],
  ['[titleInputName, titleValue]', '[]'],
  ['form.elements.namedItem(titleInputName)', 'document.querySelector("[name=title]")'],
  ['slugifyFromTitle(rawValue.trim() || currentTitle)', 'slugifyFromTitle(rawValue)'],
  ['slugifyFromTitle(rawValue.trim() || currentTitle)', 'slugifyFromTitle(titleValue ?? rawValue)'],
  ['const rawValue = input.value;', 'const rawValue = defaultValue ?? "";'],
  ['if (normalized || !rawValue.trim()) setValue(normalized);', 'setValue(normalized);'],
  ['if (normalized || !rawValue.trim()) setValue(normalized);', 'if (normalized || !rawValue.trim()) { setValue(normalized); setIsManual(false); }'],
];
check("Slug finalization rejects missing or global registration, missing or wrong cleanup, stale dependencies or value, global title reads, removed title fallback, swallowed invalid drafts and mode changes", slugFinalizationMutations.every(([before, after]) => slugInput.includes(before) && !hasFinalizedSlugSubmission(slugInput.replace(before, after))) && !hasFinalizedSlugSubmission(slugInput.replaceAll("const form = input?.form;", 'const form = document.querySelector("form");')));
check("Article image and Alt submission delegate once to the canonical ImageField without a parallel native editor", hasCanonicalArticleImageMetadata(imageField));
check("Markdown adapter is the sole article content field owner", markdownEditor.match(/<AdminRichTextEditor\b/g)?.length === 1 && markdownEditor.includes('name="content"') && markdownEditor.includes('storageFormat="markdown"') && !/<textarea[^>]*name="content"/.test(markdownEditor));
check("FAQ retains one owner for each visibility setting", faqEditor.match(/name="show_faq_on_page"/g)?.length === 1 && faqEditor.match(/name="show_faq_title_on_page"/g)?.length === 1);
const [topicSwitch, sidebarDisplayConsumer, mediaEditor, sharedSwitch, characterField, sharedRichText, adminUiStyles, sharedTabs, sharedRuntime, mediaImageField, mediaSlotGuidance, mediaReferencePresentation, sharedForm] = await Promise.all([
  read("src/components/admin/content/editors/article/TopicFormSwitch.tsx"),
  read("src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx"),
  read("src/components/admin/content/editors/media/MediaContentForm.tsx"),
  read("src/components/admin/ui/AdminFormSwitch.tsx"),
  read("src/components/admin/content/editors/article/TopicCharacterField.tsx"),
  read("src/components/admin/AdminRichTextEditor.tsx"),
  read("src/lib/admin/admin-ui-styles.ts"),
  read("src/components/admin/ui/AdminModuleTabs.tsx"),
  read("src/components/admin/ui/AdminFormRuntime.tsx"),
  read("src/components/admin/media/AdminMediaImageField.tsx"),
  read("src/components/admin/media/AdminMediaSlotGuidance.tsx"),
  read("src/components/admin/media/AdminDeletedMediaNotice.tsx"),
  read("src/components/admin/ui/AdminForm.tsx"),
]);
const familyDisplayConsumers = [createEditor, editEditor, mediaEditor];
check("Recovered Slug drafts including blank explicitly retain manual protection in all Create/Edit adapters while omitted defaults remain unchanged", hasRecoveredSlugProtection(slugInput, basicPanel, familyDisplayConsumers));
check("Recovered Slug protection rejects missing explicit draft mode, changed defaults, missing Basic forwarding and per-consumer truthiness instead of field presence", !hasRecoveredSlugProtection(slugInput.replace("draftRestored || Boolean(defaultValue)", "Boolean(defaultValue)"), basicPanel, familyDisplayConsumers) && !hasRecoveredSlugProtection(slugInput.replace("draftRestored = false", "draftRestored = true"), basicPanel, familyDisplayConsumers) && !hasRecoveredSlugProtection(slugInput, basicPanel.replace("draftRestored={slugDraftRestored}", ""), familyDisplayConsumers) && familyDisplayConsumers.every((_, index) => !hasRecoveredSlugProtection(slugInput, basicPanel, familyDisplayConsumers.map((source, current) => current === index ? source.replace('Object.hasOwn(model.recoveryFields ?? {}, "slug")', 'Boolean(model.recoveryFields?.slug?.[0])') : source))));
const slugTree = parsePresentation(slugInput);
let initialManualExpression;
const findManualInitializer = node => {
  if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.name.elements[0]?.name?.getText(slugTree) === "isManual" && node.initializer && ts.isCallExpression(node.initializer)) initialManualExpression = node.initializer.arguments[0]?.getText(slugTree);
  ts.forEachChild(node, findManualInitializer);
};
findManualInitializer(slugTree);
const initialManualMode = new Function("draftRestored", "defaultValue", `return (${initialManualExpression});`);
check("The actual Slug state initializer preserves recovered empty values and persisted manual values while a fresh omitted draft remains automatic", initialManualMode(true, "") === true && initialManualMode(false, "persisted-slug") === true && initialManualMode(false, "") === false);
check("Basic retains its optional display compatibility slot while Article family moves its one display owner to an independent tab", basicPanel.includes("displaySettings?: ReactNode") && hasInjectedDisplaySections(basicPanel) && familyDisplayConsumers.every(source => !presentationElements(source, "ContentBasicDataPanel").some(node => presentationAttribute(node, "displaySettings") !== undefined)) && ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page"].every((name) => displaySettings.match(new RegExp(`name="${name}"`, "g"))?.length === 1));
check("Family display groups explicitly adopt four-column premium-inline while Sidebar premium and omitted defaults remain unchanged", preservesDisplayDefault(displaySettings, topicSwitch, sidebarDisplayConsumer, familyDisplayConsumers));
check("Display presentation rejects changed defaults, missing Sidebar adoption and unconditional default layout", !preservesDisplayDefault(displaySettings.replace("embedded = false", "embedded = true"), topicSwitch, sidebarDisplayConsumer, familyDisplayConsumers) && !preservesDisplayDefault(displaySettings, topicSwitch.replace("embedded = false", "embedded = true"), sidebarDisplayConsumer, familyDisplayConsumers) && !preservesDisplayDefault(displaySettings, topicSwitch, sidebarDisplayConsumer.replace(/(<ContentDisplaySettings\s+columns=\{3\}\s+)presentation="premium"/, '$1presentation="default"'), familyDisplayConsumers) && !preservesDisplayDefault(displaySettings.replaceAll('embedded ? "inline" : undefined', '"inline"'), topicSwitch, sidebarDisplayConsumer, familyDisplayConsumers) && !preservesDisplayDefault(displaySettings.replace('presentation = "default"', 'presentation = "premium"'), topicSwitch, sidebarDisplayConsumer, familyDisplayConsumers));
check("Premium switch delegates one canonical Card and retains the single native checked/unchecked owner", hasPremiumSwitchComposition(sharedSwitch));
check("Premium switch rejects a changed default, parallel Card, local checkbox and lost unchecked submission", !hasPremiumSwitchComposition(sharedSwitch.replace('presentation = "default"', 'presentation = "premium"')) && !hasPremiumSwitchComposition(sharedSwitch.replace('from "./AdminCard"', 'from "./ParallelCard"')) && !hasPremiumSwitchComposition(sharedSwitch.replaceAll(/\{switchControl\}\s*<\/label>/g, '<input type="checkbox" /></label>')) && !hasPremiumSwitchComposition(sharedSwitch.replace('value={uncheckedValue}', 'value=""')));
check("Premium-inline uses one natural-height canonical Card, caller icon, flexible label and the unchanged native switch owner", hasPremiumInlineSwitchComposition(sharedSwitch, topicSwitch, displaySettings));
check("Premium-inline rejects parallel surfaces, local height, expanded spacing, missing control, icon semantics and adapter loss", !hasPremiumInlineSwitchComposition(sharedSwitch.replace('from "./AdminCard"', 'from "./ParallelCard"'), topicSwitch, displaySettings) && !hasPremiumInlineSwitchComposition(sharedSwitch.replace('className="px-2.5 py-2.5"', 'className="h-12 px-2.5 py-2.5"'), topicSwitch, displaySettings) && !hasPremiumInlineSwitchComposition(sharedSwitch.replace('items-center gap-1 text-xs', 'items-center gap-2 text-xs'), topicSwitch, displaySettings) && !hasPremiumInlineSwitchComposition(sharedSwitch.replace(/\{switchControl\}\s*<\/label>/, '<input type="checkbox" /></label>'), topicSwitch, displaySettings) && !hasPremiumInlineSwitchComposition(sharedSwitch.replace('aria-hidden="true"', 'aria-hidden="false"'), topicSwitch, displaySettings) && !hasPremiumInlineSwitchComposition(sharedSwitch, topicSwitch.replace('icon={icon}', ''), displaySettings));
check("Premium-inline rejects unconditional icons, parallel icon owners and stale family columns or presentation", !hasPremiumInlineSwitchComposition(sharedSwitch, topicSwitch, displaySettings.replaceAll('presentation === "premium-inline" ?', 'true ?')) && !hasPremiumInlineSwitchComposition(sharedSwitch, topicSwitch, displaySettings.replace('from "../../ui/AdminModuleTabs"', 'from "../../ui/ParallelIcons"')) && !preservesDisplayDefault(displaySettings, topicSwitch, sidebarDisplayConsumer, familyDisplayConsumers.map((source) => source.replace('columns={4}', 'columns={3}'))) && !preservesDisplayDefault(displaySettings, topicSwitch, sidebarDisplayConsumer, familyDisplayConsumers.map((source) => source.replace('presentation="premium-inline"', 'presentation="premium"'))));
check("Premium-inline keeps 16px field icons below section scale and rejects stale 20px icons or inconsistent font and padding", !hasPremiumInlineSwitchComposition(sharedSwitch.replace('inline-flex size-4 shrink-0 items-center justify-center text-[#D8B87A] [&>svg]:size-4', 'inline-flex size-5 shrink-0 items-center justify-center text-[#D8B87A] [&>svg]:size-5'), topicSwitch, displaySettings) && !hasPremiumInlineSwitchComposition(sharedSwitch.replace('items-center gap-1 text-xs', 'items-center gap-1 text-sm'), topicSwitch, displaySettings) && !hasPremiumInlineSwitchComposition(sharedSwitch.replace('px-2.5 py-2.5', 'px-3 py-2.5'), topicSwitch, displaySettings));
check("Premium-inline preserves its default two-column intro while all three Display tabs explicitly adopt natural single-cell flow", hasPremiumInlineIntroSpan(displaySettings) && familyDisplayConsumers.every(source => presentationElements(source, "ContentDisplaySettings").every(node => presentationAttribute(node, "introCardSpan") === "1")) && presentationElements(sidebarDisplayConsumer, "ContentDisplaySettings").every(node => presentationAttribute(node, "introCardSpan") === undefined));
check("Intro width rejects a parallel owner, wrong span, changed default branch, duplicate native owner and local sizing", !hasPremiumInlineIntroSpan(displaySettings.replace('from "../../ui/AdminFormRuntime"', 'from "../../ui/ParallelGrid"')) && !hasPremiumInlineIntroSpan(displaySettings.replace('span={2}', 'span={3}')) && !hasPremiumInlineIntroSpan(displaySettings.replace(') : introControl', ') : null')) && !hasPremiumInlineIntroSpan(displaySettings.replace('{introControl}</AdminFormGridItem>', '{introControl}{introControl}</AdminFormGridItem>')) && !hasPremiumInlineIntroSpan(displaySettings.replace('<AdminFormGridItem span={2}>', '<AdminFormGridItem span={2} className="h-12">')) && !hasPremiumInlineIntroSpan(displaySettings.replace('introCardSpan = 2', 'introCardSpan = 1')) && !hasPremiumInlineIntroSpan(displaySettings.replace(' && introCardSpan === 2', '')));
check("Content explicitly delegates direct Cards to the canonical equal-height Grid while shared Layout retains original ratio, gaps and omitted defaults", hasEqualHeightContentGrid(basicPanel, sharedForm));
check("Content equal-height composition rejects parallel grids, missing opt-in, local width ratios, wrappers, forced inner height and default changes", !hasEqualHeightContentGrid(basicPanel.replace('from "../../ui/AdminFormRuntime"', 'from "../../ui/ParallelGrid"'), sharedForm) && !hasEqualHeightContentGrid(basicPanel.replace('presentation="equal-height-columns"', 'presentation="plain"'), sharedForm) && !hasEqualHeightContentGrid(basicPanel.replace('panel && !displaySection ?', 'true ?'), sharedForm) && !hasEqualHeightContentGrid(basicPanel.replace('className={className}', 'className="xl:grid-cols-2"'), sharedForm) && !hasEqualHeightContentGrid(basicPanel, sharedForm.replace('<>{children}{aside}', '<><div>{children}</div>{aside}')) && !hasEqualHeightContentGrid(basicPanel, sharedForm.replace('min-w-0 gap-x-3 gap-y-3', 'min-w-0 h-full gap-x-3 gap-y-3')) && !hasEqualHeightContentGrid(basicPanel, sharedForm.replace('renderGrid,', 'renderGrid = () => null,')) && !hasEqualHeightContentGrid(basicPanel, sharedForm.replaceAll('1.85fr', '1fr')));
check("Only the three panel selectors reuse the existing frame and padding over parent Charcoal with natural content flow while responsive columns and omitted Grid defaults remain", hasSelectFieldContainers(basicPanel, sharedRuntime));
check("Selector containers reject lost or unconditional adoption, other-field leakage, local CSS, changed canonical surface and changed defaults", !hasSelectFieldContainers(basicPanel.replace('fieldContainers={panel}', ''), sharedRuntime) && !hasSelectFieldContainers(basicPanel.replace('fieldContainers={panel}', 'fieldContainers'), sharedRuntime) && !hasSelectFieldContainers(basicPanel.replace('<AdminFormGrid columns={2}', '<AdminFormGrid columns={2} fieldContainers={panel}'), sharedRuntime) && !hasSelectFieldContainers(basicPanel.replace('fieldContainers={panel}', 'fieldContainers={panel} className="p-3"'), sharedRuntime) && !hasSelectFieldContainers(basicPanel, sharedRuntime.replace('[&>*]:bg-[#05070B]', '[&>*]:bg-black')) && !hasSelectFieldContainers(basicPanel, sharedRuntime.replace('fieldContainers = false', 'fieldContainers = true')) && !hasSelectFieldContainers(basicPanel, sharedRuntime.replace('fieldContainers && presentation !== "control-cards"', 'fieldContainers')) && !hasSelectFieldContainers(basicPanel, sharedRuntime.replace('` ${controlCardFrameClassName} ${controlCardPaddingClassName}`', '` ${controlCardSurfaceClassName}`')) && !hasSelectFieldContainers(basicPanel, sharedRuntime.replace('? "items-stretch"', '? "items-start [&>*]:row-span-3"')));
check("Panel excerpt alone opts into native rows sizing while the default textarea floor, control bindings and counter lifecycle remain canonical", hasRowsTextareaSizing(characterField, basicPanel));
check("Rows sizing rejects changed defaults, a lost legacy floor, altered native rows or value bindings and unconditional consumer opt-in", !hasRowsTextareaSizing(characterField.replace('textareaSizing = "default"', 'textareaSizing = "rows"'), basicPanel) && !hasRowsTextareaSizing(characterField.replace('" min-h-40"', '""'), basicPanel) && !hasRowsTextareaSizing(characterField.replace('rows={rows}', 'rows={2}'), basicPanel) && !hasRowsTextareaSizing(characterField.replace('{...valueProps}', ''), basicPanel) && !hasRowsTextareaSizing(characterField, basicPanel.replace('textareaSizing={panel ? "rows" : undefined}', 'textareaSizing="rows"')) && !hasRowsTextareaSizing(characterField, basicPanel.replace('rows={panel ? 5 : 2}', 'rows={5}')) && !hasRowsTextareaSizing(characterField, basicPanel.replace('rows={panel ? 5 : 2}', 'rows={2}')));
check("Panel draft-restored notice delegates manual keyboard dismissal to the shared owner and changes only notice visibility and editor focus", hasPanelDraftNotice(markdownEditor));
check("Draft notice rejects a parallel owner, default adoption, timed or URL cleanup, lost dismiss handler and content/storage mutation", !hasPanelDraftNotice(markdownEditor.replace('from "../../../AdminNotice"', 'from "../../../ParallelNotice"')) && !hasPanelDraftNotice(markdownEditor.replace('presentation="compact"', 'presentation="default"')) && !hasPanelDraftNotice(markdownEditor.replace('lifecycle="manual"', 'lifecycle="automatic"')) && !hasPanelDraftNotice(markdownEditor.replace('dismissSearchParams={[]}', 'dismissSearchParams={["success"]}')) && !hasPanelDraftNotice(markdownEditor.replace('onDismiss={dismissDraftRestoredNotice}', '')) && !hasPanelDraftNotice(markdownEditor.replace(/setDraftRestored\(false\);\r?\n    sectionRef.current/, 'setDraftRestored(false);\n    window.localStorage.clear();\n    sectionRef.current')) && !hasPanelDraftNotice(markdownEditor.replace(/setDraftRestored\(false\);\r?\n    sectionRef.current/, 'setDraftRestored(false);\n    commitContent("");\n    sectionRef.current')));
check("Specialized publishing controls retain their presentation and native status contract", presentationElements(publishingOptions, "AdminFormSwitch").every((node) => presentationAttribute(node, "presentation") === undefined) && presentationElements(publishingOptions, "TopicFormSwitch").every((node) => presentationAttribute(node, "presentation") === undefined));
check("Basic image and display retain full section headers with presentation-specific display placement", presentationElements(basicPanel, "AdminModuleSectionHeader").some((node) => presentationAttribute(node, "id") === "content-main-image") && hasInjectedDisplaySections(basicPanel));
check("Basic display rejects duplicate fields, changed Header owner, missing default Header and lost conditional placement", !hasInjectedDisplaySections(basicPanel.replaceAll("{displaySettings}", "{displaySettings}{displaySettings}")) && !hasInjectedDisplaySections(basicPanel.replaceAll("<AdminModuleSectionHeader", "<ParallelHeader")) && !hasInjectedDisplaySections(basicPanel.replaceAll('id="content-display-settings-heading"', 'id="missing-display-header"')) && !hasInjectedDisplaySections(basicPanel.replace("secondary={panel ? displaySection : undefined}", "secondary={displaySection}")));
check("Only three qualified Basic panel headers adopt canonical charcoal while the fourth body header, defaults and six-counter summary retain their contracts", hasPremiumContentHeaders(basicPanel, markdownEditor));
const defaultImageHeader = presentationElements(basicPanel, "AdminModuleSectionHeader").find(node => presentationAttribute(node, "id") === "content-main-image" && presentationAttribute(node, "sectionHeaderPresentation") === undefined);
const basicWithDefaultImagePremium = defaultImageHeader ? basicPanel.slice(0, defaultImageHeader.getStart()) + defaultImageHeader.getText().replace("<AdminModuleSectionHeader", '<AdminModuleSectionHeader sectionHeaderPresentation="premium"') + basicPanel.slice(defaultImageHeader.end) : basicPanel;
check("Premium Content headers reject lost adoption, default leakage, unconditional scope, local identity overrides and a detached summary", !hasPremiumContentHeaders(basicPanel.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="panel"'), markdownEditor) && !hasPremiumContentHeaders(basicPanel, markdownEditor.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="panel"')) && !hasPremiumContentHeaders(basicWithDefaultImagePremium, markdownEditor) && !hasPremiumContentHeaders(basicPanel.replace('panel ? <AdminModuleSectionHeader', 'true ? <AdminModuleSectionHeader'), markdownEditor) && !hasPremiumContentHeaders(basicPanel, markdownEditor.replace('const editorHeader = panel ?', 'const editorHeader = true ?')) && !hasPremiumContentHeaders(basicPanel.replace('id="content-basic-data"', 'id="content-basic-data" sectionHeaderClassName="[&_svg]:size-8"'), markdownEditor) && !hasPremiumContentHeaders(basicPanel, markdownEditor.replace('sectionSummary={editorStats}', 'sectionSummary={null}')));
check("Charcoal presentation retains the Admin Panel neutral layers and the omitted premium header fallback", hasCharcoalPresentation(adminUiStyles, sharedTabs));
check("Charcoal rejects a parallel token, lost opt-in, default header leakage, fourth-header adoption and a changed omitted fallback", !hasPremiumContentHeaders(basicPanel.replace('/lib/admin/admin-ui-styles"', '/lib/admin/parallel-ui-styles"'), markdownEditor) && !hasPremiumContentHeaders(basicPanel.replace('sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}', ''), markdownEditor) && !hasPremiumContentHeaders(basicPanel.replace('id="content-body"', 'id="content-body" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}'), markdownEditor) && !hasPremiumContentHeaders(basicPanel, markdownEditor.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}')) && !hasCharcoalPresentation(adminUiStyles.replace('var(--admin-section-header-surface,#080D10)', 'var(--admin-section-header-surface,#000000)'), sharedTabs));
const sharedPremiumHeaderClass = presentationElements(sharedTabs, "header").filter(node => presentationAttribute(node, "data-admin-tab-section-presentation") === "premium").map(node => presentationAttribute(node, "className"))[0];
check("Shared Header chrome rejects detached imports, unused owner tokens and changed canonical padding without requiring copied consumer CSS", !hasCharcoalPresentation(adminUiStyles, sharedTabs.replace('/lib/admin/admin-ui-styles"', '/lib/admin/parallel-ui-styles"')) && !hasCharcoalPresentation(adminUiStyles, sharedTabs.replace(sharedPremiumHeaderClass, 'tab.sectionHeaderClassName')) && !hasCharcoalPresentation(adminUiStyles.replace(' p-3 ps-6"', ' p-4 ps-6"'), sharedTabs));
check("Header-only composition rejects changed defaults, a required port, reserved body spacing and changed canonical layout", !hasCharcoalPresentation(adminUiStyles, sharedTabs.replace("tab.standalone ?? false", "tab.standalone ?? true")) && !hasCharcoalPresentation(adminUiStyles, sharedTabs.replace("standalone?: boolean", "standalone: boolean")) && !hasCharcoalPresentation(adminUiStyles, sharedTabs.replace('? `relative ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME}', '? `relative mb-3 ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME}')) && !hasCharcoalPresentation(adminUiStyles.replace('"flex min-w-0 flex-wrap items-center justify-between gap-3"', '"flex min-w-0 flex-nowrap items-center justify-between gap-3"'), sharedTabs));
check("Panel fields and body guidance explicitly reuse canonical label, stack and hint presentation while omitted variants remain untouched", hasPanelTypography(basicPanel, markdownEditor));
check("Panel typography rejects unconditional labels, lost forwarding, parallel helpers and unconditional body guidance", !hasPanelTypography(basicPanel.replace('panel ? adminFormLabelClassName({ textInset: true }) : undefined', 'adminFormLabelClassName({ textInset: true })'), markdownEditor) && !hasPanelTypography(basicPanel.replace('labelClassName={labelClassName}', ''), markdownEditor) && !hasPanelTypography(basicPanel.replace('/lib/admin/admin-ui-styles"', '/lib/admin/parallel-ui-styles"'), markdownEditor) && !hasPanelTypography(basicPanel, markdownEditor.replace('helperTextClassName={panel ? adminFormHintClassName({ textInset: true }) : undefined}', 'helperTextClassName={adminFormHintClassName({ textInset: true })}')) && !hasPanelTypography(basicPanel, markdownEditor.replace('className={panel ? ADMIN_FORM.labelStack : undefined}', 'className={ADMIN_FORM.labelStack}')));
const labelPortOwners = [
  { source: characterField, component: "TopicCharacterField", wrapper: "label", fallback: "block space-y-1.5", paired: true },
  { source: slugInput, component: "TopicSlugInput", wrapper: "div", fallback: "space-y-1.5", paired: false },
  { source: typeControl, component: "TopicContentTypeControl", wrapper: "label", fallback: "inline-grid min-w-0 max-w-full shrink-0 space-y-1.5", paired: false },
  { source: seriesFields, component: "TopicSeriesFields", wrapper: "div", fallback: "inline-grid min-w-0 max-w-full shrink-0 space-y-1.5", paired: false },
  { source: imageField, component: "TopicImageField", wrapper: "label", fallback: "block", paired: true },
];
check("Four local label owners retain exact defaults while Article image labels delegate through the existing optional shared port", preservesLabelPortDefaults(labelPortOwners));
check("Label ports reject a required override, a changed omitted wrapper or unconditional text restyling", !preservesLabelPortDefaults(labelPortOwners.map((owner, index) => index === 0 ? { ...owner, source: owner.source.replace('labelClassName?: string', 'labelClassName: string') } : owner)) && !preservesLabelPortDefaults(labelPortOwners.map((owner, index) => index === 1 ? { ...owner, source: owner.source.replace('labelClassName ?? "space-y-1.5"', 'labelClassName ?? "space-y-4"') } : owner)) && !preservesLabelPortDefaults(labelPortOwners.map((owner, index) => index === 2 ? { ...owner, source: owner.source.replace('labelClassName === undefined ? "text-xs font-medium text-white/58" : undefined', '"text-xs font-medium text-white/58"') } : owner)));
const unaffectedLabelSurfaces = [markdownEditor, sharedRichText, sharedTabs, mediaSlotGuidance, mediaReferencePresentation];
check("Shared Media retains its separately approved optional title-only marker without spreading inset ownership to controls or helper text", hasOptionalMediaTitleMarker(mediaImageField));
check("Media title marker rejects unconditional markup, changed defaults and helper/control marker leakage", !hasOptionalMediaTitleMarker(mediaImageField.replace('{labelClassName ? <span data-admin-form-label-text>{label}</span> : label}', '<span data-admin-form-label-text>{label}</span>')) && !hasOptionalMediaTitleMarker(mediaImageField.replace('labelClassName?: string', 'labelClassName: string')) && !hasOptionalMediaTitleMarker(`${mediaImageField}\nconst leaked = <span data-admin-form-label-text />;`));
check("Optional URL labels cannot weaken the two legacy Media title markers or escape the card opt-in", !hasOptionalMediaTitleMarker(mediaImageField.replace('cardPresentation ? urlInput : undefined', 'urlInput')) && !hasOptionalMediaTitleMarker(mediaImageField.replace('htmlFor={urlInputOptions.id}', 'htmlFor="detached-url"')) && !hasOptionalMediaTitleMarker(mediaImageField.replace('{urlInputOptions ? (', '{true ? (')));
check("Shared label inset is optional and false by default, preserving the exact omitted stack while opting into 12px logical text-only padding", hasSharedLabelTextInset(adminUiStyles));
check("Label inset rejects changed defaults, a required option, global wrapper padding and selectors reaching descendants or controls", !hasSharedLabelTextInset(adminUiStyles.replace('textInset = false', 'textInset = true')) && !hasSharedLabelTextInset(adminUiStyles.replace('textInset?: boolean', 'textInset: boolean')) && !hasSharedLabelTextInset(adminUiStyles.replace(' = {}) {', ') {')) && !hasSharedLabelTextInset(adminUiStyles.replace('text-right text-xs font-medium text-white/48', 'ps-3 text-right text-xs font-medium text-white/48')) && !hasSharedLabelTextInset(adminUiStyles.replaceAll('[&>[data-admin-form-label-text]]', '[&_[data-admin-form-label-text]]')) && !hasSharedLabelTextInset(adminUiStyles.replaceAll('[&>[data-admin-form-label-text]]', '[&>*]')));
check("All six adapter title rows covering seven panel fields are marked direct children, keeping required markers and counters inside the padded text row", hasScopedLabelTextRows(labelPortOwners, basicPanel, unaffectedLabelSurfaces));
check("Label rows reject any missing marker, nested marker or marker moved onto a control", labelPortOwners.every((owner, index) => !hasScopedLabelTextRows(labelPortOwners.map((entry, at) => at === index ? { ...entry, source: entry.source.replace(owner.component === 'TopicImageField' ? 'metadataLabelClassName={labelClassName}' : ' data-admin-form-label-text', '') } : entry), basicPanel, unaffectedLabelSurfaces)) && !hasScopedLabelTextRows(labelPortOwners, basicPanel.replace(' data-admin-form-label-text', ''), unaffectedLabelSurfaces) && !hasScopedLabelTextRows(labelPortOwners.map((entry, index) => index === 0 ? { ...entry, source: entry.source.replace(' data-admin-form-label-text', '').replace('<span>\n          {label}', '<span data-admin-form-label-text>\n          {label}') } : entry), basicPanel, unaffectedLabelSurfaces) && !hasScopedLabelTextRows(labelPortOwners.map((entry, index) => index === 1 ? { ...entry, source: entry.source.replace(' data-admin-form-label-text', '').replace('<input\n', '<input data-admin-form-label-text\n') } : entry), basicPanel, unaffectedLabelSurfaces));
check("Label rows reject detached counters or required markers and retain the panel-only explicit opt-in", !hasScopedLabelTextRows(labelPortOwners.map((entry, index) => index === 0 ? { ...entry, source: entry.source.replace('{counter}', '').replace('{control}', '{counter}{control}') } : entry), basicPanel, unaffectedLabelSurfaces) && !hasScopedLabelTextRows(labelPortOwners.map((entry, index) => index === 4 ? { ...entry, source: entry.source.replace('showAltCounter', '') } : entry), basicPanel, unaffectedLabelSurfaces) && !hasScopedLabelTextRows(labelPortOwners, basicPanel.replace('<span className="text-red-400">*</span>', ''), unaffectedLabelSurfaces) && !hasPanelTypography(basicPanel.replace('adminFormLabelClassName({ textInset: true })', 'adminFormLabelClassName()'), markdownEditor));
check("Label inset markers and Label-owner adoption stay out of helper text, section headers and rich-text surfaces outside the independently verified Media title opt-in", unaffectedLabelSurfaces.every((source, index) => !hasScopedLabelTextRows(labelPortOwners, basicPanel, unaffectedLabelSurfaces.map((entry, at) => at === index ? `${source}\nconst leaked = <p data-admin-form-label-text />;` : entry))) && !hasScopedLabelTextRows(labelPortOwners, basicPanel, [...unaffectedLabelSurfaces, 'adminFormLabelClassName({ textInset: true })']));
check("Rich Text and both media guidance presentations preserve omitted defaults through optional shared-owner ports", preservesHelperPortDefaults(sharedRichText, imageField, mediaImageField, mediaSlotGuidance));
check("Helper ports reject a changed Rich Text default, a lost media presentation forwarding or a changed omitted guidance class", !preservesHelperPortDefaults(sharedRichText.replace('className = "space-y-2"', 'className = "space-y-4"'), imageField, mediaImageField, mediaSlotGuidance) && !preservesHelperPortDefaults(sharedRichText, imageField, mediaImageField.replace('className={guidanceClassName}', ''), mediaSlotGuidance) && !preservesHelperPortDefaults(sharedRichText, imageField, mediaImageField, mediaSlotGuidance.replace('text-xs leading-6 text-amber-600 dark:text-[#D8B87A]/75', 'text-sm text-white')));
check("Shared helper inset remains optional and false by default, adding only the canonical 12px logical-start token", hasSharedHelperTextInset(adminUiStyles));
check("Helper inset rejects default adoption, required options, changed hint typography or a wider inset", !hasSharedHelperTextInset(adminUiStyles.replaceAll('textInset = false', 'textInset = true')) && !hasSharedHelperTextInset(adminUiStyles.replaceAll('textInset?: boolean', 'textInset: boolean')) && !hasSharedHelperTextInset(adminUiStyles.replace('text-[11px] leading-5 text-white/32', 'text-xs leading-6 text-white/45')) && !hasSharedHelperTextInset(adminUiStyles.replace('helperTextInset: "min-w-0 ps-3"', 'helperTextInset: "min-w-0 ps-6"')));
check("Three helper insets remain explicit panel-only choices and reject lost, unconditional or local alignment", !hasPanelTypography(basicPanel.replace('guidanceClassName={panel ? adminFormHintClassName({ textInset: true }) : undefined}', 'guidanceClassName={adminFormHintClassName({ textInset: true })}'), markdownEditor) && !hasPanelTypography(basicPanel.replace('originalDimensionsClassName={panel ? ADMIN_FORM.helperTextInset : undefined}', 'originalDimensionsClassName={ADMIN_FORM.helperTextInset}'), markdownEditor) && !hasPanelTypography(basicPanel.replace('originalDimensionsClassName={panel ? ADMIN_FORM.helperTextInset : undefined}', 'originalDimensionsClassName={panel ? "ps-3" : undefined}'), markdownEditor) && !hasPanelTypography(basicPanel, markdownEditor.replace('adminFormHintClassName({ textInset: true })', 'adminFormHintClassName()')));
check("Original dimensions keep existing typography, catalog lookup and bdi while both image presentations forward an optional class port", hasOriginalDimensionsPresentation(imageField, mediaImageField, mediaReferencePresentation));
check("Dimensions presentation rejects required ports, lost forwarding, replaced typography, broken numeric isolation or changed unavailable data", !hasOriginalDimensionsPresentation(imageField.replace('originalDimensionsClassName?: string', 'originalDimensionsClassName: string'), mediaImageField, mediaReferencePresentation) && !hasOriginalDimensionsPresentation(imageField, mediaImageField.replace('className={originalDimensionsClassName}', ''), mediaReferencePresentation) && !hasOriginalDimensionsPresentation(imageField, mediaImageField, mediaReferencePresentation.replace('text-xs leading-6 text-slate-500${className', 'text-sm text-white${className')) && !hasOriginalDimensionsPresentation(imageField, mediaImageField, mediaReferencePresentation.replace('<bdi>{original.width}', '<span>{original.width}')) && !hasOriginalDimensionsPresentation(imageField, mediaImageField, mediaReferencePresentation.replace(': state ? "غير متاحة"', ': state ? "0 × 0 px"')));
check("Label presentation retains required markers, native label associations, character counters and current input projections", presentationElements(basicPanel, "TopicCharacterField").some((node) => presentationAttribute(node, "name") === "title" && presentationAttribute(node, "required") === true) && presentationElements(characterField, "label").some((node) => presentationAttribute(node, "htmlFor") === "id") && characterField.includes('{required ? <span className="text-red-400">*</span> : null}') && presentationElements(characterField, "TopicFieldCounter").some((node) => presentationAttribute(node, "count") === "currentCount") && hasCanonicalArticleImageMetadata(imageField) && mediaImageField.includes('{fieldValue.length}') && typeControl.includes('requestInternalNavigation(adminContentNewTopicPath(next))'));
check("Only the Edit Basic description and visible shell footer description are suppressed while Create and global footer defaults remain", hasScopedDescriptionRemoval(editEditor, createEditor, shell, sharedRuntime));
check("Description suppression rejects restored Edit copy, lost footer opt-out and changed global defaults", !hasScopedDescriptionRemoval(editEditor.replace('<ContentBasicDataPanel', '<ContentBasicDataPanel description="حدّث المحتوى الأساسي والتصنيف والصورة وإعدادات الظهور."'), createEditor, shell, sharedRuntime) && !hasScopedDescriptionRemoval(editEditor, createEditor, shell.replace('description={null}', 'description={undefined}'), sharedRuntime) && !hasScopedDescriptionRemoval(editEditor, createEditor, shell, sharedRuntime.replace('description = "احفظ التغييرات أو أغلق النموذج."', 'description = null')));
const markdownStats = presentationElements(markdownEditor, "MiniCounter");
check("All six Markdown statistics remain projected from the current editor content model", markdownStats.length === 6 && ["stats.words", "stats.paragraphs", "stats.h2", "stats.h3", "`${stats.readingMinutes} د`", "stats.internalLinks"].every((value) => markdownStats.some((node) => presentationAttribute(node, "value") === value)) && markdownEditor.includes("useMemo(() => getTextStats(content), [content])"));
check("Panel Markdown suppresses only its duplicate caption and adopts the shared 300px scrollbar viewport with toolbar outside scrolling", hasPanelRichTextViewport(markdownEditor, sharedRichText));
check("Panel viewport rejects a visible duplicate caption, changed height, lost binding, clipping, parallel scrollbar and nested toolbar", !hasPanelRichTextViewport(markdownEditor.replace('showLabel={!panel}', 'showLabel={true}'), sharedRichText) && !hasPanelRichTextViewport(markdownEditor.replace('minHeight={panel ? 300 : compact ? 440 : 620}', 'minHeight={300}'), sharedRichText) && !hasPanelRichTextViewport(markdownEditor.replace('maxHeight={panel ? 300 : undefined}', 'maxHeight={undefined}'), sharedRichText) && !hasPanelRichTextViewport(markdownEditor.replace('onValueChange={handleValueChange}', 'onValueChange={undefined}'), sharedRichText) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('maxHeight === undefined ? undefined : "auto"', 'maxHeight === undefined ? undefined : "clip"')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('from "./ui/admin-scrollbar-styles"', 'from "./ui/parallel-scrollbar-styles"')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('<EditorContent editor={editor} dir="rtl" />', '{showToolbar ? toolbar : null}<EditorContent editor={editor} dir="rtl" />')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replaceAll('"aria-label": label', '"aria-label": ""')));
check("Right scrollbar is a panel-only opt-in and rejects changed defaults, unconditional placement or a lost opt-in", !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('scrollbarSide = "auto"', 'scrollbarSide = "right"')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('dir={scrollbarSide === "right" ? "ltr" : undefined}', 'dir="ltr"')) && !hasPanelRichTextViewport(markdownEditor.replace('scrollbarSide={panel ? "right" : undefined}', 'scrollbarSide="right"'), sharedRichText) && !hasPanelRichTextViewport(markdownEditor.replace('scrollbarSide={panel ? "right" : undefined}', ''), sharedRichText));
check("Right scrollbar keeps the writing subtree and both editor-props paths RTL and rejects text reversal or scroll interception", !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('<EditorContent editor={editor} dir="rtl" />', '<EditorContent editor={editor} dir="ltr" />')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('<EditorContent editor={editor} dir="rtl" />', '<EditorContent editor={editor} />')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('dir: "rtl"', 'dir: "ltr"')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replaceAll('dir: "rtl"', 'dir: "ltr"')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('dir={scrollbarSide === "right" ? "ltr" : undefined}', 'dir={scrollbarSide === "right" ? "ltr" : undefined} contentEditable')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('dir={scrollbarSide === "right" ? "ltr" : undefined}', 'dir={scrollbarSide === "right" ? "ltr" : undefined} onWheel={() => {}}')) && !hasPanelRichTextViewport(markdownEditor, sharedRichText.replace('outline: none;', 'outline: none; transform: scaleX(-1);')));

check("navigation maps shared and typed validation failures", ['category_id: { tabId: "basic", targetId: "content-category-listbox" }', 'series_id: { tabId: "basic", targetId: "content-series-listbox" }', 'status: { tabId: "publish", targetId: "content-status" }'].every((marker) => formDefinition.includes(marker)));
check("publishing uses one status contract plus shared publishing options", publishingOptions.includes('name="status"') && publishingOptions.includes('name="is_featured"') && publishingOptions.includes('name="is_popular"') && publishingOptions.includes("TopicDateLabelField") && !publishingOptions.includes('name="is_published"'));
check("article payload reads category_id while the shared publishing owner submits status", helpers.includes('getString(formData, "category_id")') && publishingOptions.includes('name="status"'));
check("article validation loads category_id and excludes soft-deleted rows", validation.includes("category_id") && validation.includes('.is("deleted_at", null)'));

for (const field of ["show_title_on_page", "show_image_on_page", "show_excerpt_on_page", "show_faq_on_page", "show_faq_title_on_page"]) {
  check(`${field} remains additive and persisted`, migration.includes(`${field} boolean not null default true`) && helpers.includes(`getBoolean(formData, "${field}")`) && validation.includes(field));
}

check("public topic adapter receives legacy-safe display settings", publicLoader.includes("showTitleOnPage: item.display.title") && publicLoader.includes("showImageOnPage: item.display.image") && publicLoader.includes("showExcerptOnPage: item.display.excerpt"));
check("public article output retains image-alt and display controls", publicPage.includes("alt={topic.imageAlt}") && publicPage.includes("topic.showTitleOnPage") && publicPage.includes("topic.showImageOnPage") && publicPage.includes("topic.showExcerptOnPage") && publicPage.includes("topic.showFaqTitleOnPage"));
check("shared public layout can hide hero elements", publicLayout.includes("showHeroImage") && publicLayout.includes("showSubtitle") && publicLayout.includes("showTitle"));
check(
  "public path resolver maps article and media routes through the canonical registry",
  publicPath.includes('article: { listing: "topics", detail: "topic-detail" }') &&
    publicPath.includes('listing: "media-site-updates"') &&
    publicPath.includes('listing: "media-gallery"') &&
    publicPath.includes("getPublicPageRoute(") &&
    publicPath.includes("getPublicDynamicPageRoute("),
);

for (const retired of [
  "src/components/admin/content/editors/article/TopicBasicDataPanel.tsx",
  "src/components/admin/content/editors/article/ArticleTopicCategorySelect.tsx",
  "src/components/admin/content/editors/article/TopicEditTabs.tsx",
  "src/components/admin/content/editors/article/TopicPublishingOptions.tsx",
]) {
  check(`retired parallel owner is absent: ${retired}`, !existsSync(resolve(root, retired)));
}

console.log(`verify:topic-editor-basic-data passed (${passed} assertions)`);
