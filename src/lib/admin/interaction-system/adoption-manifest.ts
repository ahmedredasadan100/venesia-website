/**
 * Admin Interaction System governance ledger.
 *
 * The system is a contracts/governance umbrella only. It does not own a
 * super-runtime: Form, Collection, Data, Feedback, and Confirmation keep
 * independent lifecycle owners, while cross-cutting UI remains a Shared
 * Capability.
 */

import type { AdminEntityListEntityKey } from "../entity-list/data-engine/registry";
import type {
  AdminRowActionMoreKind,
  AdminRowActionPrimaryKind,
} from "./admin-row-actions-capability";

export type AdminInteractionModuleId =
  | "form_runtime"
  | "collection_runtime"
  | "data_runtime"
  | "feedback_runtime"
  | "confirmation_runtime"
  | "shared_capabilities";

export type AdminInteractionModule = {
  id: AdminInteractionModuleId;
  classification: "independent_runtime" | "shared_capability_layer";
  sourceFiles: readonly string[];
  responsibility: string;
};

export const ADMIN_INTERACTION_SYSTEM = {
  name: "Admin Interaction System",
  role: "governance_contracts_umbrella",
  ownsRuntime: false,
  scope: "reference_consumers_and_declared_gaps",
  globalClosed: false,
  globalClosureBlockers: [
    "Shared capabilities are not yet adopted by every eligible Admin surface.",
    "Full Collection Runtime adoption remains incomplete outside the current reference consumers.",
    "The independent runtime modules retain adoption work outside this correction pass.",
  ],
} as const;

export const ADMIN_INTERACTION_MODULES = [
  {
    id: "form_runtime",
    classification: "independent_runtime",
    sourceFiles: [
      "src/components/admin/ui/AdminFormRuntime.tsx",
      "src/lib/admin/form-runtime.ts",
    ],
    responsibility:
      "Long-lived create/edit form ownership, Save/Close lifecycle, pending, validation, dirty state, and Create-to-Edit handoff.",
  },
  {
    id: "collection_runtime",
    classification: "independent_runtime",
    sourceFiles: [
      "src/components/admin/entity-list/AdminEntityList.tsx",
      "src/components/admin/entity-list/AdminEntityListSurface.tsx",
    ],
    responsibility:
      "Entity collection query state, filters, selection, row presentation, pagination, and collection interaction ownership.",
  },
  {
    id: "data_runtime",
    classification: "independent_runtime",
    sourceFiles: [
      "src/lib/admin/entity-list/data-engine/contracts.ts",
      "src/lib/admin/entity-list/data-engine/client-controller.ts",
      "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
    ],
    responsibility:
      "Normalized entity data, request ownership, optimistic mutation, reconciliation, invalidation, and instrumentation.",
  },
  {
    id: "feedback_runtime",
    classification: "independent_runtime",
    sourceFiles: ["src/components/admin/AdminFeedbackProvider.tsx"],
    responsibility:
      "Global feedback channels, viewport publication, dismissal, and feedback lifecycle.",
  },
  {
    id: "confirmation_runtime",
    classification: "independent_runtime",
    sourceFiles: ["src/components/admin/ui/AdminConfirmDialog.tsx"],
    responsibility:
      "Accessible confirmation presentation, focus restoration, and explicit confirmation interaction.",
  },
  {
    id: "shared_capabilities",
    classification: "shared_capability_layer",
    sourceFiles: [
      "src/lib/admin/interaction-system/entity-preview-capability.ts",
      "src/components/admin/ui/AdminEntityPreviewActions.tsx",
      "src/lib/admin/interaction-system/admin-row-actions-capability.ts",
      "src/components/admin/ui/AdminDataGridRowActions.tsx",
    ],
    responsibility:
      "Portable interaction contracts and shared presentation for canonical Preview/Public View and Row Actions; mutation lifecycles remain delegated to their existing owners.",
  },
] as const satisfies readonly AdminInteractionModule[];

export type AdminInteractionFormReferenceConsumer = {
  id: string;
  module: "form_runtime";
  sourceFiles: readonly string[];
  surfaces: readonly string[];
};

