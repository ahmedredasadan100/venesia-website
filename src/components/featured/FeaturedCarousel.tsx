"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import type { PublicContentSummary } from "../../lib/content/public-content-read/contract";
import {
  resolveFeaturedItemDisplay,
  type FeaturedNavigation,
  type FeaturedPresentation,
} from "../../lib/featured-modules/contract";
import {
  type ContentDisplayOptions,
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
  type ResolvedCollectionDisplayTextFormatting,
} from "../../lib/page-blocks/configs";
import FeedCarouselDots from "../feed-modules/FeedCarouselDots";
import PublicGoldPill from "../public/PublicGoldPill";
import FeaturedContentCard from "./FeaturedContentCard";

type FeaturedCarouselMode =
  | "legacy"
  | "single"
  | "group"
  | "hero"
  | "editorial"
  | "large-card"
  | "three-cards";

function featuredGroupGridClass(itemsPerView: number) {
  if (itemsPerView <= 1) return "grid gap-5";
  if (itemsPerView === 2) return "grid gap-5 @xl/slot-module:grid-cols-2";
  if (itemsPerView === 3) return "grid gap-5 @xl/slot-module:grid-cols-3";
  return "grid gap-5 @xl/slot-module:grid-cols-2 @3xl/slot-module:grid-cols-4";
}

