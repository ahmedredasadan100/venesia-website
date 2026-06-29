"use client";

import { useCallback, useEffect, useRef } from "react";

export const SLIDER_SWIPE_THRESHOLD_PX = 48;

type UseSwipeSliderOptions = {
  enabled?: boolean;
  threshold?: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

export function useSwipeSlider<T extends HTMLElement = HTMLElement>({
  enabled = true,
  threshold = SLIDER_SWIPE_THRESHOLD_PX,
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeSliderOptions) {
  const containerRef = useRef<T | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (!enabled) return;
      const touch = event.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [enabled],
  );

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!enabled || !start) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaX) < threshold) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

      if (deltaX < 0) onSwipeLeft();
      else onSwipeRight();
    },
    [enabled, onSwipeLeft, onSwipeRight, threshold],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !enabled) return;

    const onTouchMove = (event: TouchEvent) => {
      const start = touchStartRef.current;
      if (!start) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 12) {
        event.preventDefault();
      }
    };

    element.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => element.removeEventListener("touchmove", onTouchMove);
  }, [enabled]);

  return {
    containerRef,
    swipeHandlers: {
      onTouchStart,
      onTouchEnd,
    },
  };
}
