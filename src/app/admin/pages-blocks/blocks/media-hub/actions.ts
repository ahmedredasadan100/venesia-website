"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  cleanText,
  getStatus,
  parseFormBoolean,
  parseFormStatus,
  parseNumber,
} from "../../../../../lib/page-blocks/admin-utils";
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
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));

  if (!id || !name) throw new Error("بيانات الموديول غير مكتملة.");

  const sectionKey = parseMediaHubSectionKey(cleanText(formData.get("section_key")));
  const dataSource = cleanText(formData.get("data_source")) || "topics";
  const placement = cleanText(formData.get("placement")) === "listing" ? "listing" : "hub";
  const config = buildMediaHubModuleConfig(sectionKey, dataSource, {
    limit: parseNumber(formData.get("limit"), 0),
    sideLimit: parseNumber(formData.get("side_limit"), 0),
    listLimit: parseNumber(formData.get("list_limit"), 0),
  }, {
    eyebrow: cleanText(formData.get("eyebrow")),
    title: cleanText(formData.get("title")),
    description: cleanText(formData.get("presentation_description")),
    ctaText: cleanText(formData.get("cta_text")),
  }, {
    placement,
    mediaType: cleanText(formData.get("media_type")),
    pageSize: parseNumber(formData.get("page_size"), 2),
    layout: cleanText(formData.get("listing_layout")),
    columns: parseNumber(formData.get("listing_columns"), 2),
    paginationEnabled: parseFormBoolean(formData, "pagination_enabled", true),
    cardVariant: cleanText(formData.get("card_variant")),
    cardCtaText: cleanText(formData.get("card_cta_text")),
  });

  const nextRow = {
    name,
    description: cleanText(formData.get("description")) || null,
    status: parseFormStatus(formData),
    section_key: sectionKey,
    config,
    updated_at: new Date().toISOString(),
  };
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "media_hub_module_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `media-hub-module:update:${id}`,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("media_hub_module_templates")
        .update(nextRow)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "Unable to update media hub module.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncMediaHubModulePageAssignments(id, parsePageIdsFromForm(formData), actor);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { blockType: "media-hub", sectionKey, placement },
  }, actor);
  await revalidateBlockModulePaths("media-hub");
  revalidatePath(`/admin/pages-blocks/blocks/media-hub/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/media-hub/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`);
}

export async function toggleMediaHubModuleStatus(
  id: number,
  nextStatus: "published" | "unpublished",
) {
  const actor = await requireAdminSession();
  if (!id) throw new Error("معرّف الموديول مفقود.");
  const normalizedStatus = getStatus(nextStatus);

  const { error } = await getSupabaseAdmin()
    .from("media_hub_module_templates")
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
    metadata: { blockType: "media-hub", status: normalizedStatus },
  }, actor);
  await revalidateBlockModulePaths("media-hub");
}
