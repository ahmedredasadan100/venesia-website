"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { BLOCK_MODULE_REGISTRY } from "../../../../../lib/page-blocks/block-module-registry";
import {
  MEDIA_HUB_ASSIGNMENT_TABLE,
  MEDIA_HUB_TEMPLATE_TABLE,
} from "../../../../../lib/media-hub-modules/registry";
import {
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
  MEDIA_SIDEBAR_TEMPLATE_TABLE,
} from "../../../../../lib/media-sidebar-modules/registry";
import { type PageBlockActionResult } from "../../../../../lib/page-blocks/action-result";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, parseFormBoolean, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import type { PageBlockType } from "../../../../../lib/page-blocks/types";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  assignmentTable,
  auditPageBlockAssignment,
  failure,
  nextMediaHubSortOrder,
  nextMediaSidebarSortOrder,
  nextSortOrder,
  success,
  templateTable,
} from "./helpers";

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

  await auditPageBlockAssignment("create", pageId, null, { block_type: blockType, template_id: templateId });
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

  await auditPageBlockAssignment("create", pageId, null, { module: "media-sidebar", template_id: templateId });
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

  await auditPageBlockAssignment("create", pageId, null, { module: "media-hub", template_id: templateId });
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

  await auditPageBlockAssignment("create", pageId, null, { module: "hero", hero_id: heroId });
  await revalidatePageBlocksPath(pageId);
  return success();
}
