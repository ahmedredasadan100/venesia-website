import {
  buildContentReviewChecks,
  getContentDraftBlockingChecks,
  getContentPublishBlockingChecks,
  getContentPublishValidationError,
  validateContentSlug,
  type ContentReviewFaqItem,
  type ContentReviewInput,
} from "./content-review-capability";
import type { Json } from "../../database.types";

export type TopicFaqItem = ContentReviewFaqItem;

export function parseTopicFaq(
  value: Json,
): Array<{ question: string; answer: string }> | null {
  if (!Array.isArray(value)) return null;

  const faq: Array<{ question: string; answer: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    if (typeof item.question !== "string" || typeof item.answer !== "string") {
      return null;
    }
    faq.push({ question: item.question, answer: item.answer });
  }
  return faq;
}

export type TopicPublishInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  imageAlt: string;
  categorySlug: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogImageAlt?: string;
  faq?: TopicFaqItem[];
};

function toContentReviewInput(input: TopicPublishInput): ContentReviewInput {
  return {
    ...input,
    contentType: "article",
    canonicalUrl: input.canonicalUrl ?? "",
    ogImage: input.ogImage ?? "",
    ogImageAlt: input.ogImageAlt ?? "",
    mediaPayload: null,
  };
}

export const validateSlugFormat = validateContentSlug;

export function getTopicDraftBlockingChecks(input: TopicPublishInput) {
  return getContentDraftBlockingChecks(toContentReviewInput(input));
}

export function getTopicPublishOnlyValidationError(input: TopicPublishInput): string | null {
  return getTopicPublishBlockingChecks(input).find(
    (item) =>
      ["seo-title", "seo-description", "focus-keyword", "canonical-url", "og-image-alt"].includes(item.id),
  )?.hint ?? null;
}

export function getTopicPublishBlockingChecks(input: TopicPublishInput) {
  return getContentPublishBlockingChecks(toContentReviewInput(input));
}

export function getTopicPublishValidationError(input: TopicPublishInput) {
  return getContentPublishValidationError(toContentReviewInput(input));
}

export function buildTopicPublishChecklist(input: TopicPublishInput) {
  return buildContentReviewChecks(toContentReviewInput(input));
}

export function topicRowToPublishInput(row: {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  category_slug?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  canonical_url?: string | null;
  og_image?: string | null;
  og_image_alt?: string | null;
  faq?: TopicFaqItem[] | null;
}): TopicPublishInput {
  return {
    title: row.title ?? "",
    slug: row.slug ?? "",
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    image: row.image ?? "",
    imageAlt: row.image_alt ?? "",
    categorySlug: row.category_slug ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    focusKeyword: row.focus_keyword ?? "",
    canonicalUrl: row.canonical_url ?? "",
    ogImage: row.og_image ?? "",
    ogImageAlt: row.og_image_alt ?? "",
    faq: Array.isArray(row.faq) ? row.faq : [],
  };
}
