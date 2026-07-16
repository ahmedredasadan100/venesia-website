import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { filterPublicTopics, isTestTopicSlug } from "../admin/cms-test-data";
import { formatArabicContentDate } from "../content-dates";
import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
import { estimateReadingTimeLabel } from "./reading-time";
import type { Topic } from "./types";

type DbTopic = {
  id: number;
  slug: string;
  title: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  category: string | null;
  category_slug: string | null;
  series: string | null;
  series_slug: string | null;
  date_label: string | null;
  published_at: string | null;
  is_featured: boolean;
  is_popular: boolean;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  faq: { question: string; answer: string }[] | null;
};

export type PublicTopicDetail = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  categorySlug: string;
  series: string;
  seriesSlug: string;
  date: string;
  publishedAt: string;
  readingTime: string;
  isFeatured: boolean;
  isPopular: boolean;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  faq: { question: string; answer: string }[];
};

function mapDbTopicToListingTopic(topic: DbTopic): Topic {
  return {
    id: topic.id,
    slug: topic.slug,
    title: topic.title ?? "",
    excerpt: topic.excerpt ?? "",
    image: topic.image ?? "",
    category: topic.category ?? "",
    categorySlug: topic.category_slug ?? "",
    date: topic.date_label || formatArabicContentDate(topic.published_at ?? ""),
    publishedAt: topic.published_at ?? "",
    readingTime: estimateReadingTimeLabel(topic.content),
    isFeatured: topic.is_featured,
    isPopular: topic.is_popular,
    content: topic.content ?? undefined,
    series: topic.series ?? undefined,
    seriesSlug: topic.series_slug ?? undefined,
    seoTitle: topic.seo_title ?? undefined,
    seoDescription: topic.seo_description ?? undefined,
    seoKeywords: topic.seo_keywords ?? undefined,
    faq: topic.faq ?? undefined,
  };
}

function mapDbTopicToDetail(topic: DbTopic): PublicTopicDetail {
  return {
    id: topic.id,
    slug: topic.slug,
    title: topic.title ?? "",
    excerpt: topic.excerpt ?? "",
    content: topic.content ?? "",
    image: topic.image ?? "",
    category: topic.category ?? "",
    categorySlug: topic.category_slug ?? "",
    series: topic.series ?? "",
    seriesSlug: topic.series_slug ?? "",
    date: topic.date_label || formatArabicContentDate(topic.published_at ?? ""),
    publishedAt: topic.published_at ?? "",
    readingTime: estimateReadingTimeLabel(topic.content),
    isFeatured: topic.is_featured,
    isPopular: topic.is_popular,
    seoTitle: topic.seo_title ?? "",
    seoDescription: topic.seo_description ?? "",
    seoKeywords: topic.seo_keywords ?? [],
    faq: topic.faq ?? [],
  };
}

const LISTING_SELECT =
  "id, slug, title, excerpt, image, category, category_slug, series, series_slug, date_label, published_at, is_featured, is_popular";

/** Public /topics routes only expose article topics; media lives under /media-center. */
const PUBLIC_TOPIC_CONTENT_TYPE = "article";

function applyPublicTopicFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  categorySlug?: string,
) {
  let next = query
    .eq("content_type", PUBLIC_TOPIC_CONTENT_TYPE)
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "like", "e2e-test%");

  if (categorySlug) {
    next = next.eq("category_slug", categorySlug);
  }

  return next;
}

async function queryFeaturedPublicTopic(categorySlug?: string): Promise<Topic | undefined> {
  const supabase = getSupabaseAdmin();

  const { data: featuredRow, error: featuredError } = await applyPublicTopicFilters(
    supabase.from("topics").select(LISTING_SELECT),
    categorySlug,
  )
    .eq("is_featured", true)
    .limit(1)
    .maybeSingle();

  if (featuredError) {
    logError("loadFeaturedPublicTopic failed", featuredError);
    return undefined;
  }

  if (featuredRow) {
    return mapDbTopicToListingTopic(featuredRow as DbTopic);
  }

  const { data: fallbackRow, error: fallbackError } = await applyPublicTopicFilters(
    supabase.from("topics").select(LISTING_SELECT),
    categorySlug,
  )
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    logError("loadFeaturedPublicTopic fallback failed", fallbackError);
    return undefined;
  }

  return fallbackRow ? mapDbTopicToListingTopic(fallbackRow as DbTopic) : undefined;
}

export type PublicTopicsListingParams = {
  sort: "latest" | "oldest";
  categorySlug?: string;
  page: number;
  itemsPerPage: number;
};

export type PublicTopicsListingResult = {
  featuredTopic?: Topic;
  visibleTopics: Topic[];
  totalRegularTopics: number;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
};