function FeaturedEditorialSecondaryCard({
  item,
  display,
  displayFormatting,
}: {
  item: PublicContentSummary;
  display: ContentDisplayOptions;
  displayFormatting: ResolvedCollectionDisplayTextFormatting;
}) {
  const resolvedDisplay = resolveFeaturedItemDisplay(display, item);
  const showTaxonomy = resolvedDisplay.category || resolvedDisplay.series;
  const showMetadata = showTaxonomy || resolvedDisplay.date;

  return (
    <Link href={item.href} className="group block h-full">
      <article
        className={`grid h-full gap-4 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-3 transition duration-500 hover:border-[#D8B87A]/30 ${
          resolvedDisplay.image
            ? "grid-cols-[112px_minmax(0,1fr)]"
            : "grid-cols-1"
        }`}
      >
        {resolvedDisplay.image ? (
          <div className="relative min-h-[98px] overflow-hidden rounded-[1rem]">
            <Image
              src={item.image}
              alt={item.imageAlt || item.title}
              fill
              sizes="112px"
              className="object-cover transition duration-700 group-hover:scale-105"
            />
          </div>
        ) : null}

        <div className="min-w-0 self-center">
          {showMetadata ? (
            <div
              data-featured-metadata-area=""
              className="grid gap-1.5 text-sm leading-5 text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
            >
              {showTaxonomy ? (
                <div
                  data-featured-taxonomy-stack=""
                  className="grid -translate-y-2 gap-1"
                >
                  {resolvedDisplay.category ? (
                    <span
                      className={`block w-full ${pageBlockTextAlignClass(displayFormatting.categoryAlignment)}`}
                    >
                      <PublicGoldPill>
                        <span
                          className={`text-sm leading-5 ${displayFormatting.categoryBold ? "font-bold" : "font-medium"}`}
                        >
                          {item.category}
                        </span>
                      </PublicGoldPill>
                    </span>
                  ) : null}
                  {resolvedDisplay.series ? (
                    <span
                      className={`block w-full text-sm leading-5 text-[#D8B87A] ${displayFormatting.seriesBold ? "font-bold" : "font-medium"} ${pageBlockTextAlignClass(displayFormatting.seriesAlignment)}`.trim()}
                    >
                      {item.series}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {resolvedDisplay.date ? (
                <span
                  data-featured-date=""
                  className={`block w-full ${showTaxonomy ? "border-t border-white/10 pt-1.5" : ""} leading-5 ${displayFormatting.dateBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(displayFormatting.dateAlignment)}`.trim()}
                >
                  {item.date}
                </span>
              ) : null}
            </div>
          ) : null}
          {resolvedDisplay.title ? (
            <h3
              className={`mt-2 min-h-12 line-clamp-2 text-base leading-7 text-white transition group-hover:text-[#D8B87A] ${displayFormatting.titleBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(displayFormatting.titleAlignment)} ${pageBlockTextPlacementClass(displayFormatting.titleAlignment)}`}
            >
              {item.title}
            </h3>
          ) : null}
          {resolvedDisplay.excerpt ? (
            <p
              className={`mt-2 min-h-10 line-clamp-2 text-sm leading-6 text-white/55 ${displayFormatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(displayFormatting.excerptAlignment)} ${pageBlockTextPlacementClass(displayFormatting.excerptAlignment)}`}
            >
              {item.excerpt}
            </p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}

export default function FeaturedCarousel({
  items,
  display,
  displayFormatting,
  presentation,
  navigation,
  itemsPerView,
  mode = "single",
}: {
  items: PublicContentSummary[];
  display: ContentDisplayOptions;
  displayFormatting: ResolvedCollectionDisplayTextFormatting;
  presentation: FeaturedPresentation;
  navigation: FeaturedNavigation;
  itemsPerView: number;
  mode?: FeaturedCarouselMode;
}) {
  const groupSize = Math.max(1, itemsPerView);
  const slides = useMemo(() => {
    const nextSlides: PublicContentSummary[][] = [];
    for (let index = 0; index < items.length; index += groupSize) {
      nextSlides.push(items.slice(index, index + groupSize));
    }
    return nextSlides;
  }, [groupSize, items]);
  const {
    activeIndex,
    canAdvance,
    goTo,
    goToNext,
    goToPrevious,
    containerRef,
    swipeHandlers,
  } = useAutoCarousel<HTMLDivElement>({
    itemCount: slides.length,
    intervalMs: 7600,
    autoplay: navigation.autoplay,
  });
  const activeItems = slides[activeIndex] ?? slides[0] ?? [];

  if (!activeItems.length) return null;
  const isEditorial = mode === "editorial";
  const isGroup = mode === "group" || mode === "three-cards";
  const [primary, ...secondary] = activeItems;

  return (
    <div
      ref={containerRef}
      className="touch-pan-y"
      role="region"
      aria-roledescription="carousel"
      aria-label="المحتوى المميز"
      data-featured-carousel=""
      data-featured-carousel-mode={mode}
      data-featured-items-per-view={groupSize}
      data-featured-navigation-arrows={navigation.showArrows}
      data-featured-navigation-dots={navigation.showDots}
      data-featured-navigation-autoplay={navigation.autoplay}
      {...swipeHandlers}
    >
      <div
        key={activeIndex}
        role="group"
        aria-roledescription="slide"
        aria-label={`${isGroup || isEditorial ? "مجموعة" : "عنصر"} ${activeIndex + 1} من ${slides.length}`}
        className={
          isEditorial
            ? "motion-safe:animate-[feedCarouselFade_450ms_ease-out]"
            : isGroup
              ? `${featuredGroupGridClass(groupSize)} motion-safe:animate-[feedCarouselFade_450ms_ease-out]`
              : "motion-safe:animate-[feedCarouselFade_500ms_ease-out]"
        }
      >
        {isEditorial ? (
          <div className="grid items-stretch gap-x-5 gap-y-3 @2xl/slot-module:grid-cols-[0.9fr_1.1fr]">
            {secondary.length ? (
              <div className="order-2 grid h-full auto-rows-fr gap-3 @2xl/slot-module:col-start-1 @2xl/slot-module:row-start-1">
                {secondary.map((item) => (
                  <FeaturedEditorialSecondaryCard
                    key={item.id}
                    item={item}
                    display={display}
                    displayFormatting={displayFormatting}
                  />
                ))}
              </div>
            ) : null}
            <div className="order-1 h-full @2xl/slot-module:col-start-2 @2xl/slot-module:row-start-1">
              <FeaturedContentCard
                item={primary}
                display={display}
                displayFormatting={displayFormatting}
                presentation={presentation}
                size="large"
              />
            </div>
          </div>
        ) : (
          activeItems.map((item) => (
            <FeaturedContentCard
              key={item.id}
              item={item}
              display={display}
              displayFormatting={displayFormatting}
              presentation={presentation}
              size={isGroup ? "standard" : "large"}
            />
          ))
        )}
      </div>

      {canAdvance ? (
        <div
          className="mt-3 grid justify-items-center gap-3 [&>div]:mt-0"
          aria-label="التنقل بين المحتوى المميز"
          data-featured-navigation=""
        >
          {navigation.showArrows ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={goToPrevious}
                aria-label="المجموعة السابقة"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white transition hover:border-[#D8B87A] hover:text-[#D8B87A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]"
              >
                →
              </button>
              <button
                type="button"
                onClick={goToNext}
                aria-label="المجموعة التالية"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white transition hover:border-[#D8B87A] hover:text-[#D8B87A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]"
              >
                ←
              </button>
            </div>
          ) : null}
          {navigation.showDots ? (
            <FeedCarouselDots
              count={slides.length}
              activeIndex={activeIndex}
              onSelect={goTo}
              itemLabel={
                isGroup || isEditorial
                  ? "مجموعات المحتوى المميز"
                  : "المحتوى المميز"
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
