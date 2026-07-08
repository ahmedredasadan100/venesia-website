"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  isMediaEditableContentType,
  MEDIA_CONTENT_TYPE_ERROR,
} from "../media-content-config";
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
  await requireAdminSession();
  const payload = getPayload(formData);

  try {
    payload.image = await uploadMediaImage(formData, payload.slug);
  } catch (error) {
    redirectFormError("/admin/content/media/new", error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  const validationError = getValidationError(payload);
  if (validationError) redirectFormError("/admin/content/media/new", validationError);

  const section = await resolveMediaSection(payload.categorySlug);
  if (!section.ok) redirectFormError("/admin/content/media/new", section.message);

  if (!isMediaEditableContentType(section.contentType)) {
    redirectFormError("/admin/content/media/new", MEDIA_CONTENT_TYPE_ERROR);
  }

  const writePayload = resolveWriteMediaPayload(section.contentType, formData, payload);
  if (!writePayload.ok) redirectFormError("/admin/content/media/new", writePayload.message);

  const publishError = getPublishedValidationError(
    section.contentType,
    writePayload.mediaPayload,
    payload.status,
    payload,
  );
  if (publishError) redirectFormError("/admin/content/media/new", publishError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug);
  if (!isUniqueSlug) redirectFormError("/admin/content/media/new", "هذا الـ Slug مستخدم بالفعل في محتوى آخر.");

  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .insert({
      ...buildMediaWritePayload(
        payload,
        section.category,
        section.contentType,
        writePayload.mediaPayload,
        now,
        null,
      ),
      created_at: now,
    })
    .select("id")
    .single<{ id: number }>();

  if (error || !data) {
    redirectFormError("/admin/content/media/new", error?.message || "تعذر إنشاء المحتوى.");
  }

  revalidateMediaContentPaths(data.id);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("media_content", payload.status === "published" ? "publish" : "create"),
    entityType: "media_content",
    entityId: data.id,
    entityLabel: payload.title,
    metadata: { slug: payload.slug, content_type: section.contentType, status: payload.status },
  });
  redirect(`/admin/content/media/${data.id}?notice=created`);
}
