/**
 * Admin Form Runtime module adoption ledger.
 *
 * Form Runtime is one independent module governed by the Admin Interaction
 * System contracts umbrella. This ledger does not describe Collection, Data,
 * Feedback, Confirmation, or Shared Capability ownership, and it is not a
 * declaration that every Admin interaction has adopted AdminFormRuntime.
 */

import {
  ADMIN_MODAL_CONSUMER_CAPABILITIES,
  ADMIN_MODAL_LISTBOX_CONSUMER_CAPABILITIES,
  ADMIN_MEDIA_CONSUMER_CAPABILITIES,
  ADMIN_LISTBOX_CONSUMER_CAPABILITIES,
  ADMIN_DATE_PICKER_OWNER_EXTENSION_DECISION,
  ADMIN_SCROLLBAR_OWNER_ADOPTION_DECISION,
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
  ADMIN_NO_EXPLICIT_CONSUMER_CAPABILITIES,
  ADMIN_SWITCH_CONSUMER_CAPABILITIES,
  ADMIN_SWITCH_LISTBOX_CONSUMER_CAPABILITIES,
  ADMIN_SWITCH_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
  ADMIN_SWITCH_MODAL_CONSUMER_CAPABILITIES,
  ADMIN_SWITCH_MODAL_LISTBOX_CONSUMER_CAPABILITIES,
  ADMIN_SWITCH_MODAL_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
  adminSharedCapabilityKeys,
  adminConsumerCapabilityAudit,
  deriveAdminGovernanceClosure,
  instantiateAdminBlockEditorCapabilityDecisions,
  type AdminGovernanceClosureBlocker,
  type AdminConsumerCapabilityApprovedException,
  type AdminConsumerCapabilityKey,
  type AdminConsumerCapabilityAuditDeclaration,
} from "../interaction-system/adoption-manifest.ts";
import {
  PAGE_MODULE_KINDS,
  type PageModuleKind,
} from "../../page-blocks/types.ts";

export type AdminFormAdoptionClassification =
  | "shared_reference"
  | "shared_adopter"
  | "legacy_generic_gap"
  | "specialized_exception"
  | "explicit_exception";

type AdminFormAdoptionEntryBase = {
  id: string;
  /** Present only for a Block Editor identity derived from PAGE_MODULE_KINDS. */
  registryModuleKind?: PageModuleKind;
  label: string;
  sourceFiles: readonly string[];
  surfaces: readonly string[];
  capabilityAudit: AdminConsumerCapabilityAuditDeclaration;
  rationale: string;
};

export type AdminFormCapabilityExceptionContract = {
  lowerLevelSharedCapabilities: readonly AdminConsumerCapabilityKey[];
  knownDebt: readonly string[];
  reviewTrigger: string;
  blocksGlobalClosure: boolean;
};

export type AdminFormAdoptionEntry =
  | (AdminFormAdoptionEntryBase & {
      classification: Exclude<
        AdminFormAdoptionClassification,
        "specialized_exception" | "explicit_exception"
      >;
      exceptionContract?: never;
    })
  | (AdminFormAdoptionEntryBase & {
      classification: "specialized_exception" | "explicit_exception";
      exceptionContract: AdminFormCapabilityExceptionContract;
    });

export const ADMIN_FORM_RUNTIME_MODULE = {
  id: "form_runtime",
  governanceSystem: "admin_interaction_system",
  role: "independent_runtime",
  owns: "long_lived_create_edit_form_lifecycle",
  ownsSharedCapabilities: false,
} as const;

function approvedFormRuntimeException(input: {
  scope: string;
  evidence: readonly string[];
  rationale: string;
}): AdminConsumerCapabilityApprovedException {
  return {
    state: "approved_exception",
    scope: input.scope,
    approvingOwner: "Admin Form System adoption manifest",
    evidence: input.evidence,
    rationale: input.rationale,
  };
}

const ADMIN_BLOCK_EDITOR_REGISTERED_OWNER_CAPABILITIES = {
  hero: [],
  content: [],
  cta: ["feedback"],
  cards: ["feedback"],
  breadcrumb: ["feedback"],
  feed: ["feedback"],
  featured: ["feedback", "scrollbar"],
  "media-sidebar": ["feedback"],
  "media-hub": ["feedback"],
} as const satisfies Readonly<
  Record<PageModuleKind, readonly AdminConsumerCapabilityKey[]>
