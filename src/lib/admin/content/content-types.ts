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

export const CONTENT_TYPE_OPTIONS: ReadonlyArray<{
  value: ContentType;
  label: string;
  editor: ContentEditorKind;
}> = [
  { value: "article", label: "مقال", editor: "article" },
  { value: "news", label: "خبر", editor: "text-media" },
  { value: "press", label: "بيان صحفي", editor: "text-media" },
  { value: "site_update", label: "تحديث تنفيذ", editor: "text-media" },
  { value: "video", label: "فيديو", editor: "video" },
  { value: "gallery", label: "معرض صور", editor: "gallery" },
];

const CONTENT_TYPE_SET = new Set<string>(CONTENT_TYPES);
const EDITOR_BY_CONTENT_TYPE = new Map(
  CONTENT_TYPE_OPTIONS.map((option) => [option.value, option.editor] as const),
);

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && CONTENT_TYPE_SET.has(value);
}

export function resolveContentEditor(contentType: ContentType): ContentEditorKind {
  return EDITOR_BY_CONTENT_TYPE.get(contentType) ?? "article";
}

export function getContentTypeLabel(contentType?: string | null) {
  return CONTENT_TYPE_OPTIONS.find((option) => option.value === contentType)?.label ?? "غير محدد";
}
