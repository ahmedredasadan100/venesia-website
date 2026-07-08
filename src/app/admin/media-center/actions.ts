"use server";

import { requireAdminSession } from "../../../lib/admin/auth/require-admin-session";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateMediaCenterCache } from "../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { revalidateMediaCenterPublicPaths } from "../../../lib/media-center/revalidate-public-paths";
import { getMediaAdminPath, getPublicMediaPath, isMediaAdminType, type MediaAdminType } from "./_components/media-admin-config";

const VALID_STATUSES = ["draft", "published", "unpublished", "archived"] as const;
type MediaStatus = (typeof VALID_STATUSES)[number];

type CategoryRow = {
  name: string;
  slug: string;
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

function normalizeArabicForSlug(value: string) {
  const map: Record<string, string> = {
    ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w", ي: "y", ى: "a", ة: "h", ء: "", ئ: "e", ؤ: "o",
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

function getNormalizedStatus(value: string, fallback: MediaStatus = "draft") {
  return VALID_STATUSES.includes(value as MediaStatus) ? (value as MediaStatus) : fallback;
}

function getKeywords(formData: FormData) {
  return getString(formData, "seo_keywords")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getContentBlocks(formData: FormData) {
  const content = getString(formData, "content");
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean);
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
  const publicDir = path.join(process.cwd(), "public", "images", "media-center");
  const filePath = path.join(publicDir, fileName);

  await mkdir(publicDir, { recursive: true });
  const buffer = Buffer.from(await imageFile.arrayBuffer());
  await writeFile(filePath, buffer);

  return `/images/media-center/${fileName}`;
}

async function getCategory(categorySlug: string): Promise<CategoryRow | null> {
  if (!categorySlug) return null;

  const { data } = await getSupabaseAdmin()
    .from("media_categories")
    .select("name, slug")
    .eq("slug", categorySlug)
    .maybeSingle();

  return data as CategoryRow | null;
}

function getMediaType(formData: FormData) {
  const type = getString(formData, "type");
  return isMediaAdminType(type) ? type : null;
}

function getPublishedDate(formData: FormData) {
  const value = getString(formData, "published_at");
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

function getPayload(formData: FormData, fallbackStatus: MediaStatus = "draft") {
  const title = getString(formData, "title");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);

  return {
    type: getMediaType(formData),
    title,
    slug,
    excerpt: getString(formData, "excerpt"),
    content: getContentBlocks(formData),
    image: getString(formData, "image"),
    imageAlt: getString(formData, "image_alt"),
    categorySlug: getString(formData, "category_slug"),
    project: getString(formData, "project") || null,
    duration: getString(formData, "duration") || null,
    dateLabel: getString(formData, "date_label") || null,
    publishedAt: getPublishedDate(formData),
    status: getNormalizedStatus(getString(formData, "status"), fallbackStatus),
    isFeatured: getBoolean(formData, "is_featured"),
    isPopular: getBoolean(formData, "is_popular"),
    seoTitle: getString(formData, "seo_title"),
    seoDescription: getString(formData, "seo_description"),
    seoKeywords: getKeywords(formData),
    focusKeyword: getString(formData, "focus_keyword"),
    ogImage: getString(formData, "og_image"),
    schemaType: getString(formData, "schema_type") || "Article",
  };
}

function getValidationError(payload: ReturnType<typeof getPayload>, mode: "draft" | "publish") {
  if (!payload.type) return "نوع المحتوى مطلوب.";
  if (!payload.title) return "العنوان مطلوب.";
  if (!payload.slug) return "الرابط مطلوب.";
  if (!validateSlug(payload.slug)) return "الرابط يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطة بين الكلمات فقط.";
  if (!payload.categorySlug) return "التصنيف مطلوب.";

  if (mode === "publish") {
    if (!payload.excerpt || payload.excerpt.length < 20) return "الوصف المختصر يجب ألا يقل عن 20 حرفًا قبل النشر.";
    if (!payload.image) return "الصورة الرئيسية مطلوبة قبل النشر.";
  }

  return null;
}

function revalidateMedia(type: MediaAdminType, slug?: string | null) {
  revalidateMediaCenterCache();
  revalidatePath("/admin/media-center");
  revalidatePath(getMediaAdminPath(type));
  revalidateMediaCenterPublicPaths();
  revalidatePath(getPublicMediaPath(type));
  if (slug) revalidatePath(getPublicMediaPath(type, slug));
}

async function buildDbPayload(formData: FormData, status: MediaStatus) {
  const payload = getPayload(formData, status);
  const validationError = getValidationError(payload, status === "published" ? "publish" : "draft");

  if (validationError) throw new Error(validationError);
  if (!payload.type) throw new Error("نوع المحتوى غير صحيح.");

  const category = await getCategory(payload.categorySlug);
  if (!category) throw new Error("التصنيف المحدد غير موجود في قاعدة البيانات.");

  const image = await uploadMediaImage(formData, payload.slug);

  return {
    type: payload.type,
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: payload.content,
    image: image || "/images/venesia-5.png",
    image_alt: payload.imageAlt || payload.title,
    category: category.name,
    category_slug: category.slug,
    project: payload.project,
    duration: payload.duration,
    date_label: payload.dateLabel,
    published_at: payload.publishedAt,
    status,
    is_featured: payload.isFeatured,
    is_popular: payload.isPopular,
    seo_title: payload.seoTitle || payload.title,
    seo_description: payload.seoDescription || payload.excerpt,
    seo_keywords: payload.seoKeywords,
    focus_keyword: payload.focusKeyword || null,
    og_image: payload.ogImage || image || payload.image || "/images/venesia-5.png",
    schema_type: payload.schemaType,
    updated_at: new Date().toISOString(),
  };
}

export async function createMediaItem(formData: FormData) {
  await requireAdminSession();
  let type: MediaAdminType | null = getMediaType(formData);

  try {
    const status = getNormalizedStatus(getString(formData, "status"), "draft");
    const dbPayload = await buildDbPayload(formData, status);
    type = dbPayload.type;

    const { data, error } = await getSupabaseAdmin()
      .from("media_items")
      .insert({ ...dbPayload, created_at: new Date().toISOString() })
      .select("id, slug, type")
      .single();

    if (error) throw error;
    revalidateMedia(dbPayload.type, dbPayload.slug);
    redirect(`/admin/media-center/items/${data.id}?notice=created`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء عنصر المركز الإعلامي.";
    redirectFormError(`/admin/media-center/new${type ? `?type=${type}` : ""}`, message);
  }
}

async function updateMediaItemWithStatus(
  formData: FormData,
  status: MediaStatus,
  notice: string,
  options?: { redirectToList?: boolean },
) {
  const id = getString(formData, "id");
  if (!validateId(id)) redirectFormError("/admin/media-center", "رقم العنصر غير صحيح.");

  const editPath = `/admin/media-center/items/${id}`;

  try {
    const hasFullForm = Boolean(getString(formData, "title"));

    if (!hasFullForm) {
      const { data: current } = await getSupabaseAdmin().from("media_items").select("type, slug").eq("id", id).maybeSingle();
      const currentType = current?.type;
      if (!isMediaAdminType(currentType)) throw new Error("نوع المحتوى غير صحيح.");

      const { error } = await getSupabaseAdmin()
        .from("media_items")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      revalidateMedia(currentType, current?.slug ?? null);
      redirect(`${getMediaAdminPath(currentType)}?notice=${notice}`);
    }

    const dbPayload = await buildDbPayload(formData, status);

    const { error } = await getSupabaseAdmin()
      .from("media_items")
      .update(dbPayload)
      .eq("id", id);

    if (error) throw error;
    revalidateMedia(dbPayload.type, dbPayload.slug);

    if (options?.redirectToList) {
      redirect(`${getMediaAdminPath(dbPayload.type)}?notice=${notice}`);
    }

    redirect(`${editPath}?notice=${notice}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ عنصر المركز الإعلامي.";
    redirectFormError(editPath, message);
  }
}

export async function saveMediaItem(formData: FormData) {
  await requireAdminSession();
  const status = getNormalizedStatus(getString(formData, "status"), "draft");
  return updateMediaItemWithStatus(formData, status, "saved");
}

export async function saveMediaItemAndClose(formData: FormData) {
  await requireAdminSession();
  const status = getNormalizedStatus(getString(formData, "status"), "draft");
  return updateMediaItemWithStatus(formData, status, "saved", { redirectToList: true });
}

export async function saveDraftMediaItem(formData: FormData) {
  await requireAdminSession();
  return updateMediaItemWithStatus(formData, "draft", "draft");
}

export async function publishMediaItem(formData: FormData) {
  await requireAdminSession();
  return updateMediaItemWithStatus(formData, "published", "published");
}

export async function unpublishMediaItem(formData: FormData) {
  await requireAdminSession();
  return updateMediaItemWithStatus(formData, "unpublished", "unpublished");
}

export async function softDeleteMediaItem(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!validateId(id)) redirectFormError("/admin/media-center", "رقم العنصر غير صحيح.");

  const { data: current } = await getSupabaseAdmin().from("media_items").select("type, slug").eq("id", id).maybeSingle();
  const currentType = current?.type;
  const redirectPath = isMediaAdminType(currentType) ? getMediaAdminPath(currentType) : "/admin/media-center";

  const { error } = await getSupabaseAdmin()
    .from("media_items")
    .update({ status: "archived", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) redirectFormError(redirectPath, error.message);
  if (isMediaAdminType(currentType)) revalidateMedia(currentType, current?.slug ?? null);
  redirect(`${redirectPath}?notice=deleted`);
}

function getRedirectTo(formData: FormData) {
  const value = getString(formData, "redirect_to");
  return value.startsWith("/admin/media-center") ? value : "/admin/media-center";
}

function appendNotice(path: string, notice: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}notice=${notice}`;
}

export async function bulkUpdateMediaItems(formData: FormData) {
  await requireAdminSession();
  const ids = formData
    .getAll("media_item_ids")
    .map(String)
    .filter(validateId)
    .map(Number);

  const bulkAction = getString(formData, "bulk_action");
  const redirectTo = getRedirectTo(formData);

  if (ids.length === 0) redirect(appendNotice(redirectTo, "error"));

  const now = new Date().toISOString();
  let errorMessage: string | null = null;

  if (bulkAction === "publish") {
    const { error } = await getSupabaseAdmin()
      .from("media_items")
      .update({ status: "published", updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "unpublish") {
    const { error } = await getSupabaseAdmin()
      .from("media_items")
      .update({ status: "unpublished", updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "archive") {
    const { error } = await getSupabaseAdmin()
      .from("media_items")
      .update({ status: "archived", updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "delete") {
    const { error } = await getSupabaseAdmin()
      .from("media_items")
      .update({ status: "archived", deleted_at: now, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "feature") {
    const { error } = await getSupabaseAdmin()
      .from("media_items")
      .update({ is_featured: true, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "unfeature") {
    const { error } = await getSupabaseAdmin()
      .from("media_items")
      .update({ is_featured: false, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else {
    errorMessage = "إجراء غير مدعوم.";
  }

  if (errorMessage) redirect(appendNotice(redirectTo, "error"));

  revalidatePath("/admin/media-center");
  revalidateMediaCenterPublicPaths();

  const notice =
    bulkAction === "publish"
      ? "published"
      : bulkAction === "unpublish"
        ? "unpublished"
        : bulkAction === "delete" || bulkAction === "archive"
          ? "deleted"
          : "saved";

  redirect(appendNotice(redirectTo, notice));
}
