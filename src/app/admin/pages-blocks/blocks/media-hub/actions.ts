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
  PAGE_BLOCK_PUBLICATION_BULK_ACTIONS,
  parseFormStatus,
  parseNumber,
  parsePageBlockBulkAction,
  parsePageBlockBulkIds,
  withModuleEditorReturnContextFromForm,
} from "../../../../../lib/page-blocks/admin-utils";
import { revalidateBlockModulePaths } from "../../../../../lib/page-blocks/admin-revalidate";
import {
  buildMediaHubModuleConfig,
  parseMediaHubSectionKey,
} from "../../../../../lib/media-hub-modules/parse-config";
import {
  buildMediaHubCollectionView,
  buildMediaHubContentHierarchy,
} from "../../../../../lib/media-hub-modules/presentation-contract";
import {
  parsePageIdsFromForm,
  syncMediaHubModulePageAssignments,
} from "../../../../../lib/page-blocks/sync-module-page-assignments";
import {
  buildCollectionModuleDisplayFormattingFromFormData,
  buildPageBlockTextFormattingPatch,
} from "../../../../../lib/page-blocks/configs";

export async function updateMediaHubModule(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));

  if (!id || !name) throw new Error("بيانات الموديول غير مكتملة.");

  const sectionKey = parseMediaHubSectionKey(
    cleanText(formData.get("section_key")),
  );
  if (sectionKey === "featured") {
    throw new Error("المحتوى المميز يُدار من موديول Featured المستقل.");
  }
  const dataSource = cleanText(formData.get("data_source")) || "topics";
  const placementInput = cleanText(formData.get("placement"));
  const placement = placementInput === "listing" ? "listing" : "hub";
  const config = buildMediaHubModuleConfig(
    sectionKey,
    dataSource,
    parseNumber(formData.get("item_limit"), 0),
    buildMediaHubContentHierarchy(sectionKey, {
      mode: cleanText(formData.get("content_hierarchy_mode")),
      secondaryItemCount: parseNumber(formData.get("secondary_item_count"), 0),
    }),
    {
      ...buildPageBlockTextFormattingPatch(formData, [
        { field: "eyebrow" },
        { field: "title", defaults: { bold: true } },
        { field: "description" },
      ]),
      eyebrow: cleanText(formData.get("eyebrow")),
      title: cleanText(formData.get("title")),
      description: cleanText(formData.get("presentation_description")),
      ctaText: cleanText(formData.get("cta_text")),
      collectionView: buildMediaHubCollectionView(sectionKey, {
        layout: cleanText(formData.get("collection_layout")),
        itemsPerRow: parseNumber(formData.get("items_per_row"), 0),
        cardVariant: cleanText(formData.get("collection_card_variant")),
      }),
    },
    {
      placement,
      mediaType:
        cleanText(formData.get("content_type")) ||
        cleanText(formData.get("media_type")),
      itemLimit: parseNumber(formData.get("item_limit"), 6),
      presentation: cleanText(formData.get("presentation")),
      itemsPerRow: parseNumber(formData.get("items_per_row"), 3),
      display: buildCollectionModuleDisplayFormattingFromFormData(formData),
    },
  );

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
      if (error || !data)
        throw new Error(error?.message ?? "Unable to update media hub module.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncMediaHubModulePageAssignments(
    id,
    parsePageIdsFromForm(formData),
    actor,
  );
  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("content_block_template", "update"),
      entityType: "content_block_template",
      entityId: id,
      entityLabel: name,
      metadata: { blockType: "media-hub", sectionKey, placement },
    },
    actor,
  );
  await revalidateBlockModulePaths("media-hub");
  revalidatePath(`/admin/pages-blocks/blocks/media-hub/${id}`, "page");
  redirect(
    withModuleEditorReturnContextFromForm(
      `/admin/pages-blocks/blocks/media-hub/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`,
      formData,
    ),
  );
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
  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction(
        "content_block_template",
        normalizedStatus === "published" ? "publish" : "unpublish",
      ),
      entityType: "content_block_template",
      entityId: id,
      metadata: { blockType: "media-hub", status: normalizedStatus },
    },
    actor,
  );
  await revalidateBlockModulePaths("media-hub");
}

export async function bulkMediaHubModuleStatuses(formData: FormData) {
  const actor = await requireAdminSession();
  const action = parsePageBlockBulkAction(
    formData.get("bulk_action"),
    PAGE_BLOCK_PUBLICATION_BULK_ACTIONS,
  );
  const ids = parsePageBlockBulkIds(formData.getAll("ids"));
  const status = action === "publish" ? "published" : "unpublished";

  const { error } = await getSupabaseAdmin()
    .from("media_hub_module_templates")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);

  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction(
        "content_block_template",
        action === "publish" ? "publish" : "unpublish",
      ),
      entityType: "content_block_template",
      entityLabel: "media_hub_module_templates",
      metadata: { blockType: "media-hub", action, ids, count: ids.length },
    },
    actor,
  );
  await revalidateBlockModulePaths("media-hub");
}
