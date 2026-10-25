import { normalizeVerificationText } from "./lib/verification-text.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import ts from "typescript";
import { Children, Fragment, createElement, isValidElement, useCallback, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getModuleEditorHeaderMetadata, getModuleEditorSectionMetadata, resolveModuleEditorCompositionApplicability, SLOT_MODULE_SLUG_METADATA, MODULE_KIND_METADATA, MODULE_EDITOR_TAB_LABELS } from "../src/lib/page-composition/module-registry-metadata.ts";
import { collectExecutableSourceGraph, graphUsesExecutableBinding } from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) =>
  normalizeVerificationText(readFileSync(resolve(ROOT, path), "utf8"));
const jiti = createJiti(import.meta.url, { fsCache: false, jsx: { runtime: "automatic" } });
let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}
if (process.argv.includes("--page-visual-map")) {
  await verifyPageVisualMap();
  console.log(`Page Visual Map verification passed (${passed} affected checks; actual component SSR and callback ports only).`);
  process.exit(0);
}
if (process.argv.includes("--page-composition")) {
  verifyPageCompositionPresentation();
  console.log(`Page Composition Presentation verification passed (${passed} affected checks; no module-family, browser or native journey rerun).`);
  process.exit(0);
}
if (process.argv.includes("--block-family-presentation")) {
  await verifyBlockFamilyPresentation();
  console.log(`Block Family Presentation verification passed (${passed} affected source/SSR checks; no browser, save or DB proof).`);
  process.exit(0);
}
if (process.argv.includes("--block-review-nested-presentation")) {
  await verifyBlockReviewNestedPresentation();
  console.log(`Block Review nested presentation passed (${passed} affected source/SSR checks; Live and Owner review remain separate).`);
  process.exit(0);
}
if (process.argv.includes("--owner-review-final")) {
  await verifyOwnerReviewContentDescendants();
  await verifyOwnerReviewFinalAdoption();
  console.log(`Final Owner Review protection passed (${passed} affected source/contract checks; browser and Owner approval remain Pending).`);
  process.exit(0);
}
if (process.argv.includes("--owner-review-grid-footer")) {
  if (process.argv.includes("--footer-fields-only")) verifyOwnerReviewFooterFields();
  else await verifyOwnerReviewGridAndFooter();
  console.log(`Final Grid/Footer protection passed (${passed} affected checks; other successful checks were not rerun).`);
  process.exit(0);
}
if (process.argv.includes("--compact-inline-defaults")) {
  check("Unified Compact Inline defaults preserve actual native payload and supported controls with structural negatives", await verifyCompactInlineDefaults());
  console.log(`Unified Compact Inline verification passed (${passed} affected source/SSR check; no unrelated presentation rerun).`);
  process.exit(0);
}
if (process.argv.includes("--section-header-defaults")) {
  check("Unified Section Header defaults preserve structural geometry, canonical identity and native summaries; negative probes reject regression", await verifyUnifiedSectionHeaderDefaults());
  console.log(`Unified Section Header verification passed (${passed} affected source/SSR check; no unrelated presentation rerun).`);
  process.exit(0);
}
if (process.argv.includes("--panel-composition")) {
  await verifyBlockPanelComposition();
  console.log(`Block Panel composition passed (${passed} affected source/SSR checks; Live and Owner review remain separate).`);
  process.exit(0);
}
if (process.argv.includes("--featured-switch-composition")) {
  await verifyFeaturedSwitchComposition();
  console.log(`Featured Switch composition passed (${passed} affected source/SSR checks; computed geometry and Owner review remain separate).`);
  process.exit(0);
}
await verifyFeaturedSwitchComposition();
await verifyBlockPanelComposition();
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

function pageCompositionAst(source: string) {
  const tree=ts.createSourceFile("page-composition.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes:ts.JsxOpeningLikeElement[]=[];
  const visit=(node:ts.Node)=>{if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))nodes.push(node);ts.forEachChild(node,visit);};visit(tree);
  const attr=(node:ts.JsxOpeningLikeElement,name:string)=>node.attributes.properties.find((entry):entry is ts.JsxAttribute=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)===name)?.initializer?.getText(tree);
  const owned=(name:string)=>nodes.filter(node=>node.tagName.getText(tree)===name);
  const children=(node:ts.JsxElement)=>node.children.filter((child):child is ts.JsxElement|ts.JsxSelfClosingElement=>ts.isJsxElement(child)||ts.isJsxSelfClosingElement(child));
  const canonical=(name:string,suffix:string)=>tree.statements.some(node=>ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)&&node.moduleSpecifier.text.endsWith(suffix)&&(node.importClause?.name?.text===name||(node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings)&&node.importClause.namedBindings.elements.some(binding=>binding.name.text===name&&!binding.propertyName))));
  const inside=(node:ts.Node,parent:ts.Node)=>{for(let current:ts.Node|undefined=node;current;current=current.parent)if(current===parent)return true;return false;};
  const inset=(name:string)=>{const calls:ts.CallExpression[]=[];const collect=(node:ts.Node)=>{if(ts.isCallExpression(node)&&node.expression.getText(tree)===name)calls.push(node);ts.forEachChild(node,collect);};collect(tree);return calls.length>0&&calls.every(call=>call.arguments[0]?.getText(tree).replace(/\s+/gu,"")==="{textInset:true}");};
  const marked=(node:ts.JsxOpeningLikeElement)=>node.attributes.properties.some(entry=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)==="data-admin-form-label-text");
  const nestedLabels=()=>{const labels=nodes.filter(node=>attr(node,"className")?.includes("adminFormLabelClassName("));return labels.length>0&&labels.every(node=>!marked(node)&&ts.isJsxElement(node.parent)&&children(node.parent).some(child=>marked(ts.isJsxElement(child)?child.openingElement:child)));};
  return{tree,nodes,attr,owned,children,canonical,inside,inset,nestedLabels,normal:source.replace(/\s+/gu,"")};
}

function assertCanonicalControlHeaderOwnership(tabs: string, form: string) {
  const ast = pageCompositionAst(tabs), publicAst = pageCompositionAst(form);
  const functions = (tree: ts.SourceFile, name: string) => tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const owners = functions(ast.tree, "AdminFormControlHeader");
  assert.equal(owners.length, 1, "Tabs owns exactly one local ControlHeader implementation");
  const owner = owners[0]!;
  assert.ok(ts.getModifiers(owner)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword), "The canonical local ControlHeader remains public");
  const reexports = publicAst.tree.statements.filter((node): node is ts.ExportDeclaration => ts.isExportDeclaration(node) && !!node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.some(element => element.name.text === "AdminFormControlHeader"));
  assert.equal(reexports.length, 1, "AdminForm preserves one public compatibility export");
  const reexport = reexports[0]!;
  assert.ok(!reexport.isTypeOnly && reexport.moduleSpecifier && ts.isStringLiteral(reexport.moduleSpecifier) && reexport.moduleSpecifier.text === "./AdminModuleTabs");
  assert.ok(reexport.exportClause && ts.isNamedExports(reexport.exportClause));
  const alias = reexport.exportClause.elements.find(element => element.name.text === "AdminFormControlHeader")!;
  assert.ok(!alias.isTypeOnly && (!alias.propertyName || alias.propertyName.text === "AdminFormControlHeader"), "The public name resolves to the same implementation");
  assert.equal(functions(publicAst.tree, "AdminFormControlHeader").length, 0, "AdminForm does not copy the canonical implementation");
  const isNamedBinding = (node: ts.Node) => (ts.isImportSpecifier(node) || ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isImportClause(node) || ts.isNamespaceImport(node)) && node.name?.getText() === "AdminFormControlHeader";
  for (const [tree, allowed] of [[ast.tree, owner], [publicAst.tree, undefined]] as const) {
    const visit = (node: ts.Node) => {
      if (isNamedBinding(node)) {
        const canonicalFormImport = tree === publicAst.tree && ts.isImportSpecifier(node) && !node.propertyName && ts.isImportDeclaration(node.parent.parent.parent) && ts.isStringLiteral(node.parent.parent.parent.moduleSpecifier) && node.parent.parent.parent.moduleSpecifier.text === "./AdminModuleTabs";
        assert.ok(node === allowed || canonicalFormImport, "Local/imported/destructured bindings cannot replace the canonical ControlHeader");
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  const sections = functions(ast.tree, "AdminModuleSectionHeader");
  assert.equal(sections.length, 1);
  const section = sections[0]!;
  const returns = section.body?.statements.filter(ts.isReturnStatement) ?? [];
  assert.equal(returns.length, 1);
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const returned = returns[0]!.expression && unwrap(returns[0]!.expression);
  assert.ok(returned && ts.isConditionalExpression(returned) && returned.condition.getText(ast.tree) === "tab.sectionHeading");
  const header = unwrap(returned.whenTrue);
  assert.ok(ts.isJsxElement(header) && header.openingElement.tagName.getText(ast.tree) === "header");
  const identities = ast.owned("AdminFormControlHeader").filter(node => ast.inside(node, section));
  assert.equal(identities.length, 1, "The returned Section mounts one shared identity");
  const identity = identities[0]!;
  for (let parent = identity.parent; parent !== header; parent = parent.parent) assert.ok(ts.isJsxElement(parent), "The canonical identity is mounted directly in the returned Header, never hidden in an inactive expression");
  assert.equal(ast.attr(identity, "presentation"), '"leading-icon"');
  assert.equal(ast.attr(identity, "title"), '{<span role="heading" aria-level={2}>{tab.sectionHeading}</span>}');
  assert.equal(ast.attr(identity, "description"), "{tab.sectionDescription}");
  assert.equal(ast.attr(identity, "icon"), '{<AdminModuleTabIcon name={tab.icon ?? "section"} />}');
  assert.ok(!identity.attributes.properties.some(ts.isJsxSpreadAttribute), "A spread cannot override canonical identity payloads");
  assert.equal(identity.attributes.properties.length, 4, "Identity attributes are unique and retain native title, description and icon bindings");
  return true;
}

function premiumAcceptanceOutput(args: readonly string[]) {
  const option = "--content-premium-output-dir", selected = args.filter(arg => arg.startsWith(option));
  if (selected.length === 0) return ".tmp-qa/page-block-editor-presentation/current";
  assert.equal(selected.length, 1, "The fresh acceptance output selector must be unambiguous");
  const rootState = lstatSync(ROOT);
  assert.ok(rootState.isDirectory() && !rootState.isSymbolicLink() && realpathSync(ROOT) === resolve(ROOT), "Fresh acceptance output requires a canonical repository root without linked ancestors");
  const requested = selected[0]!.slice(option.length + 1);
  assert.ok(selected[0]!.startsWith(`${option}=`) && /^\.tmp-qa\/[A-Za-z0-9._/-]+$/u.test(requested), "Fresh acceptance output is a literal repository .tmp-qa descendant");
  const parts = requested.split("/");
  assert.ok(parts.every(part => part && part !== "." && part !== ".."), "Fresh acceptance output cannot contain empty or traversal segments");
  let ancestor = ROOT;
  for (const part of parts.slice(0, -1)) {
    ancestor = join(ancestor, part);
    try {
      const state = lstatSync(ancestor);
      assert.ok(state.isDirectory() && !state.isSymbolicLink(), "Fresh acceptance output cannot traverse a symlink or junction");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const output = resolve(ROOT, requested);
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output); // Exclusive creation preserves every earlier receipt and rejects a linked target.
  return requested;
}

function hasHeroCtaDescendants(source: string) {
  const ast = pageCompositionAst(source);
  return ast.canonical("ModuleEditorSection", "/ModuleEditorPresentation") && ["primary_cta", "secondary_cta"].every(prefix => ast.owned("ModuleEditorSection").some(section =>
    Boolean(ast.attr(section, "title")) && ast.owned("AdminLinkField").some(link => ast.attr(link, "prefix") === `"${prefix}"` && ast.inside(link, section.parent)) &&
    ast.owned("AdminFormField").some(field => Boolean(ast.attr(field, "label")) && ast.inside(field, section.parent) &&
      ast.owned("input").some(input => ast.attr(input, "name") === `"${prefix}_label"` && ast.inside(input, field.parent)))));
}

function assertHeroCtaSectionComposition(source: string) {
  assert.ok(hasHeroCtaDescendants(source), "Both real Hero CTA groups retain canonical Sections, visible Fields and contained native link/input owners");
  const ast = pageCompositionAst(source), sections = ast.owned("ModuleEditorSection");
  assert.equal(sections.length, 2);
  assert.deepEqual(sections.map(section => ast.attr(section, "title")), ['"الزر الأساسي"', '"الزر الثانوي"']);
  for (const [index, prefix] of ["primary", "secondary"].entries()) {
    const section = sections[index]!, fields = ast.owned("AdminFormField").filter(field => ast.inside(field, section.parent));
    assert.equal(ast.attr(section, "className"), '"h-full"');
    assert.equal(fields.length, 1);
    assert.equal(ast.attr(fields[0]!, "label"), index === 0 ? '"نص الزر الأساسي"' : '"نص الزر الثانوي"');
    assert.ok(ast.owned("input").some(input => ast.attr(input, "name") === `"${prefix}_cta_label"` && ast.inside(input, fields[0]!.parent)));
    assert.ok(ts.isJsxElement(section.parent.parent));
    assert.equal(ast.attr(section.parent.parent.openingElement, "data-hero-cta-row"), JSON.stringify(prefix));
  }
  return true;
}

function assertDefaultHeroElementOrder(source: string) {
  const ast = pageCompositionAst(source);
  const owner = ast.tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "HeroElementOrderEditor");
  assert.ok(owner?.body);
  const returned = owner.body.statements.filter(ts.isReturnStatement);
  assert.equal(returned.length, 1);
  const root = returned[0]!.expression;
  assert.ok(root && ts.isParenthesizedExpression(root) && ts.isJsxElement(root.expression));
  const cards = ast.owned("ModuleEditorRepeaterCard").filter(node => ast.inside(node, root));
  assert.equal(cards.length, 1);
  assert.equal(ast.attr(cards[0]!, "title"), "{HERO_ELEMENT_LABELS_AR[key]}");
  const list = ast.owned("ul").filter(node => ast.inside(node, root));
  assert.equal(list.length, 1); assert.equal(ast.attr(list[0]!, "className"), '"space-y-3"');
  assert.ok(ast.inside(cards[0]!, list[0]!.parent));
  assert.equal(ast.owned("ModuleEditorRepeaterGrid").filter(node => ast.inside(node, root)).length, 0, "The ordinary Hero element list retains its current one-column native order; Project actions own the repeater Grid");
  const maps: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => { if (ts.isCallExpression(node) && node.expression.getText(ast.tree) === "order.map") maps.push(node); ts.forEachChild(node, visit); };
  visit(root); assert.equal(maps.length, 1); assert.ok(ast.inside(cards[0]!, maps[0]!));
  const inputs = ast.owned("input").filter(node => ast.inside(node, root));
  assert.equal(inputs.length, 1); assert.equal(ast.attr(inputs[0]!, "name"), '"hero_element_order"'); assert.equal(ast.attr(inputs[0]!, "value"), "{JSON.stringify(order)}");
  const buttons = ast.owned("AdminActionButton").filter(node => ast.inside(node, cards[0]!.parent));
  assert.equal(buttons.length, 2);
  for (const [index, button] of buttons.entries()) {
    assert.equal(ast.attr(button, "onClick"), index === 0 ? "{() => move(index, -1)}" : "{() => move(index, 1)}");
    assert.equal(ast.attr(button, "disabled"), index === 0 ? "{index === 0}" : "{index === order.length - 1}");
  }
  return true;
}

function alignedBreadcrumb(source: string) {
  const ast = pageCompositionAst(source), grid = ast.owned("AdminFormGrid").find(node => ast.attr(node, "columns") === "{3}" && ast.attr(node, "presentation") === '"aligned-fields"');
  if (!grid) return false;
  const children = ast.children(grid.parent as ts.JsxElement);
  return children.map(node => (ts.isJsxElement(node) ? node.openingElement : node).tagName.getText(ast.tree)).join(",") === "AdminFormListboxSelect,AdminFormField,AdminFormSwitch" &&
    ast.owned("AdminFormSwitch").some(node => ast.attr(node, "name") === '"show_home"' && ast.inside(node, grid.parent) && !ast.attr(node, "label")?.includes("AdminFormControlHeader"));
}

function hasProjectHeroFields(source: string) {
  const ast = pageCompositionAst(source), fields = ast.owned("ModuleEditorField");
  const group = ast.owned("ModuleEditorFieldGrid")[0];
  return Boolean(group) && fields.filter(node => ast.attr(node, "span") === "{4}" && ast.inside(node, group!.parent)).length === 3 &&
    ["limit", "autoplay_ms"].every(name => {
      const input = ast.owned("input").find(node => ast.attr(node, "name") === `"${name}"`);
      return Boolean(input && ast.attr(input, "className") === "{adminFormFieldClassName()}" && ast.owned("AdminFormField").some(node => ast.inside(input, node.parent)));
    }) && ast.owned("AdminFormListboxSelect").some(node => ast.attr(node, "name") === '"project_type"' && ast.attr(node, "sizing") === '"full"') &&
    ast.owned("textarea").some(node => ast.attr(node, "name") === '"empty_state"' && ast.inside(node, group!.parent)) && !source.includes("col-span-2!");
}

function hasCardsRepeaterHeading(source: string) {
  const ast = pageCompositionAst(source), headers = ast.owned("AdminFormControlHeader");
  return ast.canonical("AdminFormControlHeader", "/AdminForm") && headers.length === 1 &&
    ast.attr(headers[0]!, "title") === '{<span role="heading" aria-level={3}>{label}</span>}' &&
    ast.attr(headers[0]!, "presentation") === '"leading-icon"' &&
    ast.attr(headers[0]!, "icon") === '{<AdminModuleTabIcon name="section" />}';
}

function hasControlHeaderTitleScale(source: string) {
  const ast = pageCompositionAst(source), owner = ast.tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormControlHeader");
  return !!owner && ast.owned("span").some(node => ast.inside(node, owner) && ts.isJsxElement(node.parent) && node.parent.children.some(child => ts.isJsxExpression(child) && child.expression?.getText(ast.tree) === "title") &&
    ast.attr(node, "className") === '{`${compact ? "break-words " : ""}text-sm font-semibold text-white`}');
}

function hasMediaPreviewEligibility(source: string) {
  const ast = pageCompositionAst(source), modals = ast.owned("VenesiaModal");
  return modals.length === 1 && ast.attr(modals[0]!, "open") === '{previewOpen && presentation === "active" && canPreviewValue}' &&
    ast.attr(modals[0]!, "onClose") === "{() => setPreviewOpen(false)}";
}

function hasPrinciplesRepeaterDefault(source: string, ownerSource: string) {
  const ast = pageCompositionAst(source), cards = ast.owned("ModuleEditorRepeaterCard");
  if (!ast.canonical("ModuleEditorRepeaterCard", "/ModuleEditorPresentation") || cards.length !== 1 || ast.attr(cards[0]!, "presentation") !== undefined || ast.attr(cards[0]!, "icon") !== '{isHomeTrust ? <AdminModuleTabIcon name="section" /> : undefined}') return false;
  const owner = pageCompositionAst(ownerSource), declaration = owner.tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ModuleEditorRepeaterCard");
  if (!declaration?.body || !owner.canonical("AdminCard", "/ui") || !owner.canonical("AdminFormControlHeader", "/ui")) return false;
  const returned = declaration.body.statements.filter(ts.isReturnStatement);
  const expression = returned.length === 1 ? returned[0]!.expression : undefined;
  if (!expression || !ts.isParenthesizedExpression(expression) || !ts.isJsxElement(expression.expression)) return false;
  const root = expression.expression;
  if (root.openingElement.tagName.getText(owner.tree) !== "AdminCard" || owner.attr(root.openingElement, "presentation") !== '"premium"') return false;
  const identities = owner.owned("AdminFormControlHeader").filter(node => owner.inside(node, root));
  if (identities.length !== 1 || owner.attr(identities[0]!, "title") !== '{<span role="heading" aria-level={3}>{title}</span>}' || owner.attr(identities[0]!, "description") !== "{description}" || owner.attr(identities[0]!, "icon") !== "{icon}") return false;
  return owner.owned("div").some(node => owner.inside(node, root) && ts.isJsxElement(node.parent) && node.parent.children.some(child => ts.isJsxExpression(child) && child.expression?.getText(owner.tree) === "children"));
}

function hasAlignedFieldAndSwitchSlots(source: string) {
  return source.includes("[data-admin-form-grid-item]_[data-admin-form-field]") &&
    source.includes("[data-admin-form-grid-item]_[data-admin-form-switch-surface=embedded]:not([data-admin-form-switch-layout=inline])]:contents") &&
    source.includes("[data-admin-form-grid-item]_[data-admin-form-switch-surface]]:row-start-2");
}

function hasSelectedStyleComposition(source: string) {
  const ast = pageCompositionAst(source);
  const section = ast.owned("ModuleEditorSection").find(node => ast.attr(node, "id") === '"featured-variant-settings-panel"');
  const grid = ast.owned("AdminFormGrid").find(node => ast.attr(node, "presentation") === '"aligned-fields"' && ast.attr(node, "columns") === "{4}");
  const header = ast.owned("AdminModuleSectionHeader").find(node => ast.attr(node, "id") === '"featured-variant-settings"');
  let controls: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(ast.tree) === "variantControls") controls = node; ts.forEachChild(node, visit); };
  visit(ast.tree);
  if (!section || !grid || !header || !ast.inside(grid, section.parent) || !ast.inside(header, section.parent) || ast.attr(header, "standalone") !== "{false}" || !controls?.initializer) return false;
  const inner = pageCompositionAst(`const controls = ${controls.initializer.getText(ast.tree)};`);
  const switches = inner.owned("AdminFormSwitch");
  const count = ast.owned("input").find(node => ast.attr(node, "name") === '"items_per_view"' && ast.attr(node, "type") === '"number"');
  return switches.length === 3 && switches.every(node => node.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(inner.tree) === "embedded") && inner.attr(node, "uncheckedValue") === '"false"') &&
    !inner.owned("AdminCard").length && Boolean(count && ast.attr(count, "className") === "{adminFormFieldClassName()}" && ast.owned("AdminFormField").some(node => ast.inside(count, node.parent))) &&
    ast.owned("input").some(node => ast.attr(node, "name") === '"items_per_view"' && ast.attr(node, "type") === '"hidden"') && !source.includes("h-9") && !source.includes("w-14");
}

