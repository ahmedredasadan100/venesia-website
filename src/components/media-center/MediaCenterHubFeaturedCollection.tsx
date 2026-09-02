"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import {
  getMediaHref,
  type MediaContentItem,
  type MediaContentType,
} from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import { resolveMediaCollectionItemDisplay } from "../../lib/media-center/collection-display-adapter";
import {
  pageBlockTextAlignClass,
  resolveCollectionDisplayTextFormatting,
  type CollectionDisplayOverrides,
} from "../../lib/page-blocks/configs";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubFeaturedCollectionProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
  display: CollectionDisplayOverrides;
  href: string;
};

const FEATURED_GRID_COLUMNS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @xl/slot-module:grid-cols-2",
  3: "grid-cols-1 @xl/slot-module:grid-cols-2",
  4: "grid-cols-1 @md/slot-module:grid-cols-2 @xl/slot-module:grid-cols-4",
};

const FEATURED_ACTION_LABELS: Record<MediaContentType, string> = {
  news: "قراءة الخبر",
  video: "مشاهدة الفيديو",
  gallery: "عرض الصور",
  press: "قراءة البيان",
  site_update: "عرض التحديث",
};

const FEATURED_MARKERS: Record<MediaContentType, string> = {
  news: "◇",
  video: "▶",
  gallery: "▧",
  press: "▣",
  site_update: "◆",
};

export default function MediaCenterHubFeaturedCollection({
  items,
  presentation,
  display,
  href,
}: MediaCenterHubFeaturedCollectionProps) {
  const itemsPerView = presentation.collectionView.itemsPerRow;
  const {
    activeIndex: startIndex,
    canAdvance: canSlide,
    goToNext,
    goToPrevious,
  } = useAutoCarousel<HTMLDivElement>({
    itemCount: items.length,
    enabled: items.length > itemsPerView,
    autoplay: false,
  });
  const visibleItems = useMemo(() => {
    if (items.length <= itemsPerView) return items;

    return Array.from({ length: itemsPerView }, (_, index) => (
      items[(startIndex + index) % items.length]
    ));
  }, [items, itemsPerView, startIndex]);

  return (
    <section className="relative">
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href={href}
        actions={canSlide ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPrevious}
              aria-label="العنصر السابق"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              →
            </button>
            <button
              type="button"
              onClick={goToNext}
              aria-label="العنصر التالي"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              ←
            </button>
          </div>
        ) : undefined}
      />

      <div className={`grid gap-4 ${FEATURED_GRID_COLUMNS[itemsPerView]}`}>
        {visibleItems.map((item) => {
          const itemDisplay = resolveMediaCollectionItemDisplay(display, item);
          const formatting = resolveCollectionDisplayTextFormatting(itemDisplay);

          return (
          <Link key={item.id} href={getMediaHref(item)} className="group block">
            <article
              className={`flex h-full flex-col rounded-[1.4rem] border border-white/10 bg-white/[0.035] transition duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/35 ${
                presentation.collectionView.cardVariant === "compact" ? "p-4" : "p-5"
              }`}
            >
              {itemDisplay.image ? (
                <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-[1rem]">
                  <Image
                    src={item.image}
                    alt={item.imageAlt || item.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-[#D8B87A]/25 bg-[#05070B]/70 text-[#D8B87A] backdrop-blur"
                  >
                    {FEATURED_MARKERS[item.type]}
                  </span>
                </div>
              ) : null}

              {itemDisplay.date || itemDisplay.category || itemDisplay.series ? (
                <div className="flex w-full flex-col gap-1 text-xs text-white/35">
                  {itemDisplay.category ? <span className={`block w-full ${formatting.categoryBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.categoryAlignment)}`}>{item.category}</span> : null}
                  {itemDisplay.series ? <span className={`block w-full ${formatting.seriesBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.seriesAlignment)}`}>{item.series}</span> : null}
                  {itemDisplay.date ? <span className={`block w-full ${formatting.dateBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.dateAlignment)}`}>{item.date}</span> : null}
                </div>
              ) : null}

              {itemDisplay.title ? (
                <h3 className={`mt-3 min-h-[56px] line-clamp-2 text-base leading-7 text-white transition group-hover:text-[#D8B87A] ${formatting.titleBold ? "font-semibold" : "font-normal"} ${pageBlockTextAlignClass(formatting.titleAlignment)}`}>
                  {item.title}
                </h3>
              ) : null}

              {presentation.collectionView.cardVariant !== "compact" &&
              itemDisplay.excerpt ? (
                <p className={`mt-3 min-h-[72px] line-clamp-3 text-xs leading-6 text-white/48 ${formatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.excerptAlignment)}`}>
                  {item.excerpt}
                </p>
              ) : null}

              {itemDisplay.details.visible ? (
                <span className={`mt-auto block w-full pt-5 text-xs text-[#D8B87A] ${itemDisplay.details.bold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(itemDisplay.details.alignment)}`}>
                  {itemDisplay.details.text || FEATURED_ACTION_LABELS[item.type]} ←
                </span>
              ) : null}
            </article>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
