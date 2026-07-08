"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  resolveArticleTopicCategory,
  type ArticleTopicCategoryRecord,
} from "../../../../lib/admin/article-topic-categories";
import {
  getTopicPublishValidationError,
  topicRowToPublishInput,
} from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { logError } from "../../../../lib/logging";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import type {
  BulkPublishValidationFailure,
  BulkPublishValidationResult,
  SeriesRow,
  TopicRow,
} from "./types";

export async function validateBulkTopicPublish(ids: number[]): Promise<BulkPublishValidationResult> {
  await requireAdminSession();

  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) {
    return { validIds: [], failures: [] };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category_slug, seo_title, seo_description, focus_keyword, faq",
    )
    .in("id", uniqueIds)
    .eq("content_type", "article")
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const foundIds = new Set(rows.map((row) => row.id));
  const failures: BulkPublishValidationFailure[] = [];
  const validIds: number[] = [];

  for (const id of uniqueIds) {
    if (!foundIds.has(id)) {
      failures.push({ id, title: `#${id}`, reason: "الموضوع غير موجود أو غير متاح." });
    }
  }

  for (const row of rows) {
    const validationError = getTopicPublishValidationError(topicRowToPublishInput(row));
    if (validationError) {
      failures.push({
        id: row.id,
        title: row.title?.trim() || `موضوع #${row.id}`,
        reason: validationError,
      });
    } else {
      validIds.push(row.id);
    }
  }

  return { validIds, failures };
}

export async function getTopicById(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category_slug, status, published_at, seo_title, seo_description, focus_keyword, seo_keywords, faq",
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

async function loadActiveTopicCategoriesForValidation() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, is_active")
    .eq("is_active", true);

  if (error) {
    logError("loadActiveTopicCategoriesForValidation failed", error);
    return [] as ArticleTopicCategoryRecord[];
  }

  return (data ?? []) as ArticleTopicCategoryRecord[];
}

export async function getCategory(categorySlug: string) {
  const categories = await loadActiveTopicCategoriesForValidation();
  const result = resolveArticleTopicCategory(categorySlug, categories);

  if (!result.ok) {
    logError("getCategory rejected article category", new Error(result.message), { categorySlug });
    return null;
  }

  return result.category;
}

export async function getCategoryValidationError(categorySlug: string) {
  const categories = await loadActiveTopicCategoriesForValidation();
  const result = resolveArticleTopicCategory(categorySlug, categories);
  return result.ok ? null : result.message;
}

export async function getSeries(seriesId: number | null) {
  if (!seriesId) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id, name, slug")
    .eq("id", seriesId)
    .maybeSingle<SeriesRow>();

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
      "title, slug, excerpt, content, image, image_alt, category, category_slug, category_id, series_id, series, series_slug, date_label, seo_title, seo_description, seo_keywords, focus_keyword, faq, is_featured, is_popular",
    )
    .eq("id", id)
    .eq("content_type", "article")
    .maybeSingle<Record<string, unknown>>();

  if (error || !data) return null;
  return data;
}
