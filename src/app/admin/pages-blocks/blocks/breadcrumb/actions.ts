"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
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
  parseFormBoolean,
  parseNumber,
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

export async function createBreadcrumbBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name || !slug) throw new Error("اسم البلوك والـ slug مطلوبين.");
  if (!(await ensureUniqueSlug(slug))) throw new Error("الـ slug مستخدم بالفعل.");

  const nextRow = {
    name,
    slug,
    description: cleanText(formData.get("description")) || null,
    variant: cleanText(formData.get("variant")) || "hero-inline",
    style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
    status: getStatus(cleanText(formData.get("status")) || "draft"),
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
      if (error || !data) throw new Error(error?.message ?? "Unable to create breadcrumb block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  const data = coordinated.value;

  await revalidateBlockModulePaths("breadcrumb");
  redirect(`/admin/pages-blocks/blocks/breadcrumb/${data.id}${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "?notice=saved_with_media_sync_warning" : ""}`);
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
    status: getStatus(cleanText(formData.get("status")) || "draft"),
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

  await syncBlockModulePageAssignments("breadcrumb", id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("breadcrumb");
  revalidatePath(`/admin/pages-blocks/blocks/breadcrumb/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/breadcrumb/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`);
}

export async function toggleBreadcrumbBlockStatus(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "draft");
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await revalidateBlockModulePaths("breadcrumb");
}

export async function deleteBreadcrumbBlock(formData: FormData) {
  await requireAdminSession();
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
    status: "draft",
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
  await revalidateBlockModulePaths("breadcrumb");
  if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/breadcrumb?notice=saved_with_media_sync_warning");
  }
}

export async function bulkBreadcrumbBlocks(formData: FormData) {
  await requireAdminSession();
  const action = cleanText(formData.get("bulk_action"));
  const ids = formData
    .getAll("ids")
    .flatMap((value) => String(value).split(","))
    .map((value) => Number(value))
    .filter(Boolean);

  if (!ids.length) return;

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide" || action === "draft") {
    const status = action === "publish" ? "published" : action === "hide" ? "unpublished" : "draft";
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
