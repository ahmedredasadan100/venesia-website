"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubPressProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
};

const PRESS_GRID_COLUMNS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @xl/slot-module:grid-cols-2",
  3: "grid-cols-1 @xl/slot-module:grid-cols-2 @5xl/slot-module:grid-cols-3",
  4: "grid-cols-1 @xl/slot-module:grid-cols-2 @5xl/slot-module:grid-cols-4",
};

export default function MediaCenterHubPress({
  items,
  presentation,
}: MediaCenterHubPressProps) {
  const [startIndex, setStartIndex] = useState(0);
  const itemsPerView = presentation.collectionView.itemsPerRow;

  const visibleItems = useMemo(() => {
    if (items.length <= itemsPerView) return items;

    return Array.from({ length: itemsPerView }, (_, index) => {
      return items[(startIndex + index) % items.length];
    });
  }, [items, itemsPerView, startIndex]);

  const canSlide = items.length > itemsPerView;

  function goNext() {
    if (!canSlide) return;
    setStartIndex((current) => (current + 1) % items.length);
  }

  function goPrev() {
    if (!canSlide) return;
    setStartIndex((current) => (current - 1 + items.length) % items.length);
  }

  if (presentation.collectionView.layout !== "carousel") {
    return (
      <section>
        <MediaCenterHubSectionHeader
          presentation={presentation}
          href="/media-center/press"
        />
        <MediaCenterCollectionItems
          items={items}
          view={presentation.collectionView}
        />
      </section>
    );
  }

  return (
    <section className="relative">
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href="/media-center/press"
        actions={canSlide ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="البيان السابق"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              →
            </button>

            <button
              type="button"
              onClick={goNext}
              aria-label="البيان التالي"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              ←
            </button>
          </div>
        ) : undefined}
      />

      <div className={`grid gap-4 ${PRESS_GRID_COLUMNS[itemsPerView]}`}>
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            href={getMediaHref(item)}
            className="group block"
          >
            <article className={`flex h-full flex-col rounded-[1.4rem] border border-white/10 bg-white/[0.035] transition duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/35 ${presentation.collectionView.cardVariant === "compact" ? "p-4" : "p-5"}`}>
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8B87A]/25 bg-[#D8B87A]/10 text-[#D8B87A]">
                ▣
              </div>

              {item.showDateOnPage || item.showCategoryOnPage || item.showSeriesOnPage ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-white/35">
                  {item.showCategoryOnPage && item.category ? <span>{item.category}</span> : null}
                  {item.showSeriesOnPage && item.series ? <span>{item.series}</span> : null}
                  {item.showDateOnPage && item.date ? <span>{item.date}</span> : null}
                </div>
              ) : null}

              <h3 className="mt-3 min-h-[56px] line-clamp-2 text-base font-semibold leading-7 text-white transition group-hover:text-[#D8B87A]">
                {item.title}
              </h3>

              {presentation.collectionView.cardVariant !== "compact" && item.showExcerptOnPage ? (
                <p className="mt-3 min-h-[72px] line-clamp-3 text-xs leading-6 text-white/48">
                  {item.excerpt}
                </p>
              ) : null}

              <span className="mt-auto pt-5 inline-flex text-xs font-medium text-[#D8B87A]">
                قراءة البيان ←
              </span>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
