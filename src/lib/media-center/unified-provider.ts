import "server-only";

import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
import { adaptTopicRowToMediaItem, type UnifiedMediaTopicRow } from "./adapt-topic-row";
import {
  getUnifiedCategorySlugForType,
  toTopicsContentType,
  UNIFIED_MEDIA_CATEGORY_SLUGS,
} from "./content-type-map";
import type { MediaContentItem, MediaContentType } from "./types";

const UNIFIED_SELECT =
  "id, slug, title, excerpt, content, image, category, category_slug, date_label, published_at, content_type, is_featured, is_popular, media_payload";

const UNIFIED_MEDIA_CONTENT_TYPES = ["news", "press", "site_update", "video", "gallery"] as const;

function buildUnifiedMediaQuery(type?: MediaContentType) {
  let query = getSupabaseAdmin()
    .from("topics")
    .select(UNIFIED_SELECT)
    .in("content_type", [...UNIFIED_MEDIA_CONTENT_TYPES])
    .in("category_slug", [...UNIFIED_MEDIA_CATEGORY_SLUGS])
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });

  if (type) {
    query = query
      .eq("content_type", toTopicsContentType(type))
      .eq("category_slug", getUnifiedCategorySlugForType(type));
  }

  return query;
}

export async function unifiedGetMediaItems(type?: MediaContentType) {
  const { data, error } = await buildUnifiedMediaQuery(type);

  if (error) {
    logError("Unified media topics fetch failed", error, { type });
    return [];
  }

  return ((data ?? []) as UnifiedMediaTopicRow[])
    .map(adaptTopicRowToMediaItem)
    .filter(Boolean) as MediaContentItem[];
}

export async function unifiedGetMediaItemBySlug(type: MediaContentType, slug: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(UNIFIED_SELECT)
    .eq("content_type", toTopicsContentType(type))
    .eq("category_slug", getUnifiedCategorySlugForType(type))
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logError("Unified media topic fetch failed", error, { type, slug });
    return null;
  }

  return data ? adaptTopicRowToMediaItem(data as UnifiedMediaTopicRow) : null;
}

export async function unifiedGetMediaStaticParams(type: MediaContentType) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("slug")
    .eq("content_type", toTopicsContentType(type))
    .eq("category_slug", getUnifiedCategorySlugForType(type))
    .eq("status", "published")
    .is("deleted_at", null);

  if (error) {
    logError("Unified media static params fetch failed", error, { type });
    return [];
  }

  return (data ?? [])
    .map((item) => ({ slug: item.slug }))
    .filter((item): item is { slug: string } => Boolean(item.slug));
}
