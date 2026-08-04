import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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

function tabsAreIndependent(path: string, source: string) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let independent = true;

  function visit(node: ts.Node, ancestors: string[]) {
    if (ts.isJsxElement(node)) {
      const name = node.openingElement.tagName.getText(file);
      if (name === "AdminModuleTabs" && ancestors.some((value) => value === "AdminCard" || value === "section")) {
        independent = false;
      }
      for (const child of node.children) visit(child, [...ancestors, name]);
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(file);
      if (name === "AdminModuleTabs" && ancestors.some((value) => value === "AdminCard" || value === "section")) {
        independent = false;
      }
      return;
    }
    ts.forEachChild(node, (child) => visit(child, ancestors));
  }

  visit(file, []);
  return independent;
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
  "every corrected specialized editor supplies shared Section Hero metadata",
  consumerSources.every(({ source }) =>
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
    );
    const tabsIndex = source.indexOf("<AdminModuleTabs", heroIndex);
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

console.log(`Shared Specialized Editors Presentation verification passed (${passed} checks).`);
