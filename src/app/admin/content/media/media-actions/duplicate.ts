"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { isMediaEditableContentType } from "../media-content-config";
import {
  appendMediaListNotice,
  createSlug,
  getMediaRedirectTo,
  getNormalizedStatus,
  getString,
  validateId,
  validateSlug,
} from "./helpers";
import {
  ensureUniqueSlug,
  getMediaTopicForDuplicate,
  resolveDuplicateMediaCategory,
} from "./validation";
import { revalidateMediaContentPaths } from "./revalidate";

export async function duplicateMediaContent(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const redirectTo = getMediaRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const original = await getMediaTopicForDuplicate(id);
  if (!original || !isMediaEditableContentType(original.content_type)) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  const title = getString(formData, "title");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);
  const status = getNormalizedStatus(getString(formData, "status"), "unpublished");
  const categoryChoice = getString(formData, "category_slug");

  if (!title) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  if (!slug || !validateSlug(slug)) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const isUniqueSlug = await ensureUniqueSlug(slug);
  if (!isUniqueSlug) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const resolvedCategory = await resolveDuplicateMediaCategory(original, categoryChoice);
  if (!resolvedCategory.ok) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const { category, contentType } = resolvedCategory;
  const isRichMedia = contentType === "video" || contentType === "gallery";
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .insert({
      title,
      slug,
      excerpt: original.excerpt ?? "",
      content: isRichMedia ? "" : (original.content ?? ""),
      image: original.image ?? "",
      image_alt: original.image_alt ?? null,
      media_payload: original.media_payload,
      category: category.name,
      category_slug: category.slug,
      category_id: category.id,
      content_type: contentType,
      series_id: null,
      series: null,
      series_slug: null,
      date_label: null,
      status,
      seo_title: null,
      seo_description: null,
      seo_keywords: [],
      focus_keyword: null,
      faq: [],
      is_featured: original.is_featured ?? false,
      is_popular: false,
      published_at: status === "published" ? now : null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single<{ id: number }>();

  if (error || !data) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  revalidateMediaContentPaths(data.id);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("media_content", "duplicate"),
    entityType: "media_content",
    entityId: data.id,
    entityLabel: title,
    metadata: { slug, content_type: contentType, source_id: Number(id) },
  });
  redirect(appendMediaListNotice(redirectTo, "created", "media-table"));
}
