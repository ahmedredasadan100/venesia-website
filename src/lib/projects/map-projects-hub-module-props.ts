import type { ProjectHubFilterId, PublicProject } from "./public-types";
import type { ProjectsHubRenderPlanModule } from "./build-projects-hub-render-plan";
import {
  PROJECTS_HUB_DEFAULT_MAP_IMAGE,
  type ProjectsHubMapPinConfig,
} from "../page-blocks/projects-hub-config";

export type ProjectsHubHeroPresentationProps = {
  autoplayMs: number;
  emptyState: string | null;
  selectionMode: "auto_residential_with_media";
};

export type ProjectsHubFeaturedPresentationProps = {
  title: string;
  subtitle: string;
  autoplayMs: number;
  limit: number | null;
  selectionMode: "featured_flag";
};

export type ProjectsHubListingPresentationProps = {
  eyebrow: string;
  title: string;
  defaultFilter: ProjectHubFilterId;
  visibleFilters: ProjectHubFilterId[];
  defaultView: "list" | "cards";
  pageSize: number;
  sort: "homepage_order";
};

export type ProjectsHubMapPresentationProps = {
  title: string;
  mapImage: string;
  exploreButtonLabel: string;
  mapPins: ProjectsHubMapPinConfig[];
};

/** Presentation defaults matching the current hard-coded public components. */
export const PROJECTS_HUB_HERO_DEFAULTS: ProjectsHubHeroPresentationProps = {
  autoplayMs: 6000,
  emptyState: null,
  selectionMode: "auto_residential_with_media",
};

export const PROJECTS_HUB_FEATURED_DEFAULTS: ProjectsHubFeaturedPresentationProps = {
  title: "مشروع مميز",
  subtitle: "اختيار يعكس مسار التنفيذ على الأرض",
  autoplayMs: 6000,
  limit: null,
  selectionMode: "featured_flag",
};

export const PROJECTS_HUB_LISTING_DEFAULTS: ProjectsHubListingPresentationProps = {
  eyebrow: "Projects Index",
  title: "جميع المشروعات",
  defaultFilter: "all",
  visibleFilters: ["all", "residential", "commercial"],
  defaultView: "list",
  pageSize: 6,
  sort: "homepage_order",
};

export const PROJECTS_HUB_MAP_DEFAULTS: ProjectsHubMapPresentationProps = {
  title: "مشروعاتنا على الخريطة",
  mapImage: PROJECTS_HUB_DEFAULT_MAP_IMAGE,
  exploreButtonLabel: "استكشف على الخريطة",
  mapPins: [
    { code: "I87", district: "الحي الأول", right: "20%", top: "50%" },
    { code: "I76", district: "الحي الأول", right: "27%", top: "45%" },
    { code: "B84", district: "الحي الأول", right: "34%", top: "52%" },
    { code: "C35", district: "الحي الثاني", right: "50%", top: "46%" },
    { code: "J118", district: "الحي الثاني", right: "57%", top: "53%" },
    { code: "J191", district: "الحي الثاني", right: "63%", top: "46%" },
    { code: "F92", district: "الحي الرابع", right: "45%", top: "72%" },
    { code: "F222", district: "الحي الرابع", right: "55%", top: "74%" },
    { code: "D174", district: "النورث هاوس", right: "38%", top: "25%" },
    { code: "B137", district: "النورث هاوس", right: "48%", top: "21%" },
    { code: "B138", district: "النورث هاوس", right: "58%", top: "27%" },
  ],
};

export function mapProjectsHubHeroProps(
  module: Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-hero" }>,
): ProjectsHubHeroPresentationProps {
  return {
    selectionMode: module.config.selectionMode,
    autoplayMs: module.config.autoplayMs || PROJECTS_HUB_HERO_DEFAULTS.autoplayMs,
    emptyState: module.config.emptyState ?? null,
  };
}

export function mapProjectsHubFeaturedProps(
  module: Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-featured" }>,
): ProjectsHubFeaturedPresentationProps {
  return {
    selectionMode: module.config.selectionMode,
    title: module.config.title || PROJECTS_HUB_FEATURED_DEFAULTS.title,
    subtitle: module.config.subtitle || PROJECTS_HUB_FEATURED_DEFAULTS.subtitle,
    autoplayMs: module.config.autoplayMs || PROJECTS_HUB_FEATURED_DEFAULTS.autoplayMs,
    limit: module.config.limit,
  };
}

export function mapProjectsHubListingProps(
  module: Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-listing" }>,
): ProjectsHubListingPresentationProps {
  return {
    eyebrow: module.config.eyebrow || PROJECTS_HUB_LISTING_DEFAULTS.eyebrow,
    title: module.config.title || PROJECTS_HUB_LISTING_DEFAULTS.title,
    defaultFilter: module.config.defaultFilter,
    visibleFilters: module.config.visibleFilters.length
      ? module.config.visibleFilters
      : PROJECTS_HUB_LISTING_DEFAULTS.visibleFilters,
    defaultView: module.config.defaultView,
    pageSize: module.config.pageSize || PROJECTS_HUB_LISTING_DEFAULTS.pageSize,
    sort: module.config.sort,
  };
}

export function mapProjectsHubMapProps(
  module: Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-map" }>,
): ProjectsHubMapPresentationProps {
  return {
    title: module.config.title || PROJECTS_HUB_MAP_DEFAULTS.title,
    mapImage: module.config.mapImage || PROJECTS_HUB_MAP_DEFAULTS.mapImage,
    exploreButtonLabel: module.config.exploreButtonLabel || PROJECTS_HUB_MAP_DEFAULTS.exploreButtonLabel,
    mapPins: module.config.mapPins.length ? module.config.mapPins : PROJECTS_HUB_MAP_DEFAULTS.mapPins,
  };
}

/** Apply featured limit without mutating project rows. */
export function applyFeaturedLimit(projects: PublicProject[], limit: number | null) {
  if (limit == null || limit <= 0) return projects;
  return projects.slice(0, limit);
}
