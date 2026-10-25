import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import ts from "typescript";
import { Children, createElement, isValidElement, type ReactNode } from "react";

import { collectExecutableSourceGraph } from "./lib/typescript-executable-graph.mts";

const jiti = createJiti(import.meta.url);
const {
  STRUCTURAL_CONTENT_TEMPLATE_SLUGS,
  getContentModuleEditorKey,
  resolveModuleProductKind,
} =
  await jiti.import<
    typeof import("../src/lib/page-blocks/module-edit-registry.ts")
  >("../src/lib/page-blocks/module-edit-registry.ts");
const { PAGE_MODULE_KINDS } = await jiti.import<
  typeof import("../src/lib/page-blocks/types.ts")
>("../src/lib/page-blocks/types.ts");
const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } = await jiti.import<
  typeof import("../src/lib/admin/form-system/adoption-manifest.ts")
>("../src/lib/admin/form-system/adoption-manifest.ts");
const { ADMIN_COLLECTION_SURFACE_ADOPTION } = await jiti.import<
  typeof import("../src/lib/admin/interaction-system/adoption-manifest.ts")
>("../src/lib/admin/interaction-system/adoption-manifest.ts");
import {
  getModuleEditorHeaderMetadata,
  getModuleEditorSectionOrder,
  getModuleEditorSectionMetadata,
  getSlotModuleSlugMetadata,
} from "../src/lib/page-composition/module-registry-metadata.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const normalizePath = (path: string) => path.replaceAll("\\", "/");

function discoverSourceFiles(directory: string): string[] {
  return readdirSync(resolve(ROOT, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const sourcePath = normalizePath(`${directory}/${entry.name}`);
      if (entry.isDirectory()) return discoverSourceFiles(sourcePath);
      return /\.[cm]?[jt]sx?$/u.test(entry.name) ? [sourcePath] : [];
    },
  );
}

let passed = 0;
const settingsFamilyOnly = process.argv.includes("--settings-family");
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

if (process.argv.includes("--unified-owner-composition")) {
  const owner = read("src/components/admin/ui/AdminForm.tsx");
  const ownerTree = ts.createSourceFile("AdminForm.tsx", owner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sectionOwner = ownerTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormSection")!.getText(ownerTree);
  check("Unified Section delegates header and children to the actual default Card owner", Boolean(canonicalPanelSectionCard(owner)) &&
    !canonicalPanelSectionCard(owner.replace('from "./AdminCard"', 'from "./ParallelCard"')) &&
    !canonicalPanelSectionCard(owner.replace("{sectionHeader}", "{null}")) &&
    !canonicalPanelSectionCard(owner.replace(sectionOwner, sectionOwner.replace("{children}", "{null}"))));
  for (const path of ["src/app/admin/content/categories/CategoryForm.tsx", "src/app/admin/content/series/SeriesForm.tsx"]) {
    const source = read(path);
    check(`${path} retains canonical embedded header ownership for omitted/default/panel callers`,
      fullSectionHeadersStayOutsideCards(path, source, false, owner) &&
      fullSectionHeadersStayOutsideCards(path, source.replaceAll('presentation="panel"', 'presentation="default"'), false, owner) &&
      fullSectionHeadersStayOutsideCards(path, source.replaceAll('presentation="panel"', ''), false, owner) &&
      !fullSectionHeadersStayOutsideCards(path, source, false, owner.replace("{sectionHeader}", "{null}")) &&
      !fullSectionHeadersStayOutsideCards(path, source.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="default"'), false, owner));
  }
  const faqPath = "src/components/admin/content/editors/article/FaqEditor.tsx", faq = read(faqPath);
  check("FAQ keeps standalone versus embedded geometry through the same shared header chrome", fullSectionHeadersStayOutsideCards(faqPath, faq, false, owner) &&
    !fullSectionHeadersStayOutsideCards(faqPath, faq.replace(/(<AdminModuleSectionHeader\b[\s\S]*?\/>)/u, '<AdminCard>$1</AdminCard>'), false, owner));
  const cardSelector = (source: string, value: "default" | "omitted") => source.replaceAll('<AdminCard presentation="premium"', value === "default" ? '<AdminCard presentation="default"' : '<AdminCard');
  check("FAQ Card compatibility selectors preserve canonical imports, panel geometry and native controls", [faq, cardSelector(faq, "default"), cardSelector(faq, "omitted")].every(hasFaqFullSectionHeaders) &&
    !hasFaqFullSectionHeaders(faq.replace('from "../../../ui"', 'from "../../../ui/ParallelCard"')));
  const display = read("src/components/admin/content/editors/ContentDisplaySettings.tsx");
  check("Display controls retain their optional section and canonical Card identity for all compatibility selectors", [display, cardSelector(display, "default"), cardSelector(display, "omitted")].every(hasOptionalDisplaySection) &&
    !hasOptionalDisplaySection(display.replace('"../../ui/AdminCard"', '"../../ui/ParallelCard"')) &&
    !hasOptionalDisplaySection(display.replace("{displayControls}", "{displayControls}{displayControls}")));
  const basic = read("src/components/admin/content/editors/ContentBasicDataPanel.tsx"), markdown = read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx");
  check("Markdown body Cards retain canonical adapter, header, content and counters through compatibility selectors", [basic, cardSelector(basic, "default"), cardSelector(basic, "omitted")].every(hasCanonicalMarkdownBodySection) &&
    [markdown, cardSelector(markdown, "default"), cardSelector(markdown, "omitted")].every(hasPanelMarkdownOwner) &&
    !hasCanonicalMarkdownBodySection(basic.replace('/ui/AdminCard"', '/ui/ParallelCard"')) &&
    !hasPanelMarkdownOwner(markdown.replace('/ui/AdminCard"', '/ui/ParallelCard"')));
  for (const [path, requiresGrid, scope] of [
    ["src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx", true, "forms"],
    ["src/app/admin/pages-blocks/menus/MenuItemForm.tsx", true, "all"],
    ["src/app/admin/pages-blocks/menus/MenuItemLinkSection.tsx", false, "all"],
  ] as const) {
    const source = read(path);
    check(`${path} accepts Card compatibility selectors while rejecting parallel owners and local submit actions`,
      [source, cardSelector(source, "default"), cardSelector(source, "omitted")].every(value => hasSharedPremiumMenuPresentation(value, requiresGrid, scope)) &&
      !hasSharedPremiumMenuPresentation(source.replace('/components/admin/ui"', '/components/admin/ParallelUI"'), requiresGrid, scope) &&
      (!requiresGrid || !hasSharedPremiumMenuPresentation(source.replaceAll("AdminActionButton", "button"), requiresGrid, scope)));
  }
  const menuShell = read("src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx");
  check("Menu collection chrome preserves reviewed density through the canonical Card owner and aliases", hasUnchangedMenuCollectionShell(menuShell) &&
    hasUnchangedMenuCollectionShell(menuShell.replace('<AdminCard className="p-3 md:p-6">', '<AdminCard presentation="premium" className="p-3 md:p-6">')) &&
    !hasUnchangedMenuCollectionShell(menuShell.replace('className="p-3 md:p-6"', 'className="p-5 md:p-6"')) &&
    !hasUnchangedMenuCollectionShell(menuShell.replace('from "../../../../components/admin/ui"', 'from "../../../../components/admin/ParallelUI"')));
  for (const kind of ["company", "password", "account"] as const) {
    const source = read(kind === "company" ? "src/app/admin/settings/general/CompanyIdentityPanel.tsx" : "src/app/admin/settings/security/SecuritySettingsClient.tsx");
    check(`${kind} preserves layout and native Actions across canonical Card aliases and rejects detached owners`,
      [source, cardSelector(source, "default"), cardSelector(source, "omitted")].every(value => hasFinalSettingsLayout(value, kind)) &&
      !hasFinalSettingsLayout(source.replace("  AdminCard,", ""), kind) &&
      !hasFinalSettingsLayout(source.replaceAll('columnRatio="3:2"', 'columnRatio="1:1"'), kind));
  }
  await verifyMetaListboxDescriptionPort();
  console.log(`Unified owner composition verification passed (${passed} affected source checks; no full specialized guard rerun).`);
  process.exit(0);
}

if (process.argv.includes("--settings-layout-refinement")) {
  verifySettingsLayoutRefinementSourceProof();
  console.log(`Settings layout refinement Presentation verification passed (${passed} affected checks; no family/full-guard rerun).`);
  process.exit(0);
}

if(process.argv.includes("--meta-manager")){
  await verifyMetaManagerSourceProof();
  console.log(`MetaManager Presentation verification passed (${passed} affected checks; unrelated families not executed).`);
  process.exit(0);
}

if (settingsFamilyOnly) {
  verifySettingsFamilySourceProof();
  console.log(`Settings family Presentation verification passed (${passed} affected checks; unrelated families not executed; no full-guard PASS claim).`);
  process.exit(0);
}

const sharedTabs = read("src/components/admin/ui/AdminModuleTabs.tsx");
const contentShell = read(
  "src/components/admin/content/editors/ContentEditorShell.tsx",
);
const aboutCta = read(
  "src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx",
);
const moduleEditorPresentation = read(
  "src/components/admin/page-blocks/ModuleEditorPresentation.tsx",
);

type RegisteredModuleEditor = (typeof ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST)[number] & {
  registryModuleKind: (typeof PAGE_MODULE_KINDS)[number];
};

const registeredModuleEditors = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
  (entry): entry is RegisteredModuleEditor =>
    "registryModuleKind" in entry && entry.registryModuleKind !== undefined,
);
const registeredModuleEditorKinds = registeredModuleEditors.map(
  (entry) => entry.registryModuleKind,
);
const discoveredModuleEditorRoutes = readdirSync(
  resolve(ROOT, "src/app/admin/pages-blocks/blocks"),
  { withFileTypes: true },
)
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(
        resolve(
          ROOT,
          "src/app/admin/pages-blocks/blocks",
          entry.name,
          "[id]",
          "page.tsx",
        ),
      ),
  )
  .map((entry) => entry.name)
  .sort();

function moduleEditorRegistrationDrift(input: {
  moduleKinds: readonly string[];
  registeredKinds: readonly string[];
  routeKinds: readonly string[];
}) {
  const expected = new Set(input.moduleKinds);
  const registered = new Set(input.registeredKinds);
  const routed = new Set(input.routeKinds);
  return {
    duplicateRegistrations:
      input.registeredKinds.length - registered.size,
    missingRegistrations: [...expected].filter((kind) => !registered.has(kind)),
    unknownRegistrations: [...registered].filter((kind) => !expected.has(kind)),
    missingRoutes: [...expected].filter((kind) => !routed.has(kind)),
    unregisteredRoutes: [...routed].filter((kind) => !expected.has(kind)),
  };
}

function registrationIsComplete(
  drift: ReturnType<typeof moduleEditorRegistrationDrift>,
) {
  return (
    drift.duplicateRegistrations === 0 &&
    drift.missingRegistrations.length === 0 &&
    drift.unknownRegistrations.length === 0 &&
    drift.missingRoutes.length === 0 &&
    drift.unregisteredRoutes.length === 0
  );
}

const moduleEditorRegistration = moduleEditorRegistrationDrift({
  moduleKinds: PAGE_MODULE_KINDS,
  registeredKinds: registeredModuleEditorKinds,
  routeKinds: discoveredModuleEditorRoutes,
});

check(
  "Page Module editor identities and routes reconcile bidirectionally with the canonical registry",
  registrationIsComplete(moduleEditorRegistration) &&
    registeredModuleEditors.every(
      (entry) =>
        entry.sourceFiles.length === 1 &&
        entry.sourceFiles[0] ===
          `src/app/admin/pages-blocks/blocks/${entry.registryModuleKind}/[id]/page.tsx`,
    ),
);

const futureEditorRegistration = moduleEditorRegistrationDrift({
  moduleKinds: PAGE_MODULE_KINDS,
  registeredKinds: registeredModuleEditorKinds,
  routeKinds: [...discoveredModuleEditorRoutes, "negative-fixture"],
});
check(
  "negative fixture: a future Page Module editor route without a canonical kind fails closed",
  !registrationIsComplete(futureEditorRegistration) &&
    futureEditorRegistration.unregisteredRoutes.includes("negative-fixture"),
);

function rootSourcesForEntry(entry: RegisteredModuleEditor) {
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: entry.sourceFiles,
    symbolAware: true,
  });
  const roots = [...graph].flatMap(([path, file]) => {
    const source = file.getFullText();
    return source.includes("<ModuleEditorHeader") &&
      source.includes("<ModuleEditorTabs")
      ? [{ path, source }]
      : [];
  });
  assert.equal(
    roots.length,
    1,
    `${entry.id} must reach exactly one executable Module Editor root`,
  );
  return { entry, graph, root: roots[0]! };
}

const registeredModuleEditorGraphs = registeredModuleEditors.map(
  rootSourcesForEntry,
);
const moduleEditorRootSources = registeredModuleEditorGraphs.map(
  ({ root }) => root,
);
const moduleEditorRootSet = new Set(
  moduleEditorRootSources.map(({ path }) => path),
);
const allAdminPresentationSources = [
  ...discoverSourceFiles("src/app/admin"),
  ...discoverSourceFiles("src/components/admin"),
];
const consumerSources = allAdminPresentationSources.flatMap((path) => {
  const source = read(path);
  return (source.includes("<AdminModuleTabs") ||
    source.includes("<ModuleEditorTabs")) &&
    path !== "src/components/admin/page-blocks/ModuleEditorPresentation.tsx"
    ? [{ path, source }]
    : [];
});

function tabsAreIndependent(path: string, source: string) {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let independent = true;

  function visit(node: ts.Node, ancestors: string[]) {
    if (ts.isJsxElement(node)) {
      const name = node.openingElement.tagName.getText(file);
      if (
        (name === "AdminModuleTabs" || name === "ModuleEditorTabs") &&
        ancestors.some((value) => value === "AdminCard" || value === "section")
      ) {
        independent = false;
      }
      for (const child of node.children) visit(child, [...ancestors, name]);
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(file);
      if (
        (name === "AdminModuleTabs" || name === "ModuleEditorTabs") &&
        ancestors.some((value) => value === "AdminCard" || value === "section")
      ) {
        independent = false;
      }
      return;
    }
    ts.forEachChild(node, (child) => visit(child, ancestors));
  }

  visit(file, []);
  return independent;
}

function moduleEditorMetadataPropsAreDelegated(path: string, source: string) {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let headerCount = 0;
  let tabsCount = 0;
  let delegated = true;

  function inspectOpeningElement(node: ts.JsxOpeningLikeElement) {
    const name = node.tagName.getText(file);
    if (name !== "ModuleEditorHeader" && name !== "ModuleEditorTabs") return;

    const attributeNames = new Set(
      node.attributes.properties
        .filter(ts.isJsxAttribute)
        .map((attribute) => attribute.name.getText(file)),
    );
    delegated = delegated && attributeNames.has("moduleKind");

    if (name === "ModuleEditorHeader") {
      headerCount += 1;
      delegated = delegated && attributeNames.has("entityName");
      delegated =
        delegated &&
        ["eyebrow", "title", "description"].every(
          (attribute) => !attributeNames.has(attribute),
        );
    } else {
      tabsCount += 1;
    }
  }

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) inspectOpeningElement(node.openingElement);
    if (ts.isJsxSelfClosingElement(node)) inspectOpeningElement(node);
    ts.forEachChild(node, visit);
  }

  visit(file);
  return { delegated, headerCount, tabsCount };
}

function hasCanonicalModuleSectionHeader(source: string) {
  const tree = ts.createSourceFile("AdminModuleTabs.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tabContract = tree.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === "AdminModuleTab");
  const tabShape = tabContract && ts.isIntersectionTypeNode(tabContract.type) ? tabContract.type.types.find(ts.isTypeLiteralNode) : undefined;
  const presentation = tabShape?.members.find((node): node is ts.PropertySignature => ts.isPropertySignature(node) && node.name.getText(tree) === "sectionHeaderPresentation");
  if (!presentation?.questionToken || !presentation.type || !ts.isUnionTypeNode(presentation.type) ||
    presentation.type.types.length !== 4 || presentation.type.types.map((node) => ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? node.literal.text : "").join("|") !== "default|control|panel|premium") return false;
  const header = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminModuleSectionHeader");
  const tabs = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminModuleTabs");
  if (!header?.body || !tabs?.body || !header.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return false;
  const argument = header.parameters[0];
  const contract = argument?.type && ts.isIntersectionTypeNode(argument.type) ? argument.type : undefined;
  const picked = contract?.types[0], headerOptions = contract?.types[1];
  const standalone = headerOptions && ts.isTypeLiteralNode(headerOptions) && headerOptions.members.length === 1 ? headerOptions.members[0] : undefined;
  if (header.parameters.length !== 1 || argument?.name.getText(tree) !== "tab" || contract?.types.length !== 2 || !picked || !ts.isTypeReferenceNode(picked) || picked.typeName.getText(tree) !== "Pick" || picked.typeArguments?.[0]?.getText(tree) !== "AdminModuleTab" || !standalone || !ts.isPropertySignature(standalone) || standalone.name.getText(tree) !== "standalone" || !standalone.questionToken || standalone.type?.kind !== ts.SyntaxKind.BooleanKeyword || tabShape?.members.some(node => node.name?.getText(tree) === "standalone")) return false;
  const legacyReturn = header.body.statements.find(ts.isReturnStatement);
  if (!legacyReturn) return false;
  const markup = header.body.getText(tree);
  const canonicalControl = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./AdminForm" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((binding) => binding.name.text === "AdminFormControlHeader" && !binding.propertyName));
  const identity = header.body.statements.flatMap((node) => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []).find((node) => node.name.getText(tree) === "sectionIdentity")?.initializer;
  const identityNode = identity && ts.isParenthesizedExpression(identity) ? identity.expression : identity;
  if (!canonicalControl || !identityNode || !ts.isJsxSelfClosingElement(identityNode) || identityNode.tagName.getText(tree) !== "AdminFormControlHeader") return false;
  const identityAttributes = identityNode.attributes.properties.filter(ts.isJsxAttribute);
  const identityValue = (name: string) => identityAttributes.find((node) => node.name.getText(tree) === name)?.initializer?.getText(tree);
  if (identityAttributes.length !== 4 || identityNode.attributes.properties.length !== 4 ||
    identityValue("presentation") !== '"leading-icon"' ||
    identityValue("title") !== '{<span role="heading" aria-level={2}>{tab.sectionHeading}</span>}' ||
    identityValue("description") !== "{tab.sectionDescription}" ||
    identityValue("icon") !== '{<AdminModuleTabIcon name={tab.icon ?? "section"} />}') return false;
  const delegated: ts.JsxSelfClosingElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "AdminModuleSectionHeader") delegated.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tabs.body);
  const tabSource = tabs.body.getText(tree);
  const spread = delegated[0]?.attributes.properties[0];
  return delegated.length === 1 && delegated[0]!.attributes.properties.length === 1 && spread !== undefined &&
    ts.isJsxSpreadAttribute(spread) && spread.expression.getText(tree) === "tab" &&
    markup.includes("return tab.sectionHeading ?") && markup.includes(": null") && markup.includes("data-admin-tab-section-heading={tab.id}") &&
    markup.includes('tab.sectionHeaderPresentation === "panel"') && markup.includes('tab.sectionHeaderPresentation === "premium"') &&
    markup.includes("tab.sectionHeaderClassName") && markup.match(/tab\.sectionSummary/g)?.length === 6 &&
    markup.match(/\{sectionIdentity\}/g)?.length === 3 && !/<h[1-6]\b|<svg\b/u.test(markup) &&
    !tabSource.includes("data-admin-tab-section-heading") && tabSource.indexOf("<AdminModuleSectionHeader") < tabSource.indexOf("data-admin-active-panel-context") &&
    tabSource.indexOf("data-admin-active-panel-context") < tabSource.indexOf("{tab.content}");
}

check(
  "the shared Tabs owner renders active section context after Section Hero and before domain content",
  sharedTabs.includes("activePanelContext?: ReactNode") &&
    sharedTabs.includes("data-admin-active-panel-context") &&
    hasCanonicalModuleSectionHeader(sharedTabs),
);
check(
  "Shared Section Header rejects parallel owners, missing Tabs delegation, marker drift and lost canonical identity or summary",
  !hasCanonicalModuleSectionHeader(sharedTabs.replace("export function AdminModuleSectionHeader", "function AdminModuleSectionHeader")) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replace("<AdminModuleSectionHeader {...tab} />", "<header />")) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replaceAll("data-admin-tab-section-heading={tab.id}", "data-parallel-section-heading={tab.id}")) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replaceAll("tab.sectionSummary", "undefined")) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replace('from "./AdminForm"', 'from "./ParallelForm"')) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replace('presentation="leading-icon"', 'presentation="compact-inline"')) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replace('title={<span role="heading"', 'title={<span className="text-xl" role="heading"')) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replace("description={tab.sectionDescription}", "description={null}")) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replaceAll("{sectionIdentity}", "{null}")) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replace('tab.sectionHeaderPresentation === "premium"', 'tab.sectionHeaderPresentation === "panel"')) &&
    !hasCanonicalModuleSectionHeader(sharedTabs.replace(' | "premium";', ';')),
);

function hasStandalonePremiumHeader(source: string, styles: string) {
  const tree = ts.createSourceFile("AdminModuleTabs.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const header = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminModuleSectionHeader");
  const variables = header?.body?.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []) ?? [];
  const defaultValue = variables.find(node => node.name.getText(tree) === "standalone")?.initializer;
  const premiumBranch = header?.body?.statements.find(node => ts.isIfStatement(node) && node.expression.getText(tree) === 'tab.sectionHeaderPresentation === "premium"');
  const markup = premiumBranch?.getText(tree) ?? "";
  const tokenNames = ["ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME", "ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME", "ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME"];
  return hasCanonicalModuleSectionHeader(source) && defaultValue?.getText(tree) === "tab.standalone ?? false" && tokenNames.every(name => tree.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.getText(tree) === '"../../../lib/admin/admin-ui-styles"' && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => binding.name.text === name && !binding.propertyName))) && markup.includes('? `relative ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME} ${ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME}`') && markup.includes(": ADMIN_PREMIUM_SECTION_HEADER_CLASS_NAME}") && styles.includes('"flex min-w-0 flex-wrap items-center justify-between gap-3"') && styles.includes('`relative -mx-3 -mt-3 mb-3 ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME} ${ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME}`');
}
const sectionHeaderStyles = read("src/lib/admin/admin-ui-styles.ts");
check("standalone Premium Header is an optional shared-owner composition preserving canonical identity, chrome and embedded margins", hasStandalonePremiumHeader(sharedTabs, sectionHeaderStyles));
check("standalone Header rejects default changes, unsupported contracts, detached chrome and lost embedded margins", !hasStandalonePremiumHeader(sharedTabs.replace("tab.standalone ?? false", "tab.standalone ?? true"), sectionHeaderStyles) && !hasStandalonePremiumHeader(sharedTabs.replace("standalone?: boolean", "standalone?: string"), sectionHeaderStyles) && !hasStandalonePremiumHeader(sharedTabs.replace("? `relative ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME} ${ADMIN_PREMIUM_SECTION_HEADER_CHROME_CLASS_NAME}`", "? `relative flex p-3`"), sectionHeaderStyles) && !hasStandalonePremiumHeader(sharedTabs, sectionHeaderStyles.replace("relative -mx-3 -mt-3 mb-3 ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME}", "relative ${ADMIN_PREMIUM_SECTION_HEADER_LAYOUT_CLASS_NAME}")));

