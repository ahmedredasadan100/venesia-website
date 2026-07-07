"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PublicProject } from "../../lib/projects/public-types";
import PlainTextContent from "../content/PlainTextContent";
import { useSwipeSlider } from "../../hooks/use-swipe-slider";

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
  const canSwipe = heroSlides.length > 1;

  const goToNext = useCallback(() => {
    if (!canSwipe) return;
    setActiveSlide((prev) => (prev + 1) % heroSlides.length);
  }, [canSwipe, heroSlides.length]);

  const goToPrev = useCallback(() => {
    if (!canSwipe) return;
    setActiveSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, [canSwipe, heroSlides.length]);

  const startAutoplay = useCallback(() => {
    if (!canSwipe) return undefined;

    return window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
  }, [canSwipe, heroSlides.length]);

  useEffect(() => {
    const timer = startAutoplay();
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [startAutoplay]);

  const handleGoTo = useCallback(
    (index: number) => {
      setActiveSlide(index);
    },
    [],
  );

  const { containerRef, swipeHandlers } = useSwipeSlider<HTMLElement>({
    enabled: canSwipe,
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrev,
  });

  if (!activeProject) return null;

  return (
    <section
      ref={containerRef}
      className="relative isolate min-h-[520px] touch-pan-y overflow-hidden border-b border-[#D8B87A]/15 bg-[#05070B] md:min-h-[620px]"
      {...swipeHandlers}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {heroSlides.map((project, index) => (
          <img
            key={project.code}
            src={project.heroImage || project.image}
            alt=""
            fetchPriority={index === 0 ? "high" : undefined}
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
              index === boundedSlide ? "opacity-55" : "opacity-0"
            }`}
          />
        ))}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.96)_0%,rgba(5,7,11,0.80)_35%,rgba(5,7,11,0.40)_62%,rgba(5,7,11,0.86)_100%)]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_70%_24%,rgba(216,184,122,0.18),transparent_62%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-[520px] max-w-7xl items-end px-4 pb-14 pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] sm:px-6 sm:pb-16 md:min-h-[620px] md:pt-32">
        <div className="grid w-full items-end gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="mb-5 text-center font-en text-[11px] uppercase tracking-[0.28em] text-[#D8B87A]/70 lg:text-right">
              {activeProject.locationLabel}
            </p>

            <div className="text-center lg:text-right">
              <h1 className="font-en text-5xl font-semibold leading-none text-[#D8B87A] sm:text-6xl md:text-8xl">
                {activeProject.code}
              </h1>

              <h2 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl md:text-4xl">
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
                  loading="lazy"
                  decoding="async"
                  className="h-[280px] w-full object-cover"
                />

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070B]/90 via-transparent to-transparent" />

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

      {canSwipe ? (
        <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center gap-1.5">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`الشريحة ${index + 1}`}
              onClick={() => handleGoTo(index)}
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
