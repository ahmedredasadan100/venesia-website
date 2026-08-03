export const CONTENT_TYPES = [
  "article",
  "news",
  "press",
  "site_update",
  "video",
  "gallery",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type ContentEditorKind = "article" | "text-media" | "video" | "gallery";
export type ContentEditorBodyKind = "markdown" | "video" | "gallery";

export type ContentEditorAdapter = {
  contentType: ContentType;
  editor: ContentEditorKind;
  body: ContentEditorBodyKind;
  supportsFaq: boolean;
  supportsDisplaySettings: boolean;
  supportsPopular: boolean;
};

export const CONTENT_EDITOR_ADAPTERS = {
  article: {
    contentType: "article",
    editor: "article",
    body: "markdown",
    supportsFaq: true,
    supportsDisplaySettings: true,
    supportsPopular: true,
  },
  news: {
    contentType: "news",
    editor: "text-media",
    body: "markdown",
    supportsFaq: false,
    supportsDisplaySettings: false,
    supportsPopular: false,
  },
  press: {
    contentType: "press",
    editor: "text-media",
    body: "markdown",
    supportsFaq: false,
    supportsDisplaySettings: false,
    supportsPopular: false,
  },
  site_update: {
    contentType: "site_update",
    editor: "text-media",
    body: "markdown",
    supportsFaq: false,
    supportsDisplaySettings: false,
    supportsPopular: false,
  },
  video: {
    contentType: "video",
    editor: "video",
    body: "video",
    supportsFaq: false,
    supportsDisplaySettings: false,
    supportsPopular: false,
  },
  gallery: {
    contentType: "gallery",
    editor: "gallery",
    body: "gallery",
    supportsFaq: false,
    supportsDisplaySettings: false,
    supportsPopular: false,
  },
} as const satisfies Record<ContentType, ContentEditorAdapter>;

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: "مقال",
  news: "خبر",
  press: "بيان صحفي",
  site_update: "تحديث تنفيذ",
  video: "فيديو",
  gallery: "معرض صور",
};

export const CONTENT_TYPE_OPTIONS: ReadonlyArray<{
  value: ContentType;
  label: string;
  editor: ContentEditorKind;
}> = CONTENT_TYPES.map((value) => ({
  value,
  label: CONTENT_TYPE_LABELS[value],
  editor: CONTENT_EDITOR_ADAPTERS[value].editor,
}));

const CONTENT_TYPE_SET = new Set<string>(CONTENT_TYPES);

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && CONTENT_TYPE_SET.has(value);
}

export function resolveContentEditor(contentType: ContentType): ContentEditorKind | null {
  return CONTENT_EDITOR_ADAPTERS[contentType]?.editor ?? null;
}

export function getContentEditorAdapter(contentType: ContentType) {
  return CONTENT_EDITOR_ADAPTERS[contentType];
}

export function getContentTypeLabel(contentType?: string | null) {
  return CONTENT_TYPE_OPTIONS.find((option) => option.value === contentType)?.label ?? "غير محدد";
}