const faqEditorPath = "src/components/admin/content/editors/article/FaqEditor.tsx";
const faqEditorSource = read(faqEditorPath);

function hasFaqFullSectionHeaders(source: string) {
  const faqEditorPath = "src/components/admin/content/editors/article/FaqEditor.tsx";
  const tree = ts.createSourceFile(faqEditorPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const cards = canonicalCardBindings(faqEditorPath, tree);
  const owners = new Set<string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) ||
      resolve(ROOT, dirname(faqEditorPath), `${node.moduleSpecifier.text}.tsx`) !== resolve(ROOT, "src/components/admin/ui/AdminModuleTabs.tsx")) continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if ((binding.propertyName ?? binding.name).text === "AdminModuleSectionHeader") owners.add(binding.name.text);
    }
  }
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const presentationType = nodes.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === "FaqEditorProps");
  const presentation = presentationType && ts.isTypeLiteralNode(presentationType.type)
    ? presentationType.type.members.find((node): node is ts.PropertySignature => ts.isPropertySignature(node) && node.name.getText(tree) === "presentation") : undefined;
  const editor = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "FaqEditor");
  const props = editor?.parameters[0]?.name;
  if (!presentation?.questionToken || presentation.type?.getText(tree) !== '"default" | "panel"' || !props || !ts.isObjectBindingPattern(props) ||
    !props.elements.some((node) => node.name.getText(tree) === "presentation" && node.initializer?.getText(tree) === '"default"') ||
    !source.includes('const panel = presentation === "panel";') || !tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
      normalizePath(resolve(ROOT, dirname(faqEditorPath), node.moduleSpecifier.text)) === normalizePath(resolve(ROOT, "src/lib/admin/admin-ui-styles")) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some((binding) => !binding.propertyName && binding.name.text === "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME"))) return false;
  const headers = nodes.filter(ts.isJsxSelfClosingElement).filter((node) => owners.has(node.tagName.getText(tree)));
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const property = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === name)?.initializer;
    return property && ts.isStringLiteral(property) ? property.text : property && ts.isJsxExpression(property) ? property.expression?.getText(tree) : undefined;
  };
  const declarations = new Map(nodes.filter(ts.isVariableDeclaration).flatMap((node) => ts.isIdentifier(node.name) && node.initializer ? [[node.name.text, node.initializer] as const] : []));
  type Element = ts.JsxElement | ts.JsxSelfClosingElement;
  const children = (input: ts.Node | undefined, panel: boolean, expanded: readonly string[] = []): Element[] => {
    if (!input) return [];
    if (ts.isParenthesizedExpression(input)) return children(input.expression, panel, expanded);
    if (ts.isJsxExpression(input)) return children(input.expression, panel, expanded);
    if (ts.isIdentifier(input) && declarations.has(input.text) && !expanded.includes(input.text)) return children(declarations.get(input.text), panel, [...expanded, input.text]);
    if (ts.isConditionalExpression(input)) {
      const condition = input.condition.getText(tree);
      return condition === "panel" || condition === "!panel" ? children((condition === "panel" ? panel : !panel) ? input.whenTrue : input.whenFalse, panel, expanded) : [];
    }
    if (ts.isJsxFragment(input)) return input.children.flatMap((node) => children(node, panel, expanded));
    return ts.isJsxElement(input) || ts.isJsxSelfClosingElement(input) ? [input] : [];
  };
  const bodyChildren = (input: Element, panel: boolean) => ts.isJsxElement(input) ? input.children.flatMap((node) => children(node, panel)) : [];
  const opening = (input: Element) => ts.isJsxElement(input) ? input.openingElement : input;
  const tag = (input: Element) => opening(input).tagName.getText(tree);
  const selectedValue = (input: Element, name: string, panel: boolean) => {
    const initializer = opening(input).attributes.properties.find((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === name)?.initializer;
    let expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer;
    if (expression && ts.isConditionalExpression(expression) && expression.condition.getText(tree) === "panel") expression = panel ? expression.whenTrue : expression.whenFalse;
    return expression && ts.isStringLiteral(expression) ? expression.text : expression?.getText(tree);
  };
  return headers.length === 3 && [
    ["topic-faq-list", "الأسئلة الشائعة (FAQ)", "faq"],
    ["topic-faq-settings", "إعدادات العرض", "settings"],
    ["topic-faq-preview", "معاينة الشكل في الصفحة", "overview"],
  ].every(([id, heading, icon]) => {
    const header = headers.find((node) => value(node, "id") === id);
    if (!header || value(header, "sectionHeading") !== heading || value(header, "icon") !== icon ||
      value(header, "sectionHeaderPresentation") !== 'panel ? "premium" : undefined' ||
      value(header, "sectionHeaderClassName") !== "panel ? ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME : undefined" ||
      header.attributes.properties.some((node) => !ts.isJsxAttribute(node) || !["id", "sectionHeading", "icon", "sectionDescription", "sectionSummary", "sectionHeaderPresentation", "sectionHeaderClassName"].includes(node.name.getText(tree)))) return false;
    const marker = id === "topic-faq-list" ? "data-topic-faq-list" : id === "topic-faq-settings" ? "data-topic-faq-settings" : "data-topic-faq-preview";
    const group = nodes.filter(ts.isJsxElement).find((node) => node.openingElement.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === marker));
    if (!group) return false;
    return !/\b(?:mt-|space-y-)/u.test(value(group.openingElement, "className") ?? "") && [false, true].every((panel) => {
      const content = bodyChildren(group, panel);
      if (selectedValue(header, "sectionHeaderPresentation", panel) !== (panel ? "premium" : "undefined") ||
        selectedValue(header, "sectionHeaderClassName", panel) !== (panel ? "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME" : "undefined")) return false;
      if (panel) {
        const card = content[0];
        if (content.length !== 1 || !card || !cards.has(tag(card)) || selectedValue(card, "className", panel) !== "min-w-0 p-3") return false;
        const cardContent = bodyChildren(card, panel);
        return cardContent[0] === header && cardContent.filter((node) => owners.has(tag(node))).length === 1 &&
          (id !== "topic-faq-settings" || cardContent.length === 2 && tag(cardContent[1]!) === "AdminFormGrid" && value(opening(cardContent[1]!), "columns") === "1" && value(opening(cardContent[1]!), "className") === undefined);
      }
      if (content.length !== 2 || content[0] !== header || !content[1]) return false;
      const body = content[1];
      return id === "topic-faq-settings"
        ? tag(body) === "AdminFormGrid" && value(opening(body), "columns") === "1" && value(opening(body), "className") === undefined
        : cards.has(tag(body)) && selectedValue(body, "className", panel) === (id === "topic-faq-list" ? "p-4 md:p-5" : "p-4") && !bodyChildren(body, panel).includes(header);
    }) && value(header, "sectionDescription") === undefined &&
      (id === "topic-faq-list"
        ? Boolean(value(header, "sectionSummary")?.includes("{filledCount}") && value(header, "sectionSummary")?.includes("{items.length}"))
        : value(header, "sectionSummary") === undefined);
  });
}

function hasPremiumControlledFaqSwitches(source: string) {
  const tree = ts.createSourceFile(faqEditorPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(tree.statements.flatMap((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
    resolve(ROOT, dirname(faqEditorPath), `${node.moduleSpecifier.text}.tsx`) === resolve(ROOT, "src/components/admin/ui/AdminFormSwitch.tsx") && node.importClause?.name ? [node.importClause.name.text] : []));
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const property = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === name)?.initializer;
    return property && ts.isStringLiteral(property) ? property.text : property && ts.isJsxExpression(property) ? property.expression?.getText(tree) : undefined;
  };
  const adapter = nodes.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "FaqDisplaySwitch");
  const returned = adapter?.body?.statements.find(ts.isReturnStatement)?.expression;
  const call = returned && ts.isParenthesizedExpression(returned) ? returned.expression : returned;
  if (!call || !ts.isJsxSelfClosingElement(call) || !names.has(call.tagName.getText(tree)) ||
    value(call, "presentation") !== "premium" || value(call, "name") !== "name" || value(call, "label") !== "label" || value(call, "checked") !== "checked" ||
    value(call, "onChange") !== "(event) => onChange(event.target.checked)" ||
    call.attributes.properties.some((node) => !ts.isJsxAttribute(node) || !["name", "label", "presentation", "checked", "onChange", "wrapLabel"].includes(node.name.getText(tree)))) return false;
  const calls = nodes.filter(ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText(tree) === "FaqDisplaySwitch");
  return calls.length === 2 && [
    ["show_faq_on_page", "showSection", "setShowSection"],
    ["show_faq_title_on_page", "showTitle", "setShowTitle"],
  ].every(([name, checked, onChange]) => calls.some((node) => value(node, "name") === name && value(node, "checked") === checked && value(node, "onChange") === onChange)) &&
    source.includes("useState(defaultVisible !== false)") && source.includes("useState(defaultTitleVisible !== false)");
}

check(
  "FAQ explicitly selects three embedded Premium Charcoal Headers and p-3 Cards only for panel while preserving default sibling composition, summary and single content gap",
  hasFaqFullSectionHeaders(faqEditorSource),
);
check(
  "negative FAQ header fixtures reject parallel imports, changed defaults, missing panel ownership, missing headings, moved summaries and changed default or panel spacing",
  !hasFaqFullSectionHeaders(faqEditorSource.replace('from "../../../ui/AdminModuleTabs"', 'from "../../../ui/ParallelSectionHeader"')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace("<AdminModuleSectionHeader", "<AdminFormControlHeader")) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('presentation = "default"', 'presentation = "panel"')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('panel ? "premium" : undefined', 'panel ? "default" : undefined')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('panel ? ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME : undefined', 'ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('  ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,', '  ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME as ParallelCharcoal,')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('{panel ? null : faqListHeader}', '{faqListHeader}')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('{panel ? faqListHeader : null}', '{null}')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('sectionHeading="إعدادات العرض"', 'sectionHeading=""')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace("sectionSummary=", "parallelSummary=")) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('panel ? "min-w-0 p-3" : "p-4 md:p-5"', 'panel ? "min-w-0 p-3" : "mt-4 p-4 md:p-5"')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('panel ? "min-w-0 p-3" : "p-4 md:p-5"', 'panel ? "min-w-0 p-4" : "p-4 md:p-5"')) &&
    !hasFaqFullSectionHeaders(faqEditorSource.replace('<AdminCard presentation="premium" className="min-w-0 p-3">{faqSettingsContent}</AdminCard>', '{faqSettingsContent}')),
);

function hasFaqPanelAdoption(path: string, source: string) {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = new Set(tree.statements.flatMap((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.name &&
    normalizePath(resolve(ROOT, dirname(path), node.moduleSpecifier.text)) === normalizePath(resolve(ROOT, "src/components/admin/content/editors/article/FaqEditor")) ? [node.importClause.name.text] : []));
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const calls = nodes.filter(ts.isJsxSelfClosingElement).filter((node) => owners.has(node.tagName.getText(tree)));
  const tab = nodes.filter(ts.isObjectLiteralExpression).find((node) => node.properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(tree) === "id" && ts.isStringLiteral(property.initializer) && property.initializer.text === "faq"));
  if (calls.length !== 1 || !tab || tab.properties.some((property) => ts.isPropertyAssignment(property) && ["sectionHeading", "sectionDescription"].includes(property.name.getText(tree)))) return false;
  const propertyValue = (name: string) => tab.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(tree) === name)?.initializer?.getText(tree);
  if (propertyValue("navigationLabel") !== '"الأسئلة"' || propertyValue("icon") !== '"faq" as const') return false;
  const content = tab.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(tree) === "content")?.initializer;
  const call = calls[0]!;
  const presentation = call.attributes.properties.find((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === "presentation")?.initializer;
  return Boolean(content && (content === call || ts.isParenthesizedExpression(content) && content.expression === call) && presentation && ts.isStringLiteral(presentation) && presentation.text === "panel");
}
const faqConsumerPaths = ["src/components/admin/content/editors/ArticleCreateEditor.tsx", "src/components/admin/content/editors/ArticleEditor.tsx"];
check("Article Create and Edit explicitly adopt FAQ panel once with navigation retained and embedded Section Headers owning the section context", faqConsumerPaths.every((path) => hasFaqPanelAdoption(path, read(path))));
check("negative FAQ adoption fixtures reject omitted or parallel owners, changed presentation and duplicate outer Section Header context", faqConsumerPaths.every((path) => {
  const source = read(path);
  return !hasFaqPanelAdoption(path, source.replace('from "./article/FaqEditor"', 'from "./article/ParallelFaqEditor"')) &&
    !hasFaqPanelAdoption(path, source.replace(/(<FaqEditor\b\s*)presentation="panel"/u, "$1presentation=\"default\"")) &&
    !hasFaqPanelAdoption(path, source.replace(/(<FaqEditor\b\s*)presentation="panel"/u, "$1")) &&
    !hasFaqPanelAdoption(path, source.replace('navigationLabel: "الأسئلة",', 'navigationLabel: "",')) &&
    !hasFaqPanelAdoption(path, source.replace('navigationLabel: "الأسئلة",', 'navigationLabel: "الأسئلة", sectionHeading: "عنوان مكرر",'));
}));
check(
  "FAQ display uses two independent canonical Premium switch Cards with unchanged controlled values, names, callbacks and nullable defaults",
  hasPremiumControlledFaqSwitches(faqEditorSource),
);
check(
  "negative FAQ switch fixtures reject legacy presentation, unbound owners, uncontrolled fields, changed names and detached controlled callbacks",
  !hasPremiumControlledFaqSwitches(faqEditorSource.replace('presentation="premium"', 'presentation="default"')) &&
    !hasPremiumControlledFaqSwitches(faqEditorSource.replace('from "../../../ui/AdminFormSwitch"', 'from "../../../ui/ParallelSwitch"')) &&
    !hasPremiumControlledFaqSwitches(faqEditorSource.replace("checked={checked}", "defaultChecked={checked}")) &&
    !hasPremiumControlledFaqSwitches(faqEditorSource.replace('name="show_faq_on_page"', 'name="parallel_faq_visibility"')) &&
    !hasPremiumControlledFaqSwitches(faqEditorSource.replace("onChange(event.target.checked)", "onChange(!checked)")),
);

function hasFaqCanonicalLabelInset(source: string, fieldSource: string) {
  const tree = ts.createSourceFile(faqEditorPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const canonicalHelper = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
    normalizePath(resolve(ROOT, dirname(faqEditorPath), node.moduleSpecifier.text)) === normalizePath(resolve(ROOT, "src/lib/admin/admin-ui-styles")) &&
    node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some((binding) => !binding.propertyName && binding.name.text === "adminFormLabelClassName"));
  const fields = nodes.filter(ts.isJsxElement).filter((node) => node.openingElement.tagName.getText(tree) === "AdminFormField");
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name,
  )?.initializer?.getText(tree);
  if (!canonicalHelper || fields.length !== 2 || !["السؤال", "الإجابة"].every((label) => fields.some((field) =>
    attribute(field.openingElement, "label") === `"${label}"` &&
    attribute(field.openingElement, "labelClassName") === "{panel ? adminFormLabelClassName({ textInset: true }) : undefined}" &&
    field.openingElement.attributes.properties.length === 2))) return false;
  const nativeFields = nodes.filter(ts.isJsxSelfClosingElement).filter((node) =>
    ["input", "textarea"].includes(node.tagName.getText(tree)) && attribute(node, "onChange") !== undefined,
  );
  if (nativeFields.length !== 2 || !nativeFields.every((field) => {
    const question = field.tagName.getText(tree) === "input";
    return attribute(field, "name") === (question ? '"faq_question"' : '"faq_answer"') &&
      attribute(field, "className") === (question ? "{adminFormFieldClassName()}" : '{adminFormTextareaClassName("resize-y leading-7")}') &&
      attribute(field, "value") === (question ? "{item.question}" : "{item.answer}") &&
      attribute(field, "onChange") === (question ? '{(event) => updateItem(item.id, "question", event.target.value)}' : '{(event) => updateItem(item.id, "answer", event.target.value)}') &&
      (question || attribute(field, "rows") === "{4}") && attribute(field, "style") === undefined;
  })) return false;

  const fieldTree = ts.createSourceFile("AdminForm.tsx", fieldSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const props = fieldTree.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === "AdminFormFieldProps");
  const port = props && ts.isTypeLiteralNode(props.type) ? props.type.members.find((node): node is ts.PropertySignature =>
    ts.isPropertySignature(node) && node.name.getText(fieldTree) === "labelClassName",
  ) : undefined;
  const owner = fieldTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormField");
  const markup = owner?.body?.getText(fieldTree) ?? "";
  return Boolean(port?.questionToken && port.type?.getText(fieldTree) === "string" &&
    markup.includes('labelClassName ?? adminFormLabelClassName({ textInset: true })') &&
    markup.includes('<span data-admin-form-label-text>') &&
    markup.includes('{required ? <> <span className="text-red-400">*</span></> : null}') &&
    markup.includes('<label data-admin-form-field=""') &&
    markup.includes('<div data-admin-form-field-control="" className="min-w-0">{children}</div>') &&
    markup.includes('{hint ? <span className={adminFormHintClassName({ textInset: true })}>{hint}</span> : null}') &&
    !markup.includes('presentation ==='));
}

const formFieldOwnerSource = read("src/components/admin/ui/AdminForm.tsx");
check("FAQ title rows retain their explicit label port and native controls through the unified Form Field default", hasFaqCanonicalLabelInset(faqEditorSource, formFieldOwnerSource));
check("negative FAQ label fixtures reject local alignment, missing opt-in, changed control padding, required shared ports, lost markers and changed field spacing",
  !hasFaqCanonicalLabelInset(faqEditorSource.replace('adminFormLabelClassName({ textInset: true })', 'adminFormLabelClassName()'), formFieldOwnerSource) &&
  !hasFaqCanonicalLabelInset(faqEditorSource.replace('panel ? adminFormLabelClassName({ textInset: true }) : undefined', 'adminFormLabelClassName({ textInset: true })'), formFieldOwnerSource) &&
  !hasFaqCanonicalLabelInset(faqEditorSource.replace('labelClassName={panel ? adminFormLabelClassName({ textInset: true }) : undefined}', 'labelClassName="ps-3"'), formFieldOwnerSource) &&
  !hasFaqCanonicalLabelInset(faqEditorSource.replace('className={adminFormFieldClassName()}', 'className={adminFormFieldClassName("pr-3")}'), formFieldOwnerSource) &&
  !hasFaqCanonicalLabelInset(faqEditorSource, formFieldOwnerSource.replace('labelClassName?: string;', 'labelClassName: string;')) &&
  !hasFaqCanonicalLabelInset(faqEditorSource, formFieldOwnerSource.replace(' data-admin-form-label-text', '')) &&
  !hasFaqCanonicalLabelInset(faqEditorSource, formFieldOwnerSource.replace('<div data-admin-form-field-control="" className="min-w-0">{children}</div>', '<div>{children}</div>')));

function hasFaqPreviewWithoutDuplicateTitle(source: string) {
  const tree = ts.createSourceFile(faqEditorPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const preview = nodes.filter(ts.isJsxElement).find((node) => node.openingElement.attributes.properties.some((property) =>
    ts.isJsxAttribute(property) && property.name.getText(tree) === "data-topic-faq-preview",
  ));
  if (!preview) return false;
  const markup = preview.getText(tree);
  return !markup.includes("showTitle") && !markup.includes("الأسئلة الشائعة</") && markup.includes('<div className="space-y-2">') &&
    markup.includes("{panel ? null : faqPreviewHeader}") && markup.includes("{panel ? faqPreviewHeader : null}") &&
    markup.includes("!showSection") && markup.includes("previewItems.map((item, index)") &&
    markup.includes("{item.question || `سؤال رقم ${index + 1}`}") && markup.includes("index === 0 && item.answer") &&
    hasPremiumControlledFaqSwitches(source);
}
check("FAQ admin preview keeps its canonical header and question-answer list without a duplicate title or title-conditioned gap while both visibility switches retain persistence", hasFaqPreviewWithoutDuplicateTitle(faqEditorSource));
check("negative FAQ preview fixtures reject a restored duplicate title or empty title gap, removed questions and detached title visibility state",
  !hasFaqPreviewWithoutDuplicateTitle(faqEditorSource.replace('<div className="space-y-2">', '<div className="space-y-2"><p>الأسئلة الشائعة</p>')) &&
  !hasFaqPreviewWithoutDuplicateTitle(faqEditorSource.replace('<div className="space-y-2">', '<div className={showTitle ? "mt-3 space-y-2" : "space-y-2"}>')) &&
  !hasFaqPreviewWithoutDuplicateTitle(faqEditorSource.replace('previewItems.map((item, index)', 'items.map((item, index)')) &&
  !hasFaqPreviewWithoutDuplicateTitle(faqEditorSource.replace('checked={showTitle}', 'checked={true}')));

const formGridOwnerSource = read("src/components/admin/ui/AdminFormRuntime.tsx");
function hasBoundedEqualHeightGrid(source: string) {
  const tree = ts.createSourceFile("AdminFormRuntime.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const grid = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormGrid");
  const binding = grid?.parameters[0]?.name;
  if (!grid?.body || !binding || !ts.isObjectBindingPattern(binding) ||
    !binding.elements.some((node) => node.name.getText(tree) === "presentation" && node.initializer?.getText(tree) === '"plain"') ||
    !binding.elements.some((node) => node.name.getText(tree) === "columns" && node.initializer?.getText(tree) === "2")) return false;
  const declarations = grid.body.statements.filter(ts.isVariableStatement).flatMap((node) => [...node.declarationList.declarations]);
  const presentation = declarations.find((node) => node.name.getText(tree) === "presentationClassName")?.initializer;
  const constants = new Map(declarations.map(node => [node.name.getText(tree), node.initializer]));
  const resolveLiteral = (node: ts.Expression | undefined, seen = new Set<string>()): string | undefined => {
    if (!node) return undefined;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isIdentifier(node)) { if (seen.has(node.text)) return undefined; return resolveLiteral(constants.get(node.text), new Set([...seen, node.text])); }
    if (ts.isTemplateExpression(node)) { let text = node.head.text; for (const span of node.templateSpans) { const part = resolveLiteral(span.expression, seen); if (part === undefined) return undefined; text += part + span.literal.text; } return text; }
    return undefined;
  };
  const branches = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isConditionalExpression(node)) {
      const resolved = resolveLiteral(node.whenTrue);
      if (resolved !== undefined) branches.set(node.condition.getText(tree), resolved);
      if (node.condition.getText(tree) === 'presentation === "aligned-fields"' && ts.isConditionalExpression(node.whenTrue) && node.whenTrue.condition.getText(tree) === "fieldContainers" && node.whenTrue.whenTrue.getText(tree) === '"items-stretch"' && ts.isStringLiteral(node.whenTrue.whenFalse)) branches.set(node.condition.getText(tree), node.whenTrue.whenFalse.text);
    }
    ts.forEachChild(node, visit);
  };
  if (!presentation) return false;
  visit(presentation);
  return branches.get('presentation === "control-cards"') === "items-stretch [&>*]:rounded-2xl [&>*]:border [&>*]:border-white/10 [&>*]:bg-[#05070B] [&>*]:p-3" &&
    branches.get('presentation === "aligned-fields"') === "items-start [&>*]:row-span-3 [&>*]:grid [&>*]:grid-rows-subgrid [&>*]:items-start [&>*]:gap-2 [&>*]:space-y-0 [&>*>*]:mt-0" &&
    branches.get('presentation === "equal-height-columns"') === "items-stretch [&>*]:self-stretch" &&
    grid.body.statements.some((node) => ts.isReturnStatement(node) && node.expression?.getText(tree).includes("${presentationClassName}"));
}

