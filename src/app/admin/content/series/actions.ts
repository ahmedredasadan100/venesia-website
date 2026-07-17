"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

const VALID_STATUSES = ["draft", "published", "unpublished", "archived"] as const;
type SeriesStatus = (typeof VALID_STATUSES)[number];

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getAllStrings(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string" && /^\d+$/.test(value));
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

function validateId(id: string) {
  return /^\d+$/.test(id);
}

function getStatus(value: string): SeriesStatus {
  return VALID_STATUSES.includes(value as SeriesStatus) ? (value as SeriesStatus) : "published";
}

function getSortOrder(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCategoryId(formData: FormData) {
  const parsed = Number.parseInt(getString(formData, "category_id"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function ensureActiveCategory(categoryId: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

function redirectWithNotice(notice: string): never {
  redirect(`/admin/content/series?notice=${notice}`);
}

function redirectWithError(message: string): never {
  redirect(`/admin/content/series?error=${encodeURIComponent(message)}`);
}

function revalidateSeriesPaths() {
  revalidateTopicsCache();
  revalidatePath("/admin/content/series");
  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
}

async function ensureUniqueSlug(slug: string, id?: string) {
  let query = getSupabaseAdmin().from("topic_series").select("id").eq("slug", slug).limit(1);

  if (id) query = query.neq("id", id);

  const { data, error } = await query.maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

function getPayload(formData: FormData) {
  const name = getString(formData, "name");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(name);

  return {
    name,
    slug,
    status: getStatus(getString(formData, "status")),
    sortOrder: getSortOrder(getString(formData, "sort_order")),
    categoryId: getCategoryId(formData),
  };
}

function validatePayload(payload: ReturnType<typeof getPayload>) {
  if (!payload.name) return "اسم السلسلة مطلوب.";
  if (!payload.slug) return "Slug السلسلة مطلوب.";
  if (!validateSlug(payload.slug)) return "الـ Slug لازم يكون إنجليزي صغير، أرقام، وشرطة بين الكلمات فقط.";
  if (!payload.categoryId) return "التصنيف مطلوب.";
  return null;
}

async function validatePayloadWithCategory(payload: ReturnType<typeof getPayload>) {
  const validationError = validatePayload(payload);
  if (validationError) return validationError;

  const categoryExists = await ensureActiveCategory(payload.categoryId);
  if (!categoryExists) return "التصنيف المختار غير موجود أو غير مفعل.";

  return null;
}

export async function createSeries(formData: FormData) {
  await requireAdminSession();
  const payload = getPayload(formData);
  const validationError = await validatePayloadWithCategory(payload);
  if (validationError) redirectWithError(validationError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug);
  if (!isUniqueSlug) redirectWithError("هذا الـ Slug مستخدم بالفعل في سلسلة أخرى.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("topic_series").insert({
    name: payload.name,
    slug: payload.slug,
    status: payload.status,
    sort_order: payload.sortOrder,
    category_id: payload.categoryId,
    deleted_at: payload.status === "archived" ? now : null,
    created_at: now,
    updated_at: now,
  });

  if (error) redirectWithError(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "create"),
    entityType: "topic_series",
    entityLabel: payload.name,
    metadata: { slug: payload.slug, status: payload.status },
  });
  revalidateSeriesPaths();
  redirectWithNotice("created");
}

export async function updateSeries(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectWithError("السلسلة غير صالحة.");

  const payload = getPayload(formData);
  const validationError = await validatePayloadWithCategory(payload);
  if (validationError) redirectWithError(validationError);

  const isUniqueSlug = await ensureUniqueSlug(payload.slug, id);
  if (!isUniqueSlug) redirectWithError("هذا الـ Slug مستخدم بالفعل في سلسلة أخرى.");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topic_series")
    .update({
      name: payload.name,
      slug: payload.slug,
      status: payload.status,
      sort_order: payload.sortOrder,
      category_id: payload.categoryId,
      deleted_at: payload.status === "archived" ? now : null,
      updated_at: now,
    })
    .eq("id", id);

  if (error) redirectWithError(error.message);

  await getSupabaseAdmin()
    .from("topics")
    .update({ series: payload.name, series_slug: payload.slug, updated_at: now })
    .eq("series_id", id);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "update"),
    entityType: "topic_series",
    entityId: Number(id),
    entityLabel: payload.name,
    metadata: { slug: payload.slug, status: payload.status },
  });
  revalidateSeriesPaths();
  redirectWithNotice("updated");
}

export async function toggleSeriesStatus(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  const currentStatus = getString(formData, "status");
  if (!id || !validateId(id)) redirectWithError("السلسلة غير صالحة.");

  const nextStatus: SeriesStatus = currentStatus === "published" ? "unpublished" : "published";
  const now = new Date().toISOString();

  const { error } = await getSupabaseAdmin()
    .from("topic_series")
    .update({ status: nextStatus, deleted_at: null, updated_at: now })
    .eq("id", id);

  if (error) redirectWithError(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "topic_series",
    entityId: Number(id),
    metadata: { status: nextStatus },
  });
  revalidateSeriesPaths();
  redirectWithNotice(nextStatus === "published" ? "published" : "unpublished");
}

