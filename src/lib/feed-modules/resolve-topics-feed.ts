import "server-only";

import {
  loadPublicContentCollection,
  loadPublicContentFeedCategories,
  loadPublicContentFeedSeries,
} from "../content/public-content-read/owner";
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
  return `/topics?series=${encodeURIComponent(slug)}`;
}

async function resolveLatestOrPopular(
  feedType: Extract<TopicsFeedType, "latest" | "popular">,
  config: FeedModuleConfig,
  excludeContentIds: readonly number[],
): Promise<FeedModulePayload> {
  const result = await loadPublicContentCollection({
    contentTypes: ["article"],
    categorySlugs: config.query.categorySlugs,
    seriesSlugs: config.query.seriesSlugs,
    page: 1,
    pageSize: config.query.limit,
    sort: feedType === "popular" ? "most-viewed" : "newest",
    excludeIds: excludeContentIds,
  });

  return {
    kind: "articles",
    items: result.items.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      date: item.date,
      image: item.image,
      imageAlt: item.imageAlt,
      href: item.href,
      category: item.category,
      series: item.series,
      viewsCount: item.viewsCount,
    })),
  };
}

async function resolveCategories(
  config: FeedModuleConfig,
): Promise<FeedModulePayload> {
  const categories = await loadPublicContentFeedCategories({
    limit: config.query.limit,
    categorySlugs: config.query.categorySlugs,
    seriesSlugs: config.query.seriesSlugs,
  });

  return {
    kind: "categories",
    items: categories.map((category) => ({
      name: category.name,
      href: getCategoryFilterHref(category.slug),
      count: category.count,
    })),
  };
}

async function resolveSeries(
  config: FeedModuleConfig,
): Promise<FeedModulePayload> {
  const series = await loadPublicContentFeedSeries({
    limit: config.query.limit,
    categorySlugs: config.query.categorySlugs,
    seriesSlugs: config.query.seriesSlugs,
  });

  return {
    kind: "series",
    items: series.map((item) => ({
      title: item.name,
      subtitle: item.description,
      image: resolveLocalPublicImage(item.representative?.image, DEFAULT_IMAGE),
      imageAlt: item.representative?.imageAlt || item.name,
      href: getSeriesFilterHref(item.slug),
      slug: item.slug,
    })),
  };
}

export async function resolveTopicsFeedModule(
  template: Pick<FeedModuleTemplateRow, "feed_type">,
  config: FeedModuleConfig,
  excludeContentIds: readonly number[] = [],
): Promise<FeedModulePayload> {
  switch (template.feed_type) {
    case "latest":
      return resolveLatestOrPopular("latest", config, excludeContentIds);
    case "popular":
      return resolveLatestOrPopular("popular", config, excludeContentIds);
    case "categories":
      return resolveCategories(config);
    case "series":
      return resolveSeries(config);
    default:
      return { kind: "articles", items: [] };
  }
}
