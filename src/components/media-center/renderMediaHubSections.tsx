import type { ReactNode } from "react";
import MediaCenterHubFeatured from "./MediaCenterHubFeatured";
import MediaCenterHubGallery from "./MediaCenterHubGallery";
import MediaCenterHubPress from "./MediaCenterHubPress";
import MediaCenterHubTimeline from "./MediaCenterHubTimeline";
import MediaCenterHubVideos from "./MediaCenterHubVideos";
import {
  buildMediaHubRenderPlan,
  shouldRenderHubGridPair,
} from "../../lib/media-hub-modules/build-media-hub-render-plan";
import type { MediaHubModuleState } from "../../lib/media-hub-modules/types";

function renderHubSection(module: MediaHubModuleState): ReactNode {
  const data = module.sectionData;
  if (!data) return null;

  switch (data.kind) {
    case "featured":
      return data.item ? (
        <MediaCenterHubFeatured
          featuredItem={data.item}
          presentation={module.config.presentation}
        />
      ) : null;
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
  const plan = buildMediaHubRenderPlan(modules);
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < plan.length) {
    const current = plan[index];
    const next = plan[index + 1];

    if (shouldRenderHubGridPair(current.sectionKey, next?.sectionKey)) {
      const timelineFirst = current.sectionKey === "site-updates";
      nodes.push(
        <div
          key={`hub-grid-${current.assignmentId}-${next.assignmentId}-${index}`}
          className="grid gap-8 @5xl/slot-module:grid-cols-[0.95fr_1.05fr]"
        >
          {timelineFirst ? (
            <>
              {renderHubSection(current)}
              {renderHubSection(next)}
            </>
          ) : (
            <>
              {renderHubSection(next)}
              {renderHubSection(current)}
            </>
          )}
        </div>,
      );
      index += 2;
      continue;
    }

    if (current.sectionKey === "site-updates" || current.sectionKey === "videos") {
      nodes.push(
        <div key={`hub-grid-${current.assignmentId}-${index}`} className="grid gap-8 @5xl/slot-module:grid-cols-[0.95fr_1.05fr]">
          {renderHubSection(current)}
        </div>,
      );
      index += 1;
      continue;
    }

    nodes.push(<div key={`hub-section-${current.assignmentId}-${index}`}>{renderHubSection(current)}</div>);
    index += 1;
  }

  return nodes;
}
