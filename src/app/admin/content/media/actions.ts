"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import {
  revalidateMediaCenterCache,
  revalidateTopicsCache,
} from "../../../../lib/cache/revalidate-public-cache-tags";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  assertPayloadMatchesContentType,
  normalizeVideoPayloadForStorage,
  parseMediaPayloadFromForm,
  resolveCoverImageForGallery,
  resolveCoverImageForVideo,
  validateGalleryPayload,
  validateVideoPayload,
  type GalleryMediaPayload,
  type MediaTopicPayload,
  type VideoMediaPayload,
} from "../../../../lib/admin/media-topic-payload";
import { resolveTopicPublishedAt } from "../../../../lib/content-dates";
import { logError } from "../../../../lib/logging";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  ALLOWED_MEDIA_SECTION_SLUGS,
  getContentTypeForSectionSlug,
  isMediaEditableContentType,
  MEDIA_CONTENT_TYPE_ERROR,
  MEDIA_EDITABLE_CONTENT_TYPES,
  MEDIA_LIST_CONTENT_TYPES,
  MEDIA_SECTION_ERROR,
  type MediaEditableContentType,
} from "./media-content-config";

const VALID_STATUSES = ["draft", "published", "unpublished", "archived"] as const;
type MediaStatus = (typeof VALID_STATUSES)[number];

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  is_active: boolean | null;
};

type MediaTopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  category_slug: string | null;
  content_type: string | null;
  status: MediaStatus | string | null;
  is_featured: boolean | null;
  published_at: string | null;
  media_payload: MediaTopicPayload | null;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
  redirectFormError(`/admin/content/media/${id}`, message);
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
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function getNormalizedStatus(value: string, fallback: MediaStatus = "draft"): MediaStatus {
  return VALID_STATUSES.includes(value as MediaStatus) ? (value as MediaStatus) : fallback;
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
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

async function uploadMediaImage(formData: FormData, slug: string) {
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

  const safeSlug = slug || "media";
  const fileName = `${safeSlug}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const publicDir = path.join(process.cwd(), "public", "images", "topics");
  const filePath = path.join(publicDir, fileName);

  await mkdir(publicDir, { recursive: true });
  const buffer = Buffer.from(await imageFile.arrayBuffer());
  await writeFile(filePath, buffer);

  return `/images/topics/${fileName}`;
}

function getPayload(formData: FormData) {
  const title = getString(formData, "title");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);

  return {
    title,
    slug,
    excerpt: getString(formData, "excerpt"),
    content: getString(formData, "content"),
    image: getString(formData, "image"),
    categorySlug: getString(formData, "category_slug"),
    status: getNormalizedStatus(getString(formData, "status"), "draft"),
    isFeatured: getBoolean(formData, "is_featured"),
  };
}

function getValidationError(payload: ReturnType<typeof getPayload>) {
  if (!payload.title) return "العنوان مطلوب.";
  if (!payload.slug) return "الرابط مطلوب.";
  if (!validateSlug(payload.slug)) {
    return "الـ Slug لازم يكون إنجليزي صغير، أرقام، وشرطة بين الكلمات فقط.";
  }
  if (!payload.categorySlug) return "قسم المركز الإعلامي مطلوب.";
  return null;
}

function resolveWriteMediaPayload(
  contentType: MediaEditableContentType,
  formData: FormData,
  payload: ReturnType<typeof getPayload>,
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

function getPublishedValidationError(
  contentType: MediaEditableContentType,
  mediaPayload: MediaTopicPayload | null,
  status: MediaStatus,
) {
  if (status !== "published") return null;

  if (contentType === "video" && mediaPayload?.kind === "video") {
    return validateVideoPayload(mediaPayload as VideoMediaPayload, { published: true });
  }

  if (contentType === "gallery" && mediaPayload?.kind === "gallery") {
    return validateGalleryPayload(mediaPayload as GalleryMediaPayload, { published: true });
  }

  return null;
}

function getMediaPublishValidationError(
  contentType: MediaEditableContentType,
  mediaPayload: MediaTopicPayload | null,
): string | null {
  const matchError = assertPayloadMatchesContentType(contentType, mediaPayload);
  if (matchError) return matchError;

  return getPublishedValidationError(contentType, mediaPayload, "published");
}

async function assertMediaTopicsCanPublish(ids: number[], redirectTo: string): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id, content_type, media_payload")
    .in("id", ids)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error || !data || data.length !== ids.length) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  for (const topic of data) {
    if (!isMediaEditableContentType(topic.content_type)) {
      redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
    }

    const validationError = getMediaPublishValidationError(topic.content_type, topic.media_payload);
    if (validationError) {
      redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
    }
  }
}

async function resolveMediaSection(categorySlug: string) {
  const trimmedSlug = categorySlug.trim();

  if (!ALLOWED_MEDIA_SECTION_SLUGS.includes(trimmedSlug as (typeof ALLOWED_MEDIA_SECTION_SLUGS)[number])) {
    return { ok: false as const, message: MEDIA_SECTION_ERROR };
  }

  const contentType = getContentTypeForSectionSlug(trimmedSlug);
  if (!contentType) {
    return { ok: false as const, message: MEDIA_SECTION_ERROR };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, is_active")
    .eq("slug", trimmedSlug)
    .eq("is_active", true)
    .maybeSingle<CategoryRow>();

  if (error) {
    logError("resolveMediaSection failed", error, { categorySlug: trimmedSlug });
    return { ok: false as const, message: "تعذر التحقق من القسم المختار." };
  }

  if (!data) {
    return { ok: false as const, message: "القسم المختار غير موجود أو غير مفعل." };
  }

  if (data.slug === "media-center" || data.parent_id === null) {
    return { ok: false as const, message: MEDIA_SECTION_ERROR };
  }

  const { data: parent } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("slug")
    .eq("id", data.parent_id)
    .maybeSingle<{ slug: string }>();

  if (parent?.slug !== "media-center") {
    return { ok: false as const, message: MEDIA_SECTION_ERROR };
  }

  return {
    ok: true as const,
    category: { id: data.id, name: data.name, slug: data.slug },
    contentType,
  };
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

async function getEditableMediaTopicById(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, category_slug, content_type, status, is_featured, published_at, media_payload",
    )
    .eq("id", id)
    .in("content_type", [...MEDIA_EDITABLE_CONTENT_TYPES])
    .is("deleted_at", null)
    .maybeSingle<MediaTopicRow>();

  if (error) {
    logError("getEditableMediaTopicById failed", error, { id });
    return null;
  }

  if (!data || !isMediaEditableContentType(data.content_type)) return null;
  return data;
}

function revalidateMediaContentPaths(id?: string | number) {
  revalidateTopicsCache();
  revalidateMediaCenterCache();
  revalidatePath("/admin/content/media");
  revalidatePath("/admin/content/media/new");
  revalidatePath("/admin/topics/categories");

  if (id) {
    revalidatePath(`/admin/content/media/${id}`);
  }
}

function buildMediaWritePayload(
  payload: ReturnType<typeof getPayload>,
  category: { id: number; name: string; slug: string },
  contentType: MediaEditableContentType,
  mediaPayload: MediaTopicPayload | null,
  now: string,
  currentTopic?: MediaTopicRow | null,
) {
  const isRichMedia = contentType === "video" || contentType === "gallery";

  return {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: isRichMedia ? "" : payload.content,
    image: payload.image,
    image_alt: null,
    media_payload: mediaPayload,
    category: category.name,
    category_slug: category.slug,
    category_id: category.id,
    content_type: contentType,
    series_id: null,
    series: null,
    series_slug: null,
    date_label: null,
    status: payload.status,
    seo_title: null,
    seo_description: null,
    seo_keywords: [],
    focus_keyword: null,
    faq: [],
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

export async function createMediaContent(formData: FormData) {
  await requireAdminSession();
  const payload = getPayload(formData);

  try {
    payload.image = await uploadMediaImage(formData, payload.slug);
  } catch (error) {
    redirectFormError("/admin/content/media/new", error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  const validationError = getValidationError(payload);
  if (validationError) redirectFormError("/admin/content/media/new", validationError);

  const section = await resolveMediaSection(payload.categorySlug);
  if (!section.ok) redirectFormError("/admin/content/media/new", section.message);

  if (!isMediaEditableContentType(section.contentType)) {
    redirectFormError("/admin/content/media/new", MEDIA_CONTENT_TYPE_ERROR);
  }

  const writePayload = resolveWriteMediaPayload(section.contentType, formData, payload);
  if (!writePayload.ok) redirectFormError("/admin/content/media/new", writePayload.message);

  const publishError = getPublishedValidationError(
    section.contentType,
    writePayload.mediaPayload,
    payload.status,
  );
  if (publishError) redirectFormError("/admin/content/media/new", publishError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug);
  if (!isUniqueSlug) redirectFormError("/admin/content/media/new", "هذا الـ Slug مستخدم بالفعل في محتوى آخر.");

  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .insert({
      ...buildMediaWritePayload(
        payload,
        section.category,
        section.contentType,
        writePayload.mediaPayload,
        now,
        null,
      ),
      created_at: now,
    })
    .select("id")
    .single<{ id: number }>();

  if (error || !data) {
    redirectFormError("/admin/content/media/new", error?.message || "تعذر إنشاء المحتوى.");
  }

  revalidateMediaContentPaths(data.id);
  redirect(`/admin/content/media/${data.id}?notice=created`);
}

export async function updateMediaContent(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/content/media?notice=error");

  const currentTopic = await getEditableMediaTopicById(id);
  if (!currentTopic) redirect("/admin/content/media?notice=error");

  const payload = getPayload(formData);

  try {
    payload.image = await uploadMediaImage(formData, payload.slug);
  } catch (error) {
    redirectEditError(id, error instanceof Error ? error.message : "تعذر رفع الصورة.");
  }

  if (!payload.image.trim()) {
    payload.image = String(currentTopic.image ?? "");
  }

  const validationError = getValidationError(payload);
  if (validationError) redirectEditError(id, validationError);

  const section = await resolveMediaSection(payload.categorySlug);
  if (!section.ok) redirectEditError(id, section.message);

  if (!isMediaEditableContentType(section.contentType)) {
    redirectEditError(id, MEDIA_CONTENT_TYPE_ERROR);
  }

  const writePayload = resolveWriteMediaPayload(section.contentType, formData, payload);
  if (!writePayload.ok) redirectEditError(id, writePayload.message);

  const publishError = getPublishedValidationError(
    section.contentType,
    writePayload.mediaPayload,
    payload.status,
  );
  if (publishError) redirectEditError(id, publishError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id);
  if (!isUniqueSlug) redirectEditError(id, "هذا الـ Slug مستخدم بالفعل في محتوى آخر.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update(
      buildMediaWritePayload(
        payload,
        section.category,
        section.contentType,
        writePayload.mediaPayload,
        now,
        currentTopic,
      ),
    )
    .eq("id", id)
    .in("content_type", [...MEDIA_EDITABLE_CONTENT_TYPES]);

  if (error) redirectEditError(id, error.message);

  revalidateMediaContentPaths(id);
  redirect(`/admin/content/media/${id}?notice=saved`);
}

function getMediaRedirectTo(formData: FormData) {
  const value = getString(formData, "redirect_to");
  return value.startsWith("/admin/content/media") ? value : "/admin/content/media";
}

function appendMediaListNotice(path: string, notice: string, hash = "") {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("notice", notice);
  const query = params.toString();
  const base = query ? `${pathname}?${query}` : `${pathname}?notice=${notice}`;
  return hash ? `${base}#${hash}` : base;
}

async function getMediaTopicForDuplicate(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "title, slug, excerpt, content, image, category, category_slug, category_id, content_type, media_payload, is_featured, published_at",
    )
    .eq("id", id)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null)
    .maybeSingle<MediaTopicRow>();

  if (error) {
    logError("getMediaTopicForDuplicate failed", error, { id });
    return null;
  }

  if (!data || !isMediaEditableContentType(data.content_type)) return null;
  return data;
}

