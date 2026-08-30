"use client";

import { useMemo } from "react";

import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import type { PublicContentSummary } from "../../lib/content/public-content-read/contract";
import type { FeaturedPresentation } from "../../lib/featured-modules/contract";
import type { ContentDisplayOptions } from "../../lib/page-blocks/configs";
import FeedCarouselDots from "../feed-modules/FeedCarouselDots";
import FeaturedContentCard from "./FeaturedContentCard";

export default function FeaturedCarousel({
  items,
  display,
  presentation,
  mode = "single",
}: {
  items: PublicContentSummary[];
  display: ContentDisplayOptions;
  presentation: FeaturedPresentation;
  mode?: "legacy" | "single" | "group";
}) {
  const groupSize = mode === "group" ? 3 : 1;
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
  } =
    useAutoCarousel<HTMLDivElement>({
      itemCount: slides.length,
      intervalMs: 7600,
      autoplay: mode !== "legacy",
    });
  const activeItems = slides[activeIndex] ?? slides[0] ?? [];

  if (!activeItems.length) return null;
  const isGroup = mode === "group";

  return (
    <div
      ref={containerRef}
      className="touch-pan-y"
      role="region"
      aria-roledescription="carousel"
      aria-label="المحتوى المميز"
      data-featured-carousel=""
      data-featured-carousel-mode={mode}
      {...swipeHandlers}
    >
      <div
        key={activeIndex}
        role="group"
        aria-roledescription="slide"
        aria-label={`${isGroup ? "مجموعة" : "عنصر"} ${activeIndex + 1} من ${slides.length}`}
        className={
          isGroup
            ? "grid gap-5 motion-safe:animate-[feedCarouselFade_450ms_ease-out] @xl/slot-module:grid-cols-3"
            : "motion-safe:animate-[feedCarouselFade_500ms_ease-out]"
        }
      >
        {activeItems.map((item) => (
          <FeaturedContentCard
            key={item.id}
            item={item}
            display={display}
            presentation={presentation}
            size={isGroup ? "standard" : "large"}
          />
        ))}
      </div>

      {canAdvance && mode === "legacy" ? (
        <div
          className="mt-4 flex items-center justify-center gap-3"
          aria-label="التنقل بين المحتوى المميز"
        >
          <button
            type="button"
            onClick={goToPrevious}
            aria-label="العنصر السابق"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white transition hover:border-[#D8B87A] hover:text-[#D8B87A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]"
          >
            →
          </button>
          <span className="text-xs text-white/45">
            {activeIndex + 1} / {slides.length}
          </span>
          <button
            type="button"
            onClick={goToNext}
            aria-label="العنصر التالي"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white transition hover:border-[#D8B87A] hover:text-[#D8B87A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]"
          >
            ←
          </button>
        </div>
      ) : canAdvance ? (
        <FeedCarouselDots
          count={slides.length}
          activeIndex={activeIndex}
          onSelect={goTo}
          itemLabel={isGroup ? "مجموعات المحتوى المميز" : "المحتوى المميز"}
        />
      ) : null}
    </div>
  );
}
