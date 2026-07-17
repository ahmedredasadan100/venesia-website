"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
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
import { CONTENT_LIST_VIEW_KEY } from "../../../../lib/admin/content/load-unified-content";
import { isContentType } from "../../../../lib/admin/content/content-types";
import {
  ADMIN_CONTENT_ROUTES,
  adminContentTopicPath,
  isAdminContentReturnPath,
} from "../../../../lib/admin/content-routes";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

const VALID_STATUSES = new Set(["published", "draft", "unpublished", "archived"]);
const PREFERENCE_COLUMN_KEYS = new Set([
  "category",
  "id",
  "views",
  "created_at",
  "updated_at",
  "created_by",
  "content_type",
  "series",
  "status",
  "featured",
  "published_at",
]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getIds(formData: FormData) {
  return [...new Set(formData.getAll("topic_ids").map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0);
}

function getReturnPath(formData: FormData) {
  const value = getString(formData, "redirect_to");
  return isAdminContentReturnPath(value) ? value : ADMIN_CONTENT_ROUTES.topics;
}

function withNotice(path: string, notice: string, message?: string) {
  const url = new URL(path, "https://admin.local");
  url.searchParams.set("notice", notice);
  if (message) url.searchParams.set("message", message);
  return `${url.pathname}${url.search}#content-topics-table`;
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

export async function setUnifiedContentStatus(formData: FormData) {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  const nextStatus = getString(formData, "next_status");
  const returnPath = getReturnPath(formData);
  if (!Number.isInteger(id) || id <= 0 || !VALID_STATUSES.has(nextStatus)) {
    redirect(withNotice(returnPath, "error"));
  }

  const topic = await loadTopic(id);
  if (!topic) redirect(withNotice(returnPath, "error"));

  if (nextStatus === "published") {
    const publishError = getPublishError(topic);
    if (publishError) redirect(withNotice(returnPath, "error", publishError));
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
  if (nextStatus !== "archived") payload.deleted_at = null;

  const { error } = await getSupabaseAdmin().from("topics").update(payload).eq("id", id);
  if (error) redirect(withNotice(returnPath, "error", error.message));

  await finishMutation({
    actor,
    action: nextStatus === "published" ? "publish" : "unpublish",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: { status: nextStatus, content_type: topic.content_type },
  });
  redirect(withNotice(returnPath, nextStatus === "published" ? "published" : "unpublished"));
}

export async function toggleUnifiedContentFeatured(formData: FormData) {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  const returnPath = getReturnPath(formData);
  if (!Number.isInteger(id) || id <= 0) redirect(withNotice(returnPath, "error"));

  const topic = await loadTopic(id);
  if (!topic) redirect(withNotice(returnPath, "error"));
  const isFeatured = !Boolean(topic.is_featured);
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      is_featured: isFeatured,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    })
    .eq("id", id);
  if (error) redirect(withNotice(returnPath, "error", error.message));

  await finishMutation({
    actor,
    action: "update",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
    metadata: { is_featured: isFeatured },
  });
  redirect(withNotice(returnPath, "saved"));
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

export async function duplicateUnifiedContent(formData: FormData) {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  const returnPath = getReturnPath(formData);
  if (!Number.isInteger(id) || id <= 0) redirect(withNotice(returnPath, "error"));
  const topic = await loadTopic(id);
  if (!topic) redirect(withNotice(returnPath, "error"));

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
  if (error || !data) redirect(withNotice(returnPath, "error", error?.message));

  await finishMutation({
    actor,
    action: "duplicate",
    entityId: data.id,
    entityLabel: `${String(topic.title ?? "بدون عنوان")} - نسخة`,
    metadata: { source_topic_id: id, content_type: topic.content_type },
  });
  redirect(withNotice(returnPath, "created"));
}

export async function softDeleteUnifiedContent(formData: FormData) {
  const actor = await requireAdminSession();
  const id = Number(getString(formData, "id"));
  const returnPath = getReturnPath(formData);
  if (!Number.isInteger(id) || id <= 0) redirect(withNotice(returnPath, "error"));
  const topic = await loadTopic(id);
  if (!topic) redirect(withNotice(returnPath, "error"));

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({ status: "archived", deleted_at: now, updated_at: now, updated_by: actor.id })
    .eq("id", id);
  if (error) redirect(withNotice(returnPath, "error", error.message));

  await finishMutation({
    actor,
    action: "delete",
    entityId: id,
    entityLabel: String(topic.title ?? ""),
  });
  redirect(withNotice(returnPath, "deleted"));
}

export async function bulkUpdateUnifiedContent(formData: FormData) {
  const actor = await requireAdminSession();
  const ids = getIds(formData);
  const action = getString(formData, "bulk_action");
  const returnPath = getReturnPath(formData);
  if (!ids.length) redirect(withNotice(returnPath, "error"));

  const now = new Date().toISOString();
  let payload: Record<string, unknown> | null = null;

  if (action === "publish") {
    const { data } = await getSupabaseAdmin().from("topics").select("*").in("id", ids).is("deleted_at", null);
    const invalid = (data ?? []).map((topic) => ({ topic, error: getPublishError(topic) })).find((entry) => entry.error);
    if (invalid?.error) redirect(withNotice(returnPath, "error", invalid.error));
    payload = { status: "published", published_by: actor.id, updated_by: actor.id, updated_at: now };
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
    if (!category) redirect(withNotice(returnPath, "error", "التصنيف المختار غير متاح."));
    payload = {
      category_id: category.id,
      category: category.name,
      category_slug: category.slug,
      updated_by: actor.id,
      updated_at: now,
    };
  }

  if (!payload) redirect(withNotice(returnPath, "error"));
  const { error } = await getSupabaseAdmin().from("topics").update(payload).in("id", ids);
  if (error) redirect(withNotice(returnPath, "error", error.message));

  await finishMutation({
    actor,
    action: action === "publish" ? "publish" : action === "unpublish" ? "unpublish" : action === "delete" ? "delete" : "update",
    metadata: { bulk_action: action, topic_ids: ids, count: ids.length },
  });
  redirect(withNotice(returnPath, "saved"));
}

export async function saveContentTablePreferences(visibleColumns: string[]) {
  const actor = await requireAdminSession();
  const safeColumns = [...new Set(visibleColumns)].filter((key) =>
    PREFERENCE_COLUMN_KEYS.has(key),
  );
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("admin_user_preferences").upsert(
    {
      admin_user_id: actor.id,
      view_key: CONTENT_LIST_VIEW_KEY,
      preferences: { visibleColumns: safeColumns },
      updated_at: now,
    },
    { onConflict: "admin_user_id,view_key" },
  );
  return error ? { ok: false as const, message: error.message } : { ok: true as const };
}