function hasCanonicalFaqEqualHeightColumns(source: string) {
  const tree = ts.createSourceFile(faqEditorPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const runtime = normalizePath(resolve(ROOT, "src/components/admin/ui/AdminFormRuntime"));
  const barrel = normalizePath(resolve(ROOT, "src/components/admin/ui"));
  const barrelTree = ts.createSourceFile("index.ts", read("src/components/admin/ui/index.ts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const exportedGrid = barrelTree.statements.some((node) => ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./AdminFormRuntime" && node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.some((binding) => (binding.propertyName ?? binding.name).text === "AdminFormGrid" && binding.name.text === "AdminFormGrid"));
  const owners = new Set(tree.statements.flatMap((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) return [];
    const imported = normalizePath(resolve(ROOT, dirname(faqEditorPath), node.moduleSpecifier.text));
    const bindings = node.importClause?.namedBindings;
    return (imported === runtime || (imported === barrel && exportedGrid)) && bindings && ts.isNamedImports(bindings)
      ? bindings.elements.filter((binding) => !binding.isTypeOnly && (binding.propertyName ?? binding.name).text === "AdminFormGrid").map((binding) => binding.name.text) : [];
  }));
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const property = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === name)?.initializer;
    return property && ts.isStringLiteral(property) ? property.text : property && ts.isJsxExpression(property) ? property.expression?.getText(tree) : undefined;
  };
  const root = nodes.filter(ts.isJsxElement).find((node) => node.openingElement.tagName.getText(tree) === "section" && value(node.openingElement, "id") === "topic-faq-editor");
  const grids = root?.children.filter(ts.isJsxElement).filter((node) => owners.has(node.openingElement.tagName.getText(tree))) ?? [];
  const outer = grids[0];
  if (grids.length !== 1 || !outer || value(outer.openingElement, "columns") !== "1" || value(outer.openingElement, "presentation") !== "equal-height-columns" ||
    value(outer.openingElement, "className") !== "gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.45fr)]" ||
    outer.openingElement.attributes.properties.some((node) => !ts.isJsxAttribute(node) || !["columns", "presentation", "className"].includes(node.name.getText(tree)))) return false;
  const columns = outer.children.filter((node): node is ts.JsxElement | ts.JsxSelfClosingElement => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node));
  if (columns.length !== 2 || !columns.every(ts.isJsxElement)) return false;
  const [list, aside] = columns as ts.JsxElement[];
  const forcedInnerGeometry = nodes.filter(ts.isJsxAttribute).some((node) => {
    if (node.name.getText(tree) === "style") return true;
    if (node.name.getText(tree) !== "className" || !node.initializer) return false;
    const classes = ts.isStringLiteral(node.initializer) ? node.initializer.text : node.initializer.getText(tree);
    return /(?:^|\s)(?:[\w-]+:)*(?:h-|min-h-|max-h-|self-stretch\b|items-stretch\b)|\[&[^\]]*\]:(?:h-|min-h-|self-stretch|items-stretch)/u.test(classes);
  });
  return list!.openingElement.tagName.getText(tree) === "div" && value(list!.openingElement, "className") === "min-w-0 xl:col-start-2 xl:row-start-1" &&
    list!.openingElement.attributes.properties.some((node) => ts.isJsxAttribute(node) && node.name.getText(tree) === "data-topic-faq-list") &&
    aside!.openingElement.tagName.getText(tree) === "aside" && value(aside!.openingElement, "className") === "space-y-4 xl:col-start-1 xl:row-start-1" &&
    nodes.filter(ts.isJsxElement).filter((node) => node !== outer && owners.has(node.openingElement.tagName.getText(tree))).every((node) => value(node.openingElement, "columns") === "1" && value(node.openingElement, "presentation") === undefined) &&
    !forcedInnerGeometry;
}
check("equal-height columns stay selectable at the existing Grid owner with direct-child-only stretch and unchanged existing defaults/branches", hasBoundedEqualHeightGrid(formGridOwnerSource));
check("negative Grid fixtures reject changed defaults, descendant stretching and fixed column heights", !hasBoundedEqualHeightGrid(formGridOwnerSource.replace('presentation = "plain"', 'presentation = "equal-height-columns"')) && !hasBoundedEqualHeightGrid(formGridOwnerSource.replace('items-stretch [&>*]:self-stretch', 'items-stretch [&_*]:self-stretch')) && !hasBoundedEqualHeightGrid(formGridOwnerSource.replace('items-stretch [&>*]:self-stretch', 'items-stretch [&>*]:h-96')));
check("FAQ opts its canonical outer Grid into equal-height columns while preserving its two placements and natural inner layouts", hasCanonicalFaqEqualHeightColumns(faqEditorSource));
check("negative FAQ column fixtures reject parallel/local grids, missing opt-in, extra columns, changed placement, forced inner height and descendant stretch", !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('from "../../../ui"', 'from "../../../ui/ParallelGrid"')) && !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('presentation="equal-height-columns"', 'presentation="plain"')) && !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('gap-5 xl:grid-cols-', 'grid gap-5 xl:items-start xl:grid-cols-')) && !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('<aside className=', '<section /><aside className=')) && !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('min-w-0 xl:col-start-2', 'min-w-0 xl:col-start-1')) && !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('data-topic-faq-list', 'style={{height: 500}} data-topic-faq-list')) && !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('panel ? "min-w-0 p-3" : "p-4 md:p-5"', 'panel ? "min-w-0 h-full p-3" : "p-4 md:p-5"')) && !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('gap-5 xl:grid-cols-', 'gap-5 [&_*]:self-stretch xl:grid-cols-')) && !hasCanonicalFaqEqualHeightColumns(faqEditorSource.replace('<AdminFormGrid columns={1}>', '<AdminFormGrid columns={1} presentation="equal-height-columns">')));

function canonicalSectionBindings(path: string, tree: ts.SourceFile) {
  const names = new Set<string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const owner = normalizePath(resolve(ROOT, dirname(path), node.moduleSpecifier.text));
    if (!["src/components/admin/ui", "src/components/admin/ui/AdminForm"].some(file => owner === normalizePath(resolve(ROOT, file)))) continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if (!binding.isTypeOnly && (binding.propertyName ?? binding.name).text === "AdminFormSection") names.add(binding.name.text);
    }
  }
  return names;
}
function canonicalCardBindings(path: string, tree: ts.SourceFile) {
  const names = new Set<string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const owner = normalizePath(resolve(ROOT, dirname(path), node.moduleSpecifier.text));
    if (owner === normalizePath(resolve(ROOT, "src/components/admin/ui/AdminCard")) && node.importClause?.name) names.add(node.importClause.name.text);
    const bindings = node.importClause?.namedBindings;
    if (owner === normalizePath(resolve(ROOT, "src/components/admin/ui")) && bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) if (!binding.isTypeOnly && (binding.propertyName ?? binding.name).text === "AdminCard") names.add(binding.name.text);
    }
  }
  return names;
}
function canonicalPanelSectionCard(source: string) {
  const tree = ts.createSourceFile("AdminForm.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const card = tree.statements.filter(ts.isImportDeclaration).find(node => ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === "./AdminCard" && !node.importClause?.isTypeOnly)?.importClause?.name?.text;
  const section = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormSection");
  const returned = section?.body?.statements.find(ts.isReturnStatement)?.expression;
  let element = returned;
  while (element && ts.isParenthesizedExpression(element)) element = element.expression;
  if (!card || !element || !ts.isJsxElement(element) || element.openingElement.tagName.getText(tree) !== card ||
      element.openingElement.attributes.properties.some(ts.isJsxSpreadAttribute)) return undefined;
  const children = element.children.filter(node => !ts.isJsxText(node) || node.text.trim());
  const forwarded = section?.body?.statements.some(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(value => value.name.getText(tree) === "sectionHeader" && value.initializer && ts.isBinaryExpression(value.initializer) && value.initializer.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && value.initializer.left.getText(tree) === "header"));
  return forwarded && children.length === 2 &&
    children.every((node, index) => ts.isJsxExpression(node) && node.expression && ts.isIdentifier(node.expression) && node.expression.text === ["sectionHeader", "children"][index])
    ? element.openingElement : undefined;
}
function fullSectionHeadersStayOutsideCards(path: string, source: string, inheritedPremiumCard = false, sectionSource = formFieldOwnerSource) {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const headers = new Set<string>();
  const cards = new Set<string>();
  const sections = canonicalSectionBindings(path, tree);
  const delegatedCard = sections.size ? canonicalPanelSectionCard(sectionSource) : undefined;
  if (path === "src/components/admin/ui/AdminModuleTabs.tsx") headers.add("AdminModuleSectionHeader");
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const modulePath = normalizePath(resolve(ROOT, dirname(path), node.moduleSpecifier.text));
    if (modulePath === normalizePath(resolve(ROOT, "src/components/admin/ui/AdminCard")) && node.importClause?.name) cards.add(node.importClause.name.text);
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      const exported = (binding.propertyName ?? binding.name).text;
      if (exported === "AdminModuleSectionHeader" && modulePath === normalizePath(resolve(ROOT, "src/components/admin/ui/AdminModuleTabs"))) headers.add(binding.name.text);
      if (exported === "AdminCard" && modulePath === normalizePath(resolve(ROOT, "src/components/admin/ui"))) cards.add(binding.name.text);
    }
  }
  let count = 0;
  let nested = false;
  const isJsxValue = (node: ts.Node): boolean => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node) ||
    ts.isParenthesizedExpression(node) && isJsxValue(node.expression) || ts.isConditionalExpression(node) && (isJsxValue(node.whenTrue) || isJsxValue(node.whenFalse));
  const declarations = new Map<string, ts.Expression>();
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isJsxValue(node.initializer)) declarations.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  };
  collect(tree);
  const literal = (node: ts.JsxOpeningLikeElement, name: string, selectors: ReadonlyMap<string, boolean>) => {
    const value = node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name)?.initializer;
    let expression = value && ts.isJsxExpression(value) ? value.expression : value;
    while (expression && ts.isConditionalExpression(expression) && ts.isIdentifier(expression.condition)) {
      const selected = selectors.get(expression.condition.text);
      if (selected === undefined) return undefined;
      expression = selected ? expression.whenTrue : expression.whenFalse;
    }
    return expression && ts.isStringLiteral(expression) ? expression.text : undefined;
  };
  const inspectHeader = (node: ts.JsxOpeningLikeElement, cardStack: readonly ts.JsxOpeningLikeElement[], selectors: ReadonlyMap<string, boolean>) => {
    count++;
    const nearestCard = cardStack[cardStack.length - 1];
    nested ||= ["panel", "premium"].includes(literal(node, "sectionHeaderPresentation", selectors) ?? "")
      ? !nearestCard && !inheritedPremiumCard
      : cardStack.length > 0 || inheritedPremiumCard;
  };
  const visit = (node: ts.Node, cardStack: readonly ts.JsxOpeningLikeElement[], expanding: readonly string[] = [], selectors: ReadonlyMap<string, boolean> = new Map()) => {
    if (ts.isVariableDeclaration(node) && node.initializer && isJsxValue(node.initializer)) return;
    if (ts.isConditionalExpression(node) && ts.isIdentifier(node.condition)) {
      const name = node.condition.text;
      const selected = selectors.get(name);
      if (selected !== undefined) visit(selected ? node.whenTrue : node.whenFalse, cardStack, expanding, selectors);
      else {
        visit(node.whenTrue, cardStack, expanding, new Map([...selectors, [name, true]]));
        visit(node.whenFalse, cardStack, expanding, new Map([...selectors, [name, false]]));
      }
      return;
    }
    const identifier = ts.isJsxExpression(node) && node.expression && ts.isIdentifier(node.expression) ? node.expression : ts.isIdentifier(node) ? node : undefined;
    if (identifier) {
      const name = identifier.text;
      const value = declarations.get(name);
      if (value && !expanding.includes(name)) { visit(value, cardStack, [...expanding, name], selectors); return; }
    }
    if (ts.isJsxElement(node)) {
      const name = node.openingElement.tagName.getText(tree);
      if (headers.has(name)) inspectHeader(node.openingElement, cardStack, selectors);
      if (sections.has(name)) {
        const delegatedStack = delegatedCard ? [...cardStack, delegatedCard] : cardStack;
        for (const property of node.openingElement.attributes.properties) {
          const headerSlot = ts.isJsxAttribute(property) && property.name.getText(tree) === "header";
          visit(property, headerSlot ? delegatedStack : cardStack, expanding, selectors);
        }
        for (const child of node.children) visit(child, delegatedStack, expanding, selectors);
        return;
      }
      const nextStack = cards.has(name) ? [...cardStack, node.openingElement] : cardStack;
      ts.forEachChild(node.openingElement.attributes, (child) => visit(child, nextStack, expanding, selectors));
      for (const child of node.children) visit(child, nextStack, expanding, selectors);
      return;
    }
    if (ts.isJsxSelfClosingElement(node) && headers.has(node.tagName.getText(tree))) inspectHeader(node, cardStack, selectors);
    ts.forEachChild(node, (child) => visit(child, cardStack, expanding, selectors));
  };
  visit(tree, []);
  return count > 0 && !nested;
}
const directFullSectionHeaderSources = allAdminPresentationSources.flatMap((path) => {
  const source = read(path);
  return source.includes("<AdminModuleSectionHeader") ? [{ path, source }] : [];
});
const mediaContentOwnerPath = "src/components/admin/content/editors/media/MediaContentForm.tsx";
const mediaContentOwnerSource = read(mediaContentOwnerPath);
function resolveMediaVideoPremiumSlot(source: string) {
  const tree = ts.createSourceFile(mediaContentOwnerPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); }; visit(tree);
  const imports = new Map(tree.statements.filter(ts.isImportDeclaration).flatMap(node => ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.name && !node.importClause.isTypeOnly ? [[node.importClause.name.text, normalizePath(resolve(ROOT, dirname(mediaContentOwnerPath), node.moduleSpecifier.text))] as const] : []));
  const canonical = (name: string, path: string) => imports.get(name) === normalizePath(resolve(ROOT, path));
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const property = (node: ts.ObjectLiteralExpression, name: string) => node.properties.find((row): row is ts.PropertyAssignment => ts.isPropertyAssignment(row) && row.name.getText(tree) === name)?.initializer;
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find((row): row is ts.JsxAttribute => ts.isJsxAttribute(row) && row.name.getText(tree) === name)?.initializer;
  const variable = (name: string) => nodes.filter(ts.isVariableDeclaration).filter(node => ts.isIdentifier(node.name) && node.name.text === name);
  const refCount = (node: ts.Node, name: string) => { let count = 0; const walk = (row: ts.Node) => { if (ts.isJsxExpression(row) && row.expression && ts.isIdentifier(row.expression) && row.expression.text === name) count++; ts.forEachChild(row, walk); }; walk(node); return count; };
  const render = nodes.filter(ts.isFunctionDeclaration).filter(node => node.name?.text === "renderTabs"), returned = render[0]?.body?.statements.find(ts.isReturnStatement)?.expression;
  if (render.length !== 1 || !returned || !ts.isArrayLiteralExpression(returned) || returned.elements.length !== 5) return null;
  const [basic, spread] = returned.elements;
  if (!basic || !ts.isObjectLiteralExpression(basic) || property(basic, "id")?.getText(tree) !== '"basic"' || !spread || !ts.isSpreadElement(spread)) return null;
  const selected = unwrap(spread.expression);
  if (!ts.isConditionalExpression(selected) || selected.condition.getText(tree) !== 'contentType === "video" || contentType === "gallery"' || !ts.isArrayLiteralExpression(selected.whenTrue) || selected.whenTrue.elements.length !== 1 || !ts.isArrayLiteralExpression(selected.whenFalse) || selected.whenFalse.elements.length !== 0) return null;
  const tab = selected.whenTrue.elements[0];
  if (!tab || !ts.isObjectLiteralExpression(tab) || property(tab, "id")?.getText(tree) !== "contentType") return null;
  const content = property(tab, "content"), card = content && unwrap(content);
  if (!card || !ts.isJsxElement(card) || !canonical(card.openingElement.tagName.getText(tree), "src/components/admin/ui/AdminCard") || attribute(card.openingElement, "className")?.getText(tree) !== '"min-w-0 p-3"' || refCount(card, "bodyEditor") !== 1) return null;
  const body = variable("bodyEditor"), specialized = variable("specializedBodyEditor");
  const branch = specialized[0]?.initializer;
  const calls = nodes.filter((node): node is ts.JsxOpeningLikeElement => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)).filter(node => canonical(node.tagName.getText(tree), "src/components/admin/content/editors/media/MediaVideoFields"));
  const basicCalls = nodes.filter((node): node is ts.JsxOpeningLikeElement => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)).filter(node => canonical(node.tagName.getText(tree), "src/components/admin/content/editors/ContentBasicDataPanel"));
  const basicSlot = basicCalls[0] && attribute(basicCalls[0], "contentEditor");
  if (body.length !== 1 || !body[0]!.initializer || refCount(body[0]!.initializer, "specializedBodyEditor") !== 1 || specialized.length !== 1 || !branch || !ts.isConditionalExpression(branch) || branch.condition.getText(tree) !== 'adapter.body === "video"' || calls.length !== 1 || calls[0]!.pos < branch.whenTrue.pos || calls[0]!.end > branch.whenTrue.end || attribute(calls[0]!, "presentation")?.getText(tree) !== '"panel"' || basicCalls.length !== 1 || basicCalls[0]!.pos < basic.pos || basicCalls[0]!.end > basic.end || !basicSlot || !ts.isJsxExpression(basicSlot) || basicSlot.expression?.getText(tree) !== 'adapter.body === "markdown" ? bodyEditor : null') return null;
  return { path: "src/components/admin/content/editors/media/MediaVideoFields.tsx", card: card.getText(tree) };
}
const mediaVideoPremiumSlot = resolveMediaVideoPremiumSlot(mediaContentOwnerSource);
function hasNoLocalSectionHeaderIdentityOverrides(source: string) {
  const tree = ts.createSourceFile("HeaderConsumer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const identityClasses = /\b(?:text-|font-|leading-|tracking-)|\[&[^\]]*\]:(?:size-|[wh]-|text-|font-|leading-|stroke-|fill-)/u;
  const headerOwners = new Set(["AdminModuleSectionHeader"]);
  for (const node of tree.statements) if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
    for (const binding of node.importClause.namedBindings.elements) if ((binding.propertyName ?? binding.name).text === "AdminModuleSectionHeader") headerOwners.add(binding.name.text);
  }
  let valid = true;
  const inspectHeading = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && (node.name.getText(tree) === "style" || node.name.getText(tree) === "className" && identityClasses.test(node.initializer?.getText(tree) ?? ""))) valid = false;
    ts.forEachChild(node, inspectHeading);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) || ts.isPropertyAssignment(node)) {
      const name = node.name.getText(tree);
      if (name === "sectionHeaderClassName" && identityClasses.test(node.initializer?.getText(tree) ?? "")) valid = false;
      if (name === "sectionHeading" && node.initializer) inspectHeading(node.initializer);
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && headerOwners.has(node.tagName.getText(tree)) && node.attributes.properties.some((property) => ts.isJsxAttribute(property) && ["style", "className"].includes(property.name.getText(tree)))) valid = false;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return valid;
}
check(
  "applicable direct Section Headers and registered Module Editor tabs retain canonical identity sizing without local typography or icon overrides",
  [...directFullSectionHeaderSources, ...registeredModuleEditorGraphs.map(({ root }) => root)].every(({ source }) => hasNoLocalSectionHeaderIdentityOverrides(source)),
);
check(
  "negative Section Header consumer fixtures reject direct and indirect icon overrides, styled titles and local inline styling",
  !hasNoLocalSectionHeaderIdentityOverrides(faqEditorSource.replace("<AdminModuleSectionHeader", '<AdminModuleSectionHeader sectionHeaderClassName="[&_svg]:size-8"')) &&
    !hasNoLocalSectionHeaderIdentityOverrides(faqEditorSource.replace('sectionHeading="إعدادات العرض"', 'sectionHeading={<span className="text-xl">إعدادات العرض</span>}')) &&
    !hasNoLocalSectionHeaderIdentityOverrides(faqEditorSource.replace("<AdminModuleSectionHeader", '<AdminModuleSectionHeader style={{fontSize: 20}}')) &&
    !hasNoLocalSectionHeaderIdentityOverrides(read("src/components/admin/page-blocks/ContentModuleEditClient.tsx").replace('sectionHeaderPresentation: "control"', 'sectionHeaderClassName: "[&_svg]:size-8", sectionHeaderPresentation: "control"')),
);
const invalidDirectHeaderScopes = directFullSectionHeaderSources.filter(({ path, source }) => !fullSectionHeadersStayOutsideCards(path, source, mediaVideoPremiumSlot?.path === path));
const panelSectionConsumers = directFullSectionHeaderSources.filter(({ path, source }) => {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), bindings = canonicalSectionBindings(path, tree);
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && bindings.has(node.openingElement.tagName.getText(tree))) {
      found ||= node.openingElement.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(tree) === "presentation" && property.initializer && ts.isStringLiteral(property.initializer) && property.initializer.text === "panel");
    }
    ts.forEachChild(node, visit);
  };
  visit(tree); return found;
});
check("Section header slots resolve through the unified canonical default Card without a file-path exception",
  Boolean(canonicalPanelSectionCard(formFieldOwnerSource)) && panelSectionConsumers.length > 0 &&
    panelSectionConsumers.every(({ path, source }) => fullSectionHeadersStayOutsideCards(path, source)));
