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
  getMediaBaseValidationError,
  getMediaPublishValidationError as validateMediaPublishInput,
  type MediaPublishInput,
} from "../../../../../lib/admin/content-workflow/media-publish-validation";
import { validateSlugFormat } from "../../../../../lib/admin/content-workflow/topic-publish-validation";
import { resolveTopicPublishedAt } from "../../../../../lib/content-dates";
import type { MediaEditableContentType } from "../../../../../components/admin/content/editors/media/media-content-config";
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
  return /^\d+$/.test(id);
}

export function redirectFormError(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

export function redirectEditError(id: string, message: string): never {
  redirectFormError(`/admin/content/topics/${id}`, message);
}

function normalizeArabicForSlug(value: string) {
  const map: Record<string, string> = {
    ا: "a",
    أ: "a",
    إ: "e",
    آ: "a",
    ب: "b",
    ت: "t",
    ث: "th",
    ج: "g",
    ح: "h",
    خ: "kh",
    د: "d",
    ذ: "z",
    ر: "r",
    ز: "z",
    س: "s",
    ش: "sh",
    ص: "s",
    ض: "d",
    ط: "t",
    ظ: "z",
    ع: "a",
    غ: "gh",
    ف: "f",
    ق: "q",
    ك: "k",
    ل: "l",
    م: "m",
    ن: "n",
    ه: "h",
    و: "w",
    ي: "y",
    ى: "a",
    ة: "h",
    ء: "",
    ئ: "e",
    ؤ: "o",
  };

  return value
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}

export function createSlug(value: string) {
  return normalizeArabicForSlug(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function validateSlug(slug: string) {
  return validateSlugFormat(slug);
}

export function getNormalizedStatus(value: string, fallback: MediaStatus = "draft"): MediaStatus {
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
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);

  return {
    title,
    slug,
    excerpt: getString(formData, "excerpt"),
    content: getString(formData, "content"),
    image: getString(formData, "image"),
    imageAlt: getString(formData, "image_alt"),
    categoryId: getString(formData, "category_id"),
    contentType: getString(formData, "content_type"),
    seriesId: getString(formData, "series_id"),
    status: getNormalizedStatus(getString(formData, "status"), "draft"),
    isFeatured: getBoolean(formData, "is_featured"),
    seoTitle: getString(formData, "seo_title"),
    seoDescription: getString(formData, "seo_description"),
    focusKeyword: getString(formData, "focus_keyword"),
  };
}

export type MediaPayload = ReturnType<typeof getPayload>;

export function getValidationError(payload: MediaPayload) {
  return getMediaBaseValidationError({
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: payload.content,
    image: payload.image,
    imageAlt: payload.imageAlt,
    categorySlug: payload.categoryId,
    contentType: "news",
    mediaPayload: null,
  });
}

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
    categorySlug: payload.categoryId,
    contentType,
    mediaPayload,
  };
}

export function getPublishedValidationError(
  contentType: MediaEditableContentType,
  mediaPayload: MediaTopicPayload | null,
  status: MediaStatus,
  payload: MediaPayload,
) {
  if (status !== "published") return null;
  return validateMediaPublishInput(payloadToMediaPublishInput(payload, mediaPayload, contentType));
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

  return {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: isRichMedia ? "" : payload.content,
    image: payload.image,
    image_alt: payload.imageAlt.trim() || null,
    media_payload: mediaPayload,
    category: category.name,
    category_slug: category.slug,
    category_id: category.id,
    content_type: contentType,
    series_id: series?.id ?? null,
    series: series?.name ?? null,
    series_slug: series?.slug ?? null,
    date_label: null,
    status: payload.status,
    seo_title: payload.seoTitle || null,
    seo_description: payload.seoDescription || null,
    seo_keywords: Array.isArray(currentTopic?.seo_keywords) ? currentTopic.seo_keywords : [],
    focus_keyword: payload.focusKeyword || null,
    faq: Array.isArray(currentTopic?.faq) ? currentTopic.faq : [],
    is_featured: payload.isFeatured,
    is_popular: false,
    published_at: resolveTopicPublishedAt({
      formPublishedDate: null,
      currentPublishedAt: currentTopic?.published_at ?? null,
      status: payload.status,
      nowIso: now,
    }),
    deleted_at: payload.status === "archived" ? now : null,
    updated_at: now,
  };
}

export function getMediaRedirectTo(formData: FormData) {
  const value = getString(formData, "redirect_to");
  return value.startsWith("/admin/content/topics") ? value : "/admin/content/topics";
}

export function appendMediaListNotice(path: string, notice: string, hash = "") {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("notice", notice);
  const query = params.toString();
  const base = query ? `${pathname}?${query}` : `${pathname}?notice=${notice}`;
  return hash ? `${base}#${hash}` : base;
}
