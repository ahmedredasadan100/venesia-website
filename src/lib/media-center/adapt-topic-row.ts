import type { GalleryMediaPayload, MediaTopicPayload, VideoMediaPayload } from "../admin/media-topic-payload";
import { resolveLocalPublicImage } from "../media/resolve-local-public-image";
import { toPublicMediaType } from "./content-type-map";
import { formatDateLabel } from "./format-date-label";
import type { MediaContentItem } from "./types";

const DEFAULT_IMAGE = "/images/venesia-5.png";

export type UnifiedMediaTopicRow = {
  id: number | string;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  content?: string | null;
  image: string | null;
  category: string | null;
  category_slug: string | null;
  date_label: string | null;
  published_at: string | null;
  content_type: string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  media_payload: MediaTopicPayload | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string[] | null;
  focus_keyword?: string | null;
  image_alt: string | null;
};

function splitMarkdownParagraphs(content: string | null | undefined) {
  if (!content?.trim()) return [];

  return content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function parseMediaPayload(value: UnifiedMediaTopicRow["media_payload"]): MediaTopicPayload | null {
  if (!value || typeof value !== "object") return null;
  return value;
}

function resolveVideoPayload(payload: MediaTopicPayload | null): VideoMediaPayload | null {
  if (!payload || payload.kind !== "video") return null;
  return payload;
}

function resolveGalleryPayload(payload: MediaTopicPayload | null): GalleryMediaPayload | null {
  if (!payload || payload.kind !== "gallery") return null;
  return payload;
}

function resolveTopicImage(image: string | null | undefined, fallback?: string | null) {
  const primary = image?.trim() || fallback?.trim() || DEFAULT_IMAGE;
  return resolveLocalPublicImage(primary, DEFAULT_IMAGE);
}

function resolveTopicContent(row: UnifiedMediaTopicRow, publicType: MediaContentItem["type"]) {
  if (publicType === "video") {
    return splitMarkdownParagraphs(row.content);
  }

  if (publicType === "gallery") {
    const gallery = resolveGalleryPayload(parseMediaPayload(row.media_payload));
    const captions = (gallery?.images ?? [])
      .map((image) => image.caption?.trim())
      .filter(Boolean) as string[];
    if (captions.length > 0) return captions;
    return splitMarkdownParagraphs(row.content);
  }

  return splitMarkdownParagraphs(row.content);
}

export function adaptTopicRowToMediaItem(row: UnifiedMediaTopicRow): MediaContentItem | null {
  const publicType = toPublicMediaType(row.content_type);
  if (!publicType) return null;

  const publishedAt = row.published_at ?? "";
  const videoPayload = publicType === "video" ? resolveVideoPayload(parseMediaPayload(row.media_payload)) : null;
  const galleryPayload = publicType === "gallery" ? resolveGalleryPayload(parseMediaPayload(row.media_payload)) : null;
  const galleryCover = galleryPayload?.images?.[0]?.url ?? null;

  return {
    id: String(row.id),
    topicId: Number.isInteger(Number(row.id)) ? Number(row.id) : undefined,
    slug: row.slug ?? "",
    title: row.title ?? "",
    excerpt: row.excerpt ?? "",
    category: row.category ?? "",
    categorySlug: row.category_slug ?? undefined,
    date: row.date_label || formatDateLabel(publishedAt),
    publishedAt,
    image: resolveTopicImage(row.image, galleryCover),
    type: publicType,
    featured: Boolean(row.is_featured),
    isPopular: Boolean(row.is_popular),
    duration: videoPayload?.duration?.trim() || undefined,
    content: resolveTopicContent(row, publicType),
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    seoKeywords: Array.isArray(row.seo_keywords) ? row.seo_keywords : undefined,
    imageAlt: row.image_alt ?? undefined,
    ogImage: row.image ?? undefined,
  };
}
