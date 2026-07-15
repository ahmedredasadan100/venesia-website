"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { parseAdminLinkFromFormData } from "../../../../../lib/admin/links/form-fields";
import { serializeAdminLink } from "../../../../../lib/admin/links/serialize";
import { isAdminLinkEmpty } from "../../../../../lib/admin/links/validate";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateHeroCache } from "../../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { revalidateMediaCenterPublicPaths } from "../../../../../lib/media-center/revalidate-public-paths";
import {
  normalizeHeroElementOrder,
  parseHeroDescriptionAlignment,
  parseHeroTextAlignment,
  parseOptionalBool,
} from "../../../../../lib/hero/hero-content-controls";
import { normalizeRichTextContent } from "../../../../../lib/rich-text/html-utils";

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function formBool(formData: FormData, key: string, fallback = true) {
  return parseOptionalBool(formData.get(key)) ?? fallback;
}

function splitImages(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNumber(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildHeroConfig(formData: FormData) {
  const primaryCtaLabel = cleanText(formData.get("primary_cta_label"));
  const secondaryCtaLabel = cleanText(formData.get("secondary_cta_label"));
  const primaryCtaLink = serializeAdminLink(parseAdminLinkFromFormData(formData, "primary_cta"));
  const secondaryCtaLink = serializeAdminLink(parseAdminLinkFromFormData(formData, "secondary_cta"));
  const hasCtaContent =
    Boolean(primaryCtaLabel && primaryCtaLink && !isAdminLinkEmpty(primaryCtaLink)) ||
    Boolean(secondaryCtaLabel && secondaryCtaLink && !isAdminLinkEmpty(secondaryCtaLink));

  const hasInternalContentControls =
    formData.has("hero_element_order") || formData.has("show_eyebrow");

  const showCtaFromContent = parseOptionalBool(formData.get("show_cta_element"));
  const showCtaFromCheckbox = formData.get("show_cta") === "on";
  const showCta = hasInternalContentControls
    ? (showCtaFromContent ?? true)
    : showCtaFromCheckbox || hasCtaContent;

  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = hasInternalContentControls
    ? descriptionRaw
      ? normalizeRichTextContent(descriptionRaw)
      : ""
    : cleanText(formData.get("description"));

  const base = {
    eyebrow: cleanText(formData.get("eyebrow")),
    title: cleanText(formData.get("title")),
    highlight: cleanText(formData.get("highlight")),
    subtitle: cleanText(formData.get("subtitle")),
    description,
    images: splitImages(formData.get("images")),
    mobileImages: splitImages(formData.get("mobile_images")),
    primaryCtaLabel,
    primaryCtaLink,
    secondaryCtaLabel,
    secondaryCtaLink,
    showCta,
    imagePositionClassName: cleanText(formData.get("image_position_class")),
  };

  if (!hasInternalContentControls) {
    return base;
  }

  return {
    ...base,
    showEyebrow: formBool(formData, "show_eyebrow"),
    eyebrowBold: formBool(formData, "eyebrow_bold", false),
    eyebrowAlignment: parseHeroTextAlignment(formData.get("eyebrow_alignment"), "right"),

    showTitle: formBool(formData, "show_title"),
    titleBold: formBool(formData, "title_bold", true),
    titleAlignment: parseHeroTextAlignment(formData.get("title_alignment"), "right"),

    showHighlight: formBool(formData, "show_highlight"),
    highlightBold: formBool(formData, "highlight_bold", false),
    highlightAlignment: parseHeroTextAlignment(formData.get("highlight_alignment"), "right"),

    showSubtitle: formBool(formData, "show_subtitle"),
    subtitleBold: formBool(formData, "subtitle_bold", false),
    subtitleAlignment: parseHeroTextAlignment(formData.get("subtitle_alignment"), "right"),

    showDescription: formBool(formData, "show_description"),
    descriptionAlignment: parseHeroDescriptionAlignment(formData.get("description_alignment"), "right"),

    showBreadcrumb: formBool(formData, "show_breadcrumb"),
    breadcrumbBold: formBool(formData, "breadcrumb_bold", false),
    breadcrumbAlignment: parseHeroTextAlignment(formData.get("breadcrumb_alignment"), "right"),
    breadcrumbCurrentLabel: cleanText(formData.get("breadcrumb_current_label")),

    ctaAlignment: parseHeroTextAlignment(formData.get("cta_alignment"), "right"),

    heroElementOrder: normalizeHeroElementOrder(formData.get("hero_element_order")),
  };
}

async function revalidateHeroAdmin() {
  revalidateHeroCache();
  revalidatePath("/admin/pages-blocks/blocks/hero");
  revalidatePath("/");
  revalidatePath("/about");
  revalidateMediaCenterPublicPaths();
  revalidatePath("/topics");
  revalidatePath("/contact");
  revalidatePath("/track-your-project");
}

export async function createHeroTemplate(formData: FormData) {
  await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const rawSlug = cleanText(formData.get("slug"));
  const slug = slugify(rawSlug || name);

  if (!name || !slug) {
    throw new Error("اسم الهيرو والـ slug مطلوبين.");
  }

  const { data: existing } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    throw new Error("الـ slug مستخدم بالفعل في Hero آخر.");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("hero_templates")
    .insert({
      name,
      slug,
      description: cleanText(formData.get("template_description")) || null,
      variant: cleanText(formData.get("variant")) || "internal-page",
      style_preset: cleanText(formData.get("style_preset")) || "cinematic-gold",
      source_type: cleanText(formData.get("source_type")) || "manual",
      limit_count: parseNumber(formData.get("limit_count"), 1),
      is_visible: formData.get("is_visible") === "on",
      config: buildHeroConfig(formData),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await revalidateHeroAdmin();
  redirect(`/admin/pages-blocks/blocks/hero/${data.id}`);
}

export async function toggleHeroTemplate(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  const nextVisible = formData.get("next_visible") === "true";

  if (!id) throw new Error("Hero id is missing.");

  const { error } = await getSupabaseAdmin()
    .from("hero_templates")
    .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await revalidateHeroAdmin();
}

export async function deleteHeroTemplate(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  if (!id) throw new Error("Hero id is missing.");

  const { error } = await getSupabaseAdmin().from("hero_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await revalidateHeroAdmin();
}

export async function duplicateHeroTemplate(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  if (!id) throw new Error("Hero id is missing.");

  const { data: hero, error } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !hero) throw new Error(error?.message || "Hero not found.");

  const copySlug = `${hero.slug}-copy-${Date.now()}`;

  const { error: insertError } = await getSupabaseAdmin().from("hero_templates").insert({
    name: `${hero.name} - نسخة`,
    slug: copySlug,
    description: hero.description,
    section_key: hero.section_key,
    variant: hero.variant,
    style_preset: hero.style_preset,
    source_type: hero.source_type,
    source_id: hero.source_id,
    source_slug: hero.source_slug,
    limit_count: hero.limit_count,
    is_visible: false,
    sort_order: hero.sort_order + 1,
    config: hero.config,
  });

  if (insertError) throw new Error(insertError.message);

  await revalidateHeroAdmin();
}

export async function bulkHeroTemplates(formData: FormData) {
  await requireAdminSession();
  const action = cleanText(formData.get("bulk_action"));
  const rawIds = formData.getAll("ids");
  const ids = (rawIds.length > 1 ? rawIds : String(formData.get("ids") ?? "").split(","))
    .map((item) => Number(item))
    .filter(Boolean);

  if (!ids.length) return;

  if (action === "show" || action === "hide") {
    const { error } = await getSupabaseAdmin()
      .from("hero_templates")
      .update({ is_visible: action === "show", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) throw new Error(error.message);
  }

  if (action === "delete") {
    const { error } = await getSupabaseAdmin().from("hero_templates").delete().in("id", ids);
    if (error) throw new Error(error.message);
  }

  await revalidateHeroAdmin();
}

export async function updateHeroTemplateDetails(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"), 0);
  const name = cleanText(formData.get("name"));
  const rawSlug = cleanText(formData.get("slug"));
  const slug = slugify(rawSlug || name);

  if (!id || !name || !slug) {
    throw new Error("Hero id, name and slug are required.");
  }

  const { data: duplicate } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .maybeSingle();

  if (duplicate) {
    throw new Error("الـ slug مستخدم بالفعل في Hero آخر.");
  }

  const { error } = await getSupabaseAdmin()
    .from("hero_templates")
    .update({
      name,
      slug,
      description: cleanText(formData.get("template_description")) || null,
      variant: cleanText(formData.get("variant")) || "internal-page",
      style_preset: cleanText(formData.get("style_preset")) || "cinematic-gold",
      source_type: cleanText(formData.get("source_type")) || "manual",
      source_slug: cleanText(formData.get("source_slug")) || null,
      limit_count: parseNumber(formData.get("limit_count"), 1),
      is_visible: formData.get("is_visible") === "on",
      config: buildHeroConfig(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  const pageIds = formData.getAll("page_ids").map((value) => Number(value)).filter(Boolean);

  await getSupabaseAdmin()
    .from("hero_assignments")
    .delete()
    .eq("hero_id", id)
    .eq("target_type", "page");

  if (pageIds.length) {
    const { data: pages, error: pagesError } = await getSupabaseAdmin()
      .from("pages")
      .select("id,slug,path")
      .in("id", pageIds);

    if (pagesError) throw new Error(pagesError.message);

    const rows = (pages ?? []).map((page) => ({
      hero_id: id,
      target_type: "page",
      target_id: page.id,
      target_slug: page.slug,
      path: page.path,
      is_active: true,
      priority: 100,
    }));

    const { error: assignmentError } = await getSupabaseAdmin().from("hero_assignments").insert(rows);
    if (assignmentError) throw new Error(assignmentError.message);
  }

  await revalidateHeroAdmin();
  revalidatePath(`/admin/pages-blocks/blocks/hero/${id}`);
  redirect(`/admin/pages-blocks/blocks/hero/${id}?saved=1`);
}
