"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import type { AdminFormActionState } from "../../../../../lib/admin/form-runtime";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  synchronizeMediaReferenceWriteScopesAfterDomainMutation,
  type MediaReferenceSynchronizationResult,
} from "../../../../../lib/admin/media-catalog/synchronization";
import {
  buildFeaturedModuleConfig,
  createDefaultFeaturedModuleConfig,
  FeaturedModuleConfigValidationError,
  isPersistedFeaturedModuleConfigEqual,
} from "../../../../../lib/featured-modules/config";
import {
  FEATURED_PRESENTATION_VARIANTS,
  type FeaturedPresentationVariant,
} from "../../../../../lib/featured-modules/contract";
import { loadTopicFilterOptionsForAdmin } from "../../../../../lib/feed-modules/load-topic-filter-options";
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
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

function readVariant(value: FormDataEntryValue | null): FeaturedPresentationVariant {
  const variant = cleanText(value);
  return FEATURED_PRESENTATION_VARIANTS.includes(variant as FeaturedPresentationVariant)
    ? variant as FeaturedPresentationVariant
    : "editorial";
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("featured_module_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Featured slug lookup failed: ${error.message}`);
  return !data;
}

export type CreateFeaturedModuleFormActionState = AdminFormActionState;

function createFailure(
  revision: number,
  message: string,
  field?: "name" | "slug" | "variant",
): CreateFeaturedModuleFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء Featured",
    message,
    ...(field ? { fieldErrors: { [field]: [message] }, focusTarget: field } : {}),
  };
}

function createSuccess(
  revision: number,
  id: number,
  mediaWarning: boolean,
  infrastructureWarning?: string,
): CreateFeaturedModuleFormActionState {
  const warning = mediaWarning || Boolean(infrastructureWarning);
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء Featured مع تنبيه" : "تم إنشاء Featured",
    message: infrastructureWarning ?? (mediaWarning
      ? "تم إنشاء الموديول، لكن مزامنة مراجع الوسائط تحتاج إلى مراجعة."
      : "تم إنشاء الموديول كغير منشور بنجاح."),
    code: warning ? "created_with_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/blocks/featured/${id}${mediaWarning ? "?notice=saved_with_media_sync_warning" : ""}`,
    savedRevision: `${id}:${revision}`,
  };
}

