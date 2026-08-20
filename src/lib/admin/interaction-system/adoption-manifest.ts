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
  scope: "platform_governance",
  globalClosed: true,
  globalClosureBlockers: [],
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
      "Entity collection query state, filters, selection, row and Bulk presentation, Bulk intent and confirmation requests, pagination, and collection interaction ownership; it never owns mutation execution lifecycle.",
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
      "Normalized entity data, request ownership, row and Bulk pending/blocking, optimistic mutation, snapshot, rollback, reconciliation, invalidation, and instrumentation.",
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

export type AdminSharedConsumerCapabilityDefinition = {
  owner: string;
  sourceFiles: readonly string[];
  sourceProofTokens: readonly string[];
  /** Signals that make the capability applicable, including non-canonical/local implementations. */
  applicabilitySourceTokens: readonly string[];
  /** Generic verifier patterns; matches are local/parallel evidence, never adoption proof. */
  localImplementationPatterns: readonly string[];
  ownerAvailability: "available" | "owner_extension_required";
  absenceMeansNotApplicable: boolean;
  consumerBoundaries: readonly ("collection" | "form")[];
};

function defineAdminSharedCapabilitySet<
  const TCapabilitySet extends Readonly<
    Record<string, AdminSharedConsumerCapabilityDefinition>
  >,
>(capabilitySet: TCapabilitySet) {
  return capabilitySet;
}

/**
 * Current Shared Capability Set for Admin consumers.
 *
 * This declaration lives in the existing adoption manifest and is the only
 * source for audit axes, canonical owners, and source-proof discovery. Adding
 * a capability here automatically expands every consumer audit; no parallel
 * key list, registry, fixed count, or audit branch is allowed.
 */
export const ADMIN_CURRENT_SHARED_CAPABILITY_SET =
  defineAdminSharedCapabilitySet({
    form_runtime: {
      owner: "AdminFormRuntime",
      sourceFiles: [
        "src/components/admin/ui/AdminFormRuntime.tsx",
        "src/lib/admin/form-runtime.ts",
      ],
      sourceProofTokens: ["AdminFormRuntime"],
      applicabilitySourceTokens: ["AdminFormRuntime", "<form"],
      localImplementationPatterns: ["<form\\b"],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["form"],
    },
    collection: {
      owner: "AdminEntityList",
      sourceFiles: ["src/components/admin/entity-list/AdminEntityList.tsx"],
      sourceProofTokens: ["AdminEntityList"],
      applicabilitySourceTokens: [
        "AdminEntityList",
        "useAdminEntityListController",
      ],
      localImplementationPatterns: [],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection"],
    },
    table: {
      owner: "AdminEntityListTable + AdminDataGrid",
      sourceFiles: [
        "src/components/admin/entity-list/AdminEntityListTable.tsx",
        "src/components/admin/ui/AdminDataGrid.tsx",
      ],
      sourceProofTokens: ["AdminEntityListTable", "AdminDataGrid"],
      applicabilitySourceTokens: [
        "AdminEntityListTable",
        "AdminDataGrid",
        "<table",
      ],
      localImplementationPatterns: ["<table\\b"],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection"],
    },
    toolbar: {
      owner: "AdminEntityListFilters",
      sourceFiles: [
        "src/components/admin/entity-list/AdminEntityListFilters.tsx",
      ],
      sourceProofTokens: ["toolbar="],
      applicabilitySourceTokens: ["toolbar=", "AdminEntityListFilters"],
      localImplementationPatterns: [],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection"],
    },
    search: {
      owner: "AdminEntityListFilters + Collection query contract",
      sourceFiles: [
        "src/components/admin/entity-list/AdminEntityListFilters.tsx",
        "src/lib/admin/entity-list/url-state.ts",
      ],
      sourceProofTokens: ["search: {", "search:{"],
      applicabilitySourceTokens: [
        "search: {",
        "search:{",
        'type="search"',
        "type='search'",
      ],
      localImplementationPatterns: ["type\\s*=\\s*[\"']search[\"']"],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection"],
    },
    pagination: {
      owner: "AdminTablePagination",
      sourceFiles: ["src/components/admin/ui/AdminTablePagination.tsx"],
      sourceProofTokens: ["AdminTablePagination"],
      applicabilitySourceTokens: ["AdminTablePagination"],
      localImplementationPatterns: [],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection"],
    },
    column_visibility: {
      owner: "AdminEntityList column preferences",
      sourceFiles: [
        "src/components/admin/entity-list/AdminEntityList.tsx",
        "src/lib/admin/preferences/admin-column-preferences.ts",
      ],
      sourceProofTokens: ["enableColumnManagement"],
      applicabilitySourceTokens: ["enableColumnManagement"],
      localImplementationPatterns: [],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection"],
    },
    row_actions: {
      owner: "Shared Admin Row Actions",
      sourceFiles: [
        "src/lib/admin/interaction-system/admin-row-actions-capability.ts",
        "src/components/admin/ui/AdminDataGridRowActions.tsx",
      ],
      sourceProofTokens: ["AdminDataGridRowActions"],
      applicabilitySourceTokens: ["AdminDataGridRowActions"],
      localImplementationPatterns: [],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection"],
    },
    visibility: {
      owner: "Shared Admin Row Actions visibility presentation",
      sourceFiles: [
        "src/lib/admin/interaction-system/admin-row-actions-capability.ts",
        "src/components/admin/ui/AdminDataGridRowActions.tsx",
      ],
      sourceProofTokens: ['display="visibility"', "display='visibility'"],
      applicabilitySourceTokens: [
        'display="visibility"',
        "display='visibility'",
      ],
      localImplementationPatterns: [
        "<AdminStatusPill\\b[\\s\\S]{0,220}(?:is_visible|publication_status)",
      ],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection"],
    },
    switch: {
      owner: "AdminFormSwitch",
      sourceFiles: ["src/components/admin/ui/AdminFormSwitch.tsx"],
      sourceProofTokens: ["AdminFormSwitch"],
      applicabilitySourceTokens: [
        "AdminFormSwitch",
        'role="switch"',
        "role='switch'",
      ],
      localImplementationPatterns: ["role\\s*=\\s*[\"']switch[\"']"],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["form"],
    },
    date_picker: {
      owner: "owner_extension_required",
      sourceFiles: [],
      sourceProofTokens: [],
      applicabilitySourceTokens: ['type="date"', "type='date'"],
      localImplementationPatterns: ["type\\s*=\\s*[\"']date[\"']"],
      ownerAvailability: "owner_extension_required",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["form"],
    },
    scrollbar: {
      owner: "Venesia scrollbar visual token",
      sourceFiles: ["src/components/venesia-scrollbar-styles.ts"],
      sourceProofTokens: [
        "VENESIA_SCROLLBAR_VISUAL_CLASSES",
        "ADMIN_SCROLLBAR_VISUAL_CLASSES",
        "VenesiaModal",
      ],
      applicabilitySourceTokens: [
        "VENESIA_SCROLLBAR_VISUAL_CLASSES",
        "ADMIN_SCROLLBAR_VISUAL_CLASSES",
        "VenesiaModal",
        "webkit-scrollbar",
      ],
      localImplementationPatterns: ["\\[&::?-webkit-scrollbar"],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection", "form"],
    },
    modal: {
      owner: "VenesiaModal",
      sourceFiles: ["src/components/admin/VenesiaModal.tsx"],
      sourceProofTokens: ["VenesiaModal"],
      applicabilitySourceTokens: [
        "VenesiaModal",
        'role="dialog"',
        "role='dialog'",
      ],
      localImplementationPatterns: ["role\\s*=\\s*[\"']dialog[\"']"],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["form"],
    },
    confirmation: {
      owner: "AdminConfirmDialog",
      sourceFiles: ["src/components/admin/ui/AdminConfirmDialog.tsx"],
      sourceProofTokens: [
        'mode: "shared"',
        "mode: 'shared'",
        "AdminConfirmDialog",
      ],
      applicabilitySourceTokens: [
        'mode: "shared"',
        "mode: 'shared'",
        "AdminConfirmDialog",
        "window.confirm",
      ],
      localImplementationPatterns: ["window\\.confirm\\s*\\("],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection", "form"],
    },
    media: {
      owner: "Existing Admin Media owner",
      sourceFiles: [
        "src/components/admin/media/AdminMediaGalleryField.tsx",
        "src/components/admin/media/AdminMediaPickerModal.tsx",
        "src/components/admin/media/MediaLibraryCore.tsx",
      ],
      sourceProofTokens: [
        "AdminMediaGallery",
        "AdminMediaImage",
        "AdminMediaFile",
        "AdminMediaPicker",
        "MediaLibraryCore",
      ],
      applicabilitySourceTokens: [
        "AdminMediaGallery",
        "AdminMediaImage",
        "AdminMediaFile",
        "AdminMediaPicker",
        "MediaLibraryCore",
        'type="file"',
        "type='file'",
      ],
      localImplementationPatterns: ["type\\s*=\\s*[\"']file[\"']"],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection", "form"],
    },
    feedback: {
      owner: "AdminFeedbackProvider",
      sourceFiles: [
        "src/components/admin/AdminFeedbackProvider.tsx",
        "src/lib/admin/admin-action-feedback.ts",
      ],
      sourceProofTokens: [
        "mapAdminActionResultToFeedback",
        "AdminFeedbackProvider",
      ],
      applicabilitySourceTokens: [
        "mapAdminActionResultToFeedback",
        "AdminFeedbackProvider",
        "window.alert",
      ],
      localImplementationPatterns: ["window\\.alert\\s*\\("],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection", "form"],
    },
    busy_state: {
      owner: "Admin Form/Data interaction state",
      sourceFiles: [
        "src/lib/admin/entity-list/data-engine/interaction-state.ts",
        "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
        "src/components/admin/ui/AdminFormRuntime.tsx",
      ],
      sourceProofTokens: [
        "useAdminEntityListController",
        "useAdminEntityInstantMutation",
        "AdminFormRuntime",
      ],
      applicabilitySourceTokens: [
        "useAdminEntityListController",
        "useAdminEntityInstantMutation",
        "AdminFormRuntime",
      ],
      localImplementationPatterns: [],
      ownerAvailability: "available",
      absenceMeansNotApplicable: true,
      consumerBoundaries: ["collection", "form"],
    },
  });

export type AdminConsumerCapabilityKey =
  keyof typeof ADMIN_CURRENT_SHARED_CAPABILITY_SET;

export function adminSharedCapabilityKeys<
  const TCapabilitySet extends Readonly<
    Record<string, AdminSharedConsumerCapabilityDefinition>
  >,
>(capabilitySet: TCapabilitySet) {
  return Object.keys(capabilitySet) as Array<keyof TCapabilitySet & string>;
}

export type AdminConsumerCapabilityAdoptionState =
  | "adopted"
  | "not_applicable"
  | "missing_adoption"
  | "owner_extension_required"
  | "approved_exception";

type AdminConsumerCapabilityStandardOverride = {
  state: Exclude<AdminConsumerCapabilityAdoptionState, "approved_exception">;
  rationale: string;
};

export type AdminConsumerCapabilityApprovedException = {
  state: "approved_exception";
  scope: string;
  approvingOwner: string;
  evidence: readonly string[];
  rationale: string;
};

