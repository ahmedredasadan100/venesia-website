/**
 * Admin Form Runtime module adoption ledger.
 *
 * Form Runtime is one independent module governed by the Admin Interaction
 * System contracts umbrella. This ledger does not describe Collection, Data,
 * Feedback, Confirmation, or Shared Capability ownership, and it is not a
 * declaration that every Admin interaction has adopted AdminFormRuntime.
 */

export type AdminFormAdoptionClassification =
  | "shared_reference"
  | "shared_adopter"
  | "legacy_generic_gap"
  | "specialized_exception"
  | "explicit_exception";

export type AdminFormAdoptionEntry = {
  id: string;
  label: string;
  classification: AdminFormAdoptionClassification;
  sourceFiles: readonly string[];
  surfaces: readonly string[];
  rationale: string;
};

export const ADMIN_FORM_RUNTIME_MODULE = {
  id: "form_runtime",
  governanceSystem: "admin_interaction_system",
  role: "independent_runtime",
  owns: "long_lived_create_edit_form_lifecycle",
  ownsSharedCapabilities: false,
} as const;

export const ADMIN_FORM_SYSTEM_CLOSURE = {
  phase: "SEO Redirect Create/Edit - Form Runtime Adoption",
  module: ADMIN_FORM_RUNTIME_MODULE.id,
  scope: "reference_consumers_and_redirect_create_edit",
  allowedClaim: "seo_redirect_create_edit_adopted",
  globalClosed: false,
  globalClosureBlockers: [
    "Legacy generic Admin forms remain outside the Form Runtime module.",
    "Other Admin Interaction System runtimes and capabilities have independent adoption ledgers.",
  ],
} as const;

