import type { MediaTopicPayload } from "../media-topic-payload";
import {
  buildContentReviewChecks,
  getContentDraftBlockingChecks,
  getContentDraftValidationError,
  getContentPublishBlockingChecks,
  getContentPublishValidationError,
  type ContentReviewInput,
} from "./content-review-capability";

export type MediaEditableContentType = "news" | "video" | "gallery" | "press" | "site_update";

export type MediaPublishInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  imageAlt: string;
  categorySlug: string;
  contentType: MediaEditableContentType;
  mediaPayload: MediaTopicPayload | null;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  ogImage: string;
  ogImageAlt: string;
};

function toContentReviewInput(input: MediaPublishInput): ContentReviewInput {
  return { ...input, faq: [] };
}

export function getMediaBaseValidationError(input: MediaPublishInput) {
  return getContentDraftValidationError(toContentReviewInput(input));
}

export function getMediaDraftBlockingChecks(input: MediaPublishInput) {
  return getContentDraftBlockingChecks(toContentReviewInput(input));
}

export function getMediaPublishValidationError(input: MediaPublishInput) {
  return getContentPublishValidationError(toContentReviewInput(input));
}

export function getMediaPublishBlockingChecks(input: MediaPublishInput) {
  return getContentPublishBlockingChecks(toContentReviewInput(input));
}

export function buildMediaPublishChecklist(input: MediaPublishInput) {
  return buildContentReviewChecks(toContentReviewInput(input));
}

export function mediaRowToPublishInput(row: {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  category_slug?: string | null;
  content_type?: string | null;
  media_payload?: MediaTopicPayload | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  canonical_url?: string | null;
  og_image?: string | null;
  og_image_alt?: string | null;
}): MediaPublishInput | null {
  const contentType = row.content_type;
  if (
    contentType !== "news" &&
    contentType !== "press" &&
    contentType !== "site_update" &&
    contentType !== "video" &&
    contentType !== "gallery"
  ) {
    return null;
  }

  return {
    title: row.title ?? "",
    slug: row.slug ?? "",
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    image: row.image ?? "",
    imageAlt: row.image_alt ?? "",
    categorySlug: row.category_slug ?? "",
    contentType,
    mediaPayload: row.media_payload ?? null,
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    focusKeyword: row.focus_keyword ?? "",
    canonicalUrl: row.canonical_url ?? "",
    ogImage: row.og_image ?? "",
    ogImageAlt: row.og_image_alt ?? "",
  };
}
