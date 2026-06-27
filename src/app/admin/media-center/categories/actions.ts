"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { revalidateMediaCenterPublicPaths } from "../../../../lib/media-center/revalidate-public-paths";

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

function normalizeArabicForSlug(value: string) {
  const map: Record<string, string> = {
    ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w", ي: "y", ى: "a", ة: "h", ء: "", ئ: "e", ؤ: "o",
  };

  return value
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function redirectError(message: string): never {
  redirect(`/admin/media-center/categories?error=${encodeURIComponent(message)}`);
}

function revalidateCategories() {
  revalidatePath("/admin/media-center/categories");
  revalidatePath("/admin/media-center");
  revalidatePath("/admin/media-center/new");
  revalidateMediaCenterPublicPaths();
}

async function ensureUniqueSlug(slug: string, id?: string) {
  let query = getSupabaseAdmin().from("media_categories").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data, error } = await query.maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

async function getCategory(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("media_categories")
    .select("id, name, slug, is_active")
    .eq("id", id)
    .maybeSingle<{ id: number; name: string; slug: string; is_active: boolean | null }>();

  if (error) redirectError(error.message);
  if (!data) redirectError("التصنيف غير موجود.");
  return data;
}

async function getUsageCountBySlug(slug: string) {
  const { count, error } = await getSupabaseAdmin()
    .from("media_items")
    .select("id", { count: "exact", head: true })
    .eq("category_slug", slug)
    .is("deleted_at", null);

  if (error) redirectError(error.message);
  return count ?? 0;
}

export async function createMediaCategory(formData: FormData) {
  await requireAdminSession();
  const name = getString(formData, "name");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? normalizeArabicForSlug(rawSlug) : normalizeArabicForSlug(name);
  const description = getString(formData, "description");
  const sortOrder = Number(getString(formData, "sort_order") || "0");
  const isActive = getBoolean(formData, "is_active");

  if (!name) redirectError("اسم التصنيف مطلوب.");
  if (!slug) redirectError("Slug التصنيف مطلوب.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) redirectError("Slug التصنيف غير صالح.");

  const isUnique = await ensureUniqueSlug(slug);
  if (!isUnique) redirectError("هذا الـ Slug مستخدم في تصنيف آخر.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("media_categories").insert({
    name,
    slug,
    description: description || null,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_active: isActive,
    created_at: now,
    updated_at: now,
  });

  if (error) redirectError(error.message);
  revalidateCategories();
  redirect("/admin/media-center/categories?notice=created");
}

export async function updateMediaCategory(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? normalizeArabicForSlug(rawSlug) : normalizeArabicForSlug(name);
  const description = getString(formData, "description");
  const sortOrder = Number(getString(formData, "sort_order") || "0");
  const isActive = getBoolean(formData, "is_active");

  if (!id || !validateId(id)) redirectError("معرّف التصنيف غير صالح.");
  if (!name) redirectError("اسم التصنيف مطلوب.");
  if (!slug) redirectError("Slug التصنيف مطلوب.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) redirectError("Slug التصنيف غير صالح.");

  const current = await getCategory(id);
  const isUnique = await ensureUniqueSlug(slug, id);
  if (!isUnique) redirectError("هذا الـ Slug مستخدم في تصنيف آخر.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("media_categories")
    .update({ name, slug, description: description || null, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0, is_active: isActive, updated_at: now })
    .eq("id", id);

  if (error) redirectError(error.message);

  if (current.slug !== slug) {
    await getSupabaseAdmin().from("media_items").update({ category: name, category_slug: slug, updated_at: now }).eq("category_slug", current.slug);
  } else {
    await getSupabaseAdmin().from("media_items").update({ category: name, updated_at: now }).eq("category_slug", slug);
  }

  revalidateCategories();
  redirect("/admin/media-center/categories?notice=updated");
}

export async function toggleMediaCategoryStatus(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectError("معرّف التصنيف غير صالح.");

  const current = await getCategory(id);
  const nextStatus = !Boolean(current.is_active);

  const { error } = await getSupabaseAdmin()
    .from("media_categories")
    .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) redirectError(error.message);
  revalidateCategories();
  redirect(`/admin/media-center/categories?notice=${nextStatus ? "shown" : "hidden"}`);
}

export async function deleteMediaCategory(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectError("معرّف التصنيف غير صالح.");

  const current = await getCategory(id);
  const usageCount = await getUsageCountBySlug(current.slug);
  if (usageCount > 0) redirectError("لا يمكن حذف تصنيف مستخدم داخل عناصر المركز الإعلامي. اخفه بدلًا من حذفه.");

  const { error } = await getSupabaseAdmin().from("media_categories").delete().eq("id", id);
  if (error) redirectError(error.message);

  revalidateCategories();
  redirect("/admin/media-center/categories?notice=deleted");
}
