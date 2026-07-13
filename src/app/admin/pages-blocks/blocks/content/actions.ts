"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";

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
import { linkFieldFromFormData, hasSavedLinkField } from "../../../../../lib/admin/links/block-save";
import type {
  AboutApproachModuleConfig,
  AboutCtaModuleConfig,
  AboutIntroModuleConfig,
  AboutPrinciplesModuleConfig,
  ContentBlockConfig,
  HomeProjectsModuleConfig,
  VisionGoalsModuleConfig,
} from "../../../../../lib/page-blocks/configs";
import {
  isAboutApproachTemplate,
  isHomeProjectsTemplate,
  isVisionGoalsTemplate,
  usesAboutIntroConfigSchema,
  usesAboutCtaConfigSchema,
  usesAboutPrinciplesConfigSchema,
} from "../../../../../lib/page-blocks/configs";
import {
  PROJECTS_HUB_FEATURED_KEYS,
  PROJECTS_HUB_FEATURED_SELECTION_MODES,
  PROJECTS_HUB_HERO_KEYS,
  PROJECTS_HUB_HERO_SELECTION_MODES,
  PROJECTS_HUB_LISTING_KEYS,
  PROJECTS_HUB_MAP_KEYS,
  PROJECTS_HUB_SORT_MODES,
  PROJECTS_HUB_VIEW_MODES,
  assertAutoplayMs,
  assertMapPercent,
  assertPageSize,
  assertProjectCode,
  assertSafeCmsMediaPath,
  assertSafePlainText,
  isProjectsHubFeaturedTemplate,
  isProjectsHubHeroTemplate,
  isProjectsHubListingTemplate,
  isProjectsHubMapTemplate,
  isProjectsHubTemplate,
  mergeProjectsHubConfig,
  type ProjectsHubFeaturedModuleConfig,
  type ProjectsHubFeaturedSelectionMode,
  type ProjectsHubFilterId,
  type ProjectsHubHeroModuleConfig,
  type ProjectsHubHeroSelectionMode,
  type ProjectsHubListingModuleConfig,
  type ProjectsHubMapModuleConfig,
  type ProjectsHubMapPinConfig,
  type ProjectsHubSortMode,
  type ProjectsHubViewMode,
} from "../../../../../lib/page-blocks/projects-hub-config";

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