check("Section compatibility selectors all retain the unified Card/header owner", panelSectionConsumers.every(({ path, source }) => fullSectionHeadersStayOutsideCards(path, source.replace('presentation="panel"', 'presentation="default"'))));
const sectionTree = ts.createSourceFile("AdminForm.tsx", formFieldOwnerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const sectionFunction = sectionTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormSection")!.getText(sectionTree);
check("Section slot negatives reject parallel owners, unused header props and broken canonical header/Card delegation",
  panelSectionConsumers.every(({ path, source }) => [
    fullSectionHeadersStayOutsideCards(path, source.replace("header={<AdminModuleSectionHeader", "title={<AdminModuleSectionHeader")),
    fullSectionHeadersStayOutsideCards(path, source.replace('components/admin/ui"', 'components/admin/ParallelUI"')),
    fullSectionHeadersStayOutsideCards(path, source.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="default"')),
    fullSectionHeadersStayOutsideCards(path, source, false, formFieldOwnerSource.replace(sectionFunction, sectionFunction.replace("{sectionHeader}", "{null}"))),
    fullSectionHeadersStayOutsideCards(path, source, false, formFieldOwnerSource.replace('from "./AdminCard"', 'from "./ParallelCard"')),
  ].every(result => result === false)));
check(
  `direct full Section Headers stay outside Cards while explicit panel and premium Headers belong to their nearest Premium Card${invalidDirectHeaderScopes.length ? `: ${invalidDirectHeaderScopes.map(({ path }) => path).join(", ")}` : ""}`,
  directFullSectionHeaderSources.length > 0 && invalidDirectHeaderScopes.length === 0,
);
check("Video Header inherits its canonical Premium Card from one resolved typed Media tab slot", Boolean(mediaVideoPremiumSlot));
check("Video slot context rejects removed or non-Premium Cards, parallel owners, detached media and duplicate Basic placement", Boolean(mediaVideoPremiumSlot) && [
  mediaContentOwnerSource.replace(mediaVideoPremiumSlot!.card, "<section>{bodyEditor}</section>"),
  mediaContentOwnerSource.replace(mediaVideoPremiumSlot!.card, mediaVideoPremiumSlot!.card.replaceAll("AdminCard", "section")),
  mediaContentOwnerSource.replace('from "./MediaVideoFields"', 'from "./ParallelMediaVideoFields"'),
  mediaContentOwnerSource.replace("{bodyEditor}", "{null}"),
  mediaContentOwnerSource.replace('contentEditor={adapter.body === "markdown" ? bodyEditor : null}', 'contentEditor={bodyEditor}'),
].every(source => resolveMediaVideoPremiumSlot(source) === null));
check(
  "negative direct Section Header fixture rejects the existing owner moved inside a Card",
  !fullSectionHeadersStayOutsideCards(faqEditorPath, faqEditorSource.replace(/(<AdminModuleSectionHeader\b[\s\S]*?\/>)/u, '<AdminCard presentation="premium">$1</AdminCard>')),
);
const seoHeaderScopePath = "src/components/admin/seo/AdminEntitySeoPanel.tsx";
const seoHeaderScopeSource = read(seoHeaderScopePath);
const seoNonPremiumNearestCard = seoHeaderScopeSource.replace(/(<AdminModuleSectionHeader\s+id=\{`\$\{social\.fieldIds\.imageSection\}-media`\}[\s\S]*?\/>)/u, '<AdminCard presentation="default">$1</AdminCard>');
check(
  "nested SEO sections reject a non-Premium nearest Card or detached canonical Card ownership",
  seoNonPremiumNearestCard !== seoHeaderScopeSource && !fullSectionHeadersStayOutsideCards(seoHeaderScopePath, seoNonPremiumNearestCard) &&
    !fullSectionHeadersStayOutsideCards(seoHeaderScopePath, seoHeaderScopeSource.replaceAll("<AdminCard", "<section").replaceAll("</AdminCard>", "</section>")),
);

const basicBodyPath = "src/components/admin/content/editors/ContentBasicDataPanel.tsx";
const basicBodySource = read(basicBodyPath);
const displaySettingsPath = "src/components/admin/content/editors/ContentDisplaySettings.tsx";
const displaySettingsSource = read(displaySettingsPath);
function hasOptionalDisplaySection(source: string) {
  const displaySettingsPath = "src/components/admin/content/editors/ContentDisplaySettings.tsx";
  const tree = ts.createSourceFile(displaySettingsPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ContentDisplaySettings");
  const parameter = owner?.parameters[0], binding = parameter?.name;
  const port = parameter?.type && ts.isTypeLiteralNode(parameter.type) ? parameter.type.members.find((node): node is ts.PropertySignature => ts.isPropertySignature(node) && node.name.getText(tree) === "sectionHeading") : undefined;
  const selected = owner?.body?.statements.find(ts.isReturnStatement)?.expression;
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const branch = selected && unwrap(selected);
  if (!port?.questionToken || port.type?.getText(tree) !== "ReactNode" || !binding || !ts.isObjectBindingPattern(binding) ||
    !binding.elements.some(node => node.name.getText(tree) === "sectionHeading" && node.initializer === undefined) ||
    !branch || !ts.isConditionalExpression(branch) || branch.condition.getText(tree) !== "sectionHeading" || branch.whenFalse.getText(tree) !== "displayControls") return false;
  const card = unwrap(branch.whenTrue);
  if (!ts.isJsxElement(card) || card.openingElement.tagName.getText(tree) !== "AdminCard") return false;
  const value = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name)?.initializer?.getText(tree);
  const children = card.children.filter(node => !ts.isJsxText(node) || node.text.trim());
  const header = children[0];
  const imports = tree.statements.filter(ts.isImportDeclaration);
  return value(card.openingElement, "className") === '"min-w-0 p-3"' && children.length === 2 &&
    header !== undefined && ts.isJsxSelfClosingElement(header) && header.tagName.getText(tree) === "AdminModuleSectionHeader" &&
    value(header, "id") === '"content-display-settings-heading"' && value(header, "sectionHeading") === "{sectionHeading}" &&
    value(header, "icon") === '"settings"' && value(header, "sectionHeaderPresentation") === '"premium"' &&
    value(header, "sectionHeaderClassName") === "{ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}" &&
    ts.isJsxExpression(children[1]!) && children[1]!.getText(tree) === "{displayControls}" &&
    imports.some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../ui/AdminCard" && node.importClause?.name?.text === "AdminCard") &&
    imports.some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../ui/AdminModuleTabs" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(item => !item.propertyName && item.name.text === "AdminModuleSectionHeader")) &&
    fullSectionHeadersStayOutsideCards(displaySettingsPath, source, false, read("src/components/admin/ui/AdminForm.tsx"));
}
check("Display section opt-in wraps the existing controls once in the canonical Premium Charcoal Header/Card while omitted consumers retain controls-only output", hasOptionalDisplaySection(displaySettingsSource));
check("negative Display section fixtures reject changed defaults, parallel owners, duplicate controls, lost Header ownership and moved section context",
  !hasOptionalDisplaySection(displaySettingsSource.replace("sectionHeading,", 'sectionHeading = "إعدادات العرض",')) &&
    !hasOptionalDisplaySection(displaySettingsSource.replace('"../../ui/AdminCard"', '"../../ui/ParallelCard"')) &&
    !hasOptionalDisplaySection(displaySettingsSource.replace("{displayControls}", "{displayControls}{displayControls}")) &&
    !hasOptionalDisplaySection(displaySettingsSource.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="default"')) &&
    !hasOptionalDisplaySection(displaySettingsSource.replace('id="content-display-settings-heading"', 'id="missing-display-heading"')) &&
    !hasOptionalDisplaySection(displaySettingsSource.replace(") : displayControls;", ") : null;")));
const markdownBodySource = read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx");
function hasCanonicalMarkdownBodySection(source: string) {
  const basicBodyPath = "src/components/admin/content/editors/ContentBasicDataPanel.tsx";
  const tree = ts.createSourceFile(basicBodyPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map<string, string>();
  for (const node of tree.statements.filter(ts.isImportDeclaration)) {
    if (!ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const owner = normalizePath(resolve(ROOT, dirname(basicBodyPath), node.moduleSpecifier.text));
    if (node.importClause?.name) imports.set(node.importClause.name.text, `${owner}:default`);
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) if (!binding.isTypeOnly) imports.set(binding.name.text, `${owner}:${(binding.propertyName ?? binding.name).text}`);
  }
  const canonical = (name: string, path: string, exported: string) => imports.get(name) === `${normalizePath(resolve(ROOT, path))}:${exported}`;
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const property = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === name)?.initializer;
    return property && ts.isStringLiteral(property) ? property.text : property && ts.isJsxExpression(property) ? property.expression?.getText(tree) : undefined;
  };
  const headers = nodes.filter(ts.isJsxSelfClosingElement).filter((node) => value(node, "id") === "content-body");
  const header = headers[0];
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const branch = nodes.filter(ts.isConditionalExpression).find((node) => unwrap(node.whenTrue) === header && node.whenFalse.kind === ts.SyntaxKind.NullKeyword);
  if (headers.length !== 1 || !header || !branch || !canonical(header.tagName.getText(tree), "src/components/admin/ui/AdminModuleTabs", "AdminModuleSectionHeader") || value(header, "sectionHeading") !== "المحتوى" || value(header, "icon") !== "content" || header.attributes.properties.some((node) => !ts.isJsxAttribute(node) || !["id", "sectionHeading", "icon"].includes(node.name.getText(tree)))) return false;
  const condition = branch.condition;
  if (!ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken || !ts.isStringLiteral(condition.right) || condition.right.text !== "markdown" || !ts.isPropertyAccessExpression(condition.left) || condition.left.name.text !== "body" || !ts.isCallExpression(condition.left.expression)) return false;
  const adapter = condition.left.expression;
  if (!canonical(adapter.expression.getText(tree), "src/lib/admin/content/content-types", "getContentEditorAdapter") || adapter.arguments.length !== 1 || adapter.arguments[0]?.getText(tree) !== "contentType" || !ts.isJsxExpression(branch.parent) || !ts.isJsxElement(branch.parent.parent)) return false;
  const section = branch.parent.parent;
  const children = section.children.filter((node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || (ts.isJsxExpression(node) && node.expression));
  const body = children[1];
  return section.openingElement.tagName.getText(tree) === "section" && children.length === 2 && children[0] === branch.parent && body && ts.isJsxElement(body) && canonical(body.openingElement.tagName.getText(tree), "src/components/admin/ui/AdminCard", "default") && value(body.openingElement, "className") === "min-w-0 p-3" && body.children.filter((node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || (ts.isJsxExpression(node) && node.expression)).every((node) => ts.isJsxExpression(node) && node.expression?.getText(tree) === "contentEditor") && body.children.some((node) => ts.isJsxExpression(node) && node.expression?.getText(tree) === "contentEditor");
}
function keepsStandaloneAndCompactMarkdownTitles(source: string) {
  const tree = ts.createSourceFile("TopicMarkdownEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const headings = nodes.filter(ts.isJsxElement).filter((node) => node.openingElement.tagName.getText(tree) === "h3" && node.children.some((child) => ts.isJsxText(child) && child.text.trim() === "المحتوى"));
  const title = headings[0];
  let compactHidden = false;
  for (let parent = title?.parent; parent; parent = parent.parent) if (ts.isConditionalExpression(parent) && parent.condition.getText(tree) === "compact" && parent.whenTrue.kind === ts.SyntaxKind.NullKeyword && title && parent.whenFalse.getStart(tree) <= title.getStart(tree) && parent.whenFalse.end >= title.end) compactHidden = true;
  return headings.length === 1 && compactHidden && source.includes('variant = "default"') && source.includes('const compact = variant === "compact"') && nodes.filter(ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText(tree) === "MiniCounter").length === 6 && source.includes("useMemo(() => getTextStats(content), [content])");
}
function hasPanelMarkdownDelegation(source: string) {
  const tree = ts.createSourceFile(basicBodyPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(tree.statements.filter(ts.isImportDeclaration).flatMap((node) => {
    if (!ts.isStringLiteral(node.moduleSpecifier) || normalizePath(resolve(ROOT, dirname(basicBodyPath), node.moduleSpecifier.text)) !== normalizePath(resolve(ROOT, "src/lib/admin/content/content-types"))) return [];
    const bindings = node.importClause?.namedBindings;
    return bindings && ts.isNamedImports(bindings) ? bindings.elements.filter((binding) => (binding.propertyName ?? binding.name).text === "getContentEditorAdapter").map((binding) => binding.name.text) : [];
  }));
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const branches = nodes.filter(ts.isConditionalExpression).filter((node) => {
    const condition = node.condition;
    if (!ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken || condition.left.getText(tree) !== "panel" || !ts.isBinaryExpression(condition.right)) return false;
    const body = condition.right;
    return body.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isStringLiteral(body.right) && body.right.text === "markdown" &&
      ts.isPropertyAccessExpression(body.left) && body.left.name.text === "body" && ts.isCallExpression(body.left.expression) &&
      names.has(body.left.expression.expression.getText(tree)) && body.left.expression.arguments.length === 1 && body.left.expression.arguments[0]?.getText(tree) === "contentType";
  });
  return branches.length === 1 && branches[0]!.whenTrue.getText(tree) === "contentEditor" && ts.isJsxElement(branches[0]!.whenFalse) &&
    branches[0]!.whenFalse.openingElement.tagName.getText(tree) === "section" &&
    source.includes('presentation?: "default" | "panel"') && source.includes('presentation = "default"') && hasCanonicalMarkdownBodySection(source);
}
function hasPanelMarkdownOwner(source: string) {
  const sourcePath = "src/components/admin/content/editors/article/TopicMarkdownEditor.tsx";
  const tree = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map<string, string>();
  for (const node of tree.statements.filter(ts.isImportDeclaration)) {
    if (!ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const owner = normalizePath(resolve(ROOT, dirname(sourcePath), node.moduleSpecifier.text));
    if (node.importClause?.name) imports.set(node.importClause.name.text, `${owner}:default`);
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) if (!binding.isTypeOnly) imports.set(binding.name.text, `${owner}:${(binding.propertyName ?? binding.name).text}`);
  }
  const canonical = (name: string, path: string, exported: string) => imports.get(name) === `${normalizePath(resolve(ROOT, path))}:${exported}`;
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const declarations = new Map(nodes.filter(ts.isVariableDeclaration).flatMap((node) => ts.isIdentifier(node.name) && node.initializer ? [[node.name.text, node.initializer] as const] : []));
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const property = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === name)?.initializer;
    return property && ts.isStringLiteral(property) ? property.text : property && ts.isJsxExpression(property) ? property.expression?.getText(tree) : undefined;
  };
  const refs = (node: ts.Node) => {
    const names: string[] = [];
    const inspect = (child: ts.Node) => { if (ts.isJsxExpression(child) && child.expression && ts.isIdentifier(child.expression)) names.push(child.expression.text); ts.forEachChild(child, inspect); };
    inspect(node);
    return names;
  };
  const selectedHeader = declarations.get("editorHeader");
  const header = selectedHeader && ts.isConditionalExpression(selectedHeader) && selectedHeader.condition.getText(tree) === "panel" ? unwrap(selectedHeader.whenTrue) : undefined;
  const selector = declarations.get("panel");
  if (!source.includes('presentation?: "default" | "panel"') || !source.includes('presentation = "default"') || !source.includes('const compact = variant === "compact" || panel') ||
    selector?.getText(tree) !== 'presentation === "panel"' || !header || !ts.isJsxSelfClosingElement(header) ||
    !canonical(header.tagName.getText(tree), "src/components/admin/ui/AdminModuleTabs", "AdminModuleSectionHeader") ||
    value(header, "id") !== "content-body" || value(header, "sectionHeading") !== "المحتوى" || value(header, "icon") !== "content" ||
    value(header, "sectionHeaderPresentation") !== "premium" || value(header, "sectionSummary") !== "editorStats" ||
    header.attributes.properties.some((node) => !ts.isJsxAttribute(node) || !["id", "sectionHeading", "icon", "sectionHeaderPresentation", "sectionSummary"].includes(node.name.getText(tree)))) return false;
  const cards = nodes.filter(ts.isConditionalExpression).filter((node) => node.condition.getText(tree) === "panel").flatMap((node) => {
    const markup = unwrap(node.whenTrue);
    return ts.isJsxElement(markup) && canonical(markup.openingElement.tagName.getText(tree), "src/components/admin/ui/AdminCard", "default") ? [{ node, markup }] : [];
  });
  const card = cards[0];
  const body = declarations.get("editorBody");
  const counters = declarations.get("editorStats");
  const richEditors = nodes.filter(ts.isJsxSelfClosingElement).filter((node) => canonical(node.tagName.getText(tree), "src/components/admin/AdminRichTextEditor", "default"));
  const stack = card?.markup.children.find((node): node is ts.JsxElement => ts.isJsxElement(node));
  return cards.length === 1 && Boolean(card && value(card.markup.openingElement, "className") === "min-w-0 p-3" &&
    refs(card.markup).join("|") === "editorHeader|ADMIN_FORM_STACK_CLASS_NAME|editorBody" && refs(card.node.whenFalse).join("|") === "editorHeader|editorBody" &&
    stack && value(stack.openingElement, "className") === "ADMIN_FORM_STACK_CLASS_NAME" && canonical("ADMIN_FORM_STACK_CLASS_NAME", "src/components/admin/ui/AdminForm", "ADMIN_FORM_STACK_CLASS_NAME")) &&
    Boolean(body && counters && refs(counters).filter((name) => name === "compact").length === 6) &&
    richEditors.length === 1 && value(richEditors[0]!, "name") === "content" && value(richEditors[0]!, "storageFormat") === "markdown" &&
    value(richEditors[0]!, "value") === "content" && value(richEditors[0]!, "onValueChange") === "handleValueChange" && value(richEditors[0]!, "readOnly") === "Boolean(pendingDraft)" &&
    source.includes('className={panel ? undefined : compact ? "mt-3" : "mt-6"}') && keepsStandaloneAndCompactMarkdownTitles(source) && fullSectionHeadersStayOutsideCards(sourcePath, source, false, read("src/components/admin/ui/AdminForm.tsx"));
}
check("Markdown body composition uses canonical adapter applicability and the full Header before its unchanged sibling content Card", hasCanonicalMarkdownBodySection(basicBodySource));
check("negative body Header fixtures reject parallel applicability, copied type decisions, inverted scope, nested Headers and detached content", !hasCanonicalMarkdownBodySection(basicBodySource.replace('/lib/admin/content/content-types"', '/lib/admin/content/parallel-types"')) && !hasCanonicalMarkdownBodySection(basicBodySource.replaceAll('getContentEditorAdapter(contentType).body === "markdown"', 'contentType === "article"')) && !hasCanonicalMarkdownBodySection(basicBodySource.replaceAll('.body === "markdown"', '.body !== "markdown"')) && !hasCanonicalMarkdownBodySection(basicBodySource.replace(/(<AdminModuleSectionHeader\s+id="content-body"[\s\S]*?\/>)/u, '<AdminCard presentation="premium">$1</AdminCard>')) && !hasCanonicalMarkdownBodySection(basicBodySource.replace('{contentEditor}', '{null}')));
check("standalone default Markdown retains its legacy title while compact delegates the section title and preserves six live counters", keepsStandaloneAndCompactMarkdownTitles(markdownBodySource));
check("negative Markdown title fixtures reject compact duplicates, changed defaults and removed or stale counters", !keepsStandaloneAndCompactMarkdownTitles(markdownBodySource.replace('{compact ? null : (', '{false ? null : (')) && !keepsStandaloneAndCompactMarkdownTitles(markdownBodySource.replace('variant = "default"', 'variant = "compact"')) && !keepsStandaloneAndCompactMarkdownTitles(markdownBodySource.replace('<MiniCounter label="H2" value={stats.h2} compact={compact} />', '')) && !keepsStandaloneAndCompactMarkdownTitles(markdownBodySource.replace('getTextStats(content), [content]', 'getTextStats(defaultValue), [defaultValue]')));
check("explicit Markdown panel owns one Premium Card, the shared premium Header and its six local live counters without duplicating the rich editor or content gap", hasPanelMarkdownOwner(markdownBodySource));
check("negative Markdown panel fixtures reject changed defaults, oversized omitted-variant panels, parallel owners, detached counters, nested Cards and altered native content", !hasPanelMarkdownOwner(markdownBodySource.replace('presentation = "default"', 'presentation = "panel"')) && !hasPanelMarkdownOwner(markdownBodySource.replace('const compact = variant === "compact" || panel', 'const compact = variant === "compact"')) && !hasPanelMarkdownOwner(markdownBodySource.replace('/ui/AdminModuleTabs"', '/ui/ParallelHeader"')) && !hasPanelMarkdownOwner(markdownBodySource.replace('/ui/AdminCard"', '/ui/ParallelCard"')) && !hasPanelMarkdownOwner(markdownBodySource.replace('sectionSummary={editorStats}', 'sectionSummary={null}')) && !hasPanelMarkdownOwner(markdownBodySource.replace('{editorHeader}', '<AdminCard presentation="premium">{editorHeader}</AdminCard>')) && !hasPanelMarkdownOwner(markdownBodySource.replace('name="content"', 'name="parallel_content"')));
check("Markdown Premium Header opt-in rejects a legacy panel or implicit shared default", !hasPanelMarkdownOwner(markdownBodySource.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="panel"')) && !hasPanelMarkdownOwner(markdownBodySource.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="default"')));
check("Basic panel delegates Markdown Header and Card ownership to its existing editor while Video, Gallery and omitted consumers retain the legacy body composition", hasPanelMarkdownDelegation(basicBodySource));
check("negative Basic panel delegation fixtures reject copied type decisions, unconditional delegation, a second Card and detached editor content", !hasPanelMarkdownDelegation(basicBodySource.replace('panel && getContentEditorAdapter(contentType).body === "markdown"', 'panel && contentType === "article"')) && !hasPanelMarkdownDelegation(basicBodySource.replace('panel && getContentEditorAdapter(contentType).body === "markdown"', 'panel')) && !hasPanelMarkdownDelegation(basicBodySource.replace('? contentEditor : <section>', '? <AdminCard presentation="premium">{contentEditor}</AdminCard> : <section>')) && !hasPanelMarkdownDelegation(basicBodySource.replace('? contentEditor : <section>', '? null : <section>')));
const markdownPanelAdapterPaths = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter((entry) => ["topic-article-create-edit", "topic-media-create-edit"].includes(entry.id)).flatMap((entry) => entry.sourceFiles);
function hasActualMarkdownPanelOptIn(path: string, source: string) {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = new Map<string, string>();
  for (const node of tree.statements.filter(ts.isImportDeclaration)) if (ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.name) owners.set(node.importClause.name.text, normalizePath(resolve(ROOT, dirname(path), node.moduleSpecifier.text)));
  const calls: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => { if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) calls.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  return ["src/components/admin/content/editors/ContentBasicDataPanel", "src/components/admin/content/editors/article/TopicMarkdownEditor"].every((owner) => {
    const matches = calls.filter((node) => owners.get(node.tagName.getText(tree)) === normalizePath(resolve(ROOT, owner)));
    return matches.length === 1 && matches[0]!.attributes.properties.some((property) => ts.isJsxAttribute(property) && property.name.getText(tree) === "presentation" && property.initializer && ts.isStringLiteral(property.initializer) && property.initializer.text === "panel") && !matches[0]!.attributes.properties.some(ts.isJsxSpreadAttribute);
  });
}
check("all registered Article and Media Markdown family adapters explicitly select the Basic and Markdown panel contracts together", markdownPanelAdapterPaths.length > 0 && markdownPanelAdapterPaths.every((path) => hasActualMarkdownPanelOptIn(path, read(path))));
check("negative registered panel opt-in fixtures reject missing presentation and parallel editor owners", markdownPanelAdapterPaths.every((path) => {
  const source = read(path);
  return ["ContentBasicDataPanel", "TopicMarkdownEditor"].every(owner => {
    const changed = source.replace(new RegExp(`(<${owner}\\b[\\s\\S]*?)presentation="panel"`, "u"), '$1presentation="default"');
    return changed !== source && !hasActualMarkdownPanelOptIn(path, changed);
  }) && !hasActualMarkdownPanelOptIn(path, source.replace('/article/TopicMarkdownEditor"', '/article/ParallelMarkdownEditor"'));
}));

check(
  "the shared content shell has no generic pre-tabs presentation escape hatch",
  !contentShell.includes("beforeTabs") &&
    contentShell.indexOf("<AdminModuleTabs") <
      contentShell.indexOf("<AdminFormActions"),
);

check(
  "specialized consumers outside the Module Editor registry continue to supply their Section Hero metadata",
  consumerSources
    .filter(({ path }) => !moduleEditorRootSet.has(path))
    .every(({ source }) =>
      ["sectionHeading", "sectionDescription", "icon:"].every((token) =>
        source.includes(token),
      ),
    ),
);

check(
  "specialized Tabs stay independent from consumer content cards and sections",
  consumerSources.every(({ path, source }) => tabsAreIndependent(path, source)),
);

const blockConsumers = consumerSources.filter(
  ({ path }) =>
    path.includes("page-blocks/") &&
    !path.includes("PageBlocksClient") &&
    !path.includes("MenuBuilderClient") &&
    !path.includes("FooterBuilderClient"),
);
check(
  "block context notices and dependency banners no longer sit between Main Hero and Tabs",
  blockConsumers.every(({ source }) => {
    const heroIndex = Math.max(
      source.indexOf("<BlockEditorContextHeader"),
      source.indexOf("<AdminPageContextHeader"),
      source.indexOf("<ModuleEditorHeader"),
    );
    const tabsIndex = Math.max(
      source.indexOf("<AdminModuleTabs", heroIndex),
      source.indexOf("<ModuleEditorTabs", heroIndex),
    );
    const preTabs = source.slice(heroIndex, tabsIndex);
    return (
      heroIndex >= 0 &&
      tabsIndex > heroIndex &&
      !preTabs.includes("<ModuleCrossPageUsageBanner") &&
      !preTabs.includes("<ModuleDependencyHintsPanel") &&
      !preTabs.includes("<AdminNotice")
    );
  }),
);

check(
  "specialized non-Form-Runtime feedback is adopted through the active panel instead of above navigation",
  consumerSources
    .filter(({ source }) => !source.includes("<AdminFormRuntime"))
    .every(({ source }) => source.includes("activePanelContext=")),
);

const menu = read("src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx");
const menuPage = read("src/app/admin/pages-blocks/menus/[id]/page.tsx");
check(
  "Menu navigation and readiness live in Main Hero with no local parallel header",
  menuPage.includes('href="/admin/pages-blocks/menus"') &&
    menuPage.includes("<AdminStatusPill") &&
    !menu.includes("الرجوع لكل القوائم") &&
    !menu.includes("Database Ready") &&
    !menu.includes("<Link"),
);

function hasSharedPremiumMenuPresentation(source: string, requiresGrid: boolean, scope: "all" | "forms" = "all") {
  const tree = ts.createSourceFile("menu.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = new Map<string, string>();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== "../../../../components/admin/ui" || statement.importClause?.isTypeOnly) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      owners.set(binding.name.text, (binding.propertyName ?? binding.name).text);
    }
  }
  let premiumCards = 0;
  let headers = 0;
  let grids = 0;
  let submitActions = 0;
  let valid = true;
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name,
  );
  const stringAttribute = (node: ts.JsxOpeningLikeElement, name: string) => {
    const value = attribute(node, name)?.initializer;
    return value && ts.isStringLiteral(value) ? value.text : null;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(tree);
      const owner = owners.get(tag);
      if (tag === "button") valid = false;
      if (owner === "AdminCard") {
        premiumCards++;
      }
      if (owner === "AdminFormControlHeader") headers++;
      if (owner === "AdminFormGrid") grids++;
      if (owner === "AdminActionButton" && stringAttribute(node, "type") === "submit") {
        submitActions++;
        if (stringAttribute(node, "variant") !== "primary") valid = false;
      }
      if (owner === "AdminFormSwitch" && !attribute(node, "embedded")) valid = false;
      if (owner === "AdminLinkField" && (
        stringAttribute(node, "presentation") !== "inline" ||
        stringAttribute(node, "actionPresentation") !== "bare"
      )) valid = false;
    }
    ts.forEachChild(node, visit);
  };
  if (scope === "forms") {
    const visitForms = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "form") {
        visit(node);
        return;
      }
      ts.forEachChild(node, visitForms);
    };
    visitForms(tree);
  } else {
    visit(tree);
  }
  return valid && premiumCards > 0 && headers > 0 && (!requiresGrid || grids > 0 && submitActions > 0);
}

