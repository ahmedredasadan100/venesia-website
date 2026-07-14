"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  registerPressReset,
  useNeedsInViewReveal,
  useNeedsPressFeedback,
} from "./use-device-capabilities";

export { useNeedsPressFeedback } from "./use-device-capabilities";

/** Treat movement beyond this as scroll, not a press. */
const PRESS_SCROLL_PX = 16;
const PRESS_CLEAR_MS = 220;

/**
 * Ephemeral press visual for links/cards on touch.
 * Does not prevent navigation; clears on up/leave/scroll/cancel/visibility/bfcache.
 */
export function usePressFeedback() {
  const enabled = useNeedsPressFeedback();
  const [pressed, setPressed] = useState(false);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const movedRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (clearTimerRef.current != null) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    startRef.current = null;
    movedRef.current = false;
    activePointerRef.current = null;
    setPressed(false);
  }, []);

  const scheduleClear = useCallback(() => {
    if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(clear, PRESS_CLEAR_MS);
  }, [clear]);

  useEffect(() => {
    if (!enabled) return;
    return registerPressReset(clear);
  }, [clear, enabled]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.pointerType === "mouse") return;
      if (clearTimerRef.current != null) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      movedRef.current = false;
      activePointerRef.current = event.pointerId;
      startRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      };
      setPressed(true);
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || !startRef.current) return;
      if (event.pointerId !== startRef.current.pointerId) return;
      const dx = Math.abs(event.clientX - startRef.current.x);
      const dy = Math.abs(event.clientY - startRef.current.y);
      if (dx > PRESS_SCROLL_PX || dy > PRESS_SCROLL_PX) {
        movedRef.current = true;
        clear();
      }
    },
    [clear, enabled],
  );

  const onPointerUp = useCallback(() => {
    if (!enabled) return;
    scheduleClear();
  }, [enabled, scheduleClear]);

  /** Full reset — cancel must never leave a sticky pressed look. */
  const onPointerCancel = useCallback(() => {
    if (!enabled) return;
    clear();
  }, [clear, enabled]);

  const onPointerLeave = useCallback(() => {
    if (!enabled) return;
    clear();
  }, [clear, enabled]);

  const onClick = useCallback(() => {
    if (!enabled) return;
    scheduleClear();
  }, [enabled, scheduleClear]);

  return {
    enabled,
    pressed,
    pressProps: {
      "data-pressed": pressed ? ("true" as const) : undefined,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onClick,
    },
  };
}

/** One-shot story media reveal on touch/coarse only — desktop stays on :hover. */
export function useTouchInViewReveal(threshold = 0.4) {
  const enabled = useNeedsInViewReveal();
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    let observer: IntersectionObserver | null = null;

    const latch = () => {
      setInView(true);
      observer?.disconnect();
    };

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= threshold)) {
          latch();
        }
      },
      { threshold: [0, threshold, 0.5, 1], rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);

    const rect = node.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    if (rect.height > 0 && visible / rect.height >= threshold) {
      latch();
    }

    return () => observer?.disconnect();
  }, [enabled, threshold]);

  return {
    ref,
    inView,
    inViewProps: {
      "data-in-view": enabled && inView ? ("true" as const) : undefined,
    },
  };
}
