"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  isMediaEditableContentType,
  MEDIA_CONTENT_TYPE_ERROR,
  MEDIA_EDITABLE_CONTENT_TYPES,
} from "../media-content-config";
import {
  buildMediaWritePayload,
  getPayload,
  getPublishedValidationError,
  getString,
  getValidationError,
  redirectEditError,
  resolveWriteMediaPayload,
  uploadMediaImage,
  validateId,
} from "./helpers";
import {
  ensureUniqueSlug,
  getEditableMediaTopicById,
  resolveMediaSection,
} from "./validation";
import { revalidateMediaContentPaths } from "./revalidate";

export async function updateMediaContent(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/content/media?notice=error");

  const currentTopic = await getEditableMediaTopicById(id);
  if (!currentTopic) redirect("/admin/content/media?notice=error");

  const payload = getPayload(formData);

  try {
    payload.image = await uploadMediaImage(formData, payload.slug);
  } catch (error) {
    redirectEditError(id, error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  if (!payload.image.trim()) {
    payload.image = String(currentTopic.image ?? "");
  }

  const validationError = getValidationError(payload);
  if (validationError) redirectEditError(id, validationError);

  const section = await resolveMediaSection(payload.categorySlug);
  if (!section.ok) redirectEditError(id, section.message);

  if (!isMediaEditableContentType(section.contentType)) {
    redirectEditError(id, MEDIA_CONTENT_TYPE_ERROR);
  }

  const writePayload = resolveWriteMediaPayload(section.contentType, formData, payload);
  if (!writePayload.ok) redirectEditError(id, writePayload.message);

  const publishError = getPublishedValidationError(
    section.contentType,
    writePayload.mediaPayload,
    payload.status,
    payload,
  );
  if (publishError) redirectEditError(id, publishError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id);
  if (!isUniqueSlug) redirectEditError(id, "هذا الـ Slug مستخدم بالفعل في محتوى آخر.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update(
      buildMediaWritePayload(
        payload,
        section.category,
        section.contentType,
        writePayload.mediaPayload,
        now,
        currentTopic,
      ),
    )
    .eq("id", id)
    .in("content_type", [...MEDIA_EDITABLE_CONTENT_TYPES]);

  if (error) redirectEditError(id, error.message);

  revalidateMediaContentPaths(id);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("media_content", "update"),
    entityType: "media_content",
    entityId: Number(id),
    entityLabel: payload.title,
    metadata: { slug: payload.slug, content_type: section.contentType, status: payload.status },
  });
  redirect(`/admin/content/media/${id}?notice=saved`);
}
