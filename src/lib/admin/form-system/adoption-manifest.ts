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
  phase: "Shared Legacy Adoption Closure",
  module: ADMIN_FORM_RUNTIME_MODULE.id,
  scope: "reference_consumers_and_in_scope_generic_legacy_forms",
  allowedClaim: "shared_legacy_form_adoption_closed",
  globalClosed: false,
  globalClosureBlockers: [
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
    classification: "shared_adopter",
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
      "All five media content types use ContentEditorShell, AdminFormRuntime, structured save feedback, dirty protection, and Create-to-Edit handoff.",
  },
  {
    id: "projects-create-edit",
    label: "Project create and edit",
    classification: "shared_adopter",
    sourceFiles: [
      "src/app/admin/projects/ProjectEditForm.tsx",
      "src/components/admin/projects/ProjectPublishChecklistPanel.tsx",
    ],
    surfaces: [
      "residential:create",
      "residential:edit",
      "commercial:create",
      "commercial:edit",
    ],
    rationale:
      "One Project form delegates create and edit lifecycle ownership, dirty protection, feedback, validation focus, Create-to-Edit handoff, and live review snapshots to AdminFormRuntime.",
  },
  {
    id: "pages-quick-create",
    label: "Page quick create",
    classification: "shared_adopter",
    sourceFiles: ["src/app/admin/pages-blocks/pages/CreatePageModal.tsx"],
    surfaces: ["create"],
    rationale:
      "Generic modal create delegates pending, validation focus, feedback, dirty confirmation, and Create-to-Edit handoff to AdminFormRuntime.",
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
    id: "block-template-create-modals",
    label: "Block template create modals",
    classification: "shared_adopter",
    sourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
      "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
      "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
    ],
    surfaces: [
      "content:create",
      "hero:create",
      "breadcrumb:create",
      "cards:create",
      "cta:create",
      "feed:create",
    ],
    rationale:
      "All generic template-create modals delegate form lifecycle, validation feedback, dirty confirmation, and Create-to-Edit handoff to AdminFormRuntime while schema editors retain their specialized owners.",
  },
  {
    id: "block-template-builders-and-editors",
    label: "Block template builders and editors",
    classification: "specialized_exception",
    sourceFiles: [
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
      "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
      "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
      "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
      "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
      "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
      "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
      "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
    ],
    surfaces: ["template-edit", "template-command"],
    rationale:
      "Schema-driven block editors retain their dedicated composition contract; their generic create modals are inventoried as shared adopters separately.",
  },
  {
    id: "menu-quick-create",
    label: "Menu quick create",
    classification: "shared_adopter",
    sourceFiles: [
      "src/app/admin/pages-blocks/menus/AddMenuPanelClient.tsx",
    ],
    surfaces: ["menu-create"],
    rationale:
      "Generic menu creation delegates pending, validation focus, feedback, dirty confirmation, and Create-to-Edit handoff to AdminFormRuntime.",
  },
  {
    id: "menu-builder",
    label: "Menu builder",
    classification: "specialized_exception",
    sourceFiles: [
      "src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx",
      "src/app/admin/pages-blocks/menus/MenuItemForm.tsx",
      "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
      "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
    ],
    surfaces: ["menu-edit", "item-edit", "ordering", "row-command"],
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
      "Multi-slot footer composition is a specialized aggregate editor whose destructive interactions delegate to Shared Confirmation.",
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
    classification: "shared_adopter",
    sourceFiles: ["src/app/admin/settings/general/CompanyIdentityPanel.tsx"],
    surfaces: ["singleton-settings"],
    rationale:
      "Singleton identity persistence remains domain-owned while its generic edit lifecycle, presentation, feedback, and dirty confirmation delegate to AdminFormRuntime.",
  },
  {
    id: "media-library-settings",
    label: "Media Library settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/settings/media/MediaSettingsPanel.tsx"],
    surfaces: ["media-policy-settings"],
    rationale:
      "Singleton upload, deletion, storage, and reconciliation policies retain a dedicated settings contract.",
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
    id: "users-create-edit",
    label: "Admin users create and edit",
    classification: "shared_adopter",
    sourceFiles: [
      "src/app/admin/users-roles/AdminUserFormModal.tsx",
    ],
    surfaces: ["user-create", "user-edit"],
    rationale:
      "Create and edit presentation, pending, validation focus, feedback, dirty confirmation, and modal close lifecycle delegate to AdminFormRuntime; identity, password, session, self-protection, and role policy remain with the existing Auth domain actions.",
  },
  {
    id: "users-and-roles",
    label: "Users and roles management",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/users-roles/UsersManagementClient.tsx"],
    surfaces: ["identity-collection", "status-command", "delete-command"],
    rationale:
      "Identity status and delete commands remain specialized Auth-domain mutations while collection presentation, feedback, and confirmation use the shared owners and create/edit lifecycle is inventoried separately.",
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
      "src/components/admin/content/TopicsListClient.tsx",
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
      "src/components/admin/media/MediaLibraryCore.tsx",
      "src/components/admin/media-intelligence/AdminMediaLibraryClient.tsx",
      "src/components/admin/media-intelligence/MediaUsagePanel.tsx",
      "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
    ],
    surfaces: ["activity-query", "sitemap-check", "media-command", "media-usage"],
    rationale:
      "Query/command utilities have no generic entity create/edit lifecycle.",
  },
] as const satisfies readonly AdminFormAdoptionEntry[];

export const ADMIN_FORM_CONFIRM_DEBT = [] as const;
