"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { HomepageProjectCard } from "../../lib/projects/public-types";
import type { HomeProjectsButtonAlignment, HomeProjectsContent } from "./home-projects-mappers";
import PlainTextContent from "../content/PlainTextContent";
import RichTextContent from "../content/RichTextContent";
import { useSwipeSlider } from "../../hooks/use-swipe-slider";
import { usePressFeedback } from "../../hooks/use-press-feedback";
import { isHtmlContent, stripHtml } from "../../lib/rich-text/html-utils";

export type HomeProjectsSectionProps = {
  projects: HomepageProjectCard[];
  content: HomeProjectsContent;
};

/** Shared gold→body rhythm for both header columns (matches intro strong margin). */
const HEADER_STACK_GAP_PX = 11;

const FOOTER_ALIGN_CLASS: Record<HomeProjectsButtonAlignment, string> = {
  // Section is RTL: flex-start = physical right, flex-end = physical left.
  right: "justify-start",
  center: "justify-center",
  left: "justify-end",
};

const CARD_CTA_ALIGN_CLASS: Record<HomeProjectsButtonAlignment, string> = {
  // Card overlay is RTL: flex-start = physical right, flex-end = physical left.
  right: "justify-start",
  center: "justify-center",
  left: "justify-end",
};

const EYEBROW_TEXT_ALIGN_CLASS: Record<HomeProjectsButtonAlignment, string> = {
  right: "text-right",
  center: "text-center",
  left: "text-left",
};

function hasIntroContent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!isHtmlContent(trimmed)) return true;
  return Boolean(stripHtml(trimmed));
}

function resolveHomeProjectsContent(content: HomeProjectsContent) {
  return {
    eyebrow: content.eyebrow.trim(),
    title: content.title.trim(),
    intro: content.intro.trim(),
    footerCta: {
      label: content.footerCta.label.trim(),
      href: content.footerCta.href.trim(),
      target: content.footerCta.target === "_blank" ? ("_blank" as const) : ("_self" as const),
      alignment: content.footerCta.alignment,
    },
    showEyebrow: content.showEyebrow,
    showTitle: content.showTitle,
    showIntro: content.showIntro,
    showProjectLocation: content.showProjectLocation,
    showFooterCta: content.showFooterCta,
    projectsLimit: content.projectsLimit,
    cardCtaAlignment: content.cardCtaAlignment,
    eyebrowBold: content.eyebrowBold,
    eyebrowAlignment: content.eyebrowAlignment,
  };
}

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

function resolveProjectsLimit(limit?: number | string | null) {
  if (limit == null || limit === "") return undefined;

  const parsed =
    typeof limit === "number"
      ? limit
      : typeof limit === "string"
        ? Number(limit.trim())
        : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.floor(parsed);
}

const CARDS_PER_PAGE = 3;

function useIntentPrefetch() {
  const [prefetchEnabled, setPrefetchEnabled] = useState(false);

  return {
    prefetch: prefetchEnabled ? null : false,
    onMouseEnter: () => setPrefetchEnabled(true),
    onFocus: () => setPrefetchEnabled(true),
    onTouchStart: () => setPrefetchEnabled(true),
  };
}

function buildProjectPages(projects: HomepageProjectCard[]) {
  return chunkProjects(projects, CARDS_PER_PAGE);
}

function getHeaderLayoutClass(hasIntroColumn: boolean, hasHeadingColumn: boolean) {
  // RTL row: first DOM child sits on the physical right. Mobile stacks heading → intro.
  if (hasIntroColumn && hasHeadingColumn) {
    return "mb-9 flex flex-col gap-6 @4xl/slot-module:mb-10 @4xl/slot-module:flex-row @4xl/slot-module:items-start @4xl/slot-module:justify-between @4xl/slot-module:gap-10";
  }
  if (hasHeadingColumn) {
    return "mb-9 flex flex-col gap-6 @4xl/slot-module:mb-10 @4xl/slot-module:items-start";
  }
  if (hasIntroColumn) {
    return "mb-9 flex flex-col gap-6 @4xl/slot-module:mb-10";
  }
  return "";
}

function getProjectPageLayoutClass(cardCount: number) {
  if (cardCount >= 3) {
    return "grid h-full shrink-0 grid-cols-1 gap-5 @3xl/slot-module:grid-cols-3";
  }

  return "flex h-full shrink-0 flex-col gap-5 @3xl/slot-module:flex-row @3xl/slot-module:flex-wrap @3xl/slot-module:justify-center";
}

