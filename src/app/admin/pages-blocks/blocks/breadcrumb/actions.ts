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
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  cleanText,
  getStatus,
  PAGE_BLOCK_BULK_ACTIONS,
  parseFormBoolean,
  parseFormStatus,
  parseNumber,
  parsePageBlockBulkAction,
  parsePageBlockBulkIds,
  slugify,
} from "../../../../../lib/page-blocks/admin-utils";
import { revalidateBlockModulePaths } from "../../../../../lib/page-blocks/admin-revalidate";
import {
  parsePageIdsFromForm,
  syncBlockModulePageAssignments,
} from "../../../../../lib/page-blocks/sync-module-page-assignments";
import { revalidatePath } from "next/cache";
import { linkFieldFromFormData, hasSavedLinkField } from "../../../../../lib/admin/links/block-save";
import type { BreadcrumbBlockConfig, BreadcrumbBlockItem } from "../../../../../lib/page-blocks/configs";

function buildManualItems(formData: FormData): BreadcrumbBlockItem[] {
  const items: BreadcrumbBlockItem[] = [];
  for (let index = 0; index < 8; index += 1) {
    const label = cleanText(formData.get(`manual_item_${index}_label`));
    const linkData = linkFieldFromFormData(formData, `manual_item_${index}`);
    if (!label && !hasSavedLinkField(linkData)) continue;
    items.push({
      label: label || undefined,
      ...(linkData ? { link: linkData.link } : {}),
    });
  }
  return items;
}

function buildBreadcrumbConfig(formData: FormData): BreadcrumbBlockConfig {
  const source = cleanText(formData.get("source"));

  return {
    source: source === "manual" ? "manual" : "navigation",
    showHome: parseFormBoolean(formData, "show_home", false),
    currentLabelOverride: cleanText(formData.get("current_label_override")) || undefined,
    manualItems: buildManualItems(formData),
  };
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("breadcrumb_block_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query.maybeSingle();
  return !data;
}

export type CreateBreadcrumbBlockFormActionState = AdminFormActionState;

function createBreadcrumbBlockFailure(
  revision: number,
  message: string,
  field?: "name" | "slug",
): CreateBreadcrumbBlockFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء بلوك Breadcrumb",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function createBreadcrumbBlockSuccess(
  revision: number,
  id: number,
  mediaWarning: boolean,
  infrastructureWarning?: string,
): CreateBreadcrumbBlockFormActionState {
  const warning = mediaWarning || Boolean(infrastructureWarning);
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء بلوك Breadcrumb مع تنبيه" : "تم إنشاء بلوك Breadcrumb",
    message:
      infrastructureWarning ??
      (mediaWarning
        ? "تم إنشاء البلوك، لكن مزامنة مراجع الوسائط تحتاج إلى مراجعة."
        : "تم إنشاء البلوك كغير منشور بنجاح."),
    code: warning ? "created_with_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/blocks/breadcrumb/${id}${mediaWarning ? "?notice=saved_with_media_sync_warning" : ""}`,
    savedRevision: `${id}:${revision}`,
  };
}

