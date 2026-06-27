"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { cleanText, getStatus, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { revalidateBlockModulePaths } from "../../../../../lib/page-blocks/admin-revalidate";
import {
  buildMediaSidebarModuleConfig,
  parseMediaSidebarWidgetKey,
} from "../../../../../lib/media-sidebar-modules/parse-config";
import {
  parsePageIdsFromForm,
  syncMediaSidebarModulePageAssignments,
} from "../../../../../lib/page-blocks/sync-module-page-assignments";

export async function updateMediaSidebarModule(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));

  if (!id || !name) throw new Error("بيانات الموديول غير مكتملة.");

  const widgetKey = parseMediaSidebarWidgetKey(cleanText(formData.get("widget_key")));
  const dataSource = cleanText(formData.get("data_source"));
  const limit = parseNumber(formData.get("limit"), 0);
  const config = buildMediaSidebarModuleConfig(widgetKey, dataSource, limit);

  const { error } = await getSupabaseAdmin()
    .from("media_sidebar_module_templates")
    .update({
      name,
      description: cleanText(formData.get("description")) || null,
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      widget_key: widgetKey,
      config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await syncMediaSidebarModulePageAssignments(id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("media-sidebar");
  revalidatePath(`/admin/pages-blocks/blocks/media-sidebar/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/media-sidebar/${id}?saved=1`);
}
