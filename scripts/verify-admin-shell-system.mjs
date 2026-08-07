import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

const layout = read("src/app/admin/layout.tsx");
const access = read("src/components/admin/AdminAccessLayout.tsx");
const shell = read("src/components/admin/AdminShell.tsx");
const registry = read("src/config/admin/navigation.ts");
const company = read("src/config/admin/company.ts");
const settings = read("src/app/admin/settings/general/CompanyIdentityPanel.tsx");
const selection = read("src/components/admin/ui/useAdminGridSelection.ts");
const pageHeader = read("src/components/admin/ui/AdminPageContextHeader.tsx");
const pageExperience = read("src/components/admin/ui/AdminPageExperience.tsx");
const pageHeaderWrapper = read("src/components/admin/ui/AdminPageHeader.tsx");
const legacyPageHeaderWrapper = read("src/components/admin/AdminPageHeader.tsx");
const feedbackOwner = read("src/components/admin/AdminFeedbackProvider.tsx");
const confirmOwner = read("src/components/admin/ui/AdminConfirmDialog.tsx");
const bulkActionOwner = read("src/components/admin/ui/AdminBulkActionBar.tsx");
const dataGridOwner = read("src/components/admin/ui/AdminDataGrid.tsx");
const rowActionsOwner = read("src/components/admin/ui/AdminDataGridRowActions.tsx");
const adoptionManifest = read("src/lib/admin/interaction-system/adoption-manifest.ts");
const blockEditorHeader = read("src/components/admin/page-blocks/BlockEditorContextHeader.tsx");
const pageCompositionClient = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
const pageCompositionBulkAction = read("src/app/admin/pages-blocks/pages/page-actions/bulk.ts");
const linkValidationOwner = read("src/lib/admin/links/validate.ts");
const footerLinksGrid = read("src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx");
const seoMetaPage = read("src/app/admin/seo/meta-manager/page.tsx");
const seoMetaClient = read("src/app/admin/seo/meta-manager/MetaManagerClient.tsx");
const heroManager = read("src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx");
const blockModuleManager = read("src/components/admin/page-blocks/BlockModuleManagerClient.tsx");

