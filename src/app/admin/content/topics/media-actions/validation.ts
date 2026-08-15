"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { logError } from "../../../../../lib/logging";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  isMediaEditableContentType,
  MEDIA_EDITABLE_CONTENT_TYPES,
} from "../../../../../lib/admin/content/content-types";
import type { MediaTopicRow } from "./types";

function validateId(id: string) {
  const parsed = Number(id);
  return /^\d+$/.test(id) && Number.isSafeInteger(parsed) && parsed > 0;
}

export async function resolveMediaSection(
  categoryId: string,
  requestedContentType?: string | null,
  currentCategoryId?: number | null,
) {
  await requireAdminSession();

  const normalizedId = Number(categoryId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    return { ok: false as const, message: "التصنيف المختار غير صالح." };
  }
  if (!isMediaEditableContentType(requestedContentType)) {
    return { ok: false as const, message: "نوع المحتوى غير صالح." };
  }

  let query = getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, is_active")
    .eq("id", normalizedId)
    .is("deleted_at", null);
  if (normalizedId !== currentCategoryId) query = query.eq("is_active", true);
  const { data, error } = await query.maybeSingle();

  if (error) {
    logError("resolveMediaSection failed", error, { categoryId: normalizedId });
    return { ok: false as const, message: "تعذر التحقق من التصنيف المختار." };
  }

  if (!data) {
    return { ok: false as const, message: "التصنيف المختار غير موجود أو غير مفعل." };
  }

  return {
    ok: true as const,
    category: { id: data.id, name: data.name, slug: data.slug },
    contentType: requestedContentType,
  };
}

export async function ensureUniqueSlug(slug: string, id?: string) {
  await requireAdminSession();
  if (id && !validateId(id)) return false;

  let query = getSupabaseAdmin().from("topics").select("id").eq("slug", slug).limit(1);

  if (id) {
    query = query.neq("id", Number(id));
  }

  const { data, error } = await query.maybeSingle();
  if (error) return false;
  return !data;
}

export async function getEditableMediaTopicById(
  id: string,
): Promise<MediaTopicRow | null> {
  await requireAdminSession();
  if (!validateId(id)) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category_id, category_slug, series_id, content_type, status, is_featured, is_popular, published_at, date_label, updated_at, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_date_on_page, show_category_on_page, show_series_on_page, show_intro_card_on_page, deleted_at, media_payload, media_project, seo_title, seo_description, seo_keywords, focus_keyword, canonical_url, robots_index, robots_follow, og_image, og_image_alt, faq",
    )
    .eq("id", Number(id))
    .in("content_type", [...MEDIA_EDITABLE_CONTENT_TYPES])
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logError("getEditableMediaTopicById failed", error, { id });
    return null;
  }

  if (!data || !isMediaEditableContentType(data.content_type)) return null;
  return data;
}
