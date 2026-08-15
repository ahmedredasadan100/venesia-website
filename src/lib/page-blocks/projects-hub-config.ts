/**
 * Typed config for Projects Hub content modules (admin editors only).
 * Public `/projects` does not consume these configs yet.
 */

import type { Json } from "../database.types";

export const PROJECTS_HUB_HERO_SELECTION_MODES = ["auto_residential_with_media"] as const;
export type ProjectsHubHeroSelectionMode = (typeof PROJECTS_HUB_HERO_SELECTION_MODES)[number];

export const PROJECTS_HUB_FEATURED_SELECTION_MODES = ["featured_flag"] as const;
export type ProjectsHubFeaturedSelectionMode = (typeof PROJECTS_HUB_FEATURED_SELECTION_MODES)[number];

export const PROJECTS_HUB_FILTER_IDS = ["all", "residential", "commercial"] as const;
export type ProjectsHubFilterId = (typeof PROJECTS_HUB_FILTER_IDS)[number];

export const PROJECTS_HUB_VIEW_MODES = ["list", "cards"] as const;
export type ProjectsHubViewMode = (typeof PROJECTS_HUB_VIEW_MODES)[number];

export const PROJECTS_HUB_SORT_MODES = ["homepage_order"] as const;
export type ProjectsHubSortMode = (typeof PROJECTS_HUB_SORT_MODES)[number];

export const PROJECTS_HUB_DEFAULT_MAP_IMAGE = "/images/projects/beit-elwatan-map1.webp";

export type ProjectsHubMapPinConfig = {
  code: string;
  district: string;
  right: string;
  top: string;
};

export type ProjectsHubHeroModuleConfig = {
  selectionMode: ProjectsHubHeroSelectionMode;
  autoplayMs: number;
  emptyState: string | null;
};

export type ProjectsHubFeaturedModuleConfig = {
  selectionMode: ProjectsHubFeaturedSelectionMode;
  title: string;
  subtitle: string;
  showTitle: boolean;
  showSubtitle: boolean;
  showProjectImage: boolean;
  showProjectCode: boolean;
  showProjectName: boolean;
  showProjectDescription: boolean;
  showProjectType: boolean;
  showProjectLocation: boolean;
  showExploreButton: boolean;
  showSliderDots: boolean;
  limit: number | null;
  autoplayMs: number;
};

export type ProjectsHubListingModuleConfig = {
  eyebrow: string;
  title: string;
  showEyebrow: boolean;
  showTitle: boolean;
  /** Filters remain derived from loaded project types — not Admin-selected. */
  defaultFilter: ProjectsHubFilterId;
  visibleFilters: ProjectsHubFilterId[];
  showFilterBar: boolean;
  showProjectImage: boolean;
  showProjectCode: boolean;
  showProjectDescription: boolean;
  showProjectType: boolean;
  showProjectLocation: boolean;
  showExploreButton: boolean;
  defaultView: ProjectsHubViewMode;
  pageSize: number;
  sort: ProjectsHubSortMode;
  showViewToggle: boolean;
  showPagination: boolean;
  showProjectCount: boolean;
};

export type ProjectsHubMapModuleConfig = {
  title: string;
  mapImage: string;
  exploreButtonLabel: string;
  mapPins: ProjectsHubMapPinConfig[];
};

export const PROJECTS_HUB_HERO_KEYS = ["selectionMode", "autoplayMs", "emptyState"] as const;
export const PROJECTS_HUB_FEATURED_KEYS = [
  "selectionMode",
  "title",
  "subtitle",
  "showTitle",
  "showSubtitle",
  "showProjectImage",
  "showProjectCode",
  "showProjectName",
  "showProjectDescription",
  "showProjectType",
  "showProjectLocation",
  "showExploreButton",
  "showSliderDots",
  "limit",
  "autoplayMs",
] as const;
export const PROJECTS_HUB_LISTING_KEYS = [
  "eyebrow",
  "title",
  "showEyebrow",
  "showTitle",
  "defaultFilter",
  "visibleFilters",
  "showFilterBar",
  "showProjectImage",
  "showProjectCode",
  "showProjectDescription",
  "showProjectType",
  "showProjectLocation",
  "showExploreButton",
  "defaultView",
  "pageSize",
  "sort",
  "showViewToggle",
  "showPagination",
  "showProjectCount",
] as const;
export const PROJECTS_HUB_MAP_KEYS = ["title", "mapImage", "exploreButtonLabel", "mapPins"] as const;

export function isProjectsHubHeroTemplate(slug: string, variant?: string | null) {
  return slug === "projects-hub-hero" || variant === "projects-hub-hero";
}

