"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../../lib/admin/media-catalog/write-lease";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  isMediaEditableContentType,
  MEDIA_CONTENT_TYPE_ERROR,
  MEDIA_EDITABLE_CONTENT_TYPES,
} from "../../../../../components/admin/content/editors/media/media-content-config";
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
  const actor = await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/content/topics?notice=error");

  const currentTopic = await getEditableMediaTopicById(id);
  if (!currentTopic) redirect("/admin/content/topics?notice=error");

  const payload = getPayload(formData);

  try {
    payload.image = await uploadMediaImage(formData, payload.slug);
  } catch (error) {
    redirectEditError(id, error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  if (!formData.has("image")) {
    payload.image = String(currentTopic.image ?? "");
  }

  const validationError = getValidationError(payload);
  if (validationError) redirectEditError(id, validationError);

  const section = await resolveMediaSection(
    payload.categoryId,
    currentTopic.content_type,
    currentTopic.category_id,
  );
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

  const seriesQuery = payload.seriesId
    ? getSupabaseAdmin()
        .from("topic_series")
        .select("id,name,slug")
        .eq("id", Number(payload.seriesId))
        .is("deleted_at", null)
    : null;
  const { data: series } = seriesQuery
    ? await (Number(payload.seriesId) === currentTopic.series_id
        ? seriesQuery
        : seriesQuery.eq("status", "published")
      ).maybeSingle<{ id: number; name: string; slug: string }>()
    : { data: null };
  if (payload.seriesId && !series) redirectEditError(id, "السلسلة المختارة غير موجودة أو غير مفعلة.");

  const now = new Date().toISOString();
  const becamePublished = payload.status === "published" && currentTopic.status !== "published";
  const domainPayload = buildMediaWritePayload(
    payload,
    section.category,
    section.contentType,
    writePayload.mediaPayload,
    now,
    currentTopic,
    series,
  );
  let coordinated;
  try {
    coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "topics",
      leaseEntityIdentity: id,
      intendedRow: { ...currentTopic, ...domainPayload },
      actorId: actor.id,
      requestIdentity: `media-topic:update:${id}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("topics")
          .update({
            ...domainPayload,
            updated_by: actor.id,
            ...(becamePublished ? { published_by: actor.id } : {}),
          })
          .eq("id", id)
          .in("content_type", [...MEDIA_EDITABLE_CONTENT_TYPES])
          .select("id")
          .maybeSingle<{ id: number }>();
        if (error || !data) throw new Error(error?.message ?? "تعذر تحديث المحتوى.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
  } catch (error) {
    redirectEditError(
      id,
      error instanceof MediaReferenceWriteLeaseError
        ? getMediaReferenceWriteLeaseUserMessage(error.code)
        : error instanceof Error
          ? error.message
          : "تعذر تحديث المحتوى.",
    );
  }
  const mediaSynchronization = coordinated.mediaSynchronization;
  revalidateMediaContentPaths(id);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", becamePublished ? "publish" : "update"),
    entityType: "topic",
    entityId: Number(id),
    entityLabel: payload.title,
    metadata: { slug: payload.slug, content_type: section.contentType, status: payload.status },
  });
  redirect(
    `/admin/content/topics/${id}?notice=${
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "saved_with_media_sync_warning"
        : "saved"
    }`,
  );
}