function getProjectCardSlideClass(cardCount: number) {
  if (cardCount >= 3) {
    return "";
  }

  return "w-full @3xl/slot-module:w-[calc((100%-2.5rem)/3)] @3xl/slot-module:max-w-none @3xl/slot-module:shrink-0";
}

function HomeProjectCard({
  project,
  cardCtaAlignment,
  showProjectLocation,
  slideClass,
  revealDelay,
}: {
  project: HomepageProjectCard;
  cardCtaAlignment: HomeProjectsButtonAlignment;
  showProjectLocation: boolean;
  slideClass: string;
  revealDelay: number;
}) {
  const { pressProps } = usePressFeedback();
  const prefetchProps = useIntentPrefetch();
  const locationLabel = showProjectLocation ? project.location.label : null;

  return (
    <div
      data-reveal="fade-up"
      data-delay={String(revealDelay)}
      className={`home-project-card-reveal ${slideClass}`}
    >
      <Link
        href={getProjectHref(project)}
        {...prefetchProps}
        {...pressProps}
        className="home-project-card group relative block cursor-pointer overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] text-white shadow-2xl backdrop-blur transition-all duration-500 hover:-translate-y-2 hover:border-[#D8B87A]/20 hover:bg-white/[0.07] hover:shadow-[0_20px_56px_rgba(0,0,0,0.42),0_0_0_1px_rgba(216,184,122,0.06)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-[2rem]"
        >
          <span className="home-project-card__edge home-project-card__edge--top absolute inset-x-8 top-0 h-[2px] origin-right scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all duration-700 ease-out group-hover:scale-x-100 group-hover:opacity-100" />
          <span className="home-project-card__edge home-project-card__edge--bottom absolute inset-x-8 bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-150 duration-700 ease-out group-hover:scale-x-100 group-hover:opacity-100" />
          <span className="home-project-card__edge home-project-card__edge--right absolute inset-y-8 right-0 w-[2px] origin-top scale-y-0 bg-gradient-to-b from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-75 duration-700 ease-out group-hover:scale-y-100 group-hover:opacity-100" />
          <span className="home-project-card__edge home-project-card__edge--left absolute inset-y-8 left-0 w-[2px] origin-bottom scale-y-0 bg-gradient-to-t from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-200 duration-700 ease-out group-hover:scale-y-100 group-hover:opacity-100" />
        </div>

        <div className="relative h-[360px] overflow-hidden">
          <Image
            src={project.cardImage.src}
            alt={project.cardImage.alt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="home-project-card__image transform-gpu object-cover opacity-80 transition-transform duration-[1400ms] ease-out will-change-transform group-hover:scale-[1.035]"
            style={{
              filter: "brightness(0.92) contrast(1.08) saturate(0.94)",
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/74 to-[#05070B]/18" />

          <div
            aria-hidden
            className="home-project-card__shine pointer-events-none absolute inset-0 z-20 -translate-x-[130%] bg-[linear-gradient(115deg,transparent_0%,rgba(216,184,122,0.00)_36%,rgba(216,184,122,0.22)_48%,rgba(255,255,255,0.16)_52%,rgba(216,184,122,0.06)_58%,transparent_72%)] opacity-0 transition-all duration-[1200ms] ease-out group-hover:translate-x-[130%] group-hover:opacity-100"
          />

          <div className="absolute inset-x-0 bottom-0 z-30 p-6">
            <p className="mb-2 text-xl font-semibold tracking-[0.16em] text-[#D8B87A]">
              {project.englishName}
            </p>

            {locationLabel ? (
              <span className="mt-1 inline-flex rounded-lg bg-[#D8B87A] px-3 py-1 text-xs font-medium text-[#111]">
                {locationLabel}
              </span>
            ) : null}

            <PlainTextContent
              value={project.shortDescription}
              as="p"
              className="mt-4 line-clamp-2 text-sm leading-7 text-white/72"
            />

            <div className={`mt-6 flex ${CARD_CTA_ALIGN_CLASS[cardCtaAlignment]}`} dir="rtl">
              <div className="home-project-card__cta inline-flex items-center gap-2 text-sm font-medium text-[#D8B87A] transition-colors duration-300">
                استكشف المشروع
                <span className="home-project-card__arrow transition-transform duration-300 group-hover:-translate-x-1">
                  ←
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function HomeProjectsFooterCta({
  href,
  label,
  target,
}: {
  href: string;
  label: string;
  target: "_self" | "_blank";
}) {
  const { pressProps } = usePressFeedback();
  const prefetchProps = useIntentPrefetch();

  return (
    <Link
      href={href}
      target={target === "_blank" ? "_blank" : undefined}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      {...prefetchProps}
      {...pressProps}
      className="home-pressable home-pressable--projects-footer cursor-pointer rounded-full border border-white/10 bg-white/[0.045] px-7 py-3 text-sm font-medium text-white/80 transition duration-300 hover:border-[#D8B87A]/40 hover:bg-white/[0.08] hover:text-[#D8B87A]"
    >
      {label}
    </Link>
  );
}

export default function HomeProjectsSection({ projects, content }: HomeProjectsSectionProps) {
  const [activePage, setActivePage] = useState(0);
  const sectionCopy = resolveHomeProjectsContent(content);

  const projectsLimit = resolveProjectsLimit(sectionCopy.projectsLimit);

  const limitedProjects = !projectsLimit ? projects : projects.slice(0, projectsLimit);

  const projectPages = buildProjectPages(limitedProjects);
  const totalPages = projectPages.length;
  const hasMultiplePages = totalPages > 1;
  const safeActivePage = Math.min(activePage, Math.max(totalPages - 1, 0));

  const showIntro = sectionCopy.showIntro && hasIntroContent(sectionCopy.intro);
  const showEyebrow = sectionCopy.showEyebrow && Boolean(sectionCopy.eyebrow.trim());
  const showTitle = sectionCopy.showTitle && Boolean(sectionCopy.title.trim());

  const introColumn = showIntro ? (
    <div className="flex max-w-md flex-col text-right @4xl/slot-module:max-w-sm @5xl/slot-module:max-w-md">
      {/*
        Scoped Home Projects intro only via .home-projects-intro in globals.css:
        muted body + gold <strong> lead line. Does not change Home Story rich text.
      */}
      <RichTextContent value={sectionCopy.intro} mode="rich" className="home-projects-intro" />
    </div>
  ) : null;

  const headingColumn =
    showEyebrow || showTitle ? (
      <div
        className="flex max-w-xl flex-col text-right"
        style={{ gap: `${HEADER_STACK_GAP_PX}px` }}
      >
        {showEyebrow ? (
          <p
            className={`m-0 text-sm leading-snug tracking-[0.26em] text-[#D8B87A] ${EYEBROW_TEXT_ALIGN_CLASS[sectionCopy.eyebrowAlignment]}`}
            style={{ fontWeight: sectionCopy.eyebrowBold ? 700 : 400 }}
          >
            {sectionCopy.eyebrow}
          </p>
        ) : null}
        {showTitle ? (
          <h2
            className="m-0 text-right text-3xl font-bold tracking-[-0.04em] @3xl/slot-module:text-5xl"
            style={{ lineHeight: 1.08 }}
          >
            {sectionCopy.title}
          </h2>
        ) : null}
      </div>
    ) : null;

  const hasIntroColumn = Boolean(introColumn);
  const hasHeadingColumn = Boolean(headingColumn);
  const showHeader = hasIntroColumn || hasHeadingColumn;
  const headerLayoutClass = getHeaderLayoutClass(hasIntroColumn, hasHeadingColumn);

  const showFooterCta =
    sectionCopy.showFooterCta &&
    Boolean(sectionCopy.footerCta.label.trim()) &&
    Boolean(sectionCopy.footerCta.href.trim());

  function goToNextPage() {
    setActivePage((current) => {
      if (totalPages <= 1) return 0;
      return current >= totalPages - 1 ? 0 : current + 1;
    });
  }

  function goToPrevPage() {
    setActivePage((current) => {
      if (totalPages <= 1) return 0;
      return current <= 0 ? totalPages - 1 : current - 1;
    });
  }

  const { containerRef, swipeHandlers } = useSwipeSlider<HTMLDivElement>({
    enabled: hasMultiplePages,
    onSwipeLeft: goToNextPage,
    onSwipeRight: goToPrevPage,
  });

  if (limitedProjects.length === 0) return null;

  return (
    <section className="relative overflow-x-hidden bg-[#05070B] px-4 pb-12 pt-8 text-white @xl/slot-module:px-6 @xl/slot-module:pb-16 @xl/slot-module:pt-12 @3xl/slot-module:pb-20 @3xl/slot-module:pt-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 cursor-pointer bg-[radial-gradient(circle_at_18%_12%,rgba(216,184,122,0.10),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(255,255,255,0.055),transparent_30%)]"
      />

      <div className="relative mx-auto max-w-7xl">
        {showHeader ? (
          <div dir="rtl" className={headerLayoutClass} data-reveal="fade-up">
            {headingColumn}
            {introColumn}
          </div>
        ) : null}

        <div ref={containerRef} className="relative touch-pan-y" {...swipeHandlers}>
          {hasMultiplePages && (
            <>
              <button
                type="button"
                onClick={goToPrevPage}
                className="absolute left-[-28px] top-1/2 z-40 hidden h-14 w-14 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#D8B87A]/25 bg-[#070A0F]/90 text-2xl text-white/80 shadow-[0_0_32px_rgba(216,184,122,0.12)] backdrop-blur-md transition-all duration-300 hover:border-[#D8B87A]/55 hover:bg-[#0B0E14]/95 hover:text-[#D8B87A] hover:shadow-[0_0_38px_rgba(216,184,122,0.20)] @4xl/slot-module:flex"
                aria-label="المشاريع السابقة"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={goToNextPage}
                className="absolute right-[-28px] top-1/2 z-40 hidden h-14 w-14 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#D8B87A]/25 bg-[#070A0F]/90 text-2xl text-white/80 shadow-[0_0_32px_rgba(216,184,122,0.12)] backdrop-blur-md transition-all duration-300 hover:border-[#D8B87A]/55 hover:bg-[#0B0E14]/95 hover:text-[#D8B87A] hover:shadow-[0_0_38px_rgba(216,184,122,0.20)] @4xl/slot-module:flex"
                aria-label="المشاريع التالية"
              >
                ›
              </button>
            </>
          )}

          {/*
            Clip horizontal slide track only. Vertical padding + overflow-y visible
            lets card lift / shadows breathe without changing on-screen spacing.
          */}
          <div dir="ltr" className="home-projects-slider-clip overflow-x-hidden overflow-y-visible py-3">
            <div
              className="home-projects-slider-track flex transition-transform duration-[850ms] ease-out"
              style={
                totalPages > 1
                  ? {
                      width: `${totalPages * 100}%`,
                      transform: `translateX(-${(safeActivePage * 100) / totalPages}%)`,
                    }
                  : undefined
              }
            >
              {projectPages.map((page, pageIndex) => {
                const isActivePage = pageIndex === safeActivePage;
                const pageLayoutClass = getProjectPageLayoutClass(page.length);
                return (
                  <div
                    key={`page-${pageIndex}-${page.map((project) => project.id).join("-")}`}
                    dir="rtl"
                    className={`${pageLayoutClass}${isActivePage ? "" : " pointer-events-none"}`}
                    style={totalPages > 1 ? { width: `${100 / totalPages}%` } : { width: "100%" }}
                    aria-hidden={isActivePage ? undefined : true}
                    inert={isActivePage ? undefined : true}
                  >
                    {page.map((project, cardIndex) => (
                      <HomeProjectCard
                        key={project.id}
                        project={project}
                        cardCtaAlignment={sectionCopy.cardCtaAlignment}
                        showProjectLocation={sectionCopy.showProjectLocation}
                        slideClass={getProjectCardSlideClass(page.length)}
                        revealDelay={cardIndex * 80}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {hasMultiplePages ? (
          <div className="mt-8 flex justify-center gap-2">
            {projectPages.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActivePage(index)}
                aria-label={`انتقال إلى مجموعة المشاريع ${index + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  safeActivePage === index
                    ? "w-8 bg-[#D8B87A]"
                    : "w-2 bg-white/25 hover:bg-white/45"
                }`}
              />
            ))}
          </div>
        ) : null}

        {showFooterCta ? (
          <div className={`mt-10 flex ${FOOTER_ALIGN_CLASS[sectionCopy.footerCta.alignment]}`} dir="rtl">
            <HomeProjectsFooterCta
              href={sectionCopy.footerCta.href}
              label={sectionCopy.footerCta.label}
              target={sectionCopy.footerCta.target}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
