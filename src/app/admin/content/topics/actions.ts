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

type DeletedTopicMutationRow = {
  id: number;
  title: string | null;
  slug: string;
  content_type: string;
  deleted_at: string;
};

type TopicMutationActor = Awaited<ReturnType<typeof requireAdminSession>>;

async function loadDeletedTopics(ids: number[]) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id,title,slug,content_type,deleted_at")
    .in("id", ids)
    .not("deleted_at", "is", null)
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DeletedTopicMutationRow[];
}

async function loadAllDeletedTopics() {
  const pageSize = 500;
  const rows: DeletedTopicMutationRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseAdmin()
      .from("topics")
      .select("id,title,slug,content_type,deleted_at")
      .not("deleted_at", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as DeletedTopicMutationRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
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

async function findActiveTopicSlugConflict(
  topics: DeletedTopicMutationRow[],
) {
  const slugs = [...new Set(topics.map((topic) => topic.slug.trim()))].filter(
    Boolean,
  );
  if (!slugs.length) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id,slug")
    .in("slug", slugs)
    .is("deleted_at", null)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: number; slug: string }>();
  if (error) throw error;
  return data;
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

async function restoreTopicsWithCanonicalOwner(input: {
  actor: TopicMutationActor;
  ids: number[];
  scope: "single" | "selected";
}): Promise<AdminActionResult> {
  let topics: DeletedTopicMutationRow[];
  try {
    topics = await loadDeletedTopics(input.ids);
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (topics.length !== input.ids.length) {
    return adminActionFailure(
      "تعذر الاستعادة",
      "بعض الموضوعات المحددة ليست داخل المحذوفات. لم تتم استعادة أي Topic نشط.",
    );
  }

  let slugConflict: { id: number; slug: string } | null;
  try {
    slugConflict = await findActiveTopicSlugConflict(topics);
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (slugConflict) {
    const topic =
      topics.find((item) => item.slug === slugConflict.slug) ?? topics[0];
    return topicRestoreSlugConflict(topic.slug, topic.id);
  }

  const now = new Date().toISOString();
  const { data: restored, error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: "unpublished",
      deleted_at: null,
      updated_at: now,
      updated_by: input.actor.id,
    })
    .in("id", input.ids)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) {
    if (isTopicSlugConflictError(error)) {
      let conflictAfterWrite: { id: number; slug: string } | null = null;
      try {
        conflictAfterWrite = await findActiveTopicSlugConflict(topics);
      } catch {}
      const topic = conflictAfterWrite
        ? topics.find((item) => item.slug === conflictAfterWrite.slug) ?? topics[0]
        : topics[0];
      return topicRestoreSlugConflict(topic.slug, topic.id);
    }
    return invalidMutation(error.message);
  }
  if ((restored ?? []).length !== topics.length) {
    return invalidMutation(
      "تغيرت حالة بعض الموضوعات أثناء الاستعادة. حدّث الصفحة وحاول مرة أخرى.",
    );
  }

  const singleTopic = input.scope === "single" ? topics[0] : null;
  await finishMutation({
    actor: input.actor,
    action: "restore",
    entityId: singleTopic?.id,
    entityLabel: singleTopic?.title ?? undefined,
    metadata: {
      bulk: input.scope === "selected",
      bulk_action: input.scope === "selected" ? "restore" : undefined,
      topic_ids: topics.map((topic) => topic.id),
      count: topics.length,
      restored_status: "unpublished",
      ...(singleTopic
        ? {
            slug: singleTopic.slug,
            previous_deleted_at: singleTopic.deleted_at,
          }
        : { slugs: topics.map((topic) => topic.slug) }),
    },
  });

  return adminActionSuccess(
    input.scope === "single" ? "تمت استعادة الموضوع" : "تمت استعادة المحدد",
    input.scope === "single"
      ? "عاد الموضوع إلى القائمة النشطة كغير منشور."
      : `تمت استعادة ${topics.length} من الموضوعات المحددة كغير منشورة.`,
    {
      code: "restored",
      entityId: singleTopic?.id,
    },
  );
}

async function permanentlyDeleteTopicsWithCanonicalOwner(input: {
  actor: TopicMutationActor;
  ids: number[];
  scope: "single" | "selected" | "empty_trash";
  expectedTotalDeletedCount?: number;
}): Promise<AdminActionResult> {
  let topics: DeletedTopicMutationRow[];
  try {
    topics = await loadDeletedTopics(input.ids);
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (topics.length !== input.ids.length) {
    return adminActionFailure(
      "تعذر الحذف النهائي",
      "بعض الموضوعات المحددة ليست داخل المحذوفات. لم يتم حذف أي Topic نشط.",
    );
  }

  for (const topic of topics) {
    let linkUsageCount: number;
    try {
      linkUsageCount = await getResourceLinkUsageCount({
        linkedType: "topics",
        linkedId: topic.id,
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
        `الموضوع «${topic.title || topic.id}» مستخدم في ${linkUsageCount} من الروابط الداخلية. لم يتم حذف أي موضوع.`,
        { entityId: input.scope === "single" ? topic.id : undefined },
      );
    }
  }

  if (input.scope === "empty_trash") {
    const { count, error: countError } = await getSupabaseAdmin()
      .from("topics")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null);
    if (countError) return invalidMutation(countError.message);
    if (count !== input.expectedTotalDeletedCount) {
      return adminActionFailure(
        "تغير عدد المحذوفات",
        "تغير عدد الموضوعات المحذوفة بعد فتح التأكيد. حدّث الصفحة وراجع العدد قبل المحاولة مرة أخرى.",
      );
    }
  }

  const { data: deleted, error } = await getSupabaseAdmin()
    .from("topics")
    .delete()
    .in("id", input.ids)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return invalidMutation(error.message);
  if ((deleted ?? []).length !== topics.length) {
    return invalidMutation(
      "تغيرت حالة بعض الموضوعات أثناء الحذف النهائي. حدّث الصفحة وراجع المحذوفات.",
    );
  }

  const deletedIds = (deleted ?? []).map((row) => Number(row.id));
  const mediaSynchronization =
    await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      deletedIds.map((id) => ({ domainKey: "topics", entityIdentity: id })),
    );
  const singleTopic = input.scope === "single" ? topics[0] : null;
  await finishMutation({
    actor: input.actor,
    action: "permanent_delete",
    entityId: singleTopic?.id,
    entityLabel: singleTopic?.title ?? undefined,
    metadata: {
      bulk: input.scope !== "single",
      bulk_action:
        input.scope === "selected"
          ? "permanent_delete"
          : input.scope === "empty_trash"
            ? "empty_trash"
            : undefined,
      empty_trash: input.scope === "empty_trash",
      topic_ids: deletedIds,
      count: deletedIds.length,
      permanent: true,
      slug_released: true,
      ...(singleTopic
        ? {
            slug: singleTopic.slug,
            content_type: singleTopic.content_type,
          }
        : {
            slugs: topics.map((topic) => topic.slug),
            content_types: topics.map((topic) => topic.content_type),
          }),
      media_synchronization_status: mediaSynchronization.status,
    },
  });

  const title =
    input.scope === "single"
      ? "تم حذف الموضوع نهائيًا"
      : input.scope === "selected"
        ? "تم الحذف النهائي للمحدد"
        : "تم إفراغ المحذوفات";
  const message =
    input.scope === "single"
      ? `حُذف السجل نهائيًا وأصبح الـSlug \"${topics[0].slug}\" متاحًا للاستخدام.`
      : `تم حذف ${topics.length} من الموضوعات نهائيًا وتحرير الـSlugs الخاصة بها.`;

  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    return adminActionWarning(
      `${title} مع تنبيه للميديا`,
      `${message} تعذر إثبات تنظيف بعض مراجع الميديا بالكامل ويلزم فحصها.`,
      {
        code: "saved_with_media_sync_warning",
        entityId: singleTopic?.id,
      },
    );
  }
  return adminActionSuccess(title, message, {
    code: "permanently_deleted",
    entityId: singleTopic?.id,
  });
}

export async function restoreUnifiedContent(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  if (!Number.isInteger(id) || id <= 0) return invalidMutation();
  return restoreTopicsWithCanonicalOwner({ actor, ids: [id], scope: "single" });
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
  return permanentlyDeleteTopicsWithCanonicalOwner({
    actor,
    ids: [id],
    scope: "single",
  });
}

export async function emptyUnifiedContentTrash(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  if (getString(formData, "confirm_permanent") !== "true") {
    return adminActionFailure(
      "يلزم تأكيد إفراغ المحذوفات",
      "أكّد الحذف النهائي لكل الموضوعات الموجودة في المحذوفات.",
    );
  }
  const expectedCount = Number(getString(formData, "expected_count"));
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    return invalidMutation("عدد الموضوعات المطلوب حذفها غير صالح.");
  }

  let topics: DeletedTopicMutationRow[];
  try {
    topics = await loadAllDeletedTopics();
  } catch (error) {
    return invalidMutation(error instanceof Error ? error.message : undefined);
  }
  if (topics.length !== expectedCount) {
    return adminActionFailure(
      "تغير عدد المحذوفات",
      `العدد الحالي هو ${topics.length} وليس ${expectedCount}. حدّث الصفحة وراجع العدد قبل المحاولة مرة أخرى.`,
    );
  }

  return permanentlyDeleteTopicsWithCanonicalOwner({
    actor,
    ids: topics.map((topic) => topic.id),
    scope: "empty_trash",
    expectedTotalDeletedCount: expectedCount,
  });
}

