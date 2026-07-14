"use client";

import { useSyncExternalStore } from "react";

export type DeviceCapabilities = {
  coarsePointer: boolean;
  finePointer: boolean;
  canHover: boolean;
  hasTouch: boolean;
  /** Ephemeral press visual on links/cards (touch / coarse). */
  needsPressFeedback: boolean;
  /** Story media in-view latch (touch / coarse, not fine-hover desktop). */
  needsInViewReveal: boolean;
  /** Trust sticky open via tap (same audience as press feedback). */
  needsTouchToggle: boolean;
};

const FINE_HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const FINE_POINTER_QUERY = "(pointer: fine)";
const HOVER_QUERY = "(hover: hover)";
const COARSE_QUERIES = [
  "(pointer: coarse)",
  "(any-pointer: coarse)",
  "(hover: none)",
] as const;

const SERVER_CAPABILITIES: DeviceCapabilities = {
  coarsePointer: false,
  finePointer: false,
  canHover: false,
  hasTouch: false,
  needsPressFeedback: false,
  needsInViewReveal: false,
  needsTouchToggle: false,
};

let cachedCapabilities: DeviceCapabilities = SERVER_CAPABILITIES;
let mediaInstalled = false;
const mediaMqs: MediaQueryList[] = [];
const capabilityListeners = new Set<() => void>();

function readCapabilities(): DeviceCapabilities {
  if (typeof window === "undefined" || !window.matchMedia) {
    return SERVER_CAPABILITIES;
  }

  const finePointer = window.matchMedia(FINE_POINTER_QUERY).matches;
  const canHover = window.matchMedia(HOVER_QUERY).matches;
  const fineHover = window.matchMedia(FINE_HOVER_QUERY).matches;
  const coarsePointer = COARSE_QUERIES.some(
    (query) => window.matchMedia(query).matches,
  );
  const hasTouch =
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    coarsePointer;

  const pureFineDesktop = fineHover && !hasTouch && !coarsePointer;
  const needsPressFeedback = !pureFineDesktop && hasTouch;
  const needsInViewReveal = !(fineHover && !coarsePointer) && hasTouch;
  const needsTouchToggle = needsPressFeedback;

  return {
    coarsePointer,
    finePointer,
    canHover,
    hasTouch,
    needsPressFeedback,
    needsInViewReveal,
    needsTouchToggle,
  };
}

function emitCapabilities() {
  cachedCapabilities = readCapabilities();
  capabilityListeners.forEach((listener) => listener());
}

function ensureMediaListeners() {
  if (mediaInstalled || typeof window === "undefined" || !window.matchMedia) {
    return;
  }
  mediaInstalled = true;
  const queries = [FINE_HOVER_QUERY, FINE_POINTER_QUERY, HOVER_QUERY, ...COARSE_QUERIES];
  queries.forEach((query) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", emitCapabilities);
    mediaMqs.push(mq);
  });
  cachedCapabilities = readCapabilities();
}

function teardownMediaListeners() {
  if (!mediaInstalled) return;
  mediaMqs.forEach((mq) => mq.removeEventListener("change", emitCapabilities));
  mediaMqs.length = 0;
  mediaInstalled = false;
}

function subscribeCapabilities(listener: () => void) {
  capabilityListeners.add(listener);
  ensureMediaListeners();
  return () => {
    capabilityListeners.delete(listener);
    if (capabilityListeners.size === 0) {
      teardownMediaListeners();
    }
  };
}

function getCapabilitiesSnapshot() {
  if (!mediaInstalled && typeof window !== "undefined") {
    cachedCapabilities = readCapabilities();
  }
  return cachedCapabilities;
}

function getServerCapabilitiesSnapshot() {
  return SERVER_CAPABILITIES;
}

export function useDeviceCapabilities(): DeviceCapabilities {
  return useSyncExternalStore(
    subscribeCapabilities,
    getCapabilitiesSnapshot,
    getServerCapabilitiesSnapshot,
  );
}

export function useNeedsPressFeedback() {
  return useDeviceCapabilities().needsPressFeedback;
}

export function useNeedsInViewReveal() {
  return useDeviceCapabilities().needsInViewReveal;
}

export function useNeedsTouchToggle() {
  return useDeviceCapabilities().needsTouchToggle;
}

/** Shared page lifecycle: one listener set for all press/reset subscribers. */
const pressResetListeners = new Set<() => void>();
let lifecycleInstalled = false;

function notifyPressReset() {
  pressResetListeners.forEach((listener) => listener());
}

function onPageShow() {
  notifyPressReset();
}

function onPageHide() {
  notifyPressReset();
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    notifyPressReset();
  }
}

function ensureLifecycleListeners() {
  if (lifecycleInstalled || typeof window === "undefined") return;
  lifecycleInstalled = true;
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function teardownLifecycleListeners() {
  if (!lifecycleInstalled) return;
  window.removeEventListener("pageshow", onPageShow);
  window.removeEventListener("pagehide", onPageHide);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  lifecycleInstalled = false;
}

/**
 * Register a reset callback for pageshow / pagehide / visibility.
 * Listeners are installed only while at least one subscriber exists.
 */
export function registerPressReset(listener: () => void) {
  pressResetListeners.add(listener);
  ensureLifecycleListeners();
  return () => {
    pressResetListeners.delete(listener);
    if (pressResetListeners.size === 0) {
      teardownLifecycleListeners();
    }
  };
}
