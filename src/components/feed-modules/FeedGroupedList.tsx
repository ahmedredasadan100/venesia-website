"use client";

import { Children, useCallback, useMemo, useState, type ReactNode } from "react";

import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import FeedCarouselDots from "./FeedCarouselDots";
import {
  chunkFeedListItems,
  FEED_MAX_VISIBLE_DOTS,
} from "./feed-grouped-list-contract";

type FeedGroupedListProps = {
  children: ReactNode;
  itemsPerGroup: number;
  showDots: boolean;
  intervalSeconds: number;
  itemLabel: string;
  className: string;
};

export default function FeedGroupedList({
  children,
  itemsPerGroup,
  showDots,
  intervalSeconds,
  itemLabel,
  className,
}: FeedGroupedListProps) {
  const groups = useMemo(
    () => chunkFeedListItems(Children.toArray(children), itemsPerGroup),
    [children, itemsPerGroup],
  );
  const [userInteracted, setUserInteracted] = useState(false);
  const { activeIndex, canAdvance, goTo, containerRef, swipeHandlers } =
    useAutoCarousel<HTMLDivElement>({
      itemCount: groups.length,
      intervalMs: intervalSeconds * 1000,
      autoplay: !userInteracted,
    });
  const stopAutoAdvance = useCallback(() => setUserInteracted(true), []);
  const selectGroup = useCallback(
    (index: number) => {
      stopAutoAdvance();
      goTo(index);
    },
    [goTo, stopAutoAdvance],
  );
  const activeItems = groups[activeIndex] ?? groups[0] ?? [];

  return (
    <div
      ref={containerRef}
      className="min-w-0 touch-pan-y"
      role="region"
      aria-roledescription="carousel"
      aria-label={`مجموعات ${itemLabel}`}
      data-feed-presentation="list"
      data-feed-grouped-list=""
      data-feed-items-per-group={Math.max(1, Math.floor(itemsPerGroup))}
      data-feed-group-count={groups.length}
      data-feed-active-group={activeIndex}
      data-feed-autoplay={canAdvance && !userInteracted ? "running" : "stopped"}
      onPointerDownCapture={stopAutoAdvance}
      onFocusCapture={stopAutoAdvance}
      onKeyDownCapture={stopAutoAdvance}
      {...swipeHandlers}
    >
      <div
        key={activeIndex}
        className={`${className} motion-safe:animate-[feedCarouselFade_450ms_ease-out]`.trim()}
        role="group"
        aria-label={`مجموعة ${activeIndex + 1} من ${groups.length}`}
        data-feed-visible-group=""
        data-feed-visible-count={activeItems.length}
      >
        {activeItems}
      </div>
      {showDots && canAdvance ? (
        <FeedCarouselDots
          count={groups.length}
          activeIndex={activeIndex}
          onSelect={selectGroup}
          itemLabel={`مجموعات ${itemLabel}`}
          maxVisible={FEED_MAX_VISIBLE_DOTS}
        />
      ) : null}
    </div>
  );
}
