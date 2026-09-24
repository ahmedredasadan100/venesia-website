"use client";

import Image from "next/image";
import Link from "next/link";

import type { SidebarArticleItem } from "../../lib/content-feeds/types";
import {
  DEFAULT_FEED_ARTICLE_CARD_PRESENTATION,
  type FeedArticleCardPresentation,
  type FeedLatestPresentationVariant,
  type FeedPresentationDensity,
} from "../../lib/feed-modules/types";
import { pageBlockTextAlignClass } from "../../lib/page-blocks/configs";
import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import FeedCarouselDots from "../feed-modules/FeedCarouselDots";
import FeedCarouselNavigation from "../feed-modules/FeedCarouselNavigation";
import FeedGroupedList from "../feed-modules/FeedGroupedList";
import { FEED_MAX_VISIBLE_DOTS } from "../feed-modules/feed-grouped-list-contract";
import {
  feedGridColumnsClass,
  feedSliderColumnsClass,
} from "../feed-modules/feed-presentation-layout";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarLatestArticlesWidgetProps = {
  items: SidebarArticleItem[];
  eyebrow?: string | null;
  title: string;
  showImage?: boolean;
  showDate?: boolean;
  showExcerpt?: boolean;
  cardFormatting?: FeedArticleCardPresentation;
  presentationVariant: FeedLatestPresentationVariant;
  formatting?: import("../../lib/page-blocks/configs").PageBlockTextFormattingConfig;
};

function chunkItems(items: SidebarArticleItem[], density: FeedPresentationDensity) {
  const slides: SidebarArticleItem[][] = [];
  for (let index = 0; index < items.length; index += density) {
    slides.push(items.slice(index, index + density));
  }
  return slides;
}

