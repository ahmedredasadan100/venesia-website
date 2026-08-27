import type { ReactNode } from "react";
import MediaCenterHubFeatured from "./MediaCenterHubFeatured";
import MediaCenterHubGallery from "./MediaCenterHubGallery";
import MediaCenterHubPress from "./MediaCenterHubPress";
import MediaCenterHubTimeline from "./MediaCenterHubTimeline";
import MediaCenterHubVideos from "./MediaCenterHubVideos";
import {
  buildMediaHubRenderPlan,
} from "../../lib/media-hub-modules/build-media-hub-render-plan";
import type { MediaHubModuleState } from "../../lib/media-hub-modules/types";

export function renderMediaHubSection(module: MediaHubModuleState): ReactNode {
  const data = module.sectionData;
  if (!data) return null;
  const hierarchyMode = module.config.contentHierarchy?.mode ?? "uniform";

  if (data.kind === "featured" || hierarchyMode === "featured-first") {
    return data.items.length ? (
      <MediaCenterHubFeatured
        items={data.items}
        contentHierarchy={module.config.contentHierarchy}
        presentation={module.config.presentation}
      />
    ) : null;
  }

  switch (data.kind) {
    case "site-updates":
      return (
        <MediaCenterHubTimeline
          items={data.items}
          presentation={module.config.presentation}
        />
      );
    case "videos":
      return (
        <MediaCenterHubVideos
          items={data.items}
          presentation={module.config.presentation}
        />
      );
    case "gallery":
      return (
        <MediaCenterHubGallery
          items={data.items}
          presentation={module.config.presentation}
        />
      );
    case "press":
      return (
        <MediaCenterHubPress
          items={data.items}
          presentation={module.config.presentation}
        />
      );
    default:
      return null;
  }
}

export function renderMediaHubSections(modules: MediaHubModuleState[]): ReactNode[] {
  return buildMediaHubRenderPlan(modules).flatMap((module) => {
    const node = renderMediaHubSection(module);
    if (node == null) return [];

    return [<div key={`media-hub-${module.assignmentId}`}>{node}</div>];
  });
}