export const ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS = [
  {
    id: "topic-article-create-edit",
    module: "form_runtime",
    sourceFiles: [
      "src/components/admin/content/editors/ArticleCreateEditor.tsx",
      "src/components/admin/content/editors/ArticleEditor.tsx",
    ],
    surfaces: ["create", "edit"],
  },
  {
    id: "topic-category-create-edit",
    module: "form_runtime",
    sourceFiles: ["src/app/admin/content/categories/CategoryForm.tsx"],
    surfaces: ["create", "edit"],
  },
  {
    id: "topic-series-create-edit",
    module: "form_runtime",
    sourceFiles: ["src/app/admin/content/series/SeriesForm.tsx"],
    surfaces: ["create", "edit"],
  },
] as const satisfies readonly AdminInteractionFormReferenceConsumer[];

export type AdminEntityPreviewCapabilityAdoption = {
  id: string;
  capability: "entity_preview_public";
  status: "adopted" | "gap";
  capabilityOwner: "shared_capabilities";
  consumerBoundary:
    | "form_runtime_reference_consumer"
    | "collection_runtime"
    | "legacy_entity_page";
  sourceFiles: readonly string[];
  rationale: string;
};

export const ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION = [
  {
    id: "topic-article-edit-preview-public",
    capability: "entity_preview_public",
    status: "adopted",
    capabilityOwner: "shared_capabilities",
    consumerBoundary: "form_runtime_reference_consumer",
    sourceFiles: [
      "src/components/admin/content/editors/ArticleEditor.tsx",
      "src/lib/admin/content/entity-preview-capabilities.ts",
    ],
    rationale:
      "Topic Article Edit delegates Preview/Public resolution and rendering to the shared capability outside AdminFormRuntime.",
  },
  {
    id: "topic-media-edit-preview",
    capability: "entity_preview_public",
    status: "gap",
    capabilityOwner: "shared_capabilities",
    consumerBoundary: "legacy_entity_page",
    sourceFiles: ["src/app/admin/content/topics/[id]/page.tsx"],
    rationale:
      "The legacy Media Topic editor still renders its internal preview action locally and remains outside this correction pass.",
  },
  {
    id: "topic-category-collection-preview",
    capability: "entity_preview_public",
    status: "adopted",
    capabilityOwner: "shared_capabilities",
    consumerBoundary: "collection_runtime",
    sourceFiles: [
      "src/app/admin/content/categories/CategoryRowActions.tsx",
      "src/lib/admin/content/entity-preview-capabilities.ts",
      "src/components/admin/ui/AdminEntityPreviewActions.tsx",
    ],
    rationale:
      "The Category collection declares its existing public topics route through a thin content adapter and delegates rendering to the shared capability.",
  },
  {
    id: "topic-series-collection-preview",
    capability: "entity_preview_public",
    status: "adopted",
    capabilityOwner: "shared_capabilities",
    consumerBoundary: "collection_runtime",
    sourceFiles: [
      "src/app/admin/content/series/series-columns.tsx",
      "src/lib/admin/content/entity-preview-capabilities.ts",
      "src/components/admin/ui/AdminEntityPreviewActions.tsx",
    ],
    rationale:
      "The Series collection declares its existing filtered Admin topics route as an internal view through a thin content adapter; no unsupported public route is declared.",
  },
] as const satisfies readonly AdminEntityPreviewCapabilityAdoption[];

export type AdminRowActionsGovernedAction =
  | Exclude<AdminRowActionPrimaryKind, "more">
  | AdminRowActionMoreKind;

export type AdminRowActionsAdoptionActionState =
  | "adopted"
  | "hidden"
  | "specialized_adapter";

export type AdminRowActionsExistingOwners = {
  presentation: "shared_capabilities";
  data: "data_runtime" | "domain_action_adapter";
  feedback: "feedback_runtime";
  confirmation: "confirmation_runtime";
  audit: "cms_admin_audit";
};

