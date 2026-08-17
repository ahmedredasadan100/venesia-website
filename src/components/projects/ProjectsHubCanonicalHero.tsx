"use client";

import DynamicHeroSection from "../sections/DynamicHeroSection";
import type { ProjectsHubRenderPlanModule } from "../../lib/projects/build-projects-hub-render-plan";
import { adaptProjectsHubHeroModule } from "../../lib/projects/project-hero-adapter";
import type { PublicProject } from "../../lib/projects/public-types";
import { asProjectsHubHeroConfig } from "../../lib/page-blocks/projects-hub-config";

type ProjectsHubHeroModule = Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-hero" }>;

const FALLBACK_MODULE: ProjectsHubHeroModule = {
  slug: "projects-hub-hero",
  sortOrder: 0,
  assignmentId: 0,
  isVisible: true,
  config: asProjectsHubHeroConfig(null),
};

export default function ProjectsHubCanonicalHero({
  projects,
  module = FALLBACK_MODULE,
}: {
  projects: PublicProject[];
  module?: ProjectsHubHeroModule;
}) {
  const presentation = adaptProjectsHubHeroModule(module, projects);
  return (
    <DynamicHeroSection
      hero={presentation.hero}
      domainSlides={presentation.slides}
      autoplayMs={presentation.autoplayMs}
      emptyState={presentation.emptyState}
    />
  );
}
