import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { filterPublicTopics, isTestTopicSlug } from "../admin/cms-test-data";
import { formatArabicContentDate } from "../content-dates";
import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
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
  reading_time: string | null;
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
    readingTime: topic.reading_time ?? "",
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
    readingTime: topic.reading_time ?? "",
    isFeatured: topic.is_featured,
    isPopular: topic.is_popular,
    seoTitle: topic.seo_title ?? "",
    seoDescription: topic.seo_description ?? "",
    seoKeywords: topic.seo_keywords ?? [],
    faq: topic.faq ?? [],
  };
}

async function queryPublishedPublicTopics(): Promise<Topic[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("*")
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
