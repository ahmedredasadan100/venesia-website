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
import { linkFieldFromFormData, hasSavedLinkField } from "../../../../../lib/admin/links/block-save";
import type {
  AboutApproachModuleConfig,
  AboutCtaModuleConfig,
  AboutIntroModuleConfig,
  AboutPrinciplesModuleConfig,
  ContentBlockConfig,
  VisionGoalsModuleConfig,
} from "../../../../../lib/page-blocks/configs";
import {
  isAboutApproachTemplate,
  isAboutPrinciplesTemplate,
  isHomeProjectsTemplate,
  isVisionGoalsTemplate,
  usesAboutIntroConfigSchema,
  usesAboutCtaConfigSchema,
  usesAboutPrinciplesConfigSchema,
} from "../../../../../lib/page-blocks/configs";

function buildGenericContentConfig(formData: FormData): ContentBlockConfig {
  return {
    eyebrow: cleanText(formData.get("eyebrow")),
    title: cleanText(formData.get("title")),
    subtitle: cleanText(formData.get("subtitle")),
    body: cleanText(formData.get("body")),
    alignment: cleanText(formData.get("alignment")) === "center" ? "center" : "start",
  };
}

function optionalImagePath(formData: FormData, key: string) {
  const value = cleanText(formData.get(key));
  return value || undefined;
}

function buildAboutIntroConfig(formData: FormData): AboutIntroModuleConfig {
  const beats = Array.from({ length: 3 }, (_, index) => ({
    num: cleanText(formData.get(`beat_${index}_num`)),
    title: cleanText(formData.get(`beat_${index}_title`)),
    text: cleanText(formData.get(`beat_${index}_text`)),
  }));

  const config: AboutIntroModuleConfig = {
    ...buildGenericContentConfig(formData),
    images: {
      main: optionalImagePath(formData, "image_main"),
      secondary: optionalImagePath(formData, "image_secondary"),
      accent: optionalImagePath(formData, "image_accent"),
      mainAlt: cleanText(formData.get("image_main_alt")) || undefined,
      secondaryAlt: cleanText(formData.get("image_secondary_alt")) || undefined,
      accentAlt: cleanText(formData.get("image_accent_alt")) || undefined,
    },
    beats,
  };

  if (cleanText(formData.get("include_story_cta")) === "1") {
    const linkData = linkFieldFromFormData(formData, "button");
    config.button = {
      label: cleanText(formData.get("button_label")) || undefined,
      ...(linkData ? { link: linkData.link, target: linkData.target } : {}),
    };
  }

  return config;
}

function readColumnItems(formData: FormData, prefix: string) {
  return Array.from({ length: 3 }, (_, index) => ({
    title: cleanText(formData.get(`${prefix}_item_${index}_title`)),
    text: cleanText(formData.get(`${prefix}_item_${index}_text`)),
  }));
}

function buildVisionGoalsConfig(formData: FormData): VisionGoalsModuleConfig {
  const intro = cleanText(formData.get("intro"))
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    eyebrow: cleanText(formData.get("eyebrow")) || undefined,
    title: cleanText(formData.get("title")) || undefined,
    intro,
    image: optionalImagePath(formData, "image"),
    imageAlt: cleanText(formData.get("image_alt")) || undefined,
    vision: {
      title: cleanText(formData.get("vision_title")) || undefined,
      items: readColumnItems(formData, "vision"),
    },
    goals: {
      title: cleanText(formData.get("goals_title")) || undefined,
      items: readColumnItems(formData, "goals"),
    },
  };
}

function readContacts(formData: FormData) {
  return Array.from({ length: 4 }, (_, index) => {
    const label = cleanText(formData.get(`contact_${index}_label`));
    const value = cleanText(formData.get(`contact_${index}_value`));
    const linkData = linkFieldFromFormData(formData, `contact_${index}`);
    if (!label && !value && !hasSavedLinkField(linkData)) return null;
    return {
      label: label || undefined,
      value: value || undefined,
      ...(linkData ? { link: linkData.link, target: linkData.target } : {}),
    };
  }).filter(Boolean) as AboutCtaModuleConfig["contacts"];
}

function buildAboutCtaConfig(formData: FormData): AboutCtaModuleConfig {
  const buttonLink = linkFieldFromFormData(formData, "button");
  return {
    eyebrow: cleanText(formData.get("eyebrow")) || undefined,
    title: cleanText(formData.get("title")) || undefined,
    description: cleanText(formData.get("description")) || undefined,
    button: {
      label: cleanText(formData.get("button_label")) || undefined,
      ...(buttonLink ? { link: buttonLink.link, target: buttonLink.target } : {}),
    },
    note: cleanText(formData.get("note")) || undefined,
    image: optionalImagePath(formData, "image"),
    imageAlt: cleanText(formData.get("image_alt")) || undefined,
    contacts: readContacts(formData),
  };
}

function readPrincipleItems(formData: FormData) {
  const count = Math.min(6, Math.max(0, parseNumber(formData.get("principle_count")) ?? 0));
  if (!count) {
    return Array.from({ length: 3 }, (_, index) => ({
      icon: cleanText(formData.get(`principle_${index}_icon`)) || "land",
      title: cleanText(formData.get(`principle_${index}_title`)),
      description: cleanText(formData.get(`principle_${index}_description`)),
    }));
  }

  return Array.from({ length: count }, (_, index) => ({
    icon: cleanText(formData.get(`principle_${index}_icon`)) || "land",
    title: cleanText(formData.get(`principle_${index}_title`)),
    description: cleanText(formData.get(`principle_${index}_description`)),
  }));
}

