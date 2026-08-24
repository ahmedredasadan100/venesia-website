import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import PublicMediaImage from "../../public/PublicMediaImage";

import { getProjectTrackHref } from "../../../lib/projects/public-helpers";
import { type PublicProject } from "../../../lib/projects/public-types";
import {
  heroFlexJustifyClass,
  heroTextAlignClass,
  resolveHeroContentControlsForVariant,
  resolveHeroImageCompositionPreset,
  type HeroElementKey,
  type HeroTextAlignment,
} from "../../../lib/hero/hero-content-controls";
import type { HeroConfig } from "../../../lib/page-sections";
import PlainTextContent from "../../content/PlainTextContent";

type ProjectDetailsHeroProps = {
  project: PublicProject;
  presentation?: HeroConfig;
};

function projectHeroPrimaryTextAlignClass(alignment: HeroTextAlignment) {
  return alignment === "right"
    ? "text-center lg:text-right"
    : heroTextAlignClass(alignment);
}

export default function ProjectDetailsHero({ project, presentation }: ProjectDetailsHeroProps) {
  const resolvedPresentation: HeroConfig = presentation ?? {
    imageComposition: resolveHeroImageCompositionPreset(undefined),
    ...resolveHeroContentControlsForVariant({}, "project-detail"),
  };
  const orderedKeys = resolvedPresentation.heroElementOrder;
  const ctaIsTrailing = orderedKeys.at(-1) === "cta";
  const locationLabel = resolvedPresentation.showEyebrow
    ? project.location.label
    : null;

  const contentElements: Partial<Record<HeroElementKey, ReactNode>> = {
    eyebrow: locationLabel ? (
      <p
        className={`font-en text-[11px] uppercase tracking-[0.28em] text-[#D8B87A]/70 ${projectHeroPrimaryTextAlignClass(resolvedPresentation.eyebrowAlignment)} ${resolvedPresentation.eyebrowBold ? "font-bold" : "font-normal"}`}
      >
        {locationLabel}
      </p>
    ) : null,
    title: resolvedPresentation.showTitle ? (
      <h1
        className={`font-en text-6xl leading-none text-[#D8B87A] md:text-8xl ${projectHeroPrimaryTextAlignClass(resolvedPresentation.titleAlignment)} ${resolvedPresentation.titleBold ? "font-semibold" : "font-normal"}`}
      >
        {project.englishName}
      </h1>
    ) : null,
    subtitle: resolvedPresentation.showSubtitle ? (
      <h2
        className={`text-3xl leading-tight text-white md:text-4xl ${projectHeroPrimaryTextAlignClass(resolvedPresentation.subtitleAlignment)} ${resolvedPresentation.subtitleBold ? "font-semibold" : "font-normal"}`}
      >
        {project.arabicName}
      </h2>
    ) : null,
    description: resolvedPresentation.showDescription ? (
      <PlainTextContent
        value={project.shortDescription}
        as="p"
        className={`max-w-2xl text-[15px] leading-7 text-white/62 ${resolvedPresentation.descriptionAlignment === "right" ? "mx-auto text-center lg:mx-0 lg:text-right" : heroTextAlignClass(resolvedPresentation.descriptionAlignment)}`}
      />
    ) : null,
    cta: !ctaIsTrailing && resolvedPresentation.showCta ? (
      <ProjectHeroActions
        project={project}
        alignment={resolvedPresentation.ctaAlignment}
        layout="inline"
      />
    ) : null,
  };

  return (
    <section
      className="relative isolate min-h-[620px] overflow-hidden border-b border-[#D8B87A]/15 bg-[#05070B]"
      dir="rtl"
      data-hero-variant="project-detail"
      data-hero-family="special"
      data-hero-contract="shared"
    >
      <PublicMediaImage
        src={project.heroImage.src}
        alt={project.heroImage.alt}
        fill
        loading="eager"
        sizes="100vw"
        className="opacity-55"
        composition={resolvedPresentation.imageComposition}
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
        <div className="grid w-full items-end gap-x-12 gap-y-9 lg:grid-cols-[0.95fr_1.05fr]">
          <div
            className="flex min-w-0 flex-col gap-4"
            data-hero-element-order={orderedKeys.join(",")}
          >
            {orderedKeys.map((key) => {
              if (key === "cta" && ctaIsTrailing) return null;
              const element = contentElements[key];
              return element ? <Fragment key={key}>{element}</Fragment> : null;
            })}
          </div>

          <div className="hidden lg:row-span-2 lg:flex lg:justify-end">
            <div className="w-[420px] rounded-[28px] border border-[#D8B87A]/20 bg-black/24 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="relative h-[280px] overflow-hidden rounded-[22px]">
                <PublicMediaImage
                  src={project.heroBoxImage.src}
                  alt={project.heroBoxImage.alt}
                  fill
                  loading="eager"
                  sizes="420px"
                  composition={resolvedPresentation.imageComposition}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/90 via-transparent to-transparent" />

                <div className="absolute inset-x-5 bottom-5">
                  {resolvedPresentation.showTitle ? (
                    <p className={`font-en text-4xl text-[#D8B87A] ${heroTextAlignClass(resolvedPresentation.titleAlignment)} ${resolvedPresentation.titleBold ? "font-bold" : "font-normal"}`}>
                      {project.englishName}
                    </p>
                  ) : null}

                  {resolvedPresentation.showSubtitle ? (
                    <p className={`mt-1 text-sm text-white/75 ${heroTextAlignClass(resolvedPresentation.subtitleAlignment)} ${resolvedPresentation.subtitleBold ? "font-bold" : "font-normal"}`}>
                      {project.arabicName}
                    </p>
                  ) : null}
                </div>
              </div>

              {resolvedPresentation.showDescription ? (
                <div className="mt-5 border-t border-[#D8B87A]/15 pt-5">
                <PlainTextContent
                  value={project.shortDescription}
                  as="p"
                  className={`text-sm leading-7 text-white/58 ${heroTextAlignClass(resolvedPresentation.descriptionAlignment)}`}
                />
                </div>
              ) : null}
            </div>
          </div>

          {ctaIsTrailing && resolvedPresentation.showCta ? (
            <ProjectHeroActions
              project={project}
              alignment={resolvedPresentation.ctaAlignment}
              layout="wide"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ProjectHeroActions({
  project,
  alignment,
  layout,
}: {
  project: PublicProject;
  alignment: HeroTextAlignment;
  layout: "inline" | "wide";
}) {
  return (
    <div
      className={`flex w-full ${layout === "wide" ? "lg:col-span-2" : ""} ${heroFlexJustifyClass(alignment)}`}
      data-hero-cta-alignment={alignment}
    >
      <div className={`grid w-full max-w-full grid-cols-3 items-stretch gap-1 sm:gap-2 md:gap-3 lg:gap-4 ${alignment === "right" ? "" : "lg:max-w-5xl"}`}>
      <button
        type="button"
        disabled
        className={`${primaryActionClassName} cursor-not-allowed bg-[#D8B87A]/55 text-[#111]/70`}
      >
        <DownloadIcon className={actionIconClassName} />
        <span className={actionLabelClassName}>حمّل ملف المشروع</span>
      </button>

      <Link href={getProjectTrackHref(project)} className={secondaryActionClassName}>
        <TrackIcon className={actionIconClassName} />
        <span className={actionLabelClassName}>تابع مراحل الإنشاء</span>
      </Link>

      <Link href="/contact" className={secondaryActionClassName}>
        <ReserveIcon className={actionIconClassName} />
        <span className={actionLabelClassName}>احجز وحدتك الآن</span>
      </Link>
      </div>
    </div>
  );
}

const actionIconClassName = "hidden h-4 w-4 shrink-0 sm:block sm:h-[18px] sm:w-[18px]";

const actionLabelClassName =
  "min-w-0 whitespace-normal text-center leading-snug md:whitespace-nowrap";

const primaryActionClassName =
  "inline-flex h-full min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-xl bg-[#D8B87A] px-1.5 py-2.5 text-[10px] font-medium text-[#111] transition hover:bg-[#e5c989] sm:gap-2 sm:px-3 sm:py-3 sm:text-[11px] md:gap-2.5 md:whitespace-nowrap md:px-4 md:py-3.5 md:text-sm lg:gap-3 lg:px-5";

const secondaryActionClassName =
  "inline-flex h-full min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-[#D8B87A]/35 px-1.5 py-2.5 text-[10px] text-[#D8B87A] transition hover:border-[#D8B87A]/70 hover:bg-[#D8B87A]/10 sm:gap-2 sm:px-3 sm:py-3 sm:text-[11px] md:gap-2.5 md:whitespace-nowrap md:px-4 md:py-3.5 md:text-sm lg:gap-3 lg:px-5";

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 4v10M8 10l4 4 4-4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ReserveIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7 4v3M17 4v3M5 8h14M6 5h12a1 1 0 0 1 1 1v13H5V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TrackIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 18h16M7 14V8M12 14V6M17 14v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
