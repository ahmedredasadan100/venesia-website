"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  getProjectHref,
  PROJECT_CATEGORY_LABELS,
} from "../../lib/projects/public-helpers";
import type { ProjectHubFilterId, PublicProject } from "../../lib/projects/public-types";
import ProjectsHubFilters from "./ProjectsHubFilters";
import PlainTextContent from "../content/PlainTextContent";
import {
  ProjectCodeBadge,
  ProjectImageBottomBadges,
} from "./ProjectCardMobileOverlays";
import PublicMediaImage from "../public/PublicMediaImage";

type ViewMode = "list" | "cards";

export type ProjectsListCardDisplay = {
  showProjectImage?: boolean;
  showProjectCode?: boolean;
  showProjectName?: boolean;
  showProjectDescription?: boolean;
  showProjectType?: boolean;
  showProjectLocation?: boolean;
  showExploreButton?: boolean;
};

type ProjectsListSectionProps = {
  projects: PublicProject[];
  /** Full route-loaded projects — used only to derive filter chips (not re-queried). */
  allProjects: PublicProject[];
  activeFilter: ProjectHubFilterId;
  onFilterChange: (filter: ProjectHubFilterId) => void;
  eyebrow?: string;
  title?: string;
  showEyebrow?: boolean;
  showTitle?: boolean;
  showFilterBar?: boolean;
  pageSize?: number;
  defaultView?: ViewMode;
  showViewToggle?: boolean;
  showPagination?: boolean;
  showProjectCount?: boolean;
  visibleFilters?: ProjectHubFilterId[];
} & ProjectsListCardDisplay;

const DEFAULT_PAGE_SIZE = 6;

function getCategoryLabel(category: PublicProject["category"]) {
  return PROJECT_CATEGORY_LABELS[category];
}

function ProjectListingEnglishName({ project }: { project: PublicProject }) {
  return (
    <span
      title={project.englishName}
      className="hidden min-w-0 truncate font-en text-lg font-bold leading-tight text-[#D8B87A] md:block md:text-xl"
    >
      {project.englishName}
    </span>
  );
}

function ListViewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" strokeWidth="2.8" />
    </svg>
  );
}

function CardsViewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export default function ProjectsListSection({
  projects,
  allProjects,
  activeFilter,
  onFilterChange,
  eyebrow = "Projects Index",
  title = "جميع المشروعات",
  showEyebrow = true,
  showTitle = true,
  showFilterBar = true,
  pageSize = DEFAULT_PAGE_SIZE,
  defaultView = "list",
  showViewToggle = true,
  showPagination = true,
  showProjectCount = true,
  visibleFilters,
  showProjectImage = true,
  showProjectCode = true,
  showProjectName = true,
  showProjectDescription = true,
  showProjectType = true,
  showProjectLocation = true,
  showExploreButton = true,
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

  const cardDisplay: Required<ProjectsListCardDisplay> = {
    showProjectImage,
    showProjectCode,
    showProjectName,
    showProjectDescription,
    showProjectType,
    showProjectLocation,
    showExploreButton,
  };

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

  const showHeader = showEyebrow || showTitle || showProjectCount || showViewToggle;

  return (
    <section className="overflow-x-hidden px-4 pt-14 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {showHeader ? (
          <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0">
              {showEyebrow ? (
                <p className="mb-2 font-en text-[11px] uppercase tracking-[0.24em] text-[#D8B87A]/55">
                  {eyebrow}
                </p>
              ) : null}

              {showTitle || showProjectCount ? (
                <h2 className="text-xl font-semibold text-[#D8B87A] sm:text-2xl">
                  {showTitle ? title : null}
                  {showProjectCount ? (
                    <span className={`text-sm font-normal text-white/45 ${showTitle ? "mr-2" : ""}`}>
                      ({projects.length} مشروع)
                    </span>
                  ) : null}
                </h2>
              ) : null}
            </div>

            {showViewToggle ? (
              <div role="group" aria-label="طريقة عرض المشروعات" className="inline-flex w-fit gap-2">
                <button
                  type="button"
                  aria-label="عرض قائمة"
                  title="عرض قائمة"
                  aria-pressed={viewMode === "list"}
                  onClick={() => {
                    setCurrentPage(1);
                    setViewMode("list");
                  }}
                  className={`inline-flex size-11 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070B] ${
                    viewMode === "list"
                      ? "border-[#D8B87A]/50 bg-[#D8B87A]/10 text-[#D8B87A]"
                      : "border-white/10 text-white/50 hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
                  }`}
                >
                  <ListViewIcon />
                </button>

                <button
                  type="button"
                  aria-label="عرض كروت"
                  title="عرض كروت"
                  aria-pressed={viewMode === "cards"}
                  onClick={() => {
                    setCurrentPage(1);
                    setViewMode("cards");
                  }}
                  className={`inline-flex size-11 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070B] ${
                    viewMode === "cards"
                      ? "border-[#D8B87A]/50 bg-[#D8B87A]/10 text-[#D8B87A]"
                      : "border-white/10 text-white/50 hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
                  }`}
                >
                  <CardsViewIcon />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showFilterBar ? (
          <div className="mb-7">
            <ProjectsHubFilters
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              allProjects={allProjects}
              visibleFilters={visibleFilters}
            />
          </div>
        ) : null}

        <div ref={projectsStartRef} className="scroll-mt-32" />

        {viewMode === "list" ? (
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-5">
            {paginatedProjects.map((project) => (
              <ProjectRow key={project.id} project={project} display={cardDisplay} />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {paginatedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} display={cardDisplay} />
            ))}
          </div>
        )}

        {showPagination && totalPages > 1 ? (
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
        ) : null}
      </div>
    </section>
  );
}

function ProjectRow({
  project,
  display,
}: {
  project: PublicProject;
  display: Required<ProjectsListCardDisplay>;
}) {
  const locationLabel = display.showProjectLocation
    ? project.location.label
    : null;

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition duration-300 hover:border-[#D8B87A]/35 hover:bg-white/[0.04]">
      <div className="flex flex-col md:grid md:min-h-[250px] md:grid-cols-[250px_1fr]">
        {display.showProjectImage ? (
          <div className="relative w-full shrink-0 pb-3.5 md:min-h-[150px] md:pb-0">
            <div className="relative h-52 w-full overflow-hidden sm:h-56 md:absolute md:inset-0 md:h-auto">
              <PublicMediaImage
                src={project.cardImage.src}
                alt={project.cardImage.alt}
                fill
                sizes="(max-width: 768px) 100vw, 250px"
                className="object-cover transition duration-700 group-hover:scale-105 md:absolute md:inset-0"
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070B]/80 via-[#05070B]/10 to-transparent md:hidden" />
              {display.showProjectCode ? <ProjectCodeBadge code={project.code} /> : null}

              <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-l from-transparent via-[#05070B]/20 to-[#05070B]/78 md:block" />
              <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-[#05070B] to-transparent md:block" />
            </div>

            {(locationLabel || display.showProjectType) ? (
              <ProjectImageBottomBadges
                project={project}
                showLocation={Boolean(locationLabel)}
                showType={display.showProjectType}
              />
            ) : null}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col justify-between p-5 pt-4 sm:p-6 sm:pt-5 md:pt-6">
          <div className="min-w-0">
            {display.showProjectName ? (
              <ProjectListingEnglishName project={project} />
            ) : null}

            {locationLabel ? (
              <span className="mt-3 hidden rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111] md:inline-flex">
                {locationLabel}
              </span>
            ) : null}

            {display.showProjectType ? (
              <span className="mt-2 hidden rounded-lg border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-3 py-1 text-xs font-medium text-[#D8B87A] md:inline-flex">
                {getCategoryLabel(project.category)}
              </span>
            ) : null}

            {display.showProjectDescription ? (
              <PlainTextContent
                value={project.shortDescription}
                as="p"
                className="mt-0 line-clamp-3 text-sm leading-7 text-white/62 md:mt-4 md:line-clamp-2 md:text-white/52"
              />
            ) : null}
          </div>

          {display.showExploreButton ? (
            <Link
              href={getProjectHref(project)}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#D8B87A]/35 px-5 py-3 text-sm text-[#D8B87A] transition duration-300 hover:bg-[#D8B87A] hover:text-[#111]"
            >
              استكشف التفاصيل
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ProjectCard({
  project,
  display,
}: {
  project: PublicProject;
  display: Required<ProjectsListCardDisplay>;
}) {
  const locationLabel = display.showProjectLocation
    ? project.location.label
    : null;

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition duration-300 hover:border-[#D8B87A]/35 hover:bg-white/[0.04]">
      {display.showProjectImage ? (
        <div className="relative shrink-0 pb-3.5 md:pb-0">
          <div className="relative h-52 overflow-hidden sm:h-60">
            <PublicMediaImage
              src={project.cardImage.src}
              alt={project.cardImage.alt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover transition duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/25 to-transparent md:hidden" />
            {display.showProjectCode ? <ProjectCodeBadge code={project.code} /> : null}
          </div>

          {(locationLabel || display.showProjectType) ? (
            <ProjectImageBottomBadges
              project={project}
              showLocation={Boolean(locationLabel)}
              showType={display.showProjectType}
            />
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 md:pt-4">
        {display.showProjectName ? (
          <ProjectListingEnglishName project={project} />
        ) : null}

        {locationLabel ? (
          <span className="mt-2 hidden rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111] md:inline-flex">
            {locationLabel}
          </span>
        ) : null}

        {display.showProjectType ? (
          <span className="mt-2 hidden rounded-lg border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-3 py-1 text-xs font-medium text-[#D8B87A] md:inline-flex">
            {getCategoryLabel(project.category)}
          </span>
        ) : null}

        {display.showProjectDescription ? (
          <PlainTextContent
            value={project.shortDescription}
            as="p"
            className="mt-0 line-clamp-3 text-sm leading-7 text-white/62 md:mt-3 md:line-clamp-2 md:text-white/58"
          />
        ) : null}

        {display.showExploreButton ? (
          <Link
            href={getProjectHref(project)}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#D8B87A]/35 px-5 py-3 text-sm text-[#D8B87A] transition duration-300 hover:bg-[#D8B87A] hover:text-[#111]"
          >
            استكشف التفاصيل
          </Link>
        ) : null}
      </div>
    </article>
  );
}