export async function createFeaturedModule(
  previousState: CreateFeaturedModuleFormActionState,
  formData: FormData,
): Promise<CreateFeaturedModuleFormActionState> {
  const revision = previousState.revision + 1;
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);
  const variant = readVariant(formData.get("variant"));
  if (!name) return createFailure(revision, "اسم الموديول مطلوب.", "name");
  if (!slug) return createFailure(revision, "اكتب slug صالحًا للموديول.", "slug");
  if (!(await ensureUniqueSlug(slug))) return createFailure(revision, "الـ slug مستخدم بالفعل.", "slug");

  const options = await loadTopicFilterOptionsForAdmin();
  const firstCategory = options.categories[0]?.slug;
  if (!firstCategory) {
    return createFailure(revision, "لا يوجد تصنيف منشور يمكن استخدامه كمصدر افتراضي.");
  }
  const config = createDefaultFeaturedModuleConfig(firstCategory, variant);
  const nextRow = {
    name,
    slug,
    description: cleanText(formData.get("description")) || null,
    status: "unpublished",
    config,
  };
  let createdId: number | null = null;
  let mediaWarning = false;
  try {
    const provisionalIdentity = `create:${crypto.randomUUID()}`;
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "featured_module_templates",
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `featured-module:create:${provisionalIdentity}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("featured_module_templates")
          .insert(nextRow)
          .select("id,config")
          .single();
        if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء Featured.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
    createdId = coordinated.value.id;
    mediaWarning = coordinated.mediaSynchronization.status === "saved_with_media_sync_warning";
    if (!isPersistedFeaturedModuleConfigEqual(coordinated.value.config, config)) {
      throw new Error("قراءة الإعدادات المحفوظة لم تطابق الطلب.");
    }
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("content_block_template", "create"),
      entityType: "content_block_template",
      entityId: createdId,
      entityLabel: name,
      metadata: { blockType: "featured", slug },
    }, actor);
    await revalidateBlockModulePaths("featured");
    return createSuccess(revision, createdId, mediaWarning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء Featured.";
    return createdId
      ? createSuccess(revision, createdId, mediaWarning, `تم الإنشاء، لكن تعذر إكمال التحقق اللاحق: ${message}`)
      : createFailure(revision, message, message.toLowerCase().includes("slug") ? "slug" : undefined);
  }
}

export async function updateFeaturedModule(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);
  if (!id || !name || !slug) throw new Error("بيانات الموديول غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  let config: ReturnType<typeof buildFeaturedModuleConfig>;
  try {
    config = buildFeaturedModuleConfig(formData);
  } catch (error) {
    if (error instanceof FeaturedModuleConfigValidationError) throw new Error(error.message);
    throw error;
  }
  const nextRow = {
    name,
    slug,
    description: cleanText(formData.get("description")) || null,
    status: parseFormStatus(formData),
    config,
    updated_at: new Date().toISOString(),
  };
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "featured_module_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `featured-module:update:${id}`,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("featured_module_templates")
        .update(nextRow)
        .eq("id", id)
        .select("id,config")
        .maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "تعذر تحديث Featured.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  if (!isPersistedFeaturedModuleConfigEqual(coordinated.value.config, config)) {
    throw new Error("قراءة الإعدادات المحفوظة لم تطابق الطلب؛ لم يتم إعلان نجاح الحفظ.");
  }
  await syncBlockModulePageAssignments("featured", id, parsePageIdsFromForm(formData), actor);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { blockType: "featured", slug },
  }, actor);
  await revalidateBlockModulePaths("featured");
  revalidatePath(`/admin/pages-blocks/blocks/featured/${id}`, "page");
  redirect(withModuleEditorReturnContextFromForm(
    `/admin/pages-blocks/blocks/featured/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`,
    formData,
  ));
}

export async function toggleFeaturedModuleStatus(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const status = getStatus(cleanText(formData.get("next_status")) || "unpublished");
  if (!id) throw new Error("معرّف الموديول مفقود.");
  const { error } = await getSupabaseAdmin().from("featured_module_templates")
    .update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", status === "published" ? "publish" : "unpublish"),
    entityType: "content_block_template",
    entityId: id,
    metadata: { blockType: "featured", status },
  }, actor);
  await revalidateBlockModulePaths("featured");
}

export async function deleteFeaturedModule(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف الموديول مفقود.");
  const { error } = await getSupabaseAdmin().from("featured_module_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "delete"),
    entityType: "content_block_template",
    entityId: id,
    metadata: { blockType: "featured" },
  }, actor);
  const synchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [], null, [{ domainKey: "featured_module_templates", entityIdentity: id }],
  );
  await revalidateBlockModulePaths("featured");
  if (synchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/featured?notice=saved_with_media_sync_warning");
  }
}

export async function duplicateFeaturedModule(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف الموديول مفقود.");
  const { data: source, error } = await getSupabaseAdmin().from("featured_module_templates")
    .select("*").eq("id", id).single();
  if (error || !source) throw new Error(error?.message ?? "الموديول غير موجود.");
  const nextRow = {
    name: `${source.name} - نسخة`,
    slug: `${source.slug}-copy-${Date.now()}`,
    description: source.description,
    status: "unpublished",
    config: source.config,
    sort_order: (source.sort_order ?? 0) + 1,
  };
  const provisionalIdentity = `duplicate:${id}:${crypto.randomUUID()}`;
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "featured_module_templates",
    leaseEntityIdentity: provisionalIdentity,
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `featured-module:duplicate:${id}`,
    mutate: async () => {
      const { data, error: insertError } = await getSupabaseAdmin().from("featured_module_templates")
        .insert(nextRow).select("id").single();
      if (insertError || !data) throw new Error(insertError?.message ?? "تعذر نسخ Featured.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "duplicate"),
    entityType: "content_block_template",
    entityId: coordinated.value.id,
    entityLabel: nextRow.name,
    metadata: { blockType: "featured", sourceId: id },
  }, actor);
  await revalidateBlockModulePaths("featured");
  if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/featured?notice=saved_with_media_sync_warning");
  }
}

export async function bulkFeaturedModules(formData: FormData) {
  const actor = await requireAdminSession();
  const action = parsePageBlockBulkAction(formData.get("bulk_action"), PAGE_BLOCK_BULK_ACTIONS);
  const ids = parsePageBlockBulkIds(formData.getAll("ids"));
  let synchronization: MediaReferenceSynchronizationResult | null = null;
  if (action === "publish" || action === "hide") {
    const status = action === "publish" ? "published" : "unpublished";
    const { error } = await getSupabaseAdmin().from("featured_module_templates")
      .update({ status, updated_at: new Date().toISOString() }).in("id", ids);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await getSupabaseAdmin().from("featured_module_templates").delete().in("id", ids);
    if (error) throw new Error(error.message);
    synchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [], null, ids.map((entityIdentity) => ({ domainKey: "featured_module_templates", entityIdentity })),
    );
  }
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", action === "delete" ? "delete" : action === "publish" ? "publish" : "unpublish"),
    entityType: "content_block_template",
    entityLabel: "featured_module_templates",
    metadata: { blockType: "featured", action, ids, count: ids.length },
  }, actor);
  await revalidateBlockModulePaths("featured");
  if (synchronization?.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/featured?notice=saved_with_media_sync_warning");
  }
}