export async function createBreadcrumbBlock(
  previousState: CreateBreadcrumbBlockFormActionState,
  formData: FormData,
): Promise<CreateBreadcrumbBlockFormActionState> {
  const revision = previousState.revision + 1;
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name) return createBreadcrumbBlockFailure(revision, "اسم البلوك مطلوب.", "name");
  if (!slug) return createBreadcrumbBlockFailure(revision, "اكتب slug صالحًا للبلوك.", "slug");
  if (!(await ensureUniqueSlug(slug))) {
    return createBreadcrumbBlockFailure(revision, "الـ slug مستخدم بالفعل.", "slug");
  }

  let createdId: number | null = null;
  let mediaWarning = false;
  try {
    const nextRow = {
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant: cleanText(formData.get("variant")) || "hero-inline",
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: parseFormStatus(formData),
      config: buildBreadcrumbConfig(formData),
    };
    const provisionalIdentity = `create:${crypto.randomUUID()}`;
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "breadcrumb_block_templates",
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `breadcrumb-block:create:${provisionalIdentity}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("breadcrumb_block_templates")
          .insert(nextRow)
          .select("id")
          .single<{ id: number }>();
        if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء بلوك Breadcrumb.");
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
      metadata: { blockType: "breadcrumb", slug },
    }, actor);
    await revalidateBlockModulePaths("breadcrumb");
    return createBreadcrumbBlockSuccess(revision, data.id, mediaWarning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء بلوك Breadcrumb. حاول مرة أخرى.";
    if (createdId) {
      return createBreadcrumbBlockSuccess(
        revision,
        createdId,
        mediaWarning,
        `تم إنشاء البلوك، لكن تعذر إكمال التحقق اللاحق: ${message}`,
      );
    }
    return createBreadcrumbBlockFailure(
      revision,
      message,
      message.toLowerCase().includes("slug") ? "slug" : undefined,
    );
  }
}

export async function updateBreadcrumbBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!id || !name || !slug) throw new Error("بيانات البلوك غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  const nextRow = {
    name,
    slug,
    description: cleanText(formData.get("description")) || null,
    variant: cleanText(formData.get("variant")) || "hero-inline",
    style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
    status: parseFormStatus(formData),
    config: buildBreadcrumbConfig(formData),
    updated_at: new Date().toISOString(),
  };
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "breadcrumb_block_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `breadcrumb-block:update:${id}`,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("breadcrumb_block_templates")
        .update(nextRow)
        .eq("id", id)
        .select("id")
        .maybeSingle<{ id: number }>();
      if (error || !data) throw new Error(error?.message ?? "Unable to update breadcrumb block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncBlockModulePageAssignments("breadcrumb", id, parsePageIdsFromForm(formData), actor);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { blockType: "breadcrumb", slug },
  }, actor);
  await revalidateBlockModulePaths("breadcrumb");
  revalidatePath(`/admin/pages-blocks/blocks/breadcrumb/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/breadcrumb/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`);
}

export async function toggleBreadcrumbBlockStatus(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "unpublished");
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
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
    metadata: { blockType: "breadcrumb", status: nextStatus },
  }, actor);
  await revalidateBlockModulePaths("breadcrumb");
}

export async function deleteBreadcrumbBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle<{ id: number }>();
  if (lookupError) throw new Error(lookupError.message);
  const cleanupIdentity = existing?.id ?? id;

  const { error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .delete()
    .eq("id", cleanupIdentity);
  if (error) throw new Error(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "delete"),
    entityType: "content_block_template",
    entityId: cleanupIdentity,
    metadata: { blockType: "breadcrumb" },
  }, actor);
  const mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [],
    null,
    [{ domainKey: "breadcrumb_block_templates", entityIdentity: cleanupIdentity }],
  );
  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("breadcrumb");
    } catch (revalidationError) {
      console.error("Breadcrumb block delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/breadcrumb?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("breadcrumb");
}

export async function duplicateBreadcrumbBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: source, error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .select("*")
    .eq("id", id)
    .single();

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
    domainKey: "breadcrumb_block_templates",
    leaseEntityIdentity: provisionalIdentity,
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `breadcrumb-block:duplicate:${id}`,
    mutate: async () => {
      const { data, error: insertError } = await getSupabaseAdmin()
        .from("breadcrumb_block_templates")
        .insert(nextRow)
        .select("id")
        .single<{ id: number }>();
      if (insertError || !data) throw new Error(insertError?.message ?? "Unable to duplicate breadcrumb block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "duplicate"),
    entityType: "content_block_template",
    entityId: coordinated.value.id,
    entityLabel: nextRow.name,
    metadata: { blockType: "breadcrumb", sourceId: id },
  }, actor);
  await revalidateBlockModulePaths("breadcrumb");
  if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/breadcrumb?notice=saved_with_media_sync_warning");
  }
}

export async function bulkBreadcrumbBlocks(formData: FormData) {
  const actor = await requireAdminSession();
  const action = parsePageBlockBulkAction(
    formData.get("bulk_action"),
    PAGE_BLOCK_BULK_ACTIONS,
  );
  const ids = parsePageBlockBulkIds(formData.getAll("ids"));

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide") {
    const status = action === "publish" ? "published" : "unpublished";
    const { error } = await getSupabaseAdmin()
      .from("breadcrumb_block_templates")
      .update({ status, updated_at: now })
      .in("id", ids);
    if (error) throw new Error(error.message);
  }

  let mediaSynchronization: MediaReferenceSynchronizationResult | null = null;
  if (action === "delete") {
    const { data: existingRows, error: lookupError } = await getSupabaseAdmin()
      .from("breadcrumb_block_templates")
      .select("id")
      .in("id", ids);
    if (lookupError) throw new Error(lookupError.message);

    const capturedIds = (existingRows ?? []).map((row) => Number(row.id));
    const cleanupIds = [...new Set([...capturedIds, ...ids])];
    const { error } = await getSupabaseAdmin()
      .from("breadcrumb_block_templates")
      .delete()
      .in("id", cleanupIds);
    if (error) throw new Error(error.message);

    mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      cleanupIds.map((cleanupId) => ({
        domainKey: "breadcrumb_block_templates",
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
    entityLabel: "breadcrumb_block_templates",
    metadata: { blockType: "breadcrumb", action, ids, count: ids.length },
  }, actor);
  if (mediaSynchronization?.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("breadcrumb");
    } catch (revalidationError) {
      console.error("Breadcrumb bulk delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/breadcrumb?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("breadcrumb");
}

export async function getBreadcrumbBlockRows() {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .select("id,name,slug,description,variant,status")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    description: row.description ?? null,
  }));
}
