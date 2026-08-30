"use client";

import { useCallback, useEffect, useState } from "react";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { useSwipeSlider } from "./use-swipe-slider";

type UseAutoCarouselOptions = {
  itemCount: number;
  intervalMs?: number;
  enabled?: boolean;
  autoplay?: boolean;
};

const DEFAULT_INTERVAL_MS = 7500;

export function useAutoCarousel<T extends HTMLElement = HTMLElement>({
  itemCount,
  intervalMs = DEFAULT_INTERVAL_MS,
  enabled = true,
  autoplay = true,
}: UseAutoCarouselOptions) {
  const count = Math.max(0, Math.floor(itemCount));
  const resolvedIntervalMs = intervalMs > 0 ? intervalMs : DEFAULT_INTERVAL_MS;
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplayRevision, setAutoplayRevision] = useState(0);
  const canAdvance = enabled && count > 1;
  const boundedIndex = count > 0 ? activeIndex % count : 0;

  const restartAutoplay = useCallback(() => {
    setAutoplayRevision((current) => current + 1);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (!count) return;
      setActiveIndex(((index % count) + count) % count);
      restartAutoplay();
    },
    [count, restartAutoplay],
  );

  const goToNext = useCallback(() => {
    if (!canAdvance) return;
    setActiveIndex((current) => (current + 1) % count);
    restartAutoplay();
  }, [canAdvance, count, restartAutoplay]);

  const goToPrevious = useCallback(() => {
    if (!canAdvance) return;
    setActiveIndex((current) => (current - 1 + count) % count);
    restartAutoplay();
  }, [canAdvance, count, restartAutoplay]);

  useEffect(() => {
    if (!canAdvance || !autoplay || reducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % count);
    }, resolvedIntervalMs);

    return () => window.clearInterval(timer);
  }, [
    autoplay,
    autoplayRevision,
    canAdvance,
    count,
    reducedMotion,
    resolvedIntervalMs,
  ]);

  const { containerRef, swipeHandlers } = useSwipeSlider<T>({
    enabled: canAdvance,
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrevious,
  });

  return {
    activeIndex: boundedIndex,
    canAdvance,
    reducedMotion,
    goTo,
    goToNext,
    goToPrevious,
    containerRef,
    swipeHandlers,
  };
}
