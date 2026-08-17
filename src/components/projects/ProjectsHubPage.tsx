"use client";

import { useMemo, useState } from "react";

import type { ProjectsHubRenderPlanModule } from "../../lib/projects/build-projects-hub-render-plan";
import {
  getFeaturedProjects,
  getProjectsByFilter,
  sortProjectsByHomepageOrder,
} from "../../lib/projects/public-helpers";
import type { ProjectHubFilterId, PublicProject } from "../../lib/projects/public-types";
import ProjectsFeaturedSection from "./ProjectsFeaturedSection";
import ProjectsHubCanonicalHero from "./ProjectsHubCanonicalHero";
import ProjectsHubModulesRenderer from "./ProjectsHubModulesRenderer";
import ProjectsListSection from "./ProjectsListSection";
import ProjectsMapSection from "./ProjectsMapSection";

type ProjectsHubPageProps = {
  projects: PublicProject[];
  /** When omitted/empty, the original hard-coded section order is used. */
  modulePlan?: ProjectsHubRenderPlanModule[];
};

export default function ProjectsHubPage({ projects, modulePlan }: ProjectsHubPageProps) {
  const listingModule = modulePlan?.find((module) => module.slug === "projects-hub-listing");
  const [activeFilter, setActiveFilter] = useState<ProjectHubFilterId>(
    () => listingModule?.config.defaultFilter ?? "all",
  );
  const orderedProjects = useMemo(() => sortProjectsByHomepageOrder(projects), [projects]);

  const filteredProjects = useMemo(
    () => getProjectsByFilter(orderedProjects, activeFilter),
    [orderedProjects, activeFilter],
  );

  const featuredProjects = useMemo(() => getFeaturedProjects(orderedProjects), [orderedProjects]);
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
          projects={orderedProjects}
          featuredProjects={featuredProjects}
          filteredProjects={filteredProjects}
          modules={modulePlan!}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      ) : (
        <>
          <ProjectsHubCanonicalHero projects={orderedProjects} />

          <ProjectsFeaturedSection projects={featuredProjects} />

          <ProjectsListSection
            projects={filteredProjects}
            allProjects={orderedProjects}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />

          <ProjectsMapSection projects={filteredProjects} />
        </>
      )}
    </main>
  );
}
