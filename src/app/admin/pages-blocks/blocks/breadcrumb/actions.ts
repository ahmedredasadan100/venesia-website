"use server";

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
import type { BreadcrumbBlockConfig } from "../../../../../lib/page-blocks/configs";

function buildBreadcrumbConfig(formData: FormData): BreadcrumbBlockConfig {
  const source = cleanText(formData.get("source"));

  return {
    source: source === "manual" ? "manual" : "navigation",
    showHome: parseFormBoolean(formData, "show_home", false),
    currentLabelOverride: cleanText(formData.get("current_label_override")) || undefined,
    manualItems: cleanText(formData.get("manual_items"))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, href] = line.split("|").map((part) => part.trim());
        return { label: label || line, href: href || undefined };
      }),
  };
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("breadcrumb_block_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query.maybeSingle();
  return !data;
}

export async function createBreadcrumbBlock(formData: FormData) {
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name || !slug) throw new Error("اسم البلوك والـ slug مطلوبين.");
  if (!(await ensureUniqueSlug(slug))) throw new Error("الـ slug مستخدم بالفعل.");

  const { data, error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .insert({
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant: cleanText(formData.get("variant")) || "hero-inline",
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      config: buildBreadcrumbConfig(formData),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await revalidateBlockModulePaths("breadcrumb");
  redirect(`/admin/pages-blocks/blocks/breadcrumb/${data.id}`);
}

export async function updateBreadcrumbBlock(formData: FormData) {
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!id || !name || !slug) throw new Error("بيانات البلوك غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  const { error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .update({
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant: cleanText(formData.get("variant")) || "hero-inline",
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      config: buildBreadcrumbConfig(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await syncBlockModulePageAssignments("breadcrumb", id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("breadcrumb");
  revalidatePath(`/admin/pages-blocks/blocks/breadcrumb/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/breadcrumb/${id}?saved=1`);
}

export async function toggleBreadcrumbBlockStatus(formData: FormData) {
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
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin().from("breadcrumb_block_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await revalidateBlockModulePaths("breadcrumb");
}

export async function duplicateBreadcrumbBlock(formData: FormData) {
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: source, error } = await getSupabaseAdmin()
    .from("breadcrumb_block_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !source) throw new Error(error?.message || "البلوك غير موجود.");

  const { error: insertError } = await getSupabaseAdmin().from("breadcrumb_block_templates").insert({
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
  await revalidateBlockModulePaths("breadcrumb");
}

export async function bulkBreadcrumbBlocks(formData: FormData) {
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

  if (action === "delete") {
    const { error } = await getSupabaseAdmin().from("breadcrumb_block_templates").delete().in("id", ids);
    if (error) throw new Error(error.message);
  }

  await revalidateBlockModulePaths("breadcrumb");
}
