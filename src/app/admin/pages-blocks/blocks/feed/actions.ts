"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";

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
import { revalidatePath } from "next/cache";
import { buildFeedModuleConfig } from "../../../../../lib/feed-modules/parse-feed-config";
import {
  isSeriesAllowedForCategory,
  loadTopicFilterOptionsForAdmin,
} from "../../../../../lib/feed-modules/load-topic-filter-options";
import { TOPICS_FEED_TYPES, type TopicsFeedType } from "../../../../../lib/feed-modules/types";

function readFeedType(value: FormDataEntryValue | null): TopicsFeedType {
  const feedType = cleanText(value);
  return TOPICS_FEED_TYPES.includes(feedType as TopicsFeedType) ? (feedType as TopicsFeedType) : "latest";
}

async function sanitizeFeedModuleConfig(formData: FormData) {
  const config = buildFeedModuleConfig(formData);

  if (!config.query.categorySlug) {
    config.query.seriesSlug = null;
    return config;
  }

  if (config.query.seriesSlug) {
    const filterOptions = await loadTopicFilterOptionsForAdmin();
    if (!isSeriesAllowedForCategory(filterOptions, config.query.categorySlug, config.query.seriesSlug)) {
      config.query.seriesSlug = null;
    }
  }

  return config;
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("feed_module_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query.maybeSingle();
  return !data;
}

export async function createFeedModule(formData: FormData) {
  await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name || !slug) throw new Error("اسم الموديول والـ slug مطلوبين.");
  if (!(await ensureUniqueSlug(slug))) throw new Error("الـ slug مستخدم بالفعل.");

  const { data, error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .insert({
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      feed_type: readFeedType(formData.get("feed_type")),
      config: await sanitizeFeedModuleConfig(formData),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await revalidateBlockModulePaths("feed");
  redirect(`/admin/pages-blocks/blocks/feed/${data.id}`);
}

export async function updateFeedModule(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!id || !name || !slug) throw new Error("بيانات الموديول غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  const { error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .update({
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      feed_type: readFeedType(formData.get("feed_type")),
      config: await sanitizeFeedModuleConfig(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await syncBlockModulePageAssignments("feed", id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("feed");
  revalidatePath(`/admin/pages-blocks/blocks/feed/${id}`, "page");
  redirect(`/admin/pages-blocks/blocks/feed/${id}?saved=1`);
}

export async function toggleFeedModuleStatus(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "draft");
  if (!id) throw new Error("معرّف الموديول مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await revalidateBlockModulePaths("feed");
}

export async function deleteFeedModule(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف الموديول مفقود.");

  const { error } = await getSupabaseAdmin().from("feed_module_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await revalidateBlockModulePaths("feed");
}

export async function duplicateFeedModule(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف الموديول مفقود.");

  const { data: source, error } = await getSupabaseAdmin()
    .from("feed_module_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !source) throw new Error(error?.message || "الموديول غير موجود.");

  const { error: insertError } = await getSupabaseAdmin().from("feed_module_templates").insert({
    name: `${source.name} - نسخة`,
    slug: `${source.slug}-copy-${Date.now()}`,
    description: source.description,
    status: "draft",
    feed_type: source.feed_type,
    config: source.config,
    sort_order: (source.sort_order ?? 0) + 1,
  });

  if (insertError) throw new Error(insertError.message);
  await revalidateBlockModulePaths("feed");
}

export async function bulkFeedModules(formData: FormData) {
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
      .from("feed_module_templates")
      .update({ status, updated_at: now })
      .in("id", ids);
    if (error) throw new Error(error.message);
  }

  if (action === "delete") {
    const { error } = await getSupabaseAdmin().from("feed_module_templates").delete().in("id", ids);
    if (error) throw new Error(error.message);
  }

  await revalidateBlockModulePaths("feed");
}