>;

export type AdminBlockEditorFeedbackAdoptionDebt = {
  id: string;
  moduleKind: PageModuleKind;
  description: string;
  sourceFiles: readonly string[];
  risk: string;
  owner: "feedback_runtime";
  blocksGlobalClosure: true;
  plannedPhase: string;
  requiredProof: readonly string[];
};

/**
 * Known Block Editor action-feedback paths that still bypass the canonical
 * Feedback Runtime. This is debt, not an approved exception: G0 records the
 * current boundary without changing Product behavior.
 */
export const ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT = [
  {
    id: "block-editor-feedback:hero-direct-action-notice",
    moduleKind: "hero",
    description:
      "Hero save-result feedback renders AdminNotice directly instead of publishing through the canonical Feedback Runtime.",
    sourceFiles: [
      "src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx",
      "src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx",
    ],
    risk:
      "Feedback policy, channel reconciliation, and lifecycle changes do not automatically reach this editor.",
    owner: "feedback_runtime",
    blocksGlobalClosure: true,
    plannedPhase: "dedicated Block Editor Feedback adoption",
    requiredProof: [
      "The save-result path publishes through the canonical Feedback Runtime.",
      "Mounted behavior preserves the current success and media-warning presentation.",
    ],
  },
  {
    id: "block-editor-feedback:content-direct-action-notice",
    moduleKind: "content",
    description:
      "Content save-result feedback renders AdminNotice directly instead of publishing through the canonical Feedback Runtime.",
    sourceFiles: [
      "src/app/admin/pages-blocks/blocks/content/[id]/page.tsx",
      "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
    ],
    risk:
      "Feedback policy, channel reconciliation, and lifecycle changes do not automatically reach this editor.",
    owner: "feedback_runtime",
    blocksGlobalClosure: true,
    plannedPhase: "dedicated Block Editor Feedback adoption",
    requiredProof: [
      "The save-result path publishes through the canonical Feedback Runtime.",
      "Mounted behavior preserves every current content-specific success message.",
    ],
  },
] as const satisfies readonly AdminBlockEditorFeedbackAdoptionDebt[];

function blockEditorAdoptionEntry(
  moduleKind: PageModuleKind,
): AdminFormAdoptionEntry {
  const sourceFile =
    `src/app/admin/pages-blocks/blocks/${moduleKind}/[id]/page.tsx`;
  const feedbackAdoptionDebt =
    ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT.find(
      (debt) => debt.moduleKind === moduleKind,
    );
  const decisions = instantiateAdminBlockEditorCapabilityDecisions(moduleKind);
  const adoptedExplicitCapabilities = adminSharedCapabilityKeys(
    ADMIN_CURRENT_SHARED_CAPABILITY_SET,
  ).filter(
    (capability) =>
      ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability].applicabilityOwner ===
        "explicit_consumer_declaration" &&
      decisions[
        capability as keyof typeof decisions
      ]?.state === "adopted",
  );

  return {
    id: `block-template-${moduleKind}-editor`,
    registryModuleKind: moduleKind,
    capabilityAudit: adminConsumerCapabilityAudit(
      decisions,
      {
        form_runtime: approvedFormRuntimeException({
          scope: `block-template-${moduleKind}-editor:schema-builder-lifecycle`,
          evidence: [sourceFile],
          rationale:
            "This registered schema editor owns a compound module composition session; its create modal is governed by the separate shared adopter.",
        }),
        ...(feedbackAdoptionDebt
          ? {
              feedback: {
                state: "missing_adoption" as const,
                rationale: `${feedbackAdoptionDebt.id}: ${feedbackAdoptionDebt.description}`,
              },
            }
          : {}),
      },
    ),
    label: `Block template ${moduleKind} editor`,
    classification: "specialized_exception",
    sourceFiles: [sourceFile],
    surfaces: [`${moduleKind}:template-edit`, `${moduleKind}:template-command`],
    rationale:
      "The registry-derived Block Editor retains its dedicated composition contract and owns an independent capability declaration.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        ...ADMIN_BLOCK_EDITOR_REGISTERED_OWNER_CAPABILITIES[moduleKind],
        ...adoptedExplicitCapabilities,
      ],
      knownDebt: [
        "The schema edit session remains outside the generic Form Runtime by explicit aggregate ownership.",
        ...(feedbackAdoptionDebt ? [feedbackAdoptionDebt.description] : []),
      ],
      reviewTrigger:
        "Review when this schema editor converges on the same save, dirty-close, and create-to-edit lifecycle as generic entity forms.",
      blocksGlobalClosure: false,
    },
  };
}