async function queryPublicTopicsListing(
  params: PublicTopicsListingParams,
): Promise<PublicTopicsListingResult> {
  const categorySlug = params.categorySlug?.trim() ?? "";
  const featuredTopic = await queryFeaturedPublicTopic(categorySlug || undefined);
  const featuredId = featuredTopic?.id;

  const supabase = getSupabaseAdmin();

  let countQuery = applyPublicTopicFilters(
    supabase.from("topics").select("id", { count: "exact", head: true }),
    categorySlug || undefined,
  );

  if (featuredId) {
    countQuery = countQuery.neq("id", featuredId);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    logError("loadPublicTopicsListing count failed", countError);
  }

  const totalRegularTopics = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRegularTopics / params.itemsPerPage));
  const currentPage = Math.min(Math.max(params.page, 1), totalPages);
  const startIndex = totalRegularTopics === 0 ? 0 : (currentPage - 1) * params.itemsPerPage;
  const endIndex = Math.min(startIndex + params.itemsPerPage, totalRegularTopics);

  let listQuery = applyPublicTopicFilters(
    supabase.from("topics").select(LISTING_SELECT),
    categorySlug || undefined,
  );

  if (featuredId) {
    listQuery = listQuery.neq("id", featuredId);
  }

  listQuery = listQuery.order("published_at", {
    ascending: params.sort === "oldest",
  });

  if (totalRegularTopics > 0) {
    listQuery = listQuery.range(startIndex, endIndex - 1);
  } else {
    listQuery = listQuery.limit(0);
  }

  const { data, error: listError } = await listQuery;

  if (listError) {
    logError("loadPublicTopicsListing failed", listError);
    return {
      featuredTopic,
      visibleTopics: [],
      totalRegularTopics: 0,
      currentPage: 1,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
    };
  }

  return {
    featuredTopic,
    visibleTopics: ((data ?? []) as DbTopic[]).map((topic) => mapDbTopicToListingTopic(topic)),
    totalRegularTopics,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
  };
}

export async function loadPublicTopicsListing(
  params: PublicTopicsListingParams,
): Promise<PublicTopicsListingResult> {
  const categorySlug = params.categorySlug?.trim() ?? "";
  const cacheKey = [
    "public-topics-listing",
    params.sort,
    categorySlug,
    String(params.page),
    String(params.itemsPerPage),
  ];

  return unstable_cache(
    async () => queryPublicTopicsListing(params),
    cacheKey,
    { revalidate: 300, tags: ["topics"] },
  )();
}

async function queryPublishedPublicTopics(): Promise<Topic[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("*")
    .eq("content_type", PUBLIC_TOPIC_CONTENT_TYPE)
    .eq("status", "published")
    .is("deleted_at", null);

  if (error) {
    logError("loadPublishedPublicTopics failed", error);
    return [];
  }

  return filterPublicTopics(data ?? []).map((topic) => mapDbTopicToListingTopic(topic as DbTopic));
}

export async function loadPublishedPublicTopics(): Promise<Topic[]> {
  return unstable_cache(
    async () => queryPublishedPublicTopics(),
    ["public-topics"],
    { revalidate: 300, tags: ["topics"] },
  )();
}

async function queryPublicTopicBySlug(slug: string): Promise<PublicTopicDetail | null> {
  if (isTestTopicSlug(slug)) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("*")
    .eq("slug", slug)
    .eq("content_type", PUBLIC_TOPIC_CONTENT_TYPE)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  return mapDbTopicToDetail(data as DbTopic);
}

export const loadPublicTopicBySlug = cache(async function loadPublicTopicBySlug(
  slug: string,
): Promise<PublicTopicDetail | null> {
  return unstable_cache(
    async () => queryPublicTopicBySlug(slug),
    ["public-topic", slug],
    { revalidate: 300, tags: ["topics", "topic"] },
  )();
});

async function queryRelatedPublicTopics(topic: PublicTopicDetail): Promise<PublicTopicDetail[]> {
  const filters: string[] = [];

  if (topic.categorySlug) {
    filters.push(`category_slug.eq.${topic.categorySlug}`);
  }

  if (topic.seriesSlug) {
    filters.push(`series_slug.eq.${topic.seriesSlug}`);
  }

  if (!filters.length) return [];

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("*")
    .eq("content_type", PUBLIC_TOPIC_CONTENT_TYPE)
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("id", topic.id)
    .or(filters.join(","))
    .limit(6);

  if (error || !data?.length) return [];

  return data
    .map((item) => mapDbTopicToDetail(item as DbTopic))
    .filter((item) => item.id !== topic.id && item.slug !== topic.slug && !isTestTopicSlug(item.slug))
    .slice(0, 3);
}

export async function loadRelatedPublicTopics(topic: PublicTopicDetail): Promise<PublicTopicDetail[]> {
  return unstable_cache(
    async () => queryRelatedPublicTopics(topic),
    ["related-topics", topic.slug],
    { revalidate: 300, tags: ["topics", "topic-related"] },
  )();
}
