"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicProject } from "../../lib/projects/public-types";
import PlainTextContent from "../content/PlainTextContent";

type ProjectsHubHeroProps = {
  projects: PublicProject[];
  featuredProject?: PublicProject;
};

export default function ProjectsHubHero({
  projects,
  featuredProject,
}: ProjectsHubHeroProps) {
  const heroSlides = useMemo(() => {
    const sourceProjects = projects.length
      ? projects
      : featuredProject
        ? [featuredProject]
        : [];

    const uniqueProjects = new Map<string, PublicProject>();

    sourceProjects
      .filter((project) => project.category === "residential")
      .filter((project) => project.heroImage || project.image)
      .forEach((project) => {
        uniqueProjects.set(project.code, project);
      });

    return Array.from(uniqueProjects.values());
  }, [projects, featuredProject]);

  const [activeSlide, setActiveSlide] = useState(0);
  const boundedSlide = heroSlides.length ? activeSlide % heroSlides.length : 0;
  const activeProject = heroSlides[boundedSlide];

  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  if (!activeProject) return null;

  return (
    <section className="relative isolate min-h-[620px] overflow-hidden border-b border-[#D8B87A]/15 bg-[#05070B]">
      <img
        src={activeProject.heroImage || activeProject.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-55 transition-opacity duration-[1200ms]"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.96)_0%,rgba(5,7,11,0.80)_35%,rgba(5,7,11,0.40)_62%,rgba(5,7,11,0.86)_100%)]"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_70%_24%,rgba(216,184,122,0.18),transparent_62%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-[620px] max-w-7xl items-end px-6 pb-16 pt-32">
        <div className="grid w-full items-end gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="mb-5 text-center font-en text-[11px] uppercase tracking-[0.28em] text-[#D8B87A]/70 lg:text-right">
              {activeProject.locationLabel}
            </p>

            <div className="text-center lg:text-right">
              <h1 className="font-en text-6xl font-semibold leading-none text-[#D8B87A] md:text-8xl">
                {activeProject.code}
              </h1>

              <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-4xl">
                {activeProject.arabicName}
              </h2>
            </div>

            <PlainTextContent
              value={activeProject.shortDescription}
              as="p"
              className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-7 text-white/62 lg:mx-0 lg:text-right"
            />
          </div>

          <div className="hidden justify-end lg:flex">
            <div className="w-[420px] rounded-[28px] border border-[#D8B87A]/20 bg-black/24 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="relative overflow-hidden rounded-[22px]">
                <img
                  src={activeProject.image}
                  alt={activeProject.code}
                  className="h-[280px] w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/90 via-transparent to-transparent" />

                <div className="absolute bottom-5 right-5">
                  <p className="font-en text-4xl font-semibold text-[#D8B87A]">
                    {activeProject.code}
                  </p>

                  <p className="mt-1 text-sm text-white/75">
                    {activeProject.arabicName}
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-[#D8B87A]/15 pt-5">
                <PlainTextContent
                  value={activeProject.shortDescription}
                  as="p"
                  className="text-sm leading-7 text-white/58"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {heroSlides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center gap-1.5">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`الشريحة ${index + 1}`}
              onClick={() => setActiveSlide(index)}
              className="group inline-flex h-10 min-w-10 items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-500 ${
                  index === boundedSlide ? "w-8 bg-[#D8B87A]" : "w-3 bg-white/25 group-hover:bg-white/45"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
