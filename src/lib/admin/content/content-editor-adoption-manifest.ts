import type { ContentType } from "./content-types";
import {
  deriveAdminGovernanceClosure,
  type AdminGovernanceClosureBlocker,
} from "../interaction-system/adoption-manifest.ts";

export type ContentEditorAdoptionEntry = {
  contentType: ContentType;
  currentContract: "topics_aggregate";
  bodyContract: "markdown" | "video_payload" | "gallery_payload";
  publicConsumer: string;
  typedDifferences: readonly string[];
};

export type ContentEditorExecutableConsumer = {
  id: "article_create" | "article_edit" | "media_create_edit";
  sourceFile: string;
};

export type ContentEditorClosureBlocker = AdminGovernanceClosureBlocker;

export type ContentEditorBehaviorProof = {
  id: string;
  owner: string;
  state: "source_proven_only" | "behavior_verified";
  requiredForGlobalClosure: boolean;
  rationale: string;
};

export function deriveContentEditorClosure(input: {
  sourceBlockers: readonly ContentEditorClosureBlocker[];
  behaviorProofs: readonly ContentEditorBehaviorProof[];
}) {
  const behaviorBlockers = input.behaviorProofs
    .filter(
      (proof) =>
        proof.requiredForGlobalClosure && proof.state !== "behavior_verified",
    )
    .map(
      (proof): ContentEditorClosureBlocker => ({
        id: `content-editor-behavior:${proof.id}`,
        owner: proof.owner,
        evidence: "source_proven_only",
        rationale: proof.rationale,
      }),
    );
  const globalClosureBlockers = [
    ...input.sourceBlockers,
    ...behaviorBlockers,
  ];

  return deriveAdminGovernanceClosure(globalClosureBlockers);
}

export const CONTENT_EDITOR_SOURCE_BLOCKERS = [
  {
    id: "gallery-admin-shared-media-adoption",
    owner:
      "src/components/admin/content/editors/media/MediaGalleryFields.tsx",
    evidence: "source_confirmed",
    rationale:
      "The Gallery content editor still owns local image-row add, remove, URL, alt, and caption controls instead of adopting the existing shared Admin Media gallery owner.",
  },
  {
    id: "gallery-public-projection",
    owner: "src/lib/media-center/adapt-topic-row.ts",
    evidence: "source_confirmed",
    rationale:
      "The Public Content read owner preserves ordered Gallery images, but the Media Center adapter flattens only their non-empty captions into generic content paragraphs and drops the image URLs and per-image alt text; the detail renderer therefore has no Gallery image sequence to render.",
  },
] as const satisfies readonly ContentEditorClosureBlocker[];

export const CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER: readonly ContentEditorBehaviorProof[] =
  [
    {
      id: "registered-editor-save-round-trip",
      owner: "src/app/admin/content/topics/editor-actions/save.ts",
      state: "source_proven_only",
      requiredForGlobalClosure: true,
      rationale:
        "Executable reachability proves shared owner adoption, not successful type-specific submit, persistence, failure, and reload behavior for every registered editor consumer.",
    },
    {
      id: "registered-public-content-rendering",
      owner: "src/lib/content/public-content-read/owner.ts",
      state: "source_proven_only",
      requiredForGlobalClosure: true,
      rationale:
        "Public route reachability to the canonical read owner does not prove that every registered typed body contract is projected and rendered without semantic loss.",
    },
  ];

export const CONTENT_EDITOR_GLOBAL_CLOSURE = deriveContentEditorClosure({
  sourceBlockers: CONTENT_EDITOR_SOURCE_BLOCKERS,
  behaviorProofs: CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER,
});

