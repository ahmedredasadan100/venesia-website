export type AdminEntitySeoSurfaceKind =
  | "entity_seo_editor"
  | "global_seo_settings"
  | "seo_monitoring_tools"
  | "redirect_management"
  | "sitemap_robots_utility"
  | "specialized_exception";

export type AdminEntitySeoAdoptionClassification =
  | "shared_reference"
  | "adopted"
  | "specialized_exception"
  | "explicit_exception";

export type AdminEntitySeoAdoptionEntry = {
  id: string;
  label: string;
  surfaceKind: AdminEntitySeoSurfaceKind;
  classification: AdminEntitySeoAdoptionClassification;
  sourceFiles: readonly string[];
  surfaces: readonly string[];
  rationale: string;
  persistedScore?: {
    status: "adopted" | "gap";
    table?: "topics" | "projects";
    inputAdapter?: string;
    writeOwners?: readonly string[];
    readOwners?: readonly string[];
    reason?: string;
  };
};

export const ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE = {
  id: "shared_entity_seo_capability",
  owner: "src/components/admin/seo/AdminEntitySeoPanel.tsx",
  dataContractOwner: "src/lib/seo/entity-seo-types.ts",
  scoreContractOwner: "src/lib/admin/seo-score.ts",
  scope: "all_eligible_public_entity_editors",
  allowedClaim: "eligible_entity_seo_capability_closed",
  globalClosed: true,
  globalClosureBlockers: [],
  // Presentation closure above is unchanged. Derived persistence has a
  // separately proven scope and must never inherit that presentation claim.
  persistedScore: {
    owner: "src/lib/admin/seo-score.ts",
    contract: "src/lib/seo/entity-seo-types.ts",
    adoption: "src/lib/admin/seo/entity-seo-persistence.ts",
    backfill: "scripts/backfill-entity-seo-scores.mts",
    globalClosed: false,
    blockers: [
      "page-seo:canonical-semantic-content-resolver",
      "project-seo:create-duplicate-verification-blocked-by-existing-required-code-insert",
    ],
  },
} as const;

