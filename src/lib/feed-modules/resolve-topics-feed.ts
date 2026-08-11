import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { loadPublicContentCollection } from "../content/public-content-read/owner";
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
  const result = await loadPublicContentCollection({
    contentTypes: ["article"],
    categorySlugs: config.query.categorySlugs,
    seriesSlug: config.query.seriesSlug ?? undefined,
    popularOnly: feedType === "popular",
    page: 1,
    pageSize: config.query.limit,
    sort: "newest",
  });

  return {
    kind: "articles",
    items: result.items.map((item) => ({
      title: item.title,
      excerpt: item.excerpt,
      date: item.date,
      image: item.image,
      href: item.href,
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
    // Category counters follow the same public Article truth as the collection owner.
    .eq("topics.status", "published")
    .eq("topics.content_type", "article")
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
  const result = await loadPublicContentCollection({
    contentTypes: ["article"],
    seriesSlugs,
    page: 1,
    pageSize: 60,
    sort: "newest",
  });
  return result.items;
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
      const firstInSeries = topicImages.find((topic) => topic.seriesSlug === row.slug);

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
