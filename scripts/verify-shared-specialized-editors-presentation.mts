import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import ts from "typescript";

const jiti = createJiti(import.meta.url);
const { STRUCTURAL_CONTENT_TEMPLATE_SLUGS, resolveModuleProductKind } =
  await jiti.import<
    typeof import("../src/lib/page-blocks/module-edit-registry.ts")
  >("../src/lib/page-blocks/module-edit-registry.ts");
import {
  getModuleEditorHeaderMetadata,
  getModuleEditorSectionOrder,
  getModuleEditorSectionMetadata,
  getSlotModuleSlugMetadata,
} from "../src/lib/page-composition/module-registry-metadata.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

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

const moduleEditorRoots = [
  "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
  "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
  "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
] as const;

const specializedConsumers = [
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
  "src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx",
  "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
  "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
  "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
  "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
  "src/app/admin/projects/ProjectEditForm.tsx",
  "src/app/admin/settings/security/SecuritySettingsClient.tsx",
] as const;

const consumerSources = specializedConsumers.map((path) => ({
  path,
  source: read(path),
}));
const moduleEditorRootSet = new Set<string>(moduleEditorRoots);

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
  "contextual feedback is adopted through the active panel instead of above navigation",
  consumerSources.every(({ source }) => source.includes("activePanelContext=")),
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

const moduleEditorRootSources = moduleEditorRoots.map((path) => ({
  path,
  source: read(path),
}));
const moduleEditorFieldOwners = [
  "src/components/admin/page-blocks/FeedModuleFilterFields.tsx",
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
] as const;
const moduleEditorFieldSources = moduleEditorFieldOwners.map((path) => ({
  path,
  source: read(path),
}));
const moduleEditorSources = [
  ...moduleEditorRootSources,
  ...moduleEditorFieldSources,
];

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

function collectModuleEditorTabs(path: string) {
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
  moduleEditorRoots
    .filter((path) => !path.endsWith("ContentModuleEditClient.tsx"))
    .flatMap((sourcePath) =>
      collectModuleEditorTabs(sourcePath).map(({ moduleKind, tabIds }) => ({
        sourcePath,
        moduleKind,
        moduleSlug: null,
        tabIds,
      })),
    );

const contentEditorPath =
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx";
const contentTabUsages = collectModuleEditorTabs(contentEditorPath);
const contentTabsByVariable = new Map(
  contentTabUsages
    .filter((usage) => usage.tabsVariable !== null)
    .map((usage) => [usage.tabsVariable as string, usage.tabIds]),
);
const defaultContentTabs = contentTabUsages.find(
  (usage) => usage.tabsVariable === null,
)?.tabIds;
assert.ok(
  defaultContentTabs,
  "Content Module Editor must expose its actual default tab ids",
);

const specializedContentTabVariables: Partial<
  Record<(typeof STRUCTURAL_CONTENT_TEMPLATE_SLUGS)[number], string>
> = {
  "home-story": "homeStoryTabs",
  "home-contact": "homeContactTabs",
  "about-cta": "aboutCtaTabs",
  "projects-hub-hero": "heroPlatformTabs",
};

const contentEditorInventory: ModuleEditorMetadataInventoryEntry[] = [
  {
    sourcePath: contentEditorPath,
    moduleKind: "content",
    moduleSlug: null,
    tabIds: defaultContentTabs,
  },
  ...STRUCTURAL_CONTENT_TEMPLATE_SLUGS.map((moduleSlug) => {
    const tabsVariable = specializedContentTabVariables[moduleSlug];
    const tabIds = tabsVariable
      ? contentTabsByVariable.get(tabsVariable)
      : defaultContentTabs;
    assert.ok(
      tabIds,
      `Content Module Editor tabs are not discoverable for ${moduleSlug}`,
    );
    return {
      sourcePath: contentEditorPath,
      moduleKind: resolveModuleProductKind("content", moduleSlug, moduleSlug),
      moduleSlug,
      tabIds,
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
  moduleEditorFieldSources
    .filter(({ path }) => !path.endsWith("FeedModuleFilterFields.tsx"))
    .every(({ source }) => source.includes("<ModuleEditorSection")) &&
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
    [
      "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
      "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
    ].every((path) => {
      const source = read(path);
      return (
        source.includes(
          '<input type="hidden" name="slug" value={block.slug}',
        ) && !source.includes('mode="editable"')
      );
    }) &&
    !read(
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
    ).includes("ModuleEditorTechnicalIdentity") &&
    read(
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
    ).includes('<input type="hidden" name="description"') &&
    read("src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts").includes(
      '.select("slug,variant")',
    ) &&
    [
      "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
      "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
    ].every((path) => !read(path).includes('name="slug"')),
);

check(
  "shared listboxes, switches, and grids own standard Module Editor controls",
  [
    "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
    "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
    "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
    "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
    "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
    "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
    "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
    "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
    "src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx",
    "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
    "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
  ].every((path) => read(path).includes("AdminFormListboxSelect")) &&
    read(
      "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
    ).includes("ModuleEditorVisibilityAlignRow") &&
    !read(
      "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
    ).includes('alignmentOptions={["right", "center"]}') &&
    [
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
      "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
      "src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx",
      "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
    ].every((path) => read(path).includes("AdminFormSwitch")) &&
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
    sharedModuleEditorPresentation.includes("AdminFormSwitch") &&
    [
      "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeaturedModuleEditClient.tsx",
      "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
      "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
      "src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx",
      "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
    ].every((path) => {
      const source = read(path);
      return (
        source.includes("AdminFormGrid") ||
        source.includes("ModuleEditorFieldGrid") ||
        source.includes("ModuleEditorRepeaterGrid")
      );
    }),
);

console.log(
  `Shared Specialized Editors Presentation verification passed (${passed} checks).`,
);
