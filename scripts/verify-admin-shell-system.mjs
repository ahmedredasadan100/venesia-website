import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

check("Root admin layout resolves company config", layout.includes("loadAdminCompanyConfig") && layout.includes("ADMIN_COMPANY_DEFAULT"));
check("Root admin layout resolves navigation registry", layout.includes("resolveAdminNavigation") && layout.includes("ADMIN_NAVIGATION_REGISTRY"));
check("Auth routes retain the centralized shell exception", access.includes("isAdminAuthPagePath") && /return\s+<>\{children\}<\/>/.test(access));
check("Shell consumes registry data", shell.includes("navigation.map") && !shell.includes("const menuItems"));
check("Shell performs safe intent prefetch", shell.includes("router.prefetch(href)") && shell.includes("onMouseEnter={prefetch}") && shell.includes("onFocus={prefetch}"));
check("Shell persists collapse preference", shell.includes("window.localStorage.setItem") && shell.includes("collapseKey"));
check("Shell exposes stable navigation state", shell.includes("data-admin-shell-route") && shell.includes("data-admin-navigation-pending"));
check("Shell uses the one shared page header core for fallback coverage", shell.includes("AdminPageContextHeader") && shell.includes("data-admin-fallback-header"));
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

const adminRoot = resolve(root, "src/app/admin");
const inventory = collectPages(adminRoot).map((absolutePath) => {
  const path = relative(root, absolutePath).replaceAll("\\", "/");
  const source = readFileSync(absolutePath, "utf8");
  const authExcluded = path.includes("/(auth)/");
  const directSharedHeader = /AdminPage(?:Context)?Header|AdminPlaceholderPage/.test(source);
  return {
    path,
    authExcluded,
    directSharedHeader,
    coverage: authExcluded ? "auth-excluded" : directSharedHeader ? "direct-shared-header" : "shell-shared-fallback",
  };
});
const inventoryOut = resolve(root, ".tmp-qa/admin-shell/page-header-inventory.json");
mkdirSync(dirname(inventoryOut), { recursive: true });
writeFileSync(inventoryOut, JSON.stringify(inventory, null, 2));
check("Every /admin page is inventoried with header coverage", inventory.length > 0 && inventory.every((item) => item.coverage), `${inventory.length} pages`);
check("Auth pages are explicitly excluded from the shell", inventory.some((item) => item.authExcluded));

const failed = checks.filter((item) => !item.ok);
console.log(`verify-admin-shell-system: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
