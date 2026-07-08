"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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

// Preserves the current pagination page (from the referer) after a bulk redirect.
async function categoriesRedirectBase() {
  const referer = (await headers()).get("referer");
  if (referer) {
    try {
      const page = new URL(referer).searchParams.get("page");
      if (page && /^\d+$/.test(page)) return `/admin/media-center/categories?page=${page}&`;
    } catch {
      // ignore malformed referer
    }
  }
  return "/admin/media-center/categories?";
}

export async function bulkMediaCategoryAction(formData: FormData) {
  await requireAdminSession();

  const action = getString(formData, "bulk_action");
  const ids = formData
    .getAll("ids")
    .map((value) => String(value))
    .filter((value) => validateId(value));

  const base = await categoriesRedirectBase();

  if (!ids.length) redirect(`${base}error=${encodeURIComponent("حدد تصنيفًا واحدًا على الأقل.")}`);

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide") {
    const isActive = action === "publish";
    const { error } = await getSupabaseAdmin()
      .from("media_categories")
      .update({ is_active: isActive, updated_at: now })
      .in("id", ids);

    if (error) redirect(`${base}error=${encodeURIComponent(error.message)}`);
    revalidateCategories();
    redirect(`${base}notice=${isActive ? "shown" : "hidden"}`);
  }

  if (action === "delete") {
    const { data: selected, error: selectedError } = await getSupabaseAdmin()
      .from("media_categories")
      .select("slug")
      .in("id", ids);

    if (selectedError) redirect(`${base}error=${encodeURIComponent(selectedError.message)}`);

    const slugs = ((selected ?? []) as { slug: string }[]).map((row) => row.slug);
    if (slugs.length) {
      // all-or-nothing: if ANY selected category is in use, block the whole delete.
      const { count, error: usageError } = await getSupabaseAdmin()
        .from("media_items")
        .select("id", { count: "exact", head: true })
        .in("category_slug", slugs)
        .is("deleted_at", null);

      if (usageError) redirect(`${base}error=${encodeURIComponent(usageError.message)}`);
      if ((count ?? 0) > 0) {
        redirect(`${base}error=${encodeURIComponent("لا يمكن حذف تصنيفات مستخدمة داخل عناصر المركز الإعلامي. أخفِها بدلًا من حذفها.")}`);
      }
    }

    const { error } = await getSupabaseAdmin().from("media_categories").delete().in("id", ids);
    if (error) redirect(`${base}error=${encodeURIComponent(error.message)}`);

    revalidateCategories();
    redirect(`${base}notice=deleted`);
  }

  redirect(`${base}error=${encodeURIComponent("إجراء جماعي غير معروف.")}`);
}

export async function moveMediaCategory(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const direction = getString(formData, "direction");
  const base = await categoriesRedirectBase();

  if (!validateId(id)) redirect(`${base}error=${encodeURIComponent("معرّف التصنيف غير صالح.")}`);
  if (direction !== "up" && direction !== "down") {
    redirect(`${base}error=${encodeURIComponent("اتجاه الترتيب غير صالح.")}`);
  }

  // Global order across ALL categories (matches the list default order).
  const { data: rows, error } = await getSupabaseAdmin()
    .from("media_categories")
    .select("id")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) redirect(`${base}error=${encodeURIComponent(error.message)}`);

  const orderedIds = ((rows ?? []) as { id: number }[]).map((row) => row.id);
  const currentIndex = orderedIds.findIndex((rowId) => String(rowId) === id);
  if (currentIndex === -1) redirect(`${base}error=${encodeURIComponent("التصنيف غير موجود.")}`);

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  // First/last globally: nothing to do (arrows are disabled in the UI anyway).
  if (targetIndex < 0 || targetIndex >= orderedIds.length) {
    redirect("/admin/media-center/categories");
  }

  // Swap positions, then re-index the whole list sequentially so the new order
  // persists even when several rows currently share sort_order (e.g. default 0).
  [orderedIds[currentIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[currentIndex]];

  const now = new Date().toISOString();
  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error: updateError } = await getSupabaseAdmin()
      .from("media_categories")
      .update({ sort_order: (index + 1) * 10, updated_at: now })
      .eq("id", orderedIds[index]);

    if (updateError) redirect(`${base}error=${encodeURIComponent(updateError.message)}`);
  }

  revalidateCategories();
  redirect(`${base}notice=reordered`);
}

export async function duplicateMediaCategory(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  if (!validateId(id)) redirectError("معرّف التصنيف غير صالح.");

  const { data: source, error } = await getSupabaseAdmin()
    .from("media_categories")
    .select("name, slug, description, sort_order")
    .eq("id", id)
    .maybeSingle<{ name: string; slug: string; description: string | null; sort_order: number | null }>();

  if (error) redirectError(error.message);
  if (!source) redirectError("التصنيف غير موجود.");

  // Safe, unique slug — never reuse the source slug.
  const baseSlug = `${source.slug}-copy`;
  let candidate = baseSlug;
  let attempt = 1;
  while (!(await ensureUniqueSlug(candidate))) {
    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
  }

  // Place the copy at the end of the order.
  const { data: lastRow } = await getSupabaseAdmin()
    .from("media_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number | null }>();

  const nextSortOrder = (Number(lastRow?.sort_order ?? 0) || 0) + 10;

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await getSupabaseAdmin()
    .from("media_categories")
    .insert({
      name: `${source.name} (نسخة)`,
      slug: candidate,
      description: source.description ?? null,
      sort_order: nextSortOrder,
      is_active: false,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single<{ id: number }>();

  if (insertError) redirectError(insertError.message);
  if (!inserted) redirectError("تعذر إنشاء نسخة التصنيف.");

  revalidateCategories();
  redirect(`/admin/media-center/categories/${inserted.id}`);
}
