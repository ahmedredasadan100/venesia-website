import "server-only";

import {
  loadPublicContentCollection,
  loadPublicContentDetail,
  type PublicContentDetail,
} from "../content/public-content-read/owner";
import type { PublicContentSummary } from "../content/public-content-read/contract";
import type { Topic } from "./types";

export type PublicTopicDetail = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  metadataImage: string;
  imageAlt: string;
  ogImage: string;
  ogImageAlt: string;
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
  canonicalUrl: string;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  faq: { question: string; answer: string }[];
  showTitleOnPage: boolean;
  showImageOnPage: boolean;
  showExcerptOnPage: boolean;
  showDateOnPage: boolean;
  showCategoryOnPage: boolean;
  showSeriesOnPage: boolean;
  showIntroCardOnPage: boolean;
  showFaqOnPage: boolean;
  showFaqTitleOnPage: boolean;
};

function adaptPublicContentSummaryToTopic(item: PublicContentSummary): Topic {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    image: item.image,
    category: item.category,
    categorySlug: item.categorySlug,
    date: item.date,
    publishedAt: item.publishedAt,
    readingTime: "",
    isFeatured: item.isFeatured,
    isPopular: item.isPopular,
    series: item.series || undefined,
    seriesSlug: item.seriesSlug || undefined,
    showDateOnPage: item.display.date,
    showCategoryOnPage: item.display.category,
    showSeriesOnPage: item.display.series,
    showIntroCardOnPage: item.display.introCard,
  };
}

function adaptPublicContentDetailToTopic(item: PublicContentDetail): PublicTopicDetail {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    content: item.content,
    image: item.image,
    metadataImage: item.metadataImage,
    imageAlt: item.imageAlt,
    ogImage: item.ogImage,
    ogImageAlt: item.ogImageAlt,
    category: item.category,
    categorySlug: item.categorySlug,
    series: item.series,
    seriesSlug: item.seriesSlug,
    date: item.date,
    publishedAt: item.publishedAt,
    readingTime: item.readingTime,
    isFeatured: item.isFeatured,
    isPopular: item.isPopular,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    seoKeywords: item.seoKeywords,
    canonicalUrl: item.canonicalUrl,
    robotsIndex: item.robotsIndex,
    robotsFollow: item.robotsFollow,
    faq: item.faq,
    showTitleOnPage: item.display.title,
    showImageOnPage: item.display.image,
    showExcerptOnPage: item.display.excerpt,
    showDateOnPage: item.display.date,
    showCategoryOnPage: item.display.category,
    showSeriesOnPage: item.display.series,
    showIntroCardOnPage: item.display.introCard,
    showFaqOnPage: item.showFaqOnPage,
    showFaqTitleOnPage: item.showFaqTitleOnPage,
  };
}

/** Topics is a public presentation adapter; Unified Content owns the read. */
export async function loadPublicTopicsListing(
  params: {
    sort: "latest" | "oldest";
    categorySlug?: string;
    seriesSlug?: string;
    page: number;
    itemsPerPage: number;
    search?: string;
  },
) {
  const result = await loadPublicContentCollection({
    contentTypes: ["article"],
    sort: params.sort === "oldest" ? "oldest" : "newest",
    page: params.page,
    pageSize: params.itemsPerPage,
    search: params.search,
    categorySlugs: params.categorySlug ? [params.categorySlug] : [],
    seriesSlug: params.seriesSlug,
    featured: params.search ? "none" : "separate",
  });

  return {
    featuredTopic: result.featured
      ? adaptPublicContentSummaryToTopic(result.featured)
      : undefined,
    visibleTopics: result.items.map(adaptPublicContentSummaryToTopic),
    totalRegularTopics: result.totalCount,
    currentPage: result.page,
    totalPages: result.totalPages,
    startIndex: result.startIndex,
    endIndex: result.endIndex,
  };
}

export async function loadPublicTopicBySlug(slug: string): Promise<PublicTopicDetail | null> {
  const item = await loadPublicContentDetail("article", slug);
  return item ? adaptPublicContentDetailToTopic(item) : null;
}

export async function loadRelatedPublicTopics(topic: PublicTopicDetail): Promise<Topic[]> {
  if (!topic.categorySlug && !topic.seriesSlug) return [];
  const result = await loadPublicContentCollection({
    contentTypes: ["article"],
    page: 1,
    pageSize: 3,
    sort: "newest",
    excludeIds: [topic.id],
    relatedTo: {
      categorySlug: topic.categorySlug,
      seriesSlug: topic.seriesSlug,
    },
  });
  return result.items.map(adaptPublicContentSummaryToTopic);
}
