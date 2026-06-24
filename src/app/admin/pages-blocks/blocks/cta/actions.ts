"use server";

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
import type { CtaBlockConfig } from "../../../../../lib/page-blocks/configs";

function buildCtaConfig(formData: FormData): CtaBlockConfig {
  return {
    eyebrow: cleanText(formData.get("eyebrow")),
    title: cleanText(formData.get("title")),
    highlight: cleanText(formData.get("highlight")),
    description: cleanText(formData.get("description")),
    primaryCta: {
      label: cleanText(formData.get("primary_cta_label")),
      href: cleanText(formData.get("primary_cta_href")),
      target: cleanText(formData.get("primary_cta_target")) === "_blank" ? "_blank" : "_self",
    },
    secondaryCta: {
      label: cleanText(formData.get("secondary_cta_label")),
      href: cleanText(formData.get("secondary_cta_href")),
      target: cleanText(formData.get("secondary_cta_target")) === "_blank" ? "_blank" : "_self",
    },
    backgroundImage: cleanText(formData.get("background_image")),
    backgroundStyle: (cleanText(formData.get("background_style")) || "dark") as CtaBlockConfig["backgroundStyle"],
  };
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("cta_block_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query.maybeSingle();
  return !data;
}

export async function createCtaBlock(formData: FormData) {
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name || !slug) throw new Error("اسم البلوك والـ slug مطلوبين.");
  if (!(await ensureUniqueSlug(slug))) throw new Error("الـ slug مستخدم بالفعل.");

  const { data, error } = await getSupabaseAdmin()
    .from("cta_block_templates")
    .insert({
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant: cleanText(formData.get("variant")) || "band",
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      config: buildCtaConfig(formData),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await revalidateBlockModulePaths("cta");
  redirect(`/admin/pages-blocks/blocks/cta/${data.id}`);
}

export async function updateCtaBlock(formData: FormData) {
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!id || !name || !slug) throw new Error("بيانات البلوك غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  const { error } = await getSupabaseAdmin()
    .from("cta_block_templates")
    .update({
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant: cleanText(formData.get("variant")) || "band",
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      config: buildCtaConfig(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await syncBlockModulePageAssignments("cta", id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("cta");
  redirect(`/admin/pages-blocks/blocks/cta/${id}?saved=1`);
}

export async function toggleCtaBlockStatus(formData: FormData) {
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "draft");
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("cta_block_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await revalidateBlockModulePaths("cta");
}

export async function deleteCtaBlock(formData: FormData) {
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin().from("cta_block_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await revalidateBlockModulePaths("cta");
}

export async function duplicateCtaBlock(formData: FormData) {
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: source, error } = await getSupabaseAdmin().from("cta_block_templates").select("*").eq("id", id).single();
  if (error || !source) throw new Error(error?.message || "البلوك غير موجود.");

  const { error: insertError } = await getSupabaseAdmin().from("cta_block_templates").insert({
    name: `${source.name} - نسخة`,
    slug: `${source.slug}-copy-${Date.now()}`,
    description: source.description,
    variant: source.variant,
    style_preset: source.style_preset,
    status: "draft",
    config: source.config,
    sort_order: (source.sort_order ?? 0) + 1,
  });

  if (insertError) throw new Error(insertError.message);
  await revalidateBlockModulePaths("cta");
}

export async function bulkCtaBlocks(formData: FormData) {
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
    const { error } = await getSupabaseAdmin().from("cta_block_templates").update({ status, updated_at: now }).in("id", ids);
    if (error) throw new Error(error.message);
  }

  if (action === "delete") {
    const { error } = await getSupabaseAdmin().from("cta_block_templates").delete().in("id", ids);
    if (error) throw new Error(error.message);
  }

  await revalidateBlockModulePaths("cta");
}

export type CtaBlockRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  variant: string;
  status: string;
  updated_at: string;
};

export async function getCtaBlockRows(): Promise<CtaBlockRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("cta_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CtaBlockRow[];
}
