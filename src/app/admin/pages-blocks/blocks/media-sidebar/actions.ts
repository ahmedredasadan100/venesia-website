"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { cleanText, getStatus, parseFormStatus, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
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
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));

  if (!id || !name) throw new Error("بيانات الموديول غير مكتملة.");

  const widgetKey = parseMediaSidebarWidgetKey(cleanText(formData.get("widget_key")));
  const dataSource = cleanText(formData.get("data_source"));
  const limit = parseNumber(formData.get("limit"), 0);
  const config = buildMediaSidebarModuleConfig(widgetKey, dataSource, limit);

  const nextRow = {
    name,
    description: cleanText(formData.get("description")) || null,
    status: parseFormStatus(formData),
    widget_key: widgetKey,
    config,
    updated_at: new Date().toISOString(),
  };
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "media_sidebar_module_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `media-sidebar-module:update:${id}`,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("media_sidebar_module_templates")
        .update(nextRow)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "Unable to update media sidebar module.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncMediaSidebarModulePageAssignments(id, parsePageIdsFromForm(formData), actor);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { blockType: "media-sidebar", widgetKey },
  }, actor);
  await revalidateBlockModulePaths("media-sidebar");
  revalidatePath(`/admin/pages-blocks/blocks/media-sidebar/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/media-sidebar/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`);
}

export async function toggleMediaSidebarModuleStatus(
  id: number,
  nextStatus: "published" | "unpublished",
) {
  const actor = await requireAdminSession();
  if (!id) throw new Error("معرّف الموديول مفقود.");
  const normalizedStatus = getStatus(nextStatus);

  const { error } = await getSupabaseAdmin()
    .from("media_sidebar_module_templates")
    .update({
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "content_block_template",
      normalizedStatus === "published" ? "publish" : "unpublish",
    ),
    entityType: "content_block_template",
    entityId: id,
    metadata: { blockType: "media-sidebar", status: normalizedStatus },
  }, actor);
  await revalidateBlockModulePaths("media-sidebar");
}
