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
  scope: "complete_surface_adoption_phase_1",
  globalClosed: false,
  globalClosureBlockers: [
    "Authenticated Browser acceptance on the final working tree is still required.",
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
    status: "adopted",
    capabilityOwner: "shared_capabilities",
    consumerBoundary: "form_runtime_reference_consumer",
    sourceFiles: [
      "src/app/admin/content/topics/[id]/page.tsx",
      "src/lib/admin/content/entity-preview-capabilities.ts",
      "src/components/admin/ui/AdminEntityPreviewActions.tsx",
    ],
    rationale:
      "Media Topic Edit delegates internal Preview resolution and rendering to the same shared capability as Article Edit.",
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
  data: "data_runtime";
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

/**
 * Every generic Admin Collection declares Row Actions through the shared
 * presentation capability while the existing Data Runtime owns pending,
 * optimistic reconciliation, rollback, and invalidation.
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
    data: ["src/lib/admin/entity-list/data-engine/instant-mutation.ts"],
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
        archive: "adopted",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["archive", "delete"],
      auditedActions: [
        "visibility",
        "featured",
        "duplicate",
        "archive",
        "delete",
      ],
      rationale:
        "Topic active and Trash row presentation is shared while instant mutations, feedback, confirmation, and audit remain with their existing owners.",
    },
    {
      entity: "categories",
      status: "adopted",
      consumerSourceFile:
        "src/app/admin/content/categories/CategoryRowActions.tsx",
      sourceFiles: [
        "src/app/admin/content/categories/CategoryRowActions.tsx",
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
        archive: "adopted",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["archive", "delete"],
      auditedActions: ["visibility", "duplicate", "archive", "delete"],
      rationale:
        "Category active and Trash row presentation uses the shared capability while atomic lifecycle RPCs remain in the existing Content Taxonomy mutation owner.",
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
        archive: "adopted",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["archive", "delete"],
      auditedActions: ["visibility", "duplicate", "archive", "delete"],
      rationale:
        "Series active and Trash row presentation uses the shared capability while atomic lifecycle RPCs remain in the existing Content Taxonomy mutation owner.",
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
        copyPublicLink: "adopted",
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
        "Pages exposes the authoritative public path for Preview and Copy Public Link, and routes immediate commands through the existing Data and Feedback owners.",
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
        "src/app/admin/projects/project-actions/publication.ts",
        "src/lib/admin/projects/project-publishing-capability.ts",
        "sql/migrations/20260731100000_project_row_actions_capability.sql",
        "sql/migrations/20260803120000_project_publishing_visibility_capability.sql",
      ],
      manualOrder: false,
      actions: {
        edit: "adopted",
        preview: "adopted",
        information: "adopted",
        copyPublicLink: "adopted",
        visibility: "adopted",
        featured: "adopted",
        duplicate: "adopted",
        archive: "hidden",
        delete: "adopted",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: ["visibility", "featured", "duplicate", "delete"],
      rationale:
        "Residential and Commercial share one Project action declaration; the Project Domain owns authoritative publication, featured writes, and atomic duplication while the shared renderer owns presentation.",
    },
    {
      entity: "redirects",
      status: "adopted",
      consumerSourceFile:
        "src/app/admin/seo/redirects/RedirectsClient.tsx",
      sourceFiles: [
        "src/app/admin/seo/redirects/RedirectsClient.tsx",
        "src/app/admin/seo/redirects/actions.ts",
        "src/lib/admin/redirects/entity-list-adapter.ts",
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
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: ["visibility", "delete"],
      rationale:
        "Redirects uses shared presentation and confirmation while the Data Runtime owns pending and reconciliation around validated, audited domain commands.",
    },
    {
      entity: "admin_users",
      status: "adopted",
      consumerSourceFile:
        "src/app/admin/users-roles/UsersManagementClient.tsx",
      sourceFiles: [
        "src/app/admin/users-roles/UsersManagementClient.tsx",
        "src/app/admin/users-roles/actions.ts",
        "src/lib/admin/users/entity-list-adapter.ts",
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
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: ["delete"],
      auditedActions: ["visibility", "delete"],
      rationale:
        "Admin Users delegates collection commands and confirmation presentation to the shared capability while the existing Auth domain retains validation, session invalidation, self-protection, audit, and privileged writes.",
    },
    {
      entity: "topics_without_image",
      status: "adopted",
      consumerSourceFile:
        "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
      sourceFiles: [
        "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
      ],
      manualOrder: false,
      actions: {
        edit: "adopted",
        preview: "adopted",
        information: "adopted",
        copyPublicLink: "hidden",
        visibility: "hidden",
        featured: "hidden",
        duplicate: "hidden",
        archive: "hidden",
        delete: "hidden",
      },
      owners: ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
      confirmationActions: [],
      auditedActions: [],
      rationale:
        "The quality report delegates topic edit navigation and read-only information presentation to Shared Row Actions; it declares no mutation capabilities.",
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

export type AdminCollectionSurfaceWorkflowClassification =
  | "full_collection_adoption"
  | "specialized_data_owner_shared_collection_presentation"
  | "page_system_only"
  | "fixed_structure_not_paginated"
  | "auth_out_of_scope";

/** Authenticated Collection surfaces cannot opt out of Shared Admin Chrome. */
export type AdminCollectionHeaderState = "adopted" | "auth_out_of_scope";

export type AdminCollectionRowActionsState =
  | "adopted"
  | "read_only_no_row_commands"
  | "not_applicable";

export type AdminCollectionPaginationState =
  | "adopted"
  | "not_required";

export type AdminCollectionQueryMode =
  | "server-page"
  | "bounded-client"
  | "small-fixed"
  | "specialized";

export type AdminCollectionAdoptionState = "adopted" | "not_applicable";

export type AdminCollectionReorderOwner =
  | "not_applicable"
  | "domain_owned_atomic_reorder";

export type AdminCollectionSurfaceInventoryEntry = {
  id: string;
  /** Collection lifecycle only; Admin Chrome is inherited structurally. */
  workflowClassification: AdminCollectionSurfaceWorkflowClassification;
  pageChromeAdoption: "adopted" | "auth_out_of_scope";
  collectionAdoption: AdminCollectionAdoptionState;
  generic: boolean;
  routes: readonly string[];
  pageSourceFiles: readonly string[];
  presentationSourceFiles: readonly string[];
  sourceOwner: string;
  headerOwner: "AdminPageContextHeader" | "not_applicable";
  engineLabel: string | null;
  headerState: AdminCollectionHeaderState;
  rowActionsState: AdminCollectionRowActionsState;
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
  paginationState: AdminCollectionPaginationState;
  paginationOwner:
    | "AdminTablePagination"
    | "specialized_surface"
    | "not_applicable";
  queryMode: AdminCollectionQueryMode;
  gridOwner:
    | "AdminEntityList"
    | "AdminDataGrid"
    | "MediaCatalog"
    | "not_applicable";
  layoutOwner: string;
  feedbackOwner: "AdminFeedbackProvider" | "not_applicable";
  confirmationOwner: "AdminConfirmDialog" | "not_applicable";
  reorderOwner: AdminCollectionReorderOwner;
  genuineExceptions: readonly string[];
  requiredAdoption: readonly string[];
  exceptionRationale: string | null;
  rationale: string;
};

const ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS = {
  pageChromeAdoption: "adopted",
  collectionAdoption: "adopted",
  feedbackOwner: "AdminFeedbackProvider",
  confirmationOwner: "AdminConfirmDialog",
  gridOwner: "AdminEntityList",
  reorderOwner: "not_applicable",
  genuineExceptions: [],
} as const;

const ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS = {
  pageChromeAdoption: "adopted",
  collectionAdoption: "not_applicable",
  feedbackOwner: "AdminFeedbackProvider",
  confirmationOwner: "AdminConfirmDialog",
  gridOwner: "not_applicable",
  reorderOwner: "not_applicable",
  genuineExceptions: [],
} as const;

const ADMIN_FIXED_SURFACE_DEFAULTS = {
  pageChromeAdoption: "adopted",
  collectionAdoption: "not_applicable",
  feedbackOwner: "AdminFeedbackProvider",
  confirmationOwner: "not_applicable",
  gridOwner: "not_applicable",
  reorderOwner: "not_applicable",
  genuineExceptions: [
    "The surface is a bounded structural or navigation composition, not a growing record collection.",
  ],
} as const;

const ADMIN_AUTH_SURFACE_DEFAULTS = {
  pageChromeAdoption: "auth_out_of_scope",
  collectionAdoption: "not_applicable",
  feedbackOwner: "not_applicable",
  confirmationOwner: "not_applicable",
  gridOwner: "not_applicable",
  reorderOwner: "not_applicable",
  genuineExceptions: [
    "Authentication routes intentionally render outside authenticated Admin Chrome.",
  ],
} as const;

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
  genericAdoptionGaps: [],
  canonicalSectionGap: "gap-7",
  canonicalTableFooterGap: "gap-4",
  ownerSourceFiles: {
    header: "src/components/admin/ui/AdminPageContextHeader.tsx",
    rowActions:
      "src/components/admin/ui/AdminDataGridRowActions.tsx",
    columns: "src/components/admin/entity-list/AdminEntityList.tsx",
    layout:
      "src/components/admin/entity-list/AdminEntityListSurface.tsx",
    pagination: "src/components/admin/ui/AdminTablePagination.tsx",
    query: "src/lib/admin/entity-list/data-engine/client-controller.ts",
  },
  surfaces: [
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "content-topics",
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/content/topics"],
      pageSourceFiles: ["src/app/admin/content/topics/page.tsx"],
      presentationSourceFiles: [
        "src/components/admin/content/TopicsListClient.tsx",
        "src/components/admin/content/UnifiedContentList.tsx",
      ],
      sourceOwner:
        "src/lib/admin/content/entity-list-adapters/topics.ts#topicsEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "UNIFIED CONTENT ENGINE",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic content collection with shared metrics, filters, configurable columns, pagination, and Row Actions.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "content-categories",
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/content/categories"],
      pageSourceFiles: ["src/app/admin/content/categories/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/content/categories/CategoriesListClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/content/entity-list-adapters/categories.ts#categoriesEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "CATEGORIES CONTROL",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic taxonomy collection; relation-aware delete remains a domain adapter behind shared presentation.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "content-series",
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/content/series"],
      pageSourceFiles: ["src/app/admin/content/series/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/content/series/SeriesTableClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/content/entity-list-adapters/series.ts#seriesEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "SERIES CONTROL",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic taxonomy collection using the same list, columns, pagination, and Row Actions owners.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "pages",
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/pages-blocks/pages"],
      pageSourceFiles: ["src/app/admin/pages-blocks/pages/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/pages/entity-list-adapter.ts#pagesEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "PAGES CONTROL",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic page collection now delegates table placement, optional columns, persistence, selection, and Row Actions to existing shared owners.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "projects-residential-commercial",
      genuineExceptions: [],
      workflowClassification: "full_collection_adoption",
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
      sourceOwner:
        "src/lib/admin/projects/entity-list-adapter.ts#projectsEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "PROJECTS CONTROL",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Residential and Commercial are locked Project query configurations over the same shared collection, publication-aware read model, columns, and action declaration.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "seo-redirects",
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/seo/redirects"],
      pageSourceFiles: ["src/app/admin/seo/redirects/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/seo/redirects/RedirectsClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/redirects/entity-list-adapter.ts#redirectsEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "SEO REDIRECTS",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic Redirect collection adopts shared placement and Row Actions; its compact domain schema intentionally exposes a fixed column set.",
    },
    {
      ...ADMIN_FIXED_SURFACE_DEFAULTS,
      id: "projects-hub",
      workflowClassification: "fixed_structure_not_paginated",
      generic: false,
      routes: ["/admin/projects"],
      pageSourceFiles: ["src/app/admin/projects/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/projects/projects-table/ProjectsHubCard.tsx",
      ],
      sourceOwner: "src/lib/projects/queries.ts#countProjectsByType",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "PROJECTS CONTROL",
      headerState: "adopted",
      rowActionsState: "read_only_no_row_commands",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "small-fixed",
      layoutOwner: "Projects hub composition",
      requiredAdoption: [],
      exceptionRationale:
        "Two fixed navigation cards form a chooser, not an entity collection lifecycle.",
      rationale:
        "The Project hub keeps the canonical collection header while its fixed chooser requires neither Row Actions nor pagination.",
    },
    {
      ...ADMIN_FIXED_SURFACE_DEFAULTS,
      id: "blocks-library-hub",
      workflowClassification: "fixed_structure_not_paginated",
      generic: false,
      routes: ["/admin/pages-blocks/blocks"],
      pageSourceFiles: ["src/app/admin/pages-blocks/blocks/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/blocks/page.tsx",
      ],
      sourceOwner: "src/app/admin/pages-blocks/blocks/page.tsx#modules",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "small-fixed",
      layoutOwner: "Page Composition module catalog",
      requiredAdoption: [],
      exceptionRationale:
        "Fixed module-definition cards navigate into specialized builders; they are not an entity collection lifecycle.",
      rationale:
        "The Page Composition catalog is a bounded module chooser with active, planned, and deprecated definitions.",
    },
    {
      ...ADMIN_FIXED_SURFACE_DEFAULTS,
      id: "dashboard-recent-content",
      workflowClassification: "fixed_structure_not_paginated",
      generic: false,
      routes: ["/admin"],
      pageSourceFiles: ["src/app/admin/page.tsx"],
      presentationSourceFiles: [
        "src/components/admin/dashboard/AdminDashboardView.tsx",
      ],
      sourceOwner:
        "src/lib/admin/dashboard/load-admin-dashboard.ts#loadAdminDashboard",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "small-fixed",
      layoutOwner: "AdminDashboardView",
      requiredAdoption: [],
      exceptionRationale:
        "The Dashboard view exposes bounded edit navigation but is not a standalone collection lifecycle.",
      rationale:
        "Recent content and projects are bounded read-model snapshots with local navigation inside the Dashboard composition.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "activity-log",
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/activity-log"],
      pageSourceFiles: ["src/app/admin/activity-log/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/activity-log/ActivityLogClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/audit/entity-list-adapter.ts#activityLogEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "ACTIVITY LOG",
      headerState: "adopted",
      rowActionsState: "read_only_no_row_commands",
      rowActionsOwner: "not_applicable",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Immutable audit rows have no commands, while query state and pagination use the existing Collection and Data owners.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "media-library",
      gridOwner: "MediaCatalog",
      genuineExceptions: [
        "Folder, upload, usage, picker, and safe-delete presentation remains the specialized Media Catalog rather than a tabular EntityList.",
      ],
      workflowClassification:
        "specialized_data_owner_shared_collection_presentation",
      generic: false,
      routes: ["/admin/media-library"],
      pageSourceFiles: ["src/app/admin/media-library/page.tsx"],
      presentationSourceFiles: [
        "src/components/admin/media/MediaLibraryCore.tsx",
      ],
      sourceOwner:
        "src/components/admin/media/MediaLibraryCore.tsx + src/app/api/admin/media-library/route.ts",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "specialized_surface",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "specialized",
      layoutOwner: "Media Library catalog",
      requiredAdoption: [],
      exceptionRationale:
        "Folder, upload, usage, and safe-delete data remain with Media Catalog while shared Page, Pagination, Feedback, Confirmation, and Scrollbar owners provide presentation.",
      rationale:
        "Folder, upload, usage, recovery, and safe-delete catalog lifecycle is materially different from a tabular entity collection.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "media-recovery-queue",
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/settings/media"],
      pageSourceFiles: ["src/app/admin/settings/media/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/settings/media/MediaRecoveryCenter.tsx",
      ],
      sourceOwner:
        "src/lib/admin/media-catalog/recovery.ts#listMediaRecoveryQueue+executeMediaRecoveryAction",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "specialized_surface",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "Media Settings recovery queue",
      requiredAdoption: [],
      exceptionRationale:
        "Recovery commands operate on guarded Storage and coordination states through the existing Media Catalog recovery owner, not a generic entity-row lifecycle.",
      rationale:
        "The bounded recovery queue retains its specialized confirmation, audit, verification, and fail-closed command lifecycle.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "construction-updates",
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/projects/construction-updates"],
      pageSourceFiles: [
        "src/app/admin/projects/construction-updates/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/projects/construction-updates/ConstructionUpdatesClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/projects/construction-updates-query.ts",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "Construction planning workspace",
      requiredAdoption: [],
      exceptionRationale:
        "The project, phase, update, and media aggregate is not a single generic collection.",
      rationale:
        "Project, phase, update, and media planning is an aggregate workflow rather than a single entity list.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "block-template-libraries",
      gridOwner: "AdminDataGrid",
      workflowClassification:
        "specialized_data_owner_shared_collection_presentation",
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
        "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
      ],
      sourceOwner: "Page Composition template list loaders and domain actions",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "specialized",
      layoutOwner: "AdminPageExperience + AdminDataGrid Contract",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "All eight template libraries share Collection presentation while their loaders and mutations remain owned by Page Composition.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "block-template-editors",
      workflowClassification: "page_system_only",
      generic: false,
      routes: [
        "/admin/pages-blocks/blocks/content/[id]",
        "/admin/pages-blocks/blocks/hero/[id]",
        "/admin/pages-blocks/blocks/breadcrumb/[id]",
        "/admin/pages-blocks/blocks/cards/[id]",
        "/admin/pages-blocks/blocks/cta/[id]",
        "/admin/pages-blocks/blocks/feed/[id]",
        "/admin/pages-blocks/blocks/media-hub/[id]",
        "/admin/pages-blocks/blocks/media-sidebar/[id]",
      ],
      pageSourceFiles: [
        "src/app/admin/pages-blocks/blocks/content/[id]/page.tsx",
        "src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx",
        "src/app/admin/pages-blocks/blocks/breadcrumb/[id]/page.tsx",
        "src/app/admin/pages-blocks/blocks/cards/[id]/page.tsx",
        "src/app/admin/pages-blocks/blocks/cta/[id]/page.tsx",
        "src/app/admin/pages-blocks/blocks/feed/[id]/page.tsx",
        "src/app/admin/pages-blocks/blocks/media-hub/[id]/page.tsx",
        "src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx",
      ],
      presentationSourceFiles: [
        "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
        "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
        "src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx",
        "src/components/admin/page-blocks/CardsModuleEditClient.tsx",
        "src/components/admin/page-blocks/CtaModuleEditClient.tsx",
        "src/components/admin/page-blocks/FeedModuleEditClient.tsx",
        "src/components/admin/page-blocks/MediaHubModuleEditClient.tsx",
        "src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx",
      ],
      sourceOwner: "Page Composition schema and form owners",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience + Form Runtime where applicable",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Schema editing remains specialized content inside the structurally inherited Shared Admin Page System.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "menus-list",
      gridOwner: "AdminDataGrid",
      workflowClassification:
        "specialized_data_owner_shared_collection_presentation",
      generic: false,
      routes: ["/admin/pages-blocks/menus"],
      pageSourceFiles: ["src/app/admin/pages-blocks/menus/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
      ],
      sourceOwner: "Menu list loader and menu domain actions",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "specialized",
      layoutOwner: "AdminPageExperience + AdminDataGrid Contract",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "The menu records adopt shared collection presentation while menu mutations remain with the Menu domain owner.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "menu-editor-shell",
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/pages-blocks/menus/[id]"],
      pageSourceFiles: ["src/app/admin/pages-blocks/menus/[id]/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx",
      ],
      sourceOwner: "Hierarchical Menu Builder aggregate",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "The builder workflow remains specialized while the nested Menu Items surface is inventoried separately.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      reorderOwner: "domain_owned_atomic_reorder",
      genuineExceptions: [],
      id: "menu-items",
      gridOwner: "AdminDataGrid",
      workflowClassification:
        "specialized_data_owner_shared_collection_presentation",
      generic: false,
      routes: ["/admin/pages-blocks/menus/[id]"],
      pageSourceFiles: ["src/app/admin/pages-blocks/menus/[id]/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
      ],
      sourceOwner: "Hierarchical Menu Item loader and domain actions",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "specialized",
      layoutOwner: "AdminDataGrid Contract",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Nested items share grid, actions, pagination, feedback, and confirmation; the Menu domain owns one hierarchy-aware atomic reorder mutation.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "page-composition-shell",
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/pages-blocks/pages/[id]"],
      pageSourceFiles: ["src/app/admin/pages-blocks/pages/[id]/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
      ],
      sourceOwner: "Page Composition aggregate",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Page editing is a specialized aggregate, while its module assignment collection is inventoried separately.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      reorderOwner: "domain_owned_atomic_reorder",
      genuineExceptions: [],
      id: "page-block-assignments",
      gridOwner: "AdminDataGrid",
      workflowClassification:
        "specialized_data_owner_shared_collection_presentation",
      generic: false,
      routes: ["/admin/pages-blocks/pages/[id]"],
      pageSourceFiles: ["src/app/admin/pages-blocks/pages/[id]/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
      ],
      sourceOwner: "Page composition assignment loader and actions",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "bounded-client",
      layoutOwner: "AdminPageExperience + Page composition assignment content",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "The complete assignment dataset is paginated by the shared bounded-client URL/history owner; Page Composition owns one cross-table atomic reorder mutation.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "footer-builder-shell",
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/pages-blocks/footer"],
      pageSourceFiles: ["src/app/admin/pages-blocks/footer/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx",
      ],
      sourceOwner: "Footer Builder form-session state",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "The Footer form session inherits Shared Admin Page, Feedback, and Confirmation owners.",
    },
    {
      ...ADMIN_FIXED_SURFACE_DEFAULTS,
      id: "footer-fixed-slots",
      workflowClassification: "fixed_structure_not_paginated",
      generic: false,
      routes: ["/admin/pages-blocks/footer"],
      pageSourceFiles: ["src/app/admin/pages-blocks/footer/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/footer/FooterBuilderEditors.tsx",
        "src/app/admin/pages-blocks/footer/FooterMenuPreviewDataGrid.tsx",
      ],
      sourceOwner: "Footer four-slot schema",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "small-fixed",
      layoutOwner: "Footer fixed four-slot editor",
      requiredAdoption: [],
      exceptionRationale:
        "Exactly four structural Footer slots are edited as one schema, not as growing records.",
      rationale:
        "The fixed slots retain their schema editor and are not forced into pagination or Entity List semantics.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      reorderOwner: "domain_owned_atomic_reorder",
      genuineExceptions: [
        "Manual-link order is bounded Footer form-session state and is persisted with the full Footer aggregate, not through a shared adjacent-row mutation.",
      ],
      id: "footer-manual-links",
      gridOwner: "AdminDataGrid",
      workflowClassification:
        "specialized_data_owner_shared_collection_presentation",
      generic: false,
      routes: ["/admin/pages-blocks/footer"],
      pageSourceFiles: ["src/app/admin/pages-blocks/footer/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
      ],
      sourceOwner: "Footer Builder form-session state",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "fixed_no_optional_columns",
      summaryCards: false,
      filtersOrToolbar: false,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "specialized",
      layoutOwner: "AdminPageExperience + Multi-slot Footer Builder content",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "In-memory nested link editing, ordering, and menu preview belong to one aggregate footer form session.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      genuineExceptions: [
        "Identity mutations, role validation, session invalidation, and self-protection remain with Auth and Permissions owners.",
      ],
      id: "users-and-roles",
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/users-roles"],
      pageSourceFiles: ["src/app/admin/users-roles/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/users-roles/UsersManagementClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/users/entity-list-adapter.ts#adminUsersEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "ADMIN USERS DATA ENGINE",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "The collection adopts the shared Data, Collection, columns, feedback, confirmation, and row-action owners while privileged identity mutations remain with the existing Auth domain.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "sitemap-monitor",
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/seo/sitemap"],
      pageSourceFiles: ["src/app/admin/seo/sitemap/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/seo/sitemap/SitemapMonitorClient.tsx",
      ],
      sourceOwner: "Sitemap diagnostics loader",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "read_only_no_row_commands",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "Sitemap diagnostics surface",
      requiredAdoption: [],
      exceptionRationale:
        "Diagnostics and global refresh do not expose a row-level collection lifecycle.",
      rationale:
        "Read-only diagnostics and refresh commands do not expose a generic entity collection lifecycle.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "content-editor-pages",
      workflowClassification: "page_system_only",
      generic: false,
      routes: [
        "/admin/content/topics/new",
        "/admin/content/topics/[id]",
        "/admin/content/topics/[id]/preview",
        "/admin/content/categories/new",
        "/admin/content/categories/[id]",
        "/admin/content/series/new",
        "/admin/content/series/[id]",
      ],
      pageSourceFiles: [
        "src/app/admin/content/topics/new/page.tsx",
        "src/app/admin/content/topics/[id]/page.tsx",
        "src/app/admin/content/topics/[id]/preview/page.tsx",
        "src/app/admin/content/categories/new/page.tsx",
        "src/app/admin/content/categories/[id]/page.tsx",
        "src/app/admin/content/series/new/page.tsx",
        "src/app/admin/content/series/[id]/page.tsx",
      ],
      presentationSourceFiles: [
        "src/components/admin/content/editors/ArticleCreateEditor.tsx",
        "src/components/admin/content/editors/ArticleEditor.tsx",
        "src/app/admin/content/categories/CategoryForm.tsx",
        "src/app/admin/content/series/SeriesForm.tsx",
      ],
      sourceOwner: "Admin Form Runtime and Content domain actions",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience + Admin Form Runtime",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Content editors reuse the Page System while their form lifecycle remains with the existing Form Runtime.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "project-editor-pages",
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/projects/new", "/admin/projects/[id]"],
      pageSourceFiles: [
        "src/app/admin/projects/new/page.tsx",
        "src/app/admin/projects/[id]/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/projects/ProjectEditForm.tsx",
      ],
      sourceOwner: "Project form and domain actions",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Project create and edit stay form surfaces inside Shared Admin Chrome.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "settings-pages",
      workflowClassification: "page_system_only",
      generic: false,
      routes: [
        "/admin/settings/general",
        "/admin/settings/security",
        "/admin/settings/theme",
        "/admin/settings/appearance",
        "/admin/settings/integrations",
        "/admin/settings/media",
      ],
      pageSourceFiles: [
        "src/app/admin/settings/general/page.tsx",
        "src/app/admin/settings/security/page.tsx",
        "src/app/admin/settings/theme/page.tsx",
        "src/app/admin/settings/appearance/page.tsx",
        "src/app/admin/settings/integrations/page.tsx",
        "src/app/admin/settings/media/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/settings/security/SecuritySettingsClient.tsx",
        "src/app/admin/settings/general/CompanyIdentityPanel.tsx",
        "src/app/admin/settings/general/MaintenanceModePanel.tsx",
        "src/app/admin/settings/media/MediaSettingsPanel.tsx",
        "src/components/admin/AdminPlaceholderPage.tsx",
      ],
      sourceOwner: "Settings domain panels and actions",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Settings forms and placeholders share Page, Feedback, and Confirmation owners without forced Collection semantics.",
    },
    {
      ...ADMIN_FIXED_SURFACE_DEFAULTS,
      id: "reports-hub",
      workflowClassification: "fixed_structure_not_paginated",
      generic: false,
      routes: [
        "/admin/reports",
        "/admin/reports/content",
        "/admin/reports/projects",
        "/admin/reports/analytics",
        "/admin/reports/seo",
        "/admin/reports/media",
        "/admin/reports/publishing",
        "/admin/reports/audit",
        "/admin/reports/system",
        "/admin/reports/business",
      ],
      pageSourceFiles: [
        "src/app/admin/reports/page.tsx",
        "src/app/admin/reports/[report]/page.tsx",
        "src/app/admin/reports/export/route.ts",
      ],
      presentationSourceFiles: [
        "src/components/admin/reports/AdminReportsView.tsx",
        "src/components/admin/reports/AdminReportDetailView.tsx",
        "src/components/admin/reports/AdminReportActions.tsx",
      ],
      sourceOwner:
        "src/lib/admin/reports/load-admin-reports.ts#loadAdminReports",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminPageExperience + Reports Information Architecture",
      requiredAdoption: [],
      exceptionRationale:
        "Reports compose aggregate read models and existing domain diagnostics; they are not a pageable entity collection.",
      rationale:
        "The Reports Capability owns composition, Information Architecture, URL filters, export, and failure semantics while Dashboard, Audit, SEO, Media, Content Review, and Analytics adapters retain their source ownership.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "seo-meta-manager",
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/seo/meta-manager"],
      pageSourceFiles: ["src/app/admin/seo/meta-manager/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/seo/meta-manager/MetaManagerClient.tsx",
      ],
      sourceOwner: "SEO metadata aggregate",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "SEO metadata editing remains an aggregate page workflow within Shared Admin Chrome.",
    },
    {
      ...ADMIN_AUTH_SURFACE_DEFAULTS,
      id: "admin-auth-pages",
      workflowClassification: "auth_out_of_scope",
      generic: false,
      routes: ["/admin/login", "/admin/forgot-password"],
      pageSourceFiles: [
        "src/app/admin/(auth)/login/page.tsx",
        "src/app/admin/(auth)/forgot-password/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/(auth)/login/page.tsx",
        "src/app/admin/(auth)/forgot-password/page.tsx",
      ],
      sourceOwner: "Authentication entry flow",
      headerOwner: "not_applicable",
      engineLabel: null,
      headerState: "auth_out_of_scope",
      rowActionsState: "not_applicable",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: false,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "Authentication layout",
      requiredAdoption: [],
      exceptionRationale:
        "Authentication pages intentionally precede authenticated Admin Chrome.",
      rationale:
        "Login and recovery remain explicitly outside the authenticated shell boundary.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "topics-without-image-report",
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/reports/topics-without-image"],
      pageSourceFiles: [
        "src/app/admin/reports/topics-without-image/page.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/media-catalog/topics-without-image-entity-list-adapter.ts#topicsWithoutImageEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "MEDIA QUALITY REPORT",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Read-only report rows expose only shared navigation and information commands, while query state and pagination use the existing Collection and Data owners.",
    },
  ],
} as const satisfies {
  scope: "all_admin_collection_and_list_surfaces";
  globalClosed: false;
  globalClosureBlockers: readonly string[];
  genericAdoptionGaps: readonly string[];
  canonicalSectionGap: "gap-7";
  canonicalTableFooterGap: "gap-4";
  ownerSourceFiles: Readonly<
    Record<
      "header" | "rowActions" | "columns" | "layout" | "pagination" | "query",
      string
    >
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