async function verifyFeaturedSwitchComposition() {
  const [contract, form, headers, styles, switches, card] = await Promise.all([
    jiti.import<typeof import("../src/lib/featured-modules/contract.ts")>("../src/lib/featured-modules/contract.ts"),
    jiti.import<typeof import("../src/components/admin/ui/AdminForm.tsx")>("../src/components/admin/ui/AdminForm.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminModuleTabs.tsx")>("../src/components/admin/ui/AdminModuleTabs.tsx"),
    jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
    jiti.import<typeof import("../src/components/admin/ui/AdminFormSwitch.tsx")>("../src/components/admin/ui/AdminFormSwitch.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminCard.tsx")>("../src/components/admin/ui/AdminCard.tsx"),
  ]);
  const compile = (source: string, dependencies: Record<string, unknown>) => {
    const result: Record<string, unknown> = {};
    new Function("exports", ...Object.keys(dependencies), ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(result, ...Object.values(dependencies));
    return result;
  };
  const declarations = (source: string, name: string) => {
    const ast = pageCompositionAst(source), node = ast.tree.statements.find((entry): entry is ts.FunctionDeclaration => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
    assert.ok(node, `${name} remains the actual existing owner`); return node.getText(ast.tree);
  };
  const rejects = (probe: () => void) => { try { probe(); return false; } catch { return true; } };
  const runtimeSource = read("src/components/admin/ui/AdminFormRuntime.tsx");
  const track = "[&>[data-admin-form-switch-surface=embedded]:not([data-admin-form-switch-layout=inline])]:grid-cols-1";
  const verifyTrack = (source: string) => {
    const Grid = compile(declarations(source, "AdminFormGrid"), { React: { createElement, Fragment } }).AdminFormGrid as typeof import("../src/components/admin/ui/AdminFormRuntime.tsx").AdminFormGrid;
    for (const presentation of ["plain", "aligned-fields", "control-cards", "equal-height-columns"] as const) for (const fieldContainers of [false, true]) {
      const grid = Grid({ children: null, columns: 4, presentation, fieldContainers });
      assert.equal(grid.props.className.split(/\s+/u).includes(track), presentation === "aligned-fields" && !fieldContainers);
      if (presentation === "aligned-fields" && !fieldContainers) {
        assert.ok(grid.props.className.includes("grid-rows-subgrid") && grid.props.className.includes("grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"));
        assert.ok(hasAlignedFieldAndSwitchSlots(source), "Nested and inline-approved field contracts remain intact");
      }
    }
  };
  verifyTrack(runtimeSource);
  for (const mutant of [runtimeSource.replace(track, ""), runtimeSource.replace(track, track.replace("&>", "&_")), runtimeSource.replace(track, track.replace(":not([data-admin-form-switch-layout=inline])", ""))]) {
    assert.notEqual(mutant, runtimeSource); assert.ok(rejects(() => verifyTrack(mutant)), "Missing or broadened direct stacked-Switch track must fail");
  }
  check("Shared aligned Grid gives only direct stacked embedded Switches a full-width track, preserving nested/inline, responsive columns and other presentations; scope negatives fail", true);

  const source = read("src/components/admin/page-blocks/FeaturedModuleEditClient.tsx");
  const Grid = compile(declarations(runtimeSource, "AdminFormGrid"), { React: { createElement, Fragment } }).AdminFormGrid as typeof import("../src/components/admin/ui/AdminFormRuntime.tsx").AdminFormGrid;
  const Section = compile(declarations(read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx"), "ModuleEditorSection"), { React: { createElement, Fragment }, AdminFormSection: form.AdminFormSection }).ModuleEditorSection as typeof import("../src/components/admin/page-blocks/ModuleEditorPresentation.tsx").ModuleEditorSection;
  const verify = (candidate: string, transitions = false) => {
    assert.ok(hasSelectedStyleComposition(candidate));
    const ast = pageCompositionAst(candidate), variables = new Map<string, ts.VariableDeclaration>();
    const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) variables.set(node.name.text, node); ts.forEachChild(node, visit); }; visit(ast.tree);
    const controls = variables.get("variantControls")?.initializer;
    const section = ast.owned("ModuleEditorSection").find(node => ast.attr(node, "id") === '"featured-variant-settings-panel"');
    assert.ok(controls && section && ts.isJsxElement(section.parent));
    const body = ast.owned("div").find(node => ast.attr(node, "data-featured-variant-settings") !== undefined);
    assert.ok(body && ast.attr(body, "key") === "{presentationVariant}" && ast.inside(body, section.parent));
    assert.equal(variables.get("usesPersistedPresentation")?.initializer?.getText(ast.tree).replace(/\s+/gu, ""), "presentationVariant===config.presentation.variant");
    assert.equal(variables.get("navigation")?.initializer?.getText(ast.tree).replace(/\s+/gu, ""), "usesPersistedPresentation?config.navigation:presentationProfile.defaultNavigation");
    const actualCount = ast.owned("FeaturedItemsPerViewControl"); assert.equal(actualCount.length, 1);
    for (const [name, value] of [["variant", "{presentationVariant}"], ["profile", "{presentationProfile}"], ["value", "{itemsPerView}"], ["itemLimit", "{Number(itemLimit)}"], ["onChange", "{setItemsPerView}"]]) assert.equal(ast.attr(actualCount[0]!, name), value);
    const dependencies = { React: { createElement, Fragment }, ...form, ...styles, ...contract, AdminFormGrid: Grid, AdminFormSwitch: switches.default, AdminCard: card.default, AdminModuleSectionHeader: headers.AdminModuleSectionHeader, ModuleEditorSection: Section };
    const code = `${declarations(candidate, "FeaturedItemsPerViewControl")}\nexport function renderSelected(presentationVariant, presentationProfile, itemsPerView, itemLimit, navigation, setItemsPerView) { const variantControls = ${controls.getText(ast.tree)}; return ${section.parent.getText(ast.tree)}; }\nexport { FeaturedItemsPerViewControl };`;
    const compiled = compile(code, dependencies);
    const render = compiled.renderSelected as (variant: string, profile: import("../src/lib/featured-modules/contract.ts").FeaturedPresentationProfile, count: string, limit: number, navigation: import("../src/lib/featured-modules/contract.ts").FeaturedNavigation, onChange: (value: string) => void) => ReactNode;
    const Count = compiled.FeaturedItemsPerViewControl as (props: { variant: import("../src/lib/featured-modules/contract.ts").FeaturedPresentationVariant; profile: import("../src/lib/featured-modules/contract.ts").FeaturedPresentationProfile; value: string; itemLimit: number; onChange: (value: string) => void }) => React.ReactElement<{ children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>> }>;
    for (const variant of contract.FEATURED_PRESENTATION_VARIANTS) {
      const profile = contract.featuredPresentationProfile(variant);
      for (const limit of [1, 12]) for (const persisted of [false, true]) for (const pending of [false, true]) {
        const value = String(contract.resolveFeaturedItemsPerView(variant, undefined, limit));
        const navigation = persisted ? contract.resolveFeaturedNavigation(variant, { showArrows: false, showDots: true, autoplay: false }) : profile.defaultNavigation;
        const html = renderToStaticMarkup(createElement("form", { dir: "rtl" }, createElement("fieldset", { disabled: pending }, render(variant, profile, value, limit, navigation, () => undefined))));
        const dom = pageCompositionAst(`<main>${html}</main>`);
        assert.equal(dom.owned("section").length, 1, "Exactly one meaningful style Section; no decorative inner cards");
        assert.equal(dom.owned("header").filter(node => dom.attr(node, "data-admin-tab-section-heading") === '"featured-variant-settings"').length, 1);
        assert.ok(html.includes(profile.summaryAr)); assert.equal(dom.owned("fieldset")[0]!.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(dom.tree) === "disabled"), pending);
        const fields = dom.owned("input").filter(node => dom.attr(node, "name") === '"items_per_view"');
        assert.equal(fields.length, 1); assert.equal(dom.attr(fields[0]!, "value"), `"${value}"`);
        if (profile.itemsPerView.mode === "configurable") {
          assert.equal(dom.attr(fields[0]!, "type"), '"number"');
          assert.equal(dom.attr(fields[0]!, "min"), `"${contract.resolveFeaturedItemsPerView(variant, profile.itemsPerView.min, limit)}"`);
          assert.equal(dom.attr(fields[0]!, "max"), `"${contract.resolveFeaturedItemsPerView(variant, profile.itemsPerView.max, limit)}"`);
          assert.ok(dom.attr(fields[0]!, "required") !== undefined); assert.equal(dom.owned("output").length, 0);
        } else { assert.equal(dom.attr(fields[0]!, "type"), '"hidden"'); assert.equal(dom.owned("output").length, 1); assert.ok(html.includes(`${value} عنصر`)); }
        const embedded = dom.owned("label").filter(node => dom.attr(node, "data-admin-form-switch-surface") === '"embedded"');
        assert.equal(embedded.length, profile.supportsNavigation ? 3 : 0);
        for (const [name, checked] of [["show_navigation_arrows", navigation.showArrows], ["show_navigation_dots", navigation.showDots], ["navigation_autoplay", navigation.autoplay]] as const) {
          const native = dom.owned("input").filter(node => dom.attr(node, "name") === `"${name}"`);
          assert.equal(native.length, profile.supportsNavigation ? 2 : 1); assert.equal(dom.attr(native[0]!, "type"), '"hidden"'); assert.equal(dom.attr(native[0]!, "value"), '"false"');
          if (profile.supportsNavigation) { assert.equal(dom.attr(native[1]!, "type"), '"checkbox"'); assert.equal(dom.attr(native[1]!, "role"), '"switch"'); assert.equal(dom.attr(native[1]!, "value"), '"true"'); assert.equal(dom.attr(native[1]!, "checked") !== undefined, checked); }
        }
        for (const label of embedded) {
          const children = dom.children(label.parent as ts.JsxElement);
          assert.equal(children.length, 2); assert.ok(children[0]!.getText(dom.tree).includes("data-admin-form-label-text"));
          assert.ok(children[1]!.getText(dom.tree).includes("inline-flex min-h-11 items-center"));
          assert.ok(children[1]!.getText(dom.tree).includes("h-5 w-9"), "Actual Switch glyph retains its intrinsic20x36 geometry; only the layout track changes");
        }
      }
      if (transitions && profile.itemsPerView.mode === "configurable") {
        const changed: string[] = [], element = Count({ variant, profile, value: "2", itemLimit: 12, onChange: next => changed.push(next) });
        element.props.children.props.onChange?.({ currentTarget: { value: "3" } } as React.ChangeEvent<HTMLInputElement>); assert.deepEqual(changed, ["3"]);
      }
    }
  };
  verify(source, true);
  check("Actual Featured count, controls and meaningful Section render every derived profile with fixed/configurable bounds, intrinsic Switch composition, default/persisted navigation, pending and list false bindings preserved", true);
  for (const [from, to] of [["{variantControls}", "{null}"], ['name="navigation_autoplay"', 'name="detached_autoplay"'], ['uncheckedValue="false"', 'uncheckedValue="true"'], ['key={presentationVariant}', 'key="detached"'], ['onChange={setItemsPerView}', 'onChange={() => undefined}'], ["presentationProfile.supportsNavigation ?", "true ?"], ['type="hidden" name="items_per_view" value={value}', 'type="hidden" name="items_per_view" value="0"'], ["{variantControls}", "<AdminCard>{variantControls}</AdminCard>"]]) {
    const mutant = source.replace(from, to); assert.notEqual(mutant, source); assert.ok(rejects(() => verify(mutant)), "Actual descendant negatives reject detached controls, native/key/default drift or decorative panel nesting");
  }
  check("Selected-style regression negatives reject actual detached descendants, false/count/key/change/native drift, lost profile navigation and redundant inner Panels", true);
}

async function verifyBlockPanelComposition() {
  const [form, card, headers, styles, metadata, utils] = await Promise.all([
    jiti.import<typeof import("../src/components/admin/ui/AdminForm.tsx")>("../src/components/admin/ui/AdminForm.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminCard.tsx")>("../src/components/admin/ui/AdminCard.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminModuleTabs.tsx")>("../src/components/admin/ui/AdminModuleTabs.tsx"),
    jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
    jiti.import<typeof import("../src/lib/page-composition/slot-module-registry.ts")>("../src/lib/page-composition/slot-module-registry.ts"),
    jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>("../src/lib/page-blocks/admin-utils.ts"),
  ]);
  const compile = (source: string, names: string[], dependencies: Record<string, unknown>) => {
    const ast = pageCompositionAst(source);
    const declarations = names.map(name => {
      const node = ast.tree.statements.find((entry): entry is ts.FunctionDeclaration => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
      assert.ok(node, `${name} retains its existing executable owner`);
      return node.getText(ast.tree);
    });
    const result: Record<string, unknown> = {};
    new Function("exports", ...Object.keys(dependencies), ts.transpileModule(declarations.join("\n"), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(result, ...Object.values(dependencies));
    return result;
  };
  const rejects = (probe: () => unknown) => { try { probe(); return false; } catch { return true; } };
  const native = createElement("input", { name: "preserved", defaultValue: "original", required: true, disabled: true, onChange: () => undefined });
  const explicitHeader = createElement("header", { "data-original-header": "" }, "Original header");
  const formSource = read("src/components/admin/ui/AdminForm.tsx");
  const verifyForm = (source: string) => {
    const Section = compile(source, ["AdminFormSection"], { React: { createElement, Fragment }, AdminCard: card.default, AdminModuleSectionHeader: headers.AdminModuleSectionHeader, adminFormHintClassName: styles.adminFormHintClassName }).AdminFormSection as typeof form.AdminFormSection;
    for (const header of [undefined, explicitHeader]) {
      const props = { id: "original-id", title: "Original title", description: "Original description", actions: createElement("button", { type: "button" }, "Original action"), header, className: "original-composition", children: native };
      const panel = renderToStaticMarkup(createElement(Section, props));
      assert.ok(panel.includes(styles.ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME));
      for (const presentation of [undefined, "default", "panel"] as const) assert.equal(renderToStaticMarkup(createElement(Section, { ...props, presentation, surface: "panel" })), panel);
      const neutral = Section({ ...props, surface: "neutral" });
      assert.ok(isValidElement<{ id: string; className: string; children: ReactNode[] }>(neutral));
      assert.equal(neutral.type, "section"); assert.equal(neutral.props.id, props.id);
      assert.equal(neutral.props.className, "min-w-0 original-composition");
      assert.equal(neutral.props.children[1], native, "Neutral composition preserves exact callback-bearing native content");
      const html = renderToStaticMarkup(neutral);
      assert.ok(html.includes('data-admin-form-section-surface="neutral"') && html.includes('name="preserved"') && html.includes('value="original"') && html.includes('required=""') && html.includes('disabled=""'));
      if (header) assert.equal(neutral.props.children[0], header);
      else {
        for (const text of ["Original title", "Original description", "Original action"]) assert.ok(html.includes(text));
        assert.ok(!html.includes("-mx-3"), "Neutral implicit header uses the canonical standalone geometry");
      }
    }
  };
  verifyForm(formSource);
  for (const [from, to] of [
    ['surface = "panel"', 'surface = "neutral"'],
    ['data-admin-form-section-surface="neutral"', 'data-lost-neutral=""'],
    ['className={`min-w-0 ${className}`.trim()}', 'className={`min-w-0 p-3 border bg-black ${className}`.trim()}'],
    ["{sectionHeader}", "{null}"], ["{children}", "{null}"],
  ]) { const mutant = formSource.replaceAll(from, to); assert.notEqual(mutant, formSource); assert.ok(rejects(() => verifyForm(mutant)), "Neutral section negatives reject default changes, repeated visual chrome and lost headers/native content"); }
  check("Section surface port preserves omitted/default/legacy Panel identity and neutral semantics, original header/native children; structural negatives reject regressions", true);

  const presentation = read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx");
  const verifyTabs = (source: string) => {
    const owners = compile(source, ["ModuleEditorTabs", "ModuleEditorSection"], {
      React: { createElement, Fragment }, ...metadata, ...utils, ...form,
      useSearchParams: () => new URLSearchParams("tab=content"),
      useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, () => undefined],
      useCallback: (callback: unknown) => callback,
      AdminModuleTabs: headers.default, AdminModuleSectionHeader: headers.AdminModuleSectionHeader,
      ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME: styles.ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,
    });
    const Tabs = owners.ModuleEditorTabs as typeof import("../src/components/admin/page-blocks/ModuleEditorPresentation.tsx").ModuleEditorTabs;
    const Section = owners.ModuleEditorSection as typeof import("../src/components/admin/page-blocks/ModuleEditorPresentation.tsx").ModuleEditorSection;
    for (const surface of [undefined, "panel", "neutral"] as const) {
      const html = renderToStaticMarkup(createElement(Tabs, { moduleKind: "content", moduleSlug: "projects-hub-hero", tabs: [{ id: "content", contentSurface: surface, content: native }] }));
      const dom = pageCompositionAst(`<main>${html}</main>`), headings = dom.owned("header").filter(node => dom.attr(node, "data-admin-tab-section-heading") !== undefined);
      assert.equal(headings.length, 1); assert.ok(html.includes('role="tablist"') && html.includes('role="tabpanel"') && html.includes('aria-labelledby=') && html.includes('name="preserved"'));
      const parent = headings[0]!.parent.parent;
      assert.ok(ts.isJsxElement(parent));
      assert.equal(parent.openingElement.tagName.getText(dom.tree), "section");
      const classes = dom.attr(parent.openingElement, "class") ?? "";
      if (surface === "neutral") {
        assert.equal(dom.attr(parent.openingElement, "data-admin-form-section-surface"), '"neutral"');
        assert.equal(classes, '"min-w-0"');
        assert.ok(!dom.attr(headings[0]!, "class")?.includes("-mx-3"), "Neutral tab header uses canonical standalone geometry");
      } else assert.ok(classes.includes("p-3") && classes.includes("border"));
      const forwarded = Section({ surface, children: native });
      assert.equal(forwarded.type, form.AdminFormSection); assert.equal(forwarded.props.surface, surface); assert.equal(forwarded.props.children, native);
    }
  };
  verifyTabs(presentation);
  for (const [from, to] of [["surface={tab.contentSurface}", "surface=\"panel\""], ['standalone={tab.contentSurface === "neutral" ? true : undefined}', 'standalone={false}'], ['<AdminFormSection {...props} variant="module">', '<AdminFormSection variant="module">']]) {
    const mutant = presentation.replace(from, to); assert.notEqual(mutant, presentation); assert.ok(rejects(() => verifyTabs(mutant)));
  }
  check("Actual Module Tabs forward neutral composition with one canonical standalone Header and preserved tabs/native semantics; default Panel and wrapper forwarding stay intact", true);

  const content = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx"), intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx"), cta = read("src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx"), collection = read("src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx"), breadcrumb = read("src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx");
  const conditionalSurface = (expression: string | undefined) => {
    assert.ok(expression?.startsWith("{"));
    const resolveSurface = new Function("section", `return (${expression!.slice(1, -1)});`);
    assert.equal(resolveSurface("all"), "panel");
    for (const split of ["text", "images", "cards", "configuration"]) assert.equal(resolveSurface(split), "neutral");
  };
  const verifyConsumers = (sources: { content: string; intro: string; cta: string; collection: string; breadcrumb: string }) => {
    const root = pageCompositionAst(sources.content);
    assert.ok(root.canonical("ModuleEditorTabs", "/ModuleEditorPresentation"));
    const hero = root.tree.statements.flatMap(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "ContentModuleEditClient" ? statement.body?.statements ?? [] : []).flatMap(statement => ts.isVariableStatement(statement) ? statement.declarationList.declarations : []).find(node => node.name.getText(root.tree) === "heroPlatformTabs");
    assert.ok(hero && /id: "content",\s*contentSurface: "neutral" as const,\s*content: <ProjectsHubHeroModuleEditor/u.test(hero.getText(root.tree)), "Known107 delegates Tab visual ownership to its existing semantic sections");
    const wrappers = root.owned("ModuleEditorSection").filter(node => !root.attr(node, "title") && !root.attr(node, "header"));
    assert.equal(wrappers.length, 2); assert.ok(wrappers.every(node => root.attr(node, "surface") === '"neutral"'));
    for (const child of ["HeroCtaFields", "HeroElementOrderEditor"]) assert.ok(wrappers.some(node => node.parent.getText(root.tree).includes(`<${child}`)));
    const fallback = root.normal.match(/contentSurface:([^,]+),content:editorKey===/u)?.[1];
    assert.ok(fallback); const resolveSurface = new Function("editorKey", `return (${fallback});`);
    for (const key of ["projects-hub-featured", "projects-hub-listing", "projects-hub-map"]) assert.equal(resolveSurface(key), "neutral");
    for (const key of ["generic", "about-approach", "about-principles"]) assert.equal(resolveSurface(key), "panel");
    const about = pageCompositionAst(sources.intro), splitWrappers = about.owned("ModuleEditorSection").filter(node => !about.attr(node, "header"));
    assert.equal(splitWrappers.length, 3); splitWrappers.forEach(node => conditionalSurface(about.attr(node, "surface")));
    assert.ok(about.owned("ModuleEditorSection").some(node => about.attr(node, "header")?.includes("home-story-cta-${kind}")), "Independent CTA data/appearance sections stay functional panels");
    const contacts = pageCompositionAst(sources.cta);
    assert.equal(contacts.owned("ModuleEditorSection").length, 3); assert.ok(contacts.owned("ModuleEditorSection").every(node => contacts.attr(node, "surface") === '"neutral"'));
    for (const binding of ["AdminMediaImageField", "ModuleEditorRepeaterCard", "AdminLinkField"]) assert.ok(contacts.owned(binding).length > 0);
    for (const existing of ['onClick={() => moveRow(index, -1)}', 'onClick={() => moveRow(index, 1)}', 'name="image"', 'altName="image_alt"']) assert.ok(sources.cta.includes(existing));
    const listing = pageCompositionAst(sources.collection), configuration = listing.owned("ModuleEditorSection").find(node => listing.attr(node, "header")?.includes('section === "all"'));
    assert.ok(configuration); conditionalSurface(listing.attr(configuration!, "surface"));
    assert.ok(listing.attr(configuration!, "header")?.includes('id="collection-configuration"'));
    assert.ok(listing.owned("ModuleEditorSection").some(node => listing.attr(node, "header")?.includes('id="collection-display-formatting"') && listing.attr(node, "surface") === undefined));
    const crumbs = pageCompositionAst(sources.breadcrumb), crumbSection = crumbs.owned("ModuleEditorSection");
    assert.equal(crumbSection.length, 1); assert.equal(crumbs.attr(crumbSection[0]!, "surface"), '"neutral"');
    for (const name of ["source", "current_label_override", "show_home"]) assert.ok(crumbs.nodes.some(node => crumbs.attr(node, "name") === `"${name}"` && crumbs.inside(node, crumbSection[0]!.parent)));
  };
  const sources = { content, intro, cta, collection, breadcrumb }; verifyConsumers(sources);
  for (const key of Object.keys(sources) as Array<keyof typeof sources>) {
    const original = sources[key], mutant = key === "content" ? original.replace('contentSurface: "neutral" as const', 'contentSurface: "panel" as const') : original.replace(/surface=(?:"neutral"|\{section === "all" \? "panel" : "neutral"\})/u, 'surface="panel"');
    assert.notEqual(mutant, original); assert.ok(rejects(() => verifyConsumers({ ...sources, [key]: mutant })), `${key} rejects the proven repeated visual container pattern`);
  }
  check("Registered same-owner consumers remove redundant Tab/inner surfaces while standalone, domain section, repeater, media, CTA, native bindings and reorder contracts remain intact", true);
  const gridSource = read("src/components/admin/ui/AdminFormRuntime.tsx");
  check("Affected mixed-row source contract retains embedded Switch field slots and nonembedded row positioning; both lost-selector mutations fail", hasAlignedFieldAndSwitchSlots(gridSource) &&
    !hasAlignedFieldAndSwitchSlots(gridSource.replace("[data-admin-form-switch-surface=embedded]:not([data-admin-form-switch-layout=inline])]:contents", "[data-lost-embedded]]:contents")) &&
    !hasAlignedFieldAndSwitchSlots(gridSource.replace("[data-admin-form-switch-surface]]:row-start-2", "[data-lost-switch]]:row-start-2")) &&
    !hasAlignedFieldAndSwitchSlots(gridSource.replace(":not([data-admin-form-switch-layout=inline])]:contents", "]:contents")));
}

function hasBlockEditorPresentation(source: string) {
  const ast = pageCompositionAst(source), { owned, attr, inside } = ast;
  const forms = [...owned("form"), ...owned("AdminFormRuntime")];
  const identities = owned("ModuleEditorIdentitySection"), tabs = owned("ModuleEditorTabs"), saves = owned("ModuleEditorSaveArea");
  if (forms.length !== 1 || !identities.length || !tabs.length || !saves.length ||
    ![...identities, ...tabs, ...saves].every(node => attr(node, "presentation") === undefined) ||
    !["ModuleEditorIdentitySection", "ModuleEditorTabs", "ModuleEditorSaveArea"].every(name => ast.canonical(name, "/ModuleEditorPresentation"))) return false;
  const mountedInside = (child: ts.Node, parent: ts.Node) => {
    if (inside(child, parent)) return true;
    let declaration: ts.VariableDeclaration | undefined;
    for (let node: ts.Node | undefined = child.parent; node; node = node.parent) if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) { declaration = node; break; }
    let value = declaration?.initializer;
    while (value && ts.isParenthesizedExpression(value)) value = value.expression;
    if (!value || ![ts.SyntaxKind.JsxElement, ts.SyntaxKind.JsxSelfClosingElement, ts.SyntaxKind.JsxFragment].includes(value.kind)) return false;
    let mounted = false;
    const visit = (node: ts.Node) => { if (ts.isJsxExpression(node) && node.expression?.getText(ast.tree) === declaration!.name.getText(ast.tree) && inside(node, parent)) mounted = true; ts.forEachChild(node, visit); };
    visit(parent); return mounted;
  };
  const stack = owned("div").find(node => attr(node, "className")?.includes("ADMIN_FORM_STACK_CLASS_NAME") &&
    inside(node, forms[0]!.parent) && [...identities, ...tabs, ...saves].every(child => mountedInside(child, node.parent)));
  return Boolean(stack) && saves.every(save => ![...owned("AdminCard"), ...owned("AdminFormSection"), ...owned("ModuleEditorSection")].some(panel => inside(save, panel.parent))) &&
    (owned("AdminFormRuntime").length === 1 || owned("AdminFormPendingFields").length === 1);
}

async function registeredBlockEditorConsumers() {
  const { PAGE_MODULE_KINDS } = await jiti.import<typeof import("../src/lib/page-blocks/types.ts")>("../src/lib/page-blocks/types.ts");
  return PAGE_MODULE_KINDS.map(kind => {
    const route = `src/app/admin/pages-blocks/blocks/${kind}/[id]/page.tsx`, ast = pageCompositionAst(read(route));
    const binding = ast.tree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) &&
      Boolean(node.importClause?.name && /(?:ModuleEditClient|HeroEditClient)$/u.test(node.importClause.name.text)));
    assert.ok(binding && ts.isStringLiteral(binding.moduleSpecifier), `Registered ${kind} route retains its actual editor owner`);
    return { kind, path: resolve(ROOT, dirname(route), binding.moduleSpecifier.text + ".tsx"), source: readFileSync(resolve(ROOT, dirname(route), binding.moduleSpecifier.text + ".tsx"), "utf8") };
  });
}

function hasNestedBlockFieldPresentation(source: string) {
  const ast = pageCompositionAst(source);
  const native = ast.nodes.filter(node => /^(?:input|select|textarea)$/u.test(node.tagName.getText(ast.tree)) && ast.attr(node, "type") !== '"hidden"');
  return native.every(node => {
    for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
      if (!ts.isJsxElement(parent)) continue;
      const name = parent.openingElement.tagName.getText(ast.tree);
      if (name === "label") return false;
      if (name === "AdminFormField") return ast.canonical(name, "/ui");
      if (name === "ModuleEditorVisibilityAlignRow") return ast.canonical(name, "/ModuleEditorPresentation");
    }
    return false;
  }) && ast.owned("AdminFormListboxSelect").every(node => ast.canonical("AdminFormListboxSelect", "/ui") &&
    Boolean(ast.attr(node, "label")) && !ast.attr(node, "label")!.includes("AdminFormControlHeader"));
}

function hasCtaNestedPanelPresentation(source: string) {
  const ast = pageCompositionAst(source);
  if (!hasNestedBlockFieldPresentation(source) || !ast.canonical("ModuleEditorSection", "/ModuleEditorPresentation")) return false;
  return ["primary_cta", "secondary_cta"].every(prefix => {
    const field = ast.owned("input").find(node => ast.attr(node, "name") === `"${prefix}_label"`);
    const link = ast.owned("AdminLinkField").find(node => ast.attr(node, "prefix") === `"${prefix}"`);
    if (!field || !link) return false;
    const panel = ast.owned("ModuleEditorSection").find(node => ast.inside(field, node.parent) && ast.inside(link, node.parent));
    return Boolean(panel && ast.attr(panel, "title") && !ast.attr(panel, "header") &&
      ast.owned("AdminFormField").some(node => ast.inside(field, node.parent) && ast.inside(node, panel.parent) && Boolean(ast.attr(node, "label"))));
  });
}