async function resolveDuplicateMediaCategory(
  original: MediaTopicRow,
  categoryChoice: string,
): Promise<
  | { ok: true; category: { id: number; name: string; slug: string }; contentType: MediaEditableContentType }
  | { ok: false }
> {
  if (categoryChoice === "__same" || !categoryChoice) {
    if (!original.category_slug || !isMediaEditableContentType(original.content_type)) {
      return { ok: false };
    }

    const section = await resolveMediaSection(original.category_slug);
    if (!section.ok || section.contentType !== original.content_type) {
      return { ok: false };
    }

    return { ok: true, category: section.category, contentType: section.contentType };
  }

  const section = await resolveMediaSection(categoryChoice);
  if (!section.ok || section.contentType !== original.content_type) {
    return { ok: false };
  }

  return { ok: true, category: section.category, contentType: section.contentType };
}

export async function publishMediaContent(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const redirectTo = getMediaRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendMediaListNotice("/admin/content/media", "error", "media-table"));

  const topic = await getEditableMediaTopicById(id);
  if (!topic) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  if (!isMediaEditableContentType(topic.content_type)) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  const publishError = getMediaPublishValidationError(topic.content_type, topic.media_payload);
  if (publishError) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: "published",
      published_at: topic.published_at || now,
      updated_at: now,
    })
    .eq("id", id)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  revalidateMediaContentPaths(id);
  redirect(appendMediaListNotice(redirectTo, "published", "media-table"));
}