function hasUnchangedMenuCollectionShell(source: string) {
  const tree = ts.createSourceFile("menu.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let collectionShells = 0;
  let valid = tree.statements.some((node) =>
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === "../../../../components/admin/ui" &&
    !node.importClause?.isTypeOnly && node.importClause?.namedBindings &&
    ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some((binding) => !binding.isTypeOnly &&
      (binding.propertyName ?? binding.name).text === "AdminCard" && binding.name.text === "AdminCard"),
  );
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "AdminCard" &&
      node.children.some((child) => ts.isJsxSelfClosingElement(child) && child.tagName.getText(tree) === "MenuItemsTableClient")) {
      collectionShells++;
      const attributes = node.openingElement.attributes.properties;
      const className = attributes.find((property): property is ts.JsxAttribute =>
        ts.isJsxAttribute(property) && property.name.getText(tree) === "className",
      )?.initializer;
      if (!className || !ts.isStringLiteral(className) || className.text !== "p-3 md:p-6") valid = false;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return valid && collectionShells === 1;
}

const menuTable = read("src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx");
function hasCanonicalMenuTablePresentation(source: string) {
  const tree = ts.createSourceFile("menu-table.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = new Set<string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) ||
      node.moduleSpecifier.text !== "../../../../components/admin/ui" || node.importClause?.isTypeOnly) continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if (!binding.isTypeOnly && (binding.propertyName ?? binding.name).text === binding.name.text) owners.add(binding.name.text);
    }
  }
  const openings: ts.JsxOpeningLikeElement[] = [];
  const statusBodies: ts.JsxElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) openings.push(node);
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "AdminDataGridStatusCell" &&
      node.children.some((child) => ts.isJsxSelfClosingElement(child) && child.tagName.getText(tree) === "AdminDataGridRowActions")) statusBodies.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const property = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find(
    (item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText(tree) === name,
  )?.initializer;
  const literal = (node: ts.JsxOpeningLikeElement, name: string) => {
    const value = property(node, name);
    return value && ts.isStringLiteral(value) ? value.text : undefined;
  };
  const sameCapability = (node: ts.JsxOpeningLikeElement) => {
    const value = property(node, "capability");
    return value && ts.isJsxExpression(value) && value.expression && ts.isIdentifier(value.expression) && value.expression.text === "capability";
  };
  const primary = openings.filter((node) => node.tagName.getText(tree) === "AdminDataGridPrimaryCell");
  const containers = openings.filter((node) => node.tagName.getText(tree) === "AdminDataGrid");
  const actions = openings.filter((node) => node.tagName.getText(tree) === "AdminDataGridRowActions");
  const inline = actions.filter((node) => literal(node, "display") === "visibility");
  const menuActions = actions.filter((node) => !property(node, "display"));
  return ["AdminDataGrid", "AdminDataGridPrimaryCell", "AdminDataGridStatusCell", "AdminDataGridRowActions"].every((name) => owners.has(name)) &&
    containers.length === 1 && literal(containers[0]!, "surface") === "standalone" &&
    containers[0]!.attributes.properties.every((node) => ts.isJsxAttribute(node) && !["className", "style"].includes(node.name.getText(tree))) &&
    primary.length === 2 && primary.every((node) => literal(node, "presentation") === "text-only") &&
    actions.length === 2 && inline.length === 1 && menuActions.length === 1 &&
    actions.every((node) => sameCapability(node) && literal(node, "size") === "compact") &&
    inline[0]!.attributes.properties.every((node) => ts.isJsxAttribute(node) && ["capability", "display", "size"].includes(node.name.getText(tree))) &&
    statusBodies.length === 1 && !openings.some((node) => node.tagName.getText(tree) === "AdminStatusPill");
}

function hasMenuControlFocusExposure(source: string) {
  const tree = ts.createSourceFile("menu-table.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const captures: ts.JsxAttribute[] = [];
  const visit = (node: ts.Node) => { if (ts.isJsxAttribute(node) && node.name.getText(tree) === "onFocusCapture") captures.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  if (captures.length !== 1) return false;
  const calls: ts.CallExpression[] = [];
  const findCalls = (node: ts.Node) => { if (ts.isCallExpression(node)) calls.push(node); ts.forEachChild(node, findCalls); };
  findCalls(captures[0]!);
  const selectors = calls.flatMap((node) => ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "control" &&
    ["matches", "closest"].includes(node.expression.name.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) ? [node.arguments[0].text] : []);
  const scroll = calls.filter((node) => ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "control" && node.expression.name.text === "scrollIntoView");
  const options = scroll[0]?.arguments[0];
  const values = options && ts.isObjectLiteralExpression(options) ? options.properties.flatMap((node) =>
    ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer) ? [[node.name.getText(tree), node.initializer.text]] : []) : [];
  return ["[data-admin-grid-reorder-handle]", "[data-menu-item-reorder-arrows]", '[data-admin-row-action="visibility"]'].every((selector) => selectors.includes(selector)) &&
    scroll.length === 1 && values.some(([key, value]) => key === "block" && value === "nearest") &&
    values.some(([key, value]) => key === "inline" && value === "start");
}

const menuItemForm = read("src/app/admin/pages-blocks/menus/MenuItemForm.tsx");
const menuItemLink = read("src/app/admin/pages-blocks/menus/MenuItemLinkSection.tsx");
function hasMenuItemIdentityRow(formSource: string, linkSource: string) {
  const parse = (source: string) => ts.createSourceFile("menu.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const formTree = parse(formSource);
  const linkTree = parse(linkSource);
  const find = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const found: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); };
    visit(root);
    return found;
  };
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) => node.attributes.properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name,
  )?.initializer;
  const namedField = (node: ts.Node, name: string) => find(node, ts.isJsxAttribute).some((field) =>
    field.name.getText() === "name" && field.initializer && ts.isStringLiteral(field.initializer) && field.initializer.text === name,
  );
  const forms = find(formTree, ts.isJsxElement).filter((node) => node.openingElement.tagName.getText() === "MenuItemLinkSection");
  if (forms.length !== 1) return false;
  const identityCards = forms[0].children.filter(ts.isJsxElement);
  if (identityCards.length !== 2 || !namedField(identityCards[0], "label") || !namedField(identityCards[1], "parent_id")) return false;
  const props = linkTree.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === "MenuItemLinkSectionProps");
  if (!props || !ts.isTypeLiteralNode(props.type) || !props.type.members.some((node) =>
    ts.isPropertySignature(node) && node.name.getText() === "children" && node.questionToken,
  )) return false;
  const grids = find(linkTree, ts.isJsxElement).filter((node) => node.openingElement.tagName.getText() === "AdminFormGrid");
  if (grids.length !== 1) return false;
  const columns = attribute(grids[0].openingElement, "columns");
  if (!columns || !ts.isJsxExpression(columns) || !columns.expression || !ts.isNumericLiteral(columns.expression) || columns.expression.text !== "3") return false;
  const references = (node: ts.Node) => find(node, ts.isJsxExpression).flatMap((expression) =>
    expression.expression && ts.isIdentifier(expression.expression) ? [expression.expression.text] : [],
  );
  if (references(grids[0]).join("|") !== "children|parentControl") return false;
  const owner = linkTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "MenuItemLinkSection");
  const composed = owner?.body?.statements.find((node): node is ts.IfStatement => ts.isIfStatement(node) && node.expression.getText() === "children");
  if (!composed || references(composed).join("|") !== "children|parentControl|linkControl") return false;
  const fallback = owner?.body?.statements.at(-1);
  if (!fallback || !ts.isReturnStatement(fallback) || !fallback.expression || references(fallback.expression).join("|") !== "parentControl|linkControl") return false;
  const parentControls = find(linkTree, ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText() === "AdminFormSwitch");
  return parentControls.length === 1 && namedField(parentControls[0], "menu_item_is_parent") &&
    linkSource.includes("const linkControl = !isParentOnly ?") && !formSource.includes("useState");
}
check(
  "Menu metadata, add/edit item and conditional link controls adopt existing Premium owners",
  hasSharedPremiumMenuPresentation(menu, true, "forms") &&
    hasSharedPremiumMenuPresentation(menuItemForm, true) &&
    hasSharedPremiumMenuPresentation(menuItemLink, false) &&
    !read("src/app/admin/pages-blocks/menus/menu-builder-shared.ts").includes("menuFieldClassName") &&
    ![menu, menuItemForm].some((source) => /menu(?:Field|Label)ClassName/u.test(source)),
);
check(
  "Menu item name, Parent and the single parent-only state owner share the existing three-column grid with standalone fallback preserved",
  hasMenuItemIdentityRow(menuItemForm, menuItemLink),
);
check(
  "negative Menu identity fixtures reject a two-column identity row, a missing parent control and a required composition slot",
  !hasMenuItemIdentityRow(menuItemForm, menuItemLink.replace("columns={3}", "columns={2}")) &&
    !hasMenuItemIdentityRow(menuItemForm, menuItemLink.replace("{parentControl}", "{null}")) &&
    !hasMenuItemIdentityRow(menuItemForm, menuItemLink.replace("{linkControl}", "{null}")) &&
    !hasMenuItemIdentityRow(menuItemForm, menuItemLink.replace("children?: ReactNode", "children: ReactNode")),
);
check(
  "the canonical Menu collection shell retains reviewed compact mobile density across compatibility selectors",
  hasUnchangedMenuCollectionShell(menu) &&
    hasUnchangedMenuCollectionShell(menu.replace('<AdminCard className="p-3 md:p-6">', '<AdminCard presentation="premium" className="p-3 md:p-6">')) &&
    hasUnchangedMenuCollectionShell(menu.replace('<AdminCard className="p-3 md:p-6">', '<AdminCard presentation="default" className="p-3 md:p-6">')) &&
    !hasUnchangedMenuCollectionShell(menu.replace('className="p-3 md:p-6"', 'className="p-5 md:p-6"')) &&
    !hasUnchangedMenuCollectionShell(menu.replace('className="p-3 md:p-6"', 'className="p-3 md:p-3"')) &&
    !hasUnchangedMenuCollectionShell(menu.replace("  AdminCard,", "")) &&
    !hasUnchangedMenuCollectionShell(menu.replace('from "../../../../components/admin/ui";', 'from "../../../../local/components/admin/ui";')),
);
check(
  "Menu identity padding and inline visibility delegate to the existing shared presentation and action owners",
  hasCanonicalMenuTablePresentation(menuTable),
);
check(
  "negative Menu table fixtures reject implicit padding, a local status pill, changed action targets and missing canonical owners",
  !hasCanonicalMenuTablePresentation(menuTable.replace('presentation="text-only"', 'presentation="standard-icon"')) &&
    !hasCanonicalMenuTablePresentation(menuTable.replace('display="visibility"', 'display="menu"')) &&
    !hasCanonicalMenuTablePresentation(menuTable.replaceAll("capability={capability}", "capability={localCapability}")) &&
    !hasCanonicalMenuTablePresentation(menuTable.replace("  AdminDataGridRowActions,", "")) &&
    !hasCanonicalMenuTablePresentation(menuTable.replace('<AdminDataGridRowActions capability={capability} display="visibility" size="compact" />', '<AdminStatusPill>{item.is_visible ? "ظاهر" : "مخفي"}</AdminStatusPill>')),
);
check(
  "negative Menu container fixtures reject embedded or implicit surfaces, local frame CSS, spreads and missing canonical ownership",
  !hasCanonicalMenuTablePresentation(menuTable.replace('surface="standalone"', 'surface="embedded"')) &&
    !hasCanonicalMenuTablePresentation(menuTable.replace(' surface="standalone"', "")) &&
    !hasCanonicalMenuTablePresentation(menuTable.replace('<AdminDataGrid surface="standalone">', '<AdminDataGrid surface="standalone" className="!rounded-t-none !border-t-0">')) &&
    !hasCanonicalMenuTablePresentation(menuTable.replace('<AdminDataGrid surface="standalone">', '<AdminDataGrid surface="standalone" style={{ borderRadius: 0 }}>')) &&
    !hasCanonicalMenuTablePresentation(menuTable.replace('<AdminDataGrid surface="standalone">', '<AdminDataGrid surface="standalone" {...localSurfaceProps}>')) &&
    !hasCanonicalMenuTablePresentation(menuTable.replace("  AdminDataGrid,", "")),
);
const menuItemsSurface = ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find((entry) => entry.id === "menu-items");
check(
  "Menu visibility has no retained local-pill exception after canonical inline adoption",
  menuItemsSurface?.semanticPresentation.owner === "shared_admin_row_actions" &&
    menuItemsSurface.semanticPresentation.explicitSurfaceContracts.length === 0,
);
check(
  "Menu keyboard focus exposes reorder and visibility controls through the same native scroll owner",
  hasMenuControlFocusExposure(menuTable) &&
    !hasMenuControlFocusExposure(menuTable.replace('[data-admin-row-action="visibility"]', '[data-admin-row-action="unrelated"]')) &&
    !hasMenuControlFocusExposure(menuTable.replace('inline: "start"', 'inline: "end"')),
);
check(
  "Menu fixtures reject missing or parallel owners and local submit buttons while compatibility Card selectors retain ownership",
  !hasSharedPremiumMenuPresentation(menuItemForm.replace("  AdminCard,", ""), true) &&
    !hasSharedPremiumMenuPresentation(menuItemForm.replaceAll("AdminActionButton", "button"), true) &&
    !hasSharedPremiumMenuPresentation(menuItemForm.replace('/components/admin/ui"', '/components/admin/ParallelUI"'), true) &&
    hasSharedPremiumMenuPresentation(menuItemForm.replaceAll('<AdminCard presentation="premium"', '<AdminCard presentation="default"'), true) &&
    hasSharedPremiumMenuPresentation(menu.replaceAll('<AdminCard presentation="premium"', '<AdminCard'), true, "forms"),
);

const footer = read(
  "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx",
);
check(
  "Footer summary is domain content in a shared Overview section with no editor wrapper header",
  footer.includes('id: "overview"') &&
    footer.includes('sectionHeading: "ملخص الأعمدة والترتيب"') &&
    !footer.includes("تحرير الأعمدة والإعدادات") &&
    footer.match(/حفظ الفوتر/g)?.length === 2,
);

function hasMetaManagerPresentation(source:string){
  const tree=ts.createSourceFile("MetaManagerClient.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes:ts.JsxOpeningLikeElement[]=[];
  const visit=(node:ts.Node)=>{if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))nodes.push(node);ts.forEachChild(node,visit);};visit(tree);
  const value=(node:ts.JsxOpeningLikeElement,name:string)=>node.attributes.properties.find((entry):entry is ts.JsxAttribute=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)===name)?.initializer?.getText(tree),owned=(name:string)=>nodes.filter(node=>node.tagName.getText(tree)===name),elements=(node:ts.JsxElement)=>node.children.filter((child):child is ts.JsxElement|ts.JsxSelfClosingElement=>ts.isJsxElement(child)||ts.isJsxSelfClosingElement(child));
  const imports=new Map<string,string>();for(const node of tree.statements)if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){const path=node.moduleSpecifier.text;if(node.importClause?.name)imports.set(node.importClause.name.text,path);const named=node.importClause?.namedBindings;if(named&&ts.isNamedImports(named))for(const binding of named.elements)imports.set(binding.name.text,path);}
  for(const name of ['AdminFormRuntime','AdminFormActions','AdminModuleTabs','AdminModuleSectionHeader','AdminFormField','AdminFormListboxSelect','AdminFormSection'])if(!imports.get(name)?.includes('/components/admin/ui'))return false;
  if(!imports.get('adminFormHintClassName')?.endsWith('/lib/admin/admin-ui-styles'))return false;
  const runtimes=owned('AdminFormRuntime'),actions=owned('AdminFormActions'),tabs=owned('AdminModuleTabs'),headers=owned('AdminModuleSectionHeader');if(runtimes.length!==1||actions.length!==1||tabs.length!==1||headers.length!==1||!ts.isJsxOpeningElement(runtimes[0]!))return false;
  const root=runtimes[0]!.parent as ts.JsxElement,children=elements(root),stack=children[0];if(children.length!==1||!stack||!ts.isJsxElement(stack)||stack.openingElement.tagName.getText(tree)!=='div'||value(stack.openingElement,'className')!=='{ADMIN_FORM_STACK_CLASS_NAME}')return false;
  const contents=elements(stack);if(contents.length!==2||contents[0]!==tabs[0]||contents[1]!==actions[0]||value(runtimes[0]!,'action')!=='{saveGlobalSeoSettingsAction}'||value(runtimes[0]!,'entityKey')!=='"global-seo-settings"'||value(runtimes[0]!,'closeHref')!=='"/admin"'||value(runtimes[0]!,'className')?.includes('space-y-'))return false;
  if(value(actions[0]!,'title')!=='"إجراءات النموذج"'||!value(actions[0]!,'icon')?.includes('name="content"')||value(actions[0]!,'submitLabel')!=='"حفظ Global SEO"')return false;
  let slot:ts.Node|undefined=headers[0]!.parent;while(slot&&!ts.isJsxAttribute(slot))slot=slot.parent;const panel=slot?.parent?.parent;if(!slot||!ts.isJsxAttribute(slot)||slot.name.getText(tree)!=='header'||!panel||!ts.isJsxOpeningElement(panel)||panel.tagName.getText(tree)!=='AdminFormSection'||value(panel,'presentation')!=='"panel"'||value(headers[0]!,'sectionHeaderPresentation')!=='"premium"'||value(headers[0]!,'sectionHeaderClassName')!=='{ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}'||!value(headers[0]!,'id')?.includes('global-seo-'))return false;
  if(!owned('AdminFormField').every(node=>value(node,'presentation')==='"panel"')||!owned('AdminFormListboxSelect').every(node=>value(node,'presentation')==='"panel"'&&value(node,'label')==='{label}'&&value(node,'focusTargetId')==='{field}'&&value(node,'ariaDescribedBy')?.includes('source-note'))||nodes.some(node=>node.attributes.properties.some(entry=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)==='required')))return false;
  const note=tree.statements.find((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==='SourceNote')?.getText(tree)??'';return note.includes('<span')&&note.includes('adminFormHintClassName({ textInset: true })')&&note.includes('data-seo-effective-source={source.source}')&&note.includes('!source.persisted')&&!source.includes('function SectionCard');
}

