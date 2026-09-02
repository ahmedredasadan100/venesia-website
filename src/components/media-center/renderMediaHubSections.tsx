import type { ReactNode } from "react";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubFeatured from "./MediaCenterHubFeatured";
import MediaCenterHubFeaturedCollection from "./MediaCenterHubFeaturedCollection";
import MediaCenterHubGallery from "./MediaCenterHubGallery";
import MediaCenterHubMosaic from "./MediaCenterHubMosaic";
import MediaCenterHubPress from "./MediaCenterHubPress";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";
import MediaCenterHubTimeline from "./MediaCenterHubTimeline";
import MediaCenterHubVideos from "./MediaCenterHubVideos";
import {
  buildMediaHubRenderPlan,
} from "../../lib/media-hub-modules/build-media-hub-render-plan";
import type { MediaHubModuleState } from "../../lib/media-hub-modules/types";
import { MEDIA_TYPE_PATHS } from "../../lib/media-center/types";
import { resolveCollectionModuleDisplayFormatting } from "../../lib/page-blocks/configs";

function getMediaHubSectionHref(module: MediaHubModuleState) {
  const kind = module.sectionData?.kind;
  if (kind === "site-updates") return "/media-center/site-updates";
  if (kind === "videos") return "/media-center/videos";
  if (kind === "gallery") return "/media-center/gallery";
  if (kind === "press") return "/media-center/press";

  const firstItem = module.sectionData?.items[0];
  return firstItem
    ? `/media-center/${MEDIA_TYPE_PATHS[firstItem.type]}`
    : "/media-center";
}

export function renderMediaHubSection(module: MediaHubModuleState): ReactNode {
  const data = module.sectionData;
  if (!data) return null;
  const layout = module.config.presentation.collectionView.layout;
  const display = module.config.display
    ?? resolveCollectionModuleDisplayFormatting({});

  if (layout === "featured") {
    return data.items.length ? (
      <MediaCenterHubFeaturedCollection
        items={data.items}
        presentation={module.config.presentation}
        display={display}
        href={getMediaHubSectionHref(module)}
      />
    ) : null;
  }

  if (layout === "editorial") {
    return data.items.length ? (
      <MediaCenterHubFeatured
        items={data.items}
        contentHierarchy={module.config.contentHierarchy}
        presentation={module.config.presentation}
        display={display}
        sliderEnabled={data.kind === "featured"}
        showDateWhenAvailable={data.kind === "videos"}
      />
    ) : null;
  }

  if (layout === "mosaic") {
    return data.items.length ? (
      <MediaCenterHubMosaic
        items={data.items}
        contentHierarchy={module.config.contentHierarchy}
        presentation={module.config.presentation}
        display={display}
        href={getMediaHubSectionHref(module)}
        showDateWhenAvailable={data.kind === "videos"}
      />
    ) : null;
  }

  if (data.kind === "featured") {
    return data.items.length ? (
      <section>
        <MediaCenterHubSectionHeader
          presentation={module.config.presentation}
          href={getMediaHubSectionHref(module)}
        />
        <MediaCenterCollectionItems
          items={data.items}
          view={module.config.presentation.collectionView}
          display={display}
        />
      </section>
    ) : null;
  }

  switch (data.kind) {
    case "site-updates":
      return (
        <MediaCenterHubTimeline
          items={data.items}
          presentation={module.config.presentation}
          display={display}
        />
      );
    case "videos":
      return (
        <MediaCenterHubVideos
          items={data.items}
          presentation={module.config.presentation}
          display={display}
        />
      );
    case "gallery":
      return (
        <MediaCenterHubGallery
          items={data.items}
          presentation={module.config.presentation}
          display={display}
        />
      );
    case "press":
      return (
        <MediaCenterHubPress
          items={data.items}
          presentation={module.config.presentation}
          display={display}
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

    return [
      <div key={`media-hub-${module.assignmentId}`} className="h-full">
        {node}
      </div>,
    ];
  });
}
