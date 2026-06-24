import type { MediaHubModuleState } from "./types";

export function buildMediaHubRenderPlan(modules: MediaHubModuleState[]): MediaHubModuleState[] {
  return [...modules]
    .filter((module) => module.isVisible)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.sectionKey.localeCompare(right.sectionKey),
    );
}

export function isPairedHubGridSection(key: MediaHubModuleState["sectionKey"]) {
  return key === "site-updates" || key === "videos";
}

export function shouldRenderHubGridPair(
  current: MediaHubModuleState["sectionKey"],
  next?: MediaHubModuleState["sectionKey"],
) {
  if (!next) return false;
  return isPairedHubGridSection(current) && isPairedHubGridSection(next);
}
