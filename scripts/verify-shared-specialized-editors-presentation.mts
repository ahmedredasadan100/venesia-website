import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { STRUCTURAL_CONTENT_TEMPLATE_SLUGS } from "../src/lib/page-blocks/module-edit-registry.ts";
import {
  getModuleEditorHeaderMetadata,
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
const contentShell = read("src/components/admin/content/editors/ContentEditorShell.tsx");
const aboutCta = read("src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx");

const moduleEditorRoots = [
  "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
  "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
  "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
  "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
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
  "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
  "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
  "src/app/admin/projects/ProjectEditForm.tsx",
  "src/app/admin/settings/security/SecuritySettingsClient.tsx",
] as const;

const consumerSources = specializedConsumers.map((path) => ({ path, source: read(path) }));
const moduleEditorRootSet = new Set<string>(moduleEditorRoots);

function tabsAreIndependent(path: string, source: string) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let independent = true;

  function visit(node: ts.Node, ancestors: string[]) {
    if (ts.isJsxElement(node)) {
      const name = node.openingElement.tagName.getText(file);
      if ((name === "AdminModuleTabs" || name === "ModuleEditorTabs") && ancestors.some((value) => value === "AdminCard" || value === "section")) {
        independent = false;
      }
      for (const child of node.children) visit(child, [...ancestors, name]);
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(file);
      if ((name === "AdminModuleTabs" || name === "ModuleEditorTabs") && ancestors.some((value) => value === "AdminCard" || value === "section")) {
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
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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
      delegated = delegated && ["eyebrow", "title", "description"].every((attribute) => !attributeNames.has(attribute));
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
    sharedTabs.indexOf("data-admin-active-panel-context") < sharedTabs.indexOf("{tab.content}"),
);

check(
  "the shared content shell has no generic pre-tabs presentation escape hatch",
  !contentShell.includes("beforeTabs") &&
    contentShell.indexOf("<AdminModuleTabs") < contentShell.indexOf("<AdminFormActions"),
);

check(
  "specialized consumers outside the Module Editor registry continue to supply their Section Hero metadata",
  consumerSources
    .filter(({ path }) => !moduleEditorRootSet.has(path))
    .every(({ source }) =>
      ["sectionHeading", "sectionDescription", "icon:"].every((token) => source.includes(token)),
    ),
);

check(
  "specialized Tabs stay independent from consumer content cards and sections",
  consumerSources.every(({ path, source }) => tabsAreIndependent(path, source)),
);

const blockConsumers = consumerSources.filter(({ path }) =>
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

const footer = read("src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx");
check(
  "Footer summary is domain content in a shared Overview section with no editor wrapper header",
  footer.includes('id: "overview"') &&
    footer.includes('sectionHeading: "ملخص الأعمدة والترتيب"') &&
    !footer.includes("تحرير الأعمدة والإعدادات") &&
    footer.match(/حفظ الفوتر/g)?.length === 2,
);

const security = read("src/app/admin/settings/security/SecuritySettingsClient.tsx");
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
    read("src/components/admin/page-blocks/ContentModuleEditClient.tsx").includes("aboutCtaTabs"),
);

check(
  "specialized Project Hub Hero has no local header parallel to the shared Section Hero",
  !read("src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx").includes("<h2"),
);

const moduleEditorRootSources = moduleEditorRoots.map((path) => ({ path, source: read(path) }));
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
const moduleEditorFieldSources = moduleEditorFieldOwners.map((path) => ({ path, source: read(path) }));
const moduleEditorSources = [...moduleEditorRootSources, ...moduleEditorFieldSources];

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

const rootMetadataScopes = [
  { kind: "breadcrumb", sections: ["content", "settings", "pages"] },
  { kind: "cards", sections: ["content", "meta", "pages"] },
  { kind: "cta", sections: ["content", "meta", "pages"] },
  { kind: "feed", sections: ["content", "settings", "pages"] },
  { kind: "media-hub", sections: ["content", "settings", "pages"] },
  { kind: "media-sidebar", sections: ["content", "settings", "pages"] },
  { kind: "hero", sections: ["content", "order", "media-desktop", "media-mobile", "buttons", "display"] },
] as const;

const specializedContentSectionScopes: Record<string, readonly string[]> = {
  "home-story": ["text", "images", "cta", "pages", "settings"],
  "home-contact": ["text", "image", "cta", "contacts", "pages", "settings"],
  "about-cta": ["text", "image", "cta", "contacts", "pages", "settings"],
};

check(
  "the current module registry is the complete owner of every Module Editor Header and Section Hero definition",
  rootMetadataScopes.every(
    ({ kind, sections }) =>
      getModuleEditorHeaderMetadata(kind, null, "Module instance") !== null &&
      sections.every((sectionId) => getModuleEditorSectionMetadata(kind, sectionId) !== null),
  ) &&
    getModuleEditorHeaderMetadata("content", null, "Generic content") !== null &&
    ["content", "settings", "pages"].every(
      (sectionId) => getModuleEditorSectionMetadata("content", sectionId) !== null,
    ) &&
    STRUCTURAL_CONTENT_TEMPLATE_SLUGS.every((slug) => {
      const sections = specializedContentSectionScopes[slug] ?? ["content", "settings", "pages"];
      return (
        getSlotModuleSlugMetadata(slug) !== null &&
        getModuleEditorHeaderMetadata("content", slug, "Module instance") !== null &&
        sections.every((sectionId) => getModuleEditorSectionMetadata("content", sectionId, slug) !== null)
      );
    }),
);

check(
  "settings composition is shared by every root with a dedicated Settings tab",
  moduleEditorRootSources
    .filter(({ path }) => !path.endsWith("HeroEditClient.tsx"))
    .every(({ source }) => source.includes("<ModuleEditorSettingsComposition")),
);

check(
  "all module-specific section surfaces delegate to the shared Module Editor section owner",
  moduleEditorFieldSources
    .filter(({ path }) => !path.endsWith("FeedModuleFilterFields.tsx"))
    .every(({ source }) => source.includes("<ModuleEditorSection")) &&
    moduleEditorSources.every(({ source }) =>
      !source.includes('space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5'),
    ),
);

check(
  "Module Editors contain no native selects and no raw on-off checkboxes",
  moduleEditorSources.every(({ source }) => !source.includes("<select") && !source.includes('type="checkbox"')),
);

check(
  "page assignment multi-selection is the only explicit raw checkbox allowlist",
  read("src/components/admin/page-blocks/ModulePageAssignmentsField.tsx").includes('name="page_ids"') &&
    read("src/components/admin/page-blocks/ModulePageAssignmentsField.tsx").match(/type="checkbox"/g)?.length === 1,
);

check(
  "technical identity presentation is explicit and structural content reads registry metadata",
  read("src/components/admin/page-blocks/ContentModuleEditClient.tsx").includes("<ModuleEditorTechnicalIdentity") &&
    read("src/components/admin/page-blocks/ContentModuleEditClient.tsx").includes("moduleSlug={presentationSlug}") &&
    [
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
      "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
      "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
    ].every((path) => read(path).includes("<ModuleEditorTechnicalIdentity")) &&
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
    "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
    "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
    "src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx",
    "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
    "src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx",
    "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
    "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
  ].every((path) => read(path).includes("AdminFormListboxSelect")) &&
    [
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
      "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
      "src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx",
      "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
    ].every((path) => read(path).includes("AdminFormSwitch")) &&
    [
      "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
      "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
      "src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx",
      "src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx",
      "src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx",
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
    ].every((path) => read(path).includes("AdminFormGrid")),
);

console.log(`Shared Specialized Editors Presentation verification passed (${passed} checks).`);
