"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  adminActionFailure,
  adminActionSuccess,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import {
  getMediaPublishValidationError,
  mediaRowToPublishInput,
} from "../../../../lib/admin/content-workflow/media-publish-validation";
import {
  getTopicPublishValidationError,
  topicRowToPublishInput,
} from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { isContentType } from "../../../../lib/admin/content/content-types";
import {
  ADMIN_CONTENT_ROUTES,
  adminContentTopicPath,
} from "../../../../lib/admin/content-routes";
import { getContentPublicVisibilityState } from "../../../../lib/content-public-visibility";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import {
  TOPICS_LIST_VIEW_KEY,
  TOPICS_PREFERENCE_COLUMN_KEYS,
} from "../../../../lib/admin/content/topics-list-config";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

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

function getPublishError(topic: Record<string, unknown>) {
  const contentType = topic.content_type;
  if (!isContentType(contentType)) return "نوع المحتوى غير مدعوم.";
  if (contentType === "article") {
    return getTopicPublishValidationError(topicRowToPublishInput(topic));
  }
  const input = mediaRowToPublishInput(topic);
  return input ? getMediaPublishValidationError(input) : "بيانات المحتوى غير صالحة للنشر.";
}

function getPublishFocusTarget(
  topic: Record<string, unknown>,
  message: string,
) {
  if (!message.includes("Alt Text")) return undefined;
  return topic.content_type === "article"
    ? "topic-image-alt"
    : "media-image-alt";
}

function invalidMutation(message = "تعذر تنفيذ العملية."): AdminActionResult {
  return adminActionFailure("تعذر تنفيذ العملية", message);
}

async function finishMutation(input: {
  actor: Awaited<ReturnType<typeof requireAdminSession>>;
  action: "publish" | "unpublish" | "update" | "delete" | "duplicate";
  entityId?: number;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  revalidateTopicsCache();
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
    const publishError = getPublishError(topic);
    if (publishError) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        publishError,
        {
          code: "publish_validation",
          entityId: id,
          focusTarget: getPublishFocusTarget(topic, publishError),
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
  return nextStatus === "published"
    ? adminActionSuccess(
        "تم نشر المحتوى",
        "أصبح المحتوى ظاهرًا للعامة.",
        { code: "published", entityId: id },
      )
    : adminActionSuccess(
        "تم إخفاء المحتوى",
        "لم يعد المحتوى ظاهرًا للعامة.",
        { code: "unpublished", entityId: id },
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

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .insert({
      ...copyable,
      title: `${String(topic.title ?? "بدون عنوان")} - نسخة`,
      slug,
      status: "draft",
      published_at: null,
      published_by: null,
      views_count: 0,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select("id")
    .single<{ id: number }>();
  if (error || !data) return invalidMutation(error?.message);

  await finishMutation({
    actor,
    action: "duplicate",
    entityId: data.id,
    entityLabel: `${String(topic.title ?? "بدون عنوان")} - نسخة`,
    metadata: { source_topic_id: id, content_type: topic.content_type },
  });
  return adminActionSuccess(
    "تم نسخ المحتوى",
    "أُنشئت نسخة جديدة كمسودة.",
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
    .update({ status: "archived", deleted_at: now, updated_at: now, updated_by: actor.id })
    .eq("id", id);
  if (error) return invalidMutation(error.message);

  await finishMutation({
    actor,
    action: "delete",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
  });
  return adminActionSuccess(
    "تم حذف المحتوى",
    "تم الحذف الآمن وإزالة المحتوى من القائمة.",
    { code: "deleted", entityId: id },
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
      .map((topic) => ({ topic, error: getPublishError(topic) }))
      .find((entry) => entry.error);
    if (invalid?.error) {
      return adminActionFailure(
        "تعذر نشر المحتوى",
        invalid.error,
        {
          code: "publish_validation",
          entityId: Number(invalid.topic.id),
          focusTarget: getPublishFocusTarget(invalid.topic, invalid.error),
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
  } else if (action === "archive") {
    payload = { status: "archived", updated_by: actor.id, updated_at: now };
  } else if (action === "delete") {
    payload = { status: "archived", deleted_at: now, updated_by: actor.id, updated_at: now };
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
    metadata: { bulk_action: action, topic_ids: ids, count: ids.length },
  });
  return adminActionSuccess(
    action === "delete" ? "تم حذف المحتوى" : "تم تحديث المحتوى",
    action === "delete"
      ? `تم الحذف الآمن لـ ${ids.length} من عناصر المحتوى.`
      : `تم تحديث ${ids.length} من عناصر المحتوى بنجاح.`,
    { code: action === "delete" ? "deleted" : "saved" },
  );
}

export async function saveContentTablePreferences(visibleColumns: string[]) {
  return saveAdminColumnPreferences({
    viewKey: TOPICS_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: TOPICS_PREFERENCE_COLUMN_KEYS,
  });
}
