import type { HeroDomainSlide } from "../hero/domain-backed-slides";
import type { HeroSectionData } from "../page-sections";
import type { ProjectsHubHeroModuleConfig } from "../page-blocks/projects-hub-config";
import type { ProjectsHubRenderPlanModule } from "./build-projects-hub-render-plan";
import { getProjectHref } from "./public-helpers";
import type { PublicProject } from "./public-types";

type ProjectsHubHeroModule = Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-hero" }>;

function typeMatches(project: PublicProject, type: ProjectsHubHeroModuleConfig["projectType"]) {
  return type === "both" || project.category === type;
}

export function adaptProjectsToHeroSlides(
  projects: PublicProject[],
  config: ProjectsHubHeroModuleConfig,
): HeroDomainSlide[] {
  const references = new Map(
    config.projectReferences.map((reference) => [reference.projectId, reference]),
  );

  return projects
    .map((project, sourceIndex) => ({ project, sourceIndex, reference: references.get(Number(project.id)) }))
    .filter(({ project, reference }) => typeMatches(project, config.projectType) && reference?.visible !== false)
    .sort((left, right) => {
      const leftExplicit = left.reference ? 0 : 1;
      const rightExplicit = right.reference ? 0 : 1;
      const leftOrder = left.reference?.order ?? (left.project.homepageOrder > 0 ? left.project.homepageOrder : Number.MAX_SAFE_INTEGER);
      const rightOrder = right.reference?.order ?? (right.project.homepageOrder > 0 ? right.project.homepageOrder : Number.MAX_SAFE_INTEGER);
      return leftExplicit - rightExplicit || leftOrder - rightOrder || left.sourceIndex - right.sourceIndex;
    })
    .slice(0, config.limit)
    .map(({ project }) => ({
      id: project.id,
      desktopImage: project.heroImage.src,
      imageAlt: project.heroImage.alt,
      eyebrow: project.location.label,
      title: project.englishName,
      subtitle: project.arabicName,
      description: project.shortDescription,
      primaryCtaLabel: "استكشف المشروع",
      primaryCtaHref: getProjectHref(project),
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
    slot: "hero",
    variant: config.variant,
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
      showBreadcrumb: config.showBreadcrumb,
      breadcrumbBold: config.breadcrumbBold,
      breadcrumbAlignment: config.breadcrumbAlignment,
      breadcrumbCurrentLabel: config.breadcrumbCurrentLabel,
      showCta: config.showCta,
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
