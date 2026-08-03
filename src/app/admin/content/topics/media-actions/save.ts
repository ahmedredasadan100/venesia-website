"use server";

import type {
  AdminFormActionState,
  AdminFormMode,
} from "../../../../../lib/admin/form-runtime";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../../lib/admin/media-catalog/write-lease";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { validateEntitySeoValues } from "../../../../../lib/seo/entity-seo-types";
import type { MediaTopicPayload } from "../../../../../lib/admin/media-topic-payload";
import {
  isMediaEditableContentType,
  MEDIA_CONTENT_TYPE_ERROR,
  MEDIA_EDITABLE_CONTENT_TYPES,
} from "../../../../../components/admin/content/editors/media/media-content-config";
import {
  buildMediaWritePayload,
  getPayload,
  getPublishedValidationError,
  getValidationError,
  resolveWriteMediaPayload,
  uploadMediaImage,
  validateId,
  validateSlug,
  type MediaPayload,
} from "./helpers";
import {
  ensureUniqueSlug,
  getEditableMediaTopicById,
  resolveMediaSection,
} from "./validation";
import { revalidateUnifiedContentPaths } from "../editor-actions/revalidate";

type FieldErrors = Record<string, string[]>;

function addFieldError(
  fieldErrors: FieldErrors,
  field: string,
  message: string,
) {
  fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
}

function buildFormFailure(
  mode: AdminFormMode,
  revision: number,
  message: string,
  fieldErrors?: FieldErrors,
): AdminFormActionState {
  const focusTarget = fieldErrors ? Object.keys(fieldErrors)[0] : undefined;
  return {
    status: "error",
    mode,
    revision,
    title: "تعذر حفظ المحتوى",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
    ...(focusTarget ? { focusTarget } : {}),
  };
}

function validateBaseFields(payload: MediaPayload) {
  const fieldErrors: FieldErrors = {};
  for (const issue of validateEntitySeoValues(payload)) {
    addFieldError(fieldErrors, issue.field, issue.message);
  }
  if (!payload.title) {
    addFieldError(fieldErrors, "title", "العنوان مطلوب.");
  }
  if (!payload.slug) {
    addFieldError(fieldErrors, "slug", "الرابط مطلوب.");
  } else if (!validateSlug(payload.slug)) {
    addFieldError(
      fieldErrors,
      "slug",
      "استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط.",
    );
  }
  if (!payload.categoryId || !validateId(payload.categoryId)) {
    addFieldError(fieldErrors, "category_id", "التصنيف مطلوب.");
  }
  return fieldErrors;
}

function publishField(
  contentType: string,
  payload: MediaPayload,
  mediaPayload: MediaTopicPayload | null,
) {
  if (payload.excerpt.trim().length < 20) return "excerpt";
  if (contentType === "video" && mediaPayload?.kind === "video" && !mediaPayload.video_url.trim()) {
    return "video_url";
  }
  if (contentType === "gallery") {
    if (mediaPayload?.kind !== "gallery" || mediaPayload.images.length === 0) {
      return "gallery_image_url";
    }
    if (mediaPayload.images.some((item) => !item.alt?.trim())) {
      return "gallery_image_alt";
    }
  }
  if (!["video", "gallery"].includes(contentType) && !payload.content) return "content";
  if (!payload.image) return "image";
  if (!payload.imageAlt) return "image_alt";
  if (!payload.focusKeyword) return "focus_keyword";
  if (!payload.seoTitle || payload.seoTitle.length < 45) return "seo_title";
  if (!payload.seoDescription || payload.seoDescription.length < 120) return "seo_description";
  return "status";
}

function successMessage(mode: AdminFormMode, status: string) {
  if (mode === "create") {
    return status === "published"
      ? "تم إنشاء المحتوى ونشره بنجاح."
      : "تم إنشاء المحتوى بنجاح.";
  }
  return status === "published"
    ? "تم حفظ المحتوى ونشره بنجاح."
    : "تم حفظ تعديلات المحتوى بنجاح.";
}

