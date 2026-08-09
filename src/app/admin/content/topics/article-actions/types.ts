export const VALID_STATUSES = ["published", "unpublished"] as const;

export type TopicStatus = (typeof VALID_STATUSES)[number];

export type TopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  image_alt: string | null;
  media_payload?: unknown;
  show_title_on_page?: boolean | null;
  show_image_on_page?: boolean | null;
  show_excerpt_on_page?: boolean | null;
  show_date_on_page?: boolean | null;
  show_category_on_page?: boolean | null;
  show_series_on_page?: boolean | null;
  show_intro_card_on_page?: boolean | null;
  show_faq_on_page?: boolean | null;
  show_faq_title_on_page?: boolean | null;
  category_id?: number | null;
  category_slug: string | null;
  series_id?: number | null;
  status: TopicStatus | string | null;
  published_at: string | null;
  published_by?: number | null;
  date_label?: string | null;
  deleted_at?: string | null;
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  seo_keywords: string[] | null;
  canonical_url: string | null;
  robots_index: boolean | null;
  robots_follow: boolean | null;
  og_image: string | null;
  og_image_alt: string;
  faq: { question: string; answer: string }[] | null;
};

export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id?: number | null;
  is_active?: boolean | null;
};

export type SeriesRow = {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
};
