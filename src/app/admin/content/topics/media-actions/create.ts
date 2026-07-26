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
} from "../../../../../components/admin/content/editors/media/media-content-config";
import {
  buildMediaWritePayload,
  getPayload,
  getPublishedValidationError,
  getValidationError,
  redirectFormError,
  resolveWriteMediaPayload,
  uploadMediaImage,
} from "./helpers";
import { ensureUniqueSlug, resolveMediaSection } from "./validation";
import { revalidateMediaContentPaths } from "./revalidate";

export async function createMediaContent(formData: FormData) {
  const actor = await requireAdminSession();
  const payload = getPayload(formData);
  const formPath = `/admin/content/topics/new?type=${encodeURIComponent(payload.contentType)}`;

  try {
    payload.image = await uploadMediaImage(formData, payload.slug);
  } catch (error) {
    redirectFormError(formPath, error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  const validationError = getValidationError(payload);
  if (validationError) redirectFormError(formPath, validationError);

  const section = await resolveMediaSection(payload.categoryId, payload.contentType);
  if (!section.ok) redirectFormError(formPath, section.message);

  if (!isMediaEditableContentType(section.contentType)) {
    redirectFormError(formPath, MEDIA_CONTENT_TYPE_ERROR);
  }

  const writePayload = resolveWriteMediaPayload(section.contentType, formData, payload);
  if (!writePayload.ok) redirectFormError(formPath, writePayload.message);

  const publishError = getPublishedValidationError(
    section.contentType,
    writePayload.mediaPayload,
    payload.status,
    payload,
  );
  if (publishError) redirectFormError(formPath, publishError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug);
  if (!isUniqueSlug) redirectFormError(formPath, "هذا الـ Slug مستخدم بالفعل في محتوى آخر.");

  const { data: series } = payload.seriesId
    ? await getSupabaseAdmin()
        .from("topic_series")
        .select("id,name,slug")
        .eq("id", Number(payload.seriesId))
        .eq("status", "published")
        .is("deleted_at", null)
        .maybeSingle<{ id: number; name: string; slug: string }>()
    : { data: null };
  if (payload.seriesId && !series) redirectFormError(formPath, "السلسلة المختارة غير موجودة أو غير مفعلة.");

  const now = new Date().toISOString();
  const domainPayload = buildMediaWritePayload(
    payload,
    section.category,
    section.contentType,
    writePayload.mediaPayload,
    now,
    null,
    series,
  );
  const leaseEntityIdentity = `create:${crypto.randomUUID()}`;
  let coordinated;
  try {
    coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "topics",
      leaseEntityIdentity,
      intendedRow: domainPayload,
      actorId: actor.id,
      requestIdentity: `media-topic:create:${leaseEntityIdentity}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("topics")
          .insert({
            ...domainPayload,
            created_at: now,
            created_by: actor.id,
            updated_by: actor.id,
            published_by: payload.status === "published" ? actor.id : null,
          })
          .select("id")
          .single<{ id: number }>();
        if (error || !data) throw new Error(error?.message || "تعذر إنشاء المحتوى.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
  } catch (error) {
    redirectFormError(
      formPath,
      error instanceof MediaReferenceWriteLeaseError
        ? getMediaReferenceWriteLeaseUserMessage(error.code)
        : error instanceof Error
          ? error.message
          : "تعذر إنشاء المحتوى.",
    );
  }
  const data = coordinated.value;
  const mediaSynchronization = coordinated.mediaSynchronization;
  revalidateMediaContentPaths(data.id);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", payload.status === "published" ? "publish" : "create"),
    entityType: "topic",
    entityId: data.id,
    entityLabel: payload.title,
    metadata: { slug: payload.slug, content_type: section.contentType, status: payload.status },
  });
  redirect(
    `/admin/content/topics/${data.id}?notice=${
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "saved_with_media_sync_warning"
        : "created"
    }`,
  );
}
