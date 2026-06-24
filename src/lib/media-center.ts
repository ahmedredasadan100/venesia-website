import { getSupabaseAdmin } from "./supabase-admin";
import { logError } from "./logging";

export type MediaContentType =
  | "news"
  | "video"
  | "gallery"
  | "press"
  | "site-update";

export type MediaContentItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  publishedAt: string;
  image: string;
  type: MediaContentType;
  featured?: boolean;
  isPopular?: boolean;
  project?: string;
  duration?: string;
  content?: string[];
};

export type MediaNewsItem = MediaContentItem;

export type MediaSidebarItem = {
  title: string;
  date: string;
  image: string;
  href: string;
  label?: string;
};

type MediaItemRow = {
  id: number | string;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  category: string | null;
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

export const MEDIA_TYPE_PATHS: Record<MediaContentType, string> = {
  news: "news",
  video: "videos",
  gallery: "gallery",
  press: "press",
  "site-update": "site-updates",
};

const MEDIA_TYPES: MediaContentType[] = [
  "news",
  "video",
  "gallery",
  "press",
  "site-update",
];

function isMediaType(value: string | null): value is MediaContentType {
  return MEDIA_TYPES.includes(value as MediaContentType);
}

function formatDateLabel(value: string | null) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalizeContent(value: MediaItemRow["content"]) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function mapMediaRow(row: MediaItemRow): MediaContentItem | null {
  const type = typeof row.type === "string" ? row.type : null;
  if (!isMediaType(type)) return null;

  const publishedAt = row.published_at ?? "";

  return {
    id: String(row.id),
    slug: row.slug ?? "",
    title: row.title ?? "",
    excerpt: row.excerpt ?? "",
    category: row.category ?? "المركز الإعلامي",
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

function sortByNewest<T extends { publishedAt: string }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getMediaHref(item: Pick<MediaContentItem, "type" | "slug">) {
  const path = MEDIA_TYPE_PATHS[item.type] ?? "news";
  return `/media-center/${path}/${item.slug}`;
}

export async function getMediaItems(type?: MediaContentType) {
  let query = getSupabaseAdmin()
    .from("media_items")
    .select(
      "id, slug, title, excerpt, category, date_label, published_at, image, type, is_featured, is_popular, project, duration, content"
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });

  if (type) query = query.eq("type", type);

  const { data, error } = await query;

  if (error) {
    logError("Media items fetch failed", error, { type });
    return [];
  }

  return ((data ?? []) as MediaItemRow[])
    .map(mapMediaRow)
    .filter(Boolean) as MediaContentItem[];
}

export async function getMediaItemBySlug(type: MediaContentType, slug: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("media_items")
    .select(
      "id, slug, title, excerpt, category, date_label, published_at, image, type, is_featured, is_popular, project, duration, content"
    )
    .eq("type", type)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logError("Media item fetch failed", error, { type, slug });
    return null;
  }

  return data ? mapMediaRow(data as MediaItemRow) : null;
}

export async function getMediaStaticParams(type: MediaContentType) {
  const { data, error } = await getSupabaseAdmin()
    .from("media_items")
    .select("slug")
    .eq("type", type)
    .eq("status", "published")
    .is("deleted_at", null);

  if (error) {
    logError("Media static params fetch failed", error, { type });
    return [];
  }

  return (data ?? [])
    .map((item) => ({ slug: item.slug }))
    .filter((item): item is { slug: string } => Boolean(item.slug));
}

export async function getFeaturedNews() {
  const items = await getMediaItems("news");
  return items.find((item) => item.featured) ?? items[0] ?? null;
}

export async function getRegularNews() {
  const items = await getMediaItems("news");
  const featured = items.find((item) => item.featured);
  return featured ? items.filter((item) => item.slug !== featured.slug) : items;
}

export async function getMediaSidebarData() {
  const allItems = await getMediaItems();
  const newsItems = allItems.filter((item) => item.type === "news");
  const popularItems = allItems.filter((item) => item.isPopular);

  const latestNewsSidebar: MediaSidebarItem[] = sortByNewest(newsItems)
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      date: item.date,
      image: item.image,
      href: getMediaHref(item),
    }));

  const popularMediaSidebarItems: MediaSidebarItem[] = sortByNewest(popularItems)
    .slice(0, 4)
    .map((item) => ({
      title: item.title,
      date: item.date,
      image: item.image,
      href: getMediaHref(item),
      label: item.category,
    }));

  return { latestNewsSidebar, popularMediaSidebarItems };
}
