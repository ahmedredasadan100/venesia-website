"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  adminActionFailure,
  adminActionSuccess,
  adminActionWarning,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import {
  getMediaPublishBlockingChecks,
  mediaRowToPublishInput,
} from "../../../../lib/admin/content-workflow/media-publish-validation";
import {
  getTopicPublishBlockingChecks,
  topicRowToPublishInput,
} from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { isContentType } from "../../../../lib/admin/content/content-types";
import {
  ADMIN_CONTENT_ROUTES,
  adminContentTopicPath,
} from "../../../../lib/admin/content-routes";
import { getContentPublicVisibilityState } from "../../../../lib/content-public-visibility";
import {
  revalidateMediaCenterCache,
  revalidateTopicsCache,
} from "../../../../lib/cache/revalidate-public-cache-tags";
import { revalidateMediaCenterPublicPaths } from "../../../../lib/media-center/revalidate-public-paths";
import {
  TOPICS_COLUMN_CONTRACT_VERSION,
  TOPICS_LIST_VIEW_KEY,
  TOPICS_PREFERENCE_COLUMN_KEYS,
} from "../../../../lib/admin/content/topics-list-config";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  type MediaReferenceSynchronizationResult,
} from "../../../../lib/admin/media-catalog/synchronization";
import {
  isAdminContentSeriesInCategory,
  TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE,
} from "../../../../lib/admin/content/category-hierarchy";
import { coordinateMediaReferenceEntityMutation } from "../../../../lib/admin/media-catalog/domain-write-coordination";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../lib/admin/media-catalog/synchronization";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../lib/admin/media-catalog/write-lease";
import { getResourceLinkUsageCount } from "../../../../lib/admin/links/usage";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getIds(formData: FormData) {
  return [...new Set(formData.getAll("topic_ids").map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function loadTopic(id: number) {
  const { data } = await getSupabaseAdmin()
    .from("topics")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Record<string, unknown>>();
  return data;
}

async function loadDeletedTopic(id: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("*")
    .eq("id", id)
    .not("deleted_at", "is", null)
    .maybeSingle<Record<string, unknown>>();
  if (error) throw error;
  return data;
}

function isTopicSlugConflictError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    /topics_slug_key|slug/i.test(error.message ?? "")
  );
}

function topicRestoreSlugConflict(slug: string, entityId: number) {
  return adminActionFailure(
    "تعذر استعادة الموضوع",
    `لا يمكن استعادة الموضوع لأن الـSlug \"${slug}\" مستخدم في موضوع نشط آخر. غيّر Slug الموضوع النشط أولًا ثم أعد المحاولة.`,
    { code: "slug_conflict", entityId },
  );
}

type PublishPreflightFailure = {
  message: string;
  focusTarget?: string;
};

function getPublishFailure(
  topic: Record<string, unknown>,
): PublishPreflightFailure | null {
  const contentType = topic.content_type;
  if (!isContentType(contentType)) {
    return { message: "نوع المحتوى غير مدعوم." };
  }
  const issue = contentType === "article"
    ? getTopicPublishBlockingChecks(topicRowToPublishInput(topic))[0]
    : (() => {
        const input = mediaRowToPublishInput(topic);
        return input ? getMediaPublishBlockingChecks(input)[0] : null;
      })();
  if (!issue) return null;
  return {
    message: issue.hint,
    focusTarget: issue.correctionTarget?.targetId,
  };
}

function invalidMutation(message = "تعذر تنفيذ العملية."): AdminActionResult {
  return adminActionFailure("تعذر تنفيذ العملية", message);
}

async function validateBulkCategoryMoveSeries(
  topicIds: number[],
  categoryId: number,
) {
  const { data: topics, error: topicsError } = await getSupabaseAdmin()
    .from("topics")
    .select("id,series_id")
    .in("id", topicIds);
  if (topicsError) throw topicsError;

  const seriesIds = [
    ...new Set(
      (topics ?? [])
        .map((topic) => Number(topic.series_id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (!seriesIds.length) return null;

  const { data: series, error: seriesError } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id,category_id")
    .in("id", seriesIds);
  if (seriesError) throw seriesError;
  const seriesById = new Map(
    (series ?? []).map((item) => [Number(item.id), item]),
  );
  const conflict = (topics ?? []).find((topic) => {
    if (!topic.series_id) return false;
    const linkedSeries = seriesById.get(Number(topic.series_id));
    return (
      !linkedSeries ||
      !isAdminContentSeriesInCategory(linkedSeries, categoryId)
    );
  });

  return conflict
    ? `${TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE} تعارض الموضوع رقم ${conflict.id}.`
    : null;
}

function mediaAwareSuccess(
  synchronization: MediaReferenceSynchronizationResult,
  title: string,
  message: string,
  options: { code?: AdminActionResult["code"]; entityId?: number } = {},
) {
  if (synchronization.status === "saved_with_media_sync_warning") {
    return adminActionWarning(
      "تم حفظ المحتوى مع تنبيه للميديا",
      "تم حفظ بيانات المحتوى، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص.",
      { code: "saved_with_media_sync_warning", entityId: options.entityId },
    );
  }
  return adminActionSuccess(title, message, options);
}

async function finishMutation(input: {
  actor: Awaited<ReturnType<typeof requireAdminSession>>;
  action:
    | "publish"
    | "unpublish"
    | "update"
    | "delete"
    | "permanent_delete"
    | "restore"
    | "duplicate";
  entityId?: number;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  revalidateTopicsCache();
  revalidateMediaCenterCache();
  revalidateMediaCenterPublicPaths();
  revalidatePath("/topics");
  revalidatePath(ADMIN_CONTENT_ROUTES.topics);
  if (input.entityId) revalidatePath(adminContentTopicPath(input.entityId));
  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("topic", input.action),
      entityType: "topic",
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      metadata: input.metadata,
    },
    input.actor,
  );
}

export async function setUnifiedContentStatus(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return invalidMutation();
  }

  const topic = await loadTopic(id);
  if (!topic) return invalidMutation("المحتوى غير موجود أو تم حذفه.");
  const visibility = getContentPublicVisibilityState({
    status: typeof topic.status === "string" ? topic.status : null,
    deletedAt:
      typeof topic.deleted_at === "string" ? topic.deleted_at : null,
  });
  if (!visibility.nextStatus) {
    return adminActionFailure(
      "تعذر نشر المحتوى",
      visibility.tooltip,
      { entityId: id },
    );
  }
  const nextStatus = getString(formData, "next_status");
  if (nextStatus !== visibility.nextStatus) {
    return invalidMutation("تغيرت حالة المحتوى. حدّث الصفحة وحاول مرة أخرى.");
  }

  if (nextStatus === "published") {
    const publishFailure = getPublishFailure(topic);
    if (publishFailure) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        publishFailure.message,
        {
          code: "publish_validation",
          entityId: id,
          focusTarget: publishFailure.focusTarget,
        },
      );
    }
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
    updated_by: actor.id,
  };
  if (nextStatus === "published") {
    payload.published_at = topic.published_at || now;
    payload.published_by = actor.id;
  }
  payload.deleted_at = null;

  const { error } = await getSupabaseAdmin().from("topics").update(payload).eq("id", id);
  if (error) return invalidMutation(error.message);

  await finishMutation({
    actor,
    action: nextStatus === "published" ? "publish" : "unpublish",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: { status: nextStatus, content_type: topic.content_type },
  });
  return adminActionSuccess(
    nextStatus === "published" ? "تم نشر المحتوى" : "تم إخفاء المحتوى",
    nextStatus === "published" ? "أصبح المحتوى ظاهرًا للعامة." : "لم يعد المحتوى ظاهرًا للعامة.",
    { code: nextStatus === "published" ? "published" : "unpublished", entityId: id },
  );
}

export async function toggleUnifiedContentFeatured(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();

  const topic = await loadTopic(id);
  if (!topic) return invalidMutation("المحتوى غير موجود أو تم حذفه.");
  const isFeatured = !Boolean(topic.is_featured);
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      is_featured: isFeatured,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    })
    .eq("id", id);
  if (error) return invalidMutation(error.message);

  await finishMutation({
    actor,
    action: "update",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: { is_featured: isFeatured },
  });
  return adminActionSuccess(
    "تم تحديث التمييز",
    isFeatured ? "تم تعيين المحتوى كمميز." : "تم إلغاء تمييز المحتوى.",
    { code: isFeatured ? "featured" : "unfeatured", entityId: id },
  );
}

