"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  getProjectHref,
} from "../../lib/projects/public-helpers";
import type { ProjectHubFilterId, PublicProject } from "../../lib/projects/public-types";
import ProjectsHubFilters from "./ProjectsHubFilters";
import PlainTextContent from "../content/PlainTextContent";

type ViewMode = "list" | "cards";

type ProjectsListSectionProps = {
  projects: PublicProject[];
  activeFilter: ProjectHubFilterId;
  onFilterChange: (filter: ProjectHubFilterId) => void;
  stats: {
    total: number;
    residential: number;
    commercial: number;
  };
};

const PROJECTS_PER_PAGE = 6;

export default function ProjectsListSection({
  projects,
  activeFilter,
  onFilterChange,
  stats,
}: ProjectsListSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentPage, setCurrentPage] = useState(1);
  const projectsStartRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(projects.length / PROJECTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProjects = useMemo(() => {
    const start = (safeCurrentPage - 1) * PROJECTS_PER_PAGE;
    return projects.slice(start, start + PROJECTS_PER_PAGE);
  }, [projects, safeCurrentPage]);

  const handleFilterChange = (filter: ProjectHubFilterId) => {
    setCurrentPage(1);
    onFilterChange(filter);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);

    window.requestAnimationFrame(() => {
      projectsStartRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <section className="px-6 pt-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-en text-[11px] uppercase tracking-[0.24em] text-[#D8B87A]/55">
              Projects Index
            </p>

            <h2 className="text-2xl font-semibold text-[#D8B87A]">
              جميع المشروعات
              <span className="mr-2 text-sm font-normal text-white/45">
                ({projects.length} مشروع)
              </span>
            </h2>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                setViewMode("list");
              }}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                viewMode === "list"
                  ? "border-[#D8B87A]/35 text-[#D8B87A]"
                  : "border-white/10 text-white/50 hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
              }`}
            >
              عرض قائمة
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                setViewMode("cards");
              }}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                viewMode === "cards"
                  ? "border-[#D8B87A]/35 text-[#D8B87A]"
                  : "border-white/10 text-white/50 hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
              }`}
            >
              عرض كروت
            </button>
          </div>
        </div>

        <div className="mb-7">
          <ProjectsHubFilters
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            stats={stats}
          />
        </div>

        <div ref={projectsStartRef} className="scroll-mt-32" />

        {viewMode === "list" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {paginatedProjects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {paginatedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A] disabled:cursor-not-allowed disabled:opacity-35"
            >
              السابق
            </button>

            {Array.from({ length: totalPages }, (_, index) => {
              const page = index + 1;

              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => goToPage(page)}
                  className={`h-10 min-w-10 rounded-xl border px-3 text-sm transition ${
                    currentPage === page
                      ? "border-[#D8B87A] bg-[#D8B87A] text-[#111]"
                      : "border-white/10 text-white/55 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A] disabled:cursor-not-allowed disabled:opacity-35"
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ProjectRow({ project }: { project: PublicProject }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition duration-300 hover:border-[#D8B87A]/35 hover:bg-white/[0.04]">
      <div className="grid min-h-[250px] grid-cols-[250px_1fr]">
        <div className="relative min-h-[150px] overflow-hidden">
          <img
            src={project.image}
            alt={project.code}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#05070B]/20 to-[#05070B]/78" />
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#05070B] to-transparent" />
        </div>

        <div className="flex flex-col justify-between p-5">
          <div>
            <div>
  <p className="font-en text-3xl font-semibold leading-none text-[#D8B87A]">
    {project.code}
  </p>

  <span className="mt-3 inline-flex rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111]">
    {project.locationLabel}
  </span>
</div>

            <PlainTextContent
              value={project.shortDescription}
              as="p"
              className="mt-4 line-clamp-2 text-sm leading-7 text-white/52"
            />
          </div>

          <Link
            href={getProjectHref(project)}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-[#D8B87A]/35 px-5 py-3 text-sm text-[#D8B87A] transition duration-300 hover:bg-[#D8B87A] hover:text-[#111]"
          >
            استكشف التفاصيل
          </Link>
        </div>
      </div>
    </article>
  );
}

function ProjectCard({ project }: { project: PublicProject }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition duration-300 hover:border-[#D8B87A]/35 hover:bg-white/[0.04]">
      <div className="relative h-60 overflow-hidden">
        <img
          src={project.image}
          alt={project.code}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/25 to-transparent" />

      
      </div>

      <div className="px-5 pb-5 pt-0">
        <p className="font-en text-3xl font-semibold text-[#D8B87A]">
  {project.code}
</p>

<span className="mt-1 inline-flex rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111]">
  {project.locationLabel}
</span>
        <PlainTextContent
          value={project.shortDescription}
          as="p"
          className="mt-2 line-clamp-2 text-sm leading-7 text-white/58"
        />

        <Link
          href={getProjectHref(project)}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-[#D8B87A]/35 px-5 py-3 text-sm text-[#D8B87A] transition duration-300 hover:bg-[#D8B87A] hover:text-[#111]"
        >
          استكشف التفاصيل
        </Link>
      </div>
    </article>
  );
}