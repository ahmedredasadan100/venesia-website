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
  autoplayMs: number;
  limit: number | null;
  selectionMode: "featured_flag";
};

export type ProjectsHubListingPresentationProps = {
  eyebrow: string;
  title: string;
  showEyebrow: boolean;
  showTitle: boolean;
  defaultFilter: ProjectHubFilterId;
  visibleFilters: ProjectHubFilterId[];
  showFilterBar: boolean;
  showProjectImage: boolean;
  showProjectCode: boolean;
  showProjectDescription: boolean;
  showProjectType: boolean;
  showProjectLocation: boolean;
  showExploreButton: boolean;
  defaultView: "list" | "cards";
  pageSize: number;
  sort: "homepage_order";
  showViewToggle: boolean;
  showPagination: boolean;
  showProjectCount: boolean;
};

export type ProjectsHubMapPresentationProps = {
  title: string;
  mapImage: string;
  exploreButtonLabel: string;
  mapPins: ProjectsHubMapPinConfig[];
};

/** Presentation-only defaults. Project identities and map pins are database-owned. */
export const PROJECTS_HUB_HERO_DEFAULTS: ProjectsHubHeroPresentationProps = {
  autoplayMs: 6000,
  emptyState: null,
  selectionMode: "auto_residential_with_media",
};

export const PROJECTS_HUB_FEATURED_DEFAULTS: ProjectsHubFeaturedPresentationProps = {
  title: "مشروع مميز",
  subtitle: "اختيار يعكس مسار التنفيذ على الأرض",
  showTitle: true,
  showSubtitle: true,
  showProjectImage: true,
  showProjectCode: true,
  showProjectName: true,
  showProjectDescription: true,
  showProjectType: true,
  showProjectLocation: true,
  showExploreButton: true,
  showSliderDots: true,
  autoplayMs: 6000,
  limit: null,
  selectionMode: "featured_flag",
};

export const PROJECTS_HUB_LISTING_DEFAULTS: ProjectsHubListingPresentationProps = {
  eyebrow: "Projects Index",
  title: "جميع المشروعات",
  showEyebrow: true,
  showTitle: true,
  defaultFilter: "all",
  visibleFilters: ["all", "residential", "commercial"],
  showFilterBar: true,
  showProjectImage: true,
  showProjectCode: true,
  showProjectDescription: true,
  showProjectType: true,
  showProjectLocation: true,
  showExploreButton: true,
  defaultView: "list",
  pageSize: 6,
  sort: "homepage_order",
  showViewToggle: true,
  showPagination: true,
  showProjectCount: true,
};

export const PROJECTS_HUB_MAP_DEFAULTS: ProjectsHubMapPresentationProps = {
  title: "مشروعاتنا على الخريطة",
  mapImage: PROJECTS_HUB_DEFAULT_MAP_IMAGE,
  exploreButtonLabel: "استكشف على الخريطة",
  mapPins: [],
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
    showTitle: module.config.showTitle !== false,
    showSubtitle: module.config.showSubtitle !== false,
    showProjectImage: module.config.showProjectImage !== false,
    showProjectCode: module.config.showProjectCode !== false,
    showProjectName: module.config.showProjectName !== false,
    showProjectDescription: module.config.showProjectDescription !== false,
    showProjectType: module.config.showProjectType !== false,
    showProjectLocation: module.config.showProjectLocation !== false,
    showExploreButton: module.config.showExploreButton !== false,
    showSliderDots: module.config.showSliderDots !== false,
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
    showEyebrow: module.config.showEyebrow !== false,
    showTitle: module.config.showTitle !== false,
    defaultFilter: module.config.defaultFilter,
    visibleFilters: module.config.visibleFilters.length
      ? module.config.visibleFilters
      : PROJECTS_HUB_LISTING_DEFAULTS.visibleFilters,
    showFilterBar: module.config.showFilterBar !== false,
    showProjectImage: module.config.showProjectImage !== false,
    showProjectCode: module.config.showProjectCode !== false,
    showProjectDescription: module.config.showProjectDescription !== false,
    showProjectType: module.config.showProjectType !== false,
    showProjectLocation: module.config.showProjectLocation !== false,
    showExploreButton: module.config.showExploreButton !== false,
    defaultView: module.config.defaultView,
    pageSize: module.config.pageSize || PROJECTS_HUB_LISTING_DEFAULTS.pageSize,
    sort: module.config.sort,
    showViewToggle: module.config.showViewToggle !== false,
    showPagination: module.config.showPagination !== false,
    showProjectCount: module.config.showProjectCount !== false,
  };
}

export function mapProjectsHubMapProps(
  module: Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-map" }>,
): ProjectsHubMapPresentationProps {
  return {
    title: module.config.title || PROJECTS_HUB_MAP_DEFAULTS.title,
    mapImage: module.config.mapImage || PROJECTS_HUB_MAP_DEFAULTS.mapImage,
    exploreButtonLabel: module.config.exploreButtonLabel || PROJECTS_HUB_MAP_DEFAULTS.exploreButtonLabel,
    mapPins: module.config.mapPins,
  };
}

/** Apply featured limit without mutating project rows. */
export function applyFeaturedLimit(projects: PublicProject[], limit: number | null) {
  if (limit == null || limit <= 0) return projects;
  return projects.slice(0, limit);
}
