"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { type PageBlockActionResult } from "../../../../lib/page-blocks/action-result";
import { BLOCK_MODULE_REGISTRY, ALL_ASSIGNMENT_TABLES } from "../../../../lib/page-blocks/block-module-registry";
import {
  MEDIA_HUB_ASSIGNMENT_TABLE,
  MEDIA_HUB_TEMPLATE_TABLE,
} from "../../../../lib/media-hub-modules/registry";
import {
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
  MEDIA_SIDEBAR_TEMPLATE_TABLE,
} from "../../../../lib/media-sidebar-modules/registry";
import { cleanText, parseFormBoolean, parseNumber } from "../../../../lib/page-blocks/admin-utils";
import { revalidatePageBlocksPath, revalidatePublicPagesWithBlockAssignments } from "../../../../lib/page-blocks/admin-revalidate";
import {
  buildDuplicatePageIdentity,
  getPageDeleteBlockReason,
} from "../../../../lib/pages/page-admin-policy";
import type { PageBlockType, PageModuleKind } from "../../../../lib/page-blocks/types";

function pagesListPath(options?: { notice?: string; error?: string }) {
  const params = new URLSearchParams();
  if (options?.notice) params.set("notice", options.notice);
  if (options?.error) params.set("error", options.error);
  const query = params.toString();
  return `/admin/pages-blocks/pages${query ? `?${query}` : ""}`;
}

async function copyPageModuleAssignments(sourcePageId: number, targetPageId: number) {
  for (const table of ALL_ASSIGNMENT_TABLES) {
    const { data, error } = await getSupabaseAdmin()
      .from(table)
      .select("template_id, slot, sort_order, is_visible")
      .eq("page_id", sourcePageId);

    if (error) throw new Error(error.message);
    if (!data?.length) continue;

    const { error: insertError } = await getSupabaseAdmin().from(table).insert(
      data.map((row) => ({
        page_id: targetPageId,
        template_id: row.template_id,
        slot: row.slot,
        sort_order: row.sort_order,
        is_visible: false,
      })),
    );

    if (insertError) throw new Error(insertError.message);
  }
}

async function copyPageHeroAssignments(
  sourcePageId: number,
  targetPageId: number,
  targetSlug: string,
  targetPath: string,
) {
  const { data, error } = await getSupabaseAdmin()
    .from("hero_assignments")
    .select("hero_id, priority")
    .eq("target_type", "page")
    .eq("target_id", sourcePageId);

  if (error) throw new Error(error.message);
  if (!data?.length) return;

  const { error: insertError } = await getSupabaseAdmin().from("hero_assignments").insert(
    data.map((row) => ({
      hero_id: row.hero_id,
      target_type: "page",
      target_id: targetPageId,
      target_slug: targetSlug,
      path: targetPath,
      is_active: false,
      priority: row.priority,
    })),
  );

  if (insertError) throw new Error(insertError.message);
}

export async function togglePageStatus(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("id"));
  if (!pageId) redirect(pagesListPath({ error: "الصفحة غير موجودة." }));

  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("status")
    .eq("id", pageId)
    .maybeSingle<{ status: string }>();

  if (loadError || !page) {
    redirect(pagesListPath({ error: loadError?.message ?? "الصفحة غير موجودة." }));
  }

  const nextStatus = page.status === "published" ? "hidden" : "published";

  const { error } = await getSupabaseAdmin()
    .from("pages")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", pageId);

  if (error) redirect(pagesListPath({ error: error.message }));

  await revalidatePageBlocksPath(pageId);
  redirect(
    pagesListPath({
      notice: nextStatus === "published" ? "تم نشر الصفحة." : "تم إخفاء الصفحة.",
    }),
  );
}

