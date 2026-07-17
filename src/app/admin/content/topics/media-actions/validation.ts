"use server";

import { logError } from "../../../../../lib/logging";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  isMediaEditableContentType,
  MEDIA_EDITABLE_CONTENT_TYPES,
} from "../../../../../components/admin/content/editors/media/media-content-config";
import type {
  CategoryRow,
  MediaTopicRow,
} from "./types";

export async function resolveMediaSection(
  categoryId: string,
  requestedContentType?: string | null,
  currentCategoryId?: number | null,
) {
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
    .eq("id", normalizedId);
  if (normalizedId !== currentCategoryId) query = query.eq("is_active", true);
  const { data, error } = await query.maybeSingle<CategoryRow>();

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
  let query = getSupabaseAdmin().from("topics").select("id").eq("slug", slug).limit(1);

  if (id) {
    query = query.neq("id", id);
  }

  const { data, error } = await query.maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

export async function getEditableMediaTopicById(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category_id, category_slug, series_id, content_type, status, is_featured, published_at, media_payload, seo_title, seo_description, seo_keywords, focus_keyword, faq",
    )
    .eq("id", id)
    .in("content_type", [...MEDIA_EDITABLE_CONTENT_TYPES])
    .is("deleted_at", null)
    .maybeSingle<MediaTopicRow>();

  if (error) {
    logError("getEditableMediaTopicById failed", error, { id });
    return null;
  }

  if (!data || !isMediaEditableContentType(data.content_type)) return null;
  return data;
}
