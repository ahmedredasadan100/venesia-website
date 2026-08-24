"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import {
  synchronizeMediaReferenceWriteScopesAfterDomainMutation,
  type MediaReferenceSynchronizationResult,
} from "../../../../../lib/admin/media-catalog/synchronization";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import type { AdminFormActionState } from "../../../../../lib/admin/form-runtime";

import { redirect } from "next/navigation";
import type { Json, Tables, TablesInsert, TablesUpdate } from "../../../../../lib/database.types";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  cleanText,
  getStatus,
  PAGE_BLOCK_BULK_ACTIONS,
  parseFormBoolean,
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
import { linkFieldFromFormData, hasSavedLinkField } from "../../../../../lib/admin/links/block-save";
import type {
  AboutApproachModuleConfig,
  AboutCtaModuleConfig,
  AboutIntroModuleConfig,
  AboutIntroSingleImageModuleConfig,
  AboutPrinciplesModuleConfig,
  ContentBlockConfig,
  HomeProjectsModuleConfig,
  VisionGoalsModuleConfig,
} from "../../../../../lib/page-blocks/configs";
import { normalizeRichTextContent } from "../../../../../lib/rich-text/html-utils";
import { parseHeroContentControlsFormData } from "../../../../../lib/hero/hero-content-controls";
import { isStructuralContentTemplateSlug } from "../../../../../lib/page-blocks/module-edit-registry";
import { isRetiredContentBlockTemplateSlug } from "../../../../../lib/page-blocks/deprecated-block-modules";
import {
  isAboutApproachTemplate,
  isAboutIntroSingleImageTemplate,
  isHomeProjectsTemplate,
  isVisionGoalsTemplate,
  usesAboutIntroConfigSchema,
  usesAboutCtaConfigSchema,
  usesAboutPrinciplesConfigSchema,
} from "../../../../../lib/page-blocks/configs";
import {
  PROJECTS_HUB_FEATURED_KEYS,
  PROJECTS_HUB_FEATURED_SELECTION_MODES,
  PROJECTS_HUB_FILTER_IDS,
  PROJECTS_HUB_HERO_ELEMENT_KEYS,
  PROJECTS_HUB_HERO_KEYS,
  PROJECTS_HUB_HERO_LEGACY_KEYS,
  PROJECTS_HUB_HERO_PROJECT_TYPES,
  PROJECTS_HUB_HERO_SELECTION_MODES,
  PROJECTS_HUB_HERO_VARIANTS,
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

/**
 * Admin-only template metadata description.
 * Prefer `internal_description` so public config fields named `description`
 * (e.g. about-cta body copy) never overwrite content_block_templates.description.
 */
function readTemplateInternalDescription(formData: FormData) {
  if (formData.has("internal_description")) {
    return cleanText(formData.get("internal_description")) || null;
  }

  const schema = cleanText(formData.get("config_schema"));
  // Schemas that also post a public config `description` must not fall back to it.
  if (
    schema === "about-cta" ||
    schema === "about-principles" ||
    schema === "about-intro" ||
    schema === "about-intro-single-image" ||
    schema === "vision-goals" ||
    schema === "home-projects"
  ) {
    return null;
  }

  return cleanText(formData.get("description")) || null;
}

function buildAboutIntroConfig(formData: FormData): AboutIntroModuleConfig {
  const beats = Array.from({ length: 3 }, (_, index) => ({
    num: cleanText(formData.get(`beat_${index}_num`)),
    title: cleanText(formData.get(`beat_${index}_title`)),
    text: cleanText(formData.get(`beat_${index}_text`)),
  }));

  const bodyRaw = String(formData.get("body") ?? "").trim();
  const body = bodyRaw ? normalizeRichTextContent(bodyRaw) : "";

  const config: AboutIntroModuleConfig = {
    ...buildGenericContentConfig(formData),
    body,
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

function buildAboutIntroSingleImageConfig(
  formData: FormData,
): AboutIntroSingleImageModuleConfig {
  const beats = Array.from({ length: 3 }, (_, index) => ({
    num: cleanText(formData.get(`beat_${index}_num`)),
    title: cleanText(formData.get(`beat_${index}_title`)),
    text: cleanText(formData.get(`beat_${index}_text`)),
  }));
  const bodyRaw = String(formData.get("body") ?? "").trim();
  const body = bodyRaw ? normalizeRichTextContent(bodyRaw) : "";
  const positionRaw = cleanText(formData.get("image_position")).toLowerCase();

  return {
    ...buildGenericContentConfig(formData),
    body,
    images: {
      main: optionalImagePath(formData, "image_main"),
      mainAlt: cleanText(formData.get("image_main_alt")) || undefined,
    },
    beats,
    imagePosition: positionRaw === "right" ? "right" : "left",
  };
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

function readContacts(formData: FormData): NonNullable<AboutCtaModuleConfig["contacts"]> {
  const contacts: NonNullable<AboutCtaModuleConfig["contacts"]> = [];
  for (let index = 0; index < 4; index += 1) {
    const label = cleanText(formData.get(`contact_${index}_label`));
    const value = cleanText(formData.get(`contact_${index}_value`));
    const secondaryValue = cleanText(formData.get(`contact_${index}_secondary_value`));
    const icon = cleanText(formData.get(`contact_${index}_icon`));
    const linkData = linkFieldFromFormData(formData, `contact_${index}`);
    if (!label && !value && !secondaryValue && !hasSavedLinkField(linkData)) continue;
    contacts.push({
      label: label || undefined,
      value: value || undefined,
      ...(secondaryValue ? { secondaryValue } : {}),
      icon: icon || undefined,
      ...(linkData ? { link: linkData.link, target: linkData.target } : {}),
    });
  }
  return contacts;
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
  const length = count || 3;

  return Array.from({ length }, (_, index) => ({
    icon: cleanText(formData.get(`principle_${index}_icon`)) || "land",
    title: cleanText(formData.get(`principle_${index}_title`)),
    description: cleanText(formData.get(`principle_${index}_description`)),
    image: optionalImagePath(formData, `principle_${index}_image`),
    imageAlt: cleanText(formData.get(`principle_${index}_image_alt`)) || undefined,
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

    // Home-trust plain-text format keys (optional; legacy defaults applied at render).
    const eyebrowBoldRaw = cleanText(formData.get("eyebrow_bold"));
    config.eyebrowBold = eyebrowBoldRaw === "true";

    const eyebrowAlignRaw = cleanText(formData.get("eyebrow_alignment"));
    config.eyebrowAlignment =
      eyebrowAlignRaw === "right" || eyebrowAlignRaw === "left" || eyebrowAlignRaw === "center"
        ? eyebrowAlignRaw
        : "right";

    const titleBoldRaw = cleanText(formData.get("title_bold"));
    config.titleBold = titleBoldRaw !== "false";

    const titleAlignRaw = cleanText(formData.get("title_alignment"));
    config.titleAlignment =
      titleAlignRaw === "right" || titleAlignRaw === "left" || titleAlignRaw === "center"
        ? titleAlignRaw
        : "right";
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
    showProjectLocation: parseFormBoolean(formData, "show_project_location", false),
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
  const projectType = cleanText(formData.get("project_type"));
  if (!(PROJECTS_HUB_HERO_PROJECT_TYPES as readonly string[]).includes(projectType)) {
    throw new Error("نوع مشروعات الهيرو غير مدعوم.");
  }
  const variant = cleanText(formData.get("hero_variant"));
  if (!(PROJECTS_HUB_HERO_VARIANTS as readonly string[]).includes(variant)) {
    throw new Error("نسخة عرض الهيرو غير مدعومة.");
  }
  const limit = Number(cleanText(formData.get("limit")) || 6);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 12) {
    throw new Error("عدد شرائح الهيرو يجب أن يكون بين 1 و12.");
  }
  const autoplayMs = assertAutoplayMs(Number(cleanText(formData.get("autoplay_ms")) || 6000));
  const emptyRaw = cleanText(formData.get("empty_state"));
  const emptyState = emptyRaw ? assertSafePlainText(emptyRaw, "نص الحالة الفارغة", 400) : null;
  const controls = parseHeroContentControlsFormData(formData, {
    allowedElementKeys: PROJECTS_HUB_HERO_ELEMENT_KEYS,
  });
  return {
    selectionMode,
    projectType: projectType as ProjectsHubHeroModuleConfig["projectType"],
    variant: variant as ProjectsHubHeroModuleConfig["variant"],
    limit,
    autoplayMs,
    emptyState,
    primaryCtaLabel: assertSafePlainText(
      cleanText(formData.get("primary_cta_label")) || "استكشف المشروع",
      "نص زر الإجراء",
      100,
    ),
    ...controls,
  };
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
  const visibleFilters = formData
    .getAll("visible_filters")
    .map((value) => cleanText(value))
    .filter((value): value is ProjectsHubFilterId =>
      (PROJECTS_HUB_FILTER_IDS as readonly string[]).includes(value),
    );
  if (!visibleFilters.length) {
    throw new Error("اختر فلترًا واحدًا ظاهرًا على الأقل.");
  }
  const defaultFilter = cleanText(formData.get("default_filter")) as ProjectsHubFilterId;
  if (!visibleFilters.includes(defaultFilter)) {
    throw new Error("الفلتر الافتراضي يجب أن يكون ضمن الفلاتر الظاهرة.");
  }
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
    showProjectName: parseFormBoolean(formData, "show_project_name", false),
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
  if (isAboutIntroSingleImageTemplate(slug, variantInput)) return "about-intro-single-image";
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
  existingConfig?: Json,
): Promise<Json> {
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
        PROJECTS_HUB_HERO_LEGACY_KEYS,
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
  if (
    schema === "about-intro-single-image" ||
    isAboutIntroSingleImageTemplate(resolvedSlug, variantInput)
  ) {
    return buildAboutIntroSingleImageConfig(formData);
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
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Content module slug lookup failed: ${error.message}`);
  return !data;
}

export type CreateContentBlockFormActionState = AdminFormActionState;

function createContentBlockFailure(
  revision: number,
  message: string,
  field?: "name" | "slug",
): CreateContentBlockFormActionState {
  return {
    status: "error",
    mode: "create",
    revision,
    title: "تعذر إنشاء بلوك المحتوى",
    message,
    ...(field
      ? { fieldErrors: { [field]: [message] }, focusTarget: field }
      : {}),
  };
}

function createContentBlockSuccess(
  revision: number,
  id: number,
  mediaSynchronizationWarning: boolean,
  infrastructureWarning?: string,
): CreateContentBlockFormActionState {
  const warning = mediaSynchronizationWarning || Boolean(infrastructureWarning);
  return {
    status: warning ? "warning" : "success",
    mode: "create",
    revision,
    title: warning ? "تم إنشاء بلوك المحتوى مع تنبيه" : "تم إنشاء بلوك المحتوى",
    message:
      infrastructureWarning ??
      (mediaSynchronizationWarning
        ? "تم إنشاء البلوك، لكن مزامنة مراجع الوسائط تحتاج إلى مراجعة."
        : "تم إنشاء البلوك كغير منشور بنجاح."),
    code: warning ? "created_with_warning" : "created",
    entityId: id,
    editHref: `/admin/pages-blocks/blocks/content/${id}${mediaSynchronizationWarning ? "?notice=saved_with_media_sync_warning" : ""}`,
    savedRevision: `${id}:${revision}`,
  };
}

export async function createContentBlock(
  previousState: CreateContentBlockFormActionState,
  formData: FormData,
): Promise<CreateContentBlockFormActionState> {
  const revision = previousState.revision + 1;
  const actor = await requireAdminSession();
  const name = cleanText(formData.get("name"));
  const slug = slugify(cleanText(formData.get("slug")) || name);

  if (!name) return createContentBlockFailure(revision, "اسم البلوك مطلوب.", "name");
  if (!slug) return createContentBlockFailure(revision, "اكتب slug صالحًا للبلوك.", "slug");
  if (isRetiredContentBlockTemplateSlug(slug)) {
    return createContentBlockFailure(
      revision,
      "هذا المعرّف محجوز لسجل تاريخي متقاعد ولا يقبل إنشاء موديول جديد.",
      "slug",
    );
  }
  if (!(await ensureUniqueSlug(slug))) {
    return createContentBlockFailure(revision, "الـ slug مستخدم بالفعل.", "slug");
  }

  let createdId: number | null = null;
  let mediaSynchronizationWarning = false;
  try {
    const variantInput = cleanText(formData.get("variant")) || null;
    const variant = resolveStructuredVariant(slug, variantInput);

    const nextRow: TablesInsert<"content_block_templates"> = {
      name,
      slug,
      description: readTemplateInternalDescription(formData),
      variant,
      style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
      status: parseFormStatus(formData),
      config: await buildContentConfig(formData, slug),
    };
    const provisionalIdentity = `create:${crypto.randomUUID()}`;
    const coordinated = await coordinateMediaReferenceEntityMutation({
      domainKey: "content_block_templates",
      leaseEntityIdentity: provisionalIdentity,
      intendedRow: nextRow,
      actorId: actor.id,
      requestIdentity: `content-block:create:${provisionalIdentity}`,
      mutate: async () => {
        const { data, error } = await getSupabaseAdmin()
          .from("content_block_templates")
          .insert(nextRow)
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء بلوك المحتوى.");
        return data;
      },
      resolveEntityIdentity: (value) => String(value.id),
    });
    const data = coordinated.value;
    createdId = data.id;
    mediaSynchronizationWarning =
      coordinated.mediaSynchronization.status === "saved_with_media_sync_warning";

    await recordCmsAdminAudit({
      action: buildCmsAuditAction("content_block_template", "create"),
      entityType: "content_block_template",
      entityId: data.id,
      entityLabel: name,
      metadata: { slug, variant },
    });

    await revalidateBlockModulePaths("content");
    return createContentBlockSuccess(
      revision,
      data.id,
      mediaSynchronizationWarning,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر إنشاء بلوك المحتوى. حاول مرة أخرى.";
    if (createdId) {
      return createContentBlockSuccess(
        revision,
        createdId,
        mediaSynchronizationWarning,
        `تم إنشاء البلوك، لكن تعذر إكمال التحقق اللاحق: ${message}`,
      );
    }
    return createContentBlockFailure(
      revision,
      message,
      message.toLowerCase().includes("slug") ? "slug" : undefined,
    );
  }
}

export async function updateContentBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const name = cleanText(formData.get("name"));

  if (!id || !name) throw new Error("بيانات البلوك غير مكتملة.");

  const { data: existing, error: existingError } = await getSupabaseAdmin()
    .from("content_block_templates")
    .select("id, slug, variant, config")
    .eq("id", id)
    .maybeSingle();
  if (existingError || !existing) throw new Error(existingError?.message || "البلوك غير موجود.");
  if (isRetiredContentBlockTemplateSlug(existing.slug)) {
    throw new Error("هذا الموديول متقاعد ولا يملك مسار تعديل نشطًا.");
  }

  // Structured content modules keep slug locked — never overwrite from request.
  const slugLocked = isStructuralContentTemplateSlug(existing.slug, existing.variant);
  const requestedSlug = slugify(cleanText(formData.get("slug")) || name);
  const slug = slugLocked ? existing.slug : requestedSlug;

  if (!slug) throw new Error("بيانات البلوك غير مكتملة.");
  if (!(await ensureUniqueSlug(slug, id))) throw new Error("الـ slug مستخدم بالفعل.");

  if (isProjectsHubTemplate(existing.slug, existing.variant) && !isProjectsHubTemplate(slug, cleanText(formData.get("variant")) || null)) {
    throw new Error("لا يمكن تحويل موديول صفحة المشروعات إلى نوع عام.");
  }

  const variantInput = cleanText(formData.get("variant")) || null;
  const variant = resolveStructuredVariant(slug, variantInput);
  const requestedPageIds = parsePageIdsFromForm(formData);
  const nextConfig = await buildContentConfig(formData, slug, existing.config);

  const nextRow: TablesUpdate<"content_block_templates"> = {
    name,
    slug,
    description: readTemplateInternalDescription(formData),
    variant,
    style_preset: cleanText(formData.get("style_preset")) || "premium-dark",
    status: parseFormStatus(formData),
    config: nextConfig,
    updated_at: new Date().toISOString(),
  };
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "content_block_templates",
    leaseEntityIdentity: String(id),
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `content-block:update:${id}`,
    mutate: async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("content_block_templates")
        .update(nextRow)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "Unable to update content block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });

  await syncBlockModulePageAssignments("content", id, requestedPageIds, actor);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("content_block_template", "update"),
    entityType: "content_block_template",
    entityId: id,
    entityLabel: name,
    metadata: { slug, variant, projects_hub: isProjectsHubTemplate(slug, variant) },
  });
  await revalidateBlockModulePaths("content");
  redirect(withModuleEditorReturnContextFromForm(
    `/admin/pages-blocks/blocks/content/${id}?saved=1${coordinated.mediaSynchronization.status === "saved_with_media_sync_warning" ? "&notice=saved_with_media_sync_warning" : ""}`,
    formData,
  ));
}

export async function toggleContentBlockStatus(formData: FormData) {
  await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  const nextStatus = getStatus(cleanText(formData.get("next_status")) || "unpublished");
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

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("content_block_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const cleanupIdentity = existing?.id ?? id;

  const { error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .delete()
    .eq("id", cleanupIdentity);
  if (error) throw new Error(error.message);

  const mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [],
    null,
    [{ domainKey: "content_block_templates", entityIdentity: cleanupIdentity }],
  );
  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("content");
    } catch (revalidationError) {
      console.error("Content block delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/content?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("content");
}

export async function duplicateContentBlock(formData: FormData) {
  const actor = await requireAdminSession();
  const id = parseNumber(formData.get("id"));
  if (!id) throw new Error("معرّف البلوك مفقود.");

  const { data: source, error } = await getSupabaseAdmin().from("content_block_templates").select("*").eq("id", id).single();
  if (error || !source) throw new Error(error?.message || "البلوك غير موجود.");

  const copySlug = `${source.slug}-copy-${Date.now()}`;

  const nextRow = {
    name: `${source.name} - نسخة`,
    slug: copySlug,
    description: source.description,
    variant: source.variant,
    style_preset: source.style_preset,
    status: "unpublished",
    config: source.config,
    sort_order: (source.sort_order ?? 0) + 1,
  };
  const provisionalIdentity = `duplicate:${id}:${crypto.randomUUID()}`;
  const coordinated = await coordinateMediaReferenceEntityMutation({
    domainKey: "content_block_templates",
    leaseEntityIdentity: provisionalIdentity,
    intendedRow: nextRow,
    actorId: actor.id,
    requestIdentity: `content-block:duplicate:${id}`,
    mutate: async () => {
      const { data, error: insertError } = await getSupabaseAdmin()
        .from("content_block_templates")
        .insert(nextRow)
        .select("id")
        .single();
      if (insertError || !data) throw new Error(insertError?.message ?? "Unable to duplicate content block.");
      return data;
    },
    resolveEntityIdentity: (value) => String(value.id),
  });
  await revalidateBlockModulePaths("content");
  if (coordinated.mediaSynchronization.status === "saved_with_media_sync_warning") {
    redirect("/admin/pages-blocks/blocks/content?notice=saved_with_media_sync_warning");
  }
}

export async function bulkContentBlocks(formData: FormData) {
  await requireAdminSession();
  const action = parsePageBlockBulkAction(
    formData.get("bulk_action"),
    PAGE_BLOCK_BULK_ACTIONS,
  );
  const ids = parsePageBlockBulkIds(formData.getAll("ids"));

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide") {
    const status = action === "publish" ? "published" : "unpublished";
    const { error } = await getSupabaseAdmin().from("content_block_templates").update({ status, updated_at: now }).in("id", ids);
    if (error) throw new Error(error.message);
  }

  let mediaSynchronization: MediaReferenceSynchronizationResult | null = null;
  if (action === "delete") {
    const { data: existingRows, error: lookupError } = await getSupabaseAdmin()
      .from("content_block_templates")
      .select("id")
      .in("id", ids);
    if (lookupError) throw new Error(lookupError.message);

    const capturedIds = (existingRows ?? []).map((row) => Number(row.id));
    const cleanupIds = [...new Set([...capturedIds, ...ids])];
    const { error } = await getSupabaseAdmin()
      .from("content_block_templates")
      .delete()
      .in("id", cleanupIds);
    if (error) throw new Error(error.message);

    mediaSynchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      cleanupIds.map((cleanupId) => ({
        domainKey: "content_block_templates",
        entityIdentity: cleanupId,
      })),
    );
  }

  if (mediaSynchronization?.status === "saved_with_media_sync_warning") {
    try {
      await revalidateBlockModulePaths("content");
    } catch (revalidationError) {
      console.error("Content block bulk delete committed with a Media synchronization warning; cache revalidation also failed.", revalidationError);
    }
    redirect("/admin/pages-blocks/blocks/content?notice=saved_with_media_sync_warning");
  }
  await revalidateBlockModulePaths("content");
}

export type ContentBlockRow = Pick<
  Tables<"content_block_templates">,
  "id" | "name" | "slug" | "description" | "variant" | "status" | "updated_at"
>;

export async function getContentBlockRows(): Promise<ContentBlockRow[]> {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("content_block_templates")
    .select("id,name,slug,description,variant,status,updated_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => !isRetiredContentBlockTemplateSlug(row.slug));
}