/** Admin-only template metadata description — prefer dedicated field over public config.description. */
function readTemplateInternalDescription(formData: FormData) {
  if (formData.has("internal_description")) {
    return cleanText(formData.get("internal_description")) || null;
  }
  return cleanText(formData.get("description")) || null;
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
    const openTargetRaw = cleanText(formData.get("button_open_target"));
    const openTarget =
      openTargetRaw === "_blank" || openTargetRaw === "_self"
        ? openTargetRaw
        : linkData?.target;
    const alignmentRaw = cleanText(formData.get("button_alignment"));
    const alignment =
      alignmentRaw === "center" || alignmentRaw === "left" || alignmentRaw === "right"
        ? alignmentRaw
        : "right";
    const iconRaw = cleanText(formData.get("button_icon"));
    const icon = iconRaw === "arrow" ? "arrow" : "none";
    const iconPositionRaw = cleanText(formData.get("button_icon_position"));
    const iconPosition = iconPositionRaw === "left" ? "left" : "right";

    config.button = {
      label: cleanText(formData.get("button_label")) || undefined,
      ...(linkData ? { link: linkData.link } : {}),
      ...(openTarget ? { target: openTarget } : {}),
      alignment,
      icon,
      iconPosition,
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
    const icon = cleanText(formData.get(`contact_${index}_icon`));
    const linkData = linkFieldFromFormData(formData, `contact_${index}`);
    if (!label && !value && !hasSavedLinkField(linkData)) return null;
    return {
      label: label || undefined,
      value: value || undefined,
      icon: icon || undefined,
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

function buildHomeProjectsConfig(formData: FormData): HomeProjectsModuleConfig {
  const footerLink = linkFieldFromFormData(formData, "footer_cta");
  const label = cleanText(formData.get("footer_cta_label"));
  const limitText = cleanText(formData.get("projects_limit"));
  const parsedLimit = limitText ? parseNumber(limitText, 0) : 0;
  const projectsLimit =
    limitText && Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : undefined;

  const openTargetRaw = cleanText(formData.get("footer_cta_open_target"));
  const openTarget =
    openTargetRaw === "_blank" || openTargetRaw === "_self"
      ? openTargetRaw
      : footerLink?.target;
  const alignmentRaw = cleanText(formData.get("footer_cta_alignment"));
  const alignment: "right" | "center" | "left" =
    alignmentRaw === "right" || alignmentRaw === "left" || alignmentRaw === "center"
      ? alignmentRaw
      : "center";

  const cardAlignRaw = cleanText(formData.get("card_cta_alignment"));
  const cardCtaAlignment: "right" | "center" | "left" =
    cardAlignRaw === "right" || cardAlignRaw === "left" || cardAlignRaw === "center"
      ? cardAlignRaw
      : "right";

  const eyebrowBoldRaw = cleanText(formData.get("eyebrow_bold"));
  const eyebrowBold = eyebrowBoldRaw !== "false";

  const eyebrowAlignRaw = cleanText(formData.get("eyebrow_alignment"));
  const eyebrowAlignment: "right" | "center" | "left" =
    eyebrowAlignRaw === "right" || eyebrowAlignRaw === "left" || eyebrowAlignRaw === "center"
      ? eyebrowAlignRaw
      : "right";

  const footerCta =
    label || hasSavedLinkField(footerLink)
      ? {
          label: label || undefined,
          ...(footerLink ? { link: footerLink.link } : {}),
          ...(openTarget ? { target: openTarget } : {}),
          alignment,
        }
      : undefined;

  return {
    eyebrow: cleanText(formData.get("eyebrow")) || undefined,
    title: cleanText(formData.get("title")) || undefined,
    intro: cleanText(formData.get("intro")) || undefined,
    showEyebrow: parseFormBoolean(formData, "show_eyebrow", false),
    showTitle: parseFormBoolean(formData, "show_title", false),
    showIntro: parseFormBoolean(formData, "show_intro", false),
    showFooterCta: parseFormBoolean(formData, "show_footer_cta", false),
    projectsLimit,
    cardCtaAlignment,
    eyebrowBold,
    eyebrowAlignment,
    footerCta,
  };
}

function buildProjectsHubHeroTypedConfig(formData: FormData): ProjectsHubHeroModuleConfig {
  const selectionMode = cleanText(formData.get("selection_mode")) as ProjectsHubHeroSelectionMode;
  if (!PROJECTS_HUB_HERO_SELECTION_MODES.includes(selectionMode)) {
    throw new Error("طريقة اختيار شرائح الهيرو غير مدعومة.");
  }
  const autoplayMs = assertAutoplayMs(Number(cleanText(formData.get("autoplay_ms")) || 6000));
  const emptyRaw = cleanText(formData.get("empty_state"));
  const emptyState = emptyRaw ? assertSafePlainText(emptyRaw, "نص الحالة الفارغة", 400) : null;
  return { selectionMode, autoplayMs, emptyState };
}

function buildProjectsHubFeaturedTypedConfig(formData: FormData): ProjectsHubFeaturedModuleConfig {
  const selectionMode = cleanText(formData.get("selection_mode")) as ProjectsHubFeaturedSelectionMode;
  if (!PROJECTS_HUB_FEATURED_SELECTION_MODES.includes(selectionMode)) {
    throw new Error("قاعدة اختيار المشروعات المميزة غير مدعومة.");
  }
  const title = assertSafePlainText(cleanText(formData.get("title")) || "مشروع مميز", "العنوان", 120);
  const subtitle = assertSafePlainText(
    cleanText(formData.get("subtitle")) || "اختيار يعكس مسار التنفيذ على الأرض",
    "العنوان الفرعي",
    240,
  );
  const limitRaw = cleanText(formData.get("limit"));
  const limit = limitRaw ? assertPageSize(Number(limitRaw)) : null;
  const autoplayMs = assertAutoplayMs(Number(cleanText(formData.get("autoplay_ms")) || 6000));
  return {
    selectionMode,
    title,
    subtitle,
    showTitle: parseFormBoolean(formData, "show_title", false),
    showSubtitle: parseFormBoolean(formData, "show_subtitle", false),
    showProjectImage: parseFormBoolean(formData, "show_project_image", false),
    showProjectCode: parseFormBoolean(formData, "show_project_code", false),
    showProjectName: parseFormBoolean(formData, "show_project_name", false),
    showProjectDescription: parseFormBoolean(formData, "show_project_description", false),
    showProjectType: parseFormBoolean(formData, "show_project_type", false),
    showProjectLocation: parseFormBoolean(formData, "show_project_location", false),
    showExploreButton: parseFormBoolean(formData, "show_explore_button", false),
    showSliderDots: parseFormBoolean(formData, "show_slider_dots", false),
    limit,
    autoplayMs,
  };
}

function buildProjectsHubListingTypedConfig(formData: FormData): ProjectsHubListingModuleConfig {
  // Public chips derive from loaded project types; CMS does not choose classifications.
  const visibleFilters: ProjectsHubFilterId[] = ["all", "residential", "commercial"];
  const defaultFilter: ProjectsHubFilterId = "all";
  const defaultView = cleanText(formData.get("default_view")) as ProjectsHubViewMode;
  if (!(PROJECTS_HUB_VIEW_MODES as readonly string[]).includes(defaultView)) {
    throw new Error("وضع العرض الافتراضي غير مدعوم.");
  }
  const sort = cleanText(formData.get("sort")) as ProjectsHubSortMode;
  if (!(PROJECTS_HUB_SORT_MODES as readonly string[]).includes(sort)) {
    throw new Error("طريقة الترتيب غير مدعومة.");
  }
  return {
    eyebrow: assertSafePlainText(cleanText(formData.get("eyebrow")) || "Projects Index", "النص التمهيدي", 80),
    title: assertSafePlainText(cleanText(formData.get("title")) || "جميع المشروعات", "عنوان القسم", 120),
    showEyebrow: parseFormBoolean(formData, "show_eyebrow", false),
    showTitle: parseFormBoolean(formData, "show_title", false),
    defaultFilter,
    visibleFilters,
    showFilterBar: parseFormBoolean(formData, "show_filter_bar", false),
    showProjectImage: parseFormBoolean(formData, "show_project_image", false),
    showProjectCode: parseFormBoolean(formData, "show_project_code", false),
    showProjectDescription: parseFormBoolean(formData, "show_project_description", false),
    showProjectType: parseFormBoolean(formData, "show_project_type", false),
    showProjectLocation: parseFormBoolean(formData, "show_project_location", false),
    showExploreButton: parseFormBoolean(formData, "show_explore_button", false),
    defaultView,
    pageSize: assertPageSize(Number(cleanText(formData.get("page_size")) || 6)),
    sort,
    showViewToggle: parseFormBoolean(formData, "show_view_toggle", false),
    showPagination: parseFormBoolean(formData, "show_pagination", false),
    showProjectCount: parseFormBoolean(formData, "show_project_count", false),
  };
}

async function buildProjectsHubMapTypedConfig(formData: FormData): Promise<ProjectsHubMapModuleConfig> {
  const pinCount = Math.min(30, Math.max(0, Number(cleanText(formData.get("pin_count")) || 0)));
  const mapPins: ProjectsHubMapPinConfig[] = [];

  for (let index = 0; index < pinCount; index += 1) {
    const codeRaw = cleanText(formData.get(`pin_${index}_code`));
    const districtRaw = cleanText(formData.get(`pin_${index}_district`));
    const rightRaw = cleanText(formData.get(`pin_${index}_right`));
    const topRaw = cleanText(formData.get(`pin_${index}_top`));
    if (!codeRaw && !districtRaw && !rightRaw && !topRaw) continue;

    const code = assertProjectCode(codeRaw);
    mapPins.push({
      code,
      district: assertSafePlainText(districtRaw || "—", "المنطقة", 80),
      right: assertMapPercent(rightRaw, "Right %"),
      top: assertMapPercent(topRaw, "Top %"),
    });
  }

  if (!mapPins.length) {
    throw new Error("أضف دبوس خريطة واحدًا على الأقل.");
  }

  const codes = mapPins.map((pin) => pin.code);
  const { data: projectRows, error } = await getSupabaseAdmin()
    .from("projects")
    .select("code")
    .in("code", codes);
  if (error) throw new Error(error.message);

  const knownCodes = new Set((projectRows ?? []).map((row) => String(row.code).toUpperCase()));
  for (const code of codes) {
    if (!knownCodes.has(code.toUpperCase())) {
      throw new Error(`كود المشروع غير موجود في قاعدة البيانات: ${code}`);
    }
  }

  return {
    title: assertSafePlainText(cleanText(formData.get("title")) || "مشروعاتنا على الخريطة", "العنوان", 120),
    mapImage: assertSafeCmsMediaPath(cleanText(formData.get("map_image")), "صورة الخريطة"),
    exploreButtonLabel: assertSafePlainText(
      cleanText(formData.get("explore_button_label")) || "استكشف على الخريطة",
      "نص زر الاستكشاف",
      80,
    ),
    mapPins,
  };
}

function resolveStructuredVariant(slug: string, variantInput: string | null) {
  if (usesAboutIntroConfigSchema(slug, variantInput)) return "about-intro";
  if (isVisionGoalsTemplate(slug, variantInput)) return "vision-goals";
  if (usesAboutCtaConfigSchema(slug, variantInput)) return "about-cta";
  if (usesAboutPrinciplesConfigSchema(slug, variantInput)) return "about-principles";
  if (isAboutApproachTemplate(slug, variantInput)) return "about-approach";
  if (isHomeProjectsTemplate(slug, variantInput)) return "home-projects";
  if (isProjectsHubHeroTemplate(slug, variantInput)) return "projects-hub-hero";
  if (isProjectsHubFeaturedTemplate(slug, variantInput)) return "projects-hub-featured";
  if (isProjectsHubListingTemplate(slug, variantInput)) return "projects-hub-listing";
  if (isProjectsHubMapTemplate(slug, variantInput)) return "projects-hub-map";
  return variantInput || "default";
}

async function buildContentConfig(
  formData: FormData,
  slug?: string,
  existingConfig?: unknown,
): Promise<
  | ContentBlockConfig
  | AboutIntroModuleConfig
  | VisionGoalsModuleConfig
  | AboutCtaModuleConfig
  | AboutPrinciplesModuleConfig
  | AboutApproachModuleConfig
  | HomeProjectsModuleConfig
  | Record<string, unknown>
> {
  const variantInput = cleanText(formData.get("variant")) || null;
  const schema = cleanText(formData.get("config_schema"));
  const resolvedSlug = slug ?? "";

  if (isProjectsHubTemplate(resolvedSlug, variantInput)) {
    if (
      schema === "projects-hub-hero" ||
      (!schema && isProjectsHubHeroTemplate(resolvedSlug, variantInput))
    ) {
      return mergeProjectsHubConfig(
        existingConfig,
        buildProjectsHubHeroTypedConfig(formData),
        PROJECTS_HUB_HERO_KEYS,
      );
    }
    if (
      schema === "projects-hub-featured" ||
      (!schema && isProjectsHubFeaturedTemplate(resolvedSlug, variantInput))
    ) {
      return mergeProjectsHubConfig(
        existingConfig,
        buildProjectsHubFeaturedTypedConfig(formData),
        PROJECTS_HUB_FEATURED_KEYS,
      );
    }
    if (
      schema === "projects-hub-listing" ||
      (!schema && isProjectsHubListingTemplate(resolvedSlug, variantInput))
    ) {
      return mergeProjectsHubConfig(
        existingConfig,
        buildProjectsHubListingTypedConfig(formData),
        PROJECTS_HUB_LISTING_KEYS,
      );
    }
    if (
      schema === "projects-hub-map" ||
      (!schema && isProjectsHubMapTemplate(resolvedSlug, variantInput))
    ) {
      return mergeProjectsHubConfig(
        existingConfig,
        await buildProjectsHubMapTypedConfig(formData),
        PROJECTS_HUB_MAP_KEYS,
      );
    }
    throw new Error("موديولات صفحة المشروعات لا يمكن حفظها عبر المحرر العام.");
  }

  if (schema === "about-intro" || usesAboutIntroConfigSchema(resolvedSlug, variantInput)) {
    return buildAboutIntroConfig(formData);
  }
  if (schema === "vision-goals" || isVisionGoalsTemplate(resolvedSlug, variantInput)) {
    return buildVisionGoalsConfig(formData);
  }
  if (schema === "about-cta" || usesAboutCtaConfigSchema(resolvedSlug, variantInput)) {
    return buildAboutCtaConfig(formData);
  }
  if (schema === "about-principles" || usesAboutPrinciplesConfigSchema(resolvedSlug, variantInput)) {
    return buildAboutPrinciplesConfig(formData);
  }
  if (schema === "about-approach" || isAboutApproachTemplate(resolvedSlug, variantInput)) {
    return buildAboutApproachConfig(formData);
  }
  if (schema === "home-projects" || isHomeProjectsTemplate(resolvedSlug, variantInput)) {
    return buildHomeProjectsConfig(formData);
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
      description: readTemplateInternalDescription(formData),
      variant,
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      config: await buildContentConfig(formData, slug),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "create"),
    entityType: "content_block_template",
    entityId: data.id,
    entityLabel: name,
    metadata: { slug, variant },
  });

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

  const { data: existing, error: existingError } = await getSupabaseAdmin()
    .from("content_block_templates")
    .select("id, slug, variant, config")
    .eq("id", id)
    .maybeSingle();
  if (existingError || !existing) throw new Error(existingError?.message || "البلوك غير موجود.");

  if (isProjectsHubTemplate(existing.slug, existing.variant) && !isProjectsHubTemplate(slug, cleanText(formData.get("variant")) || null)) {
    throw new Error("لا يمكن تحويل موديول صفحة المشروعات إلى نوع عام.");
  }

  const variantInput = cleanText(formData.get("variant")) || null;
  const variant = resolveStructuredVariant(slug, variantInput);
  const nextConfig = await buildContentConfig(formData, slug, existing.config);

  const { error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .update({
      name,
      slug,
      description: readTemplateInternalDescription(formData),
      variant,
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: getStatus(cleanText(formData.get("status")) || "draft"),
      config: nextConfig,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await syncBlockModulePageAssignments("content", id, parsePageIdsFromForm(formData));
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { slug, variant, projects_hub: isProjectsHubTemplate(slug, variant) },
  });
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
