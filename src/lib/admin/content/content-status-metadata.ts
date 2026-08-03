export const CONTENT_STATUS_VALUES = [
  "published",
  "unpublished",
  "draft",
  "archived",
] as const;

export type ContentStatus = (typeof CONTENT_STATUS_VALUES)[number];
export type ContentStatusTone = "green" | "gold" | "blue" | "muted";

export const CONTENT_STATUS_METADATA: Record<
  ContentStatus,
  { label: string; tone: ContentStatusTone }
> = {
  published: { label: "منشور", tone: "green" },
  unpublished: { label: "غير منشور", tone: "gold" },
  draft: { label: "مسودة", tone: "blue" },
  archived: { label: "مؤرشف", tone: "muted" },
};

export function getContentStatusMetadata(
  status?: string | null,
): (typeof CONTENT_STATUS_METADATA)[ContentStatus] {
  const normalized = CONTENT_STATUS_VALUES.includes(status as ContentStatus)
    ? (status as ContentStatus)
    : "draft";
  return CONTENT_STATUS_METADATA[normalized];
}