export const CONTENT_EDITOR_ARCHITECTURE = {
  id: "unified_content_editors_adoption",
  shellOwner: "src/components/admin/content/editors/ContentEditorShell.tsx",
  tabsOwner: "src/components/admin/ui/AdminModuleTabs.tsx",
  formRuntimeOwner: "src/components/admin/ui/AdminFormRuntime.tsx",
  saveOwner: "src/app/admin/content/topics/editor-actions/save.ts",
  persistenceAdapters: [
    "src/app/admin/content/topics/article-actions/save.ts",
    "src/app/admin/content/topics/media-actions/save.ts",
  ],
  basicDataOwner: "src/components/admin/content/editors/ContentBasicDataPanel.tsx",
  reviewOwner: "src/components/admin/content-workflow/ContentReviewPanel.tsx",
  publishingOwner: "src/components/admin/content/editors/ContentPublishingOptions.tsx",
  displaySettingsOwner: "src/components/admin/content/editors/ContentDisplaySettings.tsx",
  seoOwner: "src/components/admin/seo/AdminEntitySeoPanel.tsx",
  persistenceAggregate: "public.topics",
  proofBoundaries: {
    source: "source_and_executable_reachability",
    behavior: "behavior_verification_ledger",
  },
  ...CONTENT_EDITOR_GLOBAL_CLOSURE,
} as const;

export const CONTENT_EDITOR_EXECUTABLE_CONSUMERS = [
  {
    id: "article_create",
    sourceFile:
      "src/components/admin/content/editors/ArticleCreateEditor.tsx",
  },
  {
    id: "article_edit",
    sourceFile: "src/components/admin/content/editors/ArticleEditor.tsx",
  },
  {
    id: "media_create_edit",
    sourceFile:
      "src/components/admin/content/editors/media/MediaContentForm.tsx",
  },
] as const satisfies readonly ContentEditorExecutableConsumer[];

export const CONTENT_EDITOR_EXECUTABLE_BINDINGS = [
  {
    sourceFile: CONTENT_EDITOR_ARCHITECTURE.shellOwner,
    exportNames: ["default"],
  },
  {
    sourceFile: CONTENT_EDITOR_ARCHITECTURE.formRuntimeOwner,
    exportNames: ["default", "AdminFormRuntime"],
  },
  {
    sourceFile: CONTENT_EDITOR_ARCHITECTURE.basicDataOwner,
    exportNames: ["default"],
  },
  {
    sourceFile: CONTENT_EDITOR_ARCHITECTURE.publishingOwner,
    exportNames: ["default"],
  },
  {
    sourceFile: CONTENT_EDITOR_ARCHITECTURE.displaySettingsOwner,
    exportNames: ["default"],
  },
  {
    sourceFile: CONTENT_EDITOR_ARCHITECTURE.seoOwner,
    exportNames: ["default"],
  },
  {
    sourceFile: CONTENT_EDITOR_ARCHITECTURE.saveOwner,
    exportNames: ["saveContentForm"],
  },
] as const;

export const CONTENT_EDITOR_ADOPTION_MANIFEST = [
  {
    contentType: "article",
    currentContract: "topics_aggregate",
    bodyContract: "markdown",
    publicConsumer: "/topics/[slug]",
    typedDifferences: ["faq"],
  },
  {
    contentType: "news",
    currentContract: "topics_aggregate",
    bodyContract: "markdown",
    publicConsumer: "/media-center/news/[slug]",
    typedDifferences: [],
  },
  {
    contentType: "press",
    currentContract: "topics_aggregate",
    bodyContract: "markdown",
    publicConsumer: "/media-center/press/[slug]",
    typedDifferences: [],
  },
  {
    contentType: "site_update",
    currentContract: "topics_aggregate",
    bodyContract: "markdown",
    publicConsumer: "/media-center/site-updates/[slug]",
    typedDifferences: [],
  },
  {
    contentType: "video",
    currentContract: "topics_aggregate",
    bodyContract: "video_payload",
    publicConsumer: "/media-center/videos/[slug]",
    typedDifferences: ["youtube_url", "thumbnail", "duration"],
  },
  {
    contentType: "gallery",
    currentContract: "topics_aggregate",
    bodyContract: "gallery_payload",
    publicConsumer: "/media-center/gallery/[slug]",
    typedDifferences: ["ordered_images", "per_image_alt", "per_image_caption"],
  },
] as const satisfies readonly ContentEditorAdoptionEntry[];
