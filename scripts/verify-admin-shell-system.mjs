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
function layoutProperties(className, width, descendant = null) {
  const candidates = new Set(className.split(/\s+/u).filter(Boolean));
  const properties = {};
  const important = {};
  const unescape = selector => selector.replace(/\\([\da-f]{1,6}\s?|.)/giu, (_, escaped) => /^[\da-f]/iu.test(escaped) ? String.fromCodePoint(parseInt(escaped.trim(), 16)) : escaped);
  postcss.parse(layoutCompiler.build([...candidates])).walkDecls(decl => {
    const ancestors = [];
    for (let parent = decl.parent; parent; parent = parent.parent) ancestors.push(parent);
    const rules = ancestors.filter(parent => parent.type === "rule");
    if (descendant === null) {
      if (rules.length !== 1 || !candidates.has(unescape(rules[0].selector).slice(1))) return;
    } else if (rules.length !== 2 || rules[0].selector !== `&>${descendant}` || !candidates.has(unescape(rules[1].selector).slice(1))) return;
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

function verifyMetricIconPresentation(source) {
  const Metric = loadHeader(source);
  const elements = node => Array.isArray(node) ? node.flatMap(elements)
    : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  const icon = React.createElement("svg", { "data-metric-test-glyph": "", viewBox: "0 0 24 24" });
  let cases = 0;
  for (const compact of [false, true]) {
    const props = { label: "مؤشر اختبار", value: 0, suffix: "%", compact, icon };
    const defaultMarkup = renderToStaticMarkup(React.createElement(Metric, props));
    assert.equal(defaultMarkup, renderToStaticMarkup(React.createElement(Metric, { ...props, iconSize: "default" })), "Omitting iconSize must preserve the shared default presentation");
    for (const iconSize of [undefined, "default", "prominent"]) {
      const tree = Metric({ ...props, iconSize });
      const glyph = elements(tree).find(node => Object.hasOwn(node.props, "data-admin-metric-icon"));
      assert.ok(glyph, "The shared owner must retain its semantic glyph slot");
      assert.equal(glyph.props["aria-hidden"], "true", "Metric glyphs remain decorative");
      assert.equal(glyph.props.children, icon, "Consumer glyph identity must pass through unchanged");
      const iconRow = elements(tree).find(node => node.type === "div" && node.props.dir === "rtl");
      assert.ok(iconRow, "The shared metric retains its content/icon row");
      for (const width of [390, 1536]) {
        const css = layoutProperties(glyph.props.className, width);
        const expected = iconSize === "prominent" ? 9 : width < 768 ? 5.5 : 6;
        for (const property of ["width", "height"]) assert.equal(css[property], `calc(var(--spacing) * ${expected})`, `${iconSize ?? "omitted"} glyph sizing at ${width}px`);
        assert.equal(css["flex-shrink"], "0", "Glyph size must not collapse beside content");
        const svg = layoutProperties(glyph.props.className, width, "svg");
        for (const property of ["width", "height"]) assert.equal(svg[property], css[property], "Consumer SVG must fill the same shared glyph frame");
        assert.equal(svg["stroke-width"], iconSize === "prominent" ? "2" : undefined, "The heavier SVG stroke is opt-in; existing consumers keep their authored stroke");
        const card = layoutProperties(tree.props.className, width);
        assert.equal(card["min-height"], compact ? "80px" : "96px", "The existing metric card minimum heights must remain");
        assert.equal(card.padding, `calc(var(--spacing) * ${iconSize === "prominent" ? 2.5 : 3})`, "Only prominent icons reclaim internal card padding");
        assert.equal(layoutProperties(iconRow.props.className, width).gap, `calc(var(--spacing) * ${iconSize === "prominent" ? 1 : 2})`, "Only prominent icons reclaim internal content/icon spacing");
        cases += 1;
      }
      const markup = renderToStaticMarkup(tree);
      assert.match(markup, /0.*%/u, "Zero-valued metrics and suffixes must remain visible");
      assert.match(markup, /مؤشر اختبار/u);
      assert.equal(tree.type, "div");
    }
    const bare = { label: "مؤشر بلا أيقونة", value: 42, compact };
    assert.equal(renderToStaticMarkup(React.createElement(Metric, bare)), renderToStaticMarkup(React.createElement(Metric, { ...bare, iconSize: "prominent" })), "The opt-in icon size must not affect consumers without icons");
    const onClick = () => {};
    const button = Metric({ ...props, iconSize: "prominent", onClick, active: true, ariaLabel: "فتح تفاصيل المؤشر" });
    assert.equal(button.type, "button");
    assert.equal(button.props.type, "button");
    assert.equal(button.props.onClick, onClick);
    assert.equal(button.props["aria-pressed"], true);
    assert.equal(button.props["aria-label"], "فتح تفاصيل المؤشر");
  }
  return cases;
}
const metricCard = read("src/components/admin/ui/AdminMetricCard.tsx");
check("Actual Metric Card preserves default sizes/strokes and semantics while prominent glyphs opt in to 36px and stroke 2", verifyMetricIconPresentation(metricCard) === 12);
const metricMutants = [
  metricCard.replaceAll("size-5.5", "size-9"),
  metricCard.replaceAll("md:size-6", "md:size-9"),
  metricCard.replaceAll("size-9", "size-7"),
  metricCard.replace("[&>svg]:stroke-2", "[&>svg]:stroke-1"),
  metricCard.replace('"size-5.5 md:size-6', '"[&>svg]:stroke-2 size-5.5 md:size-6'),
  metricCard.replace('"p-2.5" : "p-3"', '"p-3" : "p-3"'),
  metricCard.replace('"p-2.5" : "p-3"', '"p-2.5" : "p-2.5"'),
  metricCard.replace('"gap-1" : "gap-2"', '"gap-2" : "gap-2"'),
  metricCard.replace('"gap-1" : "gap-2"', '"gap-1" : "gap-1"'),
  metricCard.replace('iconSize = "default"', 'iconSize = "prominent"'),
  metricCard.replace('iconSize === "prominent"', 'iconSize === "default"'),
  metricCard.replaceAll('aria-hidden="true"', 'aria-hidden="false"'),
  metricCard.replace('"aria-pressed": active', '"aria-pressed": false'),
];
check("Metric Card negatives reject default size/stroke drift, undersized prominence, ignored opt-in, exposed glyphs and changed interaction semantics", metricMutants.every(source => {
  if (source === metricCard) return false;
  try { verifyMetricIconPresentation(source); return false; } catch { return true; }
}));

function verifyDashboardThumbnailPresentation(source) {
  const ast = ts.createSourceFile("AdminDashboardView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === "DashboardThumbnail");
  assert.equal(declarations.length, 1, "One existing Dashboard thumbnail presentation owner must remain");
  const code = ts.transpileModule(declarations[0].getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const Image = () => null;
  const Icon = () => null;
  const Thumbnail = Function("require", "exports", "PublicMediaImage", "AdminModuleTabIcon", code + ";return DashboardThumbnail;")(() => jsxRuntime, {}, Image, Icon);
  const mounts = [];
  function collectMounts(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "DashboardThumbnail") {
      mounts.push(Object.fromEntries(node.attributes.properties.map(property => {
        assert.ok(ts.isJsxAttribute(property), "Thumbnail mounts cannot spread a parallel presentation");
        const value = property.initializer;
        return [property.name.getText(ast), value && ts.isJsxExpression(value) ? value.expression?.getText(ast) : value?.text];
      })));
    }
    ts.forEachChild(node, collectMounts);
  }
  collectMounts(ast);
  assert.deepEqual(mounts, [
    { image: "topic.image", imageAlt: "topic.imageAlt", icon: "media" },
    { image: "project.image", imageAlt: "project.imageAlt", icon: "plans" },
  ], "Both original sources and alt text must use the one shared Dashboard thumbnail owner without per-consumer dimensions");
  let cases = 0;
  let commonReservedClass;
  for (const icon of ["media", "plans"]) {
    const expectedWidths = [112, 128];
    let reservedClass;
    for (const image of [undefined, null, "", "/images/original-project.webp", "https://dashboard-fixture.supabase.co/storage/v1/object/public/dashboard-fixture-images/images/original.png"]) {
      const props = { image, imageAlt: "وصف الصورة الأصلي", icon };
      const tree = Thumbnail(props);
      assert.equal(tree.type, "span");
      assert.ok(Object.hasOwn(tree.props, "data-dashboard-thumbnail"));
      reservedClass ??= tree.props.className;
      commonReservedClass ??= tree.props.className;
      assert.equal(tree.props.className, reservedClass, "The reserved landscape frame must remain identical with and without an image");
      assert.equal(tree.props.className, commonReservedClass, "Content and Project thumbnails must retain equal visual dimensions");
      for (const [index, width] of [390, 1536].entries()) {
        const css = layoutProperties(tree.props.className, width);
        assert.equal(css.width, `calc(var(--spacing) * ${expectedWidths[index] / 4})`);
        assert.equal(css["aspect-ratio"], "var(--aspect-video)", "Both thumbnail consumers reserve the landscape ratio");
        assert.equal(css["flex-shrink"], "0");
        assert.equal(css.overflow, "hidden");
      }
      const children = React.Children.toArray(tree.props.children);
      const fallback = children[0];
      assert.equal(fallback.props["aria-hidden"], "true", "The reserved fallback stays decorative");
      assert.equal(fallback.props.children.props.children.type, Icon);
      assert.equal(fallback.props.children.props.children.props.name, props.icon);
      const fallbackCss = layoutProperties(fallback.props.children.props.className, 390);
      for (const property of ["width", "height"]) assert.equal(fallbackCss[property], "calc(var(--spacing) * 7)", "Both consumers retain a visible 28px fallback in the reserved frame");
      const renderedImage = children.find(child => child.type === Image);
      if (image) {
        assert.ok(renderedImage);
        assert.equal(renderedImage.props.src, image, "The authored source must reach the existing renderer unchanged");
        assert.equal(renderedImage.props.alt, props.imageAlt);
        assert.equal(renderedImage.props.fill, true);
        assert.equal(renderedImage.props.composition, "cover-center");
        assert.equal(renderedImage.props.fallbackSrc, null, "Fallback must not substitute another photo");
        assert.equal(renderedImage.props.sizes, `(min-width: 640px) ${expectedWidths[1]}px, ${expectedWidths[0]}px`);
      } else assert.equal(renderedImage, undefined, "Absent source must retain the icon without an image request");
      cases += 1;
    }
    const withoutAlt = Thumbnail({ image: "/images/original-project.webp", icon });
    assert.equal(React.Children.toArray(withoutAlt.props.children).find(child => child.type === Image).props.alt, "");
  }
  return cases;
}
const dashboardView = read("src/components/admin/dashboard/AdminDashboardView.tsx");
check("Actual Dashboard thumbnails unify responsive landscape frames while preserving authored sources, alt text and 28px decorative fallback", verifyDashboardThumbnailPresentation(dashboardView) === 10);
const thumbnailMutants = [
  dashboardView.replace("aspect-video", "aspect-square"),
  dashboardView.replace("w-28", "w-20"),
  dashboardView.replace("sm:w-32", "sm:w-24"),
  dashboardView.replace('className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-xl border border-[#D8B87A]/20 bg-[#D8B87A]/8 sm:w-32"', 'className={`relative block aspect-video shrink-0 overflow-hidden ${icon === "plans" ? "w-28 sm:w-32" : "w-20 sm:w-24"}`}'),
  dashboardView.replace('image={topic.image}', 'image={project.image}'),
  dashboardView.replace('className="size-7"', 'className="size-6"'),
  dashboardView.replace("src={image}", 'src="/replacement.webp"'),
  dashboardView.replace("fallbackSrc={null}", 'fallbackSrc="/replacement.webp"'),
  dashboardView.replace('composition="cover-center"', 'composition="contain-center"'),
  dashboardView.replace("          fill\n", "          fill={false}\n").replace("          fill\r\n", "          fill={false}\r\n"),
  dashboardView.replace("128px, 112px", "128px, 40px"),
];
check("Dashboard thumbnail negatives reject unequal/undersized frames, small fallbacks, substituted sources, wrong crop/fill and stale sizes", thumbnailMutants.every(source => {
  if (source === dashboardView) return false;
  try { verifyDashboardThumbnailPresentation(source); return false; } catch { return true; }
}));

function dashboardContentFlowClasses(source) {
  const ast = ts.createSourceFile("AdminDashboardView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let primary;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "AdminDataGridPrimaryCell") primary ??= node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(primary, "Dashboard recent content retains the shared primary cell");
  const wrapper = primary.children.find(ts.isJsxElement);
  const text = wrapper?.children.find(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "div");
  const classes = element => {
    const attribute = element?.openingElement.attributes.properties.find(node => ts.isJsxAttribute(node) && node.name.getText(ast) === "className");
    assert.ok(attribute?.initializer && ts.isStringLiteral(attribute.initializer));
    return attribute.initializer.text;
  };
  return { wrapper: classes(wrapper), text: classes(text) };
}
function verifyDashboardContentFlow(source) {
  const classes = dashboardContentFlowClasses(source);
  const length = value => {
    const spacing = /^calc\(var\(--spacing\) \* ([\d.]+)\)$/u.exec(value ?? "");
    if (spacing) return Number(spacing[1]) * 4;
    const pixels = /^([\d.]+)px$/u.exec(value ?? "");
    assert.ok(pixels, `Expected a compiled spacing length, received ${value}`);
    return Number(pixels[1]);
  };
  // These are the corrected usable primary-track bounds at 320/390/1510px,
  // measured in the focused Browser review after unifying thumbnail widths.
  // Compiled properties establish the wrapping envelope; Browser evidence is
  // still required for actual line lengths, geometry and visual approval.
  for (const [viewport, available, imageWidth, shouldWrap] of [[320, 142, 112, true], [390, 212, 112, true], [1510, 293.1875, 128, false]]) {
    const wrapper = layoutProperties(classes.wrapper, viewport);
    const text = layoutProperties(classes.text, viewport);
    assert.equal(wrapper.display, "flex");
    assert.equal(wrapper["flex-wrap"], "wrap", "Narrow primary tracks must let the title flow below its image");
    assert.equal(text["min-width"], "calc(var(--spacing) * 0)");
    assert.equal(text["flex-grow"], "1", "A wrapped title must reclaim the full primary track");
    const basis = length(text["flex-basis"]);
    const gap = length(wrapper.gap);
    assert.ok(basis >= 112, "The text preference must preserve a readable title column");
    assert.equal(gap, 8, "The thumbnail/text gap retains the approved compact spacing");
    assert.equal(imageWidth + gap + basis > available, shouldWrap, `Content flow must fit its measured ${viewport}px primary track`);
  }
  return true;
}
check("Compiled actual Dashboard content flow protects narrow title width and keeps image/text inline where space allows", verifyDashboardContentFlow(dashboardView));
const contentFlowClasses = dashboardContentFlowClasses(dashboardView);
const contentFlowMutants = [
  dashboardView.replace(contentFlowClasses.wrapper, contentFlowClasses.wrapper.replace("flex-wrap", "flex-nowrap")),
  dashboardView.replace(contentFlowClasses.text, contentFlowClasses.text.replace(/basis-[\d.]+/u, "basis-0")),
  dashboardView.replace(contentFlowClasses.text, contentFlowClasses.text.replace(/\bgrow\b/u, "grow-0")),
  dashboardView.replace(contentFlowClasses.wrapper, contentFlowClasses.wrapper.replace(/gap-[\d.]+/u, "gap-3")),
];
check("Dashboard content flow negatives reject nowrap, zero title basis, lost growth and changed thumbnail/text spacing", contentFlowMutants.every(source => {
  if (source === dashboardView) return false;
  try { verifyDashboardContentFlow(source); return false; } catch { return true; }
}));

function verifyDashboardRecentDensity(source) {
  const ast = ts.createSourceFile("AdminDashboardView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const attribute = (element, name) => element.openingElement.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast) === name)?.initializer;
  const textAttribute = (element, name) => {
    const value = attribute(element, name);
    assert.ok(value === undefined || ts.isStringLiteral(value), `Expected a literal ${name} in the Dashboard composition`);
    return value?.text ?? "";
  };
  let summary, content, projectList, projectRow;
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(ast);
      if (tag === "section" && textAttribute(node, "aria-label") === "ملخص المحتوى والمشاريع") summary = node;
      if (tag === "AdminDataGrid" && textAttribute(node, "scrollLabel") === "آخر المحتويات") content = node;
      if (tag === "Link") {
        const href = attribute(node, "href");
        if (href && ts.isJsxExpression(href) && href.expression?.getText(ast) === "`/admin/projects/${project.id}`") projectRow = node;
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "truth.recentProjects.map") {
      let parent = node.parent;
      while (parent && !ts.isJsxElement(parent)) parent = parent.parent;
      assert.ok(parent); projectList = parent;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(summary && content && projectList && projectRow, "Existing Dashboard summary/Grid/Project composition owners must remain");
  const summaryClasses = textAttribute(summary, "className");
  assert.equal(layoutProperties(summaryClasses, 1510)["grid-template-columns"], "minmax(0,1.2fr) minmax(0,0.8fr) minmax(0,1fr)", "Desktop reserves the wider content track required by the unified thumbnail");
  const contentClasses = textAttribute(content, "className");
  const projectClasses = textAttribute(projectList, "className");
  for (const viewport of [320, 390, 1510]) {
    const grid = layoutProperties(contentClasses, viewport);
    assert.equal(grid.flex, undefined, "Embedded content rows cannot stretch to fill a neighboring panel");
    assert.equal(grid.height, undefined);
    assert.equal(layoutProperties(contentClasses, viewport, "div").height, undefined, "The embedded scroll region keeps natural content height");
    const projects = layoutProperties(projectClasses, viewport);
    assert.equal(projects.display, "grid");
    assert.equal(projects.flex, undefined, "Project rows keep their natural height");
    assert.ok(projects["grid-auto-rows"] === undefined || projects["grid-auto-rows"] === "auto", "Project rows must not distribute surplus panel height equally");
    assert.equal(layoutProperties(textAttribute(projectRow, "className"), viewport)["padding-block"], "calc(var(--spacing) * 3)", "Project row spacing is 12px between natural records");
  }
  assert.equal(textAttribute(content, "surface"), "embedded", "The existing parent Panel remains the visual surface owner");
  assert.match(source, /const RECENT_CONTENT_COLUMNS = `minmax\(0,1fr\) \$\{adminDataGridActionsColumn\(2, "compact"\)\}`/u, "The canonical two-action track must remain readable");
  return { contentClasses, projectClasses, projectRowClasses: textAttribute(projectRow, "className"), summaryClasses };
}
check("Compiled Dashboard composition keeps natural recent-row density and a readable wider Desktop content track", Boolean(verifyDashboardRecentDensity(dashboardView)));
const recentDensity = verifyDashboardRecentDensity(dashboardView);
const recentDensityMutants = [
  dashboardView.replace('scrollLabel="آخر المحتويات"', 'scrollLabel="آخر المحتويات" className="flex-1 [&>div]:h-full"'),
  dashboardView.replace(recentDensity.projectClasses, `${recentDensity.projectClasses} flex-1 auto-rows-fr`),
  dashboardView.replace(recentDensity.projectRowClasses, recentDensity.projectRowClasses.replace("py-3", "py-4")),
  dashboardView.replace(recentDensity.summaryClasses, recentDensity.summaryClasses.replace("xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)]", "xl:grid-cols-3")),
  dashboardView.replace('adminDataGridActionsColumn(2, "compact")', 'adminDataGridActionsColumn(1, "compact")'),
];
check("Dashboard density negatives reject forced row filling, equal-height distribution, old spacing and a narrowed action/content budget", recentDensityMutants.every(source => {
  if (source === dashboardView) return false;
  try { verifyDashboardRecentDensity(source); return false; } catch { return true; }
}));

function verifyDashboardRecentTopicDatePresentation(source) {
  const ast = ts.createSourceFile("AdminDashboardView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let topicRenderer, statusOwner;
  function visit(node) {
    if (ts.isArrowFunction(node) && node.parameters.length === 1 && node.parameters[0].name.getText(ast) === "topic") {
      assert.equal(topicRenderer, undefined, "Recent Topic rendering must have one existing callback owner");
      topicRenderer = node;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "statusLabel") statusOwner = node;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(topicRenderer && statusOwner);
  const code = ts.transpileModule(`${statusOwner.getText(ast)}\nconst renderRecentTopic = ${topicRenderer.getText(ast)};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const Row = props => React.createElement("article", null, props.children);
  const Primary = props => React.createElement("div", null, props.children);
  const Actions = () => React.createElement("button", { type: "button" }, "إجراءات الاختبار");
  const Thumbnail = props => React.createElement("span", { "data-original-image": props.image, "aria-label": props.imageAlt });
  const date = value => `QA-DATE:${value}`;
  const bindings = { RECENT_CONTENT_COLUMNS: "existing-shared-two-action-track", AdminDataGridRow: Row,
    AdminDataGridPrimaryCell: Primary, AdminDataGridRowActions: Actions, DashboardThumbnail: Thumbnail,
    formatAdminDateTime: date, getContentTypeLabel: value => `QA-TYPE:${value}` };
  const render = Function("require", "exports", ...Object.keys(bindings), code + ";return renderRecentTopic;")(() => jsxRuntime, {}, ...Object.values(bindings));
  for (const status of ["published", "draft"]) {
    const topic = { id: 271, title: "عنوان المحتوى الأصلي", category: "تصنيف المحتوى الأصلي", contentType: "article", status,
      image: "/images/unchanged-original.webp", imageAlt: "الوصف الأصلي", updatedAt: "2026-10-21T17:00:00.000Z", createdAt: "2020-01-01T00:00:00.000Z" };
    const tree = render(topic);
    assert.equal(tree.type, Row); assert.equal(tree.props.divided, true); assert.equal(tree.props.stickyActions, false);
    const children = React.Children.toArray(tree.props.children);
    const primary = children.find(child => child.type === Primary), actions = children.find(child => child.type === Actions);
    assert.ok(primary && actions, "Recent Content retains the canonical Primary Cell and Row Actions owners");
    const primaryMarkup = renderToStaticMarkup(primary), visible = primaryMarkup.replace(/<[^>]+>/gu, "");
    assert.equal((primaryMarkup.match(/<time\b/gu) ?? []).length, 0, "The recent-content primary cell no longer exposes a visible timestamp");
    assert.ok(!visible.includes(date(topic.updatedAt)) && !visible.includes(topic.updatedAt), "Changing a time element to another visible wrapper cannot restore the removed date");
    for (const text of [topic.title, topic.category, `QA-TYPE:${topic.contentType}`, status === "published" ? "منشور" : "غير منشور"]) assert.ok(visible.includes(text), "Existing visible identity/type/category/status metadata remains");
    assert.ok(primaryMarkup.includes(topic.image) && primaryMarkup.includes(topic.imageAlt), "The original thumbnail binding remains");
    assert.equal(actions.props.size, "compact"); assert.equal(actions.props.iconSize, "lg");
    const capability = actions.props.capability;
    assert.equal(capability.entityType, "dashboard_recent_topic"); assert.equal(capability.entityId, topic.id); assert.equal(capability.entityLabel, topic.title);
    assert.deepEqual(capability.actions.edit, { access: "allowed", href: `/admin/content/topics/${topic.id}` });
    assert.equal(capability.actions.information.access, "allowed");
    assert.deepEqual(capability.actions.information.items, [
      { label: "النوع", value: `QA-TYPE:${topic.contentType}` },
      { label: "التصنيف", value: topic.category },
      { label: "الحالة", value: status === "published" ? "منشور" : "غير منشور" },
      { label: "آخر تحديث", value: date(topic.updatedAt) },
    ], "The original updatedAt remains available through Information without changing its data source");
    for (const name of ["preview", "copyPublicLink", "visibility", "featured", "duplicate", "archive", "delete"]) assert.equal(capability.actions[name].access, "hidden");
  }
  return true;
}
check("Actual recent-topic SSR hides only the visible date while retaining original metadata, image, actions and Information updatedAt", verifyDashboardRecentTopicDatePresentation(dashboardView));
const recentTopicDateMutants = [
  dashboardView.replace(/\{topic\.title\}(\s*<\/p>)/u, "{topic.title}<time dateTime={topic.updatedAt}>{formatAdminDateTime(topic.updatedAt)}</time>$1"),
  dashboardView.replace(/\{topic\.title\}(\s*<\/p>)/u, "{topic.title}<span>{formatAdminDateTime(topic.updatedAt)}</span>$1"),
  dashboardView.replace('label: "آخر تحديث"', 'label: "بدون تحديث"'),
  dashboardView.replace("formatAdminDateTime(topic.updatedAt)", "formatAdminDateTime(topic.createdAt)"),
];
check("Recent-topic date negatives reject a restored visible time/span and missing or changed Information updatedAt", recentTopicDateMutants.every(source => {
  if (source === dashboardView) return false;
  try { verifyDashboardRecentTopicDatePresentation(source); return false; } catch { return true; }
}));

function verifyDashboardDistributionNaturalFlow(source) {
  const ast = ts.createSourceFile("AdminDashboardView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  let panel;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ["distributions", "distributionTotal", "circumference"].includes(node.name.text)) {
      assert.equal(declarations.has(node.name.text), false); declarations.set(node.name.text, node);
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "Panel") {
      const title = node.openingElement.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast) === "title")?.initializer;
      if (title && ts.isStringLiteral(title) && title.text === "توزيع الحالات") panel = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(panel && declarations.size === 3);
  const branch = panel.children.find(ts.isJsxExpression)?.expression;
  assert.ok(branch && ts.isConditionalExpression(branch));
  let wrapper = branch.whenTrue;
  while (ts.isParenthesizedExpression(wrapper)) wrapper = wrapper.expression;
  assert.ok(ts.isJsxElement(wrapper));
  const code = ts.transpileModule([...declarations.values()].map(node => `const ${node.getText(ast)};`).join("\n")
    + `\nfunction renderDistribution(){return (${wrapper.getText(ast)});}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const labels = ["محتوى منشور", "محتوى غير منشور", "مشاريع منشورة", "مشاريع غير منشورة", "صفحات منشورة"];
  const colors = ["#D8B87A", "#B99AE9", "#64A5E8", "#4EC6B4", "#E8C785"];
  let layout;
  for (const values of [[11, 3, 5, 2, 7], [0, 0, 0, 0, 0]]) {
    const truth = { kpis: { topics: { published: values[0], unpublished: values[1] }, projects: { published: values[2], unpublished: values[3] }, pages: { published: values[4] } } };
    const render = Function("require", "exports", "truth", "AdminModuleTabIcon", code + ";return renderDistribution;")(() => jsxRuntime, {}, truth, () => null);
    const tree = render(), children = React.Children.toArray(tree.props.children);
    const disk = children.find(child => child.type === "div"), legend = children.find(child => child.type === "dl");
    assert.ok(disk && legend);
    const svg = React.Children.toArray(disk.props.children).find(child => child.type === "svg");
    assert.ok(svg); assert.equal(svg.props.viewBox, "0 0 100 100"); assert.equal(svg.props["aria-hidden"], "true"); assert.equal(svg.props.focusable, "false");
    for (const viewport of [320, 390, 1510]) {
      const flow = layoutProperties(tree.props.className, viewport);
      assert.equal(flow.display, "flex"); assert.equal(flow["flex-direction"], "column"); assert.equal(flow.gap, "calc(var(--spacing) * 6)");
      assert.equal(flow.flex, undefined, "The chart no longer grows to fill another Panel's height");
      assert.equal(flow["justify-content"], undefined, "The chart cannot distribute artificial surplus space between disk and legend");
      for (const property of ["height", "min-height", "max-height", "padding", "padding-block"]) assert.equal(flow[property], undefined, "The chart wrapper retains natural height without artificial vertical spacing");
      const frame = layoutProperties(disk.props.className, viewport);
      assert.equal(frame["aspect-ratio"].replace(/\s/gu, ""), "1/1"); assert.equal(frame.width, "100%");
      assert.equal(frame["max-width"], "calc(var(--spacing) * 56)", "The original 224px disk cap cannot shrink with the natural-flow correction");
      assert.equal(frame["margin-inline"], "auto"); assert.equal(frame.height, undefined);
      const svgCss = layoutProperties(svg.props.className, viewport);
      assert.equal(svgCss.width, "100%"); assert.equal(svgCss.height, "100%"); assert.equal(svgCss.rotate, "calc(90deg * -1)");
    }
    const circles = React.Children.toArray(svg.props.children), total = values.reduce((sum, value) => sum + value, 0), circumference = 2 * Math.PI * 42;
    assert.equal(circles.length, values.length + 1);
    for (const circle of circles) {
      assert.equal(circle.type, "circle"); assert.equal(circle.props.cx, "50"); assert.equal(circle.props.cy, "50");
      assert.equal(circle.props.r, "42"); assert.equal(circle.props.fill, "none"); assert.equal(circle.props.strokeWidth, "13");
    }
    assert.equal(circles[0].props.stroke, "rgba(255,255,255,0.06)");
    let offset = 0;
    for (const [index, circle] of circles.slice(1).entries()) {
      assert.equal(circle.props.stroke, colors[index]);
      assert.equal(circle.props.strokeDasharray, `${total ? values[index] / total * circumference : 0} ${circumference}`);
      assert.equal(circle.props.strokeDashoffset, total ? -offset / total * circumference : 0); offset += values[index];
    }
    const items = React.Children.toArray(legend.props.children);
    assert.equal(items.length, values.length); assert.equal(legend.props.className, "space-y-4");
    for (const [index, item] of items.entries()) {
      const pair = React.Children.toArray(item.props.children), label = pair.find(child => child.type === "dt"), value = pair.find(child => child.type === "dd");
      assert.ok(label && value); assert.equal(renderToStaticMarkup(label).replace(/<[^>]+>/gu, ""), labels[index]); assert.equal(value.props.children, values[index]);
      assert.equal(React.Children.toArray(label.props.children).find(React.isValidElement).props.style.backgroundColor, colors[index]);
    }
    layout = { wrapperClasses: tree.props.className, diskClasses: disk.props.className };
  }
  return layout;
}
check("Actual chart SSR and compiled CSS use natural flow while preserving disk geometry, all arcs, legend data and zero counts", Boolean(verifyDashboardDistributionNaturalFlow(dashboardView)));
const distributionLayout = verifyDashboardDistributionNaturalFlow(dashboardView);
const distributionMutants = [
  dashboardView.replace(distributionLayout.wrapperClasses, `${distributionLayout.wrapperClasses} flex-1 justify-evenly`),
  dashboardView.replace(distributionLayout.wrapperClasses, `${distributionLayout.wrapperClasses} h-[480px]`),
  dashboardView.replace(distributionLayout.wrapperClasses, `${distributionLayout.wrapperClasses} py-2`),
  dashboardView.replace(distributionLayout.diskClasses, distributionLayout.diskClasses.replace("max-w-56", "max-w-48")),
  dashboardView.replace(distributionLayout.diskClasses, distributionLayout.diskClasses.replace("aspect-square", "aspect-video")),
  dashboardView.replace(/(label:\s*"محتوى منشور",\s*value:\s*)truth\.kpis\.topics\.published/u, "$1truth.kpis.topics.unpublished"),
  dashboardView.replace('strokeWidth="13"', 'strokeWidth="9"'),
];
check("Chart negatives reject restored stretch/distribution, fixed height or padding, a smaller disk and changed read-model arcs/data", distributionMutants.every(source => {
  if (source === dashboardView) return false;
  try { verifyDashboardDistributionNaturalFlow(source); return false; } catch { return true; }
}));

function verifySidebarGlyphPresentation(source) {
  const ast = ts.createSourceFile("AdminShell.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let sidebar;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "renderSidebar") sidebar = node;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(sidebar);
  const code = ts.transpileModule(sidebar.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const elements = node => Array.isArray(node) ? node.flatMap(elements)
    : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  const navigation = [
    { id: "glyph-leaf", href: "/admin/glyph-leaf", label: "عنصر اختبار", icon: "◉" },
    { id: "glyph-group", href: "/admin/glyph-group", label: "مجموعة اختبار", icon: "▣", children: [{ id: "glyph-child", href: "/admin/glyph-child", label: "فرع اختبار" }] },
  ];
  const Nav = () => null, Link = () => null;
  let cases = 0;
  for (const collapsed of [false, true]) for (const forceExpanded of [false, true]) {
    const compact = collapsed && !forceExpanded, groups = [];
    let toggles = 0;
    const toggleCollapsed = () => { toggles += 1; };
    const bindings = { collapsed, company: { name: "اختبار", cmsLabel: "TEST", publicWebsiteUrl: "/public-glyph-fixture" },
      navigation, activeGroupIds: new Set(), openGroupId: null, pathname: "/admin/glyph-leaf", onNavigateStart() {},
      toggleCollapsed, setGroupOverride: value => groups.push(value), isAdminNavigationItemActive: () => false,
      CompanyMark: () => null, Link, AdminNavLink: Nav, VENESIA_SCROLLBAR_VISUAL_CLASSES: "venesia-scrollbar" };
    const render = Function("require", "exports", ...Object.keys(bindings), code + ";return renderSidebar;")(() => jsxRuntime, {}, ...Object.values(bindings));
    const tree = render(forceExpanded), all = elements(tree);
    for (const item of navigation) {
      const glyphs = all.filter(node => node.type === "span" && node.props.children === item.icon);
      assert.equal(glyphs.length, 1, "Leaf and group retain their supplied Unicode glyph instead of a replacement owner");
      for (const width of [390, 1536]) {
        const css = layoutProperties(glyphs[0].props.className, width);
        assert.equal(css["font-size"], "28px"); assert.equal(css["line-height"], "1");
        for (const dimension of ["width", "height"]) assert.equal(css[dimension], "calc(var(--spacing) * 9)", "The original 36px navigation frame must contain the larger glyph");
        assert.equal(css["flex-shrink"], "0"); assert.equal(css.display, "grid");
      }
    }
    const collapse = all.find(node => node.type === "button" && node.props.onClick === toggleCollapsed);
    if (forceExpanded) assert.equal(collapse, undefined, "The Mobile drawer retains its existing separate close control");
    else {
      assert.ok(collapse); assert.equal(collapse.props.type, "button"); assert.equal(collapse.props["aria-expanded"], !compact);
      const css = layoutProperties(collapse.props.className, 1536);
      assert.equal(css["font-size"], "var(--text-2xl)"); assert.equal(css["line-height"], "1");
      for (const dimension of ["width", "height"]) assert.equal(css[dimension], "calc(var(--spacing) * 9)");
      collapse.props.onClick(); assert.equal(toggles, 1, "Glyph refinement preserves the existing collapse handler");
    }
    const group = all.find(node => node.type === "button" && node !== collapse && Object.hasOwn(node.props, "aria-expanded"));
    if (compact) assert.equal(group, undefined);
    else {
      assert.ok(group); assert.equal(group.props["aria-expanded"], false);
      const disclosure = React.Children.toArray(group.props.children).find(node => React.isValidElement(node) && typeof node.props.children === "string");
      assert.ok(disclosure);
      const css = layoutProperties(disclosure.props.className, 390);
      assert.equal(css["font-size"], "var(--text-base)"); assert.equal(css["line-height"], "1");
      group.props.onClick(); assert.deepEqual(groups, [{ pathname: bindings.pathname, id: "glyph-group" }]);
    }
    const publicLink = all.find(node => node.type === Link && node.props.href === bindings.company.publicWebsiteUrl);
    assert.ok(publicLink);
    const publicGlyph = React.Children.toArray(publicLink.props.children).find(node => React.isValidElement(node) && node.type === "span");
    assert.ok(publicGlyph && typeof publicGlyph.props.children === "string");
    const css = layoutProperties(publicGlyph.props.className, 390);
    assert.equal(css["font-size"], "var(--text-xl)"); assert.equal(css["line-height"], "1");
    for (const dimension of ["width", "height"]) assert.equal(css[dimension], "calc(var(--spacing) * 8)");
    const leaf = all.find(node => node.type === Nav && node.props.href === navigation[0].href);
    assert.ok(leaf); assert.equal(leaf.props.onNavigateStart, bindings.onNavigateStart);
    cases += 1;
  }
  return cases;
}
check("Actual Sidebar retains Unicode ownership, 36px frames and navigation behavior with larger leaf/group/control glyphs", verifySidebarGlyphPresentation(shell) === 4);
const sidebarGlyphClass = "font-en text-[28px] leading-none";
const finalSidebarGlyph = shell.lastIndexOf(sidebarGlyphClass);
assert.ok(finalSidebarGlyph >= 0);
const sidebarGlyphMutants = [
  shell.replace(sidebarGlyphClass, "font-en text-base leading-none"),
  shell.slice(0, finalSidebarGlyph) + shell.slice(finalSidebarGlyph).replace(sidebarGlyphClass, "font-en text-base leading-none"),
  shell.replaceAll("size-9 shrink-0 place-items-center rounded-2xl", "size-7 shrink-0 place-items-center rounded-2xl"),
  shell.replaceAll("{item.icon}", '{"replacement"}'),
  shell.replace("text-2xl font-bold leading-none", "text-sm font-bold leading-none"),
  shell.replace("text-base leading-none transition", "text-xs leading-none transition"),
  shell.replace("text-xl leading-none", "text-sm leading-none"),
];
check("Sidebar glyph negatives reject a small leaf or group hidden by its valid sibling, narrowed frames, replacements and undersized controls", sidebarGlyphMutants.every(source => {
  if (source === shell) return false;
  try { verifySidebarGlyphPresentation(source); return false; } catch { return true; }
}));

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
  assert.equal(desktop.wrapper["background-color"], "transparent", "The Desktop sidebar keeps its existing transparent composition");
  assert.equal(desktop.aside["background-color"], "transparent");
  for (const node of [desktop.wrapper, desktop.aside]) {
    assert.ok(!["fixed", "sticky", "absolute"].includes(node.position), "Desktop navigation must participate in normal document flow");
    assert.ok(!node.height || node.height === "auto");
    assert.ok(!node["max-height"] || node["max-height"] === "none");
  }
  assert.equal(desktop.aside["min-height"], "100vh");
  assert.ok(!desktop.nav["overflow-y"] || desktop.nav["overflow-y"] === "visible");
  assert.equal(mobile.dialog.position, "fixed");
  assert.equal(mobile.wrapper.height, "100%");
  assert.equal(mobile.wrapper["background-color"], "var(--admin-surface)", "The Mobile overlay must paint the canonical surface so underlying Dashboard text cannot bleed through its transparent sidebar");
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
check("Compiled actual desktop Sidebar keeps its transparent document flow while the bounded Mobile drawer paints the canonical surface", Boolean(sidebarLayout(shell)));
const sidebarMutants = [
  shell.replace('className="hidden shrink-0 bg-transparent lg:block"', 'className="hidden shrink-0 bg-transparent lg:block [position:sticky] [height:100vh]"'),
  shell.replace('forceExpanded ? "h-full" : "min-h-screen"', 'forceExpanded ? "h-full" : "[height:100vh] min-h-screen"'),
  shell.replace('forceExpanded ? "overflow-y-auto " : ""', 'forceExpanded ? "overflow-y-auto " : "[overflow-y:auto] "'),
  shell.replace('forceExpanded ? "overflow-y-auto " : ""', 'forceExpanded ? "[overflow-y:visible] " : ""'),
  shell.replace('className="absolute right-0 top-0 h-full bg-[var(--admin-surface)]"', 'className="absolute right-0 top-0 h-full"'),
  shell.replace('className="absolute right-0 top-0 h-full bg-[var(--admin-surface)]"', 'className="absolute right-0 top-0 h-full bg-transparent"'),
];
check("Equivalent-property negatives reject desktop sticky/viewport/nav scrolling, lost Mobile scroll and missing or transparent drawer fill", sidebarMutants.every(source => {
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
    assert.equal(menuStyle["font-size"], "var(--text-2xl)"); assert.equal(menuStyle["line-height"], "1", "The Mobile menu keeps its larger glyph inside the existing 44px button");
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
  shell.replace("text-2xl leading-none text-white/70 lg:hidden", "text-base leading-none text-white/70 lg:hidden"),
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
