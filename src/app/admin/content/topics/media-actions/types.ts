import type { MediaTopicPayload } from "../../../../../lib/admin/media-topic-payload";

export const VALID_STATUSES = ["draft", "published", "unpublished", "archived"] as const;

export type MediaStatus = (typeof VALID_STATUSES)[number];

export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  is_active: boolean | null;
};

export type MediaTopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  image_alt: string | null;
  category_id?: number | null;
  category_slug: string | null;
  series_id?: number | null;
  content_type: string | null;
  status: MediaStatus | string | null;
  is_featured: boolean | null;
  published_at: string | null;
  media_payload: MediaTopicPayload | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string[] | null;
  focus_keyword?: string | null;
  canonical_url?: string | null;
  robots_index?: boolean | null;
  robots_follow?: boolean | null;
  og_image?: string | null;
  og_image_alt?: string | null;
  faq?: { question: string; answer: string }[] | null;
};
