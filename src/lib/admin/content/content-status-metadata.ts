export const CONTENT_STATUS_VALUES = [
  "published",
  "unpublished",
] as const;

export type ContentStatus = (typeof CONTENT_STATUS_VALUES)[number];
export type ContentStatusTone = "green" | "gold";

export const CONTENT_STATUS_METADATA: Record<
  ContentStatus,
  { label: string; tone: ContentStatusTone }
> = {
  published: { label: "منشور", tone: "green" },
  unpublished: { label: "غير منشور", tone: "gold" },
};

export function getContentStatusMetadata(
  status?: string | null,
): (typeof CONTENT_STATUS_METADATA)[ContentStatus] {
  const normalized = CONTENT_STATUS_VALUES.includes(status as ContentStatus)
    ? (status as ContentStatus)
    : "unpublished";
  return CONTENT_STATUS_METADATA[normalized];
}
