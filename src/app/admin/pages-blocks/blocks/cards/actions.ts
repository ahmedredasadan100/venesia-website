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
import type { Tables, TablesInsert, TablesUpdate } from "../../../../../lib/database.types";
import type { CardsBlockConfig, CardsBlockItem } from "../../../../../lib/page-blocks/configs";
import { linkFieldFromFormData, hasSavedLinkField } from "../../../../../lib/admin/links/block-save";

function buildCardsItems(formData: FormData): CardsBlockItem[] {
  const rawItems = cleanText(formData.get("items_json"));
  if (rawItems) {
    try {
      const parsed = JSON.parse(rawItems) as CardsBlockItem[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to structured fields
    }
  }

  const items: CardsBlockItem[] = [];
  for (let index = 0; index < 12; index += 1) {
    const title = cleanText(formData.get(`item_${index}_title`));
    const body = cleanText(formData.get(`item_${index}_body`));
    const icon = cleanText(formData.get(`item_${index}_icon`));
    const linkData = linkFieldFromFormData(formData, `item_${index}`);
    if (!title && !body && !icon && !hasSavedLinkField(linkData)) continue;
    items.push({
      title: title || undefined,
      body: body || undefined,
      icon: icon || undefined,
      ...(linkData ? { link: linkData.link, target: linkData.target } : {}),
    });
  }
  return items;
}

function assertValidCardsItems(items: CardsBlockItem[]) {
  if (!items.length) {
    throw new Error("أضف بطاقة واحدة على الأقل بعنوان ووصف مختصر.");
  }

  items.forEach((item, index) => {
    if (!item.title?.trim() || !item.body?.trim()) {
      throw new Error(`البطاقة ${index + 1} تحتاج عنوانًا ووصفًا مختصرًا.`);
    }
  });
}

function buildCardsConfig(formData: FormData): CardsBlockConfig {
  const items = buildCardsItems(formData);
  assertValidCardsItems(items);

  const columns = parseNumber(formData.get("columns"), 3);
  const normalizedColumns = columns === 2 || columns === 4 ? columns : 3;

  return {
    eyebrow: cleanText(formData.get("eyebrow")),
    title: cleanText(formData.get("title")),
    description: cleanText(formData.get("description")),
    columns: normalizedColumns as 2 | 3 | 4,
    items,
  };
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("cards_block_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query.maybeSingle();
  return !data;
}

export type CreateCardsBlockFormActionState = AdminFormActionState;

function createCardsBlockFailure(
  revision: number,
  message: string,
  field?: "name" | "slug",
): CreateCardsBlockFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء بلوك الكروت",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function createCardsBlockSuccess(
  revision: number,
  id: number,
  mediaWarning: boolean,
  infrastructureWarning?: string,
): CreateCardsBlockFormActionState {
  const warning = mediaWarning || Boolean(infrastructureWarning);
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء بلوك الكروت مع تنبيه" : "تم إنشاء بلوك الكروت",
    message:
      infrastructureWarning ??
      (mediaWarning
        ? "تم إنشاء البلوك، لكن مزامنة مراجع الوسائط تحتاج إلى مراجعة."
        : "تم إنشاء البلوك كغير منشور بنجاح."),
    code: warning ? "created_with_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/blocks/cards/${id}${mediaWarning ? "?notice=saved_with_media_sync_warning" : ""}`,
    savedRevision: `${id}:${revision}`,
  };
}

