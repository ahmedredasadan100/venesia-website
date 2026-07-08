"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  buildTopicWritePayload,
  getNormalizedStatus,
  getPayload,
  getPublishOnlyValidationError,
  getString,
  getValidationError,
  preserveImage,
  preservePayloadFromCurrent,
  preserveText,
  redirectEditError,
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
import { revalidateTopicPaths } from "./revalidate";
import type { TopicStatus } from "./types";

export async function updateTopicWithStatus(
  formData: FormData,
  nextStatus: TopicStatus,
  notice: string,
  options: { redirectToList?: boolean; validationMode?: "save" | "publish" | "draft" } = {},
) {
  const { redirectToList = false, validationMode = "save" } = options;
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/topics?notice=error");

  const currentTopic = await getTopicById(id);
  if (!currentTopic) redirect("/admin/topics?notice=error");

  const payload = getPayload(formData);

  try {
    payload.image = await uploadTopicImage(formData, payload.slug);
  } catch (error) {
    redirectEditError(id, error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  payload.image = preserveImage(payload.image, String(currentTopic.image ?? ""));

  const currentStatus = getNormalizedStatus(String(currentTopic.status ?? "draft"), "draft");

  if (validationMode === "publish") {
    const saveError = getValidationError(payload, "save");
    if (saveError) redirectEditError(id, saveError);

    const publishError = getPublishOnlyValidationError(payload);

    const isUniqueSlug = await ensureUniqueSlug(payload.slug, id);
    if (!isUniqueSlug) redirectEditError(id, "هذا الـ Slug مستخدم بالفعل في موضوع آخر.");

    const category = await getCategory(payload.categorySlug);
    if (!category) {
      const categoryError = await getCategoryValidationError(payload.categorySlug);
      redirectEditError(id, categoryError ?? "التصنيف المختار غير موجود أو غير مفعل.");
    }

    const series = await getSeries(payload.seriesId);
    if (payload.seriesId && !series) redirectEditError(id, "السلسلة المختارة غير موجودة.");

    const writePayload = publishError
      ? preservePayloadFromCurrent({ ...payload, faq: [...payload.faq], seoKeywords: [...payload.seoKeywords] }, currentTopic)
      : payload;

    const now = new Date().toISOString();
    const statusToWrite = publishError ? currentStatus : nextStatus;
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update(buildTopicWritePayload(writePayload, category, series, statusToWrite, now, currentTopic))
      .eq("id", id);

    if (error) redirectEditError(id, error.message);

    revalidateTopicPaths({ id, oldSlug: currentTopic.slug, newSlug: payload.slug });

    if (publishError) redirectEditError(id, publishError);

    await recordCmsAdminAudit({
      action: buildCmsAuditAction(
        "topic",
        statusToWrite === "published" ? "publish" : statusToWrite === "unpublished" ? "unpublish" : "update",
      ),
      entityType: "topic",
      entityId: Number(id),
      entityLabel: payload.title,
      metadata: { slug: payload.slug, status: statusToWrite },
    });

    redirect(redirectToList ? `/admin/topics?notice=${notice}` : `/admin/topics/${id}?notice=${notice}`);
  }

  payload.imageAlt = preserveText(payload.imageAlt, String(currentTopic.image_alt ?? ""));

  const validationError = getValidationError(payload, validationMode);

  if (validationError) redirectEditError(id, validationError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id);
  if (!isUniqueSlug) redirectEditError(id, "هذا الـ Slug مستخدم بالفعل في موضوع آخر.");

  const category = await getCategory(payload.categorySlug);
  if (!category) {
    const categoryError = await getCategoryValidationError(payload.categorySlug);
    redirectEditError(id, categoryError ?? "التصنيف المختار غير موجود أو غير مفعل.");
  }

  const series = await getSeries(payload.seriesId);
  if (payload.seriesId && !series) redirectEditError(id, "السلسلة المختارة غير موجودة.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update(buildTopicWritePayload(payload, category, series, nextStatus, now, currentTopic))
    .eq("id", id);

  if (error) redirectEditError(id, error.message);

  revalidateTopicPaths({ id, oldSlug: currentTopic.slug, newSlug: payload.slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "topic",
      nextStatus === "published" ? "publish" : nextStatus === "unpublished" ? "unpublish" : "update",
    ),
    entityType: "topic",
    entityId: Number(id),
    entityLabel: payload.title,
    metadata: { slug: payload.slug, status: nextStatus },
  });
  redirect(redirectToList ? `/admin/topics?notice=${notice}` : `/admin/topics/${id}?notice=${notice}`);
}

export async function saveTopic(formData: FormData) {
  await requireAdminSession();
  const status = getNormalizedStatus(getString(formData, "status"), "draft");
  await updateTopicWithStatus(formData, status, "saved", { validationMode: "save" });
}

export async function saveTopicAndClose(formData: FormData) {
  await requireAdminSession();
  const status = getNormalizedStatus(getString(formData, "status"), "draft");
  await updateTopicWithStatus(formData, status, "saved", { redirectToList: true, validationMode: "save" });
}

export async function saveDraftTopic(formData: FormData) {
  await requireAdminSession();
  await updateTopicWithStatus(formData, "draft", "draft", { validationMode: "draft" });
}
