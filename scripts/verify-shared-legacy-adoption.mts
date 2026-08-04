import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } from "../src/lib/admin/form-system/adoption-manifest.ts";
import { ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS } from "../src/lib/admin/interaction-system/adoption-manifest.ts";
import { PAGE_COMPOSITION_COLUMN_PREFERENCES } from "../src/lib/page-blocks/admin-collection-columns.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const inScopeFormIds = [
  "pages-quick-create",
  "menu-quick-create",
  "company-identity-settings",
  "users-create-edit",
  "block-template-create-modals",
] as const;
const formEntries = new Map(
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map((entry) => [entry.id, entry]),
);

check(
  "all in-scope generic form lifecycles are registered shared adopters",
  inScopeFormIds.every(
    (id) => formEntries.get(id)?.classification === "shared_adopter",
  ),
);
check(
  "the Form Runtime ledger has no remaining generic legacy gap",
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.every(
    (entry) => String(entry.classification) !== "legacy_generic_gap",
  ),
);

const genericFormConsumers = [
  "src/app/admin/pages-blocks/pages/CreatePageModal.tsx",
  "src/app/admin/pages-blocks/menus/AddMenuPanelClient.tsx",
  "src/app/admin/settings/general/CompanyIdentityPanel.tsx",
  "src/app/admin/users-roles/AdminUserFormModal.tsx",
] as const;
for (const sourceFile of genericFormConsumers) {
  const source = read(sourceFile);
  check(
    `${sourceFile} delegates lifecycle and feedback to AdminFormRuntime`,
    source.includes("AdminFormRuntime") &&
      !source.includes("new FormData(") &&
      !source.includes("useActionState("),
  );
}

const blockCreateConsumers = [
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
] as const;
check(
  "all block-create modal families delegate generic form lifecycle to the shared owner",
  blockCreateConsumers.every((sourceFile) => {
    const source = read(sourceFile);
    return source.includes("AdminFormRuntime") && source.includes("VenesiaModal");
  }),
);

const structuredActionSources = [
  "src/app/admin/pages-blocks/pages/page-actions/create-page.ts",
  "src/app/admin/pages-blocks/menus/menu-actions/save.ts",
  "src/app/admin/settings/general/actions.ts",
  "src/app/admin/users-roles/actions.ts",
  "src/app/admin/pages-blocks/blocks/content/actions.ts",
  "src/app/admin/pages-blocks/blocks/hero/actions.ts",
  "src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts",
  "src/app/admin/pages-blocks/blocks/cards/actions.ts",
  "src/app/admin/pages-blocks/blocks/cta/actions.ts",
  "src/app/admin/pages-blocks/blocks/feed/actions.ts",
] as const;
check(
  "in-scope create and edit actions expose the existing structured Form Runtime state",
  structuredActionSources.every((sourceFile) =>
    read(sourceFile).includes("AdminFormActionState"),
  ),
);
const pageCreateAction = read(
  "src/app/admin/pages-blocks/pages/page-actions/create-page.ts",
);
const menuCreateAction = read(
  "src/app/admin/pages-blocks/menus/menu-actions/save.ts",
);
const companyIdentityAction = read(
  "src/app/admin/settings/general/actions.ts",
);
check(
  "Page and Menu quick-create preserve committed rows through warning handoff failures",
  [pageCreateAction, menuCreateAction].every(
    (source) =>
      source.includes("postCommitWarnings") &&
      source.includes("created_with_infrastructure_warning") &&
      source.includes("editHref"),
  ),
);
check(
  "Company Identity distinguishes persistence failure from post-commit infrastructure warnings",
  companyIdentityAction.includes("persistedCompanyKey") &&
    companyIdentityAction.includes("postCommitWarnings") &&
    companyIdentityAction.includes("saved_with_infrastructure_warning"),
);
const feedCreateAction = read(
  "src/app/admin/pages-blocks/blocks/feed/actions.ts",
);
const genericBlockManager = read(
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
);
check(
  "Feed quick-create validates required title and integer limit at the Server Action boundary",
  feedCreateAction.includes('field?: "name" | "slug" | "widget_title" | "limit"') &&
    feedCreateAction.includes("if (!widgetTitle)") &&
    feedCreateAction.includes("!Number.isInteger(limit) || limit < 1") &&
    genericBlockManager.includes('<AdminFormError name="widget_title" />') &&
    genericBlockManager.includes('<AdminFormError name="limit" />'),
);
check(
  "the obsolete menu availability owner is removed",
  !existsSync(
    resolve(
      ROOT,
      "src/app/admin/pages-blocks/menus/menu-actions/slug-check.ts",
    ),
  ),
);

const topicEditPage = read("src/app/admin/content/topics/[id]/page.tsx");
check(
  "Media Topic preview delegates to the shared Preview capability",
  topicEditPage.includes("AdminEntityPreviewActions") &&
    topicEditPage.includes("buildAdminContentPreviewCapability") &&
    !topicEditPage.includes("<Link"),
);