export async function duplicateSeries(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectWithError("السلسلة غير صالحة.");

  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("name, slug, status, sort_order, category_id")
    .eq("id", id)
    .maybeSingle<{ name: string; slug: string; status: string | null; sort_order: number | null; category_id: number | null }>();

  if (error) redirectWithError(error.message);
  if (!data) redirectWithError("السلسلة غير موجودة.");
  if (!data.category_id) redirectWithError("لا يمكن نسخ سلسلة بدون تصنيف. عيّن تصنيفًا للسلسلة أولًا.");

  let slug = `${data.slug}-copy`;
  let counter = 2;
  while (!(await ensureUniqueSlug(slug))) {
    slug = `${data.slug}-copy-${counter}`;
    counter += 1;
  }

  const now = new Date().toISOString();
  const { error: insertError } = await getSupabaseAdmin().from("topic_series").insert({
    name: `${data.name} - نسخة`,
    slug,
    status: "draft",
    sort_order: data.sort_order ?? 0,
    category_id: data.category_id,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  });

  if (insertError) redirectWithError(insertError.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "duplicate"),
    entityType: "topic_series",
    entityLabel: `${data.name} - نسخة`,
    metadata: { slug, source_series_id: Number(id) },
  });
  revalidateSeriesPaths();
  redirectWithNotice("duplicated");
}

export async function deleteSeries(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirectWithError("السلسلة غير صالحة.");

  const { count, error: countError } = await getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("series_id", id);

  if (countError) redirectWithError(countError.message);
  if ((count ?? 0) > 0) redirectWithError("لا يمكن حذف سلسلة مرتبطة بموضوعات. أخفها أو انقل الموضوعات أولًا.");

  const { error } = await getSupabaseAdmin().from("topic_series").delete().eq("id", id);
  if (error) redirectWithError(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "delete"),
    entityType: "topic_series",
    entityId: Number(id),
  });
  revalidateSeriesPaths();
  redirectWithNotice("deleted");
}

export async function bulkSeriesAction(formData: FormData) {
  await requireAdminSession();
  const action = getString(formData, "bulk_action");
  const ids = getAllStrings(formData, "ids");
  if (!ids.length) redirectWithError("حدد سلسلة واحدة على الأقل.");

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide") {
    const status = action === "publish" ? "published" : "unpublished";
    const { error } = await getSupabaseAdmin()
      .from("topic_series")
      .update({ status, deleted_at: null, updated_at: now })
      .in("id", ids);
    if (error) redirectWithError(error.message);
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("topic_series", status === "published" ? "publish" : "unpublish"),
      entityType: "topic_series",
      metadata: { bulk_action: action, ids: ids.map(Number) },
    });
    revalidateSeriesPaths();
    redirectWithNotice(status === "published" ? "published" : "unpublished");
  }

  if (action === "delete") {
    const { data: linked, error: linkedError } = await getSupabaseAdmin()
      .from("topics")
      .select("series_id")
      .in("series_id", ids);

    if (linkedError) redirectWithError(linkedError.message);
    if ((linked ?? []).length > 0) redirectWithError("لا يمكن حذف سلاسل مرتبطة بموضوعات. انقل الموضوعات أولًا.");

    const { error } = await getSupabaseAdmin().from("topic_series").delete().in("id", ids);
    if (error) redirectWithError(error.message);
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("topic_series", "delete"),
      entityType: "topic_series",
      metadata: { bulk_action: action, ids: ids.map(Number) },
    });
    revalidateSeriesPaths();
    redirectWithNotice("deleted");
  }

  redirectWithError("عملية غير معروفة.");
}

export type SeriesTableRow = {
  id: number;
  name: string;
  slug: string;
  status: string | null;
  sort_order: number | null;
  topics_count: number;
};

export type SeriesTableResult = {
  ok: boolean;
  message?: string;
  rows?: SeriesTableRow[];
};

export async function getSeriesTableRows(): Promise<SeriesTableRow[]> {
  await requireAdminSession();
  const [{ data: seriesRows, error: seriesError }, { data: topicRows, error: topicError }] = await Promise.all([
    getSupabaseAdmin()
      .from("topic_series")
      .select("id, name, slug, status, sort_order")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: false }),
    getSupabaseAdmin().from("topics").select("series_id"),
  ]);

  if (seriesError) throw new Error(seriesError.message);
  if (topicError) throw new Error(topicError.message);

  const counts = new Map<number, number>();
  ((topicRows ?? []) as { series_id: number | null }[]).forEach((row) => {
    if (!row.series_id) return;
    counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
  });

  return ((seriesRows ?? []) as {
    id: number;
    name: string;
    slug: string;
    status: string | null;
    sort_order: number | null;
  }[]).map((item) => ({
    ...item,
    topics_count: counts.get(item.id) ?? 0,
  }));
}

