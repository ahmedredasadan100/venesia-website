"use server";

import {
  resolveArticleTopicCategory,
  type ArticleTopicCategoryRecord,
} from "../../../../../lib/admin/article-topic-categories";
import { logError } from "../../../../../lib/logging";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import type {
  SeriesRow,
  TopicRow,
} from "./types";

export async function getTopicById(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category_slug, series_id, status, published_at, published_by, date_label, deleted_at, seo_title, seo_description, focus_keyword, seo_keywords, canonical_url, robots_index, robots_follow, faq, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_faq_on_page, show_faq_title_on_page",
    )
    .eq("id", id)
    .eq("content_type", "article")
    .maybeSingle<TopicRow>();

  if (error) {
    logError("getTopicById failed", error, { id });
    return null;
  }

  if (!data) return null;
  return data;
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

async function loadTopicCategoriesForValidation() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, is_active");

  if (error) {
    logError("loadActiveTopicCategoriesForValidation failed", error);
    return [] as ArticleTopicCategoryRecord[];
  }

  return (data ?? []) as ArticleTopicCategoryRecord[];
}

export async function getCategory(categorySlug: string, currentCategorySlug?: string | null) {
  const categories = await loadTopicCategoriesForValidation();
  if (categorySlug === currentCategorySlug) {
    const current = categories.find((category) => category.slug === categorySlug);
    if (current) return { id: current.id, name: current.name, slug: current.slug };
  }
  const result = resolveArticleTopicCategory(categorySlug, categories);

  if (!result.ok) {
    logError("getCategory rejected article category", new Error(result.message), { categorySlug });
    return null;
  }

  return result.category;
}

export async function getCategoryValidationError(categorySlug: string, currentCategorySlug?: string | null) {
  const categories = await loadTopicCategoriesForValidation();
  if (categorySlug === currentCategorySlug && categories.some((category) => category.slug === categorySlug)) {
    return null;
  }
  const result = resolveArticleTopicCategory(categorySlug, categories);
  return result.ok ? null : result.message;
}

export async function getSeries(seriesId: number | null, currentSeriesId?: number | null) {
  if (!seriesId) return null;

  let query = getSupabaseAdmin()
    .from("topic_series")
    .select("id, name, slug")
    .eq("id", seriesId)
    .is("deleted_at", null);
  if (seriesId !== currentSeriesId) query = query.eq("status", "published");
  const { data, error } = await query.maybeSingle<SeriesRow>();

  if (error) {
    logError("getSeries failed", error, { seriesId });
    return null;
  }

  if (!data) return null;
  return data;
}

export async function getTopicForDuplicate(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "title, slug, excerpt, content, image, image_alt, category, category_slug, category_id, series_id, series, series_slug, date_label, seo_title, seo_description, seo_keywords, focus_keyword, canonical_url, robots_index, robots_follow, faq, is_featured, is_popular, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_faq_on_page, show_faq_title_on_page",
    )
    .eq("id", id)
    .eq("content_type", "article")
    .maybeSingle<Record<string, unknown>>();

  if (error || !data) return null;
  return data;
}
