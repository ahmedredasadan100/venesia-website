"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

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
    .join("")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function redirectError(message: string): never {
  redirect(`/admin/topics/categories?error=${encodeURIComponent(message)}`);
}

function revalidateCategories() {
  revalidatePath("/admin/topics/categories");
  revalidatePath("/admin/topics");
  revalidatePath("/admin/topics/new");
  revalidatePath("/topics");
}

function getParentId(formData: FormData) {
  const rawParentId = getString(formData, "parent_id");
  if (!rawParentId) return null;
  if (!validateId(rawParentId)) redirectError("التصنيف الأب غير صالح.");
  return Number(rawParentId);
}

async function ensureUniqueSlug(slug: string, id?: string) {
  let query = getSupabaseAdmin().from("topic_categories").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);

  const { data, error } = await query.maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

async function getCategory(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, is_active, parent_id")
    .eq("id", id)
    .maybeSingle<{ id: number; name: string; slug: string; is_active: boolean | null; parent_id: number | null }>();

  if (error) redirectError(error.message);
  if (!data) redirectError("التصنيف غير موجود.");
  return data;
}

async function getUsageCount(id: string) {
  const { count, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("category_id", Number(id));

  if (error) redirectError(error.message);
  return count ?? 0;
}

async function getChildrenCount(id: string) {
  const { count, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", Number(id));

  if (error) redirectError(error.message);
  return count ?? 0;
}

async function ensureParentIsValid(parentId: number | null, currentId?: string) {
  if (!parentId) return;
  if (currentId && parentId === Number(currentId)) {
    redirectError("لا يمكن جعل التصنيف أب لنفسه.");
  }

  const { data: parent, error: parentError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id")
    .eq("id", parentId)
    .maybeSingle<{ id: number }>();

  if (parentError) redirectError(parentError.message);
  if (!parent) redirectError("التصنيف الأب غير موجود.");

  if (!currentId) return;

  const { data: categories, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, parent_id");

  if (error) redirectError(error.message);

  const childrenByParent = new Map<number, number[]>();
  (categories ?? []).forEach((category) => {
    const id = Number(category.id);
    const directParentId = category.parent_id ? Number(category.parent_id) : null;
    if (!directParentId) return;

    const children = childrenByParent.get(directParentId) ?? [];
    children.push(id);
    childrenByParent.set(directParentId, children);
  });

  const blockedIds = new Set<number>([Number(currentId)]);
  const stack = [...(childrenByParent.get(Number(currentId)) ?? [])];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || blockedIds.has(id)) continue;
    blockedIds.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  if (blockedIds.has(parentId)) {
    redirectError("لا يمكن نقل التصنيف داخل نفسه أو داخل أحد التصنيفات الفرعية التابعة له.");
  }
}

export async function createCategory(formData: FormData) {
  const name = getString(formData, "name");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? normalizeArabicForSlug(rawSlug) : normalizeArabicForSlug(name);
  const sortOrder = Number(getString(formData, "sort_order") || "0");
  const isActive = getBoolean(formData, "is_active");
  const parentId = getParentId(formData);

  if (!name) redirectError("اسم التصنيف مطلوب.");
  if (!slug) redirectError("Slug التصنيف مطلوب.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) redirectError("Slug التصنيف غير صالح.");

  await ensureParentIsValid(parentId);

  const isUnique = await ensureUniqueSlug(slug);
  if (!isUnique) redirectError("هذا الـ Slug مستخدم في تصنيف آخر.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("topic_categories").insert({
    name,
    slug,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_active: isActive,
    parent_id: parentId,
    status: isActive ? "published" : "draft",
    show_in_menu: true,
    is_featured: false,
    created_at: now,
    updated_at: now,
  });

  if (error) redirectError(error.message);

  revalidateCategories();
  redirect("/admin/topics/categories?notice=created");
}

export async function updateCategory(formData: FormData) {
  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? normalizeArabicForSlug(rawSlug) : normalizeArabicForSlug(name);
  const sortOrder = Number(getString(formData, "sort_order") || "0");
  const isActive = getBoolean(formData, "is_active");
  const parentId = getParentId(formData);

  if (!id || !validateId(id)) redirectError("معرّف التصنيف غير صالح.");
  if (!name) redirectError("اسم التصنيف مطلوب.");
  if (!slug) redirectError("Slug التصنيف مطلوب.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) redirectError("Slug التصنيف غير صالح.");

  const current = await getCategory(id);
  await ensureParentIsValid(parentId, id);

  const isUnique = await ensureUniqueSlug(slug, id);
  if (!isUnique) redirectError("هذا الـ Slug مستخدم في تصنيف آخر.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topic_categories")
    .update({
      name,
      slug,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: isActive,
      parent_id: parentId,
      status: isActive ? "published" : "draft",
      updated_at: now,
    })
    .eq("id", id);

  if (error) redirectError(error.message);

  if (current.slug !== slug) {
    await getSupabaseAdmin()
      .from("topics")
      .update({ category: name, category_slug: slug, category_id: Number(id), updated_at: now })
      .eq("category_slug", current.slug);
  } else {
    await getSupabaseAdmin()
      .from("topics")
      .update({ category: name, category_id: Number(id), updated_at: now })
      .eq("category_slug", slug);
  }

  revalidateCategories();
  redirect("/admin/topics/categories?notice=updated");
}

export async function toggleCategoryStatus(formData: FormData) {
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectError("معرّف التصنيف غير صالح.");

  const current = await getCategory(id);
  const nextStatus = !Boolean(current.is_active);
  const now = new Date().toISOString();

  const { error } = await getSupabaseAdmin()
    .from("topic_categories")
    .update({ is_active: nextStatus, status: nextStatus ? "published" : "draft", updated_at: now })
    .eq("id", id);

  if (error) redirectError(error.message);

  revalidateCategories();
  redirect(`/admin/topics/categories?notice=${nextStatus ? "shown" : "hidden"}`);
}

export async function duplicateCategory(formData: FormData) {
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectError("معرّف التصنيف غير صالح.");

  const { data: current, error: readError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("name, slug, description, sort_order, is_active, parent_id, status")
    .eq("id", id)
    .maybeSingle<{
      name: string;
      slug: string;
      description: string | null;
      sort_order: number | null;
      is_active: boolean | null;
      parent_id: number | null;
      status: string | null;
    }>();

  if (readError) redirectError(readError.message);
  if (!current) redirectError("التصنيف غير موجود.");

  let nextSlug = `${current.slug}-copy`;
  let suffix = 2;
  while (!(await ensureUniqueSlug(nextSlug))) {
    nextSlug = `${current.slug}-copy-${suffix}`;
    suffix += 1;
  }

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("topic_categories").insert({
    name: `${current.name} - نسخة`,
    slug: nextSlug,
    description: current.description,
    sort_order: current.sort_order ?? 0,
    is_active: false,
    parent_id: current.parent_id,
    status: "draft",
    show_in_menu: true,
    is_featured: false,
    created_at: now,
    updated_at: now,
  });

  if (error) redirectError(error.message);

  revalidateCategories();
  redirect("/admin/topics/categories?notice=created");
}

export async function deleteCategory(formData: FormData) {
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectError("معرّف التصنيف غير صالح.");

  const usageCount = await getUsageCount(id);
  if (usageCount > 0) redirectError("لا يمكن حذف تصنيف مستخدم داخل موضوعات. عطّله بدل حذفه.");

  const childrenCount = await getChildrenCount(id);
  if (childrenCount > 0) redirectError("لا يمكن حذف تصنيف يحتوي على تصنيفات فرعية. انقل التصنيفات الفرعية أولًا.");

  const { error } = await getSupabaseAdmin().from("topic_categories").delete().eq("id", id);
  if (error) redirectError(error.message);

  revalidateCategories();
  redirect("/admin/topics/categories?notice=deleted");
}
