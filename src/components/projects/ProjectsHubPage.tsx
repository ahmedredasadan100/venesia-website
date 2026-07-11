"use client";

import { useMemo, useState } from "react";

import type { ProjectsHubRenderPlanModule } from "../../lib/projects/build-projects-hub-render-plan";
import {
  getFeaturedProjects,
  getProjectStats,
  getProjectsByFilter,
} from "../../lib/projects/public-helpers";
import type { ProjectHubFilterId, PublicProject } from "../../lib/projects/public-types";
import ProjectsFeaturedSection from "./ProjectsFeaturedSection";
import ProjectsHubHero from "./ProjectsHubHero";
import ProjectsHubModulesRenderer from "./ProjectsHubModulesRenderer";
import ProjectsListSection from "./ProjectsListSection";
import ProjectsMapSection from "./ProjectsMapSection";

type ProjectsHubPageProps = {
  projects: PublicProject[];
  /** When omitted/empty, the original hard-coded section order is used. */
  modulePlan?: ProjectsHubRenderPlanModule[];
};

function resolveInitialFilter(modulePlan?: ProjectsHubRenderPlanModule[]): ProjectHubFilterId {
  const listing = modulePlan?.find((module) => module.slug === "projects-hub-listing");
  if (!listing || listing.slug !== "projects-hub-listing") return "all";
  return listing.config.defaultFilter;
}

export default function ProjectsHubPage({ projects, modulePlan }: ProjectsHubPageProps) {
  const [activeFilter, setActiveFilter] = useState<ProjectHubFilterId>(() =>
    resolveInitialFilter(modulePlan),
  );

  const filteredProjects = useMemo(
    () => getProjectsByFilter(projects, activeFilter),
    [projects, activeFilter],
  );

  const featuredProjects = useMemo(() => getFeaturedProjects(projects), [projects]);
  const stats = useMemo(() => getProjectStats(projects), [projects]);
  const useCmsPlan = Boolean(modulePlan?.length);

  return (
    <main
      className="relative z-10 min-h-screen overflow-hidden bg-[#05070B] text-white"
      dir="rtl"
    >
      <div
        aria-hidden
        className="venesia-grain pointer-events-none fixed inset-0 z-[4]"
      />

      {useCmsPlan ? (
        <ProjectsHubModulesRenderer
          projects={projects}
          featuredProjects={featuredProjects}
          filteredProjects={filteredProjects}
          modules={modulePlan!}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          stats={stats}
        />
      ) : (
        <>
          <ProjectsHubHero projects={projects} featuredProject={featuredProjects[0]} />

          <ProjectsFeaturedSection projects={featuredProjects} />

          <ProjectsListSection
            projects={filteredProjects}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            stats={stats}
          />

          <ProjectsMapSection projects={filteredProjects} />
        </>
      )}
    </main>
  );
}
