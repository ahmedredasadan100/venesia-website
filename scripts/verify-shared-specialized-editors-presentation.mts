import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import ts from "typescript";

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
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
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

check(
  "the shared Tabs owner renders active section context after Section Hero and before domain content",
  sharedTabs.includes("activePanelContext?: ReactNode") &&
    sharedTabs.includes("data-admin-active-panel-context") &&
    sharedTabs.indexOf("data-admin-tab-section-heading") <
      sharedTabs.indexOf("data-admin-active-panel-context") &&
    sharedTabs.indexOf("data-admin-active-panel-context") <
      sharedTabs.indexOf("{tab.content}"),
);

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

const security = read(
  "src/app/admin/settings/security/SecuritySettingsClient.tsx",
);
check(
  "Security settings use flat shared section presentation without repeated section descriptions",
  security.includes("activePanelContext") &&
    security.match(/تغيير كلمة المرور/g)?.length === 2 &&
    security.match(/بيانات الحساب الحالي/g)?.length === 1 &&
    security.match(/إدارة بيانات الدخول للحساب الحالي/g)?.length === 1,
);

check(
  "the legacy nested About CTA Tabs owner is retired",
  !aboutCta.includes("AdminModuleTabs") &&
    !aboutCta.includes('section === "all"') &&
    read(
      "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
    ).includes("aboutCtaTabs"),
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

function collectModuleEditorTabs(path: string, activeEditorKey?: string) {
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
    .flatMap(({ path }) =>
      collectModuleEditorTabs(path).map(({ moduleKind, tabIds }) => ({
        sourcePath: path,
        moduleKind,
        moduleSlug: null,
        tabIds,
      })),
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
  "all module-specific section surfaces delegate to the shared Module Editor section owner",
  moduleSpecificEditorSources.every(({ path }) => {
    const graph = collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: [path],
      symbolAware: true,
    });
    return [...graph.values()].some((file) =>
      file.getFullText().includes("<ModuleEditorSection"),
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
      "md:grid-cols-3",
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
