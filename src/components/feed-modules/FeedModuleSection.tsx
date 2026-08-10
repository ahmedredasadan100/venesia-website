import SidebarCategoriesWidget from "../sidebar-feeds/SidebarCategoriesWidget";
import SidebarLatestArticlesWidget from "../sidebar-feeds/SidebarLatestArticlesWidget";
import SidebarMostReadWidget from "../sidebar-feeds/SidebarMostReadWidget";
import SidebarSeriesWidget from "../sidebar-feeds/SidebarSeriesWidget";
import type { ResolvedFeedModule } from "../../lib/feed-modules/types";

type FeedModuleSectionProps = {
  module: ResolvedFeedModule;
};

function isEmptyPayload(module: ResolvedFeedModule) {
  if (module.payload.kind === "articles") return module.payload.items.length === 0;
  if (module.payload.kind === "categories") return module.payload.items.length === 0;
  return module.payload.items.length === 0;
}

export default function FeedModuleSection({ module }: FeedModuleSectionProps) {
  if (module.presentation.emptyBehavior === "hide" && isEmptyPayload(module)) {
    return null;
  }

  const { presentation, payload, feedType } = module;

  if (payload.kind === "categories") {
    return (
      <SidebarCategoriesWidget
        items={payload.items}
        eyebrow={presentation.eyebrow ?? "Categories"}
        title={presentation.title}
      />
    );
  }

  if (payload.kind === "series") {
    return (
      <SidebarSeriesWidget
        items={payload.items}
        eyebrow={presentation.eyebrow ?? "Series"}
        title={presentation.title}
        linkText={presentation.linkText ?? "عرض كل الموضوعات"}
        showImage={presentation.showImage}
        showExcerpt={presentation.showExcerpt}
      />
    );
  }

  if (feedType === "popular") {
    return (
      <SidebarMostReadWidget
        items={payload.items}
        eyebrow={presentation.eyebrow}
        title={presentation.title}
        showImage={presentation.showImage}
        showDate={presentation.showDate}
        showExcerpt={presentation.showExcerpt}
      />
    );
  }

  return (
    <SidebarLatestArticlesWidget
      items={payload.items}
      eyebrow={presentation.eyebrow}
      title={presentation.title}
      showImage={presentation.showImage}
      showDate={presentation.showDate}
      showExcerpt={presentation.showExcerpt}
    />
  );
}
