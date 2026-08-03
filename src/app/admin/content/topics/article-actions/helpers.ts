import { redirect } from "next/navigation";
import { parseFormPublishedDate, resolveTopicPublishedAt } from "../../../../../lib/content-dates";
import {
  readEntitySeoFormData,
  toEntitySeoPersistence,
} from "../../../../../lib/seo/entity-seo-types";
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

function getDateLabel(formData: FormData) {
  const label = getString(formData, "date_label");
  return label || null;
}

export async function uploadTopicImage(formData: FormData, _slug: string) {
  void _slug;
  const imageFile = getFile(formData, "image_file");
  const currentImage = getString(formData, "image");
  if (imageFile) {
    throw new Error("الرفع المباشر من نموذج الموضوع متوقف. استخدم مكتبة الصور المشتركة.");
  }
  return currentImage;
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
  const seo = readEntitySeoFormData(formData);

  return {
    title,
    slug,
    excerpt: getString(formData, "excerpt"),
    content: getString(formData, "content"),
    image: getString(formData, "image"),
    imageFieldPresent: formData.has("image"),
    imageAlt: getString(formData, "image_alt"),
    categorySlug: getString(formData, "category_slug"),
    seriesId: seriesId && validateId(seriesId) ? Number(seriesId) : null,
    legacySeries: legacySeries || null,
    legacySeriesSlug: legacySeriesSlug ? createSlug(legacySeriesSlug) : null,
    dateLabel: getDateLabel(formData),
    publishedAt: parseFormPublishedDate(formData),
    ...seo,
    faq: getFaq(formData),
    faqEditorPresent: getBoolean(formData, "faq_editor_present"),
    isFeatured: getBoolean(formData, "is_featured"),
    isPopular: getBoolean(formData, "is_popular"),
    showTitleOnPage: getBoolean(formData, "show_title_on_page"),
    showImageOnPage: getBoolean(formData, "show_image_on_page"),
    showExcerptOnPage: getBoolean(formData, "show_excerpt_on_page"),
    showFaqOnPage: getBoolean(formData, "show_faq_on_page"),
    showFaqTitleOnPage: getBoolean(formData, "show_faq_title_on_page"),
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

export function preserveImage(nextValue: string, currentValue: string, imageFieldPresent: boolean) {
  const normalized = nextValue.trim();
  return imageFieldPresent ? normalized : normalized || currentValue;
}

export function preserveText(nextValue: string, currentValue: string) {
  return nextValue.trim() || currentValue;
}

export function preservePayloadFromCurrent(payload: TopicPayload, currentTopic: TopicRow) {
  payload.image = preserveImage(
    payload.image,
    String(currentTopic.image ?? ""),
    payload.imageFieldPresent,
  );
  payload.imageAlt = preserveText(payload.imageAlt, String(currentTopic.image_alt ?? ""));
  if (!payload.excerpt.trim()) {
    payload.excerpt = String(currentTopic.excerpt ?? "");
  }

  if (!payload.content.trim()) {
    payload.content = String(currentTopic.content ?? "");
  }

  if (!payload.faqEditorPresent && !payload.faq.length && Array.isArray(currentTopic.faq)) {
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
  const seo = toEntitySeoPersistence(payload);
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
    ...seo,
    faq: payload.faq,
    is_featured: payload.isFeatured,
    is_popular: payload.isPopular,
    show_title_on_page: payload.showTitleOnPage,
    show_image_on_page: payload.showImageOnPage,
    show_excerpt_on_page: payload.showExcerptOnPage,
    show_faq_on_page: payload.showFaqOnPage,
    show_faq_title_on_page: payload.showFaqTitleOnPage,
    published_at: resolveTopicPublishedAt({
      formPublishedDate: payload.publishedAt,
      currentPublishedAt: currentTopic?.published_at ?? null,
      status,
      nowIso: now,
    }),
    deleted_at: currentTopic?.deleted_at ?? null,
    updated_at: now,
    content_type: "article" as const,
  };
}