export async function saveMediaContentAdapter(
  previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const actor = await requireAdminSession();
  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId.trim() : "";
  const mode: AdminFormMode = id ? "edit" : "create";
  const revision = previousState.revision + 1;
  const failure = (message: string, fieldErrors?: FieldErrors) =>
    buildFormFailure(mode, revision, message, fieldErrors);

  if (mode === "edit" && !validateId(id)) {
    return failure("معرّف المحتوى غير صالح.");
  }

  const currentTopic =
    mode === "edit" ? await getEditableMediaTopicById(id) : null;
  if (mode === "edit" && !currentTopic) {
    return failure("المحتوى غير موجود أو تعذر تحميله.");
  }

  const payload = getPayload(formData);
  const baseErrors = validateBaseFields(payload);
  if (Object.keys(baseErrors).length) {
    return failure(
      "راجع الحقول الموضحة ثم حاول مرة أخرى.",
      baseErrors,
    );
  }
  const baseError = getValidationError(payload);
  if (baseError) return failure(baseError);

  try {
    payload.image = await uploadMediaImage(formData, payload.slug);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر رفع الصورة.";
    return failure(message, { image: [message] });
  }
  if (!formData.has("image") && currentTopic) {
    payload.image = String(currentTopic.image ?? "");
  }

  const requestedType =
    mode === "edit" ? currentTopic?.content_type : payload.contentType;
  if (!isMediaEditableContentType(requestedType)) {
    return failure(MEDIA_CONTENT_TYPE_ERROR, {
      content_type: [MEDIA_CONTENT_TYPE_ERROR],
    });
  }

  const section = await resolveMediaSection(
    payload.categoryId,
    requestedType,
    currentTopic?.category_id,
  );
  if (!section.ok) {
    return failure(section.message, { category_id: [section.message] });
  }

  const writePayload = resolveWriteMediaPayload(
    section.contentType,
    formData,
    payload,
  );
  if (!writePayload.ok) {
    const field = section.contentType === "video"
      ? "video_url"
      : section.contentType === "gallery"
        ? "gallery_image_url"
        : "content";
    return failure(writePayload.message, { [field]: [writePayload.message] });
  }

  const publishError = getPublishedValidationError(
    section.contentType,
    writePayload.mediaPayload,
    payload.status,
    payload,
  );
  if (publishError) {
    const field = publishField(
      section.contentType,
      payload,
      writePayload.mediaPayload,
    );
    return failure(publishError, { [field]: [publishError] });
  }

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id || undefined);
  if (!isUniqueSlug) {
    return failure("هذا الـ Slug مستخدم بالفعل في محتوى آخر.", {
      slug: ["اختر Slug مختلفًا."],
    });
  }

  const seriesQuery = payload.seriesId
    ? getSupabaseAdmin()
        .from("topic_series")
        .select("id,name,slug")
        .eq("id", Number(payload.seriesId))
        .is("deleted_at", null)
    : null;
  const { data: series } = seriesQuery
    ? await (Number(payload.seriesId) === currentTopic?.series_id
        ? seriesQuery
        : seriesQuery.eq("status", "published")
      ).maybeSingle<{ id: number; name: string; slug: string }>()
    : { data: null };
  if (payload.seriesId && !series) {
    return failure("السلسلة المختارة غير موجودة أو غير مفعلة.", {
      series_id: ["اختر سلسلة متاحة أو اترك الحقل فارغًا."],
    });
  }

  const now = new Date().toISOString();
  const currentStatus = currentTopic?.status ?? null;
  const becamePublished =
    payload.status === "published" && currentStatus !== "published";
  const domainPayload = buildMediaWritePayload(
    payload,
    section.category,
    section.contentType,
    writePayload.mediaPayload,
    now,
    currentTopic,
    series,
  );
  const leaseEntityIdentity =
    mode === "edit" ? id : `create:${crypto.randomUUID()}`;

  let coordinated;
  try {
    coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "topics",
      leaseEntityIdentity,
      intendedRow: { ...(currentTopic ?? {}), ...domainPayload },
      actorId: actor.id,
      requestIdentity: `media-topic:${mode}:${leaseEntityIdentity}`,
      mutate: async () => {
        if (mode === "create") {
          const { data, error } = await getSupabaseAdmin()
            .from("topics")
            .insert({
              ...domainPayload,
              created_at: now,
              created_by: actor.id,
              updated_by: actor.id,
              published_by:
                payload.status === "published" ? actor.id : null,
            })
            .select("id,slug")
            .single<{ id: number; slug: string }>();
          if (error || !data) {
            throw new Error(error?.message ?? "تعذر إنشاء المحتوى.");
          }
          return data;
        } else {
          const { data, error } = await getSupabaseAdmin()
            .from("topics")
            .update({
              ...domainPayload,
              updated_by: actor.id,
              ...(becamePublished ? { published_by: actor.id } : {}),
            })
            .eq("id", id)
            .in("content_type", [...MEDIA_EDITABLE_CONTENT_TYPES])
            .is("deleted_at", null)
            .select("id,slug")
            .maybeSingle<{ id: number; slug: string }>();
          if (error || !data) {
            throw new Error(error?.message ?? "تعذر تحديث المحتوى.");
          }
          return data;
        }
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
  } catch (error) {
    return failure(
      error instanceof MediaReferenceWriteLeaseError
        ? getMediaReferenceWriteLeaseUserMessage(error.code)
        : error instanceof Error
          ? error.message
          : "تعذر حفظ المحتوى.",
    );
  }

  const entityId = coordinated.value.id;
  revalidateUnifiedContentPaths({
    contentType: section.contentType,
    id: entityId,
    oldSlug: currentTopic?.slug,
    newSlug: coordinated.value.slug,
  });
  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction(
        "topic",
        mode === "create"
          ? payload.status === "published"
            ? "publish"
            : "create"
          : becamePublished
            ? "publish"
            : currentStatus === "published" &&
                payload.status === "unpublished"
              ? "unpublish"
              : "update",
      ),
      entityType: "topic",
      entityId,
      entityLabel: payload.title,
      metadata: {
        slug: coordinated.value.slug,
        content_type: section.contentType,
        status: payload.status,
      },
    },
    actor,
  );

  const mediaSynchronization = coordinated.mediaSynchronization;
  return {
    status:
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "warning"
        : "success",
    mode,
    revision,
    title:
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "تم حفظ المحتوى مع تنبيه للميديا"
        : "تم الحفظ بنجاح",
    message:
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "تم حفظ البيانات، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح."
        : successMessage(mode, payload.status),
    code:
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "saved_with_media_sync_warning"
        : mode === "create"
          ? "created"
          : payload.status,
    entityId,
    ...(mode === "create"
      ? { editHref: `/admin/content/topics/${entityId}` }
      : {}),
    savedRevision: `${entityId}:${now}`,
    result: { mediaSynchronization },
  };
}
