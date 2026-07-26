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
  parseNumber,
  slugify,
} from "../../../../../lib/page-blocks/admin-utils";
import { revalidateBlockModulePaths } from "../../../../../lib/page-blocks/admin-revalidate";
import {
  parsePageIdsFromForm,
  syncBlockModulePageAssignments,
} from "../../../../../lib/page-blocks/sync-module-page-assignments";
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

function buildCardsConfig(formData: FormData): CardsBlockConfig {
  const items = buildCardsItems(formData);

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

export async function createCardsBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name || !slug) throw new Error("اسم البلوك والـ slug مطلوبين.");
  if (!(await ensureUniqueSlug(slug))) throw new Error("الـ slug مستخدم بالفعل.");

  const nextRow = {
    name,
    slug,
    description: cleanText(formData.get("description")) || null,
    variant: cleanText(formData.get("variant")) || "glass",
    style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
    status: getStatus(cleanText(formData.get("status")) || "draft"),
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
        .single<{ id: number }>();
      if (error || !data) throw new Error(error?.message ?? "Unable to create cards block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  const data = coordinated.value;

  await revalidateBlockModulePaths("cards");
  redirect(`/admin/pages-blocks/blocks/cards/${data.id}${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "?notice=saved_with_media_sync_warning" : ""}`);
}

export async function updateCardsBlock(formData: FormData) {
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
    variant: cleanText(formData.get("variant")) || "glass",
    style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
    status: getStatus(cleanText(formData.get("status")) || "draft"),
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
        .maybeSingle<{ id: number }>();
      if (error || !data) throw new Error(error?.message ?? "Unable to update cards block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncBlockModulePageAssignments("cards", id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("cards");
  redirect(`/admin/pages-blocks/blocks/cards/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`);
}

export async function toggleCardsBlockStatus(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "draft");
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await revalidateBlockModulePaths("cards");
}

export async function deleteCardsBlock(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle<{ id: number }>();
  if (lookupError) throw new Error(lookupError.message);
  const cleanupIdentity = existing?.id ?? id;

  const { error } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .delete()
    .eq("id", cleanupIdentity);
  if (error) throw new Error(error.message);

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
    status: "draft",
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
        .single<{ id: number }>();
      if (insertError || !data) throw new Error(insertError?.message ?? "Unable to duplicate cards block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  await revalidateBlockModulePaths("cards");
  if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/cards?notice=saved_with_media_sync_warning");
  }
}

export async function bulkCardsBlocks(formData: FormData) {
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

export type CardsBlockRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  variant: string;
  status: string;
  updated_at: string;
};

export async function getCardsBlockRows(): Promise<CardsBlockRow[]> {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("cards_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CardsBlockRow[];
}