function LatestArticleCard({ item, layout, showImage, formatting }: {
  item: SidebarArticleItem;
  layout: FeedLatestPresentationVariant["layout"];
  showImage: boolean;
  formatting: FeedArticleCardPresentation;
}) {
  const hasDate = formatting.showDate && Boolean(item.date?.trim());
  const hasExcerpt = formatting.showExcerpt && Boolean(item.excerpt?.trim());
  const hasText = formatting.showTitle || hasDate || hasExcerpt;
  const isList = layout === "list";
  const hasSurface = layout === "grid" || isList;
  if (!showImage && !hasText) return null;

  return (
    <Link
      href={item.href}
      className={`group min-w-0 ${
        isList && showImage && hasText
          ? "grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-4"
          : "flex flex-col"
      } ${
        hasSurface
          ? "h-full rounded-2xl border border-white/10 bg-white/[0.025] p-3 transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.06]"
          : ""
      }`.trim()}
      data-feed-article-card="latest"
    >
      {showImage ? (
        <div className={`relative w-full overflow-hidden rounded-xl ${isList ? "aspect-square" : "aspect-[4/3]"}`}>
          <Image
            src={item.image}
            alt={item.imageAlt}
            fill
            sizes={isList ? "104px" : "(max-width: 1024px) 30vw, 100px"}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
      ) : null}
      {hasText ? (
        <div className={`${showImage && !isList ? "mt-3" : ""} min-w-0 w-full space-y-1`.trim()}>
          {formatting.showTitle ? (
            <h4
              className={`line-clamp-2 text-sm text-white/70 transition group-hover:text-[#D8B87A] ${formatting.titleBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.titleAlignment)}`.trim()}
              style={{ lineHeight: 1.75 }}
              data-feed-article-title=""
            >
              {item.title}
            </h4>
          ) : null}
          {hasDate ? (
            <p className={`text-xs text-white/35 ${formatting.dateBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.dateAlignment)}`.trim()} data-feed-article-date="">
              {item.date}
            </p>
          ) : null}
          {hasExcerpt ? (
            <p className={`line-clamp-2 text-xs leading-6 text-white/45 ${formatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.excerptAlignment)}`.trim()} data-feed-article-excerpt="">
              {item.excerpt}
            </p>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

export default function SidebarLatestArticlesWidget({
  items,
  eyebrow,
  title,
  showImage = true,
  showDate = true,
  showExcerpt = false,
  cardFormatting,
  presentationVariant,
  formatting,
}: SidebarLatestArticlesWidgetProps) {
  const isSlider = presentationVariant.layout === "slider";
  const slides = chunkItems(items, presentationVariant.density);
  const { activeIndex, canAdvance, goTo, goToNext, goToPrevious, containerRef, swipeHandlers } =
    useAutoCarousel<HTMLDivElement>({ itemCount: slides.length, intervalMs: 7600, enabled: isSlider });

  if (!items.length) return null;
  const resolvedCardFormatting = cardFormatting ?? {
    ...DEFAULT_FEED_ARTICLE_CARD_PRESENTATION,
    showDate,
    showExcerpt,
  };
  const hasRenderableItems =
    showImage ||
    resolvedCardFormatting.showTitle ||
    (resolvedCardFormatting.showDate && items.some((item) => Boolean(item.date?.trim()))) ||
    (resolvedCardFormatting.showExcerpt && items.some((item) => Boolean(item.excerpt?.trim())));
  if (!hasRenderableItems) return null;

  if (!isSlider) {
    const cards = items.map((item) => (
      <LatestArticleCard key={`${item.href}-${item.title}`} item={item} layout={presentationVariant.layout} showImage={showImage} formatting={resolvedCardFormatting} />
    ));
    return (
      <SidebarFeedPanel eyebrow={eyebrow ?? undefined} title={title} formatting={formatting}>
        {presentationVariant.layout === "list" ? (
          <FeedGroupedList itemsPerGroup={presentationVariant.list.itemsPerGroup} showDots={presentationVariant.list.showDots} intervalSeconds={presentationVariant.list.intervalSeconds} itemLabel="أحدث الموضوعات" className="space-y-4">
            {cards}
          </FeedGroupedList>
        ) : (
          <div className={`grid gap-4 ${feedGridColumnsClass(presentationVariant.density)}`} data-feed-presentation="grid" data-feed-grid-columns={presentationVariant.density}>
            {cards}
          </div>
        )}
      </SidebarFeedPanel>
    );
  }

  const activeItems = slides[activeIndex] ?? slides[0] ?? [];
  return (
    <SidebarFeedPanel eyebrow={eyebrow ?? undefined} title={title} formatting={formatting}>
      <div ref={containerRef} className="touch-pan-y" role="region" aria-roledescription="carousel" aria-label={title} data-feed-presentation="slider" data-feed-slider-density={presentationVariant.density} {...swipeHandlers}>
        <div key={activeIndex} className={`grid gap-3 motion-safe:animate-[feedCarouselFade_450ms_ease-out] ${feedSliderColumnsClass(presentationVariant.density)}`} role="group" aria-roledescription="slide" aria-label={`مجموعة ${activeIndex + 1} من ${slides.length}`}>
          {activeItems.map((item) => (
            <LatestArticleCard key={`${item.href}-${item.title}`} item={item} layout="slider" showImage={showImage} formatting={resolvedCardFormatting} />
          ))}
        </div>
        {presentationVariant.showArrows && canAdvance ? (
          <FeedCarouselNavigation onPrevious={goToPrevious} onNext={goToNext} label="التنقل بين مجموعات أحدث الموضوعات" previousLabel="عرض المجموعة السابقة" nextLabel="عرض المجموعة التالية" />
        ) : null}
        {presentationVariant.showDots && canAdvance ? (
          <FeedCarouselDots count={slides.length} activeIndex={activeIndex} onSelect={goTo} itemLabel="مجموعات أحدث الموضوعات" maxVisible={FEED_MAX_VISIBLE_DOTS} />
        ) : null}
      </div>
    </SidebarFeedPanel>
  );
}
