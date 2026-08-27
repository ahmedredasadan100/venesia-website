import type { MediaContentItem } from "../../lib/media-center";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubVideosProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
};

export default function MediaCenterHubVideos({
  items,
  presentation,
}: MediaCenterHubVideosProps) {
  if (!items.length) return null;

  return (
    <section>
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href="/media-center/videos"
      />
      <MediaCenterCollectionItems
        items={items}
        view={presentation.collectionView}
      />
    </section>
  );
}
