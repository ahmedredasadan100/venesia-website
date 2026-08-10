"use client";

import Image from "next/image";
import Link from "next/link";

import type { SidebarArticleItem } from "../../lib/content-feeds/types";
import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import FeedCarouselDots from "../feed-modules/FeedCarouselDots";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarLatestArticlesWidgetProps = {
  items: SidebarArticleItem[];
  title: string;
  showImage?: boolean;
  showDate?: boolean;
  showExcerpt?: boolean;
};

const ITEMS_PER_SLIDE = 3;

function chunkItems(items: SidebarArticleItem[]) {
  const slides: SidebarArticleItem[][] = [];

  for (let index = 0; index < items.length; index += ITEMS_PER_SLIDE) {
    slides.push(items.slice(index, index + ITEMS_PER_SLIDE));
  }

  return slides;
}

export default function SidebarLatestArticlesWidget({
  items,
  title,
  showImage = true,
  showDate = true,
  showExcerpt = false,
}: SidebarLatestArticlesWidgetProps) {
  const slides = chunkItems(items);
  const { activeIndex, goTo, containerRef, swipeHandlers } =
    useAutoCarousel<HTMLDivElement>({
      itemCount: slides.length,
      intervalMs: 7600,
    });

  if (!items.length) return null;

  const activeItems = slides[activeIndex] ?? slides[0] ?? [];

  return (
    <SidebarFeedPanel title={title}>
      <div
        ref={containerRef}
        className="touch-pan-y"
        role="region"
        aria-roledescription="carousel"
        aria-label={title}
        {...swipeHandlers}
      >
        <div
          key={activeIndex}
          className="space-y-4 motion-safe:animate-[featuredFade_450ms_ease-out]"
          role="group"
          aria-roledescription="slide"
          aria-label={`مجموعة ${activeIndex + 1} من ${slides.length}`}
        >
          {activeItems.map((item) => (
            <Link
              key={`${item.href}-${item.title}`}
              href={item.href}
              className="group flex gap-3 border-b border-white/10 pb-4 last:border-0 last:pb-0"
            >
              {showImage ? (
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="80px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              ) : null}

              <div>
                <h4 className="line-clamp-2 text-sm leading-7 text-white/70 transition group-hover:text-[#D8B87A]">
                  {item.title}
                </h4>

                {showDate && item.date ? (
                  <p className="mt-1 text-xs text-white/35">{item.date}</p>
                ) : null}

                {showExcerpt && item.excerpt ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-6 text-white/45">
                    {item.excerpt}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>

        <FeedCarouselDots
          count={slides.length}
          activeIndex={activeIndex}
          onSelect={goTo}
          itemLabel="مجموعات أحدث الموضوعات"
        />
      </div>
    </SidebarFeedPanel>
  );
}