export type AdminConsumerCapabilityOverride =
  | AdminConsumerCapabilityStandardOverride
  | AdminConsumerCapabilityApprovedException;

export type AdminConsumerCapabilityAuditDeclaration = {
  phase: "capability_applicability";
  overrides: Partial<
    Readonly<
      Record<AdminConsumerCapabilityKey, AdminConsumerCapabilityOverride>
    >
  >;
};

export function adminConsumerCapabilityAudit(
  overrides: AdminConsumerCapabilityAuditDeclaration["overrides"] = {},
): AdminConsumerCapabilityAuditDeclaration {
  return {
    phase: "capability_applicability",
    overrides,
  };
}

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
  Exclude<AdminRowActionPrimaryKind, "more"> | AdminRowActionMoreKind;

export type AdminRowActionsAdoptionActionState =
  "adopted" | "hidden" | "specialized_adapter";

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

export type AdminStatusIconAdoptionEntry = {
  entity: string;
  consumerSourceFile: string;
  dataMode: "server-page" | "bounded-client";
  publicationField: "status" | "publication_status";
  featuredField?: "is_featured" | "featured";
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
  globalClosed: true,
  globalClosureBlockers: [],
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
  instantMutationInteraction: {
    owner: "data_runtime",
    queryPending:
      "query-result transition only; Search, Filters, Toolbar, Sort, and Pagination remain interactive and never present busy",
    revalidating:
      "same-query post-success synchronization; never disables collection controls",
    rowPending:
      "the active row and target command only; unrelated rows remain interactive",
    bulkPending:
      "the only mutation scope allowed to block all row commands and bulk controls",
    layout:
      "pending presentation preserves the canonical DataGrid column and action geometry",
    directConsumers: [
      "src/components/admin/content/TopicsListClient.tsx",
      "src/app/admin/content/categories/CategoriesListClient.tsx",
      "src/app/admin/content/series/SeriesTableClient.tsx",
      "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
      "src/app/admin/projects/ProjectsTableClient.tsx",
      "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
      "src/app/admin/seo/redirects/RedirectsClient.tsx",
      "src/app/admin/users-roles/UsersManagementClient.tsx",
      "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
      "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
      "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
      "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
      "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
      "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
    ],
    domainOwnedRowLifecycleConsumers: [],
    genuineExceptions: [
      "Footer manual-link ordering is bounded form-session state persisted with the full Footer aggregate.",
    ],
  },
  inlineStatusExtension: {
    scope: "all_binary_publication_collections",
    owner: "shared_capabilities",
    runtime: "data_runtime",
    capability: "shared_admin_row_actions",
    adapter: "existing_domain_action_callbacks",
    inputContract: "AdminRowActionsCapability",
    outputContract: "inline_visibility_and_featured_action_state",
    sourceOfTruth: "domain_publication_and_featured_fields",
    icons: {
      published: "eye",
      unpublished: "eye_off",
      featured: "star_filled",
      notFeatured: "star_outline",
    },
    consumers: [
      {
        entity: "topics",
        consumerSourceFile:
          "src/components/admin/content/unified-content-columns.tsx",
        dataMode: "server-page",
        publicationField: "status",
        featuredField: "is_featured",
      },
      {
        entity: "topic_categories",
        consumerSourceFile:
          "src/app/admin/content/categories/categories-columns.tsx",
        dataMode: "server-page",
        publicationField: "status",
      },
      {
        entity: "topic_series",
        consumerSourceFile: "src/app/admin/content/series/series-columns.tsx",
        dataMode: "server-page",
        publicationField: "status",
      },
      {
        entity: "pages",
        consumerSourceFile:
          "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
        dataMode: "server-page",
        publicationField: "status",
      },
      {
        entity: "projects",
        consumerSourceFile:
          "src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx",
        dataMode: "server-page",
        publicationField: "publication_status",
        featuredField: "featured",
      },
      ...[
        "breadcrumb_block_templates",
        "cards_block_templates",
        "cta_block_templates",
        "feed_module_templates",
      ].map((entity) => ({
        entity,
        consumerSourceFile:
          "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
        dataMode: "bounded-client" as const,
        publicationField: "status" as const,
      })),
      {
        entity: "content_block_templates",
        consumerSourceFile:
          "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
        dataMode: "bounded-client",
        publicationField: "status",
      },
      {
        entity: "hero_templates",
        consumerSourceFile:
          "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
        dataMode: "bounded-client",
        publicationField: "status",
      },
      ...["media_hub_module_templates", "media_sidebar_module_templates"].map(
        (entity) => ({
          entity,
          consumerSourceFile:
            "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
          dataMode: "bounded-client" as const,
          publicationField: "status" as const,
        }),
      ),
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
      "src/lib/admin/entity-list/data-engine/interaction-state.ts",
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
    ...(
      [
        "project_locations_governorate",
        "project_locations_city",
        "project_locations_main_area",
        "project_locations_sub_area",
      ] as const
    ).map(
      (entity) =>
        ({
          entity,
          status: "adopted",
          consumerSourceFile:
            "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
          sourceFiles: [
            "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
            "src/app/admin/projects/locations/actions.ts",
            "src/lib/admin/projects/location-management-adapter.ts",
            "sql/migrations/20260814020750_location_management_foundation.sql",
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
            "All four Location levels share one Row Actions contract; the Location Domain owns guarded CRUD and hierarchy integrity while the shared renderer owns presentation.",
        }) as const,
    ),
    ...(
      [
        "project_tracking_stages",
        "project_tracking_items",
        "project_tracking_updates",
      ] as const
    ).map(
      (entity) =>
        ({
          entity,
          status: "adopted",
          consumerSourceFile:
            "src/components/admin/projects/tracking/TrackingCollections.tsx",
          sourceFiles: [
            "src/components/admin/projects/tracking/TrackingCollections.tsx",
            "src/app/admin/projects/tracking-actions.ts",
            "src/lib/admin/projects/tracking-adapter.ts",
            "sql/migrations/20260817170332_project_construction_tracking_detail.sql",
          ],
          manualOrder: false,
          actions: {
            edit: "adopted",
            preview: "adopted",
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
            "Tracking hierarchy rows delegate edit/navigation/information/delete and supported visibility presentation to Shared Row Actions; guarded Domain RPCs own child safety, audit, and mutation.",
        }) as const,
    ),
    {
      entity: "redirects",
      status: "adopted",
      consumerSourceFile: "src/app/admin/seo/redirects/RedirectsClient.tsx",
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
      consumerSourceFile: "src/app/admin/users-roles/UsersManagementClient.tsx",
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
  globalClosed: true;
  globalClosureBlockers: readonly string[];
  canonicalOrders: {
    primary: readonly AdminRowActionPrimaryKind[];
    more: readonly AdminRowActionMoreKind[];
  };
  instantMutationInteraction: {
    owner: "data_runtime";
    queryPending: string;
    revalidating: string;
    rowPending: string;
    bulkPending: string;
    layout: string;
    directConsumers: readonly string[];
    domainOwnedRowLifecycleConsumers: readonly string[];
    genuineExceptions: readonly string[];
  };
  inlineStatusExtension: {
    scope: "all_binary_publication_collections";
    owner: "shared_capabilities";
    runtime: "data_runtime";
    capability: "shared_admin_row_actions";
    adapter: "existing_domain_action_callbacks";
    inputContract: "AdminRowActionsCapability";
    outputContract: "inline_visibility_and_featured_action_state";
    sourceOfTruth: "domain_publication_and_featured_fields";
    icons: {
      published: "eye";
      unpublished: "eye_off";
      featured: "star_filled";
      notFeatured: "star_outline";
    };
    consumers: readonly AdminStatusIconAdoptionEntry[];
  };
  ownerSourceFiles: Readonly<
    Record<keyof AdminRowActionsExistingOwners, readonly string[]>
  >;
  entities: readonly AdminRowActionsAdoptionEntry[];
};

export type AdminCollectionSurfaceWorkflowClassification =
  | "full_collection_adoption"
  | "partial_collection_adoption"
  | "specialized_data_owner_shared_collection_presentation"
  | "page_system_only"
  | "fixed_structure_not_paginated"
  | "auth_out_of_scope";

/** Authenticated Collection surfaces cannot opt out of Shared Admin Chrome. */
export type AdminCollectionHeaderState = "adopted" | "auth_out_of_scope";

export type AdminCollectionRowActionsState =
  "adopted" | "read_only_no_row_commands" | "not_applicable";

export type AdminCollectionPaginationState = "adopted" | "not_required";

export type AdminCollectionQueryMode =
  "server-page" | "bounded-client" | "small-fixed" | "specialized";

export type AdminCollectionAdoptionState = "adopted" | "not_applicable";

export type AdminCollectionReorderOwner =
  "not_applicable" | "domain_owned_atomic_reorder";

export type AdminSemanticPresentationState =
  | "publication"
  | "visibility"
  | "progress"
  | "featured"
  | "archived"
  | "enabled";

export type AdminSemanticPresentationSurfaceContract = {
  state: AdminSemanticPresentationState;
  sourceFile: string;
  component: "AdminStatusPill";
  surface: "dedicated_status_column";
  rationale: string;
};

export type AdminCollectionSemanticPresentationContract = {
  owner:
    "shared_admin_row_actions" | "explicit_surface_contract" | "not_applicable";
  primaryCellContract: "identity_primary_content_only" | "not_applicable";
  governedStates: readonly AdminSemanticPresentationState[];
  sourceFiles: readonly string[];
  sourceObjectNames: readonly string[];
  sourceFieldNames: readonly string[];
  explicitSurfaceContracts: readonly AdminSemanticPresentationSurfaceContract[];
};

export type AdminCollectionConsumerAdoptionEvidence = {
  id: string;
  route: string;
  pageSourceFile: string;
  presentationOwner: string;
  applicability: AdminConsumerCapabilityAuditDeclaration;
  contracts: Readonly<
    Record<
      | "collection"
      | "table"
      | "toolbar"
      | "search"
      | "filters"
      | "header"
      | "columns"
      | "sort"
      | "row_actions"
      | "bulk"
      | "selection"
      | "pagination"
      | "runtime"
      | "data_registry",
      "adopted" | "not_required"
    >
  >;
  /** Tokens must resolve from this consumer's own page-to-presentation source graph. */
  sourceProofTokens: readonly string[];
  dataRegistryEntities: readonly AdminEntityListEntityKey[];
  genuineExceptions: readonly string[];
  requiredAdoption: readonly string[];
};

export type AdminCollectionSurfaceInventoryEntry = {
  id: string;
  /** Omitted means active; deprecated entries require owner-backed evidence. */
  lifecycle?: "active" | "deprecated";
  deprecationEvidence?: {
    owner: string;
    evidence: readonly string[];
  };
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
    "shared_admin_row_actions" | "specialized_surface" | "not_applicable";
  columnVisibility:
    "shared_optional_columns" | "fixed_no_optional_columns" | "not_applicable";
  summaryCards: boolean;
  filtersOrToolbar: boolean;
  paginationState: AdminCollectionPaginationState;
  paginationOwner:
    "AdminTablePagination" | "specialized_surface" | "not_applicable";
  queryMode: AdminCollectionQueryMode;
  /** Exact Data Runtime registry keys represented by this surface. */
  dataRegistryEntities: readonly AdminEntityListEntityKey[];
  gridOwner:
    "AdminEntityList" | "AdminDataGrid" | "MediaCatalog" | "not_applicable";
  layoutOwner: string;
  feedbackOwner: "AdminFeedbackProvider" | "not_applicable";
  confirmationOwner: "AdminConfirmDialog" | "not_applicable";
  reorderOwner: AdminCollectionReorderOwner;
  semanticPresentation: AdminCollectionSemanticPresentationContract;
  /** Per-consumer proof for grouped surfaces whose routes have distinct adapters or capabilities. */
  consumerAdoptionEvidence: readonly AdminCollectionConsumerAdoptionEvidence[];
  /** Declaration-first applicability plus explicit conditional capability decisions. */
  capabilityAudit: AdminConsumerCapabilityAuditDeclaration;
  genuineExceptions: readonly string[];
  requiredAdoption: readonly string[];
  exceptionRationale: string | null;
  rationale: string;
};

const ADMIN_NO_SEMANTIC_PRESENTATION = {
  owner: "not_applicable",
  primaryCellContract: "not_applicable",
  governedStates: [],
  sourceFiles: [],
  sourceObjectNames: [],
  sourceFieldNames: [],
  explicitSurfaceContracts: [],
} as const satisfies AdminCollectionSemanticPresentationContract;

const ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS = {
  owner: "shared_admin_row_actions",
  primaryCellContract: "identity_primary_content_only",
  explicitSurfaceContracts: [],
} as const;

const ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS = {
  pageChromeAdoption: "adopted",
  collectionAdoption: "adopted",
  feedbackOwner: "AdminFeedbackProvider",
  confirmationOwner: "AdminConfirmDialog",
  gridOwner: "AdminEntityList",
  dataRegistryEntities: [],
  reorderOwner: "not_applicable",
  semanticPresentation: ADMIN_NO_SEMANTIC_PRESENTATION,
  consumerAdoptionEvidence: [],
  genuineExceptions: [],
} as const;

const ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS = {
  pageChromeAdoption: "adopted",
  collectionAdoption: "not_applicable",
  feedbackOwner: "AdminFeedbackProvider",
  confirmationOwner: "AdminConfirmDialog",
  gridOwner: "not_applicable",
  dataRegistryEntities: [],
  reorderOwner: "not_applicable",
  semanticPresentation: ADMIN_NO_SEMANTIC_PRESENTATION,
  consumerAdoptionEvidence: [],
  genuineExceptions: [],
} as const;

const ADMIN_FIXED_SURFACE_DEFAULTS = {
  pageChromeAdoption: "adopted",
  collectionAdoption: "not_applicable",
  feedbackOwner: "AdminFeedbackProvider",
  confirmationOwner: "not_applicable",
  gridOwner: "not_applicable",
  dataRegistryEntities: [],
  reorderOwner: "not_applicable",
  semanticPresentation: ADMIN_NO_SEMANTIC_PRESENTATION,
  consumerAdoptionEvidence: [],
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
  dataRegistryEntities: [],
  reorderOwner: "not_applicable",
  semanticPresentation: ADMIN_NO_SEMANTIC_PRESENTATION,
  consumerAdoptionEvidence: [],
  genuineExceptions: [
    "Authentication routes intentionally render outside authenticated Admin Chrome.",
  ],
} as const;

const ADMIN_BLOCK_TEMPLATE_LIBRARY_CONTRACTS = {
  collection: "adopted",
  table: "adopted",
  toolbar: "adopted",
  search: "adopted",
  filters: "adopted",
  header: "adopted",
  columns: "adopted",
  sort: "adopted",
  row_actions: "adopted",
  bulk: "adopted",
  selection: "adopted",
  pagination: "adopted",
  runtime: "adopted",
  data_registry: "not_required",
} as const;

const ADMIN_BLOCK_TEMPLATE_LIBRARY_SOURCE_PROOF = [
  "AdminDataGrid",
  "AdminDataGridHeader",
  "AdminEntityListFilters",
  "AdminPageContextHeader",
  "AdminColumnVisibilityMenu",
  "AdminDataGridSortLabel",
  "AdminDataGridRowActions",
  "AdminBulkActionBar",
  "useAdminGridSelection",
  "AdminTablePagination",
  "useAdminBoundedClientInstantMutation",
] as const;

const ADMIN_TRACKING_CONSUMER_CONTRACTS = {
  collection: "adopted",
  table: "adopted",
  toolbar: "adopted",
  search: "adopted",
  filters: "adopted",
  header: "adopted",
  columns: "adopted",
  sort: "adopted",
  row_actions: "adopted",
  bulk: "not_required",
  selection: "not_required",
  pagination: "adopted",
  runtime: "adopted",
  data_registry: "adopted",
} as const;

/**
 * Exhaustive ledger for concrete Admin collection/list presentation sources.
 * The verifier scans AdminEntityList, AdminDataGrid, and native table consumers
 * and requires every concrete surface source to appear exactly once here.
 */
export const ADMIN_COLLECTION_SURFACE_ADOPTION = {
  scope: "all_admin_collection_and_list_surfaces",
  globalClosed: true,
  globalClosureBlockers: [],
  genericAdoptionGaps: [],
  canonicalSectionGap: "gap-7",
  canonicalTableFooterGap: "gap-4",
  ownerSourceFiles: {
    header: "src/components/admin/ui/AdminPageContextHeader.tsx",
    rowActions: "src/components/admin/ui/AdminDataGridRowActions.tsx",
    columns: "src/components/admin/entity-list/AdminEntityList.tsx",
    layout: "src/components/admin/entity-list/AdminEntityListSurface.tsx",
    pagination: "src/components/admin/ui/AdminTablePagination.tsx",
    query: [
      "src/lib/admin/entity-list/data-engine/client-controller.ts",
      "src/lib/admin/entity-list/bounded-client-pagination.ts",
    ],
  },
  surfaces: [
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "content-topics",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["publication", "featured", "archived"],
        sourceFiles: [
          "src/components/admin/content/unified-content-columns.tsx",
          "src/components/admin/content/UnifiedContentRowActions.tsx",
        ],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["status", "is_featured", "deleted_at"],
        explicitSurfaceContracts: [
          {
            state: "archived",
            sourceFile:
              "src/components/admin/content/unified-content-columns.tsx",
            component: "AdminStatusPill",
            surface: "dedicated_status_column",
            rationale:
              "Trash rows use the declared Status column to distinguish archived membership; publication and featured presentation remain with Shared Row Actions.",
          },
        ],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: ["topics"],
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic content collection with shared metrics, filters, configurable columns, pagination, and Row Actions.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "content-categories",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["publication", "archived"],
        sourceFiles: [
          "src/app/admin/content/categories/categories-columns.tsx",
        ],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["status", "deleted_at"],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: ["categories"],
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic taxonomy collection; relation-aware delete remains a domain adapter behind shared presentation.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "content-series",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["publication", "archived"],
        sourceFiles: ["src/app/admin/content/series/series-columns.tsx"],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["status", "deleted_at"],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: ["series"],
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic taxonomy collection using the same list, columns, pagination, and Row Actions owners.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "pages",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      engineLabel: "إدارة الصفحات والموديولات",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["publication"],
        sourceFiles: ["src/app/admin/pages-blocks/pages/PagesTableClient.tsx"],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["status"],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: ["pages"],
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic page collection now delegates table placement, optional columns, persistence, selection, and Row Actions to existing shared owners.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "projects-residential-commercial",
      capabilityAudit: adminConsumerCapabilityAudit(),
      genuineExceptions: [],
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/projects/residential", "/admin/projects/commercial"],
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["publication", "featured"],
        sourceFiles: [
          "src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx",
        ],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["publication_status", "featured"],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: ["projects"],
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Residential and Commercial are locked Project query configurations over the same shared collection, publication-aware read model, columns, and action declaration.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "project-locations",
      capabilityAudit: adminConsumerCapabilityAudit(),
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: [
        "/admin/projects/locations/governorates",
        "/admin/projects/locations/cities",
        "/admin/projects/locations/districts",
        "/admin/projects/locations/sub-districts",
      ],
      pageSourceFiles: [
        "src/app/admin/projects/locations/governorates/page.tsx",
        "src/app/admin/projects/locations/cities/page.tsx",
        "src/app/admin/projects/locations/districts/page.tsx",
        "src/app/admin/projects/locations/sub-districts/page.tsx",
        "src/app/admin/projects/locations/ProjectLocationManagementPage.tsx",
      ],
      presentationSourceFiles: [
        "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/projects/location-management-adapter.ts#projectLocationManagementResult",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "PROJECT LOCATION DOMAIN",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["enabled"],
        sourceFiles: [
          "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
        ],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["is_active"],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: [
        "project_locations_governorate",
        "project_locations_city",
        "project_locations_main_area",
        "project_locations_sub_area",
      ],
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Governorates, cities, districts, and sub-districts share one Location consumer that adopts the existing Collection/Data owners, optional-column persistence, shared sorting, Row Actions, and explicit no-bulk contract.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "seo-redirects",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["enabled"],
        sourceFiles: ["src/app/admin/seo/redirects/RedirectsClient.tsx"],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["status"],
        explicitSurfaceContracts: [
          {
            state: "enabled",
            sourceFile: "src/app/admin/seo/redirects/RedirectsClient.tsx",
            component: "AdminStatusPill",
            surface: "dedicated_status_column",
            rationale:
              "The declared Redirect Status column remains a compact read contract; the shared capability still owns visibility action presentation and Information.",
          },
        ],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: ["redirects"],
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Generic Redirect collection adopts shared placement and Row Actions; its compact domain schema intentionally exposes a fixed column set.",
    },
    {
      ...ADMIN_FIXED_SURFACE_DEFAULTS,
      id: "project-locations-hub",
      capabilityAudit: adminConsumerCapabilityAudit(),
      workflowClassification: "fixed_structure_not_paginated",
      generic: false,
      routes: ["/admin/projects/locations"],
      pageSourceFiles: ["src/app/admin/projects/locations/page.tsx"],
      presentationSourceFiles: ["src/app/admin/projects/locations/page.tsx"],
      sourceOwner:
        "src/lib/admin/projects/location-management-contract.ts#PROJECT_LOCATION_LEVEL_CONFIG",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "PROJECT LOCATION DOMAIN",
      headerState: "adopted",
      rowActionsState: "read_only_no_row_commands",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "small-fixed",
      layoutOwner: "AdminPageExperience",
      requiredAdoption: [],
      exceptionRationale:
        "The hub is a fixed four-level Domain navigation catalog, not a growing record collection.",
      rationale:
        "The fixed hub links the four canonical Location levels without owning their collection or mutation lifecycles.",
    },
    {
      ...ADMIN_FIXED_SURFACE_DEFAULTS,
      id: "projects-hub",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
      workflowClassification: "fixed_structure_not_paginated",
      generic: false,
      routes: ["/admin/pages-blocks/blocks"],
      pageSourceFiles: ["src/app/admin/pages-blocks/blocks/page.tsx"],
      presentationSourceFiles: ["src/app/admin/pages-blocks/blocks/page.tsx"],
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      dataRegistryEntities: ["activity_log"],
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Immutable audit rows have no commands, while query state and pagination use the existing Collection and Data owners.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "media-library",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      id: "construction-updates-hub",
      capabilityAudit: adminConsumerCapabilityAudit(),
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/projects/construction-updates"],
      pageSourceFiles: ["src/app/admin/projects/construction-updates/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/projects/construction-updates/ConstructionUpdatesClient.tsx",
      ],
      sourceOwner:
        "src/lib/admin/projects/tracking-hub.ts#loadProjectTrackingHub",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "read_only_no_row_commands",
      rowActionsOwner: "not_applicable",
      columnVisibility: "not_applicable",
      summaryCards: true,
      filtersOrToolbar: false,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "ConstructionUpdatesClient specialized project selector",
      requiredAdoption: [],
      exceptionRationale:
        "This is a dynamic project-selection and aggregate-summary hub, not a record Collection and not a fixed structural catalog.",
      rationale:
        "ConstructionUpdatesClient is classified Specialized inside the existing Page System contract; it does not claim Collection adoption.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "project-construction-tracking",
      capabilityAudit: adminConsumerCapabilityAudit({
        visibility: {
          state: "adopted",
          rationale:
            "Stage, Item, and Update visibility commands use the shared Row Actions Eye presentation.",
        },
      }),
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: [
        "/admin/projects/[id]/tracking",
        "/admin/projects/[id]/tracking/stages/[stageId]",
        "/admin/projects/[id]/tracking/items/[itemId]",
      ],
      pageSourceFiles: [
        "src/app/admin/projects/[id]/tracking/page.tsx",
        "src/app/admin/projects/[id]/tracking/stages/[stageId]/page.tsx",
        "src/app/admin/projects/[id]/tracking/items/[itemId]/page.tsx",
      ],
      presentationSourceFiles: [
        "src/components/admin/projects/tracking/TrackingCollections.tsx",
      ],
      sourceOwner:
        "src/lib/admin/projects/tracking-adapter.ts#trackingStagesEntityListAdapter+trackingItemsEntityListAdapter+trackingUpdatesEntityListAdapter",
      headerOwner: "AdminPageContextHeader",
      engineLabel: "PROJECT TRACKING DOMAIN",
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["progress"],
        sourceFiles: [
          "src/components/admin/projects/tracking/TrackingCollections.tsx",
        ],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["status", "derived_status"],
        explicitSurfaceContracts: [
          {
            state: "progress",
            sourceFile:
              "src/components/admin/projects/tracking/TrackingCollections.tsx",
            component: "AdminStatusPill",
            surface: "dedicated_status_column",
            rationale:
              "Stage-derived and Item-owned progress are explicit read columns; no percentage or parallel mutation owner is introduced.",
          },
        ],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: true,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: [
        "project_tracking_stages",
        "project_tracking_items",
        "project_tracking_updates",
      ],
      reorderOwner: "domain_owned_atomic_reorder",
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      consumerAdoptionEvidence: [
        {
          id: "project-tracking-stages",
          route: "/admin/projects/[id]/tracking",
          pageSourceFile: "src/app/admin/projects/[id]/tracking/page.tsx",
          presentationOwner:
            "src/components/admin/projects/tracking/TrackingCollections.tsx",
          applicability: adminConsumerCapabilityAudit({
            visibility: {
              state: "adopted",
              rationale: "Stage visibility adopts Shared Admin Row Actions.",
            },
          }),
          contracts: ADMIN_TRACKING_CONSUMER_CONTRACTS,
          sourceProofTokens: [
            "TrackingStagesCollection",
            "PROJECT_TRACKING_ENTITY_KEYS.stages",
            "useAdminEntityListController",
            "useAdminEntityInstantMutation",
          ],
          dataRegistryEntities: ["project_tracking_stages"],
          genuineExceptions: [],
          requiredAdoption: [],
        },
        {
          id: "project-tracking-items",
          route: "/admin/projects/[id]/tracking/stages/[stageId]",
          pageSourceFile:
            "src/app/admin/projects/[id]/tracking/stages/[stageId]/page.tsx",
          presentationOwner:
            "src/components/admin/projects/tracking/TrackingCollections.tsx",
          applicability: adminConsumerCapabilityAudit({
            visibility: {
              state: "adopted",
              rationale: "Item visibility adopts Shared Admin Row Actions.",
            },
          }),
          contracts: ADMIN_TRACKING_CONSUMER_CONTRACTS,
          sourceProofTokens: [
            "TrackingItemsCollection",
            "PROJECT_TRACKING_ENTITY_KEYS.items",
            "useAdminEntityListController",
            "useAdminEntityInstantMutation",
          ],
          dataRegistryEntities: ["project_tracking_items"],
          genuineExceptions: [],
          requiredAdoption: [],
        },
        {
          id: "project-tracking-updates",
          route: "/admin/projects/[id]/tracking/items/[itemId]",
          pageSourceFile:
            "src/app/admin/projects/[id]/tracking/items/[itemId]/page.tsx",
          presentationOwner:
            "src/components/admin/projects/tracking/TrackingCollections.tsx",
          applicability: adminConsumerCapabilityAudit({
            visibility: {
              state: "adopted",
              rationale:
                "Update publication visibility adopts Shared Admin Row Actions.",
            },
          }),
          contracts: ADMIN_TRACKING_CONSUMER_CONTRACTS,
          sourceProofTokens: [
            "TrackingUpdatesCollection",
            "PROJECT_TRACKING_ENTITY_KEYS.updates",
            "useAdminEntityListController",
            "useAdminEntityInstantMutation",
          ],
          dataRegistryEntities: ["project_tracking_updates"],
          genuineExceptions: [],
          requiredAdoption: [],
        },
      ],
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "The Project-scoped Stage, Item, and Update hierarchy exposes one shared Collection/Data owner per route while profile facts remain a singleton Form Runtime adopter and Media associations retain the existing Media Catalog coordination owner.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "block-template-libraries",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      queryMode: "bounded-client",
      layoutOwner: "AdminPageExperience + AdminDataGrid Contract",
      consumerAdoptionEvidence: [
        {
          id: "content-template-library",
          route: "/admin/pages-blocks/blocks/content",
          pageSourceFile: "src/app/admin/pages-blocks/blocks/content/page.tsx",
          presentationOwner:
            "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
          applicability: adminConsumerCapabilityAudit(),
          contracts: ADMIN_BLOCK_TEMPLATE_LIBRARY_CONTRACTS,
          sourceProofTokens: ADMIN_BLOCK_TEMPLATE_LIBRARY_SOURCE_PROOF,
          dataRegistryEntities: [],
          genuineExceptions: [],
          requiredAdoption: [],
        },
        {
          id: "hero-template-library",
          route: "/admin/pages-blocks/blocks/hero",
          pageSourceFile: "src/app/admin/pages-blocks/blocks/hero/page.tsx",
          presentationOwner:
            "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
          applicability: adminConsumerCapabilityAudit(),
          contracts: ADMIN_BLOCK_TEMPLATE_LIBRARY_CONTRACTS,
          sourceProofTokens: ADMIN_BLOCK_TEMPLATE_LIBRARY_SOURCE_PROOF,
          dataRegistryEntities: [],
          genuineExceptions: [],
          requiredAdoption: [],
        },
        ...(["breadcrumb", "cards", "cta", "feed"] as const).map(
          (moduleKind) => ({
            id: `${moduleKind}-template-library`,
            route: `/admin/pages-blocks/blocks/${moduleKind}`,
            pageSourceFile: `src/app/admin/pages-blocks/blocks/${moduleKind}/page.tsx`,
            presentationOwner:
              "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
            applicability: adminConsumerCapabilityAudit(),
            contracts: ADMIN_BLOCK_TEMPLATE_LIBRARY_CONTRACTS,
            sourceProofTokens: ADMIN_BLOCK_TEMPLATE_LIBRARY_SOURCE_PROOF,
            dataRegistryEntities: [],
            genuineExceptions: [],
            requiredAdoption: [],
          }),
        ),
        ...(["media-hub", "media-sidebar"] as const).map((moduleKind) => ({
          id: `${moduleKind}-template-library`,
          route: `/admin/pages-blocks/blocks/${moduleKind}`,
          pageSourceFile: `src/app/admin/pages-blocks/blocks/${moduleKind}/page.tsx`,
          presentationOwner:
            "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
          applicability: adminConsumerCapabilityAudit(),
          contracts: ADMIN_BLOCK_TEMPLATE_LIBRARY_CONTRACTS,
          sourceProofTokens: ADMIN_BLOCK_TEMPLATE_LIBRARY_SOURCE_PROOF,
          dataRegistryEntities: [],
          genuineExceptions: [
            "Create, duplicate, and delete are not supported by the current Media module domain action contract.",
          ],
          requiredAdoption: [],
        })),
      ],
      genuineExceptions: [],
      requiredAdoption: [],
      exceptionRationale:
        "Each template-library consumer proves search, filtering, sorting, selection, publication bulk actions, optional columns, pagination, Row Actions, and shared Runtime adoption independently. Unsupported Media lifecycle commands remain explicit at their two consumers.",
      rationale:
        "All eight template libraries use bounded-client query contracts, while per-consumer evidence prevents one grouped surface from hiding adoption drift between their distinct presentation adapters.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "block-template-editors",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
        "src/components/admin/page-blocks/ModuleEditorPresentation.tsx",
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
      layoutOwner:
        "AdminShell + AdminPageExperience + Form Runtime where applicable",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Schema editing remains specialized content inside the structurally inherited Shared Admin Page System; the shared Module Editor header preserves validated Page Composition return context while direct Library entry retains Library navigation.",
    },
    {
      ...ADMIN_FULL_COLLECTION_SURFACE_DEFAULTS,
      id: "menus-list",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["visibility"],
        sourceFiles: ["src/app/admin/pages-blocks/menus/MenusTableClient.tsx"],
        sourceObjectNames: ["menu"],
        sourceFieldNames: ["is_active"],
        explicitSurfaceContracts: [
          {
            state: "visibility",
            sourceFile: "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
            component: "AdminStatusPill",
            surface: "dedicated_status_column",
            rationale:
              "The declared menu Status column is an explicit list-reading contract; Shared Row Actions remains the mutation and Information presentation owner.",
          },
        ],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "bounded-client",
      layoutOwner: "AdminPageExperience + AdminDataGrid Contract",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "The menu records declare one bounded-client query contract owned by the shared Collection runtime while domain writes remain with the Menu owner.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "menu-editor-shell",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["visibility"],
        sourceFiles: [
          "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
        ],
        sourceObjectNames: ["item"],
        sourceFieldNames: ["is_visible"],
        explicitSurfaceContracts: [
          {
            state: "visibility",
            sourceFile:
              "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
            component: "AdminStatusPill",
            surface: "dedicated_status_column",
            rationale:
              "The declared item Status column is an explicit hierarchy-reading contract; Shared Row Actions remains the visibility mutation and Information presentation owner.",
          },
        ],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "bounded-client",
      layoutOwner: "AdminDataGrid Contract",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Nested items delegate query normalization, filtering, membership, URL history, and pagination to the shared bounded-client Collection owner; the Menu domain owns one hierarchy-aware atomic reorder mutation.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "page-composition-shell",
      capabilityAudit: adminConsumerCapabilityAudit(),
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/pages-blocks/pages/[id]"],
      pageSourceFiles: ["src/app/admin/pages-blocks/pages/[id]/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksHeader.tsx",
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
      capabilityAudit: adminConsumerCapabilityAudit(),
      gridOwner: "AdminDataGrid",
      workflowClassification:
        "specialized_data_owner_shared_collection_presentation",
      generic: false,
      routes: ["/admin/pages-blocks/pages/[id]"],
      pageSourceFiles: ["src/app/admin/pages-blocks/pages/[id]/page.tsx"],
      presentationSourceFiles: [
        "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
        "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
        "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx",
      ],
      sourceOwner: "Page composition assignment loader and actions",
      headerOwner: "AdminPageContextHeader",
      engineLabel: null,
      headerState: "adopted",
      rowActionsState: "adopted",
      rowActionsOwner: "shared_admin_row_actions",
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["publication", "visibility"],
        sourceFiles: [
          "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx",
        ],
        sourceObjectNames: ["row"],
        sourceFieldNames: [
          "template_status",
          "is_visible",
          "is_publicly_visible",
        ],
      },
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
        "The complete assignment dataset declares one shared bounded-client query lifecycle through the Collection owner; Page Composition owns one cross-table atomic reorder mutation.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "footer-builder-shell",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["visibility"],
        sourceFiles: [
          "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
        ],
        sourceObjectNames: ["item"],
        sourceFieldNames: ["visible"],
        explicitSurfaceContracts: [
          {
            state: "visibility",
            sourceFile:
              "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
            component: "AdminStatusPill",
            surface: "dedicated_status_column",
            rationale:
              "The declared manual-link Status column is an explicit Footer form-reading contract; Shared Row Actions remains the visibility action and Information presentation owner.",
          },
        ],
      },
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      semanticPresentation: {
        ...ADMIN_SHARED_SEMANTIC_PRESENTATION_DEFAULTS,
        governedStates: ["enabled"],
        sourceFiles: ["src/app/admin/users-roles/UsersManagementClient.tsx"],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["is_active"],
        explicitSurfaceContracts: [
          {
            state: "enabled",
            sourceFile: "src/app/admin/users-roles/UsersManagementClient.tsx",
            component: "AdminStatusPill",
            surface: "dedicated_status_column",
            rationale:
              "The declared account Status column remains an identity-management read contract; the shared capability owns enable/disable action presentation and Information.",
          },
        ],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: ["admin_users"],
      layoutOwner: "AdminEntityListPageLayout + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "The collection adopts the shared Data, Collection, columns, feedback, confirmation, and row-action owners while privileged identity mutations remain with the existing Auth domain.",
    },
    {
      ...ADMIN_PAGE_SYSTEM_SURFACE_DEFAULTS,
      id: "sitemap-monitor",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      filtersOrToolbar: false,
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
      workflowClassification: "page_system_only",
      generic: false,
      routes: ["/admin/projects/new", "/admin/projects/[id]"],
      pageSourceFiles: [
        "src/app/admin/projects/new/page.tsx",
        "src/app/admin/projects/[id]/page.tsx",
      ],
      presentationSourceFiles: ["src/app/admin/projects/ProjectEditForm.tsx"],
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
      capabilityAudit: adminConsumerCapabilityAudit({
        search: {
          state: "approved_exception",
          scope: "settings-pages:integrations-fixed-provider-search",
          approvingOwner: "Admin Collection adoption manifest",
          evidence: [
            "src/components/admin/integrations/AdminIntegrationsPlatform.tsx",
          ],
          rationale:
            "The Integrations platform is a fixed nine-provider catalog with bounded local search and is not a growing Collection consumer.",
        },
      }),
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
        "src/components/admin/integrations/AdminIntegrationsPlatform.tsx",
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
      filtersOrToolbar: true,
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
      layoutOwner: "AdminShell + AdminPageExperience",
      requiredAdoption: [],
      genuineExceptions: [
        "The Integrations platform is a fixed nine-provider catalog with local non-URL search/filter state; it is not a growing entity collection.",
      ],
      exceptionRationale:
        "The Integrations catalog retains its fixed specialized interaction state; the remaining Settings routes are form or placeholder surfaces.",
      rationale:
        "Settings forms and placeholders share Page, Feedback, and Confirmation owners without forced Collection semantics; the fixed Integrations catalog is explicitly inventoried as a specialized exception.",
    },
    {
      ...ADMIN_FIXED_SURFACE_DEFAULTS,
      id: "reports-hub",
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      filtersOrToolbar: false,
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
      capabilityAudit: adminConsumerCapabilityAudit(),
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
      capabilityAudit: adminConsumerCapabilityAudit(),
      workflowClassification: "full_collection_adoption",
      generic: true,
      routes: ["/admin/reports/topics-without-image"],
      pageSourceFiles: ["src/app/admin/reports/topics-without-image/page.tsx"],
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
      semanticPresentation: {
        owner: "explicit_surface_contract",
        primaryCellContract: "identity_primary_content_only",
        governedStates: ["publication"],
        sourceFiles: [
          "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
        ],
        sourceObjectNames: ["row"],
        sourceFieldNames: ["status"],
        explicitSurfaceContracts: [
          {
            state: "publication",
            sourceFile:
              "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
            component: "AdminStatusPill",
            surface: "dedicated_status_column",
            rationale:
              "The read-only report declares publication as a Status column and exposes no publication mutation capability.",
          },
        ],
      },
      columnVisibility: "shared_optional_columns",
      summaryCards: false,
      filtersOrToolbar: true,
      paginationState: "adopted",
      paginationOwner: "AdminTablePagination",
      queryMode: "server-page",
      dataRegistryEntities: ["topics_without_image"],
      layoutOwner: "AdminPageExperience + AdminEntityListSurface",
      requiredAdoption: [],
      exceptionRationale: null,
      rationale:
        "Read-only report rows expose only shared navigation and information commands, while query state and pagination use the existing Collection and Data owners.",
    },
  ],
} as const satisfies {
  scope: "all_admin_collection_and_list_surfaces";
  globalClosed: true;
  globalClosureBlockers: readonly string[];
  genericAdoptionGaps: readonly string[];
  canonicalSectionGap: "gap-7";
  canonicalTableFooterGap: "gap-4";
  ownerSourceFiles: Readonly<
    Record<
      "header" | "rowActions" | "columns" | "layout" | "pagination",
      string
    > & { query: readonly string[] }
  >;
  surfaces: readonly AdminCollectionSurfaceInventoryEntry[];
};

/**
 * A Full Adoption claim is a Quality Gate input, not descriptive prose.
 * Every required contract must be declared here and proven from the concrete
 * surface sources, shared owners, and Data Runtime registry by the governance
 * guard. A missing claim, missing axis, or unproven axis fails closed.
 */
export const ADMIN_COLLECTION_FULL_ADOPTION_REQUIRED_CONTRACTS = [
  "collection",
  "table",
  "toolbar",
  "header",
  "columns",
  "sort",
  "row_actions",
  "bulk",
  "runtime",
  "data_registry",
] as const;

export type AdminCollectionFullAdoptionContract =
  (typeof ADMIN_COLLECTION_FULL_ADOPTION_REQUIRED_CONTRACTS)[number];

export type AdminCollectionFullAdoptionContractState =
  "adopted" | "not_required";

export type AdminCollectionFullAdoptionClaim = {
  surfaceId: string;
  contracts: Readonly<
    Record<
      AdminCollectionFullAdoptionContract,
      AdminCollectionFullAdoptionContractState
    >
  >;
};

const ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS = {
  collection: "adopted",
  table: "adopted",
  toolbar: "adopted",
  header: "adopted",
  columns: "adopted",
  sort: "adopted",
  row_actions: "adopted",
  bulk: "not_required",
  runtime: "adopted",
  data_registry: "adopted",
} as const satisfies Readonly<
  Record<
    AdminCollectionFullAdoptionContract,
    AdminCollectionFullAdoptionContractState
  >
>;

export const ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS = [
  {
    surfaceId: "content-topics",
    contracts: {
      ...ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
      bulk: "adopted",
    },
  },
  {
    surfaceId: "content-categories",
    contracts: {
      ...ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
      bulk: "adopted",
    },
  },
  {
    surfaceId: "content-series",
    contracts: {
      ...ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
      bulk: "adopted",
    },
  },
  {
    surfaceId: "pages",
    contracts: {
      ...ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
      bulk: "adopted",
    },
  },
  {
    surfaceId: "projects-residential-commercial",
    contracts: ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
  },
  {
    surfaceId: "project-locations",
    contracts: ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
  },
  {
    surfaceId: "project-construction-tracking",
    contracts: ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
  },
  {
    surfaceId: "seo-redirects",
    contracts: {
      ...ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
      sort: "not_required",
    },
  },
  {
    surfaceId: "activity-log",
    contracts: {
      ...ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
      row_actions: "not_required",
    },
  },
  {
    surfaceId: "users-and-roles",
    contracts: {
      ...ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
      sort: "not_required",
    },
  },
  {
    surfaceId: "topics-without-image-report",
    contracts: ADMIN_COLLECTION_FULL_ADOPTION_BASE_CONTRACTS,
  },
] as const satisfies readonly AdminCollectionFullAdoptionClaim[];

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

/**
 * Product Surface Identity is an independent governance axis.
 *
 * It answers what lifecycle the user entered the surface to perform. It does
 * not infer identity from Collection/Form adoption, capability applicability,
 * or `workflowClassification`. Those ledgers remain independently governed;
 * Product Identity does not carry their declarations or registration ids.
 */
export const PRODUCT_SURFACE_TYPE_DEFINITIONS = {
  management_collection: {
    productIntent: "Manage a growing set of domain records.",
    userLifecycle: [
      "discover records",
      "query and refine",
      "inspect or select",
      "execute row or bulk intent",
      "observe reconciliation",
    ],
  },
  navigation_hub: {
    productIntent:
      "Understand available destinations and enter a downstream workflow.",
    userLifecycle: [
      "enter context",
      "scan destinations and status",
      "choose a destination",
    ],
  },
  dashboard: {
    productIntent:
      "Understand current platform state through bounded metrics and summaries.",
    userLifecycle: [
      "enter dashboard",
      "scan metrics and summaries",
      "identify attention",
      "navigate to an owning workflow",
    ],
  },
  analytical_report: {
    productIntent: "Answer a defined analytical or audit question.",
    userLifecycle: [
      "open report",
      "set report query",
      "inspect or drill down",
      "export or navigate to remediation",
    ],
  },
  form: {
    productIntent:
      "Create or edit one bounded record or singleton configuration.",
    userLifecycle: [
      "load values or defaults",
      "edit and validate",
      "submit",
      "observe feedback",
      "close or continue",
    ],
  },
  editor: {
    productIntent: "Author and review one rich domain aggregate.",
    userLifecycle: [
      "load draft",
      "edit aggregate concerns",
      "preview or review",
      "save or publish",
    ],
  },
  builder: {
    productIntent: "Compose and order a structured multi-node aggregate.",
    userLifecycle: [
      "load structure",
      "add remove or reorder nodes",
      "configure subresources",
      "validate and persist aggregate",
    ],
  },
  workspace: {
    productIntent:
      "Coordinate multiple independently owned workflows around one context.",
    userLifecycle: [
      "enter context",
      "choose a nested workflow",
      "complete the nested lifecycle",
      "return to context",
    ],
  },
  operational_console: {
    productIntent: "Inspect operational state and execute guarded commands.",
    userLifecycle: [
      "inspect state",
      "diagnose",
      "confirm guarded command",
      "observe result or retry",
    ],
  },
  asset_library: {
    productIntent:
      "Browse, select, upload, organize, and safely mutate media assets.",
    userLifecycle: [
      "browse or search assets",
      "select or manage",
      "upload edit move replace or delete",
      "return selection or persist result",
    ],
  },
  preview: {
    productIntent:
      "Inspect a read-only draft or effective representation before publication.",
    userLifecycle: ["render representation", "inspect", "return to editor"],
  },
  authentication_flow: {
    productIntent:
      "Establish an authenticated session and continue to the protected context.",
    userLifecycle: [
      "enter credentials",
      "authenticate",
      "establish session",
      "redirect or display error",
    ],
  },
  placeholder: {
    productIntent:
      "Explain that a product surface is intentionally unavailable.",
    userLifecycle: ["understand unavailable state", "navigate away"],
  },
  public_content_page: {
    productIntent: "Consume a composed public informational or marketing page.",
    userLifecycle: [
      "arrive",
      "consume composed content",
      "follow a public call to action",
    ],
  },
  public_discovery: {
    productIntent: "Discover and refine public content or domain records.",
    userLifecycle: [
      "enter public listing",
      "search filter sort or page",
      "select a public item",
    ],
  },
  public_detail: {
    productIntent:
      "Consume the canonical public representation of one published entity.",
    userLifecycle: [
      "resolve published entity",
      "consume detail",
      "continue discovery",
    ],
  },
  customer_self_service: {
    productIntent:
      "Let a customer inspect a domain workflow without Admin mutation authority.",
    userLifecycle: [
      "enter customer context",
      "resolve permitted domain data",
      "inspect progress and history",
      "navigate within the customer workflow",
    ],
  },
  system_gateway: {
    productIntent:
      "Represent a system-wide availability boundary and controlled access path.",
    userLifecycle: [
      "observe system state",
      "wait or authenticate through the allowed gateway",
      "continue when available",
    ],
  },
} as const satisfies Readonly<
  Record<
    string,
    {
      productIntent: string;
      userLifecycle: readonly [string, ...string[]];
    }
  >
>;

export type ProductSurfaceKind = keyof typeof PRODUCT_SURFACE_TYPE_DEFINITIONS;

export type ProductSurfaceScope =
  "admin_route" | "public_route" | "nested_surface";

export type ProductSurfaceRuntimeOwner =
  Exclude<AdminInteractionModuleId, "shared_capabilities"> | "not_applicable";

export type ProductSurfaceWorkflowOwner =
  | "audit_domain"
  | "authentication_domain"
  | "block_template_domain"
  | "content_domain"
  | "dashboard_domain"
  | "footer_domain"
  | "identity_access_domain"
  | "integrations_domain"
  | "maintenance_access_domain"
  | "media_catalog_domain"
  | "media_recovery_domain"
  | "menu_domain"
  | "page_composition_domain"
  | "page_definition_domain"
  | "project_domain"
  | "project_location_domain"
  | "project_tracking_domain"
  | "public_content_domain"
  | "public_media_center_domain"
  | "public_page_composition_domain"
  | "public_project_tracking_domain"
  | "public_projects_domain"
  | "reports_domain"
  | "security_domain"
  | "seo_diagnostics_domain"
  | "seo_metadata_domain"
  | "seo_redirect_domain"
  | "settings_domain"
  | "taxonomy_domain";

export type ProductSurfaceIdentity = {
  id: string;
  scope: ProductSurfaceScope;
  route: string | null;
  sourceFiles: readonly [string, ...string[]];
  productSurfaceKind: ProductSurfaceKind;
  productIntent: string;
  userLifecycle: readonly [string, ...string[]];
  workflowOwner: ProductSurfaceWorkflowOwner;
  runtimeOwners: readonly [
    ProductSurfaceRuntimeOwner,
    ...ProductSurfaceRuntimeOwner[],
  ];
  nestedParent: string | null;
  nestedChildren: readonly string[];
};

type ProductSurfaceIdentityDeclaration = Omit<
  ProductSurfaceIdentity,
  "productIntent" | "userLifecycle"
>;

function defineProductSurfaceIdentity<
  const TDeclaration extends ProductSurfaceIdentityDeclaration,
>(declaration: TDeclaration): ProductSurfaceIdentity {
  const definition =
    PRODUCT_SURFACE_TYPE_DEFINITIONS[declaration.productSurfaceKind];
  return {
    ...declaration,
    productIntent: definition.productIntent,
    userLifecycle: definition.userLifecycle,
  };
}

export const PRODUCT_SURFACE_IDENTITIES = [
  // Admin route surfaces: authentication, dashboard, content, and media.
  defineProductSurfaceIdentity({
    id: "admin-forgot-password-placeholder",
    scope: "admin_route",
    route: "/admin/forgot-password",
    sourceFiles: ["src/app/admin/(auth)/forgot-password/page.tsx"],
    productSurfaceKind: "placeholder",
    workflowOwner: "authentication_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-login-authentication",
    scope: "admin_route",
    route: "/admin/login",
    sourceFiles: ["src/app/admin/(auth)/login/page.tsx"],
    productSurfaceKind: "authentication_flow",
    workflowOwner: "authentication_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-dashboard",
    scope: "admin_route",
    route: "/admin",
    sourceFiles: ["src/app/admin/page.tsx"],
    productSurfaceKind: "dashboard",
    workflowOwner: "dashboard_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: ["admin-dashboard-recent-content"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-activity-log-report",
    scope: "admin_route",
    route: "/admin/activity-log",
    sourceFiles: ["src/app/admin/activity-log/page.tsx"],
    productSurfaceKind: "analytical_report",
    workflowOwner: "audit_domain",
    runtimeOwners: ["collection_runtime", "data_runtime"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-categories-collection",
    scope: "admin_route",
    route: "/admin/content/categories",
    sourceFiles: ["src/app/admin/content/categories/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "taxonomy_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: null,
    nestedChildren: [
      "admin-content-category-create-form",
      "admin-content-category-edit-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-category-create-form",
    scope: "admin_route",
    route: "/admin/content/categories/new",
    sourceFiles: ["src/app/admin/content/categories/new/page.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "taxonomy_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-content-categories-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-category-edit-form",
    scope: "admin_route",
    route: "/admin/content/categories/[id]",
    sourceFiles: ["src/app/admin/content/categories/[id]/page.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "taxonomy_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-content-categories-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-series-collection",
    scope: "admin_route",
    route: "/admin/content/series",
    sourceFiles: ["src/app/admin/content/series/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "taxonomy_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: null,
    nestedChildren: [
      "admin-content-series-create-form",
      "admin-content-series-edit-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-series-create-form",
    scope: "admin_route",
    route: "/admin/content/series/new",
    sourceFiles: ["src/app/admin/content/series/new/page.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "taxonomy_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-content-series-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-series-edit-form",
    scope: "admin_route",
    route: "/admin/content/series/[id]",
    sourceFiles: ["src/app/admin/content/series/[id]/page.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "taxonomy_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-content-series-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-topics-collection",
    scope: "admin_route",
    route: "/admin/content/topics",
    sourceFiles: ["src/app/admin/content/topics/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "content_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: null,
    nestedChildren: [
      "admin-content-topic-create-editor",
      "admin-content-topic-edit-editor",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-topic-create-editor",
    scope: "admin_route",
    route: "/admin/content/topics/new",
    sourceFiles: ["src/app/admin/content/topics/new/page.tsx"],
    productSurfaceKind: "editor",
    workflowOwner: "content_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-content-topics-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-topic-edit-editor",
    scope: "admin_route",
    route: "/admin/content/topics/[id]",
    sourceFiles: ["src/app/admin/content/topics/[id]/page.tsx"],
    productSurfaceKind: "editor",
    workflowOwner: "content_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-content-topics-collection",
    nestedChildren: ["admin-content-topic-preview"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-topic-preview",
    scope: "admin_route",
    route: "/admin/content/topics/[id]/preview",
    sourceFiles: ["src/app/admin/content/topics/[id]/preview/page.tsx"],
    productSurfaceKind: "preview",
    workflowOwner: "content_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-content-topic-edit-editor",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-library",
    scope: "admin_route",
    route: "/admin/media-library",
    sourceFiles: ["src/app/admin/media-library/page.tsx"],
    productSurfaceKind: "asset_library",
    workflowOwner: "media_catalog_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: null,
    nestedChildren: ["admin-media-usage-panel"],
  }),
  // Admin route surfaces: page definitions, block templates, menus, and footer.
  defineProductSurfaceIdentity({
    id: "admin-blocks-library-hub",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/page.tsx"],
    productSurfaceKind: "navigation_hub",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [
      "admin-breadcrumb-blocks-collection",
      "admin-cards-blocks-collection",
      "admin-content-blocks-collection",
      "admin-cta-blocks-collection",
      "admin-feed-blocks-collection",
      "admin-hero-blocks-collection",
      "admin-media-hub-blocks-collection",
      "admin-media-sidebar-blocks-collection",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-breadcrumb-blocks-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/breadcrumb",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/breadcrumb/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "block_template_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-blocks-library-hub",
    nestedChildren: [
      "admin-breadcrumb-block-builder",
      "admin-breadcrumb-block-create-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-breadcrumb-block-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/breadcrumb/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/breadcrumb/[id]/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-breadcrumb-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-cards-blocks-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/cards",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/cards/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "block_template_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-blocks-library-hub",
    nestedChildren: [
      "admin-cards-block-builder",
      "admin-cards-block-create-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-cards-block-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/cards/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/cards/[id]/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-cards-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-blocks-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/content",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/content/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "block_template_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-blocks-library-hub",
    nestedChildren: [
      "admin-content-block-builder",
      "admin-content-block-create-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-block-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/content/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/content/[id]/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-content-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-cta-blocks-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/cta",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/cta/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "block_template_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-blocks-library-hub",
    nestedChildren: ["admin-cta-block-builder", "admin-cta-block-create-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-cta-block-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/cta/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/cta/[id]/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-cta-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-feed-blocks-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/feed",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/feed/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "block_template_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-blocks-library-hub",
    nestedChildren: [
      "admin-feed-block-builder",
      "admin-feed-block-create-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-feed-block-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/feed/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/feed/[id]/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-feed-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-hero-blocks-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/hero",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/hero/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "block_template_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-blocks-library-hub",
    nestedChildren: [
      "admin-hero-block-builder",
      "admin-hero-block-create-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-hero-block-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/hero/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-hero-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-hub-blocks-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/media-hub",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/media-hub/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "block_template_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-blocks-library-hub",
    nestedChildren: ["admin-media-hub-block-builder"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-hub-block-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/media-hub/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/media-hub/[id]/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-media-hub-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-sidebar-blocks-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/media-sidebar",
    sourceFiles: ["src/app/admin/pages-blocks/blocks/media-sidebar/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "block_template_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-blocks-library-hub",
    nestedChildren: ["admin-media-sidebar-block-builder"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-sidebar-block-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/blocks/media-sidebar/[id]",
    sourceFiles: [
      "src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx",
    ],
    productSurfaceKind: "builder",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-media-sidebar-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-menus-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/menus",
    sourceFiles: ["src/app/admin/pages-blocks/menus/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "menu_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: null,
    nestedChildren: ["admin-menu-builder", "admin-menu-quick-create-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-menu-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/menus/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/menus/[id]/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "menu_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-menus-collection",
    nestedChildren: ["admin-menu-items-collection", "admin-menu-item-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-page-definitions-collection",
    scope: "admin_route",
    route: "/admin/pages-blocks/pages",
    sourceFiles: ["src/app/admin/pages-blocks/pages/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "page_definition_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: null,
    nestedChildren: [
      "admin-page-composition-workspace",
      "admin-page-quick-create-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-page-composition-workspace",
    scope: "admin_route",
    route: "/admin/pages-blocks/pages/[id]",
    sourceFiles: ["src/app/admin/pages-blocks/pages/[id]/page.tsx"],
    productSurfaceKind: "workspace",
    workflowOwner: "page_composition_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-page-definitions-collection",
    nestedChildren: [
      "admin-page-composition-builder",
      "admin-page-block-assignments-collection",
      "admin-page-block-assignment-form",
      "admin-page-seo-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-footer-builder",
    scope: "admin_route",
    route: "/admin/pages-blocks/footer",
    sourceFiles: ["src/app/admin/pages-blocks/footer/page.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "footer_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: null,
    nestedChildren: [
      "admin-footer-fixed-slots-builder",
      "admin-footer-manual-links-collection",
      "admin-footer-link-form",
    ],
  }),
  // Admin route surfaces: projects and construction tracking.
  defineProductSurfaceIdentity({
    id: "admin-projects-hub",
    scope: "admin_route",
    route: "/admin/projects",
    sourceFiles: ["src/app/admin/projects/page.tsx"],
    productSurfaceKind: "navigation_hub",
    workflowOwner: "project_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [
      "admin-residential-projects-collection",
      "admin-commercial-projects-collection",
      "admin-construction-updates-hub",
      "admin-project-locations-hub",
      "admin-project-create-editor",
      "admin-project-edit-editor",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-residential-projects-collection",
    scope: "admin_route",
    route: "/admin/projects/residential",
    sourceFiles: ["src/app/admin/projects/residential/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-projects-hub",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-commercial-projects-collection",
    scope: "admin_route",
    route: "/admin/projects/commercial",
    sourceFiles: ["src/app/admin/projects/commercial/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-projects-hub",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-construction-updates-hub",
    scope: "admin_route",
    route: "/admin/projects/construction-updates",
    sourceFiles: ["src/app/admin/projects/construction-updates/page.tsx"],
    productSurfaceKind: "navigation_hub",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-projects-hub",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-locations-hub",
    scope: "admin_route",
    route: "/admin/projects/locations",
    sourceFiles: ["src/app/admin/projects/locations/page.tsx"],
    productSurfaceKind: "navigation_hub",
    workflowOwner: "project_location_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-projects-hub",
    nestedChildren: [
      "admin-governorates-collection",
      "admin-cities-collection",
      "admin-districts-collection",
      "admin-sub-districts-collection",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-governorates-collection",
    scope: "admin_route",
    route: "/admin/projects/locations/governorates",
    sourceFiles: ["src/app/admin/projects/locations/governorates/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_location_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-project-locations-hub",
    nestedChildren: ["admin-governorate-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-cities-collection",
    scope: "admin_route",
    route: "/admin/projects/locations/cities",
    sourceFiles: ["src/app/admin/projects/locations/cities/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_location_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-project-locations-hub",
    nestedChildren: ["admin-city-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-districts-collection",
    scope: "admin_route",
    route: "/admin/projects/locations/districts",
    sourceFiles: ["src/app/admin/projects/locations/districts/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_location_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-project-locations-hub",
    nestedChildren: ["admin-district-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-sub-districts-collection",
    scope: "admin_route",
    route: "/admin/projects/locations/sub-districts",
    sourceFiles: ["src/app/admin/projects/locations/sub-districts/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_location_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-project-locations-hub",
    nestedChildren: ["admin-sub-district-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-create-editor",
    scope: "admin_route",
    route: "/admin/projects/new",
    sourceFiles: ["src/app/admin/projects/new/page.tsx"],
    productSurfaceKind: "editor",
    workflowOwner: "project_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-projects-hub",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-edit-editor",
    scope: "admin_route",
    route: "/admin/projects/[id]",
    sourceFiles: ["src/app/admin/projects/[id]/page.tsx"],
    productSurfaceKind: "editor",
    workflowOwner: "project_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-projects-hub",
    nestedChildren: [
      "admin-project-preview",
      "admin-project-tracking-workspace",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-preview",
    scope: "admin_route",
    route: "/admin/projects/[id]/preview",
    sourceFiles: ["src/app/admin/projects/[id]/preview/page.tsx"],
    productSurfaceKind: "preview",
    workflowOwner: "project_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-project-edit-editor",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-workspace",
    scope: "admin_route",
    route: "/admin/projects/[id]/tracking",
    sourceFiles: ["src/app/admin/projects/[id]/tracking/page.tsx"],
    productSurfaceKind: "workspace",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-project-edit-editor",
    nestedChildren: [
      "admin-project-tracking-stage-workspace",
      "admin-project-tracking-stages-collection",
      "admin-project-tracking-profile-form",
      "admin-project-tracking-stage-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-stage-workspace",
    scope: "admin_route",
    route: "/admin/projects/[id]/tracking/stages/[stageId]",
    sourceFiles: [
      "src/app/admin/projects/[id]/tracking/stages/[stageId]/page.tsx",
    ],
    productSurfaceKind: "workspace",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-project-tracking-workspace",
    nestedChildren: [
      "admin-project-tracking-item-workspace",
      "admin-project-tracking-items-collection",
      "admin-project-tracking-item-form",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-item-workspace",
    scope: "admin_route",
    route: "/admin/projects/[id]/tracking/items/[itemId]",
    sourceFiles: [
      "src/app/admin/projects/[id]/tracking/items/[itemId]/page.tsx",
    ],
    productSurfaceKind: "workspace",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-project-tracking-stage-workspace",
    nestedChildren: [
      "admin-project-tracking-updates-collection",
      "admin-project-tracking-update-form",
    ],
  }),
  // Admin route surfaces: reports, SEO, settings, integrations, and identity.
  defineProductSurfaceIdentity({
    id: "admin-reports-hub",
    scope: "admin_route",
    route: "/admin/reports",
    sourceFiles: ["src/app/admin/reports/page.tsx"],
    productSurfaceKind: "navigation_hub",
    workflowOwner: "reports_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [
      "admin-report-detail",
      "admin-topics-without-image-report",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-report-detail",
    scope: "admin_route",
    route: "/admin/reports/[report]",
    sourceFiles: ["src/app/admin/reports/[report]/page.tsx"],
    productSurfaceKind: "analytical_report",
    workflowOwner: "reports_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-reports-hub",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-topics-without-image-report",
    scope: "admin_route",
    route: "/admin/reports/topics-without-image",
    sourceFiles: ["src/app/admin/reports/topics-without-image/page.tsx"],
    productSurfaceKind: "analytical_report",
    workflowOwner: "media_catalog_domain",
    runtimeOwners: ["collection_runtime", "data_runtime"],
    nestedParent: "admin-reports-hub",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-seo-meta-form",
    scope: "admin_route",
    route: "/admin/seo/meta-manager",
    sourceFiles: ["src/app/admin/seo/meta-manager/page.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "seo_metadata_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-seo-redirects-collection",
    scope: "admin_route",
    route: "/admin/seo/redirects",
    sourceFiles: ["src/app/admin/seo/redirects/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "seo_redirect_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: null,
    nestedChildren: ["admin-seo-redirect-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-sitemap-console",
    scope: "admin_route",
    route: "/admin/seo/sitemap",
    sourceFiles: ["src/app/admin/seo/sitemap/page.tsx"],
    productSurfaceKind: "operational_console",
    workflowOwner: "seo_diagnostics_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-appearance-placeholder",
    scope: "admin_route",
    route: "/admin/settings/appearance",
    sourceFiles: ["src/app/admin/settings/appearance/page.tsx"],
    productSurfaceKind: "placeholder",
    workflowOwner: "settings_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-general-settings-workspace",
    scope: "admin_route",
    route: "/admin/settings/general",
    sourceFiles: ["src/app/admin/settings/general/page.tsx"],
    productSurfaceKind: "workspace",
    workflowOwner: "settings_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [
      "admin-company-identity-form",
      "admin-maintenance-mode-console",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-integrations-hub",
    scope: "admin_route",
    route: "/admin/settings/integrations",
    sourceFiles: ["src/app/admin/settings/integrations/page.tsx"],
    productSurfaceKind: "navigation_hub",
    workflowOwner: "integrations_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [
      "admin-integration-console",
      "admin-integrations-server-console",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-integration-console",
    scope: "admin_route",
    route: "/admin/settings/integrations/[integration]",
    sourceFiles: ["src/app/admin/settings/integrations/[integration]/page.tsx"],
    productSurfaceKind: "operational_console",
    workflowOwner: "integrations_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-integrations-hub",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-integrations-server-console",
    scope: "admin_route",
    route: "/admin/settings/integrations/server-configuration",
    sourceFiles: [
      "src/app/admin/settings/integrations/server-configuration/page.tsx",
    ],
    productSurfaceKind: "operational_console",
    workflowOwner: "integrations_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-integrations-hub",
    nestedChildren: ["admin-integrations-server-credentials-form"],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-settings-workspace",
    scope: "admin_route",
    route: "/admin/settings/media",
    sourceFiles: ["src/app/admin/settings/media/page.tsx"],
    productSurfaceKind: "workspace",
    workflowOwner: "settings_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [
      "admin-media-settings-form",
      "admin-media-recovery-console",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-security-console",
    scope: "admin_route",
    route: "/admin/settings/security",
    sourceFiles: ["src/app/admin/settings/security/page.tsx"],
    productSurfaceKind: "operational_console",
    workflowOwner: "security_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: null,
    nestedChildren: [
      "admin-security-password-form",
      "admin-security-account-form",
      "admin-security-sessions-console",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "admin-theme-placeholder",
    scope: "admin_route",
    route: "/admin/settings/theme",
    sourceFiles: ["src/app/admin/settings/theme/page.tsx"],
    productSurfaceKind: "placeholder",
    workflowOwner: "settings_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-users-roles-collection",
    scope: "admin_route",
    route: "/admin/users-roles",
    sourceFiles: ["src/app/admin/users-roles/page.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "identity_access_domain",
    runtimeOwners: [
      "collection_runtime",
      "data_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: null,
    nestedChildren: ["admin-user-form"],
  }),
  // Public route surfaces.
  defineProductSurfaceIdentity({
    id: "public-home-content",
    scope: "public_route",
    route: "/",
    sourceFiles: ["src/app/(site)/page.tsx"],
    productSurfaceKind: "public_content_page",
    workflowOwner: "public_page_composition_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-about-content",
    scope: "public_route",
    route: "/about",
    sourceFiles: ["src/app/(site)/about/page.tsx"],
    productSurfaceKind: "public_content_page",
    workflowOwner: "public_page_composition_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-contact-content",
    scope: "public_route",
    route: "/contact",
    sourceFiles: ["src/app/(site)/contact/page.tsx"],
    productSurfaceKind: "public_content_page",
    workflowOwner: "public_page_composition_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-dynamic-cms-content",
    scope: "public_route",
    route: "/[...slug]",
    sourceFiles: ["src/app/(site)/[...slug]/page.tsx"],
    productSurfaceKind: "public_content_page",
    workflowOwner: "public_page_composition_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-media-center-hub",
    scope: "public_route",
    route: "/media-center",
    sourceFiles: ["src/app/(site)/media-center/page.tsx"],
    productSurfaceKind: "navigation_hub",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: [
      "public-gallery-discovery",
      "public-news-discovery",
      "public-press-discovery",
      "public-site-updates-discovery",
      "public-videos-discovery",
    ],
  }),
  defineProductSurfaceIdentity({
    id: "public-gallery-discovery",
    scope: "public_route",
    route: "/media-center/gallery",
    sourceFiles: ["src/app/(site)/media-center/gallery/page.tsx"],
    productSurfaceKind: "public_discovery",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-media-center-hub",
    nestedChildren: ["public-gallery-detail"],
  }),
  defineProductSurfaceIdentity({
    id: "public-gallery-detail",
    scope: "public_route",
    route: "/media-center/gallery/[slug]",
    sourceFiles: ["src/app/(site)/media-center/gallery/[slug]/page.tsx"],
    productSurfaceKind: "public_detail",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-gallery-discovery",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-news-discovery",
    scope: "public_route",
    route: "/media-center/news",
    sourceFiles: ["src/app/(site)/media-center/news/page.tsx"],
    productSurfaceKind: "public_discovery",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-media-center-hub",
    nestedChildren: ["public-news-detail"],
  }),
  defineProductSurfaceIdentity({
    id: "public-news-detail",
    scope: "public_route",
    route: "/media-center/news/[slug]",
    sourceFiles: ["src/app/(site)/media-center/news/[slug]/page.tsx"],
    productSurfaceKind: "public_detail",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-news-discovery",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-press-discovery",
    scope: "public_route",
    route: "/media-center/press",
    sourceFiles: ["src/app/(site)/media-center/press/page.tsx"],
    productSurfaceKind: "public_discovery",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-media-center-hub",
    nestedChildren: ["public-press-detail"],
  }),
  defineProductSurfaceIdentity({
    id: "public-press-detail",
    scope: "public_route",
    route: "/media-center/press/[slug]",
    sourceFiles: ["src/app/(site)/media-center/press/[slug]/page.tsx"],
    productSurfaceKind: "public_detail",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-press-discovery",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-site-updates-discovery",
    scope: "public_route",
    route: "/media-center/site-updates",
    sourceFiles: ["src/app/(site)/media-center/site-updates/page.tsx"],
    productSurfaceKind: "public_discovery",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-media-center-hub",
    nestedChildren: ["public-site-updates-detail"],
  }),
  defineProductSurfaceIdentity({
    id: "public-site-updates-detail",
    scope: "public_route",
    route: "/media-center/site-updates/[slug]",
    sourceFiles: ["src/app/(site)/media-center/site-updates/[slug]/page.tsx"],
    productSurfaceKind: "public_detail",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-site-updates-discovery",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-videos-discovery",
    scope: "public_route",
    route: "/media-center/videos",
    sourceFiles: ["src/app/(site)/media-center/videos/page.tsx"],
    productSurfaceKind: "public_discovery",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-media-center-hub",
    nestedChildren: ["public-videos-detail"],
  }),
  defineProductSurfaceIdentity({
    id: "public-videos-detail",
    scope: "public_route",
    route: "/media-center/videos/[slug]",
    sourceFiles: ["src/app/(site)/media-center/videos/[slug]/page.tsx"],
    productSurfaceKind: "public_detail",
    workflowOwner: "public_media_center_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-videos-discovery",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-projects-discovery",
    scope: "public_route",
    route: "/projects",
    sourceFiles: ["src/app/(site)/projects/page.tsx"],
    productSurfaceKind: "public_discovery",
    workflowOwner: "public_projects_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: ["public-project-detail"],
  }),
  defineProductSurfaceIdentity({
    id: "public-project-detail",
    scope: "public_route",
    route: "/projects/[slug]",
    sourceFiles: ["src/app/(site)/projects/[slug]/page.tsx"],
    productSurfaceKind: "public_detail",
    workflowOwner: "public_projects_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-projects-discovery",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-topics-discovery",
    scope: "public_route",
    route: "/topics",
    sourceFiles: ["src/app/(site)/topics/page.tsx"],
    productSurfaceKind: "public_discovery",
    workflowOwner: "public_content_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: ["public-topic-detail"],
  }),
  defineProductSurfaceIdentity({
    id: "public-topic-detail",
    scope: "public_route",
    route: "/topics/[slug]",
    sourceFiles: ["src/app/(site)/topics/[slug]/page.tsx"],
    productSurfaceKind: "public_detail",
    workflowOwner: "public_content_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-topics-discovery",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-project-tracking-entry",
    scope: "public_route",
    route: "/track-your-project",
    sourceFiles: ["src/app/(site)/track-your-project/page.tsx"],
    productSurfaceKind: "customer_self_service",
    workflowOwner: "public_project_tracking_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: ["public-project-tracking-detail"],
  }),
  defineProductSurfaceIdentity({
    id: "public-project-tracking-detail",
    scope: "public_route",
    route: "/track-your-project/[slug]",
    sourceFiles: ["src/app/(site)/track-your-project/[slug]/page.tsx"],
    productSurfaceKind: "customer_self_service",
    workflowOwner: "public_project_tracking_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-project-tracking-entry",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-maintenance-gateway",
    scope: "public_route",
    route: "/maintenance",
    sourceFiles: ["src/app/maintenance/page.tsx"],
    productSurfaceKind: "system_gateway",
    workflowOwner: "maintenance_access_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: null,
    nestedChildren: ["public-maintenance-authentication"],
  }),
  // Nested product surfaces owned by existing route surfaces.
  defineProductSurfaceIdentity({
    id: "admin-dashboard-recent-content",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/components/admin/dashboard/AdminDashboardView.tsx"],
    productSurfaceKind: "dashboard",
    workflowOwner: "dashboard_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "admin-dashboard",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-usage-panel",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/media-intelligence/MediaUsagePanel.tsx",
    ],
    productSurfaceKind: "asset_library",
    workflowOwner: "media_catalog_domain",
    runtimeOwners: ["feedback_runtime"],
    nestedParent: "admin-media-library",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-breadcrumb-block-create-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-breadcrumb-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-cards-block-create-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-cards-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-content-block-create-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-content-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-cta-block-create-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-cta-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-feed-block-create-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-feed-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-hero-block-create-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "block_template_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-hero-blocks-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-menu-quick-create-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/menus/AddMenuPanelClient.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "menu_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-menus-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-menu-items-collection",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "menu_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-menu-builder",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-menu-item-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/menus/MenuItemForm.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "menu_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-menu-builder",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-page-quick-create-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/pages/CreatePageModal.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "page_definition_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-page-definitions-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-page-composition-builder",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "page_composition_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-page-composition-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-page-block-assignments-collection",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
    ],
    productSurfaceKind: "management_collection",
    workflowOwner: "page_composition_domain",
    runtimeOwners: [
      "collection_runtime",
      "feedback_runtime",
      "confirmation_runtime",
    ],
    nestedParent: "admin-page-composition-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-page-block-assignment-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "page_composition_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-page-composition-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-page-seo-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "seo_metadata_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-page-composition-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-footer-fixed-slots-builder",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/footer/FooterBuilderEditors.tsx"],
    productSurfaceKind: "builder",
    workflowOwner: "footer_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-footer-builder",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-footer-manual-links-collection",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx"],
    productSurfaceKind: "management_collection",
    workflowOwner: "footer_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-footer-builder",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-footer-link-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/pages-blocks/footer/FooterBuilderEditors.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "footer_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-footer-builder",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-governorate-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/app/admin/projects/locations/ProjectLocationFormModal.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "project_location_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-governorates-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-city-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/app/admin/projects/locations/ProjectLocationFormModal.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "project_location_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-cities-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-district-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/app/admin/projects/locations/ProjectLocationFormModal.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "project_location_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-districts-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-sub-district-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/app/admin/projects/locations/ProjectLocationFormModal.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "project_location_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-sub-districts-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-stages-collection",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/projects/tracking/TrackingCollections.tsx",
    ],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["collection_runtime", "data_runtime", "feedback_runtime"],
    nestedParent: "admin-project-tracking-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-profile-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/components/admin/projects/tracking/TrackingForms.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-project-tracking-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-stage-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/components/admin/projects/tracking/TrackingForms.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-project-tracking-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-items-collection",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/projects/tracking/TrackingCollections.tsx",
    ],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["collection_runtime", "data_runtime", "feedback_runtime"],
    nestedParent: "admin-project-tracking-stage-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-item-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/components/admin/projects/tracking/TrackingForms.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-project-tracking-stage-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-updates-collection",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/projects/tracking/TrackingCollections.tsx",
    ],
    productSurfaceKind: "management_collection",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["collection_runtime", "data_runtime", "feedback_runtime"],
    nestedParent: "admin-project-tracking-item-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-project-tracking-update-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/projects/tracking/TrackingForms.tsx",
      "src/components/admin/projects/tracking/TrackingVideoFields.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "project_tracking_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-project-tracking-item-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-seo-redirect-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/seo/redirects/RedirectFormModal.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "seo_redirect_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-seo-redirects-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-company-identity-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/settings/general/CompanyIdentityPanel.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "settings_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-general-settings-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-maintenance-mode-console",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/settings/general/MaintenanceModePanel.tsx"],
    productSurfaceKind: "operational_console",
    workflowOwner: "maintenance_access_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-general-settings-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-integrations-server-credentials-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: [
      "src/components/admin/integrations/IntegrationsServerConfiguration.tsx",
    ],
    productSurfaceKind: "form",
    workflowOwner: "integrations_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-integrations-server-console",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-settings-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/settings/media/MediaSettingsPanel.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "settings_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-media-settings-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-media-recovery-console",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/settings/media/MediaRecoveryCenter.tsx"],
    productSurfaceKind: "operational_console",
    workflowOwner: "media_recovery_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-media-settings-workspace",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-security-password-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/settings/security/SecuritySettingsClient.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "security_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-security-console",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-security-account-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/settings/security/SecuritySettingsClient.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "security_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-security-console",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-security-sessions-console",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/settings/security/SecuritySettingsClient.tsx"],
    productSurfaceKind: "operational_console",
    workflowOwner: "security_domain",
    runtimeOwners: ["feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-security-console",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "admin-user-form",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/admin/users-roles/AdminUserFormModal.tsx"],
    productSurfaceKind: "form",
    workflowOwner: "identity_access_domain",
    runtimeOwners: ["form_runtime", "feedback_runtime", "confirmation_runtime"],
    nestedParent: "admin-users-roles-collection",
    nestedChildren: [],
  }),
  defineProductSurfaceIdentity({
    id: "public-maintenance-authentication",
    scope: "nested_surface",
    route: null,
    sourceFiles: ["src/app/maintenance/MaintenanceLoginForm.tsx"],
    productSurfaceKind: "authentication_flow",
    workflowOwner: "maintenance_access_domain",
    runtimeOwners: ["not_applicable"],
    nestedParent: "public-maintenance-gateway",
    nestedChildren: [],
  }),
] as const satisfies readonly ProductSurfaceIdentity[];