function hasMetaNativeBindings(source:string,actionSource:string){
  const tree=ts.createSourceFile('meta.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),actionTree=ts.createSourceFile('actions.ts',actionSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),build=actionTree.statements.find((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==='buildSettingsFromForm')?.body?.statements.find(ts.isReturnStatement)?.expression;
  if(!build||!ts.isObjectLiteralExpression(build))return false;const expected=new Map<string,{name:string,kind:string}>();for(const prop of build.properties)if(ts.isPropertyAssignment(prop)&&ts.isCallExpression(prop.initializer)){const arg=prop.initializer.arguments[1];if(arg&&ts.isStringLiteral(arg))expected.set(prop.name.getText(actionTree),{name:arg.text,kind:prop.initializer.expression.getText(actionTree)});}
  const value=(node:ts.JsxOpeningLikeElement,name:string)=>{const item=node.attributes.properties.find((entry):entry is ts.JsxAttribute=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)===name)?.initializer;return item&&ts.isStringLiteral(item)?item.text:undefined;},calls:ts.JsxOpeningLikeElement[]=[],arrays:ts.JsxOpeningLikeElement[]=[],social:string[]=[];const visit=(node:ts.Node)=>{if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){const name=node.tagName.getText(tree);if(['StringField','BooleanSourceField','ImageSourceField'].includes(name))calls.push(node);if(name==='textarea'&&value(node,'id'))arrays.push(node);if(name==='input'&&value(node,'name')?.startsWith('social_'))social.push(value(node,'name')!);}ts.forEachChild(node,visit);};visit(tree);
  const types=ts.createSourceFile('seo-types.ts',read('src/lib/seo/global-seo-types.ts'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),settings=types.statements.find((node):node is ts.TypeAliasDeclaration=>ts.isTypeAliasDeclaration(node)&&node.name.text==='GlobalSeoSettings'),imageKeys=settings&&ts.isTypeLiteralNode(settings.type)?settings.type.members.filter((node):node is ts.PropertySignature=>ts.isPropertySignature(node)&&node.type?.kind===ts.SyntaxKind.StringKeyword&&/(?:Image|Logo)$/u.test(node.name.getText(types))).map(node=>node.name.getText(types)):[];
  const scalar=[...expected].filter(([,item])=>['optionalString','readBoolean'].includes(item.kind)),array=[...expected].filter(([,item])=>item.kind==='readStringList');if(!imageKeys.length||calls.length!==scalar.length||arrays.length!==array.length||!scalar.every(([field,item])=>calls.filter(node=>value(node,'field')===field&&value(node,'name')===item.name&&node.tagName.getText(tree)===(item.kind==='readBoolean'?'BooleanSourceField':imageKeys.includes(field)?'ImageSourceField':'StringField')).length===1)||!array.every(([field,item])=>arrays.some(node=>value(node,'id')===field&&value(node,'name')===item.name)))return false;
  const socialReader=actionTree.statements.find((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==='readSocialLinks'),socialNames:string[]=[];if(socialReader){const visit=(node:ts.Node)=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='getAll'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))socialNames.push(node.arguments[0].text);ts.forEachChild(node,visit);};visit(socialReader);}if(JSON.stringify(social)!==JSON.stringify(socialNames))return false;
  const normal=source.replace(/\s+/gu,'');return normal.includes('defaultValue:typeofpersisted==="string"?persisted:""')&&normal.includes('placeholder:typeofeffective==="string"?effective:""')&&normal.includes('typeofpersisted==="boolean"?String(persisted):"inherit"')&&['inherit','true','false'].every(value=>source.includes('value: "'+value+'"'))&&source.includes('persistedKnowsAbout.join("\\n")')&&source.includes('defaultValue={link.label}')&&source.includes('defaultValue={link.href}');
}

function hasMetaErrorNavigation(source:string,keys:readonly string[]){
  const tree=ts.createSourceFile('meta-nav.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let tabs:ts.ArrayLiteralExpression|undefined;const find=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='tabs'&&node.initializer&&ts.isArrayLiteralExpression(node.initializer))tabs=node.initializer;ts.forEachChild(node,find);};find(tree);if(!tabs)return false;
  const fields:string[]=[],ids:string[]=[];for(const tab of (tabs as ts.ArrayLiteralExpression).elements){if(!ts.isObjectLiteralExpression(tab))return false;const prop=(key:string)=>tab.properties.find((node):node is ts.PropertyAssignment=>ts.isPropertyAssignment(node)&&node.name.getText(tree)===key)?.initializer;const id=prop('id');if(!id||!ts.isStringLiteral(id))return false;ids.push(id.text);let list=prop('fields');while(list&&ts.isAsExpression(list))list=list.expression;if(!list||!ts.isArrayLiteralExpression(list))return false;for(const field of list.elements){if(!ts.isStringLiteral(field))return false;fields.push(field.text);}if(id.text==='preview'&&list.elements.length)return false;}
  const normal=source.replace(/\s+/gu,'');return ids.join('|')==='defaults|identity|crawl|preview'&&fields.length===keys.length&&new Set(fields).size===keys.length&&keys.every(key=>fields.includes(key))&&normal.includes('fields:Object.fromEntries(tabs.flatMap(tab=>tab.fields.map(field=>[field,{tabId:tab.id,targetId:field}])))')&&normal.includes('navigation={navigation}')&&normal.includes('navigationEventName={META_MANAGER_NAVIGATION_EVENT}')&&normal.includes('sectionHeading:undefined')&&normal.includes('sectionDescription:undefined')&&normal.includes('id={index===0?"organizationSocialLinks":undefined}')&&normal.includes('role="group"')&&normal.includes('"aria-invalid":hasError')&&normal.includes('"aria-describedby":fieldSupportIds(field,hasError)');
}

function hasMetaImageAdoption(source:string,owner:string){
  const tree=ts.createSourceFile('meta-images.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),declaration=tree.statements.find((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==='ImageSourceField'),normal=declaration?.getText(tree).replace(/\s+/gu,'')??'';
  if(!source.includes('import AdminMediaImageField from "../../../../components/admin/media/AdminMediaImageField"')||!normal.includes('<AdminMediaImageFieldname={name}label={label}')||!normal.includes('labelClassName={adminFormLabelClassName({textInset:true})}')||!normal.includes('defaultValue={typeofpersisted==="string"?persisted:""}')||!normal.includes('variant="card"')||!normal.includes('urlInput={{id:field,placeholder:typeofeffective==="string"?effective:"",dir,ariaInvalid:hasError,ariaDescribedBy:fieldSupportIds(field,hasError),}}')||!normal.includes('<SourceNotecontract={contract}field={field}/>')||!normal.includes('<AdminFormErrorname={field}/>')||/\b(?:altName|captionName|value)=/u.test(normal))return false;
  const ownerTree=ts.createSourceFile('image-owner.tsx',owner,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),props=ownerTree.statements.find((node):node is ts.TypeAliasDeclaration=>ts.isTypeAliasDeclaration(node)&&node.name.text==='AdminMediaImageFieldProps'),port=props&&ts.isTypeLiteralNode(props.type)?props.type.members.find((node):node is ts.PropertySignature=>ts.isPropertySignature(node)&&node.name.getText(ownerTree)==='urlInput'):undefined;
  if(!port?.questionToken||!port.type||!ts.isTypeLiteralNode(port.type))return false;
  const members=new Map(port.type.members.filter(ts.isPropertySignature).map(node=>[node.name.getText(ownerTree),node]));if(!members.has('id')||members.get('id')?.questionToken||['placeholder','dir','ariaInvalid','ariaDescribedBy'].some(name=>!members.get(name)?.questionToken))return false;
  const ownerNormal=owner.replace(/\s+/gu,'');return ownerNormal.includes('consturlInputOptions=cardPresentation?urlInput:undefined;')&&ownerNormal.includes('{urlInputOptions?(')&&ownerNormal.includes('type="text"id={urlInputOptions.id}name={name}value={value}')&&ownerNormal.includes('placeholder={urlInputOptions.placeholder}')&&ownerNormal.includes('aria-describedby={urlInputOptions.ariaDescribedBy}')&&ownerNormal.includes('onChange={(event)=>updateValue(event.currentTarget.value)}')&&ownerNormal.includes('):<inputref={valueInputRef}type="hidden"name={name}value={value}/>')&&ownerNormal.includes('unoptimized={urlInputOptions?true:undefined}')&&ownerNormal.includes('!canPreviewValue?<MediaNoImage')&&ownerNormal.includes('open={previewOpen&&presentation==="active"&&canPreviewValue}');
}

function verifyMetaImagePreviewGate(owner:string){
  const tree=ts.createSourceFile('image-preview.tsx',owner,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression:string|undefined;const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='canPreviewValue')expression=node.initializer?.getText(tree);ts.forEachChild(node,visit);};visit(tree);assert.ok(expression);const eligible=new Function('value','urlInputOptions','return '+expression) as(value:string,optIn:object|undefined)=>boolean;
  for(const [value,expected] of [['',false],['https://',false],['draft',false],['//example.test/image.png',false],['javascript:alert(1)',false],['/image.png',true],['https://example.test/image.png',true],['http://example.test/image.png',true]] as const){assert.equal(eligible(value,{}),expected);assert.equal(eligible(value,undefined),true,'Omitted URL presentation retains the existing preview eligibility');}
}

async function verifyMetaManagerSourceProof(){
  const source=read('src/app/admin/seo/meta-manager/MetaManagerClient.tsx'),actionSource=read('src/app/admin/seo/meta-manager/actions.ts'),{GLOBAL_SEO_FIELD_KEYS}=await jiti.import<typeof import('../src/lib/seo/global-seo-types.ts')>('../src/lib/seo/global-seo-types.ts');
  const mutationTree=ts.createSourceFile('meta-negative.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),stacks:ts.JsxElement[]=[];const findStack=(node:ts.Node)=>{if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(mutationTree)==='AdminFormRuntime'){const stack=node.children.find(ts.isJsxElement);if(stack)stacks.push(stack);}ts.forEachChild(node,findStack);};findStack(mutationTree);assert.equal(stacks.length,1);const stack=stacks[0]!,lostRuntimeStack=source.slice(0,stack.openingElement.getStart(mutationTree))+'<div>'+source.slice(stack.openingElement.end);
  check('MetaManager selects canonical panel/header/field/source-hint owners and real Tabs→Actions inner20px stack',hasMetaManagerPresentation(source));
  check('MetaManager presentation rejects detached/nested Actions, ineffective Runtime-only stack, lost charcoal/label/hint ports and invented required fields',!hasMetaManagerPresentation(lostRuntimeStack)&&!hasMetaManagerPresentation(lostRuntimeStack.replace('className="pb-10"','className="space-y-5 pb-10"'))&&!hasMetaManagerPresentation(source.replace('presentation="panel"','presentation="default"'))&&!hasMetaManagerPresentation(source.replaceAll('ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME','PARALLEL_CHARCOAL'))&&!hasMetaManagerPresentation(source.replace('adminFormHintClassName({ textInset: true })','adminFormHintClassName({ textInset: false })'))&&!hasMetaManagerPresentation(source.replace('<AdminFormActions','<AdminFormSection><AdminFormActions').replace(/(<AdminFormActions[\s\S]*?\/>)(\s*)<\/div>/u,'$1</AdminFormSection>$2</div>'))&&!hasMetaManagerPresentation(source.replace('presentation="panel"','presentation="panel" required')));
  check('MetaManager native scalar, boolean inheritance, array and repeated social bindings match its actual save parser',hasMetaNativeBindings(source,actionSource));
  check('MetaManager native binding negatives reject effective-as-persisted, lost inheritance, changed array names and social pairing',!hasMetaNativeBindings(source.replace('defaultValue: typeof persisted','defaultValue: typeof effective'),actionSource)&&!hasMetaNativeBindings(source.replace(': "inherit"',': "true"'),actionSource)&&!hasMetaNativeBindings(source.replace('name="robots_txt_allow"','name="lost_robots"'),actionSource)&&!hasMetaNativeBindings(source.replace('name="social_href"','name="lost_social"'),actionSource));
  check('MetaManager derives complete hidden-tab error navigation from the same actual tab field metadata and exposes aggregate social focus',hasMetaErrorNavigation(source,GLOBAL_SEO_FIELD_KEYS));
  check('MetaManager navigation negatives reject lost tab event, field membership, social focus and native error descriptions',!hasMetaErrorNavigation(source.replace('navigationEventName={META_MANAGER_NAVIGATION_EVENT}','navigationEventName={undefined}'),GLOBAL_SEO_FIELD_KEYS)&&!hasMetaErrorNavigation(source.replace('"siteName", "defaultTitle"','"lostSiteName", "defaultTitle"'),GLOBAL_SEO_FIELD_KEYS)&&!hasMetaErrorNavigation(source.replace('id={index === 0 ? "organizationSocialLinks" : undefined}','id={undefined}'),GLOBAL_SEO_FIELD_KEYS)&&!hasMetaErrorNavigation(source.replace('"aria-describedby": fieldSupportIds(field, hasError)','"aria-describedby": undefined'),GLOBAL_SEO_FIELD_KEYS));
  const imageOwner=read('src/components/admin/media/AdminMediaImageField.tsx');check('MetaManager image overrides select the canonical card owner with one raw URL value, inherited placeholder and source/error descriptions',hasMetaImageAdoption(source,imageOwner));
  check('MetaManager image adoption negatives reject effective-as-saved, alternate metadata fields, lost URL input and non-card activation',!hasMetaImageAdoption(source.replace('defaultValue={typeof persisted === "string" ? persisted : ""}','defaultValue={typeof effective === "string" ? effective : ""}'),imageOwner)&&!hasMetaImageAdoption(source.replace('variant="card"','variant="card" altName="invented_alt"'),imageOwner)&&!hasMetaImageAdoption(source,imageOwner.replace('urlInput?: {','urlInput: {'))&&!hasMetaImageAdoption(source,imageOwner.replace('cardPresentation ? urlInput : undefined','urlInput'))&&!hasMetaNativeBindings(source.replace('<ImageSourceField','<StringField'),actionSource));
  verifyMetaImagePreviewGate(imageOwner);check('Opt-in image URL previews reject incomplete/unsafe drafts without changing omitted-owner eligibility',true);
  await verifyMetaListboxDescriptionPort();
}

async function verifyMetaListboxDescriptionPort(){
  const source=read('src/components/admin/ui/AdminFormListboxSelect.tsx'),styles=await jiti.import<typeof import('../src/lib/admin/admin-ui-styles.ts')>('../src/lib/admin/admin-ui-styles.ts');
  const tree=ts.createSourceFile('listbox.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),declaration=tree.statements.find((node):node is ts.TypeAliasDeclaration=>ts.isTypeAliasDeclaration(node)&&node.name.text==='AdminFormListboxSelectProps');
  const port=declaration&&ts.isTypeLiteralNode(declaration.type)?declaration.type.members.find((node):node is ts.PropertySignature=>ts.isPropertySignature(node)&&node.name.getText(tree)==='ariaDescribedBy'):undefined;check('Listbox source descriptions are an optional string port on the existing native Form wrapper',port?.questionToken&&port.type?.kind===ts.SyntaxKind.StringKeyword);
  const node=tree.statements.find((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==='AdminFormListboxSelect');assert.ok(node);const Stub=()=>null;
  const load=(body:string)=>{const exports:{default?:(props:Record<string,unknown>)=>ReactNode}={};new Function('React','exports','useEffect','useId','useRef','useState','AdminListboxSelect','adminFormHintClassName','adminFormLabelClassName',ts.transpileModule(body,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)({createElement},exports,()=>undefined,()=>'-fixture-',()=>({current:null}),(value:unknown)=>[value,()=>undefined],Stub,styles.adminFormHintClassName,styles.adminFormLabelClassName);assert.ok(exports.default);return exports.default;};
  const verify=(body:string)=>{const Wrapper=load(body);for(const loading of [false,true])for(const error of [null,'local error'])for(const unavailable of [false,true])for(const hint of [undefined,'local hint'])for(const external of [undefined,'source-note']){const rendered=Wrapper({id:'control',name:'field',options:unavailable?[]:[{value:'inherit',label:'inherit'}],defaultValue:'inherit',loading,error,hint,ariaDescribedBy:external});assert(isValidElement<{children?:ReactNode}>(rendered));const findControl=(children:ReactNode):ReactNode=>{for(const child of Children.toArray(children)){if(!isValidElement<{children?:ReactNode}>(child))continue;if(child.type===Stub)return child;const nested=findControl(child.props.children);if(nested)return nested;}return null;};const control=findControl(rendered.props.children);assert(isValidElement<{ariaDescribedBy?:string}>(control));const expected=[...(external?[external]:[]),...((loading||error||unavailable||hint)?['control-status']:[])];assert.deepEqual(control.props.ariaDescribedBy?.split(' ')??[],expected);}};
  const body=node.getText(tree);verify(body);check('Listbox normal/loading/error/unavailable/hint states retain default status IDs and merge the external source note',true);
  for(const mutant of [body.replace('    ariaDescribedBy,','    undefined,'),body.replace('loading || error || unavailable || hint ? statusId : undefined','undefined'),body.replace('ariaDescribedBy={describedBy}','ariaDescribedBy={undefined}')]){assert.notEqual(mutant,body);assert.throws(()=>verify(mutant));}check('Listbox description negatives reject a lost external source note or detached canonical status',true);
}

function hasFinalSettingsLayout(source: string, kind: "company" | "password" | "account") {
  const tree=ts.createSourceFile("settings-final.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const cardOwners=canonicalCardBindings(kind==="company"?"src/app/admin/settings/general/CompanyIdentityPanel.tsx":"src/app/admin/settings/security/SecuritySettingsClient.tsx",tree);
  const attribute=(node:ts.JsxOpeningLikeElement,name:string)=>node.attributes.properties.find((entry):entry is ts.JsxAttribute=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)===name)?.initializer?.getText(tree);
  const elements=(node:ts.JsxElement)=>node.children.filter((child):child is ts.JsxElement|ts.JsxSelfClosingElement=>ts.isJsxElement(child)||ts.isJsxSelfClosingElement(child));
  const actions:ts.JsxSelfClosingElement[]=[],label=kind==="company"?'"حفظ هوية الإدارة"':kind==="password"?'"حفظ كلمة المرور"':'"حفظ بيانات الحساب"';
  const visit=(node:ts.Node)=>{if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==="AdminFormActions"&&attribute(node,"submitLabel")===label)actions.push(node);ts.forEachChild(node,visit);};visit(tree);
  if(actions.length!==1)return false;const action=actions[0]!,stack=action.parent;
  if(!ts.isJsxElement(stack)||stack.openingElement.tagName.getText(tree)!=="div"||attribute(stack.openingElement,"className")!=="{ADMIN_FORM_STACK_CLASS_NAME}"||attribute(action,"title")!=='"إجراءات النموذج"')return false;
  const stackChildren=elements(stack),ratio=stackChildren[0];if(stackChildren.length!==2||stackChildren[1]!==action||!ratio||!ts.isJsxElement(ratio)||ratio.openingElement.tagName.getText(tree)!=="AdminFormGrid"||attribute(ratio.openingElement,"columnRatio")!=='"3:2"'||attribute(ratio.openingElement,"presentation")!=='"equal-height-columns"')return false;
  const columns=elements(ratio);if(columns.length!==2||!columns.every(ts.isJsxElement))return false;
  if(kind==="company"){
    if(!source.includes('from "../../../../components/admin/ui"')||!source.includes('entityKey="admin-company-identity"')||!columns.every(node=>ts.isJsxElement(node)&&node.openingElement.tagName.getText(tree)==="AdminFormGrid"&&attribute(node.openingElement,"columns")==="{1}"&&attribute(node.openingElement,"density")==='"sections"'))return false;
    const right=columns[0] as ts.JsxElement,left=columns[1] as ts.JsxElement,panels=elements(right),cards=elements(left);
    if(panels.length!==2||!panels.every((node,index)=>ts.isJsxElement(node)&&node.openingElement.tagName.getText(tree)==="AdminFormSection"&&attribute(node.openingElement,"presentation")==='"panel"'&&attribute(node.openingElement,"header")?.includes(index===0?'id="company-identity"':'id="company-colors"'))||cards.length!==2||!cards.every(node=>ts.isJsxElement(node)&&cardOwners.has(node.openingElement.tagName.getText(tree))))return false;
    let verticalFields=false,fiveFields=false;const inspect=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==="textFields"&&node.initializer&&ts.isArrayLiteralExpression(node.initializer))fiveFields=node.initializer.elements.length===5;if(ts.isJsxExpression(node)&&node.expression&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(tree)==="textFields.map"){const grid=node.parent;verticalFields=ts.isJsxElement(grid)&&grid.openingElement.tagName.getText(tree)==="AdminFormGrid"&&attribute(grid.openingElement,"columns")==="{1}";}ts.forEachChild(node,inspect);};inspect(tree);
    const fields=panels[0]!.getText(tree);return fiveFields&&verticalFields&&fields.includes("textFields.map")&&!fields.includes("AdminMediaImageField")&&panels[1]!.getText(tree).includes("colorFields.map")&&cards[0]!.getText(tree).includes('name="logoUrl"')&&cards[1]!.getText(tree).includes('name="compactLogoUrl"')&&!left.getText(tree).includes("textFields.map");
  }
  const pending=stack.parent,form=pending?.parent,right=columns[0] as ts.JsxElement,empty=columns[1] as ts.JsxElement;
  if(!pending||!ts.isJsxElement(pending)||pending.openingElement.tagName.getText(tree)!=="AdminFormPendingFields"||attribute(pending.openingElement,"pending")!=="{isPending}"||!form||!ts.isJsxElement(form)||form.openingElement.tagName.getText(tree)!=="form"||source.includes("<AdminFormRuntime"))return false;
  const cards=elements(empty),card=cards[0];return right.openingElement.tagName.getText(tree)==="AdminFormSection"&&attribute(right.openingElement,"presentation")==='"panel"'&&attribute(right.openingElement,"header")?.includes('id="security-'+kind+'"')&&right.getText(tree).includes('<AdminFormGrid columns={1}>')&&!right.getText(tree).includes("AdminFormActions")&&empty.openingElement.tagName.getText(tree)==="div"&&attribute(empty.openingElement,"aria-hidden")==='"true"'&&attribute(empty.openingElement,"className")==='"hidden md:grid"'&&cards.length===1&&card&&ts.isJsxElement(card)&&cardOwners.has(card.openingElement.tagName.getText(tree))&&card.children.filter(child=>!ts.isJsxText(child)||child.text.trim()).every(child=>ts.isJsxExpression(child)&&child.expression?.kind===ts.SyntaxKind.NullKeyword)&&attribute(action,"pending")==="{isPending}"&&attribute(action,"showClose")==="{false}";
}

function hasSessionCommandLayout(source:string){
  const tree=ts.createSourceFile("session-final.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),bars:ts.JsxElement[]=[];
  const attribute=(node:ts.JsxOpeningLikeElement,name:string)=>node.attributes.properties.find((entry):entry is ts.JsxAttribute=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)===name)?.initializer?.getText(tree);
  const elements=(node:ts.JsxElement)=>node.children.filter((child):child is ts.JsxElement|ts.JsxSelfClosingElement=>ts.isJsxElement(child)||ts.isJsxSelfClosingElement(child));
  const visit=(node:ts.Node)=>{if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(tree)==="AdminStickyFormBar")bars.push(node);ts.forEachChild(node,visit);};visit(tree);if(bars.length!==1)return false;
  const bar=bars[0]!,stack=bar.parent,pending=stack?.parent,form=pending?.parent;
  if(!source.includes('import { AdminStickyFormBar } from "../../../../components/admin/ui/AdminForm"')||!ts.isJsxElement(stack)||attribute(stack.openingElement,"className")!=="{ADMIN_FORM_STACK_CLASS_NAME}"||!pending||!ts.isJsxElement(pending)||pending.openingElement.tagName.getText(tree)!=="AdminFormPendingFields"||attribute(pending.openingElement,"pending")!=="{isPending || revokePending}"||!form||!ts.isJsxElement(form)||form.openingElement.tagName.getText(tree)!=="form"||!attribute(form.openingElement,"onSubmit")?.includes("setConfirmRevoke(true)")||form.getText(tree).includes("AdminFormActions"))return false;
  const children=elements(stack),panel=children[0],commands=elements(bar),command=commands[0];return children.length===2&&children[1]===bar&&panel&&ts.isJsxElement(panel)&&panel.openingElement.tagName.getText(tree)==="AdminFormSection"&&attribute(panel.openingElement,"header")?.includes('id="security-revoke-sessions"')&&attribute(bar.openingElement,"title")==='"إجراءات النموذج"'&&commands.length===1&&command&&ts.isJsxElement(command)&&command.openingElement.tagName.getText(tree)==="AdminActionButton"&&attribute(command.openingElement,"type")==='"submit"'&&attribute(command.openingElement,"buttonRef")==="{revokeTriggerRef}"&&attribute(command.openingElement,"disabled")==="{isPending || revokePending}"&&attribute(command.openingElement,"variant")==='"danger"';
}

function verifySettingsLayoutRefinementSourceProof() {
  const company=read("src/app/admin/settings/general/CompanyIdentityPanel.tsx"),security=read("src/app/admin/settings/security/SecuritySettingsClient.tsx");
  check("General final layout groups Identity and Colors on the right and both logo cards on the left in the shared equal-height60/40 Grid",hasFinalSettingsLayout(company,"company"));
  check("General final layout rejects lost ratio/stretch/section rhythm, reversed section roles, missing Colors and an altered Actions title",!hasFinalSettingsLayout(company.replace('columnRatio="3:2"','columnRatio="1:1"'),"company")&&!hasFinalSettingsLayout(company.replace('presentation="equal-height-columns"','presentation="plain"'),"company")&&!hasFinalSettingsLayout(company.replace('density="sections"','density="default"'),"company")&&!hasFinalSettingsLayout(company.replace('id="company-colors"','id="company-identity"'),"company")&&!hasFinalSettingsLayout(company.replace('colorFields.map','lostColors.map'),"company")&&!hasFinalSettingsLayout(company.replace('title="إجراءات النموذج"','title="حفظ هوية الإدارة"'),"company"));
  for(const kind of ["password","account"] as const){
    check(kind+" final layout retains its native pending form with right fields, empty desktop Premium Card and standalone Save-only Actions",hasFinalSettingsLayout(security,kind));
    const tree=ts.createSourceFile("nested-actions.tsx",security,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let action:ts.JsxSelfClosingElement|undefined;const find=(node:ts.Node)=>{if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==="AdminFormActions"&&node.getText(tree).includes(kind==="password"?'submitLabel="حفظ كلمة المرور"':'submitLabel="حفظ بيانات الحساب"'))action=node;ts.forEachChild(node,find);};find(tree);assert.ok(action);const nested=security.replace(action.getText(tree),'<AdminFormSection presentation="panel">'+action.getText(tree)+'</AdminFormSection>');
    check(kind+" final layout rejects a visible mobile placeholder, missing stretch/ratio, altered native pending and nested Actions",!hasFinalSettingsLayout(security.replaceAll('className="hidden md:grid"','className="grid"'),kind)&&!hasFinalSettingsLayout(security.replaceAll('presentation="equal-height-columns"','presentation="plain"'),kind)&&!hasFinalSettingsLayout(security.replaceAll('columnRatio="3:2"','columnRatio="1:1"'),kind)&&!hasFinalSettingsLayout(security.replaceAll('pending={isPending}','pending={false}'),kind)&&!hasFinalSettingsLayout(security.replaceAll('title="إجراءات النموذج"','title="حفظ"'),kind)&&!hasFinalSettingsLayout(nested,kind));
  }
  check("Sessions keep the immediate command in the shared standalone StickyBar with native form, pending and Confirm ownership",hasSessionCommandLayout(security));
  check("Sessions reject generic save Actions, changed native command type/pending and lost return-focus ref",!hasSessionCommandLayout(security.replaceAll("AdminStickyFormBar","AdminFormActions"))&&!hasSessionCommandLayout(security.replace('type="submit"','type="button"'))&&!hasSessionCommandLayout(security.replaceAll('pending={isPending || revokePending}','pending={false}'))&&!hasSessionCommandLayout(security.replace('buttonRef={revokeTriggerRef}','buttonRef={undefined}')));
}

function verifySettingsFamilySourceProof() {
const security = read(
  "src/app/admin/settings/security/SecuritySettingsClient.tsx",
);
function hasSecuritySharedSaveBars(source: string) {
  const tree=ts.createSourceFile("security.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),actions:ts.JsxSelfClosingElement[]=[];
  const visit=(node:ts.Node)=>{if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==="AdminFormActions")actions.push(node);ts.forEachChild(node,visit);};visit(tree);
  const value=(node:ts.JsxOpeningLikeElement,name:string)=>node.attributes.properties.find((entry):entry is ts.JsxAttribute=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)===name)?.initializer?.getText(tree);
  return actions.length===2&&!source.includes("<AdminFormRuntime")&&actions.every(node=>{
    const stack=node.parent;
    return value(node,"pending")==="{isPending}"&&value(node,"showClose")==="{false}"&&value(node,"description")==="{null}"&&value(node,"icon")?.includes('name="content"')&&
      ts.isJsxElement(stack)&&stack.openingElement.tagName.getText(tree)==="div"&&value(stack.openingElement,"className")==="{ADMIN_FORM_STACK_CLASS_NAME}";
  });
}
check("Security settings native password and account saves use the exact shared Save-only Actions with controlled pending",hasSecuritySharedSaveBars(security));
check("Security settings Save Bar rejects missing pending, new Close, missing icon and ineffective stack",!hasSecuritySharedSaveBars(security.replace('pending={isPending} showClose={false}','showClose={false}'))&&!hasSecuritySharedSaveBars(security.replace('showClose={false}','showClose={true}'))&&!hasSecuritySharedSaveBars(security.replace('name="content"','name="settings"'))&&!hasSecuritySharedSaveBars(security.replace('className={ADMIN_FORM_STACK_CLASS_NAME}','className="contents"')));
check(
  "Security settings use flat shared section presentation without repeated section descriptions",
  security.includes("activePanelContext") && security.includes("AdminFormSection") &&
    ["security-password", "security-account", "security-sessions", "security-revoke-sessions"].every(id => security.includes(`id="${id}"`)) &&
    security.includes("sectionHeaderPresentation=\"premium\"") && security.includes("ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME") &&
    security.includes("sectionHeading: undefined") && security.includes("sectionDescription: undefined"),
);

function hasGeneralSettingsPremiumPresentation(source: string, kind: "company" | "maintenance") {
  const tree = ts.createSourceFile("general.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = new Map<string, string>();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const path = statement.moduleSpecifier.text;
    const directOwner = path.match(/\/components\/admin\/(?:ui\/)?(AdminCard|AdminActionButton|AdminStatusPill|AdminConfirmDialog)$/u)?.[1];
    if (directOwner && statement.importClause?.name) owners.set(statement.importClause.name.text, directOwner);
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings) && /\/components\/admin\/(?:ui(?:\/AdminForm|\/AdminModuleTabs)?|media)$/u.test(path)) {
      for (const binding of bindings.elements) owners.set(binding.name.text, (binding.propertyName ?? binding.name).text);
    }
  }
  const nodes: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const owned = (name: string) => nodes.filter((node) => owners.get(node.tagName.getText(tree)) === name);
  const value = (node: ts.JsxOpeningLikeElement, name: string) => {
    const attribute = node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name);
    const initializer = attribute?.initializer;
    return initializer && ts.isStringLiteral(initializer) ? initializer.text : initializer && ts.isJsxExpression(initializer) ? initializer.expression?.getText(tree) : undefined;
  };
  const cards = owned("AdminCard");
  const cardOwners = canonicalCardBindings("src/app/admin/settings/general/CompanyIdentityPanel.tsx", tree);
  const headers = owned("AdminFormControlHeader");
  if (!nodes.filter(node => node.tagName.getText(tree) === "AdminCard" || cardOwners.has(node.tagName.getText(tree))).every(node => cardOwners.has(node.tagName.getText(tree))) ||
    !headers.every((node) => ["leading-icon", "compact-inline"].includes(value(node, "presentation") ?? ""))) return false;
  const sections = owned("AdminFormSection"), sectionHeaders = owned("AdminModuleSectionHeader");
  if (!sections.length || !sections.every(node => value(node,"presentation") === "panel") || !sectionHeaders.length || !sectionHeaders.every(node => value(node,"sectionHeaderPresentation") === "premium" && value(node,"sectionHeaderClassName") === "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME")) return false;
  if (kind === "company") {
    const media = owned("AdminMediaImageField");
    const inputs = nodes.filter((node) => node.tagName.getText(tree) === "input");
    const runtime = owned("AdminFormRuntime");
    return owned("AdminFormGrid").some((node) => value(node, "columns") === "3") &&
      cards.length === 2 && sectionHeaders.length === 2 && ["company-identity", "company-colors"].every((id) => sectionHeaders.some((node) => value(node, "id") === id && value(node, "icon") === "settings")) &&
      sectionHeaders.some((node) => value(node, "id") === "company-identity" && value(node, "sectionSummary")?.includes("company.source")) &&
      runtime.length === 1 && value(runtime[0]!, "action") === "updateAdminCompanyAction" && value(runtime[0]!, "entityKey") === "admin-company-identity" &&
      value(runtime[0]!, "mode") === "edit" && value(runtime[0]!, "closeHref") === "/admin" && owned("AdminFormActions").length === 1 && owned("AdminFormField").every(node => value(node,"presentation") === "panel") &&
      media.length === 2 && ["logoUrl", "compactLogoUrl"].every((name) => media.some((node) => value(node, "name") === name && value(node, "focusTargetId") === name && value(node, "ariaInvalid") === `Boolean(fieldErrors.${name}?.length)` && value(node, "variant") === "card" && value(node, "browseFolder") === "images" && value(node, "showLabel") === "false")) &&
      inputs.length === 2 && inputs.every((node) => value(node, "name") === "name" && value(node, "defaultValue") === "value" && value(node, "className")?.startsWith("adminFormFieldClassName(")) && inputs.some((node) => value(node, "type") === "color");
  }
  const actions = owned("AdminActionButton");
  const trigger = actions.find((node) => value(node, "buttonRef") === "toggleTriggerRef");
  return actions.length === 2 && !nodes.some((node) => node.tagName.getText(tree) === "button") && Boolean(trigger &&
    value(trigger, "type") === "button" && value(trigger, "disabled") === "pending || refreshPending || !readAvailable" && value(trigger, "aria-pressed") === "readAvailable ? enabled : undefined") &&
    owned("AdminConfirmDialog").some((node) => value(node, "returnFocusRef") === "toggleTriggerRef" && value(node, "open") === "readAvailable && confirmNextEnabled !== null" && value(node, "pending") === "pending") && source.includes('const FEEDBACK_CHANNEL = "settings-general-maintenance"');
}

