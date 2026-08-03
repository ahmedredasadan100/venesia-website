import {
  CONTENT_TYPES,
  getContentTypeLabel as getUnifiedContentTypeLabel,
  type ContentType,
} from "../../../../../lib/admin/content/content-types";

export type MediaEditableContentType = Exclude<ContentType, "article">;
export const MEDIA_EDITABLE_CONTENT_TYPES = CONTENT_TYPES.filter(
  (contentType): contentType is MediaEditableContentType => contentType !== "article",
);

export const MEDIA_CONTENT_TYPE_ERROR =
  "نوع المحتوى غير مسموح. يُسمح فقط بـ news و press و site_update و video و gallery.";

export function isMediaEditableContentType(value?: string | null): value is MediaEditableContentType {
  return MEDIA_EDITABLE_CONTENT_TYPES.includes(value as MediaEditableContentType);
}

export function getContentTypeLabel(value?: string | null) {
  return getUnifiedContentTypeLabel(value);
}
