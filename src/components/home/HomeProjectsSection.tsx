"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HomepageProjectCard } from "../../lib/projects/types";
import PlainTextContent from "../content/PlainTextContent";

export type HomeProjectsSectionProps = {
  projects: HomepageProjectCard[];
};

function getProjectHref(project: HomepageProjectCard) {
  return `/projects/${project.slug}`;
}

function chunkProjects(projects: HomepageProjectCard[], size: number) {
  const chunks: HomepageProjectCard[][] = [];

  for (let i = 0; i < projects.length; i += size) {
    chunks.push(projects.slice(i, i + size));
  }

  return chunks;
}

export default function HomeProjectsSection({ projects }: HomeProjectsSectionProps) {
  const [activePage, setActivePage] = useState(0);

  const projectPages = useMemo(() => chunkProjects(projects, 3), [projects]);
  const hasMultiplePages = projectPages.length > 1;

  function goToNextPage() {
    setActivePage((current) =>
      current === projectPages.length - 1 ? 0 : current + 1
    );
  }

  function goToPrevPage() {
    setActivePage((current) =>
      current === 0 ? projectPages.length - 1 : current - 1
    );
  }

  if (projects.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-[#05070B] px-6 py-20 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute cursor-pointer inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(216,184,122,0.10),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(255,255,255,0.055),transparent_30%)]"
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-8 lg:flex-row-reverse lg:items-end lg:justify-between">
          <div className="max-w-md">
            <p className="text-lg leading-9 text-white/65">
              كل مشروع مش مجرد اسم... ده نقطة بناء جديدة في خريطة الشركة،
              ومتابعة حقيقية للتنفيذ على الأرض.
            </p>
          </div>

          <div className="flex flex-col gap-5 lg:items-end">
            <div className="text-right">
              <p className="mb-3 text-sm font-medium tracking-[0.26em] text-[#D8B87A]">
                مشاريع قيد المتابعة
              </p>

              <h2 className="text-3xl font-bold leading-tight tracking-[-0.04em] md:text-5xl">
                مشاريع فينيسيا
              </h2>
            </div>
          </div>
        </div>

        <div className="relative">
          {hasMultiplePages && (
            <>
              <button
                type="button"
                onClick={goToPrevPage}
                className="absolute left-[-28px] top-1/2 z-40 hidden h-14 w-14 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#D8B87A]/25 bg-[#070A0F]/90 text-2xl text-white/80 shadow-[0_0_32px_rgba(216,184,122,0.12)] backdrop-blur-md transition-all duration-300 hover:border-[#D8B87A]/55 hover:bg-[#0B0E14]/95 hover:text-[#D8B87A] hover:shadow-[0_0_38px_rgba(216,184,122,0.20)] lg:flex"
                aria-label="المشاريع السابقة"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={goToNextPage}
className="absolute right-[-28px] top-1/2 z-40 hidden h-14 w-14 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#D8B87A]/25 bg-[#070A0F]/90 text-2xl text-white/80 shadow-[0_0_32px_rgba(216,184,122,0.12)] backdrop-blur-md transition-all duration-300 hover:border-[#D8B87A]/55 hover:bg-[#0B0E14]/95 hover:text-[#D8B87A] hover:shadow-[0_0_38px_rgba(216,184,122,0.20)] lg:flex"
                aria-label="المشاريع التالية"
              >
                ›
              </button>
            </>
          )}

          <div className="overflow-x-hidden overflow-y-visible py-3">
            <div
              className="flex transition-transform duration-[850ms] ease-out"
              style={{ transform: `translateX(${activePage * 100}%)` }}
            >
              {projectPages.map((page, pageIndex) => (
                <div
                  key={pageIndex}
                  className="grid min-w-full grid-cols-1 gap-5 md:grid-cols-3"
                >
                  {page.map((project) => (
<Link
  key={project.id}
  href={getProjectHref(project)}
  className="group relative block cursor-pointer overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] text-white shadow-2xl backdrop-blur transition-all duration-500 hover:-translate-y-2 hover:border-[#D8B87A]/20 hover:bg-white/[0.07] hover:shadow-[0_20px_56px_rgba(0,0,0,0.42),0_0_0_1px_rgba(216,184,122,0.06)]"
>
  {/* Venesia Gold Edge Traces */}
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-[2rem]"
  >
    <span className="absolute inset-x-8 top-0 h-[2px] origin-right scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all duration-700 ease-out group-hover:scale-x-100 group-hover:opacity-100" />

    <span className="absolute inset-x-8 bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-150 duration-700 ease-out group-hover:scale-x-100 group-hover:opacity-100" />

    <span className="absolute inset-y-8 right-0 w-[2px] origin-top scale-y-0 bg-gradient-to-b from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-75 duration-700 ease-out group-hover:scale-y-100 group-hover:opacity-100" />

    <span className="absolute inset-y-8 left-0 w-[2px] origin-bottom scale-y-0 bg-gradient-to-t from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-200 duration-700 ease-out group-hover:scale-y-100 group-hover:opacity-100" />
  </div>

  <div className="relative h-[360px] overflow-hidden">
      <img
        src={project.image}
        alt={`${project.code} - ${project.englishName}`}
        className="h-full w-full transform-gpu object-cover opacity-80 transition-transform duration-[1400ms] ease-out will-change-transform group-hover:scale-[1.035]"
        style={{
          filter: "brightness(0.92) contrast(1.08) saturate(0.94)",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/74 to-[#05070B]/18" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 -translate-x-[130%] bg-[linear-gradient(115deg,transparent_0%,rgba(216,184,122,0.00)_36%,rgba(216,184,122,0.22)_48%,rgba(255,255,255,0.16)_52%,rgba(216,184,122,0.06)_58%,transparent_72%)] opacity-0 transition-all duration-[1200ms] ease-out group-hover:translate-x-[130%] group-hover:opacity-100"
      />

      <div className="absolute inset-x-0 bottom-0 z-30 p-6">
        <p className="mb-2 text-xl font-semibold tracking-[0.16em] text-[#D8B87A]">
          {project.code}
        </p>

        <span className="mt-1 inline-flex rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111]">
          {project.locationLabel}
        </span>

        <PlainTextContent
          value={project.shortDescription}
          as="p"
          className="mt-4 line-clamp-2 text-sm leading-7 text-white/72"
        />

        <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#D8B87A]">
          استكشف المشروع
          <span className="transition-transform duration-300 group-hover:-translate-x-1">
            ←
          </span>
        </div>
      </div>
    </div>
  </Link>
))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {hasMultiplePages && (
          <div className="mt-8 flex justify-center gap-2">
            {projectPages.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActivePage(index)}
                aria-label={`انتقال إلى مجموعة المشاريع ${index + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activePage === index
                    ? "w-8 bg-[#D8B87A]"
                    : "w-2 bg-white/25 hover:bg-white/45"
                }`}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            href="/projects"
            className="rounded-full border border-white/10 bg-white/[0.045] px-7 py-3 text-sm font-medium text-white/80 transition duration-300 hover:border-[#D8B87A]/40 hover:bg-white/[0.08] hover:text-[#D8B87A]"
          >
            استعرض كل المشاريع
          </Link>
        </div>
      </div>
    </section>
  );
}