const companyIdentity = read("src/app/admin/settings/general/CompanyIdentityPanel.tsx");
const maintenanceMode = read("src/app/admin/settings/general/MaintenanceModePanel.tsx");
function hasSettingsPanelRolePlacement(source: string) {
  const tree = ts.createSourceFile("settings.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const canonical = new Map<string,string>();
  for (const node of tree.statements) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /(?:components\/admin\/ui|^\.\.\/ui)(?:\/AdminForm|\/AdminModuleTabs)?$/u.test(node.moduleSpecifier.text)) {
    const named = node.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) for (const binding of named.elements) canonical.set(binding.name.text,(binding.propertyName??binding.name).text);
  }
  const headers: ts.JsxSelfClosingElement[] = [], fields: ts.JsxOpeningLikeElement[] = [];
  const inspect = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && canonical.get(node.tagName.getText(tree)) === "AdminModuleSectionHeader") headers.push(node);
    if ((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)) && canonical.get(node.tagName.getText(tree)) === "AdminFormField") fields.push(node);
    ts.forEachChild(node,inspect);
  }; inspect(tree);
  const attribute = (node: ts.JsxOpeningLikeElement,name:string) => node.attributes.properties.find((entry):entry is ts.JsxAttribute=>ts.isJsxAttribute(entry)&&entry.name.getText(tree)===name)?.initializer;
  const literal = (node: ts.JsxOpeningLikeElement,name:string,value:string) => {const entry=attribute(node,name);return Boolean(entry&&ts.isStringLiteral(entry)&&entry.text===value);};
  return headers.length>0 && headers.every(header=>{
    let slot: ts.Node | undefined = header.parent;while(slot&&!ts.isJsxAttribute(slot)&&slot!==tree)slot=slot.parent;const owner=slot?.parent?.parent;
    return literal(header,"sectionHeaderPresentation","premium") && attribute(header,"sectionHeaderClassName")?.getText(tree)==="{ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}" &&
      slot && ts.isJsxAttribute(slot) && slot.name.getText(tree)==="header" && owner && ts.isJsxOpeningElement(owner) && canonical.get(owner.tagName.getText(tree))==="AdminFormSection" && literal(owner,"presentation","panel");
  }) && fields.every(field=>literal(field,"presentation","panel"));
}
const settingsPanelPaths=["src/app/admin/settings/general/CompanyIdentityPanel.tsx","src/app/admin/settings/general/MaintenanceModePanel.tsx","src/app/admin/settings/security/SecuritySettingsClient.tsx","src/app/admin/settings/media/MediaSettingsPanel.tsx","src/app/admin/settings/media/MediaRecoveryCenter.tsx","src/components/admin/integrations/AdminIntegrationsPlatform.tsx","src/components/admin/integrations/IntegrationConnectionWizard.tsx","src/components/admin/integrations/IntegrationsServerConfiguration.tsx"];
check("Settings family panel headers and fields retain their canonical owner and actual role placement",settingsPanelPaths.every(file=>hasSettingsPanelRolePlacement(read(file))));
check("Settings family rejects missing charcoal, wrong slot, default field and parallel Section owner",settingsPanelPaths.every(file=>{
  const source=read(file);
  return !hasSettingsPanelRolePlacement(source.replaceAll("ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME","PARALLEL_CHARCOAL")) &&
    !hasSettingsPanelRolePlacement(source.replace(/\bheader=\{/gu,"unownedHeader={")) &&
    !hasSettingsPanelRolePlacement(source.replaceAll("AdminFormSection","ParallelSection")) &&
    (!source.includes("<AdminFormField") || !hasSettingsPanelRolePlacement(source.replace(/(<AdminFormField\b[^>]*?)presentation="panel"/u,'$1presentation="default"')));
}));
function hasCompanyIdentitySpacingComposition(source: string) {
  return hasFinalSettingsLayout(source,"company");
}

check("Company identity adopts existing Premium cards, headers and media while retaining native RGB fields and Form Runtime", hasGeneralSettingsPremiumPresentation(companyIdentity, "company"));
check("Company Runtime callback owns one real stack with the final equal-height ratio and standalone SaveBar", hasCompanyIdentitySpacingComposition(companyIdentity));
check("Company spacing rejects a form-only stack, a parallel Section and detached SaveBar", !hasCompanyIdentitySpacingComposition(companyIdentity.replace('<div className={ADMIN_FORM_STACK_CLASS_NAME}>', '<div>')) && !hasCompanyIdentitySpacingComposition(companyIdentity.replaceAll('AdminFormSection', 'ParallelSection')) && !hasCompanyIdentitySpacingComposition(companyIdentity.replace('<div className={ADMIN_FORM_STACK_CLASS_NAME}>', '<><div className={ADMIN_FORM_STACK_CLASS_NAME}>').replace(/(<AdminFormActions\b[\s\S]*?\/>)(\s*)<\/div>/u, '</div>$2$1</>')));
check("Company section headings reject a parallel owner, forced control scale and missing source summary", !hasGeneralSettingsPremiumPresentation(companyIdentity.replace('/ui/AdminModuleTabs"', '/ui/ParallelModuleTabs"'), "company") && !hasGeneralSettingsPremiumPresentation(companyIdentity.replace('id="company-identity"', 'id="company-identity" sectionHeaderPresentation="control"'), "company") && !hasGeneralSettingsPremiumPresentation(companyIdentity.replace("{company.source}", "{null}"), "company"));
check("Company media validation rejects missing visible focus targets", ["logoUrl","compactLogoUrl"].every(name=>!hasGeneralSettingsPremiumPresentation(companyIdentity.replace(`focusTargetId="${name}"`, `focusTargetId="lost-${name}"`),"company")));
check("Maintenance Premium adopts canonical controls while preserving its immediate command, pending and confirmation contract", hasGeneralSettingsPremiumPresentation(maintenanceMode, "maintenance"));
check("General Settings accepts compatibility Card selectors and rejects missing Card bindings, parallel controls and altered native RGB/media contracts", hasGeneralSettingsPremiumPresentation(companyIdentity.replaceAll('<AdminCard presentation="premium"', '<AdminCard presentation="default"'), "company") && !hasGeneralSettingsPremiumPresentation(companyIdentity.replace("  AdminCard,", ""), "company") && !hasGeneralSettingsPremiumPresentation(companyIdentity.replaceAll('variant="card"', 'variant="plain"'), "company") && !hasGeneralSettingsPremiumPresentation(companyIdentity.replace('type="color"', 'type="text"'), "company") && !hasGeneralSettingsPremiumPresentation(maintenanceMode.replace('/ui/AdminActionButton"', '/ui/ParallelActionButton"'), "maintenance"));
check("Maintenance presentation rejects lost pressed, pending, confirmation focus and Premium ownership", !hasGeneralSettingsPremiumPresentation(maintenanceMode.replaceAll('presentation="panel"', 'presentation="default"'), "maintenance") && !hasGeneralSettingsPremiumPresentation(maintenanceMode.replace('aria-pressed={readAvailable ? enabled : undefined}', ''), "maintenance") && !hasGeneralSettingsPremiumPresentation(maintenanceMode.replace('disabled={pending || refreshPending || !readAvailable}', 'disabled={pending}'), "maintenance") && !hasGeneralSettingsPremiumPresentation(maintenanceMode.replace('returnFocusRef={toggleTriggerRef}', 'returnFocusRef={undefined}'), "maintenance"));
verifySettingsLayoutRefinementSourceProof();
}
verifySettingsFamilySourceProof();
await verifyMetaManagerSourceProof();

function hasNestedModuleTabs(source: string) {
  const tree = ts.createSourceFile("editor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = new Set(["AdminModuleTabs", "ModuleEditorTabs"]);
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (statement.moduleSpecifier.text.endsWith("/AdminModuleTabs") && statement.importClause?.name) owners.add(statement.importClause.name.text);
    if (bindings && ts.isNamedImports(bindings)) for (const specifier of bindings.elements) {
      if (["AdminModuleTabs", "ModuleEditorTabs"].includes((specifier.propertyName ?? specifier.name).text)) owners.add(specifier.name.text);
    }
  }
  let nested = false;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && owners.has(node.tagName.getText(tree))) nested = true;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return nested;
}
check(
  "the legacy nested About CTA Tabs owner is retired; decorative tab icons are allowed",
  !hasNestedModuleTabs(aboutCta) &&
    hasNestedModuleTabs('import Tabs from "./AdminModuleTabs"; const node = <Tabs />;') &&
    hasNestedModuleTabs('import { ModuleEditorTabs as Tabs } from "./ModuleEditorPresentation"; const node = <Tabs />;') &&
    !hasNestedModuleTabs('import { AdminModuleTabIcon } from "./AdminModuleTabs"; const node = <AdminModuleTabIcon name="media" />;') &&
    !aboutCta.includes('section === "all"') &&
    read("src/components/admin/page-blocks/ContentModuleEditClient.tsx").includes("aboutCtaTabs"),
);

check(
  "specialized Project Hub Hero has no local header parallel to the shared Section Hero",
  !read(
    "src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx",
  ).includes("<h2"),
);

const combinedModuleEditorGraph = new Map(
  registeredModuleEditorGraphs.flatMap(({ graph }) => [...graph]),
);
const moduleEditorSources = [...combinedModuleEditorGraph].flatMap(
  ([path, file]) => {
    const isDomainImplementation =
      moduleEditorRootSet.has(path) ||
      path.startsWith("src/components/admin/page-blocks/editors/") ||
      path === "src/components/admin/page-blocks/FeedModuleFilterFields.tsx" ||
      path.startsWith("src/app/admin/pages-blocks/blocks/hero/[id]/");
    return isDomainImplementation
      ? [{ path, source: file.getFullText() }]
      : [];
  },
);
const moduleSpecificEditorSources = moduleEditorSources.filter(
  ({ path }) =>
    path.startsWith("src/components/admin/page-blocks/editors/") &&
    path.endsWith("ModuleEditor.tsx"),
);

const sharedTextFormatControls = read(
  "src/components/admin/ui/AdminTextFormatControls.tsx",
);
const sharedRichTextEditor = read(
  "src/components/admin/AdminRichTextEditor.tsx",
);
const sharedModuleEditorPresentation = read(
  "src/components/admin/page-blocks/ModuleEditorPresentation.tsx",
);
const moduleEditorVisibilityAlignRowSource = sharedModuleEditorPresentation.slice(
  sharedModuleEditorPresentation.indexOf(
    "export function ModuleEditorVisibilityAlignRow",
  ),
  sharedModuleEditorPresentation.indexOf(
    "export function ModuleEditorIdentitySection",
  ),
);
const heroTextFormatConsumer = read(
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx",
);
const homeProjectsTextFormatConsumer = read(
  "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
);
const aboutPrinciplesTextFormatConsumer = read(
  "src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx",
);

