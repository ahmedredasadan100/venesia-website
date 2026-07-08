"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
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
  revalidateTopicsCache();
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

async function loadCategoryRelations() {
  const { data, error } = await getSupabaseAdmin().from("topic_categories").select("id, parent_id, name");
  if (error) redirectError(error.message);
  return data ?? [];
}

function buildChildrenByParent(categories: Array<{ id: number | string; parent_id: number | null }>) {
  const childrenByParent = new Map<number, number[]>();

  categories.forEach((category) => {
    const id = Number(category.id);
    const parentId = category.parent_id ? Number(category.parent_id) : null;
    if (!parentId) return;

    const children = childrenByParent.get(parentId) ?? [];
    children.push(id);
    childrenByParent.set(parentId, children);
  });

  return childrenByParent;
}

function collectDescendantIds(rootId: number, childrenByParent: Map<number, number[]>) {
  const blockedIds = new Set<number>([rootId]);
  const stack = [...(childrenByParent.get(rootId) ?? [])];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || blockedIds.has(id)) continue;
    blockedIds.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  return blockedIds;
}

function flattenValidTransferTargets(
  categories: Array<{ id: number | string; name: string; parent_id: number | null }>,
  blockedIds: Set<number>,
) {
  const byId = new Map(
    categories.map((category) => [Number(category.id), category]),
  );

  function getLevel(id: number) {
    let level = 0;
    let current = byId.get(id);

    while (current?.parent_id) {
      const parentId = Number(current.parent_id);
      if (blockedIds.has(parentId)) break;
      level += 1;
      current = byId.get(parentId);
    }

    return level;
  }

  return categories
    .filter((category) => !blockedIds.has(Number(category.id)))
    .map((category) => ({
      id: Number(category.id),
      name: category.name,
      level: getLevel(Number(category.id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
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

  const categories = await loadCategoryRelations();
  const childrenByParent = buildChildrenByParent(categories);
  const blockedIds = collectDescendantIds(Number(currentId), childrenByParent);

  if (blockedIds.has(parentId)) {
    redirectError("لا يمكن نقل التصنيف داخل نفسه أو داخل أحد التصنيفات الفرعية التابعة له.");
  }
}

export async function createCategory(formData: FormData) {
  await requireAdminSession();
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

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_category", "create"),
    entityType: "topic_category",
    entityLabel: name,
    metadata: { slug, parent_id: parentId },
  });
  revalidateCategories();
  redirect("/admin/topics/categories?notice=created");
}

export async function updateCategory(formData: FormData) {
  await requireAdminSession();
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

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_category", "update"),
    entityType: "topic_category",
    entityId: Number(id),
    entityLabel: name,
    metadata: { slug },
  });
  revalidateCategories();
  redirect("/admin/topics/categories?notice=updated");
}

export async function toggleCategoryStatus(formData: FormData) {
  await requireAdminSession();
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

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_category", nextStatus ? "publish" : "unpublish"),
    entityType: "topic_category",
    entityId: Number(id),
    metadata: { is_active: nextStatus },
  });
  revalidateCategories();
  redirect(`/admin/topics/categories?notice=${nextStatus ? "shown" : "hidden"}`);
}

export async function duplicateCategory(formData: FormData) {
  await requireAdminSession();
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

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_category", "duplicate"),
    entityType: "topic_category",
    entityLabel: `${current.name} - نسخة`,
    metadata: { slug: nextSlug, source_category_id: Number(id) },
  });
  revalidateCategories();
  redirect("/admin/topics/categories?notice=created");
}

