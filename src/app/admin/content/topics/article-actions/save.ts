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
import {
  buildTopicWritePayload,
  getDraftBlockingChecks,
  getPublishBlockingChecks,
  getNormalizedStatus,
  getPayload,
  preserveImage,
  preserveText,
  uploadTopicImage,
  validateId,
} from "./helpers";
import {
  ensureUniqueSlug,
  getCategory,
  getCategoryValidationError,
  getSeries,
  getTopicById,
} from "./validation";
import { revalidateUnifiedContentPaths } from "../editor-actions/revalidate";
import type { TopicPayload } from "./helpers";
import type { TopicStatus } from "./types";

type FieldErrors = Record<string, string[]>;

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
    title: "تعذر حفظ الموضوع",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
    ...(focusTarget ? { focusTarget } : {}),
  };
}

function addFieldError(
  fieldErrors: FieldErrors,
  field: string,
  message: string,
) {
  fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
}

function validateTopicFields(
  payload: TopicPayload,
  publishing: boolean,
) {
  const fieldErrors: FieldErrors = {};
  const issues = publishing
    ? getPublishBlockingChecks(payload)
    : getDraftBlockingChecks(payload);
  for (const issue of issues) {
    addFieldError(fieldErrors, issue.field ?? "status", issue.hint);
  }
  return fieldErrors;
}

function successMessage(mode: AdminFormMode, status: TopicStatus) {
  if (mode === "create") {
    return status === "published"
      ? "تم إنشاء الموضوع ونشره بنجاح."
      : "تم إنشاء الموضوع كغير منشور بنجاح.";
  }
  if (status === "published") return "تم حفظ الموضوع ونشره بنجاح.";
  if (status === "unpublished") {
    return "تم حفظ الموضوع وإخفاؤه مع الاحتفاظ بتاريخ أول نشر.";
  }
  return "تم حفظ تعديلات الموضوع بنجاح.";
}

function auditOperation(
  mode: AdminFormMode,
  currentStatus: TopicStatus | null,
  nextStatus: TopicStatus,
) {
  if (mode === "create") return nextStatus === "published" ? "publish" : "create";
  if (nextStatus === "published" && currentStatus !== "published") {
    return "publish";
  }
  if (currentStatus === "published" && nextStatus === "unpublished") {
    return "unpublish";
  }
  return "update";
}