export const ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST = [
  {
    id: "topic-article-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      {
        ...ADMIN_SWITCH_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
        date_picker: ADMIN_DATE_PICKER_OWNER_EXTENSION_DECISION,
      },
      {
        scrollbar: ADMIN_SCROLLBAR_OWNER_ADOPTION_DECISION,
      },
    ),
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
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Topic Category create and edit",
    classification: "shared_reference",
    sourceFiles: ["src/app/admin/content/categories/CategoryForm.tsx"],
    surfaces: ["create", "edit"],
    rationale:
      "Reference taxonomy consumer using the shared runtime and the common action pair.",
  },
  {
    id: "topic-series-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Topic Series create and edit",
    classification: "shared_reference",
    sourceFiles: ["src/app/admin/content/series/SeriesForm.tsx"],
    surfaces: ["create", "edit"],
    rationale:
      "Reference taxonomy consumer using the shared runtime and the common action pair.",
  },
  {
    id: "topic-media-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      {
        ...ADMIN_SWITCH_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
        date_picker: ADMIN_DATE_PICKER_OWNER_EXTENSION_DECISION,
      },
      {
        scrollbar: ADMIN_SCROLLBAR_OWNER_ADOPTION_DECISION,
      },
    ),
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
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
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
    id: "project-locations-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Project Location create and edit",
    classification: "shared_adopter",
    sourceFiles: [
      "src/app/admin/projects/locations/ProjectLocationFormModal.tsx",
    ],
    surfaces: [
      "governorate:create",
      "governorate:edit",
      "city:create",
      "city:edit",
      "district:create",
      "district:edit",
      "sub-district:create",
      "sub-district:edit",
    ],
    rationale:
      "All four Project Location levels delegate modal form lifecycle, pending state, validation focus, dirty confirmation, feedback, and close behavior to AdminFormRuntime while hierarchy validation remains owned by the Location Domain.",
  },
  {
    id: "project-tracking-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      {
        ...ADMIN_NO_EXPLICIT_CONSUMER_CAPABILITIES,
        listbox: ADMIN_LISTBOX_CONSUMER_CAPABILITIES.listbox,
        date_picker: {
          ...ADMIN_DATE_PICKER_OWNER_EXTENSION_DECISION,
          rationale:
            "Tracking dates are applicable, but the current platform has no shared Date or Calendar owner available for adoption.",
        },
        switch: {
          state: "adopted",
          rationale:
            "Tracking visibility and publication inputs use AdminFormSwitch.",
        },
        modal: {
          state: "adopted",
          rationale: "Tracking create/edit surfaces use VenesiaModal.",
        },
        media: {
          state: "adopted",
          rationale:
            "Tracking Updates use the existing Admin Media picker and gallery owner.",
        },
      },
      {},
    ),
    label: "Project Tracking profile, stages, items, and updates",
    classification: "shared_adopter",
    sourceFiles: [
      "src/components/admin/projects/tracking/TrackingForms.tsx",
      "src/components/admin/projects/tracking/TrackingVideoFields.tsx",
    ],
    surfaces: [
      "tracking-profile",
      "stage-create",
      "stage-edit",
      "item-create",
      "item-edit",
      "update-create",
      "update-edit",
    ],
    rationale:
      "Tracking forms delegate pending state, structured validation feedback, dirty-close confirmation, and success handoff to AdminFormRuntime while Domain RPCs and Media coordination remain server-owned.",
  },
  {
    id: "pages-quick-create",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_MODAL_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Page quick create",
    classification: "shared_adopter",
    sourceFiles: ["src/app/admin/pages-blocks/pages/CreatePageModal.tsx"],
    surfaces: ["create"],
    rationale:
      "Generic modal create delegates pending, validation focus, feedback, dirty confirmation, and Create-to-Edit handoff to AdminFormRuntime.",
  },
  {
    id: "redirects-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_MODAL_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "SEO Redirect create and edit",
    classification: "shared_adopter",
    sourceFiles: ["src/app/admin/seo/redirects/RedirectFormModal.tsx"],
    surfaces: ["create", "edit"],
    rationale:
      "Generic modal create/edit form delegates lifecycle ownership to AdminFormRuntime while Redirect validation and list reconciliation remain entity adapters.",
  },
  {
    id: "page-composition-and-seo",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
      {
        form_runtime: approvedFormRuntimeException({
          scope: "page-composition-and-seo:specialized-builder-lifecycle",
          evidence: [
            "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
            "src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx",
          ],
          rationale:
            "Page composition and per-page SEO are a compound builder workflow with ordering and assignment lifecycles outside a generic create/edit session.",
        }),
      },
    ),
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
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "feedback",
        "confirmation",
        "busy_state",
        "modal",
        "media",
        "listbox",
        "switch",
      ],
      knownDebt: [
        "The composition aggregate retains domain-owned assignment, ordering, and page SEO command lifecycles.",
      ],
      reviewTrigger:
        "Review when Page Composition moves to a generic long-lived create/edit session or its domain command boundary changes.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "block-template-create-modals",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
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
      "featured:create",
    ],
    rationale:
      "All generic template-create modals delegate form lifecycle, validation feedback, dirty confirmation, and Create-to-Edit handoff to AdminFormRuntime while schema editors retain their specialized owners.",
  },
  ...PAGE_MODULE_KINDS.map(blockEditorAdoptionEntry),
  {
    id: "menu-quick-create",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Menu quick create",
    classification: "shared_adopter",
    sourceFiles: ["src/app/admin/pages-blocks/menus/AddMenuPanelClient.tsx"],
    surfaces: ["menu-create"],
    rationale:
      "Generic menu creation delegates pending, validation focus, feedback, dirty confirmation, and Create-to-Edit handoff to AdminFormRuntime.",
  },
  {
    id: "menu-builder",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
      {
        form_runtime: approvedFormRuntimeException({
          scope: "menu-builder:hierarchical-builder-lifecycle",
          evidence: [
            "src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx",
            "src/app/admin/pages-blocks/menus/MenuItemForm.tsx",
          ],
          rationale:
            "Hierarchical menu editing, ordering, and row commands form one specialized builder workflow rather than a generic entity form session.",
        }),
      },
    ),
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
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "feedback",
        "confirmation",
        "busy_state",
        "listbox",
        "switch",
        "media",
      ],
      knownDebt: [
        "Menu hierarchy and ordering remain specialized domain commands.",
      ],
      reviewTrigger:
        "Review when menu and item editing acquire a generic long-lived form session contract.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "footer-builder",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Footer builder",
    classification: "specialized_exception",
    sourceFiles: [
      "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx",
      "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
    ],
    surfaces: ["footer-compose", "footer-link-edit", "ordering"],
    rationale:
      "Multi-slot footer composition is a specialized aggregate editor whose destructive interactions delegate to Shared Confirmation.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "feedback",
        "confirmation",
        "modal",
        "listbox",
        "switch",
        "media",
      ],
      knownDebt: [
        "Footer slot composition and ordering remain one aggregate draft rather than generic entity forms.",
      ],
      reviewTrigger:
        "Review when footer slots become independently persisted entities or adopt generic create/edit sessions.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "global-seo-settings",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Global SEO settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/seo/meta-manager/MetaManagerClient.tsx"],
    surfaces: ["global-meta"],
    rationale:
      "Singleton global metadata management is not a generic entity create/edit consumer.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "form_runtime",
        "feedback",
        "busy_state",
        "listbox",
      ],
      knownDebt: [
        "Global SEO remains a singleton settings aggregate with inheritance semantics.",
      ],
      reviewTrigger:
        "Review when global SEO becomes a generic versioned entity create/edit workflow.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "company-identity-settings",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_MEDIA_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Company identity settings",
    classification: "shared_adopter",
    sourceFiles: ["src/app/admin/settings/general/CompanyIdentityPanel.tsx"],
    surfaces: ["singleton-settings"],
    rationale:
      "Singleton identity persistence remains domain-owned while its generic edit lifecycle, presentation, feedback, and dirty confirmation delegate to AdminFormRuntime.",
  },
  {
    id: "media-library-settings",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Media Library settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/settings/media/MediaSettingsPanel.tsx"],
    surfaces: ["media-policy-settings"],
    rationale:
      "Singleton upload, deletion, storage, and reconciliation policies retain a dedicated settings contract.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "form_runtime",
        "feedback",
        "confirmation",
        "busy_state",
        "switch",
      ],
      knownDebt: [
        "Storage reconciliation and upload policy remain a dedicated settings aggregate.",
      ],
      reviewTrigger:
        "Review when Media settings loses reconciliation commands or becomes a generic entity edit session.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "security-settings",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_NO_EXPLICIT_CONSUMER_CAPABILITIES,
      {
        form_runtime: approvedFormRuntimeException({
          scope: "security-settings:sensitive-session-semantics",
          evidence: [
            "src/app/admin/settings/security/SecuritySettingsClient.tsx",
          ],
          rationale:
            "Sensitive password and session commands require their existing security-specific validation and session semantics.",
        }),
      },
    ),
    label: "Security settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/settings/security/SecuritySettingsClient.tsx"],
    surfaces: ["password", "session", "security-policy"],
    rationale:
      "Sensitive security mutations require dedicated validation and session semantics.",
    exceptionContract: {
      lowerLevelSharedCapabilities: ["feedback", "confirmation"],
      knownDebt: [
        "Password and session mutation lifecycles remain security-domain owned.",
      ],
      reviewTrigger:
        "Review only if Auth and Permissions approve a change to security form ownership.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "integrations-server-configuration",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_NO_EXPLICIT_CONSUMER_CAPABILITIES,
      {
        form_runtime: approvedFormRuntimeException({
          scope: "integrations-server-configuration:vault-aggregate",
          evidence: [
            "src/components/admin/integrations/IntegrationsServerConfiguration.tsx",
          ],
          rationale:
            "Vault-only provider credential replacement is an optimistic-concurrency aggregate, not a browser-owned generic edit session.",
        }),
      },
    ),
    label: "Integrations server configuration",
    classification: "specialized_exception",
    sourceFiles: [
      "src/components/admin/integrations/IntegrationsServerConfiguration.tsx",
    ],
    surfaces: [
      "provider-app-credentials",
      "vault-replacement",
      "configuration-test",
    ],
    rationale:
      "Provider App credentials use a dedicated Vault-only Aggregate with optimistic concurrency, test rate limits, and no browser-owned secret state; this is not a generic entity create/edit lifecycle.",
    exceptionContract: {
      lowerLevelSharedCapabilities: ["confirmation"],
      knownDebt: [
        "Vault-backed credential replacement remains a security-sensitive aggregate command.",
      ],
      reviewTrigger:
        "Review only when the Vault, concurrency, or provider-test ownership contract changes.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "users-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Admin users create and edit",
    classification: "shared_adopter",
    sourceFiles: ["src/app/admin/users-roles/AdminUserFormModal.tsx"],
    surfaces: ["user-create", "user-edit"],
    rationale:
      "Create and edit presentation, pending, validation focus, feedback, dirty confirmation, and modal close lifecycle delegate to AdminFormRuntime; identity, password, session, self-protection, and role policy remain with the existing Auth domain actions.",
  },
  {
    id: "users-and-roles",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Users and roles management",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/users-roles/UsersManagementClient.tsx"],
    surfaces: ["identity-collection", "status-command", "delete-command"],
    rationale:
      "Identity status and delete commands remain specialized Auth-domain mutations while collection presentation, feedback, and confirmation use the shared owners and create/edit lifecycle is inventoried separately.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "form_runtime",
        "feedback",
        "confirmation",
        "busy_state",
        "modal",
        "switch",
      ],
      knownDebt: [
        "Identity status and deletion remain Auth-domain commands; create/edit is governed by its separate adopter entry.",
      ],
      reviewTrigger:
        "Review when Auth-domain command semantics or the separate create/edit ownership changes.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "maintenance-immediate-setting",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_NO_EXPLICIT_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Maintenance mode immediate setting",
    classification: "explicit_exception",
    sourceFiles: ["src/app/admin/settings/general/MaintenanceModePanel.tsx"],
    surfaces: ["immediate-toggle"],
    rationale:
      "Single immediate toggle command intentionally has no persistent editable form session.",
    exceptionContract: {
      lowerLevelSharedCapabilities: ["feedback", "confirmation"],
      knownDebt: [
        "The immediate maintenance command intentionally has no persistent form session.",
      ],
      reviewTrigger:
        "Review if maintenance mode becomes a multi-field persisted settings form.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "authentication-login",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_CONSUMER_CAPABILITIES,
      {
        form_runtime: approvedFormRuntimeException({
          scope: "authentication-login:session-boundary",
          evidence: [
            "src/app/admin/(auth)/login/AdminLoginForm.tsx",
            "src/app/maintenance/MaintenanceLoginForm.tsx",
          ],
          rationale:
            "Authentication owns session creation and redirect behavior outside the Admin entity form lifecycle.",
        }),
      },
    ),
    label: "Authentication login forms",
    classification: "explicit_exception",
    sourceFiles: [
      "src/app/admin/(auth)/login/AdminLoginForm.tsx",
      "src/app/maintenance/MaintenanceLoginForm.tsx",
    ],
    surfaces: ["admin-login", "maintenance-login"],
    rationale:
      "Authentication forms have session and redirect semantics outside Admin entity editing.",
    exceptionContract: {
      lowerLevelSharedCapabilities: ["switch"],
      knownDebt: [
        "Authentication feedback remains local to the session-entry boundary.",
      ],
      reviewTrigger:
        "Review only if Auth and Permissions change login lifecycle ownership.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "list-bulk-row-one-shot-actions",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MODAL_LISTBOX_CONSUMER_CAPABILITIES,
      {
        form_runtime: approvedFormRuntimeException({
          scope: "list-bulk-row-one-shot-actions:atomic-command",
          evidence: [
            "src/components/admin/ui/AdminBulkActionBar.tsx",
            "src/components/admin/ui/AdminDataGridRowActions.tsx",
            "src/components/admin/ui/AdminDuplicateResourceModal.tsx",
          ],
          rationale:
            "Atomic list, bulk, row, and duplicate commands do not create a long-lived editable form session.",
        }),
      },
    ),
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
      "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
    ],
    surfaces: ["bulk-command", "row-command", "duplicate-command"],
    rationale:
      "Atomic list commands do not represent a long-lived create/edit form session.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "feedback",
        "confirmation",
        "busy_state",
        "modal",
        "listbox",
        "switch",
      ],
      knownDebt: [
        "Atomic list commands intentionally do not create persistent editable sessions.",
      ],
      reviewTrigger:
        "Review when an atomic command expands into a long-lived create/edit workflow.",
      blocksGlobalClosure: false,
    },
  },
  {
    id: "activity-sitemap-media-commands",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_MEDIA_CONSUMER_CAPABILITIES,
      {
        form_runtime: approvedFormRuntimeException({
          scope: "activity-sitemap-media-commands:query-command-utilities",
          evidence: [
            "src/app/admin/activity-log/ActivityLogClient.tsx",
            "src/app/admin/seo/sitemap/SitemapMonitorClient.tsx",
            "src/components/admin/media/MediaLibraryCore.tsx",
          ],
          rationale:
            "Activity queries, sitemap checks, and Media commands are bounded command utilities without a generic entity edit lifecycle.",
        }),
      },
    ),
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
    surfaces: [
      "activity-query",
      "sitemap-check",
      "media-command",
      "media-usage",
    ],
    rationale:
      "Query/command utilities have no generic entity create/edit lifecycle.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "feedback",
        "confirmation",
        "busy_state",
        "media",
      ],
      knownDebt: [
        "Query and media command utilities intentionally remain outside entity form sessions.",
      ],
      reviewTrigger:
        "Review when any utility becomes a persistent generic entity create/edit workflow.",
      blocksGlobalClosure: false,
    },
  },
] as const satisfies readonly AdminFormAdoptionEntry[];

