"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  buildTopicWritePayload,
  getDraftValidationError,
  getPayload,
  getPublishValidationError,
  getString,
  redirectFormError,
  uploadTopicImage,
} from "./helpers";
import { ensureUniqueSlug, getCategory, getCategoryValidationError, getSeries } from "./validation";
import { revalidateTopicPaths } from "./revalidate";
import type { TopicStatus } from "./types";

export async function createTopic(formData: FormData) {
  const actor = await requireAdminSession();
  const intent = getString(formData, "intent");
  const status: TopicStatus = intent === "publish" ? "published" : "draft";
  const redirectToList = intent === "draft-close";
  const payload = getPayload(formData);

  try {
    payload.image = await uploadTopicImage(formData, payload.slug);
  } catch (error) {
    redirectFormError("/admin/content/topics/new?type=article", error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  const validationError =
    status === "published" ? getPublishValidationError(payload) : getDraftValidationError(payload);

  if (validationError) redirectFormError("/admin/content/topics/new?type=article", validationError);

  const category = await getCategory(payload.categorySlug);
  if (!category) {
    const categoryError = await getCategoryValidationError(payload.categorySlug);
    redirectFormError("/admin/content/topics/new?type=article", categoryError ?? "التصنيف المختار غير موجود أو غير مفعل.");
  }

  const series = await getSeries(payload.seriesId);
  if (payload.seriesId && !series) redirectFormError("/admin/content/topics/new?type=article", "السلسلة المختارة غير موجودة.");

  const isUniqueSlug = await ensureUniqueSlug(payload.slug);
  if (!isUniqueSlug) redirectFormError("/admin/content/topics/new?type=article", "هذا الـ Slug مستخدم بالفعل في موضوع آخر.");

  const now = new Date().toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .insert({
      ...buildTopicWritePayload(payload, category, series, status, now, null),
      created_at: now,
      created_by: actor.id,
      updated_by: actor.id,
      published_by: status === "published" ? actor.id : null,
    })
    .select("id, slug")
    .single<{ id: number; slug: string }>();

  if (error || !data) {
    redirectFormError("/admin/content/topics/new?type=article", error?.message || "تعذر إنشاء الموضوع. راجع قاعدة البيانات.");
  }

  revalidateTopicPaths({ id: data.id, newSlug: data.slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", status === "published" ? "publish" : "create"),
    entityType: "topic",
    entityId: data.id,
    entityLabel: payload.title,
    metadata: { slug: data.slug, status },
  });
  redirect(
    redirectToList
      ? "/admin/content/topics?notice=created"
      : `/admin/content/topics/${data.id}?notice=${status === "published" ? "published" : "created"}`,
  );
}