async function createUniqueCopySlug(baseSlug: string) {
  let candidate = `${baseSlug || "content"}-copy`;
  let suffix = 2;
  while (true) {
    const { count } = await getSupabaseAdmin()
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);
    if (!count) return candidate;
    candidate = `${baseSlug || "content"}-copy-${suffix}`;
    suffix += 1;
  }
}

export async function duplicateUnifiedContent(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();
  const topic = await loadTopic(id);
  if (!topic) return invalidMutation("المحتوى غير موجود أو تم حذفه.");

  const slug = await createUniqueCopySlug(String(topic.slug ?? "content"));
  const now = new Date().toISOString();
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    created_by: _createdBy,
    updated_by: _updatedBy,
    published_by: _publishedBy,
    views_count: _viewsCount,
    ...copyable
  } = topic;
  void [_id, _createdAt, _updatedAt, _createdBy, _updatedBy, _publishedBy, _viewsCount];

  const nextRow = {
    ...copyable,
    title: `${String(topic.title ?? "بدون عنوان")} - نسخة`,
    slug,
    status: "unpublished",
    published_at: null,
    published_by: null,
    views_count: 0,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    created_by: actor.id,
    updated_by: actor.id,
  };
  const leaseEntityIdentity = `duplicate:${id}:${crypto.randomUUID()}`;
  let coordinated;
  try {
    coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "topics",
      leaseEntityIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `topic-duplicate:${id}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("topics")
          .insert(nextRow)
          .select("id")
          .single<{ id: number }>();
        if (error || !data) throw new Error(error?.message ?? "تعذر نسخ المحتوى.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
  } catch (error) {
    return invalidMutation(
      error instanceof MediaReferenceWriteLeaseError
        ? getMediaReferenceWriteLeaseUserMessage(error.code)
        : error instanceof Error
          ? error.message
          : "تعذر نسخ المحتوى.",
    );
  }
  const data = coordinated.value;
  const mediaSynchronization = coordinated.mediaSynchronization;
  await finishMutation({
    actor,
    action: "duplicate",
    entityId: data.id,
    entityLabel: `${String(topic.title ?? "بدون عنوان")} - نسخة`,
    metadata: { source_topic_id: id, content_type: topic.content_type },
  });
  return mediaAwareSuccess(
    mediaSynchronization,
    "تم نسخ المحتوى",
    "أُنشئت نسخة جديدة كغير منشورة.",
    { code: "created", entityId: data.id },
  );
}

export async function softDeleteUnifiedContent(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();
  const topic = await loadTopic(id);
  if (!topic) return invalidMutation("المحتوى غير موجود أو تم حذفه.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({ status: "unpublished", deleted_at: now, updated_at: now, updated_by: actor.id })
    .eq("id", id);
  if (error) return invalidMutation(error.message);

  await finishMutation({
    actor,
    action: "delete",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: {
      permanent: false,
      slug: topic.slug,
      slug_retained: true,
    },
  });
  return adminActionSuccess(
    "تم نقل الموضوع إلى المحذوفات",
    "اختفى الموضوع من القائمة النشطة، وبقي الـSlug محجوزًا حتى الحذف النهائي.",
    { code: "deleted", entityId: id },
  );
}

export async function restoreUnifiedContent(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();

  let topic: Record<string, unknown> | null;
  try {
    topic = await loadDeletedTopic(id);
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (!topic) {
    return invalidMutation("الموضوع غير موجود في المحذوفات أو تمت استعادته بالفعل.");
  }

  const slug = String(topic.slug ?? "").trim();
  const { data: slugConflict, error: slugLookupError } = await getSupabaseAdmin()
    .from("topics")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: number }>();
  if (slugLookupError) return invalidMutation(slugLookupError.message);
  if (slugConflict) return topicRestoreSlugConflict(slug, id);

  const now = new Date().toISOString();
  const { data: restored, error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: "unpublished",
      deleted_at: null,
      updated_at: now,
      updated_by: actor.id,
    })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle<{ id: number }>();
  if (error) {
    return isTopicSlugConflictError(error)
      ? topicRestoreSlugConflict(slug, id)
      : invalidMutation(error.message);
  }
  if (!restored) {
    return invalidMutation("الموضوع لم يعد موجودًا في المحذوفات. حدّث الصفحة وحاول مرة أخرى.");
  }

  await finishMutation({
    actor,
    action: "restore",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: {
      slug,
      restored_status: "unpublished",
      previous_deleted_at: topic.deleted_at,
    },
  });
  return adminActionSuccess(
    "تمت استعادة الموضوع",
    "عاد الموضوع إلى القائمة النشطة كغير منشور.",
    { code: "restored", entityId: id },
  );
}

export async function permanentlyDeleteUnifiedContent(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();
  if (getString(formData, "confirm_permanent") !== "true") {
    return adminActionFailure(
      "يلزم تأكيد الحذف النهائي",
      "أكّد الحذف النهائي صراحةً قبل إزالة الموضوع وتحرير الـSlug.",
      { entityId: id },
    );
  }

  let topic: Record<string, unknown> | null;
  try {
    topic = await loadDeletedTopic(id);
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (!topic) {
    return invalidMutation("الموضوع غير موجود في المحذوفات أو تم حذفه نهائيًا بالفعل.");
  }

  let linkUsageCount: number;
  try {
    linkUsageCount = await getResourceLinkUsageCount({
      linkedType: "topics",
      linkedId: id,
    });
  } catch (error) {
    return invalidMutation(
      error instanceof Error
        ? error.message
        : "تعذر فحص روابط الموضوع قبل الحذف النهائي.",
    );
  }
  if (linkUsageCount > 0) {
    return adminActionFailure(
      "تعذر الحذف النهائي",
      `الموضوع مستخدم في ${linkUsageCount} من الروابط الداخلية. أزل هذه الروابط أولًا ثم أعد المحاولة.`,
      { entityId: id },
    );
  }

  const slug = String(topic.slug ?? "").trim();
  const { data: deleted, error } = await getSupabaseAdmin()
    .from("topics")
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle<{ id: number }>();
  if (error) return invalidMutation(error.message);
  if (!deleted) {
    return invalidMutation("الموضوع لم يعد موجودًا في المحذوفات. حدّث الصفحة وحاول مرة أخرى.");
  }

  const mediaSynchronization =
    await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      [{ domainKey: "topics", entityIdentity: id }],
    );
  await finishMutation({
    actor,
    action: "permanent_delete",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: {
      permanent: true,
      slug,
      slug_released: true,
      content_type: topic.content_type,
      media_synchronization_status: mediaSynchronization.status,
    },
  });

  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    return adminActionWarning(
      "تم الحذف النهائي مع تنبيه للميديا",
      "حُذف الموضوع وتحرر الـSlug، لكن تعذر إثبات تنظيف مراجع الميديا بالكامل ويلزم فحصها.",
      { code: "saved_with_media_sync_warning", entityId: id },
    );
  }
  return adminActionSuccess(
    "تم حذف الموضوع نهائيًا",
    `حُذف السجل نهائيًا وأصبح الـSlug \"${slug}\" متاحًا للاستخدام.`,
    { code: "permanently_deleted", entityId: id },
  );
}