const picker = read("src/components/admin/media/AdminMediaPickerModal.tsx");
check(
  "Admin Media Picker delegates modal lifecycle to VenesiaModal",
  picker.includes("<VenesiaModal") &&
    picker.includes('bodyClassName="flex flex-col !overflow-hidden !p-0"') &&
    !picker.includes("createPortal") &&
    !picker.includes("addEventListener") &&
    !picker.includes("document.body.style"),
);
const sharedModal = read("src/components/admin/VenesiaModal.tsx");
check(
  "VenesiaModal owns optional Escape, scroll lock, and extra-large presentation",
  sharedModal.includes("closeOnEscape") &&
    sharedModal.includes("bodyClassName") &&
    sharedModal.includes("ADMIN_MODAL_SIZES") &&
    sharedModal.includes("createPortal"),
);

const expectedColumnPreferenceIds = [
  "contentTemplates",
  "heroTemplates",
  "breadcrumbTemplates",
  "cardsTemplates",
  "ctaTemplates",
  "feedTemplates",
  "mediaHubTemplates",
  "mediaSidebarTemplates",
  "menus",
  "menuItems",
  "pageAssignments",
] as const;
const preferenceEntries = Object.entries(PAGE_COMPOSITION_COLUMN_PREFERENCES);
check(
  "all missing Page Composition collections have a typed column contract",
  expectedColumnPreferenceIds.every((id) =>
    Object.hasOwn(PAGE_COMPOSITION_COLUMN_PREFERENCES, id),
  ) && preferenceEntries.length === expectedColumnPreferenceIds.length,
);
check(
  "typed column contracts have unique view keys and immutable required columns",
  new Set(preferenceEntries.map(([, config]) => config.viewKey)).size ===
    preferenceEntries.length &&
    preferenceEntries.every(([, config]) =>
      config.columns.some((column) => !column.hideable),
    ),
);
const preferenceAction = read(
  "src/app/admin/pages-blocks/column-preferences.ts",
);
check(
  "Page Composition preferences validate collection IDs and delegate persistence",
  preferenceAction.includes("isPageCompositionColumnPreferenceId") &&
    preferenceAction.includes("saveAdminColumnPreferences") &&
    preferenceAction.includes("allowedColumns") &&
    read("src/lib/page-blocks/admin-collection-columns.ts").includes(
      "Object.hasOwn(PAGE_COMPOSITION_COLUMN_PREFERENCES, value)",
    ),
);

const typedColumnConsumers = [
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
  "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
  "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
] as const;
check(
  "all in-scope specialized collections render the shared typed column menu",
  typedColumnConsumers.every((sourceFile) => {
    const source = read(sourceFile);
    return (
      source.includes("AdminColumnVisibilityMenu") &&
      source.includes("savePageCompositionColumnPreferences")
    );
  }),
);
check(
  "in-memory block collections delegate paging to the shared bounded owner",
  [
    "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
  ].every((sourceFile) => {
    const source = read(sourceFile);
    return (
      source.includes("useAdminBoundedClientPagination") &&
      !/\[\s*(?:currentPage|page|pageSize)\s*,\s*set(?:CurrentPage|Page|PageSize)\s*\]\s*=\s*useState/.test(
        source,
      )
    );
  }),
);

const usersClient = read("src/app/admin/users-roles/UsersManagementClient.tsx");
const usersForm = read("src/app/admin/users-roles/AdminUserFormModal.tsx");
const usersActions = read("src/app/admin/users-roles/actions.ts");
const entityListRegistry = read(
  "src/lib/admin/entity-list/data-engine/registry.ts",
);
check(
  "Admin Users adopts the existing shared Collection, Data, row-action, and column owners",
  entityListRegistry.includes("admin_users: adminUsersEntityListAdapter") &&
    usersClient.includes("AdminEntityList") &&
    usersClient.includes("AdminDataGridRowActions") &&
    usersClient.includes("enableColumnManagement") &&
    usersClient.includes("onPersistColumns={saveAdminUsersTablePreferences}") &&
    usersClient.includes('mode: "shared"'),
);
check(
  "Admin Users adopts shared form and confirmation presentation without owning role policy",
  usersForm.includes("AdminFormRuntime") &&
    usersForm.includes("VenesiaModal") &&
    usersForm.includes("AdminConfirmDialog") &&
    usersForm.includes("readOnly") &&
    usersForm.includes("disabled") &&
    !usersForm.includes('name="role"'),
);
check(
  "Admin Users form actions remain fail-closed at the authenticated Server Action boundary",
  /updateAdminUserFormAction[\s\S]{0,320}?await requireAdminSession\(\)/.test(
    usersActions,
  ) &&
    usersForm.includes("confirmStatusChange ||") &&
    usersForm.includes("event.target instanceof HTMLButtonElement"),
);
check(
  "generic Collection runtime adoption has no remaining registered gap",
  ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS.length === 0,
);

console.log(`Shared Legacy Adoption verification passed (${passed} checks).`);
