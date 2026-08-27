import type { HeroDomainSlide } from "../hero/domain-backed-slides";
import { getDefaultAssignmentPosition } from "../page-composition/page-assignment-contract";
import type { HeroSectionData } from "../page-sections";
import type { ProjectsHubHeroModuleConfig } from "../page-blocks/projects-hub-config";
import type { ProjectsHubRenderPlanModule } from "./build-projects-hub-render-plan";
import { getProjectHref, sortProjectsByHomepageOrder } from "./public-helpers";
import type { PublicProject } from "./public-types";

type ProjectsHubHeroModule = Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-hero" }>;

function typeMatches(project: PublicProject, type: ProjectsHubHeroModuleConfig["projectType"]) {
  return type === "both" || project.category === type;
}

export function adaptProjectsToHeroSlides(
  projects: PublicProject[],
  config: ProjectsHubHeroModuleConfig,
): HeroDomainSlide[] {
  return sortProjectsByHomepageOrder(projects)
    .filter((project) => typeMatches(project, config.projectType))
    .slice(0, config.limit)
    .map((project) => ({
      id: project.id,
      desktopImage: project.heroImage.src,
      imageAlt: project.heroImage.alt,
      eyebrow: config.showEyebrow ? project.location.label : undefined,
      title: project.englishName,
      subtitle: project.arabicName,
      description: project.shortDescription,
      primaryCtaLabel: config.showCta ? config.primaryCtaLabel : undefined,
      primaryCtaHref: config.showCta ? getProjectHref(project) : undefined,
    }));
}

export function adaptProjectsHubHeroModule(
  module: ProjectsHubHeroModule,
  projects: PublicProject[],
) {
  const { config } = module;
  const hero: HeroSectionData = {
    id: module.assignmentId,
    page_id: 0,
    section_key: "projects-hub-hero",
    section_type: "hero",
    slot: getDefaultAssignmentPosition("hero"),
      variant: "projects-hub",
    style_preset: "cinematic-gold",
    source_type: "domain-backed",
    source_id: null,
    source_slug: "projects",
    limit_count: config.limit,
    is_visible: true,
    sort_order: module.sortOrder,
    config: {
      showEyebrow: config.showEyebrow,
      eyebrowBold: config.eyebrowBold,
      eyebrowAlignment: config.eyebrowAlignment,
      showTitle: config.showTitle,
      titleBold: config.titleBold,
      titleAlignment: config.titleAlignment,
      showHighlight: config.showHighlight,
      highlightBold: config.highlightBold,
      highlightAlignment: config.highlightAlignment,
      showSubtitle: config.showSubtitle,
      subtitleBold: config.subtitleBold,
      subtitleAlignment: config.subtitleAlignment,
      showDescription: config.showDescription,
      descriptionAlignment: config.descriptionAlignment,
      showCta: config.showCta,
      ctaBold: config.ctaBold,
      ctaAlignment: config.ctaAlignment,
      heroElementOrder: config.heroElementOrder,
    },
  };

  return {
    hero,
    slides: adaptProjectsToHeroSlides(projects, config),
    autoplayMs: config.autoplayMs,
    emptyState: config.emptyState,
  };
}