export async function createCardsBlock(
  previousState: CreateCardsBlockFormActionState,
  formData: FormData,
): Promise<CreateCardsBlockFormActionState> {
  const revision = previousState.revision + 1;
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name) return createCardsBlockFailure(revision, "اسم البلوك مطلوب.", "name");
  if (!slug) return createCardsBlockFailure(revision, "اكتب slug صالحًا للبلوك.", "slug");
  if (!(await ensureUniqueSlug(slug))) {
    return createCardsBlockFailure(revision, "الـ slug مستخدم بالفعل.", "slug");
  }

  let createdId: number | null = null;
  let mediaWarning = false;
  try {
    const nextRow: TablesInsert<"cards_block_templates"> = {
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant: cleanText(formData.get("variant")) || "glass",
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: parseFormStatus(formData),
      config: buildCardsConfig(formData),
    };
    const provisionalIdentity = `create:${crypto.randomUUID()}`;
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "cards_block_templates",
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `cards-block:create:${provisionalIdentity}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("cards_block_templates")
          .insert(nextRow)
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء بلوك الكروت.");
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
      metadata: { blockType: "cards", slug },
    }, actor);
    await revalidateBlockModulePaths("cards");
    return createCardsBlockSuccess(revision, data.id, mediaWarning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء بلوك الكروت. حاول مرة أخرى.";
    if (createdId) {
      return createCardsBlockSuccess(
        revision,
        createdId,
        mediaWarning,
        `تم إنشاء البلوك، لكن تعذر إكمال التحقق اللاحق: ${message}`,
      );
    }
    return createCardsBlockFailure(
      revision,
      message,
      message.toLowerCase().includes("slug") ? "slug" : undefined,
    );
  }
}

export async function updateCardsBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!id || !name || !slug) throw new Error("بيانات البلوك غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  const nextRow: TablesUpdate<"cards_block_templates"> = {
    name,
    slug,
    description: cleanText(formData.get("description")) || null,
    variant: cleanText(formData.get("variant")) || "glass",
    style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
    status: parseFormStatus(formData),
    config: buildCardsConfig(formData),
    updated_at: new Date().toISOString(),
  };
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "cards_block_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `cards-block:update:${id}`,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("cards_block_templates")
        .update(nextRow)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "Unable to update cards block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncBlockModulePageAssignments("cards", id, parsePageIdsFromForm(formData), actor);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { blockType: "cards", slug },
  }, actor);
  await revalidateBlockModulePaths("cards");
  redirect(`/admin/pages-blocks/blocks/cards/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`);
}

export async function toggleCardsBlockStatus(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "unpublished");
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("cards_block_templates")
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
    metadata: { blockType: "cards", status: nextStatus },
  }, actor);
  await revalidateBlockModulePaths("cards");
}

export async function deleteCardsBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const cleanupIdentity = existing?.id ?? id;

  const { error } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .delete()
    .eq("id", cleanupIdentity);
  if (error) throw new Error(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "delete"),
    entityType: "content_block_template",
    entityId: cleanupIdentity,
    metadata: { blockType: "cards" },
  }, actor);
  const mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [],
    null,
    [{ domainKey: "cards_block_templates", entityIdentity: cleanupIdentity }],
  );
  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("cards");
    } catch (revalidationError) {
      console.error("Cards block delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/cards?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("cards");
}

export async function duplicateCardsBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: source, error } = await getSupabaseAdmin().from("cards_block_templates").select("*").eq("id", id).single();
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
    domainKey: "cards_block_templates",
    leaseEntityIdentity: provisionalIdentity,
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `cards-block:duplicate:${id}`,
    mutate: async () => {
      const { data, error: insertError } = await getSupabaseAdmin()
        .from("cards_block_templates")
        .insert(nextRow)
        .select("id")
        .single();
      if (insertError || !data) throw new Error(insertError?.message ?? "Unable to duplicate cards block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "duplicate"),
    entityType: "content_block_template",
    entityId: coordinated.value.id,
    entityLabel: nextRow.name,
    metadata: { blockType: "cards", sourceId: id },
  }, actor);
  await revalidateBlockModulePaths("cards");
  if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/cards?notice=saved_with_media_sync_warning");
  }
}

export async function bulkCardsBlocks(formData: FormData) {
  const actor = await requireAdminSession();
  const action = parsePageBlockBulkAction(
    formData.get("bulk_action"),
    PAGE_BLOCK_BULK_ACTIONS,
  );
  const ids = parsePageBlockBulkIds(formData.getAll("ids"));

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide") {
    const status = action === "publish" ? "published" : "unpublished";
    const { error } = await getSupabaseAdmin().from("cards_block_templates").update({ status, updated_at: now }).in("id", ids);
    if (error) throw new Error(error.message);
  }

  let mediaSynchronization: MediaReferenceSynchronizationResult | null = null;
  if (action === "delete") {
    const { data: existingRows, error: lookupError } = await getSupabaseAdmin()
      .from("cards_block_templates")
      .select("id")
      .in("id", ids);
    if (lookupError) throw new Error(lookupError.message);

    const capturedIds = (existingRows ?? []).map((row) => Number(row.id));
    const cleanupIds = [...new Set([...capturedIds, ...ids])];
    const { error } = await getSupabaseAdmin()
      .from("cards_block_templates")
      .delete()
      .in("id", cleanupIds);
    if (error) throw new Error(error.message);

    mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      cleanupIds.map((cleanupId) => ({
        domainKey: "cards_block_templates",
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
    entityLabel: "cards_block_templates",
    metadata: { blockType: "cards", action, ids, count: ids.length },
  }, actor);
  if (mediaSynchronization?.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("cards");
    } catch (revalidationError) {
      console.error("Cards block bulk delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/cards?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("cards");
}

export type CardsBlockRow = Pick<
  Tables<"cards_block_templates">,
  "id" | "name" | "slug" | "description" | "variant" | "status" | "updated_at"
>;

export async function getCardsBlockRows(): Promise<CardsBlockRow[]> {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
