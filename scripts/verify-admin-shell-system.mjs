import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createHash } from "node:crypto";
import postcss from "postcss";
import { compile } from "@tailwindcss/node";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const checks = [];

function containsCompanyLiteral(source) {
  const ast = ts.createSourceFile("shared-core.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  function visit(node) {
    const literal = ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
    const modulePath = node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) && node.parent.moduleSpecifier === node;
    if (literal && !modulePath && /venesia/iu.test(node.text)) found = true;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}

function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`,
  );
}

const layout = read("src/app/admin/layout.tsx");
const access = read("src/components/admin/AdminAccessLayout.tsx");
const authenticatedLayout = read(
  "src/components/admin/AdminAuthenticatedLayout.tsx",
);
const shell = read("src/components/admin/AdminShell.tsx");
const registry = read("src/config/admin/navigation.ts");
const company = read("src/config/admin/company.ts");
const settings = read(
  "src/app/admin/settings/general/CompanyIdentityPanel.tsx",
);
const selection = read("src/components/admin/ui/useAdminGridSelection.ts");
const pageHeader = read("src/components/admin/ui/AdminPageContextHeader.tsx");
const pageExperience = read("src/components/admin/ui/AdminPageExperience.tsx");
const pageHeaderWrapper = read("src/components/admin/ui/AdminPageHeader.tsx");
const feedbackOwner = read("src/components/admin/AdminFeedbackProvider.tsx");
const confirmOwner = read("src/components/admin/ui/AdminConfirmDialog.tsx");
const bulkActionOwner = read("src/components/admin/ui/AdminBulkActionBar.tsx");
const dataGridOwner = read("src/components/admin/ui/AdminDataGrid.tsx");
const rowActionsOwner = read(
  "src/components/admin/ui/AdminDataGridRowActions.tsx",
);
const adoptionManifest = read(
  "src/lib/admin/interaction-system/adoption-manifest.ts",
);
const blockEditorHeader = read(
  "src/components/admin/page-blocks/BlockEditorContextHeader.tsx",
);
const pageCompositionClient = read(
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
);
const pageCompositionBulkAction = read(
  "src/app/admin/pages-blocks/pages/page-actions/bulk.ts",
);
const linkValidationOwner = read("src/lib/admin/links/validate.ts");
const footerLinksGrid = read(
  "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
);
const seoMetaPage = read("src/app/admin/seo/meta-manager/page.tsx");
const seoMetaClient = read(
  "src/app/admin/seo/meta-manager/MetaManagerClient.tsx",
);
const heroManager = read(
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
);
const blockModuleManager = read(
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
);

check(
  "Root admin layout resolves company config",
  layout.includes("loadAdminCompanyConfig") &&
    layout.includes("ADMIN_COMPANY_DEFAULT"),
);
check(
  "Root admin layout resolves navigation registry",
  layout.includes("resolveAdminNavigation") &&
    layout.includes("ADMIN_NAVIGATION_REGISTRY"),
);
check(
  "Auth routes retain the centralized shell exception",
  access.includes("isAdminAuthPagePath") &&
    /return\s+<>\{children\}<\/>/.test(access),
);
check(
  "Shell consumes registry data",
  shell.includes("navigation.map") && !shell.includes("const menuItems"),
);
check(
  "Shell performs safe intent prefetch",
  shell.includes("router.prefetch(href)") &&
    shell.includes("onMouseEnter={prefetch}") &&
    shell.includes("onFocus={prefetch}"),
);
check(
  "Shell persists collapse preference",
  shell.includes("window.localStorage.setItem") &&
    shell.includes("collapseKey"),
);
check(
  "Shell exposes stable navigation state",
  shell.includes("data-admin-shell-route") &&
    shell.includes("data-admin-navigation-pending"),
);
check(
  "Shell uses the one shared page header core for fallback coverage",
  shell.includes("AdminPageContextHeader") &&
    shell.includes("data-admin-fallback-header"),
);
check(
  "Authenticated routes inherit the one shared page surface owner",
  layout.includes("<AdminAccessLayout") &&
    access.includes("<AdminAuthenticatedLayout") &&
    authenticatedLayout.includes("<AdminShell") &&
    shell.includes("<AdminPageExperience") &&
    shell.includes("data-admin-route-content") &&
    pageExperience.includes(
      'data-admin-page-surface-owner="AdminPageExperience"',
    ) &&
    pageExperience.includes("flex flex-col gap-6"),
);
check(
  "Shell normalizes legacy page-root cadence at the shared boundary",
  shell.includes(":has(>[data-admin-page-header])]:contents") &&
    shell.includes(":has(>[data-admin-page-header])>*]:!my-0") &&
    shell.includes("pb-10") &&
    !shell.includes('data-admin-fallback-header className="order-first mb-7"'),
);
check(
  "Shared page header exposes three logical levels with no legacy compatibility entry point",
  !pageHeader.includes("contextLine") &&
    !pageHeaderWrapper.includes("contextLine") &&
    !pageHeaderWrapper.includes('variant?: "default" | "context"') &&
    pageHeaderWrapper.includes('eyebrow = "ADMIN PANEL"') &&
    !existsSync(resolve(root, "src/components/admin/AdminPageHeader.tsx")) &&
    !existsSync(resolve(root, "src/components/admin/AdminStatusBadge.tsx")),
);
check(
  "Shell owns the canonical 24px transition without a local header margin",
  ["flex", "min-w-0", "flex-1", "flex-col", "gap-6", "px-4", "py-4", "sm:px-6", "lg:px-7"].every(
    (token) => /<main className="([^"]+)"/.exec(shell)?.[1].split(" ").includes(token),
  ) && !shell.includes("admin-premium-card mb-5"),
);
check(
  "One global Footer belongs to the authenticated Shell after route content",
  (shell.match(/<footer\b/g) ?? []).length === 1 &&
    shell.indexOf("<footer") > shell.indexOf("</AdminPageExperience>") &&
    shell.indexOf("</footer>") < shell.indexOf("</main>") &&
    shell.includes("data-admin-shell-footer") &&
    authenticatedLayout.includes("<AdminShell") && access.includes("<AdminAuthenticatedLayout"),
);
check(
  "Footer uses the current year and isolated LTR branding inside the RTL Shell",
  shell.includes('© {new Date().getFullYear()} {company.name}.') &&
    shell.includes('<bdi dir="ltr">') && shell.includes('جميع الحقوق محفوظة.'),
);
const footerClass = /<footer[\s\S]*?className="([^"]+)"/.exec(shell)?.[1].split(" ") ?? [];
check(
  "Short pages fill the viewport and Footer stays in normal flow after long content",
  /<main className="[^"]*min-h-screen/.test(shell) &&
    ["mt-auto", "min-w-0", "shrink-0"].every(token => footerClass.includes(token)) &&
    !footerClass.some(token => ["fixed", "absolute", "overflow-hidden", "overflow-x-hidden"].includes(token)),
);
check(
  "Block editors delegate Chrome and feedback to the shared owners",
  blockEditorHeader.includes("AdminPageContextHeader") &&
    blockEditorHeader.includes("AdminFeedbackRegion") &&
    !blockEditorHeader.includes("rounded-[34px] border border-white/10") &&
    !blockEditorHeader.includes("تم حفظ الموديول بنجاح.</p>"),
);
check(
  "SEO Meta Manager delegates Chrome and feedback to the shared owners",
  seoMetaPage.includes("AdminPageExperience") &&
    seoMetaPage.includes("AdminPageHeader") &&
    seoMetaClient.includes("AdminFormRuntime") &&
    seoMetaClient.includes("AdminFormActions") &&
    !seoMetaClient.includes("<h1") &&
    !seoMetaClient.includes("setNotice") &&
    !seoMetaClient.includes("setError"),
);
check(
  "Shared Feedback and Confirmation owners remain the only active interaction owners",
  feedbackOwner.includes("export function AdminFeedbackRegion") &&
    feedbackOwner.includes("AdminFeedbackChannelViewport") &&
    bulkActionOwner.includes("AdminConfirmDialog") &&
    bulkActionOwner.includes("resolvedOption?.confirmation") &&
    bulkActionOwner.includes('resolvedAction === "delete"') &&
    rowActionsOwner.includes("AdminConfirmDialog") &&
    confirmOwner.includes("pendingRef.current || invokingRef.current") &&
    confirmOwner.includes("resolveReturnFocus"),
);
check(
  "Shared Data Grid alone owns the compact full-height divided cell track",
  dataGridOwner.includes("stickyActions = true") &&
    dataGridOwner.match(/\[&>\*:last-child\]:sticky/g)?.length === 2 &&
    dataGridOwner.includes("[&>*]:self-stretch") &&
    dataGridOwner.includes("[&>*]:px-1.5") &&
    dataGridOwner.includes("[&>*+*]:border-s") &&
    dataGridOwner.includes("ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES") &&
    dataGridOwner.includes("ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES") &&
    dataGridOwner.includes("columnGap: 0") &&
    rowActionsOwner.includes("sticky = false") &&
    rowActionsOwner.includes("sticky={sticky}"),
);
check(
  "Page Composition bulk detach uses semantic confirmation and one atomic mutation",
  pageCompositionClient.includes("await instant.mutateAsync({") &&
    pageCompositionClient.includes("bulk: true") &&
    pageCompositionClient.includes("cache.removeRows(idSet)") &&
    pageCompositionClient.includes(
      "await bulkPageBlockAssignments(formData)",
    ) &&
    pageCompositionClient.includes('value: "detach"') &&
    pageCompositionClient.includes('label: "إزالة المحدد من الصفحة"') &&
    pageCompositionClient.includes('if (action === "detach")') &&
    pageCompositionClient.includes("throw error") &&
    !pageCompositionClient.includes("startTransition") &&
    !pageCompositionClient.includes("return new Promise<void>") &&
    pageCompositionClient.indexOf("selection.clearSelection()") >
      pageCompositionClient.indexOf("await instant.mutateAsync({") &&
    pageCompositionBulkAction.includes(
      'await mutatePageComposition(pageId, "bulk"',
    ) &&
    !pageCompositionBulkAction.includes("Promise.all") &&
    !pageCompositionBulkAction.includes("mutationResults") &&
    !pageCompositionBulkAction.includes(".from(") &&
    pageCompositionBulkAction.includes(
      'const databaseAction = action === "detach" ? "delete" : action',
    ) &&
    pageCompositionBulkAction.includes("action: databaseAction") &&
    pageCompositionBulkAction.includes(
      'throw new Error("Unsupported page block bulk action.")',
    ),
);
check(
  "Hero and block delete confirmation preserves failure retry and selection",
  [heroManager, blockModuleManager].every(
    (source) =>
      source.includes("): Promise<boolean>") &&
      source.includes("return false;") &&
      /if\s*\(action === "delete"\)\s*throw new Error/.test(source) &&
      source.includes("if (!succeeded) throw new Error") &&
      source.indexOf("if (!succeeded)") <
        source.indexOf("selection.clearSelection()"),
  ),
);
check(
  "Navigation registry exposes contract fields",
  [
    "id:",
    "href:",
    "label:",
    "icon:",
    "order:",
    "enabled:",
    "moduleKey:",
    "permission:",
  ].every((field) => registry.includes(field)),
);
check(
  "Current admins remain allowed",
  registry.includes('mode: "allow-current-admins"'),
);
check(
  "Company default is isolated in company config",
  company.includes("ADMIN_COMPANY_DEFAULT") &&
    !containsCompanyLiteral(shell),
);
check(
  "Company identity is editable through existing media management",
  settings.includes("AdminMediaImageField") &&
    settings.includes("logoUrl") &&
    settings.includes("compactLogoUrl"),
);
check(
  "Selection resets when the visible entity set changes",
  selection.includes("previousVisibleSignature") &&
    selection.includes("setSelectedIds([])"),
);
check(
  "Unified loading and error boundaries exist",
  read("src/app/admin/loading.tsx").includes('state="loading"') &&
    read("src/app/admin/error.tsx").includes('state="error"'),
);

const sharedCoreFiles = [
  "src/lib/admin/shell/contracts.ts",
  "src/lib/admin/shell/navigation.ts",
  "src/lib/admin/shell/company-config.ts",
  "src/components/admin/AdminShell.tsx",
  "src/components/admin/ui/AdminPageContextHeader.tsx",
  "src/components/admin/ui/AdminPageExperience.tsx",
];
const sharedHardcoding = sharedCoreFiles.filter((path) =>
  containsCompanyLiteral(read(path)),
);
check(
  "Shared Core contains no company-name hardcoding",
  sharedHardcoding.length === 0,
  sharedHardcoding.join(", "),
);
check("Company guard accepts canonical owner imports and rejects literal branding", !containsCompanyLiteral('import { VENESIA_SCROLLBAR_VISUAL_CLASSES } from "../venesia-scrollbar-styles";') && containsCompanyLiteral('<p>Venesia</p>') && containsCompanyLiteral('const name = "Venesia";'));

function collectPages(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectPages(path, result);
    else if (entry.name === "page.tsx") result.push(path);
  }
  return result;
}

function collectSourceFiles(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(path, result);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) result.push(path);
  }
  return result;
}

const adminPresentationSourceRoots = [
  resolve(root, "src/app/admin"),
  resolve(root, "src/components/admin"),
  resolve(root, "src/lib/admin"),
];
const localDateTimePresentationDebt = adminPresentationSourceRoots
  .flatMap((directory) => collectSourceFiles(directory))
  .filter((sourceFile) =>
    /Intl\.DateTimeFormat|\.toLocale(?:String|DateString|TimeString)\s*\(/.test(
      readFileSync(sourceFile, "utf8"),
    ),
  )
  .map((sourceFile) => relative(root, sourceFile).replaceAll("\\", "/"));
check(
  "Admin date and time presentation delegates to the Shared Date and Time owner",
  localDateTimePresentationDebt.length === 0,
  localDateTimePresentationDebt.join(", "),
);

const adminRoot = resolve(root, "src/app/admin");
const inventory = collectPages(adminRoot).map((absolutePath) => {
  const path = relative(root, absolutePath).replaceAll("\\", "/");
  const authExcluded = path.includes("/(auth)/");
  return {
    path,
    authExcluded,
    coverage: authExcluded
      ? "auth-contract"
      : "AdminAccessLayout > AdminShell > AdminPageExperience",
  };
});
check(
  "Every authenticated /admin page inherits Shared Admin Chrome structurally",
  inventory.length > 0 &&
    inventory
      .filter((item) => !item.authExcluded)
      .every(
        (item) =>
          item.coverage ===
          "AdminAccessLayout > AdminShell > AdminPageExperience",
      ),
  `${inventory.filter((item) => !item.authExcluded).length} authenticated pages`,
);
check(
  "Auth pages are explicitly excluded from the shell",
  inventory.some((item) => item.authExcluded),
);

const chromeAdopters = [
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
  "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
  "src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx",
  "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx",
  "src/app/admin/projects/[id]/page.tsx",
  "src/app/admin/content/topics/[id]/page.tsx",
];
const blockCollectionConsumers = [
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
];
const menuItemsGrid = read(
  "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
);
const menuItemsManifest = adoptionManifest.slice(
  adoptionManifest.indexOf('id: "menu-items"'),
  adoptionManifest.indexOf('id: "page-composition-shell"'),
);
check(
  "Named specialized-content routes retain no native confirmation owner",
  chromeAdopters.every((path) => !read(path).includes("window.confirm")) &&
    !existsSync(
      resolve(
        root,
        "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksDeleteConfirm.tsx",
      ),
    ) &&
    !read(
      "src/app/admin/pages-blocks/footer/FooterBuilderEditors.tsx",
    ).includes("RestoreConfirmModal") &&
    !read("src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx").includes(
      "window.confirm",
    ) &&
    !read("src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx").includes(
      "window.confirm",
    ) &&
    blockCollectionConsumers.every((path) => {
      const source = read(path);
      return (
        source.includes("AdminDataGridRowActions") &&
        source.includes("confirmation:") &&
        source.includes('mode: "shared"') &&
        !source.includes("window.confirm")
      );
    }),
);
check(
  "Menu and Footer Preview hrefs use one fail-closed shared policy owner",
  linkValidationOwner.includes("export function resolvePublicPreviewHref") &&
    linkValidationOwner.includes('href.startsWith("#")') &&
    linkValidationOwner.includes(
      'href.startsWith("/") && !href.startsWith("//")',
    ) &&
    linkValidationOwner.includes("!/^https?:\\/\\//i.test(href)") &&
    linkValidationOwner.includes(
      'url.protocol === "http:" || url.protocol === "https:"',
    ) &&
    menuItemsGrid.includes("resolvePublicPreviewHref(item.href)") &&
    !menuItemsGrid.includes("function resolveMenuItemPreviewHref") &&
    menuItemsGrid.includes("preview: previewHref") &&
    /resolvePublicPreviewHref\(\s*manualLinkHrefLabel\(item\),?\s*\)/.test(
      footerLinksGrid,
    ) &&
    !footerLinksGrid.includes("function manualLinkPreviewHref") &&
    footerLinksGrid.includes("preview: previewHref") &&
    menuItemsGrid.includes(
      "لا يملك العنصر مسارًا عامًا مستقلاً يمكن معاينته من هنا.",
    ),
);
check(
  "Menu Items manifest and consumer declare shared typed column preferences truthfully",
  menuItemsManifest.includes('columnVisibility: "shared_optional_columns"') &&
    menuItemsGrid.includes("AdminColumnVisibilityMenu") &&
    menuItemsGrid.includes("savePageCompositionColumnPreferences"),
);

function loadHeader(source) {
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", compiled)(commonJsModule.exports, commonJsModule, specifier => {
    assert.equal(specifier, "react/jsx-runtime");
    return jsxRuntime;
  });
  return commonJsModule.exports.default;
}
function verifyHeaderSemantics(source) {
  const Header = loadHeader(source);
  const elements = node => {
    if (Array.isArray(node)) return node.flatMap(elements);
    return React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  };
  let cases = 0;
  for (const variant of ["default", "minimal"]) for (const status of ["ready", "loading", "error", "empty", "under-construction"]) {
    const action = React.createElement("button", { type: "button", "data-header-action": "", onClick: () => {} }, "إجراء");
    const tree = Header({ variant, status, title: "العنوان", eyebrow: "السياق", description: "الوصف", badge: "الحالة", breadcrumb: "المسار", meta: "بيانات", actions: action });
    assert.equal(tree.type, "section");
    assert.equal(tree.props.dir, "rtl");
    assert.ok("data-admin-page-header" in tree.props);
    assert.equal(tree.props["data-admin-page-header-status"], status);
    assert.equal(tree.props["data-admin-page-header-variant"], variant);
    const all = elements(tree);
    assert.equal(all.filter(node => node.type === "h1").length, 1);
    assert.equal(all.find(node => node.type === "h1").props.children, "العنوان");
    assert.equal(all.filter(node => node === action).length, 1);
    assert.equal(all.find(node => node === action).props.type, "button");
    const text = renderToStaticMarkup(tree).replace(/<[^>]+>/gu, "");
    assert.ok(text.indexOf("السياق") < text.indexOf("العنوان") && text.indexOf("العنوان") < text.indexOf("الوصف"));
    for (const slot of ["الحالة", "المسار", "بيانات", "إجراء"]) assert.equal(text.split(slot).length - 1, 1);
    cases += 1;
  }
  const bare = renderToStaticMarkup(React.createElement(Header, { title: "مفرد" }));
  assert.equal((bare.match(/<h1\b/gu) ?? []).length, 1);
  assert.ok(!bare.includes("<button") && !bare.includes("<a "));
  for (const optional of [{ meta: "بيانات فقط" }, { actions: React.createElement("a", { href: "/admin/content/topics" }, "رابط فقط") }]) {
    const html = renderToStaticMarkup(React.createElement(Header, { title: "مفرد", ...optional }));
    assert.ok(html.includes(optional.meta ?? "رابط فقط"));
    assert.equal((html.match(/<h1\b/gu) ?? []).length, 1);
    cases += 1;
  }
  return cases + 1;
}
check("Actual shared Header preserves RTL, status, hierarchy and every optional action/context slot", verifyHeaderSemantics(pageHeader) === 13);
const headerMutants = [
  pageHeader.replace('dir="rtl"', 'dir="ltr"'),
  pageHeader.replace("{actions}", "{null}"),
  pageHeader.replace("data-admin-page-header-status={status}", 'data-admin-page-header-status="ready"'),
  pageHeader.replaceAll("h1", "h2"),
];
check("Header semantic negatives reject wrong direction, dropped actions, fixed status and lost heading", headerMutants.every(source => {
  if (source === pageHeader) return false;
  try { verifyHeaderSemantics(source); return false; } catch { return true; }
}));

// Narrow compiled-property checks complement (and never claim) Browser geometry.
const layoutCompiler = await compile('@import "tailwindcss" source(none);', { base: root, onDependency() {} });
function layoutProperties(className, width) {
  const candidates = new Set(className.split(/\s+/u).filter(Boolean));
  const properties = {};
  const important = {};
  const unescape = selector => selector.replace(/\\([\da-f]{1,6}\s?|.)/giu, (_, escaped) => /^[\da-f]/iu.test(escaped) ? String.fromCodePoint(parseInt(escaped.trim(), 16)) : escaped);
  postcss.parse(layoutCompiler.build([...candidates])).walkDecls(decl => {
    const ancestors = [];
    for (let parent = decl.parent; parent; parent = parent.parent) ancestors.push(parent);
    const rules = ancestors.filter(parent => parent.type === "rule");
    if (rules.length !== 1 || !candidates.has(unescape(rules[0].selector).slice(1))) return;
    if (!ancestors.some(parent => parent.type === "atrule" && parent.name === "layer" && parent.params === "utilities")) return;
    for (const media of ancestors.filter(parent => parent.type === "atrule" && parent.name === "media")) {
      const minimum = /^\(width >= ([\d.]+)(rem|px)\)$/u.exec(media.params);
      assert.ok(minimum, `Unexpected media in these layout probes: ${media.params}`);
      if (width < Number(minimum[1]) * (minimum[2] === "rem" ? 16 : 1)) return;
    }
    for (const property of decl.prop === "overflow" ? ["overflow", "overflow-x", "overflow-y"] : [decl.prop]) {
      if (important[property] && !decl.important) continue;
      properties[property] = decl.value;
      important[property] = Boolean(decl.important);
    }
  });
  return properties;
}
function sidebarLayout(source) {
  const ast = ts.createSourceFile("AdminShell.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let sidebar;
  const mounts = new Map();
  const className = node => {
    const attribute = node.openingElement.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast) === "className");
    assert.ok(attribute?.initializer && ts.isStringLiteral(attribute.initializer));
    return attribute.initializer.text;
  };
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "renderSidebar") sidebar = node;
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "renderSidebar") {
      assert.ok(node.arguments.length === 0 || (node.arguments.length === 1 && node.arguments[0].kind === ts.SyntaxKind.TrueKeyword));
      const mode = node.arguments.length ? "mobile" : "desktop";
      assert.ok(!mounts.has(mode));
      let wrapper = node.parent;
      while (wrapper && !ts.isJsxElement(wrapper)) wrapper = wrapper.parent;
      assert.ok(wrapper);
      let dialog = wrapper.parent;
      while (dialog && !(ts.isJsxElement(dialog) && dialog.openingElement.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(ast) === "role" && property.initializer && ts.isStringLiteral(property.initializer) && property.initializer.text === "dialog"))) dialog = dialog.parent;
      if (mode === "mobile") assert.ok(dialog);
      mounts.set(mode, { wrapper: className(wrapper), dialog: mode === "mobile" ? className(dialog) : null });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(sidebar && mounts.size === 2);
  const bindings = { collapsed: false, company: { name: "اختبار", cmsLabel: "ADMIN", publicWebsiteUrl: "/" }, navigation: [], activeGroupIds: new Set(), openGroupId: null, pathname: "/admin/content/topics", onNavigateStart() {}, toggleCollapsed() {}, setGroupOverride() {}, CompanyMark: () => null, Link: () => null, AdminNavLink: () => null, VENESIA_SCROLLBAR_VISUAL_CLASSES: "venesia-scrollbar" };
  const code = ts.transpileModule(sidebar.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const render = Function("require", "exports", ...Object.keys(bindings), code + ";return renderSidebar;")(() => jsxRuntime, {}, ...Object.values(bindings));
  const result = {};
  for (const [mode, mount] of mounts) {
    const tree = render(mode === "mobile");
    const nav = React.Children.toArray(tree.props.children).find(node => React.isValidElement(node) && node.type === "nav");
    assert.ok(nav);
    const width = mode === "desktop" ? 1536 : 390;
    result[mode] = { wrapper: layoutProperties(mount.wrapper, width), aside: layoutProperties(tree.props.className, width), nav: layoutProperties(nav.props.className, width), ...(mount.dialog ? { dialog: layoutProperties(mount.dialog, width) } : {}) };
  }
  const { desktop, mobile } = result;
  assert.equal(desktop.wrapper.display, "block");
  for (const node of [desktop.wrapper, desktop.aside]) {
    assert.ok(!["fixed", "sticky", "absolute"].includes(node.position), "Desktop navigation must participate in normal document flow");
    assert.ok(!node.height || node.height === "auto");
    assert.ok(!node["max-height"] || node["max-height"] === "none");
  }
  assert.equal(desktop.aside["min-height"], "100vh");
  assert.ok(!desktop.nav["overflow-y"] || desktop.nav["overflow-y"] === "visible");
  assert.equal(mobile.dialog.position, "fixed");
  assert.equal(mobile.wrapper.height, "100%");
  assert.equal(mobile.aside.height, "100%");
  assert.equal(mobile.nav["overflow-y"], "auto");
  return result;
}
function dockLayout(source) {
  const Header = loadHeader(source);
  const action = React.createElement("button", { type: "button" }, "إجراء");
  function pathTo(node, target, path = []) {
    if (Array.isArray(node)) return node.map(child => pathTo(child, target, path)).find(Boolean);
    if (!React.isValidElement(node)) return null;
    const next = [...path, node];
    return node === target ? next : pathTo(node.props.children, target, next);
  }
  const path = pathTo(Header({ title: "العنوان", actions: action }), action);
  assert.ok(path && path.length >= 3);
  const inner = layoutProperties(path.at(-2).props.className, 1536);
  const outer = layoutProperties(path.at(-3).props.className, 1536);
  assert.equal(inner.width, "fit-content", "Default action dock must use content width");
  assert.equal(inner["max-width"], "100%");
  assert.equal(inner["margin-inline-start"], "auto", "Default action dock must align externally left in RTL");
  assert.equal(inner["flex-wrap"], "wrap");
  assert.equal(inner.gap, "calc(var(--spacing) * 2)");
  assert.equal(inner.padding, "calc(var(--spacing) * 2)");
  assert.equal(outer.flex, "0 1 34rem");
  assert.equal(outer["margin-inline-start"], "auto", "Wrapped default outer dock must align externally left in RTL");
  return { inner, outer };
}
check("Compiled actual desktop Sidebar grows with the document while the mobile drawer retains bounded native scroll", Boolean(sidebarLayout(shell)));
const sidebarMutants = [
  shell.replace('className="hidden shrink-0 bg-transparent lg:block"', 'className="hidden shrink-0 bg-transparent lg:block [position:sticky] [height:100vh]"'),
  shell.replace('forceExpanded ? "h-full" : "min-h-screen"', 'forceExpanded ? "h-full" : "[height:100vh] min-h-screen"'),
  shell.replace('forceExpanded ? "overflow-y-auto " : ""', 'forceExpanded ? "overflow-y-auto " : "[overflow-y:auto] "'),
  shell.replace('forceExpanded ? "overflow-y-auto " : ""', 'forceExpanded ? "[overflow-y:visible] " : ""'),
];
check("Equivalent-property negatives reject desktop sticky/viewport/nav scrolling and loss of mobile native scroll", sidebarMutants.every(source => {
  if (source === shell) return false;
  try { sidebarLayout(source); return false; } catch { return true; }
}));
check("Compiled actual default action dock fits its contents without changing outer basis, padding or gap", Boolean(dockLayout(pageHeader)));
const dockMutants = [
  pageHeader.replace("flex w-fit min-w-0", "flex min-w-0"),
  pageHeader.replace("flex w-fit min-w-0", "flex [width:100%] min-w-0"),
  pageHeader.replace("flex w-fit min-w-0", "flex w-fit [width:100%]! min-w-0"),
  pageHeader.replace("isolate ms-auto flex", "isolate [margin-inline-start:0] flex"),
  pageHeader.replace("isolate ms-auto flex", "isolate me-auto flex"),
  pageHeader.replace("flex-[0_1_34rem]", "[flex:1_1_34rem]"),
  pageHeader.replace("max-w-full flex-wrap", "max-w-full flex-nowrap"),
  pageHeader.replace(/(minimal\s*\?\s*"lg:shrink-0"\s*:\s*")([^"]*)(")/u, (_, prefix, classes, suffix) => prefix + classes.replace(/\bms-auto\b/u, "me-auto") + suffix),
];
check("Equivalent-property negatives reject stretched/filled docks, wrong RTL anchoring and expanded outer basis", dockMutants.every(source => {
  if (source === pageHeader) return false;
  try { dockLayout(source); return false; } catch { return true; }
}));

async function verifyGlobalHeader(source) {
  const ast = ts.createSourceFile("AdminShell.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let header, companyMark, mainClasses;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "CompanyMark") companyMark = node;
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(ast) === "data-admin-shell-header")) header = node;
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === "main") mainClasses = node.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast) === "className")?.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(header && companyMark && mainClasses && ts.isStringLiteral(mainClasses));
  const code = ts.transpileModule(`${companyMark.getText(ast)}\nfunction renderGlobalHeader(){return (${header.getText(ast)});}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const company = { name: "شركة اختبار", cmsLabel: "TEST CMS", adminLabel: "إدارة الاختبار", publicWebsiteUrl: "/public-fixture", accentColor: "#d8b87a", logoUrl: "", compactLogoUrl: "" };
  let cases = 0;
  for (const width of [390, 820, 1536]) for (const pendingHref of [null, "/admin/content/categories"]) {
    const events = [], state = [];
    let releaseLogout;
    const bindings = { company, pendingHref, pathname: "/admin/content/topics", setMobileState: value => state.push(value), fetch: (url, options) => { events.push({ type: "fetch", url, options }); return new Promise(resolve => { releaseLogout = resolve; }); }, window: { location: { assign: url => events.push({ type: "assign", url }) } } };
    const { renderGlobalHeader, CompanyMark } = Function("require", "exports", ...Object.keys(bindings), code + ";return {renderGlobalHeader,CompanyMark};")(() => jsxRuntime, {}, ...Object.values(bindings));
    const tree = renderGlobalHeader();
    assert.equal(tree.type, "header"); assert.ok("data-admin-shell-header" in tree.props);
    const shellPadding = layoutProperties(tree.props.className, width);
    assert.equal(shellPadding["padding-inline"], "calc(var(--spacing) * 4)", "Global Header horizontal padding remains16px");
    assert.equal(shellPadding["padding-block"], "calc(var(--spacing) * 3)", "Global Header vertical padding is12px");
    assert.equal(shellPadding.padding, undefined, "Global Header does not restore all-axis padding");
    assert.equal(layoutProperties(mainClasses.text, width).gap, "calc(var(--spacing) * 6)", "Main cadence is24px");
    const row = tree.props.children;
    const groups = React.Children.toArray(row.props.children).filter(React.isValidElement);
    assert.equal(groups.length, 2);
    const rowStyle = layoutProperties(row.props.className, width);
    assert.equal(rowStyle.gap, "calc(var(--spacing) * 4)");
    assert.equal(rowStyle["flex-direction"], width < 640 ? "column" : "row");
    for (const group of groups) assert.equal(layoutProperties(group.props.className, width).gap, "calc(var(--spacing) * 3)");
    const menu = React.Children.toArray(groups[0].props.children).find(node => React.isValidElement(node) && node.type === "button");
    const controls = React.Children.toArray(groups[1].props.children).filter(React.isValidElement);
    const logout = controls.find(node => node.type === "button");
    assert.ok(menu && logout);
    assert.equal(menu.props.type, "button"); assert.equal(menu.props["aria-label"], "فتح القائمة");
    const menuStyle = layoutProperties(menu.props.className, width);
    assert.equal(menuStyle.display, width < 1024 ? "grid" : "none");
    assert.equal(menuStyle.width, "calc(var(--spacing) * 11)"); assert.equal(menuStyle.height, "calc(var(--spacing) * 11)");
    menu.props.onClick(); assert.deepEqual(state, [{ pathname: "/admin/content/topics", open: true }]);
    assert.equal(logout.props.type, "button"); assert.equal(logout.props.children.trim(), "خروج");
    const statuses = controls.filter(node => node.props.role === "status");
    assert.equal(statuses.length, pendingHref ? 1 : 0);
    if (pendingHref) assert.ok(statuses[0].props.children.trim().length > 0);
    const mark = CompanyMark({ company, compact: false });
    assert.equal(mark.props["aria-label"], company.name); assert.equal(mark.props.children, "شر");
    const markStyle = layoutProperties(mark.props.className, width);
    assert.equal(markStyle.width, "calc(var(--spacing) * 10)"); assert.equal(markStyle.height, "calc(var(--spacing) * 10)");
    const media = CompanyMark({ company: { ...company, logoUrl: "/synthetic-logo.svg" }, compact: false }).props.children;
    assert.equal(media.type, "img"); assert.equal(media.props.alt, ""); assert.equal(media.props.src, "/synthetic-logo.svg");
    const operation = logout.props.onClick();
    assert.deepEqual(events, [{ type: "fetch", url: "/api/admin/auth/logout", options: { method: "POST", credentials: "same-origin" } }], "Logout uses its exact existing request without navigating early");
    releaseLogout({ ok: true }); await operation;
    assert.deepEqual(events[1], { type: "assign", url: company.publicWebsiteUrl }); assert.equal(events.length, 2);
    const html = renderToStaticMarkup(tree);
    assert.ok(html.includes(company.adminLabel) && html.includes(company.cmsLabel));
    cases += 1;
  }
  return cases;
}
check("Actual global Header preserves six responsive/pending states, exact compact spacing, identity and injected menu/logout behavior", await verifyGlobalHeader(shell) === 6);
const globalHeaderMutants = [
  shell.replace("admin-premium-card rounded-[28px] px-4 py-3", "admin-premium-card rounded-[28px] p-4"),
  shell.replace('gap-6 px-4 py-4 sm:px-6 lg:px-7', 'gap-7 px-4 py-4 sm:px-6 lg:px-7'),
  shell.replace('method: "POST", credentials: "same-origin"', 'method: "GET", credentials: "same-origin"'),
  shell.replace('method: "POST", credentials: "same-origin"', 'method: "POST", credentials: "omit"'),
];
check("Global Header negatives reject former padding/cadence and changed logout method or credentials", (await Promise.all(globalHeaderMutants.map(async source => {
  if (source === shell) return false;
  try { await verifyGlobalHeader(source); return false; } catch { return true; }
}))).every(Boolean));

