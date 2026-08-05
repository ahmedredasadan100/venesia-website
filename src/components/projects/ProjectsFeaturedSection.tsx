"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getProjectHref } from "../../lib/projects/public-helpers";
import type { PublicProject } from "../../lib/projects/public-types";
import PlainTextContent from "../content/PlainTextContent";
import { useSwipeSlider } from "../../hooks/use-swipe-slider";
import {
  ProjectCodeBadge,
  ProjectImageBottomBadges,
} from "./ProjectCardMobileOverlays";

export type ProjectsFeaturedCardDisplay = {
  showProjectImage?: boolean;
  showProjectCode?: boolean;
  showProjectName?: boolean;
  showProjectDescription?: boolean;
  showProjectType?: boolean;
  showProjectLocation?: boolean;
  showExploreButton?: boolean;
};

type ProjectsFeaturedSectionProps = {
  projects: PublicProject[];
  title?: string;
  subtitle?: string;
  autoplayMs?: number;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showSliderDots?: boolean;
} & ProjectsFeaturedCardDisplay;

const DEFAULT_TITLE = "مشروع مميز";
const DEFAULT_SUBTITLE = "اختيار يعكس مسار التنفيذ على الأرض";
const DEFAULT_AUTOPLAY_MS = 6000;

export default function ProjectsFeaturedSection({
  projects,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  autoplayMs = DEFAULT_AUTOPLAY_MS,
  showTitle = true,
  showSubtitle = true,
  showSliderDots = true,
  showProjectImage = true,
  showProjectCode = true,
  showProjectName = true,
  showProjectDescription = true,
  showProjectType = true,
  showProjectLocation = true,
  showExploreButton = true,
}: ProjectsFeaturedSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const canSwipe = projects.length > 1;
  const resolvedAutoplayMs = autoplayMs > 0 ? autoplayMs : DEFAULT_AUTOPLAY_MS;

  const cardDisplay: Required<ProjectsFeaturedCardDisplay> = {
    showProjectImage,
    showProjectCode,
    showProjectName,
    showProjectDescription,
    showProjectType,
    showProjectLocation,
    showExploreButton,
  };

  const startAutoplay = useCallback(() => {
    if (!canSwipe) return undefined;

    return window.setInterval(() => {
      setActiveIndex((prev) => (prev === projects.length - 1 ? 0 : prev + 1));
    }, resolvedAutoplayMs);
  }, [canSwipe, projects.length, resolvedAutoplayMs]);

  useEffect(() => {
    const timer = startAutoplay();
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [startAutoplay]);

  const goToNext = useCallback(() => {
    if (!canSwipe) return;
    setActiveIndex((prev) => (prev === projects.length - 1 ? 0 : prev + 1));
  }, [canSwipe, projects.length]);

  const goToPrev = useCallback(() => {
    if (!canSwipe) return;
    setActiveIndex((prev) => (prev === 0 ? projects.length - 1 : prev - 1));
  }, [canSwipe, projects.length]);

  const { containerRef, swipeHandlers } = useSwipeSlider<HTMLElement>({
    enabled: canSwipe,
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrev,
  });

  if (projects.length === 0) return null;

  const mainProject = projects[activeIndex];

  const visibleSideProjects = [1, 2]
    .map((offset) => projects[(activeIndex + offset) % projects.length])
    .filter(Boolean);

  const showHeader = showTitle || showSubtitle;

  return (
    <section
      ref={containerRef}
      className="touch-pan-y overflow-x-hidden px-4 pt-10 sm:px-6 sm:pt-12"
      {...swipeHandlers}
    >
      <div className="mx-auto max-w-7xl">
        {showHeader ? (
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {showTitle ? <h2 className="text-xl font-semibold text-[#D8B87A]">{title}</h2> : null}

            {showSubtitle ? <span className="text-xs leading-6 text-white/40">{subtitle}</span> : null}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.75fr_0.62fr_0.62fr] lg:gap-4">
          <MainFeaturedCard project={mainProject} display={cardDisplay} />

          {visibleSideProjects.map((project) => (
            <SideFeaturedCard key={project.id} project={project} display={cardDisplay} />
          ))}
        </div>

        {showSliderDots ? (
          <div className="mt-6 flex justify-center gap-2">
            {projects.map((project, index) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`عرض ${project.englishName}`}
                className={`h-1.5 cursor-pointer rounded-full transition-all ${
                  index === activeIndex
                    ? "w-8 bg-[#D8B87A]"
                    : "w-1.5 bg-[#D8B87A]/25 hover:bg-[#D8B87A]/55"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getCategoryLabel(category: PublicProject["category"]) {
  return category === "residential" ? "سكني" : "تجاري";
}

function MainFeaturedCard({
  project,
  display,
}: {
  project: PublicProject;
  display: Required<ProjectsFeaturedCardDisplay>;
}) {
  return (
    <article
      key={project.id}
      className="group animate-[featuredFade_600ms_ease-out] overflow-hidden rounded-[24px] border border-[#D8B87A]/40 bg-[#080B10]/92 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
    >
      <div className="flex flex-col lg:grid lg:min-h-[320px] lg:grid-cols-[1.08fr_0.92fr]">
        {display.showProjectImage ? (
          <div className="relative w-full shrink-0 pb-3.5 lg:min-h-[320px] lg:pb-0">
            <div className="relative h-56 w-full overflow-hidden sm:h-64 lg:absolute lg:inset-0 lg:h-auto">
              <Image
                src={project.cardImage.src}
                alt={project.cardImage.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-cover transition duration-700 group-hover:scale-105 lg:absolute lg:inset-0"
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070B]/80 via-[#05070B]/10 to-transparent lg:hidden" />
              {display.showProjectCode ? <ProjectCodeBadge code={project.code} hideFrom="lg" /> : null}

              <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_left,rgba(5,7,11,0.80)_0%,rgba(5,7,11,0.38)_42%,rgba(5,7,11,0.04)_100%)] lg:block" />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 hidden w-32 bg-gradient-to-r from-[#080B10] via-[#080B10]/72 to-transparent lg:block"
              />
            </div>

            {display.showProjectLocation || display.showProjectType ? (
              <ProjectImageBottomBadges
                project={project}
                hideFrom="lg"
                showLocation={display.showProjectLocation}
                showType={display.showProjectType}
              />
            ) : null}
          </div>
        ) : null}

        <div className="relative z-10 flex min-w-0 flex-col justify-center p-5 pt-4 sm:p-6 sm:pt-5 lg:pt-6">
          {display.showProjectCode ? (
            <p className="hidden font-en text-2xl font-semibold leading-none text-[#D8B87A] lg:block lg:text-3xl">
              {project.englishName}
            </p>
          ) : null}

          {display.showProjectLocation ? (
            <span className="mt-3 hidden w-fit rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111] lg:inline-flex">
              {project.location.label}
            </span>
          ) : null}

          {display.showProjectType ? (
            <span className="mt-2 hidden w-fit rounded-lg border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-3 py-1 text-xs font-medium text-[#D8B87A] lg:inline-flex">
              {getCategoryLabel(project.category)}
            </span>
          ) : null}

          {display.showProjectDescription ? (
            <PlainTextContent
              value={project.shortDescription}
              as="p"
              className="mt-0 line-clamp-3 text-sm leading-7 text-white/62 lg:mt-4 lg:line-clamp-none lg:max-w-xl lg:text-white/60"
            />
          ) : null}

          {display.showExploreButton ? (
            <Link
              href={getProjectHref(project)}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#D8B87A]/45 px-6 py-3 text-sm text-[#D8B87A] transition duration-300 hover:bg-[#D8B87A] hover:text-[#111] lg:mt-7"
            >
              استكشف التفاصيل
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SideFeaturedCard({
  project,
  display,
}: {
  project: PublicProject;
  display: Required<ProjectsFeaturedCardDisplay>;
}) {
  return (
    <Link
      key={project.id}
      href={getProjectHref(project)}
      className="group animate-[featuredFade_520ms_ease-out] overflow-hidden rounded-[22px] border border-[#D8B87A]/20 bg-white/[0.035] transition duration-300 hover:border-[#D8B87A]/55"
    >
      {display.showProjectImage ? (
        <div className="relative h-[175px] overflow-hidden">
          <Image
            src={project.cardImage.src}
            alt={project.cardImage.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 20vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/36 to-transparent" />

          {display.showProjectCode ? (
            <p className="absolute bottom-4 right-4 font-en text-3xl font-semibold leading-none text-[#D8B87A]">
              {project.englishName}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="p-4 text-center">
        {display.showProjectName ? (
          <span className="inline-flex rounded-lg border border-[#D8B87A]/30 bg-[#D8B87A]/10 px-3 py-1.5 text-sm font-semibold text-[#D8B87A]">
            {project.arabicName}
          </span>
        ) : null}

        {display.showProjectDescription ? (
          <PlainTextContent
            value={project.shortDescription}
            as="p"
            className="mt-3 line-clamp-2 text-xs leading-6 text-white/52"
          />
        ) : null}
      </div>
    </Link>
  );
}