export async function saveArticleContentAdapter(
  previousState: AdminFormActionState,
  formData: FormData,
): Promise<AdminFormActionState> {
  const actor = await requireAdminSession();
  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId.trim() : "";
  const mode: AdminFormMode = id ? "edit" : "create";
  const revision = previousState.revision + 1;
  const formFailure = (message: string, fieldErrors?: FieldErrors) =>
    buildFormFailure(mode, revision, message, fieldErrors);

  if (mode === "edit" && !validateId(id)) {
    return formFailure("معرّف الموضوع غير صالح.");
  }

  const currentTopic = mode === "edit" ? await getTopicById(id) : null;
  if (mode === "edit" && !currentTopic) {
    return formFailure("الموضوع غير موجود أو تعذر تحميله.");
  }

  const payload = getPayload(formData);
  const nextStatus = getNormalizedStatus(
    String(formData.get("status") ?? "unpublished"),
    "unpublished",
  );

  const baseErrors = validateTopicFields(payload, false);
  if (Object.keys(baseErrors).length) {
    return formFailure("راجع الحقول الموضحة ثم حاول مرة أخرى.", baseErrors);
  }

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id || undefined);
  if (!isUniqueSlug) {
    return formFailure("هذا الـ Slug مستخدم بالفعل في موضوع آخر.", {
      slug: ["اختر Slug مختلفًا."],
    });
  }

  const category = await getCategory(
    payload.categoryId,
    currentTopic?.category_id,
  );
  if (!category) {
    const categoryError = await getCategoryValidationError(
      payload.categoryId,
      currentTopic?.category_id,
    );
    const message =
      categoryError ?? "التصنيف المختار غير موجود أو غير مفعل.";
    return formFailure(message, { category_id: [message] });
  }

  const series = await getSeries(payload.seriesId, currentTopic?.series_id);
  if (payload.seriesId && !series) {
    return formFailure("السلسلة المختارة غير موجودة.", {
      series_id: ["اختر سلسلة متاحة أو اترك الحقل فارغًا."],
    });
  }

  if (currentTopic) {
    payload.image = preserveImage(
      payload.image,
      String(currentTopic.image ?? ""),
      payload.imageFieldPresent,
    );
    payload.imageAlt = preserveText(
      payload.imageAlt,
      String(currentTopic.image_alt ?? ""),
    );
    if (currentTopic.date_label) {
      payload.dateLabel = currentTopic.date_label;
    }
  }

  const pendingImageFile = formData.get("image_file");
  const hasPendingImageUpload =
    pendingImageFile instanceof File && pendingImageFile.size > 0;
  const publishErrors = validateTopicFields(
    hasPendingImageUpload ? { ...payload, image: "pending-upload" } : payload,
    nextStatus === "published",
  );
  if (Object.keys(publishErrors).length) {
    return formFailure(
      "تعذر النشر. أكمل الحقول المطلوبة ثم احفظ مرة أخرى.",
      publishErrors,
    );
  }

  try {
    payload.image = await uploadTopicImage(formData, payload.slug);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر رفع الصورة.";
    return formFailure(message, { image: [message] });
  }

  if (currentTopic) {
    payload.image = preserveImage(
      payload.image,
      String(currentTopic.image ?? ""),
      payload.imageFieldPresent,
    );
    payload.imageAlt = preserveText(
      payload.imageAlt,
      String(currentTopic.image_alt ?? ""),
    );
    if (currentTopic.date_label) {
      payload.dateLabel = currentTopic.date_label;
    }
  }

  const now = new Date().toISOString();
  const currentStatus = currentTopic
    ? getNormalizedStatus(String(currentTopic.status ?? "unpublished"), "unpublished")
    : null;
  const writePayload = buildTopicWritePayload(
    payload,
    category,
    series,
    nextStatus,
    now,
    currentTopic,
  );

  const leaseEntityIdentity = mode === "edit"
    ? id
    : `create:${crypto.randomUUID()}`;
  let coordinated;
  try {
    coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "topics",
      leaseEntityIdentity,
      intendedRow: {
        ...(currentTopic ?? {}),
        ...writePayload,
      },
      actorId: actor.id,
      requestIdentity: `topic-article:${mode}:${leaseEntityIdentity}`,
      mutate: async () => {
        if (mode === "create") {
          const { data, error } = await getSupabaseAdmin()
            .from("topics")
            .insert({
              ...writePayload,
              created_at: now,
              created_by: actor.id,
              updated_by: actor.id,
              published_by: nextStatus === "published" ? actor.id : null,
            })
            .select("id, slug")
            .single<{ id: number; slug: string }>();
          if (error || !data) {
            throw new Error(error?.message ?? "تعذر إنشاء الموضوع. راجع قاعدة البيانات.");
          }
          return data;
        } else {
          const { data, error } = await getSupabaseAdmin()
            .from("topics")
            .update({
              ...writePayload,
              updated_by: actor.id,
              ...(nextStatus === "published" && currentStatus !== "published"
                ? { published_by: actor.id }
                : {}),
            })
            .eq("id", id)
            .select("id, slug")
            .maybeSingle<{ id: number; slug: string }>();
          if (error || !data) throw new Error(error?.message ?? "تعذر تحديث الموضوع.");
          return data;
        }
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
  } catch (error) {
    if (error instanceof MediaReferenceWriteLeaseError) {
      return formFailure(getMediaReferenceWriteLeaseUserMessage(error.code), {
        image: [getMediaReferenceWriteLeaseUserMessage(error.code)],
      });
    }
    return formFailure(error instanceof Error ? error.message : "تعذر حفظ الموضوع.");
  }
  const entityId = coordinated.value.id;
  const savedSlug = coordinated.value.slug;
  const mediaSynchronization = coordinated.mediaSynchronization;

  revalidateUnifiedContentPaths({
    contentType: "article",
    id: entityId,
    oldSlug: currentTopic?.slug,
    newSlug: savedSlug,
  });

  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction(
        "topic",
        auditOperation(mode, currentStatus, nextStatus),
      ),
      entityType: "topic",
      entityId,
      entityLabel: payload.title,
      metadata: { slug: savedSlug, status: nextStatus },
    },
    actor,
  );

  return {
    status:
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "warning"
        : "success",
    revision,
    title:
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "تم حفظ الموضوع مع تنبيه للميديا"
        : "تم الحفظ بنجاح",
    message:
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "تم حفظ بيانات الموضوع، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص."
        : successMessage(mode, nextStatus),
    code:
      mediaSynchronization.status === "saved_with_media_sync_warning"
        ? "saved_with_media_sync_warning"
        : mode === "create"
        ? nextStatus === "published"
          ? "published"
          : "created"
        : nextStatus,
    entityId,
    mode,
    ...(mode === "create"
      ? { editHref: `/admin/content/topics/${entityId}` }
      : {}),
    savedRevision: `${entityId}:${now}`,
    result: { mediaSynchronization },
  };
}
