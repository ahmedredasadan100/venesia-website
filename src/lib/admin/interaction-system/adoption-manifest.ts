/**
 * Admin Interaction System governance ledger.
 *
 * The system is a contracts/governance umbrella only. It does not own a
 * super-runtime: Form, Collection, Data, Feedback, and Confirmation keep
 * independent lifecycle owners, while cross-cutting UI remains a Shared
 * Capability.
 */

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
    "Category and Series collection interactions still have declared Collection Runtime gaps.",
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
    ],
    responsibility:
      "Portable, non-mutating interaction capabilities such as canonical internal Preview and eligible Public View actions.",
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
    status: "gap",
    capabilityOwner: "shared_capabilities",
    consumerBoundary: "collection_runtime",
    sourceFiles: [
      "src/app/admin/content/categories/CategoryRowActions.tsx",
    ],
    rationale:
      "The Category collection still derives and renders its public topics preview inside row actions.",
  },
  {
    id: "topic-series-collection-preview",
    capability: "entity_preview_public",
    status: "gap",
    capabilityOwner: "shared_capabilities",
    consumerBoundary: "collection_runtime",
    sourceFiles: ["src/app/admin/content/series/series-columns.tsx"],
    rationale:
      "The Series collection still derives and renders its topics-view action inside row actions.",
  },
] as const satisfies readonly AdminEntityPreviewCapabilityAdoption[];

export type AdminInteractionCollectionRuntimeGap = {
  id: string;
  runtime: "collection_runtime";
  sourceFiles: readonly string[];
  gaps: readonly string[];
  nextReferenceContract: readonly string[];
  rationale: string;
};

export const ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS = [
  {
    id: "topic-category-collection-row-actions",
    runtime: "collection_runtime",
    sourceFiles: [
      "src/app/admin/content/categories/CategoriesListClient.tsx",
      "src/app/admin/content/categories/CategoryRowActions.tsx",
    ],
    gaps: [
      "row_action_pending_scope",
      "shared_entity_preview_capability",
      "shared_feedback_delivery",
      "collection_visibility_command_policy",
    ],
    nextReferenceContract: [
      "row_scoped_pending",
      "optimistic_update",
      "targeted_invalidation",
      "shared_feedback",
      "confirmation_contract",
      "audit",
      "no_collection_wide_visual_refresh",
    ],
    rationale:
      "Category row commands remain locally composed and expose collection-wide pending behavior; they require a Collection Runtime pass, not a Form Runtime change.",
  },
  {
    id: "topic-series-collection-row-actions",
    runtime: "collection_runtime",
    sourceFiles: [
      "src/app/admin/content/series/SeriesTableClient.tsx",
      "src/app/admin/content/series/series-columns.tsx",
    ],
    gaps: [
      "row_action_pending_scope",
      "shared_entity_preview_capability",
      "shared_feedback_delivery",
      "collection_visibility_command_policy",
    ],
    nextReferenceContract: [
      "row_scoped_pending",
      "optimistic_update",
      "targeted_invalidation",
      "shared_feedback",
      "confirmation_contract",
      "audit",
      "no_collection_wide_visual_refresh",
    ],
    rationale:
      "Series row commands retain local pending and topics-view ownership; they require the same future Collection Runtime pass as Categories.",
  },
] as const satisfies readonly AdminInteractionCollectionRuntimeGap[];
