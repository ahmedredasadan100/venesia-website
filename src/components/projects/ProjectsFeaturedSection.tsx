"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getProjectHref } from "../../lib/projects/public-helpers";
import type { PublicProject } from "../../lib/projects/public-types";
import PublicMediaImage from "../public/PublicMediaImage";
import PlainTextContent from "../content/PlainTextContent";
import { useSwipeSlider } from "../../hooks/use-swipe-slider";
import {
  ProjectCodeBadge,
  ProjectImageBottomBadges,
} from "./ProjectCardMobileOverlays";
import { resolveVisibleProjectLocationLabel } from "../../lib/projects/project-location-presentation";

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

function getVisibleSideProjects<T>(projects: readonly T[], activeIndex: number): T[] {
  const sideProjectCount = Math.max(0, Math.min(2, projects.length - 1));

  return Array.from(
    { length: sideProjectCount },
    (_, sideIndex) => projects[(activeIndex + sideIndex + 1) % projects.length],
  );
}

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

  const visibleSideProjects = getVisibleSideProjects(projects, activeIndex);

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

function FeaturedProjectEnglishName({
  project,
  className = "",
}: {
  project: PublicProject;
  className?: string;
}) {
  return (
    <span
      title={project.englishName}
      className={`block min-w-0 truncate font-en font-bold leading-tight text-[#D8B87A] ${className}`.trim()}
    >
      {project.englishName}
    </span>
  );
}

function FeaturedProjectMetaRow({
  project,
  showLocation,
  showType,
  className = "",
}: {
  project: PublicProject;
  showLocation: boolean;
  showType: boolean;
  className?: string;
}) {
  const locationLabel = resolveVisibleProjectLocationLabel(
    project.location,
    showLocation,
  );

  if (!locationLabel && !showType) return null;

  return (
    <div className={`flex min-w-0 flex-nowrap items-center gap-2 ${className}`.trim()}>
      {locationLabel ? (
        <span
          title={locationLabel}
          className="min-w-0 truncate rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111]"
        >
          {locationLabel}
        </span>
      ) : null}
      {showType ? (
        <span className="shrink-0 rounded-lg border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-3 py-1 text-xs font-medium text-[#D8B87A]">
          {getCategoryLabel(project.category)}
        </span>
      ) : null}
    </div>
  );
}

function MainFeaturedCard({
  project,
  display,
}: {
  project: PublicProject;
  display: Required<ProjectsFeaturedCardDisplay>;
}) {
  const locationLabel = resolveVisibleProjectLocationLabel(
    project.location,
    display.showProjectLocation,
  );

  return (
    <article
      key={project.id}
      className="group animate-[featuredFade_600ms_ease-out] overflow-hidden rounded-[24px] border border-[#D8B87A]/40 bg-[#080B10]/92 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
    >
      <div className="flex flex-col lg:grid lg:min-h-[320px] lg:grid-cols-[1.08fr_0.92fr]">
        {display.showProjectImage ? (
          <div className="relative w-full shrink-0 pb-3.5 lg:min-h-[320px] lg:pb-0">
            <div className="relative h-56 w-full overflow-hidden sm:h-64 lg:absolute lg:inset-0 lg:h-auto">
              <PublicMediaImage
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

            {locationLabel || display.showProjectType ? (
              <ProjectImageBottomBadges
                project={project}
                hideFrom="lg"
                showLocation={Boolean(locationLabel)}
                showType={display.showProjectType}
              />
            ) : null}
          </div>
        ) : null}

        <div className="relative z-10 flex min-w-0 flex-col justify-center p-5 pt-4 sm:p-6 sm:pt-5 lg:pt-6">
          {display.showProjectCode ? (
            <FeaturedProjectEnglishName project={project} className="hidden text-lg lg:block lg:text-xl" />
          ) : null}

          <FeaturedProjectMetaRow
            project={project}
            showLocation={display.showProjectLocation}
            showType={display.showProjectType}
            className="mt-3 hidden lg:flex"
          />

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
          <PublicMediaImage
            src={project.cardImage.src}
            alt={project.cardImage.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 20vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/36 to-transparent" />

          {display.showProjectCode ? (
            <FeaturedProjectEnglishName
              project={project}
              className="absolute inset-x-4 bottom-4 text-right text-lg sm:text-xl"
            />
          ) : null}
        </div>
      ) : null}

      <div className="p-4 text-center">
        <FeaturedProjectMetaRow
          project={project}
          showLocation={display.showProjectLocation}
          showType={display.showProjectType}
          className="w-full justify-center"
        />

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
