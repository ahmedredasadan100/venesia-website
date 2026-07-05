import "server-only";

import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
import { formatDateLabel } from "./format-date-label";
import type { MediaContentItem, MediaContentType } from "./types";
import { isMediaContentType } from "./types";

type LegacyMediaItemRow = {
  id: number | string;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  category: string | null;
  category_slug: string | null;
  date_label: string | null;
  published_at: string | null;
  image: string | null;
  type: MediaContentType | string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  project: string | null;
  duration: string | null;
  content: string[] | string | null;
};

const LEGACY_SELECT =
  "id, slug, title, excerpt, category, category_slug, date_label, published_at, image, type, is_featured, is_popular, project, duration, content";

function normalizeContent(value: LegacyMediaItemRow["content"]) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function mapLegacyMediaRow(row: LegacyMediaItemRow): MediaContentItem | null {
  const type = typeof row.type === "string" ? row.type : null;
  if (!isMediaContentType(type)) return null;

  const publishedAt = row.published_at ?? "";

  return {
    id: String(row.id),
    slug: row.slug ?? "",
    title: row.title ?? "",
    excerpt: row.excerpt ?? "",
    category: row.category ?? "المركز الإعلامي",
    categorySlug: row.category_slug ?? undefined,
    date: row.date_label || formatDateLabel(publishedAt),
    publishedAt,
    image: row.image || "/images/venesia-5.png",
    type,
    featured: Boolean(row.is_featured),
    isPopular: Boolean(row.is_popular),
    project: row.project || undefined,
    duration: row.duration || undefined,
    content: normalizeContent(row.content),
  };
}

export async function legacyGetMediaItems(type?: MediaContentType) {
  let query = getSupabaseAdmin()
    .from("media_items")
    .select(LEGACY_SELECT)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });

  if (type) query = query.eq("type", type);

  const { data, error } = await query;

  if (error) {
    logError("Legacy media items fetch failed", error, { type });
    return [];
  }

  return ((data ?? []) as LegacyMediaItemRow[])
    .map(mapLegacyMediaRow)
    .filter(Boolean) as MediaContentItem[];
}

export async function legacyGetMediaItemBySlug(type: MediaContentType, slug: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("media_items")
    .select(LEGACY_SELECT)
    .eq("type", type)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logError("Legacy media item fetch failed", error, { type, slug });
    return null;
  }

  return data ? mapLegacyMediaRow(data as LegacyMediaItemRow) : null;
}

export async function legacyGetMediaStaticParams(type: MediaContentType) {
  const { data, error } = await getSupabaseAdmin()
    .from("media_items")
    .select("slug")
    .eq("type", type)
    .eq("status", "published")
    .is("deleted_at", null);

  if (error) {
    logError("Legacy media static params fetch failed", error, { type });
    return [];
  }

  return (data ?? [])
    .map((item) => ({ slug: item.slug }))
    .filter((item): item is { slug: string } => Boolean(item.slug));
}
