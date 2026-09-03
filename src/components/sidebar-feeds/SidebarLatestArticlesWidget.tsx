"use client";

import Image from "next/image";
import Link from "next/link";

import type { SidebarArticleItem } from "../../lib/content-feeds/types";
import {
  DEFAULT_FEED_ARTICLE_CARD_PRESENTATION,
  type FeedArticleCardPresentation,
} from "../../lib/feed-modules/types";
import { pageBlockTextAlignClass } from "../../lib/page-blocks/configs";
import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import FeedCarouselDots from "../feed-modules/FeedCarouselDots";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarLatestArticlesWidgetProps = {
  items: SidebarArticleItem[];
  eyebrow?: string | null;
  title: string;
  showImage?: boolean;
  showDate?: boolean;
  showExcerpt?: boolean;
  cardFormatting?: FeedArticleCardPresentation;
  formatting?: import("../../lib/page-blocks/configs").PageBlockTextFormattingConfig;
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
  eyebrow,
  title,
  showImage = true,
  showDate = true,
  showExcerpt = false,
  cardFormatting,
  formatting,
}: SidebarLatestArticlesWidgetProps) {
  const slides = chunkItems(items);
  const { activeIndex, goTo, containerRef, swipeHandlers } =
    useAutoCarousel<HTMLDivElement>({
      itemCount: slides.length,
      intervalMs: 7600,
    });

  if (!items.length) return null;

  const activeItems = slides[activeIndex] ?? slides[0] ?? [];
  const resolvedCardFormatting = cardFormatting ?? {
    ...DEFAULT_FEED_ARTICLE_CARD_PRESENTATION,
    showDate,
    showExcerpt,
  };
  const hasRenderableItems =
    showImage ||
    resolvedCardFormatting.showTitle ||
    (resolvedCardFormatting.showDate && items.some((item) => Boolean(item.date?.trim()))) ||
    (resolvedCardFormatting.showExcerpt &&
      items.some((item) => Boolean(item.excerpt?.trim())));
  if (!hasRenderableItems) return null;

  return (
    <SidebarFeedPanel eyebrow={eyebrow ?? undefined} title={title} formatting={formatting}>
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
          className="grid grid-cols-3 gap-3 motion-safe:animate-[feedCarouselFade_450ms_ease-out]"
          role="group"
          aria-roledescription="slide"
          aria-label={`مجموعة ${activeIndex + 1} من ${slides.length}`}
        >
          {activeItems.map((item) => {
            const hasDate =
              resolvedCardFormatting.showDate && Boolean(item.date?.trim());
            const hasExcerpt =
              resolvedCardFormatting.showExcerpt && Boolean(item.excerpt?.trim());
            const hasText =
              resolvedCardFormatting.showTitle || hasDate || hasExcerpt;
            if (!showImage && !hasText) return null;

            return (
              <Link
                key={`${item.href}-${item.title}`}
                href={item.href}
                className="group flex min-w-0 flex-col"
                data-feed-article-card="latest"
              >
                {showImage ? (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 1024px) 30vw, 100px"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                ) : null}

                {hasText ? (
                  <div
                    className={`${showImage ? "mt-3" : ""} min-w-0 w-full space-y-1`.trim()}
                  >
                    {resolvedCardFormatting.showTitle ? (
                      <h4
                        className={`line-clamp-2 text-sm text-white/70 transition group-hover:text-[#D8B87A] ${resolvedCardFormatting.titleBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.titleAlignment)}`.trim()}
                        style={{ lineHeight: 1.75 }}
                        data-feed-article-title=""
                      >
                        {item.title}
                      </h4>
                    ) : null}

                    {hasDate ? (
                      <p
                        className={`text-xs text-white/35 ${resolvedCardFormatting.dateBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.dateAlignment)}`.trim()}
                        data-feed-article-date=""
                      >
                        {item.date}
                      </p>
                    ) : null}

                    {hasExcerpt ? (
                      <p
                        className={`line-clamp-2 text-xs leading-6 text-white/45 ${resolvedCardFormatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(resolvedCardFormatting.excerptAlignment)}`.trim()}
                        data-feed-article-excerpt=""
                      >
                        {item.excerpt}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Link>
            );
          })}
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