export const ADMIN_FORM_CONFIRM_DEBT = [] as const;

export type AdminGovernanceBehaviorProof = {
  id: string;
  state: "source_proven_only" | "behavior_verified";
  requiredForGlobalClosure: boolean;
  evidence: readonly string[];
  rationale: string;
};

export const ADMIN_FORM_BEHAVIOR_PROOF_LEDGER = [
  {
    id: "form-dirty-guard-programmatic-navigation",
    state: "behavior_verified",
    requiredForGlobalClosure: true,
    evidence: [
      "src/components/admin/ui/AdminFormRuntime.tsx",
      "src/lib/admin/form-runtime.ts",
      "scripts/verify-admin-form-system.mts",
      "scripts/qa-admin-form-guarded-navigation.mts",
    ],
    rationale:
      "A registry-scoped source guard and mounted Chromium integration harness prove guarded internal programmatic navigation across clean, dirty, pending, failed-save, successful-save, and create-to-edit states.",
  },
  {
    id: "form-save-parity-across-consumers",
    state: "source_proven_only",
    requiredForGlobalClosure: true,
    evidence: ["src/components/admin/ui/AdminFormRuntime.tsx"],
    rationale:
      "Source adoption does not by itself prove equivalent save, rollback, and completion behavior across every registered consumer.",
  },
] as const satisfies readonly AdminGovernanceBehaviorProof[];