export function isProjectsHubFeaturedTemplate(slug: string, variant?: string | null) {
  return slug === "projects-hub-featured" || variant === "projects-hub-featured";
}

export function isProjectsHubListingTemplate(slug: string, variant?: string | null) {
  return slug === "projects-hub-listing" || variant === "projects-hub-listing";
}

export function isProjectsHubMapTemplate(slug: string, variant?: string | null) {
  return slug === "projects-hub-map" || variant === "projects-hub-map";
}

export function isProjectsHubTemplate(slug: string, variant?: string | null) {
  return (
    isProjectsHubHeroTemplate(slug, variant) ||
    isProjectsHubFeaturedTemplate(slug, variant) ||
    isProjectsHubListingTemplate(slug, variant) ||
    isProjectsHubMapTemplate(slug, variant)
  );
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInt(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return fallback;
}

function readNullablePositiveInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return null;
}

function isFilterId(value: string): value is ProjectsHubFilterId {
  return (PROJECTS_HUB_FILTER_IDS as readonly string[]).includes(value);
}

/** Missing keys resolve to current public Listing defaults (visible = true). */
function readShowFlag(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "false" || value === "0") return false;
  if (value === "true" || value === "1") return true;
  return fallback;
}

export function asProjectsHubHeroConfig(raw: unknown): ProjectsHubHeroModuleConfig {
  const config = asRecord(raw);
  const selectionMode = readText(config.selectionMode);
  return {
    selectionMode: PROJECTS_HUB_HERO_SELECTION_MODES.includes(selectionMode as ProjectsHubHeroSelectionMode)
      ? (selectionMode as ProjectsHubHeroSelectionMode)
      : "auto_residential_with_media",
    autoplayMs: readPositiveInt(config.autoplayMs, 6000),
    emptyState: config.emptyState == null || config.emptyState === "" ? null : readText(config.emptyState) || null,
  };
}

export function asProjectsHubFeaturedConfig(raw: unknown): ProjectsHubFeaturedModuleConfig {
  const config = asRecord(raw);
  const selectionMode = readText(config.selectionMode);
  return {
    selectionMode: PROJECTS_HUB_FEATURED_SELECTION_MODES.includes(
      selectionMode as ProjectsHubFeaturedSelectionMode,
    )
      ? (selectionMode as ProjectsHubFeaturedSelectionMode)
      : "featured_flag",
    title: readText(config.title) || "مشروع مميز",
    subtitle: readText(config.subtitle) || "اختيار يعكس مسار التنفيذ على الأرض",
    showTitle: readShowFlag(config.showTitle ?? config.show_title),
    showSubtitle: readShowFlag(config.showSubtitle ?? config.show_subtitle),
    showProjectImage: readShowFlag(config.showProjectImage ?? config.show_project_image),
    showProjectCode: readShowFlag(config.showProjectCode ?? config.show_project_code),
    showProjectName: readShowFlag(config.showProjectName ?? config.show_project_name),
    showProjectDescription: readShowFlag(config.showProjectDescription ?? config.show_project_description),
    showProjectType: readShowFlag(config.showProjectType ?? config.show_project_type),
    showProjectLocation: readShowFlag(config.showProjectLocation ?? config.show_project_location),
    showExploreButton: readShowFlag(config.showExploreButton ?? config.show_explore_button),
    showSliderDots: readShowFlag(config.showSliderDots ?? config.show_slider_dots),
    limit: readNullablePositiveInt(config.limit),
    autoplayMs: readPositiveInt(config.autoplayMs, 6000),
  };
}

export function asProjectsHubListingConfig(raw: unknown): ProjectsHubListingModuleConfig {
  const config = asRecord(raw);
  // Chips are derived from loaded project types on the public page; keep registry keys for compat.
  const visibleRaw = Array.isArray(config.visibleFilters) ? config.visibleFilters : ["all", "residential", "commercial"];
  const visibleFilters = visibleRaw
    .map((item) => readText(item))
    .filter(isFilterId);
  const filters = visibleFilters.length ? visibleFilters : (["all", "residential", "commercial"] as ProjectsHubFilterId[]);
  const defaultViewRaw = readText(config.defaultView);
  const sortRaw = readText(config.sort);

  return {
    eyebrow: readText(config.eyebrow) || "Projects Index",
    title: readText(config.title) || "جميع المشروعات",
    showEyebrow: readShowFlag(config.showEyebrow ?? config.show_eyebrow),
    showTitle: readShowFlag(config.showTitle ?? config.show_title),
    defaultFilter: "all",
    visibleFilters: filters.length ? filters : (["all", "residential", "commercial"] as ProjectsHubFilterId[]),
    showFilterBar: readShowFlag(config.showFilterBar ?? config.show_filter_bar),
    showProjectImage: readShowFlag(config.showProjectImage ?? config.show_project_image),
    showProjectCode: readShowFlag(config.showProjectCode ?? config.show_project_code),
    showProjectDescription: readShowFlag(config.showProjectDescription ?? config.show_project_description),
    showProjectType: readShowFlag(config.showProjectType ?? config.show_project_type),
    showProjectLocation: readShowFlag(config.showProjectLocation ?? config.show_project_location),
    showExploreButton: readShowFlag(config.showExploreButton ?? config.show_explore_button),
    defaultView: PROJECTS_HUB_VIEW_MODES.includes(defaultViewRaw as ProjectsHubViewMode)
      ? (defaultViewRaw as ProjectsHubViewMode)
      : "list",
    pageSize: readPositiveInt(config.pageSize, 6),
    sort: PROJECTS_HUB_SORT_MODES.includes(sortRaw as ProjectsHubSortMode)
      ? (sortRaw as ProjectsHubSortMode)
      : "homepage_order",
    showViewToggle: readShowFlag(config.showViewToggle ?? config.show_view_toggle),
    showPagination: readShowFlag(config.showPagination ?? config.show_pagination),
    showProjectCount: readShowFlag(config.showProjectCount ?? config.show_project_count),
  };
}

