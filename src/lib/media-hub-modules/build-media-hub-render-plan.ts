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
