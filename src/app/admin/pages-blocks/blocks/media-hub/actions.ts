"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { cleanText, getStatus, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { revalidateBlockModulePaths } from "../../../../../lib/page-blocks/admin-revalidate";
import {
  buildMediaHubModuleConfig,
  parseMediaHubSectionKey,
} from "../../../../../lib/media-hub-modules/parse-config";
import {
  parsePageIdsFromForm,
  syncMediaHubModulePageAssignments,
} from "../../../../../lib/page-blocks/sync-module-page-assignments";

export async function updateMediaHubModule(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));

  if (!id || !name) throw new Error("بيانات الموديول غير مكتملة.");

  const sectionKey = parseMediaHubSectionKey(cleanText(formData.get("section_key")));
  const dataSource = cleanText(formData.get("data_source")) || "media_items";
  const config = buildMediaHubModuleConfig(sectionKey, dataSource, {
    limit: parseNumber(formData.get("limit"), 0),
    sideLimit: parseNumber(formData.get("side_limit"), 0),
    listLimit: parseNumber(formData.get("list_limit"), 0),
  });

  const { error } = await getSupabaseAdmin()
    .from("media_hub_module_templates")
    .update({
      name,
      description: cleanText(formData.get("description")) || null,
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      section_key: sectionKey,
      config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await syncMediaHubModulePageAssignments(id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("media-hub");
  revalidatePath(`/admin/pages-blocks/blocks/media-hub/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/media-hub/${id}?saved=1`);
}
