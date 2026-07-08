"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { logError } from "../../../../../lib/logging";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  ALLOWED_MEDIA_SECTION_SLUGS,
  getContentTypeForSectionSlug,
  isMediaEditableContentType,
  MEDIA_EDITABLE_CONTENT_TYPES,
  MEDIA_LIST_CONTENT_TYPES,
  MEDIA_SECTION_ERROR,
  type MediaEditableContentType,
} from "../media-content-config";
import { validateMediaTopicRow } from "./helpers";
import type {
  BulkMediaPublishValidationFailure,
  BulkMediaPublishValidationResult,
  CategoryRow,
  MediaTopicRow,
} from "./types";

export async function validateBulkMediaPublish(ids: number[]): Promise<BulkMediaPublishValidationResult> {
  await requireAdminSession();

  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) {
    return { validIds: [], failures: [] };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category_slug, content_type, media_payload",
    )
    .in("id", uniqueIds)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MediaTopicRow[];
  const foundIds = new Set(rows.map((row) => row.id));
  const failures: BulkMediaPublishValidationFailure[] = [];
  const validIds: number[] = [];

  for (const id of uniqueIds) {
    if (!foundIds.has(id)) {
      failures.push({ id, title: `#${id}`, reason: "المحتوى غير موجود أو غير متاح." });
    }
  }

  for (const row of rows) {
    const validationError = validateMediaTopicRow(row);
    if (validationError) {
      failures.push({
        id: row.id,
        title: row.title?.trim() || `محتوى #${row.id}`,
        reason: validationError,
      });
    } else {
      validIds.push(row.id);
    }
  }

  return { validIds, failures };
}

export async function resolveMediaSection(categorySlug: string) {
  const trimmedSlug = categorySlug.trim();

  if (!ALLOWED_MEDIA_SECTION_SLUGS.includes(trimmedSlug as (typeof ALLOWED_MEDIA_SECTION_SLUGS)[number])) {
    return { ok: false as const, message: MEDIA_SECTION_ERROR };
  }

  const contentType = getContentTypeForSectionSlug(trimmedSlug);
  if (!contentType) {
    return { ok: false as const, message: MEDIA_SECTION_ERROR };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, is_active")
    .eq("slug", trimmedSlug)
    .eq("is_active", true)
    .maybeSingle<CategoryRow>();

  if (error) {
    logError("resolveMediaSection failed", error, { categorySlug: trimmedSlug });
    return { ok: false as const, message: "تعذر التحقق من القسم المختار." };
  }

  if (!data) {
    return { ok: false as const, message: "القسم المختار غير موجود أو غير مفعل." };
  }

  if (data.slug === "media-center" || data.parent_id === null) {
    return { ok: false as const, message: MEDIA_SECTION_ERROR };
  }

  const { data: parent } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("slug")
    .eq("id", data.parent_id)
    .maybeSingle<{ slug: string }>();

  if (parent?.slug !== "media-center") {
    return { ok: false as const, message: MEDIA_SECTION_ERROR };
  }

  return {
    ok: true as const,
    category: { id: data.id, name: data.name, slug: data.slug },
    contentType,
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
      "id, title, slug, excerpt, content, image, image_alt, category_slug, content_type, status, is_featured, published_at, media_payload",
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

export async function getMediaTopicForDuplicate(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "title, slug, excerpt, content, image, image_alt, category, category_slug, category_id, content_type, media_payload, is_featured, published_at",
    )
    .eq("id", id)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null)
    .maybeSingle<MediaTopicRow>();

  if (error) {
    logError("getMediaTopicForDuplicate failed", error, { id });
    return null;
  }

  if (!data || !isMediaEditableContentType(data.content_type)) return null;
  return data;
}

export async function resolveDuplicateMediaCategory(
  original: MediaTopicRow,
  categoryChoice: string,
): Promise<
  | { ok: true; category: { id: number; name: string; slug: string }; contentType: MediaEditableContentType }
  | { ok: false }
> {
  if (categoryChoice === "__same" || !categoryChoice) {
    if (!original.category_slug || !isMediaEditableContentType(original.content_type)) {
      return { ok: false };
    }

    const section = await resolveMediaSection(original.category_slug);
    if (!section.ok || section.contentType !== original.content_type) {
      return { ok: false };
    }

    return { ok: true, category: section.category, contentType: section.contentType };
  }

  const section = await resolveMediaSection(categoryChoice);
  if (!section.ok || section.contentType !== original.content_type) {
    return { ok: false };
  }

  return { ok: true, category: section.category, contentType: section.contentType };
}
