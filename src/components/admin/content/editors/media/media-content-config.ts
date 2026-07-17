import { getContentTypeLabel as getUnifiedContentTypeLabel } from "../../../../../lib/admin/content/content-types";

export const MEDIA_EDITABLE_CONTENT_TYPES = ["news", "press", "site_update", "video", "gallery"] as const;
export type MediaEditableContentType = (typeof MEDIA_EDITABLE_CONTENT_TYPES)[number];

export const MEDIA_CONTENT_TYPE_ERROR =
  "نوع المحتوى غير مسموح. يُسمح فقط بـ news و press و site_update و video و gallery.";

export function isMediaEditableContentType(value?: string | null): value is MediaEditableContentType {
  return MEDIA_EDITABLE_CONTENT_TYPES.includes(value as MediaEditableContentType);
}

export function getContentTypeLabel(value?: string | null) {
  return getUnifiedContentTypeLabel(value);
}