check(
  "one Design System toolbar owns Bold and icon-only alignment across reference and specialized editors",
  sharedTextFormatControls.includes('data-admin-text-format-controls=""') &&
    sharedTextFormatControls.includes('data-admin-text-format-bold=""') &&
    sharedTextFormatControls.includes(
      "data-admin-text-alignment={option.value}",
    ) &&
    sharedTextFormatControls.includes("aria-pressed={active}") &&
    sharedRichTextEditor.includes("AdminTextFormatControls") &&
    sharedModuleEditorPresentation.includes("AdminTextFormatControls") &&
    heroTextFormatConsumer.includes(
      "ModuleEditorVisibilityAlignRow as default",
    ) &&
    homeProjectsTextFormatConsumer.includes("ModuleEditorVisibilityAlignRow") &&
    aboutPrinciplesTextFormatConsumer.includes(
      "ModuleEditorVisibilityAlignRow",
    ) &&
    [
      sharedModuleEditorPresentation,
      homeProjectsTextFormatConsumer,
      aboutPrinciplesTextFormatConsumer,
    ].every(
      (source) =>
        !source.includes('label: "يمين"') &&
        !source.includes('label: "وسط"') &&
        !source.includes('label: "يسار"') &&
        !source.includes("function toolClass"),
    ) &&
    !sharedRichTextEditor.includes('label="يمين"') &&
    !sharedRichTextEditor.includes('label="وسط"') &&
    !sharedRichTextEditor.includes('label="يسار"'),
);

check(
  "shared editor navigation preserves its controls while adopting the denser panel cadence",
  sharedTabs.includes('className="space-y-4"') &&
    sharedTabs.includes("min-h-[76px]") &&
    sharedTabs.includes('className="mb-4" data-admin-active-panel-context'),
);

check(
  "every Page Blocks module editor root adopts the thin shared header, tabs, feedback, pages, and save composition",
  moduleEditorRootSources.every(({ source }) =>
    [
      "<ModuleEditorHeader",
      "<ModuleEditorTabs",
      "<ModuleEditorFeedback",
      "<ModuleEditorPagesTab",
      "<ModuleEditorSaveArea",
    ].every((token) => source.includes(token)),
  ),
);

check(
  "Module Editor consumers delegate Header and Section Hero metadata without local title, description, or icon ownership",
  moduleEditorRootSources.every(({ path, source }) => {
    const result = moduleEditorMetadataPropsAreDelegated(path, source);
    return (
      result.delegated &&
      result.headerCount >= 1 &&
      result.tabsCount >= 1 &&
      !source.includes("sectionHeading:") &&
      !source.includes("sectionDescription:") &&
      !source.includes("navigationLabel:") &&
      !source.includes("icon:")
    );
  }),
);

type ModuleEditorMetadataInventoryEntry = {
  sourcePath: string;
  moduleKind: string;
  moduleSlug: string | null;
  tabIds: readonly string[];
};

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function getJsxAttribute(
  node: ts.JsxOpeningLikeElement,
  name: string,
): ts.JsxAttribute | undefined {
  return node.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText() === name,
  );
}

function getJsxStringValue(
  attribute: ts.JsxAttribute | undefined,
): string | null {
  const initializer = attribute?.initializer;
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    (ts.isStringLiteral(initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(initializer.expression))
  ) {
    return initializer.expression.text;
  }
  return null;
}

function collectModuleEditorTabs(path: string, activeEditorKey?: string, activeModuleSlug?: string | null) {
  const source = read(path);
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = new Map<string, ts.Expression>();

  function collectDeclarations(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collectDeclarations);
  }
  collectDeclarations(file);

  const UNKNOWN = Symbol("unknown-static-value");
  const TRUTHY = Symbol("truthy-static-value");
  type StaticValue = string | number | boolean | null | typeof UNKNOWN | typeof TRUTHY;

  function evaluateStaticValue(
    expression: ts.Expression,
    resolving = new Set<string>(),
  ): StaticValue {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isNonNullExpression(expression)
    ) {
      return evaluateStaticValue(expression.expression, resolving);
    }
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text;
    }
    if (ts.isNumericLiteral(expression)) return Number(expression.text);
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(expression) || ts.isObjectLiteralExpression(expression)) {
      return TRUTHY;
    }
    if (activeModuleSlug !== undefined && ts.isCallExpression(expression) && expression.expression.getText(file) === "Boolean") {
      const field = expression.arguments[0];
      if (field && ts.isPropertyAccessExpression(field) && ts.isPropertyAccessExpression(field.expression) && field.expression.name.text === "editorSections") {
        const lookup = field.expression.expression;
        if (ts.isCallExpression(lookup) && lookup.expression.getText(file) === "getSlotModuleSlugMetadata" && lookup.arguments[0]?.getText(file) === "block.slug") {
          return Boolean(activeModuleSlug && getSlotModuleSlugMetadata(activeModuleSlug)?.editorSections?.[field.name.text]);
        }
      }
    }
    if (ts.isIdentifier(expression)) {
      if (expression.text === "editorKey" && activeEditorKey !== undefined) {
        return activeEditorKey;
      }
      if (resolving.has(expression.text)) return UNKNOWN;
      const declaration = declarations.get(expression.text);
      return declaration
        ? evaluateStaticValue(
            declaration,
            new Set(resolving).add(expression.text),
          )
        : UNKNOWN;
    }
    if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
      const value = evaluateStaticValue(expression.operand, resolving);
      return value === UNKNOWN ? UNKNOWN : !Boolean(value);
    }
    if (ts.isBinaryExpression(expression)) {
      const left = evaluateStaticValue(expression.left, resolving);
      const right = evaluateStaticValue(expression.right, resolving);
      if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
      switch (expression.operatorToken.kind) {
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
        case ts.SyntaxKind.EqualsEqualsToken:
          return left === right;
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
        case ts.SyntaxKind.ExclamationEqualsToken:
          return left !== right;
        case ts.SyntaxKind.AmpersandAmpersandToken:
          return Boolean(left) ? right : left;
        case ts.SyntaxKind.BarBarToken:
          return Boolean(left) ? left : right;
        default:
          return UNKNOWN;
      }
    }
    if (ts.isConditionalExpression(expression)) {
      const condition = evaluateStaticValue(expression.condition, resolving);
      if (condition === UNKNOWN) return UNKNOWN;
      return evaluateStaticValue(
        Boolean(condition) ? expression.whenTrue : expression.whenFalse,
        resolving,
      );
    }
    return UNKNOWN;
  }

  function conditionMatches(expression: ts.Expression, expected: boolean) {
    const value = evaluateStaticValue(expression);
    return value !== UNKNOWN && Boolean(value) === expected;
  }

  function usageIsReachable(node: ts.Node) {
    if (activeEditorKey === undefined) return true;
    let current: ts.Node = node;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isConditionalExpression(parent)) {
        if (current === parent.whenTrue && !conditionMatches(parent.condition, true)) {
          return false;
        }
        if (current === parent.whenFalse && !conditionMatches(parent.condition, false)) {
          return false;
        }
      }
      if (
        ts.isBinaryExpression(parent) &&
        current === parent.right &&
        parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        !conditionMatches(parent.left, true)
      ) {
        return false;
      }
      current = parent;
    }
    return true;
  }

  const cache = new Map<string, readonly string[]>();
  function resolveTabIds(
    expression: ts.Expression,
    resolving = new Set<string>(),
  ): readonly string[] {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      return resolveTabIds(expression.expression, resolving);
    }

    if (ts.isConditionalExpression(expression)) {
      if (activeModuleSlug !== undefined) {
        const condition = evaluateStaticValue(expression.condition);
        if (condition !== UNKNOWN) return resolveTabIds(Boolean(condition) ? expression.whenTrue : expression.whenFalse, resolving);
      }
      return unique([
        ...resolveTabIds(expression.whenTrue, resolving),
        ...resolveTabIds(expression.whenFalse, resolving),
      ]);
    }

    if (ts.isIdentifier(expression)) {
      const cached = cache.get(expression.text);
      if (cached) return cached;
      if (resolving.has(expression.text)) return [];
      const declaration = declarations.get(expression.text);
      if (!declaration) return [];
      const resolved = resolveTabIds(
        declaration,
        new Set(resolving).add(expression.text),
      );
      cache.set(expression.text, resolved);
      return resolved;
    }

    if (ts.isObjectLiteralExpression(expression)) {
      const id = expression.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(file) === "id",
      );
      if (
        id &&
        (ts.isStringLiteral(id.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(id.initializer))
      ) {
        return [id.initializer.text];
      }
      return [];
    }

    if (ts.isArrayLiteralExpression(expression)) {
      return unique(
        expression.elements.flatMap((element) =>
          ts.isSpreadElement(element)
            ? resolveTabIds(element.expression, resolving)
            : resolveTabIds(element, resolving),
        ),
      );
    }

    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === "map") {
      let source: ts.Expression = expression.expression.expression;
      while (ts.isParenthesizedExpression(source) || ts.isAsExpression(source)) source = source.expression;
      const callback = expression.arguments[0];
      if (ts.isArrayLiteralExpression(source) && callback && ts.isArrowFunction(callback) && callback.parameters.length === 1 && ts.isIdentifier(callback.parameters[0].name)) {
        let body = callback.body;
        while (ts.isParenthesizedExpression(body)) body = body.expression;
        if (ts.isObjectLiteralExpression(body)) {
          const id = body.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(file) === "id");
          if (id && ts.isIdentifier(id.initializer) && id.initializer.text === callback.parameters[0].name.text) {
            return unique(source.elements.flatMap(element => ts.isStringLiteral(element) ? [element.text] : []));
          }
        }
      }
    }

    return [];
  }

  const usages: Array<{
    moduleKind: string;
    tabsVariable: string | null;
    tabIds: readonly string[];
  }> = [];

  function inspectOpeningElement(node: ts.JsxOpeningLikeElement) {
    if (node.tagName.getText(file) !== "ModuleEditorTabs") return;
    if (!usageIsReachable(node)) return;
    const moduleKind = getJsxStringValue(getJsxAttribute(node, "moduleKind"));
    const tabsAttribute = getJsxAttribute(node, "tabs");
    const tabsExpression =
      tabsAttribute?.initializer &&
      ts.isJsxExpression(tabsAttribute.initializer) &&
      tabsAttribute.initializer.expression
        ? tabsAttribute.initializer.expression
        : null;
    assert.ok(
      moduleKind,
      `${path} must declare a literal ModuleEditorTabs moduleKind`,
    );
    assert.ok(
      tabsExpression,
      `${path} must declare a resolvable ModuleEditorTabs tabs expression`,
    );
    const tabIds = resolveTabIds(tabsExpression);
    assert.ok(
      tabIds.length > 0,
      `${path} must expose at least one actual ModuleEditorTabs tab id`,
    );
    usages.push({
      moduleKind,
      tabsVariable: ts.isIdentifier(tabsExpression)
        ? tabsExpression.text
        : null,
      tabIds,
    });
  }

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      inspectOpeningElement(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return usages;
}

const rootEditorInventory: ModuleEditorMetadataInventoryEntry[] =
  moduleEditorRootSources
    .filter(({ path }) => !path.endsWith("ContentModuleEditClient.tsx"))
    .flatMap(({ path }) => {
      // Exercise both existing default and approved slug opt-in; unknown conditions still audit both branches.
      const scopes = path.endsWith("FeaturedModuleEditClient.tsx")
        ? [null, "media-featured-content-news"]
        : [undefined];
      return scopes.flatMap((moduleSlug) =>
        collectModuleEditorTabs(path, undefined, moduleSlug).map(({ moduleKind, tabIds }) => ({
          sourcePath: path, moduleKind, moduleSlug: moduleSlug ?? null, tabIds,
        })),
      );
    });

assert.deepEqual(
  rootEditorInventory.filter(({ moduleKind }) => moduleKind === "featured").map(({ moduleSlug, tabIds }) => ({ moduleSlug, tabIds })),
  [
    { moduleSlug: null, tabIds: ["content", "text", "presentation", "pages"] },
    { moduleSlug: "media-featured-content-news", tabIds: ["content", "text", "presentation", "pages"] },
  ],
  "Featured default and scoped consumers retain their approved independent text tab",
);

const contentEditorPath =
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx";
const defaultContentUsage = collectModuleEditorTabs(
  contentEditorPath,
  "generic",
);
assert.equal(
  defaultContentUsage.length,
  1,
  "Content Module Editor must expose one executable default tab set",
);

const contentEditorInventory: ModuleEditorMetadataInventoryEntry[] = [
  {
    sourcePath: contentEditorPath,
    moduleKind: "content",
    moduleSlug: null,
    tabIds: defaultContentUsage[0]!.tabIds,
  },
  ...STRUCTURAL_CONTENT_TEMPLATE_SLUGS.map((moduleSlug) => {
    const editorKey = getContentModuleEditorKey(moduleSlug, moduleSlug);
    const usages = collectModuleEditorTabs(contentEditorPath, editorKey);
    assert.equal(
      usages.length,
      1,
      `Content Module Editor must expose one executable tab set for ${moduleSlug}`,
    );
    return {
      sourcePath: contentEditorPath,
      moduleKind: resolveModuleProductKind("content", moduleSlug, moduleSlug),
      moduleSlug,
      tabIds: usages[0]!.tabIds,
    };
  }),
];

assert.deepEqual(
  contentEditorInventory.find(entry => entry.moduleSlug === "search-platform")?.tabIds,
  ["content", "search", "presentation", "pages"],
  "Search metadata audits every actual flat tab, including mapped sections and both legacy IDs",
);

const moduleEditorMetadataInventory = [
  ...rootEditorInventory,
  ...contentEditorInventory,
];
const missingMetadataCombinations = moduleEditorMetadataInventory.flatMap(
  ({ moduleKind, moduleSlug, tabIds }) =>
    tabIds.flatMap((tabId) => {
      const metadata = getModuleEditorSectionMetadata(
        moduleKind,
        tabId,
        moduleSlug,
      );
      const sectionChromeComplete =
        metadata?.sectionHeadingAr === null
          ? metadata.sectionDescriptionAr === null
          : Boolean(
              metadata?.sectionHeadingAr.trim().length &&
              (metadata.sectionDescriptionAr === null ||
                metadata.sectionDescriptionAr.trim().length > 0),
            );
      const complete =
        metadata !== null &&
        metadata.navigationLabelAr.trim().length > 0 &&
        sectionChromeComplete &&
        (metadata.sectionChrome !== "implicit" ||
          (metadata.sectionHeadingAr === null &&
            metadata.sectionDescriptionAr === null)) &&
        metadata.icon.trim().length > 0;
      return complete
        ? []
        : [`${moduleKind}:${moduleSlug ?? "default"}:${tabId}`];
    }),
);

moduleEditorMetadataInventory.forEach(({ moduleKind, moduleSlug, tabIds }) => {
  console.log(
    `INVENTORY ${moduleKind}:${moduleSlug ?? "default"} -> ${tabIds.join(",")}`,
  );
});

check(
  `the current module registry completely owns every actual Module Editor Header and Section Hero combination; missing=${missingMetadataCombinations.join(",") || "none"}`,
  moduleEditorMetadataInventory.every(
    ({ moduleKind, moduleSlug }) =>
      getModuleEditorHeaderMetadata(
        moduleKind,
        moduleSlug,
        "Module instance",
      ) !== null &&
      (moduleSlug === null || getSlotModuleSlugMetadata(moduleSlug) !== null),
  ) && missingMetadataCombinations.length === 0,
);

const infrastructureRoleByTabId = new Map<string, "settings" | "visibility">([
  ["meta", "settings"],
  ["settings", "settings"],
  ["pages", "visibility"],
  ["display", "visibility"],
] as const);
const misclassifiedInfrastructureTabs = moduleEditorMetadataInventory.flatMap(
  ({ moduleKind, moduleSlug, tabIds }) =>
    tabIds.flatMap((tabId) => {
      const expectedRole = infrastructureRoleByTabId.get(tabId);
      if (!expectedRole) return [];
      const metadata = getModuleEditorSectionMetadata(
        moduleKind,
        tabId,
        moduleSlug,
      );
      return metadata?.operationalRole === expectedRole
        ? []
        : [`${moduleKind}:${moduleSlug ?? "default"}:${tabId}`];
    }),
);

check(
  `shared metadata owns canonical domain, Settings, then Pages/Visibility tab order; misclassified=${misclassifiedInfrastructureTabs.join(",") || "none"}`,
  moduleEditorPresentation.includes("getModuleEditorSectionOrder") &&
    moduleEditorPresentation.includes("left.order - right.order") &&
    getModuleEditorSectionOrder({
      navigationLabelAr: "domain",
      sectionHeadingAr: null,
      sectionDescriptionAr: null,
      icon: "content",
    }) === 0 &&
    getModuleEditorSectionOrder({
      navigationLabelAr: "settings",
      sectionHeadingAr: null,
      sectionDescriptionAr: null,
      icon: "settings",
      operationalRole: "settings",
    }) === 1 &&
    getModuleEditorSectionOrder({
      navigationLabelAr: "visibility",
      sectionHeadingAr: null,
      sectionDescriptionAr: null,
      icon: "plans",
      operationalRole: "visibility",
    }) === 2 &&
    misclassifiedInfrastructureTabs.length === 0,
);

check(
  "identity composition is shared by every root and no empty Settings tab survives",
  moduleEditorRootSources
    .every(
      ({ source }) =>
        source.includes("<ModuleEditorIdentitySection") &&
        !source.includes("<ModuleEditorSettingsComposition") &&
        !source.includes('id: "settings"') &&
        !source.includes('id: "meta"'),
    ) &&
    moduleEditorPresentation.includes(
      "export function ModuleEditorIdentitySection",
    ) &&
    moduleEditorPresentation.includes('data-module-editor-name-field=""') &&
    moduleEditorPresentation.includes(
      'data-module-editor-identity-control=""',
    ) &&
    moduleEditorPresentation.includes(
      'className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-3"',
    ) &&
    moduleEditorPresentation.includes(
      "[&>[data-admin-form-listbox]]:grid-cols-[max-content_minmax(0,1fr)]",
    ) &&
    !moduleEditorPresentation.includes(
      "export function ModuleEditorSettingsComposition",
    ),
);

check(
  "all module-specific section surfaces delegate to shared Module Editor sections or existing Premium cards",
  moduleSpecificEditorSources.every(({ path }) => {
    const graph = collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: [path],
      symbolAware: true,
    });
    return [...graph.values()].some((file) =>
      file.getFullText().includes("<ModuleEditorSection") ||
      (() => {
        const owners = canonicalCardBindings(file.fileName, file);
        let found = false;
        const visit = (node: ts.Node) => {
          if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && owners.has(node.tagName.getText(file))) found = true;
          ts.forEachChild(node, visit);
        };
        visit(file); return found;
      })(),
    );
  }) &&
    moduleEditorSources.every(
      ({ source }) =>
        !source.includes(
          "space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5",
        ),
    ),
);

check(
  "Module Editors contain no native selects and no raw on-off checkboxes",
  moduleEditorSources.every(
    ({ source }) =>
      !source.includes("<select") && !source.includes('type="checkbox"'),
  ),
);

check(
  "page assignment multi-selection adopts the shared checkbox owner",
  read(
    "src/components/admin/page-blocks/ModulePageAssignmentsField.tsx",
  ).includes("AdminCheckbox") &&
    read(
      "src/components/admin/page-blocks/ModulePageAssignmentsField.tsx",
    ).includes('name="page_ids"') &&
    read(
      "src/components/admin/page-blocks/ModulePageAssignmentsField.tsx",
    ).includes('presentation="premium"') &&
    !read(
      "src/components/admin/page-blocks/ModulePageAssignmentsField.tsx",
    ).includes('type="checkbox"'),
);

check(
  "technical identity and internal descriptions stay preserved but hidden from product editors",
  !moduleEditorPresentation.includes('"read-only"') &&
    read(
      "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
    ).includes('<input type="hidden" name="slug" value={block.slug}') &&
    read(
      "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
    ).includes('<input type="hidden" name="internal_description"') &&
    read("src/app/admin/pages-blocks/blocks/content/actions.ts").includes(
      "slugLocked ? existing.slug : requestedSlug",
    ) &&
    read(
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
    ).includes('<input type="hidden" name="slug" value={hero.slug}') &&
    !moduleEditorPresentation.includes("ModuleEditorTechnicalIdentity") &&
    moduleEditorSources.every(
      ({ source }) => !source.includes('mode="read-only"'),
    ) &&
    moduleEditorRootSources
      .filter(({ source }) => source.includes('name="slug"'))
      .every(
        ({ source }) =>
          source.includes('<input type="hidden" name="slug"') &&
          !source.includes('mode="editable"'),
      ) &&
    !read(
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
    ).includes("ModuleEditorTechnicalIdentity") &&
    read(
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
    ).includes('<input type="hidden" name="description"') &&
    read("src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts").includes(
      '.select("slug,variant")',
    ) &&
    registeredModuleEditorGraphs
      .filter(({ entry }) => entry.registryModuleKind.startsWith("media-"))
      .every(({ root }) => !root.source.includes('name="slug"')),
);

const moduleEditorListboxConsumers = moduleEditorSources.filter(({ source }) =>
  source.includes("AdminFormListboxSelect"),
);
const moduleEditorSwitchConsumers = moduleEditorSources.filter(({ source }) =>
  source.includes("AdminFormSwitch"),
);
const moduleEditorGridConsumers = moduleEditorSources.filter(
  ({ source }) =>
    source.includes("AdminFormGrid") ||
    source.includes("ModuleEditorFieldGrid") ||
    source.includes("ModuleEditorRepeaterGrid"),
);

check(
  "shared listboxes, switches, and grids own standard Module Editor controls",
  moduleEditorListboxConsumers.length > 0 &&
    moduleEditorSwitchConsumers.length > 0 &&
    moduleEditorGridConsumers.length > 0 &&
    read(
      "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
    ).includes("ModuleEditorVisibilityAlignRow") &&
    !read(
      "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
    ).includes('alignmentOptions={["right", "center"]}') &&
    read(
      "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
    ).includes("ModuleEditorVisibilityAlignRow") &&
    moduleEditorVisibilityAlignRowSource.includes("<AdminFormSwitch") &&
    [
      "ModuleEditorVisibilityAlignRow",
      'controlMode="visibility-only"',
      '<AdminFormGrid columns={1} className="mt-4">',
    ].every((token) =>
      read(
        "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
      ).includes(token),
    ) &&
    !read(
      "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
    ).includes("FeaturedDisplayVisibility") &&
    [
      'name="show_navigation_arrows"',
      'name="show_navigation_dots"',
      'name="navigation_autoplay"',
      'alignmentName="display_title_alignment"',
    ].every((token) =>
      read(
        "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
      ).includes(token),
    ) &&
    read(
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
    ).includes("HeroTextFieldRow") &&
    read(
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx",
    ).includes("HeroVisibilityAlignRow") &&
    read(
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx",
    ).includes("ModuleEditorVisibilityAlignRow as default") &&
    sharedModuleEditorPresentation.includes("AdminFormSwitch"),
);

console.log(
  `Shared Specialized Editors Presentation verification passed (${passed} checks).`,
);
