"use client";

import Image from "next/image";
import Link from "next/link";

import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import type { CollectionContentHierarchy } from "../../lib/collection-modules/content-hierarchy";
import {
  getMediaHref,
  MEDIA_TYPE_PATHS,
  type MediaContentItem,
} from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import FeedCarouselDots from "../feed-modules/FeedCarouselDots";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubFeaturedProps = {
  items: MediaContentItem[];
  contentHierarchy?: CollectionContentHierarchy;
  presentation: MediaHubModulePresentation;
  sliderEnabled?: boolean;
  showDateWhenAvailable?: boolean;
};

function FeaturedPrimaryCard({
  item,
  presentation,
  className = "",
  showDateWhenAvailable,
}: {
  item: MediaContentItem;
  presentation: MediaHubModulePresentation;
  className?: string;
  showDateWhenAvailable: boolean;
}) {
  const showDate = Boolean(item.date) && (
    item.showDateOnPage || showDateWhenAvailable
  );

  return (
    <Link
      href={getMediaHref(item)}
      className={`group block h-full ${className}`.trim()}
    >
      <article
        className={`relative h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] ${
          presentation.collectionView.cardVariant === "compact"
            ? "min-h-[280px] @2xl/slot-module:min-h-[340px]"
            : "min-h-[320px] @2xl/slot-module:min-h-[445px]"
        }`}
      >
        <Image
          src={item.image}
          alt={item.imageAlt || item.title}
          fill
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover transition duration-1000 group-hover:scale-105"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/55 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-6 @xl/slot-module:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {item.showCategoryOnPage && item.category ? (
              <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
                {item.category}
              </span>
            ) : null}
            {item.showSeriesOnPage && item.series ? (
              <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
                {item.series}
              </span>
            ) : null}
            {showDate ? (
              <span className="text-xs text-white/55">{item.date}</span>
            ) : null}
          </div>
          <h3 className="max-w-2xl text-2xl font-semibold leading-tight text-white @xl/slot-module:text-3xl">
            {item.title}
          </h3>
          {presentation.collectionView.cardVariant !== "compact" &&
          item.showExcerptOnPage &&
          item.excerpt ? (
            <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-7 text-white/68">
              {item.excerpt}
            </p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}

export default function MediaCenterHubFeatured({
  items,
  contentHierarchy,
  presentation,
  sliderEnabled = false,
  showDateWhenAvailable = false,
}: MediaCenterHubFeaturedProps) {
  const [primaryItem, ...remainingItems] = items;
  const hierarchyMode = contentHierarchy?.mode ?? "uniform";
  const secondaryItems = remainingItems.slice(
    0,
    contentHierarchy?.secondaryItemCount ?? remainingItems.length,
  );
  const {
    activeIndex: activeSliderIndex,
    goTo,
  } = useAutoCarousel<HTMLDivElement>({
    itemCount: secondaryItems.length,
    enabled: sliderEnabled,
    autoplay: false,
  });
  if (!primaryItem) return null;

  const activeSliderItem = secondaryItems[activeSliderIndex] ?? primaryItem;

  return (
    <section className="relative">
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href={`/media-center/${MEDIA_TYPE_PATHS[primaryItem.type]}`}
      />

      {hierarchyMode === "uniform" ? (
        <MediaCenterCollectionItems
          items={items}
          view={presentation.collectionView}
          showDateWhenAvailable={showDateWhenAvailable}
        />
      ) : sliderEnabled && secondaryItems.length ? (
        <div
          className="grid items-stretch gap-x-5 gap-y-3 @2xl/slot-module:grid-cols-[0.9fr_1.1fr]"
          data-featured-slider=""
        >
          <div
            className="order-2 grid h-full auto-rows-fr gap-3 @2xl/slot-module:col-start-1 @2xl/slot-module:row-start-1"
            data-slider-news-group=""
          >
            {secondaryItems.map((item, index) => {
              const isActive = activeSliderIndex === index;
              const showDate = Boolean(item.date) && (
                item.showDateOnPage || showDateWhenAvailable
              );

              return (
                <Link
                  key={item.id}
                  href={getMediaHref(item)}
                  onMouseEnter={() => goTo(index)}
                  onFocus={() => goTo(index)}
                  aria-current={isActive ? "true" : undefined}
                  className="group block h-full"
                >
                  <article
                    className={`grid h-full grid-cols-[112px_minmax(0,1fr)] gap-4 overflow-hidden rounded-[1.35rem] border bg-white/[0.035] p-3 transition duration-500 ${
                      isActive
                        ? "border-[#D8B87A]/40"
                        : "border-white/10 hover:border-[#D8B87A]/30"
                    }`}
                  >
                    <div className="relative min-h-[98px] overflow-hidden rounded-[1rem]">
                      <Image
                        src={item.image}
                        alt={item.imageAlt || item.title}
                        fill
                        sizes="112px"
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                    </div>

                    <div className="min-w-0 self-center">
                      {item.showCategoryOnPage ||
                      item.showSeriesOnPage ||
                      showDate ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-white/38">
                          {item.showCategoryOnPage && item.category ? (
                            <span className="text-[#D8B87A]/75">{item.category}</span>
                          ) : null}
                          {item.showSeriesOnPage && item.series ? (
                            <span className="text-[#D8B87A]/75">{item.series}</span>
                          ) : null}
                          {showDate ? <span>{item.date}</span> : null}
                        </div>
                      ) : null}

                      <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white transition group-hover:text-[#D8B87A]">
                        {item.title}
                      </h3>

                      {item.showExcerptOnPage && item.excerpt ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/48">
                          {item.excerpt}
                        </p>
                      ) : null}
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>

          <div
            className="order-3 @2xl/slot-module:col-start-1 @2xl/slot-module:row-start-2 [&>div]:mt-0"
          >
            <FeedCarouselDots
              count={secondaryItems.length}
              activeIndex={activeSliderIndex}
              onSelect={goTo}
              itemLabel="الأخبار"
            />
          </div>

          <FeaturedPrimaryCard
            key={activeSliderItem.id}
            item={activeSliderItem}
            presentation={presentation}
            showDateWhenAvailable={showDateWhenAvailable}
            className="order-1 @2xl/slot-module:col-start-2 @2xl/slot-module:row-start-1"
          />
        </div>
      ) : (
        <div className="grid items-stretch gap-5 @2xl/slot-module:grid-cols-[1.1fr_0.9fr]">
          <FeaturedPrimaryCard
            item={primaryItem}
            presentation={presentation}
            showDateWhenAvailable={showDateWhenAvailable}
          />

          {secondaryItems.length ? (
            <div className="@2xl/slot-module:h-full @2xl/slot-module:[&>div]:h-full @2xl/slot-module:[&>div]:auto-rows-fr">
              <MediaCenterCollectionItems
                items={secondaryItems}
                view={{
                  ...presentation.collectionView,
                  layout: "list",
                  itemsPerRow: 1,
                  cardVariant: "compact",
                }}
                showDateWhenAvailable={showDateWhenAvailable}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
