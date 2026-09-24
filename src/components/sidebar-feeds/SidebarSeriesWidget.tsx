"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import type { SidebarSeriesItem } from "../../lib/content-feeds/types";
import {
  DEFAULT_FEED_SERIES_CARD_PRESENTATION,
  type FeedSeriesCardPresentation,
  type FeedSeriesPresentationVariant,
} from "../../lib/feed-modules/types";
import { pageBlockTextAlignClass } from "../../lib/page-blocks/configs";
import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import FeedCarouselNavigation from "../feed-modules/FeedCarouselNavigation";
import FeedGroupedList from "../feed-modules/FeedGroupedList";
import { feedGridColumnsClass } from "../feed-modules/feed-presentation-layout";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarSeriesWidgetProps = {
  items: SidebarSeriesItem[];
  eyebrow: string;
  title: string;
  linkText: string;
  showImage?: boolean;
  showExcerpt?: boolean;
  cardFormatting?: FeedSeriesCardPresentation;
  presentationVariant: FeedSeriesPresentationVariant;
  formatting?: import("../../lib/page-blocks/configs").PageBlockTextFormattingConfig;
};

function SeriesCard({
  item,
  layout,
  linkText,
  showImage,
  formatting,
  navigation,
  slideLabel,
}: {
  item: SidebarSeriesItem;
  layout: FeedSeriesPresentationVariant["layout"];
  linkText: string;
  showImage: boolean;
  formatting: FeedSeriesCardPresentation;
  navigation?: ReactNode;
  slideLabel?: string;
}) {
  const isSlider = layout === "slider";
  const isList = layout === "list";
  const hasHref = Boolean(item.href.trim());
  const hasDescription = formatting.showDescription && Boolean(item.subtitle.trim());
  const showDetails = formatting.showDetails && hasHref && Boolean(linkText.trim());
  const hasContent = formatting.showSeries || hasDescription;
  const footerAlignmentClassName = showDetails
    ? formatting.detailsAlignment === "center"
      ? "justify-center"
      : formatting.detailsAlignment === "left"
        ? "justify-end"
        : "justify-start"
    : "justify-center";
  if (!showImage && !hasContent && !showDetails && !navigation) return null;

  const image = showImage ? (
    <div className={isList ? "relative min-h-36 w-full" : "relative aspect-video w-full"} data-feed-series-image-frame="">
      <div className={`absolute inset-0 overflow-hidden ${isList ? "rounded-r-2xl" : "rounded-t-2xl"}`}>
        <Image src={item.image} alt={item.imageAlt} fill sizes={isList ? "112px" : "(max-width: 1024px) 100vw, 340px"} className="object-cover opacity-85 transition-transform duration-700 group-hover:scale-105" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {hasHref ? <Link href={item.href} scroll={false} className="absolute inset-0 z-10" aria-label={item.title} /> : null}
      </div>
      {navigation}
    </div>
  ) : navigation ? (
    <div className="relative h-14 border-b border-white/8">{navigation}</div>
  ) : null;

  const content = hasContent ? (
    <div className="space-y-3 p-4 sm:p-5" data-feed-series-card-content="">
      {formatting.showSeries ? (
        <h4 className={`line-clamp-2 text-base leading-7 text-white ${formatting.seriesBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.seriesAlignment)}`.trim()} data-feed-series-title="">
          {hasHref ? <Link href={item.href} scroll={false} className="transition hover:text-[#D8B87A]">{item.title}</Link> : item.title}
        </h4>
      ) : null}
      {hasDescription ? (
        <p className={`line-clamp-3 text-sm leading-6 text-white/55 ${formatting.descriptionBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.descriptionAlignment)}`.trim()} data-feed-series-description="">
          {item.subtitle}
        </p>
      ) : null}
    </div>
  ) : null;

  const action = showDetails ? (
    <div className={`flex flex-wrap items-center gap-2 border-t border-white/8 px-4 py-3 ${footerAlignmentClassName}`.trim()} aria-label="إجراء سلسلة المحتوى" data-feed-series-action-bar="">
      <Link href={item.href} scroll={false} className={`inline-flex min-h-9 w-fit items-center rounded-full border border-[#D8B87A]/30 bg-[#D8B87A]/[0.06] px-4 py-2 text-xs text-[#D8B87A] transition hover:border-[#D8B87A]/60 hover:bg-[#D8B87A]/15 ${formatting.detailsBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.detailsAlignment)}`.trim()} data-feed-series-details="">
        {linkText}
      </Link>
    </div>
  ) : null;

  return (
    <div
      className={`group relative min-w-0 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_24px_60px_rgba(0,0,0,0.24)] transition-[border-color,background-color,transform] duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.05] motion-reduce:hover:translate-y-0 ${isList && showImage && (hasContent || showDetails) ? "grid grid-cols-[7rem_minmax(0,1fr)]" : ""} ${isSlider ? "motion-safe:animate-[feedCarouselFade_500ms_ease-out]" : "h-full overflow-hidden"}`.trim()}
      role={isSlider ? "group" : undefined}
      aria-roledescription={isSlider ? "slide" : undefined}
      aria-label={isSlider ? slideLabel : undefined}
      data-feed-series-card=""
    >
      {image}
      {isList && showImage && (hasContent || showDetails) ? <div className="flex min-w-0 flex-col">{content}{action}</div> : <>{content}{action}</>}
    </div>
  );
}