export function asProjectsHubMapConfig(raw: unknown): ProjectsHubMapModuleConfig {
  const config = asRecord(raw);
  const pinsRaw = Array.isArray(config.mapPins) ? config.mapPins : [];
  const mapPins = pinsRaw
    .map((item) => {
      const row = asRecord(item);
      const code = readText(row.code);
      const district = readText(row.district);
      const right = readText(row.right);
      const top = readText(row.top);
      if (!code && !district && !right && !top) return null;
      return { code, district, right, top };
    })
    .filter(Boolean) as ProjectsHubMapPinConfig[];

  return {
    title: readText(config.title) || "مشروعاتنا على الخريطة",
    mapImage: readText(config.mapImage) || PROJECTS_HUB_DEFAULT_MAP_IMAGE,
    exploreButtonLabel: readText(config.exploreButtonLabel) || "استكشف على الخريطة",
    mapPins,
  };
}

/** Merge typed fields onto existing config without dropping unknown top-level keys. */
export function mergeProjectsHubConfig<
  T extends { [Key in keyof T]: Json | undefined },
>(
  existing: Json | undefined,
  typedPatch: T,
  knownKeys: readonly (keyof T & string)[],
): { [key: string]: Json | undefined } {
  const base: { [key: string]: Json | undefined } =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  for (const key of knownKeys) {
    base[key] = typedPatch[key];
  }
  return base;
}

const UNSAFE_MEDIA_PATTERN = /[<>`]|javascript:|data:|\s/i;

export function assertSafeCmsMediaPath(path: string, fieldLabel: string) {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error(`${fieldLabel} مطلوب.`);
  }
  if (UNSAFE_MEDIA_PATTERN.test(trimmed) || trimmed.includes("://")) {
    throw new Error(`${fieldLabel} غير صالح.`);
  }
  if (!trimmed.startsWith("/images/") && !trimmed.startsWith("/files/")) {
    throw new Error(`${fieldLabel} يجب أن يبدأ بـ /images/ أو /files/.`);
  }
  return trimmed;
}

export function assertAutoplayMs(value: number) {
  if (!Number.isFinite(value) || value < 1000 || value > 60000) {
    throw new Error("مدة التشغيل التلقائي يجب أن تكون بين 1000 و 60000 مللي ثانية.");
  }
  return Math.floor(value);
}

export function assertPageSize(value: number) {
  if (!Number.isFinite(value) || value < 1 || value > 48) {
    throw new Error("حجم الصفحة يجب أن يكون بين 1 و 48.");
  }
  return Math.floor(value);
}

const PERCENT_PATTERN = /^\d+(\.\d+)?%$/;

export function assertMapPercent(value: string, fieldLabel: string) {
  const trimmed = value.trim();
  if (!PERCENT_PATTERN.test(trimmed)) {
    throw new Error(`${fieldLabel} يجب أن يكون نسبة مئوية مثل 20%.`);
  }
  return trimmed;
}

export function assertProjectCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("كود المشروع مطلوب لكل دبوس.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(trimmed)) {
    throw new Error(`كود المشروع غير صالح: ${trimmed}`);
  }
  return trimmed;
}

export function assertSafePlainText(value: string, fieldLabel: string, maxLength = 500) {
  const trimmed = value.trim();
  if (/[<>`]|javascript:/i.test(trimmed)) {
    throw new Error(`${fieldLabel} يحتوي على محتوى غير مسموح.`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldLabel} طويل جدًا.`);
  }
  return trimmed;
}