export async function unpublishMediaContent(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const redirectTo = getMediaRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendMediaListNotice("/admin/content/media", "error", "media-table"));

  const topic = await getEditableMediaTopicById(id);
  if (!topic) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: "unpublished",
      updated_at: now,
    })
    .eq("id", id)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  revalidateMediaContentPaths(id);
  redirect(appendMediaListNotice(redirectTo, "unpublished", "media-table"));
}

export async function archiveMediaContent(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const redirectTo = getMediaRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendMediaListNotice("/admin/content/media", "error", "media-table"));

  const topic = await getEditableMediaTopicById(id);
  if (!topic) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: "archived",
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  revalidateMediaContentPaths(id);
  redirect(appendMediaListNotice(redirectTo, "deleted", "media-table"));
}

export async function duplicateMediaContent(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const redirectTo = getMediaRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const original = await getMediaTopicForDuplicate(id);
  if (!original || !isMediaEditableContentType(original.content_type)) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  const title = getString(formData, "title");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);
  const status = getNormalizedStatus(getString(formData, "status"), "unpublished");
  const categoryChoice = getString(formData, "category_slug");

  if (!title) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  if (!slug || !validateSlug(slug)) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const isUniqueSlug = await ensureUniqueSlug(slug);
  if (!isUniqueSlug) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const resolvedCategory = await resolveDuplicateMediaCategory(original, categoryChoice);
  if (!resolvedCategory.ok) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const { category, contentType } = resolvedCategory;
  const isRichMedia = contentType === "video" || contentType === "gallery";
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .insert({
      title,
      slug,
      excerpt: original.excerpt ?? "",
      content: isRichMedia ? "" : (original.content ?? ""),
      image: original.image ?? "",
      image_alt: null,
      media_payload: original.media_payload,
      category: category.name,
      category_slug: category.slug,
      category_id: category.id,
      content_type: contentType,
      series_id: null,
      series: null,
      series_slug: null,
      date_label: null,
      status,
      seo_title: null,
      seo_description: null,
      seo_keywords: [],
      focus_keyword: null,
      faq: [],
      is_featured: original.is_featured ?? false,
      is_popular: false,
      published_at: status === "published" ? now : null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single<{ id: number }>();

  if (error) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  revalidateMediaContentPaths();
  redirect(appendMediaListNotice(redirectTo, "created", "media-table"));
}

export async function bulkUpdateMediaContent(formData: FormData) {
  await requireAdminSession();

  const ids = formData
    .getAll("media_ids")
    .map(String)
    .filter(validateId)
    .map(Number);
  const bulkAction = getString(formData, "bulk_action");
  const redirectTo = getMediaRedirectTo(formData);

  if (ids.length === 0) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  const now = new Date().toISOString();
  let errorMessage: string | null = null;

  if (bulkAction === "publish") {
    await assertMediaTopicsCanPublish(ids, redirectTo);

    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "published", updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "unpublish") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "unpublished", updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "archive") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "archived", deleted_at: now, updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "feature") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ is_featured: true, updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "unfeature") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ is_featured: false, updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  if (errorMessage) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  revalidateTopicsCache();
  revalidateMediaCenterCache();
  revalidatePath("/admin/content/media");
  redirect(appendMediaListNotice(redirectTo, "saved", "media-table"));
}
