"use client";

import { useMemo, useState } from "react";

import type { ProjectsHubRenderPlanModule } from "../../lib/projects/build-projects-hub-render-plan";
import {
  getFeaturedProjects,
  getProjectsByFilter,
  sortProjectsByHomepageOrder,
} from "../../lib/projects/public-helpers";
import type { ProjectHubFilterId, PublicProject } from "../../lib/projects/public-types";
import ProjectsHubModulesRenderer from "./ProjectsHubModulesRenderer";

type ProjectsHubPageProps = {
  projects: PublicProject[];
  modulePlan: ProjectsHubRenderPlanModule[];
};

export function ProjectsHubUnavailableState() {
  return (
    <main
      className="relative z-10 flex min-h-[70vh] items-center justify-center overflow-hidden bg-[#05070B] px-6 text-white"
      data-projects-hub-state="unavailable"
      dir="rtl"
    >
      <div
        aria-hidden
        className="venesia-grain pointer-events-none fixed inset-0 z-[4]"
      />
      <section
        aria-labelledby="projects-hub-unavailable-title"
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">
          VENESIA
        </p>
        <h1
          id="projects-hub-unavailable-title"
          className="mt-4 text-3xl font-semibold"
        >
          صفحة المشروعات غير متاحة مؤقتًا
        </h1>
        <p className="mt-4 leading-8 text-white/60">
          يجري تجهيز محتوى المشروعات للنشر. يرجى المحاولة مرة أخرى لاحقًا.
        </p>
      </section>
    </main>
  );
}

export default function ProjectsHubPage({ projects, modulePlan }: ProjectsHubPageProps) {
  const listingModule = modulePlan.find((module) => module.slug === "projects-hub-listing");
  const [activeFilter, setActiveFilter] = useState<ProjectHubFilterId>(
    () => listingModule?.config.defaultFilter ?? "all",
  );
  const orderedProjects = useMemo(() => sortProjectsByHomepageOrder(projects), [projects]);

  const filteredProjects = useMemo(
    () => getProjectsByFilter(orderedProjects, activeFilter),
    [orderedProjects, activeFilter],
  );

  const featuredProjects = useMemo(() => getFeaturedProjects(orderedProjects), [orderedProjects]);
  return (
    <main
      className="relative z-10 min-h-screen overflow-hidden bg-[#05070B] text-white"
      dir="rtl"
    >
      <div
        aria-hidden
        className="venesia-grain pointer-events-none fixed inset-0 z-[4]"
      />

      <ProjectsHubModulesRenderer
        projects={orderedProjects}
        featuredProjects={featuredProjects}
        filteredProjects={filteredProjects}
        modules={modulePlan}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
    </main>
  );
}
