import { redirect } from "next/navigation";
import {
  assertPayloadMatchesContentType,
  normalizeVideoPayloadForStorage,
  parseMediaPayloadFromForm,
  resolveCoverImageForGallery,
  resolveCoverImageForVideo,
  type MediaTopicPayload,
} from "../../../../../lib/admin/media-topic-payload";
import {
  getMediaDraftBlockingChecks,
  getMediaPublishBlockingChecks,
  type MediaPublishInput,
} from "../../../../../lib/admin/content-workflow/media-publish-validation";
import { validateSlugFormat } from "../../../../../lib/admin/content-workflow/topic-publish-validation";
import { slugifyFromTitle } from "../../../../../lib/admin/slug";
import { parseFormPublishedDate, resolveTopicPublishedAt } from "../../../../../lib/content-dates";
import {
  readEntitySeoFormData,
  toEntitySeoPersistence,
} from "../../../../../lib/seo/entity-seo-types";
import type { MediaEditableContentType } from "../../../../../lib/admin/content/content-types";
import type { MediaStatus, MediaTopicRow } from "./types";
import { VALID_STATUSES } from "./types";

export function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export function validateId(id: string) {
  const parsed = Number(id);
  return /^\d+$/.test(id) && Number.isSafeInteger(parsed) && parsed > 0;
}