export default function SidebarSeriesWidget({
  items,
  eyebrow,
  title,
  linkText,
  showImage = true,
  showExcerpt = false,
  cardFormatting,
  presentationVariant,
  formatting,
}: SidebarSeriesWidgetProps) {
  const isSlider = presentationVariant.layout === "slider";
  const { activeIndex, canAdvance, goToNext, goToPrevious, containerRef, swipeHandlers } =
    useAutoCarousel<HTMLDivElement>({ itemCount: items.length, intervalMs: 8200, enabled: isSlider });
  const item = items[activeIndex] ?? items[0];
  if (!item) return null;

  const resolvedCardFormatting = cardFormatting ?? {
    ...DEFAULT_FEED_SERIES_CARD_PRESENTATION,
    showDescription: showExcerpt,
  };
  const navigation = presentationVariant.showArrows && canAdvance ? (
    <div className="contents" data-feed-series-navigation="">
      <FeedCarouselNavigation onPrevious={goToPrevious} onNext={goToNext} label="التنقل بين سلاسل المحتوى" previousLabel="عرض السلسلة السابقة" nextLabel="عرض السلسلة التالية" placement="image-edges" />
    </div>
  ) : null;

  if (!isSlider) {
    const cards = items.map((seriesItem) => (
      <SeriesCard key={seriesItem.slug} item={seriesItem} layout={presentationVariant.layout} linkText={linkText} showImage={showImage} formatting={resolvedCardFormatting} />
    ));
    return (
      <SidebarFeedPanel eyebrow={eyebrow} title={title} formatting={formatting}>
        {presentationVariant.layout === "list" ? (
          <FeedGroupedList itemsPerGroup={presentationVariant.list.itemsPerGroup} showDots={presentationVariant.list.showDots} intervalSeconds={presentationVariant.list.intervalSeconds} itemLabel="سلاسل المحتوى" className="space-y-4">
            {cards}
          </FeedGroupedList>
        ) : (
          <div className={`grid gap-4 ${feedGridColumnsClass(presentationVariant.columns)}`} data-feed-presentation="grid" data-feed-grid-columns={presentationVariant.columns}>
            {cards}
          </div>
        )}
      </SidebarFeedPanel>
    );
  }

  return (
    <SidebarFeedPanel eyebrow={eyebrow} title={title} formatting={formatting}>
      <div ref={containerRef} className="touch-pan-y" role="region" aria-roledescription="carousel" aria-label={title} data-feed-presentation="slider" data-feed-slider-density="1" {...swipeHandlers}>
        <SeriesCard key={item.slug} item={item} layout="slider" linkText={linkText} showImage={showImage} formatting={resolvedCardFormatting} navigation={navigation} slideLabel={`${activeIndex + 1} من ${items.length}`} />
      </div>
    </SidebarFeedPanel>
  );
}
