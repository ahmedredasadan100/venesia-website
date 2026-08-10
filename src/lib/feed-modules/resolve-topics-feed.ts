import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { filterPublicTopics } from "../admin/cms-test-data";
import { logError } from "../logging";
import { formatArabicContentDate } from "../content-dates";
import { resolveLocalPublicImage } from "../media/resolve-local-public-image";
import type {
  FeedModuleConfig,
  FeedModulePayload,
  FeedModuleTemplateRow,
  TopicsFeedType,
} from "./types";

const DEFAULT_IMAGE = "/images/topics/default.jpg";

function getCategoryFilterHref(slug: string) {
  return `/topics?category=${encodeURIComponent(slug)}`;
}

function getSeriesFilterHref(slug: string) {
  return `/topics?series=${slug}`;
}

async function resolveLatestOrPopular(
  feedType: Extract<TopicsFeedType, "latest" | "popular">,
  config: FeedModuleConfig,
): Promise<FeedModulePayload> {
  let query = getSupabaseAdmin()
    .from("topics")
    .select("slug, title, excerpt, image, date_label, published_at")
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null);

  if (config.query.categorySlugs.length) {
    query = query.in("category_slug", config.query.categorySlugs);
  }

  if (config.query.seriesSlug) {
    query = query.eq("series_slug", config.query.seriesSlug);
  }

  if (feedType === "popular") {
    query = query.eq("is_popular", true);
  }

  const { data, error } = await query
    .order("published_at", { ascending: false })
    .limit(config.query.limit + 5);

  if (error) {
    logError(`resolveTopicsFeed: ${feedType} query failed`, error, {
      categorySlugs: config.query.categorySlugs,
      seriesSlug: config.query.seriesSlug,
    });
    return { kind: "articles", items: [] };
  }

  return {
    kind: "articles",
    items: filterPublicTopics(data ?? [])
      .slice(0, config.query.limit)
      .map((row) => ({
        title: row.title ?? "",
        excerpt: row.excerpt ?? "",
        date: row.date_label || formatArabicContentDate(row.published_at) || "",
        image: resolveLocalPublicImage(row.image, DEFAULT_IMAGE),
        href: `/topics/${row.slug}`,
      })),
  };
}

async function resolveCategories(config: FeedModuleConfig): Promise<FeedModulePayload> {
  let seriesCategoryId: number | null = null;

  if (config.query.seriesSlug) {
    const { data: seriesRow, error: seriesError } = await getSupabaseAdmin()
      .from("topic_series")
      .select("category_id")
      .eq("slug", config.query.seriesSlug)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();

    if (seriesError) {
      logError("resolveTopicsFeed: series lookup for categories failed", seriesError);
      return { kind: "categories", items: [] };
    }

    if (!seriesRow?.category_id) return { kind: "categories", items: [] };
    seriesCategoryId = seriesRow.category_id;
  }

  let categoriesQuery = getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, status, topics_count:topics(count)")
    .eq("status", "published")
    .is("deleted_at", null)
    // Soft-deleted topics must never count toward a public category.
    .is("topics.deleted_at", null);

  if (config.query.categorySlugs.length) {
    categoriesQuery = categoriesQuery.in("slug", config.query.categorySlugs);
  }

  if (seriesCategoryId !== null) {
    categoriesQuery = categoriesQuery.eq("id", seriesCategoryId);
  }

  const { data: categories, error: categoriesError } = await categoriesQuery
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(config.query.limit);

  if (categoriesError) {
    logError("resolveTopicsFeed: categories query failed", categoriesError);
    return { kind: "categories", items: [] };
  }

  return {
    kind: "categories",
    items: (categories ?? []).flatMap((row) => {
      const name = String(row.name ?? "").trim();
      const slug = String(row.slug ?? "").trim();
      if (!name || !slug) return [];

      const rawCount = Array.isArray(row.topics_count) ? (row.topics_count[0]?.count ?? 0) : 0;
      const parsedCount = Number(rawCount);

      return [{
        name,
        href: getCategoryFilterHref(slug),
        count: Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0,
      }];
    }),
  };
}

async function loadTopicImagesBySeriesSlug(seriesSlugs: string[]) {
  if (!seriesSlugs.length) return [];

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("series_slug, image, slug")
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .in("series_slug", seriesSlugs);

  if (error) {
    logError("resolveTopicsFeed: series image lookup failed", error);
    return [];
  }

  return filterPublicTopics(data ?? []);
}

async function resolveSeries(config: FeedModuleConfig): Promise<FeedModulePayload> {
  let query = getSupabaseAdmin()
    .from("topic_series")
    .select("id, name, slug, description, status, sort_order, category_id")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (config.query.categorySlugs.length) {
    const { data: categories, error: categoryError } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id")
      .in("slug", config.query.categorySlugs)
      .is("deleted_at", null)
      .eq("status", "published");

    if (categoryError) {
      logError("resolveTopicsFeed: category lookup for series failed", categoryError);
      return { kind: "series", items: [] };
    }

    const categoryIds = (categories ?? []).map((category) => category.id).filter(Boolean);
    if (!categoryIds.length) return { kind: "series", items: [] };

    query = query.in("category_id", categoryIds);
  }

  if (config.query.seriesSlug) {
    query = query.eq("slug", config.query.seriesSlug);
  }

  const { data: seriesRows, error: seriesError } = await query.limit(config.query.limit);

  if (seriesError) {
    logError("resolveTopicsFeed: series query failed", seriesError);
    return { kind: "series", items: [] };
  }

  const rows = seriesRows ?? [];
  const topicImages = await loadTopicImagesBySeriesSlug(rows.map((row) => row.slug));

  return {
    kind: "series",
    items: rows.map((row) => {
      const firstInSeries = topicImages.find((topic) => topic.series_slug === row.slug);

      return {
        title: row.name,
        subtitle: row.description ?? "",
        image: resolveLocalPublicImage(firstInSeries?.image, DEFAULT_IMAGE),
        href: getSeriesFilterHref(row.slug),
        slug: row.slug,
      };
    }),
  };
}

export async function resolveTopicsFeedModule(
  template: Pick<FeedModuleTemplateRow, "feed_type">,
  config: FeedModuleConfig,
): Promise<FeedModulePayload> {
  switch (template.feed_type) {
    case "latest":
      return resolveLatestOrPopular("latest", config);
    case "popular":
      return resolveLatestOrPopular("popular", config);
    case "categories":
      return resolveCategories(config);
    case "series":
      return resolveSeries(config);
    default:
      return { kind: "articles", items: [] };
  }
}