export function redirectFormError(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

export function redirectEditError(id: string, message: string): never {
  redirectFormError(`/admin/content/topics/${id}`, message);
}

export function validateSlug(slug: string) {
  return validateSlugFormat(slug);
}

export function getNormalizedStatus(value: string, fallback: MediaStatus = "unpublished"): MediaStatus {
  return VALID_STATUSES.includes(value as MediaStatus) ? (value as MediaStatus) : fallback;
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function uploadMediaImage(formData: FormData, _slug: string) {
  void _slug;
  const imageFile = getFile(formData, "image_file");
  const currentImage = getString(formData, "image");
  if (imageFile) {
    throw new Error("الرفع المباشر من نموذج المحتوى متوقف. استخدم مكتبة الصور المشتركة.");
  }
  return currentImage;
}

export function getPayload(formData: FormData) {
  const title = getString(formData, "title");
  const rawSlug = getString(formData, "slug");
  const slug = slugifyFromTitle(rawSlug || title);
  const seo = readEntitySeoFormData(formData);

  return {
    title,
    slug,
    excerpt: getString(formData, "excerpt"),
    content: getString(formData, "content"),
    image: getString(formData, "image"),
    imageAlt: getString(formData, "image_alt"),
    mediaProject: getString(formData, "media_project"),
    categoryId: getString(formData, "category_id"),
    contentType: getString(formData, "content_type"),
    seriesId: getString(formData, "series_id"),
    status: getNormalizedStatus(getString(formData, "status"), "unpublished"),
    isFeatured: getBoolean(formData, "is_featured"),
    isPopular: getBoolean(formData, "is_popular"),
    publishedAt: parseFormPublishedDate(formData),
    dateLabel: getString(formData, "date_label") || null,
    showTitleOnPage: getBoolean(formData, "show_title_on_page"),
    showImageOnPage: getBoolean(formData, "show_image_on_page"),
    showExcerptOnPage: getBoolean(formData, "show_excerpt_on_page"),
    showDateOnPage: getBoolean(formData, "show_date_on_page"),
    showCategoryOnPage: getBoolean(formData, "show_category_on_page"),
    showSeriesOnPage: getBoolean(formData, "show_series_on_page"),
    showIntroCardOnPage: getBoolean(formData, "show_intro_card_on_page"),
    ...seo,
  };
}

export type MediaPayload = ReturnType<typeof getPayload>;

function payloadToMediaPublishInput(
  payload: MediaPayload,
  mediaPayload: MediaTopicPayload | null,
  contentType: MediaEditableContentType,
): MediaPublishInput {
  return {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: payload.content,
    image: payload.image,
    imageAlt: payload.imageAlt,
    categorySlug: validateId(payload.categoryId) ? payload.categoryId : "",
    contentType,
    mediaPayload,
    seoTitle: payload.seoTitle,
    seoDescription: payload.seoDescription,
    focusKeyword: payload.focusKeyword,
    canonicalUrl: payload.canonicalUrl,
    ogImage: payload.ogImage,
    ogImageAlt: payload.ogImageAlt,
  };
}

export function getPublishedValidationChecks(
  contentType: MediaEditableContentType,
  mediaPayload: MediaTopicPayload | null,
  status: MediaStatus,
  payload: MediaPayload,
) {
  if (status !== "published") return [];
  return getMediaPublishBlockingChecks(
    payloadToMediaPublishInput(payload, mediaPayload, contentType),
  );
}

export function getDraftValidationChecks(
  contentType: MediaEditableContentType,
  mediaPayload: MediaTopicPayload | null,
  payload: MediaPayload,
) {
  return getMediaDraftBlockingChecks(
    payloadToMediaPublishInput(payload, mediaPayload, contentType),
  );
}

export function resolveWriteMediaPayload(
  contentType: MediaEditableContentType,
  formData: FormData,
  payload: MediaPayload,
) {
  const mediaPayload = parseMediaPayloadFromForm(contentType, formData);
  const matchError = assertPayloadMatchesContentType(contentType, mediaPayload);
  if (matchError) return { ok: false as const, message: matchError };

  if (contentType === "video" && mediaPayload?.kind === "video") {
    const normalized = normalizeVideoPayloadForStorage(mediaPayload);
    payload.image = resolveCoverImageForVideo(payload.image, normalized);
    return { ok: true as const, mediaPayload: normalized };
  }

  if (contentType === "gallery" && mediaPayload?.kind === "gallery") {
    payload.image = resolveCoverImageForGallery(payload.image, mediaPayload);
    payload.imageAlt = payload.imageAlt.trim() || mediaPayload.images[0]?.alt?.trim() || "";
    return { ok: true as const, mediaPayload };
  }

  return { ok: true as const, mediaPayload: null as MediaTopicPayload | null };
}

export function buildMediaWritePayload(
  payload: MediaPayload,
  category: { id: number; name: string; slug: string },
  contentType: MediaEditableContentType,
  mediaPayload: MediaTopicPayload | null,
  now: string,
  currentTopic?: MediaTopicRow | null,
  series?: { id: number; name: string; slug: string } | null,
) {
  const isRichMedia = contentType === "video" || contentType === "gallery";
  const seo = toEntitySeoPersistence(payload);

  return {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: isRichMedia ? "" : payload.content,
    image: payload.image,
    image_alt: payload.imageAlt.trim() || null,
    media_payload: mediaPayload,
    media_project: payload.mediaProject || null,
    category: category.name,
    category_slug: category.slug,
    category_id: category.id,
    content_type: contentType,
    series_id: series?.id ?? null,
    series: series?.name ?? null,
    series_slug: series?.slug ?? null,
    date_label: payload.dateLabel,
    status: payload.status,
    ...seo,
    faq: Array.isArray(currentTopic?.faq) ? currentTopic.faq : [],
    is_featured: payload.isFeatured,
    is_popular: payload.isPopular,
    show_title_on_page: payload.showTitleOnPage,
    show_image_on_page: payload.showImageOnPage,
    show_excerpt_on_page: payload.showExcerptOnPage,
    show_date_on_page: payload.showDateOnPage,
    show_category_on_page: payload.showCategoryOnPage,
    show_series_on_page: payload.showSeriesOnPage,
    show_intro_card_on_page: payload.showIntroCardOnPage,
    published_at: resolveTopicPublishedAt({
      formPublishedDate: payload.publishedAt,
      currentPublishedAt: currentTopic?.published_at ?? null,
      status: payload.status,
      nowIso: now,
    }),
    deleted_at: currentTopic?.deleted_at ?? null,
    updated_at: now,
  };
}
