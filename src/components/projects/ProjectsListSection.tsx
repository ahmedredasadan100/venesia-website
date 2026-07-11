"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  getProjectHref,
} from "../../lib/projects/public-helpers";
import type { ProjectHubFilterId, PublicProject } from "../../lib/projects/public-types";
import ProjectsHubFilters from "./ProjectsHubFilters";
import PlainTextContent from "../content/PlainTextContent";
import {
  ProjectCodeBadge,
  ProjectImageBottomBadges,
} from "./ProjectCardMobileOverlays";

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
  eyebrow?: string;
  title?: string;
  pageSize?: number;
  defaultView?: ViewMode;
  visibleFilters?: ProjectHubFilterId[];
};

const DEFAULT_PAGE_SIZE = 6;

function getCategoryLabel(category: PublicProject["category"]) {
  return category === "residential" ? "سكني" : "تجاري";
}

export default function ProjectsListSection({
  projects,
  activeFilter,
  onFilterChange,
  stats,
  eyebrow = "Projects Index",
  title = "جميع المشروعات",
  pageSize = DEFAULT_PAGE_SIZE,
  defaultView = "list",
  visibleFilters,
}: ProjectsListSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [currentPage, setCurrentPage] = useState(1);
  const projectsStartRef = useRef<HTMLDivElement | null>(null);
  const resolvedPageSize = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;

  const totalPages = Math.max(1, Math.ceil(projects.length / resolvedPageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProjects = useMemo(() => {
    const start = (safeCurrentPage - 1) * resolvedPageSize;
    return projects.slice(start, start + resolvedPageSize);
  }, [projects, safeCurrentPage, resolvedPageSize]);

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
    <section className="overflow-x-hidden px-4 pt-14 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 font-en text-[11px] uppercase tracking-[0.24em] text-[#D8B87A]/55">
              {eyebrow}
            </p>

            <h2 className="text-xl font-semibold text-[#D8B87A] sm:text-2xl">
              {title}
              <span className="mr-2 text-sm font-normal text-white/45">
                ({projects.length} مشروع)
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
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
            visibleFilters={visibleFilters}
          />
        </div>

        <div ref={projectsStartRef} className="scroll-mt-32" />

        {viewMode === "list" ? (
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-5">
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
      <div className="flex flex-col md:grid md:min-h-[250px] md:grid-cols-[250px_1fr]">
        <div className="relative w-full shrink-0 pb-3.5 md:min-h-[150px] md:pb-0">
          <div className="relative h-52 w-full overflow-hidden sm:h-56 md:absolute md:inset-0 md:h-auto">
            <Image
              src={project.image}
              alt={project.code}
              fill
              sizes="(max-width: 768px) 100vw, 250px"
              className="object-cover transition duration-700 group-hover:scale-105 md:absolute md:inset-0"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070B]/80 via-[#05070B]/10 to-transparent md:hidden" />
            <ProjectCodeBadge code={project.code} />

            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-l from-transparent via-[#05070B]/20 to-[#05070B]/78 md:block" />
            <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-[#05070B] to-transparent md:block" />
          </div>

          <ProjectImageBottomBadges project={project} />
        </div>

        <div className="flex min-w-0 flex-col justify-between p-5 pt-4 sm:p-6 sm:pt-5 md:pt-6">
          <div className="min-w-0">
            <p className="hidden font-en text-2xl font-semibold leading-none text-[#D8B87A] md:block md:text-3xl">
              {project.code}
            </p>

            <span className="mt-3 hidden rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111] md:inline-flex">
              {project.locationLabel}
            </span>

            <span className="mt-2 hidden rounded-lg border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-3 py-1 text-xs font-medium text-[#D8B87A] md:inline-flex">
              {getCategoryLabel(project.category)}
            </span>

            <PlainTextContent
              value={project.shortDescription}
              as="p"
              className="mt-0 line-clamp-3 text-sm leading-7 text-white/62 md:mt-4 md:line-clamp-2 md:text-white/52"
            />
          </div>

          <Link
            href={getProjectHref(project)}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#D8B87A]/35 px-5 py-3 text-sm text-[#D8B87A] transition duration-300 hover:bg-[#D8B87A] hover:text-[#111]"
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
      <div className="relative shrink-0 pb-3.5 md:pb-0">
        <div className="relative h-52 overflow-hidden sm:h-60">
          <Image
            src={project.image}
            alt={project.code}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/25 to-transparent md:hidden" />
          <ProjectCodeBadge code={project.code} />
        </div>

        <ProjectImageBottomBadges project={project} />
      </div>

      <div className="min-w-0 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 md:pt-4">
        <p className="hidden font-en text-2xl font-semibold text-[#D8B87A] md:block md:text-3xl">
          {project.code}
        </p>

        <span className="mt-2 hidden rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111] md:inline-flex">
          {project.locationLabel}
        </span>

        <span className="mt-2 hidden rounded-lg border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-3 py-1 text-xs font-medium text-[#D8B87A] md:inline-flex">
          {getCategoryLabel(project.category)}
        </span>

        <PlainTextContent
          value={project.shortDescription}
          as="p"
          className="mt-0 line-clamp-3 text-sm leading-7 text-white/62 md:mt-3 md:line-clamp-2 md:text-white/58"
        />

        <Link
          href={getProjectHref(project)}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#D8B87A]/35 px-5 py-3 text-sm text-[#D8B87A] transition duration-300 hover:bg-[#D8B87A] hover:text-[#111]"
        >
          استكشف التفاصيل
        </Link>
      </div>
    </article>
  );
}