export async function bulkUpdateUnifiedContent(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const ids = getIds(formData);
  const action = getString(formData, "bulk_action");
  if (!ids.length) return invalidMutation("حدد محتوى واحدًا على الأقل.");

  const now = new Date().toISOString();
  let payload: Record<string, unknown> | null = null;

  if (action === "publish") {
    const { data, error: readError } = await getSupabaseAdmin()
      .from("topics")
      .select("*")
      .in("id", ids)
      .is("deleted_at", null);
    if (readError) return invalidMutation(readError.message);
    if ((data ?? []).length !== ids.length) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        "بعض السجلات غير موجودة أو محذوفة. حدّث الصفحة وحاول مرة أخرى.",
      );
    }
    const restoreRequired = (data ?? []).find(
      (topic) =>
        getContentPublicVisibilityState({
          status: topic.status,
          deletedAt: topic.deleted_at,
        }).actionIntent === "restore_required",
    );
    if (restoreRequired) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        getContentPublicVisibilityState({
          status: restoreRequired.status,
          deletedAt: restoreRequired.deleted_at,
        }).tooltip,
        {
          code: "publish_validation",
          entityId: Number(restoreRequired.id),
        },
      );
    }
    const invalid = (data ?? [])
      .map((topic) => ({ topic, failure: getPublishFailure(topic) }))
      .find((entry) => entry.failure);
    if (invalid?.failure) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        invalid.failure.message,
        {
          code: "publish_validation",
          entityId: Number(invalid.topic.id),
          focusTarget: invalid.failure.focusTarget,
        },
      );
    }
    const results = await Promise.all(
      (data ?? []).map((topic) =>
        getSupabaseAdmin()
          .from("topics")
          .update({
            status: "published",
            published_at: topic.published_at || now,
            published_by: actor.id,
            updated_by: actor.id,
            updated_at: now,
          })
          .eq("id", topic.id),
      ),
    );
    const publishError = results.find((result) => result.error)?.error;
    if (publishError) return invalidMutation(publishError.message);
    await finishMutation({
      actor,
      action: "publish",
      metadata: { bulk_action: action, topic_ids: ids, count: ids.length },
    });
    return adminActionSuccess(
      "تم نشر المحتوى",
      `تم نشر ${ids.length} من عناصر المحتوى بنجاح.`,
      { code: "published" },
    );
  } else if (action === "unpublish") {
    payload = { status: "unpublished", updated_by: actor.id, updated_at: now };
  } else if (action === "delete") {
    payload = { status: "unpublished", deleted_at: now, updated_by: actor.id, updated_at: now };
  } else if (action === "feature" || action === "unfeature") {
    payload = { is_featured: action === "feature", updated_by: actor.id, updated_at: now };
  } else if (action === "move_category") {
    const categoryId = Number(getString(formData, "category_id"));
    const { data: category } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id,name,slug")
      .eq("id", categoryId)
      .eq("is_active", true)
      .maybeSingle<{ id: number; name: string; slug: string }>();
    if (!category) return invalidMutation("التصنيف المختار غير متاح.");
    try {
      const seriesCategoryError = await validateBulkCategoryMoveSeries(
        ids,
        category.id,
      );
      if (seriesCategoryError) return invalidMutation(seriesCategoryError);
    } catch (error) {
      return invalidMutation(
        error instanceof Error
          ? error.message
          : "تعذر التحقق من توافق السلاسل مع التصنيف.",
      );
    }
    payload = {
      category_id: category.id,
      category: category.name,
      category_slug: category.slug,
      updated_by: actor.id,
      updated_at: now,
    };
  }

  if (!payload) return invalidMutation("الإجراء الجماعي غير صالح.");
  const { error } = await getSupabaseAdmin().from("topics").update(payload).in("id", ids);
  if (error) return invalidMutation(error.message);

  await finishMutation({
    actor,
    action: action === "publish" ? "publish" : action === "unpublish" ? "unpublish" : action === "delete" ? "delete" : "update",
    metadata: {
      bulk_action: action,
      topic_ids: ids,
      count: ids.length,
      ...(action === "delete"
        ? { permanent: false, slug_retained: true }
        : {}),
    },
  });
  return adminActionSuccess(
    action === "delete" ? "تم نقل المحتوى إلى المحذوفات" : "تم تحديث المحتوى",
    action === "delete"
      ? `تم نقل ${ids.length} من عناصر المحتوى إلى المحذوفات مع إبقاء الـSlug محجوزًا.`
      : `تم تحديث ${ids.length} من عناصر المحتوى بنجاح.`,
    { code: action === "delete" ? "deleted" : "saved" },
  );
}

export async function saveContentTablePreferences(visibleColumns: string[]) {
  return saveAdminColumnPreferences({
    viewKey: TOPICS_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: TOPICS_PREFERENCE_COLUMN_KEYS,
    contractVersion: TOPICS_COLUMN_CONTRACT_VERSION,
  });
}
