"use client";

import { useMemo, useState } from "react";

import {
  getFeaturedProjects,
  getProjectStats,
  getProjectsByFilter,
} from "../../lib/projects/public-helpers";
import type { ProjectHubFilterId, PublicProject } from "../../lib/projects/public-types";
import ProjectsFeaturedSection from "./ProjectsFeaturedSection";
import ProjectsHubCTA from "./ProjectsHubCTA";
import ProjectsHubHero from "./ProjectsHubHero";
import ProjectsListSection from "./ProjectsListSection";
import ProjectsMapSection from "./ProjectsMapSection";

type ProjectsHubPageProps = {
  projects: PublicProject[];
};

export default function ProjectsHubPage({ projects }: ProjectsHubPageProps) {
  const [activeFilter, setActiveFilter] = useState<ProjectHubFilterId>("all");

  const filteredProjects = useMemo(
    () => getProjectsByFilter(projects, activeFilter),
    [projects, activeFilter],
  );

  const featuredProjects = useMemo(() => getFeaturedProjects(projects), [projects]);
  const stats = useMemo(() => getProjectStats(projects), [projects]);

  return (
    <main
      className="relative z-10 min-h-screen overflow-hidden bg-[#05070B] text-white"
      dir="rtl"
    >
      <div
        aria-hidden
        className="venesia-grain pointer-events-none fixed inset-0 z-[4]"
      />

      <ProjectsHubHero projects={projects} featuredProject={featuredProjects[0]} />

      <ProjectsFeaturedSection projects={featuredProjects} />

      <ProjectsListSection
        projects={filteredProjects}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        stats={stats}
      />

      <ProjectsMapSection projects={filteredProjects} />
    </main>
  );
}
