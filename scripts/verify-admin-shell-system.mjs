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
function hasConfirmedPageCompositionBulkDetach(source) {
  const tree = ts.createSourceFile("PageBlocksClient.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "handleBulkExecute") handler = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  let request;
  function findRequest(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "instant.mutateAsync") request = node.arguments[0];
    ts.forEachChild(node, findRequest);
  }
  if (!handler) return false;
  findRequest(handler);
  if (!request || !ts.isObjectLiteralExpression(request)) return false;
  const property = name => request.properties.find(node => ts.isPropertyAssignment(node) && node.name.getText(tree) === name)?.initializer?.getText(tree);
  const optimistic = property("optimistic") ?? "", reconciliation = property("reconcileSuccess") ?? "";
  return optimistic.includes('if (action === "detach")') &&
    !optimistic.includes("cache.removeRows") && !optimistic.includes("cache.transformActiveRows") &&
    reconciliation.includes('if (action !== "detach") return;') &&
    reconciliation.includes("cache.transformActiveRows((rows) => rows.filter(") &&
    reconciliation.includes("!idSet.has(assignmentRowId(candidate))");
}

check(
  "Page Composition bulk detach uses semantic confirmation and one atomic mutation",
  pageCompositionClient.includes("await instant.mutateAsync({") &&
    pageCompositionClient.includes("bulk: true") &&
    hasConfirmedPageCompositionBulkDetach(pageCompositionClient) &&
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
  "Page Composition bulk detach rejects premature removal and numeric-only assignment identity",
  !hasConfirmedPageCompositionBulkDetach(pageCompositionClient.replace(
    /if \(action === "detach"\) \{\s*return;/u,
    'if (action === "detach") {\n            cache.removeRows(idSet); return;',
  )) &&
    !hasConfirmedPageCompositionBulkDetach(pageCompositionClient.replace(
      "!idSet.has(assignmentRowId(candidate))", "!idSet.has(candidate.id)",
    )) &&
    !hasConfirmedPageCompositionBulkDetach(pageCompositionClient.replace(
      'if (action !== "detach") return;', 'if (action === "detach") return;',
    )),
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

function loadAdminStyleTokens() {
  const tokens = { exports: {} };
  const code = ts.transpileModule(read("src/lib/admin/admin-ui-styles.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  Function("exports", "module", "require", code)(tokens.exports, tokens, tokenSpecifier => {
    assert.equal(tokenSpecifier, "../../components/venesia-scrollbar-styles");
    const neutral = { exports: {} };
    const neutralCode = ts.transpileModule(read("src/components/venesia-scrollbar-styles.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    Function("exports", "module", neutralCode)(neutral.exports, neutral);
    return neutral.exports;
  });
  return tokens.exports;
}
function loadHeader(source, styleTokens = loadAdminStyleTokens()) {
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", compiled)(commonJsModule.exports, commonJsModule, specifier => {
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "../../../lib/admin/admin-ui-styles") return styleTokens;
    if (specifier === "./AdminModuleTabs") return { AdminModuleTabIcon: loadSharedHeaderIcon() };
    assert.equal(specifier, "./admin-scrollbar-styles");
    const scrollbarModule = { exports: {} };
    const scrollbarCode = ts.transpileModule(read("src/components/admin/ui/admin-scrollbar-styles.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    Function("exports", "module", "require", scrollbarCode)(scrollbarModule.exports, scrollbarModule, neutralSpecifier => {
      assert.equal(neutralSpecifier, "../../venesia-scrollbar-styles");
      const neutralModule = { exports: {} };
      const neutralCode = ts.transpileModule(read("src/components/venesia-scrollbar-styles.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      Function("exports", "module", neutralCode)(neutralModule.exports, neutralModule);
      return neutralModule.exports;
    });
    return scrollbarModule.exports;
  });
  return commonJsModule.exports.default;
}
function loadSharedHeaderIcon() {
  const loadFunction = (file, name, bindings) => {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(declaration);
    const compiled = ts.transpileModule(declaration.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    return Function("exports", "require", ...Object.keys(bindings), compiled + `;return ${name};`)({}, () => jsxRuntime, ...Object.values(bindings));
  };
  const gridAst = ts.createSourceFile("AdminDataGrid.tsx", dataGridOwner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let actionIconClass;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(gridAst) === "ADMIN_DATA_GRID_RULES") {
    const object = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
    const property = object.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(gridAst) === "actionIcon");
    assert.ok(property && ts.isStringLiteral(property.initializer)); actionIconClass = property.initializer.text;
  } ts.forEachChild(node, visit); };
  visit(gridAst); assert.ok(actionIconClass);
  const ActionIcon = loadFunction("src/components/admin/ui/AdminDataGrid.tsx", "AdminDataGridActionIcon", { ADMIN_DATA_GRID_RULES: { actionIcon: actionIconClass } });
  return loadFunction("src/components/admin/ui/AdminModuleTabs.tsx", "AdminModuleTabIcon", { AdminDataGridActionIcon: ActionIcon });
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

function verifyOfficialModuleHeaderDefault(source) {
  const Header = loadHeader(source);
  const elements = node => Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  const action = React.createElement("button", { type: "button", disabled: true, "data-header-action": "danger-pending" }, "إجراء قائم");
  let cases = 0;
  for (const variant of ["default", "minimal"]) for (const presentation of [undefined, "default", "cinematic"]) for (const actionsPresentation of [undefined, "default", "cinematic"]) for (const artwork of [undefined, "document", "statistics"]) {
    const props = { title: "عنوان المستهلك", description: "وصف المستهلك", eyebrow: "سياق", breadcrumb: "مسار", meta: "حالة", variant, presentation, actionsPresentation, artwork, actions: action };
    const tree = Header(props), all = elements(tree);
    assert.equal(tree.props["data-admin-page-header-presentation"], "cinematic");
    assert.equal(tree.props["data-admin-page-header-actions-presentation"], "cinematic");
    assert.equal(tree.props.className, loadAdminStyleTokens().ADMIN_CINEMATIC_GOLD_V1.module.root);
    assert.equal(renderToStaticMarkup(tree), renderToStaticMarkup(Header({ ...props, presentation: "cinematic", actionsPresentation: "cinematic" })), "Omitted and historical default values resolve to the same official presentation");
    assert.equal(all.filter(node => node === action).length, 1, "Existing action identity, Disabled and Pending payload remain untouched");
    const illustrated = all.filter(node => Object.hasOwn(node.props, "data-admin-header-artwork"));
    assert.equal(illustrated.length, artwork ? 1 : 0, "The owner never invents a document illustration for an unillustrated consumer");
    if (artwork) assert.equal(illustrated[0].props["data-admin-header-artwork"], artwork);
    const dock = all.find(node => node.props.role === "region");
    assert.equal(Boolean(dock), variant !== "minimal", "The existing utility variant retains its landmark semantics");
    cases += 1;
  }
  const bare = renderToStaticMarkup(Header({ title: "عنوان بلا إجراءات" }));
  assert.ok(!bare.includes("<button") && !bare.includes("<a ") && !bare.includes("data-admin-header-artwork"));
  return cases;
}
check("Module Header default and historical aliases use one cinematic owner while retaining utility semantics, explicit artwork and unchanged actions", verifyOfficialModuleHeaderDefault(pageHeader) === 54);
const officialHeaderMutants = [
  pageHeader.replace("resolveAdminCollectionPresentation(presentation)", "presentation"),
  pageHeader.replace("resolveAdminCollectionPresentation(actionsPresentation)", "actionsPresentation"),
  pageHeader.replace('data-admin-page-header-presentation={resolvedPresentation}', 'data-admin-page-header-presentation="default"'),
  pageHeader.replace('resolvedArtwork === "document"', '!resolvedArtwork || resolvedArtwork === "document"'),
  pageHeader.replace('resolvedArtwork === "statistics"', 'resolvedArtwork === "document"'),
  pageHeader.replace("{actions}", "{null}"),
];
check("Official Module Header negatives reject old default output, unnormalized action chrome, copied artwork and lost actions", officialHeaderMutants.every(source => {
  if (source === pageHeader) return false;
  try { verifyOfficialModuleHeaderDefault(source); return false; } catch { return true; }
}));

function verifyHeaderWrapperForwarding(sourceOverrides = {}) {
  const Header = () => null, BlockHeader = () => null, Action = () => null;
  const loadFunction = (file, name, bindings) => {
    const source = sourceOverrides[file] ?? read(file);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(declaration);
    const compiled = ts.transpileModule(declaration.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    return Function("exports", "require", ...Object.keys(bindings), compiled + `;return ${name};`)({}, () => jsxRuntime, ...Object.values(bindings));
  };
  const icon = React.createElement("svg", { "data-actual-icon-slot": "" });
  const action = React.createElement("button", { type: "button" }, "إجراء قائم");
  const props = { title: "عنوان قائم", description: "وصف قائم", icon, artwork: "statistics", visualPreset: "series", actions: action, meta: "بيانات قائمة" };
  const Basic = loadFunction("src/components/admin/ui/AdminPageHeader.tsx", "AdminPageHeader", { AdminPageContextHeader: Header });
  const basic = Basic(props);
  assert.equal(basic.type, Header);
  for (const key of ["title", "description", "icon", "artwork", "visualPreset", "actions", "meta"]) assert.equal(basic.props[key], props[key]);
  const Context = loadFunction("src/components/admin/page-blocks/BlockEditorContextHeader.tsx", "BlockEditorContextHeader", { AdminPageContextHeader: Header, AdminActionButton: Action, statusMeta: () => ({ label: "مسودة" }) });
  const context = Context({ ...props, backHref: "/admin/pages-blocks/blocks", backLabel: "العودة" });
  assert.equal(context.type, Header);
  for (const key of ["title", "description", "icon", "artwork", "visualPreset", "meta"]) assert.equal(context.props[key], props[key]);
  const actions = context.props.actions.props.children;
  assert.ok(Array.isArray(actions));
  assert.equal(actions[0], action); assert.equal(actions[1].type, Action);
  assert.equal(actions[1].props.href, "/admin/pages-blocks/blocks"); assert.equal(actions[1].props.children, "العودة");
  for (const mode of ["direct", "back", "contextual"]) {
    const metadata = { eyebrowAr: null, titleAr: "عنوان الميتاداتا القائم", descriptionAr: "وصف الميتاداتا القائم" };
    const returnNavigation = mode === "contextual" ? { backHref: "/admin/pages-blocks/pages/1", backLabel: "الصفحة" } : null;
    const Module = loadFunction("src/components/admin/page-blocks/ModuleEditorPresentation.tsx", "ModuleEditorHeader", {
      AdminPageContextHeader: Header, BlockEditorContextHeader: BlockHeader,
      useSearchParams: () => new URLSearchParams(), getModuleEditorHeaderMetadata: () => metadata,
      resolveModuleEditorReturnNavigation: () => returnNavigation, MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM: "return_page",
    });
    const result = Module({ ...props, moduleKind: "content", ...(mode === "back" ? { backHref: "/admin/pages-blocks/blocks", backLabel: "العودة" } : {}) });
    assert.equal(result.type, mode === "direct" ? Header : BlockHeader);
    assert.equal(result.props.title, metadata.titleAr); assert.equal(result.props.description, metadata.descriptionAr);
    for (const key of ["icon", "artwork", "visualPreset", "actions", "meta"]) assert.equal(result.props[key], props[key]);
    if (returnNavigation) assert.equal(result.props.backHref, returnNavigation.backHref);
  }
  return true;
}
check("Actual Page/Block/Module Header wrappers forward optional semantic artwork and icons without losing metadata, actions or return navigation", verifyHeaderWrapperForwarding());
const wrapperMutants = [
  ["src/components/admin/ui/AdminPageHeader.tsx", "artwork={artwork}", "artwork={undefined}"],
  ["src/components/admin/page-blocks/BlockEditorContextHeader.tsx", "icon={icon}", "icon={undefined}"],
  ["src/components/admin/page-blocks/ModuleEditorPresentation.tsx", "artwork={contextualProps.artwork}", "artwork={undefined}"],
  ["src/components/admin/page-blocks/ModuleEditorPresentation.tsx", "icon={contextualProps.icon}", "icon={undefined}"],
  ["src/components/admin/page-blocks/ModuleEditorPresentation.tsx", "actions={contextualProps.actions}", "actions={undefined}"],
  ["src/components/admin/ui/AdminPageHeader.tsx", "visualPreset={visualPreset}", "visualPreset={undefined}"],
  ["src/components/admin/page-blocks/BlockEditorContextHeader.tsx", "visualPreset={visualPreset}", "visualPreset={undefined}"],
];
check("Header wrapper negatives reject dropped explicit artwork/icons or actions on direct and return-navigation branches", wrapperMutants.every(([file, before, after]) => {
  const source = read(file); assert.ok(source.includes(before));
  try { verifyHeaderWrapperForwarding({ [file]: source.replace(before, after) }); return false; } catch { return true; }
}));

function loadVisualManifest(source = read("src/lib/admin/interaction-system/adoption-manifest.ts")) {
  const commonJsModule = { exports: {} }, code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  Function("exports", "module", "require", code)(commonJsModule.exports, commonJsModule, dependency => { throw new Error(`Visual contract must not introduce a runtime manifest dependency: ${dependency}`); });
  return commonJsModule.exports;
}
function discoverHeaderVisualSites(sourceOverrides = {}, extraSources = {}) {
  const canonical = new Set(["AdminPageContextHeader", "AdminPageHeader", "BlockEditorContextHeader", "ModuleEditorHeader", "AdminPlaceholderPage"]), rows = [];
  const files = [...new Set([...collectSourceFiles(resolve(root, "src")).filter(file => file.endsWith(".tsx")).map(file => relative(root, file).replaceAll("\\", "/")), ...Object.keys(extraSources)])];
  for (const file of files) {
    const source = sourceOverrides[file] ?? extraSources[file] ?? read(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), aliases = new Map();
    for (const statement of ast.statements) if (ts.isImportDeclaration(statement) && statement.importClause && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause, target = statement.moduleSpecifier.text.split("/").at(-1);
      if (clause.name && canonical.has(target)) aliases.set(clause.name.text, target);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const binding of clause.namedBindings.elements) if (canonical.has((binding.propertyName ?? binding.name).text)) aliases.set(binding.name.text, (binding.propertyName ?? binding.name).text);
    }
    const mounts = [];
    const visit = node => { if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const component = aliases.get(node.tagName.getText(ast));
      if (component) mounts.push({ node, component, props: Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => [attribute.name.getText(ast), attribute.initializer])) });
    } ts.forEachChild(node, visit); };
    visit(ast); if (mounts.length) rows.push({ file, source, ast, mounts });
  }
  return rows;
}
function headerVisualConsumerContract({ manifest = loadVisualManifest(), sourceOverrides = {}, headerSource = pageHeader, extraSources = {} } = {}) {
  const contracts = [...manifest.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.flatMap(surface => [surface, ...surface.consumerAdoptionEvidence]), ...manifest.PRODUCT_SURFACE_IDENTITIES].flatMap(consumer => consumer.visualPresentation?.moduleHeaders ?? []);
  const boundaries = manifest.ADMIN_COLLECTION_SURFACE_ADOPTION.visualPresentation.sharedOwnerBoundaries;
  const declarations = [...contracts, ...boundaries], sites = discoverHeaderVisualSites(sourceOverrides, extraSources);
  assert.equal(new Set(declarations.map(contract => contract.sourceFile)).size, declarations.length, "A visual source binding has one canonical declaration");
  assert.deepEqual(declarations.map(contract => contract.sourceFile).sort(), sites.map(site => site.file).sort(), "Every actual Header JSX consumer must declare applicable visual atoms or a legitimate boundary; a new unclassified site fails closed");
  const Header = loadHeader(headerSource), elements = node => Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  const literalValues = node => !node ? [] : ts.isJsxExpression(node) ? literalValues(node.expression) : ts.isStringLiteral(node) ? [node.text] : ts.isParenthesizedExpression(node) ? literalValues(node.expression) : ts.isConditionalExpression(node) ? [...literalValues(node.whenTrue), ...literalValues(node.whenFalse)] : [];
  const moduleSource = sourceOverrides["src/components/admin/page-blocks/ModuleEditorPresentation.tsx"] ?? read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx"), moduleAst = ts.createSourceFile("ModuleEditorPresentation.tsx", moduleSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const moduleDeclaration = moduleAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ModuleEditorHeader");
  assert.ok(moduleDeclaration);
  const compiledModule = ts.transpileModule(moduleDeclaration.getText(moduleAst), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const Module = Function("exports", "require", "useSearchParams", "getModuleEditorHeaderMetadata", "resolveModuleEditorReturnNavigation", "MODULE_EDITOR_RETURN_PAGE_QUERY_PARAM", "AdminPageContextHeader", "BlockEditorContextHeader", compiledModule + ";return ModuleEditorHeader;")({}, () => jsxRuntime, () => new URLSearchParams(), () => ({ titleAr: "محرر", eyebrowAr: "سياق", descriptionAr: "وصف" }), () => null, "return_page", Header, Header);
  const allPresets = new Set();
  for (const site of sites) {
    const contract = declarations.find(contract => contract.sourceFile === site.file);
    if (contract.state === "not_applicable") {
      assert.ok(contract.rationale.length > 40 && /identity|module|navigation|route/iu.test(contract.rationale));
      for (const mount of site.mounts) assert.ok(!mount.props.visualPreset && !mount.props.icon && !mount.props.artwork, "Global utility N/A covers decoration only; it still uses the shared Header title/motion owner");
      continue;
    }
    if (contract.state === "delegated") {
      assert.ok(contract.rationale.length > 40); continue; // The real wrapper execution and mutation tests above protect these ports.
    }
    assert.equal(contract.state, "required"); assert.equal(contract.icon, "required"); assert.equal(contract.artwork, "required");
    const actualPresets = [];
    for (const mount of site.mounts) {
      if (mount.component === "ModuleEditorHeader") {
        let kinds = literalValues(mount.props.moduleKind);
        if (!kinds.length) {
          assert.equal(mount.props.moduleKind?.getText(site.ast), "{moduleProductKind}");
          assert.ok(site.source.includes('const moduleProductKind = resolveModuleProductKind("content", block.slug, block.variant)'));
          const resolverSource = read("src/lib/page-blocks/module-edit-registry.ts"), resolverAst = ts.createSourceFile("module-edit-registry.ts", resolverSource, ts.ScriptTarget.Latest, true), resolver = resolverAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "resolveModuleProductKind");
          const collectReturns = node => { if (ts.isReturnStatement(node) && node.expression) {
            if (ts.isStringLiteral(node.expression)) kinds.push(node.expression.text);
            else { assert.equal(node.expression.getText(resolverAst), "moduleKind"); kinds.push("content"); }
          } ts.forEachChild(node, collectReturns); }; collectReturns(resolver);
        }
        for (const kind of kinds) actualPresets.push(Module({ moduleKind: kind }).props.visualPreset);
      } else actualPresets.push(...literalValues(mount.props.visualPreset));
    }
    assert.deepEqual([...new Set(actualPresets)].sort(), [...contract.semanticPresets].sort(), `${site.file} adopts its declared semantic identity through every actual mount`);
    assert.ok(site.mounts.every(mount => mount.component === "ModuleEditorHeader" || literalValues(mount.props.visualPreset).length > 0), "Each direct applicable mount selects its presentation explicitly");
    for (const preset of contract.semanticPresets) {
      const tree = Header({ title: "عنوان عربي متصل", visualPreset: preset }), all = elements(tree);
      assert.equal(tree.props["data-admin-page-header-visual-preset"], preset);
      const icons = all.filter(node => Object.hasOwn(node.props, "data-admin-header-icon")), artwork = all.filter(node => Object.hasOwn(node.props, "data-admin-header-artwork"));
      assert.equal(icons.length, 1, `${preset} renders its required foreground icon`); assert.equal(artwork.length, 1, `${preset} renders its applicable artwork`);
      assert.equal(icons[0].props["aria-hidden"], "true"); assert.equal(artwork[0].props["aria-hidden"], "true");
      assert.ok(renderToStaticMarkup(icons[0]).includes("<svg"), "The real shared glyph owner supplies the icon");
      assert.ok(renderToStaticMarkup(artwork[0]).includes("<svg"), "The applicable shared scene is present even where Mobile policy hides Header background artwork");
      assert.ok(!elements(artwork[0]).some(node => ["button", "a", "text"].includes(node.type)), "Artwork contains no invented data or interaction");
      assert.equal(all.filter(node => node.type === "h1").length, 1); assert.equal(all.find(node => node.type === "h1").props.children, "عنوان عربي متصل");
      allPresets.add(preset);
    }
  }
  return { sites: sites.length, mounts: sites.reduce((count, site) => count + site.mounts.length, 0), presets: [...allPresets] };
}
const headerVisualContractResult = headerVisualConsumerContract();
check("Every actual Header JSX site reconciles to its existing consumer visual contract, with required semantic icons/artwork, delegated wrappers or explicit utility N/A", headerVisualContractResult.sites > 0 && headerVisualContractResult.mounts > 0, `${headerVisualContractResult.sites} source files / ${headerVisualContractResult.mounts} mounts / ${headerVisualContractResult.presets.length} semantic presets; source proof only`);
const incompleteHeaderManifest = loadVisualManifest();
const firstRequiredHeader = incompleteHeaderManifest.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(surface => surface.visualPresentation?.moduleHeaders?.length);
firstRequiredHeader.visualPresentation.moduleHeaders.pop();
const applicableHeaderSourceFile = headerVisualContractResult && loadVisualManifest().ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.flatMap(surface => surface.visualPresentation?.moduleHeaders ?? [])[0].sourceFile;
const applicableHeaderSource = read(applicableHeaderSourceFile);
const visualHeaderMutations = [
  { manifest: incompleteHeaderManifest },
  { extraSources: { "src/components/admin/UnclassifiedVisualHeaderProbe.tsx": 'import {AdminPageContextHeader} from "./ui";export default function Probe(){return <AdminPageContextHeader title="جديد"/>;}' } },
  { sourceOverrides: { [applicableHeaderSourceFile]: applicableHeaderSource.replace(/visualPreset="[^"]+"/u, "") } },
  { headerSource: pageHeader.replace('const resolvedIcon = icon ?? (visual ? <AdminModuleTabIcon name={visual.icon} /> : null);', 'const resolvedIcon = null;') },
  { headerSource: pageHeader.replace('const resolvedArtwork = artwork ?? visual?.artwork;', 'const resolvedArtwork = undefined;') },
];
check("Visual adoption negatives reject unclassified consumers, lost applicable preset/icon/artwork and a removed normative binding despite shared component adoption", visualHeaderMutations.every(input => { try { headerVisualConsumerContract(input); return false; } catch { return true; } }));

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
      // These geometry probes describe the default motion preference; the
      // existing Browser fixture separately exercises reduced motion.
      if (/^\(prefers-reduced-motion:/u.test(media.params)) return;
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

function loadOfficialAdminActionModule(source = read("src/components/admin/ui/AdminActionButton.tsx")) {
  const actionModule = { exports: {} };
  const tokens = loadAdminStyleTokens();
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  Function("exports", "module", "require", compiled)(actionModule.exports, actionModule, specifier => {
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "next/link") return { default: "a" };
    assert.equal(specifier, "../../../lib/admin/admin-ui-styles");
    return tokens;
  });
  return actionModule.exports;
}
function verifyOfficialAdminActionDefault(source) {
  const { default: Button, adminActionButtonClassName } = loadOfficialAdminActionModule(source);
  const tokens = loadAdminStyleTokens(), onClick = () => {}, buttonRef = { current: null };
  let cases = 0;
  for (const presentation of [undefined, "default", "cinematic"]) for (const variant of ["primary", "gold", "dark", "ghost", "gold-ghost", "danger", "danger-ghost"]) for (const transport of ["button", "link", "disabled-link"]) {
    const props = { children: "الإجراء الحقيقي", presentation, variant, href: transport === "button" ? undefined : "/admin/projects", disabled: transport === "disabled-link", type: "submit", form: "existing-form", onClick, buttonRef, target: "_blank", rel: "noopener noreferrer", prefetch: false, "aria-label": "إجراء حالي" };
    const tree = Button(props), classes = tree.props.className;
    assert.equal(tree.props["data-admin-action-presentation"], "cinematic");
    assert.equal(classes, Button({ ...props, presentation: "cinematic" }).props.className, "Default aliases retain the same official action presentation");
    if (variant === "primary") assert.ok(classes.includes(tokens.ADMIN_CINEMATIC_GOLD_V1.action.primary));
    else if (variant === "gold" || variant === "dark") assert.ok(classes.includes(tokens.ADMIN_CINEMATIC_GOLD_V1.action.secondary));
    else if (variant === "danger" || variant === "danger-ghost") assert.ok(classes.includes("text-red-400") && !classes.includes(tokens.ADMIN_CINEMATIC_GOLD_V1.action.primary), "Danger semantics never become Gold Primary");
    else if (variant === "gold-ghost") assert.ok(classes.includes("text-[#D8B87A]"));
    else assert.ok(classes.includes("text-white/50"));
    assert.equal(tree.props["aria-label"], props["aria-label"]);
    assert.equal(tree.props.children, props.children);
    assert.ok(classes.split(/\s+/u).includes("min-h-11"));
    assert.equal(classes, adminActionButtonClassName({ variant, disabled: props.disabled }), "The component and disabled non-button consumer share the same chrome owner");
    if (transport === "link") {
      assert.equal(tree.type, "a"); assert.equal(tree.props.href, props.href);
      for (const key of ["target", "rel", "prefetch"]) assert.equal(tree.props[key], props[key]);
    }
    else {
      assert.equal(tree.type, "button"); assert.equal(tree.props.disabled, props.disabled);
      assert.equal(tree.props.type, props.type); assert.equal(tree.props.form, props.form);
      assert.equal(tree.props.onClick, onClick); assert.equal(tree.props.ref, buttonRef);
      for (const key of ["target", "rel", "prefetch"]) assert.equal(tree.props[key], undefined, "Link-only attributes never leak into disabled/native buttons");
    }
    cases += 1;
  }
  return cases;
}
const sharedActionButton = read("src/components/admin/ui/AdminActionButton.tsx");
check("Official shared action defaults preserve Primary/Secondary, semantic danger/ghost, links, disabled submit/form/ref/callback contracts", verifyOfficialAdminActionDefault(sharedActionButton) === 63);
const officialActionMutants = [
  sharedActionButton.replace("resolveAdminCollectionPresentation(presentation)", "presentation"),
  sharedActionButton.replace("ADMIN_CINEMATIC_GOLD_V1.action.primary", "ADMIN_CINEMATIC_GOLD_V1.action.secondary"),
  sharedActionButton.replace('variant === "gold" || variant === "dark"', 'variant === "gold" || variant === "dark" || variant === "danger"'),
  sharedActionButton.replace("if (href && !disabled)", "if (href)"),
  sharedActionButton.replace('type = "button"', 'type = "reset"').replace("type={type}", 'type="reset"'),
  sharedActionButton.replace("form={form}", "form={undefined}"),
  sharedActionButton.replace("onClick={onClick}", "onClick={undefined}"),
  sharedActionButton.replace("prefetch={prefetch}", "prefetch={true}"),
  sharedActionButton.replace("target={target}", 'target="_self"'),
  sharedActionButton.replace("rel={rel}", "rel={undefined}"),
];
check("Official action negatives reject old aliases, lost Primary hierarchy, recolored Danger, enabled disabled links and changed submit/form/callback behavior", officialActionMutants.every(source => {
  if (source === sharedActionButton) return false;
  try { verifyOfficialAdminActionDefault(source); return false; } catch { return true; }
}));

function verifyCanonicalHeaderPreviewActions(source) {
  const loadPure = (file, dependencies = {}) => {
    const pureModule = { exports: {} };
    const compiled = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    Function("exports", "module", "require", compiled)(pureModule.exports, pureModule, specifier => {
      assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected Preview policy dependency ${specifier}`);
      return dependencies[specifier];
    });
    return pureModule.exports;
  };
  const safePaths = loadPure("src/lib/security/safe-internal-path.ts");
  const policy = loadPure("src/lib/admin/interaction-system/entity-preview-capability.ts", { "../../security/safe-internal-path": safePaths });
  const actionModule = loadOfficialAdminActionModule(), CompactAction = () => null;
  const previewModule = { exports: {} };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  Function("exports", "module", "require", compiled)(previewModule.exports, previewModule, specifier => {
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "../../../lib/admin/interaction-system/entity-preview-capability") return policy;
    if (specifier === "./AdminActionButton") return actionModule;
    assert.equal(specifier, "./AdminDataGrid"); return { AdminDataGridActionButton: CompactAction };
  });
  const Preview = previewModule.exports.default;
  const elements = node => Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  const base = { entityType: "project", entityId: 7, publicationStatus: "published", routes: { internalPreview: "/admin/projects/7/preview", publicView: "/projects/current" }, access: { "internal-preview": "allowed", "public-view": "allowed" } };
  const cases = [
    [base, 2], [{ ...base, publicationStatus: "draft" }, 1],
    [{ ...base, access: { "internal-preview": "disabled", "public-view": "allowed" } }, 2],
    [{ ...base, access: { "internal-preview": "allowed", "public-view": "disabled" } }, 2],
    [{ ...base, access: { "internal-preview": "hidden", "public-view": "hidden" } }, 0],
    [{ ...base, entityId: 0 }, 0],
    [{ ...base, routes: { internalPreview: "//unsafe.example/preview", publicView: "https://unsafe.example/current" } }, 0],
  ];
  let count = 0;
  for (const [capability, expectedCount] of cases) for (const presentation of [undefined, "default", "data-grid-compact"]) {
    const expected = policy.resolveAdminEntityPreviewActions(capability);
    assert.equal(expected.length, expectedCount);
    const tree = Preview({ capability, presentation });
    if (!expected.length) { assert.equal(tree, null); count += 1; continue; }
    const all = elements(tree);
    const rendered = all.filter(node => Object.hasOwn(node.props, "data-admin-entity-preview-action"));
    assert.equal(rendered.length, expected.length);
    expected.forEach((action, index) => {
      const node = rendered[index];
      assert.equal(node.props["data-admin-entity-preview-action"], action.kind);
      assert.equal(node.props["data-admin-entity-preview-action-state"], action.disabled ? "disabled" : "enabled");
      if (presentation === "data-grid-compact") {
        const compact = elements(node).find(element => element.type === CompactAction);
        assert.ok(compact); assert.equal(compact.props.href, action.href); assert.equal(compact.props.disabled, action.disabled);
        assert.equal(compact.props.target, "_blank"); assert.equal(compact.props.rel, "noopener noreferrer");
        assert.equal(compact.props.size, "compact");
      } else if (action.disabled) {
        assert.equal(node.type, "span"); assert.equal(node.props.role, "link"); assert.equal(node.props["aria-disabled"], "true");
        for (const key of ["href", "onClick", "onKeyDown", "tabIndex"]) assert.equal(node.props[key], undefined, "Disabled Preview spans gain no navigation or interaction");
        assert.equal(node.props.className, actionModule.adminActionButtonClassName({ disabled: true, variant: "dark" }));
      } else {
        assert.equal(node.type, actionModule.default, "Header Preview links use the canonical Action owner directly");
        const link = actionModule.default(node.props);
        assert.equal(link.type, "a"); assert.equal(link.props.href, action.href);
        assert.equal(link.props.target, "_blank"); assert.equal(link.props.rel, "noopener noreferrer"); assert.equal(link.props.prefetch, false);
        assert.equal(link.props["data-admin-entity-preview-action"], action.kind);
        assert.ok(link.props.className.includes(loadAdminStyleTokens().ADMIN_CINEMATIC_GOLD_V1.action.secondary));
      }
    });
    count += 1;
  }
  return count;
}
const canonicalHeaderPreview = read("src/components/admin/ui/AdminEntityPreviewActions.tsx");
check("Actual Preview owner retains published/hidden/disabled/safe-route rules, disabled span semantics, new-tab safety and compact owner while adopting canonical Header actions", verifyCanonicalHeaderPreviewActions(canonicalHeaderPreview) === 21);
const headerPreviewMutants = [
  canonicalHeaderPreview.replaceAll('target="_blank"', 'target="_self"'),
  canonicalHeaderPreview.replaceAll('rel="noopener noreferrer"', 'rel="opener"'),
  canonicalHeaderPreview.replace("prefetch={false}", "prefetch={true}"),
  canonicalHeaderPreview.replace('role="link"', 'role="button"'),
  canonicalHeaderPreview.replace('aria-disabled="true"', 'aria-disabled="false"'),
  canonicalHeaderPreview.replace('adminActionButtonClassName({ disabled: true, variant: "dark" })', '"old-preview-chrome"'),
  canonicalHeaderPreview.replace('role="link"', 'role="link" href={action.href}'),
];
check("Header Preview negatives reject unsafe new-tab attributes, prefetch drift, interactive or relabelled disabled spans and parallel old chrome", headerPreviewMutants.every(source => {
  if (source === canonicalHeaderPreview) return false;
  try { verifyCanonicalHeaderPreviewActions(source); return false; } catch { return true; }
}));

function verifyNativeHeaderActionAdoption(sourceOverrides = {}) {
  const consumers = [
    ["src/components/admin/AdminPlaceholderPage.tsx", 2],
    ["src/components/admin/integrations/AdminIntegrationsPlatform.tsx", 1],
    ["src/components/admin/integrations/IntegrationsServerConfiguration.tsx", 1],
    ["src/app/admin/error.tsx", 1], ["src/app/admin/not-found.tsx", 1],
    ["src/app/admin/content/topics/[id]/preview/page.tsx", 1], ["src/app/admin/projects/[id]/preview/page.tsx", 1],
  ];
  for (const [file, expectedCount] of consumers) {
    const source = sourceOverrides[file] ?? read(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const actionElements = [];
    function visit(node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ["AdminPageHeader", "AdminPageContextHeader"].includes(node.tagName.getText(ast))) {
        const attribute = node.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast) === "actions");
        if (attribute) {
          function action(child) {
            if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) actionElements.push(child);
            ts.forEachChild(child, action);
          }
          action(attribute);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(actionElements.filter(node => node.tagName.getText(ast) === "AdminActionButton").length, expectedCount, `${file} uses the canonical Header action owner`);
    assert.ok(!actionElements.some(node => ["Link", "a", "button"].includes(node.tagName.getText(ast))), `${file} keeps no parallel native Header button chrome`);
    if (file.endsWith("/error.tsx")) {
      const retry = actionElements.find(node => node.tagName.getText(ast) === "AdminActionButton");
      const callback = retry.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast) === "onClick");
      assert.equal(callback?.initializer?.getText(ast), "{retry}", "The route error action retains its existing retry callback");
    }
  }
  return consumers.length;
}
check("Placeholder, Integration, error/not-found and both internal Preview headers adopt canonical actions without local button chrome", verifyNativeHeaderActionAdoption() === 7);
check("Native Header action negatives reject restored local links/buttons and a lost existing retry callback", [
  ["src/components/admin/AdminPlaceholderPage.tsx", "<AdminActionButton", "<Link"],
  ["src/app/admin/error.tsx", "onClick={retry}", "onClick={undefined}"],
  ["src/components/admin/integrations/IntegrationsServerConfiguration.tsx", "<AdminActionButton href=", "<Link href="],
].every(([file, before, after]) => {
  const source = read(file); assert.ok(source.includes(before));
  try { verifyNativeHeaderActionAdoption({ [file]: source.replace(before, after) }); return false; } catch { return true; }
}));

function verifyReportHeaderActionContracts(source) {
  const reportModule = { exports: {} }, actionModule = loadOfficialAdminActionModule();
  let prints = 0;
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  Function("exports", "module", "require", "window", compiled)(reportModule.exports, reportModule, specifier => {
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    assert.equal(specifier, "../ui"); return { AdminActionButton: actionModule.default };
  }, { print: () => { prints += 1; } });
  const exportHref = "/admin/reports/export?report=system&filter=diagnostics&period=current";
  const tree = reportModule.exports.default({ exportHref });
  const actions = tree.props.children;
  assert.ok(Array.isArray(actions)); assert.equal(actions.length, 2);
  assert.ok(tree.props.className.includes("print:hidden"));
  for (const action of actions) assert.equal(action.type, actionModule.default);
  const csv = actionModule.default(actions[0].props), print = actionModule.default(actions[1].props);
  assert.equal(csv.type, "a"); assert.equal(csv.props.href, exportHref); assert.equal(csv.props.children.trim(), "تصدير CSV");
  assert.equal(print.type, "button"); assert.equal(print.props.type, "button"); assert.equal(print.props.children.trim(), "طباعة");
  print.props.onClick(); assert.equal(prints, 1, "The existing print callback still executes once without a domain mutation");
  return true;
}
const reportHeaderActions = read("src/components/admin/reports/AdminReportActions.tsx");
check("Existing report Header actions already use canonical presentation and retain exact CSV query/navigation and print-only callback contracts", verifyReportHeaderActionContracts(reportHeaderActions));
check("Report Header negatives reject changed CSV targets and a lost print callback", [
  reportHeaderActions.replace("href={exportHref}", 'href="/admin/reports"'),
  reportHeaderActions.replace("onClick={() => window.print()}", "onClick={() => undefined}"),
].every(source => {
  if (source === reportHeaderActions) return false;
  try { verifyReportHeaderActionContracts(source); return false; } catch { return true; }
}));

function verifyMetricIconPresentation(source) {
  const Metric = loadHeader(source), official = loadAdminStyleTokens().ADMIN_CINEMATIC_GOLD_V1.metric;
  const elements = node => Array.isArray(node) ? node.flatMap(elements)
    : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  const icon = React.createElement("svg", { "data-metric-test-glyph": "", viewBox: "0 0 24 24", strokeWidth: 1.5 });
  let cases = 0;
  for (const presentation of [undefined, "default", "cinematic"]) for (const compact of [false, true]) {
    const props = { label: "مؤشر اختبار", value: 0, suffix: "%", compact, icon, presentation };
    const officialMarkup = renderToStaticMarkup(React.createElement(Metric, { ...props, presentation: "cinematic" }));
    for (const iconSize of [undefined, "default", "prominent"]) {
      const tree = Metric({ ...props, iconSize, align: "start" });
      assert.equal(renderToStaticMarkup(tree), officialMarkup, "Omitted/default/current aliases and compatibility geometry ports use one official KPI presentation");
      assert.equal(tree.props["data-admin-metric-presentation"], "cinematic");
      assert.ok(tree.props.className.includes(official.surfaceClassName));
      const glyph = elements(tree).find(node => Object.hasOwn(node.props, "data-admin-metric-icon"));
      assert.ok(glyph, "The shared owner retains its semantic glyph slot");
      assert.equal(glyph.props["aria-hidden"], "true");
      assert.equal(glyph.props.children, icon, "Consumer glyph and authored stroke pass through unchanged");
      assert.equal(glyph.props.className, official.iconClassName);
      for (const width of [390, 1536]) {
        const css = layoutProperties(glyph.props.className, width);
        for (const property of ["width", "height"]) assert.equal(css[property], `calc(var(--spacing) * ${width < 1536 ? 9 : 12})`);
        assert.equal(css["flex-shrink"], "0");
        const svg = layoutProperties(glyph.props.className, width, "svg");
        for (const property of ["width", "height"]) assert.equal(svg[property], `calc(var(--spacing) * ${width < 1536 ? 6 : 7})`);
        assert.equal(svg["stroke-width"], undefined, "Official frame does not replace authored semantic strokes");
        const card = layoutProperties(tree.props.className, width);
        assert.equal(card["min-height"], "132px");
        assert.equal(card.padding, "calc(var(--spacing) * 3)");
        cases += 1;
      }
      const markup = renderToStaticMarkup(tree);
      assert.match(markup, /0.*%/u); assert.match(markup, /مؤشر اختبار/u);
      assert.equal(tree.type, "div"); assert.equal(tree.props.tabIndex, undefined); assert.equal(tree.props.onClick, undefined); assert.equal(tree.props["aria-pressed"], undefined);
      assert.equal(elements(tree).filter(node => Object.hasOwn(node.props, "data-admin-metric-artwork")).length, 0, "No invented artwork for existing consumers");
    }
    const onClick = () => {};
    const button = Metric({ ...props, onClick, active: true, ariaLabel: "فتح تفاصيل المؤشر" });
    assert.equal(button.type, "button"); assert.equal(button.props.type, "button"); assert.equal(button.props.onClick, onClick); assert.equal(button.props["aria-pressed"], true); assert.equal(button.props["aria-label"], "فتح تفاصيل المؤشر");
    assert.ok(button.props.className.includes(official.activeClassName));
  }
  return cases;
}
const metricCard = read("src/components/admin/ui/AdminMetricCard.tsx");
const presentationScripts = JSON.parse(read("package.json")).scripts;
check("Cinematic browser regression remains reachable from the existing Shell guard and awaited bounded runner", presentationScripts["qa:cinematic-admin"] === "node scripts/qa-home-story-presentation.mjs --cinematic-admin-only" && presentationScripts["verify:admin-shell-system"] === "node scripts/verify-admin-shell-system.mjs && npm run qa:cinematic-admin" && read("scripts/qa-home-story-presentation.mjs").includes("await verifyCinematicAdminPresentation();") && read("scripts/fixtures/cinematic-admin-browser.mjs").includes("await verifyRefinements();") && read("scripts/fixtures/cinematic-admin-browser.mjs").includes("--cinematic-v11-only"));
check("Existing Admin Runtime CI path also awaits Sidebar selection, system-wide adoption, official KPI and Module title/visual Browser deltas", read("scripts/qa-home-story-presentation.mjs").includes("await verifyCinematicAdminPresentation({ sidebarSelectionOnly: true });") && read("scripts/qa-home-story-presentation.mjs").includes("await verifyCinematicAdminPresentation({ systemwideAdoptionOnly: true });") && read("scripts/qa-home-story-presentation.mjs").includes("await verifyCinematicAdminPresentation({ kpiAdoptionOnly: true });") && read("scripts/qa-home-story-presentation.mjs").includes("await verifyCinematicAdminPresentation({ moduleTitleShimmerOnly: true });") && read("scripts/fixtures/cinematic-admin-browser.mjs").includes("--cinematic-systemwide-adoption-only") && read("scripts/fixtures/cinematic-admin-browser.mjs").includes("--cinematic-kpi-adoption-only") && read("scripts/fixtures/cinematic-admin-browser.mjs").includes("--cinematic-module-title-shimmer-only") && read("scripts/fixtures/cinematic-admin-browser.mjs").includes("if (moduleTitleShimmerOnly) await verifyModuleTitleShimmer();"));
function cinematicMotionContract(source = read("src/app/globals.css")) {
  const css = postcss.parse(source), rules = [];
  css.walkRules(rule => rules.push(rule));
  const reduced = rule => rule.parent.type === "atrule" && rule.parent.name === "media" && rule.parent.params === "(prefers-reduced-motion: reduce)";
  const find = (selector, isReduced = false) => rules.find(rule => rule.selectors?.includes(selector) && reduced(rule) === isReduced);
  const value = (rule, property) => rule?.nodes.find(node => node.type === "decl" && node.prop === property)?.value;
  const edge = find(".admin-cinematic-edge::after"), active = find(".admin-cinematic-edge:is(:hover, :focus-within)::after");
  assert.equal(value(edge, "pointer-events"), "none"); assert.equal(value(edge, "mask-composite"), "exclude");
  assert.equal(value(active, "animation"), "admin-edge-trace 1.15s linear infinite"); assert.equal(value(active, "opacity"), "1");
  assert.equal(value(find(".admin-cinematic-metric"), "transition-duration"), "300ms");
  assert.equal(value(find(".admin-cinematic-metric:is(:hover, :focus-visible)"), "transform"), "translateY(-4px)");
  assert.equal(value(find(".admin-cinematic-edge:is(:hover, :focus-within)::after", true), "animation"), "none");
  assert.equal(value(find(".admin-cinematic-metric:is(:hover, :focus-visible)", true), "transform"), "none");
  assert.equal(value(find(".admin-cinematic-metric:is(:hover, :focus-visible)", true), "transition"), "none");
  const keyframes = [], properties = [];
  css.walkAtRules("keyframes", node => { if (node.params === "admin-edge-trace") keyframes.push(node); });
  css.walkAtRules("property", node => { if (node.params === "--admin-edge-angle") properties.push(node); });
  assert.equal(keyframes.length, 1, "Cinematic adopts the existing Admin edge keyframe without another animation owner");
  const target = keyframes[0].nodes.find(node => node.type === "rule" && node.selectors.includes("to"));
  assert.equal(value(target, "--admin-edge-angle"), "360deg", "The real border angle must advance through a full turn");
  assert.equal(properties.length, 1, "The original CSS angle remains registered for interpolation");
  assert.equal(value(properties[0], "syntax"), '"<angle>"');
  assert.equal(value(properties[0], "initial-value"), "0deg"); assert.equal(value(properties[0], "inherits"), "false");
  return true;
}
check("Cinematic shared motion adopts the original edge timing and KPI lift with keyboard and reduced-motion contracts", cinematicMotionContract());
const motionSource = read("src/app/globals.css");
const motionMutants = [
  motionSource.replace(".admin-cinematic-edge:is(:hover, :focus-within)::after", ".admin-cinematic-edge:hover::after"),
  motionSource.replace("animation: admin-edge-trace 1.15s linear infinite", "animation: admin-edge-trace 4s linear infinite"),
  motionSource.replace(/(\.admin-cinematic-metric:is\(:hover, :focus-visible\) \{\r?\n  transform:) translateY\(-4px\)/u, "$1 translateY(-1px)"),
  motionSource.replace(/    animation: none;(\r?\n)    transition: none;/u, "    animation: admin-edge-trace 1.15s linear infinite;$1    transition: none;"),
  motionSource.replace("@property --admin-edge-angle", "@property --fixture-unregistered-edge-angle"),
  motionSource.replace("to { --admin-edge-angle: 360deg; }", "to { --admin-edge-angle: 0deg; }"),
];
check("Cinematic motion negatives reject lost keyboard support, altered legacy timing/lift and animated reduced-motion", motionMutants.every(source => { if (source === motionSource) return false; try { cinematicMotionContract(source); return false; } catch { return true; } }));
function cinematicEntryMotionContract(source = motionSource) {
  const css = postcss.parse(source), rules = [];
  css.walkRules(rule => rules.push(rule));
  const scope = '.admin-cinematic-edge[data-admin-edge-motion="entry"]';
  const find = (selector, media = null) => rules.find(rule => rule.selectors?.includes(selector) && (media === null ? rule.parent.type !== "atrule" : rule.parent.type === "atrule" && rule.parent.name === "media" && rule.parent.params === media));
  const value = (rule, property) => rule?.nodes.find(node => node.type === "decl" && node.prop === property)?.value;
  const quiet = find(scope + "::after"), keyboard = find(scope + ":has(:focus-visible)::after"), pointer = find(scope + ":hover::after", "(prefers-reduced-motion: no-preference)");
  assert.equal(value(quiet, "animation"), "none", "Entry mode overrides retained pointer focus without an ambient trace");
  assert.equal(value(quiet, "opacity"), "0");
  assert.equal(value(keyboard, "opacity"), "0.42", "Keyboard focus gets a quiet static cue");
  assert.equal(value(keyboard, "animation"), undefined, "Keyboard focus inherits static entry-mode motion");
  assert.equal(value(pointer, "animation"), "admin-edge-trace 1.15s linear 1 both", "Pointer entry reuses one original cycle, holds the completed angle, and resets on exit");
  assert.equal(value(pointer, "opacity"), "1");
  assert.equal(find(scope + ":hover::after"), undefined, "The entry trace is unavailable outside no-preference media");
  const legacy = find(".admin-cinematic-edge:is(:hover, :focus-within)::after");
  assert.equal(value(legacy, "animation"), "admin-edge-trace 1.15s linear infinite", "System Header and KPI keep their existing continuous contract");
  assert.ok(rules.indexOf(quiet) > rules.indexOf(legacy), "The optional scoped behavior wins over general hover/focus");
  assert.equal(value(find(".admin-cinematic-edge:is(:hover, :focus-within)::after", "(prefers-reduced-motion: reduce)"), "animation"), "none");
  assert.equal(value(find(".admin-cinematic-edge:is(:hover, :focus-within)::after", "(prefers-reduced-motion: reduce)"), "transition"), "none");
  return true;
}
check("Optional Grid entry motion runs one original cycle, settles while hovered, keeps keyboard static and protects legacy/reduced motion", cinematicEntryMotionContract());
const entryMotionMutants = [
  motionSource.replace('animation: admin-edge-trace 1.15s linear 1 both', 'animation: admin-edge-trace 1.15s linear infinite'),
  motionSource.replace('animation: admin-edge-trace 1.15s linear 1 both', 'animation: admin-edge-trace 1.15s linear 1'),
  motionSource.replace('animation: admin-edge-trace 1.15s linear 1 both', 'animation: fixture-entry-trace 1.15s linear 1 both'),
  motionSource.replace('animation: admin-edge-trace 1.15s linear 1 both', 'animation: admin-edge-trace 4s linear 1 both'),
  motionSource.replace('.admin-cinematic-edge[data-admin-edge-motion="entry"]:hover::after', '.admin-cinematic-edge:hover::after'),
  motionSource.replace('.admin-cinematic-edge[data-admin-edge-motion="entry"]:has(:focus-visible)::after', '.admin-cinematic-edge[data-admin-edge-motion="entry"]:focus-within::after'),
  motionSource.replace('(prefers-reduced-motion: no-preference)', '(prefers-reduced-motion: reduce)'),
  motionSource.replace(/(\.admin-cinematic-edge\[data-admin-edge-motion="entry"\]::after \{\r?\n  opacity: 0;\r?\n  animation:) none;/u, '$1 admin-edge-trace 1.15s linear infinite;'),
];
check("Entry motion negatives reject looping, a missing held endpoint, parallel timing/engine, global leakage, pointer focus and reduced-motion activation", entryMotionMutants.every(source => { if (source === motionSource) return false; try { cinematicEntryMotionContract(source); return false; } catch { return true; } }));
function moduleTitleShimmerContract({ source = pageHeader, cssSource = motionSource, tokens = loadAdminStyleTokens() } = {}) {
  const Header = loadHeader(source, tokens), moduleStyles = tokens.ADMIN_CINEMATIC_GOLD_V1.module;
  assert.ok(!source.includes('"use client"') && !/\buse(?:State|Effect|LayoutEffect|Ref)\b/u.test(source), "The presentation stays CSS-owned without a title animation runtime");
  assert.ok(!moduleStyles.root.split(/\s+/u).includes("admin-cinematic-edge"), "Module frame no longer opts into rotating edge motion");
  assert.ok(!moduleStyles.dock.split(/\s+/u).includes("admin-cinematic-edge"), "Module action dock remains static");
  assert.equal(moduleStyles.root, "@container/admin-module relative isolate overflow-hidden rounded-[20px] border border-[rgba(216,176,104,0.025)] bg-[linear-gradient(110deg,#10100C_0%,#000810_45%,#090D12_100%)] px-4 py-3 shadow-[inset_0_2px_0_rgba(237,200,120,0.52),inset_0_5px_12px_rgba(216,176,104,0.045),0_9px_18px_rgba(0,0,0,0.48),0_24px_48px_rgba(0,0,0,0.56),0_18px_45px_rgba(216,176,104,0.105),0_36px_75px_rgba(216,176,104,0.055)] sm:px-5", "Floating Gold changes only the shared frame border and its six approved light/depth layers while retaining geometry and background");
  assert.equal(moduleStyles.ribbon.split(/\s+/u).filter(token => token === "opacity-70").length, 1, "Only the named decorative ribbon token gains 0.7 opacity");
  assert.equal(moduleStyles.ribbon.split(/\s+/u).filter(token => token !== "opacity-70").join(" "), "pointer-events-none absolute inset-0 -z-10 size-full text-[#EDC878]/50 [mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]", "Ribbon geometry, color, mask and interaction stay unchanged");
  assert.equal(moduleStyles.title, "mt-2 break-words text-[26px] font-bold leading-tight text-[#F6F7FA] sm:text-[32px]", "Title typography and dimensions retain their pre-shimmer tokens");
  assert.ok(tokens.ADMIN_CINEMATIC_GOLD_V1.system.root.split(/\s+/u).includes("admin-cinematic-edge"), "System Header retains its original edge opt-in");
  assert.ok(tokens.ADMIN_CINEMATIC_GOLD_V1.metric.surfaceClassName.split(/\s+/u).includes("admin-cinematic-edge"), "KPI retains its original edge opt-in");
  const elements = node => Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  let cases = 0;
  for (const variant of ["default", "minimal"]) for (const presentation of [undefined, "default", "cinematic"]) for (const status of ["ready", "loading", "error", "empty", "under-construction"]) {
    const title = React.createElement("span", { lang: "ar" }, "عنوان عربي متصل"), action = React.createElement("button", { type: "button" }, React.createElement("svg", { "data-fixture-action-icon": true }), "إجراء قائم");
    const tree = Header({ title, actions: action, icon: React.createElement("svg", { "data-fixture-header-icon": true }), artwork: "document", variant, presentation, status }), all = elements(tree);
    const ribbons = all.filter(node => Object.hasOwn(node.props, "data-admin-header-background-lines"));
    assert.equal(ribbons.length, 1, "One decorative background ribbon owns the hook; foreground, artwork and action SVGs never inherit it");
    const ribbon = ribbons[0];
    assert.equal(ribbon.type, "svg"); assert.equal(ribbon.props["data-admin-header-background-lines"], true); assert.ok((Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children]).includes(ribbon), "The background-lines hook belongs only to the root's direct decorative SVG");
    assert.equal(ribbon.props.className, moduleStyles.ribbon); assert.equal(ribbon.props["aria-hidden"], "true"); assert.equal(ribbon.props.focusable, "false");
    assert.equal(ribbon.props.viewBox, "0 0 1200 180"); assert.equal(ribbon.props.preserveAspectRatio, "none");
    const paths = React.Children.toArray(ribbon.props.children);
    assert.deepEqual(paths.map(node => [node.type, node.props.d, node.props.strokeWidth, node.props.opacity]), [["path", "M-40 175C220 225 270 80 540 112S840 218 1240 145", "1.1", undefined], ["path", "M80 190C350 175 380 50 610 115S900 195 1180 172", "0.65", ".55"], ["path", "M275 185C450 90 550 105 720 160S950 215 1240 140", "5", ".035"]], "Existing ribbon shapes and internal opacities remain intact");
    assert.ok(all.filter(node => node.type === "svg" && node !== ribbon).length >= 3, "Foreground icon, artwork and action SVGs remain separate from the decorative ribbon");
    const headings = all.filter(node => node.type === "h1"), docks = all.filter(node => Object.hasOwn(node.props, "data-admin-page-header-actions-dock"));
    assert.equal(headings.length, 1); assert.equal(headings[0].props.children, title, "One unchanged title node preserves Arabic shaping and accessible text");
    assert.ok(Object.hasOwn(headings[0].props, "data-admin-page-header-title"));
    assert.equal(headings[0].props["aria-label"], undefined); assert.equal(headings[0].props["data-text"], undefined);
    assert.equal(headings[0].props.className, moduleStyles.title);
    assert.equal(docks.length, 1); assert.equal(all.filter(node => node === action).length, 1);
    assert.equal(tree.props["data-admin-page-header-status"], status); assert.equal(tree.props["data-admin-page-header-variant"], variant);
    assert.equal(tree.props["data-admin-page-header-presentation"], "cinematic");
    cases += 1;
  }
  const css = postcss.parse(cssSource), rules = [];
  css.walkRules(rule => rules.push(rule));
  const selector = "[data-admin-page-header] [data-admin-page-header-title]";
  const media = rule => { for (let parent = rule.parent; parent; parent = parent.parent) if (parent.type === "atrule" && parent.name === "media") return parent.params; return null; };
  const find = (target, preference = null) => rules.find(rule => rule.selectors?.includes(target) && media(rule) === preference);
  const value = (rule, property) => rule?.nodes.find(node => node.type === "decl" && node.prop === property)?.value;
  assert.equal(value(find(selector), "color"), "#F6F7FA", "Unsupported animation environments retain the approved fixed silver-white title");
  const animated = find(selector, "(prefers-reduced-motion: no-preference)"), reduced = find(selector, "(prefers-reduced-motion: reduce)");
  assert.equal(animated?.parent.name, "supports"); assert.equal(animated?.parent.params, "((background-clip: text) or (-webkit-background-clip: text))");
  assert.equal(value(animated, "animation"), "admin-module-title-shimmer 2.8s linear infinite");
  assert.equal(value(animated, "background-size"), "300% 100%"); assert.equal(value(animated, "background-position"), "0% 50%");
  assert.equal(value(animated, "background-repeat"), "no-repeat");
  assert.equal(value(animated, "background-image")?.replace(/\s+/gu, " "), "repeating-linear-gradient( 90deg, #F6F7FA 0%, #F6F7FA 4%, #D8B068 27%, #FFF3BE 33.333333%, #D8B068 39.666667%, #F6F7FA 62.666667%, #F6F7FA 66.666667% )", "The warm/highlight/silver period joins the two-title-width RTL travel without a white-only hold");
  for (const property of ["background-clip", "-webkit-background-clip"]) assert.equal(value(animated, property), "text");
  for (const property of ["color", "-webkit-text-fill-color"]) assert.equal(value(animated, property), "transparent");
  assert.equal(value(reduced, "animation"), "none"); assert.equal(value(reduced, "background-image"), "none");
  for (const property of ["color", "-webkit-text-fill-color"]) assert.equal(value(reduced, property), "#F6F7FA");
  const allowedProperties = new Set(["color", "background-image", "background-size", "background-position", "background-repeat", "-webkit-background-clip", "background-clip", "-webkit-text-fill-color", "animation"]);
  for (const rule of rules.filter(rule => rule.selectors?.includes(selector))) for (const node of rule.nodes) if (node.type === "decl") assert.ok(allowedProperties.has(node.prop), "Shimmer adds no title geometry, letter spacing or font overrides");
  const keyframes = [];
  css.walkAtRules("keyframes", rule => { if (rule.params === "admin-module-title-shimmer") keyframes.push(rule); });
  assert.equal(keyframes.length, 1); assert.equal(keyframes[0].nodes.length, 2);
  assert.equal(value(keyframes[0].nodes.find(rule => rule.selector === "from"), "background-position"), "0% 50%");
  assert.equal(value(keyframes[0].nodes.find(rule => rule.selector === "to"), "background-position"), "100% 50%", "A larger background moves physically right-to-left as position increases");
  const animatedDeclarations = [];
  css.walkDecls("animation", node => { if (node.value.includes("admin-module-title-shimmer")) animatedDeclarations.push(node); });
  assert.equal(animatedDeclarations.length, 1); assert.equal(animatedDeclarations[0].parent.selector, selector, "Title motion cannot leak into System Header, KPI, DataGrid or Sidebar");
  for (const target of ["[data-admin-page-header]::after", "[data-admin-page-header]:is(:hover, :focus-within)::after", "[data-admin-page-header] [data-admin-page-header-actions-dock]::after", "[data-admin-page-header] [data-admin-page-header-actions-dock]:is(:hover, :focus-within)::after"]) {
    assert.equal(value(find(target), "content"), "none"); assert.equal(value(find(target), "animation"), "none", "Module frame and dock stay static in pointer and keyboard states");
  }
  return cases;
}
check("Module Header shimmer covers all aliases/states with one unchanged title, static gold frame/dock, bounded RTL colors and fixed reduced-motion text", moduleTitleShimmerContract() === 30);
const shimmerCssMutations = [
  ['admin-module-title-shimmer 2.8s linear infinite', 'admin-module-title-shimmer 4s linear infinite'],
  ['admin-module-title-shimmer 2.8s linear infinite', 'admin-module-title-shimmer 2.8s ease infinite'],
  ['admin-module-title-shimmer 2.8s linear infinite', 'admin-module-title-shimmer 2.8s linear 1'],
  ['background-size: 300% 100%', 'background-size: 200% 100%'],
  ['to { background-position: 100% 50%; }', 'to { background-position: -100% 50%; }'],
  ['#D8B068 27%', '#F6F7FA 27%'],
  ['#FFF3BE 33.333333%', '#FFFFFF 33.333333%'],
  ['#F6F7FA 66.666667%', '#F6F7FA 90%'],
  ['-webkit-text-fill-color: transparent;', '-webkit-text-fill-color: #F6F7FA;'],
  ['@supports ((background-clip: text) or (-webkit-background-clip: text))', '@supports (display: grid)'],
].map(([before, after]) => { assert.ok(motionSource.includes(before), `Shimmer negative mutation remains reachable: ${before}`); return { cssSource: motionSource.replace(before, after) }; });
shimmerCssMutations.push({ cssSource: motionSource.replace(/(\[data-admin-page-header\] \[data-admin-page-header-actions-dock\]:is\(:hover, :focus-within\)::after \{\r?\n  content:) none;/u, '$1 "";') });
shimmerCssMutations.push({ cssSource: motionSource.replaceAll("[data-admin-page-header] [data-admin-page-header-title]", "[data-admin-page-header-title]") });
shimmerCssMutations.push({ cssSource: motionSource.replace(/(\[data-admin-page-header\] \[data-admin-page-header-title\] \{\r?\n    animation:) none;/u, "$1 admin-module-title-shimmer 2.8s linear infinite;") });
shimmerCssMutations.push({ cssSource: motionSource.replace("background-size: 300% 100%;", "background-size: 300% 100%;\n      letter-spacing: 1px;") });
const shimmerMutations = [
  ...shimmerCssMutations,
  { source: pageHeader.replace("data-admin-page-header-title", "data-fixture-heading") },
  { source: pageHeader.replace("data-admin-page-header-actions-dock", "data-fixture-dock") },
  { source: pageHeader.replace("{title}", "{null}") },
  { source: pageHeader.replace("data-admin-header-background-lines", "data-fixture-background-lines") },
  { source: pageHeader.replace('viewBox="0 0 320 180"', 'data-admin-header-background-lines viewBox="0 0 320 180"') },
  { source: pageHeader.replace('strokeWidth="0.65" opacity=".55"', 'strokeWidth="0.65" opacity=".7"') },
  ...["border-[rgba(216,176,104,0.025)]", "inset_0_2px_0_rgba(237,200,120,0.52)", "inset_0_5px_12px_rgba(216,176,104,0.045)", "0_9px_18px_rgba(0,0,0,0.48)", "0_24px_48px_rgba(0,0,0,0.56)", "0_18px_45px_rgba(216,176,104,0.105)", "0_36px_75px_rgba(216,176,104,0.055)"].map(value => { const tokens = loadAdminStyleTokens(); assert.ok(tokens.ADMIN_CINEMATIC_GOLD_V1.module.root.includes(value), "Floating Gold negative remains reachable: " + value); tokens.ADMIN_CINEMATIC_GOLD_V1.module.root = tokens.ADMIN_CINEMATIC_GOLD_V1.module.root.replace(value, value.replace(/0\.(\d+)/u, "0.9")); return { tokens }; }),
  ...["opacity-70", "opacity-70 opacity-50"].map(value => { const tokens = loadAdminStyleTokens(); tokens.ADMIN_CINEMATIC_GOLD_V1.module.ribbon = tokens.ADMIN_CINEMATIC_GOLD_V1.module.ribbon.replace("opacity-70", value === "opacity-70" ? "opacity-50" : value); return { tokens }; }),
  ...["root", "dock"].map(key => { const tokens = loadAdminStyleTokens(); tokens.ADMIN_CINEMATIC_GOLD_V1.module[key] = `admin-cinematic-edge ${tokens.ADMIN_CINEMATIC_GOLD_V1.module[key]}`; return { tokens }; }),
];
check("Module shimmer negatives reject legacy rotating frames, changed typography/content, global leakage, wrong timing/direction/colors/seam and animated reduced motion", shimmerMutations.every(input => { try { moduleTitleShimmerContract(input); return false; } catch { return true; } }));
check("Final alignment remains an isolated awaited branch of the existing runner and fixture", read("scripts/qa-home-story-presentation.mjs").includes("--cinematic-final-alignment-only") && read("scripts/fixtures/cinematic-admin-browser.mjs").includes("if (finalAlignmentOnly) await verifyFinalAlignment();") && read("scripts/fixtures/cinematic-admin-browser.mjs").includes("assert.equal(finalAlignmentOnly, false, 'The final alignment delta permits no preference or domain action transport')"));
check("Actual Metric Card normalizes omitted/default/current KPI presentation while preserving glyphs, values and static/interactive semantics", verifyMetricIconPresentation(metricCard) === 36);
const metricMutants = [
  metricCard.replace("resolveAdminCollectionPresentation(presentation)", "presentation"),
  metricCard.replace('data-admin-metric-presentation="cinematic"', 'data-admin-metric-presentation="default"'),
  metricCard.replace('cinematic.surfaceClassName,', '"min-h-[80px]",'),
  metricCard.replace('className={cinematic.iconClassName}', 'className="size-5"'),
  metricCard.replace('{icon}', '{null}'),
  metricCard.replaceAll('aria-hidden="true"', 'aria-hidden="false"'),
  metricCard.replaceAll('"aria-pressed": active', '"aria-pressed": false'),
  metricCard.replace('onClick ? "button" : "div"', '"button"'),
];
check("KPI negatives reject legacy-default fallback, old geometry, lost glyphs/decorative semantics and fake static interaction", metricMutants.every(source => {
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
function dashboardHeaderAdoptionContract(source = dashboardView) {
  const ast = ts.createSourceFile("AdminDashboardView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), headers = [], definitions = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "AdminPageContextHeader") headers.push(node);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "quickActions") definitions.push(node.initializer.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(headers.length, 1); assert.equal(definitions.length, 1);
  const props = Object.fromEntries(headers[0].attributes.properties.filter(ts.isJsxAttribute).map(node => [node.name.getText(ast), node.initializer?.getText(ast)]));
  assert.equal(props.presentation, '"cinematic"'); assert.equal(props.actionsPresentation, '"cinematic"');
  assert.equal(props.title, '"لوحة التحكم"'); assert.equal(props.description, '"نظرة شاملة على المحتوى والمشاريع وحالة مصادر النظام."');
  assert.equal(props.artwork, '"statistics"', "Dashboard explicitly selects its native semantic artwork through the existing owner"); assert.equal(props.icon, '{<AdminModuleTabIcon name="statistics" />}');
  assert.ok(props.actions.includes("quickActions.map") && props.actions.includes("href={action.href}") && props.actions.includes("variant={action.variant}") && props.actions.includes("name={action.icon}"), "Existing action priority, icon and destination bindings remain canonical");
  const actions = Function('"use strict";return (' + definitions[0] + ');')();
  assert.deepEqual(actions.map(({ href, label, icon, variant }) => ({ href, label, icon, variant })), [
    { href: "/admin/content/topics/new", label: "موضوع جديد", icon: "content", variant: "primary" },
    { href: "/admin/content/categories/new", label: "تصنيف جديد", icon: "specifications", variant: "dark" },
    { href: "/admin/settings/general", label: "الإعدادات", icon: "settings", variant: "dark" },
  ]);
  return true;
}
check("Dashboard adopts the existing cinematic Module Header with suitable artwork while preserving its three functional actions", dashboardHeaderAdoptionContract());
const dashboardHeaderMutants = [
  dashboardView.replace(/presentation="cinematic"(\r?\n        icon=)/u, 'presentation="default"$1'),
  dashboardView.replace('name="statistics"', 'name="content"'),
  dashboardView.replace('artwork="statistics"', 'artwork="document"'),
  dashboardView.replace('artwork="statistics"', ''),
  dashboardView.replace('href: "/admin/content/categories/new"', 'href: "/admin/content/categories"'),
  dashboardView.replace('variant: "primary",', 'variant: "dark",'),
  dashboardView.replace('variant={action.variant}', 'variant="primary"'),
];
check("Dashboard adoption negatives reject default container drift, Topics artwork, changed destinations, lost priority and ignored action roles", dashboardHeaderMutants.every(source => { if (source === dashboardView) return false; try { dashboardHeaderAdoptionContract(source); return false; } catch { return true; } }));
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

function verifySidebarGlyphPresentation(source, sidebarTokens = loadAdminStyleTokens().ADMIN_SIDEBAR) {
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
      navigation, activeGroupIds: new Set(["glyph-group"]), activeRouteItem: navigation[0], openGroupId: null, compactGroupId: null,
      compactTriggerRef: { current: null }, compactPanelRef: { current: null }, compactMenuPosition: null,
      ADMIN_SIDEBAR: sidebarTokens, setCompactGroupState: value => groups.push(value), setMobileState() {}, pathname: "/admin/glyph-leaf", onNavigateStart() {},
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
    if (forceExpanded) {
      assert.equal(collapse, undefined, "The Mobile drawer retains its separate close control");
      const close = all.find(node => node.type === "button" && Object.hasOwn(node.props, "data-admin-drawer-close"));
      assert.ok(close && close.props["aria-label"] === "إغلاق قائمة الإدارة", "The drawer has a visible keyboard reachable close control");
    }
    else {
      assert.ok(collapse); assert.equal(collapse.props.type, "button"); assert.equal(collapse.props["aria-expanded"], !compact);
      const css = layoutProperties(collapse.props.className, 1536);
      assert.equal(css["font-size"], "var(--text-2xl)"); assert.equal(css["line-height"], "1");
      for (const dimension of ["width", "height"]) assert.equal(css[dimension], "calc(var(--spacing) * 9)");
      collapse.props.onClick(); assert.equal(toggles, 1, "Glyph refinement preserves the existing collapse handler");
    }
    const group = all.find(node => node.type === "button" && node.props["data-admin-nav-item"] === "glyph-group");
    assert.ok(group, "Both compact and expanded groups retain an explicit disclosure button");
    assert.equal(group.props["aria-expanded"], false);
    assert.equal(group.props["aria-controls"], `admin-nav-${forceExpanded ? "mobile" : "desktop"}-glyph-group`);
    if (compact) {
      assert.equal(group.props["aria-label"], navigation[1].label);
      const trigger = {};
      group.props.onClick({ currentTarget: trigger });
      assert.equal(bindings.compactTriggerRef.current, trigger);
    } else {
      const disclosure = elements(group).find(node => node.type === "span" && node.props.children === "⌄");
      assert.ok(disclosure);
      const css = layoutProperties(disclosure.props.className, 390);
      assert.equal(css["font-size"], "var(--text-base)"); assert.equal(css["line-height"], "1");
      group.props.onClick({ currentTarget: {} });
    }
    assert.deepEqual(groups, [{ pathname: bindings.pathname, id: "glyph-group" }]);
    const publicLink = all.find(node => node.type === Link && node.props.href === bindings.company.publicWebsiteUrl);
    assert.ok(publicLink);
    const publicGlyph = React.Children.toArray(publicLink.props.children).find(node => React.isValidElement(node) && node.type === "span");
    assert.ok(publicGlyph && typeof publicGlyph.props.children === "string");
    const css = layoutProperties(publicGlyph.props.className, 390);
    assert.equal(css["font-size"], "var(--text-xl)"); assert.equal(css["line-height"], "1");
    for (const dimension of ["width", "height"]) assert.equal(css[dimension], "calc(var(--spacing) * 8)");
    const leaf = all.find(node => node.type === Nav && node.props.href === navigation[0].href);
    assert.ok(leaf); assert.equal(leaf.props.onNavigateStart, bindings.onNavigateStart);
    assert.equal(leaf.props.active, true); assert.equal(leaf.props.itemId, navigation[0].id);
    assert.equal(tree.props["data-admin-sidebar-presentation"], "default-v2");
    assert.equal(tree.props["data-admin-sidebar-mode"], forceExpanded ? "drawer" : compact ? "collapsed" : "expanded");
    const closedPanel = all.find(node => node.props["data-admin-nav-submenu"] === "glyph-group");
    if (compact) assert.equal(closedPanel, undefined, "A closed compact group contributes no invisible navigation targets");
    else assert.equal(closedPanel?.props.hidden, true, "A closed expanded group removes its children from keyboard navigation");
    const openedBindings = { ...bindings, activeRouteItem: navigation[1].children[0], openGroupId: "glyph-group", compactGroupId: "glyph-group", compactMenuPosition: { style: { position: "fixed", top: 100, left: 100, width: 240, maxHeight: 420 } } };
    const renderOpened = Function("require", "exports", ...Object.keys(openedBindings), code + ";return renderSidebar;")(() => jsxRuntime, {}, ...Object.values(openedBindings));
    const opened = elements(renderOpened(forceExpanded));
    const openedPanel = opened.find(node => node.props["data-admin-nav-submenu"] === "glyph-group");
    const openedChild = opened.find(node => node.type === Nav && node.props.href === navigation[1].children[0].href);
    assert.ok(openedPanel && openedChild, "Both Sidebar modes retain actual child destinations");
    assert.equal(openedPanel.props.hidden, false); assert.equal(openedChild.props.active, true);
    assert.equal(openedChild.props.child, true); assert.equal(openedChild.props.onNavigateStart, bindings.onNavigateStart);
    const openButton = opened.find(node => node.type === "button" && node.props["data-admin-nav-item"] === "glyph-group");
    assert.equal(openButton.props["aria-expanded"], true);
    openButton.props.onClick({ currentTarget: {} });
    assert.deepEqual(groups.at(-1), { pathname: bindings.pathname, id: null }, "Even an active group can close without losing its navigation state");
    cases += 1;
  }
  return cases;
}
check("Actual Sidebar v2 retains Unicode ownership, 36px frames, current-page identity and accessible group controls in all modes", verifySidebarGlyphPresentation(shell) === 4);
const sidebarTokenDefaults = loadAdminStyleTokens().ADMIN_SIDEBAR;
const sidebarGlyphMutants = [
  { tokens: { ...sidebarTokenDefaults, icon: sidebarTokenDefaults.icon.replace("text-[28px]", "text-base") } },
  { tokens: { ...sidebarTokenDefaults, icon: sidebarTokenDefaults.icon.replace("size-9", "size-7") } },
  { source: shell.replaceAll("{item.icon}", '{"replacement"}') },
  { tokens: { ...sidebarTokenDefaults, toggle: sidebarTokenDefaults.toggle.replace("text-2xl", "text-sm") } },
  { tokens: { ...sidebarTokenDefaults, chevron: sidebarTokenDefaults.chevron.replace("text-base", "text-xs") } },
  { tokens: { ...sidebarTokenDefaults, publicIcon: sidebarTokenDefaults.publicIcon.replace("text-xl", "text-sm") } },
  { source: shell.replace('aria-controls={panelId}', 'aria-controls={undefined}') },
  { source: shell.replace('active={activeRouteItem?.id === item.id}', 'active={false}') },
  { source: shell.replace('openGroupId === item.id;', 'openGroupId === item.id || active;') },
  { source: shell.replace('hidden={!open}', 'hidden={false}') },
  { source: shell.replace('const childActive = activeRouteItem?.id === child.id;', 'const childActive = false;') },
];
check("Sidebar v2 negatives reject narrowed or undersized glyph/control tokens, replaced icons and inaccessible disclosure/current-page identity", sidebarGlyphMutants.every(({ source = shell, tokens = sidebarTokenDefaults }) => {
  try { verifySidebarGlyphPresentation(source, tokens); return false; } catch { return true; }
}));

function verifySidebarCurrentRoute(source) {
  const ast = ts.createSourceFile("AdminShell.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "activeRouteItem") initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(initializer);
  const loadPure = file => {
    const pureModule = { exports: {} };
    const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    Function("exports", "module", code)(pureModule.exports, pureModule);
    return pureModule.exports;
  };
  const { ADMIN_NAVIGATION_REGISTRY } = loadPure("src/config/admin/navigation.ts");
  const { resolveAdminNavigation, isAdminNavigationItemActive } = loadPure("src/lib/admin/shell/navigation.ts");
  const navigation = resolveAdminNavigation(ADMIN_NAVIGATION_REGISTRY);
  const current = Function("useMemo", "navigation", "pathname", "isAdminNavigationItemActive", `return (${initializer.getText(ast)});`);
  const cases = [
    ["/admin", "home"], ["/admin/content/topics", "topics"], ["/admin/media-library", "media-library"],
    ["/admin/projects", "projects-all"], ["/admin/projects/locations", "project-locations"],
    ["/admin/projects/construction-updates/123", "construction-updates"], ["/admin/reports/content", "reports-content"],
    ["/admin/settings/general", "settings-general"],
  ];
  for (const [pathname, id] of cases) {
    assert.equal(current(callback => callback(), navigation, pathname, isAdminNavigationItemActive)?.id, id, `Current route uses the most specific registered child at ${pathname}`);
  }
  return cases.length;
}
check("Sidebar current-page resolution prefers the actual child on shared landing URLs and the longest matching project/report path", verifySidebarCurrentRoute(shell) === 8);
const sidebarRouteMutants = [
  shell.replace(/\.\.\.\(item\.children \?\? \[\]\),\r?\n      item,/u, 'item,\n      ...(item.children ?? []),'),
  shell.replace('right.href.length - left.href.length', 'left.href.length - right.href.length'),
  shell.replace('...(item.children ?? []),', ''),
  shell.replace('isAdminNavigationItemActive(pathname, { ...item, children: undefined })', 'isAdminNavigationItemActive(pathname, item)'),
];
check("Sidebar route negatives reject parent tie wins, short-prefix selection and missing submenu routes", sidebarRouteMutants.every(source => {
  if (source === shell) return false;
  try { verifySidebarCurrentRoute(source); return false; } catch { return true; }
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
  const bindings = { collapsed: false, company: { name: "اختبار", cmsLabel: "ADMIN", publicWebsiteUrl: "/" }, navigation: [], activeGroupIds: new Set(), activeRouteItem: null, openGroupId: null, compactGroupId: null, compactTriggerRef: { current: null }, compactPanelRef: { current: null }, compactMenuPosition: null, ADMIN_SIDEBAR: loadAdminStyleTokens().ADMIN_SIDEBAR, pathname: "/admin/content/topics", onNavigateStart() {}, toggleCollapsed() {}, setGroupOverride() {}, setCompactGroupState() {}, setMobileState() {}, CompanyMark: () => null, Link: () => null, AdminNavLink: () => null, VENESIA_SCROLLBAR_VISUAL_CLASSES: "venesia-scrollbar" };
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
  assert.equal(desktop.wrapper.display, "flex", "The Desktop wrapper stretches its existing Sidebar through the document height");
  assert.equal(desktop.wrapper["align-self"], "stretch", "The Desktop rail fills the actual shared flex-row height");
  assert.ok(!desktop.wrapper["align-items"] || desktop.wrapper["align-items"] === "stretch", "The existing Aside stretches inside its wrapper");
  assert.equal(desktop.wrapper["background-color"], "transparent", "The Desktop sidebar keeps its existing transparent composition");
  assert.equal(desktop.aside["background-color"], undefined, "Sidebar surface is painted by its existing CSS owner, without a conflicting transparent utility");
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
function dockLayout(source, styleTokens = loadAdminStyleTokens()) {
  const Header = loadHeader(source, styleTokens);
  const action = React.createElement("button", { type: "button" }, "إجراء");
  function pathTo(node, target, path = []) {
    if (Array.isArray(node)) return node.map(child => pathTo(child, target, path)).find(Boolean);
    if (!React.isValidElement(node)) return null;
    const next = [...path, node];
    return node === target ? next : pathTo(node.props.children, target, next);
  }
  const path = pathTo(Header({ title: "العنوان", actions: action }), action);
  assert.ok(path && path.length >= 3);
  const dock = path.at(-2);
  assert.equal(dock.props.role, "region");
  assert.equal(dock.props["aria-label"], "إجراءات الصفحة وبياناتها");
  assert.equal(dock.props.tabIndex, 0, "Bounded action overflow remains keyboard reachable");
  assert.ok(dock.props.className.split(/\s+/u).includes("venesia-scrollbar"));
  const baseClasses = classes => classes.split(/\s+/u).filter(token => !token.startsWith("@")).join(" ");
  const results = [];
  for (const width of [320, 390, 768, 1440, 1536]) {
    // Container-query layout depends on real content width, not viewport width;
    // the Browser proof owns those transitions. Probe its shared base geometry.
    const inner = layoutProperties(baseClasses(dock.props.className), width);
    const outer = layoutProperties(baseClasses(path.at(-3).props.className), width);
    const actions = layoutProperties(baseClasses(dock.props.className), width, "*");
    const frame = layoutProperties(baseClasses(path.at(-4).props.className), width);
    const title = path.at(-4).props.children[0];
    const titleLayout = layoutProperties(baseClasses(title.props.className), width);
    assert.equal(inner.width, "fit-content", "Official action dock must use content width");
    assert.equal(inner["max-width"], "100%");
    assert.equal(inner["flex-wrap"], "wrap", "The approved cinematic dock exposes actions through natural wrapping");
    assert.equal(inner["overflow-x"], "auto", "Only actual excess action width scrolls");
    assert.equal(inner["overscroll-behavior-x"], "contain");
    assert.equal(actions["max-width"], "100%", "Controls remain bounded by the actual dock");
    assert.equal(inner.gap, "calc(var(--spacing) * 2)");
    assert.equal(inner.padding, "calc(var(--spacing) * 2)");
    assert.equal(outer.width, undefined, "The dock wrapper must not fill a false fixed action budget");
    assert.equal(outer["flex-basis"], undefined, "The dock wrapper keeps its natural action budget");
    assert.equal(outer["max-width"], "100%");
    assert.equal(outer["margin-inline-start"], "auto", "The bounded outer dock aligns externally left in RTL");
    assert.equal(frame["flex-direction"], "column", "The official narrow composition places bounded actions below the identity");
    assert.equal(titleLayout["min-width"], "calc(var(--spacing) * 0)", "The identity remains shrinkable without clipping its content");
    results.push({ width, inner, outer, actions });
  }
  return results;
}
check("Compiled actual Sidebar v2 stretches through normal Desktop document flow and keeps bounded opaque Mobile scrolling", Boolean(sidebarLayout(shell)));
const sidebarMutants = [
  shell.replace('className="hidden shrink-0 self-stretch bg-transparent lg:flex"', 'className="hidden shrink-0 self-stretch bg-transparent lg:flex [position:sticky] [height:100vh]"'),
  shell.replace('className="hidden shrink-0 self-stretch bg-transparent lg:flex"', 'className="hidden shrink-0 self-start bg-transparent lg:flex"'),
  shell.replace('className="hidden shrink-0 self-stretch bg-transparent lg:flex"', 'className="hidden shrink-0 self-stretch bg-transparent lg:block"'),
  shell.replace('forceExpanded ? "h-full" : "min-h-screen"', 'forceExpanded ? "h-full" : "[height:100vh] min-h-screen"'),
  shell.replace('forceExpanded ? "min-h-0 overflow-y-auto " : ""', 'forceExpanded ? "min-h-0 overflow-y-auto " : "[overflow-y:auto] "'),
  shell.replace('forceExpanded ? "min-h-0 overflow-y-auto " : ""', 'forceExpanded ? "[overflow-y:visible] " : ""'),
  shell.replace('className="absolute right-0 top-0 h-full bg-[var(--admin-surface)]"', 'className="absolute right-0 top-0 h-full"'),
  shell.replace('className="absolute right-0 top-0 h-full bg-[var(--admin-surface)]"', 'className="absolute right-0 top-0 h-full bg-transparent"'),
];
check("Equivalent-property negatives reject desktop sticky/viewport/nav scrolling, lost Mobile scroll and missing or transparent drawer fill", sidebarMutants.every(source => {
  if (source === shell) return false;
  try { sidebarLayout(source); return false; } catch { return true; }
}));
check("Official Module Header preserves content-width RTL action alignment, native overflow, wrapping, control bounds and approved spacing", dockLayout(pageHeader).length === 5);
const dockStyleTokens = loadAdminStyleTokens();
const mutateModuleDock = replace => ({ ...dockStyleTokens, ADMIN_CINEMATIC_GOLD_V1: { ...dockStyleTokens.ADMIN_CINEMATIC_GOLD_V1, module: { ...dockStyleTokens.ADMIN_CINEMATIC_GOLD_V1.module, dock: replace(dockStyleTokens.ADMIN_CINEMATIC_GOLD_V1.module.dock) } } });
const dockMutants = [
  { tokens: mutateModuleDock(value => value.replace("w-fit", "w-full")) },
  { tokens: mutateModuleDock(value => value.replace("w-fit", "w-fit [width:100%]!")) },
  { tokens: mutateModuleDock(value => value.replace("flex-wrap", "flex-nowrap")) },
  { tokens: mutateModuleDock(value => value.replace("overflow-x-auto", "overflow-x-hidden")) },
  { tokens: mutateModuleDock(value => value.replace("overscroll-x-contain", "overscroll-x-auto")) },
  { tokens: mutateModuleDock(value => value.replace("[&>*]:max-w-full", "[&>*]:max-w-none")) },
  { source: pageHeader.replace("${ADMIN_SCROLLBAR_VISUAL_CLASSES}", "") },
  { source: pageHeader.replace('className="ms-auto min-w-0 max-w-full', 'className="me-auto min-w-0 max-w-full') },
  { source: pageHeader.replace('className="ms-auto min-w-0 max-w-full', 'className="ms-auto w-full min-w-0 max-w-full') },
  { source: pageHeader.replace('className="ms-auto min-w-0 max-w-full', 'className="ms-auto basis-96 min-w-0 max-w-full') },
  { source: pageHeader.replace('role={minimal ? undefined : "region"}', "role={undefined}") },
  { source: pageHeader.replace('aria-label={minimal ? undefined : "إجراءات الصفحة وبياناتها"}', "aria-label={undefined}") },
  { source: pageHeader.replace("tabIndex={minimal ? undefined : 0}", "tabIndex={undefined}") },
];
check("Official Header negatives reject filled or clipped docks, lost wrapping/bounds/scrollbars/accessibility and wrong RTL or fixed action budgets", dockMutants.every(({ source = pageHeader, tokens = dockStyleTokens }) => {
  try { dockLayout(source, tokens); return false; } catch { return true; }
}));

const headerActionGroupSources = [
  "src/components/admin/projects/tracking/TrackingCollections.tsx",
  "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
  "src/app/admin/projects/residential/page.tsx",
  "src/app/admin/projects/commercial/page.tsx",
].map(sourceFile => ({ sourceFile, source: read(sourceFile) }));
function headerActionGroups(source) {
  const ast = ts.createSourceFile("header-actions.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const groups = [];
  function visit(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ["AdminPageContextHeader", "AdminPageHeader"].includes(node.tagName.getText(ast))) {
      const actions = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "actions");
      if (actions) {
        assert.ok(actions.initializer && ts.isJsxExpression(actions.initializer) && actions.initializer.expression && ts.isJsxFragment(actions.initializer.expression), "Qualified action groups delegate row ownership to the shared Header instead of a local wrapping container");
        groups.push(actions.initializer.expression);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(groups.length > 0, "Each affected consumer retains its Header actions");
  return { ast, groups };
}
check("All six affected project Header groups preserve their actions as direct shared-dock children", headerActionGroupSources.reduce((count, { source }) => count + headerActionGroups(source).groups.length, 0) === 6);
check("Every affected Header group rejects an independently wrapping consumer container", headerActionGroupSources.every(({ source }) => {
  const { ast, groups } = headerActionGroups(source);
  return groups.every(group => {
    const children = source.slice(group.openingFragment.end, group.closingFragment.pos);
    const mutant = source.slice(0, group.getStart(ast)) + `<div className="flex flex-wrap gap-2">${children}</div>` + source.slice(group.end);
    try { headerActionGroups(mutant); return false; } catch { return true; }
  });
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
  for (const headerPresentation of ["default", "cinematic"]) for (const width of [390, 820, 1536]) for (const pendingHref of [null, "/admin/content/categories"]) {
    const events = [], state = [];
    let releaseLogout;
    const tokens = loadAdminStyleTokens();
    const cinematicHeader = headerPresentation === "cinematic";
    const bindings = { company, pendingHref, headerPresentation, cinematicHeader, mobileOpen: false, mobileTriggerRef: { current: null }, headerStyles: tokens.ADMIN_CINEMATIC_GOLD_V1.system, ADMIN_CINEMATIC_GOLD_V1: tokens.ADMIN_CINEMATIC_GOLD_V1, pathname: "/admin/content/topics", setMobileState: value => state.push(value), fetch: (url, options) => { events.push({ type: "fetch", url, options }); return new Promise(resolve => { releaseLogout = resolve; }); }, window: { location: { assign: url => events.push({ type: "assign", url }) } } };
    const { renderGlobalHeader, CompanyMark } = Function("require", "exports", ...Object.keys(bindings), code + ";return {renderGlobalHeader,CompanyMark};")(() => jsxRuntime, {}, ...Object.values(bindings));
    const tree = renderGlobalHeader();
    assert.equal(tree.type, "header"); assert.ok("data-admin-shell-header" in tree.props);
    const shellPadding = layoutProperties(tree.props.className, width);
    assert.equal(shellPadding["padding-inline"], "calc(var(--spacing) * 4)", "Global Header horizontal padding remains16px");
    assert.equal(shellPadding["padding-block"], "calc(var(--spacing) * 3)", "Global Header vertical padding is12px");
    assert.equal(shellPadding.padding, undefined, "Global Header does not restore all-axis padding");
    assert.equal(layoutProperties(mainClasses.text, width).gap, "calc(var(--spacing) * 6)", "Main cadence is24px");
    const row = React.Children.toArray(tree.props.children).filter(React.isValidElement).at(-1);
    const groups = React.Children.toArray(row.props.children).filter(React.isValidElement);
    assert.equal(groups.length, 2);
    const rowStyle = layoutProperties(row.props.className, width);
    if (cinematicHeader) {
      assert.equal(tree.props.className, tokens.ADMIN_CINEMATIC_GOLD_V1.system.root);
      assert.equal(rowStyle["flex-wrap"], "wrap");
      assert.equal(tree.props["data-admin-shell-header-presentation"], "cinematic");
    } else {
      assert.equal(rowStyle.gap, "calc(var(--spacing) * 4)");
      assert.equal(rowStyle["flex-direction"], width < 640 ? "column" : "row");
      for (const group of groups) assert.equal(layoutProperties(group.props.className, width).gap, "calc(var(--spacing) * 3)");
    }
    const menu = React.Children.toArray(groups[0].props.children).find(node => React.isValidElement(node) && node.type === "button");
    const controls = React.Children.toArray(groups[1].props.children).filter(React.isValidElement);
    const logout = controls.find(node => node.type === "button");
    assert.ok(menu && logout);
    assert.equal(menu.props.type, "button"); assert.equal(menu.props["aria-label"], "فتح القائمة");
    const menuStyle = layoutProperties(menu.props.className, width);
    assert.equal(menuStyle.display, width < 1024 ? "grid" : "none");
    assert.equal(menuStyle.width, `calc(var(--spacing) * ${cinematicHeader ? 10 : 11})`); assert.equal(menuStyle.height, `calc(var(--spacing) * ${cinematicHeader ? 10 : 11})`);
    if (!cinematicHeader) { assert.equal(menuStyle["font-size"], "var(--text-2xl)"); assert.equal(menuStyle["line-height"], "1", "The existing Mobile menu retains its default glyph and 44px button"); }
    menu.props.onClick(); assert.deepEqual(state, [{ pathname: "/admin/content/topics", open: true }]);
    assert.equal(logout.props.type, "button"); assert.equal(renderToStaticMarkup(logout).replace(/<[^>]+>/gu, "").trim(), "خروج");
    const statuses = controls.filter(node => node.props.role === "status");
    assert.equal(statuses.length, pendingHref ? 1 : 0);
    if (pendingHref) assert.ok(statuses[0].props.children.trim().length > 0);
    const mark = CompanyMark({ company, compact: false, cinematic: cinematicHeader });
    assert.equal(mark.props["aria-label"], company.name); assert.equal(mark.props.children, "شر");
    const markStyle = layoutProperties(mark.props.className, width);
    const markSize = cinematicHeader ? width < 640 ? 11 : 14 : 10;
    assert.equal(markStyle.width, `calc(var(--spacing) * ${markSize})`); assert.equal(markStyle.height, `calc(var(--spacing) * ${markSize})`);
    const media = CompanyMark({ company: { ...company, logoUrl: "/synthetic-logo.svg" }, compact: false, cinematic: cinematicHeader }).props.children;
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
check("Actual global Header preserves twelve default/cinematic responsive and pending states, identity and menu/logout behavior", await verifyGlobalHeader(shell) === 12);
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
