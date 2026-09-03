"use client";

import Image from "next/image";
import Link from "next/link";

import type { SidebarSeriesItem } from "../../lib/content-feeds/types";
import {
  DEFAULT_FEED_SERIES_CARD_PRESENTATION,
  type FeedSeriesCardPresentation,
} from "../../lib/feed-modules/types";
import {
  pageBlockTextAlignClass,
} from "../../lib/page-blocks/configs";
import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarSeriesWidgetProps = {
  items: SidebarSeriesItem[];
  eyebrow: string;
  title: string;
  linkText: string;
  showImage?: boolean;
  showExcerpt?: boolean;
  cardFormatting?: FeedSeriesCardPresentation;
  formatting?: import("../../lib/page-blocks/configs").PageBlockTextFormattingConfig;
};

export default function SidebarSeriesWidget({
  items,
  eyebrow,
  title,
  linkText,
  showImage = true,
  showExcerpt = false,
  cardFormatting,
  formatting,
}: SidebarSeriesWidgetProps) {
  const {
    activeIndex,
    canAdvance,
    goToNext,
    goToPrevious,
    containerRef,
    swipeHandlers,
  } = useAutoCarousel<HTMLDivElement>({
    itemCount: items.length,
    intervalMs: 8200,
  });
  const item = items[activeIndex] ?? items[0];

  if (!item) return null;

  const resolvedCardFormatting = cardFormatting ?? {
    ...DEFAULT_FEED_SERIES_CARD_PRESENTATION,
    showDescription: showExcerpt,
  };
  const hasHref = Boolean(item.href.trim());
  const hasDescription =
    resolvedCardFormatting.showDescription && Boolean(item.subtitle.trim());
  const showDetails =
    resolvedCardFormatting.showDetails && hasHref && Boolean(linkText.trim());
  const hasContent = resolvedCardFormatting.showSeries || hasDescription;
  const footerAlignmentClassName = showDetails
    ? resolvedCardFormatting.detailsAlignment === "center"
      ? "justify-center"
      : resolvedCardFormatting.detailsAlignment === "left"
        ? "justify-end"
        : "justify-start"
    : "justify-center";
  if (!showImage && !hasContent && !showDetails && !canAdvance) return null;

  const carouselButtonClassName =
    "pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm transition hover:border-[#D8B87A]/70 hover:bg-[#D8B87A] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A] motion-reduce:transition-none";
  const carouselControls = canAdvance ? (
    <div
      className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between"
      role="group"
      aria-label="التنقل بين سلاسل المحتوى"
      data-feed-series-navigation=""
    >
      <button
        type="button"
        onClick={goToPrevious}
        aria-label="عرض السلسلة السابقة"
        className={`${carouselButtonClassName} translate-x-1/2`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9 5 7 7-7 7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={goToNext}
        aria-label="عرض السلسلة التالية"
        className={`${carouselButtonClassName} -translate-x-1/2`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m15 5-7 7 7 7" />
        </svg>
      </button>
    </div>
  ) : null;

  const image = (
    <div
      className="relative aspect-video w-full"
      data-feed-series-image-frame=""
    >
      <div className="absolute inset-0 overflow-hidden rounded-t-2xl">
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="(max-width: 1024px) 100vw, 340px"
          className="object-cover opacity-85 transition-transform duration-700 group-hover:scale-105"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {hasHref ? (
          <Link
            href={item.href}
            scroll={false}
            className="absolute inset-0 z-10"
            aria-label={item.title}
          />
        ) : null}
      </div>
      {carouselControls}
    </div>
  );

  const cardContent = (
    <>
      {showImage ? image : canAdvance ? (
        <div className="relative h-14 border-b border-white/8">
          {carouselControls}
        </div>
      ) : null}

      {hasContent ? (
        <div className="space-y-3 p-4 sm:p-5" data-feed-series-card-content="">
          {resolvedCardFormatting.showSeries ? (
            <h4
              className={`line-clamp-2 text-base leading-7 text-white ${resolvedCardFormatting.seriesBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.seriesAlignment)}`.trim()}
              data-feed-series-title=""
            >
              {hasHref ? (
                <Link href={item.href} scroll={false} className="transition hover:text-[#D8B87A]">
                  {item.title}
                </Link>
              ) : item.title}
            </h4>
          ) : null}

          {hasDescription ? (
            <p
              className={`line-clamp-3 text-sm leading-6 text-white/55 ${resolvedCardFormatting.descriptionBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.descriptionAlignment)}`.trim()}
              data-feed-series-description=""
            >
              {item.subtitle}
            </p>
          ) : null}

        </div>
      ) : null}
    </>
  );
  const cardClassName =
    "group relative rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_24px_60px_rgba(0,0,0,0.24)] transition-[border-color,background-color,transform] duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.05] motion-safe:animate-[feedCarouselFade_500ms_ease-out] motion-reduce:hover:translate-y-0";

  return (
    <SidebarFeedPanel eyebrow={eyebrow} title={title} formatting={formatting}>
      <div
        ref={containerRef}
        className="touch-pan-y"
        role="region"
        aria-roledescription="carousel"
        aria-label={title}
        {...swipeHandlers}
      >
        <div
          key={item.slug}
          className={cardClassName}
          role="group"
          aria-roledescription="slide"
          aria-label={`${activeIndex + 1} من ${items.length}`}
          data-feed-series-card=""
        >
          {cardContent}

          {showDetails ? (
            <div
              className={`flex flex-wrap items-center gap-2 border-t border-white/8 px-4 py-3 ${footerAlignmentClassName}`.trim()}
              aria-label="إجراء سلسلة المحتوى"
              data-feed-series-action-bar=""
            >
              <Link
                href={item.href}
                scroll={false}
                className={`inline-flex min-h-9 w-fit items-center rounded-full border border-[#D8B87A]/30 bg-[#D8B87A]/[0.06] px-4 py-2 text-xs text-[#D8B87A] transition hover:border-[#D8B87A]/60 hover:bg-[#D8B87A]/15 ${resolvedCardFormatting.detailsBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.detailsAlignment)}`.trim()}
                data-feed-series-details=""
              >
                {linkText}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </SidebarFeedPanel>
  );
}
