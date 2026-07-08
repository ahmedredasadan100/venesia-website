"use server";

import { requireAdminSession } from "../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../lib/admin/audit-log";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { revalidateTopicsCache } from "../../../lib/cache/revalidate-public-cache-tags";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { logError } from "../../../lib/logging";
import { parseFormPublishedDate, resolveTopicPublishedAt } from "../../../lib/content-dates";
import {
  resolveArticleTopicCategory,
  type ArticleTopicCategoryRecord,
} from "../../../lib/admin/article-topic-categories";
import {
  getTopicDraftValidationError,
  getTopicPublishOnlyValidationError,
  getTopicPublishValidationError,
  topicRowToPublishInput,
  validateSlugFormat,
  type TopicPublishInput,
} from "../../../lib/admin/content-workflow/topic-publish-validation";

const VALID_STATUSES = ["draft", "published", "unpublished", "archived"] as const;
type TopicStatus = (typeof VALID_STATUSES)[number];

type TopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  image_alt: string | null;
  category_slug: string | null;
  status: TopicStatus | string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  seo_keywords: string[] | null;
  faq: { question: string; answer: string }[] | null;
};

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id?: number | null;
  is_active?: boolean | null;
};

type SeriesRow = {
  id: number;
  name: string;
  slug: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getRedirectTo(formData: FormData, fallback = "/admin/topics") {
  const redirectTo = getString(formData, "redirect_to");
  return redirectTo.startsWith("/admin/topics") ? redirectTo : fallback;
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function validateId(id: string) {
  return /^\d+$/.test(id);
}

function redirectFormError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectEditError(id: string, message: string): never {
  redirectFormError(`/admin/topics/${id}`, message);
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

function createSlug(value: string) {
  return normalizeArabicForSlug(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function validateSlug(slug: string) {
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

async function uploadTopicImage(formData: FormData, slug: string) {
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

function getNormalizedStatus(value: string, fallback: TopicStatus = "draft") {
  return VALID_STATUSES.includes(value as TopicStatus)
    ? (value as TopicStatus)
    : fallback;
}

function getPayload(formData: FormData) {
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

function getDraftValidationError(payload: ReturnType<typeof getPayload>) {
  return getTopicDraftValidationError(payloadToPublishInput(payload));
}

function getPublishOnlyValidationError(payload: ReturnType<typeof getPayload>) {
  return getTopicPublishOnlyValidationError(payloadToPublishInput(payload));
}

function payloadToPublishInput(payload: ReturnType<typeof getPayload>): TopicPublishInput {
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

function getValidationError(
  payload: ReturnType<typeof getPayload>,
  mode: "save" | "publish" | "draft",
) {
  if (mode === "publish") return getPublishValidationError(payload);
  return getDraftValidationError(payload);
}

function getPublishValidationError(payload: ReturnType<typeof getPayload>) {
  return getTopicPublishValidationError(payloadToPublishInput(payload));
}

function preserveImage(nextValue: string, currentValue: string) {
  return nextValue.trim() || currentValue;
}

function preserveText(nextValue: string, currentValue: string) {
  return nextValue.trim() || currentValue;
}

function preservePayloadFromCurrent(
  payload: ReturnType<typeof getPayload>,
  currentTopic: TopicRow,
) {
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

export type BulkPublishValidationFailure = {
  id: number;
  title: string;
  reason: string;
};

export type BulkPublishValidationResult = {
  validIds: number[];
  failures: BulkPublishValidationFailure[];
};

export async function validateBulkTopicPublish(ids: number[]): Promise<BulkPublishValidationResult> {
  await requireAdminSession();

  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) {
    return { validIds: [], failures: [] };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category_slug, seo_title, seo_description, focus_keyword, faq",
    )
    .in("id", uniqueIds)
    .eq("content_type", "article")
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const foundIds = new Set(rows.map((row) => row.id));
  const failures: BulkPublishValidationFailure[] = [];
  const validIds: number[] = [];

  for (const id of uniqueIds) {
    if (!foundIds.has(id)) {
      failures.push({ id, title: `#${id}`, reason: "الموضوع غير موجود أو غير متاح." });
    }
  }

  for (const row of rows) {
    const validationError = getTopicPublishValidationError(topicRowToPublishInput(row));
    if (validationError) {
      failures.push({
        id: row.id,
        title: row.title?.trim() || `موضوع #${row.id}`,
        reason: validationError,
      });
    } else {
      validIds.push(row.id);
    }
  }

  return { validIds, failures };
}

async function getTopicById(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category_slug, status, published_at, seo_title, seo_description, focus_keyword, seo_keywords, faq"
    )
    .eq("id", id)
    .eq("content_type", "article")
    .maybeSingle<TopicRow>();

  if (error) {
    logError("getTopicById failed", error, { id });
    return null;
  }

  if (!data) return null;
  return data;
}

async function ensureUniqueSlug(slug: string, id?: string) {
  let query = getSupabaseAdmin().from("topics").select("id").eq("slug", slug).limit(1);

  if (id) {
    query = query.neq("id", id);
  }

  const { data, error } = await query.maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

async function loadActiveTopicCategoriesForValidation() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, is_active")
    .eq("is_active", true);

  if (error) {
    logError("loadActiveTopicCategoriesForValidation failed", error);
    return [] as ArticleTopicCategoryRecord[];
  }

  return (data ?? []) as ArticleTopicCategoryRecord[];
}

async function getCategory(categorySlug: string) {
  const categories = await loadActiveTopicCategoriesForValidation();
  const result = resolveArticleTopicCategory(categorySlug, categories);

  if (!result.ok) {
    logError("getCategory rejected article category", new Error(result.message), { categorySlug });
    return null;
  }

  return result.category;
}

async function getCategoryValidationError(categorySlug: string) {
  const categories = await loadActiveTopicCategoriesForValidation();
  const result = resolveArticleTopicCategory(categorySlug, categories);
  return result.ok ? null : result.message;
}

async function getSeries(seriesId: number | null) {
  if (!seriesId) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id, name, slug")
    .eq("id", seriesId)
    .maybeSingle<SeriesRow>();

  if (error) {
    logError("getSeries failed", error, { seriesId });
    return null;
  }

  if (!data) return null;
  return data;
}

function revalidateTopicPaths(options: {
  id?: string | number;
  oldSlug?: string | null;
  newSlug?: string | null;
}) {
  revalidateTopicsCache();
  revalidatePath("/topics");
  revalidatePath("/admin/topics");
  revalidatePath("/admin/topics/new");

  if (options.id) {
    revalidatePath(`/admin/topics/${options.id}`);
    revalidatePath(`/admin/topics/${options.id}/preview`);
  }

  if (options.oldSlug) revalidatePath(`/topics/${options.oldSlug}`);
  if (options.newSlug) revalidatePath(`/topics/${options.newSlug}`);
}

function buildTopicWritePayload(
  payload: ReturnType<typeof getPayload>,
  category: CategoryRow,
  series: SeriesRow | null,
  status: TopicStatus,
  now: string,
  currentTopic?: TopicRow | null
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

export async function createTopic(formData: FormData) {
  await requireAdminSession();
  const intent = getString(formData, "intent");
  const status: TopicStatus = intent === "publish" ? "published" : "draft";
  const payload = getPayload(formData);

  try {
    payload.image = await uploadTopicImage(formData, payload.slug);
  } catch (error) {
    redirectFormError("/admin/topics/new", error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  const validationError =
    status === "published" ? getPublishValidationError(payload) : getDraftValidationError(payload);

  if (validationError) redirectFormError("/admin/topics/new", validationError);

  const category = await getCategory(payload.categorySlug);
  if (!category) {
    const categoryError = await getCategoryValidationError(payload.categorySlug);
    redirectFormError("/admin/topics/new", categoryError ?? "التصنيف المختار غير موجود أو غير مفعل.");
  }

  const series = await getSeries(payload.seriesId);
  if (payload.seriesId && !series) redirectFormError("/admin/topics/new", "السلسلة المختارة غير موجودة.");

  const isUniqueSlug = await ensureUniqueSlug(payload.slug);
  if (!isUniqueSlug) redirectFormError("/admin/topics/new", "هذا الـ Slug مستخدم بالفعل في موضوع آخر.");

  const now = new Date().toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .insert({
      ...buildTopicWritePayload(payload, category, series, status, now, null),
      created_at: now,
    })
    .select("id, slug")
    .single<{ id: number; slug: string }>();

  if (error || !data) {
    redirectFormError("/admin/topics/new", error?.message || "تعذر إنشاء الموضوع. راجع قاعدة البيانات.");
  }

  revalidateTopicPaths({ id: data.id, newSlug: data.slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", status === "published" ? "publish" : "create"),
    entityType: "topic",
    entityId: data.id,
    entityLabel: payload.title,
    metadata: { slug: data.slug, status },
  });
  redirect(`/admin/topics/${data.id}?notice=${status === "published" ? "published" : "created"}`);
}

async function updateTopicWithStatus(
  formData: FormData,
  nextStatus: TopicStatus,
  notice: string,
  options: { redirectToList?: boolean; validationMode?: "save" | "publish" | "draft" } = {},
) {
  const { redirectToList = false, validationMode = "save" } = options;
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/topics?notice=error");

  const currentTopic = await getTopicById(id);
  if (!currentTopic) redirect("/admin/topics?notice=error");

  const payload = getPayload(formData);

  try {
    payload.image = await uploadTopicImage(formData, payload.slug);
  } catch (error) {
    redirectEditError(id, error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  payload.image = preserveImage(payload.image, String(currentTopic.image ?? ""));

  const currentStatus = getNormalizedStatus(String(currentTopic.status ?? "draft"), "draft");

  if (validationMode === "publish") {
    const saveError = getValidationError(payload, "save");
    if (saveError) redirectEditError(id, saveError);

    const publishError = getPublishOnlyValidationError(payload);

    const isUniqueSlug = await ensureUniqueSlug(payload.slug, id);
    if (!isUniqueSlug) redirectEditError(id, "هذا الـ Slug مستخدم بالفعل في موضوع آخر.");

    const category = await getCategory(payload.categorySlug);
    if (!category) {
      const categoryError = await getCategoryValidationError(payload.categorySlug);
      redirectEditError(id, categoryError ?? "التصنيف المختار غير موجود أو غير مفعل.");
    }

    const series = await getSeries(payload.seriesId);
    if (payload.seriesId && !series) redirectEditError(id, "السلسلة المختارة غير موجودة.");

    const writePayload = publishError
      ? preservePayloadFromCurrent({ ...payload, faq: [...payload.faq], seoKeywords: [...payload.seoKeywords] }, currentTopic)
      : payload;

    const now = new Date().toISOString();
    const statusToWrite = publishError ? currentStatus : nextStatus;
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update(buildTopicWritePayload(writePayload, category, series, statusToWrite, now, currentTopic))
      .eq("id", id);

    if (error) redirectEditError(id, error.message);

    revalidateTopicPaths({ id, oldSlug: currentTopic.slug, newSlug: payload.slug });

    if (publishError) redirectEditError(id, publishError);

    await recordCmsAdminAudit({
      action: buildCmsAuditAction(
        "topic",
        statusToWrite === "published" ? "publish" : statusToWrite === "unpublished" ? "unpublish" : "update",
      ),
      entityType: "topic",
      entityId: Number(id),
      entityLabel: payload.title,
      metadata: { slug: payload.slug, status: statusToWrite },
    });

    redirect(redirectToList ? `/admin/topics?notice=${notice}` : `/admin/topics/${id}?notice=${notice}`);
  }

  payload.imageAlt = preserveText(payload.imageAlt, String(currentTopic.image_alt ?? ""));

  const validationError = getValidationError(payload, validationMode);

  if (validationError) redirectEditError(id, validationError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id);
  if (!isUniqueSlug) redirectEditError(id, "هذا الـ Slug مستخدم بالفعل في موضوع آخر.");

  const category = await getCategory(payload.categorySlug);
  if (!category) {
    const categoryError = await getCategoryValidationError(payload.categorySlug);
    redirectEditError(id, categoryError ?? "التصنيف المختار غير موجود أو غير مفعل.");
  }

  const series = await getSeries(payload.seriesId);
  if (payload.seriesId && !series) redirectEditError(id, "السلسلة المختارة غير موجودة.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update(buildTopicWritePayload(payload, category, series, nextStatus, now, currentTopic))
    .eq("id", id);

  if (error) redirectEditError(id, error.message);

  revalidateTopicPaths({ id, oldSlug: currentTopic.slug, newSlug: payload.slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "topic",
      nextStatus === "published" ? "publish" : nextStatus === "unpublished" ? "unpublish" : "update",
    ),
    entityType: "topic",
    entityId: Number(id),
    entityLabel: payload.title,
    metadata: { slug: payload.slug, status: nextStatus },
  });
  redirect(redirectToList ? `/admin/topics?notice=${notice}` : `/admin/topics/${id}?notice=${notice}`);
}

export async function saveTopic(formData: FormData) {
  await requireAdminSession();
  const status = getNormalizedStatus(getString(formData, "status"), "draft");
  await updateTopicWithStatus(formData, status, "saved", { validationMode: "save" });
}

export async function saveTopicAndClose(formData: FormData) {
  await requireAdminSession();
  const status = getNormalizedStatus(getString(formData, "status"), "draft");
  await updateTopicWithStatus(formData, status, "saved", { redirectToList: true, validationMode: "save" });
}

export async function saveDraftTopic(formData: FormData) {
  await requireAdminSession();
  await updateTopicWithStatus(formData, "draft", "draft", { validationMode: "draft" });
}

async function setTopicStatusFromList(formData: FormData, nextStatus: TopicStatus, notice: string) {
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/topics?notice=error");

  const topic = await getTopicById(id);
  if (!topic) redirect("/admin/topics?notice=error");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: nextStatus,
      published_at: nextStatus === "published" ? topic.published_at || now : topic.published_at,
      updated_at: now,
    })
    .eq("id", id);

  if (error) redirectEditError(id, error.message);

  revalidateTopicPaths({ id, oldSlug: topic.slug, newSlug: topic.slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "topic",
    entityId: Number(id),
    entityLabel: topic.title,
    metadata: { status: nextStatus },
  });
  const redirectTo = getRedirectTo(formData);
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=${notice}#topics-table`);
}

export async function publishTopic(formData: FormData) {
  await requireAdminSession();
  if (getString(formData, "title")) {
    await updateTopicWithStatus(formData, "published", "published", { validationMode: "publish" });
  }

  await setTopicStatusFromList(formData, "published", "published");
}

export async function unpublishTopic(formData: FormData) {
  await requireAdminSession();
  if (getString(formData, "title")) {
    await updateTopicWithStatus(formData, "unpublished", "unpublished", { validationMode: "save" });
  }

  await setTopicStatusFromList(formData, "unpublished", "unpublished");
}

export async function softDeleteTopic(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/topics?notice=error");

  const topic = await getTopicById(id);
  if (!topic) redirect("/admin/topics?notice=error");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({ status: "archived", deleted_at: now, updated_at: now })
    .eq("id", id);

  if (error) redirectEditError(id, error.message);

  revalidateTopicPaths({ id, oldSlug: topic.slug, newSlug: topic.slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", "delete"),
    entityType: "topic",
    entityId: Number(id),
    entityLabel: topic.title,
  });
  const redirectTo = getRedirectTo(formData);
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=deleted#topics-table`);
}

function appendNotice(path: string, notice: string) {
  const [baseWithQuery, hash = ""] = path.split("#");
  const joiner = baseWithQuery.includes("?") ? "&" : "?";
  return `${baseWithQuery}${joiner}notice=${notice}${hash ? `#${hash}` : "#topics-table"}`;
}

async function getTopicForDuplicate(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("title, slug, excerpt, content, image, image_alt, category, category_slug, category_id, series_id, series, series_slug, date_label, seo_title, seo_description, seo_keywords, focus_keyword, faq, is_featured, is_popular")
    .eq("id", id)
    .eq("content_type", "article")
    .maybeSingle<Record<string, unknown>>();

  if (error || !data) return null;
  return data;
}

export async function duplicateTopic(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  const redirectTo = getRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendNotice(redirectTo, "error"));

  const original = await getTopicForDuplicate(id);
  if (!original) redirect(appendNotice(redirectTo, "error"));

  const title = getString(formData, "title");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);
  const status = getNormalizedStatus(getString(formData, "status"), "unpublished");
  const categoryChoice = getString(formData, "category_slug");

  if (!title) redirect(appendNotice(redirectTo, "error"));
  if (!slug || !validateSlug(slug)) redirect(appendNotice(redirectTo, "error"));

  const isUniqueSlug = await ensureUniqueSlug(slug);
  if (!isUniqueSlug) redirect(appendNotice(redirectTo, "error"));

  let categoryName = original.category as string | null;
  let categorySlug = original.category_slug as string | null;
  let categoryId = original.category_id as number | null;

  if (categoryChoice === "__none") {
    categoryName = null;
    categorySlug = null;
    categoryId = null;
  } else if (categoryChoice && categoryChoice !== "__same") {
    const category = await getCategory(categoryChoice);
    if (!category) {
      redirect(appendNotice(redirectTo, "error"));
    }
    categoryName = category.name;
    categorySlug = category.slug;
    categoryId = category.id;
  }

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("topics").insert({
    title,
    slug,
    excerpt: original.excerpt ?? "",
    content: original.content ?? "",
    image: original.image ?? "",
    image_alt: original.image_alt ?? "",
    category: categoryName,
    category_slug: categorySlug,
    category_id: categoryId,
    series_id: original.series_id ?? null,
    series: original.series ?? null,
    series_slug: original.series_slug ?? null,
    date_label: original.date_label ?? null,
    status,
    seo_title: original.seo_title ?? null,
    seo_description: original.seo_description ?? null,
    seo_keywords: original.seo_keywords ?? [],
    focus_keyword: original.focus_keyword ?? null,
    faq: original.faq ?? [],
    is_featured: original.is_featured ?? false,
    is_popular: original.is_popular ?? false,
    published_at: status === "published" ? now : null,
    deleted_at: null,
    content_type: "article",
    created_at: now,
    updated_at: now,
  });

  if (error) redirect(appendNotice(redirectTo, "error"));

  revalidateTopicPaths({ newSlug: slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", "duplicate"),
    entityType: "topic",
    entityLabel: title,
    metadata: { slug, source_topic_id: Number(id) },
  });
  redirect(appendNotice(redirectTo, "created"));
}

export async function bulkUpdateTopics(formData: FormData) {
  await requireAdminSession();
  const ids = formData
    .getAll("topic_ids")
    .map(String)
    .filter(validateId)
    .map(Number);
  const bulkAction = getString(formData, "bulk_action");
  const redirectTo = getRedirectTo(formData);

  if (ids.length === 0) redirect(appendNotice(redirectTo, "error"));

  const now = new Date().toISOString();
  let errorMessage: string | null = null;

  if (bulkAction === "publish") {
    const validation = await validateBulkTopicPublish(ids);
    if (!validation.validIds.length) {
      redirect(
        `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=error&bulk_error=${encodeURIComponent("لا يمكن نشر أي موضوع من التحديد — راجع قائمة الجاهزية لكل موضوع.")}#topics-table`,
      );
    }

    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "published", updated_at: now })
      .in("id", validation.validIds);
    errorMessage = error?.message ?? null;

    if (!errorMessage && validation.failures.length > 0) {
      redirect(
        `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=published&bulk_partial=${validation.validIds.length}&bulk_skipped=${validation.failures.length}#topics-table`,
      );
    }
  } else if (bulkAction === "unpublish") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "unpublished", updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "archive") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "archived", updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "delete") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "archived", deleted_at: now, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "feature") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ is_featured: true, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "unfeature") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ is_featured: false, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "move_category") {
    const categorySlug = getString(formData, "category_slug");
    const category = categorySlug ? await getCategory(categorySlug) : null;
    if (!category) {
      redirect(appendNotice(redirectTo, "error"));
    }

    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({
        category: category.name,
        category_slug: category.slug,
        category_id: category.id,
        updated_at: now,
      })
      .in("id", ids)
      .eq("content_type", "article");
    errorMessage = error?.message ?? null;
  } else {
    redirect(appendNotice(redirectTo, "error"));
  }

  if (errorMessage) redirect(appendNotice(redirectTo, "error"));

  revalidateTopicsCache();
  revalidatePath("/admin/topics");
  revalidatePath("/topics");
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", bulkAction === "publish" ? "publish" : bulkAction === "unpublish" ? "unpublish" : "update"),
    entityType: "topic",
    metadata: { bulk_action: bulkAction, topic_ids: ids, count: ids.length },
  });
  redirect(appendNotice(redirectTo, "saved"));
}
