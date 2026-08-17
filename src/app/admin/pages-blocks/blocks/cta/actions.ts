"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import type { AdminFormActionState } from "../../../../../lib/admin/form-runtime";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  synchronizeMediaReferenceWriteScopesAfterDomainMutation,
  type MediaReferenceSynchronizationResult,
} from "../../../../../lib/admin/media-catalog/synchronization";

import { redirect } from "next/navigation";
import type { TablesInsert, TablesUpdate } from "../../../../../lib/database.types";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  cleanText,
  getStatus,
  PAGE_BLOCK_BULK_ACTIONS,
  parseFormStatus,
  parseNumber,
  parsePageBlockBulkAction,
  parsePageBlockBulkIds,
  slugify,
  withModuleEditorReturnContextFromForm,
} from "../../../../../lib/page-blocks/admin-utils";
import { revalidateBlockModulePaths } from "../../../../../lib/page-blocks/admin-revalidate";
import {
  parsePageIdsFromForm,
  syncBlockModulePageAssignments,
} from "../../../../../lib/page-blocks/sync-module-page-assignments";
import type { CtaBlockConfig } from "../../../../../lib/page-blocks/configs";
import { linkFieldFromFormData, hasSavedLinkField } from "../../../../../lib/admin/links/block-save";

function buildCtaLink(formData: FormData, prefix: string, labelField: string) {
  const label = cleanText(formData.get(labelField));
  const linkData = linkFieldFromFormData(formData, prefix);
  if (!label && !hasSavedLinkField(linkData)) return undefined;
  return {
    label,
    ...(linkData ? { link: linkData.link, target: linkData.target } : {}),
  };
}

function buildCtaConfig(formData: FormData): CtaBlockConfig {
  return {
    eyebrow: cleanText(formData.get("eyebrow")),
    title: cleanText(formData.get("title")),
    highlight: cleanText(formData.get("highlight")),
    description: cleanText(formData.get("description")),
    primaryCta: buildCtaLink(formData, "primary_cta", "primary_cta_label"),
    secondaryCta: buildCtaLink(formData, "secondary_cta", "secondary_cta_label"),
    backgroundImage: cleanText(formData.get("background_image")),
    backgroundStyle: (cleanText(formData.get("background_style")) || "dark") as CtaBlockConfig["backgroundStyle"],
  };
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("cta_block_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`CTA slug lookup failed: ${error.message}`);
  return !data;
}

export type CreateCtaBlockFormActionState = AdminFormActionState;

function createCtaBlockFailure(
  revision: number,
  message: string,
  field?: "name" | "slug",
): CreateCtaBlockFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء بلوك CTA",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function createCtaBlockSuccess(
  revision: number,
  id: number,
  mediaWarning: boolean,
  infrastructureWarning?: string,
): CreateCtaBlockFormActionState {
  const warning = mediaWarning || Boolean(infrastructureWarning);
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء بلوك CTA مع تنبيه" : "تم إنشاء بلوك CTA",
    message:
      infrastructureWarning ??
      (mediaWarning
        ? "تم إنشاء البلوك، لكن مزامنة مراجع الوسائط تحتاج إلى مراجعة."
        : "تم إنشاء البلوك كغير منشور بنجاح."),
    code: warning ? "created_with_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/blocks/cta/${id}${mediaWarning ? "?notice=saved_with_media_sync_warning" : ""}`,
    savedRevision: `${id}:${revision}`,
  };
}