function behaviorProofBlocksGlobalClosure(
  proof: AdminGovernanceBehaviorProof,
) {
  return proof.requiredForGlobalClosure && proof.state !== "behavior_verified";
}

const formCapabilityOwnerBlockers = adminSharedCapabilityKeys(
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
).flatMap((capability): AdminGovernanceClosureBlocker[] => {
  const definition = ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability];
  const hasApplicableConsumer = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.some(
    (entry) =>
      entry.capabilityAudit.decisions[
        capability as keyof typeof entry.capabilityAudit.decisions
      ]?.state === "owner_extension_required" ||
      entry.capabilityAudit.overrides[capability]?.state ===
        "owner_extension_required",
  );
  return definition.ownerAvailability === "owner_extension_required" &&
    hasApplicableConsumer
    ? [
        {
          id: `form-capability-owner:${capability}`,
          owner: definition.owner,
          evidence: "source_confirmed",
          rationale: `${capability} is applicable to a registered Form consumer but its shared owner requires an extension.`,
        },
      ]
    : [];
});

const formManifestBlockers = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.flatMap(
  (entry): AdminGovernanceClosureBlocker[] => {
    const blockers: AdminGovernanceClosureBlocker[] = [];
    if (entry.classification === "legacy_generic_gap") {
      blockers.push({
        id: `form-legacy-gap:${entry.id}`,
        owner: entry.id,
        evidence: "source_confirmed",
        rationale: entry.rationale,
      });
    }
    for (const [capability, decision] of Object.entries({
      ...entry.capabilityAudit.decisions,
      ...entry.capabilityAudit.overrides,
    })) {
      if (decision.state === "missing_adoption") {
        blockers.push({
          id: `form-missing-adoption:${entry.id}:${capability}`,
          owner: entry.id,
          evidence: "source_confirmed",
          rationale: decision.rationale,
        });
      }
    }
    if (
      "exceptionContract" in entry &&
      entry.exceptionContract !== undefined &&
      entry.exceptionContract.blocksGlobalClosure
    ) {
      blockers.push({
        id: `form-exception:${entry.id}`,
        owner: entry.id,
        evidence: "source_confirmed",
        rationale: entry.exceptionContract.knownDebt.join(" "),
      });
    }
    return blockers;
  },
);

export const ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS = [
  ...formCapabilityOwnerBlockers,
  ...formManifestBlockers,
  ...ADMIN_FORM_CONFIRM_DEBT.map(
    (debt): AdminGovernanceClosureBlocker => ({
      id: `form-confirm-debt:${debt}`,
      owner: "confirmation_runtime",
      evidence: "source_confirmed",
      rationale: debt,
    }),
  ),
  ...ADMIN_FORM_BEHAVIOR_PROOF_LEDGER.filter(
    behaviorProofBlocksGlobalClosure,
  ).map(
    (proof): AdminGovernanceClosureBlocker => ({
      id: `form-behavior:${proof.id}`,
      owner: "form_runtime",
      evidence: "source_proven_only",
      rationale: proof.rationale,
    }),
  ),
] as const satisfies readonly AdminGovernanceClosureBlocker[];

export const ADMIN_FORM_SYSTEM_CLOSURE = {
  phase: "Shared Legacy Adoption Closure",
  module: ADMIN_FORM_RUNTIME_MODULE.id,
  scope: "reference_consumers_and_in_scope_generic_legacy_forms",
  allowedClaim: "shared_legacy_form_adoption_closed",
  ...deriveAdminGovernanceClosure(ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS),
} as const;
