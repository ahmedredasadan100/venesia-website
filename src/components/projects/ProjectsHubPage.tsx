"use client";

import { useMemo, useState } from "react";

import type { ProjectsHubRenderPlanModule } from "../../lib/projects/build-projects-hub-render-plan";
import {
  getFeaturedProjects,
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

export default function ProjectsHubPage({ projects, modulePlan }: ProjectsHubPageProps) {
  /** Shared Listing + Map filter; always starts at `all` (not chosen from Admin). */
  const [activeFilter, setActiveFilter] = useState<ProjectHubFilterId>("all");

  const filteredProjects = useMemo(
    () => getProjectsByFilter(projects, activeFilter),
    [projects, activeFilter],
  );

  const featuredProjects = useMemo(() => getFeaturedProjects(projects), [projects]);
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
        />
      ) : (
        <>
          <ProjectsHubHero projects={projects} featuredProject={featuredProjects[0]} />

          <ProjectsFeaturedSection projects={featuredProjects} />

          <ProjectsListSection
            projects={filteredProjects}
            allProjects={projects}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />

          <ProjectsMapSection projects={filteredProjects} />
        </>
      )}
    </main>
  );
}