export const ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST = [
  {
    id: "topic-article-create-edit",
    label: "Topic Article create and edit",
    classification: "shared_reference",
    sourceFiles: [
      "src/components/admin/content/editors/ArticleCreateEditor.tsx",
      "src/components/admin/content/editors/ArticleEditor.tsx",
    ],
    surfaces: ["create", "edit"],
    rationale:
      "Reference consumer for the shared runtime, unified save action, publication capability, and Save/Close contract.",
  },
  {
    id: "topic-category-create-edit",
    label: "Topic Category create and edit",
    classification: "shared_reference",
    sourceFiles: ["src/app/admin/content/categories/CategoryForm.tsx"],
    surfaces: ["create", "edit"],
    rationale:
      "Reference taxonomy consumer using the shared runtime and the common action pair.",
  },
  {
    id: "topic-series-create-edit",
    label: "Topic Series create and edit",
    classification: "shared_reference",
    sourceFiles: ["src/app/admin/content/series/SeriesForm.tsx"],
    surfaces: ["create", "edit"],
    rationale:
      "Reference taxonomy consumer using the shared runtime and the common action pair.",
  },
  {
    id: "topic-media-create-edit",
    label: "Media Topic create and edit",
    classification: "legacy_generic_gap",
    sourceFiles: [
      "src/components/admin/content/editors/media/MediaContentForm.tsx",
    ],
    surfaces: [
      "news:create",
      "news:edit",
      "press:create",
      "press:edit",
      "site_update:create",
      "site_update:edit",
      "video:create",
      "video:edit",
      "gallery:create",
      "gallery:edit",
    ],
    rationale:
      "Generic create/edit form still owns its local form lifecycle and must be migrated in a later adoption phase.",
  },
  {
    id: "projects-create",
    label: "Project create",
    classification: "legacy_generic_gap",
    sourceFiles: ["src/app/admin/projects/AddProjectPanelClient.tsx"],
    surfaces: ["residential:create", "commercial:create"],
    rationale:
      "Generic entity create form remains on a local client submission lifecycle.",
  },
  {
    id: "projects-edit",
    label: "Project edit",
    classification: "legacy_generic_gap",
    sourceFiles: ["src/app/admin/projects/ProjectEditForm.tsx"],
    surfaces: ["residential:edit", "commercial:edit"],
    rationale:
      "Generic entity edit form remains outside the shared runtime.",
  },
  {
    id: "pages-quick-create",
    label: "Page quick create",
    classification: "legacy_generic_gap",
    sourceFiles: ["src/app/admin/pages-blocks/pages/CreatePageModal.tsx"],
    surfaces: ["create"],
    rationale:
      "Generic modal create form remains outside the shared runtime.",
  },
  {
    id: "redirects-create-edit",
    label: "SEO Redirect create and edit",
    classification: "shared_adopter",
    sourceFiles: ["src/app/admin/seo/redirects/RedirectFormModal.tsx"],
    surfaces: ["create", "edit"],
    rationale:
      "Generic modal create/edit form delegates lifecycle ownership to AdminFormRuntime while Redirect validation and list reconciliation remain entity adapters.",
  },
  {
    id: "page-composition-and-seo",
    label: "Page composition and per-page SEO",
    classification: "specialized_exception",
    sourceFiles: [
      "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
      "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx",
      "src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx",
    ],
    surfaces: ["composition", "assignment", "seo"],
    rationale:
      "Composite page-builder workflow has specialized assignment, ordering, and SEO lifecycles.",
  },
  {
    id: "block-template-builders-and-editors",
    label: "Block template builders and editors",
    classification: "specialized_exception",
    sourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
      "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
      "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
      "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
      "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
      "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
      "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
      "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
    ],
    surfaces: ["template-create", "template-edit", "template-command"],
    rationale:
      "Schema-driven block builders and editors require a dedicated composition contract before shared-runtime adoption.",
  },
  {
    id: "menu-builder",
    label: "Menu builder",
    classification: "specialized_exception",
    sourceFiles: [
      "src/app/admin/pages-blocks/menus/AddMenuPanelClient.tsx",
      "src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx",
      "src/app/admin/pages-blocks/menus/MenuItemForm.tsx",
      "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
      "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
    ],
    surfaces: ["menu-create", "menu-edit", "item-edit", "ordering", "row-command"],
    rationale:
      "Hierarchical menu editing and ordering are a specialized builder workflow.",
  },
  {
    id: "footer-builder",
    label: "Footer builder",
    classification: "specialized_exception",
    sourceFiles: [
      "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx",
      "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
    ],
    surfaces: ["footer-compose", "footer-link-edit", "ordering"],
    rationale:
      "Multi-slot footer composition is a specialized aggregate editor; its link-delete confirm remains recorded debt.",
  },
  {
    id: "global-seo-settings",
    label: "Global SEO settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/seo/meta-manager/MetaManagerClient.tsx"],
    surfaces: ["global-meta"],
    rationale:
      "Singleton global metadata management is not a generic entity create/edit consumer.",
  },
  {
    id: "company-identity-settings",
    label: "Company identity settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/settings/general/CompanyIdentityPanel.tsx"],
    surfaces: ["singleton-settings"],
    rationale:
      "Singleton identity settings retain their dedicated settings contract.",
  },
  {
    id: "security-settings",
    label: "Security settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/settings/security/SecuritySettingsClient.tsx"],
    surfaces: ["password", "session", "security-policy"],
    rationale:
      "Sensitive security mutations require dedicated validation and session semantics.",
  },
  {
    id: "users-and-roles",
    label: "Users and roles management",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/users-roles/UsersManagementClient.tsx"],
    surfaces: ["user-create", "user-edit", "role-change", "status-command"],
    rationale:
      "Identity lifecycle and role mutations are specialized; native confirm calls remain recorded debt.",
  },
  {
    id: "maintenance-immediate-setting",
    label: "Maintenance mode immediate setting",
    classification: "explicit_exception",
    sourceFiles: ["src/app/admin/settings/general/MaintenanceModePanel.tsx"],
    surfaces: ["immediate-toggle"],
    rationale:
      "Single immediate toggle command intentionally has no persistent editable form session.",
  },
  {
    id: "authentication-login",
    label: "Authentication login forms",
    classification: "explicit_exception",
    sourceFiles: [
      "src/app/admin/(auth)/login/AdminLoginForm.tsx",
      "src/app/maintenance/MaintenanceLoginForm.tsx",
    ],
    surfaces: ["admin-login", "maintenance-login"],
    rationale:
      "Authentication forms have session and redirect semantics outside Admin entity editing.",
  },
  {
    id: "list-bulk-row-one-shot-actions",
    label: "List, bulk, row, and one-shot actions",
    classification: "explicit_exception",
    sourceFiles: [
      "src/components/admin/ui/AdminBulkActionBar.tsx",
      "src/components/admin/ui/AdminDataGridRowActions.tsx",
      "src/components/admin/ui/AdminDuplicateResourceModal.tsx",
      "src/components/admin/AdminRowActions.tsx",
      "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
      "src/app/admin/seo/redirects/RedirectsClient.tsx",
      "src/app/admin/seo/redirects/RedirectDeleteButton.tsx",
      "src/components/admin/content/UnifiedContentList.tsx",
      "src/components/admin/content/UnifiedContentRowActions.tsx",
    ],
    surfaces: ["bulk-command", "row-command", "duplicate-command"],
    rationale:
      "Atomic list commands do not represent a long-lived create/edit form session.",
  },
  {
    id: "activity-sitemap-media-commands",
    label: "Activity, sitemap, and media commands",
    classification: "explicit_exception",
    sourceFiles: [
      "src/app/admin/activity-log/ActivityLogClient.tsx",
      "src/app/admin/seo/sitemap/SitemapMonitorClient.tsx",
      "src/components/admin/media/AdminMediaPickerModal.tsx",
      "src/components/admin/media-intelligence/AdminMediaLibraryClient.tsx",
      "src/components/admin/media-intelligence/MediaUsagePanel.tsx",
    ],
    surfaces: ["activity-query", "sitemap-check", "media-command", "media-usage"],
    rationale:
      "Query/command utilities have no generic entity create/edit lifecycle.",
  },
] as const satisfies readonly AdminFormAdoptionEntry[];

export const ADMIN_FORM_CONFIRM_DEBT = [
  "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
  "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  "src/app/admin/users-roles/UsersManagementClient.tsx",
] as const;