export async function bulkUpdateUnifiedContent(
  formData: FormData,
): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const ids = getIds(formData);
  const action = getString(formData, "bulk_action");
  if (!ids.length) return invalidMutation("حدد محتوى واحدًا على الأقل.");

  if (action === "restore") {
    return restoreTopicsWithCanonicalOwner({
      actor,
      ids,
      scope: "selected",
    });
  }
  if (action === "permanent_delete") {
    if (getString(formData, "confirm_permanent") !== "true") {
      return adminActionFailure(
        "يلزم تأكيد الحذف النهائي للمحدد",
        "أكّد الحذف النهائي للموضوعات المحددة قبل تحرير الـSlugs.",
      );
    }
    return permanentlyDeleteTopicsWithCanonicalOwner({
      actor,
      ids,
      scope: "selected",
    });
  }

  const now = new Date().toISOString();
  let payload: Record<string, unknown> | null = null;
  const moveToTrash = action === "delete" || action === "move_to_trash";

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
  } else if (moveToTrash) {
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
  const { data: activeTopics, error: activeTopicsError } =
    await getSupabaseAdmin()
      .from("topics")
      .select("id")
      .in("id", ids)
      .is("deleted_at", null);
  if (activeTopicsError) return invalidMutation(activeTopicsError.message);
  if ((activeTopics ?? []).length !== ids.length) {
    return adminActionFailure(
      "تعذر تنفيذ الإجراء الجماعي",
      "بعض السجلات غير موجودة أو داخل المحذوفات. لم يتم تعديل أي Topic محذوف.",
    );
  }
  const { data: updated, error } = await getSupabaseAdmin()
    .from("topics")
    .update(payload)
    .in("id", ids)
    .is("deleted_at", null)
    .select("id");
  if (error) return invalidMutation(error.message);
  if ((updated ?? []).length !== ids.length) {
    return invalidMutation(
      "تغيرت حالة بعض الموضوعات أثناء التنفيذ. حدّث الصفحة وحاول مرة أخرى.",
    );
  }

  await finishMutation({
    actor,
    action: action === "publish" ? "publish" : action === "unpublish" ? "unpublish" : moveToTrash ? "delete" : "update",
    metadata: {
      bulk_action: action,
      topic_ids: ids,
      count: ids.length,
      ...(moveToTrash
        ? { permanent: false, slug_retained: true }
        : {}),
    },
  });
  return adminActionSuccess(
    moveToTrash ? "تم نقل المحتوى إلى المحذوفات" : "تم تحديث المحتوى",
    moveToTrash
      ? `تم نقل ${ids.length} من عناصر المحتوى إلى المحذوفات مع إبقاء الـSlug محجوزًا.`
      : `تم تحديث ${ids.length} من عناصر المحتوى بنجاح.`,
    { code: moveToTrash ? "deleted" : "saved" },
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