export type AdminRowActionsAdoptionEntry = {
  entity: AdminEntityListEntityKey | "redirects";
  status: "adopted";
  consumerSourceFile: string;
  sourceFiles: readonly string[];
  manualOrder: false;
  actions: Readonly<
    Record<AdminRowActionsGovernedAction, AdminRowActionsAdoptionActionState>
  >;
  owners: AdminRowActionsExistingOwners;
  confirmationActions: readonly AdminRowActionsGovernedAction[];
  auditedActions: readonly AdminRowActionsGovernedAction[];
  rationale: string;
};

export const ADMIN_ROW_ACTIONS_EXISTING_OWNERS = {
  presentation: "shared_capabilities",
  data: "data_runtime",
  feedback: "feedback_runtime",
  confirmation: "confirmation_runtime",
  audit: "cms_admin_audit",
} as const satisfies AdminRowActionsExistingOwners;

export const ADMIN_ROW_ACTIONS_REDIRECT_OWNERS = {
  ...ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
  data: "domain_action_adapter",
} as const satisfies AdminRowActionsExistingOwners;

/**
 * Every generic Admin Collection declares Row Actions through the shared
 * presentation capability. Entity List consumers keep the Data Runtime;
 * Redirects keeps its established audited server-action adapter.
 */
export const ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION = {
  capability: "shared_admin_row_actions",
  scope: "generic_admin_collection_surfaces",
  globalClosed: false,
  globalClosureBlockers: [
    "Authenticated Browser QA for the final working tree is still required before global closure.",
  ],
  canonicalOrders: {
    primary: ["edit", "preview", "more"],
    more: [
      "information",
      "copyPublicLink",
      "visibility",
      "featured",
      "duplicate",
      "archive",
      "delete",
    ],
  },
  ownerSourceFiles: {
    presentation: [
      "src/lib/admin/interaction-system/admin-row-actions-capability.ts",
      "src/components/admin/ui/AdminDataGridRowActions.tsx",
      "src/components/admin/ui/AdminDataGrid.tsx",
    ],
    data: [
      "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
      "src/app/admin/seo/redirects/actions.ts",
    ],
    feedback: ["src/components/admin/AdminFeedbackProvider.tsx"],
    confirmation: ["src/components/admin/ui/AdminConfirmDialog.tsx"],
    audit: [
      "src/lib/admin/audit-log.ts",
      "src/lib/admin/audit/cms-audit-actions.ts",
    ],
  },
  entities: [
    {
      entity: "topics",
      status: "adopted",
      consumerSourceFile:
        "src/components/admin/content/UnifiedContentRowActions.tsx",
      sourceFiles: [
        "src/components/admin/content/UnifiedContentRowActions.tsx",
        "src/components/admin/content/TopicsListClient.tsx",
        "src/app/admin/content/topics/actions.ts",
      ],
      manualOrder: false,
      actions: {
        edit: "adopted",
        preview: "adopted",
        information: "adopted",
        copyPublicLink: "hidden",
        visibility: "adopted",
        featured: "adopted",
        duplicate: "adopted",
        archive: "hidden",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: [
        "visibility",
        "featured",
        "duplicate",
        "delete",
      ],
      rationale:
        "Topic row presentation is shared while instant mutations, feedback, confirmation, and audit remain with their existing owners.",
    },
    {
      entity: "categories",
      status: "adopted",
      consumerSourceFile:
        "src/app/admin/content/categories/CategoryRowActions.tsx",
      sourceFiles: [
        "src/app/admin/content/categories/CategoryRowActions.tsx",
        "src/app/admin/content/categories/CategoryDeleteButton.tsx",
        "src/app/admin/content/categories/CategoriesListClient.tsx",
        "src/app/admin/content/categories/actions.ts",
      ],
      manualOrder: false,
      actions: {
        edit: "adopted",
        preview: "adopted",
        information: "adopted",
        copyPublicLink: "hidden",
        visibility: "adopted",
        featured: "hidden",
        duplicate: "adopted",
        archive: "hidden",
        delete: "specialized_adapter",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: ["visibility", "duplicate", "delete"],
      rationale:
        "Category delete keeps its transfer and relation-preflight adapter while delegating its dangerous confirmation surface to the existing Confirmation Runtime.",
    },
    {
      entity: "series",
      status: "adopted",
      consumerSourceFile: "src/app/admin/content/series/series-columns.tsx",
      sourceFiles: [
        "src/app/admin/content/series/series-columns.tsx",
        "src/app/admin/content/series/SeriesTableClient.tsx",
        "src/app/admin/content/series/actions.ts",
      ],
      manualOrder: false,
      actions: {
        edit: "adopted",
        preview: "adopted",
        information: "adopted",
        copyPublicLink: "hidden",
        visibility: "adopted",
        featured: "hidden",
        duplicate: "adopted",
        archive: "hidden",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: ["visibility", "duplicate", "delete"],
      rationale:
        "Series delegates row rendering to the shared capability and keeps its established Data, Feedback, Confirmation, and Audit owners.",
    },
    {
      entity: "pages",
      status: "adopted",
      consumerSourceFile:
        "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
      sourceFiles: [
        "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
        "src/app/admin/pages-blocks/pages/page-actions/page-status.ts",
        "src/app/admin/pages-blocks/pages/page-actions/page-duplicate.ts",
        "src/app/admin/pages-blocks/pages/page-actions/page-delete.ts",
      ],
      manualOrder: false,
      actions: {
        edit: "adopted",
        preview: "adopted",
        information: "adopted",
        copyPublicLink: "hidden",
        visibility: "adopted",
        featured: "hidden",
        duplicate: "adopted",
        archive: "hidden",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: ["visibility", "duplicate", "delete"],
      rationale:
        "Pages declares only supported actions and routes immediate commands through the existing Data and Feedback owners.",
    },
    {
      entity: "projects",
      status: "adopted",
      consumerSourceFile:
        "src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx",
      sourceFiles: [
        "src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx",
        "src/app/admin/projects/ProjectsTableClient.tsx",
        "src/app/admin/projects/project-actions/delete.ts",
        "src/app/admin/projects/project-actions/duplicate.ts",
        "src/app/admin/projects/project-actions/featured.ts",
        "sql/migrations/20260731100000_project_row_actions_capability.sql",
      ],
      manualOrder: false,
      actions: {
        edit: "adopted",
        preview: "adopted",
        information: "adopted",
        copyPublicLink: "adopted",
        visibility: "hidden",
        featured: "adopted",
        duplicate: "adopted",
        archive: "hidden",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: ["featured", "duplicate", "delete"],
      rationale:
        "Residential and Commercial share one Project action declaration; the Project Domain owns atomic duplication and authoritative featured writes while the shared renderer owns presentation.",
    },
    {
      entity: "redirects",
      status: "adopted",
      consumerSourceFile:
        "src/app/admin/seo/redirects/RedirectsClient.tsx",
      sourceFiles: [
        "src/app/admin/seo/redirects/RedirectsClient.tsx",
        "src/app/admin/seo/redirects/actions.ts",
      ],
      manualOrder: false,
      actions: {
        edit: "adopted",
        preview: "hidden",
        information: "adopted",
        copyPublicLink: "hidden",
        visibility: "adopted",
        featured: "hidden",
        duplicate: "hidden",
        archive: "hidden",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_REDIRECT_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: ["visibility", "delete"],
      rationale:
        "Redirects adopts the shared presentation and confirmation owners while preserving its validated, audited server-action adapter and fixed-column list contract.",
    },
  ],
} as const satisfies {
  capability: "shared_admin_row_actions";
  scope: "generic_admin_collection_surfaces";
  globalClosed: false;
  globalClosureBlockers: readonly string[];
  canonicalOrders: {
    primary: readonly AdminRowActionPrimaryKind[];
    more: readonly AdminRowActionMoreKind[];
  };
  ownerSourceFiles: Readonly<
    Record<keyof AdminRowActionsExistingOwners, readonly string[]>
  >;
  entities: readonly AdminRowActionsAdoptionEntry[];
};

export type AdminCollectionSurfaceClassification =
  | "adopted"
  | "legacy_generic_gap"
  | "specialized_exception"
  | "explicit_exception"
  | "deprecated_legacy";

export type AdminCollectionSurfaceInventoryEntry = {
  id: string;
  classification: AdminCollectionSurfaceClassification;
  generic: boolean;
  routes: readonly string[];
  pageSourceFiles: readonly string[];
  presentationSourceFiles: readonly string[];
  rowActionsOwner:
    | "shared_admin_row_actions"
    | "specialized_surface"
    | "not_applicable";
  columnVisibility:
    | "shared_optional_columns"
    | "fixed_no_optional_columns"
    | "not_applicable";
  summaryCards: boolean;
  filtersOrToolbar: boolean;
  pagination: boolean;
  layoutOwner: string;
  rationale: string;
};

/**
 * Exhaustive ledger for concrete Admin collection/list presentation sources.
 * The verifier scans AdminEntityList, AdminDataGrid, and native table consumers
 * and requires every concrete surface source to appear exactly once here.
 */
export const ADMIN_COLLECTION_SURFACE_ADOPTION = {
  scope: "all_admin_collection_and_list_surfaces",
  globalClosed: false,
  globalClosureBlockers: [
    "Authenticated Browser QA for every generic adopter on the final working tree is still required.",
  ],
  legacyGenericGaps: [],
  canonicalSectionGap: "gap-7",
  ownerSourceFiles: {
    rowActions:
      "src/components/admin/ui/AdminDataGridRowActions.tsx",
    columns: "src/components/admin/entity-list/AdminEntityList.tsx",
    layout:
      "src/components/admin/entity-list/AdminEntityListSurface.tsx",
    pagination: "src/components/admin/ui/AdminTablePagination.tsx",
  },
  surfaces: [
    {
      id: "content-topics",
      classification: "adopted",
      generic: true,
      routes: ["/admin/content/topics"],
      pageSourceFiles: ["src/app/admin/content/topics/page.tsx"],
      presentationSourceFiles: [
        "src/components/admin/content/TopicsListClient.tsx",
        "src/components/admin/content/UnifiedContentList.tsx",
      ],
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      pagination: true,
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      rationale:
        "Generic content collection with shared metrics, filters, configurable columns, pagination, and Row Actions.",
    },
    {
      id: "content-categories",
      classification: "adopted",
      generic: true,
      routes: ["/admin/content/categories"],
      pageSourceFiles: ["src/app/admin/content/categories/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/content/categories/CategoriesListClient.tsx",
      ],
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      pagination: true,
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      rationale:
        "Generic taxonomy collection; relation-aware delete remains a domain adapter behind shared presentation.",
    },
    {
      id: "content-series",
      classification: "adopted",
      generic: true,
      routes: ["/admin/content/series"],
      pageSourceFiles: ["src/app/admin/content/series/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/content/series/SeriesTableClient.tsx",
      ],
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      pagination: true,
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      rationale:
        "Generic taxonomy collection using the same list, columns, pagination, and Row Actions owners.",
    },
    {
      id: "pages",
      classification: "adopted",
      generic: true,
      routes: ["/admin/pages-blocks/pages"],
      pageSourceFiles: ["src/app/admin/pages-blocks/pages/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
      ],
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      pagination: true,
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      rationale:
        "Generic page collection now delegates table placement, optional columns, persistence, selection, and Row Actions to existing shared owners.",
    },
    {
      id: "projects-residential-commercial",
      classification: "adopted",
      generic: true,
      routes: [
        "/admin/projects/residential",
        "/admin/projects/commercial",
      ],
      pageSourceFiles: [
        "src/app/admin/projects/residential/page.tsx",
        "src/app/admin/projects/commercial/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/projects/ProjectsTableClient.tsx",
      ],
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      pagination: true,
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      rationale:
        "Residential and Commercial are locked Project query configurations over the same shared collection, columns, and action declaration.",
    },
    {
      id: "seo-redirects",
      classification: "adopted",
      generic: true,
      routes: ["/admin/seo/redirects"],
      pageSourceFiles: ["src/app/admin/seo/redirects/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/seo/redirects/RedirectsClient.tsx",
      ],
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "fixed_no_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      pagination: false,
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      rationale:
        "Generic Redirect collection adopts shared placement and Row Actions; its compact domain schema intentionally exposes a fixed column set.",
    },
    {
      id: "dashboard-recent-content",
      classification: "explicit_exception",
      generic: false,
      routes: ["/admin"],
      pageSourceFiles: ["src/app/admin/page.tsx"],
      presentationSourceFiles: ["src/app/admin/page.tsx"],
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: false,
      pagination: false,
      layoutOwner: "Admin dashboard composition",
      rationale:
        "Read-only recent-content widget embedded in a metrics dashboard, not an entity collection lifecycle.",
    },
    {
      id: "activity-log",
      classification: "explicit_exception",
      generic: false,
      routes: ["/admin/activity-log"],
      pageSourceFiles: ["src/app/admin/activity-log/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/activity-log/ActivityLogClient.tsx",
      ],
      rowActionsOwner: "not_applicable",
      columnVisibility: "fixed_no_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      pagination: true,
      layoutOwner: "Audit query surface",
      rationale:
        "Immutable audit query has no entity mutation or Row Actions lifecycle.",
    },
    {
      id: "media-library",
      classification: "specialized_exception",
      generic: false,
      routes: ["/admin/media-library"],
      pageSourceFiles: ["src/app/admin/media-library/page.tsx"],
      presentationSourceFiles: [
        "src/components/admin/media/MediaLibraryCore.tsx",
      ],
      rowActionsOwner: "specialized_surface",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: true,
      pagination: false,
      layoutOwner: "Media Library catalog",
      rationale:
        "Folder, upload, usage, recovery, and safe-delete catalog lifecycle is materially different from a tabular entity collection.",
    },
    {
      id: "construction-updates",
      classification: "specialized_exception",
      generic: false,
      routes: ["/admin/projects/construction-updates"],
      pageSourceFiles: [
        "src/app/admin/projects/construction-updates/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/projects/construction-updates/ConstructionUpdatesClient.tsx",
      ],
      rowActionsOwner: "specialized_surface",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: true,
      pagination: false,
      layoutOwner: "Construction planning workspace",
      rationale:
        "Project, phase, update, and media planning is an aggregate workflow rather than a single entity list.",
    },
    {
      id: "block-template-builders",
      classification: "specialized_exception",
      generic: false,
      routes: [
        "/admin/pages-blocks/blocks/content",
        "/admin/pages-blocks/blocks/hero",
        "/admin/pages-blocks/blocks/breadcrumb",
        "/admin/pages-blocks/blocks/cards",
        "/admin/pages-blocks/blocks/cta",
        "/admin/pages-blocks/blocks/feed",
        "/admin/pages-blocks/blocks/media-hub",
        "/admin/pages-blocks/blocks/media-sidebar",
      ],
      pageSourceFiles: [
        "src/app/admin/pages-blocks/blocks/content/page.tsx",
        "src/app/admin/pages-blocks/blocks/hero/page.tsx",
        "src/app/admin/pages-blocks/blocks/breadcrumb/page.tsx",
        "src/app/admin/pages-blocks/blocks/cards/page.tsx",
        "src/app/admin/pages-blocks/blocks/cta/page.tsx",
        "src/app/admin/pages-blocks/blocks/feed/page.tsx",
        "src/app/admin/pages-blocks/blocks/media-hub/page.tsx",
        "src/app/admin/pages-blocks/blocks/media-sidebar/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
        "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
        "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
        "src/app/admin/pages-blocks/blocks/media-hub/page.tsx",
        "src/app/admin/pages-blocks/blocks/media-sidebar/page.tsx",
      ],
      rowActionsOwner: "specialized_surface",
      columnVisibility: "fixed_no_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      pagination: false,
      layoutOwner: "Schema-driven block builder",
      rationale:
        "Template creation, duplication, visibility, usage, and schema editing belong to the specialized Page Composition lifecycle recorded by the Form System ledger.",
    },
    {
      id: "menu-builder",
      classification: "specialized_exception",
      generic: false,
      routes: [
        "/admin/pages-blocks/menus",
        "/admin/pages-blocks/menus/[id]",
      ],
      pageSourceFiles: [
        "src/app/admin/pages-blocks/menus/page.tsx",
        "src/app/admin/pages-blocks/menus/[id]/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
        "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
      ],
      rowActionsOwner: "specialized_surface",
      columnVisibility: "fixed_no_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      pagination: false,
      layoutOwner: "Hierarchical Menu Builder",
      rationale:
        "Nested items, ordering, import, and parent-child constraints form a specialized hierarchical builder lifecycle.",
    },
    {
      id: "page-block-assignments",
      classification: "specialized_exception",
      generic: false,
      routes: ["/admin/pages-blocks/pages/[id]"],
      pageSourceFiles: ["src/app/admin/pages-blocks/pages/[id]/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
      ],
      rowActionsOwner: "specialized_surface",
      columnVisibility: "fixed_no_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      pagination: false,
      layoutOwner: "Page composition assignment workspace",
      rationale:
        "Assignment, slot eligibility, reorder, and detach operations are a nested composition lifecycle.",
    },
    {
      id: "footer-builder",
      classification: "specialized_exception",
      generic: false,
      routes: ["/admin/pages-blocks/footer"],
      pageSourceFiles: ["src/app/admin/pages-blocks/footer/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
        "src/app/admin/pages-blocks/footer/FooterMenuPreviewDataGrid.tsx",
      ],
      rowActionsOwner: "specialized_surface",
      columnVisibility: "fixed_no_optional_columns",
      summaryCards: false,
      filtersOrToolbar: false,
      pagination: false,
      layoutOwner: "Multi-slot Footer Builder",
      rationale:
        "In-memory nested link editing, ordering, and menu preview belong to one aggregate footer form session.",
    },
    {
      id: "users-and-roles",
      classification: "specialized_exception",
      generic: false,
      routes: ["/admin/users-roles"],
      pageSourceFiles: ["src/app/admin/users-roles/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/users-roles/UsersManagementClient.tsx",
      ],
      rowActionsOwner: "specialized_surface",
      columnVisibility: "fixed_no_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      pagination: false,
      layoutOwner: "Identity lifecycle surface",
      rationale:
        "User status, password, and role mutations cross the Auth and Permissions boundary and retain their specialized owner.",
    },
    {
      id: "sitemap-monitor",
      classification: "explicit_exception",
      generic: false,
      routes: ["/admin/seo/sitemap"],
      pageSourceFiles: ["src/app/admin/seo/sitemap/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/seo/sitemap/SitemapMonitorClient.tsx",
      ],
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: true,
      pagination: false,
      layoutOwner: "Sitemap diagnostics surface",
      rationale:
        "Read-only diagnostics and refresh commands do not expose a generic entity collection lifecycle.",
    },
    {
      id: "topics-without-image-report",
      classification: "explicit_exception",
      generic: false,
      routes: ["/admin/reports/topics-without-image"],
      pageSourceFiles: [
        "src/app/admin/reports/topics-without-image/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/reports/topics-without-image/page.tsx",
      ],
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: false,
      pagination: false,
      layoutOwner: "Read-only report surface",
      rationale:
        "Diagnostic report links to source records but owns no collection mutations or column preferences.",
    },
  ],
} as const satisfies {
  scope: "all_admin_collection_and_list_surfaces";
  globalClosed: false;
  globalClosureBlockers: readonly string[];
  legacyGenericGaps: readonly string[];
  canonicalSectionGap: "gap-7";
  ownerSourceFiles: Readonly<
    Record<"rowActions" | "columns" | "layout" | "pagination", string>
  >;
  surfaces: readonly AdminCollectionSurfaceInventoryEntry[];
};

export type AdminInteractionCollectionRuntimeGap = {
  id: string;
  runtime: "collection_runtime";
  sourceFiles: readonly string[];
  gaps: readonly string[];
  nextReferenceContract: readonly string[];
  rationale: string;
};

export const ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS =
  [] as const satisfies readonly AdminInteractionCollectionRuntimeGap[];