export async function createCtaBlock(
  previousState: CreateCtaBlockFormActionState,
  formData: FormData,
): Promise<CreateCtaBlockFormActionState> {
  const revision = previousState.revision + 1;
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name) return createCtaBlockFailure(revision, "اسم البلوك مطلوب.", "name");
  if (!slug) return createCtaBlockFailure(revision, "اكتب slug صالحًا للبلوك.", "slug");
  if (!(await ensureUniqueSlug(slug))) {
    return createCtaBlockFailure(revision, "الـ slug مستخدم بالفعل.", "slug");
  }

  let createdId: number | null = null;
  let mediaWarning = false;
  try {
    const nextRow: TablesInsert<"cta_block_templates"> = {
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant: cleanText(formData.get("variant")) || "band",
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: parseFormStatus(formData),
      config: buildCtaConfig(formData),
    };
    const provisionalIdentity = `create:${crypto.randomUUID()}`;
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "cta_block_templates",
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `cta-block:create:${provisionalIdentity}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("cta_block_templates")
          .insert(nextRow)
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء البلوك.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
    const data = coordinated.value;
    createdId = data.id;
    mediaWarning = coordinated.mediaSynchronization.status === "saved_with_media_sync_warning";

    await recordCmsAdminAudit({
      action: buildCmsAuditAction("content_block_template", "create"),
      entityType: "content_block_template",
      entityId: data.id,
      entityLabel: name,
      metadata: { blockType: "cta", slug },
    }, actor);
    await revalidateBlockModulePaths("cta");
    return createCtaBlockSuccess(revision, data.id, mediaWarning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء بلوك CTA. حاول مرة أخرى.";
    if (createdId) {
      return createCtaBlockSuccess(
        revision,
        createdId,
        mediaWarning,
        `تم إنشاء البلوك، لكن تعذر إكمال التحقق اللاحق: ${message}`,
      );
    }
    return createCtaBlockFailure(
      revision,
      message,
      message.toLowerCase().includes("slug") ? "slug" : undefined,
    );
  }
}

export async function updateCtaBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!id || !name || !slug) throw new Error("بيانات البلوك غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  const nextRow: TablesUpdate<"cta_block_templates"> = {
    name,
    slug,
    description: cleanText(formData.get("description")) || null,
    variant: cleanText(formData.get("variant")) || "band",
    style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
    status: parseFormStatus(formData),
    config: buildCtaConfig(formData),
    updated_at: new Date().toISOString(),
  };
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "cta_block_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `cta-block:update:${id}`,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("cta_block_templates")
        .update(nextRow)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "تعذر تحديث البلوك.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncBlockModulePageAssignments("cta", id, parsePageIdsFromForm(formData), actor);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { blockType: "cta", slug },
  }, actor);
  await revalidateBlockModulePaths("cta");
  redirect(withModuleEditorReturnContextFromForm(
    `/admin/pages-blocks/blocks/cta/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`,
    formData,
  ));
}

export async function toggleCtaBlockStatus(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "unpublished");
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("cta_block_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "content_block_template",
      nextStatus === "published" ? "publish" : "unpublish",
    ),
    entityType: "content_block_template",
    entityId: id,
    metadata: { blockType: "cta", status: nextStatus },
  }, actor);
  await revalidateBlockModulePaths("cta");
}

export async function deleteCtaBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("cta_block_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const cleanupIdentity = existing?.id ?? id;

  const { error } = await getSupabaseAdmin()
    .from("cta_block_templates")
    .delete()
    .eq("id", cleanupIdentity);
  if (error) throw new Error(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "delete"),
    entityType: "content_block_template",
    entityId: cleanupIdentity,
    metadata: { blockType: "cta" },
  }, actor);
  const mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [],
    null,
    [{ domainKey: "cta_block_templates", entityIdentity: cleanupIdentity }],
  );
  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("cta");
    } catch (revalidationError) {
      console.error("CTA block delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/cta?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("cta");
}

export async function duplicateCtaBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: source, error } = await getSupabaseAdmin().from("cta_block_templates").select("*").eq("id", id).single();
  if (error || !source) throw new Error(error?.message || "البلوك غير موجود.");

  const nextRow = {
    name: `${source.name} - نسخة`,
    slug: `${source.slug}-copy-${Date.now()}`,
    description: source.description,
    variant: source.variant,
    style_preset: source.style_preset,
    status: "unpublished",
    config: source.config,
    sort_order: (source.sort_order ?? 0) + 1,
  };
  const provisionalIdentity = `duplicate:${id}:${crypto.randomUUID()}`;
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "cta_block_templates",
    leaseEntityIdentity: provisionalIdentity,
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `cta-block:duplicate:${id}`,
    mutate: async () => {
      const { data, error: insertError } = await getSupabaseAdmin()
        .from("cta_block_templates")
        .insert(nextRow)
        .select("id")
        .single();
      if (insertError || !data) throw new Error(insertError?.message ?? "تعذر نسخ البلوك.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "duplicate"),
    entityType: "content_block_template",
    entityId: coordinated.value.id,
    entityLabel: nextRow.name,
    metadata: { blockType: "cta", sourceId: id },
  }, actor);
  await revalidateBlockModulePaths("cta");
  if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/cta?notice=saved_with_media_sync_warning");
  }
}

export async function bulkCtaBlocks(formData: FormData) {
  const actor = await requireAdminSession();
  const action = parsePageBlockBulkAction(
    formData.get("bulk_action"),
    PAGE_BLOCK_BULK_ACTIONS,
  );
  const ids = parsePageBlockBulkIds(formData.getAll("ids"));

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide") {
    const status = action === "publish" ? "published" : "unpublished";
    const { error } = await getSupabaseAdmin().from("cta_block_templates").update({ status, updated_at: now }).in("id", ids);
    if (error) throw new Error(error.message);
  }

  let mediaSynchronization: MediaReferenceSynchronizationResult | null = null;
  if (action === "delete") {
    const { data: existingRows, error: lookupError } = await getSupabaseAdmin()
      .from("cta_block_templates")
      .select("id")
      .in("id", ids);
    if (lookupError) throw new Error(lookupError.message);

    const capturedIds = (existingRows ?? []).map((row) => Number(row.id));
    const cleanupIds = [...new Set([...capturedIds, ...ids])];
    const { error } = await getSupabaseAdmin()
      .from("cta_block_templates")
      .delete()
      .in("id", cleanupIds);
    if (error) throw new Error(error.message);

    mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      cleanupIds.map((cleanupId) => ({
        domainKey: "cta_block_templates",
        entityIdentity: cleanupId,
      })),
    );
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "content_block_template",
      action === "delete" ? "delete" : action === "publish" ? "publish" : "unpublish",
    ),
    entityType: "content_block_template",
    entityLabel: "cta_block_templates",
    metadata: { blockType: "cta", action, ids, count: ids.length },
  }, actor);
  if (mediaSynchronization?.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("cta");
    } catch (revalidationError) {
      console.error("CTA block bulk delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/cta?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("cta");
}