async function verifyOwnerReviewContentDescendants() {
  const hasAttribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === name);
  const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
  const hasNamedSlotMedia = (source: string) => {
    const ast = pageCompositionAst(source);
    const slots = ast.tree.statements.find(node => node.getText(ast.tree).includes("const aboutImageFields"));
    const fields = ast.owned("AdminMediaImageField").filter(node => slots && ast.inside(node, slots) && ast.attr(node, "name") === '{"image_" + slot.key}');
    return ast.canonical("AdminMediaImageField", "/media/AdminMediaImageField") && fields.length === 1 && fields.every(node => ast.attr(node, "altName") === '{"image_" + slot.key + "_alt"}' &&
      ast.attr(node, "defaultValue") === '{images[slot.key] ?? ""}' && ast.attr(node, "defaultAlt") === '{images[slot.altKey] ?? ""}' &&
      ast.attr(node, "variant") === '"card"' && ast.attr(node, "dimensionsPresentation") === '"disclosure"' &&
      ast.attr(node, "metadataPresentation") === '"panel"' && hasAttribute(node, "showAltCounter") &&
      ast.attr(node, "showGuidance") !== "{false}" && ast.attr(node, "enablePreview") !== "{false}" &&
      !ast.attr(node, "captionName")) && ["main", "secondary", "accent"].every(key => source.includes(`key: "${key}"`)) &&
      !ast.owned("AdminMediaGalleryField").length;
  };
  check("About Intro and its variant copies keep three named image/Alt slots with shared dimension disclosures/metadata and existing preview/actions; array-only ordering/caption is not invented", hasNamedSlotMedia(intro) &&
    !hasNamedSlotMedia(intro.replace('dimensionsPresentation="disclosure"', 'dimensionsPresentation="default"')) &&
    !hasNamedSlotMedia(intro.replace('altName={"image_" + slot.key + "_alt"}', 'altName="detached_alt"')) &&
    !hasNamedSlotMedia(intro.replace('metadataPresentation="panel"', 'metadataPresentation="default"')));

  const vision = read("src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx");
  const hasBoundedVisionComposition = (source: string) => {
    const ast = pageCompositionAst(source), editors = ast.owned("AdminRichTextEditor");
    const row = ast.owned("ModuleEditorVisibilityAlignRow").find(node => ast.attr(node, "showName") === '"show_intro"');
    return ast.canonical("AdminRichTextEditor", "/AdminRichTextEditor") && ast.canonical("ModuleEditorVisibilityAlignRow", "/ModuleEditorPresentation") && editors.length === 1 && row && ast.inside(editors[0]!, row.parent) &&
      ast.attr(editors[0]!, "name") === '"intro"' && ast.attr(editors[0]!, "maxHeight") === "{360}" &&
      !ast.attr(editors[0]!, "minHeight") && ast.attr(editors[0]!, "storageFormat") === '"markdown"' &&
      ast.attr(editors[0]!, "toolbarMode") === '"full"' && hasAttribute(editors[0]!, "enableArticleStructure") &&
      hasAttribute(editors[0]!, "enableTextAlign") && ast.attr(row, "boldName") === '"intro_bold"' &&
      ast.attr(row, "alignmentName") === '"intro_alignment"' && ast.attr(row, "boldDefault") === "{introFormat.bold}" &&
      ast.attr(row, "alignmentDefault") === "{introFormat.alignment}" && ast.attr(row, "showDefault") === "{introFormat.visible}" &&
      !ast.owned("AdminTextFormatControls").length && !ast.owned("input").some(node => ['"intro_bold"', '"intro_alignment"'].includes(ast.attr(node, "name") ?? ""));
  };
  check("Vision Goals uses the shared bounded editor viewport and a single canonical whole-module control row while retaining Markdown/selection formatting and native formatting defaults", hasBoundedVisionComposition(vision) &&
    !hasBoundedVisionComposition(vision.replace("maxHeight={360}", "minHeight={620}")) &&
    !hasBoundedVisionComposition(vision.replace('boldName="intro_bold"', 'boldName="detached_bold"')) &&
    !hasBoundedVisionComposition(vision.replace('alignmentName="intro_alignment"', 'alignmentName="detached_alignment"')));
  const [{ default: Card }, { AdminFormControlHeader: Header }, { default: Switch }, { default: Format }, { TrashIcon }, { default: Button }] = await Promise.all([
    jiti.import<typeof import("../src/components/admin/ui/AdminCard.tsx")>("../src/components/admin/ui/AdminCard.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminForm.tsx")>("../src/components/admin/ui/AdminForm.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminFormSwitch.tsx")>("../src/components/admin/ui/AdminFormSwitch.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminTextFormatControls.tsx")>("../src/components/admin/ui/AdminTextFormatControls.tsx"),
    jiti.import<typeof import("../src/components/admin/AdminRowActions.tsx")>("../src/components/admin/AdminRowActions.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminActionButton.tsx")>("../src/components/admin/ui/AdminActionButton.tsx"),
  ]);
  const ownerTree = pageCompositionAst(read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx"));
  const ownerRow = ownerTree.tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ModuleEditorVisibilityAlignRow");
  assert.ok(ownerRow);
  const rowExports: Partial<typeof import("../src/components/admin/page-blocks/ModuleEditorPresentation.tsx")> = {};
  new Function("React", "exports", "useState", "AdminCard", "AdminFormControlHeader", "AdminFormSwitch", "AdminTextFormatControls", ts.transpileModule(ownerRow.getText(ownerTree.tree), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)({ createElement, Fragment }, rowExports, useState, Card, Header, Switch, Format);
  const ModuleEditorVisibilityAlignRow = rowExports.ModuleEditorVisibilityAlignRow;
  assert.ok(ModuleEditorVisibilityAlignRow);
  for (const visible of [true, false]) for (const bold of [true, false]) for (const alignment of ["right", "center", "left", "justify"] as const) {
    const html = renderToStaticMarkup(createElement(ModuleEditorVisibilityAlignRow, { label: "المحتوى الطويل", showName: "show_intro", showDefault: visible, boldName: "intro_bold", boldDefault: bold, alignmentName: "intro_alignment", alignmentDefault: alignment }, createElement("input", { type: "hidden", name: "intro", value: "المحتوى الأصلي" })));
    const dom = pageCompositionAst(`<main>${html}</main>`);
    for (const [name, value] of [["show_intro", String(visible)], ["intro_bold", String(bold)], ["intro_alignment", alignment], ["intro", "المحتوى الأصلي"]]) {
      const inputs = dom.owned("input").filter(node => dom.attr(node, "name") === `"${name}"`);
      assert.equal(inputs.length, 1, `${name} remains submitted once`);
      assert.equal(dom.attr(inputs[0]!, "value"), `"${value}"`);
    }
  }
  check("Actual shared whole-module row SSR preserves every existing visibility/bold/alignment value including legacy justify without duplicate native projections", true);

  for (const [file, handler, collection] of [["AboutPrinciplesModuleEditor", "removeItem", "items"], ["ProjectsHubMapModuleEditor", "removePin", "pins"]]) {
    const source = read(`src/components/admin/page-blocks/editors/${file}.tsx`);
    const hasCanonicalDelete = (candidate: string) => {
      const ast = pageCompositionAst(candidate);
      const button = ast.owned("AdminActionButton").find(node => ast.attr(node, "onClick") === `{() => ${handler}(index)}`);
      return ast.canonical("TrashIcon", "/AdminRowActions") && button && ast.attr(button, "type") === '"button"' && ast.attr(button, "variant") === '"danger"' && ast.attr(button, "size") === '"icon"' &&
        ast.attr(button, "disabled") === `{${collection}.length <= 1}` && ast.attr(button, "title") === ast.attr(button, "aria-label") &&
        Boolean(ast.attr(button, "aria-label")?.includes("index + 1")) && ast.owned("TrashIcon").some(node => ast.inside(node, button.parent));
    };
    assert.ok(hasCanonicalDelete(source) && !hasCanonicalDelete(source.replace('<TrashIcon className="size-5" />', 'حذف')) &&
      !hasCanonicalDelete(source.replace(`disabled={${collection}.length <= 1}`, "disabled={false}")));
    const ast = pageCompositionAst(source), opening = ast.owned("AdminActionButton").find(node => ast.attr(node, "onClick") === `{() => ${handler}(index)}`)!;
    const render = new Function("React", "AdminActionButton", "TrashIcon", collection, handler, "index", ts.transpileModule(`return ${opening.parent.getText(ast.tree)};`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText) as (...args: unknown[]) => React.ReactElement<React.ComponentProps<typeof Button>>;
    const removed: number[] = [];
    for (const count of [1, 3]) {
      const element = render({ createElement }, Button, TrashIcon, Array.from({ length: count }), (index: number) => removed.push(index), 0);
      const html = renderToStaticMarkup(element);
      assert.equal(html.includes('disabled=""'), count === 1);
      assert.ok(html.includes('<svg') && html.includes('aria-label="حذف'));
      if (count > 1) element.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    }
    assert.deepEqual(removed, [0]);
    check(`${file} actual delete action delegates to canonical Trash/button with accessible identity, minimum-item boundary and unchanged removal callback`, true);
  }
}

async function verifyOwnerReviewGridAndFooter() {
  const files = [
    "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
    "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
    "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
    "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
    "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
    "src/app/admin/pages-blocks/footer/FooterMenuPreviewDataGrid.tsx",
  ];
  const usesFixedGridScroll = (source: string) => {
    const ast = pageCompositionAst(source);
    const rows = [...ast.owned("AdminDataGridHeader"), ...ast.owned("AdminDataGridRow")];
    return rows.length >= 2 && rows.every(node => node.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(ast.tree) === "horizontalScroll" && (!property.initializer || property.initializer.getText(ast.tree) === "{true}"))) &&
      ast.owned("AdminDataGrid").length > 0;
  };
  check("Every affected fixed-track Page Blocks/Footer collection adopts the existing scroll geometry for both Header and Rows; header-only adoption fails", files.every(path => {
    const source = read(path);
    const ast = pageCompositionAst(source), row = ast.owned("AdminDataGridRow")[0]!;
    const port = row.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast.tree) === "horizontalScroll");
    if (!port) return false;
    const headerOnly = source.slice(0, port.getStart(ast.tree)) + source.slice(port.end);
    return usesFixedGridScroll(source) && !usesFixedGridScroll(headerOnly);
  }));
  const grid = await jiti.import<typeof import("../src/components/admin/ui/AdminDataGrid.tsx")>("../src/components/admin/ui/AdminDataGrid.tsx");
  const renderGridProbe = new Function("React", "grid", ts.transpileModule(`return function GridProbe() {
    return <div dir="rtl"><grid.AdminDataGrid scrollLabel="جدول الاختبار">
      <grid.AdminDataGridHeader columns="320px 160px 96px 198px" horizontalScroll><grid.AdminDataGridPrimaryCell>العنوان</grid.AdminDataGridPrimaryCell></grid.AdminDataGridHeader>
      <grid.AdminDataGridRow columns="320px 160px 96px 198px" horizontalScroll><grid.AdminDataGridPrimaryCell>عنوان طويل</grid.AdminDataGridPrimaryCell></grid.AdminDataGridRow>
    </grid.AdminDataGrid></div>;
  }`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText)({ createElement }, grid) as () => ReactNode;
  const markup = renderToStaticMarkup(createElement(renderGridProbe));
  check("Actual shared Grid renders accessible RTL scroll containment and matching content-sized Header/Row tracks without hidden mobile header", markup.includes('aria-label="جدول الاختبار"') &&
    (markup.match(/w-max min-w-full/gu) ?? []).length === 2 && markup.includes("overflow-x-auto") && !markup.includes("max-xl:hidden"));
  check("Footer manual and read-only menu tables retain canonical Primary/Center/Status/Actions cells", files.slice(-2).every(path => {
    const ast = pageCompositionAst(read(path));
    return ["AdminDataGridPrimaryCell", "AdminDataGridCenterCell", "AdminDataGridStatusCell", "AdminDataGridActionsCell", "AdminDataGridActionsHeaderCell"].every(name => ast.owned(name).length > 0);
  }));
  verifyOwnerReviewFooterFields();
}

function verifyOwnerReviewFooterFields() {
  const footerFiles = ["FooterBuilderClient", "FooterBuilderEditors", "FooterSlotConfigFields", "FooterSlotEditorCard"];
  check("Footer actual descendant fields and existing semantic Sections use canonical owners without raw label or two-column CSS substitutes", footerFiles.every(name => {
    const source = read(`src/app/admin/pages-blocks/footer/${name}.tsx`), ast = pageCompositionAst(source);
    const fields = ast.owned("AdminFormField"), controls = [...ast.owned("input"), ...ast.owned("textarea"), ...ast.owned("AdminListboxSelect")];
    return controls.every(control => fields.some(field => ast.inside(control, field.parent))) && ast.owned("label").length === 0 && !source.includes("ADMIN_FORM.gridTwoCol") &&
      ast.owned("AdminFormSection").length > 0 && (name !== "FooterBuilderClient" || ast.owned("AdminModuleTabs").length > 0);
  }));
}

async function verifyOwnerReviewFinalAdoption() {
  const [{ fieldClassName }, { adminFormFieldClassName }] = await Promise.all([
    jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>("../src/lib/page-blocks/admin-utils.ts"),
    jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
  ]);
  const helper = read("src/lib/page-blocks/admin-utils.ts");
  const delegatesFieldGeometry = (source: string) => {
    const ast = pageCompositionAst(source);
    return ast.canonical("adminFormFieldClassName", "/admin/admin-ui-styles") && ast.tree.statements.some(node =>
      ts.isFunctionDeclaration(node) && node.name?.text === "fieldClassName" &&
      node.body?.statements.length === 1 && ts.isReturnStatement(node.body.statements[0]!) &&
      node.body.statements[0].expression?.getText(ast.tree) === "adminFormFieldClassName(extra)");
  };
  check("Page Blocks field helper delegates actual defaults and specialized extras to the canonical Form owner; duplicate geometry fails", delegatesFieldGeometry(helper) &&
    ["", "h-11", "resize-y leading-7", "h-[72px] resize-none"].every(extra => fieldClassName(extra) === adminFormFieldClassName(extra)) &&
    !delegatesFieldGeometry(helper.replace("return adminFormFieldClassName(extra);", 'return "local py-3 " + extra;')));

  const featured = read("src/components/admin/page-blocks/FeaturedModuleEditClient.tsx");
  check("Featured actual style-dependent count and three native switches share aligned fields and one Section; fixed count and false bindings survive", hasSelectedStyleComposition(featured) &&
    !hasSelectedStyleComposition(featured.replace('presentation="aligned-fields"', 'presentation="plain"')) &&
    !hasSelectedStyleComposition(featured.replaceAll("embedded", "surface")) &&
    !hasSelectedStyleComposition(featured.replace("{adminFormFieldClassName()}", '{fieldClassName("h-9 w-14")}')));

  const projectHero = read("src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx");
  check("Content Projects Hero actual Select and number row keeps three equal spans, canonical fields and original full-width empty-state", hasProjectHeroFields(projectHero) &&
    !hasProjectHeroFields(projectHero.replace('name="project_type"', 'name="detached_type"')) &&
    !hasProjectHeroFields(projectHero.replace("span={4}", "span={8}")));

  const breadcrumb = read("src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx");
  check("Breadcrumb mixed Select/Input/Switch are actual direct aligned-grid fields; opaque per-field cards cannot masquerade as alignment", alignedBreadcrumb(breadcrumb) &&
    !alignedBreadcrumb(breadcrumb.replace('presentation="aligned-fields"', 'presentation="plain"')));
  const feed = pageCompositionAst(read("src/components/admin/page-blocks/FeedModuleFilterFields.tsx"));
  check("Feed filter descendants use two canonical functional Sections while native category and series controls remain at their existing owners", feed.owned("ModuleEditorSection").length === 2 &&
    feed.owned("AdminModuleSectionHeader").length === 2 && feed.owned("AdminFormControlHeader").length === 0 &&
    feed.owned("AdminFormSwitch").some(node => feed.attr(node, "name") === '"category_slugs"') &&
    feed.owned("AdminCheckbox").some(node => feed.attr(node, "name") === '"series_slugs"'));
  const heroCta = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx");
  check("Hero CTA actual descendant button groups require visible Fields and Section ownership; canonical Hero shell cannot hide the same CTA gap", hasHeroCtaDescendants(heroCta) &&
    !hasHeroCtaDescendants(heroCta.replaceAll("ModuleEditorSection", "UnadoptedSection")) &&
    !hasHeroCtaDescendants(heroCta.replaceAll("AdminFormField", "UnadoptedField")));
  await verifyOwnerReviewGridAndFooter();
}