const acceptanceArgument = process.argv.find(argument => argument.startsWith("--acceptance-file="));
if (acceptanceArgument) {
  const acceptancePath = resolve(root, acceptanceArgument.slice("--acceptance-file=".length));
  const acceptance = JSON.parse(readFileSync(acceptancePath, "utf8"));
  const externalAlignment = acceptance.scope === "header_external_alignment";
  const sha = bytes => createHash("sha256").update(bytes).digest("hex");
  const phaseBaseline = JSON.parse(readFileSync(resolve(dirname(acceptancePath), "baseline.json"), "utf8"));
  const originalSource = path => {
    const entry = phaseBaseline.entries.find(item => item.path === path);
    assert.ok(entry, `Missing phase baseline ${path}`);
    const bytes = readFileSync(resolve(dirname(acceptancePath), "baseline", path));
    assert.equal(sha(bytes), entry.sha256.toLowerCase(), `Original source bytes ${path}`);
    return bytes;
  };
  const originalShell = originalSource("src/components/admin/AdminShell.tsx").toString("utf8");
  const originalHeader = originalSource("src/components/admin/ui/AdminPageContextHeader.tsx").toString("utf8");
  if (externalAlignment) {
    sidebarLayout(originalShell);
    assert.throws(() => dockLayout(originalHeader), /Default action dock must align externally left in RTL/u);
    check("Exact phase-baseline Header rejects the wrong external anchor while Sidebar normal flow remains protected", true);
  } else {
    assert.throws(() => sidebarLayout(originalShell), /Desktop navigation must participate in normal document flow/u);
    assert.throws(() => dockLayout(originalHeader), /Default action dock must use content width/u);
    check("Exact phase-baseline Sidebar and filled Header dock are independently rejected for their actual layout properties", true);
  }
  const close = (actual, expected, label) => {
    assert.ok(Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= 1, `${label}: ${actual} vs ${expected}`);
  };
  const rectEqual = (actual, expected, label) => {
    for (const key of ["x", "y", "width", "height"]) close(actual[key], expected[key], `${label}.${key}`);
  };
  const sources = (entries, current = true) => {
    assert.ok(Array.isArray(entries) && entries.length > 0);
    for (const entry of entries) assert.equal(sha(current ? readFileSync(resolve(root, entry.path)) : originalSource(entry.path)), entry.sha256.toLowerCase(), `${current ? "Current" : "Baseline"} source ${entry.path}`);
    for (const path of ["src/components/admin/AdminShell.tsx", "src/components/admin/ui/AdminPageContextHeader.tsx", "src/app/globals.css"]) assert.ok(entries.some(entry => entry.path === path));
  };
  const rasterMetadata = new Map();
  async function capture(record, current) {
    assert.equal(record.dir, "rtl");
    if (externalAlignment) {
      assert.equal(record.ready, true, "External alignment evidence must capture a ready rendered Header");
      assert.ok(record.header.title.width > 0 && record.header.title.height > 0 && record.header.text.width > 0 && record.header.text.height > 0, "Header title and content have nonempty rendered bounds");
      assert.ok(record.header.dock.actions.length > 0 && record.header.dock.actions.every(action => typeof action.text === "string" && action.text.trim().length > 0 && !/loading|جار[ٍي]?\s*(?:التحميل|تحميل)|يرجى الانتظار/iu.test(action.text)), "Actual Header children have meaningful non-loading labels");
      if (record.header.titleText !== undefined) assert.ok(typeof record.header.titleText === "string" && record.header.titleText.trim().length > 0 && !/loading|جار[ٍي]?\s*(?:التحميل|تحميل)|يرجى الانتظار/iu.test(record.header.titleText), "Captured heading text is meaningful and non-loading");
    }
    assert.ok(record.viewport.w > 0 && record.viewport.h > 0);
    assert.ok(record.root.sw <= record.root.w + 1, "No horizontal document overflow");
    sources(record.source, current);
    assert.ok(record.image && /^[\da-f]{64}$/iu.test(record.imageSha256));
    const image = readFileSync(resolve(dirname(acceptancePath), record.image));
    assert.equal(sha(image), record.imageSha256.toLowerCase(), `Screenshot ${record.image}`);
    if (!rasterMetadata.has(record.imageSha256)) rasterMetadata.set(record.imageSha256, sharp(image).metadata());
    const metadata = await rasterMetadata.get(record.imageSha256);
    assert.ok(["png", "jpeg", "webp"].includes(metadata.format) && metadata.width > 0 && metadata.height > 0, "Nonempty decoded raster; extension is not assumed to identify its format");
  }
  async function verifyAcceptance(bundle) {
    sources(bundle.sourceFiles);
    assert.ok(Array.isArray(bundle.pairs) && bundle.pairs.length > 0);
    assert.equal(new Set(bundle.pairs.map(pair => pair.id)).size, bundle.pairs.length);
    for (const pair of bundle.pairs) {
      const { before, after } = pair;
      await capture(before, false); await capture(after, true);
      assert.deepEqual(after.viewport, before.viewport);
      assert.equal(after.url, before.url);
      close(after.root.top, before.root.top, "Matched document scroll state");
      for (const key of ["rect", "title", "text"]) rectEqual(after.header[key], before.header[key], `Unchanged header ${key}`);
      const wrappedOuterLine = externalAlignment && before.header.outer.rect.top >= before.header.text.bottom - 1 && after.header.outer.rect.top >= after.header.text.bottom - 1;
      if (wrappedOuterLine) {
        for (const key of ["y", "width", "height"]) close(after.header.outer.rect[key], before.header.outer.rect[key], `Unchanged wrapped outer dock ${key}`);
        close(after.header.outer.rect.left, after.header.rect.left + parseFloat(after.header.style.borderLeftWidth) + parseFloat(after.header.style.paddingLeft), "Wrapped outer dock aligns to Header content-left");
      } else rectEqual(after.header.outer.rect, before.header.outer.rect, "Unchanged outer dock");
      const { actions, style, rect } = after.header.dock;
      const originalDock = before.header.dock.rect;
      const dockTranslation = rect.x - originalDock.x;
      if (externalAlignment) {
        const leftEdge = after.header.rect.left + parseFloat(after.header.style.borderLeftWidth) + parseFloat(after.header.style.paddingLeft);
        close(rect.left, leftEdge, "Dock aligns with the Header's actual external left content edge");
        close(rect.width, originalDock.width, "Dock width remains unchanged");
        close(rect.height, originalDock.height, "Dock height remains unchanged");
        close(rect.y, originalDock.y, "Dock vertical position remains unchanged");
      }
      assert.ok(actions.length > 0);
      assert.equal(actions.length, before.header.dock.actions.length);
      actions.forEach((action, index) => {
        const original = before.header.dock.actions[index];
        assert.equal(action.text, original.text); assert.equal(action.href, original.href);
        if (externalAlignment) {
          close(action.x - original.x, dockTranslation, "Every action translates horizontally with its dock");
          for (const key of ["y", "width", "height"]) close(action[key], original[key], `Unchanged action ${key}`);
        } else rectEqual(action, original, "Unchanged action geometry");
        assert.ok(action.left >= rect.left - 1 && action.right <= rect.right + 1);
      });
      for (const key of ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth", "gap"]) assert.equal(style[key], before.header.dock.style[key]);
      const rowCount = entries => {
        const rows = [];
        for (const action of entries) {
          const center = action.y + action.height / 2;
          if (!rows.some(row => Math.abs(row - center) <= 1)) rows.push(center);
        }
        return rows.length;
      };
      assert.equal(rowCount(actions), rowCount(before.header.dock.actions), "Responsive row membership remains unchanged");
      if (rowCount(actions) === 1) {
        const union = Math.max(...actions.map(action => action.right)) - Math.min(...actions.map(action => action.left));
        const edges = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce((total, key) => total + parseFloat(style[key]), 0);
        close(rect.width, union + edges, "One-row dock fits actual content and edges");
      } else {
        assert.ok(rect.width <= after.header.outer.rect.width + 1, "Wrapped dock stays within available width at any viewport; natural row space is allowed");
      }
      if (after.sidebar && after.viewport.w >= 1024) {
        assert.equal(after.sidebar.wrapper.style.position, "static");
        assert.equal(after.sidebar.nav.style.overflowY, "visible");
        assert.ok(after.sidebar.nav.sh <= after.sidebar.nav.h + 1);
        close(after.sidebar.nav.top, 0, "Desktop navigation has no independent scroll offset");
      } else if (String(pair.mode).includes("drawer")) {
        assert.ok(after.sidebar);
        assert.equal(after.sidebar.nav.style.overflowY, "auto");
        close(after.sidebar.rect.height, after.viewport.h, "Mobile drawer stays viewport bounded");
      }
    }
    if (externalAlignment) return bundle.pairs.length;
    const { before, after } = bundle.wheel;
    assert.deepEqual(after.viewport, before.viewport); assert.equal(after.url, before.url);
    const base = bundle.pairs.find(pair => pair.before.url === before.url && JSON.stringify(pair.before.viewport) === JSON.stringify(before.viewport) && pair.before.sidebar && pair.before.viewport.w >= 1024);
    assert.ok(base, "Wheel measurement has a matched pre-wheel state");
    sources(before.source, false); sources(after.source);
    close(before.root.top, base.before.root.top, "Old wheel leaves document unchanged");
    assert.ok(before.sidebar.nav.top - base.before.sidebar.nav.top > 10, "Old wheel demonstrably scrolled navigation");
    const documentDelta = after.root.top - base.after.root.top;
    assert.ok(documentDelta > 10, "New wheel scrolls the document");
    close(after.sidebar.nav.top, base.after.sidebar.nav.top, "New wheel leaves navigation offset unchanged");
    close(after.sidebar.wrapper.rect.top, base.after.sidebar.wrapper.rect.top - documentDelta, "Sidebar moves with the document");
    return bundle.pairs.length;
  }
  const pairs = await verifyAcceptance(acceptance);
  check(externalAlignment ? "Supplied current Browser receipt validates external left alignment, unit translation and raster/source hashes" : "Supplied current Browser receipt validates paired geometry, raster/source hashes and actual wheel ownership", pairs > 0, `${pairs} matched pairs; Owner visual approval remains separate`);
  const receiptMutations = [
    bundle => { bundle.sourceFiles[0].sha256 = "0".repeat(64); },
    bundle => { bundle.pairs[0].after.viewport.w += 1; },
    bundle => { bundle.pairs[0].after.imageSha256 = "0".repeat(64); },
    bundle => { bundle.pairs[0].after.header.dock.rect.width += 50; },
    bundle => { bundle.pairs[0].after.header.dock.actions[0].x += 2; },
    externalAlignment ? bundle => {
      const dock = bundle.pairs[0].after.header.dock;
      for (const key of ["x", "left", "right"]) dock.rect[key] += 16;
      for (const action of dock.actions) for (const key of ["x", "left", "right"]) action[key] += 16;
    } : bundle => { bundle.wheel.after.root.top = 0; },
    ...(externalAlignment ? [bundle => { bundle.pairs[0].after.ready = false; }] : []),
  ];
  check(externalAlignment ? "Browser receipt negatives reject stale evidence, wrong external gap, stretch and nonuniform translation" : "Browser receipt negatives reject stale sources/images, mismatched states, filled docks, moved actions and wrong scroll ownership", (await Promise.all(receiptMutations.map(async mutate => {
    const altered = structuredClone(acceptance); mutate(altered);
    try { await verifyAcceptance(altered); return false; } catch { return true; }
  }))).every(Boolean));
} else {
  console.log("Source/SSR/compiled-CSS checks only: actual Browser geometry and Owner visual approval are not inferred.");
}

const failed = checks.filter((item) => !item.ok);
console.log(
  `verify-admin-shell-system: ${checks.length - failed.length}/${checks.length} passed`,
);
if (failed.length) process.exitCode = 1;