export async function deletePage(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("id"));
  if (!pageId) redirect(pagesListPath({ error: "الصفحة غير موجودة." }));

  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("slug,title")
    .eq("id", pageId)
    .maybeSingle<{ slug: string; title: string }>();

  if (loadError || !page) {
    redirect(pagesListPath({ error: loadError?.message ?? "الصفحة غير موجودة." }));
  }

  const blockReason = getPageDeleteBlockReason(page.slug);
  if (blockReason) redirect(pagesListPath({ error: blockReason }));

  const { error } = await getSupabaseAdmin().from("pages").delete().eq("id", pageId);
  if (error) redirect(pagesListPath({ error: error.message }));

  revalidatePath("/admin/pages-blocks/pages", "layout");
  await revalidatePublicPagesWithBlockAssignments();
  redirect(pagesListPath({ notice: `تم حذف الصفحة «${page.title}».` }));
}

export type PagesTableRow = {
  id: number;
  title: string;
  slug: string;
  path: string;
  page_type: string;
  status: string;
  block_count: number;
};

export type PagesTableResult = {
  ok: boolean;
  message?: string;
  rows?: PagesTableRow[];
};

async function loadPagesTableRows(): Promise<PagesTableRow[]> {
  const { data: pages, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .order("id", { ascending: true });

  if (loadError) throw new Error(loadError.message);

  const pageRows = pages ?? [];
  const pageIds = pageRows.map((page) => page.id);
  const blockCounts = await getPageModuleCounts(pageIds);

  return pageRows.map((page) => ({
    ...page,
    block_count: blockCounts.get(page.id) ?? 0,
  }));
}

export async function getPagesTableRows(): Promise<PagesTableRow[]> {
  await requireAdminSession();
  return loadPagesTableRows();
}

export async function bulkDeletePagesAjax(ids: number[]): Promise<PagesTableResult> {
  await requireAdminSession();
  const validIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!validIds.length) return { ok: false, message: "حدد صفحة واحدة على الأقل." };

  const { data: pages, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("id, slug")
    .in("id", validIds);

  if (loadError) return { ok: false, message: loadError.message };

  const deletableIds: number[] = [];
  let blockedCount = 0;

  for (const page of pages ?? []) {
    const blockReason = getPageDeleteBlockReason(page.slug);
    if (blockReason) {
      blockedCount += 1;
    } else {
      deletableIds.push(page.id);
    }
  }

  if (!deletableIds.length) {
    return { ok: false, message: "لا يمكن حذف الصفحات المحددة — صفحات نظامية محمية." };
  }

  const { error: deleteError } = await getSupabaseAdmin().from("pages").delete().in("id", deletableIds);
  if (deleteError) return { ok: false, message: deleteError.message };

  revalidatePath("/admin/pages-blocks/pages", "layout");
  await revalidatePublicPagesWithBlockAssignments();

  const rows = await loadPagesTableRows();
  let message = `تم حذف ${deletableIds.length} صفحة بنجاح.`;
  if (blockedCount > 0) {
    message += ` لم يُحذف ${blockedCount} صفحة محمية.`;
  }

  return { ok: true, message, rows };
}

export async function duplicatePage(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("id"));
  if (!pageId) redirect(pagesListPath({ error: "الصفحة غير موجودة." }));

  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("title, slug, path, page_type, status")
    .eq("id", pageId)
    .maybeSingle<{ title: string; slug: string; path: string; page_type: string; status: string }>();

  if (loadError || !page) {
    redirect(pagesListPath({ error: loadError?.message ?? "الصفحة غير موجودة." }));
  }

  const suffix = Date.now().toString().slice(-5);
  const identity = buildDuplicatePageIdentity(page, suffix);

  const { data: copiedPage, error: insertError } = await getSupabaseAdmin()
    .from("pages")
    .insert({
      title: identity.title,
      slug: identity.slug,
      path: identity.path,
      page_type: page.page_type,
      status: "draft",
    })
    .select("id")
    .single<{ id: number }>();

  if (insertError || !copiedPage) {
    redirect(pagesListPath({ error: insertError?.message ?? "تعذر نسخ الصفحة." }));
  }

  try {
    await copyPageModuleAssignments(pageId, copiedPage.id);
    await copyPageHeroAssignments(pageId, copiedPage.id, identity.slug, identity.path);
  } catch (error) {
    await getSupabaseAdmin().from("pages").delete().eq("id", copiedPage.id);
    redirect(pagesListPath({ error: error instanceof Error ? error.message : "تعذر نسخ موديولات الصفحة." }));
  }

  await revalidatePageBlocksPath(copiedPage.id);
  redirect(`/admin/pages-blocks/pages/${copiedPage.id}?notice=duplicated`);
}

