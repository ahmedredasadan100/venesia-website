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
      "id, title, slug, excerpt, content, image, image_alt, media_payload, category_id, category_slug, series_id, status, published_at, published_by, date_label, deleted_at, seo_title, seo_description, focus_keyword, seo_keywords, canonical_url, robots_index, robots_follow, og_image, og_image_alt, faq, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_faq_on_page, show_faq_title_on_page",
    )
    .eq("id", id)
    .eq("content_type", "article")
    .is("deleted_at", null)
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

export async function getConflictingTopicSlugs(slugs: readonly string[]) {
  const candidates = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!candidates.length) return new Set<string>();

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("slug")
    .in("slug", candidates);

  if (error) {
    logError("getConflictingTopicSlugs failed", error, {
      candidateCount: candidates.length,
    });
    throw new Error("Could not verify Article slug uniqueness.", {
      cause: error,
    });
  }

  return new Set(
    (data ?? [])
      .map((row) => String(row.slug ?? "").trim())
      .filter(Boolean),
  );
}

async function loadTopicCategoriesForValidation() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, is_active")
    .is("deleted_at", null);

  if (error) {
    logError("loadActiveTopicCategoriesForValidation failed", error);
    return [] as ArticleTopicCategoryRecord[];
  }

  return (data ?? []) as ArticleTopicCategoryRecord[];
}

export async function getCategory(categoryId: number | null, currentCategoryId?: number | null) {
  const categories = await loadTopicCategoriesForValidation();
  if (categoryId === currentCategoryId) {
    const current = categories.find((category) => category.id === categoryId);
    if (current) return { id: current.id, name: current.name, slug: current.slug };
  }
  const category = categories.find((item) => item.id === categoryId);
  const result = resolveArticleTopicCategory(category?.slug ?? "", categories);

  if (!result.ok) {
    logError("getCategory rejected article category", new Error(result.message), { categoryId });
    return null;
  }

  return result.category;
}

export async function getCategoryValidationError(categoryId: number | null, currentCategoryId?: number | null) {
  const categories = await loadTopicCategoriesForValidation();
  if (categoryId === currentCategoryId && categories.some((category) => category.id === categoryId)) {
    return null;
  }
  const category = categories.find((item) => item.id === categoryId);
  const result = resolveArticleTopicCategory(category?.slug ?? "", categories);
  return result.ok ? null : result.message;
}

export async function getSeries(seriesId: number | null, currentSeriesId?: number | null) {
  if (!seriesId) return null;

  let query = getSupabaseAdmin()
    .from("topic_series")
    .select("id, name, slug, category_id")
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
      "title, slug, excerpt, content, image, image_alt, category, category_slug, category_id, series_id, series, series_slug, date_label, seo_title, seo_description, seo_keywords, focus_keyword, canonical_url, robots_index, robots_follow, og_image, og_image_alt, faq, is_featured, is_popular, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_faq_on_page, show_faq_title_on_page",
    )
    .eq("id", id)
    .eq("content_type", "article")
    .maybeSingle<Record<string, unknown>>();

  if (error || !data) return null;
  return data;
}