export const ADMIN_ENTITY_SEO_ADOPTION_MANIFEST = [
  {
    id: "admin-entity-seo-panel",
    label: "Shared Entity SEO presentation owner",
    surfaceKind: "entity_seo_editor",
    classification: "shared_reference",
    sourceFiles: [
      "src/components/admin/seo/AdminEntitySeoPanel.tsx",
      "src/lib/admin/seo-score.ts",
      "src/lib/seo/entity-seo-types.ts",
      "src/lib/seo/resolve-seo-metadata.ts",
    ],
    surfaces: ["shared-data-contract", "shared-presentation", "shared-preview", "shared-analysis", "shared-public-metadata"],
    rationale:
      "Owns Entity SEO terminology, field presentation, previews, accordion disclosure, issue cards, metrics, and correction-button presentation.",
  },
  {
    id: "topic-article-seo",
    persistedScore: {
      status: "adopted", table: "topics", inputAdapter: "toTopicSeoScoreInput",
      writeOwners: [
        "src/app/admin/content/topics/article-actions/helpers.ts",
        "src/app/admin/content/topics/article-actions/create-domain.ts",
        "src/app/admin/content/topics/article-actions/save.ts",
        "src/app/admin/content/topics/actions.ts",
        "src/lib/admin/media-catalog/reference-providers.ts",
      ],
      readOwners: ["src/lib/admin/content/load-unified-content.ts"],
    },
    label: "Topic Article create and edit SEO",
    surfaceKind: "entity_seo_editor",
    classification: "adopted",
    sourceFiles: [
      "src/components/admin/SeoPanel.tsx",
      "src/components/admin/content/editors/ArticleCreateEditor.tsx",
      "src/components/admin/content/editors/ArticleEditor.tsx",
    ],
    surfaces: ["topic:create", "topic:edit"],
    rationale:
      "A thin adapter maps Topic sources, explicit Open Graph overrides, FAQ analysis state, and correction targets into the shared owner; content image remains only the fallback source.",
  },
  {
    id: "project-seo",
    persistedScore: {
      status: "adopted", table: "projects", inputAdapter: "toProjectSeoScoreInput",
      writeOwners: [
        "src/app/admin/projects/project-actions/save-entry.ts",
        "src/app/admin/projects/project-actions/duplicate.ts",
        "src/lib/admin/projects/project-duplicate-seo.ts",
      ],
      readOwners: [],
    },
    label: "Project create and edit SEO",
    surfaceKind: "entity_seo_editor",
    classification: "adopted",
    sourceFiles: [
      "src/components/admin/projects/entry/ProjectSeoPanel.tsx",
      "src/app/admin/projects/ProjectEditForm.tsx",
    ],
    surfaces: [
      "residential:create",
      "residential:edit",
      "commercial:create",
      "commercial:edit",
    ],
    rationale:
      "A thin adapter maps Project fields, explicit Open Graph overrides, and correction targets into the shared owner.",
  },
  {
    id: "page-seo",
    persistedScore: {
      status: "gap",
      reason: "The current Page Block config extractor covers five authored module kinds, not all resolved public semantic content or metadata. Feed, Featured and other dynamic sources plus navigation-derived Breadcrumb labels require a canonical semantic resolver before atomic Page SEO adoption; template names are never a substitute.",
    },
    label: "Per-page SEO overrides",
    surfaceKind: "entity_seo_editor",
    classification: "adopted",
    sourceFiles: [
      "src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx",
      "src/app/admin/pages-blocks/pages/page-seo-actions.ts",
    ],
    surfaces: ["page:edit"],
    rationale:
      "The existing Page save lifecycle now reads and writes the final Entity SEO contract while presentation, preview, analysis, and correction delegate to the shared owner.",
  },
  {
    id: "media-topic-seo",
    persistedScore: {
      status: "adopted", table: "topics", inputAdapter: "toTopicSeoScoreInput",
      writeOwners: [
        "src/app/admin/content/topics/media-actions/helpers.ts",
        "src/app/admin/content/topics/media-actions/save.ts",
        "src/app/admin/content/topics/actions.ts",
        "src/lib/admin/media-catalog/reference-providers.ts",
      ],
      readOwners: ["src/lib/admin/content/load-unified-content.ts"],
    },
    label: "Media Topic SEO fields",
    surfaceKind: "entity_seo_editor",
    classification: "adopted",
    sourceFiles: [
      "src/components/admin/content/editors/media/MediaContentForm.tsx",
      "src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx",
      "src/app/admin/content/topics/media-actions/helpers.ts",
    ],
    surfaces: [
      "news:create-edit",
      "press:create-edit",
      "site-update:create-edit",
      "video:create-edit",
      "gallery:create-edit",
    ],
    rationale:
      "All five public Media Topic types use the same Entity SEO fields, persistence mapping, shared presentation, previews, analysis, and public metadata fallback chain.",
  },
  {
    id: "global-seo-settings",
    label: "Global SEO defaults and organization metadata",
    surfaceKind: "global_seo_settings",
    classification: "specialized_exception",
    sourceFiles: ["src/app/admin/seo/meta-manager/MetaManagerClient.tsx"],
    surfaces: ["global-defaults", "organization", "verification"],
    rationale:
      "Singleton defaults and fallback ownership have a different lifecycle from per-entity overrides.",
  },
  {
    id: "seo-redirects",
    label: "SEO redirect management",
    surfaceKind: "redirect_management",
    classification: "specialized_exception",
    sourceFiles: [
      "src/app/admin/seo/redirects/RedirectsClient.tsx",
      "src/app/admin/seo/redirects/RedirectFormModal.tsx",
    ],
    surfaces: ["redirect:list", "redirect:create", "redirect:edit"],
    rationale:
      "Redirect source, destination, status, and lifecycle are a separate capability rather than entity metadata presentation.",
  },
  {
    id: "sitemap-monitor",
    label: "Sitemap and robots monitoring utility",
    surfaceKind: "sitemap_robots_utility",
    classification: "explicit_exception",
    sourceFiles: ["src/app/admin/seo/sitemap/SitemapMonitorClient.tsx"],
    surfaces: ["sitemap:monitor", "robots:diagnostic"],
    rationale:
      "Read-only runtime monitoring does not edit entity metadata and must not adopt an Entity SEO form.",
  },
  {
    id: "category-series-seo",
    label: "Category and Series SEO",
    surfaceKind: "specialized_exception",
    classification: "explicit_exception",
    sourceFiles: [
      "src/app/admin/content/categories/CategoryForm.tsx",
      "src/app/admin/content/series/SeriesForm.tsx",
    ],
    surfaces: ["category:create-edit", "series:create-edit"],
    rationale:
      "No per-record Entity SEO override surface exists for these taxonomy editors in the current product contract.",
  },
] as const satisfies readonly AdminEntitySeoAdoptionEntry[];
