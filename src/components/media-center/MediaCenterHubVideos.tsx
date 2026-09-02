import type { MediaContentItem } from "../../lib/media-center";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import type { CollectionDisplayOverrides } from "../../lib/page-blocks/configs";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubVideosProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
  display: CollectionDisplayOverrides;
};

export default function MediaCenterHubVideos({
  items,
  presentation,
  display,
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
        showDateWhenAvailable
        display={display}
      />
    </section>
  );
}