check("Root admin layout resolves company config", layout.includes("loadAdminCompanyConfig") && layout.includes("ADMIN_COMPANY_DEFAULT"));
check("Root admin layout resolves navigation registry", layout.includes("resolveAdminNavigation") && layout.includes("ADMIN_NAVIGATION_REGISTRY"));
check("Auth routes retain the centralized shell exception", access.includes("isAdminAuthPagePath") && /return\s+<>\{children\}<\/>/.test(access));
check("Shell consumes registry data", shell.includes("navigation.map") && !shell.includes("const menuItems"));
check("Shell performs safe intent prefetch", shell.includes("router.prefetch(href)") && shell.includes("onMouseEnter={prefetch}") && shell.includes("onFocus={prefetch}"));
check("Shell persists collapse preference", shell.includes("window.localStorage.setItem") && shell.includes("collapseKey"));
check("Shell exposes stable navigation state", shell.includes("data-admin-shell-route") && shell.includes("data-admin-navigation-pending"));
check("Shell uses the one shared page header core for fallback coverage", shell.includes("AdminPageContextHeader") && shell.includes("data-admin-fallback-header"));
check(
  "Authenticated routes inherit the one shared page surface owner",
  layout.includes("<AdminAccessLayout") &&
    access.includes("<AdminShell") &&
    shell.includes("<AdminPageExperience") &&
    shell.includes("data-admin-route-content") &&
    pageExperience.includes('data-admin-page-surface-owner="AdminPageExperience"') &&
    pageExperience.includes("flex flex-col gap-7"),
);
check(
  "Shell normalizes legacy page-root cadence at the shared boundary",
  shell.includes(':has(>[data-admin-page-header])]:contents') &&
    shell.includes(":has(>[data-admin-page-header])>*]:!my-0") &&
    shell.includes("pb-10") &&
    !shell.includes("data-admin-fallback-header className=\"order-first mb-7\""),
);
check(
  "Shared page header exposes three logical levels with no fourth context slot",
  !pageHeader.includes("contextLine") &&
    !pageHeaderWrapper.includes("contextLine") &&
    !legacyPageHeaderWrapper.includes("contextLine") &&
    !pageHeaderWrapper.includes('variant?: "default" | "context"') &&
    !legacyPageHeaderWrapper.includes('variant?: "default" | "context"') &&
    pageHeaderWrapper.includes('eyebrow = "ADMIN PANEL"') &&
    legacyPageHeaderWrapper.includes('eyebrow = "ADMIN PANEL"'),
);
check(
  "Shell owns the canonical 28px transition without a local header margin",
  shell.includes(
    'className="flex min-w-0 flex-1 flex-col gap-7 px-4 py-4 sm:px-6 lg:px-7"',
  ) && !shell.includes("admin-premium-card mb-5"),
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
  "Page Composition bulk confirmation awaits one atomic mutation and preserves failure retry",
  pageCompositionClient.includes("return new Promise<void>") &&
    pageCompositionClient.includes("await bulkPageBlockAssignments(formData)") &&
    pageCompositionClient.includes('if (action === "delete")') &&
    pageCompositionClient.includes("reject(error)") &&
    pageCompositionClient.indexOf("selection.clearSelection()") >
      pageCompositionClient.indexOf("await bulkPageBlockAssignments(formData)") &&
    pageCompositionBulkAction.includes('await mutatePageComposition(pageId, "bulk"') &&
    !pageCompositionBulkAction.includes("Promise.all") &&
    !pageCompositionBulkAction.includes("mutationResults") &&
    !pageCompositionBulkAction.includes(".from(") &&
    pageCompositionBulkAction.includes('throw new Error("Unsupported page block bulk action.")'),
);
check(
  "Hero and block delete confirmation preserves failure retry and selection",
  [heroManager, blockModuleManager].every(
    (source) =>
      source.includes("): Promise<boolean>") &&
      source.includes("return false;") &&
      source.includes('if (action === "delete") throw new Error') &&
      source.includes("if (!succeeded) throw new Error") &&
      source.indexOf("if (!succeeded)") < source.indexOf("selection.clearSelection()"),
  ),
);
check("Navigation registry exposes contract fields", ["id:", "href:", "label:", "icon:", "order:", "enabled:", "moduleKey:", "permission:"].every((field) => registry.includes(field)));
check("Current admins remain allowed", registry.includes('mode: "allow-current-admins"'));
check("Company default is isolated in company config", company.includes("ADMIN_COMPANY_DEFAULT") && !shell.toLowerCase().includes("venesia"));
check("Company identity is editable through existing media management", settings.includes("AdminMediaImageField") && settings.includes("logoUrl") && settings.includes("compactLogoUrl"));
check("Selection resets when the visible entity set changes", selection.includes("previousVisibleSignature") && selection.includes("setSelectedIds([])"));
check("Unified loading and error boundaries exist", read("src/app/admin/loading.tsx").includes('state="loading"') && read("src/app/admin/error.tsx").includes('state="error"'));

const sharedCoreFiles = [
  "src/lib/admin/shell/contracts.ts",
  "src/lib/admin/shell/navigation.ts",
  "src/lib/admin/shell/company-config.ts",
  "src/components/admin/AdminShell.tsx",
  "src/components/admin/ui/AdminPageContextHeader.tsx",
  "src/components/admin/ui/AdminPageExperience.tsx",
];
const sharedHardcoding = sharedCoreFiles.filter((path) => /venesia/i.test(read(path)));
check("Shared Core contains no company-name hardcoding", sharedHardcoding.length === 0, sharedHardcoding.join(", "));

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
check("Auth pages are explicitly excluded from the shell", inventory.some((item) => item.authExcluded));

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
    !read("src/app/admin/pages-blocks/footer/FooterBuilderEditors.tsx").includes(
      "RestoreConfirmModal",
    ) &&
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
    linkValidationOwner.includes('href.startsWith("/") && !href.startsWith("//")') &&
    linkValidationOwner.includes("!/^https?:\\/\\//i.test(href)") &&
    linkValidationOwner.includes('url.protocol === "http:" || url.protocol === "https:"') &&
    menuItemsGrid.includes("resolvePublicPreviewHref(item.href)") &&
    !menuItemsGrid.includes("function resolveMenuItemPreviewHref") &&
    menuItemsGrid.includes("preview: previewHref") &&
    footerLinksGrid.includes("resolvePublicPreviewHref(manualLinkHrefLabel(item))") &&
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

const failed = checks.filter((item) => !item.ok);
console.log(`verify-admin-shell-system: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
