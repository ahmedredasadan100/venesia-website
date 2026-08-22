"use client";

import DynamicHeroSection from "../sections/DynamicHeroSection";
import type { ProjectsHubRenderPlanModule } from "../../lib/projects/build-projects-hub-render-plan";
import { adaptProjectsHubHeroModule } from "../../lib/projects/project-hero-adapter";
import type { PublicProject } from "../../lib/projects/public-types";

type ProjectsHubHeroModule = Extract<ProjectsHubRenderPlanModule, { slug: "projects-hub-hero" }>;

export default function ProjectsHubCanonicalHero({
  projects,
  module,
}: {
  projects: PublicProject[];
  module: ProjectsHubHeroModule;
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
