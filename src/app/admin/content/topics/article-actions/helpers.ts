import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { parseFormPublishedDate, resolveTopicPublishedAt } from "../../../../../lib/content-dates";
import {
  getTopicDraftValidationError,
  getTopicPublishOnlyValidationError,
  getTopicPublishValidationError,
  validateSlugFormat,
  type TopicPublishInput,
} from "../../../../../lib/admin/content-workflow/topic-publish-validation";
import type { CategoryRow, SeriesRow, TopicRow, TopicStatus } from "./types";
import { VALID_STATUSES } from "./types";

export function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function getRedirectTo(formData: FormData, fallback = "/admin/content/topics") {
  const redirectTo = getString(formData, "redirect_to");
  return redirectTo.startsWith("/admin/content/topics") ? redirectTo : fallback;
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

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function getKeywords(formData: FormData) {
  return getString(formData, "seo_keywords")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDateLabel(formData: FormData) {
  const label = getString(formData, "date_label");
  return label || null;
}

function getImageExtension(file: File) {
  const allowedTypes: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return allowedTypes[file.type] ?? null;
}

export async function uploadTopicImage(formData: FormData, slug: string) {
  const imageFile = getFile(formData, "image_file");
  const currentImage = getString(formData, "image");

  if (!imageFile) return currentImage;

  const extension = getImageExtension(imageFile);
  if (!extension) {
    throw new Error("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو GIF.");
  }

  const maxSize = 5 * 1024 * 1024;
  if (imageFile.size > maxSize) {
    throw new Error("حجم الصورة كبير. الحد الأقصى 5MB.");
  }

  const safeSlug = slug || "topic";
  const fileName = `${safeSlug}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const publicDir = path.join(process.cwd(), "public", "images", "topics");
  const filePath = path.join(publicDir, fileName);

  await mkdir(publicDir, { recursive: true });
  const buffer = Buffer.from(await imageFile.arrayBuffer());
  await writeFile(filePath, buffer);

  return `/images/topics/${fileName}`;
}

function getFaq(formData: FormData) {
  const questions = formData.getAll("faq_question").map(String);
  const answers = formData.getAll("faq_answer").map(String);

  return questions
    .map((question, index) => ({
      question: question.trim(),
      answer: (answers[index] ?? "").trim(),
    }))
    .filter((item) => item.question && item.answer);
}

export function getNormalizedStatus(value: string, fallback: TopicStatus = "draft") {
  return VALID_STATUSES.includes(value as TopicStatus) ? (value as TopicStatus) : fallback;
}

export function getPayload(formData: FormData) {
  const title = getString(formData, "title");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);
  const seriesId = getString(formData, "series_id");
  const legacySeries = getString(formData, "legacy_series");
  const legacySeriesSlug = getString(formData, "legacy_series_slug");

  return {
    title,
    slug,
    excerpt: getString(formData, "excerpt"),
    content: getString(formData, "content"),
    image: getString(formData, "image"),
    imageAlt: getString(formData, "image_alt"),
    categorySlug: getString(formData, "category_slug"),
    seriesId: seriesId && validateId(seriesId) ? Number(seriesId) : null,
    legacySeries: legacySeries || null,
    legacySeriesSlug: legacySeriesSlug ? createSlug(legacySeriesSlug) : null,
    dateLabel: getDateLabel(formData),
    publishedAt: parseFormPublishedDate(formData),
    seoTitle: getString(formData, "seo_title"),
    seoDescription: getString(formData, "seo_description"),
    focusKeyword: getString(formData, "focus_keyword"),
    seoKeywords: getKeywords(formData),
    faq: getFaq(formData),
    isFeatured: getBoolean(formData, "is_featured"),
    isPopular: getBoolean(formData, "is_popular"),
  };
}

export type TopicPayload = ReturnType<typeof getPayload>;

function payloadToPublishInput(payload: TopicPayload): TopicPublishInput {
  return {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: payload.content,
    image: payload.image,
    imageAlt: payload.imageAlt,
    categorySlug: payload.categorySlug,
    seoTitle: payload.seoTitle,
    seoDescription: payload.seoDescription,
    focusKeyword: payload.focusKeyword,
    faq: payload.faq,
  };
}

export function getDraftValidationError(payload: TopicPayload) {
  return getTopicDraftValidationError(payloadToPublishInput(payload));
}

export function getPublishOnlyValidationError(payload: TopicPayload) {
  return getTopicPublishOnlyValidationError(payloadToPublishInput(payload));
}

export function getValidationError(payload: TopicPayload, mode: "save" | "publish" | "draft") {
  if (mode === "publish") return getPublishValidationError(payload);
  return getDraftValidationError(payload);
}

export function getPublishValidationError(payload: TopicPayload) {
  return getTopicPublishValidationError(payloadToPublishInput(payload));
}

export function preserveImage(nextValue: string, currentValue: string) {
  return nextValue.trim() || currentValue;
}

export function preserveText(nextValue: string, currentValue: string) {
  return nextValue.trim() || currentValue;
}

export function preservePayloadFromCurrent(payload: TopicPayload, currentTopic: TopicRow) {
  payload.image = preserveImage(payload.image, String(currentTopic.image ?? ""));
  payload.imageAlt = preserveText(payload.imageAlt, String(currentTopic.image_alt ?? ""));
  payload.seoTitle = preserveText(payload.seoTitle, String(currentTopic.seo_title ?? ""));
  payload.seoDescription = preserveText(payload.seoDescription, String(currentTopic.seo_description ?? ""));
  payload.focusKeyword = preserveText(payload.focusKeyword, String(currentTopic.focus_keyword ?? ""));

  if (!payload.excerpt.trim()) {
    payload.excerpt = String(currentTopic.excerpt ?? "");
  }

  if (!payload.content.trim()) {
    payload.content = String(currentTopic.content ?? "");
  }

  if (!payload.seoKeywords.length && Array.isArray(currentTopic.seo_keywords)) {
    payload.seoKeywords = currentTopic.seo_keywords.map(String).filter(Boolean);
  }

  if (!payload.faq.length && Array.isArray(currentTopic.faq)) {
    payload.faq = currentTopic.faq
      .map((item) => ({
        question: String(item.question ?? "").trim(),
        answer: String(item.answer ?? "").trim(),
      }))
      .filter((item) => item.question && item.answer);
  }

  return payload;
}

export function appendNotice(path: string, notice: string) {
  const [baseWithQuery, hash = ""] = path.split("#");
  const joiner = baseWithQuery.includes("?") ? "&" : "?";
  return `${baseWithQuery}${joiner}notice=${notice}${hash ? `#${hash}` : "#topics-table"}`;
}

export function buildTopicWritePayload(
  payload: TopicPayload,
  category: CategoryRow,
  series: SeriesRow | null,
  status: TopicStatus,
  now: string,
  currentTopic?: TopicRow | null,
) {
  return {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: payload.content,
    image: payload.image,
    image_alt: payload.imageAlt,
    category: category.name,
    category_slug: category.slug,
    category_id: category.id,
    series_id: series?.id ?? null,
    series: series?.name ?? payload.legacySeries,
    series_slug: series?.slug ?? payload.legacySeriesSlug,
    date_label: payload.dateLabel,
    status,
    seo_title: payload.seoTitle || null,
    seo_description: payload.seoDescription || null,
    seo_keywords: payload.seoKeywords,
    focus_keyword: payload.focusKeyword || null,
    faq: payload.faq,
    is_featured: payload.isFeatured,
    is_popular: payload.isPopular,
    published_at: resolveTopicPublishedAt({
      formPublishedDate: payload.publishedAt,
      currentPublishedAt: currentTopic?.published_at ?? null,
      status,
      nowIso: now,
    }),
    deleted_at: status === "archived" ? now : null,
    updated_at: now,
    content_type: "article" as const,
  };
}
