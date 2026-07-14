"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Treat movement beyond this as scroll, not a press. */
const PRESS_SCROLL_PX = 16;
const PRESS_CLEAR_MS = 220;

const TOUCH_MEDIA_QUERIES = [
  "(hover: none)",
  "(pointer: coarse)",
  "(any-pointer: coarse)",
] as const;

function readDeviceFlags() {
  const fineHover = Boolean(
    typeof window !== "undefined" &&
      window.matchMedia?.("(hover: hover) and (pointer: fine)").matches,
  );
  const touchPoints =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const coarseTouch = Boolean(
    typeof window !== "undefined" &&
      window.matchMedia &&
      TOUCH_MEDIA_QUERIES.some((query) => window.matchMedia(query).matches),
  );
  return { fineHover, touchPoints, coarseTouch };
}

/** Ephemeral press feedback: touch/coarse devices. Mouse desktop stays hover-only. */
function readNeedsPressFeedback(): boolean {
  if (typeof window === "undefined") return false;
  const { fineHover, touchPoints, coarseTouch } = readDeviceFlags();
  if (fineHover && !touchPoints && !coarseTouch) return false;
  return touchPoints || coarseTouch;
}

/**
 * Story in-view latch: touch/coarse only.
 * Fine-pointer desktop (even hybrid trackpads) keeps :hover — no data-in-view.
 */
function readNeedsInViewReveal(): boolean {
  if (typeof window === "undefined") return false;
  const { fineHover, touchPoints, coarseTouch } = readDeviceFlags();
  if (fineHover && !coarseTouch) return false;
  return touchPoints || coarseTouch;
}

function subscribeDeviceFlags(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const queries = ["(hover: hover) and (pointer: fine)", ...TOUCH_MEDIA_QUERIES];
  const mqs = queries.map((query) => window.matchMedia(query));
  mqs.forEach((mq) => mq.addEventListener("change", callback));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", callback));
}

function getFalseServerSnapshot() {
  return false;
}

export function useNeedsPressFeedback() {
  return useSyncExternalStore(
    subscribeDeviceFlags,
    readNeedsPressFeedback,
    getFalseServerSnapshot,
  );
}

function useNeedsInViewReveal() {
  return useSyncExternalStore(
    subscribeDeviceFlags,
    readNeedsInViewReveal,
    getFalseServerSnapshot,
  );
}

/**
 * Ephemeral press visual for links/cards on touch.
 * Does not prevent navigation; clears on up/leave/scroll/visibility/bfcache.
 */
export function usePressFeedback() {
  const enabled = useNeedsPressFeedback();
  const [pressed, setPressed] = useState(false);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (clearTimerRef.current != null) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    startRef.current = null;
    setPressed(false);
  }, []);

  const scheduleClear = useCallback(() => {
    if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(clear, PRESS_CLEAR_MS);
  }, [clear]);

  useEffect(() => {
    if (!enabled) return;
    const onPageShow = () => clear();
    const onPageHide = () => clear();
    const onVisibility = () => {
      if (document.visibilityState === "visible") clear();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
    };
  }, [clear, enabled]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.pointerType === "mouse") return;
      if (clearTimerRef.current != null) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
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
        clear();
      }
    },
    [clear, enabled],
  );

  const onPointerUp = useCallback(() => {
    if (!enabled) return;
    scheduleClear();
  }, [enabled, scheduleClear]);

  /** Android may cancel still taps; keep press so the following click can navigate. */
  const onPointerCancel = useCallback(() => {
    if (!enabled) return;
    startRef.current = null;
  }, [enabled]);

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