function buildAboutPrinciplesConfig(formData: FormData): AboutPrinciplesModuleConfig {
  const config: AboutPrinciplesModuleConfig = {
    eyebrow: cleanText(formData.get("eyebrow")) || undefined,
    title: cleanText(formData.get("title")) || undefined,
    items: readPrincipleItems(formData),
  };

  if (cleanText(formData.get("include_home_trust_intro")) === "1") {
    config.description = cleanText(formData.get("principles_intro")) || undefined;
  }

  return config;
}

function buildAboutApproachConfig(formData: FormData): AboutApproachModuleConfig {
  return {
    eyebrow: cleanText(formData.get("eyebrow")) || undefined,
    title: cleanText(formData.get("title")) || undefined,
  };
}

function resolveStructuredVariant(slug: string, variantInput: string | null) {
  if (usesAboutIntroConfigSchema(slug, variantInput)) return "about-intro";
  if (isVisionGoalsTemplate(slug, variantInput)) return "vision-goals";
  if (usesAboutCtaConfigSchema(slug, variantInput)) return "about-cta";
  if (usesAboutPrinciplesConfigSchema(slug, variantInput)) return "about-principles";
  if (isAboutApproachTemplate(slug, variantInput)) return "about-approach";
  if (isHomeProjectsTemplate(slug, variantInput)) return "home-projects";
  return variantInput || "default";
}

function buildContentConfig(
  formData: FormData,
  slug?: string,
):
  | ContentBlockConfig
  | AboutIntroModuleConfig
  | VisionGoalsModuleConfig
  | AboutCtaModuleConfig
  | AboutPrinciplesModuleConfig
  | AboutApproachModuleConfig {
  const variantInput = cleanText(formData.get("variant")) || null;

  if (cleanText(formData.get("config_schema")) === "about-intro" || usesAboutIntroConfigSchema(slug ?? "", variantInput)) {
    return buildAboutIntroConfig(formData);
  }
  if (cleanText(formData.get("config_schema")) === "vision-goals" || isVisionGoalsTemplate(slug ?? "", variantInput)) {
    return buildVisionGoalsConfig(formData);
  }
  if (cleanText(formData.get("config_schema")) === "about-cta" || usesAboutCtaConfigSchema(slug ?? "", variantInput)) {
    return buildAboutCtaConfig(formData);
  }
  if (
    cleanText(formData.get("config_schema")) === "about-principles" ||
    usesAboutPrinciplesConfigSchema(slug ?? "", variantInput)
  ) {
    return buildAboutPrinciplesConfig(formData);
  }
  if (cleanText(formData.get("config_schema")) === "about-approach" || isAboutApproachTemplate(slug ?? "", variantInput)) {
    return buildAboutApproachConfig(formData);
  }
  if (cleanText(formData.get("config_schema")) === "home-projects" || isHomeProjectsTemplate(slug ?? "", variantInput)) {
    return {};
  }
  return buildGenericContentConfig(formData);
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin().from("content_block_templates").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query.maybeSingle();
  return !data;
}

export async function createContentBlock(formData: FormData) {
  await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name || !slug) throw new Error("اسم البلوك والـ slug مطلوبين.");
  if (!(await ensureUniqueSlug(slug))) throw new Error("الـ slug مستخدم بالفعل.");

  const variantInput = cleanText(formData.get("variant")) || null;
  const variant = resolveStructuredVariant(slug, variantInput);

  const { data, error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .insert({
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant,
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      config: buildContentConfig(formData, slug),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await revalidateBlockModulePaths("content");
  redirect(`/admin/pages-blocks/blocks/content/${data.id}`);
}

export async function updateContentBlock(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!id || !name || !slug) throw new Error("بيانات البلوك غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  const variantInput = cleanText(formData.get("variant")) || null;
  const variant = resolveStructuredVariant(slug, variantInput);

  const { error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .update({
      name,
      slug,
      description: cleanText(formData.get("description")) || null,
      variant,
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      config: buildContentConfig(formData, slug),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await syncBlockModulePageAssignments("content", id, parsePageIdsFromForm(formData));
  await revalidateBlockModulePaths("content");
  redirect(`/admin/pages-blocks/blocks/content/${id}?saved=1`);
}

export async function toggleContentBlockStatus(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "draft");
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await revalidateBlockModulePaths("content");
}

export async function deleteContentBlock(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { error } = await getSupabaseAdmin().from("content_block_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await revalidateBlockModulePaths("content");
}

export async function duplicateContentBlock(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: source, error } = await getSupabaseAdmin().from("content_block_templates").select("*").eq("id", id).single();
  if (error || !source) throw new Error(error?.message || "البلوك غير موجود.");

  const copySlug = `${source.slug}-copy-${Date.now()}`;

  const { error: insertError } = await getSupabaseAdmin().from("content_block_templates").insert({
    name: `${source.name} - نسخة`,
    slug: copySlug,
    description: source.description,
    variant: source.variant,
    style_preset: source.style_preset,
    status: "draft",
    config: source.config,
    sort_order: (source.sort_order ?? 0) + 1,
  });

  if (insertError) throw new Error(insertError.message);
  await revalidateBlockModulePaths("content");
}

export async function bulkContentBlocks(formData: FormData) {
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
    const { error } = await getSupabaseAdmin().from("content_block_templates").update({ status, updated_at: now }).in("id", ids);
    if (error) throw new Error(error.message);
  }

  if (action === "delete") {
    const { error } = await getSupabaseAdmin().from("content_block_templates").delete().in("id", ids);
    if (error) throw new Error(error.message);
  }

  await revalidateBlockModulePaths("content");
}

export type ContentBlockRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  variant: string;
  status: string;
  updated_at: string;
};

export async function getContentBlockRows(): Promise<ContentBlockRow[]> {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentBlockRow[];
}
