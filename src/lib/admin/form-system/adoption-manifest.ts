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
  ADMIN_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
  ADMIN_LISTBOX_CONSUMER_CAPABILITIES,
  ADMIN_DATE_PICKER_OWNER_ADOPTION_DECISION,
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
  type AdminSharedConsumerCapabilityDefinition,
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

export type AdminFormPresentationReference = {
  sourceFile: string;
  exportName: string;
  /** Existing selected presentation, not a new runtime mode. */
  mode?: string;
};

export type AdminFormPresentationRequirement = {
  /** Consumer presentation element/state; never a Current Shared Capability axis. */
  target: string;
  requirement: "required" | "optional" | "not_applicable";
  owner?: { sourceFile: string; exportName: string };
  /** Current call-site binding; deprecated appearance aliases do not override unified owner defaults. */
  presentation?: { port: string; value: string };
  reference?: AdminFormPresentationReference;
  conditions?: { surfaces?: readonly string[]; notes?: string };
  rationale: string;
};

export type AdminFormPresentationContract = {
  scope: string;
  reference: AdminFormPresentationReference;
  requirements: readonly AdminFormPresentationRequirement[];
  /** Existing scoped evidence references; metadata does not confer proof or approval. */
  evidence?: readonly string[];
};

type AdminFormAdoptionEntryBase = {
  id: string;
  /** Present only for a Block Editor identity derived from PAGE_MODULE_KINDS. */
  registryModuleKind?: PageModuleKind;
  label: string;
  sourceFiles: readonly string[];
  surfaces: readonly string[];
  capabilityAudit: AdminConsumerCapabilityAuditDeclaration;
  presentationContract?: AdminFormPresentationContract;
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
  hero: ["feedback", "form_runtime", "busy_state", "confirmation"],
  content: ["feedback", "form_runtime", "busy_state", "confirmation"],
  cta: ["feedback"],
  cards: ["feedback"],
  breadcrumb: ["feedback"],
  feed: ["feedback", "scrollbar"],
  featured: ["feedback", "scrollbar"],
  "media-sidebar": ["feedback", "scrollbar"],
  "media-hub": ["feedback", "scrollbar"],
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
export const ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT: readonly AdminBlockEditorFeedbackAdoptionDebt[] = [];

// Informational content, not a save/action result. The guard verifies this exact
// function scope; direct action-result AdminNotice rendering still fails.
export const ADMIN_BLOCK_EDITOR_INFORMATIONAL_NOTICE_SCOPES = [{
  sourceFile: "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
  functionName: "ProjectDetailHeroEditorLinks",
}] as const;

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
        form_runtime: moduleKind === "hero" || moduleKind === "content" ? {
          state: "adopted",
          rationale: "The schema editor delegates save feedback, pending, and form preservation to AdminFormRuntime; composition fields retain their existing owner.",
        } : approvedFormRuntimeException({
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
    presentationContract: {
      scope: "registered_page_block_editor_applicable_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "inner_visible_stack" },
      requirements: [
        { target: "moduleIdentity", requirement: "required", owner: { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportName: "ModuleEditorIdentitySection" }, rationale: "The shared identity owner defaults to canonical panel/name-field presentation for every registered editor while preserving identity, status and native required name binding. Inherited domain fields remain specialized; no visual opt-in or legacy branch remains." },
        ...(moduleKind === "featured" ? [{ target: "featuredSelectedStyleSwitchComposition", requirement: "required" as const, owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormGrid" }, conditions: { notes: "Standards17/21 apply to the current selected-style Section across all presentation profiles. Direct stacked embedded Switches require a full-width field track; their native36x20 glyph and existing accessible control slot are not text Inputs. Inline and nonembedded card Switches retain their distinct composition. The independently titled settings Section is meaningful; its controls add no nested Premium surface." }, rationale: "Live Featured1 showed aligned Y coordinates but caption-sized implicit Switch tracks inside wider field cells because Grid display retained flex justify-between. The existing aligned-fields owner constrains only direct stacked embedded tracks to one full-width column. Profile-specific fixed/configurable count, navigation visibility/defaults, hidden false values, top Labels, RTL/Mobile order and current Save ownership remain unchanged. Legacy carousel is retained only for an already-persisted legacy record; source/SSR proof is distinct from live branch and Owner approval." }] : []),
        { target: "moduleTabsAndHeaders", requirement: "required", owner: { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportName: "ModuleEditorTabs" }, rationale: "The shared tab owner defaults to the unified Charcoal section header inside the canonical panel. Explicit contentSurface neutral retains that same Header, tab identity and native children when independent child Sections already own the visual panels. Metadata, tab order, navigation/error reveal and specialized field controls retain their current owners; omitted callers preserve the panel default." },
        { target: "minimalMeaningfulPanelComposition", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, conditions: { notes: "Standard21 applies to redundant tab/section surfaces and field-only wrappers. Independent titled functional Sections, media previews, format controls and repeater items retain their meaningful containers. About Intro and Collection standalone all sections retain their original panel; split-tab layout-only groups explicitly compose neutral." }, rationale: "The current shared Section exposes surface neutral without removing semantic section/header/id/children or introducing another renderer. Content107 Projects Hub Hero and same-owner sectioned content tabs avoid the redundant outer Premium frame; proven headerless split-tab wrappers use the same port. Native form, Grid, validation, Sticky, media and domain owners are preserved. Source/SSR and the bounded live107 review are separate from unobserved consumers and Owner approval." },
        { target: "nativeVisibleSectionStack", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" }, rationale: "The existing Runtime or PendingFields contains a real visible stack around identity, tabs and save; a class on a display-contents fieldset is not spacing proof. Hidden metadata and all native save bindings stay at their current boundary." },
        { target: "moduleNativeActions", requirement: "required", owner: { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportName: "ModuleEditorSaveArea" }, rationale: "Standalone canonical Form Actions title/icon/button is now the shared default inside the original native form with its existing pending/redirect contract and return context. No Close action or generic form-runtime adoption is invented for specialized editors; functional defaults remain unchanged." },
        { target: "fieldRowAlignmentAndComposition", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormGrid" }, rationale: "Standard17 uses the existing aligned-fields grid and shared field/listbox/control owners for actual mixed Input/Select/Switch/Checkbox rows. Canonical label/control/support slots align responsive rows without imposing equal-height content panels or changing native values, events, order, pending or validation. Compact-inline format controls retain their functional composition." },
        { target: "specializedControlsAndMedia", requirement: "required", owner: { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportName: "ModuleEditorVisibilityAlignRow" }, rationale: "Applicable content/format controls retain approved compact-inline presentation and exact hidden values. Field labels, native inputs, Listboxes and media delegate to existing owners; unsupported controls or SEO fields are not imposed on other module kinds." },
        { target: "nestedSemanticSections", requirement: "required", owner: { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportName: "ModuleEditorSection" }, conditions: { notes: "Applies to distinct functional subsections, including both CTA button data groups and Media Sidebar data/display settings. Compact format toolbars, Switch captions and read-only domain reference cards are legitimate compositions, not replacement Section Headers." }, rationale: "The Owner Review exposed inner CTA panels that still used compact control headings while the outer Identity/Tabs/Save guard passed. Nested functional Panels must delegate to the canonical Section/Header and real shared spacing owners; the outer shell or a presentation prop alone cannot prove nested adoption. The existing Page Block guard now checks actual nested ownership and rejects missing fields, compact subsection headers and detached links. Live/Owner approval remains Pending." },
        { target: "actualNestedFieldsAndLinks", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormField" }, conditions: { notes: "The bounded same-pattern audit covers the current registered route roots; specialized child media/repeaters retain their separately governed contracts. A source root without inline fields is not proof of complete descendant adoption." }, rationale: "Visible native field labels and Select captions consume the canonical Field/Listbox text owner rather than raw sr-only captions or embedded compact Headers. CTA primary/secondary names retain exact native bindings inside their own Sections. Shared AdminLinkField owns canonical label/helper/Anchor text for existing card and inline callers while its hidden tuples, resolution, picker, clear and controlled callbacks remain unchanged. Source/contract PASS cannot confer Live visual or functional approval." },
        { target: "applicableMediaOrderingAndSlots", requirement: "required", owner: { sourceFile: "src/components/admin/media/AdminMediaGalleryField.tsx", exportName: "default" }, conditions: { notes: "Hero Desktop/Mobile arrays use the existing AdminImagePathListField alias and explicitly enable native Drag & Drop/image-area drag while retaining arrows and authored order. Current read-only record mapping confirms Content2 and106 select the about-intro editor with named main/secondary/accent slots; they retain AdminMediaImageField, native URL/Alt pairs and shared dimensions/reference/metadata. Reorder, Drag & Drop and Caption are not applicable to these fixed slots. URL+Alt paired Home Story swap remains a distinct domain contract. Live interaction remains Pending." }, rationale: "Preserve the capabilities applicable to the actual media contract, not a generic Media component name. Array tuples keep one ordering owner without mount sorting; slot-based images keep their names and domain positions. Gallery mutation callbacks respect existing explicit/runtime/native-form/disabled-fieldset pending locks. No new capability axis, media state, provider or save path is introduced." },
        { target: "functionalParityAndDescendantCompleteness", requirement: "required", owner: { sourceFile: "src/components/admin/page-blocks/ModuleEditorPresentation.tsx", exportName: "ModuleEditorTabs" }, conditions: { notes: "Standards18/19 apply through registered executable descendants, conditional style settings, repeaters and specialized editors. Canonical outer Header/Tabs/Save is insufficient. Review media ordering, original native tuples, pending/confirmation/focus and storage format at their existing owners; untested interaction states remain Pending." }, rationale: "The final Owner Review exposed child editor height/formatting, delete glyphs, selected-style field composition and fixed-grid scroll omissions that the earlier root-only guard did not inspect. Targeted checks now require the actual affected descendants and reject the proven partial-adoption patterns; source, live behavior and Owner approval remain separate." },
        { target: "existingUxAndCanonicalFieldGeometry", requirement: "required", owner: { sourceFile: "src/lib/page-blocks/admin-utils.ts", exportName: "fieldClassName" }, conditions: { notes: "Standard20 retains original tabs, columns, functional controls, field ordering and specialized storage. The existing Page Blocks field helper delegates to the canonical Form token owner while preserving consumer extras; bounded editor height uses the existing Rich Text maxHeight port. Whole-content formatting stays distinct from selection/paragraph editing and is composed once in the existing visibility/format header." }, rationale: "Do not replace a specialized editor or aggregate layout with a generic form. Shared field geometry and canonical Action glyphs must reach visible descendants without local CSS, duplicate controls, Legacy/Premium paths or changed save ownership." },
        { target: "standaloneSeoOrCollectionOnEditor", requirement: "not_applicable", rationale: "Registered module editor forms do not own page SEO or the separate template-library DataGrid. Existing Page composition SEO, libraries and quick-create boundaries keep their own manifests and capabilities." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/page-blocks-applicable-20261025/", ".tmp-qa/admin-development-batch-01/unified-presentation-20261025/", ".tmp-qa/admin-development-batch-01/owner-review-fix-20261025/", ".tmp-qa/admin-development-batch-01/final-adoption-20261025/"],
    },
    rationale:
      "The registry-derived Block Editor retains its dedicated composition contract and owns an independent capability declaration.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        ...ADMIN_BLOCK_EDITOR_REGISTERED_OWNER_CAPABILITIES[moduleKind],
        ...adoptedExplicitCapabilities,
      ],
      knownDebt: [
        ...(moduleKind === "hero" || moduleKind === "content"
          ? ["Schema-specific field projections and redirect-on-success actions remain in the Block Editor; generic entity persistence parity is not claimed."]
          : ["The schema edit session remains outside the generic Form Runtime by explicit aggregate ownership."]),
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
        date_picker: ADMIN_DATE_PICKER_OWNER_ADOPTION_DECISION,
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
      "Reference consumer for the shared runtime, unified save action, publication capability, and Save/Close contract. The authorized Cinematic Gold v1.1 repair routes the existing full-form Draft notice savedAt display through formatAdminDateTime in the canonical content-dates owner: fixed Africa/Cairo, unchanged stored ISO instant and draft identity/version/CAS contract. Full form local draft recovery explicitly consumes credential-free verified actor/session expiry metadata at the existing Topic draft owner. It scopes candidates by actor, session, type, record and writer, restores applicable native owner state through the existing Content Editor model, keeps the shared Form Runtime mounted for Dirty and Close protection, preserves server-owned identity/revision/publication metadata, and never saves to the database automatically. Versioned allowlisted field snapshots include original baselines for conflict-aware recovery, retain legacy or unsupported drafts opaquely, exclude sensitive fields and access-bearing URLs, preserve independent writers, and clear only exact accepted snapshots after successful save. Explicit logout and known expiry stop local writers and remove session content within browser storage limits; remote revocation and physical deletion while the browser is closed are not claimed. The owner-approved final notice refinement uses the existing AdminNotice dismiss frame with an optional content slot: compact Desktop message/date/actions in one row, responsive Mobile stacking and the physical-left close control. Closing only hides the exact pending candidate notice; it never restores, discards, deletes storage or resolves the candidate. Reopening the form presents the candidate again, and an explicit submit reveals/focuses the unresolved choice while the existing save gate remains active. Restore, eligible exact-snapshot Discard, and visual Close remain distinct. Unchanged AdminNotice callers retain their existing defaults. The owner-approved follow-up unifies every existing Draft Recovery state, including opaque legacy/unsupported snapshots, through the same optional compact AdminNotice presentation and status icon, responsive message/actions row and manual visual Close. Existing exact-raw discard, identity/version/expiry protection and unresolved pending save gate remain unchanged; other Admin notices omit the port and keep their existing behavior. Actual six-type Create/Edit Desktop/Mobile RTL recovery proof and Owner Functional/Visual Review remain separate; no Panel adoption is authorized by this extension. The six Topic editor consumers retain TopicSlugInput as the shared Slug field, now delegating generation to the unchanged existing slugifyFromTitle owner. Manual input retains transient text until blur or explicit submit. This shell opts into default-off Form Runtime own-form field finalization before payload/control snapshots, giving keyboard, mouse and imperative saves the same boundary regardless of focus while other consumers retain their defaults. TopicSlugInput applies the unchanged server-compatible empty-title fallback at this explicit boundary and retains nonempty invalid candidates for server validation. Committed value changes notify the current form/SEO input observers; saved and manual slugs remain protected from title-only changes, with explicit generation returning to the existing automatic mode. Save conflict identity is shared within the existing topic content domain and maps only the topics_slug_key SQL23505 to the current field/focus response. Generation rules, public paths, Canonical/redirect owners, runtime defaults, media tabs and Meta integration remain unchanged. Functional closure requires actual Create/Edit browser and approved save-owner roundtrip evidence for all six types, followed by Owner review; source proof alone is not closure. Create/Edit FAQ columns adopt AdminFormGrid presentation=equal-height-columns for natural outer-container stretch only; inner content, responsive stacking, and existing domain behavior stay unchanged. Article Create/Edit explicitly select FaqEditor presentation=panel: the existing three FAQ Section Headers adopt the canonical premium/charcoal presentation inside premium p-3 Cards; their duplicate outer tab hero is omitted while tab navigation stays unchanged. FaqEditor omitted presentation remains default, all FAQ controls, preview, reorder, dirty/pending/error/save contracts and natural inner flow remain unchanged; final FAQ visual refinement and Owner approval remain separate. The Content tab adopts the approved panel composition at ContentBasicDataPanel, AdminFormLayout and TopicMarkdownEditor. Display Settings is a separate mounted tab immediately after Content; its existing ContentDisplaySettings owner composes the same Premium Card/Charcoal Header through an optional sectionHeading and retains all seven unchanged labels, fields, ordering, Boolean defaults and persisted-value bindings. Article tabs remain basic, display, faq, seo, publish; the Review correction target follows display without changing the same Form Runtime, dirty tracking or save contract. The display controls retain AdminFormSwitch premium-inline through ContentDisplaySettings with AdminFormGrid compact density; these tabs explicitly select introCardSpan=1 for seven equal-width cells while omitted consumers retain their span defaults. Content panel selects AdminFormLayout renderGrid with the canonical AdminFormGrid equal-height-columns to stretch only the two direct Card containers at the original 1.85:1 ratio; Mobile cards retain natural heights. Only the three panel Content selectors opt into AdminFormGrid fieldContainers alongside aligned-fields, reusing its existing control-card frame and padding over the parent Charcoal surface, with natural label/control/supporting-copy flow instead of reserving empty subgrid rows; labels, control sizes and grid gaps stay unchanged. TopicCharacterField textareaSizing=rows with five native excerpt rows while legacy consumers retain their prior sizing. Restored draft feedback reuses the dismissible AdminNotice owner; dismissal affects the notice only; native fields, all six counters, media ownership and form lifecycle remain unchanged. Save/Close adopts the optional canonical AdminFormActions icon without changing action behavior. The four Content section headers explicitly adopt the existing AdminModuleSectionHeader premium option as an embedded surface spanning the edges of its canonical p-3 AdminCard: an explicitly composed neutral charcoal surface on the three Basic headers and the unchanged solid fallback on the body header, with a physical-right decorative gold bar before the canonical AdminFormControlHeader leading-icon identity, with a 20px glyph, 40px frame and 14px title at 600 weight, ordered Icon -> Divider -> Title. Default/control/panel chrome, summaries, implicit section metadata, and specialized field/page headers remain unchanged. TopicMarkdownEditor panel explicitly selects AdminRichTextEditor scrollbarSide=right for its noneditable native viewport while the writing subtree remains RTL. The existing topic basic-data and shared presentation guards maintain source and negative coverage; the existing Topic Content fixture in qa-home-story-presentation covers actual Article/Media Create/Edit Desktop/Mobile RTL behavior, editing, draft recovery and summary preservation. The panel explicitly adopts the existing canonical label and hint typography and 8px label/control spacing through presentation-only ports; omitted field/editor/media defaults remain unchanged. Its seven field title rows explicitly select adminFormLabelClassName textInset for a shared 12px logical-start inset, with required markers and counters kept in the title row; controls, card padding, hints and section headers retain their geometry. The three Content helper lines explicitly adopt ADMIN_FORM.helperTextInset at 12px logical-start through adminFormHintClassName and the existing media guidance/dimensions owners; original-dimensions typography, bidi content, data and all omitted defaults are preserved. The Content shell opts out of its optional action description, and Article Edit omits its redundant Basic description. FAQ panel question/answer title rows now opt into the canonical 12px label inset through AdminFormField without changing control spacing; the administrative preview omits its redundant inner title while the public title switch and persistence stay intact. The Topic SEO adapter explicitly opts into AdminEntitySeoPanel presentation=panel: Basics, Robots and Social sections use existing premium/charcoal headers and Cards; the existing single-open accordion adopts the same header tokens and leading-icon identity while retaining disclosure, keyboard and correction-target behavior. Existing SEO native field order, the internal Index/Follow grid, canonical/robots/Open Graph values, validation, analysis and save contracts stay unchanged. The approved panel lower composition now groups Robots, Canonical and Alt vertically in the right information column with an eight-column span and the unchanged media owner in the left four-column span, under the existing social section header, through AdminFormGrid and AdminFormGridItem. The final Open Graph panel refinement removes only the three nested Robots, Canonical and Alt premium headers, leaving their existing inset field labels, Cards, counters and guidance in natural flow. The existing twelve-column AdminFormGrid explicitly selects equal-height-columns and the image GridItem participates as a constrained single-column grid so only its sole outer AdminCard stretches to the information column on Desktop; the inner media frame keeps its natural size and Mobile cards stack at natural heights. Main Open Graph and image premium headers retain their current chrome. Existing image actions and dimensions, natural responsive stacking and all other SEO sections remain at their canonical owners. Panel-only label/helper ports preserve other consumers and defaults. Article Create/Edit also explicitly adopt the supported panel presentation at ContentReviewPanel, AdminEntityReviewPanel and ContentPublishingOptions. The same review owner moves Notes and the horizontal three-entry Status Summary ahead of the unchanged four decision cards, composes existing Premium Card/Charcoal Headers for readiness and Validation, and keeps the same checks, score function, expansion state, corrections and sole native publication fields. The existing Shell composes the Article-only Premium tab header through its current tab metadata and the optional standalone composition on AdminModuleSectionHeader, retaining the same chrome while omitting embedded-card margins and an empty padded body. Panel-only descriptions and the display-count badge are omitted as approved, real analysis messages remain, and guidance details buttons align to the left in RTL; Media and Project omitted/default review and publishing paths stay unchanged. Field/helper inset uses existing shared ports and tokens; dates, persisted values, server validation and the deferred global 24px-header spacing rule are unchanged. Targeted source checks precede separate FAQ/SEO Owner Visual Review; visual approval, canonical default adoption and global closure remain unclaimed. The Owner-approved Unified Image refinement delegates Article primary-image metadata and every Gallery item presentation to AdminMediaImageField; AdminMediaGalleryField retains ordered tuples, batched references, Picker/list/projection and existing save contracts. Optional controlled metadata, counters, fit/aspect, shared dimension disclosures and default-off image-area native drag preserve omitted consumers. Article and Gallery use their current Slot dimensions and existing action icons. Source Proof and targeted actual Create/Edit/default behavior precede Owner Functional/Visual Review; this does not authorize default adoption or global closure.",
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
    presentationContract: {
      scope: "complete_applicable_taxonomy_form_presentation",
      reference: {
        sourceFile: "src/components/admin/content/editors/ContentBasicDataPanel.tsx",
        exportName: "default",
        mode: "panel",
      },
      requirements: [
        {
          target: "sectionActionSpacing",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" },
          presentation: { port: "className", value: "ADMIN_FORM_STACK_CLASS_NAME" },
          reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "inner_visible_stack" },
          conditions: { surfaces: ["create", "edit"], notes: "Normal and Sticky Actions retain the same canonical sibling cadence; geometry requires Desktop/Mobile RTL proof separately from source conformance." },
          rationale: "The actual Topic reference applies the existing stack token to an inner visible DOM container whose direct children are the applicable Sections and Actions. Category must space Basic, Color and Actions together; the Runtime form and its display:contents fieldset do not forward direct-child spacing. Native identity/revision inputs remain outside this visible stack, and Sticky Actions retain their existing owner and behavior. The taxonomy-spacing-20261025 correction addresses the spacing gap omitted by historical role-paint/source checks; its current normal/sticky evidence and Owner review remain separate from those prior proofs.",
        },
        {
          target: "basicSection",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" },
          presentation: { port: "presentation", value: "panel" },
          rationale: "The current basic section composes the existing premium Card and premium Charcoal section header. Its original title/description and four-field Create versus three-field Edit aligned-fields Grid remain authoritative.",
        },
        {
          target: "categoryColorSection",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" },
          presentation: { port: "presentation", value: "panel" },
          rationale: "Category alone exposes a distinct color function. Its independent approved panel retains CategoryColorPicker palette, automatic token, selected value, preview, accessible fieldset, errors and native change/dirty bridge; it adds no payload field or save owner.",
        },
        {
          target: "fieldLabels",
          requirement: "required",
          owner: { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportName: "adminFormLabelClassName" },
          presentation: { port: "textInset", value: "true" },
          rationale: "All applicable native field, relation, Slug and publication title labels select the approved canonical panel typography, logical inset and spacing through their existing owners. Required markers remain specific to genuinely required fields; optional parent remains optional.",
        },
        {
          target: "fieldHints",
          requirement: "required",
          owner: { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportName: "adminFormHintClassName" },
          presentation: { port: "textInset", value: "true" },
          rationale: "Existing parent and create-Slug guidance retains its original copy and field associations while selecting the canonical panel helper presentation. Domain color preview copy is preserved at its specialized owner.",
        },
        {
          target: "createSlug",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminSlugField.tsx", exportName: "default" },
          presentation: { port: "labelClassName", value: "adminFormLabelClassName({ textInset: true })" },
          conditions: { surfaces: ["create"], notes: "Edit intentionally omits the immutable stored Slug; that condition is not missing adoption." },
          rationale: "Create retains the canonical generated/manual Slug input and its original name/validation behavior, with approved label/helper ports. Edit remains protected by the unchanged taxonomy Slug owner.",
        },
        {
          target: "relationSelect",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminFormListboxSelect.tsx", exportName: "default" },
          presentation: { port: "presentation", value: "panel" },
          rationale: "The optional parent_id Listbox retains the empty parent option, hierarchy/self/descendant exclusions, current value, conditional search, keyboard, focus target, native bridge and pending/error contract. Presentation does not make the parent required.",
        },
        {
          target: "publishSwitch",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminFormSwitch.tsx", exportName: "default" },
          presentation: { port: "surface", value: "true" },
          rationale: "Keep the existing native is_published surface Switch and checked/default/pending contract. Its title adopts the panel label owner; no premium-inline variant or changed Boolean semantics is required by this consumer composition.",
        },
        {
          target: "formActions",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormActions" },
          presentation: { port: "icon", value: "AdminModuleTabIcon(content)" },
          reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default" },
          rationale: "Match the actual Topic Actions composition through its existing content icon and description=null ports, retaining the canonical icon frame/divider/typography and current Save/Close positions, callbacks, pending, focus and dirty-close guard. No parallel footer or save lifecycle.",
        },
        {
          target: "feedbackStates",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "default" },
          conditions: { notes: "Existing validation/error/focus, disabled/pending, dirty/close and save result/revision states are required preservation checks; isolated transport evidence is distinct from actual hosted persistence." },
          rationale: "Preserve the existing Runtime, Feedback and Confirmation owners across all applicable visual and interaction states. Current source, isolated behavior and actual route observations require separately scoped evidence; source reachability is not functional or Owner approval.",
        },
      ],
    },
    rationale:
      "Reference taxonomy consumer using the shared runtime and the common action pair. Historical taxonomy-panel-20261025 evidence proves the earlier bounded main Section Panel and preservation of the remaining body/Actions; it does not prove the current complete applicable presentation. The newly approved taxonomy-complete-20261025 scope explicitly adopts the existing AdminFormSection panel composition for basic data and independent Category color, canonical panel labels/helpers, create-only Slug presentation, parent Listbox presentation and Topic Actions icon/description ports while preserving the native surface Switch, four/three-field Grid, all colors/preview/errors, revision, field names/values, Runtime and taxonomy save owners. The optional parent, immutable Edit Slug and Category-only color function remain legitimate domain differences. Its presentationContract records actual required elements and conditions without changing capability axes or shared defaults. Current source, computed-style, actual Create/Edit Desktop/Mobile RTL and isolated functional proofs are recorded separately in .tmp-qa/admin-development-batch-01/taxonomy-complete-20261025; untested states remain Pending and previous evidence is not promoted. Owner Functional/Visual Review is pending and globalClosed=false.",
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
    presentationContract: {
      scope: "complete_applicable_taxonomy_form_presentation",
      reference: {
        sourceFile: "src/components/admin/content/editors/ContentBasicDataPanel.tsx",
        exportName: "default",
        mode: "panel",
      },
      requirements: [
        {
          target: "sectionActionSpacing",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" },
          presentation: { port: "className", value: "ADMIN_FORM_STACK_CLASS_NAME" },
          reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "inner_visible_stack" },
          conditions: { surfaces: ["create", "edit"], notes: "Normal and Sticky Actions retain the same canonical sibling cadence; geometry requires Desktop/Mobile RTL proof separately from source conformance." },
          rationale: "The actual Topic reference applies the existing stack token to an inner visible DOM container whose direct children are the applicable Sections and Actions. Series must space Basic and Actions together; the Runtime form and its display:contents fieldset do not forward direct-child spacing. Native identity/revision inputs remain outside this visible stack, and Sticky Actions retain their existing owner and behavior. The taxonomy-spacing-20261025 correction addresses the spacing gap omitted by historical role-paint/source checks; its current normal/sticky evidence and Owner review remain separate from those prior proofs.",
        },
        {
          target: "basicSection",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" },
          presentation: { port: "presentation", value: "panel" },
          rationale: "The current basic section composes the existing premium Card and premium Charcoal section header. Its original title/description and four-field Create versus three-field Edit aligned-fields Grid remain authoritative.",
        },
        {
          target: "categoryColorSection",
          requirement: "not_applicable",
          rationale: "Series has no color field, palette or color payload. Category's domain function and new subsection must not be introduced merely to copy its form layout.",
        },
        {
          target: "fieldLabels",
          requirement: "required",
          owner: { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportName: "adminFormLabelClassName" },
          presentation: { port: "textInset", value: "true" },
          rationale: "All applicable native field, relation, Slug and publication title labels select the approved canonical panel typography, logical inset and spacing through their existing owners. Name and Category remain required; publication retains its native Boolean semantics.",
        },
        {
          target: "fieldHints",
          requirement: "required",
          owner: { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportName: "adminFormHintClassName" },
          presentation: { port: "textInset", value: "true" },
          rationale: "Existing Category and create-Slug guidance keeps its original copy and field associations, including the current unpublished-category explanation, while selecting canonical panel helper presentation.",
        },
        {
          target: "createSlug",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminSlugField.tsx", exportName: "default" },
          presentation: { port: "labelClassName", value: "adminFormLabelClassName({ textInset: true })" },
          conditions: { surfaces: ["create"], notes: "Edit intentionally omits the immutable stored Slug; that condition is not missing adoption." },
          rationale: "Create retains the canonical generated/manual Slug input and its original name/validation behavior, with approved label/helper ports. Edit remains protected by the unchanged taxonomy Slug owner.",
        },
        {
          target: "relationSelect",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminFormListboxSelect.tsx", exportName: "default" },
          presentation: { port: "presentation", value: "panel" },
          rationale: "The required category_id Listbox retains its actual options/current value, unpublished current-category option, conditional search, keyboard, focus target, native bridge and pending/error contract. This differs legitimately from optional Category parent selection.",
        },
        {
          target: "publishSwitch",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminFormSwitch.tsx", exportName: "default" },
          presentation: { port: "surface", value: "true" },
          rationale: "Keep the existing native is_published surface Switch, create-false/edit-saved state and pending contract. Its title adopts the panel label owner; no premium-inline variant or changed Boolean semantics is required by this consumer composition.",
        },
        {
          target: "formActions",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormActions" },
          presentation: { port: "icon", value: "AdminModuleTabIcon(content)" },
          reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default" },
          rationale: "Match the actual Topic Actions composition through its existing content icon and description=null ports, retaining canonical icon frame/divider/typography and current Save/Close positions, callbacks, pending, focus and dirty-close guard. No parallel footer or save lifecycle.",
        },
        {
          target: "feedbackStates",
          requirement: "required",
          owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "default" },
          conditions: { notes: "Existing validation/error/focus, disabled/pending, dirty/close and save result/revision states are required preservation checks; isolated transport evidence is distinct from actual hosted persistence." },
          rationale: "Preserve existing Runtime, Feedback and Confirmation owners across all applicable visual and interaction states. Current source, isolated behavior and actual route observations require separately scoped evidence; source reachability is not functional or Owner approval.",
        },
      ],
    },
    rationale:
      "Reference taxonomy consumer using the shared runtime and the common action pair. Historical taxonomy-panel-20261025 evidence proves the earlier bounded main Section Panel and preservation of the remaining body/Actions; it does not prove the current complete applicable presentation. The newly approved taxonomy-complete-20261025 scope explicitly adopts the existing AdminFormSection panel, canonical panel labels/helpers, create-only Slug presentation, required Category Listbox presentation and Topic Actions icon/description ports while preserving the native surface Switch, four/three-field Grid, current unpublished-category option, revision, field names/values, Runtime and taxonomy save owners. The required Category relation, immutable Edit Slug and absence of Category-only color functions remain legitimate domain differences. Its presentationContract records actual required elements and conditions without changing capability axes or shared defaults. Current source, computed-style, actual Create/Edit Desktop/Mobile RTL and isolated functional proofs are recorded separately in .tmp-qa/admin-development-batch-01/taxonomy-complete-20261025; untested states remain Pending and previous evidence is not promoted. Owner Functional/Visual Review is pending and globalClosed=false.",
  },
  {
    id: "topic-media-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      {
        ...ADMIN_SWITCH_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
        date_picker: ADMIN_DATE_PICKER_OWNER_ADOPTION_DECISION,
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
      "The authorized Cinematic Gold v1.1 repair shares the full-form Draft notice savedAt display through formatAdminDateTime in the canonical content-dates owner with fixed Africa/Cairo, unchanged stored ISO instant and draft identity/version/CAS contract. All five media content types use ContentEditorShell, AdminFormRuntime, structured save feedback, dirty protection, and Create-to-Edit handoff. Full form local draft recovery explicitly consumes credential-free verified actor/session expiry metadata at the existing Topic draft owner. It scopes candidates by actor, session, type, record and writer, restores applicable native owner state through the existing Content Editor model, keeps the shared Form Runtime mounted for Dirty and Close protection, preserves server-owned identity/revision/publication metadata, and never saves to the database automatically. Versioned allowlisted field snapshots include original baselines for conflict-aware recovery, retain legacy or unsupported drafts opaquely, exclude sensitive fields and access-bearing URLs, preserve independent writers, and clear only exact accepted snapshots after successful save. Explicit logout and known expiry stop local writers and remove session content within browser storage limits; remote revocation and physical deletion while the browser is closed are not claimed. The owner-approved final notice refinement uses the existing AdminNotice dismiss frame with an optional content slot: compact Desktop message/date/actions in one row, responsive Mobile stacking and the physical-left close control. Closing only hides the exact pending candidate notice; it never restores, discards, deletes storage or resolves the candidate. Reopening the form presents the candidate again, and an explicit submit reveals/focuses the unresolved choice while the existing save gate remains active. Restore, eligible exact-snapshot Discard, and visual Close remain distinct. Unchanged AdminNotice callers retain their existing defaults. The owner-approved follow-up unifies every existing Draft Recovery state, including opaque legacy/unsupported snapshots, through the same optional compact AdminNotice presentation and status icon, responsive message/actions row and manual visual Close. Existing exact-raw discard, identity/version/expiry protection and unresolved pending save gate remain unchanged; other Admin notices omit the port and keep their existing behavior. Actual six-type Create/Edit Desktop/Mobile RTL recovery proof and Owner Functional/Visual Review remain separate; no Panel adoption is authorized by this extension. The six Topic editor consumers retain TopicSlugInput as the shared Slug field, now delegating generation to the unchanged existing slugifyFromTitle owner. Manual input retains transient text until blur or explicit submit. This shell opts into default-off Form Runtime own-form field finalization before payload/control snapshots, giving keyboard, mouse and imperative saves the same boundary regardless of focus while other consumers retain their defaults. TopicSlugInput applies the unchanged server-compatible empty-title fallback at this explicit boundary and retains nonempty invalid candidates for server validation. Committed value changes notify the current form/SEO input observers; saved and manual slugs remain protected from title-only changes, with explicit generation returning to the existing automatic mode. Save conflict identity is shared within the existing topic content domain and maps only the topics_slug_key SQL23505 to the current field/focus response. Generation rules, public paths, Canonical/redirect owners, runtime defaults, media tabs and Meta integration remain unchanged. Functional closure requires actual Create/Edit browser and approved save-owner roundtrip evidence for all six types, followed by Owner review; source proof alone is not closure. Video and Gallery now keep their specialized media owner in a mounted type-specific tab immediately after Content (video or gallery from the actual contentType); News, Press and Site Update keep their four-tab order. Basic retains shared data, primary image and the existing body contract without an empty media card. The same Form Runtime field navigation and Content Review correction targets select the matching media tab, including a visible URL focus fallback for the hidden historical duration. Panel-only provider copy hides the visible label through its existing accessible label port and omits the generic hint while keeping restricted-provider guidance. A reproduced same-request Meta SDK error could recreate its failed iframe after the new panel geometry changed; the existing MediaVideoPlayback owner now retains that failure across resize and tab visibility while a genuine media or opt-in identity change can retry. Default omitted Meta consumers, form/model, media capabilities, save/public-read/SEO owners and Slug rules remain unchanged. Their shared Content tab adopts the approved panel composition at ContentBasicDataPanel and AdminFormLayout. Display Settings is a separate mounted tab immediately after Content; the existing ContentDisplaySettings owner composes the same Premium Card/Charcoal Header through optional sectionHeading while retaining all seven labels, fields, ordering, Boolean defaults and persisted bindings. The five Media types retain their existing no-FAQ exception and basic, display, seo, publish order. Review correction navigation follows display within the unchanged Form Runtime and save contract. Display controls retain AdminFormSwitch premium-inline through ContentDisplaySettings with AdminFormGrid compact density; these tabs explicitly select introCardSpan=1 for seven equal-width cells while omitted consumers retain their span defaults. Content panel explicitly selects AdminFormLayout renderGrid with the canonical AdminFormGrid equal-height-columns to stretch only the two direct Card containers at the original 1.85:1 ratio; Mobile cards retain natural heights. Only the three panel Content selectors opt into AdminFormGrid fieldContainers alongside aligned-fields, reusing its existing control-card frame and padding over the parent Charcoal surface, with natural label/control/supporting-copy flow instead of reserving empty subgrid rows; labels, control sizes and grid gaps stay unchanged. TopicCharacterField textareaSizing=rows with five native excerpt rows; legacy sizing remains unchanged. Markdown restored draft feedback reuses dismissible AdminNotice without touching the draft or form. Markdown bodies adopt TopicMarkdownEditor panel while video/gallery keep their specialized body contracts. Save/Close adopts the optional canonical AdminFormActions icon without changing action behavior. Qualified Content section headers explicitly adopt the existing AdminModuleSectionHeader premium option as an embedded surface spanning the edges of its canonical p-3 AdminCard: an explicitly composed neutral charcoal surface on the three Basic headers and the unchanged solid fallback on the body header, with a physical-right decorative gold bar before the canonical AdminFormControlHeader leading-icon identity, with a 20px glyph, 40px frame and 14px title at 600 weight, ordered Icon -> Divider -> Title. Default/control/panel chrome, summaries, implicit section metadata, and specialized field/page headers remain unchanged. Markdown panels explicitly select AdminRichTextEditor scrollbarSide=right for its noneditable native viewport while the writing subtree remains RTL and all six counters retain their current model. The existing topic basic-data and shared presentation guards maintain source and negative coverage; the existing Topic Content fixture in qa-home-story-presentation covers actual Article/Media Create/Edit Desktop/Mobile RTL behavior, editing, draft recovery and summary preservation. The panel explicitly adopts the existing canonical label and hint typography and 8px label/control spacing through presentation-only ports; omitted field/editor/media defaults remain unchanged. Its seven field title rows explicitly select adminFormLabelClassName textInset for a shared 12px logical-start inset, with required markers and counters kept in the title row; controls, card padding, hints and section headers retain their geometry. The three Content helper lines explicitly adopt ADMIN_FORM.helperTextInset at 12px logical-start through adminFormHintClassName and the existing media guidance/dimensions owners; original-dimensions typography, bidi content, data and all omitted defaults are preserved. The Content shell opts out of its optional action description, and Article Edit omits its redundant Basic description. Video Create/Edit explicitly adopt the approved canonical panel at MediaVideoFields, MediaEntitySeoPanel, ContentReviewPanel and ContentPublishingOptions. Video uses the current specialized Media owner with unchanged YouTube URL, duration and thumbnail contracts, shared Premium Charcoal header and field-container/label/helper ports; its SEO resolves to AdminEntitySeoPanel panel including the final8:4 Open Graph outer-height composition, and its Review metadata selects the existing standalone Premium header. News, Press, Site Updates and Gallery Create/Edit explicitly adopt the same existing MediaEntitySeoPanel to AdminEntitySeoPanel panel, ContentReviewPanel to AdminEntityReviewPanel panel, and ContentPublishingOptions panel through MediaContentForm. Their existing section headers and horizontal summary use the approved presentation without duplicate JSX. MediaEntitySeoPanel exposes an optional presentation port while omitted consumers retain the existing video-panel and other-media-premium defaults. Article and Video, Display Settings premium-inline, content applicability, native fields, validation, saved values, Slug, Full Form Draft Recovery and Meta contracts remain unchanged. Gallery Create/Edit opts into AdminMediaGalleryField panel and genuine optional Add, Replace, Remove, Reorder, Alt, Caption and Drag-and-Drop controls. Only Gallery explicitly selects the optional four-column Desktop grid at the existing xl breakpoint; omitted consumers retain two Desktop columns, and existing Mobile/Tablet density, card ratios and actions remain unchanged. The existing shared owner reuses AdminDataGridReorderHandle for native drag and ArrowUp/ArrowDown/Home/End movement, retains arrows for mobile and unchanged defaults for Hero and Tracking, moves url/alt/caption tuples atomically, and keeps existing media references, cover priority, persistence and public projection. Touch drag is not claimed where the existing root lacks it; no parallel drag runtime or dependency is introduced. Behavioral and visual adoption require targeted actual Create/Edit and default-consumer proof on stable sources followed by Owner review; these notes do not grant global closure. Related Project remains optional free-text metadata with no relationship or public-behavior change; completed Basic, Display and Save/Close bindings remain unchanged. No FAQ or media-data repair is introduced. The Video capabilities refinement explicitly opts MediaVideoFields into panel, composes RTL settings and a preview/thumbnail column with canonical Cards/Headers, reuses inline listbox selection and the existing public playback owner, binds the live URL through the current ContentEditorModel, and preserves video_duration through a hidden panel field. Only YouTube is enabled in the preceding bounded refinement. The approved full Video finalization extends the same payload/validation/save/duplicate/public/SEO/playback owners to six declared providers, using explicit source-only behavior when safe embedding is not available, additive optional JSON start_seconds without schema migration, and existing manual thumbnail priority. That completed phase added no remote metadata scraping or Storage pipeline. The approved Media Public Preview and Video Final Refinement now extends eligible saved Media headers through the same AdminEntityPreviewActions capability as Article, and resets incompatible Video URL context through the existing form model on real provider changes, retaining other values and current panel composition. Dynamic URL label and placeholder use the declared provider metadata; stale field feedback is cleared only through the existing canonical Form Runtime projection when explicitly requested. The owner subsequently approved the bounded official Meta oEmbed plus SDK integration after its impact report. Official tokenless response and actual idle/manual playback were proved before activation; the existing single MediaVideoPlayback owner receives approved descriptors through the current public-read and authenticated Media read boundaries, with fixed SDK loading, reconstructed approved markup, narrow-width/denial/time-out fallback, and no Share resolution. The existing player may be relocated to one narrow client boundary with a stable re-export; no second player, parser, Runtime, credential, route, schema, SEO, storage or shared-default change is authorized. The approved bounded YouTube normalization correction rejects lookalike hosts and non-video paths at the existing validation/public resolver; other platforms and persisted start time were pending in that earlier scope and are now covered by the separately approved full Video finalization. Omitted field/selection/playback consumers keep their existing presentation and behavior. Current refinements use targeted source checks; final visual QA, Owner Visual Review and any canonical default adoption remain separate. The Owner-approved Unified Image refinement delegates Article primary-image metadata and every Gallery item presentation to AdminMediaImageField; AdminMediaGalleryField retains ordered tuples, batched references, Picker/list/projection and existing save contracts. Optional controlled metadata, counters, fit/aspect, shared dimension disclosures and default-off image-area native drag preserve omitted consumers. Article and Gallery use their current Slot dimensions and existing action icons. Source Proof and targeted actual Create/Edit/default behavior precede Owner Functional/Visual Review; this does not authorize default adoption or global closure.",
  },
  {
    id: "projects-create-edit",
    capabilityAudit: adminConsumerCapabilityAudit(
      ADMIN_SWITCH_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
      { scrollbar: ADMIN_SCROLLBAR_OWNER_ADOPTION_DECISION },
    ),
    label: "Project create and edit",
    classification: "shared_adopter",
    sourceFiles: [
      "src/app/admin/projects/ProjectEditForm.tsx",
      "src/components/admin/projects/ProjectPublishChecklistPanel.tsx",
      "src/components/admin/projects/entry/ProjectMediaEditors.tsx",
      "src/components/admin/projects/entry/ProjectSeoPanel.tsx",
    ],
    surfaces: [
      "residential:create",
      "residential:edit",
      "commercial:create",
      "commercial:edit",
    ],
    presentationContract: {
      scope: "project_owner_review_media_seo_sections",
      reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "unified_shared_default" },
      requirements: [
        { target: "projectGalleryCapabilitiesAndNativeTuples", requirement: "required", owner: { sourceFile: "src/components/admin/media/AdminMediaGalleryField.tsx", exportName: "default" }, rationale: "Project images delegate controlledItems/onItemsChange/renderItemProjection/onRequestRemove to the existing gallery owner, including applicable Reorder and Drag & Drop. Project IDs, tombstones, section membership, ordered native tuples and remove confirmation remain at the existing consumer; there is no second ordering collection or mutation path." },
        { target: "projectVideoNativeBinding", requirement: "required", owner: { sourceFile: "src/components/admin/content/editors/media/MediaVideoFields.tsx", exportName: "default" }, rationale: "Existing project native URL/provider presentation delegates to canonical Video controls and provider resolution through nativeBinding. Unsupported serialized provider/start/duration fields are not added to the Project domain; source contracts and current values remain authoritative." },
        { target: "projectSeoFieldsAndInheritance", requirement: "required", owner: { sourceFile: "src/components/admin/projects/entry/ProjectSeoPanel.tsx", exportName: "default" }, rationale: "The existing Project adapter delegates to AdminEntitySeoPanel canonical panel presentation with its exact native SEO fields, current values and inheritance. Shared Fields/Sections/Actions do not replace the Project save, validation or SEO contract." },
        { target: "projectActualSectionStack", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" }, rationale: "A real visible inner DOM stack contains tabs, errors and actions within the existing Runtime/PendingFields boundary; SectionCard bodies use the same shared20px stack. Class placement on a contents fieldset or local margins is not proof of section spacing." },
        { target: "projectMixedFieldRowComposition", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormGrid" }, rationale: "The existing homepage-order/Switch row uses canonical aligned-fields Grid and embedded control composition without changing field order, native values, checked semantics, validation or save ownership. Source/contract checks do not establish measured alignment." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/owner-review-fix-20261025/"],
    },
    rationale:
      "One Project form delegates create and edit lifecycle ownership, dirty protection, feedback, validation focus, Create-to-Edit handoff, and live review snapshots to AdminFormRuntime. Owner Review corrections cover actual descendant media/video/SEO/Section composition with source/contract proof only; real Desktop/Mobile/RTL, authenticated save/reload and Owner Functional/Visual approval remain Pending.",
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
    presentationContract: {
      scope: "location_mixed_field_row_and_surface_composition",
      reference: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormGrid", mode: "aligned-fields" },
      requirements: [
        { target: "locationOrderAndActiveRow", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormGrid" }, rationale: "All four levels preserve the original numeric order and active Boolean on the same responsive row through aligned-fields and the existing embedded stacked Switch. The redundant outer Switch surface is removed; native name/defaultChecked/disabled, hierarchy validation, field errors and modal Runtime commands remain unchanged. Live Create/Edit review remains Pending." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/admin-wide-21-20261025/field-rows/"],
    },
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
          ...ADMIN_DATE_PICKER_OWNER_ADOPTION_DECISION,
          rationale:
            "Tracking date fields render AdminDatePicker directly; stored date strings and domain validation remain unchanged.",
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
            "Tracking Updates adopt multiple image addition and duplicate exclusion through AdminMediaGalleryField and the existing Media picker; replacement remains single selection.",
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
    presentationContract: {
      scope: "tracking_update_mixed_field_row_composition",
      reference: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormGrid", mode: "aligned-fields" },
      requirements: [
        { target: "trackingUpdateTitleDatePublicationRow", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormGrid" }, conditions: { surfaces: ["update-create", "update-edit"], notes: "Stage/item Boolean surfaces and the other specialized Tracking layouts retain their existing composition; no generic layout is imposed." }, rationale: "The original title/date/publication 6/3/3 topology adopts aligned-fields and the existing embedded stacked Switch. The shared GridItem composition exposes embedded label/control slots while default and nonembedded Switch behavior stay intact. Hidden draft followed by published checkbox values, pending, error focus, gallery/video, save and modal lifecycle remain at their current owners; source proof is not live parity or approval." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/admin-wide-21-20261025/field-rows/"],
    },
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
            "src/app/admin/pages-blocks/pages/[id]/PageLayoutManager.tsx",
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
      "src/app/admin/pages-blocks/pages/[id]/PageLayoutManager.tsx",
    ],
    surfaces: ["composition", "assignment", "layout", "seo"],
    presentationContract: {
      scope: "page_composition_detail_family_applicable_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "inner_visible_stack" },
      requirements: [
        { target: "pageHeader", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminPageContextHeader.tsx", exportName: "default" }, rationale: "The existing page-composition route and header select the canonical pages identity, icon, artwork and dividers. This detail-family contract does not extend to the separate Pages list or Quick Create boundary." },
        { target: "sectionPanelsAndHeaders", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, presentation: { port: "presentation", value: "panel" }, rationale: "Applicable SEO, Layout, Map and Modules sections select canonical Premium Panels and premium Charcoal headers through existing Section/ModuleTabs owners; no copied local panel/header chrome or duplicate heading. The joined assignment collection retains its canonical table presentation." },
        { target: "tabs", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportName: "default" }, presentation: { port: "sectionHeaderPresentation", value: "premium" }, rationale: "The four existing SEO/layout/map/modules tabs retain their identities, initial-tab resolution and current navigation event. Section presentation adopts existing ports without introducing a new tab or validation/navigation lifecycle." },
        { target: "sectionActionSpacing", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" }, presentation: { port: "className", value: "ADMIN_FORM_STACK_CLASS_NAME" }, rationale: "Applicable sections and standalone native SEO Actions use a real visible DOM stack with the shared20px cadence. PendingFields contents wrappers are not spacing owners; hidden metadata remains outside the visible sibling stack. Layout controlled commands, modal footer and collection toolbar keep their own canonical composition boundaries." },
        { target: "canonicalFieldTypography", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormField" }, presentation: { port: "presentation", value: "panel" }, rationale: "Applicable native fields, inherited SEO controls, Layout editor controls and assignment modal controls adopt the approved label12px/500/16px and12px logical-start inset from existing Field/Listbox/Switch/Image ports. Preserve names, controlled values, options, native types, labels and legitimate required semantics; no local typography or required marker is invented." },
        { target: "hintsErrorsAndFocus", requirement: "required", owner: { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportName: "adminFormHintClassName" }, presentation: { port: "textInset", value: "true" }, rationale: "Current canonical hint/error/focus owners retain descriptions, validation and pending associations. Required markers follow actual current constraints; inherited optional SEO values remain optional. This presentation contract creates no new field, validation rule or generic error-navigation runtime." },
        { target: "nativeSeoActions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminStickyFormBar" }, presentation: { port: "icon", value: "AdminModuleTabIcon:content; title إجراءات النموذج" }, conditions: { surfaces: ["seo"], notes: "Standalone outside SEO Panels inside the original native savePageSeoAction form and PendingFields boundary." }, rationale: "Preserve the existing submit ActionButton, native action, all hidden page/redirect/content metadata, current pending/disabled behavior and return policy. Only canonical Actions presentation is selected; no AdminFormActions Save/Close lifecycle, Runtime Provider or new Close command is introduced." },
        { target: "layoutCommands", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminActionButton.tsx", exportName: "default" }, conditions: { surfaces: ["layout"] }, rationale: "Layout select/save and region add/remove/reorder remain controlled specialized commands with their exact state, handlers, atomic save/select semantics and pending controls. Canonical presentation must not convert them into a new native or generic long-lived form session." },
        { target: "assignmentFooter", requirement: "required", owner: { sourceFile: "src/components/admin/VenesiaModal.tsx", exportName: "default" }, conditions: { surfaces: ["assignment"] }, rationale: "The existing modal footer and four domain assignment branches retain their form association, payload, session/close policy, Cancel/Submit controls, loading/error/retry and confirmation behavior. No page Sticky Save bar is added inside or outside the modal." },
        { target: "joinedAssignmentCollection", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminDataGrid.tsx", exportName: "default" }, conditions: { surfaces: ["composition"] }, rationale: "The existing page-block-assignments collection remains the joined table owner with its bounded-client search/filter/sort/pagination, columns, selection, row actions, visibility and atomic reorder contracts. Adoption is reconciled with the existing collection manifest; no parallel table or query state is introduced." },
        { target: "mediaAndSwitchControls", requirement: "required", owner: { sourceFile: "src/components/admin/seo/AdminEntitySeoPanel.tsx", exportName: "default" }, rationale: "Per-page SEO retains the shared Entity SEO/Image owners and current fields. Existing native booleans use their actual Listbox or Switch owner by type, including assignment visibility and Layout assign-after-save; no colors, binary substitution or metadata fields are added." },
        { target: "visualMap", requirement: "required", owner: { sourceFile: "src/components/admin/page-blocks/PageVisualSlotMap.tsx", exportName: "default" }, conditions: { surfaces: ["composition"] }, rationale: "All dynamic Page detail maps project the current Layout/Regions through the existing theme topology resolver and shared Premium Panels/Charcoal headers, without region counters or invented regions. Hidden assignments stay faded and manageable. In-region arrow actions consume PageBlocksClient reorder/interaction ports and instant.rows, sharing the table's authoritative assignment mutation, rollback and reconciliation; Hero remains fixed. No map-owned save, state, drag/drop or layout engine is introduced." },
        { target: "genericRuntimeAndGlobalSaveBar", requirement: "not_applicable", rationale: "The approved specialized-builder-lifecycle exception remains authoritative. The joined collection, Layout commands, Map and assignment modal are not one generic page Save/Close session; no Runtime/provider migration or blanket Sticky bar is required." },
        { target: "adjacentConsumersOrNewDomainFields", requirement: "not_applicable", rationale: "Pages list, Quick Create and linked Module Editors are separate boundaries. No new page/SEO/Layout/assignment fields, tabs, colors, permissions, persistence, public ordering or capability axes are introduced." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/page-composition-adoption-20261025/"],
    },
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
    presentationContract: {
      scope: "registered_page_block_create_modal_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "inner_visible_stack" },
      requirements: [
        { target: "createFields", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormField" }, presentation: { port: "presentation", value: "panel" }, rationale: "Existing quick-create fields use unified shared-default labels, hints and required markers while retaining all native names/defaults and specialized payloads. Explicit semantic panel composition is preserved; it no longer chooses legacy field typography." },
        { target: "createActions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminStickyFormBar" }, rationale: "The existing modal Runtime retains pending, dirty-close and Create-to-Edit ownership; Actions are independent of the data Panel inside that form with canonical title/icon. Hero uses AdminFormActions; the other native modal buttons keep their exact requestClose and pending contracts." },
        { target: "unsupportedCreateKinds", requirement: "not_applicable", rationale: "Media Sidebar/Hub intentionally expose no generic Create/Delete/Duplicate capability; this adoption does not introduce those Product commands." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/page-blocks-applicable-20261025/"],
    },
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
    presentationContract: {
      scope: "existing_footer_aggregate_descendant_presentation",
      reference: { sourceFile: "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx", exportName: "default" },
      requirements: [
        { target: "originalFooterComposition", requirement: "required", owner: { sourceFile: "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx", exportName: "default" }, rationale: "Standard20 preserves the existing overview, fixed-slot tabs, contact and social/legal tabs, original responsive slot summary, type-specific editors, previews, duplicate/move controls and aggregate save lifecycle. Source comparison found no previous layout replacement to revert; no generic Form layout, legacy renderer or alternate save owner is introduced." },
        { target: "actualFooterSectionsAndFields", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, rationale: "Standards17/19 reach the actual FooterBuilderEditors, FooterSlotConfigFields and FooterSlotEditorCard descendants: existing semantic Panels/Headers and labels delegate to canonical Section/Field owners, and mixed rows use aligned-fields Grid. Controlled values, callbacks, inherited source selection, native link tuples and specialized read-only previews remain unchanged. Source conformance does not establish measured Desktop/Mobile/RTL geometry." },
        { target: "footerTablesAndCommands", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminDataGrid.tsx", exportName: "AdminDataGrid" }, rationale: "The existing Footer manual-link and read-only menu grids use canonical cell wrappers and opt both Header and Row into existing horizontalScroll geometry. Selection, native row actions, domain confirmations, pending, ordering and preview semantics retain their original owners; no new collection or reorder mutation is invented." },
        { target: "genericFormRuntimeAndGallery", requirement: "not_applicable", rationale: "Footer remains the approved aggregate builder exception with its existing source acceptance/save behavior. Specialized menu/media slot projections do not become arbitrary image galleries or independently saved generic forms." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/final-adoption-20261025/", ".tmp-qa/admin-development-batch-01/owner-review-oneshot-20261025/footer-mediahub/"],
    },
    rationale:
      "Multi-slot footer composition is an Edit/Save aggregate editor; manual-link deletion delegates to Shared Confirmation. Footer Restore Default was removed by explicit Product decision.",
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
      ADMIN_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
      {},
    ),
    label: "Global SEO settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/seo/meta-manager/MetaManagerClient.tsx"],
    surfaces: ["global-meta"],
    presentationContract: {
      scope: "global_seo_settings_applicable_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "inner_visible_stack" },
      requirements: [
        { target: "sectionPanels", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, presentation: { port: "presentation", value: "panel" }, conditions: { surfaces: ["global-meta"], notes: "Defaults, Identity, Crawl and Preview retain their actual four-tab content and select the existing Premium panel composition; Preview remains read-only Effective output." }, rationale: "The existing shared Section/Card owner replaces local section chrome without changing tab identities, persisted fields, social rows, source metadata or SEO behavior." },
        { target: "sectionHeaders", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportName: "AdminModuleSectionHeader" }, presentation: { port: "sectionHeaderPresentation", value: "premium" }, rationale: "All four actual tab sections use the existing Premium Charcoal header and current semantic icon; navigation and section identity remain canonical without duplicate local headings." },
        { target: "canonicalFieldTypography", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormField" }, presentation: { port: "presentation", value: "panel" }, rationale: "String, textarea, inherited Boolean listbox and social-link fields select the approved Topic label presentation:12px, weight500, line-height16px and12px logical-start text inset. Native names, ids, values, placeholders, rows, direction, repeated social fields and blank-means-inherit semantics stay unchanged." },
        { target: "sourceHints", requirement: "required", owner: { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportName: "adminFormHintClassName" }, presentation: { port: "textInset", value: "true" }, rationale: "Effective-source supporting copy selects the existing canonical hint typography and12px logical-start inset. Database, Environment and Code Fallback labels, data-seo-effective-source values, effective values and precedence remain unchanged; this is presentation only." },
        { target: "listboxDescription", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormListboxSelect.tsx", exportName: "default" }, presentation: { port: "ariaDescribedBy", value: "external effective-source hint merged with canonical statusId" }, rationale: "Only Meta explicitly opts into the existing wrapper optional description port so inherited Boolean controls remain associated with their effective-source hint alongside the canonical loading/error/unavailable/hint status. AdminListboxSelect already owns the low-level accessibility capability; omitted wrapper consumers retain exact defaults, and no parallel hint, error or selection owner is added." },
        { target: "fieldErrors", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormError" }, rationale: "Existing field errors and global save feedback keep their current runtime owner and field mapping; presentation adoption introduces no validation or inheritance rule." },
        { target: "requiredMarkers", requirement: "not_applicable", rationale: "Editable SEO overrides are optional and blank fields intentionally inherit. No required marker or new required constraint is inferred from Topic presentation parity." },
        { target: "sectionActionSpacing", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" }, presentation: { port: "className", value: "ADMIN_FORM_STACK_CLASS_NAME" }, rationale: "A real visible inner DOM stack inside the existing Runtime contents fieldset has AdminModuleTabs and standalone AdminFormActions as direct siblings at the canonical20px cadence. Actions are outside all tab Panels and remain within the same native Runtime form; a class on the Runtime or an import alone is insufficient." },
        { target: "actions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormActions" }, presentation: { port: "icon", value: "AdminModuleTabIcon:content; title إجراءات النموذج" }, rationale: "The existing canonical Save/Close and Sticky bar retains current submit/pending labels, closeHref, dirty protection, pending and saveGlobalSeoSettingsAction. It selects the content icon and standard Actions title without adding a form, Provider, save owner or navigation command." },
        { target: "formLifecycle", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "default" }, rationale: "The actual existing lower-level edit Runtime remains mounted across all four tabs. The specialized singleton classification and exception contract are preserved; database/environment/code inheritance, Effective versus persisted settings, revision, domain validation and public projection retain their owners." },
        { target: "previewComposition", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminCard.tsx", exportName: "default" }, rationale: "Effective Preview retains its existing search, Open Graph and Organization content within canonical Card/Grid presentation. It continues to read contract.settings and does not project unsaved field edits as effective or add editable controls." },
        { target: "imageAssetFields", requirement: "required", owner: { sourceFile: "src/components/admin/media/AdminMediaImageField.tsx", exportName: "default" }, conditions: { surfaces: ["global-meta"], notes: "Only existing defaultOgImage, defaultTwitterImage and organizationLogo asset-URL overrides; preserve their field names, optionalString/site_settings save owner and blank-means-inherit semantics." }, rationale: "Applicable Picker, preview and Add/Replace/Remove behavior adopts the canonical image owner. A bounded optional manual-URL input port preserves existing relative-path or http(s) input and effective-value placeholder while keeping one native named value; omitted shared consumers retain defaults. Existing source/error descriptions remain associated. No new alt/caption/domain field, Storage/save owner or inheritance rule is introduced." },
        { target: "newDomainFieldsOrCapabilityAxes", requirement: "not_applicable", rationale: "No new SEO domain fields, tabs, required states, publication/taxonomy controls, collection Runtime or shared capability axes are introduced. Existing media capability adoption for the three asset-URL fields is explicitly required above." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/meta-manager-adoption-20261025/"],
    },
    rationale:
      "Singleton global metadata management is not a generic entity create/edit consumer.",
    exceptionContract: {
      lowerLevelSharedCapabilities: [
        "form_runtime",
        "feedback",
        "busy_state",
        "listbox",
        "media",
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
    presentationContract: {
      scope: "settings_family_applicable_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "inner_visible_stack" },
      requirements: [
        { target: "sectionPanels", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, presentation: { port: "presentation", value: "panel" }, rationale: "Identity and color sections use the canonical premium Card composition; the two existing logo fields remain with their existing media owner." },
        { target: "sectionHeaders", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportName: "AdminModuleSectionHeader" }, presentation: { port: "sectionHeaderPresentation", value: "premium" }, rationale: "Each applicable section selects the canonical premium Charcoal header token and existing icon identity; no copied header geometry or duplicate tab heading." },
        { target: "identityComposition", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormGrid" }, presentation: { port: "columnRatio", value: "3:2" }, conditions: { surfaces: ["singleton-settings"], notes: "The outer General composition uses the optional3:2 ratio with the existing equal-height-columns presentation: the right one-column Grid contains the Identity Section with five vertical fields followed by the unchanged Colors Section; the left one-column Grid contains the two unchanged logo Cards. Mobile DOM order is Identity, Colors, main logo, compact logo." }, rationale: "The existing Grid owner supplies60/40 minmax tracks and natural outer-column stretch through equal-height-columns, without fixed height or inner-content stretching. Plain ratio retains items-start; omitted ratios and other column counts retain their prior behavior. Native fields, logo bindings, Colors and persistence stay unchanged." },
        { target: "canonicalFieldTypography", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormField" }, presentation: { port: "presentation", value: "panel" }, rationale: "The five identity text controls and three native color controls use the canonical label/helper/required-marker ports while retaining their current names, values, media bindings and validation." },
        { target: "sectionActionSpacing", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" }, presentation: { port: "className", value: "ADMIN_FORM_STACK_CLASS_NAME" }, rationale: "The existing20px cadence belongs to a real inner DOM stack whose direct children are the outer Identity/Colors/logos composition Grid and Actions, inside the Runtime contents fieldset. Each column selects the existing one-column Grid density=sections port for the canonical20px gap between Identity/Colors and between the two logo Panels; default and compact field gaps stay unchanged. A Runtime class or import alone is insufficient." },
        { target: "actions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormActions" }, presentation: { port: "icon", value: "AdminModuleTabIcon:content" }, rationale: "The canonical Save/Close and Sticky owner receives the content icon and the explicit title إجراءات النموذج. Existing submit/close labels, description, closeHref, dirty confirmation, pending and singleton save action remain authoritative." },
        { target: "formLifecycle", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "default" }, rationale: "The existing shared adopter retains its current long-lived singleton edit runtime and domain-owned save/read contract." },
        { target: "newFieldsOrTabs", requirement: "not_applicable", rationale: "Identity settings keeps its actual fields and media functions; Topic tabs, publication, taxonomy, counters and data are not introduced for presentation parity." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/settings-family-adoption-20261025/"],
    },
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
    presentationContract: {
      scope: "settings_family_applicable_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentEditorShell.tsx", exportName: "default", mode: "inner_visible_stack" },
      requirements: [
        { target: "sectionPanels", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, presentation: { port: "presentation", value: "panel" }, rationale: "Reconciliation status and upload policy each retain a single functional section using the existing premium Card composition. Specialized audit metadata is not converted into numeric KPI values." },
        { target: "sectionHeaders", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportName: "AdminModuleSectionHeader" }, presentation: { port: "sectionHeaderPresentation", value: "premium" }, rationale: "The existing media/settings icons and premium Charcoal header token provide section identity without duplicated chrome." },
        { target: "canonicalFieldTypography", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormField" }, presentation: { port: "presentation", value: "panel" }, rationale: "Numeric controls and native grouped checkbox legends reuse current shared label/helper ports. Names, allowed-type/extension grouping, enabled states, switch semantics, errors and normalization stay unchanged." },
        { target: "sectionActionSpacing", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" }, presentation: { port: "className", value: "ADMIN_FORM_STACK_CLASS_NAME" }, rationale: "The upload-policy Section and canonical Actions are direct children of a visible inner20px stack inside the existing Runtime; field groups keep their canonical Grid/Stack owner." },
        { target: "actions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormActions" }, presentation: { port: "icon", value: "AdminModuleTabIcon:content" }, rationale: "The singleton save-only flow adopts canonical Actions with its current submit/pending/title text, description null, and showClose=false. The opt-in presentation must not create a Close/navigation action or change the existing save contract." },
        { target: "closeAction", requirement: "not_applicable", rationale: "This existing singleton policy flow has Save only; the optional showClose port is false here while omitted shared consumers retain the default true." },
        { target: "formLifecycle", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "default" }, rationale: "The specialized media policy retains its current lower-level Runtime, validation, confirmation and domain save lifecycle; reconciliation commands remain separate operations." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/settings-family-adoption-20261025/"],
    },
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
        scrollbar: ADMIN_SCROLLBAR_OWNER_ADOPTION_DECISION,
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
    surfaces: ["password", "account", "session", "security-policy"],
    presentationContract: {
      scope: "settings_family_applicable_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentBasicDataPanel.tsx", exportName: "default", mode: "panel" },
      requirements: [
        { target: "sectionPanels", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, presentation: { port: "presentation", value: "panel" }, rationale: "Password, account, session information and session revocation retain their actual security functions in canonical premium section surfaces." },
        { target: "sectionHeaders", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportName: "AdminModuleSectionHeader" }, presentation: { port: "sectionHeaderPresentation", value: "premium" }, rationale: "Applicable security sections select the existing premium Charcoal identity. Tab metadata headings are not rendered again above their section headers." },
        { target: "canonicalFieldTypography", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormField" }, presentation: { port: "presentation", value: "panel" }, rationale: "Password/account field labels, helpers, required markers and errors use the shared panel port; autocomplete, readOnly, conditional current-password fields and every native name remain security-domain owned." },
        { target: "tabs", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportName: "default" }, rationale: "The existing three password/account/sessions tabs stay mounted and navigable with their original identities and visibility behavior; no Topic editor state or extra fields are added." },
        { target: "sectionActionSpacing", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" }, presentation: { port: "className", value: "ADMIN_FORM_STACK_CLASS_NAME" }, rationale: "Password and account each retain the same native form/PendingFields and real inner stack: the outer3:2 equal-height-columns Grid and canonical Actions Bar are direct siblings. The right column keeps the original Section Header and fields; the left column is an empty Premium presentation panel hidden on Mobile and aria-hidden on Desktop. Session-info Section remains unchanged; the revoke fields Panel and presentation-only command bar are direct stack siblings inside its original native form/PendingFields." },
        { target: "pendingFields", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormPendingFields" }, rationale: "Lower-level pending/inert field protection wraps existing command controls while preserving native onSubmit, validation, session-source acceptance, revoke confirmation and Auth handlers." },
        { target: "actions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormActions" }, presentation: { port: "pending", value: "existing controlled isPending; showClose=false; content icon" }, conditions: { surfaces: ["password", "account"], notes: "Save-only native domain forms select the existing canonical Actions/Sticky Bar, with icon, divider and spacing; the explicit controlled pending port supplies presentation outside Form Runtime." }, rationale: "Password/account saves use the canonical Actions Bar outside their panels but inside the same native form, with explicit title إجراءات النموذج, content icon, controlled pending and showClose=false. Native onSubmit, validation, Auth mutation and feedback ownership remain unchanged. No Runtime Provider, extra field name or generic save lifecycle is introduced; Owner approval remains separate." },
        { target: "securityStandaloneActions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormActions" }, conditions: { surfaces: ["password", "account"], notes: "Each Save Bar is outside the outer60/40 composition panels, immediately below them, within its unchanged native form and pending boundary. Both select the existing equal-height-columns presentation; the empty Premium left panel is Desktop-only and has no fields or product data." }, rationale: "The existing canonical Actions owner supplies icon/divider/spacing/Sticky presentation with controlled pending and showClose=false. Moving password/account presentation preserves both original submit handlers, fields, Auth commands, feedback and native form ownership; no Runtime Provider, field, or save owner is added." },
        { target: "sessionRevokeAction", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminActionButton.tsx", exportName: "default" }, conditions: { surfaces: ["session"], notes: "Immediate revoke command, not a password/account save form." }, rationale: "Session revocation retains the exact existing danger submit ActionButton inside the presentation-only AdminStickyFormBar, with the current confirmation, current-password control and pending/disabled semantics. Submitting still opens the existing confirmation; no generic Save Bar, Save/Close semantics, or Auth execution owner is added." },
        { target: "sessionCommandBar", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminStickyFormBar" }, presentation: { port: "icon", value: "AdminModuleTabIcon:content; title إجراءات النموذج; description null" }, conditions: { surfaces: ["session"], notes: "Standalone after the original revoke fields Panel within the same native form/PendingFields; session-info Section remains unchanged." }, rationale: "Only canonical Sticky presentation surrounds the exact existing danger submit command. Confirmation, return focus, pending, revokeAllSessions and Auth lifecycle retain their current owners. This is not AdminFormActions Save/Close or Form Runtime adoption." },
        { target: "closeAction", requirement: "not_applicable", rationale: "Password/account commands are Save-only and explicitly select showClose=false; session revocation keeps its current confirmation lifecycle." },
        { target: "genericFormRuntime", requirement: "not_applicable", rationale: "The approved sensitive-session-semantics Runtime exception remains valid while the existing shared Actions Bar is explicitly applicable to password/account Save-only forms. Presentation adoption does not authorize Auth/Permissions or session ownership changes." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/settings-family-adoption-20261025/"],
    },
    rationale:
      "Sensitive security mutations require dedicated validation and session semantics.",
    exceptionContract: {
      lowerLevelSharedCapabilities: ["feedback", "confirmation", "scrollbar"],
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
        scrollbar: ADMIN_SCROLLBAR_OWNER_ADOPTION_DECISION,
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
    presentationContract: {
      scope: "settings_family_applicable_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentBasicDataPanel.tsx", exportName: "default", mode: "panel" },
      requirements: [
        { target: "sectionPanels", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, presentation: { port: "presentation", value: "panel" }, rationale: "Provider App configuration, validation and readiness use the existing premium section surfaces; callback/credential detail Cards remain subordinate functional groups." },
        { target: "sectionHeaders", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportName: "AdminModuleSectionHeader" }, presentation: { port: "sectionHeaderPresentation", value: "premium" }, rationale: "Canonical premium Charcoal section headers retain their declared integrations/settings identity; detail fields use the existing compact control-header port rather than duplicated full-section chrome." },
        { target: "canonicalFieldTypography", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormField" }, presentation: { port: "presentation", value: "panel" }, rationale: "Credential labels and help use the shared field port without adding names, exposing secret values, changing autocomplete, or replacing existing dynamic credential-field metadata." },
        { target: "sectionActionSpacing", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME" }, presentation: { port: "className", value: "ADMIN_FORM_STACK_CLASS_NAME" }, rationale: "Existing section/field/action groups use real inner canonical stacks, including inside PendingFields; the class on an ancestor native form is not proof of descendant spacing." },
        { target: "pendingFields", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormPendingFields" }, rationale: "Pending protection is lower-level presentation/interaction only; the existing Vault replacement, optimistic concurrency, credential validation and provider-test handlers remain authoritative." },
        { target: "actions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminActionButton.tsx", exportName: "default" }, rationale: "The existing domain save/test/callback actions retain their shared button owner and current command semantics; no generic Close or new secret serialization is added." },
        { target: "genericFormRuntimeAndStickySaveBar", requirement: "not_applicable", rationale: "The approved vault-aggregate Runtime exception remains valid; browser-owned secret state or a generic edit lifecycle must not be introduced for visual parity." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/settings-family-adoption-20261025/"],
    },
    rationale:
      "Provider App credentials use a dedicated Vault-only Aggregate with optimistic concurrency, test rate limits, and no browser-owned secret state; this is not a generic entity create/edit lifecycle.",
    exceptionContract: {
      lowerLevelSharedCapabilities: ["feedback", "confirmation", "scrollbar"],
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
    presentationContract: {
      scope: "settings_family_applicable_presentation",
      reference: { sourceFile: "src/components/admin/content/editors/ContentBasicDataPanel.tsx", exportName: "default", mode: "panel" },
      requirements: [
        { target: "sectionPanels", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection" }, presentation: { port: "presentation", value: "panel" }, rationale: "The actual maintenance function uses one canonical premium section surface, preserving read-unavailable and current-state truth." },
        { target: "sectionHeaders", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminModuleTabs.tsx", exportName: "AdminModuleSectionHeader" }, presentation: { port: "sectionHeaderPresentation", value: "premium" }, rationale: "The maintenance section explicitly selects the existing premium Charcoal header and icon identity; no second visual title or local header geometry." },
        { target: "immediateCommandAndActions", requirement: "required", owner: { sourceFile: "src/components/admin/ui/AdminActionButton.tsx", exportName: "default" }, rationale: "The existing AdminActionButton command retains its accessible action text and aria-pressed state, read availability, fail-closed disabled state, pending, confirmation and refresh feedback through the current owners and handlers; it is not a Switch adoption." },
        { target: "canonicalFieldTypography", requirement: "not_applicable", rationale: "There is no independent editable text-field title in this immediate command; its accessible action name stays owned by AdminActionButton rather than adding artificial FormFields." },
        { target: "sectionActionSpacing", requirement: "not_applicable", rationale: "This consumer is a single immediate command section with no separate Save Bar. The General page owns the actual sibling section stack and the inner AdminFormGrid owns this section content spacing." },
        { target: "genericFormRuntimeAndStickySaveBar", requirement: "not_applicable", rationale: "The explicit immediate-toggle exception is preserved; there is no persistent editable form session, generic Save/Close, or Topic field/tab to adopt." },
      ],
      evidence: [".tmp-qa/admin-development-batch-01/settings-family-adoption-20261025/"],
    },
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
      ADMIN_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,
      {
        scrollbar: ADMIN_SCROLLBAR_OWNER_ADOPTION_DECISION,
        form_runtime: approvedFormRuntimeException({
          scope: "activity-sitemap-media-commands:query-command-utilities",
          evidence: [
            "src/app/admin/activity-log/ActivityLogClient.tsx",
            "src/app/admin/seo/sitemap/SitemapMonitorClient.tsx",
            "src/components/admin/media/MediaLibraryCore.tsx",
            "src/app/admin/settings/media/MediaRecoveryCenter.tsx",
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
        "scrollbar",
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
    id: "remaining-project-committed-result-truth",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["scripts/verify-remaining-project-proof.mjs", "scripts/qa-remaining-project-proof.mjs"],
    rationale: "Actual Projects, Locations and Tracking Actions preserve committed warnings across failed post-write reads and bounded cache retries without repeating the mutation or inventing saved identities. Tracking/Location SQL executes in disposable PGlite; Project Actions use isolated mutation ports and retain the independent aggregate SQL proof. Mounted Location/Tracking forms settle once without a result row, and Project create with an unknown saved identity delegates closure to the existing Form Runtime. Auth, Media services and Next navigation/cache ports are isolated; this does not prove authenticated full-page persistence, every field/state combination or global adoption closure.",
  },
  {
    id: "remaining-settings-committed-result-truth",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["scripts/verify-remaining-settings-menu-proof.mts", "scripts/qa-remaining-settings-result-truth.mjs"],
    rationale: "Actual Footer save/reset, Maintenance, Media settings and Menu metadata actions distinguish a rejected write from failed post-commit cache refresh using the existing bounded retry owner. Menu metadata rejects invalid identities and missing update rows. Mounted Footer, Maintenance and Media settings preserve committed warning outcomes at desktop and 390px through existing Form/Feedback owners. Auth, database transport, Media side services and Next cache/navigation are isolated; this is not authenticated persistence or all Menu operation closure.",
  },
  {
    id: "remaining-content-branch-field-proof",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["scripts/qa-remaining-content-proof.mjs", "scripts/fixtures/remaining-content-owner-harness.mjs"],
    rationale: "Mounted home-projects and the four Projects Hub Content editors prove current-field serialization, isolated transport rejection with retained input, resubmission, canonical parsing and explicit read-back mounting; the redirect Action is not acknowledged as saved. Project-detail Hero proves presentation-only authoring and separate Project content rendering. Actual Media create adapter/validation covers news, press, site_update and gallery through in-memory database/Auth/Media ports and explicit destination mounting. These scoped results do not prove authenticated database persistence, real Next navigation or every optional field/status combination.",
  },
  {
    id: "shared-corrections-atomic-template-save",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["scripts/verify-shared-atomic-adoption.mts", "scripts/verify-shared-atomic-persistence.mjs", "scripts/qa-shared-atomic-persistence.mjs", "docs/reports/SHARED_CORRECTIONS_PROOF.md"],
    rationale: "Local delta from d60938a: real signed Admin Auth, eight update Actions, isolated PostgREST/PostgreSQL and assignment reread. Existing Composition owns template plus assignments in one transaction, including empty assignments, actual later-write rollback/retry, persisted config checks, observed lock contention and unchanged Audit/ACL. Next transport/cache and Media side services are isolated explicitly. Mounted Feedback proves committed warning/dismissal; this does not extend broad form persistence or every Content branch parity.",
  },
  {
    id: "shared-corrections-native-pending-fields",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["scripts/verify-shared-corrections-adoption.mts", "scripts/qa-shared-corrections-adoption.mjs", "docs/reports/SHARED_CORRECTIONS_PROOF.md"],
    rationale: "Menu metadata, Menu item create/edit and Page SEO adopt native-action pending field protection at AdminFormRuntime. The seven CTA/Cards/Breadcrumb/Feed/Featured/MediaSidebar/MediaHub form bodies adopt the same lower-level owner; their aggregate Actions retain their specialized contract. Mounted proof covers submitted values, disabled/inert controls and duplicate submission while pending; operation-scoped source proof covers every form body. This does not close template/assignment atomicity or native redirect-error persistence.",
  },
  {
    id: "shared-corrections-specialized-draft-source",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["scripts/verify-shared-corrections-adoption.mts", "scripts/qa-shared-corrections-adoption.mjs", "docs/reports/SHARED_CORRECTIONS_PROOF.md"],
    rationale: "Actual Footer aggregate and Security account name/email components preserve dirty drafts against incoming props and use the existing Form owner's source-acceptance policy. Mounted deferred Action ports prove pending locks, failure/retry and newer input after save surviving a late read. Auth, permissions, password/session commands and database persistence are not part of this component evidence.",
  },
  {
    id: "shared-corrections-media-legacy-feedback",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["scripts/verify-shared-corrections-adoption.mts", "scripts/qa-shared-corrections-adoption.mjs", "docs/reports/SHARED_CORRECTIONS_PROOF.md"],
    rationale: "Both Media routes feed the legacy error to the existing ContentEditorShell/Form/Feedback owner without an additional AdminNotice. Source binding plus mounted Form/Feedback proof demonstrates one error, dismissal clearing the legacy query, and replacement on the next save. This is not an additional authenticated Media persistence claim.",
  },
  {
    id: "a10-authenticated-content-persistence",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["docs/reports/A10_CONTENT_PROOF.md"],
    rationale: "Local A10 delta from eeb204bb890f97aaaffa902eaa0ca86541d16dca: actual Admin Auth, isolated PostgreSQL/PostgREST, Category/Series create/edit/conflict retry, all six typed Topic edit saves and Article/Video create-to-edit. The report binds each action to its real database/reload evidence; other forms and untested branch fields are not covered.",
  },
  {
    id: "a10-block-editor-saved-revision-integrity",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["docs/reports/A10_CONTENT_PROOF.md", "scripts/qa-admin-form-guarded-navigation.mts"],
    rationale: "Hero internal-page and generic Content use real authenticated save, failure/retry and database reload; a delayed real RSC read from a second editor must retain newer unsaved input. The canonical Form Runtime accepts saved revisions through its live dirty/pending guard. Media-warning proof isolates only one side-service HTTP failure; it does not mock the core save. Additional schema branches are enumerated separately in the report.",
  },
  {
    id: "block-editor-shared-feedback-save-retry",
    state: "behavior_verified",
    requiredForGlobalClosure: false,
    evidence: ["scripts/qa-shared-capability-completion.mjs", "scripts/verify-admin-form-system.mts"],
    rationale: "Local delta from 6ec44b8afbf153e02b194759cc88a90058086835: actual Form/Feedback owners preserve input, clear busy, publish one failure/result and support redirect success/media-warning retry; executable bindings cover Hero and every Content editor branch. Transport and Next redirect/reload are isolated; this is not domain persistence parity.",
  },
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
    evidence: ["src/components/admin/ui/AdminFormRuntime.tsx", "scripts/qa-admin-form-runtime-behavior.mts", "scripts/qa-admin-form-guarded-navigation.mts", "scripts/qa-shared-capability-completion.mjs"],
    rationale:
      "Shared-owner and Content Editor mounted evidence covers preservation, guarded navigation and retry; it does not prove authenticated type-specific save, persistence, rollback and completion across every registered consumer. This broad parity claim remains open.",
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
  const definition: AdminSharedConsumerCapabilityDefinition = ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability];
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