function isMediaSidebarKind(kind: string) {
  return kind === "media-sidebar";
}

function isMediaHubKind(kind: string) {
  return kind === "media-hub";
}

function assignmentTable(blockType: PageBlockType) {
  return BLOCK_MODULE_REGISTRY[blockType].assignmentTable;
}

function templateTable(blockType: PageBlockType) {
  return BLOCK_MODULE_REGISTRY[blockType].templateTable;
}

async function nextSortOrder(pageId: number, blockType: PageBlockType) {
  const table = assignmentTable(blockType);
  const { data } = await getSupabaseAdmin()
    .from(table)
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
}

async function nextMediaSidebarSortOrder(pageId: number) {
  const { data } = await getSupabaseAdmin()
    .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
}

async function nextMediaHubSortOrder(pageId: number) {
  const { data } = await getSupabaseAdmin()
    .from(MEDIA_HUB_ASSIGNMENT_TABLE)
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
}

function failure(message: string): PageBlockActionResult {
  return { ok: false, message };
}

function success(): PageBlockActionResult {
  return { ok: true, message: null };
}

export async function assignPageBlock(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const blockType = cleanText(formData.get("block_type")) as PageBlockType;
  const templateId = parseNumber(formData.get("template_id"));
  const slot = cleanText(formData.get("slot")) || "main";
  const sortOrder = parseNumber(formData.get("sort_order"), await nextSortOrder(pageId, blockType));
  const isVisible = parseFormBoolean(formData, "is_visible", true);

  if (!pageId || !templateId || !(blockType in BLOCK_MODULE_REGISTRY)) {
    return failure("بيانات الربط غير مكتملة.");
  }

  const { data: existingAssignment, error: existingError } = await getSupabaseAdmin()
    .from(assignmentTable(blockType))
    .select("id")
    .eq("page_id", pageId)
    .eq("template_id", templateId)
    .maybeSingle();

  if (existingError) return failure(existingError.message);

  if (existingAssignment) {
    return failure("هذا القالب مرتبط بالصفحة مسبقًا. احذف الربط الحالي أو اختر قالبًا آخر.");
  }

  const { data: template, error: templateError } = await getSupabaseAdmin()
    .from(templateTable(blockType))
    .select("id")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError || !template) return failure("القالب المحدد غير موجود.");

  const { error } = await getSupabaseAdmin().from(assignmentTable(blockType)).insert({
    page_id: pageId,
    template_id: templateId,
    slot,
    sort_order: sortOrder,
    is_visible: isVisible,
  });

  if (error) {
    if (error.code === "23505") {
      return failure("هذا القالب مرتبط بالصفحة مسبقًا.");
    }
    return failure(error.message);
  }

  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function assignMediaSidebarModule(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const templateId = parseNumber(formData.get("template_id"));
  const sortOrder = parseNumber(formData.get("sort_order"), await nextMediaSidebarSortOrder(pageId));
  const isVisible = parseFormBoolean(formData, "is_visible", true);

  if (!pageId || !templateId) return failure("بيانات الربط غير مكتملة.");

  const { data: existingAssignment, error: existingError } = await getSupabaseAdmin()
    .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
    .select("id")
    .eq("page_id", pageId)
    .eq("template_id", templateId)
    .maybeSingle();

  if (existingError) return failure(existingError.message);

  if (existingAssignment) {
    return failure("هذا القالب مرتبط بالصفحة مسبقًا. احذف الربط الحالي أو اختر قالبًا آخر.");
  }

  const { data: template, error: templateError } = await getSupabaseAdmin()
    .from(MEDIA_SIDEBAR_TEMPLATE_TABLE)
    .select("id")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError || !template) return failure("القالب المحدد غير موجود.");

  const { error } = await getSupabaseAdmin().from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE).insert({
    page_id: pageId,
    template_id: templateId,
    slot: "sidebar",
    sort_order: sortOrder,
    is_visible: isVisible,
  });

  if (error) {
    if (error.code === "23505") {
      return failure("هذا القالب مرتبط بالصفحة مسبقًا.");
    }
    return failure(error.message);
  }

  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function assignMediaHubModule(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const templateId = parseNumber(formData.get("template_id"));
  const sortOrder = parseNumber(formData.get("sort_order"), await nextMediaHubSortOrder(pageId));
  const isVisible = parseFormBoolean(formData, "is_visible", true);

  if (!pageId || !templateId) return failure("بيانات الربط غير مكتملة.");

  const { data: existingAssignment, error: existingError } = await getSupabaseAdmin()
    .from(MEDIA_HUB_ASSIGNMENT_TABLE)
    .select("id")
    .eq("page_id", pageId)
    .eq("template_id", templateId)
    .maybeSingle();

  if (existingError) return failure(existingError.message);

  if (existingAssignment) {
    return failure("هذا القالب مرتبط بالصفحة مسبقًا. احذف الربط الحالي أو اختر قالبًا آخر.");
  }

  const { data: template, error: templateError } = await getSupabaseAdmin()
    .from(MEDIA_HUB_TEMPLATE_TABLE)
    .select("id")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError || !template) return failure("القالب المحدد غير موجود.");

  const { error } = await getSupabaseAdmin().from(MEDIA_HUB_ASSIGNMENT_TABLE).insert({
    page_id: pageId,
    template_id: templateId,
    slot: "main",
    sort_order: sortOrder,
    is_visible: isVisible,
  });

  if (error) {
    if (error.code === "23505") {
      return failure("هذا القالب مرتبط بالصفحة مسبقًا.");
    }
    return failure(error.message);
  }

  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function assignHeroModule(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const heroId = parseNumber(formData.get("template_id"));
  const sortOrder = parseNumber(formData.get("sort_order"), 0);

  if (!pageId || !heroId) return failure("بيانات ربط الهيرو غير مكتملة.");

  const { data: page } = await getSupabaseAdmin().from("pages").select("slug,path").eq("id", pageId).maybeSingle();
  const { data: hero, error: heroError } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id")
    .eq("id", heroId)
    .maybeSingle();

  if (heroError || !hero) return failure("الهيرو المحدد غير موجود.");

  const { data: existing } = await getSupabaseAdmin()
    .from("hero_assignments")
    .select("id")
    .eq("target_type", "page")
    .eq("target_id", pageId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    return failure("هذه الصفحة لديها هيرو مرتبط بالفعل. احذف الربط الحالي أولًا.");
  }

  const { error } = await getSupabaseAdmin().from("hero_assignments").insert({
    hero_id: heroId,
    target_type: "page",
    target_id: pageId,
    target_slug: page?.slug ?? null,
    path: page?.path ?? null,
    is_active: true,
    priority: sortOrder,
  });

  if (error) return failure(error.message);

  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function updatePageBlockAssignment(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const blockType = cleanText(formData.get("block_type")) as PageBlockType | "media-sidebar" | "media-hub";
  const slot = cleanText(formData.get("slot")) || "main";
  const sortOrder = parseNumber(formData.get("sort_order"), 0);
  const isVisible = parseFormBoolean(formData, "is_visible", false);

  if (!pageId || !assignmentId) {
    return failure("بيانات الربط غير مكتملة.");
  }

  if (isMediaSidebarKind(blockType)) {
    if (slot !== "sidebar") return failure("موديولات الشريط الجانبي تستخدم slot: sidebar فقط.");

    const { error } = await getSupabaseAdmin()
      .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
      .update({
        slot: "sidebar",
        sort_order: sortOrder,
        is_visible: isVisible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);

    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (isMediaHubKind(blockType)) {
    if (slot !== "main") return failure("موديولات Hub تستخدم slot: main فقط.");

    const { error } = await getSupabaseAdmin()
      .from(MEDIA_HUB_ASSIGNMENT_TABLE)
      .update({
        slot: "main",
        sort_order: sortOrder,
        is_visible: isVisible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);

    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (!(blockType in BLOCK_MODULE_REGISTRY)) {
    return failure("بيانات الربط غير مكتملة.");
  }

  const { error } = await getSupabaseAdmin()
    .from(assignmentTable(blockType))
    .update({
      slot,
      sort_order: sortOrder,
      is_visible: isVisible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId)
    .eq("page_id", pageId);

  if (error) return failure(error.message);

  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function updateHeroPageAssignment(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const sortOrder = parseNumber(formData.get("sort_order"), 0);
  const isVisible = parseFormBoolean(formData, "is_visible", true);

  if (!pageId || !assignmentId) return failure("بيانات الربط غير مكتملة.");

  const { error } = await getSupabaseAdmin()
    .from("hero_assignments")
    .update({ priority: sortOrder, is_active: isVisible })
    .eq("id", assignmentId)
    .eq("target_id", pageId)
    .eq("target_type", "page");

  if (error) return failure(error.message);

  await revalidatePageBlocksPath(pageId);
  return success();
}

/**
 * Swaps sort_order between an assignment and its adjacent sibling (same module kind).
 * Mirrors the approved menu reorder technique — no schema change, no new order system.
 */
export async function movePageBlockAssignment(formData: FormData): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const moduleKind = cleanText(formData.get("block_type")) as PageBlockType | "hero" | "media-sidebar" | "media-hub";
  const currentId = parseNumber(formData.get("current_id"));
  const targetId = parseNumber(formData.get("target_id"));

  if (!pageId || !currentId || !targetId) return failure("تعذر إعادة الترتيب.");

  if (moduleKind === "hero") {
    const { data: rows, error } = await getSupabaseAdmin()
      .from("hero_assignments")
      .select("id, priority")
      .eq("target_type", "page")
      .eq("target_id", pageId)
      .in("id", [currentId, targetId]);

    if (error || !rows || rows.length !== 2) return failure(error?.message ?? "تعذر إعادة الترتيب.");

    const current = rows.find((row) => Number(row.id) === currentId);
    const target = rows.find((row) => Number(row.id) === targetId);
    if (!current || !target) return failure("تعذر إعادة الترتيب.");

    const currentOrder = Number(current.priority ?? 0);
    const targetOrder = Number(target.priority ?? 0);

    const { error: e1 } = await getSupabaseAdmin()
      .from("hero_assignments")
      .update({ priority: targetOrder })
      .eq("id", currentId)
      .eq("target_id", pageId)
      .eq("target_type", "page");
    if (e1) return failure(e1.message);

    const { error: e2 } = await getSupabaseAdmin()
      .from("hero_assignments")
      .update({ priority: currentOrder })
      .eq("id", targetId)
      .eq("target_id", pageId)
      .eq("target_type", "page");
    if (e2) return failure(e2.message);

    await revalidatePageBlocksPath(pageId);
    return success();
  }

  const table = isMediaSidebarKind(moduleKind)
    ? MEDIA_SIDEBAR_ASSIGNMENT_TABLE
    : isMediaHubKind(moduleKind)
      ? MEDIA_HUB_ASSIGNMENT_TABLE
      : moduleKind in BLOCK_MODULE_REGISTRY
        ? assignmentTable(moduleKind as PageBlockType)
        : null;

  if (!table) return failure("نوع الموديول غير مدعوم.");

  const { data: rows, error } = await getSupabaseAdmin()
    .from(table)
    .select("id, sort_order")
    .eq("page_id", pageId)
    .in("id", [currentId, targetId]);

  if (error || !rows || rows.length !== 2) return failure(error?.message ?? "تعذر إعادة الترتيب.");

  const current = rows.find((row) => Number(row.id) === currentId);
  const target = rows.find((row) => Number(row.id) === targetId);
  if (!current || !target) return failure("تعذر إعادة الترتيب.");

  const currentOrder = Number(current.sort_order ?? 0);
  const targetOrder = Number(target.sort_order ?? 0);
  const now = new Date().toISOString();

  const { error: e1 } = await getSupabaseAdmin()
    .from(table)
    .update({ sort_order: targetOrder, updated_at: now })
    .eq("id", currentId)
    .eq("page_id", pageId);
  if (e1) return failure(e1.message);

  const { error: e2 } = await getSupabaseAdmin()
    .from(table)
    .update({ sort_order: currentOrder, updated_at: now })
    .eq("id", targetId)
    .eq("page_id", pageId);
  if (e2) return failure(e2.message);

  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function togglePageBlockAssignment(formData: FormData): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const blockType = cleanText(formData.get("block_type")) as PageBlockType | "hero" | "media-sidebar" | "media-hub";
  const nextVisible = parseFormBoolean(formData, "next_visible", false);

  if (!pageId || !assignmentId) return failure("بيانات الربط غير مكتملة.");

  if (blockType === "hero") {
    const { error } = await getSupabaseAdmin()
      .from("hero_assignments")
      .update({ is_active: nextVisible })
      .eq("id", assignmentId)
      .eq("target_id", pageId)
      .eq("target_type", "page");

    if (error) return failure(error.message);
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (isMediaSidebarKind(blockType)) {
    const { error } = await getSupabaseAdmin()
      .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
      .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (isMediaHubKind(blockType)) {
    const { error } = await getSupabaseAdmin()
      .from(MEDIA_HUB_ASSIGNMENT_TABLE)
      .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (!(blockType in BLOCK_MODULE_REGISTRY)) return failure("نوع الموديول غير مدعوم.");

  const { error } = await getSupabaseAdmin()
    .from(assignmentTable(blockType))
    .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("page_id", pageId);

  if (error) return failure(error.message);

  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function deletePageBlockAssignment(formData: FormData): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const blockType = cleanText(formData.get("block_type")) as PageBlockType | "hero" | "media-sidebar" | "media-hub";

  if (!pageId || !assignmentId) return failure("بيانات الربط غير مكتملة.");

  if (blockType === "hero") {
    const { error } = await getSupabaseAdmin()
      .from("hero_assignments")
      .delete()
      .eq("id", assignmentId)
      .eq("target_id", pageId)
      .eq("target_type", "page");

    if (error) return failure(error.message);
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (isMediaSidebarKind(blockType)) {
    const { error } = await getSupabaseAdmin()
      .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
      .delete()
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (isMediaHubKind(blockType)) {
    const { error } = await getSupabaseAdmin()
      .from(MEDIA_HUB_ASSIGNMENT_TABLE)
      .delete()
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (!(blockType in BLOCK_MODULE_REGISTRY)) return failure("نوع الموديول غير مدعوم.");

  const { error } = await getSupabaseAdmin()
    .from(assignmentTable(blockType))
    .delete()
    .eq("id", assignmentId)
    .eq("page_id", pageId);

  if (error) return failure(error.message);

  await revalidatePageBlocksPath(pageId);
  return success();
}

type ParsedAssignmentKey = {
  moduleKind: PageModuleKind;
  blockType: PageBlockType | null;
  assignmentId: number;
};

function parseAssignmentKeys(formData: FormData): ParsedAssignmentKey[] {
  return formData
    .getAll("ids")
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const [kind, assignmentId] = value.split(":");
      const moduleKind = kind as PageModuleKind;
      return {
        moduleKind,
        blockType:
          moduleKind === "hero" || moduleKind === "media-sidebar" || moduleKind === "media-hub"
            ? null
            : (moduleKind as PageBlockType),
        assignmentId: Number(assignmentId),
      };
    })
    .filter((entry) => Number.isFinite(entry.assignmentId) && entry.moduleKind);
}

export async function bulkPageBlockAssignments(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const action = cleanText(formData.get("bulk_action"));
  const entries = parseAssignmentKeys(formData);

  if (!pageId || !entries.length) return;

  const now = new Date().toISOString();

  if (action === "show" || action === "hide") {
    const isVisible = action === "show";

    await Promise.all(
      entries.map((entry) => {
        if (entry.moduleKind === "hero") {
          return getSupabaseAdmin()
            .from("hero_assignments")
            .update({ is_active: isVisible })
            .eq("id", entry.assignmentId)
            .eq("target_id", pageId)
            .eq("target_type", "page");
        }

        if (entry.moduleKind === "media-sidebar") {
          return getSupabaseAdmin()
            .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
            .update({ is_visible: isVisible, updated_at: now })
            .eq("id", entry.assignmentId)
            .eq("page_id", pageId);
        }

        if (entry.moduleKind === "media-hub") {
          return getSupabaseAdmin()
            .from(MEDIA_HUB_ASSIGNMENT_TABLE)
            .update({ is_visible: isVisible, updated_at: now })
            .eq("id", entry.assignmentId)
            .eq("page_id", pageId);
        }

        if (!entry.blockType) return Promise.resolve();

        return getSupabaseAdmin()
          .from(assignmentTable(entry.blockType))
          .update({ is_visible: isVisible, updated_at: now })
          .eq("id", entry.assignmentId)
          .eq("page_id", pageId);
      }),
    );
  }

  if (action === "delete") {
    await Promise.all(
      entries.map((entry) => {
        if (entry.moduleKind === "hero") {
          return getSupabaseAdmin()
            .from("hero_assignments")
            .delete()
            .eq("id", entry.assignmentId)
            .eq("target_id", pageId)
            .eq("target_type", "page");
        }

        if (entry.moduleKind === "media-sidebar") {
          return getSupabaseAdmin()
            .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
            .delete()
            .eq("id", entry.assignmentId)
            .eq("page_id", pageId);
        }

        if (entry.moduleKind === "media-hub") {
          return getSupabaseAdmin()
            .from(MEDIA_HUB_ASSIGNMENT_TABLE)
            .delete()
            .eq("id", entry.assignmentId)
            .eq("page_id", pageId);
        }

        if (!entry.blockType) return Promise.resolve();

        return getSupabaseAdmin()
          .from(assignmentTable(entry.blockType))
          .delete()
          .eq("id", entry.assignmentId)
          .eq("page_id", pageId);
      }),
    );
  }

  await revalidatePageBlocksPath(pageId);
}

export async function getPageModuleCounts(pageIds: number[]) {
  await requireAdminSession();
  if (!pageIds.length) return new Map<number, number>();

  const counts = new Map<number, number>();
  pageIds.forEach((id) => counts.set(id, 0));

  const tables = ALL_ASSIGNMENT_TABLES;

  await Promise.all(
    tables.map(async (table) => {
      const { data } = await getSupabaseAdmin().from(table).select("page_id").in("page_id", pageIds);
      for (const row of data ?? []) {
        counts.set(row.page_id, (counts.get(row.page_id) ?? 0) + 1);
      }
    }),
  );

  const { data: heroAssignments } = await getSupabaseAdmin()
    .from("hero_assignments")
    .select("target_id")
    .eq("target_type", "page")
    .eq("is_active", true)
    .in("target_id", pageIds);

  for (const row of heroAssignments ?? []) {
    counts.set(row.target_id, (counts.get(row.target_id) ?? 0) + 1);
  }

  return counts;
}

/** @deprecated Use getPageModuleCounts */
export async function getPageBlockCounts(pageIds: number[]) {
  await requireAdminSession();
  return getPageModuleCounts(pageIds);
}

/** @deprecated Legacy page_sections CRUD — kept for backward compatibility only. */
export async function createPageSection() {
  await requireAdminSession();
  throw new Error("Legacy page_sections creation is disabled. Assign a block template instead.");
}

export async function togglePageSection(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  revalidatePath(`/admin/pages-blocks/pages/${pageId}`);
}

export async function deletePageSection(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const sectionId = parseNumber(formData.get("section_id"));
  if (!pageId || !sectionId) throw new Error("Page section id is missing.");
  const { error } = await getSupabaseAdmin().from("page_sections").delete().eq("id", sectionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/pages-blocks/pages/${pageId}`);
}

export async function updatePageSectionPlacement(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  revalidatePath(`/admin/pages-blocks/pages/${pageId}`);
}
