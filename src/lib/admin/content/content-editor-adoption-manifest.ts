import type { ContentType } from "./content-types";

export type ContentEditorAdoptionEntry = {
  contentType: ContentType;
  currentContract: "topics_aggregate";
  bodyContract: "markdown" | "video_payload" | "gallery_payload";
  publicConsumer: string;
  typedDifferences: readonly string[];
};

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
  globalClosed: true,
  globalClosureBlockers: [],
} as const;

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
