"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { resolveTopicPublishedAt } from "../../../../lib/content-dates";
import { logError } from "../../../../lib/logging";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  ALLOWED_MEDIA_SECTION_SLUGS,
  getContentTypeForSectionSlug,
  isPhase3BEditableContentType,
  MEDIA_CONTENT_TYPE_ERROR,
  MEDIA_SECTION_ERROR,
  type Phase3BEditableContentType,
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
    .select("id, title, slug, excerpt, content, image, category_slug, content_type, status, is_featured, published_at")
    .eq("id", id)
    .in("content_type", ["news", "press", "site_update"])
    .is("deleted_at", null)
    .maybeSingle<MediaTopicRow>();

  if (error) {
    logError("getEditableMediaTopicById failed", error, { id });
    return null;
  }

  if (!data || !isPhase3BEditableContentType(data.content_type)) return null;
  return data;
}

function revalidateMediaContentPaths(id?: string | number) {
  revalidatePath("/admin/content/media");
  revalidatePath("/admin/content/media/new");

  if (id) {
    revalidatePath(`/admin/content/media/${id}`);
  }
}

function buildMediaWritePayload(
  payload: ReturnType<typeof getPayload>,
  category: { id: number; name: string; slug: string },
  contentType: Phase3BEditableContentType,
  now: string,
  currentTopic?: MediaTopicRow | null,
) {
  return {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content: payload.content,
    image: payload.image,
    image_alt: null,
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

  const isUniqueSlug = await ensureUniqueSlug(payload.slug);
  if (!isUniqueSlug) redirectFormError("/admin/content/media/new", "هذا الـ Slug مستخدم بالفعل في محتوى آخر.");

  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .insert({
      ...buildMediaWritePayload(payload, section.category, section.contentType, now, null),
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

  if (!isPhase3BEditableContentType(section.contentType)) {
    redirectEditError(id, MEDIA_CONTENT_TYPE_ERROR);
  }

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id);
  if (!isUniqueSlug) redirectEditError(id, "هذا الـ Slug مستخدم بالفعل في محتوى آخر.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update(buildMediaWritePayload(payload, section.category, section.contentType, now, currentTopic))
    .eq("id", id)
    .in("content_type", ["news", "press", "site_update"]);

  if (error) redirectEditError(id, error.message);

  revalidateMediaContentPaths(id);
  redirect(`/admin/content/media/${id}?notice=saved`);
}