async function verifyBlockReviewNestedPresentation() {
  const consumers = await registeredBlockEditorConsumers();
  const cta = consumers.find(row => row.kind === "cta")!.source;
  check("Registered roots protect actual inner native fields and Listbox labels, including legitimate shared compact text controls", consumers.every(row => hasNestedBlockFieldPresentation(row.source)));
  const mutants = [
    cta.replaceAll("AdminFormField", "UnadoptedField"),
    cta.replaceAll("ModuleEditorSection", "UnadoptedSection"),
    cta.replace('<ModuleEditorSection title="الزر الأساسي"', '<ModuleEditorSection header={<AdminFormControlHeader title="الزر الأساسي" />} title="الزر الأساسي"'),
  ];
  check("CTA completion requires both actual button Panels/Headers/Fields/links; canonical outer shell alone cannot pass", hasCtaNestedPanelPresentation(cta) &&
    mutants.every(source => source !== cta && hasBlockEditorPresentation(source) && !hasCtaNestedPanelPresentation(source)));
  const sidebar = pageCompositionAst(consumers.find(row => row.kind === "media-sidebar")!.source);
  assert.equal(sidebar.owned("ModuleEditorSection").length, 2, "The two semantic sidebar groups use the canonical Section owner");
  assert.ok(sidebar.owned("ModuleEditorSection").every(node => sidebar.attr(node, "title") && !sidebar.attr(node, "header")));
  const [{ AdminFormField, AdminFormSection }, { AdminFormGrid }, { default: Button }, styles, fields, serialize, defaults] = await Promise.all([
    jiti.import<typeof import("../src/components/admin/ui/AdminForm.tsx")>("../src/components/admin/ui/AdminForm.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminFormRuntime.tsx")>("../src/components/admin/ui/AdminFormRuntime.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminActionButton.tsx")>("../src/components/admin/ui/AdminActionButton.tsx"),
    jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
    jiti.import<typeof import("../src/lib/admin/links/form-fields.ts")>("../src/lib/admin/links/form-fields.ts"),
    jiti.import<typeof import("../src/lib/admin/links/serialize.ts")>("../src/lib/admin/links/serialize.ts"),
    jiti.import<typeof import("../src/lib/admin/links/link-defaults.ts")>("../src/lib/admin/links/link-defaults.ts"),
  ]);
  const compile = (source: string, dependencies: Record<string, unknown>) => {
    const ast = pageCompositionAst(source);
    let executable = source;
    for (const node of ast.tree.statements.filter(ts.isImportDeclaration).reverse()) executable = executable.slice(0, node.getStart(ast.tree)) + executable.slice(node.end);
    const exported: Record<string, unknown> = {};
    new Function("exports", ...Object.keys(dependencies), ts.transpileModule(executable, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exported, ...Object.values(dependencies));
    return exported;
  };
  const linkSource = read("src/components/admin/ui/AdminLinkField.tsx");
  const hasLinkLabelOwnership = (source: string) => {
    const ast = pageCompositionAst(source);
    return ast.inset("adminFormLabelClassName") && ast.inset("adminFormHintClassName") && ["p", "label"].every(tag => {
      const labels = ast.owned(tag).filter(node => ast.attr(node, "className")?.includes("adminFormLabelClassName("));
      return labels.length === 1 && ast.owned("span").some(node => node.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(ast.tree) === "data-admin-form-label-text") && ast.inside(node, labels[0]!.parent));
    });
  };
  assert.ok(hasLinkLabelOwnership(linkSource) && !hasLinkLabelOwnership(linkSource.replace('className={adminFormLabelClassName({ textInset: true })}', 'className="unadopted-label"')) &&
    !hasLinkLabelOwnership(linkSource.replace('className={adminFormHintClassName({ textInset: true })}', 'className="unadopted-hint"')), "The actual Link owner delegates both labels/hint/Anchor text to shared inset tokens; title-only or partial adoption fails");
  const stateChanges: unknown[] = [], accepted: unknown[] = [];
  const dependencies = { React: { createElement, Fragment }, useMemo: (factory: () => unknown) => factory(), useEffect: () => {},
    useState: (initial: unknown) => [initial, (value: unknown) => stateChanges.push(value)],
    unstable_rethrow: (error: unknown) => { throw error; }, resolveAdminLinkAjax: () => Promise.resolve({ ok: false }),
    ...fields, ...serialize, ...styles, AdminActionButton: Button,
    AdminLinkPicker: () => null, AdminDataGridActionIcon: () => createElement("span", { "aria-hidden": true }) };
  const Link = compile(linkSource, dependencies).default as typeof import("../src/components/admin/ui/AdminLinkField.tsx").default;
  const sectionSource = read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx"), sectionAst = pageCompositionAst(sectionSource);
  const section = sectionAst.tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ModuleEditorSection")!;
  const Section = compile(section.getText(sectionAst.tree), { React: { createElement, Fragment }, AdminFormSection }).ModuleEditorSection as typeof import("../src/components/admin/page-blocks/ModuleEditorPresentation.tsx").ModuleEditorSection;
  const ctaAst = pageCompositionAst(cta), panels = ctaAst.owned("ModuleEditorSection").map(node => node.parent.getText(ctaAst.tree));
  const renderPanels = new Function("React", "ModuleEditorSection", "AdminFormGrid", "AdminFormField", "AdminLinkField", "fieldClassName", "linkDefaultFromContainer", ts.transpileModule(`return function render(config) { return <>${panels.join("")}</>; }`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText)({ createElement, Fragment }, Section, AdminFormGrid, AdminFormField, Link, styles.adminFormFieldClassName, defaults.linkDefaultFromContainer) as (config: unknown) => ReactNode;
  const html = renderToStaticMarkup(createElement("form", { dir: "rtl" }, renderPanels({ primaryCta: { label: "إجراء أول", href: "https://example.com/one" }, secondaryCta: { label: "إجراء ثان", href: "https://example.com/two" } })));
  const rendered = pageCompositionAst(`<main>${html}</main>`);
  assert.equal(rendered.owned("header").filter(node => rendered.attr(node, "data-admin-tab-section-presentation") === '"premium"').length, 2);
  for (const [prefix, label] of [["primary_cta", "إجراء أول"], ["secondary_cta", "إجراء ثان"]]) {
    const input = rendered.owned("input").find(node => rendered.attr(node, "name") === `"${prefix}_label"`)!;
    assert.equal(rendered.attr(input, "value"), `"${label}"`);
    assert.ok(rendered.owned("label").some(node => rendered.attr(node, "data-admin-form-field") !== undefined && rendered.inside(input, node.parent)));
    const names = fields.adminLinkHiddenInputNames(prefix);
    for (const name of Object.values(names)) assert.equal(rendered.owned("input").filter(node => rendered.attr(node, "name") === `"${name}"`).length, 1);
  }
  assert.ok(html.includes("data-admin-form-label-text") && html.includes("ps-3") && !html.includes('class="sr-only">نص زر'));
  check("Actual CTA descendant JSX renders two canonical Charcoal Panels with visible shared labels and unchanged native button/link tuples", true);
  const values = [serialize.emptyAdminLink(), { ...serialize.emptyAdminLink(), link_kind: "external", href: "https://example.com/video", target: "_blank" }, { ...serialize.emptyAdminLink(), link_kind: "static_route", href: "/about", anchor: "team", meta: { route_key: "about" } }] as Parameters<typeof Link>[0]["defaultValue"][];
  for (const value of values) for (const presentation of ["card", "inline"] as const) for (const actionPresentation of ["default", "bare"] as const) {
    const html = renderToStaticMarkup(createElement(Link, { prefix: "original_link", label: "الرابط", helperText: "إرشاد محفوظ", defaultValue: value, showAnchor: true, presentation, actionPresentation }));
    const dom = pageCompositionAst(`<main>${html}</main>`), names = fields.adminLinkHiddenInputNames("original_link"), serialized = serialize.serializeAdminLink(value!);
    const expected = [serialized?.link_kind ?? "none", serialized?.linked_type ?? "", serialized?.linked_id ?? "", serialized?.href ?? "", serialized?.anchor ?? "", serialized?.target ?? "_self", serialized?.meta?.route_key ?? ""];
    Object.values(names).forEach((name, index) => { const input = dom.owned("input").find(node => dom.attr(node, "name") === `"${name}"`)!; assert.ok(input); assert.equal(dom.attr(input, "value"), `"${String(expected[index])}"`); });
    assert.ok(html.includes(styles.adminFormHintClassName({ textInset: true })) && html.includes("data-admin-form-label-text"));
  }
  const controlledTree = Link({ prefix: "controlled_link", label: "رابط محكوم", controlledValue: values[2], showAnchor: true, onControlledChange: next => accepted.push(next) });
  const elements: React.ReactElement<{ children?: ReactNode; onChange?: unknown }>[] = [];
  const visit = (node: ReactNode) => { Children.forEach(node, child => { if (isValidElement<{ children?: ReactNode }>(child)) { elements.push(child); visit(child.props.children); } }); };
  visit(controlledTree);
  const buttons = elements.filter(node => node.type === Button) as React.ReactElement<React.ComponentProps<typeof Button>>[];
  buttons[0]!.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
  buttons[1]!.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
  assert.deepEqual(stateChanges.at(-1), true, "Choose opens the existing picker");
  assert.deepEqual(accepted.at(-1), serialize.emptyAdminLink(), "Clear stays at the existing controlled owner");
  const anchor = elements.find(node => node.type === "input" && "onChange" in node.props) as React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
  anchor.props.onChange?.({ target: { value: " #contact " } } as React.ChangeEvent<HTMLInputElement>);
  assert.deepEqual(accepted.at(-1), { ...values[2], anchor: "contact" }, "Anchor retains normalization and exact existing link state");
  check("Shared Link label/hint unification preserves card/inline/bare/default native serialization, picker, clear and controlled Anchor callbacks", true);
}

async function verifyBlockFamilyPresentation() {
  await verifyBlockReviewNestedPresentation();
  const [{ PAGE_MODULE_KINDS: kinds }, form, runtime, card, action, headers, styles, switches, metadata, utils, contract, formContract] = await Promise.all([
    jiti.import<typeof import("../src/lib/page-blocks/types.ts")>("../src/lib/page-blocks/types.ts"),
    jiti.import<typeof import("../src/components/admin/ui/AdminForm.tsx")>("../src/components/admin/ui/AdminForm.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminFormRuntime.tsx")>("../src/components/admin/ui/AdminFormRuntime.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminCard.tsx")>("../src/components/admin/ui/AdminCard.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminActionButton.tsx")>("../src/components/admin/ui/AdminActionButton.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminModuleTabs.tsx")>("../src/components/admin/ui/AdminModuleTabs.tsx"),
    jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
    jiti.import<typeof import("../src/components/admin/ui/AdminFormSwitch.tsx")>("../src/components/admin/ui/AdminFormSwitch.tsx"),
    jiti.import<typeof import("../src/lib/page-composition/slot-module-registry.ts")>("../src/lib/page-composition/slot-module-registry.ts"),
    jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>("../src/lib/page-blocks/admin-utils.ts"),
    jiti.import<typeof import("../src/lib/page-blocks/module-editor-presentation-contract.ts")>("../src/lib/page-blocks/module-editor-presentation-contract.ts"),
    jiti.import<typeof import("../src/lib/admin/form-runtime.ts")>("../src/lib/admin/form-runtime.ts"),
  ]);
  const consumers = kinds.map(kind => {
    const route = `src/app/admin/pages-blocks/blocks/${kind}/[id]/page.tsx`, ast = pageCompositionAst(read(route));
    const binding = ast.tree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) &&
      Boolean(node.importClause?.name && /(?:ModuleEditClient|HeroEditClient)$/u.test(node.importClause.name.text)));
    assert.ok(binding && ts.isStringLiteral(binding.moduleSpecifier), `Registered ${kind} route retains its actual editor owner`);
    return { kind, source: readFileSync(resolve(ROOT, dirname(route), binding.moduleSpecifier.text + ".tsx"), "utf8") };
  });
  assert.equal(form.ADMIN_FORM_STACK_CLASS_NAME, "space-y-5", "Visible stacks retain the canonical20px token");
  const missing = consumers.filter(row => !hasBlockEditorPresentation(row.source)).map(row => row.kind);
  check(`Every registered Block family uses unified-default Identity/Tabs/Save inside a real visible20px stack and its existing native form/Pending owner (${missing.join(",") || "all"})`, missing.length === 0);
  check("Family negatives reject ineffective form-only spacing, obsolete presentation overrides and nested actions", consumers.every(({ source }) =>
    !hasBlockEditorPresentation(source.replaceAll("ADMIN_FORM_STACK_CLASS_NAME", "lostStack")) &&
    !hasBlockEditorPresentation(source.replace(/(<ModuleEditorSaveArea\b)/u, '$1 presentation="default"')) &&
    !hasBlockEditorPresentation(source.replace(/(<ModuleEditorSaveArea\b[^>]*\/>)/u, '<AdminCard>$1</AdminCard>'))));
  const source = read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx"), ast = pageCompositionAst(source);
  let executable = source;
  for (const node of ast.tree.statements.filter(ts.isImportDeclaration).reverse()) executable = executable.slice(0, node.getStart(ast.tree)) + executable.slice(node.end);
  let pending = false;
  const params = new URLSearchParams("returnPageId=2&return_to=%2Fadmin%2Fpages-blocks%2Fpages&tab=content");
  const dependencies = { React: { createElement, Fragment }, Children, useState, useCallback,
    useFormStatus: () => ({ pending }), useSearchParams: () => params,
    ...form, AdminFormGrid: runtime.AdminFormGrid, AdminFormGridItem: runtime.AdminFormGridItem,
    AdminCard: card.default, AdminActionButton: action.default, AdminFormSwitch: switches.default,
    AdminModuleTabs: headers.default, AdminModuleSectionHeader: headers.AdminModuleSectionHeader, AdminModuleTabIcon: headers.AdminModuleTabIcon,
    ...metadata, ...utils, ...contract, resolveAdminFormReturnPath: formContract.resolveAdminFormReturnPath,
    ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME: styles.ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME };
  const exported = {} as typeof import("../src/components/admin/page-blocks/ModuleEditorPresentation.tsx");
  const compile = ts.transpileModule(executable, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("exports", ...Object.keys(dependencies), compile)(exported, ...Object.values(dependencies));
  const renderSave = () => renderToStaticMarkup(createElement("form", { id: "existing-owner" }, createElement(exported.ModuleEditorSaveArea, { saveLabel: "حفظ اختبار" })));
  const canonical = renderSave();
  const dom = pageCompositionAst("<main>" + canonical + "</main>"), save = dom.owned("button");
  assert.equal(dom.owned("form").length, 1); assert.equal(save.length, 1);
  assert.equal(dom.attr(save[0]!, "type"), '"submit"'); assert.ok(dom.inside(save[0]!, dom.owned("form")[0]!.parent));
  assert.ok(canonical.includes("إجراءات النموذج") && canonical.includes("data-admin-form-control-header") && canonical.includes("حفظ اختبار") && canonical.includes("data-admin-action-presentation"));
  assert.ok(!canonical.includes("حفظ الموديول") && !canonical.includes("mt-8"));
  for (const [name, value] of [[utils.MODULE_EDITOR_RETURN_PAGE_FORM_FIELD, "2"], ["return_to", "/admin/pages-blocks/pages"]]) assert.ok(canonical.includes(`name="${name}"`) && canonical.includes(`value="${value}"`));
  pending = true; const busy = renderSave(); assert.ok(/<button[^>]*disabled=""/u.test(busy) && busy.includes("جارٍ الحفظ...")); pending = false;
  check("Actual SaveArea defaults to canonical icon/title/actions and preserves native submit/form, return context and Pending", true);
  const panelIdentity = renderToStaticMarkup(createElement(exported.ModuleEditorIdentitySection, { name: "اسم محفوظ", status: "published", inputClassName: "native-control" }));
  assert.ok(panelIdentity.includes('name="name"') && panelIdentity.includes('value="اسم محفوظ"') && panelIdentity.includes("required=") && panelIdentity.includes("data-admin-form-label-text") && panelIdentity.includes("ps-3"));
  const panelTabs = renderToStaticMarkup(createElement(exported.ModuleEditorTabs, { moduleKind: "hero", tabs: [{ id: "content", sectionHeaderPresentation: "control", content: createElement("input", { name: "original_field", defaultValue: "original_value" }) }] }));
  assert.ok(panelTabs.includes('data-admin-tab-section-presentation="premium"') && panelTabs.includes("--admin-section-header-surface") && panelTabs.includes('name="original_field"') && panelTabs.includes('value="original_value"') && panelTabs.includes(`name="${utils.MODULE_EDITOR_TAB_FORM_FIELD}"`));
  const tabDom = pageCompositionAst("<main>" + panelTabs + "</main>");
  const tabHeaders = tabDom.owned("header").filter(node => tabDom.attr(node, "data-admin-tab-section-heading") !== undefined);
  assert.equal(tabHeaders.length, 1, "Premium tab has one actual heading, with no duplicate outer Header");
  const panel = tabHeaders[0]!.parent.parent;
  assert.ok(ts.isJsxElement(panel) && panel.openingElement.tagName.getText(tabDom.tree) === "section", "Premium Header belongs directly to its shared Panel");
  assert.ok(tabDom.owned("input").some(node => tabDom.attr(node, "name") === '"original_field"' && tabDom.inside(node, panel)), "Original tab body stays inside the same Panel");
  check("Actual Identity and Tabs default to canonical label/Charcoal DOM and preserve native values/required markers and tab context", true);
  const heroControls = await jiti.import<typeof import("../src/lib/hero/hero-content-controls.ts")>("../src/lib/hero/hero-content-controls.ts");
  const orderSource = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor.tsx"), orderAst = pageCompositionAst(orderSource);
  let orderExecutable = orderSource;
  for (const node of orderAst.tree.statements.filter(ts.isImportDeclaration).reverse()) orderExecutable = orderExecutable.slice(0, node.getStart(orderAst.tree)) + orderExecutable.slice(node.end);
  const orderDependencies = { ...dependencies, ...heroControls, ModuleEditorRepeaterCard: exported.ModuleEditorRepeaterCard, ModuleEditorRepeaterGrid: exported.ModuleEditorRepeaterGrid, adminFormHintClassName: styles.adminFormHintClassName };
  const orderExported = {} as typeof import("../src/app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor.tsx");
  new Function("exports", ...Object.keys(orderDependencies), ts.transpileModule(orderExecutable, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(orderExported, ...Object.values(orderDependencies));
  const authoredOrder = [...heroControls.DEFAULT_HERO_ELEMENT_ORDER].reverse();
  const canonicalOrder = pageCompositionAst("<main>" + renderToStaticMarkup(createElement(orderExported.default, { defaultOrder: authoredOrder })) + "</main>");
  assert.equal(canonicalOrder.owned("input").length, 1);
  assert.equal(canonicalOrder.attr(canonicalOrder.owned("input")[0]!, "name"), '"hero_element_order"');
  assert.equal(canonicalOrder.attr(canonicalOrder.owned("input")[0]!, "value"), '"' + JSON.stringify(authoredOrder).replaceAll('"', "&quot;") + '"');
  const moves = canonicalOrder.owned("button");
  assert.equal(moves.length, heroControls.DEFAULT_HERO_ELEMENT_ORDER.length * 2);
  assert.ok(moves.every(node => canonicalOrder.attr(node, "type") === '"button"' && canonicalOrder.attr(node, "aria-label")));
  assert.equal(moves.filter(node => node.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(canonicalOrder.tree) === "disabled")).length, 2);
  check("Actual Hero order defaults to canonical presentation with the exact authored native payload, accessible non-submit actions and both boundary disables", true);
  const cardsSource = read("src/components/admin/page-blocks/editors/AdminCardsItemsField.tsx"), breadcrumbSource = read("src/components/admin/page-blocks/editors/BreadcrumbManualItemsField.tsx");
  const cardLabels = (text: string) => {
    const ast = pageCompositionAst(text), labels = ast.owned("label");
    return labels.length === 3 && ast.canonical("adminFormLabelClassName", "/admin-ui-styles") && labels.every(label =>
      ast.attr(label, "className")?.replace(/\s+/gu, "") === '{adminFormLabelClassName({textInset:true})}' &&
      ast.owned("span").some(span => ast.inside(span, label.parent) && ast.attr(span, "data-admin-form-label-text") === '""'));
  };
  const breadcrumbLabel = (text: string) => {
    const ast = pageCompositionAst(text), fields = ast.owned("AdminFormField");
    return ast.canonical("AdminFormField", "/ui") && fields.length === 1 &&
      ast.owned("input").some(input => ast.inside(input, fields[0]!.parent) && ast.attr(input, "name") === '{`manual_item_${index}_label`}' && ast.attr(input, "value") === '{item.label ?? ""}' && ast.attr(input, "onChange") === '{(event) => updateLabel(index, event.target.value)}');
  };
  check("Registered Cards/Breadcrumb descendants keep native label bindings and unified inset/typography; negatives reject lost title-only adoption", cardLabels(cardsSource) && breadcrumbLabel(breadcrumbSource) &&
    !cardLabels(cardsSource.replace("textInset: true", "textInset: false")) && !cardLabels(cardsSource.replaceAll('data-admin-form-label-text=""', 'data-lost-label-text=""')) &&
    !breadcrumbLabel(breadcrumbSource.replace('AdminFormField', 'LostFormField')) && !breadcrumbLabel(breadcrumbSource.replace('manual_item_${index}_label', 'manual_item_${index}_lost')));
  const [{ default: Select }, { default: Checkbox }] = await Promise.all([
    jiti.import<typeof import("../src/components/admin/ui/AdminFormListboxSelect.tsx")>("../src/components/admin/ui/AdminFormListboxSelect.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminCheckbox.tsx")>("../src/components/admin/ui/AdminCheckbox.tsx"),
  ]);
  const input = createElement("input", { name: "row_title", defaultValue: "unchanged", required: true, className: styles.adminFormFieldClassName() });
  const fieldProps = { label: "عنوان الحقل", required: true, hint: "إرشاد الحقل", children: input };
  const field = renderToStaticMarkup(createElement(form.AdminFormField, fieldProps));
  for (const presentation of ["default", "panel"] as const) assert.equal(renderToStaticMarkup(createElement(form.AdminFormField, { ...fieldProps, presentation })), field);
  const selectProps = { id: "row-select", name: "row_select", label: "اختيار الحقل", hint: "إرشاد الاختيار", defaultValue: "saved", options: [{ value: "saved", label: "محفوظ" }], sizing: "full" as const, required: true };
  const select = renderToStaticMarkup(createElement(Select, selectProps));
  for (const presentation of ["default", "panel"] as const) assert.equal(renderToStaticMarkup(createElement(Select, { ...selectProps, presentation })), select);
  const choiceFieldProps = { key: "checkbox", label: "خيارات الحقل", children: createElement("span", { className: "flex min-h-11 items-center" }, createElement(Checkbox, { label: "خيار محفوظ", name: "row_choice", value: "saved-choice", defaultChecked: true })) };
  const mixedGridProps = { columns: 4 as const, presentation: "aligned-fields" as const, children: [
    createElement(form.AdminFormField, { ...fieldProps, key: "input" }),
    createElement(Select, { ...selectProps, key: "select" }),
    createElement(switches.default, { key: "switch", name: "row_visible", label: "الظهور", defaultChecked: true, value: "true", uncheckedValue: "false" }),
    createElement(form.AdminFormField, choiceFieldProps),
  ] };
  const mixed = renderToStaticMarkup(createElement("form", { dir: "rtl" }, createElement(runtime.AdminFormGrid, mixedGridProps)));
  assert.ok(mixed.includes('data-admin-form-grid="aligned-fields"') && mixed.includes("grid-rows-subgrid") && mixed.includes('dir="rtl"'));
  assert.equal((mixed.match(/data-admin-form-field-control=""/gu) ?? []).length, 3);
  assert.ok(mixed.includes('name="row_title"') && mixed.includes('value="unchanged"') && mixed.includes('required=""'));
  assert.ok(mixed.includes('name="row_select"') && mixed.includes('value="saved" selected=""') && mixed.includes('aria-labelledby="row-select-label"'));
  assert.ok(mixed.includes('data-admin-form-switch-surface="card"') && mixed.includes('role="switch"') && mixed.includes('name="row_visible" value="false"') && mixed.includes('name="row_visible"') && mixed.includes('checked=""'));
  assert.ok(mixed.includes('name="row_choice"') && mixed.includes('value="saved-choice"') && mixed.includes('aria-label="خيار محفوظ"'));
  assert.ok(styles.adminFormFieldClassName().includes("min-h-11") && styles.adminFormFieldClassName().includes("py-2.5") && !styles.adminFormFieldClassName().includes("py-3 "));
  const gridSource = read("src/components/admin/ui/AdminFormRuntime.tsx");
  assert.ok(hasAlignedFieldAndSwitchSlots(gridSource));
  assert.ok(ast.owned("AdminFormGrid").some(node => ast.attr(node, "presentation") === '"aligned-fields"'), "Identity consumes the existing aligned-fields owner rather than fixed private columns");
  check("Standard17 mixed Input/Select/Switch/Checkbox uses shared field/control slots,44px native cadence and RTL alignment while preserving names/values/required/unchecked payloads", true);
}

async function verifyCompactInlineDefaults() {
    const sourceFile = "src/components/admin/page-blocks/ModuleEditorPresentation.tsx";
    const tree = ts.createSourceFile(sourceFile, read(sourceFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const row = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ModuleEditorVisibilityAlignRow");
    assert.ok(row && !read(sourceFile).includes("MODULE_EDITOR_CONTROL_CARD_CLASS_NAME"));
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
      assert.equal(sourceAttribute(element.openingElement, "presentation"), undefined);
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
      const isPremiumRow = (node: ts.JsxElement) => canonical(node) === "ModuleEditorVisibilityAlignRow" && !node.openingElement.attributes.properties.some(attribute =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(consumer) === "presentation");
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
    const compiled = ts.transpileModule(row.getText(tree), {
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
      const html = renderToStaticMarkup(createElement(Row, actual));
      inspect(html, expected);
      assert.deepEqual(native(html), [
        { name: "show_compact", value: "false", type: "hidden" },
        { name: "compact_alignment", value: "left", type: "hidden" },
        ...("preserveUnsetBold" in changes && changes.preserveUnsetBold && "boldDefault" in changes && changes.boldDefault === undefined ? [] : [{ name: "compact_bold", value: "true", type: "hidden" }]),
        ...(expected.child === "none" ? [] : expected.child === "native" ? [{ name: "compact_text", value: "نص أصلي", type: undefined }] : []),
      ], "Unified presentation preserves the original named native payload, disabled-control fallbacks and unset Bold omission");
      assert.ok(html.includes("وصف محفوظ"));
      return { html, expected };
    });
    const visibilityProps = { label: "الصورة", showName: "show_image", showDefault: true, controlMode: "visibility-only" } as const;
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
      ["reserved input spacer", html.replace(body, body.replace(/<div\b[^>]*>/u, 'async function verifyUnifiedSectionHeaderDefaults() {<span aria-hidden="true"></span>'))],
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
}

async function verifyUnifiedSectionHeaderDefaults() {
  const [styles, { AdminDataGridActionIcon }] = await Promise.all([
    jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
    jiti.import<typeof import("../src/components/admin/ui/AdminDataGrid.tsx")>("../src/components/admin/ui/AdminDataGrid.tsx"),
  ]);
  const source = read("src/components/admin/ui/AdminModuleTabs.tsx");
  const compile = (input: string, tokenOverrides: Record<string, string> = {}) => {
    const tree = ts.createSourceFile("AdminModuleTabs.tsx", input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = ["AdminFormControlHeader", "AdminModuleTabIcon", "AdminModuleSectionHeader"];
    const declarations = names.map(name => {
      const node = tree.statements.find((entry): entry is ts.FunctionDeclaration => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
      assert.ok(node, `${name} resolves to its existing canonical owner`);
      return node.getText(tree);
    });
    const headerNode = tree.statements.find((entry): entry is ts.FunctionDeclaration => ts.isFunctionDeclaration(entry) && entry.name?.text === "AdminModuleSectionHeader");
    assert.ok(headerNode?.getText(tree).includes("standalone?: boolean"), "Structural geometry stays an optional existing port");
    assert.ok(!headerNode?.body?.statements.some(node => ts.isIfStatement(node) && node.expression.getText(tree).includes("sectionHeaderPresentation")), "Aliases cannot choose a parallel visual Header branch");
    const dependencies = { React: { createElement, Fragment }, ...styles, ...tokenOverrides, AdminDataGridActionIcon };
    const exports = {} as typeof import("../src/components/admin/ui/AdminModuleTabs.tsx");
    new Function("exports", ...Object.keys(dependencies), ts.transpileModule(declarations.join("\n"), {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText)(exports, ...Object.values(dependencies));
    return exports;
  };
  const summary = createElement("div", { "data-original-summary": "" },
    ...Array.from({ length: 6 }, (_, index) => createElement("span", { key: index, "data-original-counter": index }, String(index))),
    createElement("input", { name: "original-summary-field", defaultValue: "same-value" }),
    createElement("button", { type: "button", onClick: () => undefined }, "Original summary action"));
  const verify = (input: string, overrides: Record<string, string> = {}) => {
    const { AdminModuleSectionHeader: Header } = compile(input, overrides);
    for (const presentation of [undefined, "default", "control", "panel", "premium"] as const) {
      for (const standalone of [undefined, false, true]) for (const extra of [undefined, "existing-composition-class"]) {
        const props = { id: "original-section", sectionHeading: "Section title", sectionDescription: "Section description", sectionSummary: summary, sectionHeaderClassName: extra, sectionHeaderPresentation: presentation, icon: "content" as const, standalone };
        const result = Header(props);
        assert.ok(isValidElement<{ className: string; children?: ReactNode; dir?: string; "data-admin-tab-section-heading": string; "data-admin-tab-section-presentation": string }>(result));
        const isolated = standalone ?? !(presentation === "premium" || presentation === "panel");
        const expected = `${isolated ? `relative ${styles.ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME} ${styles.ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME}` : styles.ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME} ${extra ?? styles.ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}`.trim();
        assert.equal(result.type, "header"); assert.equal(result.props.className, expected);
        assert.equal(result.props.dir, "rtl"); assert.equal(result.props["data-admin-tab-section-heading"], props.id);
        assert.equal(result.props["data-admin-tab-section-presentation"], "premium");
        const children = Children.toArray(result.props.children);
        assert.equal(children.length, 3, "Exactly one decorative accent, identity and original summary are mounted");
        const accent = children[0], mountedSummary = children[2];
        assert.ok(isValidElement<{ className: string; "aria-hidden": string; "data-admin-tab-section-accent": string }>(accent));
        assert.equal(accent.type, "span"); assert.equal(accent.props.className, styles.ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME);
        assert.equal(accent.props["aria-hidden"], "true"); assert.equal(accent.props["data-admin-tab-section-accent"], "premium");
        assert.ok(isValidElement<{ children: ReactNode; className: string }>(mountedSummary));
        assert.equal(mountedSummary.props.children, summary, "The Header preserves the exact native summary children and callback-bearing button");
        assert.equal(mountedSummary.props.className, "flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 sm:ms-auto sm:w-auto");
        const html = renderToStaticMarkup(result);
        assert.equal((html.match(/<header\b/gu) ?? []).length, 1); assert.equal((html.match(/data-admin-form-control-header=""/gu) ?? []).length, 1);
        assert.equal((html.match(/role="heading" aria-level="2"/gu) ?? []).length, 1);
        assert.equal((html.match(/<h[1-6]\b/gu) ?? []).length, 0);
        assert.ok(html.includes('data-admin-form-control-presentation="leading-icon"') && html.includes("size-10") && html.includes("size-5"));
        assert.ok(html.includes('class="text-sm font-semibold text-white"><span role="heading" aria-level="2">Section title</span></span>'));
        assert.ok(html.includes('class="text-xs leading-5 text-white/55">Section description</span>'));
        assert.ok(html.includes(renderToStaticMarkup(summary))); assert.equal((html.match(/data-original-counter=/gu) ?? []).length, 6);
        assert.equal((html.match(/<svg\b/gu) ?? []).length, 1);
        assert.equal(html.includes("sm:max-w-[46%]"), false); assert.equal(html.includes("flex-nowrap"), false);
      }
      for (const sectionHeading of [undefined, ""]) assert.equal(Header({ id: "empty", sectionHeading, sectionSummary: summary, sectionHeaderPresentation: presentation }), null);
    }
  };
  verify(source);
  const rejects = (probe: () => void) => { try { probe(); return false; } catch { return true; } };
  for (const [original, replacement] of [
    ['dir="rtl"', 'dir="ltr"'],
    ['aria-hidden="true" data-admin-tab-section-accent', 'aria-hidden="false" data-admin-tab-section-accent'],
    ["{tab.sectionSummary}", "{null}"],
    ["max-w-full flex-wrap items-center gap-2", "max-w-full flex-nowrap items-center gap-2"],
    ["standalone?: boolean", "standalone: boolean"],
    ['standalone = tab.standalone ?? !(tab.sectionHeaderPresentation === "premium" || tab.sectionHeaderPresentation === "panel")', 'standalone = false'],
    ['presentation="leading-icon"', 'presentation="default"'],
    ['title={<span role="heading" aria-level={2}>', 'title={<span role="heading" aria-level={3}>'],
    ["description={tab.sectionDescription}", "description={null}"],
    ['icon={<AdminModuleTabIcon name={tab.icon ?? "section"} />}', "icon={null}"],
  ]) {
    const mutant = source.replace(original, replacement);
    assert.notEqual(mutant, source, "Each negative probe changes its intended owner binding");
    assert.ok(rejects(() => verify(mutant)), "Unified defaults reject lost direction, accessibility, summary, responsive flow, geometry and identity");
  }
  for (const [name, original, replacement] of [
    ["ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME", styles.ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME, styles.ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME.replace("right-2", "left-2")],
    ["ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME", styles.ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME, styles.ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME.replace("-mx-3 -mt-3", "mx-0 mt-0")],
  ]) {
    assert.notEqual(original, replacement); assert.ok(rejects(() => verify(source, { [name]: replacement })), "Canonical token-owner regressions fail without parallel local Header classes");
  }
  assert.ok(read("src/components/admin/ui/AdminForm.tsx").includes('export { AdminFormControlHeader } from "./AdminModuleTabs";'), "Existing imports retain the public ControlHeader binding after cycle-free owner consolidation");
  return true;
}

function hasPageSeoComposition(source:string) {
  const ast=pageCompositionAst(source),{attr,owned,children,inside,normal}=ast,forms=owned("form"),pending=owned("AdminFormPendingFields"),panels=owned("AdminEntitySeoPanel"),bars=owned("AdminStickyFormBar");
  if(forms.length!==1||pending.length!==1||panels.length!==1||bars.length!==1||attr(forms[0]!,"action")!=="{savePageSeoAction}"||attr(panels[0]!,"presentation")!=='"panel"'||!ast.canonical("AdminEntitySeoPanel","/components/admin/seo/AdminEntitySeoPanel")||!ast.canonical("AdminStickyFormBar","/components/admin/ui/AdminForm")||source.includes("<AdminFormRuntime"))return false;
  const bar=bars[0]!,stack=bar.parent.parent;if(!ts.isJsxElement(stack)||stack.openingElement.tagName.getText(ast.tree)!=="div"||attr(stack.openingElement,"className")!=="{ADMIN_FORM_STACK_CLASS_NAME}"||!ts.isJsxOpeningElement(pending[0]!)||stack.parent!==pending[0]!.parent||pending[0]!.parent.parent!==forms[0]!.parent)return false;
  const body=children(stack);if(body.length!==2||body[0]!==panels[0]||body[1]!==bar.parent||attr(bar,"title")!=='"إجراءات النموذج"'||!attr(bar,"icon")?.includes('name="content"'))return false;
  const hidden=owned("input").filter(node=>attr(node,"type")==='"hidden"'),expected=new Map([["page_id","{props.pageId}"],["redirect_to",null],["page_title","{props.pageTitle}"],["page_description",'""'],["page_content","{props.content}"],["page_slug","{publicSlug}"],["page_image",'""'],["page_image_alt",'""']]);
  if(hidden.length!==expected.size||!hidden.every(node=>inside(node,pending[0]!.parent))||![...expected].every(([name,value])=>hidden.some(node=>attr(node,"name")===JSON.stringify(name)&&(value===null?attr(node,"value")?.includes("adminFormEditHref("):attr(node,"value")===value))))return false;
  const buttons=owned("AdminActionButton");return buttons.length===1&&inside(buttons[0]!,bar.parent)&&attr(buttons[0]!,"type")==='"submit"'&&normal.includes('navigationEventName="admin-page-blocks-navigation"')&&normal.includes('page-seo:')&&normal.includes('fieldNames={ENTITY_SEO_FIELD_NAMESsatisfiesAdminEntitySeoFieldNames}')&&normal.includes('fieldIds={PAGE_SEO_FIELD_IDS}');
}

function hasPageAssignmentComposition(source:string) {
  const ast=pageCompositionAst(source),{attr,owned,inside,normal}=ast,forms=owned("form"),pending=owned("AdminFormPendingFields"),primary=owned("AdminModalPrimaryButton"),cancel=owned("AdminModalCancelButton").filter(node=>attr(node,"onClick")==="{onClose}"),modals=owned("VenesiaModal");
  if(forms.length!==1||pending.length!==1||primary.length!==1||cancel.length!==1||modals.length!==1||attr(forms[0]!,"id")!=='"assign-page-block-form"'||attr(pending[0]!,"pending")!=="{assignPending}"||pending[0]!.parent.parent!==forms[0]!.parent||!ast.canonical("AdminFormPendingFields","/components/admin/ui/AdminFormRuntime")||source.includes("<AdminFormRuntime")||source.includes('presentation="leading-icon"'))return false;
  const action=attr(forms[0]!,"action")?.replace(/\s+/gu,"");if(action!=='{assignModuleKind==="hero"?assignHeroAction:assignModuleKind==="media-sidebar"?assignMediaSidebarAction:assignModuleKind==="media-hub"?assignMediaHubAction:assignBlockAction}'||attr(primary[0]!,"form")!=='"assign-page-block-form"'||attr(primary[0]!,"type")!=='"submit"'||attr(primary[0]!,"disabled")?.replace(/\s+/gu,"")!=="{templatesLoading||Boolean(templatesError)||!assignableTemplates.length||!slotOptions.length||assignPending}"||attr(cancel[0]!,"onClick")!=="{onClose}"||attr(modals[0]!,"onClose")!=="{onClose}")return false;
  const pendingBody=ast.children(pending[0]!.parent as ts.JsxElement);if(pendingBody.length!==1||!ts.isJsxElement(pendingBody[0]!)||pendingBody[0]!.openingElement.tagName.getText(ast.tree)!=="div"||attr(pendingBody[0]!.openingElement,"className")!=="{ADMIN_FORM_STACK_CLASS_NAME}"||!owned("AdminFormListboxSelect").every(node=>attr(node,"presentation")==='"panel"'&&inside(node,pending[0]!.parent))||!owned("input").every(node=>attr(node,"type")==='"hidden"'||inside(node,pending[0]!.parent)))return false;
  return ['name="page_id"value={pageId}','name="block_type"value={assignModuleKind}','name="is_visible"value={assignVisible?"true":"false"}','name="sort_order"value="0"','name="sort_order"type="number"min={0}step={10}','ariaLabelledBy="assign-module-kind-label"','onChange={(event)=>onAssignVisibleChange(event.target.checked)}'].every(value=>normal.includes(value))&&ast.inset("adminFormLabelClassName")&&ast.inset("adminFormHintClassName")&&ast.nestedLabels();
}

function hasPageLayoutComposition(source:string) {
  const ast=pageCompositionAst(source),{attr,owned,inside,normal}=ast,pending=owned("AdminFormPendingFields"),panels=owned("AdminFormSection"),bars=owned("AdminStickyFormBar");
  if(pending.length!==1||attr(pending[0]!,"pending")!=="{isPending}"||panels.length!==2||!panels.every(node=>attr(node,"presentation")==='"panel"'&&attr(node,"header")?.includes("<AdminModuleSectionHeader"))||bars.length!==1||source.includes("<AdminFormRuntime")||source.includes("<AdminFormActions"))return false;
  const headers=owned("AdminModuleSectionHeader");if(headers.length!==2||!["page-layout-selection","page-layout-editor"].every(id=>headers.some(node=>attr(node,"id")===JSON.stringify(id)&&attr(node,"sectionHeaderPresentation")==='"premium"'&&attr(node,"sectionHeaderClassName")==="{ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}")))return false;
  const stack=pending[0]!.parent; if(!ts.isJsxElement(stack)||!ast.children(stack).some(node=>ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast.tree)==="div"&&attr(node.openingElement,"className")==="{ADMIN_FORM_STACK_CLASS_NAME}"))return false;
  const save=owned("AdminActionButton").filter(node=>attr(node,"onClick")==="{handleSaveLayout}"),select=owned("AdminActionButton").filter(node=>attr(node,"onClick")==="{handleSelectLayout}"),bar=bars[0]!;
  if(save.length!==1||select.length!==1||attr(save[0]!,"type")!=='"button"'||attr(select[0]!,"type")!=='"button"'||!inside(save[0]!,bar.parent)||panels.some(node=>inside(bar,node.parent))||!panels.some(node=>inside(select[0]!,node.parent))||!inside(bar,pending[0]!.parent)||attr(bar,"title")!=='"إجراءات النموذج"'||!attr(bar,"icon")?.includes('name="content"'))return false;
  return owned("AdminFormField").length===4&&owned("AdminFormField").every(node=>attr(node,"presentation")==='"panel"'&&!attr(node,"label")?.includes("<AdminFormControlHeader"))&&owned("AdminFormListboxSelect").length===2&&owned("AdminFormListboxSelect").every(node=>attr(node,"presentation")==='"panel"'&&!attr(node,"label")?.includes("<AdminFormControlHeader"))&&normal.includes('disabled={isPending||!layoutKey.trim()||!adminLabel.trim()||regions.length===0}')&&normal.includes('disabled={isPending||assignmentLayoutId===String(currentLayoutId)}')&&normal.includes('!legacyProtected?(')&&ast.inset("adminFormLabelClassName")&&ast.nestedLabels()&&normal.includes('selectPageLayout(pageId,layoutId)')&&normal.includes('savePageLayout({');
}

function hasPageVisualMapComposition(source: string) {
  const ast = pageCompositionAst(source);
  const grids = ast.owned("AdminFormGrid"), sections = ast.owned("AdminFormSection");
  const headers = ast.owned("AdminModuleSectionHeader"), layouts = ast.owned("AdminFormLayout");
  const calls: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) calls.push(node.expression.getText(ast.tree));
    ts.forEachChild(node, visit);
  };
  visit(ast.tree);
  const themeOwner = ast.canonical("resolveVenesiaThemeLayout", "/page-composition/venisia-theme-regions")
    && calls.includes("resolveVenesiaThemeLayout")
    || ast.canonical("VENISIA_THEME_CONTRACT", "/page-composition/venisia-theme-contract")
    && calls.includes("VENISIA_THEME_CONTRACT.resolveLayout");
  return themeOwner
    && grids.some(node => ast.attr(node, "columns") === "{1}" && ast.attr(node, "density") === '"sections"')
    && !grids.some(node => ast.attr(node, "columns") === "{5}")
    && layouts.length === 1 && ast.attr(layouts[0]!, "presentation") === '"panel"'
    && sections.length > 0 && sections.every(node => ast.attr(node, "presentation") === '"panel"')
    && headers.length === 1
    && ast.attr(headers[0]!, "sectionHeaderPresentation") === '"premium"'
    && ast.attr(headers[0]!, "sectionHeaderClassName") === "{ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}"
    && ast.attr(headers[0]!, "sectionSummary") === undefined
    && ast.owned("AdminCard").length > 0
    && ast.owned("AdminCard").every(node => ast.attr(node, "presentation") === '"premium"')
    && calls.includes("comparePageAssignmentOrder")
    && !calls.some(name => ["useState", "useReducer", "useTransition", "useAdminInstantMutation"].includes(name))
    && !ast.tree.statements.some(node => ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier) && /(?:^|\/)actions(?:\/|$)/u.test(node.moduleSpecifier.text));
}

async function verifyPageVisualMap() {
  const source = read("src/components/admin/page-blocks/PageVisualSlotMap.tsx");
  const client = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
  check("Map uses the existing Theme topology and Premium/Charcoal panel owners without region counters or a parallel state/mutation owner",
    hasPageVisualMapComposition(source));
  // Import each actual presentation owner directly. The production UI barrel also
  // exports unrelated server-action fields, which ordinary Node SSR cannot load.
  const [form, runtime, card, action, headers, styles, slots, adminUtils, registry, theme, nextLink] = await Promise.all([
    jiti.import<typeof import("../src/components/admin/ui/AdminForm.tsx")>("../src/components/admin/ui/AdminForm.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminFormRuntime.tsx")>("../src/components/admin/ui/AdminFormRuntime.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminCard.tsx")>("../src/components/admin/ui/AdminCard.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminActionButton.tsx")>("../src/components/admin/ui/AdminActionButton.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminModuleTabs.tsx")>("../src/components/admin/ui/AdminModuleTabs.tsx"),
    jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
    jiti.import<typeof import("../src/lib/page-blocks/layout-slots.ts")>("../src/lib/page-blocks/layout-slots.ts"),
    jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>("../src/lib/page-blocks/admin-utils.ts"),
    jiti.import<typeof import("../src/lib/page-composition/slot-module-registry.ts")>("../src/lib/page-composition/slot-module-registry.ts"),
    jiti.import<typeof import("../src/components/page-composition/venisia-theme-regions.ts")>("../src/components/page-composition/venisia-theme-regions.ts"),
    jiti.import<typeof import("next/link")>("next/link"),
  ]);
  const { comparePageAssignmentOrder: compare } = await jiti.import<typeof import("../src/lib/page-composition/page-assignment-contract.ts")>(
    "../src/lib/page-composition/page-assignment-contract.ts",
  );
  const dependencies = {
    React: { createElement, Fragment }, Link: nextLink.default,
    ADMIN_FORM_STACK_CLASS_NAME: form.ADMIN_FORM_STACK_CLASS_NAME,
    AdminFormLayout: form.AdminFormLayout, AdminFormSection: form.AdminFormSection,
    AdminFormGrid: runtime.AdminFormGrid, AdminCard: card.default, AdminActionButton: action.default,
    AdminModuleSectionHeader: headers.AdminModuleSectionHeader,
    ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME: styles.ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,
    adminFormHintClassName: styles.adminFormHintClassName,
    normalizeLayoutSlot: slots.normalizeLayoutSlot,
    moduleEditHref: adminUtils.moduleEditHref, moduleKindLabel: adminUtils.moduleKindLabel, normalizeBoolean: adminUtils.normalizeBoolean,
    comparePageAssignmentOrder: compare, getSlotCompatibilityLabel: registry.getSlotCompatibilityLabel,
    resolveVenesiaThemeLayout: theme.resolveVenesiaThemeLayout,
  };
  const mapAst = pageCompositionAst(source), imports = mapAst.tree.statements.filter(ts.isImportDeclaration);
  let executable = source;
  for (const statement of [...imports].reverse()) executable = executable.slice(0, statement.getStart(mapAst.tree)) + executable.slice(statement.end);
  const compiled = ts.transpileModule(executable, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { default?: typeof import("../src/components/admin/page-blocks/PageVisualSlotMap.tsx").default } = {};
  new Function("exports", ...Object.keys(dependencies), compiled)(exported, ...Object.values(dependencies));
  const MapComponent = exported.default!;
  assert.equal(typeof MapComponent, "function");
  type Row = import("../src/lib/page-blocks/types.ts").PageBlockAssignmentRow;
  type Props = Parameters<typeof MapComponent>[0];
  const region = (key: string, sortOrder: number) => ({ key, adminLabel: "منطقة " + key, sortOrder });
  const row = (id: number, slot: string, sortOrder: number, visible = true, moduleKind: Row["module_kind"] = "content"): Row => ({
    id, page_id: 42, template_id: id + 100, slot, sort_order: sortOrder,
    is_visible: visible, is_publicly_visible: visible, updated_at: "2026-10-25T00:00:00Z",
    module_kind: moduleKind, block_type: moduleKind === "hero" ? null : "content",
    template_name: "مقياس " + id, template_slug: "map-probe-" + id, template_status: "published",
    template_variant: "default", manages_assignment_on_page: true, assignment_note: null,
  });
  const moves: Array<{ rowId: number; target: number }> = [];
  const propsFor = (assignments: Row[], regions: Props["regions"], layoutKey: string, options: { disabled?: boolean; pendingId?: number } = {}): Props => ({
    assignments, regions, layoutKey, returnTo: "/admin/pages-blocks/pages",
    reorderDisabled: Boolean(options.disabled),
    getReorderPosition: current => {
      const siblings = current.module_kind === "hero" ? [current] : assignments.filter(candidate =>
        candidate.module_kind !== "hero" && candidate.slot === current.slot,
      ).sort((first, second) => compare(
        { sortOrder: first.sort_order, moduleKind: first.module_kind, assignmentId: first.id },
        { sortOrder: second.sort_order, moduleKind: second.module_kind, assignmentId: second.id },
      ));
      return { position: siblings.findIndex(candidate => candidate.id === current.id && candidate.module_kind === current.module_kind), count: siblings.length };
    },
    getRowInteraction: current => ({ isPending: current.id === options.pendingId, pendingAction: current.id === options.pendingId ? "reorder" : null }),
    onMoveTo: (current, target) => { moves.push({ rowId: current.id, target }); },
  });
  const render = (props: Props) => renderToStaticMarkup(createElement(MapComponent, props));
  const parse = (html: string) => {
    const ast = pageCompositionAst("<main>" + html + "</main>");
    const has = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.some(property =>
      ts.isJsxAttribute(property) && property.name.getText(ast.tree) === name);
    const value = (node: ts.JsxOpeningLikeElement, name: string) => {
      const text = ast.attr(node, name);
      return text && /^"/u.test(text) ? JSON.parse(text) as string : text;
    };
    const within = (outer: ts.Node, inner: ts.Node) => outer.pos <= inner.pos && inner.end <= outer.end;
    return { ...ast, has, value, within };
  };
  const regionIds = (html: string) => {
    const dom = parse(html);
    return dom.nodes.flatMap(node => {
      const id = dom.attr(node, "data-admin-tab-section-heading");
      return id && /^"page-map-/u.test(id) ? [JSON.parse(id) as string] : [];
    });
  };
  const customRegions = [region("north-gallery", 10), region("details", 20)];
  const custom = render(propsFor([row(1, "north-gallery", 0), row(2, "details", 0)], customRegions, "custom-layout"));
  assert.deepEqual(regionIds(custom), ["page-map-north-gallery", "page-map-details"]);
  assert.ok(!custom.includes("data-admin-form-layout="), "A custom Region stack does not acquire legacy columns");
  assert.ok(!custom.includes("page-map-main") && !custom.includes("page-map-sidebar") && !custom.includes("page-map-hero"));
  check("Custom layouts retain actual Region names/order without invented legacy regions", true);
  const rows = [row(12, "main", 20), row(20, "sidebar", 0, false), row(21, "sidebar", 10), row(22, "bottom", 0), row(10, "main", 0), row(30, "hero", 50), row(11, "main", 10, false), row(99, "hero", 100, true, "hero")];
  const legacyRegions = [region("main", 10), region("sidebar", 20), region("bottom", 30), region("footer", 40), region("hero", 50)];
  const props = propsFor(rows, legacyRegions, "venisia-legacy");
  const legacy = render(props), dom = parse(legacy);
  assert.deepEqual(regionIds(legacy), ["page-map-hero", "page-map-main", "page-map-sidebar", "page-map-bottom", "page-map-footer"]);
  const body = dom.nodes.find(node => dom.value(node, "data-admin-form-layout") === "panel");
  assert.ok(body);
  for (const id of ["page-map-main", "page-map-sidebar"]) assert.ok(dom.nodes.some(node => dom.value(node, "data-admin-tab-section-heading") === id && dom.within(body.parent, node)));
  assert.ok(!dom.nodes.some(node => dom.value(node, "data-admin-tab-section-heading") === "page-map-hero" && dom.within(body.parent, node)));
  assert.ok(legacy.indexOf("مقياس 99") < legacy.indexOf("مقياس 30"), "The fixed Hero remains before its ordered peers");
  assert.ok(legacy.indexOf("مقياس 10") < legacy.indexOf("مقياس 11") && legacy.indexOf("مقياس 11") < legacy.indexOf("مقياس 12"));
  check("Legacy topology draws Hero, the real main/sidebar body relation, Bottom and pre-footer with canonical module order", true);
  for (const id of [11, 20]) {
    const item = dom.owned("li").find(node => node.parent.getText(dom.tree).includes("مقياس " + id));
    assert.ok(item);
    assert.ok(dom.nodes.some(node => dom.within(item.parent, node) && (dom.value(node, "className") ?? dom.value(node, "class") ?? "").includes("opacity-50")));
    assert.ok(item.parent.getText(dom.tree).includes("مخفي"), "Hidden assignments retain an explicit management label");
  }
  const visible = dom.owned("li").find(node => node.parent.getText(dom.tree).includes("مقياس 10"));
  assert.ok(visible);
  assert.ok(!dom.nodes.some(node => dom.within(visible.parent, node) && (dom.value(node, "class") ?? "").includes("opacity-50")));
  const renderedHeaders = dom.nodes.filter(node => /^page-map-/u.test(dom.value(node, "data-admin-tab-section-heading") ?? ""));
  assert.ok(renderedHeaders.every(node => !/>\s*\d+\s*</u.test(node.parent.getText(dom.tree))), "Region headings contain no numerical counter");
  assert.ok(!dom.nodes.some(node => dom.has(node, "data-admin-tab-section-summary")), "No Region summary counter survives actual rendering");
  check("Hidden assignments stay in the ordered map with faded cards and a visible label; visible cards and headings keep their correct state", true);
  type ButtonPort = { "aria-label"?: string; disabled?: boolean; onClick?: () => void };
  const buttons = (actual: Props) => {
    const found: ButtonPort[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!isValidElement(node)) return;
      const properties = node.props as Record<string, unknown>;
      if (typeof properties.onClick === "function" && /أعلى|أسفل/u.test(String(properties["aria-label"]))) found.push(properties as ButtonPort);
      Object.values(properties).forEach(walk);
    };
    walk(MapComponent(actual));
    return found;
  };
  const controls = buttons(props);
  const control = (id: number, direction: "up" | "down", list = controls) => {
    const found = list.find(button => button["aria-label"]?.includes("مقياس " + id) && (direction === "up" ? /أعلى/u : /أسفل/u).test(button["aria-label"]));
    assert.ok(found, "Both reorder directions are present for each assignment");
    return found;
  };
  assert.equal(control(10, "up").disabled, true);
  assert.equal(Boolean(control(10, "down").disabled), false);
  assert.equal(Boolean(control(11, "up").disabled), false);
  assert.equal(Boolean(control(11, "down").disabled), false);
  assert.equal(control(12, "down").disabled, true);
  for (const id of [22, 99]) for (const direction of ["up", "down"] as const) assert.equal(control(id, direction).disabled, true);
  control(11, "up").onClick!(); control(11, "down").onClick!();
  assert.deepEqual(moves, [{ rowId: 11, target: 0 }, { rowId: 11, target: 2 }]);
  check("Actual map callback ports preserve first/last/singleton/Hero limits and include hidden assignments in same-Region moves", true);
  for (const direction of ["up", "down"] as const) assert.equal(control(11, direction, buttons(propsFor(rows, legacyRegions, "venisia-legacy", { pendingId: 11 }))).disabled, true);
  assert.ok(buttons(propsFor(rows, legacyRegions, "venisia-legacy", { disabled: true })).every(button => button.disabled));
  const unmanageableRows = rows.map(current => current.id === 11 ? { ...current, manages_assignment_on_page: false } : current);
  const unmanageable = buttons(propsFor(unmanageableRows, legacyRegions, "venisia-legacy"));
  for (const direction of ["up", "down"] as const) assert.equal(control(11, direction, unmanageable).disabled, true);
  const pending = parse(render(propsFor(rows, legacyRegions, "venisia-legacy", { pendingId: 11 })));
  assert.ok(pending.owned("button").filter(node => (pending.value(node, "aria-label") ?? "").includes("مقياس 11")).every(node => pending.has(node, "disabled")));
  check("Row Pending, assignment manageability and the owning global disabled port disable actual rendered commands", true);
  const removed = render({ ...props, assignments: rows.filter(candidate => candidate.id !== 11) });
  assert.ok(!removed.includes("مقياس 11") && legacy.includes("مقياس 11"));
  check("Assignment removal follows the shared assignment source without dropping hidden or pending rows early", true);
  const clientAst = pageCompositionAst(client), map = clientAst.owned("PageVisualSlotMap");
  assert.equal(map.length, 1);
  const attr = (name: string) => clientAst.attr(map[0]!, name)?.replace(/\s+/gu, "");
  assert.equal(attr("assignments"), "{instant.rows}");
  assert.equal(attr("getReorderPosition"), "{getReorderPosition}");
  assert.equal(attr("onMoveTo"), "{handleReorderAssignment}");
  assert.ok(attr("layoutKey") && attr("getRowInteraction") && attr("reorderDisabled"));
  assert.ok(client.includes("instant.getRowInteraction") && client.includes("reorderPageComposition(") && client.includes("reconcileSuccess:"));
  check("The dynamic page consumer wires map and table to the existing instant rows, reorder command, interaction and reconciliation owners", true);
  const utils = await jiti.import<typeof import("../src/app/admin/pages-blocks/pages/[id]/page-blocks/page-blocks-utils.ts")>(
    "../src/app/admin/pages-blocks/pages/[id]/page-blocks/page-blocks-utils.ts",
  );
  const handlerNames = ["getAssignmentSiblings", "getReorderPosition", "handleDetachAssignment", "handleReorderAssignment", "handleBulkExecute"] as const;
  const extracted = handlerNames.map(name => {
    const matches: ts.FunctionDeclaration[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node);
      ts.forEachChild(node, visit);
    };
    visit(clientAst.tree);
    assert.equal(matches.length, 1, "Every callback probe must bind exactly one actual consumer function: " + name);
    return matches[0]!.getText(clientAst.tree);
  }).join("\n");
  type Result = import("../src/lib/admin/entity-list/data-engine/instant-mutation.ts").AdminEntityMutationResult;
  type Request = import("../src/lib/admin/entity-list/data-engine/instant-mutation.ts").AdminEntityMutationRequest<Row>;
  const makeHarness = (initial: Row[], response: () => Promise<Result>) => {
    const feedback: Array<{ ok: boolean; message: string }> = [];
    let mutationCalls = 0, cleared = 0;
    const commands: Array<{ slot: string; ids: number[] }> = [];
    // This is the callback's existing mutation/cache port under controlled
    // settlement, not an authenticated server or a replacement Data Engine.
    const instant = {
      rows: [...initial], bulkInteraction: { isBlocked: false },
      mutateAsync: async (request: Request) => {
        mutationCalls += 1;
        const snapshot = [...instant.rows];
        const cache = {
          patchRows: (update: (current: Row) => Row) => { instant.rows = instant.rows.map(update); },
          transformActiveRows: (update: (current: Row[]) => Row[]) => { instant.rows = update(instant.rows); },
          // Match the shared cache's numeric row.id contract so a regression to
          // composite IDs passed to removeRows cannot be masked by this probe.
          removeRows: (ids: ReadonlySet<string | number>) => { instant.rows = instant.rows.filter(current => !ids.has(current.id)); },
          upsertRows: () => { throw new Error("Unrelated cache insertion is outside this callback contract"); },
        };
        request.optimistic(cache);
        try {
          const result = await request.execute({ commandId: "map-callback-probe" });
          if (!result.ok) throw Object.assign(new Error(result.message), result);
          request.reconcileSuccess?.(result, {
            cache, restoreSnapshot: () => { instant.rows = [...snapshot]; },
            reconcileDeletedRows: ids => cache.removeRows(ids),
          });
          return result;
        } catch (error) {
          instant.rows = snapshot;
          throw error;
        }
      },
    };
    const bindings = {
      instant, page: { id: 42 }, manualReorderEnabled: true,
      assignmentRowId: utils.assignmentRowId, isManageableAssignment: utils.isManageableAssignment,
      normalizeLayoutSlot: slots.normalizeLayoutSlot, normalizeBoolean: adminUtils.normalizeBoolean,
      isPageModulePubliclyVisible: adminUtils.isPageModulePubliclyVisible, comparePageAssignmentOrder: compare,
      setActionFeedback: (value: { ok: boolean; message: string }) => feedback.push(value),
      detachPageBlockAssignment: response, bulkPageBlockAssignments: response,
      updatePageBlockAssignment: response,
      reorderPageComposition: async (_pageId: number, slot: string, values: Array<{ id: number }>) => {
        commands.push({ slot, ids: values.map(value => value.id) });
        return response();
      },
      selection: { clearSelection: () => { cleared += 1; } },
    };
    const compiledHandlers = ts.transpileModule(extracted, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const callbacks = new Function(...Object.keys(bindings), compiledHandlers + "\nreturn {" + handlerNames.join(",") + "};")(...Object.values(bindings)) as {
      getAssignmentSiblings: (current: Row) => Row[];
      getReorderPosition: (current: Row) => { position: number; count: number };
      handleDetachAssignment: (current: Row) => Promise<void>;
      handleReorderAssignment: (current: Row, target: number) => Promise<void>;
      handleBulkExecute: (action: string, ids: string[]) => Promise<void>;
    };
    return { instant, feedback, commands, callbacks, calls: () => mutationCalls, cleared: () => cleared };
  };
  const identities = (items: Row[]) => items.map(utils.assignmentRowId);
  const collisionRows = [row(7, "hero", 0, true, "hero"), row(7, "main", 0), row(8, "main", 10, false)];
  let settle!: (result: Result) => void;
  let harness = makeHarness(collisionRows, () => new Promise<Result>(resolve => { settle = resolve; }));
  let inFlight = harness.callbacks.handleDetachAssignment(collisionRows[1]!);
  assert.deepEqual(identities(harness.instant.rows), ["hero:7", "content:7", "content:8"]);
  assert.equal(harness.feedback.length, 0, "Pending detach has no fabricated success feedback");
  settle({ ok: true, message: "confirmed detach" }); await inFlight;
  assert.deepEqual(identities(harness.instant.rows), ["hero:7", "content:8"]);
  assert.equal(harness.feedback.at(-1)?.ok, true);
  harness = makeHarness(collisionRows, async () => ({ ok: false, code: "controlled_failure", message: "detach rejected" }));
  await harness.callbacks.handleDetachAssignment(collisionRows[1]!);
  assert.deepEqual(identities(harness.instant.rows), ["hero:7", "content:7", "content:8"]);
  assert.equal(harness.feedback.at(-1)?.ok, false);
  check("Actual detach callback retains pending assignments, removes only the confirmed kind/id, and preserves rows/error feedback after failure", true);
  harness = makeHarness(collisionRows, () => new Promise<Result>(resolve => { settle = resolve; }));
  inFlight = harness.callbacks.handleBulkExecute("detach", ["content:7", "content:8"]);
  assert.deepEqual(identities(harness.instant.rows), ["hero:7", "content:7", "content:8"]);
  assert.equal(harness.feedback.length, 0);
  settle({ ok: true, message: "confirmed bulk detach" }); await inFlight;
  assert.deepEqual(identities(harness.instant.rows), ["hero:7"]);
  assert.equal(harness.cleared(), 1);
  harness = makeHarness(collisionRows, async () => { throw new Error("bulk rejected"); });
  await assert.rejects(harness.callbacks.handleBulkExecute("detach", ["content:7", "content:8"]), /bulk rejected/u);
  assert.deepEqual(identities(harness.instant.rows), ["hero:7", "content:7", "content:8"]);
  assert.equal(harness.cleared(), 0);
  assert.equal(harness.feedback.at(-1)?.ok, false);
  check("Actual bulk detach callback removes confirmed assignments after settlement and retains source/selection on failure", true);
  harness = makeHarness(collisionRows, async () => ({ ok: true, message: "confirmed reorder" }));
  assert.deepEqual(identities(harness.callbacks.getAssignmentSiblings(collisionRows[1]!)), ["content:7", "content:8"]);
  assert.deepEqual(harness.callbacks.getReorderPosition(collisionRows[2]!), { position: 1, count: 2 });
  await harness.callbacks.handleReorderAssignment({ ...collisionRows[1]!, manages_assignment_on_page: false }, 1);
  harness.instant.bulkInteraction.isBlocked = true;
  await harness.callbacks.handleReorderAssignment(collisionRows[1]!, 1);
  harness.instant.bulkInteraction.isBlocked = false;
  await harness.callbacks.handleReorderAssignment(collisionRows[1]!, -1);
  await harness.callbacks.handleReorderAssignment(collisionRows[1]!, 2);
  await harness.callbacks.handleReorderAssignment(collisionRows[1]!, 0);
  await harness.callbacks.handleReorderAssignment(collisionRows[0]!, 1);
  assert.equal(harness.calls(), 0, "Unmanageable, blocked, Hero and unavailable target positions never mutate");
  await harness.callbacks.handleReorderAssignment(collisionRows[2]!, 0);
  assert.deepEqual(harness.commands, [{ slot: "main", ids: [8, 7] }]);
  assert.deepEqual(harness.instant.rows.map(current => [utils.assignmentRowId(current), current.sort_order]), [["hero:7", 0], ["content:7", 20], ["content:8", 10]]);
  harness = makeHarness(collisionRows, async () => ({ ok: false, code: "controlled_failure", message: "reorder rejected" }));
  await harness.callbacks.handleReorderAssignment(collisionRows[2]!, 0);
  assert.deepEqual(harness.instant.rows, collisionRows);
  assert.equal(harness.feedback.at(-1)?.ok, false);
  check("Actual reorder callback rejects permission/Pending/boundary/Hero cases, keeps hidden same-Region siblings and restores controlled failure state", true);
  check("Regression negatives reject lost topology, Region panels, Charcoal headers and revived counters",
    !hasPageVisualMapComposition(source.replace(/presentation="panel"/u, 'presentation="default"'))
      && !hasPageVisualMapComposition(source.replace(/sectionHeaderPresentation="premium"/u, 'sectionHeaderPresentation="default"'))
      && !hasPageVisualMapComposition(source.replace(/<AdminModuleSectionHeader/u, '<AdminModuleSectionHeader sectionSummary={rows.length}'))
      && !hasPageVisualMapComposition(source.replace(/resolveVenesiaThemeLayout\(/u, "lostThemeLayout(").replace(/VENISIA_THEME_CONTRACT\.resolveLayout\(/u, "lostThemeLayout(")));
}

function hasPageFamilyPresentation(client:string,map:string,header:string,route:string) {
  const ast=pageCompositionAst(client),tabs=ast.owned("AdminModuleTabs");if(tabs.length!==1||ast.owned("AdminPageExperience").some(node=>ast.attr(node,"as")!=='"div"')||ast.attr(tabs[0]!,"navigationEventName")!=='"admin-page-blocks-navigation"'||!header.includes('visualPreset="pages"')||pageCompositionAst(route).owned("AdminPageExperience").some(node=>pageCompositionAst(route).attr(node,"as")!=='"div"'))return false;
  const property=tabs[0]!.attributes.properties.find((node):node is ts.JsxAttribute=>ts.isJsxAttribute(node)&&node.name.getText(ast.tree)==="tabs")?.initializer;if(!property||!ts.isJsxExpression(property)||!property.expression||!ts.isArrayLiteralExpression(property.expression))return false;
  const ids:string[]=[];for(const item of property.expression.elements){if(!ts.isObjectLiteralExpression(item))return false;const value=(name:string)=>item.properties.find((node):node is ts.PropertyAssignment=>ts.isPropertyAssignment(node)&&node.name.getText(ast.tree)===name)?.initializer?.getText(ast.tree),id=value("id");if(!id)return false;ids.push(JSON.parse(id) as string);if(value("sectionHeaderPresentation")!=='"premium"'||value("sectionHeaderClassName")!=="ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME")return false;}
  if(ids.join("|")!=="seo|layout|map|modules"||!ast.owned("AdminFormSection").some(node=>ast.attr(node,"presentation")==='"panel"'&&ast.inside(ast.owned("PageVisualSlotMap")[0]!,node.parent))||!client.includes('placement="global"'))return false;
  return hasPageVisualMapComposition(map);
}

function verifyPageCompositionPresentation() {
  const base="src/app/admin/pages-blocks/pages/[id]/",seo=read(base+"PageSeoPanel.tsx"),layout=read(base+"PageLayoutManager.tsx"),assign=read(base+"page-blocks/PageBlocksAssignModal.tsx"),client=read(base+"PageBlocksClient.tsx"),map=read("src/components/admin/page-blocks/PageVisualSlotMap.tsx"),header=read(base+"page-blocks/PageBlocksHeader.tsx"),route=read(base+"page.tsx");
  check("Page Composition keeps its actual four premium charcoal tabs, canonical map panels/Grid and existing Page header/feedback owners",hasPageFamilyPresentation(client,map,header,route));
  check("Page SEO uses the actual PendingFields inner20px stack with sibling panel and native Sticky submit, preserving all eight hidden payload bindings",hasPageSeoComposition(seo));
  check("Page Layout keeps panel/field owners and pending commands, with only its Save command in a standalone canonical Actions bar",hasPageLayoutComposition(layout));
  check("Page assignment preserves all four native dispatch branches, pending fieldset, footer form ownership, canonical labels/hints and existing close handler",hasPageAssignmentComposition(assign));
  const seoAst=pageCompositionAst(seo),bar=seoAst.owned("AdminStickyFormBar")[0]!,stack=bar.parent.parent;assert.ok(ts.isJsxElement(stack));const lostStack=seo.slice(0,stack.openingElement.getStart(seoAst.tree))+"<div>"+seo.slice(stack.openingElement.end);
  check("Page family negatives reject lost headers/map owner, ineffective or nested SEO actions, altered payload, detached layout save and lost assignment pending/dispatch",
    !hasPageFamilyPresentation(client.replace('sectionHeaderPresentation: "premium"','sectionHeaderPresentation: "panel"'),map,header,route)&&
    !hasPageFamilyPresentation(client,map.replace('presentation="panel"','presentation="default"'),header,route)&&
    !hasPageSeoComposition(lostStack)&&!hasPageSeoComposition(seo.replace('name="page_id"','name="lost_page_id"'))&&!hasPageSeoComposition(seo.replace('presentation="panel"','presentation="premium"'))&&!hasPageSeoComposition(seo.replace("<AdminStickyFormBar","<AdminFormSection><AdminStickyFormBar").replace("</AdminStickyFormBar>","</AdminStickyFormBar></AdminFormSection>"))&&
    !hasPageLayoutComposition(layout.replace('presentation="panel"','presentation="default"'))&&!hasPageLayoutComposition(layout.replace("onClick={handleSaveLayout}","onClick={handleSelectLayout}"))&&!hasPageLayoutComposition(layout.replace("<AdminStickyFormBar","<AdminFormSection><AdminStickyFormBar").replace("</AdminStickyFormBar>","</AdminStickyFormBar></AdminFormSection>"))&&
    !hasPageAssignmentComposition(assign.replace("pending={assignPending}","pending={false}"))&&!hasPageAssignmentComposition(assign.replace('form="assign-page-block-form"','form="other-form"'))&&!hasPageAssignmentComposition(assign.replace("? assignHeroAction","? assignBlockAction"))&&!hasPageAssignmentComposition(assign.replace('name="is_visible"','name="lost_visibility"'))&&!hasPageAssignmentComposition(assign.replace('presentation="panel"','presentation="default"'))&&!hasPageAssignmentComposition(assign.replace("textInset: true","textInset: false"))&&!hasPageAssignmentComposition(assign.replaceAll("data-admin-form-label-text","data-lost-label-marker"))&&!hasPageLayoutComposition(layout.replaceAll("data-admin-form-label-text","data-lost-label-marker")));
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
    assert.equal(attr(pages[0], "presentation"), undefined);
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
    assert.ok(hasBlockEditorPresentation(ctaEditor), "CTA inherits the unified module owner defaults");
    assert.ok(hasCtaNestedPanelPresentation(ctaEditor) && ctaEditor.includes("<AdminFormGrid columns={2}"));
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
  presentation.indexOf('data-module-editor-settings-header=""') <
    presentation.indexOf('data-module-editor-settings-body=""') &&
    presentation.includes(
      'className="flex min-w-0 flex-wrap items-center gap-1"',
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
    heroOrderEditor.includes("<ModuleEditorRepeaterGrid>") &&
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
    assert.ok(detailRows.every(node => !attr(node, "presentation") && attr(node, "icon")));
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
    assert.equal(value(composition, "label"), '"تكوين الصورة"');
    assert.equal(value(composition, "presentation"), '"panel"');
    assert.ok(heroEditor.includes("ref={surfaceRef}") && heroEditor.includes("ref={iframeRef}"));
    assert.ok(heroEditor.includes('<HeroRenderedAreaCard previewPath={previewPath} />'));
    const pages = tagged("ModuleEditorPagesTab");
    assert.equal(pages.length, 1);
    assert.equal(attr(pages[0], "presentation"), undefined);
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
    assert.equal(text.attr(textFormat[0], "presentation"), undefined);
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
    assert.ok(domainBranch.thenStatement.getText(cta.tree).includes("{projectActionLabelField}"));
    const domainLabel = cta.tagged("input").find(node => node.pos < domainBranch.pos && cta.value(node, "name") === '"primary_cta_label"');
    assert.ok(domainLabel);
    assert.equal(cta.value(domainLabel, "defaultValue"), "{primaryLabel}");
    assert.equal(domain.attr(domain.tagged("HeroVisibilityAlignRow")[0], "presentation"), undefined);
    assert.ok(domain.tagged("AdminFormField").some(node => domain.value(node, "presentation") === '"panel"'));
    const adminRows = cta.tagged("HeroVisibilityAlignRow").filter(node => node.pos > domainBranch.end);
    assert.equal(adminRows.length, 1);
    assert.equal(cta.attr(adminRows[0], "presentation"), undefined);
    for (const [name, expected] of [["alignmentName", '"cta_alignment"'], ["showName", '"show_cta"'], ["boldName", '"cta_bold"'], ["alignmentDefault", "{alignmentDefault}"], ["boldDefault", "{boldDefault}"], ["enableAlignment", "{enableAlignment}"], ["showDefault", "{showDefault}"]]) assert.equal(cta.value(adminRows[0], name), expected);
    assert.equal(cta.tagged("AdminCard").length, 0);
    assert.equal(cta.tagged("AdminFormControlHeader").length, 0);
    assertHeroCtaSectionComposition(heroCtaEditor);
    for (const [original, replacement] of [
      ["ModuleEditorSection", "UnadoptedSection"], ["AdminFormField", "UnadoptedField"],
      ['title="الزر الأساسي"', 'title="الزر الثانوي"'], ['label="نص الزر الأساسي"', 'label="Hidden name"'],
      ['data-hero-cta-row="primary"', 'data-hero-cta-row="secondary"'], ['name="secondary_cta_label"', 'name="foreign_cta_label"'],
      ['className="h-full"', 'className="detached-height"'], ['prefix="primary_cta"', 'prefix="secondary_cta"'],
    ]) {
      const mutant = heroCtaEditor.replaceAll(original, replacement);
      assert.notEqual(mutant, heroCtaEditor);
      assert.equal(ts.transpileModule(mutant, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).diagnostics?.length ?? 0, 0, "Hero CTA mutations are syntax-valid");
      assert.throws(() => assertHeroCtaSectionComposition(mutant), "Canonical Sections, visible native Fields, group order/context and payloads cannot be lost");
    }
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
    assert.equal(actions.attr(actions.tagged("ModuleEditorRepeaterGrid")[0], "presentation"), undefined);
    assert.equal(actions.tagged("ModuleEditorRepeaterCard").length, 1);
    assert.equal(actions.attr(actions.tagged("ModuleEditorRepeaterCard")[0], "presentation"), undefined);
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
    const defaultOrderBranch = defaultOrder.slice(defaultOrder.lastIndexOf("\n  return ("));
    assert.ok(!defaultOrder.includes('presentation =') && !defaultOrder.includes('if (presentation ==='));
    assert.ok(defaultOrderBranch.includes("ModuleEditorRepeaterCard") && assertDefaultHeroElementOrder(heroOrderEditor));
    for (const [original, replacement] of [
      ['<ul className="space-y-3">', '<ul className="grid grid-cols-3">'],
      ['title={HERO_ELEMENT_LABELS_AR[key]}', 'title="Detached title"'],
      ['name="hero_element_order"', 'name="foreign_element_order"'],
      ['onClick={() => move(index, -1)}', 'onClick={() => move(index, 1)}'],
    ]) {
      const mutant = heroOrderEditor.replaceAll(original, replacement);
      assert.notEqual(mutant, heroOrderEditor);
      assert.equal(ts.transpileModule(mutant, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).diagnostics?.length ?? 0, 0);
      assert.throws(() => assertDefaultHeroElementOrder(mutant), "Current ordinary Hero list, canonical item identity and native reorder payload/callbacks remain required");
    }
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
  presentation.includes("columns?: 2 | 3") &&
    presentation.includes('<AdminFormGrid columns={columns} className={className}>{children}</AdminFormGrid>') &&
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
  "shared identity composition aligns module name, selection and publication through the canonical Field Grid without private sizing",
  presentation.includes("data-module-editor-identity") &&
    presentation.includes('data-module-editor-name-field=""') &&
    presentation.includes('data-module-editor-identity-control=""') &&
    presentation.includes('<AdminFormGrid columns={12} presentation="aligned-fields"') &&
    presentation.includes('span={children ? 4 : 6}') &&
    !presentation.includes('grid-cols-[max-content_minmax(0,1fr)]') &&
    !presentation.includes('minmax(20rem,26rem)') &&
    presentation.includes("<ModuleEditorStatusSwitch") && presentation.includes('className="contents"'),
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
    alignedBreadcrumb(breadcrumbEditor) &&
    !alignedBreadcrumb(breadcrumbEditor.replace('presentation="aligned-fields"', 'presentation="plain"')) &&
    !alignedBreadcrumb(breadcrumbEditor.replace('name="show_home"', 'name="foreign_home"')) &&
    presentation.includes('data-module-editor-field-span={resolvedSpan}') && presentation.includes('className="contents"') &&
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
    presentation.includes('<AdminFormSection {...props}') &&
    hasProjectHeroFields(projectsHubHeroEditor) &&
    !hasProjectHeroFields(projectsHubHeroEditor.replace('name="project_type"', 'name="detached_type"')) &&
    !hasProjectHeroFields(projectsHubHeroEditor.replace("span={4}", "span={8}")) &&
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
    for (const row of textRows) assert.equal(attr(row, "presentation"), undefined);
    assert.equal(tagged("ModuleEditorField").filter(node => attr(node, "nature")?.initializer?.getText(tree) === '"short-text"' && attr(node, "span")?.initializer?.getText(tree) === "{6}").length, 2);
    assert.equal(tagged("ModuleEditorField").filter(node => attr(node, "nature")?.initializer?.getText(tree) === '"long-content"' && attr(node, "span")?.initializer?.getText(tree) === "{12}").length, 1);
    assert.equal(tagged("textarea").length, 1);
    assert.equal(attr(tagged("textarea")[0], "name")?.initializer?.getText(tree), '"description"');
    const repeaters = tagged("AdminCardsItemsField");
    assert.equal(repeaters.length, 1);
    assert.equal(attr(repeaters[0], "presentation"), undefined);
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
    assert.equal(attr(pages[0], "presentation"), undefined);
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
  "Cards unified repeater preserves default creation, stable rows, limits and canonical save owners",
  (() => {
    assert.ok(!cardsRepeater.includes('presentation?:') && !cardsRepeater.includes('presentation ='));
    assert.ok(!cardsRepeater.includes('presentation ==='));
    assert.ok(cardsRepeater.includes("<ModuleEditorRepeaterGrid columns={3}>"));
    assert.equal(pageCompositionAst(cardsRepeater).owned("ModuleEditorRepeaterCard").length, 1);
    assert.ok(cardsRepeater.includes("<AdminFormControlHeader") && cardsRepeater.includes('presentation="leading-icon"') && cardsRepeater.includes("<AdminActionButton"));
    for (const token of ["minItems = 1", "maxItems = 12", "showIcon = true", "padItems(items, minItems).slice(0, maxItems)", "key={item.clientKey}", "function updateItem(", "function moveItem(", "function removeItem(", "function addItem(", "if (nextIndex < 0 || nextIndex >= rows.length) return;", "[next[index], next[nextIndex]] = [next[nextIndex], next[index]];", "if (rows.length <= minItems) return;", "if (rows.length >= maxItems) return;", "renderHref(item, index)"]) assert.ok(cardsRepeater.includes(token), token);
    for (const field of ["icon", "title", "body"]) assert.ok(cardsRepeater.includes("item_${index}_" + field));
    for (const condition of ["disabled={index === 0}", "disabled={index === rows.length - 1}", "disabled={rows.length <= minItems}"]) assert.equal(cardsRepeater.split(condition).length - 1, 1);
    assert.ok(hasCardsRepeaterHeading(cardsRepeater));
    for (const [original, replacement] of [
      ['{label}</span>', '{null}</span>'], ['aria-level={3}', 'aria-level={2}'],
      ['from "../../ui/AdminForm"', 'from "../../ui/ForeignForm"'],
    ]) {
      const mutant = cardsRepeater.replace(original, replacement);
      assert.notEqual(mutant, cardsRepeater);
      assert.equal(ts.transpileModule(mutant, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).diagnostics?.length ?? 0, 0);
      assert.ok(!hasCardsRepeaterHeading(mutant), "The canonical Cards repeater preserves its accessible original native label");
    }
    assert.ok(cardsRepeater.includes("<AdminActionButton") && cardsRepeater.includes("onClick={addItem}"));
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
  /export function ModuleEditorRepeaterGrid\(\{\s*children,\s*columns = 3,/u.test(presentation) &&
    presentation.includes('<AdminFormGrid columns={columns} className={className}>{children}</AdminFormGrid>') &&
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
    pageCompositionAst(pagesClient).owned("PageVisualSlotMap").some(node =>
      pageCompositionAst(pagesClient).attr(node, "assignments")?.replace(/\s+/gu, "") === "{instant.rows}",
    ) &&
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
      owner.includes('<span data-admin-form-label-text>Anchor (اختياري)</span>') && pageCompositionAst(owner).inset("adminFormLabelClassName") && pageCompositionAst(owner).inset("adminFormHintClassName");
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
          const surfaces = owned.filter(node => tag(node) === "ModuleEditorSection" && textAttribute(node, "presentation") === "panel" &&
            !nearest(node, ancestor => tag(ancestor) === "ModuleEditorSection" && panelOf(ancestor) === panel));
          assert.equal(surfaces.length, 1, "Each functional CTA panel has one outer shared Premium surface");
          const heading = one(owned.filter(node => tag(node) === "AdminModuleSectionHeader" && textAttribute(node, "sectionHeaderPresentation") === "premium"), "Each CTA panel has one canonical Premium heading");
          assert.ok(nearest(heading, ancestor => ancestor === surfaces[0]), "Panel heading belongs to its shared surface");
          assert.equal(attribute(heading, "sectionHeaderClassName")?.initializer?.getText(tree), "{ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}");
          assert.ok(textAttribute(heading, "sectionHeading") && textAttribute(heading, "sectionDescription"), "Each CTA panel retains its semantic title and explanation");
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
        { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportNames: ["ModuleEditorFieldGrid", "ModuleEditorField", "ModuleEditorSection"] },
        { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportNames: ["AdminModuleSectionHeader"] },
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
          const ownership = pageCompositionAst(text);
          assert.ok(ownership.canonical("ModuleEditorSection", "/ModuleEditorPresentation") && ownership.canonical("AdminFormField", "/ui"), `${functionName} retains canonical Section and visible Field owners`);
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
            const card = nearest(labels[0], node => tag(node) === "ModuleEditorSection");
            assert.ok(card && textAttribute(card, "title"), `${functionName} ${prefix} label has a shared functional Section/Header`);
            const field = nearest(labels[0], node => tag(node) === "AdminFormField");
            assert.ok(field && textAttribute(field, "label") && nearest(field, node => tag(node) === "ModuleEditorSection") === card, `${functionName} ${prefix} native label belongs to its own visible Field`);
            assert.equal(nearest(links[0], node => tag(node) === "ModuleEditorSection") === card, true, `${functionName} ${prefix} label and matching link share their closest functional Section`);
            pairs.push({ card, link: links[0] });
          }
          assert.equal(pairs[0].card !== pairs[1].card, true, `${functionName} keeps its two button data groups distinct`);
          return { tree, pairs };
        };
        const paired = inspectPair(pairedSource);
        const pairedGraph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [pairedFile], symbolAware: true });
        for (const binding of [
          { sourceFile: "src/components/admin/ui/AdminCard.tsx", exportNames: ["default"] },
          { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportNames: ["ModuleEditorSection"] },
          { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportNames: ["AdminFormField"] },
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
  "shared Card has one canonical surface while compatibility aliases preserve functional defaults and shared control scale",
  (() => {
    const card = read("src/components/admin/ui/AdminCard.tsx");
    const defaultCard = card.slice(card.lastIndexOf("\n  return ("));
    const form = read("src/components/admin/ui/AdminModuleTabs.tsx");
    const styles = read("src/lib/admin/admin-ui-styles.ts");
    return card.includes('presentation?: "default" | "premium"') &&
      !card.includes('presentation = "default"') &&
      !card.includes('if (presentation === "premium")') &&
      card.includes('interactive = false') &&
      defaultCard.includes('relative ${ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME}') &&
      defaultCard.includes('hover:-translate-y-0.5 hover:border-[#D8B87A]/28 hover:bg-[#10131A]/82') &&
      !defaultCard.includes('pointer-events-none absolute inset-x-0 top-0 h-px') &&
      defaultCard.includes('ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME') &&
      form.includes('data-admin-form-control-header=""') &&
      hasControlHeaderTitleScale(form) && !hasControlHeaderTitleScale(form.replace("text-sm font-semibold text-white", "text-base font-semibold text-white")) &&
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
    mediaOwner.includes('previewFit ?? (cardPresentation ? "contain" : "cover")') &&
    mediaOwner.includes(': `relative w-full max-w-sm overflow-hidden rounded-2xl border') &&
    mediaOwner.includes('data-admin-media-image-preview-trigger') &&
    mediaOwner.includes('<VenesiaModal') &&
    hasMediaPreviewEligibility(mediaOwner) &&
    ["presentation === \"active\" && canPreviewValue", "previewOpen && canPreviewValue", "previewOpen && presentation === \"active\"", "previewOpen && presentation === \"active\" && !canPreviewValue"].every(open =>
      !hasMediaPreviewEligibility(mediaOwner.replace('open={previewOpen && presentation === "active" && canPreviewValue}', `open={${open}}`))) &&
    mediaOwner.includes('aria-haspopup="dialog"') &&
    mediaOwner.includes('className="object-contain"') &&
    mediaOwner.includes('compactAspectClassName = "aspect-[4/3]"') &&
    !mediaOwner.split('if (variant === "compact")')[1].split('\n  const cardPresentation')[0].includes('max-w-sm') &&
    (() => { const gallery = read("src/components/admin/media/AdminMediaGalleryField.tsx");
      return gallery.includes('grid-cols-1 md:grid-cols-2') &&
        gallery.includes('grid-cols-1 md:grid-cols-3 xl:grid-cols-4') &&
        gallery.includes('previewAspectRatio={4 / 3}') && gallery.includes('<AdminMediaImageField') && mediaOwner.includes('AdminMediaOriginalDimensions');
    })(),
);

check(
  "CTA module uses the shared one-column form grid inside each CTA card without joined text/link columns",
  (() => { const cta = read("src/components/admin/page-blocks/CtaModuleEditClient.tsx"); const links = cta.slice(cta.indexOf('id: "cta"'), cta.indexOf('id: "presentation"')); return (links.split('<AdminFormGrid columns={1}>').length === 3) && !cta.includes("grid-cols-[minmax(0,1fr)_auto]") && !cta.includes("rounded-e-none"); })(),
);

check(
  "Gallery delegates every image item to ImageField while shared actions retain default, bare and card contracts",
  await (async () => {
    const gallery = read("src/components/admin/media/AdminMediaGalleryField.tsx");
    const tree = ts.createSourceFile("AdminMediaGalleryField.tsx", gallery, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const nodes: ts.Node[] = [];
    const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); }; visit(tree);
    const owners = nodes.filter((node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "AdminMediaImageField");
    assert.equal(owners.length, 1);
    const ownerText = owners[0]!.getText(tree);
    for (const binding of ['variant="gallery"', 'value={item.url}', 'altValue={item.alt}', 'captionValue={item.caption}', 'referenceState={referenceState}', 'onReplace={() => openReplace(index)}', 'onRemove={() => removeAt(index)}', 'actionPresentation={actionPresentation}', 'renderValueInput={itemsMode}']) assert.ok(ownerText.includes(binding), "Canonical Gallery item binding " + binding);
    assert.ok(gallery.includes('import AdminMediaImageField from "./AdminMediaImageField"'));
    for (const parallel of ["<AdminMediaImageActions", "<AdminMediaPreview", "<AdminMediaOriginalDimensions", "<AdminMediaReferenceLabel", "<Image "]) assert.ok(!gallery.includes(parallel), "Gallery must not retain parallel item presentation: " + parallel);
    assert.equal(read("src/components/admin/page-blocks/AdminImagePathListField.tsx").trim(), 'export { default } from "../media/AdminMediaGalleryField";');
    const [{ ADMIN_FORM, ADMIN_CINEMATIC_GOLD_V1, adminFormLabelClassName, adminFormFieldClassName, adminFormTextareaClassName }, { default: ActionButton }, { AdminDataGridActionIcon }, { AdminMediaPreview, AdminMediaReferenceLabel, AdminMediaOriginalDimensions }] = await Promise.all([
      jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
      jiti.import<typeof import("../src/components/admin/ui/AdminActionButton.tsx")>("../src/components/admin/ui/AdminActionButton.tsx"),
      jiti.import<typeof import("../src/components/admin/ui/AdminDataGrid.tsx")>("../src/components/admin/ui/AdminDataGrid.tsx"),
      jiti.import<typeof import("../src/components/admin/media/AdminDeletedMediaNotice.tsx")>("../src/components/admin/media/AdminDeletedMediaNotice.tsx"),
    ]);
    const imageTree = ts.createSourceFile("AdminMediaImageField.tsx", mediaOwner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const mediaActionNode = imageTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminMediaImageActions"); assert.ok(mediaActionNode);
    const exports: Partial<typeof import("../src/components/admin/media/AdminMediaImageField.tsx")> = {};
    new Function("React", "exports", "AdminActionButton", "AdminDataGridActionIcon", ts.transpileModule(mediaActionNode.getText(imageTree), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)({ createElement }, exports, ActionButton, AdminDataGridActionIcon);
    const MediaActions = exports.AdminMediaImageActions; assert.ok(MediaActions);
    assert.ok(mediaOwner.includes('"children" | "size" | "variant" | "className" | "href" | "form" | "type"'));
    for (const glyph of ["restore", "delete"]) assert.ok(mediaActionNode.getText(imageTree).includes(`<AdminDataGridActionIcon action="${glyph}" size="md" />`));
    const galleryBranch: ts.IfStatement[] = [];
    const findGallery = (node: ts.Node) => { if (ts.isIfStatement(node) && node.expression.getText(imageTree) === 'variant === "gallery"') galleryBranch.push(node); ts.forEachChild(node, findGallery); }; findGallery(imageTree); assert.equal(galleryBranch.length, 1);
    const branchBody = galleryBranch[0]!.thenStatement; assert.ok(ts.isBlock(branchBody));
    const branchSource = branchBody.statements.map(node => node.getText(imageTree)).join("\n");
    const render = new Function("React", "AdminMediaImageActions", "AdminActionButton", "AdminDataGridActionIcon", "AdminMediaPreview", "AdminMediaReferenceLabel", "AdminMediaOriginalDimensions", "Image", "AdminMediaPickerModal", ts.transpileModule(`function render({ actionPresentation = "default", allowReplace = true, allowRemove = true, value = "/fixture.webp", altValue = "Alt", name = "gallery_url", renderValueInput = true, presentation = "active", referenceState, onReplace, onRemove, actionAttributes, pickerExpanded = false }) { const pickerOpen = false; const valueInputRef = { current: null }; const previewSurfaceProps = undefined, previewAspectRatio = undefined, previewFit = undefined, previewOverlay = null; const dimensionsPresentation = "default", dimensionDisclosures = null, showReferenceLabel = true, metadataFields = null; const updateValue = value => onRemove?.(value); const setPickerOpen = value => onReplace?.(value); const browseFolder = "images"; ${branchSource} }`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn render;")({ createElement, Fragment }, MediaActions, ActionButton, AdminDataGridActionIcon, AdminMediaPreview, AdminMediaReferenceLabel, AdminMediaOriginalDimensions, () => null, () => null) as (context: Record<string, unknown>) => ReactNode;
    for (const itemsMode of [false, true]) for (const state of ["active", "deleted", "missing", "unavailable"]) {
      const index = itemsMode ? 0 : 1, calls: [string, number][] = [];
      const attributes = { replace: { id: itemsMode ? "gallery-focus" : undefined, "aria-describedby": itemsMode ? "gallery_url-error" : undefined, "data-admin-media-gallery-action": "replace" }, remove: { "aria-label": `إزالة الصورة ${index + 1} من المعرض`, "data-admin-media-gallery-action": "remove" } };
      const context = { actionAttributes: attributes, pickerExpanded: itemsMode, presentation: state, referenceState: { deleted: state === "deleted" ? ["/fixture.webp"] : [], missing: state === "missing" ? ["/fixture.webp"] : [], available: state !== "unavailable", originals: [] }, onReplace: () => calls.push(["replace", index]), onRemove: () => calls.push(["remove", index]) };
      const node = (mode?: "default" | "bare" | "card", allowReplace = true, allowRemove = true) => render({ ...context, ...(mode ? { actionPresentation: mode } : {}), allowReplace, allowRemove });
      const html = (node: ReactNode) => renderToStaticMarkup(createElement("div", null, node));
      assert.equal(html(node()), html(node("default")), "Omitted Gallery actions retain default markup");
      for (const mode of ["default", "bare", "card"] as const) {
        const markup = html(node(mode)), buttons = [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gu)].map(match => match[0]); assert.equal(buttons.length, 2);
        const replace = buttons.find(button => button.includes('data-admin-media-gallery-action="replace"'))!, remove = buttons.find(button => button.includes('data-admin-media-gallery-action="remove"'))!; assert.ok(replace && remove);
        const replaceLabel = state === "deleted" || state === "missing" ? "اختيار بديل" : "استبدال";
        assert.ok(replace.includes('aria-haspopup="dialog"') && replace.includes(`aria-expanded="${itemsMode}"`)); assert.equal(replace.includes('id="gallery-focus"'), itemsMode); assert.equal(replace.includes('aria-describedby="gallery_url-error"'), itemsMode); assert.ok(remove.includes(`aria-label="إزالة الصورة ${index + 1} من المعرض"`));
        if (mode === "default") { assert.ok(replace.includes(`>${replaceLabel}</button>`) && remove.includes('>×</button>')); assert.ok(markup.includes("absolute right-2 top-2") && !markup.includes("<svg")); }
        else {
          assert.ok(replace.includes(`aria-label="${replaceLabel}"`) && replace.includes(`title="${replaceLabel}"`));
          assert.ok(buttons.every(button => button.includes('type="button"') && button.includes("size-11 shrink-0 p-0") && button.includes("focus-visible:outline")));
          if (mode === "bare") { assert.ok(markup.includes('data-admin-media-gallery-actions="bare"')); assert.ok(buttons.every(button => button.includes('class="size-5.5 shrink-0"') && button.includes("border-transparent bg-transparent"))); assert.ok(replace.includes("text-[#D8B87A]") && remove.includes("text-red-400")); }
          else { assert.equal((markup.match(/data-admin-media-image-actions="true"/gu) ?? []).length, 1); assert.ok(markup.includes("absolute bottom-3 left-3 flex gap-2 rounded-2xl bg-[#080B10]/95 p-1")); assert.ok(buttons.every(button => button.includes('class="size-4.5 shrink-0"'))); assert.ok(replace.includes(ADMIN_CINEMATIC_GOLD_V1.action.secondary) && replace.includes('data-admin-action-presentation="cinematic"') && remove.includes("border-red-500/20 bg-red-500/10")); assert.ok(!replace.includes(ADMIN_CINEMATIC_GOLD_V1.action.primary), "Image replacement keeps the official secondary role rather than borrowing the primary submit role"); for (const [button, action] of [[replace, "restore"], [remove, "delete"]] as const) assert.ok(button.includes(renderToStaticMarkup(createElement(AdminDataGridActionIcon, { action, size: "md" })))); }
        }
      }
      const invoke = (value: ReactNode): void => {
        if (!isValidElement<Record<string, unknown>>(value)) return;
        if (value.type === MediaActions && isValidElement<Parameters<typeof MediaActions>[0]>(value)) { invoke(MediaActions(value.props)); return; }
        if (value.props["data-admin-media-gallery-action"] && typeof value.props.onClick === "function") value.props.onClick();
        for (const child of Children.toArray(value.props.children as ReactNode)) invoke(child);
      };
      for (const mode of ["default", "bare", "card"] as const) for (const allowReplace of [false, true]) for (const allowRemove of [false, true]) {
        calls.length = 0; const rendered = node(mode, allowReplace, allowRemove); invoke(rendered); assert.deepEqual(calls.sort(([a], [b]) => a.localeCompare(b)), [...(allowRemove ? [["remove", index]] : []), ...(allowReplace ? [["replace", index]] : [])]); assert.equal((html(rendered).match(/<button\b/gu) ?? []).length, Number(allowReplace) + Number(allowRemove));
      }
    }
    const metadataNodes: ts.FunctionDeclaration[] = [];
    const findMetadata = (node: ts.Node) => { if (ts.isFunctionDeclaration(node) && node.name?.text === "renderMetadataField") metadataNodes.push(node); ts.forEachChild(node, findMetadata); }; findMetadata(imageTree); assert.equal(metadataNodes.length, 1);
    const renderMetadata = new Function("React", "ADMIN_FORM", "adminFormLabelClassName", "adminFormFieldClassName", "adminFormTextareaClassName", ts.transpileModule(`function render({ metadataPresentation = "panel", showAlt = true, showCaption = true, rows = 2 }) { const altName = "gallery-alt", captionName = "gallery-caption", altValue = "A correct alt", captionValue = "A correct caption", altLabel = "Alt", captionLabel = "Caption", altId = "alt-focus", altPlaceholder = "", captionPlaceholder = "", altInvalid = false, altDescribedBy = undefined, metadataLabelClassName = undefined, altRows = rows, captionRows = rows, showAltCounter = true, showCaptionCounter = true; const altProjectionRef = { current: null }, captionProjectionRef = { current: null }; const setAltValue = () => {}, onAltValueChange = () => {}, onCaptionValueChange = () => {}; ${metadataNodes[0]!.getText(imageTree)} return <>{renderMetadataField("alt")}{renderMetadataField("caption")}</>; }`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn render;")({ createElement, Fragment }, ADMIN_FORM, adminFormLabelClassName, adminFormFieldClassName, adminFormTextareaClassName) as (context: Record<string, unknown>) => ReactNode;
    for (const metadataPresentation of ["panel", "gallery"] as const) for (const rows of [1, 2]) for (const showAlt of [false, true]) for (const showCaption of [false, true]) {
      const html = renderToStaticMarkup(createElement("div", null, renderMetadata({ metadataPresentation, showAlt, showCaption, rows })));
      for (const [name, value, visible] of [["gallery-alt", "A correct alt", showAlt], ["gallery-caption", "A correct caption", showCaption]] as const) { const controls = [...html.matchAll(/<input\b[^>]*>/gu), ...html.matchAll(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gu)].map(match => match[0]).filter(control => control.includes('name="' + name + '"')); assert.equal(controls.length, 1); assert.ok(controls[0]!.includes(value)); assert.equal(controls[0]!.includes('type="hidden"'), !visible); }
    }
    return true;
  })(),
);

check(
  "Gallery panel ports preserve hidden metadata, omitted defaults and atomic shared-handle reorder",
  (() => {
    const source = read("src/components/admin/media/AdminMediaGalleryField.tsx");
    const tree = ts.createSourceFile("AdminMediaGalleryField.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const nodes: ts.Node[] = [];
    function visit(node: ts.Node) { nodes.push(node); ts.forEachChild(node, visit); }
    visit(tree);
    const binding = (name: string) => nodes.find((node): node is ts.BindingElement => ts.isBindingElement(node) && node.name.getText(tree) === name);
    assert.equal(binding("presentation")?.initializer?.getText(tree), '"default"');
    assert.equal(binding("enableDragDrop")?.initializer?.getText(tree), "false");
    assert.equal(binding("desktopColumns")?.initializer?.getText(tree), 'density === "compact" ? 4 : 2',
      "Desktop density defaults stay two normal columns and four compact columns");
    const galleryGrid = nodes.find((node): node is ts.JsxOpeningElement => ts.isJsxOpeningElement(node)
      && node.tagName.getText(tree) === "div"
      && node.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(tree) === "data-admin-media-gallery-density"));
    assert.ok(galleryGrid);
    const gridAttribute = galleryGrid.attributes.properties.find((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === "className");
    assert.ok(gridAttribute?.initializer && ts.isJsxExpression(gridAttribute.initializer) && gridAttribute.initializer.expression);
    const renderGrid = new Function("return function ({ density = 'default', desktopColumns = density === 'compact' ? 4 : 2 } = {}) { return (" + gridAttribute.initializer.expression.getText(tree) + "); };")() as (options?: { density?: "default" | "compact"; desktopColumns?: 2 | 4 }) => string;
    const gridCases = [
      [{}, "grid gap-3 grid-cols-1 md:grid-cols-2"],
      [{ density: "default", desktopColumns: 4 }, "grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4"],
      [{ density: "compact" }, "grid gap-3 grid-cols-1 md:grid-cols-3 xl:grid-cols-4"],
      [{ density: "compact", desktopColumns: 2 }, "grid gap-3 grid-cols-1 md:grid-cols-3 xl:grid-cols-2"],
    ] as const;
    for (const [options, expected] of gridCases) assert.equal(renderGrid(options), expected,
      "Desktop-only Gallery column opt-in must preserve the selected Mobile and Tablet density");
    const mediaForm = ts.createSourceFile("MediaContentForm.tsx", read("src/components/admin/content/editors/media/MediaContentForm.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const formGalleries: ts.JsxSelfClosingElement[] = [];
    function findFormGalleries(node: ts.Node) {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(mediaForm) === "AdminMediaGalleryField") formGalleries.push(node);
      ts.forEachChild(node, findFormGalleries);
    }
    findFormGalleries(mediaForm);
    assert.equal(formGalleries.length, 1);
    const adoptsDesktopFour = (node: ts.JsxSelfClosingElement, sourceFile: ts.SourceFile = mediaForm) => node.attributes.properties.some(property => ts.isJsxAttribute(property)
      && property.name.getText(sourceFile) === "desktopColumns" && property.initializer && ts.isJsxExpression(property.initializer)
      && property.initializer.expression?.getText(sourceFile) === "4");
    assert.ok(adoptsDesktopFour(formGalleries[0]!), "Only the existing Media Gallery consumer explicitly adopts four desktop columns");
    for (const wrong of ["2", "undefined"]) {
      const mutated = formGalleries[0]!.getText(mediaForm).replace("desktopColumns={4}", "desktopColumns={" + wrong + "}");
      const negative = ts.createSourceFile("MediaContentForm.tsx", mutated, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const statement = negative.statements[0];
      assert.ok(statement && ts.isExpressionStatement(statement) && ts.isJsxSelfClosingElement(statement.expression));
      const wrongBinding = statement.expression.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(negative) === "desktopColumns");
      assert.ok(wrongBinding && ts.isJsxAttribute(wrongBinding) && wrongBinding.initializer && ts.isJsxExpression(wrongBinding.initializer));
      assert.notEqual(wrongBinding.initializer.expression?.getText(negative), "4", "Desktop consumer adoption negatives cannot pass as four columns");
      assert.equal(adoptsDesktopFour(statement.expression, negative), false, "The same consumer adoption guard rejects an omitted or wrong desktop column binding");
    }
    for (const name of ["allowAdd", "allowReplace", "allowRemove", "allowReorder", "showAlt", "showCaption"]) {
      assert.equal(binding(name)?.initializer?.getText(tree), "true", name + " retains its omitted behavior");
    }
    const handles = nodes.filter((node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "AdminDataGridReorderHandle");
    assert.equal(handles.length, 1);
    assert.ok(handles[0]!.getText(tree).includes("onMoveTo={(target) => moveItemTo(item.key, target)}"));
    assert.ok(source.includes('const reorderControls = allowReorder ? (') && source.includes('{enableDragDrop ? ('));
    assert.ok(!source.includes("fetch(") && !source.includes("saveContentForm") && !source.includes("onPointerMove"));
    assert.ok(source.includes('<AdminCard presentation="premium"') && !source.includes('<AdminFormGrid'));
    const item = nodes.find((node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "AdminMediaImageField");
    assert.ok(item);
    for (const binding of ['showAlt={showAlt}', 'showCaption={showCaption}', 'altValue={item.alt}', 'captionValue={item.caption}', 'metadataPresentation={panel ? "panel" : "gallery"}', 'dimensionsPresentation={panel ? "disclosure" : "default"}']) assert.ok(item.getText(tree).includes(binding), "Gallery metadata/disclosure port " + binding);
    assert.equal(binding("dragFromImage")?.initializer?.getText(tree), "false");
    assert.ok(item.getText(tree).includes('previewSurfaceProps={allowReorder && enableDragDrop && dragFromImage ?'));
    assert.ok(source.includes('data-gallery-item-drop-target={dropTargetKey === item.key || undefined}'));
    const functions = ["isLocked", "moveItemTo", "moveItem", "startDrag", "dragOver", "dropOn", "endDrag"].map(name => {
      const node = nodes.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
      assert.ok(node, name + " remains the Gallery state owner's actual callback");
      return node.getText(tree);
    }).join("\n");
    type Row = { key: string; url: string; alt: string; caption: string };
    type ReorderFixture = {
      moveItemTo: (key: string, target: number) => void;
      moveItem: (index: number, direction: -1 | 1) => void;
      startDrag: (event: unknown, key: string) => void;
      dragOver: (event: unknown) => void;
      dropOn: (event: unknown, key: string) => void;
      endDrag: () => void;
      read: () => { items: Row[]; signals: number; drag: string | null; visual: string | null };
    };
    const harness = [
      "function build({ items, allowReorder = true, enableDragDrop = false }) {",
      "const disabled = false; const galleryRef = { current: null };",
      "let signals = 0; const draggedItemKeyRef = { current: null }; let visual = null;",
      "const setDraggedItemKey = value => { visual = value; }; let dropTarget = null; const setDropTargetKey = value => { dropTarget = value; }; const Element = class {};",
      "const commitItems = update => { items = update(items); signals++; };",
      functions,
      "return { moveItemTo, moveItem, startDrag, dragOver, dropOn, endDrag,",
      "read: () => ({ items, signals, drag: draggedItemKeyRef.current, visual }) }; }",
    ].join("\n");
    const build = new Function(ts.transpileModule(harness, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn build;")() as (context: Record<string, unknown>) => ReorderFixture;
    const original = ["a", "b", "c"].map(key => ({ key, url: "/" + key + ".webp", alt: "alt-" + key, caption: "caption-" + key }));
    const fixture = (options: Record<string, unknown> = {}) => build({ items: original.map(item => ({ ...item })), ...options });
    const event = () => ({
      prevented: 0, stopped: 0,
      dataTransfer: { effectAllowed: "", dropEffect: "", setData(type: string, value: string) { assert.equal(type, "text/plain"); assert.equal(value, "a"); } },
      preventDefault() { this.prevented++; }, stopPropagation() { this.stopped++; },
    });
    const tupleOrder = (value: ReorderFixture, keys: string[]) => assert.deepEqual(value.read().items, keys.map(key => original.find(item => item.key === key)), "URL, Alt, Caption and stable identity move together");
    const moved = fixture();
    moved.moveItemTo("a", 2); tupleOrder(moved, ["b", "c", "a"]); assert.equal(moved.read().signals, 1);
    moved.moveItemTo("a", 2); moved.moveItemTo("a", -1); moved.moveItemTo("missing", 1); moved.moveItemTo("a", 3);
    assert.equal(moved.read().signals, 1, "Bounds and unchanged order cannot emit structural dirty signals");
    moved.moveItem(2, -1); tupleOrder(moved, ["b", "a", "c"]); assert.equal(moved.read().signals, 2);
    const disabled = fixture({ allowReorder: false, enableDragDrop: true });
    disabled.moveItemTo("a", 2); disabled.moveItem(0, 1); const blocked = event(); disabled.startDrag(blocked, "a");
    disabled.dragOver(event()); disabled.dropOn(event(), "c"); tupleOrder(disabled, ["a", "b", "c"]);
    assert.equal(disabled.read().signals, 0); assert.equal(blocked.prevented, 1);
    const omitted = fixture(); const omittedStart = event(); omitted.startDrag(omittedStart, "a");
    assert.equal(omittedStart.prevented, 1); assert.equal(omitted.read().drag, null);
    const dragged = fixture({ enableDragDrop: true }); const start = event(); dragged.startDrag(start, "a");
    assert.equal(start.dataTransfer.effectAllowed, "move"); assert.equal(dragged.read().signals, 0);
    const over = event(); dragged.dragOver(over); assert.equal(over.prevented, 1); assert.equal(over.dataTransfer.dropEffect, "move");
    const drop = event(); dragged.dropOn(drop, "c"); tupleOrder(dragged, ["b", "c", "a"]);
    assert.equal(dragged.read().signals, 1); assert.equal(drop.stopped, 1); assert.equal(dragged.read().drag, null);
    const cancelled = fixture({ enableDragDrop: true }); cancelled.startDrag(event(), "a"); cancelled.endDrag();
    tupleOrder(cancelled, ["a", "b", "c"]); assert.equal(cancelled.read().signals, 0);
    const external = fixture({ enableDragDrop: true }); const externalDrop = event(); external.dragOver(externalDrop); external.dropOn(externalDrop, "c");
    tupleOrder(external, ["a", "b", "c"]); assert.equal(externalDrop.prevented, 0); assert.equal(external.read().signals, 0);
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
      pageCompositionAst(single).inset("adminFormLabelClassName") && pageCompositionAst(single).nestedLabels() &&
      !pageCompositionAst(single.replaceAll("{ textInset: true }", "{}")).inset("adminFormLabelClassName") &&
      !single.includes('className="block space-y-1.5"') &&
      !intro.includes('className="block space-y-1.5"') &&
      gallery.includes('altName={props.valueMode === "items" ? props.altName : undefined}') && gallery.includes('captionName={props.valueMode === "items" ? props.captionName : undefined}') && mediaOwner.includes('data-admin-media-image-metadata-field={kind}');
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
      mediaOwner.includes('remove={allowRemove ? {') && mediaOwner.includes('onClick: removeValue') && mediaOwner.includes('else updateValue("");') &&
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
      assertCanonicalControlHeaderOwnership(tabs, read("src/components/admin/ui/AdminForm.tsx")) &&
      tabs.includes('title={<span role="heading" aria-level={2}>{tab.sectionHeading}</span>}') &&
      tabs.includes('description={tab.sectionDescription}') && tabs.includes('icon={<AdminModuleTabIcon name={tab.icon ?? "section"} />}') &&
      tabs.includes('presentation="leading-icon"') && !tabs.includes('<h2 className=') &&
      link.includes('data-admin-link-actions="" className="inline-flex shrink-0 items-center gap-1"') &&
      link.includes(') : linkActions}') && link.includes('actionPresentation = "default"');
  })(),
);
check(
  "ControlHeader retains its canonical local owner, public reexport and native identity payload with effective source negatives",
  await (async () => {
    const tabs = read("src/components/admin/ui/AdminModuleTabs.tsx"), form = read("src/components/admin/ui/AdminForm.tsx");
    assertCanonicalControlHeaderOwnership(tabs, form);
    const owner = await jiti.import<typeof import("../src/components/admin/ui/AdminModuleTabs.tsx")>("../src/components/admin/ui/AdminModuleTabs.tsx");
    const publicTree = pageCompositionAst(form).tree;
    const publicExport = publicTree.statements.find((node): node is ts.ExportDeclaration => ts.isExportDeclaration(node) && !!node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.some(element => element.name.text === "AdminFormControlHeader"))!;
    const compatibility: Partial<typeof import("../src/components/admin/ui/AdminForm.tsx")> = {};
    new Function("require", "exports", ts.transpileModule(publicExport.getText(publicTree), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)((specifier: string) => { assert.equal(specifier, "./AdminModuleTabs"); return owner; }, compatibility);
    assert.equal(compatibility.AdminFormControlHeader, owner.AdminFormControlHeader, "Existing consumers resolve the same runtime function through AdminForm");
    const native = createElement("input", { name: "original_control_header", defaultValue: "same-payload", onChange: () => undefined });
    for (const presentation of [undefined, "default", "leading-icon", "compact-inline"] as const) {
      const props = { title: native, description: "Original description", icon: createElement("svg", { "data-original-header-icon": "" }), presentation };
      const html = renderToStaticMarkup(createElement(owner.AdminFormControlHeader, props));
      assert.equal(renderToStaticMarkup(createElement(compatibility.AdminFormControlHeader, props)), html);
      assert.ok(html.includes(renderToStaticMarkup(native)) && html.includes("Original description"));
      assert.equal((html.match(/data-original-header-icon=""/gu) ?? []).length, 1);
    }
    const replace = (input: string, before: string, after: string) => { assert.equal(input.split(before).length, 2, "Each source mutation targets one actual owner binding"); return input.replace(before, after); };
    const identityAst = pageCompositionAst(tabs), identitySource = identityAst.owned("AdminFormControlHeader")[0]!.getText(identityAst.tree);
    const mutants: [string, string, string][] = [
      ["reverse import", replace(tabs, "export function AdminFormControlHeader", 'import { AdminFormControlHeader } from "./AdminForm";\nfunction DisconnectedControlHeader'), form],
      ["private local owner", replace(tabs, "export function AdminFormControlHeader", "function AdminFormControlHeader"), form],
      ["missing public reexport", tabs, replace(form, 'export { AdminFormControlHeader } from "./AdminModuleTabs";', "")],
      ["foreign public reexport", tabs, replace(form, 'export { AdminFormControlHeader } from "./AdminModuleTabs";', 'export { AdminFormControlHeader } from "./ForeignHeader";')],
      ["wrong public identity", tabs, replace(form, 'export { AdminFormControlHeader } from "./AdminModuleTabs";', 'export { AdminModuleSectionHeader as AdminFormControlHeader } from "./AdminModuleTabs";')],
      ["type-only reexport", tabs, replace(form, 'export { AdminFormControlHeader } from "./AdminModuleTabs";', 'export type { AdminFormControlHeader } from "./AdminModuleTabs";')],
      ["copied compatibility owner", tabs, `${form}\nfunction AdminFormControlHeader() { return null; }`],
      ["shadowed runtime owner", replace(tabs, "  const standalone = tab.standalone", "  const { AdminFormControlHeader } = substituteOwner;\n  const standalone = tab.standalone"), form],
      ["inactive identity", replace(tabs, identitySource, `{false && ${identitySource}}`), form],
      ["lost native title", replace(tabs, 'title={<span role="heading" aria-level={2}>{tab.sectionHeading}</span>}', 'title={<span role="heading" aria-level={2}>Substitute</span>}'), form],
      ["lost description", replace(tabs, 'description={tab.sectionDescription}', 'description={null}'), form],
      ["lost icon owner", replace(tabs, 'icon={<AdminModuleTabIcon name={tab.icon ?? "section"} />}', 'icon={null}'), form],
      ["lost identity presentation", replace(tabs, identitySource, identitySource.replace('presentation="leading-icon"', 'presentation="default"')), form],
      ["overriding payload spread", replace(tabs, identitySource, identitySource.replace("<AdminFormControlHeader", "<AdminFormControlHeader {...foreignPayload}")), form],
      ["duplicate native title", replace(tabs, 'description={tab.sectionDescription}', 'description={tab.sectionDescription} title="Foreign title"'), form],
    ];
    for (const [name, candidateTabs, candidateForm] of mutants) {
      for (const candidate of [candidateTabs, candidateForm]) assert.equal(ts.transpileModule(candidate, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).diagnostics?.length ?? 0, 0, `${name} is a syntax-valid source mutation`);
      assert.throws(() => assertCanonicalControlHeaderOwnership(candidateTabs, candidateForm), `${name} must fail the canonical ownership contract`);
      check(`ControlHeader ownership rejects ${name}`, true);
    }
    return true;
  })(),
);
check(
  "the opt-in Accordion panel renders canonical section chrome while preserving native disclosure and mounted content",
  await (async () => {
    const [{ default: Accordion }, styles] = await Promise.all([
      jiti.import<typeof import("../src/components/admin/ui/AdminSingleOpenAccordion.tsx")>("../src/components/admin/ui/AdminSingleOpenAccordion.tsx"),
      jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
    ]);
    const items = ["search", "social", "analysis"].map((id, index) => ({
      id, label: `عنوان ${id}`, description: `وصف ${id}`, icon: index === 0 ? "seo" as const : index === 1 ? "media" as const : "statistics" as const,
      content: createElement("input", { name: `original_${id}`, defaultValue: `value_${id}` }),
    }));
    const props = { items, defaultOpenId: "social", ariaLabel: "المعاينات", className: "existing-composition" };
    type Element = ts.JsxElement | ts.JsxSelfClosingElement;
    const inspect = (html: string, openId: string, panel: boolean, expectedItems: readonly { id: string; description?: ReactNode }[] = items) => {
      const tree = ts.createSourceFile("accordion.tsx", html, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const elements: Element[] = [];
      const visit = (node: ts.Node) => { if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node); ts.forEachChild(node, visit); };
      visit(tree);
      const opening = (node: Element) => ts.isJsxElement(node) ? node.openingElement : node;
      const tag = (node: Element) => opening(node).tagName.getText(tree);
      const value = (node: Element, name: string) => {
        const attr = opening(node).attributes.properties.find((entry): entry is ts.JsxAttribute => ts.isJsxAttribute(entry) && entry.name.getText(tree) === name)?.initializer;
        return attr && ts.isStringLiteral(attr) ? attr.text : undefined;
      };
      const within = (parent: ts.Node, child: ts.Node) => parent.pos <= child.pos && child.end <= parent.end;
      const root = elements.find(node => value(node, "data-admin-single-open-accordion") !== undefined);
      assert.ok(root);
      assert.equal(value(root, "dir"), "rtl");
      assert.equal(value(root, "data-admin-single-open-accordion-active"), openId);
      assert.equal(value(root, "data-admin-single-open-accordion-presentation"), panel ? "panel" : undefined);
      assert.equal(value(root, "class"), `${panel ? "space-y-4" : "overflow-hidden rounded-2xl border border-white/10 bg-black/20"} existing-composition`);
      const sections = elements.filter(node => value(node, "data-admin-accordion-item") !== undefined);
      assert.equal(sections.length, expectedItems.length);
      for (const [index, section] of sections.entries()) {
        const item = expectedItems[index];
        assert.equal(value(section, "class"), panel ? `relative ${styles.ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME} overflow-hidden` : index > 0 ? "border-t border-white/10" : undefined);
        const trigger = elements.find(node => within(section, node) && value(node, "aria-expanded") !== undefined);
        const body = elements.find(node => within(section, node) && value(node, "data-admin-accordion-panel") === item.id);
        assert.ok(trigger && body);
        assert.equal(tag(trigger), "button");
        assert.equal(tag(trigger.parent as Element), "h3");
        assert.equal(value(trigger, "type"), "button");
        assert.equal(value(trigger, "aria-expanded"), String(item.id === openId));
        assert.equal(value(trigger, "aria-controls"), value(body, "id"));
        assert.equal(value(body, "aria-labelledby"), value(trigger, "id"));
        assert.equal(value(body, "role"), "region");
        assert.equal(value(body, "hidden"), item.id === openId ? undefined : "");
        assert.equal(value(body, "class"), panel ? "p-3" : "border-t border-white/10 p-4");
        assert.ok(value(trigger, "class")?.includes("focus-visible:ring-[#D8B87A]/70"));
        assert.equal(elements.some(node => within(trigger, node) && tag(node) === "header"), false, "Native disclosure triggers cannot contain section Header elements");
        const accents = elements.filter(node => within(trigger, node) && value(node, "data-admin-tab-section-accent") !== undefined);
        const identities = elements.filter(node => within(trigger, node) && value(node, "data-admin-form-control-header") !== undefined);
        assert.equal(accents.length, panel ? 1 : 0);
        assert.equal(identities.length, panel ? 1 : 0);
        if (panel) {
          assert.equal(value(trigger, "class"), `relative flex w-full min-w-0 flex-nowrap items-center justify-between gap-3 ${styles.ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME} ${styles.ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} cursor-pointer text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D8B87A]/70 hover:text-[#F2D99B]`, "The disclosure owns a flush natural-height row, without static Header margins or fixed height");
          assert.equal(value(accents[0], "class"), styles.ADMIN_PREMIUM_SECTION_HEADER_ACCENT_CLASS_NAME);
          assert.equal(value(accents[0], "aria-hidden"), "true");
          assert.equal(value(identities[0], "data-admin-form-control-presentation"), "leading-icon");
          assert.equal(value(identities[0].parent as Element, "class"), "min-w-0 flex-1", "The identity shrinks and wraps within the row while the arrow stays alongside it");
          assert.equal(elements.filter(node => within(identities[0], node) && value(node, "class") === "text-xs leading-5 text-white/55").length, item.description ? 1 : 0, "Missing descriptions reserve no empty line");
          const arrows = elements.filter(node => node.parent === trigger && tag(node) === "svg");
          assert.equal(arrows.length, 1, "One unchanged chevron remains a direct row sibling of the identity");
          assert.equal(value(arrows[0], "class"), `size-4 shrink-0 transition ${item.id === openId ? "rotate-180 text-[#D8B87A]" : "text-white/42"}`);
        }
        assert.equal(elements.filter(node => within(body, node) && value(node, "name") === `original_${item.id}`).length, 1, "Closed content remains mounted with its original native value");
      }
    };
    const normal = renderToStaticMarkup(createElement(Accordion, props));
    assert.equal(normal, renderToStaticMarkup(createElement(Accordion, { ...props, presentation: "default" })));
    const panel = renderToStaticMarkup(createElement(Accordion, { ...props, presentation: "panel" }));
    inspect(normal, "social", false);
    inspect(panel, "social", true);
    inspect(renderToStaticMarkup(createElement(Accordion, { ...props, presentation: "panel", defaultOpenId: "missing" })), "search", true);
    const mixedDescriptions = items.map(item => ({ ...item, description: item.id === "social" ? item.description : undefined }));
    inspect(renderToStaticMarkup(createElement(Accordion, { ...props, items: mixedDescriptions, presentation: "panel" })), "social", true, mixedDescriptions);
    assert.deepEqual(panel.match(/<input\b[^>]*>/gu), normal.match(/<input\b[^>]*>/gu), "Presentation retains every original named input and value");
    for (const changed of [
      panel.replace('data-admin-tab-section-accent="premium"', 'data-missing-accent="premium"'),
      panel.replace(styles.ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME, "parallel-header"),
      panel.replace('aria-expanded="false"', 'aria-expanded="true"'),
      panel.replace(' hidden=""', ""),
      panel.replace("relative flex w-full", "relative mb-3 flex w-full"),
      panel.replace("flex-nowrap", "flex-wrap"),
      panel.replace('class="min-w-0 flex-1"', 'class="min-w-0 flex-auto"'),
      panel.replace("relative flex w-full", "relative h-24 flex w-full"),
      panel.replace(`${styles.ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME} overflow-hidden`, `${styles.ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME} p-3 overflow-hidden`),
    ]) assert.ok(changed !== panel && rejects(() => inspect(changed, "social", true)), "Accordion SSR rejects lost canonical chrome or disclosure semantics");
    return true;
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
  "all Section Header aliases inherit unified Charcoal chrome while structural geometry, native summaries and one shared identity remain intact",
  await verifyUnifiedSectionHeaderDefaults(),
);

check(
  "control headers opt into a single leading icon and gold divider while preserving default presentation and scale",
  (() => {
    const source = read("src/components/admin/ui/AdminModuleTabs.tsx");
    const tree = ts.createSourceFile("AdminModuleTabs.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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
  "Story and About text/image cards share one canonical presentation while specialized editor and media contracts remain intact",
  (() => {
    const intro = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
    const storyImages = intro.split('{isHomeStory ? (')[1]?.split(') : (')[0] ?? "";
    const editor = read("src/components/admin/AdminRichTextEditor.tsx");
    return !intro.includes('presentation?: "default" | "premium"') &&
      !intro.includes('presentation === "premium"') &&
      pageCompositionAst(intro).owned("ModuleEditorVisibilityAlignRow").length === 4 &&
      intro.includes('toolbarMode={fullDescriptionEditor ? "full" : "none"}') &&
      intro.includes('minHeight={fullDescriptionEditor ? undefined : 72}') &&
      intro.includes('enableArticleStructure={fullDescriptionEditor}') &&
      intro.includes('enableTextAlign={fullDescriptionEditor}') &&
      intro.includes('showLabel={!fullDescriptionEditor}') &&
      (storyImages.match(/variant="card"/g)?.length === 2) &&
      storyImages.includes('<AdminFormGrid columns={2}>') &&
      (storyImages.match(/<AdminCard presentation="premium"/g)?.length === 2) &&
      editor.includes('storageFormat = "html"') && editor.includes('showLabel = true') &&
      !presentation.includes('presentation = "card"') &&
      !presentation.includes('if (presentation === "premium")') &&
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
  "Story page visibility and all registered consumers inherit the unified assignment/grid/header owners with one live selection",
  (() => {
    assert.ok(pageCompositionAst(contentEditClient).owned("ModuleEditorPagesTab").every(node => pageCompositionAst(contentEditClient).attr(node, "presentation") === undefined));
    assert.ok(!assignmentField.includes('presentation = "default"') && !assignmentField.includes('presentation?: "default" | "premium"'));
    for (const owner of ["AdminFormGrid", "AdminCard", "AdminFormControlHeader", "AdminToneBadge", "AdminCheckbox", "AdminModuleTabIcon"]) assert.ok(assignmentField.includes(owner));
    assert.ok(assignmentField.includes('<AdminFormGrid columns={2}>'));
    assert.ok(assignmentField.includes('group.pages.filter((page) => selectedSet.has(page.id)).length'));
    assert.equal((assignmentField.match(/useState</g) ?? []).length, 1, "Counts must derive from selection, not a second state");
    assert.ok(assignmentField.includes('checked={selectedSet.has(page.id)}'));
    assert.ok(!assignmentField.includes('defaultChecked='));
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
    assert.ok(value.includes('editorMode="about-intro" section={section}'));
    assert.ok(value.includes('<ModuleEditorPagesTab') && value.includes('assignmentContext={assignmentContext}'));
    assert.ok(contentEditClient.includes('nowrap tabs={aboutIntroTabs} activePanelContext={activePanelContext}'));
    assert.ok(contentEditClient.includes('{usesAboutIntroConfig ? <input type="hidden" name="config_schema" value="about-intro" /> : null}'));
    assert.ok(contentEditClient.includes('{isHomeStory ? <input type="hidden" name="include_story_cta" value="1" /> : null}'));
    assert.ok(tabs.includes('hidden={tab.id !== activeId}') && tabs.includes('{tab.content}'));
    for (const [id, label] of [["text", "النصوص"], ["images", "الصور"], ["cards", "البطاقات"], ["pages", "الظهور"]]) {
      assert.equal(getModuleEditorSectionMetadata("content", id, "about-intro")?.navigationLabelAr, label);
    }
    assert.equal(getModuleEditorSectionMetadata("content", "pages", "about-intro")?.sectionDescriptionAr, "حدد الصفحات التي يظهر بها الموديول.");
    assert.ok(!intro.includes('presentation = "default"') && !intro.includes('const premium ='));
    assert.ok(intro.includes('(section === "all" || section === "cards")'));
    assert.ok(intro.includes('<ModuleEditorRepeaterGrid>'));
    assert.ok(intro.includes('rows={3}') && intro.includes('name={`beat_${index}_text`}'));
    assert.ok(intro.includes('.slice(0, 3)') && intro.includes('while (rows.length < 3)'));
    assert.ok(intro.includes('toolbarMode={fullDescriptionEditor ? "full" : "none"}') && intro.includes('enableArticleStructure={fullDescriptionEditor}'));
    const mediaFields = intro.slice(intro.indexOf('const aboutImageFields'), intro.indexOf('  return (', intro.indexOf('const aboutImageFields')));
    for (const key of ["main", "secondary", "accent"]) assert.ok(mediaFields.includes('key: "' + key + '"'));
    assert.ok(mediaFields.includes('name={"image_" + slot.key}') && mediaFields.includes('altName={"image_" + slot.key + "_alt"}'));
    assert.ok(mediaFields.includes('variant="card"') && mediaFields.includes('browseFolder="images/about"'));
    assert.ok(!mediaFields.includes('onClick=') && !mediaFields.includes('useState') && !mediaFields.includes('AdminFormSwitch'));
    assert.ok(presentation.includes('<AdminFormGrid columns={columns} className={className}>{children}</AdminFormGrid>'));
    assert.ok(presentation.includes('<AdminCard presentation="premium" className={`h-full p-3 ${className}`.trim()}>'));
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
    assert.ok(contentEditClient.includes('editorMode="about-intro" section={section} descriptionToolbar="full"'));
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
  "Shared grid preserves existing layouts and adds opt-in equal-height outer columns without changing inner flow",
  (() => {
    const tree = ts.createSourceFile("AdminFormRuntime.tsx", adminFormGridOwner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const node = tree.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === "AdminFormGrid");
    assert.ok(node);
    const loadGrid = (source: string) => {
      const output = ts.transpileModule(source.replace(/^export /, ""), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
      return new Function("React", output + "\nreturn AdminFormGrid;")({ createElement }) as (props: Record<string, unknown>) => { props: { className: string; children: unknown; "data-admin-form-grid": string } };
    };
    const grid = loadGrid(node.getText(tree));
    const columnContracts = [
      [1, "grid-cols-1"], [2, "grid-cols-1 md:grid-cols-2"], [3, "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"],
      [4, "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"], [5, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"],
      [6, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"], [12, "grid-cols-1 xl:grid-cols-12"],
    ] as const;
    for (const [columns, classes] of columnContracts) {
      const result = grid({ columns, children: ["one", "two", "three", "four"] });
      assert.equal(result.props.className, "grid min-w-0 gap-4 [&>*]:min-w-0 " + classes);
      assert.deepEqual(result.props.children, ["one", "two", "three", "four"], "Layout must not pad or truncate cards");
    }
    for (const children of [["one"], ["one", "two", "three"]]) {
      assert.deepEqual(grid({ columns: 2, children }).props.children, children, "Odd field counts remain intact without placeholder cards or forced balancing");
    }
    assert.equal(grid({}).props.className, grid({ columns: 2 }).props.className);
    assert.ok(grid({ columns: 3, presentation: "aligned-fields" }).props.className.includes("grid-cols-1 md:grid-cols-3"));
    const verifyDensity = (source: string) => {
      const actualGrid = loadGrid(source);
      const naturalBody = createElement("div", { "data-original-density-body": "" }, "Natural inner content");
      const children = [naturalBody];
      for (const [columns] of columnContracts) for (const presentation of ["plain", "control-cards", "aligned-fields", "equal-height-columns"]) {
        const props = { columns, presentation, children, className: "existing-density-layout" };
        const normal = actualGrid(props);
        assert.ok(normal.props.className.startsWith("grid min-w-0 gap-4 [&>*]:min-w-0 "), "Omitted density preserves the existing 16px spacing for every column and presentation");
        assert.equal(actualGrid({ ...props, density: "default" }).props.className, normal.props.className);
        const compact = actualGrid({ ...props, density: "compact" });
        assert.equal(compact.props.className, normal.props.className.replace("grid min-w-0 gap-4 ", "grid min-w-0 gap-x-3 gap-y-2 "), "Compact density changes only the outer horizontal and vertical gap tokens");
        assert.equal(compact.props["data-admin-form-grid"], normal.props["data-admin-form-grid"]);
        assert.equal(compact.props.children, children, "Density must not clone, wrap, stretch or pad natural content");
      }
      for (const children of [[], [naturalBody], [naturalBody, "second", "third"]]) {
        assert.equal(actualGrid({ columns: 3, density: "compact", children }).props.children, children);
      }
    };
    verifyDensity(node.getText(tree));
    const densityMutants = [
      node.getText(tree).replace('density = "default"', 'density = "compact"'),
      node.getText(tree).replace('density === "compact"', 'density === "missing-compact"'),
      node.getText(tree).replace("gap-x-3 gap-y-2", "gap-3"),
      node.getText(tree).replace("gap-x-3 gap-y-2", "gap-x-3 gap-y-2 h-full items-stretch"),
      node.getText(tree).replace("{children}", "{null}"),
    ];
    assert.ok(densityMutants.every(source => source !== node.getText(tree) && rejects(() => verifyDensity(source))), "Reject compact defaults, missing opt-in, wrong gaps, height/stretch side effects and lost natural children");
    const equalHeightClasses = "items-stretch [&>*]:self-stretch";
    const verifyEqualHeightColumns = (source: string) => {
      const actualGrid = loadGrid(source);
      const body = createElement("div", { "data-natural-flow-body": "" }, "Natural content");
      const mainProps: { "data-natural-flow-main": string; children?: ReactNode } = { "data-natural-flow-main": "" };
      const asideProps: { "data-natural-flow-aside": string; children?: ReactNode } = { "data-natural-flow-aside": "" };
      const main = createElement("section", mainProps, body);
      const aside = createElement("aside", asideProps, "Short preview");
      const children = [main, aside];
      for (const [columns, classes] of columnContracts) {
        const baseClasses = `grid min-w-0 gap-4 [&>*]:min-w-0 ${classes}`;
        const plain = actualGrid({ columns, children });
        assert.equal(plain.props.className, baseClasses, "Existing defaults must not acquire equal-height presentation");
        assert.equal(plain.props["data-admin-form-grid"], "plain");
        assert.equal(actualGrid({ columns, presentation: "plain", children }).props.className, baseClasses);
        const equal = actualGrid({ columns, presentation: "equal-height-columns", children });
        assert.equal(equal.props["data-admin-form-grid"], "equal-height-columns");
        assert.equal(equal.props.className, `${baseClasses} ${equalHeightClasses}`, "The opt-in adds only outer alignment and direct-child self-stretch; no heights, nested flow, row sizing or surface rules");
        assert.equal(equal.props.children, children, "Outer layout must not clone, wrap, distribute or pad inner content");
        assert.equal(main.props.children, body);
        assert.equal(aside.props.children, "Short preview");
      }
      for (const children of [[], [main], [main, aside, body]]) {
        assert.equal(actualGrid({ columns: 2, presentation: "equal-height-columns", children }).props.children, children, "Natural and incomplete rows retain their actual content");
      }
      const custom = actualGrid({ columns: 1, presentation: "equal-height-columns", className: "existing-consumer-layout", children });
      assert.equal(custom.props.className, `grid min-w-0 gap-4 [&>*]:min-w-0 grid-cols-1 ${equalHeightClasses} existing-consumer-layout`, "The existing consumer layout remains an explicit composition input");
    };
    verifyEqualHeightColumns(node.getText(tree));
    const presentationConditions: ts.BinaryExpression[] = [];
    const findPresentation = (entry: ts.Node) => {
      if (ts.isVariableDeclaration(entry) && entry.name.getText(tree) === "presentationClassName" && entry.initializer) {
        const visit = (child: ts.Node) => { if (ts.isBinaryExpression(child) && child.getText(tree) === 'presentation === "equal-height-columns"') presentationConditions.push(child); ts.forEachChild(child, visit); };
        visit(entry.initializer);
      }
      ts.forEachChild(entry, findPresentation);
    };
    findPresentation(node); assert.equal(presentationConditions.length, 1, "The negative targets the actual presentation class selector, not the separate ratio/columns selector");
    const condition = presentationConditions[0]!, conditionStart = condition.getStart(tree) - node.getStart(tree), conditionEnd = condition.end - node.getStart(tree);
    const equalHeightMutants = [
      node.getText(tree).replace('presentation = "plain"', 'presentation = "equal-height-columns"'),
      node.getText(tree).slice(0, conditionStart) + 'presentation === "missing-equal-height-columns"' + node.getText(tree).slice(conditionEnd),
      node.getText(tree).replace(equalHeightClasses, "items-start [&>*]:self-start"),
      ...["h-full", "min-h-80", "flex flex-col", "justify-between", "auto-rows-fr", "[&>*]:h-full", "[&>*>*]:self-stretch", "[&>*]:grid [&>*]:grid-rows-subgrid"].map(classes => node.getText(tree).replace(equalHeightClasses, `${equalHeightClasses} ${classes}`)),
      node.getText(tree).replace("{children}", "{null}"),
    ];
    assert.ok(equalHeightMutants.every(source => source !== node.getText(tree) && rejects(() => verifyEqualHeightColumns(source))), "Reject default drift, missing stretch, forced heights, flex distribution, row equalization, nested changes and dropped content");
    const editor = read("src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx");
    assert.ok(editor.includes('<ModuleEditorRepeaterGrid columns={isHomeTrust ? 2 : 3}>'));
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
    assert.ok(entries[2].content.includes('ModuleEditorPagesTab') && !entries[2].content.includes('presentation="premium"'));
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
    assert.ok(hasPrinciplesRepeaterDefault(editor, presentation));
    for (const [consumer, owner] of [
      [editor.replace("<ModuleEditorRepeaterCard", '<ModuleEditorRepeaterCard presentation="premium"'), presentation],
      [editor, presentation.replace('<AdminCard presentation="premium" className={`h-full p-3 ${className}`.trim()}>', '<AdminCard presentation="default" className={`h-full p-3 ${className}`.trim()}>')],
      [editor, presentation.replace('        {children}\n      </div>\n    </AdminCard>', '        {null}\n      </div>\n    </AdminCard>')],
    ]) {
      assert.ok(consumer !== editor || owner !== presentation);
      assert.ok(!hasPrinciplesRepeaterDefault(consumer, owner), "Omitted repeater composition still requires the canonical Premium owner and original native children");
    }
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
    assert.ok(entries[4].content.includes('ModuleEditorPagesTab') && !entries[4].content.includes('presentation="premium"'));
    for (const [id, key] of [["text","text"],["image","images"],["cta","cta"],["contacts","cards"],["pages","visibility"]] as const) assert.equal(getModuleEditorSectionMetadata("content", id, "home-contact")?.navigationLabelAr, MODULE_EDITOR_TAB_LABELS[key]);
    assert.equal(getModuleEditorSectionMetadata("content", "contacts", "about-cta")?.navigationLabelAr, "وسائل التواصل");
    assert.equal(getModuleEditorSectionMetadata("content", "pages", "home-contact")?.sectionDescriptionAr, "حدد الصفحات التي يظهر بها الموديول.");
    const editor = read("src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx");
    assert.ok(editor.includes('editorMode = "about-cta"') && editor.includes('const CONTACT_SLOTS = 4'));
    assert.ok(editor.includes('Array.from({ length: CONTACT_SLOTS }') && editor.includes('key={row.uid}'));
    assert.equal((editor.match(/<textarea/g) ?? []).length, 2);
    assert.ok(editor.includes('name="description"') && !editor.includes("AdminRichTextEditor"));
    assert.ok(editor.includes('columns={isHomeContact ? 2 : 3}') && !/ModuleEditorRepeaterGrid[^>]*presentation=/u.test(editor));
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
  "Media Hub modes and Topics listings inherit unified collection presentation while functional domain selection and retired exclusions remain stable",
  (() => {
    const collection = read("src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx");
    const topics = read("src/components/admin/page-blocks/editors/TopicsListingModuleEditor.tsx");
    const listing = mediaHubEditor.slice(mediaHubEditor.indexOf("function ListingPresentationFields"), mediaHubEditor.indexOf("export default function"));
    assert.ok(!listing.includes('surfacePresentation='));
    assert.equal((mediaHubEditor.match(/sectionHeaderPresentation: isListing \|\| isActiveHub \? "control" : undefined/g) ?? []).length, 2);
    assert.ok(mediaHubEditor.includes('const isActiveHub = !isListing && sectionKey !== "featured"'));
    assert.ok(pageCompositionAst(mediaHubEditor).owned("ModuleEditorPagesTab").every(node => pageCompositionAst(mediaHubEditor).attr(node, "presentation") === undefined));
    assert.ok(!collection.includes('surfacePresentation'));
    assert.ok(!collection.includes('const premium =') && !collection.includes('const Section ='));
    assert.ok(collection.includes('<AdminFormGrid columns={3}>{cards}</AdminFormGrid>'));
    assert.ok(!collection.includes('const ControlCard ='));
    assert.ok(pageCompositionAst(collection).owned("ModuleEditorVisibilityAlignRow").every(node => pageCompositionAst(collection).attr(node, "presentation") === undefined));
    assert.equal((collection.match(/<ModuleEditorVisibilityAlignRow/g) ?? []).length, 7);
    assert.ok(collection.includes('controlMode="visibility-only"'));
    assert.ok(!topics.includes('surfacePresentation='));
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
    assert.ok(topics.includes('<CollectionModuleDisplayFormattingFields display={config.display} />'));
    assert.ok(mediaHubEditor.includes('getSlotModuleSlugMetadata(block.slug)?.editorSections?.presentation'));
    assert.ok(mediaHubEditor.includes('moduleSlug={splitListingTabs ? block.slug : undefined}'));
    assert.ok(mediaHubEditor.includes('section={splitListingTabs ? "configuration" : "all"}'));
    assert.ok(mediaHubEditor.includes('display={parsedInitial.listing.display}'));
    assert.equal((mediaHubEditor.match(/<ModuleEditorTabs/g) ?? []).length, 1);
    // Split composition delegates the configuration header to ModuleEditorTabs.
    // The implicit display section adopts its existing full Section Header owner.
    const collectionAst = pageCompositionAst(collection);
    const configurationSection = collectionAst.owned("ModuleEditorSection").find(node => collectionAst.attr(node, "header")?.includes('id="collection-configuration"'));
    assert.ok(configurationSection);
    assert.equal(collectionAst.attr(configurationSection!, "surface"), '{section === "all" ? "panel" : "neutral"}');
    assert.ok(collectionAst.attr(configurationSection!, "header")?.startsWith('{section === "all" ? <AdminModuleSectionHeader'));
    assert.ok(collection.includes('heading = "إعدادات العرض"'));
    assert.ok(collectionAst.owned("AdminModuleSectionHeader").some(node => collectionAst.attr(node, "id") === '"collection-display-formatting"' && collectionAst.attr(node, "sectionHeading") === "{heading}" && collectionAst.attr(node, "icon") === '"settings"'));
    assert.equal(sections.content.sectionHeadingAr, MODULE_KIND_METADATA["media-hub"].editorSections.content.sectionHeadingAr);
    assert.equal(sections.content.sectionDescriptionAr, MODULE_KIND_METADATA["media-hub"].editorSections.content.sectionDescriptionAr);
    assert.equal(sections.content.icon, MODULE_KIND_METADATA["media-hub"].editorSections.content.icon);
    assert.equal(sections.presentation.sectionHeadingAr, null);
    assert.equal(sections.presentation.sectionChrome, "implicit");
    return true;
  })(),
);

check(
  "Premium selected-pattern and Collection section groups use full default Headers outside their bodies without duplicate surfaces or spacing",
  (() => {
    const contracts = [
      { file: "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx", groups: [
        { id: "featured-variant-settings", heading: '"إعدادات النمط المختار"', icon: "settings", body: "data-featured-variant-settings", root: "ModuleEditorSection", premium: false },
        { id: "featured-display-formatting", heading: '"تنسيق عناصر المحتوى"', icon: "settings", body: "data-featured-display-settings", root: "section", premium: false },
      ] },
      { file: "src/components/admin/page-blocks/CollectionModuleFields.tsx", groups: [
        { id: "collection-variant-settings", heading: '"إعدادات النمط المختار"', icon: "settings", body: "data-collection-presentation-settings", root: "div", premium: false },
      ] },
      { file: "src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx", groups: [
        { id: "collection-display-formatting", heading: "{heading}", icon: "settings", body: "data-collection-display-settings", root: "ModuleEditorSection", premium: true },
        { id: "collection-configuration", heading: '"إعدادات القائمة"', icon: "section", body: "configuration-grid", root: "ModuleEditorSection", premium: true },
      ] },
    ];
    const verify = (source: string, groups: typeof contracts[number]["groups"]) => {
      const tree = ts.createSourceFile("section-groups.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const nodes: (ts.JsxElement | ts.JsxSelfClosingElement)[] = [];
      const visit = (node: ts.Node) => { if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) nodes.push(node); ts.forEachChild(node, visit); };
      visit(tree);
      const opening = (node: typeof nodes[number]) => ts.isJsxElement(node) ? node.openingElement : node;
      const tag = (node: typeof nodes[number]) => opening(node).tagName.getText(tree);
      const attribute = (node: typeof nodes[number], name: string) => opening(node).attributes.properties.find((value): value is ts.JsxAttribute => ts.isJsxAttribute(value) && value.name.getText(tree) === name);
      const value = (node: typeof nodes[number], name: string) => attribute(node, name)?.initializer?.getText(tree);
      const section = (node: ts.Node) => {
        for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
          if (ts.isJsxElement(ancestor)) {
            assert.notEqual(ancestor.openingElement.tagName.getText(tree), "AdminCard", "A full Section Header stays outside field Cards and their bodies");
            if (["section", "div", "ModuleEditorSection"].includes(ancestor.openingElement.tagName.getText(tree))) return ancestor;
          }
        }
        assert.fail("Missing functional section owner");
      };
      assert.ok(tree.statements.some(statement => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.endsWith("/AdminModuleTabs") && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && statement.importClause.namedBindings.elements.some(binding => binding.name.text === "AdminModuleSectionHeader" && !binding.propertyName)), "Header resolves to the existing canonical owner");
      return groups.map(group => {
        const matches = nodes.filter(node => tag(node) === "AdminModuleSectionHeader" && value(node, "id") === JSON.stringify(group.id));
        assert.equal(matches.length, 1, `${group.id} has one full Header`);
        const header = matches[0];
        assert.equal(value(header, "sectionHeading"), group.heading);
        assert.equal(value(header, "icon"), JSON.stringify(group.icon));
        assert.equal(value(header, "sectionHeaderPresentation"), group.premium ? '"premium"' : undefined, "Each current Header retains its canonical inherited or embedded presentation");
        const root = section(header);
        assert.equal(tag(root), group.root, "The current functional Section or neutral sibling group remains its actual owner");
        if (group.root === "ModuleEditorSection") {
          assert.ok(pageCompositionAst(source).canonical("ModuleEditorSection", "/ModuleEditorPresentation"));
          const slot = attribute(root, "header")?.initializer;
          assert.ok(slot && ts.isJsxExpression(slot));
          if (group.id === "collection-configuration") {
            assert.ok(slot.expression && ts.isConditionalExpression(slot.expression) && slot.expression.condition.getText(tree) === 'section === "all"' && slot.expression.whenTrue === header && slot.expression.whenFalse.getText(tree) === "undefined", "Configuration Header mounts only in the full Section context");
            assert.equal(value(root, "surface"), '{section === "all" ? "panel" : "neutral"}', "Already selected tab contexts retain neutral composition");
          } else assert.equal(slot.expression === header, true, "The canonical Header is the active shared Section slot");
        }
        assert.equal(attribute(root, "className") !== undefined, false, "The Header alone owns the Header-to-body gap");
        const body = nodes.find(node => group.body === "configuration-grid"
          ? tag(node) === "AdminFormGrid" && value(node, "columns") === "{4}"
          : Boolean(attribute(node, group.body)));
        assert.ok(body && section(body) === root && header.end < body.pos, "The full Header precedes its sibling body instead of nesting inside it");
        return { id: group.id, header, body, root, tree };
      });
    };
    for (const contract of contracts) {
      const source = read(contract.file);
      const groups = verify(source, contract.groups);
      for (const { id, header, body, root, tree } of groups) {
        const headerSource = header.getText(tree);
        const rootOpening = root.openingElement.getText(tree);
        const mutants = [
          source.replace(headerSource, headerSource.replace("AdminModuleSectionHeader", "AdminFormControlHeader")),
          source.replace(headerSource, `<AdminCard presentation="premium">${headerSource}</AdminCard>`),
          source.replace(headerSource, /sectionHeaderPresentation="[^"]*"/u.test(headerSource) ? headerSource.replace(/sectionHeaderPresentation="[^"]*"/u, 'sectionHeaderPresentation="control"') : headerSource.replace(/\/>$/u, ' sectionHeaderPresentation="control" />')),
          source.slice(0, root.openingElement.getStart(tree)) + rootOpening.replace(/>$/u, ' className="space-y-4">') + source.slice(root.openingElement.end),
          (root.openingElement.tagName.getText(tree) === "ModuleEditorSection"
            ? source.replace(root.openingElement.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(tree) === "header")!.getText(tree), "header={null}")
            : source.replace(headerSource, "")).replace(body.getText(tree), body.getText(tree) + headerSource),
        ];
        for (const [index, mutant] of mutants.entries()) {
          assert.equal(ts.transpileModule(mutant, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).diagnostics?.length ?? 0, 0, "Each Section grouping mutation is syntax-valid");
          assert.ok(mutant !== source && rejects(() => verify(mutant, contract.groups)), `${id} probe ${index}: reject missing/internal/nested Headers, duplicate gap ownership and Headers placed after the body`);
        }
      }
    }
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
    assert.ok(editor.includes('<ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext}'));
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
      if (!alignedBreadcrumb(source) || x.within(content, "AdminCard").length !== 0) return false;
      const grids = x.within(content, "AdminFormGrid"), sections = x.within(content, "ModuleEditorSection");
      if (grids.length !== 1 || sections.length !== 1 || !x.literal(x.attribute(sections[0], "surface"), "neutral") || !x.contains(sections[0], grids[0])) return false;
      const controlOwners = ["source", "current_label_override", "show_home"].map(name => {
        const control = x.named(name);
        return control ? grids.filter(grid => x.contains(grid, control)) : [];
      });
      if (controlOwners.some(owners => owners.length !== 1)) return false;
      const manual = x.within(content, "BreadcrumbManualItemsField");
      return manual.length === 1 && !x.contains(sections[0], manual[0]) && sections[0].end < manual[0].pos;
    };
    assert.ok(breadcrumbComposition(breadcrumbEditor));
    assert.ok(!breadcrumbComposition(breadcrumbEditor.replaceAll("AdminFormField", "div")), "Imports or field presence without actual control groups must fail");
    assert.ok(!breadcrumbComposition(breadcrumbEditor.replace("<BreadcrumbManualItemsField items={config.manualItems ?? []} />", "")), "The subordinate manual group is required");
    const breadcrumbTree = inspect(breadcrumbEditor);
    const breadcrumbGrid = breadcrumbTree.elements.find(n => breadcrumbTree.tag(n) === "AdminFormGrid")!;
    const flattenedControls = ["source", "current_label_override", "show_home"].map(name => breadcrumbTree.named(name)!.getText(breadcrumbTree.tree)).join("\n");
    const flattenedBreadcrumb = breadcrumbEditor.replace(breadcrumbGrid.getText(breadcrumbTree.tree), `<AdminFormGrid columns={3} presentation="aligned-fields"><AdminCard presentation="premium">${flattenedControls}</AdminCard><AdminCard presentation="premium" /><AdminCard presentation="premium" /></AdminFormGrid>`);
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
      return assignments.length === 1 && pageCompositionAst(source).canonical("ModuleEditorPagesTab", "/ModuleEditorPresentation") && x.attribute(assignments[0], "presentation") === undefined &&
        x.attribute(assignments[0], "moduleName")?.getText(x.tree) === "{block.name}" && x.attribute(assignments[0], "assignmentContext")?.getText(x.tree) === "{assignmentContext}";
    };
    const featured = read("src/components/admin/page-blocks/FeaturedModuleEditClient.tsx");
    assert.ok(featuredComposition(featured));
    assert.ok(!featuredComposition(featured.replace("{sourceFields}{variantFields}", "{sourceFields}{textFields}{variantFields}")), "Mixing copy with source configuration must fail");
    assert.ok(!featuredComposition(featured.replaceAll("AdminCard", "div")), "Shared imports alone cannot prove actual grouping");
    assert.ok(!featuredComposition(featured.replace("{sourceFields}{variantFields}", "{variantFields}{sourceFields}")), "Presentation configuration must follow source selection");
    assert.ok(!featuredComposition(featured.replace("{variantControls}", "{__swappedControls}").replace("{displayControls}", "{variantControls}").replace("{__swappedControls}", "{displayControls}")), "Counts/navigation and display formatting cannot swap their functional parents");
    assert.ok(!featuredComposition(featured.replace("<ModuleEditorPagesTab", '<ModuleEditorPagesTab presentation="premium"')), "Featured retains the canonical Pages owner default");
    assert.ok(!featuredComposition(featured.replace("assignmentContext={assignmentContext}", "assignmentContext={foreignContext}")), "The existing canonical assignment context cannot be disconnected");
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
  await verifyCompactInlineDefaults(),
);

check(
  "Premium acceptance executes actual rendered contract states, save-path integrity and evidence rejection probes",
  (() => {
    const output = execFileSync(process.execPath, [
      "scripts/qa-home-story-presentation.mjs", "--premium-adoption-acceptance-offline",
      `--content-premium-output-dir=${premiumAcceptanceOutput(process.argv.slice(2))}`,
    ], { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 4_000_000, timeout: 120_000 });
    // The runner fails closed on any assertion; stdout is scoped technical proof,
    // never a substitute for observed Browser evidence or Owner visual approval.
    process.stdout.write(output);
    return true;
  })(),
);

verifyPageCompositionPresentation();

console.log(
  `Page Block Editor Presentation verification passed (${passed} checks).`,
);