async function successWithFreshRows(message: string): Promise<SeriesTableResult> {
  revalidateSeriesPaths();
  return { ok: true, message, rows: await getSeriesTableRows() };
}

function failure(message: string): SeriesTableResult {
  return { ok: false, message };
}

export async function toggleSeriesStatusAjax(id: number, currentStatus: string | null): Promise<SeriesTableResult> {
  await requireAdminSession();
  if (!validateId(String(id))) return failure("السلسلة غير صالحة.");

  const nextStatus: SeriesStatus = currentStatus === "published" ? "unpublished" : "published";
  const now = new Date().toISOString();

  const { error } = await getSupabaseAdmin()
    .from("topic_series")
    .update({ status: nextStatus, deleted_at: null, updated_at: now })
    .eq("id", id);

  if (error) return failure(error.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "topic_series",
    entityId: id,
    metadata: { status: nextStatus },
  });
  return successWithFreshRows(nextStatus === "published" ? "تم إظهار السلسلة بنجاح." : "تم إخفاء السلسلة بنجاح.");
}

export async function duplicateSeriesAjax(id: number): Promise<SeriesTableResult> {
  await requireAdminSession();
  if (!validateId(String(id))) return failure("السلسلة غير صالحة.");

  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("name, slug, status, sort_order, category_id")
    .eq("id", id)
    .maybeSingle<{ name: string; slug: string; status: string | null; sort_order: number | null; category_id: number | null }>();

  if (error) return failure(error.message);
  if (!data) return failure("السلسلة غير موجودة.");
  if (!data.category_id) return failure("لا يمكن نسخ سلسلة بدون تصنيف. عيّن تصنيفًا للسلسلة أولًا.");

  let slug = `${data.slug}-copy`;
  let counter = 2;
  while (!(await ensureUniqueSlug(slug))) {
    slug = `${data.slug}-copy-${counter}`;
    counter += 1;
  }

  const now = new Date().toISOString();
  const { error: insertError } = await getSupabaseAdmin().from("topic_series").insert({
    name: `${data.name} - نسخة`,
    slug,
    status: "draft",
    sort_order: data.sort_order ?? 0,
    category_id: data.category_id,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  });

  if (insertError) return failure(insertError.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "duplicate"),
    entityType: "topic_series",
    entityLabel: `${data.name} - نسخة`,
    metadata: { slug, source_series_id: id },
  });
  return successWithFreshRows("تم نسخ السلسلة بنجاح.");
}

export async function deleteSeriesAjax(id: number): Promise<SeriesTableResult> {
  await requireAdminSession();
  if (!validateId(String(id))) return failure("السلسلة غير صالحة.");

  const { count, error: countError } = await getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("series_id", id);

  if (countError) return failure(countError.message);
  if ((count ?? 0) > 0) return failure("لا يمكن حذف سلسلة مرتبطة بموضوعات. أخفها أو انقل الموضوعات أولًا.");

  const { error } = await getSupabaseAdmin().from("topic_series").delete().eq("id", id);
  if (error) return failure(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "delete"),
    entityType: "topic_series",
    entityId: id,
  });
  return successWithFreshRows("تم حذف السلسلة بنجاح.");
}

export async function bulkSeriesActionAjax(action: string, ids: number[]): Promise<SeriesTableResult> {
  await requireAdminSession();
  const validIds = ids.filter((id) => validateId(String(id))).map(String);
  if (!validIds.length) return failure("حدد سلسلة واحدة على الأقل.");

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide") {
    const status = action === "publish" ? "published" : "unpublished";
    const { error } = await getSupabaseAdmin()
      .from("topic_series")
      .update({ status, deleted_at: null, updated_at: now })
      .in("id", validIds);

    if (error) return failure(error.message);
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("topic_series", status === "published" ? "publish" : "unpublish"),
      entityType: "topic_series",
      metadata: { bulk_action: action, ids: validIds.map(Number) },
    });
    return successWithFreshRows(status === "published" ? "تم إظهار السلاسل المحددة بنجاح." : "تم إخفاء السلاسل المحددة بنجاح.");
  }

  if (action === "delete") {
    const { data: linked, error: linkedError } = await getSupabaseAdmin()
      .from("topics")
      .select("series_id")
      .in("series_id", validIds);

    if (linkedError) return failure(linkedError.message);
    if ((linked ?? []).length > 0) return failure("لا يمكن حذف سلاسل مرتبطة بموضوعات. انقل الموضوعات أولًا.");

    const { error } = await getSupabaseAdmin().from("topic_series").delete().in("id", validIds);
    if (error) return failure(error.message);

    await recordCmsAdminAudit({
      action: buildCmsAuditAction("topic_series", "delete"),
      entityType: "topic_series",
      metadata: { bulk_action: action, ids: validIds.map(Number) },
    });
    return successWithFreshRows("تم حذف السلاسل المحددة بنجاح.");
  }

  return failure("عملية غير معروفة.");
}