export async function getCategoryDeletePreviewAjax(id: number) {
  await requireAdminSession();

  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false as const, message: "معرّف التصنيف غير صالح." };
  }

  const { data: category, error: categoryError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name")
    .eq("id", id)
    .maybeSingle<{ id: number; name: string }>();

  if (categoryError) return { ok: false as const, message: categoryError.message };
  if (!category) return { ok: false as const, message: "التصنيف غير موجود." };

  const { count: topicCountRaw, error: topicError } = await getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (topicError) return { ok: false as const, message: topicError.message };

  const { count: childrenCountRaw, error: childrenError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);
  if (childrenError) return { ok: false as const, message: childrenError.message };

  const topicCount = topicCountRaw ?? 0;
  const childrenCount = childrenCountRaw ?? 0;

  const { data: categories, error: categoriesError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, parent_id, name");
  if (categoriesError) return { ok: false as const, message: categoriesError.message };

  const childrenByParent = buildChildrenByParent(categories ?? []);
  const blockedIds = collectDescendantIds(id, childrenByParent);
  const validTransferTargets = flattenValidTransferTargets(categories ?? [], blockedIds);

  return {
    ok: true as const,
    categoryName: category.name,
    topicCount,
    childrenCount,
    validTransferTargets,
  };
}

export async function deleteCategorySafelyAjax(id: number, transferToId?: number | null) {
  await requireAdminSession();

  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false as const, message: "معرّف التصنيف غير صالح." };
  }

  const supabase = getSupabaseAdmin();

  const { count: topicCountRaw, error: topicError } = await supabase
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (topicError) return { ok: false as const, message: topicError.message };

  const { count: childrenCountRaw, error: childrenError } = await supabase
    .from("topic_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);
  if (childrenError) return { ok: false as const, message: childrenError.message };

  const topicCount = topicCountRaw ?? 0;
  const childrenCount = childrenCountRaw ?? 0;

  if (childrenCount > 0) {
    return {
      ok: false as const,
      message: "لا يمكن حذف تصنيف يحتوي على تصنيفات فرعية. انقل التصنيفات الفرعية أولًا.",
    };
  }

  if (topicCount > 0) {
    if (!transferToId || !Number.isFinite(transferToId)) {
      return { ok: false as const, message: "اختر تصنيفًا لنقل الموضوعات إليه." };
    }

    if (transferToId === id) {
      return { ok: false as const, message: "لا يمكن النقل إلى نفس التصنيف." };
    }

    const { data: categories, error: categoriesError } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id, parent_id, name");
    if (categoriesError) return { ok: false as const, message: categoriesError.message };

    const childrenByParent = buildChildrenByParent(categories ?? []);
    const blockedIds = collectDescendantIds(id, childrenByParent);

    if (blockedIds.has(transferToId)) {
      return {
        ok: false as const,
        message: "لا يمكن النقل إلى هذا التصنيف لأنه نفس التصنيف أو أحد أبنائه.",
      };
    }

    const { data: target, error: targetError } = await supabase
      .from("topic_categories")
      .select("id, name, slug")
      .eq("id", transferToId)
      .maybeSingle<{ id: number; name: string; slug: string }>();

    if (targetError) return { ok: false as const, message: targetError.message };
    if (!target) return { ok: false as const, message: "التصنيف الهدف غير موجود." };

    const now = new Date().toISOString();
    const { error: moveError } = await supabase
      .from("topics")
      .update({
        category_id: target.id,
        category: target.name,
        category_slug: target.slug,
        updated_at: now,
      })
      .eq("category_id", id);

    if (moveError) return { ok: false as const, message: moveError.message };
  }

  const { error: deleteError } = await supabase.from("topic_categories").delete().eq("id", id);
  if (deleteError) return { ok: false as const, message: deleteError.message };

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_category", "delete"),
    entityType: "topic_category",
    entityId: id,
    metadata: { transfer_to_id: transferToId ?? null },
  });
  revalidateCategories();
  return { ok: true as const, message: "تم حذف التصنيف بنجاح." };
}

export async function deleteCategory(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectError("معرّف التصنيف غير صالح.");

  const usageCount = await getUsageCount(id);
  if (usageCount > 0) redirectError("لا يمكن حذف تصنيف مستخدم داخل موضوعات. عطّله بدل حذفه.");

  const childrenCount = await getChildrenCount(id);
  if (childrenCount > 0) redirectError("لا يمكن حذف تصنيف يحتوي على تصنيفات فرعية. انقل التصنيفات الفرعية أولًا.");

  const { error } = await getSupabaseAdmin().from("topic_categories").delete().eq("id", id);
  if (error) redirectError(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_category", "delete"),
    entityType: "topic_category",
    entityId: Number(id),
  });
  revalidateCategories();
  redirect("/admin/topics/categories?notice=deleted");
}
