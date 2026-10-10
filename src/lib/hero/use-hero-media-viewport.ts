"use client";
import { useSyncExternalStore } from "react";

const HERO_MOBILE_QUERY = "(max-width: 767px)";
function subscribe(callback: () => void) {
  const query = window.matchMedia(HERO_MOBILE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function snapshot(): "mobile" | "desktop" {
  return window.matchMedia(HERO_MOBILE_QUERY).matches ? "mobile" : "desktop";
}
function serverSnapshot() { return null; }

/** Null SSR snapshot renders the first art-directed image before hydration. */
export function useHeroMediaViewport() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
