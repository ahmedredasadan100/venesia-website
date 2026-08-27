"use client";

import Image from "next/image";
import Link from "next/link";

import type { SidebarSeriesItem } from "../../lib/content-feeds/types";
import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarSeriesWidgetProps = {
  items: SidebarSeriesItem[];
  eyebrow: string;
  title: string;
  linkText: string;
  showImage?: boolean;
  showExcerpt?: boolean;
  formatting?: import("../../lib/page-blocks/configs").PageBlockTextFormattingConfig;
};

export default function SidebarSeriesWidget({
  items,
  eyebrow,
  title,
  linkText,
  showImage = true,
  showExcerpt = false,
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

  const cardContent = (
    <>
      {showImage ? (
        <div className="relative h-44 overflow-hidden">
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(max-width: 1024px) 100vw, 340px"
            className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        </div>
      ) : null}

      <div className={`flex min-h-44 flex-col p-4 ${showImage ? "" : "px-16"}`}>
        <h4 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 text-white">
          {item.title}
        </h4>

        {showExcerpt && item.subtitle ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/50">
            {item.subtitle}
          </p>
        ) : null}

        <p className="mt-auto flex justify-end pt-3 text-xs text-[#D8B87A]/80">
          {linkText}
        </p>
      </div>
    </>
  );
  const cardClassName =
    "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition-[border-color,background-color,transform] duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.05] motion-safe:animate-[feedCarouselFade_500ms_ease-out] motion-reduce:hover:translate-y-0";
  const arrowPositionClassName = showImage ? "top-[5.5rem]" : "top-1/2";

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
        >
          {item.href.trim() ? (
            <Link href={item.href} scroll={false} className="block">
              {cardContent}
            </Link>
          ) : (
            <div>{cardContent}</div>
          )}

          {canAdvance ? (
            <div aria-label="التنقل بين سلاسل المحتوى">
              <button
                type="button"
                onClick={goToPrevious}
                aria-label="عرض السلسلة السابقة"
                className={`absolute right-3 ${arrowPositionClassName} z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg backdrop-blur transition hover:border-[#D8B87A]/65 hover:bg-[#D8B87A] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A] motion-reduce:transition-none`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9 5 7 7-7 7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={goToNext}
                aria-label="عرض السلسلة التالية"
                className={`absolute left-3 ${arrowPositionClassName} z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg backdrop-blur transition hover:border-[#D8B87A]/65 hover:bg-[#D8B87A] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A] motion-reduce:transition-none`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m15 5-7 7 7 7" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </SidebarFeedPanel>
  );
}
